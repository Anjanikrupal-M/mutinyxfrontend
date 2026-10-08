import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import http from '@/core/http';
import { API } from '@/core/api';
import wsManager from '@/core/websocket';
import {
    AI_EVENTS,
    type AssistantActivity,
    type AssistantCard,
    type AssistantConversationDetail,
    type AssistantMessage,
    type AssistantProposal,
    type AskUserQuestion,
} from '@/shared/types/assistant';

/**
 * Wires REST + socket into one live conversation.
 *
 * REST hydrates durable state (the transcript, pending proposals); the socket layers live
 * events on top. Sending a message deliberately does NOT return the reply — it returns as
 * soon as the message is stored, and the answer streams in over `ai:token`.
 */

interface EventPayload { conversationId: string }

/**
 * Comfortably above the server's own 60s wall-clock cap on a turn, so this only ever fires
 * when a completion event genuinely went missing — never racing a slow but healthy turn.
 */
const STREAM_WATCHDOG_MS = 90_000;

/**
 * The socket is the fast path, not the only path.
 *
 * A live event is expected within a second or two of a turn starting. If none arrives, the
 * panel stops trusting the channel and asks the server directly, on a short interval, until the
 * turn is over. That is the difference between a dead socket costing ninety seconds of blank
 * screen and costing a second and a half — and it is invisible when the socket is healthy,
 * because a single event switches the polling back off.
 */
const SOCKET_QUIET_MS = 4_000;
const POLL_INTERVAL_MS = 2_000;
/**
 * A job sits in the queue briefly before the worker registers it, so `turnActive` is legitimately
 * false for the first moment of a turn. Nothing may be settled on that flag until this has
 * passed, or the panel calls a turn finished before it has started.
 */
const TURN_START_GRACE_MS = 6_000;

