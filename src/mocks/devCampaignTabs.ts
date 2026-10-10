// ─────────────────────────────────────────────────────────────
// Dev-only demo data for the campaign detail tabs.
//
// The demo account (see devAuth.ts) has no server, and until now only the
// campaign list/detail was served from the browser (devCampaigns.ts) — so
// Overview had numbers while Applications, Status Board, Scripts, Work
// Submissions, Proof of Work and Analytics all came back empty.
//
// This builds the missing pieces for any demo campaign from the campaign's
// own numbers (applications waiting, creators accepted, scripts and work
// waiting, progress), so every tab agrees with Overview and the dashboard:
// a roster of creators at different stages, their scripts, their submitted
// work, their proof-of-work posts, and the analytics those posts add up to.
//
// Everything is derived, nothing is stored: the same campaign always gets
// the same creators and figures. It is read-only — approving or rejecting
// in a tab still calls the real API, which the demo account does not have.
// Production builds and real accounts never reach this file's data.
// ─────────────────────────────────────────────────────────────

import type { Campaign, CampaignInfluencer, InfluencerCampaignStatus, ProofReelAnalytics, ScriptVersion, WorkSubmission } from '@/shared/types/campaign';
import type { CampaignAnalyticsSummary, CampaignMetricHistory, CampaignMetricHistoryPoint } from '@/modules/campaigns/hooks/useCampaignAnalytics';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';
import { MOCK_INFLUENCERS } from './data';
import { demoCampaignSnapshot } from './devCampaigns';

const LATENCY_MS = 300;
const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

// Roster size limits: enough to fill a tab, not so many it stops reading as a sample.
const MAX_APPLIED = 9;
const MAX_ACCEPTED = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A proof-of-work row as the Proof of Work tab reads it (see ProofOfWorkSubmission in ProofOfWorkTab.tsx). */
export interface DemoProofOfWork {
    id: string;
    campaignInfluencerId: string;
    proofUrl: string;
    description?: string;
    platform: 'instagram';
    status: 'pending' | 'approved';
    submittedAt: string;
    reviewedAt: string | null;
    metricSource: 'meta_graph';
    metricStatus: 'fresh';
    metricsFetchedAt: string;
    mediaType: 'VIDEO';
    contentFormat: 'reel';
    itemIndex: number;
    scrapedLikes: number;
    scrapedComments: number;
    scrapedViews: number;
    scrapedReach: number;
    scrapedImpressions: number;
    scrapedShares: number;
    scrapedSaved: number;
    scrapedTotalInteractions: number;
    scrapedEngagementRate: string;
    finalCaptureStatus: 'not_required';
    isFinal: boolean;
    lastSuccessfulSyncAt: string;
    ci: { id: string; influencerId: string; status: string; agreedBudget: number | null; tierRate: number };
    influencerId: string;
    influencerName: string;
    influencerHandle: string;
    influencerAvatar: null;
}

