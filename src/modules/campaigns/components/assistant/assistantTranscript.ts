import type { AssistantMessage } from '@/shared/types/assistant';

/** One rendered assistant bubble: the text of every row in its group, and whether it is live. */
export interface AssistantBubble {
    text: string;
    streaming: boolean;
}

export interface AssistantGrouping {
    /** Rows drawn as part of an earlier bubble, so the transcript must not render them itself. */
    mergedInto: Set<string>;
    /** Keyed by the FIRST row of each group — the id the bubble renders under. */
    groupContent: Map<string, AssistantBubble>;
}

/**
 * Consecutive assistant rows are ONE reply, so they render as one bubble.
 *
 * A turn writes an assistant row every time it stops to call a tool, and another for the text it
 * finishes on — so a single answer arrived as two or three bubbles stacked back to back, usually
 * with overlapping wording ("let me try again", then "that did not work"). The same happens when
 * the loop keeps a paragraph and appends the corrected reply underneath it. None of those are
 * separate things the assistant said; they are one thing said in instalments.
 *
 * Only STRICTLY adjacent rows merge. The user's own message, a card, a question or a confirmed
 * proposal in between ends the group, because those genuinely separate two replies. The bubble
 * keys off the first row of its group, so a later block landing underneath extends the bubble
 * rather than remounting it.
 */
export function groupAssistantRows(messages: AssistantMessage[]): AssistantGrouping {
    const groupContent = new Map<string, AssistantBubble>();
    const mergedInto = new Set<string>();
    let leadId: string | null = null;

    for (const m of messages) {
        if (m.role !== 'assistant') {
            leadId = null;
            continue;
        }
        // A row with no text of its own is a pure tool-call carrier. The server already filters
        // these out of the transcript; a local one has nothing to read, so it neither opens a
        // group nor adds a blank line to one — but it must not BREAK the group either, which is
        // precisely the "text, then a tool, then more text" case this exists for.
        if (!m.content.trim() && !m.streaming) {
            mergedInto.add(m.id);
            continue;
        }
        if (leadId === null) {
            leadId = m.id;
            groupContent.set(m.id, { text: m.content, streaming: Boolean(m.streaming) });
            continue;
        }
        const group = groupContent.get(leadId);
        if (!group) continue;
        /**
         * A block identical to one already in this bubble is dropped.
         *
         * A turn can write the same paragraph twice — most reliably when a tool refuses the
         * same call twice in a row (asking to move a deadline, which propose_campaign_update
         * cannot do) and the model explains itself again in the same words. Merging those into
         * one bubble printed the identical sentence back to back, which reads as a rendering
         * fault rather than as the assistant repeating itself. Exact match only, so two
         * genuinely different blocks that merely start alike are both kept.
         */
        const block = m.content.trim();
        const alreadySaid = group.text
            .split('\n\n')
            .some((existing) => existing.trim() === block);
        if (alreadySaid) {
            mergedInto.add(m.id);
            group.streaming = Boolean(m.streaming);
            continue;
        }
        group.text = [group.text.trim(), m.content].join('\n\n');
        // The caret belongs to the block still being written, whichever one that is.
        group.streaming = Boolean(m.streaming);
        mergedInto.add(m.id);
    }

    return { mergedInto, groupContent };
}

/**
 * The confirmed-proposal row the cover-image panel belongs under.
 *
 * The panel used to render after the whole transcript, which made it structurally the last thing
 * in the thread rather than a thing that happened at a point in it: send one more message while
 * it was open and it jumped below the new message, as though the assistant had asked for a cover
 * image in answer to "hi". Anchoring it to the row that offered it keeps it where it was said.
 *
 * Null when no such row is on screen yet. Straight after the Confirm click the panel is put up
 * from local state before the transcript has re-hydrated, and with nothing to anchor to it falls
 * back to the end of the thread — which in that moment IS its chronological place.
 */
export function findCoverAnchorRowId(
    messages: AssistantMessage[],
    campaignId: string | undefined,
): string | null {
    if (!campaignId) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i];
        if (m.role !== 'event' || m.eventType !== 'proposal_confirmed') continue;
        if ((m.cardPayload as { campaignId?: string } | null)?.campaignId === campaignId) return m.id;
    }
    return null;
}

/**
 * The transcript row a pending proposal card belongs under.
 *
 * Exactly the problem findCoverAnchorRowId solves, for the confirmation card. Rendered after the
 * whole transcript, the card was structurally the last thing in the thread rather than a thing
 * that happened at a point in it: send another message and it slid down beneath the new reply,
 * so a draft offered several turns ago ended up sitting under an answer about something else.
 *
 * Anchored to the assistant row whose tool call raised it. That row is sometimes absent — a pure
 * tool-call carrier with no text of its own is filtered out of the transcript — so the fallback
 * is chronological: the last row written no later than the proposal itself.
 *
 * Null when neither is available, which is the moment between the tool call landing and the
 * transcript re-hydrating. The end of the thread IS its place then.
 */
export function findProposalAnchorRowId(
    messages: AssistantMessage[],
    proposal: { messageId?: string | null; createdAt?: string },
): string | null {
    if (proposal.messageId && messages.some((m) => m.id === proposal.messageId)) {
        return proposal.messageId;
    }
    if (!proposal.createdAt) return null;

    let anchor: string | null = null;
    for (const m of messages) {
        if (m.createdAt && m.createdAt <= proposal.createdAt) anchor = m.id;
        else break;
    }
    return anchor;
}
