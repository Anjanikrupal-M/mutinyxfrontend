import { describe, it, expect } from 'vitest';
import { groupAssistantRows, findCoverAnchorRowId, findProposalAnchorRowId } from './assistantTranscript';
import type { AssistantMessage } from '@/shared/types/assistant';

let seq = 0;
const row = (partial: Partial<AssistantMessage> & { role: AssistantMessage['role'] }): AssistantMessage => ({
    id: `m${(seq += 1)}`,
    content: '',
    createdAt: new Date().toISOString(),
    ...partial,
});

describe('groupAssistantRows', () => {
    it('merges consecutive assistant rows into the first one', () => {
        const a = row({ role: 'assistant', content: 'Let me try again!' });
        const b = row({ role: 'assistant', content: 'The system is not accepting that.' });

        const { mergedInto, groupContent } = groupAssistantRows([a, b]);

        expect(mergedInto.has(b.id)).toBe(true);
        expect(groupContent.get(a.id)?.text).toBe('Let me try again!\n\nThe system is not accepting that.');
        // The bubble keys off the FIRST row, so a block landing underneath extends it rather
        // than remounting it.
        expect(groupContent.has(b.id)).toBe(false);
    });

    it('does not merge across the user\'s own message', () => {
        const a = row({ role: 'assistant', content: 'First reply.' });
        const u = row({ role: 'user', content: 'yes' });
        const b = row({ role: 'assistant', content: 'Second reply.' });

        const { mergedInto, groupContent } = groupAssistantRows([a, u, b]);

        expect(mergedInto.size).toBe(0);
        expect(groupContent.get(a.id)?.text).toBe('First reply.');
        expect(groupContent.get(b.id)?.text).toBe('Second reply.');
    });

    it.each(['card', 'question', 'proposal_confirmed'])('does not merge across a %s event', (eventType) => {
        const a = row({ role: 'assistant', content: 'Before.' });
        const e = row({ role: 'event', eventType, content: 'x' });
        const b = row({ role: 'assistant', content: 'After.' });

        const { mergedInto } = groupAssistantRows([a, e, b]);

        expect(mergedInto.size).toBe(0);
    });

    it('keeps the group open across an empty tool-carrier row', () => {
        // The "text, then a tool call, then more text" turn — the whole reason this exists.
        const a = row({ role: 'assistant', content: 'Looking that up.' });
        const carrier = row({ role: 'assistant', content: '' });
        const b = row({ role: 'assistant', content: 'Here is what came back.' });

        const { mergedInto, groupContent } = groupAssistantRows([a, carrier, b]);

        expect(mergedInto.has(carrier.id)).toBe(true);
        expect(mergedInto.has(b.id)).toBe(true);
        expect(groupContent.get(a.id)?.text).toBe('Looking that up.\n\nHere is what came back.');
    });

    it('carries the caret to whichever block is still streaming', () => {
        const a = row({ role: 'assistant', content: 'Settled.' });
        const b = row({ role: 'assistant', content: 'Still writ', streaming: true });

        const { groupContent } = groupAssistantRows([a, b]);

        expect(groupContent.get(a.id)?.streaming).toBe(true);
    });

    it('leaves a lone assistant row exactly as it was', () => {
        const a = row({ role: 'assistant', content: 'One reply.' });

        const { mergedInto, groupContent } = groupAssistantRows([a]);

        expect(mergedInto.size).toBe(0);
        expect(groupContent.get(a.id)).toEqual({ text: 'One reply.', streaming: false });
    });
    /**
     * The same paragraph twice reads as a rendering fault, not as the assistant repeating
     * itself. A turn writes it when a tool refuses the same call twice — asking to move a
     * deadline, which propose_campaign_update cannot do — and explains itself again verbatim.
     */
    it('drops a block identical to one already in the bubble', () => {
        const said = "I can't move the dates from here — they're edited in the builder.";
        const a = row({ role: 'assistant', content: said });
        const b = row({ role: 'assistant', content: said });

        const { mergedInto, groupContent } = groupAssistantRows([a, b]);

        expect(mergedInto.has(b.id)).toBe(true);
        expect(groupContent.get(a.id)?.text).toBe(said);
    });

    it('keeps two different blocks that merely start alike', () => {
        const a = row({ role: 'assistant', content: 'I cannot move the dates. They live in the builder.' });
        const b = row({ role: 'assistant', content: 'I cannot move the dates. Shall I draft the rest?' });

        const { groupContent } = groupAssistantRows([a, b]);

        expect(groupContent.get(a.id)?.text).toContain('They live in the builder.');
        expect(groupContent.get(a.id)?.text).toContain('Shall I draft the rest?');
    });
});

