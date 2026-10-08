import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Send, Square, Loader2, ArrowRight, Clock, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import http from '@/core/http';
import { API } from '@/core/api';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAssistantConversation } from '@/modules/campaigns/hooks/useAssistantConversation';
import { useCampaign } from '@/modules/campaigns/hooks/useCampaigns';
import { AssistantCardView } from './AssistantCardView';
import { AssistantMarkdown } from './AssistantMarkdown';
import { AssistantQuestionCard } from './AssistantQuestionCard';
import { AssistantProposalCard } from './AssistantProposalCard';
import { AssistantCoverImageStep } from './AssistantCoverImageStep';
import { AssistantScriptStep } from './AssistantScriptStep';
import { groupAssistantRows, findCoverAnchorRowId, findProposalAnchorRowId } from './assistantTranscript';
import { shouldAdoptStoredConversation, mayResumeOnCreatePage, readNavigationType, describeRecentRow } from './assistantSession';
import { readCachedIntro, writeCachedIntro, sameIntro } from './assistantIntroCache';
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
    AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/shared/ui/alert-dialog';
import type { AssistantCard, AskUserQuestion } from '@/shared/types/assistant';

/**
 * The agentic campaign assistant.
 *
 * Replaces AIStrategistChat's four-stage wizard with an actual conversation: the model reads
 * this brand's real data, asks only for what it cannot look up, and proposes a campaign the
 * user confirms. There is no local extraction, no hardcoded question order, and no client-side
 * strategy generation — the server is the single brain.
 */

interface AssistantStarter {
    label: string;
    prompt: string;
}

interface RecentConversation {
    id: string;
    title: string | null;
    updatedAt: string;
    messageCount: number;
    /**
     * The campaign this thread produced, if any. Already sent by the list endpoint and
     * previously dropped here — see describeRecentRow for why the row needs it.
     */
    campaignId?: string | null;
    campaignName?: string | null;
    campaignVisibility?: string | null;
}

interface AssistantIntro {
    heading: string;
    /** Absent for brands with history — the heading says enough and the cards get the room. */
    subtitle?: string;
    starters: AssistantStarter[];
}

/**
 * Shown ONLY when GET /ai/assistant/intro fails outright.
 *
 * It used to also cover the wait for that request, which is what made every open of the panel
 * render twice: this generic screen first, then the brand's own one two or three seconds later.
 * A brand-neutral screen is the right thing to show a brand we could not look up; it is the
 * wrong thing to show a brand we are three seconds away from knowing. The wait is now a
 * skeleton (see introPending), and repeat opens paint the cached real intro immediately.
 *
 * The real starters are written server-side from this brand's own history — their usual
 * platform and niche, what they typically spend, their best campaign, their city. A fixed
 * list cannot do that, and showing a jewellery example to a SaaS brand teaches the user that
 * the assistant does not know them. So this fallback says nothing a brand could contradict.
 */
/** Mirrors assertLaunchable: below this a brand script does not satisfy the launch gate. */
const MIN_BRAND_SCRIPT_CHARS = 30;

const FALLBACK_INTRO: AssistantIntro = {
    heading: "Let's build a campaign",
    subtitle: 'Tell me what you are promoting and I will draft it with you.',
    starters: [
        { label: 'Start a campaign', prompt: 'Create a creator campaign for us — recommend the budget and draft it.' },
        { label: 'Launch nationally', prompt: 'Create a Pan-India campaign for a new product launch and draft it.' },
        { label: 'Create a UGC campaign', prompt: 'Create a UGC campaign — authentic creator content we can reuse in our ads.' },
        { label: 'You decide', prompt: 'Decide what our next campaign should be and draft it.' },
    ],
};

