import { describe, it, expect } from 'vitest';
import { shouldAdoptStoredConversation, mayResumeOnCreatePage, describeRecentRow } from './assistantSession';

describe('shouldAdoptStoredConversation', () => {
    it('does not resume on a fresh VISIT to Create Campaign — every visit is a new campaign', () => {
        // The first reported bug: leaving and coming back reopened whatever was said last, so
        // someone starting a public campaign found themselves continuing a private one.
        expect(shouldAdoptStoredConversation({ scopedCampaignId: null, navigationType: 'navigate' })).toBe(false);
        expect(shouldAdoptStoredConversation({ scopedCampaignId: undefined, navigationType: 'navigate' })).toBe(false);
        expect(shouldAdoptStoredConversation({})).toBe(false);
    });

    it('DOES resume across a reload of Create Campaign', () => {
        // The second reported bug: refreshing mid-brief threw the conversation away and came
        // back with a blank New chat. A reload is not a visit.
        expect(shouldAdoptStoredConversation({ scopedCampaignId: null, navigationType: 'reload' })).toBe(true);
    });

    it('treats an unknown navigation type as a fresh visit', () => {
        // Conservative half: without Navigation Timing we keep today's blank-page behaviour
        // rather than risk silently continuing a finished thread.
        expect(shouldAdoptStoredConversation({ scopedCampaignId: null, navigationType: 'unknown' })).toBe(false);
    });

    it('still resumes the thread belonging to an existing campaign', () => {
        // On a campaign's own page the stored thread IS that campaign's conversation, which is
        // exactly what should come back.
        expect(shouldAdoptStoredConversation({ scopedCampaignId: 'camp-1' })).toBe(true);
    });

    it('treats an empty campaign id as no campaign', () => {
        expect(shouldAdoptStoredConversation({ scopedCampaignId: '' })).toBe(false);
    });

    it('still resumes an existing campaign page however it was reached', () => {
        for (const navigationType of ['navigate', 'reload', 'unknown'] as const) {
            expect(shouldAdoptStoredConversation({ scopedCampaignId: 'camp-1', navigationType })).toBe(true);
        }
    });
});

describe('mayResumeOnCreatePage', () => {
    it('allows a thread that has not produced a campaign yet', () => {
        expect(mayResumeOnCreatePage({ campaignId: null })).toBe(true);
        expect(mayResumeOnCreatePage({})).toBe(true);
    });

    it('refuses a thread already bound to a campaign, even across a reload', () => {
        // Resuming it would silently turn Create Campaign into an edit session for that
        // campaign, because conversation.campaignId is what picks the tool catalogue.
        expect(mayResumeOnCreatePage({ campaignId: 'camp-1' })).toBe(false);
    });
});

describe('describeRecentRow', () => {
    it('names a bound thread after its campaign, not its opening message', () => {
        const row = describeRecentRow({
            title: 'i want to create a campaign',
            campaignName: 'Better Results Feature Push',
            campaignVisibility: 'public',
            messageCount: 24,
        });

        expect(row.title).toBe('Better Results Feature Push');
        expect(row.meta).toBe('Public campaign · 24 messages');
        expect(row.badge).toBe('Public');
    });

    it('marks a private campaign, which is the one that matters to get wrong', () => {
        const row = describeRecentRow({
            title: 'hello',
            campaignName: 'Secret Launch',
            campaignVisibility: 'private',
            messageCount: 3,
        });

        expect(row.badge).toBe('Private');
        expect(row.meta).toBe('Private campaign · 3 messages');
    });

    it('leaves an unbound draft on its own title, with no badge', () => {
        const row = describeRecentRow({ title: 'hello', messageCount: 2 });

        expect(row.title).toBe('hello');
        expect(row.meta).toBe('2 messages');
        expect(row.badge).toBeNull();
    });

    it('falls back to "New chat" when there is no title at all', () => {
        expect(describeRecentRow({ messageCount: 0 }).title).toBe('New chat');
    });

    it('gets the singular right', () => {
        expect(describeRecentRow({ title: 'hi', messageCount: 1 }).meta).toBe('1 message');
    });
});
