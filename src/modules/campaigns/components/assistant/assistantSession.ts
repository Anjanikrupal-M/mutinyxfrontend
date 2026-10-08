/**
 * Threads are remembered per builder context in sessionStorage so an accidental reload resumes
 * where it left off instead of starting a blank one and littering Recent with empty rows. The
 * key is the campaign being built: `:<campaignId>` for an existing campaign, `:new` for one that
 * does not exist yet.
 */

/**
 * How this mount was reached. `reload` is the one that matters — see below.
 *
 * Read from the Navigation Timing entry rather than tracked by hand, because it is the only
 * thing that can tell a refresh apart from a fresh visit AFTER the page has already been torn
 * down and rebuilt. Anything the panel could remember itself would be remembered across both.
 */
export type PanelNavigationType = 'reload' | 'navigate' | 'unknown';

export function readNavigationType(): PanelNavigationType {
    try {
        const entry = performance.getEntriesByType('navigation')[0] as { type?: string } | undefined;
        if (entry?.type === 'reload') return 'reload';
        if (entry?.type === 'back_forward' || entry?.type === 'navigate' || entry?.type === 'prerender') return 'navigate';
        return 'unknown';
    } catch {
        // No Navigation Timing (old browser, odd embedding): treat as a fresh visit, which is
        // the conservative half of the rule below.
        return 'unknown';
    }
}

/**
 * Which stored conversation a freshly-mounted panel may adopt.
 *
 * Two failures pull in opposite directions here, and the rule has to serve both.
 *
 * Reopening Create Campaign as a fresh visit must start blank. The remembered thread used to
 * come back whatever it was, including a finished one for a campaign that had already been
 * created — so someone starting a public campaign found themselves continuing a private one,
 * and continuing it silently, because a thread bound to a campaign switches the assistant from
 * creating to updating THAT campaign (conversation.campaignId picks the tool catalogue).
 *
 * But refusing every stored thread on that page threw away the case the storage existed for:
 * an accidental refresh in the middle of a brief. Everything typed so far vanished and a blank
 * "New chat" came back, which is what users hit and report.
 *
 * A reload is not a visit. So: an existing campaign's own page always resumes — there the
 * stored thread IS that campaign's conversation. Create Campaign resumes only across a
 * RELOAD, and even then only a thread that is not yet bound to a campaign; anything bound is
 * finished work and belongs in Recent, to be reopened deliberately.
 */
export function shouldAdoptStoredConversation(input: {
    /** The campaign the builder is open on, if any. */
    scopedCampaignId?: string | null;
    /** How this mount was reached. Absent is treated as a fresh visit. */
    navigationType?: PanelNavigationType;
}): boolean {
    if (input.scopedCampaignId) return true;
    return input.navigationType === 'reload';
}

/**
 * Whether a stored thread, now fetched, may actually be resumed on the create page.
 *
 * The reload check above is about HOW the panel got here; this is about WHAT it found. A thread
 * already bound to a campaign turns the assistant into an editor for that campaign, which is
 * never what "Create Campaign" should silently become — not even across a refresh.
 */
export function mayResumeOnCreatePage(conversation: { campaignId?: string | null }): boolean {
    return !conversation.campaignId;
}

export interface RecentRowSource {
    /** The conversation's own title — its opening message. */
    title?: string | null;
    /** The campaign it produced, if any. */
    campaignName?: string | null;
    campaignVisibility?: string | null;
    messageCount?: number;
}

export interface RecentRowLabel {
    /** What the row is called. */
    title: string;
    /** The line under it: what this thread is bound to, and how big it is. */
    meta: string;
    /** Present only for a thread bound to a campaign; null for an unbound draft. */
    badge: 'Private' | 'Public' | null;
}

/**
 * What a Recent row should say.
 *
 * Two problems, one fix. A conversation is titled after its opening message, so every thread
 * that starts the obvious way is called "i want to create a campaign" and the list becomes a
 * wall of identical rows. And a thread BOUND to a campaign looks exactly like an unbound one —
 * yet clicking it silently switches the assistant from creating a campaign to updating that
 * specific one, because conversation.campaignId is what picks the tool catalogue. Naming the
 * row after the campaign, and saying whether that campaign is private, makes the consequence of
 * the click visible before it is made.
 */
export function describeRecentRow(source: RecentRowSource): RecentRowLabel {
    const campaignName = source.campaignName?.trim() || '';
    const ownTitle = source.title?.trim() || '';
    const count = Number(source.messageCount ?? 0);
    const messages = `${count} message${count === 1 ? '' : 's'}`;

    if (!campaignName) {
        return { title: ownTitle || 'New chat', meta: messages, badge: null };
    }

    const visibility = source.campaignVisibility === 'private' ? 'Private' : 'Public';
    return {
        // The campaign is what the thread is now about, so it wins over the opening message.
        title: campaignName,
        meta: `${visibility} campaign · ${messages}`,
        badge: visibility,
    };
}
