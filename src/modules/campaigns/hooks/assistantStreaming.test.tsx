import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * Pins the streaming behaviour that makes a reply read smoothly: many tokens landing inside one
 * animation frame produce ONE render, in order, and the buffer never survives a hand-off it
 * should not (a discard bins it; ai:done flushes it before the caret is dropped).
 */

const handlers = new Map<string, (payload: unknown) => void>();

vi.mock('@/core/websocket', () => ({
    default: {
        on: (event: string, handler: (payload: unknown) => void) => handlers.set(event, handler),
        off: (event: string) => handlers.delete(event),
    },
}));
// Mounting hydrates the conversation over REST; an empty transcript is the state these tests
// care about, and answering properly keeps the console free of unhandled-rejection noise.
vi.mock('@/core/http', () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: { data: { id: 'conv-1', status: 'active', messages: [], pendingProposals: [] } },
        }),
        post: vi.fn().mockResolvedValue({ data: { data: {} } }),
        patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

import http from '@/core/http';
import { AI_EVENTS } from '@/shared/types/assistant';
import { useAssistantConversation } from './useAssistantConversation';

const CONV = 'conv-1';

/** Drive requestAnimationFrame by hand so a "frame" is something the test decides. */
let frames: Array<() => void> = [];
beforeEach(() => {
    handlers.clear();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames[id - 1] = () => {}; });
});
/** Mount and let the initial hydrate settle, so no state update lands outside act(). */
const mount = async () => {
    const rendered = renderHook(() => useAssistantConversation(CONV));
    await act(async () => { await Promise.resolve(); });
    return rendered;
};
const paintFrame = () => act(() => { const due = frames; frames = []; due.forEach((f) => f()); });
const emit = (event: string, payload: object) =>
    act(() => { handlers.get(event)?.({ conversationId: CONV, ...payload }); });

