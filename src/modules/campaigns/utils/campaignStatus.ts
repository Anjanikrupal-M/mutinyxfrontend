import type { Campaign, CampaignStatus } from '@/shared/types/campaign';

type ApprovalAware = Pick<Partial<Campaign>, 'approvalStatus'>;

/**
 * True while a campaign sits in the admin approval queue.
 *
 * Such a campaign is still on status 'draft', so this is the only way to tell it apart from
 * a draft the brand is simply still working on.
 */
export function isAwaitingApproval(campaign: ApprovalAware): boolean {
    return campaign.approvalStatus === 'pending';
}

/** True when an admin declined the campaign and the brand has not resubmitted it yet. */
export function isApprovalRejected(campaign: ApprovalAware): boolean {
    return campaign.approvalStatus === 'rejected';
}

/**
 * A campaign in the approval queue must not be editable-then-relaunched behind the admin's
 * back, and there is nothing for the brand to do but wait — so the builder and the detail
 * page both lock while this is true.
 */
export function isApprovalLocked(campaign: ApprovalAware): boolean {
    return isAwaitingApproval(campaign);
}

export function isDeadlinePassed(value?: string | Date | null, now = Date.now()) {
    if (!value) return false;

    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) return false;

    deadline.setHours(23, 59, 59, 999);
    return deadline.getTime() < now;
}

const RUNNING_STATUSES = new Set<CampaignStatus>(['active', 'script', 'work']);

/**
 * The campaign's lifecycle status — what filters and actions key off. The backend owns the
 * final states (completed / closed / withdrawn), so they are never overridden here; the only
 * derived value is 'expired': a live campaign whose application window shut with nobody in it.
 */
export function getCampaignDisplayStatus(campaign: { status: string } & Partial<Pick<Campaign, 'applicationDeadline' | 'timeline' | 'applicationsCount' | 'creatorsAccepted'>>, now = Date.now()): CampaignStatus {
    const status = String(campaign.status ?? '').toLowerCase() as CampaignStatus;
    const applicationDeadline = campaign.applicationDeadline ?? campaign.timeline?.applicationDeadline;
    const applicationsCount = Number(campaign.applicationsCount) || 0;
    const creatorsAccepted = Number(campaign.creatorsAccepted) || 0;

    // A private campaign's invited creators never bump applicationsCount, so the accepted
    // check is required to avoid labelling a working campaign as expired.
    if (RUNNING_STATUSES.has(status) && isDeadlinePassed(applicationDeadline, now) && applicationsCount === 0 && creatorsAccepted === 0) {
        return 'expired';
    }
    return status;
}

/*
 * Phase names reuse the app's own vocabulary — the list tabs (Waiting Approval, Expired …)
 * and the creator stages brands already see (Applications, Review, Work) — so a badge reads
 * the same as the screen it opens.
 */
export type CampaignPhase =
    | 'draft' | 'waiting_approval' | 'changes_requested'
    | 'active' | 'applications_open' | 'inviting_creators' | 'applications_received'
    | 'in_progress' | 'pending_review' | 'past_deadline'
    | 'completed' | 'closed' | 'withdrawn' | 'expired';

export const CAMPAIGN_PHASE_LABELS: Record<CampaignPhase, string> = {
    draft: 'Draft',
    waiting_approval: 'Waiting Approval',
    changes_requested: 'Changes Requested',
    active: 'Active',
    applications_open: 'Applications Open',
    inviting_creators: 'Inviting Creators',
    applications_received: 'Applications Received',
    in_progress: 'In Progress',
    pending_review: 'Pending Review',
    past_deadline: 'Past Deadline',
    completed: 'Completed',
    closed: 'Closed',
    withdrawn: 'Withdrawn',
    expired: 'Expired',
};

// Everything but status is optional: some payloads (team workload, public review) carry only
// part of a campaign, and the phase degrades to plain 'active' when the counters are missing.
export type PhaseCampaign = { status: string } & Partial<Pick<Campaign, 'approvalStatus' | 'applicationDeadline' | 'timeline' | 'applicationsCount' | 'creatorsAccepted' | 'workDeadline' | 'proofOfWorkDeadline' | 'visibility'>> & {
    pendingScripts?: number;
    pendingSubmissions?: number;
    pendingApplications?: number;
};

/**
 * Where a campaign actually is, for the badge. Lifecycle status says "active" for the whole
 * run; this splits a live campaign by what is happening in it, using the counters the list
 * endpoint already returns. Order matters — the first match is what the brand most needs:
 *   past deadline → pending review → in progress → applications received → applications open.
 */