/** Small stable number from a string, so each campaign picks its own creators and figures. */
function seedOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const toNumber = (value: unknown) => {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** The stages the accepted creators are spread across, in pipeline order. */
function stagesFor(campaign: Campaign, accepted: number): InfluencerCampaignStatus[] {
    if (accepted === 0) return [];
    if (campaign.status === 'completed') return Array.from({ length: accepted }, () => 'completed');

    const stages: InfluencerCampaignStatus[] = [];
    const take = (status: InfluencerCampaignStatus, count: number) => {
        for (let i = 0; i < count && stages.length < accepted; i++) stages.push(status);
    };
    const noScripts = campaign.scriptType === 'none' || campaign.scriptType === 'brand';

    // What the campaign says is waiting on the brand comes first, so the tabs match its counts.
    if (!noScripts) take('script_review', toNumber(campaign.pendingScripts));
    take('work_review', toNumber(campaign.pendingSubmissions));
    const left = accepted - stages.length;
    // Then the rest follow the campaign's progress: the further along, the more have finished.
    const progress = clamp(toNumber(campaign.progress), 0, 100) / 100;
    const finished = Math.round(left * progress);
    if (campaign.proofOfWorkRequired || campaign.proofOfWorkReq) take('proof_review', Math.min(2, finished));
    take('completed', finished - (stages.filter((s) => s === 'proof_review').length));
    const early: InfluencerCampaignStatus[] = noScripts ? ['work_pending', 'paid'] : ['work_pending', 'script_pending', 'paid'];
    for (let i = 0; stages.length < accepted; i++) stages.push(early[i % early.length]);
    return stages;
}

const PAST_SCRIPT: InfluencerCampaignStatus[] = ['work_pending', 'work_review', 'proof_review', 'completed', 'settled'];
const PAST_WORK: InfluencerCampaignStatus[] = ['proof_review', 'completed', 'settled'];

function scriptText(campaign: Campaign, creatorName: string) {
    return [
        `Hook (0–3s): "I didn't expect ${campaign.name.split('—')[0].trim()} to be this good."`,
        'Body (3–20s): Show the product in use, one clear benefit per shot. Natural light, no voice-over filters.',
        'Proof (20–25s): A before/after or a first reaction on camera.',
        `Close (25–30s): "${creatorName.split(' ')[0]} approved." Call to action and the brand handle on screen.`,
    ].join('\n');
}

/** The creators on a demo campaign, each at a stage, with the scripts and work that stage implies. */
function buildRoster(campaign: Campaign): CampaignInfluencer[] {
    const seed = seedOf(campaign.id);
    const startedAt = new Date(campaign.createdAt || Date.now()).getTime();
    const iso = (dayOffset: number, hour = 10) => new Date(startedAt + dayOffset * DAY_MS + hour * 60 * 60 * 1000).toISOString();

    const accepted = clamp(toNumber(campaign.creatorsAccepted), 0, MAX_ACCEPTED);
    const waiting = toNumber(campaign.pendingApplications) || Math.max(0, toNumber(campaign.applicationsCount) - toNumber(campaign.creatorsAccepted));
    const applied = campaign.status === 'completed' ? 0 : clamp(waiting, 0, MAX_APPLIED);
    const statuses: InfluencerCampaignStatus[] = [
        ...Array.from({ length: applied }, () => 'applied' as const),
        ...stagesFor(campaign, accepted),
    ];

    const tiers = (campaign.budgetTierPricing || campaign.budget?.tierPricing || []) as Array<{ tier: string; amount?: number | null }>;
    const isProductOnly = (campaign.budgetMode || campaign.budget?.mode) === 'product';
    const feePercent = toNumber(campaign.platformFeePercent || campaign.budget?.platformFeePercent) || DEFAULT_PLATFORM_FEE_PERCENT;

    return statuses.map((status, i) => {
        const creator = MOCK_INFLUENCERS[(seed + i * 7) % MOCK_INFLUENCERS.length];
        const id = `ci-${campaign.id}-${String(i + 1).padStart(2, '0')}`;
        const tierRate = isProductOnly ? 0 : toNumber((tiers.find((t) => t.tier === creator.creatorSize) ?? tiers[0])?.amount);
        const isApplied = status === 'applied';
        const agreedBudget = isApplied ? null : tierRate;
        const platformFee = Math.round((tierRate * feePercent) / 100);
        const half = Math.round((tierRate + platformFee) / 2);

        // Scripts: none yet, one waiting (every third creator on a second version), or one approved.
        const scriptVersions: ScriptVersion[] = [];
        if (status === 'script_review') {
            if (i % 3 === 0) {
                scriptVersions.push({ id: `${id}-sv1`, version: 1, textContent: scriptText(campaign, creator.name), status: 'revision_requested', submittedAt: iso(4), reviewedAt: iso(5), reviewNote: 'Lead with the product in the first three seconds.' });
                scriptVersions.push({ id: `${id}-sv2`, version: 2, textContent: scriptText(campaign, creator.name), status: 'pending', submittedAt: iso(6, 14) });
            } else {
                scriptVersions.push({ id: `${id}-sv1`, version: 1, textContent: scriptText(campaign, creator.name), status: 'pending', submittedAt: iso(5, 9 + (i % 6)) });
            }
        } else if (PAST_SCRIPT.includes(status) && campaign.scriptType !== 'none') {
            scriptVersions.push({ id: `${id}-sv1`, version: 1, textContent: scriptText(campaign, creator.name), status: 'approved', submittedAt: iso(4), reviewedAt: iso(5) });
        }

        // Work: one post waiting for review, or one approved once the creator is past that stage.
        const handle = creator.handle.replace(/^@/, '');
        const workUrl = `https://www.instagram.com/reel/demo-${handle}-${campaign.id}/`;
        const workSubmissions: WorkSubmission[] = [];
        if (status === 'work_review') {
            workSubmissions.push({ id: `${id}-ws1`, itemIndex: 1, type: 'link', url: workUrl, externalUrl: workUrl, status: 'pending', submittedAt: iso(9, 11 + (i % 5)) });
        } else if (PAST_WORK.includes(status)) {
            workSubmissions.push({ id: `${id}-ws1`, itemIndex: 1, type: 'link', url: workUrl, externalUrl: workUrl, status: 'approved', submittedAt: iso(9), reviewedAt: iso(10) });
        }

        return {
            id,
            campaignId: campaign.id,
            influencerId: creator.id,
            origin: i % 2 === 0 ? 'influencer_application' : 'brand_invite',
            status,
            chatEnabled: !isApplied,
            tierRate,
            quotedPrice: tierRate,
            negotiations: [],
            agreedBudget,
            platformFee: isApplied ? 0 : platformFee,
            firstPayment: isApplied ? 0 : half,
            finalPayment: isApplied ? 0 : half,
            paymentStatus: isApplied ? 'pending_first' : status === 'completed' ? 'completed' : 'first_paid',
            scriptVersions,
            workSubmissions,
            connectedAt: iso(1, 9 + (i % 8)),
            acceptedAt: isApplied ? undefined : iso(2),
            paidAt: isApplied ? undefined : iso(3),
            completedAt: status === 'completed' ? iso(12) : undefined,
            userName: creator.name,
            handle: creator.handle,
            tier: creator.creatorSize,
            bio: creator.bio,
            followerCount: creator.followers,
            platform: creator.platform,
            // What the Applications cards and their Brand Fit score read: each creator's own niche,
            // city and engagement, so scores and stats differ from card to card.
            ...({
                niches: creator.niche,
                location: creator.location,
                engagementRate: creator.engagement,
                pastCollaborations: creator.pastCollaborations,
                rating: creator.rating,
                platforms: [{ platform: creator.platform, handle: creator.handle, followers: creator.followers }],
            } as Partial<CampaignInfluencer>),
            profileComplete: true,
            appliedPlatform: 'instagram',
        } satisfies CampaignInfluencer;
    });
}

function rosterFor(campaignId: string): { campaign: Campaign; roster: CampaignInfluencer[] } | null {
    const campaign = demoCampaignSnapshot().find((c) => c.id === campaignId);
    return campaign ? { campaign, roster: buildRoster(campaign) } : null;
}

/** Proof-of-work posts: one per creator who has reached proof review (waiting) or finished (approved). */
function buildProofs(campaign: Campaign, roster: CampaignInfluencer[]): DemoProofOfWork[] {
    const startedAt = new Date(campaign.createdAt || Date.now()).getTime();
    const now = new Date().toISOString();
    return roster
        .filter((ci) => PAST_WORK.includes(ci.status))
        .map((ci, i) => {
            const followers = toNumber(ci.followerCount);
            const spread = 0.8 + ((seedOf(ci.id) % 40) / 100); // 0.80–1.19, so creators differ
            const reach = Math.round(followers * 0.22 * spread);
            const views = Math.round(reach * 1.35);
            const likes = Math.round(reach * 0.052 * spread);
            const comments = Math.round(likes * 0.045);
            const shares = Math.round(likes * 0.11);
            const saved = Math.round(likes * 0.16);
            const interactions = likes + comments + shares + saved;
            const handle = String(ci.handle ?? '').replace(/^@/, '');
            const submittedAt = new Date(startedAt + (10 + (i % 4)) * DAY_MS).toISOString();
            return {
                id: `${ci.id}-pow1`,
                campaignInfluencerId: ci.id,
                proofUrl: `https://www.instagram.com/reel/demo-${handle}-${campaign.id}/`,
                description: 'Posted as agreed.',
                platform: 'instagram',
                status: ci.status === 'proof_review' ? 'pending' : 'approved',
                submittedAt,
                reviewedAt: ci.status === 'proof_review' ? null : new Date(startedAt + 12 * DAY_MS).toISOString(),
                metricSource: 'meta_graph',
                metricStatus: 'fresh',
                metricsFetchedAt: now,
                mediaType: 'VIDEO',
                contentFormat: 'reel',
                itemIndex: 1,
                scrapedLikes: likes,
                scrapedComments: comments,
                scrapedViews: views,
                scrapedReach: reach,
                scrapedImpressions: Math.round(views * 1.1),
                scrapedShares: shares,
                scrapedSaved: saved,
                scrapedTotalInteractions: interactions,
                scrapedEngagementRate: `${((interactions / Math.max(1, reach)) * 100).toFixed(2)}%`,
                finalCaptureStatus: 'not_required',
                isFinal: false,
                lastSuccessfulSyncAt: now,
                ci: { id: ci.id, influencerId: ci.influencerId, status: ci.status, agreedBudget: ci.agreedBudget, tierRate: ci.tierRate },
                influencerId: ci.influencerId,
                influencerName: ci.userName ?? 'Creator',
                influencerHandle: String(ci.handle ?? ''),
                influencerAvatar: null,
            } satisfies DemoProofOfWork;
        });
}

const sum = (rows: DemoProofOfWork[], pick: (row: DemoProofOfWork) => number) => rows.reduce((total, row) => total + pick(row), 0);

// ── What the hooks call ──

/**
 * The campaign as its detail page should see it: the Overview tab's performance figures become the
 * totals of the very posts the Analytics tab lists, so the two tabs always agree. (The sample
 * campaigns in data.ts carry hand-typed figures that match nothing else.) With no posts yet there
 * are no figures, and Overview leaves its performance card out.
 */
export function withDemoPerformance(campaign: Campaign): Campaign {
    const proofs = buildProofs(campaign, buildRoster(campaign));
    if (proofs.length === 0) return { ...campaign, analytics: undefined };
    const reach = sum(proofs, (p) => p.scrapedReach);
    const interactions = sum(proofs, (p) => p.scrapedTotalInteractions);
    return {
        ...campaign,
        analytics: {
            totalReach: reach,
            totalLikes: sum(proofs, (p) => p.scrapedLikes),
            totalComments: sum(proofs, (p) => p.scrapedComments),
            totalShares: sum(proofs, (p) => p.scrapedShares),
            // Interactions ÷ reach, the same definition the Analytics tab uses.
            engagementRate: reach > 0 ? Number(((interactions / reach) * 100).toFixed(2)) : 0,
        },
    };
}

/** Applications tab and Status Board: the whole roster. */
export function demoListApplications(campaignId: string): Promise<CampaignInfluencer[]> {
    return wait(rosterFor(campaignId)?.roster ?? []);
}

/** Scripts tab: every script version, labelled with its creator. */
export function demoListScripts(campaignId: string): Promise<ScriptVersion[]> {
    const roster = rosterFor(campaignId)?.roster ?? [];
    return wait(roster.flatMap((ci) => ci.scriptVersions.map((script) => ({
        ...script,
        campaignId,
        campaignInfluencerId: ci.id,
        influencerId: ci.influencerId,
        influencerName: ci.userName,
        influencerHandle: ci.handle,
    }))));
}

/** Work Submissions tab: every submitted post, labelled with its creator. */
export function demoListSubmissions(campaignId: string): Promise<WorkSubmission[]> {
    const roster = rosterFor(campaignId)?.roster ?? [];
    return wait(roster.flatMap((ci) => ci.workSubmissions.map((work) => ({
        ...work,
        campaignId,
        campaignInfluencerId: ci.id,
        influencerId: ci.influencerId,
        influencerName: ci.userName,
        influencerHandle: ci.handle,
    }))));
}

/** Proof of Work tab. */
export function demoListProofOfWork(campaignId: string): Promise<DemoProofOfWork[]> {
    const found = rosterFor(campaignId);
    return wait(found ? buildProofs(found.campaign, found.roster) : []);
}

/** Analytics tab — the per-post rows. */
export function demoListProofAnalytics(campaignId: string): Promise<ProofReelAnalytics[]> {
    const found = rosterFor(campaignId);
    const proofs = found ? buildProofs(found.campaign, found.roster) : [];
    return wait(proofs.map((proof) => ({
        proofId: proof.id,
        proofUrl: proof.proofUrl,
        description: proof.description,
        status: proof.status,
        submittedAt: proof.submittedAt,
        influencerName: proof.influencerName,
        influencerHandle: proof.influencerHandle,
        influencerAvatar: null,
        scrapedLikes: proof.scrapedLikes,
        scrapedComments: proof.scrapedComments,
        scrapedViews: proof.scrapedViews,
        scrapedReach: proof.scrapedReach,
        scrapedImpressions: proof.scrapedImpressions,
        scrapedShares: proof.scrapedShares,
        scrapedSaved: proof.scrapedSaved,
        scrapedTotalInteractions: proof.scrapedTotalInteractions,
        scrapedEngagementRate: proof.scrapedEngagementRate,
        metricSource: 'meta_graph',
        metricStatus: 'fresh',
        metricsFetchedAt: proof.metricsFetchedAt,
        mediaType: 'VIDEO',
        contentFormat: 'reel',
        thumbnailUrl: null,
        scrapedAt: proof.metricsFetchedAt,
        finalCaptureStatus: 'not_required',
        isFinal: false,
        lastSuccessfulSyncAt: proof.lastSuccessfulSyncAt,
        metricContentId: proof.id,
    })));
}

/** Analytics tab — the totals across those posts. */
export function demoCampaignAnalyticsSummary(campaignId: string): Promise<CampaignAnalyticsSummary> {
    const found = rosterFor(campaignId);
    const proofs = found ? buildProofs(found.campaign, found.roster) : [];
    const now = new Date().toISOString();
    const reach = sum(proofs, (p) => p.scrapedReach);
    const interactions = sum(proofs, (p) => p.scrapedTotalInteractions);
    const none = { totalReach: 0, totalViews: 0, totalImpressions: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalSaved: 0, totalEngagements: 0, engagementRate: 0 };
    return wait({
        instagramByFormat: proofs.length === 0 ? [] : [{
            format: 'reel',
            label: 'Reel',
            requested: true,
            proofCount: proofs.length,
            creatorCount: new Set(proofs.map((p) => p.influencerId)).size,
            lastFetchedAt: now,
            totalReach: reach,
            totalViews: sum(proofs, (p) => p.scrapedViews),
            totalLikes: sum(proofs, (p) => p.scrapedLikes),
            totalComments: sum(proofs, (p) => p.scrapedComments),
            totalShares: sum(proofs, (p) => p.scrapedShares),
            totalSaved: sum(proofs, (p) => p.scrapedSaved),
            totalEngagements: interactions,
            totalReplies: null,
            totalFollows: null,
            averageWatchTime: 11.4,
            totalWatchTime: Math.round(sum(proofs, (p) => p.scrapedViews) * 11.4),
            engagementRate: reach > 0 ? Number(((interactions / reach) * 100).toFixed(2)) : null,
            metricAvailability: {},
        }],
        requestedInstagramFormats: ['reel'],
        youtube: none,
        generatedAt: now,
    });
}

/** Analytics tab — the daily trend: each post's figures building up over the last seven days. */
export function demoCampaignMetricHistory(campaignId: string): Promise<CampaignMetricHistory> {
    const found = rosterFor(campaignId);
    const proofs = found ? buildProofs(found.campaign, found.roster) : [];
    const DAYS = 7;
    const today = Date.now();
    // Share of the final figure reached by each day: quick at first, then levelling off.
    const curve = Array.from({ length: DAYS }, (_, day) => 1 - Math.pow(0.55, day + 1));
    const dateOf = (day: number) => new Date(today - (DAYS - 1 - day) * DAY_MS).toISOString().split('T')[0];
    const at = (proof: DemoProofOfWork, day: number) => {
        const share = curve[day] / curve[DAYS - 1];
        const likes = Math.round(proof.scrapedLikes * share);
        const comments = Math.round(proof.scrapedComments * share);
        const shares = Math.round(proof.scrapedShares * share);
        const saved = Math.round(proof.scrapedSaved * share);
        return {
            views: Math.round(proof.scrapedViews * share),
            reach: Math.round(proof.scrapedReach * share),
            likes,
            comments,
            shares,
            saved,
            totalInteractions: likes + comments + shares + saved,
            watchMinutes: Math.round((proof.scrapedViews * share * 11.4) / 60),
        };
    };
    const add = (a: ReturnType<typeof at>, b: ReturnType<typeof at>) => ({
        views: a.views + b.views, reach: a.reach + b.reach, likes: a.likes + b.likes, comments: a.comments + b.comments,
        shares: a.shares + b.shares, saved: a.saved + b.saved, totalInteractions: a.totalInteractions + b.totalInteractions, watchMinutes: a.watchMinutes + b.watchMinutes,
    });
    const zero = { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, totalInteractions: 0, watchMinutes: 0 };
    const totalOn = (day: number) => proofs.reduce((total, proof) => add(total, at(proof, day)), zero);

    const series: CampaignMetricHistoryPoint[] = proofs.length === 0 ? [] : Array.from({ length: DAYS }, (_, day) => ({
        platform: 'instagram',
        date: dateOf(day),
        ...totalOn(day),
    }));
    const contentPoints: CampaignMetricHistoryPoint[] = proofs.flatMap((proof) => Array.from({ length: DAYS }, (_, day) => ({
        platform: 'instagram',
        date: dateOf(day),
        ...at(proof, day),
        contentId: proof.id,
        campaignInfluencerId: proof.campaignInfluencerId,
        influencerName: proof.influencerName,
        contentFormat: 'reel',
        finalCaptureStatus: 'not_required' as const,
        isFinal: false,
        lastSuccessfulSyncAt: proof.lastSuccessfulSyncAt,
    })));

    return wait({
        campaignId,
        series,
        byFormat: proofs.length === 0 ? [] : [{ key: 'instagram:reel', platform: 'instagram', contentFormat: 'reel', totals: totalOn(DAYS - 1) }],
        influencers: proofs.map((proof) => ({
            campaignInfluencerId: proof.campaignInfluencerId,
            influencerName: proof.influencerName,
            totals: at(proof, DAYS - 1),
            series: Array.from({ length: DAYS }, (_, day) => {
                const point = at(proof, day);
                return { date: dateOf(day), views: point.views, reach: point.reach, totalInteractions: point.totalInteractions };
            }),
        })),
        contentPoints,
    });
}