describe('assistant token streaming', () => {
    it('coalesces a burst of tokens into one on-screen update, in order', async () => {
        const { result } = await mount();

        for (const token of ['Hi ', 'Raju', '! Great ', 'to hear ', 'from you.']) {
            emit(AI_EVENTS.TOKEN, { token });
        }
        // Nothing is painted until the frame runs — that is what caps the render rate.
        expect(result.current.messages).toHaveLength(0);

        paintFrame();
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].content).toBe('Hi Raju! Great to hear from you.');
        expect(result.current.messages[0].streaming).toBe(true);
    });

    it('appends later frames to the same bubble rather than starting a new one', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOKEN, { token: 'first' });
        paintFrame();
        emit(AI_EVENTS.TOKEN, { token: ' second' });
        paintFrame();

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].content).toBe('first second');
    });

    it('flushes what is buffered before the turn settles, so no words are lost', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOKEN, { token: 'done in the same frame' });
        emit(AI_EVENTS.DONE, { messageId: 'm1' });

        expect(result.current.messages[0].content).toBe('done in the same frame');
        // The caret goes with the turn, not with the next network round-trip.
        expect(result.current.messages[0].streaming).toBe(false);
        expect(result.current.isStreaming).toBe(false);
    });

    it('bins a buffer the server has discarded instead of painting it', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOKEN, { token: 'a rejected sentence' });
        emit(AI_EVENTS.DISCARD, {});
        paintFrame();

        expect(result.current.messages).toHaveLength(0);
    });

    it('ignores tokens belonging to another conversation', async () => {
        const { result } = await mount();

        act(() => { handlers.get(AI_EVENTS.TOKEN)?.({ conversationId: 'someone-else', token: 'nope' }); });
        paintFrame();

        expect(result.current.messages).toHaveLength(0);
    });

    it('treats a question as the end of the turn, so the options card is never greyed out', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOOL_CALL, { tool: 'ask_user', label: 'Thinking about what to ask…' });
        emit(AI_EVENTS.QUESTION, {
            messageId: 'q1',
            questions: [{ id: 'promotion', question: 'What are we promoting?', options: [{ label: 'New launch' }, { label: 'Offer push' }] }],
        });

        // ai:done has NOT arrived yet — the server is a couple of writes behind. Nothing may be
        // left claiming to be running, or the card renders disabled and then flips.
        expect(result.current.questions).toHaveLength(1);
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.activity).toBeNull();
    });

    it('keeps a bubble key when the server trims what was streamed', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOKEN, { token: `Hi Raju!\n` });
        paintFrame();
        const streamedId = result.current.messages[0].id;

        // What the server persists is textBuffer.trim() under a real uuid. The on-screen key has
        // to survive that, or React remounts the bubble the user is already reading.
        vi.mocked(http.get).mockResolvedValueOnce({
            data: {
                data: {
                    id: CONV,
                    status: 'active',
                    pendingProposals: [],
                    messages: [{ id: 'uuid-from-server', role: 'assistant', content: 'Hi Raju!', createdAt: '2026-09-03T07:32:56.367Z' }],
                },
            },
        } as never);

        emit(AI_EVENTS.DONE, { messageId: 'uuid-from-server' });
        await act(async () => { await Promise.resolve(); });

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].id).toBe(streamedId);
        // Trailing whitespace is no longer adopted from the server, because adopting it was a
        // state change for a difference nobody can see: it defeated the identity guard below
        // and re-rendered the whole transcript at the end of every reply ending in a newline.
        // What matters is that the two agree once trimmed — see assistantTurnStability.
        expect(result.current.messages[0].content.trim()).toBe('Hi Raju!');
    });

    it('never drops a reply that is still streaming when the transcript is refetched', async () => {
        const { result } = await mount();

        emit(AI_EVENTS.TOKEN, { token: 'half a sentence so far' });
        paintFrame();
        const streamedId = result.current.messages[0].id;

        // What a mid-turn poll sees: the user's row is persisted, the reply is not yet.
        vi.mocked(http.get).mockResolvedValueOnce({
            data: {
                data: {
                    id: CONV,
                    status: 'active',
                    turnActive: true,
                    pendingProposals: [],
                    messages: [{ id: 'u1', role: 'user', content: 'hello', createdAt: '2026-09-03T07:32:52.216Z' }],
                },
            },
        } as never);

        await act(async () => { await result.current.refresh(CONV, { silent: true }); });

        expect(result.current.messages.map((m) => m.id)).toContain(streamedId);
        expect(result.current.messages.find((m) => m.id === streamedId)?.content).toBe('half a sentence so far');
    });

    it('ignores a refetch that a newer one has already superseded', async () => {
        const { result } = await mount();

        // The slow one was started first and describes the turn BEFORE it finished; the fast
        // one describes the turn after. Applying them in completion order would put the older
        // transcript back on screen, which is the answer blinking out and returning.
        let releaseSlow: (v: unknown) => void = () => {};
        const slow = new Promise((resolve) => { releaseSlow = resolve; });
        vi.mocked(http.get)
            .mockImplementationOnce(async () => {
                await slow;
                return {
                    data: { data: { id: CONV, status: 'active', turnActive: true, pendingProposals: [], messages: [] } },
                } as never;
            })
            .mockResolvedValueOnce({
                data: {
                    data: {
                        id: CONV,
                        status: 'awaiting_input',
                        turnActive: false,
                        pendingProposals: [],
                        messages: [{ id: 'a1', role: 'assistant', content: 'the finished reply', createdAt: '2026-09-03T07:32:56.367Z' }],
                    },
                },
            } as never);

        await act(async () => {
            const first = result.current.refresh(CONV, { silent: true });
            const second = result.current.refresh(CONV, { silent: true });
            await second;
            releaseSlow(null);
            await first;
        });

        expect(result.current.messages.map((m) => m.content)).toEqual(['the finished reply']);
    });

    it('changes nothing when the end-of-turn refetch matches what is already on screen', async () => {
        const { result } = await mount();
        const asked = [{
            id: 'promotion',
            question: 'What are you promoting in this campaign?',
            options: [{ label: 'A product' }, { label: 'A service' }],
            multiSelect: false,
        }];

        emit(AI_EVENTS.TOKEN, { token: 'Got it! Let us start with what you are promoting.' });
        paintFrame();
        emit(AI_EVENTS.QUESTION, { messageId: 'q1', questions: asked });

        const before = result.current.messages;
        expect(before).toHaveLength(2);

        // Exactly what the server holds for those two rows, under its own ids.
        vi.mocked(http.get).mockResolvedValueOnce({
            data: {
                data: {
                    id: CONV,
                    status: 'awaiting_input',
                    turnActive: false,
                    pendingProposals: [],
                    messages: [
                        { id: 'a1', role: 'assistant', content: 'Got it! Let us start with what you are promoting.', createdAt: '2026-09-03T07:32:56.000Z' },
                        { id: 'q1', role: 'event', eventType: 'question', content: asked[0].question, cardPayload: { questions: asked }, createdAt: '2026-09-03T07:32:56.400Z' },
                    ],
                },
            },
        } as never);

        await act(async () => { await result.current.refresh(CONV, { silent: true }); });

        // Same ARRAY, not merely equal contents: React re-renders every bubble otherwise, which
        // is the settled answer visibly reloading itself a second later.
        expect(result.current.messages).toBe(before);
    });
});