export function useAssistantConversation(conversationId: string | null) {
    const queryClient = useQueryClient();

    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    /** What is on screen, readable from callbacks without making them depend on it. */
    const messagesRef = useRef<AssistantMessage[]>([]);
    messagesRef.current = messages;
    const [proposals, setProposals] = useState<AssistantProposal[]>([]);
    const [questions, setQuestions] = useState<AskUserQuestion[] | null>(null);
    const [activity, setActivity] = useState<AssistantActivity | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    /**
     * The daily message cap, once the server has actually refused one.
     *
     * A hard block cannot be reported with a toast. When a brand runs out of messages the POST
     * 403s, the toast shows for a few seconds and then the chat looks exactly like a chat that
     * has stopped working — the user types again, gets nothing again, and concludes the
     * assistant is broken. Held as state so the panel can say so permanently, next to the box
     * they are typing into.
     */
    const [limitNotice, setLimitNotice] = useState<string | null>(null);

    // Held in a ref as well as state: the socket handlers are registered once and would
    // otherwise close over a stale conversationId after the user switches conversations.
    const conversationIdRef = useRef<string | null>(conversationId);
    conversationIdRef.current = conversationId;

    /** The id of the assistant message currently receiving tokens. */
    const streamingIdRef = useRef<string | null>(null);

    /**
     * Tokens that have arrived but are not on screen yet, and the frame that will put them there.
     *
     * The model streams in bursts — several chunks can land inside a single frame — and each one
     * used to be its own setState, so React re-rendered the whole transcript dozens of times a
     * second and the browser never got a clean frame to paint. That is the stutter: text
     * appearing in lurches, the scroll position jumping with it. Buffering into a ref and
     * flushing ONCE per animation frame caps the work at one render per painted frame, which is
     * exactly what a smooth typewriter is. Nothing is delayed by more than ~16ms, and every path
     * that ends or interrupts a block flushes first so ordering is never disturbed.
     */
    const pendingTokensRef = useRef('');
    const flushFrameRef = useRef<number | null>(null);

    /**
     * Sequence number for transcript refetches.
     *
     * A turn's end can start two of them within milliseconds — `ai:done` fires one, and the
     * polling fallback may already have another in flight. They race, and when the OLDER
     * response lands last it reinstates the transcript as it was before the reply finished:
     * the answer and its options blink out and come back when the next one arrives. Responses
     * that are no longer the newest are dropped instead of applied.
     */
    const hydrateSeqRef = useRef(0);

    /** When the socket last delivered anything for the conversation on screen. */
    const lastEventAtRef = useRef(0);
    /** When the turn now in flight was started from this tab. */
    const turnStartedAtRef = useRef(0);

    /**
     * Which conversation the in-flight turn actually belongs to.
     *
     * `conversationIdRef` tracks what is on SCREEN, which is a different question the moment
     * the user opens another thread mid-turn. Without this we cannot tell "the turn I am
     * watching" from "a turn still running in the thread I just left", and the latter left
     * isStreaming stuck true forever — see the reset effect below.
     */
    const streamingConversationIdRef = useRef<string | null>(null);

    /**
     * True when this tab joined a turn that was ALREADY under way, so it missed the start of the
     * block currently streaming.
     *
     * Painting tokens in that state produces a bubble that begins mid-sentence — the tail of a
     * paragraph whose opening went to a tab that was looking at another conversation — and it is
     * then replaced wholesale when the finished row hydrates. The thinking row is the honest
     * thing to show instead. Cleared at the next clean block boundary (a tool call, a card, a
     * question, a discard) or when the turn ends, after which tokens are the start of a block
     * again and paint normally.
     */
    const joinedMidTurnRef = useRef(false);

    /**
     * Which conversation the rows currently ON SCREEN belong to — not which one is selected.
     *
     * The two differ for exactly as long as a switch takes to load, and that gap is what made
     * opening a recent chat feel broken: the transcript was left showing the thread being left,
     * with no spinner (the spinner only appears on an empty transcript), until the response for
     * the new one arrived and replaced it wholesale. The user's read of that is that the click
     * did nothing, and then the page changed under them.
     */
    const renderedConversationIdRef = useRef<string | null>(null);

    const cancelTokenFrame = useCallback(() => {
        if (flushFrameRef.current === null) return;
        cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
    }, []);

    /** Put whatever has buffered on screen NOW. Safe to call when nothing is buffered. */
    const flushTokens = useCallback(() => {
        cancelTokenFrame();
        const buffered = pendingTokensRef.current;
        if (!buffered) return;
        pendingTokensRef.current = '';

        setMessages((prev) => {
            const streamingId = streamingIdRef.current;
            if (streamingId) {
                return prev.map((m) => (m.id === streamingId ? { ...m, content: m.content + buffered } : m));
            }
            // First tokens of a reply: open a placeholder row the rest append into. It is
            // replaced wholesale by the persisted message when `ai:done` arrives.
            const placeholderId = `streaming-${Date.now()}`;
            streamingIdRef.current = placeholderId;
            return [...prev, {
                id: placeholderId,
                role: 'assistant',
                content: buffered,
                createdAt: new Date().toISOString(),
                streaming: true,
            }];
        });
    }, [cancelTokenFrame]);

    /**
     * The turn is over: put down the caret, the dots and the tool line, in one place.
     *
     * Shared by the live events and by the polling fallback, because "the turn ended" has to
     * look identical however the panel found out. The final burst can arrive in the same frame
     * as ai:done, so it flushes first — otherwise a reply ends a word or two short until the
     * next hydrate quietly fills it in.
     */
    const settleTurn = useCallback(() => {
        flushTokens();
        joinedMidTurnRef.current = false;
        setIsStreaming(false);
        setActivity(null);
        streamingIdRef.current = null;
        streamingConversationIdRef.current = null;
        setMessages((prev) => (prev.some((m) => m.streaming)
            ? prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
            : prev));
    }, [flushTokens]);

    /** Throw the buffer away — used when the server discards the block it was streaming. */
    const dropBufferedTokens = useCallback(() => {
        cancelTokenFrame();
        pendingTokensRef.current = '';
    }, [cancelTokenFrame]);

    // A frame scheduled as the panel unmounts would fire into a dead component.
    useEffect(() => cancelTokenFrame, [cancelTokenFrame]);

    const hydrate = useCallback(async (
        id: string,
        opts?: { silent?: boolean; adoptRunningTurn?: boolean },
    ): Promise<AssistantConversationDetail | null> => {
        // Refreshes after a turn settles must not raise the loading flag: doing so blanked the
        // transcript area for a frame on every reply, which reads as a flicker. Only the first
        // load of a conversation shows a spinner.
        if (!opts?.silent) setIsLoading(true);
        const seq = hydrateSeqRef.current + 1;
        hydrateSeqRef.current = seq;
        try {
            const { data } = await http.get(API.ai.assistant.conversation(id));
            const detail = data.data as AssistantConversationDetail;

            // Superseded while this was in flight, or the user moved to another thread. Either
            // way this answer is about a state that is no longer on screen.
            if (seq !== hydrateSeqRef.current) return detail;
            if (conversationIdRef.current !== id) return detail;

            /**
             * Pick up a turn that was already running when this conversation was opened.
             *
             * `isStreaming` is per-tab state, and switching threads deliberately drops it — the
             * turn being watched belongs to the thread being left. But coming BACK to a thread
             * whose turn is still going left the panel with no indicator at all: the transcript
             * ended on the user's own message, nothing was spinning, and the reply simply
             * appeared out of nowhere some seconds later. Worse, none of the machinery that
             * recovers a turn — the polling fallback, the watchdog — runs while isStreaming is
             * false, so a missed completion event had nothing to catch it.
             *
             * Only ever from the code path that OPENS a conversation. The hydrate that follows
             * ai:done must never do this: `clearTurn` runs after the event is emitted, so a
             * response racing that window can still report the turn as live and would re-raise
             * the indicator on a turn that had just finished.
             */
            if (opts?.adoptRunningTurn) {
                const rows = detail.messages ?? [];
                // A turn sitting in the queue has not registered yet, so `turnActive` is
                // legitimately false for its first moment — and that moment is exactly this bug,
                // since it is triggered by switching away straight after sending. A transcript
                // whose last row is the user's own message is owed a reply either way.
                const queued = detail.turnActive !== true;
                if (!queued || rows[rows.length - 1]?.role === 'user') {
                    if (streamingConversationIdRef.current !== id) joinedMidTurnRef.current = true;
                    streamingConversationIdRef.current = id;
                    // Give a queued turn the same grace a locally-started one gets before the
                    // poll is allowed to call it finished, or the first poll settles it before
                    // the worker has picked it up.
                    if (queued) turnStartedAtRef.current = Date.now();
                    setIsStreaming(true);
                }
            }

            setMessages((prev) => {
                const server = detail.messages ?? [];
                // Never replace a populated transcript with an empty one.
                //
                // Sending the first message creates the conversation, which changes
                // conversationId, which triggers this hydrate — often before the POST that
                // persists the message has landed. The server then legitimately reports zero
                // messages, and blindly assigning that wiped the optimistic bubble and flashed
                // the empty state back, which is the flicker. The real rows arrive on ai:done.
                if (server.length === 0 && prev.length > 0) return prev;

                // Carry the on-screen id across for any row whose visible content is unchanged.
                //
                // Every bubble renders with key={m.id}. The optimistic rows are keyed
                // `local-*` / `streaming-*`, and ai:done hydrates the same text back under real
                // UUIDs — so a straight assignment handed React a brand new key for every
                // bubble and remounted the entire transcript at the end of each turn. That is
                // the flash and re-adjust: the reply is already correct on screen, then the
                // whole thread tears down and rebuilds underneath it.
                //
                // The server row still wins on everything that matters (cardPayload, eventType,
                // proposalId); only the key is preserved, and only while the text matches.
                // Matching by POSITION only held while the two lists lined up exactly. They stop
                // lining up the moment the server has a row the optimistic transcript never had
                // — a card event, a reply the loop split across two rows, a tool-carrier bubble
                // — and from that index onwards EVERY key changed, so React tore down and
                // rebuilt the whole tail of the thread. That is the flash-and-re-adjust at the
                // end of a turn. Matching on the row's own content survives insertions anywhere.
                // Duplicates (the same message sent twice) are consumed in order.
                // Trimmed, because the two sides are not byte-identical: the browser holds every
                // token exactly as it streamed, while the server persists `textBuffer.trim()`.
                // A single trailing newline from the model — common — was enough to miss the
                // match, hand that bubble a brand-new key and remount it along with every bubble
                // after it. That is the flash at the end of a reply already correct on screen.
                const rowKey = (role: string, content: string) => `${role} ${content.trim()}`;
                const carried = new Map<string, string[]>();
                for (const m of prev) {
                    const key = rowKey(m.role, m.content);
                    const ids = carried.get(key);
                    if (ids) ids.push(m.id);
                    else carried.set(key, [m.id]);
                }
                const merged = server.map((row) => {
                    const before = carried.get(rowKey(row.role, row.content))?.shift();
                    return before ? { ...row, id: before } : row;
                });

                /**
                 * A reply mid-stream exists only on screen — the server writes the row when the
                 * block finishes — so a refetch that lands during a turn does not contain it.
                 * Assigning the server's list would take the half-written answer off screen and
                 * put it back a second later, which is the text flickering away while it is
                 * being written. Anything still streaming is kept, at the end, where it is.
                 */
                const streamingRows = prev.filter((m) => m.streaming
                    && !merged.some((row) => row.id === m.id));
                const next = streamingRows.length > 0 ? [...merged, ...streamingRows] : merged;

                /**
                 * If nothing visible changed, hand back the SAME array — do not assign a new one.
                 *
                 * A refetch lands at the end of every turn, and by then the transcript on screen
                 * is already correct: the reply streamed in token by token, the card arrived over
                 * the socket. Assigning a fresh array anyway re-rendered every bubble, re-ran the
                 * scroll effect and re-animated the card, a second or two after everything had
                 * settled — the whole answer appearing to reload for no reason. React skips the
                 * render entirely when the state is the object it already holds.
                 */
                // Compared TRIMMED, for the same reason rowKey above matches on trimmed text.
                // The browser holds every token exactly as it streamed; the server persists
                // textBuffer.trim(). A single trailing newline from the model — common — made
                // this check report a difference that does not exist on screen, so the identity
                // guard below never fired: the transcript was re-assigned at the end of every
                // such reply and every bubble re-rendered a beat after it had settled. That is
                // the reply appearing to reload itself. Whitespace-only differences are exactly
                // what must NOT count as a change here.
                const same = next.length === prev.length && next.every((row, i) => {
                    const before = prev[i];
                    return before
                        && before.id === row.id
                        && before.role === row.role
                        && before.content.trim() === row.content.trim()
                        && (before.eventType ?? null) === (row.eventType ?? null)
                        && (before.proposalId ?? null) === (row.proposalId ?? null)
                        && !before.streaming === !row.streaming
                        && JSON.stringify(before.cardPayload ?? null) === JSON.stringify(row.cardPayload ?? null);
                });
                return same ? prev : next;
            });
            // Also identity-stable: assigning a new (usually empty) array on every refetch is a
            // state change React has to render, for no visible difference.
            setProposals((current) => {
                const incoming = detail.pendingProposals ?? [];
                return JSON.stringify(current) === JSON.stringify(incoming) ? current : incoming;
            });

            // A conversation left mid-question must come back still asking it.
            if (detail.status === 'awaiting_input') {
                const lastQuestion = [...(detail.messages ?? [])].reverse()
                    .find((m) => m.eventType === 'question');
                const payload = lastQuestion?.cardPayload as { questions?: AskUserQuestion[] } | undefined;
                const next = payload?.questions ?? null;
                // ask_user emits ai:question and then ai:done, so this runs moments after the
                // chips are already on screen with the very same questions. Handing back a new
                // array remounted the question card for no reason — keep the existing one.
                setQuestions((current) =>
                    JSON.stringify(current) === JSON.stringify(next) ? current : next);
            } else if (detail.turnActive !== true) {
                setQuestions(null);
            }
            // No else: a response fetched WHILE a turn was running describes a moment that may
            // already be out of date — the card can have arrived in the meantime, and clearing
            // it on the strength of a stale read is what made an answered-looking card vanish
            // and come back. Answering already clears it locally, so nothing is left stuck.
            return detail;
        } catch {
            toast.error('Could not load that conversation.');
            return null;
        } finally {
            /**
             * Only the NEWEST hydrate may put the spinner down.
             *
             * Opening a recent chat while a refetch for the previous one was still in flight
             * meant two responses landing in either order. The old one is discarded above — but
             * it still ran this line, so the spinner disappeared while the conversation the user
             * had just clicked was seconds away from arriving. What they saw was the loader
             * closing, the thread they were leaving still on screen, and then the real one
             * snapping in. Whichever hydrate is current clears the flag; a superseded one leaves
             * it exactly as it found it.
             *
             * Not gated on `silent` any more, only on being current: `silent` decides whether a
             * hydrate RAISES the flag, and a silent refetch that supersedes a visible load is
             * the one that has to lower it, or nothing ever does.
             */
            if (seq === hydrateSeqRef.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Drop the live-turn state whenever the turn in flight belongs to a DIFFERENT
        // conversation than the one now on screen.
        //
        // This used to run only for the null case ("New chat"), so opening another thread from
        // Recent mid-turn left isStreaming stuck true: conversationIdRef had already moved to
        // the newly opened thread, so the old turn's ai:done failed the `mine()` filter and was
        // discarded, and nothing else ever cleared the flag. The panel renders its thinking
        // dots from isStreaming and hides the empty state while it is set, so every
        // conversation opened afterwards showed dots until the 90s watchdog fired — which is
        // why it read as a permanent, global loading state rather than a stuck single chat.
        //
        // Comparing against the TURN's own conversation, rather than resetting on any id
        // change, is what keeps the lazy-create path intact: there the id legitimately goes
        // null -> the conversation we have just started streaming into, in the same batch as
        // setIsStreaming(true), and a blind reset would kill the indicator for the turn the
        // user just started.
        if (streamingConversationIdRef.current
            && streamingConversationIdRef.current !== conversationId) {
            // Tokens buffered for the thread being left would otherwise flush into the one now
            // on screen — a stray half-sentence from another conversation.
            dropBufferedTokens();
            streamingConversationIdRef.current = null;
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;
            setIsStreaming(false);
            setActivity(null);
        }

        const leaving = renderedConversationIdRef.current;
        renderedConversationIdRef.current = conversationId;

        if (!conversationId) {
            setMessages([]);
            setProposals([]);
            setQuestions(null);
            return;
        }

        /**
         * Moving BETWEEN two conversations empties the transcript first, so the panel shows a
         * spinner for the one being opened rather than the contents of the one being left.
         *
         * Deliberately not done when `leaving` is null. That is the lazy-create path — a new
         * chat has no id until the first message creates one, and `beginLocalTurn` has already
         * put that message and the thinking indicator on screen; clearing here would take the
         * user's own message away the instant their conversation came into existence.
         */
        if (leaving && leaving !== conversationId) {
            setMessages([]);
            setProposals([]);
            setQuestions(null);
        }

        void hydrate(conversationId, { adoptRunningTurn: true });
    }, [conversationId, hydrate, dropBufferedTokens]);

    /**
     * Last-resort guard against a turn that never reports finishing.
     *
     * The server caps a turn at 60s and always emits ai:done, ai:stopped or ai:error — but if
     * one is missed (socket drop, reconnect mid-turn, an event arriving while the ref pointed
     * at another conversation) nothing else clears isStreaming, and the panel hangs on the
     * dots forever with the response already sitting above them. Re-sync rather than hang.
     */
    useEffect(() => {
        if (!isStreaming) return;
        const timer = setTimeout(() => {
            setIsStreaming(false);
            setActivity(null);
            streamingIdRef.current = null;
            streamingConversationIdRef.current = null;
            joinedMidTurnRef.current = false;
            const id = conversationIdRef.current;
            if (id) void hydrate(id, { silent: true });
        }, STREAM_WATCHDOG_MS);
        return () => clearTimeout(timer);
    }, [isStreaming, hydrate]);

    /**
     * The fallback that makes a missed socket event cost a second and a half instead of ninety.
     *
     * While a turn is in flight, if nothing has arrived over the socket for SOCKET_QUIET_MS, the
     * panel starts asking the server for the conversation on a short interval and settles the
     * turn itself once the server says no turn is running. One live event switches it straight
     * back off, so a healthy socket never polls at all.
     *
     * `turnActive` is the server's own answer, not a guess from the transcript: tool rows are
     * filtered out of the detail, so a turn deep in lookups is indistinguishable from a finished
     * one by content alone.
     */
    useEffect(() => {
        if (!isStreaming) return;

        const timer = setInterval(() => {
            const id = conversationIdRef.current;
            if (!id) return;
            if (Date.now() - lastEventAtRef.current < SOCKET_QUIET_MS) return;

            void (async () => {
                let status: { turnActive?: boolean; messageCount?: number };
                try {
                    const { data } = await http.get(API.ai.assistant.conversationStatus(id));
                    status = data.data ?? {};
                } catch {
                    return; // A failed poll is not news; the next one will tell us.
                }
                if (conversationIdRef.current !== id) return;

                // Something new has been written — a block of the reply, a question, a draft —
                // so pull it in. Counted against the server's own rows only, since the local
                // list also holds the optimistic message and any streaming placeholder.
                const knownRows = messagesRef.current.filter((m) => !m.id.startsWith('local-')
                    && !m.id.startsWith('streaming-')).length;
                const somethingNew = (status.messageCount ?? 0) > knownRows;
                // Only this tab's own turn may be settled this way, and only once the queue has
                // had time to pick it up.
                const finished = status.turnActive === false
                    && Date.now() - turnStartedAtRef.current >= TURN_START_GRACE_MS;

                // One refetch, at most, per poll: the pair this used to fire raced each other.
                if (somethingNew || finished) await hydrate(id, { silent: true });
                if (finished) settleTurn();
            })();
        }, POLL_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [isStreaming, hydrate, settleTurn]);

    // ── Live events ─────────────────────────────────────────────────────────
    useEffect(() => {
        const mine = (payload: unknown): payload is EventPayload => {
            const ours = !!payload
                && typeof payload === 'object'
                && (payload as EventPayload).conversationId === conversationIdRef.current;
            // Any event at all means the live channel is working, which is what the polling
            // fallback below checks before it starts doing the socket's job for it.
            if (ours) lastEventAtRef.current = Date.now();
            return ours;
        };

        const onToken = (payload: unknown) => {
            if (!mine(payload)) return;
            const { token } = payload as EventPayload & { token: string };

            // Claim the turn for this conversation. Tokens can be the first thing we see for a
            // turn this tab did not start (a reload mid-turn, a second tab), and without this
            // the turn would have no owner for the switch-away reset to compare against.
            streamingConversationIdRef.current = conversationIdRef.current;
            setIsStreaming(true);

            // Mid-block arrival: the thinking row stands in until the next block starts, rather
            // than painting a bubble that opens halfway through a sentence. See joinedMidTurnRef.
            if (joinedMidTurnRef.current) return;

            pendingTokensRef.current += token;
            if (flushFrameRef.current === null) {
                flushFrameRef.current = requestAnimationFrame(() => {
                    flushFrameRef.current = null;
                    flushTokens();
                });
            }
        };

        const onToolCall = (payload: unknown) => {
            if (!mine(payload)) return;
            const { tool, label } = payload as EventPayload & { tool: string; label: string };
            flushTokens();
            setActivity({ tool, label });
            // A tool call ends the current text block; the next tokens start a new message.
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;
        };

        const onToolResult = (payload: unknown) => {
            if (!mine(payload)) return;
            const { tool, summary } = payload as EventPayload & { tool: string; summary: string };
            /**
             * ask_user's result summary is "Waiting for your answer" — a description of the
             * card that is about to appear, not of work still going on. Shown in the status
             * row it became a spinner reading "Waiting for your answer", sitting under the
             * user's own reply as though the assistant were stuck. The card speaks for itself.
             */
            if (tool === 'ask_user') return;
            setActivity((prev) => (prev?.tool === tool ? { ...prev, summary } : prev));
        };

        const onCard = (payload: unknown) => {
            if (!mine(payload)) return;
            const { messageId, card } = payload as EventPayload & { messageId: string; card: AssistantCard };
            flushTokens();
            setMessages((prev) => [...prev, {
                id: messageId,
                role: 'event',
                content: card.title,
                eventType: 'card',
                cardPayload: card,
                createdAt: new Date().toISOString(),
            }]);
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;
        };

        /**
         * The server rejected the block it was streaming and is asking the model again.
         *
         * Tokens go out as they arrive but a reply is only judged once it is complete, so a
         * paragraph could type itself out, sit there for several seconds, and then be silently
         * swapped when the turn settled. Removing it the moment it is rejected turns that into
         * the thinking indicator simply carrying on — which is what is really happening.
         */
        const onDiscard = (payload: unknown) => {
            if (!mine(payload)) return;
            // Anything still buffered belongs to the rejected block — bin it rather than
            // painting text the server has already thrown away.
            dropBufferedTokens();
            const discardedId = streamingIdRef.current;
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;
            if (!discardedId) return;
            setMessages((prev) => prev.filter((m) => m.id !== discardedId));
        };

        /**
         * A text block finished and the server has persisted it, while the turn carries on.
         *
         * Two things have to happen, and neither used to: the bubble stops being the one the
         * next tokens append to — otherwise the following block lands inside it and the user
         * reads two paragraphs run together — and it takes the id it will keep, so the refetch
         * at the end of the turn recognises it instead of handing that text a new key and
         * remounting the bubble under the reader. That remount, replaying the entry animation
         * on an answer that had already settled, is what reads as the reply reloading itself.
         */
        const onBlockEnd = (payload: unknown) => {
            if (!mine(payload)) return;
            const { messageId } = payload as EventPayload & { messageId: string };
            flushTokens();
            const finishedId = streamingIdRef.current;
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;
            if (!finishedId || !messageId) return;
            setMessages((prev) => {
                // Already carrying the server's id (a refetch got here first): nothing to do,
                // and re-assigning the array would re-render the transcript for no change.
                if (prev.some((m) => m.id === messageId)) return prev;
                if (!prev.some((m) => m.id === finishedId)) return prev;
                return prev.map((m) => (m.id === finishedId
                    ? { ...m, id: messageId, streaming: false }
                    : m));
            });
        };

        const onQuestion = (payload: unknown) => {
            if (!mine(payload)) return;
            const { messageId, questions: qs } = payload as EventPayload
                & { messageId: string; questions: AskUserQuestion[] };
            flushTokens();
            setQuestions(qs);
            streamingIdRef.current = null;
            joinedMidTurnRef.current = false;

            /**
             * Record the question as a transcript row too, exactly as the server stored it.
             *
             * The card itself is rendered from `questions`, so this row renders as nothing while
             * the question is live — but without it the local transcript is one row short of the
             * server's, and the refetch at the end of the turn therefore always differed and
             * re-rendered the whole thread. With it, that refetch matches what is already on
             * screen and changes nothing at all.
             */
            setMessages((prev) => (prev.some((m) => m.id === messageId) ? prev : [...prev, {
                id: messageId,
                role: 'event',
                content: qs.map((q) => q.question).join(' | '),
                eventType: 'question',
                cardPayload: { questions: qs },
                createdAt: new Date().toISOString(),
            }]));

            /**
             * ask_user ENDS the server's turn — the loop stops and waits for an answer — but
             * `ai:done` only follows a couple of database writes later. In that gap the options
             * card was already on screen while `isStreaming` was still true: it rendered at half
             * opacity and unclickable, with the tool's spinner line still ticking underneath,
             * and then flipped to live a moment later. Nothing is actually running any more, so
             * say so here. The card arrives usable, once, and no status row appears under it.
             */
            setIsStreaming(false);
            setActivity(null);
            streamingConversationIdRef.current = null;
            setMessages((prev) => (prev.some((m) => m.streaming)
                ? prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
                : prev));
        };

        const onProposal = (payload: unknown) => {
            if (!mine(payload)) return;
            const { proposal } = payload as EventPayload & { proposal: AssistantProposal };
            setProposals((prev) => [...prev.filter((p) => p.id !== proposal.id), proposal]);
        };

        const onProposalUpdate = (payload: unknown) => {
            if (!mine(payload)) return;
            const { proposal } = payload as EventPayload & { proposal: AssistantProposal };
            setProposals((prev) => prev.map((p) => (p.id === proposal.id ? proposal : p)));
        };

        const onDone = (payload: unknown) => {
            if (!mine(payload)) return;
            settleTurn();
            // Re-hydrate so the optimistic placeholder is replaced by the real persisted row
            // (with its real id), keeping the transcript consistent across reloads.
            const id = conversationIdRef.current;
            if (id) void hydrate(id, { silent: true });
        };

        const onStopped = (payload: unknown) => {
            if (!mine(payload)) return;
            settleTurn();
            const id = conversationIdRef.current;
            if (id) void hydrate(id, { silent: true });
        };

        const onError = (payload: unknown) => {
            if (!mine(payload)) return;
            const { message } = payload as EventPayload & { code: string; message: string };
            settleTurn();
            toast.error(message || 'The assistant hit an error.');
        };

        wsManager.on(AI_EVENTS.TOKEN, onToken);
        wsManager.on(AI_EVENTS.TOOL_CALL, onToolCall);
        wsManager.on(AI_EVENTS.TOOL_RESULT, onToolResult);
        wsManager.on(AI_EVENTS.CARD, onCard);
        wsManager.on(AI_EVENTS.DISCARD, onDiscard);
        wsManager.on(AI_EVENTS.BLOCK_END, onBlockEnd);
        wsManager.on(AI_EVENTS.QUESTION, onQuestion);
        wsManager.on(AI_EVENTS.PROPOSAL, onProposal);
        wsManager.on(AI_EVENTS.PROPOSAL_UPDATE, onProposalUpdate);
        wsManager.on(AI_EVENTS.DONE, onDone);
        wsManager.on(AI_EVENTS.STOPPED, onStopped);
        wsManager.on(AI_EVENTS.ERROR, onError);

        return () => {
            wsManager.off(AI_EVENTS.TOKEN, onToken);
            wsManager.off(AI_EVENTS.TOOL_CALL, onToolCall);
            wsManager.off(AI_EVENTS.TOOL_RESULT, onToolResult);
            wsManager.off(AI_EVENTS.CARD, onCard);
            wsManager.off(AI_EVENTS.DISCARD, onDiscard);
            wsManager.off(AI_EVENTS.BLOCK_END, onBlockEnd);
            wsManager.off(AI_EVENTS.QUESTION, onQuestion);
            wsManager.off(AI_EVENTS.PROPOSAL, onProposal);
            wsManager.off(AI_EVENTS.PROPOSAL_UPDATE, onProposalUpdate);
            wsManager.off(AI_EVENTS.DONE, onDone);
            wsManager.off(AI_EVENTS.STOPPED, onStopped);
            wsManager.off(AI_EVENTS.ERROR, onError);
        };
    }, [hydrate, flushTokens, dropBufferedTokens, settleTurn]);

    // ── Actions ─────────────────────────────────────────────────────────────

    const appendLocalUserMessage = useCallback((content: string): string => {
        const localId = `local-${Date.now()}`;
        setMessages((prev) => [...prev, {
            id: localId,
            role: 'user',
            content,
            createdAt: new Date().toISOString(),
        }]);
        return localId;
    }, []);

    /**
     * Put the user's message and the thinking indicator on screen BEFORE a conversation exists.
     *
     * A new chat has nothing to send to, so the first message has to create the conversation
     * first — a network round-trip that ran before anything was rendered at all. The message
     * the user had just pressed enter on simply vanished for the length of that request, and
     * appeared, with the loader, only once it came back: on a slow call that is a second or
     * more of staring at a composer that just emptied itself, with no sign anything happened.
     * Showing it first makes the first message behave like every later one. `cancelLocalTurn`
     * takes it back off screen if the conversation cannot be created.
     */
    const beginLocalTurn = useCallback((content: string): string => {
        setQuestions(null);
        // Whatever the last turn was doing is over; leaving its line up makes the new turn look
        // like a continuation of it.
        setActivity(null);
        turnStartedAtRef.current = Date.now();
        setIsStreaming(true);
        return appendLocalUserMessage(content);
    }, [appendLocalUserMessage]);

    const cancelLocalTurn = useCallback((localId: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        setIsStreaming(false);
        streamingConversationIdRef.current = null;
    }, []);

    /**
     * `overrideId` exists because a conversation may be created lazily, in the same tick as the
     * first send. React state (and therefore the ref) has not updated yet at that point, so the
     * caller passes the freshly created id explicitly rather than sending into a stale ref.
     */
    const sendMessage = useCallback(async (content: string, overrideId?: string, opts?: { localId?: string }) => {
        const id = overrideId ?? conversationIdRef.current;
        if (!id || !content.trim()) return;

        // Point the ref at the conversation we are actually sending to, right now, rather than
        // waiting for the re-render that follows setConversationId. Every socket handler
        // filters on this ref, so while it lagged, events for a freshly created conversation —
        // including the ai:done that ends the turn — were discarded as "not mine". That left
        // the reply on screen with the thinking dots still running underneath it.
        conversationIdRef.current = id;

        // beginLocalTurn already put it on screen while the conversation was being created;
        // appending again would show the user their own message twice.
        if (!opts?.localId) {
            appendLocalUserMessage(content.trim());
            setQuestions(null);
        }
        streamingConversationIdRef.current = id;
        setActivity(null);
        turnStartedAtRef.current = Date.now();
        setIsStreaming(true);

        try {
            await http.post(API.ai.assistant.messages(id), { message: content.trim() });
            setLimitNotice(null);
        } catch (err) {
            streamingConversationIdRef.current = null;
            setIsStreaming(false);
            const error = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
                ?.response?.data?.error;
            // A quota refusal is a standing condition, not a passing failure — keep it on screen.
            if (error?.code === 'PLAN_UPGRADE_REQUIRED' || error?.code === 'AI_DAILY_LIMIT_REACHED') {
                setLimitNotice(error.message ?? 'You have reached today’s assistant message limit.');
            } else {
                toast.error(error?.message || 'Could not send that message.');
            }
            void hydrate(id);
        }
    }, [appendLocalUserMessage, hydrate]);

    const answerQuestions = useCallback(async (answers: Array<{ questionId: string; answer: string }>) => {
        const id = conversationIdRef.current;
        if (!id || answers.length === 0) return;

        // Exactly what the server persists: the ANSWER, and nothing else. Their bubble is
        // their side of the conversation — putting the assistant's question in it (as
        // "<question> — <answer>", which is how this used to read) made the assistant appear to
        // speak in the user's voice, on the user's side, while the card that asked it vanished.
        // The question stays where it was asked; the pairing the model needs rides on the row.
        appendLocalUserMessage(answers.map((a) => a.answer).join('\n'));
        setQuestions(null);
        streamingConversationIdRef.current = id;
        setActivity(null);
        turnStartedAtRef.current = Date.now();
        setIsStreaming(true);

        try {
            await http.post(API.ai.assistant.answer(id), { answers });
        } catch (err) {
            streamingConversationIdRef.current = null;
            setIsStreaming(false);
            const message = (err as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message;
            toast.error(message || 'Could not send that answer.');
            void hydrate(id);
        }
    }, [appendLocalUserMessage, hydrate, questions]);

    const stop = useCallback(async () => {
        const id = conversationIdRef.current;
        if (!id) return;

        // Settle on the click rather than on the server's reply. The turn is genuinely
        // cancelled server-side now (a stop landing before the worker starts is recorded and
        // honoured), but waiting for ai:stopped to come back left the dots bouncing and the
        // Stop button live for a beat after a press whose entire point is that something
        // should stop immediately. If tokens somehow keep arriving, onToken re-raises the flag.
        flushTokens();
        streamingConversationIdRef.current = null;
        streamingIdRef.current = null;
        joinedMidTurnRef.current = false;
        setIsStreaming(false);
        setActivity(null);
        setMessages((prev) => (prev.some((m) => m.streaming)
            ? prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
            : prev));

        try {
            await http.post(API.ai.assistant.stop(id));
        } catch {
            // Best effort — the turn also ends on its own wall-clock cap.
        }
    }, [flushTokens]);

    const confirmProposal = useCallback(async (proposalId: string) => {
        const { data } = await http.post(API.ai.assistant.confirmProposal(proposalId));
        setProposals((prev) => prev.filter((p) => p.id !== proposalId));
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        const id = conversationIdRef.current;
        if (id) void hydrate(id);
        return data.data as { campaignId?: string; campaignName?: string; message: string };
    }, [hydrate, queryClient]);

    const rejectProposal = useCallback(async (proposalId: string) => {
        await http.post(API.ai.assistant.rejectProposal(proposalId));
        setProposals((prev) => prev.filter((p) => p.id !== proposalId));
        const id = conversationIdRef.current;
        if (id) void hydrate(id);
    }, [hydrate]);

    const saveProposalDraft = useCallback(async (proposalId: string, formState: Record<string, unknown>) => {
        await http.patch(API.ai.assistant.proposal(proposalId), { formState });
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, formState } : p)));
    }, []);

    return {
        messages,
        proposals,
        questions,
        activity,
        isStreaming,
        isLoading,
        limitNotice,
        sendMessage,
        beginLocalTurn,
        cancelLocalTurn,
        answerQuestions,
        stop,
        confirmProposal,
        rejectProposal,
        saveProposalDraft,
        refresh: hydrate,
    };
}