describe('findCoverAnchorRowId', () => {
    it('finds the confirmed row for the campaign the panel is about', () => {
        const confirmed = row({
            role: 'event', eventType: 'proposal_confirmed', content: 'Campaign "RRR" created.',
            cardPayload: { campaignId: 'camp-1' },
        });
        const later = row({ role: 'user', content: 'hi' });

        expect(findCoverAnchorRowId([confirmed, later], 'camp-1')).toBe(confirmed.id);
    });

    it('ignores a confirmed row for a different campaign', () => {
        const other = row({
            role: 'event', eventType: 'proposal_confirmed', content: 'Campaign "Other" updated.',
            cardPayload: { campaignId: 'camp-2' },
        });

        expect(findCoverAnchorRowId([other], 'camp-1')).toBeNull();
    });

    it('returns null before the row has hydrated, so the panel falls back to the end', () => {
        expect(findCoverAnchorRowId([row({ role: 'user', content: 'hi' })], 'camp-1')).toBeNull();
        expect(findCoverAnchorRowId([], undefined)).toBeNull();
    });

    it('takes the newest matching row when the campaign was confirmed more than once', () => {
        const first = row({
            role: 'event', eventType: 'proposal_confirmed', content: 'created',
            cardPayload: { campaignId: 'camp-1' },
        });
        const second = row({
            role: 'event', eventType: 'proposal_confirmed', content: 'updated',
            cardPayload: { campaignId: 'camp-1' },
        });

        expect(findCoverAnchorRowId([first, second], 'camp-1')).toBe(second.id);
    });
});

/**
 * A confirmation card belongs at the point in the thread where it was offered. Rendered after
 * the whole transcript it was structurally the LAST thing in the thread, so asking anything
 * else slid the draft down below the new reply.
 */
describe('findProposalAnchorRowId', () => {
    it('anchors to the assistant row whose tool call raised it', () => {
        const a = row({ role: 'assistant', content: "Here's the draft.", createdAt: '2026-09-09T10:00:00Z' });
        const u = row({ role: 'user', content: 'what about proof of work?', createdAt: '2026-09-09T10:05:00Z' });
        const b = row({ role: 'assistant', content: 'I cannot move the dates.', createdAt: '2026-09-09T10:06:00Z' });

        const anchor = findProposalAnchorRowId([a, u, b], { messageId: a.id, createdAt: '2026-09-09T10:00:01Z' });

        // Not b — the card was offered at a, and later turns must not drag it down.
        expect(anchor).toBe(a.id);
    });

    it('falls back to the last row at or before it when the raising row was filtered out', () => {
        // A pure tool-call carrier has no text and never reaches the transcript, so its id is
        // not something the panel can anchor to.
        const a = row({ role: 'assistant', content: 'Working on it.', createdAt: '2026-09-09T10:00:00Z' });
        const b = row({ role: 'user', content: 'go on', createdAt: '2026-09-09T10:10:00Z' });

        const anchor = findProposalAnchorRowId([a, b], { messageId: 'dropped-row', createdAt: '2026-09-09T10:05:00Z' });

        expect(anchor).toBe(a.id);
    });

    it('returns null while nothing has been written yet, so the card falls to the end', () => {
        expect(findProposalAnchorRowId([], { messageId: null, createdAt: '2026-09-09T10:00:00Z' })).toBeNull();
    });

    it('returns null when the proposal carries neither anchor', () => {
        const a = row({ role: 'assistant', content: 'Hi', createdAt: '2026-09-09T10:00:00Z' });
        expect(findProposalAnchorRowId([a], {})).toBeNull();
    });
});

/**
 * The cover anchor must survive the user landing on the campaign's own page.
 *
 * finishCoverStep navigates to /campaigns/:id/edit, so opening the AI Strategist tab there
 * makes the confirmed campaign the SAME one the page is about. The panel used to suppress the
 * step in that case, which meant the offer vanished the moment you followed it — a draft with
 * no cover and no way to add one from the conversation that created it.
 */
describe('findCoverAnchorRowId — returning to the same campaign', () => {
    it('still finds the anchor when the confirmed campaign is the page campaign', () => {
        const confirmed = row({
            role: 'event',
            eventType: 'proposal_confirmed',
            content: 'Draft campaign created.',
            cardPayload: { campaignId: 'camp-1', kind: 'create_campaign' },
        });

        expect(findCoverAnchorRowId([confirmed], 'camp-1')).toBe(confirmed.id);
    });

    it('anchors to the newest confirmation for that campaign', () => {
        const first = row({
            role: 'event',
            eventType: 'proposal_confirmed',
            content: 'Draft campaign created.',
            cardPayload: { campaignId: 'camp-1', kind: 'create_campaign' },
        });
        const later = row({
            role: 'event',
            eventType: 'proposal_confirmed',
            content: 'Campaign updated.',
            cardPayload: { campaignId: 'camp-1', kind: 'update_campaign' },
        });

        expect(findCoverAnchorRowId([first, later], 'camp-1')).toBe(later.id);
    });

    it('ignores a confirmation for a different campaign', () => {
        const other = row({
            role: 'event',
            eventType: 'proposal_confirmed',
            content: 'Draft campaign created.',
            cardPayload: { campaignId: 'camp-2', kind: 'create_campaign' },
        });

        expect(findCoverAnchorRowId([other], 'camp-1')).toBeNull();
    });
});