export function getCampaignPhase(campaign: PhaseCampaign, now = Date.now()): CampaignPhase {
    const status = getCampaignDisplayStatus(campaign, now);
    // The approval gate only applies before launch; a stale approvalStatus on a live
    // campaign must not mask what is happening in it.
    if (status === 'draft' && isAwaitingApproval(campaign)) return 'waiting_approval';
    if (status === 'draft' && isApprovalRejected(campaign)) return 'changes_requested';
    if (!RUNNING_STATUSES.has(status)) {
        return (['draft', 'completed', 'closed', 'withdrawn', 'expired'] as const).find((s) => s === status) ?? 'draft';
    }

    // Without counters we can't tell recruiting from production — say so plainly.
    if (campaign.creatorsAccepted == null && campaign.applicationsCount == null) return 'active';

    const accepted = Number(campaign.creatorsAccepted) || 0;
    const applications = Number(campaign.applicationsCount) || 0;
    const pendingApplications = Number(campaign.pendingApplications) || 0;
    const awaitingBrand = (Number(campaign.pendingScripts) || 0) + (Number(campaign.pendingSubmissions) || 0);
    // The last shared deadline a creator works to. Individual-deadline campaigns have none,
    // so they can't be overdue at campaign level — their creators show it on their own cards.
    const finalDeadline = campaign.proofOfWorkDeadline ?? campaign.timeline?.proofOfWorkDeadline
        ?? campaign.workDeadline ?? campaign.timeline?.workDeadline;

    if (accepted > 0) {
        if (isDeadlinePassed(finalDeadline, now)) return 'past_deadline';
        if (awaitingBrand > 0) return 'pending_review';
        return 'in_progress';
    }
    // pendingApplications is only on some payloads; fall back to the total.
    if (pendingApplications > 0 || (campaign.pendingApplications == null && applications > 0)) return 'applications_received';
    // A private campaign has no open applications — the brand is inviting creators.
    return campaign.visibility === 'private' ? 'inviting_creators' : 'applications_open';
}

// Derive a meaningful progress percent for the campaign card.
// The backend campaign-level `status` rarely advances past `active` — individual
// creators progress through their own per-influencer status (script_pending,
// work_review, proof_review, completed, ...). So we look at the per-campaign
// aggregate counters (which the list endpoint already returns) plus
// creatorsAccepted/applicationsCount to build a representative percent.
type ProgressCampaign = Pick<
    Campaign,
    'status' | 'progress' | 'creatorsAccepted' | 'creatorsInvited' | 'applicationsCount'
> & {
    pendingScripts?: number;
    pendingSubmissions?: number;
    pendingApplications?: number;
    pendingProductShipments?: number;
};

export function getCampaignProgress(campaign: ProgressCampaign): number {
    // Trust an explicit backend value if it's a sensible non-zero number.
    const explicit = Number(campaign.progress);
    if (Number.isFinite(explicit) && explicit > 0) {
        return Math.min(100, Math.max(0, Math.round(explicit)));
    }

    const status = String(campaign.status ?? '').toLowerCase();
    const accepted = Number(campaign.creatorsAccepted) || 0;
    const applications = Number(campaign.applicationsCount) || 0;
    const pendingScripts = Number(campaign.pendingScripts) || 0;
    const pendingSubmissions = Number(campaign.pendingSubmissions) || 0;
    const pendingApplications = Number(campaign.pendingApplications) || 0;
    const pendingProduct = Number(campaign.pendingProductShipments) || 0;

    if (status === 'completed' || status === 'closed') return 100;
    if (status === 'draft' || status === 'withdrawn') return 0;

    // Campaign-level status `script` / `work` (rare — when all creators are in that phase).
    if (status === 'work') return 80;
    if (status === 'script') return 55;

    // Status === 'active' (the common case). Choose the highest stage that has activity.
    if (pendingSubmissions > 0) return 75;        // work / proof under review
    if (pendingScripts > 0) return 55;            // scripts in flight
    if (pendingProduct > 0) return 45;            // product shipping
    if (accepted > 0 && pendingApplications === 0) return 35; // all apps reviewed, ready to start
    if (accepted > 0) return 30;                  // some creators accepted
    if (applications > 0) return 20;              // apps received but none accepted
    return 10;                                    // launched, no apps yet
}

export function getIsBrandScript(campaign?: Pick<Campaign, 'scriptType' | 'requirements' | 'scriptFlow'> | null): boolean {
    if (!campaign) return false;
    const type = String(campaign.scriptType || campaign.requirements?.scriptType || '').toLowerCase();
    if (type === 'brand') return true;
    if (type === 'creator') return false;
    // Legacy fallback for old campaigns lacking an explicit scriptType field
    return typeof campaign.scriptFlow === 'string' && campaign.scriptFlow.trim().length > 0;
}

type ScriptAware = Pick<Campaign, 'scriptType' | 'requirements' | 'scriptFlow'>;

/** True when the brand turned "Script required" off — the campaign has no script at all. */
export function getIsNoScript(campaign?: Pick<Campaign, 'scriptType' | 'requirements'> | null): boolean {
    if (!campaign) return false;
    return String(campaign.scriptType || campaign.requirements?.scriptType || '').toLowerCase() === 'none';
}

/**
 * True when creators skip the script stages (script_pending / script_review): either the
 * brand provides the script, or the campaign needs no script. Drives hiding the Scripts tab,
 * the script Kanban columns and the script progress steps.
 */
export function getSkipsCreatorScript(campaign?: ScriptAware | null): boolean {
    return getIsNoScript(campaign) || getIsBrandScript(campaign);
}