describe('rejoining a turn that is already running', () => {
    /** The transcript as it stands when a turn has been sent but not answered yet. */
    const openWith = (detail: Record<string, unknown>) => {
        vi.mocked(http.get).mockResolvedValueOnce({
            data: { data: { id: CONV, status: 'active', pendingProposals: [], messages: [], ...detail } },
        });
        return mount();
    };

    const userRow = { id: 'u1', role: 'user', content: 'hi', createdAt: new Date().toISOString() };

    it('shows the turn as running when the server says one is', async () => {
        const { result } = await openWith({ turnActive: true, messages: [userRow] });

        // Without this the panel came back to a thread mid-answer with no indicator at all:
        // the user's own message, nothing spinning, and the reply appearing out of nowhere.
        expect(result.current.isStreaming).toBe(true);
    });

    it('shows it for a turn still QUEUED, which turnActive cannot see yet', async () => {
        // The exact case: send, switch away immediately, come back. The worker has not
        // registered the turn, so turnActive is false while a reply is very much owed.
        const { result } = await openWith({ turnActive: false, messages: [userRow] });

        expect(result.current.isStreaming).toBe(true);
    });

    it("stays settled when the last word was the assistant's", async () => {
        const { result } = await openWith({
            turnActive: false,
            messages: [userRow, { id: 'a1', role: 'assistant', content: 'All done.', createdAt: new Date().toISOString() }],
        });

        expect(result.current.isStreaming).toBe(false);
    });

    it('does not paint the tail of a block whose start it missed', async () => {
        const { result } = await openWith({ turnActive: true, messages: [userRow] });

        emit(AI_EVENTS.TOKEN, { token: ' has reached 31.7 lakh people.' });
        paintFrame();

        // A bubble opening mid-sentence, replaced wholesale seconds later, is worse than the
        // thinking row. The real text arrives with the hydrate on ai:done.
        expect(result.current.messages.some((m) => m.streaming)).toBe(false);
        expect(result.current.isStreaming).toBe(true);
    });

    it('starts painting again at the next clean block boundary', async () => {
        const { result } = await openWith({ turnActive: true, messages: [userRow] });

        emit(AI_EVENTS.TOKEN, { token: 'tail of the block we missed' });
        paintFrame();
        expect(result.current.messages.some((m) => m.streaming)).toBe(false);

        // A tool call ends that block; whatever comes next starts from its beginning.
        emit(AI_EVENTS.TOOL_CALL, { tool: 'search_creators', label: 'Finding creators…' });
        emit(AI_EVENTS.TOKEN, { token: 'Here is what I found.' });
        paintFrame();

        const painted = result.current.messages.filter((m) => m.role === 'assistant');
        expect(painted).toHaveLength(1);
        expect(painted[0].content).toBe('Here is what I found.');
    });
});

describe('switching to another conversation', () => {
    const rows = (content: string) => [
        { id: `u-${content}`, role: 'user', content, createdAt: new Date().toISOString() },
    ];
    const detail = (id: string, content: string) => ({
        data: { data: { id, status: 'active', turnActive: false, pendingProposals: [], messages: rows(content) } },
    });

    it('empties the transcript so the thread being left is not left on screen', async () => {
        vi.mocked(http.get).mockResolvedValueOnce(detail(CONV, 'first thread'));
        const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id), {
            initialProps: { id: CONV },
        });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.messages[0].content).toBe('first thread');

        // The second conversation's response never resolves during this test, so what is
        // asserted is precisely what the user sees WHILE it is loading.
        vi.mocked(http.get).mockReturnValueOnce(new Promise(() => {}) as never);
        await act(async () => { rerender({ id: 'conv-2' }); });

        expect(result.current.messages).toHaveLength(0);
        // Empty AND loading, which is what puts the spinner up rather than the empty state.
        expect(result.current.isLoading).toBe(true);
    });

    it('keeps the optimistic first message when a new chat lazily becomes a conversation', async () => {
        const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id), {
            initialProps: { id: null as string | null },
        });
        await act(async () => { await Promise.resolve(); });

        // beginLocalTurn puts the message up before the conversation exists.
        act(() => { result.current.beginLocalTurn('build me a campaign'); });
        expect(result.current.messages).toHaveLength(1);

        // Held pending, so this asserts the state DURING the switch — which is where a clear
        // would do its damage. The server's own copy of the row arrives with the response.
        vi.mocked(http.get).mockReturnValueOnce(new Promise(() => {}) as never);
        await act(async () => { rerender({ id: 'conv-new' }); });

        // null -> an id is the conversation coming INTO existence, not a switch away from one.
        // Clearing here would take the user's own message off screen as they sent it.
        expect(result.current.messages.some((m) => m.content === 'build me a campaign')).toBe(true);
    });

    it('does not let a superseded response put the spinner down early', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        vi.mocked(http.get).mockReturnValueOnce(new Promise((res) => { resolveFirst = res; }) as never);
        const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id), {
            initialProps: { id: CONV },
        });
        await act(async () => { await Promise.resolve(); });

        vi.mocked(http.get).mockReturnValueOnce(new Promise(() => {}) as never);
        await act(async () => { rerender({ id: 'conv-2' }); });

        // The first conversation's response finally lands, for a thread nobody is looking at.
        await act(async () => { resolveFirst(detail(CONV, 'stale')); await Promise.resolve(); });

        // It must not report the load finished — the conversation the user clicked is still
        // coming. Otherwise the loader closes on an empty screen and the answer snaps in after.
        expect(result.current.isLoading).toBe(true);
        expect(result.current.messages).toHaveLength(0);
    });
});
