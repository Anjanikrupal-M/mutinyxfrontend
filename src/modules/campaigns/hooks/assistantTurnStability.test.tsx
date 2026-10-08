import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * Pins the two things that made a settled reply appear to reload itself.
 *
 * Both are about the refetch that lands at the end of every turn. By then the transcript on
 * screen is already correct, so that refetch must change nothing: same array, same row ids.
 * When it changed either, React re-rendered — or worse, remounted and replayed the entry
 * animation — a second after the answer had finished, which is what users report as flicker.
 */

const handlers = new Map<string, (payload: unknown) => void>();
vi.mock('@/core/websocket', () => ({
    default: {
        on: (event: string, handler: (payload: unknown) => void) => handlers.set(event, handler),
        off: (event: string) => handlers.delete(event),
    },
}));
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
let frames: Array<() => void> = [];
beforeEach(() => {
    handlers.clear();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames[id - 1] = () => {}; });
});

const mount = async () => {
    const rendered = renderHook(() => useAssistantConversation(CONV));
    await act(async () => { await Promise.resolve(); });
    return rendered;
};
const paintFrame = () => act(() => { const due = frames; frames = []; due.forEach((f) => f()); });
const emit = (event: string, payload: object) =>
    act(() => { handlers.get(event)?.({ conversationId: CONV, ...payload }); });

const serverReturns = (messages: Array<Record<string, unknown>>) => {
    (http.get as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
        data: { data: { id: CONV, status: 'active', pendingProposals: [], messages } },
    });
};
const row = (id: string, content: string) => ({
    id, role: 'assistant', content, createdAt: new Date().toISOString(),
});
/** ai:done, plus the silent refetch it triggers. */
const finishTurn = async () => {
    await act(async () => {
        handlers.get(AI_EVENTS.DONE)?.({ conversationId: CONV });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
};

describe('end-of-turn transcript stability', () => {
    it('ignores a whitespace-only difference between the streamed text and the stored row', async () => {
        const { result } = await mount();

        // The browser keeps every token verbatim; the server persists textBuffer.trim(). A
        // trailing newline from the model is common and must not count as a change.
        for (const t of ['Got it! ', 'What are you promoting in sports?', '\n']) {
            emit(AI_EVENTS.TOKEN, { token: t });
        }
        paintFrame();
        const streamed = result.current.messages;
        expect(streamed).toHaveLength(1);

        serverReturns([row('real-uuid', 'Got it! What are you promoting in sports?')]);
        await finishTurn();

        // The row keeps the key it streamed under, so the bubble is never remounted.
        const settled = result.current.messages;
        expect(settled).toHaveLength(1);
        expect(settled[0].id).toBe(streamed[0].id);

        // And a further refetch of the same rows hands back the SAME array — React skips the
        // render entirely. Before the trim fix this churned on every reply that ended in a
        // newline, re-rendering the whole transcript once the answer had already settled.
        serverReturns([row('real-uuid', 'Got it! What are you promoting in sports?')]);
        await finishTurn();
        expect(result.current.messages).toBe(settled);
    });

    it('gives each text block of a multi-block turn its own bubble, keyed once', async () => {
        const { result } = await mount();

        // Block 1 — a question the model wrote without ask_user behind it.
        emit(AI_EVENTS.TOKEN, { token: 'Got it! What are you promoting in sports?' });
        paintFrame();

        // The unasked-question interceptor keeps that paragraph and persists it, then asks the
        // model again. ai:block_end is how the client learns the block closed and what id it
        // was stored under — without it, block 2 appended into block 1's bubble.
        emit(AI_EVENTS.BLOCK_END, { messageId: 'uuid-1' });

        emit(AI_EVENTS.TOKEN, { token: 'Here are a few directions we could take.' });
        paintFrame();

        const during = result.current.messages;
        expect(during.map((m) => m.content)).toEqual([
            'Got it! What are you promoting in sports?',
            'Here are a few directions we could take.',
        ]);
        expect(during[0].id).toBe('uuid-1');

        const serverRows = [
            row('uuid-1', 'Got it! What are you promoting in sports?'),
            row('uuid-2', 'Here are a few directions we could take.'),
        ];
        serverReturns(serverRows);
        await finishTurn();

        // Two rows, still two rows, and block 1 kept the id it already had. The bug this pins
        // showed ONE bubble holding both blocks run together during the turn, which the refetch
        // then replaced with two freshly-keyed bubbles — a remount, entry animation and all.
        const settled = result.current.messages;
        expect(settled.map((m) => m.content)).toEqual(during.map((m) => m.content));
        expect(settled[0].id).toBe('uuid-1');

        serverReturns(serverRows);
        await finishTurn();
        expect(result.current.messages).toBe(settled);
    });

    it('leaves the transcript alone when block_end arrives after the row is already correct', async () => {
        const { result } = await mount();
        emit(AI_EVENTS.TOKEN, { token: 'A reply.' });
        paintFrame();

        emit(AI_EVENTS.BLOCK_END, { messageId: 'uuid-1' });
        const after = result.current.messages;
        // A duplicate or late event must not re-assign the array.
        emit(AI_EVENTS.BLOCK_END, { messageId: 'uuid-1' });
        expect(result.current.messages).toBe(after);
    });

    it('does not adopt a block id when nothing was streaming', async () => {
        const { result } = await mount();
        const before = result.current.messages;
        emit(AI_EVENTS.BLOCK_END, { messageId: 'uuid-1' });
        expect(result.current.messages).toBe(before);
    });
});