export default function AssistantPanel({ campaignId }: { campaignId?: string }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);

    /**
     * The public/private answer given on the dashboard, before this panel existed.
     *
     * CampaignVisibilityModal asks it and navigates to /campaigns/create?visibility=private.
     * The step-by-step builder reads the same param and locks it in; the assistant used to
     * ignore it entirely, so a campaign chosen as private and then built in chat came out
     * public — permanently, because visibility cannot be changed from the chat afterwards.
     * It is sent once, when the conversation is created, and lives on the conversation from
     * there so it survives a reload.
     */
    const requestedVisibility = searchParams.get('visibility') === 'private' ? 'private'
        : searchParams.get('visibility') === 'public' ? 'public'
        : null;

    const [conversationId, setConversationId] = useState<string | null>(null);

    /**
     * "New chat" means a NEW CAMPAIGN, even while the builder is sitting on an existing one.
     *
     * Without this, a new thread started from /campaigns/:id/edit was created with that
     * campaign in scope, so the backend gave it scope `campaign_manage` — and buildToolCatalog
     * drops propose_campaign for a managed conversation, leaving propose_campaign_update as the
     * only write tool the model has. Asked to create a campaign it could not create one: it
     * reached for the single tool available and rewrote the campaign the user was editing.
     * That is how "Pan-India Food & Beverage Launch" became a Visakhapatnam campaign, and it
     * happened again to a draft when a new chat was asked for a "Sports complex" campaign.
     *
     * Detaching means the conversation is created with no campaignId at all, which is what
     * makes it a create-scope thread with a real propose_campaign tool behind it.
     */
    const [detachedFromCampaign, setDetachedFromCampaign] = useState(false);
    const scopedCampaignId = detachedFromCampaign ? undefined : campaignId;

    // True only while checking sessionStorage for a thread to resume, so the empty state does
    // not flash before a restored conversation loads.
    const [isCreating, setIsCreating] = useState(true);
    const [input, setInput] = useState('');
    const [recent, setRecent] = useState<RecentConversation[]>([]);
    // Keyset cursor from the server, not a page number: the list reorders as turns finish, so
    // an offset would re-show rows the user has already scrolled past.
    const [recentCursor, setRecentCursor] = useState<string | null>(null);
    const [recentHasMore, setRecentHasMore] = useState(false);
    const [isLoadingMoreRecent, setIsLoadingMoreRecent] = useState(false);
    /**
     * Seeded synchronously from the per-brand cache so a returning user never sees the generic
     * screen at all — the first paint is already their own. `useState(fn)` matters here: the
     * read has to happen before the first render, not in an effect after it.
     */
    const [intro, setIntro] = useState<AssistantIntro | null>(
        () => readCachedIntro(user?.brandId, campaignId) as AssistantIntro | null,
    );
    /**
     * True only on a genuine cold load — no cached intro for this brand and the request still
     * in flight. Drives the skeleton, which is what replaced showing FALLBACK_INTRO during the
     * wait. It starts false when the cache hit, so nothing ever flickers over a real intro.
     */
    const [introPending, setIntroPending] = useState<boolean>(
        () => readCachedIntro(user?.brandId, campaignId) === null,
    );

    /**
     * Set the moment a NEW campaign is confirmed, so the cover-image step appears immediately
     * rather than waiting on the transcript to re-hydrate. It is only the fast path — what
     * makes the step SURVIVE is `confirmedCampaignId` below.
     */
    const [justConfirmed, setJustConfirmed] = useState<{ campaignId: string; campaignName?: string } | null>(null);

    /**
     * That fast path belongs to ONE conversation, so it dies with it.
     *
     * This panel is not remounted when the user opens another thread or clicks New chat — only
     * `conversationId` changes — so a `justConfirmed` left standing followed them into every
     * conversation afterwards. The cover-image panel for a campaign confirmed in one chat sat at
     * the bottom of an unrelated one, and under the empty state of a brand new chat, still
     * holding the image they had picked. Cleared here; a step that genuinely belongs to the
     * conversation now open is rebuilt from ITS transcript by `confirmedCampaignId` below.
     */
    useEffect(() => {
        setJustConfirmed(null);
    }, [conversationId]);

    /** Campaigns the user chose to skip. Session-scoped: skipping means "not now", not "never". */
    const [coverSkipped, setCoverSkipped] = useState<string[]>([]);
    /** Campaigns whose script step is done with — attached or skipped — so it stops re-offering. */
    const [scriptSettled, setScriptSettled] = useState<string[]>([]);

    /** The row awaiting confirmation. Holding the whole row, not just an id, lets the modal
     *  name the thread being deleted rather than asking about "this chat". */
    const [pendingDelete, setPendingDelete] = useState<RecentConversation | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    /**
     * Whether the transcript is parked at the bottom, i.e. whether the user is following the
     * reply or has scrolled up to read something earlier. Only the former gets auto-scrolled.
     */
    const isPinnedRef = useRef(true);
    const createdRef = useRef(false);
    /** True once Load more has been used, so a refresh stops rewinding the cursor. */
    const hasPagedRecentRef = useRef(false);
    const composerRef = useRef<HTMLTextAreaElement>(null);

    /**
     * Sizes the composer to its content. Without this the single-line textarea's scrollHeight
     * exceeded its height and the browser drew a scrollbar inside the field — the stray arrows
     * in the corner. Overflow only turns on once the content genuinely exceeds the cap.
     */
    const autoSize = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        const next = Math.min(el.scrollHeight, 128);
        el.style.height = `${next}px`;
        el.style.overflowY = el.scrollHeight > 128 ? 'auto' : 'hidden';
    };

    const {
        messages, proposals, questions, activity,
        isStreaming, isLoading, limitNotice,
        sendMessage, beginLocalTurn, cancelLocalTurn, answerQuestions, stop,
        confirmProposal, rejectProposal, saveProposalDraft,
    } = useAssistantConversation(conversationId);

    /**
     * Conversations are created LAZILY, on the first message, and the active one is remembered
     * per builder context.
     *
     * Creating one on mount meant every page load — including an accidental reload — started a
     * fresh empty thread, losing whatever had been said and littering Recent with "New chat, 0
     * messages" rows. Now a reload resumes the thread it was on, and a visit that never sends
     * anything leaves nothing behind.
     */
    const storageKey = `mutiny_assistant_conv:${scopedCampaignId ?? 'new'}`;

    useEffect(() => {
        if (createdRef.current) return;
        createdRef.current = true;

        (async () => {
            try {
                // A fresh visit to Create Campaign opens blank; a RELOAD of it resumes. See
                // shouldAdoptStoredConversation. Checked before anything is fetched, so a fresh
                // visit costs no request either.
                if (!shouldAdoptStoredConversation({ scopedCampaignId, navigationType: readNavigationType() })) {
                    sessionStorage.removeItem(storageKey);
                    return;
                }

                const stored = sessionStorage.getItem(storageKey);
                if (stored) {
                    // Confirm it still exists and belongs to this user before adopting it.
                    const { data } = await http.get(API.ai.assistant.conversation(stored));
                    const detail = data?.data as { campaignId?: string | null } | undefined;
                    // On the create page, a thread that has already produced a campaign must not
                    // come back: resuming it would silently turn this into an edit session for
                    // that campaign. It is finished work, and Recent is where it belongs.
                    if (!scopedCampaignId && detail && !mayResumeOnCreatePage(detail)) {
                        sessionStorage.removeItem(storageKey);
                        return;
                    }
                    setConversationId(stored);
                    return;
                }

                // Nothing under this key, but the campaign may still HAVE a conversation.
                //
                // A campaign built by the assistant starts life in a create-scope thread stored
                // under `:new`, because no campaign existed yet. On confirm the server links
                // that conversation to the new campaign and the panel navigates to
                // /campaigns/:id/edit — where the key becomes `:<campaignId>` and finds nothing.
                // The thread that just built the campaign was still there, still linked, but the
                // panel showed a blank "New chat" and the only way back was hunting through
                // Recent. Ask the server which conversation belongs to this campaign instead.
                const { data } = await http.get(API.ai.assistant.conversations);
                const own = (data?.data as Array<{ id: string; campaignId: string | null; updatedAt: string }> | undefined)
                    ?.filter((c) => c.campaignId === scopedCampaignId)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                if (own) {
                    sessionStorage.setItem(storageKey, own.id);
                    setConversationId(own.id);
                }
            } catch {
                sessionStorage.removeItem(storageKey);
            } finally {
                setIsCreating(false);
            }
        })();
    }, [storageKey, scopedCampaignId]);

    /** Returns the active conversation id, creating one the first time it is needed. */
    const ensureConversation = async (): Promise<string | null> => {
        if (conversationId) return conversationId;
        try {
            const { data } = await http.post(API.ai.assistant.conversations, {
                ...(scopedCampaignId ? { campaignId: scopedCampaignId } : {}),
                // Only on a create-scope thread: an existing campaign's visibility is already
                // set and the chat cannot change it.
                ...(!scopedCampaignId && requestedVisibility ? { visibility: requestedVisibility } : {}),
            });
            const newId = data.data.id as string;
            sessionStorage.setItem(storageKey, newId);
            setConversationId(newId);
            return newId;
        } catch (err) {
            const message = (err as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message;
            toast.error(message || 'Could not start the assistant.');
            return null;
        }
    };

    /**
     * Follow the conversation, the way a chat client does — and only when the user is actually
     * following it.
     *
     * This used to be one line: a SMOOTH scrollTo on every change to `messages`. During a reply
     * that fires on every token, and each call restarts the browser's smooth-scroll animation
     * from wherever the last one had got to, so the viewport never settles — the visible
     * wobble under a streaming answer. It also dragged the user back down mid-sentence whenever
     * they scrolled up to re-read something.
     *
     * So: instant while tokens are landing (the content grows a line at a time, and an
     * animation per line is what shakes), smooth for the discrete arrivals — a new bubble, a
     * question card, a proposal — where the motion is the point. And nothing at all unless the
     * transcript was already at the bottom.
     */
    useEffect(() => {
        isPinnedRef.current = true;
    }, [conversationId]);

    // Read from a ref, not from the dependency list: including `isStreaming` there meant the
    // flag flipping false at the end of a turn scheduled one more smooth scroll of its own, so
    // every reply finished with a small animated lurch after it had already settled.
    const isStreamingRef = useRef(isStreaming);
    isStreamingRef.current = isStreaming;

    /** Height at the last scroll, so an update that changed nothing visible does not scroll. */
    const lastHeightRef = useRef(0);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !isPinnedRef.current) return;
        // State can change without the transcript growing — a refetch that matched what was
        // already there, a status row swapping its contents. Animating a scroll for those makes
        // a settled answer look like it is reloading itself.
        if (el.scrollHeight === lastHeightRef.current) return;
        lastHeightRef.current = el.scrollHeight;
        el.scrollTo({ top: el.scrollHeight, behavior: isStreamingRef.current ? 'auto' : 'smooth' });
    }, [messages, questions, proposals, activity]);

    /**
     * A reply arriving is not a reason to take the scroll position away from the user. 64px of
     * slack keeps "pinned" true through sub-pixel rounding and the caret's own height change.
     */
    const handleTranscriptScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        isPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    };

    // Recent conversations for the rail. Refreshed when a turn settles so a new thread's
    // title (taken from the first message) appears without a reload.
    // Deliberately keyed on conversationId only. Keying it on isStreaming as well refetched
    // the rail at the start and end of every single turn, re-rendering it mid-reply.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await http.get(API.ai.assistant.conversations);
                if (cancelled) return;
                const first: RecentConversation[] = data.data ?? [];
                // Merge rather than replace, so a refresh does not throw away pages the user
                // has already loaded. The freshly-fetched head wins for any id it contains —
                // that is what carries a new title or message count — and everything below it
                // is whatever they had pulled in with Load more.
                setRecent((prev) => {
                    const inHead = new Set(first.map((c) => c.id));
                    return [...first, ...prev.filter((c) => !inHead.has(c.id))];
                });
                // Only adopt the head's cursor while the list IS just the head. Once the user
                // has paged deeper, resetting to page one would make the next Load more refetch
                // rows already on screen — every one deduped away, so the button would look
                // broken. Their deeper cursor stays authoritative.
                if (!hasPagedRecentRef.current) {
                    setRecentCursor(data.meta?.nextCursor ?? null);
                    setRecentHasMore(Boolean(data.meta?.hasMore));
                }
            } catch {
                // The rail is a convenience; failing to load it must not disturb the chat.
            }
        })();
        return () => { cancelled = true; };
    }, [conversationId]);

    /**
     * Deletes the thread the modal is confirming.
     *
     * Deleting the thread you are CURRENTLY reading has to reset the panel as well as the list:
     * leaving conversationId pointing at a deleted row would leave the transcript on screen with
     * every further message failing, and the stale sessionStorage key would restore it on the
     * next visit. The server soft-deletes, so nothing is destroyed.
     */
    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setIsDeleting(true);
        try {
            await http.delete(API.ai.assistant.conversation(id));
            setRecent((prev) => prev.filter((c) => c.id !== id));
            if (conversationId === id) {
                sessionStorage.removeItem(storageKey);
                setConversationId(null);
            }
            setPendingDelete(null);
            toast.success('Chat deleted.');
        } catch {
            toast.error('Could not delete that chat.');
        } finally {
            setIsDeleting(false);
        }
    };

    const loadMoreRecent = async () => {
        if (!recentCursor || isLoadingMoreRecent) return;
        setIsLoadingMoreRecent(true);
        try {
            const { data } = await http.get(API.ai.assistant.conversations, {
                params: { cursor: recentCursor },
            });
            const next: RecentConversation[] = data.data ?? [];
            // Deduped on append: a conversation can move up into the head between pages when a
            // turn finishes, and appending it blindly would render the same thread twice.
            setRecent((prev) => {
                const seen = new Set(prev.map((c) => c.id));
                return [...prev, ...next.filter((c) => !seen.has(c.id))];
            });
            hasPagedRecentRef.current = true;
            setRecentCursor(data.meta?.nextCursor ?? null);
            setRecentHasMore(Boolean(data.meta?.hasMore));
        } catch {
            toast.error('Could not load older chats.');
        } finally {
            setIsLoadingMoreRecent(false);
        }
    };

    // The empty state, written server-side from this brand's real history. Fetched once per
    // mount rather than per conversation: it depends on the brand, not on the open thread.
    useEffect(() => {
        let cancelled = false;
        const brandId = user?.brandId;
        // Re-seed on a scope change (the builder's "New chat" detaches from the campaign, which
        // is a different starter set): show that scope's cached screen rather than leaving the
        // previous scope's starters up while the new ones load.
        const cached = readCachedIntro(brandId, scopedCampaignId) as AssistantIntro | null;
        if (cached) {
            setIntro(cached);
            setIntroPending(false);
        } else {
            setIntroPending(true);
        }
        (async () => {
            try {
                // campaignId matters: with one in scope the assistant can only UPDATE that
                // campaign, so the server returns manage-shaped starters instead of
                // create-shaped ones the tools could not honour.
                const { data } = await http.get(API.ai.assistant.intro, {
                    params: scopedCampaignId ? { campaignId: scopedCampaignId } : undefined,
                });
                if (cancelled) return;
                if (data?.data?.starters?.length) {
                    const fresh = data.data as AssistantIntro;
                    writeCachedIntro(brandId, scopedCampaignId, fresh);
                    // Applied only when it actually differs. A refresh that returns what is
                    // already on screen must not re-render the cards under the user's cursor —
                    // that would be the same visible swap, just with better content.
                    setIntro((prev) => (sameIntro(prev, fresh) ? prev : fresh));
                }
            } catch {
                // Leaves FALLBACK_INTRO showing, which asserts nothing about this brand.
            } finally {
                // Ends the skeleton either way: on failure the neutral fallback is the right
                // screen, and a skeleton that never resolves is worse than a generic prompt.
                if (!cancelled) setIntroPending(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scopedCampaignId, user?.brandId]);

    // Clears the thread without creating anything; the next message starts a real conversation.
    const startNewChat = () => {
        sessionStorage.removeItem(storageKey);
        setConversationId(null);
        setInput('');
        // A new chat is a new campaign — never a second thread that edits the campaign this
        // builder happens to be open on. See detachedFromCampaign above.
        setDetachedFromCampaign(true);
    };

    const send = async () => {
        const text = input.trim();
        if (!text || isStreaming) return;
        setInput('');
        // Sending is an explicit "I am at the bottom now", whatever they had scrolled up to read.
        isPinnedRef.current = true;
        // Collapse back to one line; the value changed programmatically so onChange won't fire.
        requestAnimationFrame(() => autoSize(composerRef.current));
        // Your message and the thinking indicator go up NOW. On a new chat the conversation has
        // to be created first, and doing that before rendering anything left the message you
        // just sent invisible for the whole round-trip.
        const localId = beginLocalTurn(text);
        const id = await ensureConversation();
        if (!id) {
            cancelLocalTurn(localId);
            return;
        }
        void sendMessage(text, id, { localId });
    };

    /**
     * The campaign a confirmed draft still owes a cover image, rebuilt from the PERSISTED
     * transcript rather than remembered from the Confirm click.
     *
     * This used to be plain state written inside handleConfirm, which meant it existed only in
     * the tab that clicked Confirm and only until something cleared it. A reload, a navigation,
     * or opening another thread in between lost the step for good, and nothing anywhere brought
     * it back — leaving a coverless draft and an assistant improvising directions to a dashboard
     * upload page that does not exist. `proposal_confirmed` rows already carry the campaign id,
     * so the offer can be rebuilt from the conversation and now survives all of that.
     */
    const confirmedCampaignId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const m = messages[i];
            if (m.role !== 'event' || m.eventType !== 'proposal_confirmed') continue;
            const payload = m.cardPayload as { campaignId?: string; kind?: string } | null;
            if (!payload?.campaignId) continue;
            // Only a newly CREATED campaign is owed a cover. An update proposal touches one that
            // has already been through this, so it must not re-prompt on every later change.
            // Rows written before `kind` was recorded fall through to the cover check below.
            if (payload.kind && payload.kind !== 'create_campaign') return null;
            return payload.campaignId;
        }
        return null;
    }, [messages]);

    /**
     * Deliberately NOT gated on the campaign being a different one from the page's.
     *
     * It used to also require `confirmedCampaignId !== campaignId`, to avoid yanking someone
     * out of the campaign they were sitting on. But finishCoverStep navigates to
     * /campaigns/:id/edit, so the moment the user opened the AI Strategist tab there the
     * confirmed campaign WAS the page's campaign — and the offer vanished for good. Coming back
     * to the thread showed a draft with no cover and no way to add one from the conversation
     * that created it.
     *
     * The "leave them where they are" concern was only ever about the NAVIGATION, and only
     * about update proposals — which confirmedCampaignId already excludes above. So the guard
     * moves to finishCoverStep, where it belongs, and the card itself comes back.
     */
    const coverCandidateId = confirmedCampaignId
        && !coverSkipped.includes(confirmedCampaignId)
        ? confirmedCampaignId
        : null;

    /**
     * The campaign a post-confirm step would be about.
     *
     * Read from `justConfirmed` first so the row is fetched the moment a draft is created, not
     * only once the transcript re-hydrates — the script step below cannot be decided without it.
     * Skipped when there is nothing to look at (useCampaign is disabled on an empty id).
     */
    const postConfirmId = justConfirmed?.campaignId ?? coverCandidateId;
    const { data: postConfirmCampaign } = useCampaign(postConfirmId ?? '');

    /**
     * A brand-script campaign owes its creators the script, and owes it BEFORE a cover image.
     *
     * The chat collects the script as text before drafting, so this only fires for someone who
     * said they would rather attach a file — assertLaunchable accepts either, but refuses to
     * launch with neither. The campaign row is the authority: the transcript only says a draft
     * was created, not whether a script has since been added in the builder.
     */
    const needsBrandScript = Boolean(
        postConfirmId
        && postConfirmCampaign
        && postConfirmCampaign.scriptType === 'brand'
        && !postConfirmCampaign.scriptFileKey
        && String(postConfirmCampaign.scriptFlow ?? '').trim().length < MIN_BRAND_SCRIPT_CHARS
        && !scriptSettled.includes(postConfirmId),
    );

    const scriptStep = needsBrandScript && postConfirmId
        ? { campaignId: postConfirmId, campaignName: postConfirmCampaign?.name }
        : null;

    /**
     * The cover comes second, and waits for the campaign row before showing at all.
     *
     * Without that wait `justConfirmed` would put the cover step up instantly, the user would
     * skip it and be navigated away, and the script step would never appear — the row that
     * decides between them arrives a moment later.
     */
    const coverStep = scriptStep || (justConfirmed && !postConfirmCampaign)
        ? null
        : justConfirmed
            ?? (coverCandidateId && postConfirmCampaign && !postConfirmCampaign.coverImageUrl
                ? { campaignId: coverCandidateId, campaignName: postConfirmCampaign.name }
                : null);

    const handleConfirm = async (proposalId: string) => {
        const outcome = await confirmProposal(proposalId);
        // A newly created draft no longer jumps straight to the builder. It used to navigate
        // here with no step, which dropped the user on step 1 of the wizard — asking them to
        // re-enter a campaign they had just finished describing in the chat. Instead we ask
        // for the one thing the assistant cannot produce, the cover image, right here; the
        // handoff to the preview happens in finishCoverStep once that is settled.
        //
        // Only for a campaign that is NOT already open. Updating the campaign you are sitting
        // on should leave you where you are; the buttons on the confirmed row give you the way
        // over when you want it, rather than yanking you mid-read.
        if (outcome.campaignId && outcome.campaignId !== campaignId) {
            setJustConfirmed({ campaignId: outcome.campaignId, campaignName: outcome.campaignName });
        }
        return outcome;
    };

    /**
     * Land them on the builder's Preview step with everything already filled in — the campaign
     * is complete at this point, so the only thing left is to look it over and launch.
     *
     * ?tab=manual is required, not cosmetic: without it the builder reopens on this same
     * assistant instead of the wizard.
     */
    /**
     * Settle the script step and fall through to the cover one. No navigation here: the cover
     * step is what hands off to the preview, and jumping away from a half-finished draft is the
     * behaviour the post-confirm flow exists to avoid.
     */
    const finishScriptStep = (uploaded: boolean) => {
        const target = scriptStep?.campaignId;
        if (!target) return;
        if (uploaded) toast.success('Script attached.');
        setScriptSettled((prev) => (prev.includes(target) ? prev : [...prev, target]));
    };

    const finishCoverStep = (uploaded: boolean) => {
        const target = coverStep?.campaignId;
        setJustConfirmed(null);
        if (!target) return;
        if (uploaded) toast.success('Cover image added.');
        // Recorded either way. On skip it stops the step reappearing from the transcript the
        // moment they come back to this chat; on upload it stops a stale cached campaign row
        // (coverImageUrl not yet refetched) briefly re-offering a step already completed.
        setCoverSkipped((prev) => (prev.includes(target) ? prev : [...prev, target]));
        // Already on this campaign's own page: settle the step and stay put. Navigating would
        // throw the user out of whatever they were reading to land them where they already are.
        if (target === campaignId) return;
        navigate(`/campaigns/${target}/edit?tab=manual&step=3&from=ai`);
    };

    // Also excludes an in-flight turn: between creating the conversation and the first token
    // there are briefly no messages, and without this the starter prompts flashed back in
    // underneath the thinking indicator.
    // Deliberately NOT gated on the intro fetch. That request computes the whole brand snapshot
    // server-side, and holding a bare spinner until it returned is what made opening the panel
    // sit on nothing for a second or two. FALLBACK_INTRO is a complete, brand-neutral empty
    // state, so the starters can be on screen and usable immediately and simply sharpen when
    // the brand's own version lands.
    const isEmpty = messages.length === 0 && !isLoading && !isCreating && !isStreaming;

    /**
     * Whether the assistant is visibly working. `activity` only appears once a TOOL starts, so a
     * plain reply — the common case — needs the dots to cover the gap between sending and the
     * first token. Once text is streaming, the caret in the bubble is the indicator and this row
     * stands down; while a question is waiting to be answered, nothing is running at all.
     */
    /**
     * The question currently on screen as the interactive card, so the transcript does not also
     * render it as a plain bubble. Only the newest question can be the live one — that is the
     * same row `hydrate` restores the card from after a reload.
     */
    const liveQuestionRowId = questions
        ? [...messages].reverse().find((m) => m.eventType === 'question')?.id ?? null
        : null;

    /**
     * Pending confirmation cards, grouped by the transcript row each belongs under.
     *
     * They used to render as one block AFTER the whole transcript, which made a card the last
     * thing in the thread rather than a thing offered at a point in it: ask anything else and
     * the draft slid down below the new reply. Anchoring puts each card back where it was
     * offered; anything with no anchor yet still falls to the end, which is its place in that
     * moment.
     */
    const { proposalsByAnchor, unanchoredProposals } = useMemo(() => {
        const byAnchor = new Map<string, typeof proposals>();
        const loose: typeof proposals = [];
        for (const p of proposals) {
            const anchorId = findProposalAnchorRowId(messages, p);
            if (!anchorId) { loose.push(p); continue; }
            const bucket = byAnchor.get(anchorId);
            if (bucket) bucket.push(p);
            else byAnchor.set(anchorId, [p]);
        }
        return { proposalsByAnchor: byAnchor, unanchoredProposals: loose };
    }, [messages, proposals]);

    const coverAnchorRowId = findCoverAnchorRowId(messages, coverStep?.campaignId);

    const { mergedInto, groupContent } = useMemo(() => groupAssistantRows(messages), [messages]);

    const showStatusRow = !questions
        && (activity !== null || (isStreaming && !messages.some((m) => m.streaming)));

    // The server's version wins as soon as it lands; until then the neutral fallback shows,
    // so the panel never renders a claim about this brand that turns out to be wrong.
    const activeIntro = intro ?? FALLBACK_INTRO;
    // Cold load only: no cached intro for this brand and the request still out. Renders the
    // shape of the screen rather than a screen the brand would disagree with.
    const showIntroSkeleton = introPending && intro === null;

    return (
        // Same two-column shell as the original strategist: chat card on the left, rail on the
        // right. The page wrapper is already `flex flex-col flex-1 min-h-0`, so the card sizes
        // itself with dvh rather than a fixed vh height, which previously collapsed the layout.
        // Heights live on the two COLUMNS, never on this wrapper and never as h-full.
        // This element is a `flex-1` item of a column flex parent, and `flex: 1 1 0%` makes
        // flex-basis win over `height` — a height set here is silently dropped, the row then
        // sizes to its tallest content, and `h-full` children faithfully match that. That is
        // what produced a chat card tall enough to bury the transcript off-screen once the
        // Recent rail grew past a handful of rows. Both columns are sized from the VIEWPORT
        // instead, so neither can be stretched by the other's content.
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_clamp(280px,24vw,380px)] gap-4 lg:gap-6 min-h-0 px-0 sm:px-2 animate-fade-in lg:items-start">
            <div className="bg-card border border-border rounded-2xl flex flex-col shadow-sm overflow-hidden h-[calc(100dvh-260px)] min-h-[420px] lg:h-[calc(100dvh-200px)] lg:min-h-[520px]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-[#fedc03] text-black flex items-center justify-center shadow shrink-0">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold">MutinyX AI Strategist</h2>
                        <p className="text-[11px] text-muted-foreground truncate">
                            Knows your campaigns, creators and rates — nothing is created until you confirm
                        </p>
                    </div>
                    <button
                        onClick={startNewChat}
                        className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-secondary transition-colors flex items-center gap-1.5 shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New chat
                    </button>
                </div>

                <div
                    ref={scrollRef}
                    onScroll={handleTranscriptScroll}
                    className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                >
                {(isCreating || isLoading) && messages.length === 0 && !isStreaming ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : null}

                {isEmpty && showIntroSkeleton ? (
                    /* The wait for GET /ai/assistant/intro. Same geometry as the real screen —
                       badge, heading, subtitle, four cards — so nothing moves when it lands. */
                    <div className="max-w-2xl mx-auto w-full px-2 py-8 sm:py-12" aria-busy="true" aria-live="polite">
                        <span className="sr-only">Loading your campaign suggestions</span>
                        <div className="flex flex-col items-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#fedc03] text-black shadow-sm mb-5">
                                <Sparkles className="w-7 h-7" />
                            </div>
                            <div className="h-8 w-64 max-w-full rounded-lg bg-muted animate-pulse" />
                            <div className="h-4 w-80 max-w-full rounded bg-muted animate-pulse mt-3.5" />
                        </div>

                        <div className="h-3 w-24 rounded bg-muted animate-pulse mt-8 mb-3" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-[86px] rounded-xl border border-border bg-card p-3.5">
                                    <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                                    <div className="h-3 w-full rounded bg-muted animate-pulse mt-2.5" />
                                    <div className="h-3 w-2/3 rounded bg-muted animate-pulse mt-1.5" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {isEmpty && !showIntroSkeleton ? (
                    <div className="max-w-2xl mx-auto w-full px-2 py-8 sm:py-12">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#fedc03] text-black shadow-sm mb-5">
                                <Sparkles className="w-7 h-7" />
                            </div>
                            <h2 className="text-2xl sm:text-[28px] font-bold font-display tracking-tight leading-tight">
                                {activeIntro.heading}
                            </h2>
                            {activeIntro.subtitle ? (
                                <p className="text-sm text-muted-foreground mt-2.5 max-w-md mx-auto leading-relaxed">
                                    {activeIntro.subtitle}
                                </p>
                            ) : null}
                        </div>

                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-8 mb-3">
                            Try one of these
                        </p>
                        {/* items-stretch keeps all four cards the same height whatever the prompt
                            length, so a long one no longer leaves its neighbour looking squeezed. */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left items-stretch">
                            {activeIntro.starters.map((starter) => (
                                <button
                                    key={starter.prompt}
                                    type="button"
                                    onClick={async () => {
                                        setInput('');
                                        isPinnedRef.current = true;
                                        const localId = beginLocalTurn(starter.prompt);
                                        const id = await ensureConversation();
                                        if (!id) {
                                            cancelLocalTurn(localId);
                                            return;
                                        }
                                        void sendMessage(starter.prompt, id, { localId });
                                    }}
                                    className="group h-full flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-card hover:bg-secondary hover:border-foreground/30 text-left transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                                >
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {starter.label}
                                        </span>
                                        <span className="block text-[13px] leading-[1.45] text-muted-foreground/90 mt-1">
                                            {starter.prompt}
                                        </span>
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-premium" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {messages.map((m) => {
                    const row = ((): ReactNode => {
                        // Already rendered as part of the assistant bubble above it. See mergedInto.
                        if (mergedInto.has(m.id)) return null;

                        if (m.role === 'event' && m.eventType === 'card') {
                            return <AssistantCardView key={m.id} card={m.cardPayload as AssistantCard} />;
                        }
                        /**
                         * A question the user has already answered still belongs to the assistant.
                         *
                         * These rows used to render as nothing at all: while a question was live it
                         * came from `questions` as the interactive card, and the moment it was
                         * answered the card disappeared and left no trace. The only surviving copy
                         * of the question was the one pasted into the user's own reply — so the
                         * assistant's words showed up on the user's side of the chat, in their
                         * bubble. Now the live one is still the card (skipped here so it is not
                         * shown twice) and every answered one stays where it was asked.
                         */
                        if (m.role === 'event' && m.eventType === 'question') {
                            if (m.id === liveQuestionRowId) return null;
                            const asked = (m.cardPayload as { questions?: AskUserQuestion[] } | null)?.questions;
                            const text = asked?.length
                                ? asked.map((q) => q.question).join('\n')
                                : m.content;
                            return (
                                <div key={m.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#fedc03] flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles className="w-3.5 h-3.5 text-black" />
                                    </div>
                                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-6 bg-card border border-border">
                                        <AssistantMarkdown content={text} />
                                    </div>
                                </div>
                            );
                        }

                        // A confirmed proposal is the one event worth more than a grey caption: it
                        // means a campaign now exists or changed, and the user needs a way to reach
                        // it. Rendered from the persisted row rather than local state, so it is
                        // still here after a reload or when the thread is reopened from Recent.
                        if (m.role === 'event' && m.eventType === 'proposal_confirmed') {
                            const outcomeCampaignId = (m.cardPayload as { campaignId?: string } | null)?.campaignId;
                            return (
                                <Fragment key={m.id}>
                                    <div className="rounded-xl border border-border bg-card p-3.5">
                                        <p className="text-[13px] leading-snug">{m.content}</p>
                                        {outcomeCampaignId ? (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <Link
                                                    to={`/campaigns/${outcomeCampaignId}/edit?tab=manual&step=3&from=ai`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-premium"
                                                >
                                                    Open in builder
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                                <Link
                                                    to={`/campaigns/${outcomeCampaignId}`}
                                                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium"
                                                >
                                                    View campaign
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                    {/* The cover-image step, in the place it was actually offered:
                                        under the confirmation for the campaign it is about, not
                                        pinned to the bottom of the thread where a later message
                                        would push past it. */}
                                    {scriptStep && m.id === coverAnchorRowId ? (
                                    <AssistantScriptStep
                                        key={scriptStep.campaignId}
                                        campaignId={scriptStep.campaignId}
                                        campaignName={scriptStep.campaignName}
                                        onDone={finishScriptStep}
                                    />
                                ) : null}
                                {coverStep && m.id === coverAnchorRowId ? (
                                        <AssistantCoverImageStep
                                            key={coverStep.campaignId}
                                            campaignId={coverStep.campaignId}
                                            campaignName={coverStep.campaignName}
                                            onDone={finishCoverStep}
                                        />
                                    ) : null}
                                </Fragment>
                            );
                        }

                        if (m.role === 'event') {
                            return (
                                <p key={m.id} className="text-[11px] text-muted-foreground text-center py-1">
                                    {m.content}
                                </p>
                            );
                        }

                        const isUser = m.role === 'user';

                        if (isUser) {
                            return (
                                <div key={m.id} className="flex justify-end">
                                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-foreground text-background whitespace-pre-wrap">
                                        {m.content}
                                    </div>
                                </div>
                            );
                        }

                        // This row leads a group of adjacent assistant rows; they share one bubble.
                        const group = groupContent.get(m.id);
                        return (
                            <div key={m.id} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#fedc03] flex items-center justify-center shrink-0 mt-0.5">
                                    <Sparkles className="w-3.5 h-3.5 text-black" />
                                </div>
                                {/* Rendered as markdown: the model emits **bold** and numbered lists,
                                    which previously showed as literal asterisks in the transcript. */}
                                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-6 bg-card border border-border">
                                    <AssistantMarkdown content={group?.text ?? m.content} />
                                    {(group?.streaming ?? m.streaming) ? (
                                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#fedc03] align-middle animate-pulse" />
                                    ) : null}
                                </div>
                            </div>
                        );
                    })();

                    // Any confirmation card raised at this row renders directly beneath it, so
                    // it stays put when the conversation carries on past it.
                    const anchored = proposalsByAnchor.get(m.id);
                    if (!anchored?.length) return row;
                    return (
                        <Fragment key={m.id}>
                            {row}
                            {anchored.map((p) => (
                                <AssistantProposalCard
                                    key={p.id}
                                    proposal={p}
                                    onConfirm={handleConfirm}
                                    onReject={rejectProposal}
                                    onSaveDraft={saveProposalDraft}
                                />
                            ))}
                        </Fragment>
                    );
                })}

                {/* Only the ones with nothing to anchor to yet — the moment between the tool
                    call landing and the transcript re-hydrating. Everything else is rendered
                    inline above, at the row where it was offered. */}
                {unanchoredProposals.map((p) => (
                    <AssistantProposalCard
                        key={p.id}
                        proposal={p}
                        onConfirm={handleConfirm}
                        onReject={rejectProposal}
                        onSaveDraft={saveProposalDraft}
                    />
                ))}

                {/* The final step of a create flow: the campaign exists, so the cover image can
                    now be uploaded to it, and only then do we hand off to the preview.

                    Only reached in the moment between the Confirm click and the transcript
                    re-hydrating, when there is no confirmed row to sit under yet — and the end of
                    the thread is where it belongs then anyway. Once the row lands the panel is
                    rendered inline with it above, so a later message can no longer push past it.

                    Keyed by campaign at both sites: the picked file and its preview live inside
                    this component, and without a key React reuses the same instance when the
                    step switches to a different campaign — so an image chosen for one campaign
                    would be sitting there, ready to upload, against another. */}
                {scriptStep && !coverAnchorRowId ? (
                    <AssistantScriptStep
                        key={scriptStep.campaignId}
                        campaignId={scriptStep.campaignId}
                        campaignName={scriptStep.campaignName}
                        onDone={finishScriptStep}
                    />
                ) : null}

                {coverStep && !coverAnchorRowId ? (
                    <AssistantCoverImageStep
                        key={coverStep.campaignId}
                        campaignId={coverStep.campaignId}
                        campaignName={coverStep.campaignName}
                        onDone={finishCoverStep}
                    />
                ) : null}

                {questions ? (
                    <AssistantQuestionCard questions={questions} onSubmit={answerQuestions} />
                ) : null}

                {/*
                    ONE status row for the whole turn, never two elements taking turns.

                    The thinking dots and the running-tool line used to be separate blocks with
                    different shapes: the dots carried the avatar and a bubble, the tool line was
                    a bare 14px caption. Every tool call therefore collapsed a 44px row to an 18px
                    one and back — the transcript jumped, and with it the scroll position, several
                    times in a single turn. Same row, same height, same avatar throughout; only
                    what is INSIDE the bubble changes.
                */}
                {showStatusRow ? (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#fedc03] flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-black" />
                        </div>
                        <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 min-h-[42px] flex items-center gap-2">
                            {activity ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                        {activity.summary ?? activity.label}
                                    </span>
                                </>
                            ) : (
                                <span className="flex items-center gap-1.5 py-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                                </span>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

                <div className="border-t border-border p-3 bg-card shrink-0">
                    {/* A quota block is a standing condition, so it is stated here rather than
                        in a toast that vanishes. Without it, running out of messages is
                        indistinguishable from the assistant being broken: you type, nothing
                        comes back, you type again. */}
                    {limitNotice ? (
                        <div className="mb-2.5 rounded-lg border border-[#fedc03] bg-[#fedc03]/10 px-3 py-2">
                            <p className="text-[12px] leading-snug font-medium">{limitNotice}</p>
                            <Link
                                to="/subscription"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1.5 hover:underline"
                            >
                                See plans
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    ) : null}
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={composerRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                autoSize(e.target);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                            rows={1}
                            placeholder={questions ? 'Or type your own answer…' : 'Tell me about your campaign…'}
                            className="flex-1 min-w-0 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-6 max-h-32 overflow-y-hidden focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 disabled:opacity-50"
                        />
                        {isStreaming ? (
                            <Button size="icon" variant="outline" onClick={() => void stop()} title="Stop" className="shrink-0 rounded-xl">
                                <Square className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                onClick={send}
                                disabled={!input.trim()}
                                className="shrink-0 rounded-xl bg-[#fedc03] text-black hover:bg-[#f0d000]"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        Nothing is created until you confirm it.
                    </p>
                </div>
            </div>

            {/* Right rail. A flex column rather than stacked blocks: "What I can do" keeps its
                natural height and Recent takes every remaining pixel, instead of both sitting at
                the top of a full-height column with dead space underneath. */}
            <div className="flex flex-col gap-4 min-h-0 pr-1 lg:h-[calc(100dvh-200px)] lg:min-h-[520px]">
                <div className="bg-card border border-border rounded-2xl p-4 shrink-0">
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> What I can do
                    </p>
                    <ul className="space-y-1.5">
                        {[
                            'Look up how your past campaigns performed',
                            'Find real creators and score their fit',
                            'Quote real market rates for your budget',
                            'Draft the campaign for you to confirm',
                        ].map((item) => (
                            <li key={item} className="text-[11px] text-muted-foreground flex gap-1.5">
                                <span className="text-[#fedc03] shrink-0">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {recent.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 lg:flex-1">
                        <div className="px-4 py-3 border-b border-border shrink-0">
                            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Recent
                            </p>
                        </div>
                        {/* Scrolls rather than truncating. The list used to be sliced to six with
                            no way to reach the rest, so older threads were simply unreachable.
                            On desktop it fills the rail; stacked under the chat it caps instead,
                            so it cannot push the composer off a short screen. */}
                        <div className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto custom-scrollbar max-h-[50vh] lg:max-h-none">
                            {/* A row is a div holding two sibling buttons, not one button wrapping
                                another — nesting them is invalid HTML and the inner click target
                                behaves unpredictably. The delete button also stops propagation so
                                asking to delete a thread never opens it first. */}
                            {recent.map((session) => {
                                const row = describeRecentRow(session);
                                return (
                                <div
                                    key={session.id}
                                    className={cn(
                                        'group/row flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-secondary',
                                        session.id === conversationId && 'bg-secondary',
                                    )}
                                >
                                    <button
                                        onClick={() => {
                                            sessionStorage.setItem(storageKey, session.id);
                                            setConversationId(session.id);
                                        }}
                                        className="flex-1 min-w-0 text-left px-2.5 py-2 flex items-center gap-2"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                <span className="block text-xs font-medium truncate">
                                                    {row.title}
                                                </span>
                                                {/* Private is the one that costs something to get
                                                    wrong, so it is the one that carries a colour. */}
                                                {row.badge ? (
                                                    <span className={cn(
                                                        'shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                                                        row.badge === 'Private'
                                                            ? 'bg-[#fedc03] text-black'
                                                            : 'bg-secondary text-muted-foreground',
                                                    )}>
                                                        {row.badge}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="block text-[10px] text-muted-foreground truncate">
                                                {row.meta}
                                            </span>
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete chat "${row.title}"`}
                                        title="Delete chat"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingDelete(session);
                                        }}
                                        // Always reachable by keyboard and on touch, where there is
                                        // no hover to reveal it; only the fade is hover-driven.
                                        className="shrink-0 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                );
                            })}
                        </div>

                        {recentHasMore ? (
                            <div className="px-2 pb-2 shrink-0 border-t border-border pt-2">
                                <button
                                    type="button"
                                    onClick={loadMoreRecent}
                                    disabled={isLoadingMoreRecent}
                                    className="w-full text-center px-2.5 py-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isLoadingMoreRecent ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    {isLoadingMoreRecent ? 'Loading…' : 'Load older chats'}
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <AlertDialog
                open={pendingDelete !== null}
                // Radix fires this for Esc and overlay clicks too. Ignored mid-request so a
                // stray click cannot dismiss the dialog while the delete is still in flight.
                onOpenChange={(open) => { if (!open && !isDeleting) setPendingDelete(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{pendingDelete ? describeRecentRow(pendingDelete).title : 'New chat'}&rdquo; and its{' '}
                            {pendingDelete?.messageCount ?? 0} message
                            {pendingDelete?.messageCount === 1 ? '' : 's'} will be removed from your
                            list. Any campaign already created from it is not affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                // Radix closes the dialog on action click by default; prevented so
                                // it stays open showing progress, and closes only on success.
                                e.preventDefault();
                                void confirmDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            {isDeleting ? 'Deleting…' : 'Delete chat'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
