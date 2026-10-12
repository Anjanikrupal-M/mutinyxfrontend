// ─────────────────────────────────────────────────────────────
// Dev-only demo responses for screens that have no store of their own.
//
// While signed in as the demo account (see devAuth.ts), the HTTP client
// (core/http.ts) asks `demoApiResponse` before sending a request. For the
// read-only endpoints listed below it answers here, in the same shape the
// real API returns, so the existing hooks and normalisers run unchanged:
//
//   notifications · messages (list + thread) · support (FAQs, tickets, info)
//   transactions · campaign payment summary · analytics overview
//
// Everything is built from the demo campaigns and their generated rosters
// (devCampaigns.ts, devCampaignTabs.ts), so names, counts and money agree
// with every other screen. Requests this file does not know about return
// undefined and go to the network as usual. Real accounts never get here.
// ─────────────────────────────────────────────────────────────

import type { Campaign, CampaignInfluencer } from '@/shared/types/campaign';
import { demoCampaignSnapshot, isDevDemoSession } from './devCampaigns';
import { demoRosterSnapshot } from './devCampaignTabs';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const toNumber = (value: unknown) => {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
};

const liveCampaigns = (): Campaign[] => demoCampaignSnapshot().filter((c) => c.status !== 'draft');
const rosters = () => liveCampaigns()
    .map((campaign) => demoRosterSnapshot(campaign.id))
    .filter((entry): entry is NonNullable<ReturnType<typeof demoRosterSnapshot>> => entry != null);

// ── Notifications ──

function notifications() {
    const items: Array<Record<string, unknown>> = [];
    let age = 8 * MINUTE;
    for (const { campaign, roster } of rosters()) {
        for (const ci of roster) {
            const base = { campaignId: campaign.id, campaignName: campaign.name, influencerId: ci.influencerId, influencerName: ci.userName };
            const name = ci.userName ?? 'A creator';
            const entry =
                ci.status === 'applied' ? { type: 'application', title: 'New application', message: `${name} applied to ${campaign.name}` }
                : ci.status === 'script_review' ? { type: 'script', title: 'Script submitted', message: `${name} submitted a script for review` }
                : ci.status === 'work_review' ? { type: 'submission', title: 'Content submitted', message: `${name} submitted their content for review` }
                : ci.status === 'proof_review' ? { type: 'submission', title: 'Proof of work shared', message: `${name} shared the live link for their post` }
                : ci.status === 'completed' ? { type: 'payment', title: 'Campaign complete', message: `${name} finished their work on ${campaign.name}` }
                : null;
            if (!entry) continue;
            const tab = entry.type === 'application' ? 'applications' : entry.type === 'script' ? 'scripts' : entry.type === 'submission' ? 'submissions' : 'overview';
            items.push({ id: `demo-notif-${ci.id}`, ...base, ...entry, actionUrl: `/campaigns/${campaign.id}?tab=${tab}`, isRead: items.length > 5, createdAt: ago(age) });
            age += 47 * MINUTE + (items.length % 3) * 23 * MINUTE;
        }
    }
    return items.slice(0, 24);
}

// ── Messages ──

const THREAD = [
    { from: 'brand', text: 'Hi! Thanks for joining the campaign. Did the brief make sense?' },
    { from: 'influencer', text: 'Hey! Yes, all clear. I was thinking of opening with an unboxing shot.' },
    { from: 'brand', text: 'Love that. Keep the product in frame for the first three seconds if you can.' },
    { from: 'influencer', text: 'Will do. I can share a rough cut by Thursday.' },
    { from: 'brand', text: 'Perfect. Any questions on the hashtags or the tag?' },
    { from: 'influencer', text: 'All good — I have them noted. Sending the draft soon!' },
];

function conversations() {
    const list: Array<Record<string, unknown>> = [];
    for (const { campaign, roster } of rosters()) {
        for (const ci of roster) {
            if (!['script_pending', 'script_review', 'work_pending', 'work_review', 'proof_review'].includes(ci.status)) continue;
            const index = list.length;
            const lastAt = ago((index + 1) * 2.5 * HOUR);
            list.push({
                id: `demo-conv-${ci.id}`,
                campaignId: campaign.id,
                campaignName: campaign.name,
                influencerId: ci.influencerId,
                influencerName: ci.userName,
                influencerHandle: ci.handle,
                otherName: ci.userName,
                status: 'active',
                lastMessage: THREAD[(index + 5) % THREAD.length].text,
                lastMessageAt: lastAt,
                unreadCount: index < 3 ? 3 - index : 0,
                brandUserId: 'demo-brand',
                influencerUserId: `demo-user-${ci.influencerId}`,
                createdAt: ago(5 * DAY),
            });
        }
    }
    return list.slice(0, 10);
}

function conversationThread(id: string) {
    const conversation = conversations().find((c) => c.id === id);
    if (!conversation) return undefined;
    const start = Date.now() - 2 * DAY;
    const messages = THREAD.map((line, i) => {
        const at = new Date(start + i * 3.5 * HOUR).toISOString();
        return {
            id: `${id}-m${i + 1}`,
            conversationId: id,
            senderId: line.from === 'brand' ? 'demo-brand' : `demo-user-${conversation.influencerId}`,
            senderRole: line.from,
            sender: line.from,
            content: line.text,
            isRead: true,
            timestamp: at,
            createdAt: at,
        };
    });
    return { success: true, data: { conversation, messages, meta: { total: messages.length, page: 1, limit: 50, totalPages: 1 } } };
}

// ── Support ──

const FAQS = [
    { id: 'faq-1', question: 'How do I invite creators to a private campaign?', answer: 'Open the campaign, go to Applications and use Invite creators. Only creators you invite can see and apply to a private campaign.' },
    { id: 'faq-2', question: 'When is the creator paid?', answer: 'Half of the agreed fee is paid as an advance once you accept the creator, and the rest after you approve their work.' },
    { id: 'faq-3', question: 'Can I ask a creator to change their script?', answer: 'Yes. Open the script in the Scripts tab and choose Request revision with a note. The creator gets it straight away.' },
    { id: 'faq-4', question: 'Where do the analytics numbers come from?', answer: 'Reach, views and interactions are fetched from Meta for every approved, live post, and refreshed daily.' },
    { id: 'faq-5', question: 'How do I add another brand to my account?', answer: 'Agency plans can add brands from the Brands page and switch between them from the profile menu.' },
    { id: 'faq-6', question: 'What does the Campaign fit score mean?', answer: 'It combines audience match, engagement, brand fit, track record, price and reliability. Hover the ring on a creator card for the breakdown.' },
];

const TICKETS = [
    { id: 'tkt-3', subject: 'Payment stuck on processing', message: 'The final payout for Summer Glow has shown "processing" since yesterday.', status: 'in_progress', createdAt: ago(1 * DAY + 3 * HOUR), adminNotes: 'We are checking with the payment gateway and will update you within 24 hours.' },
    { id: 'tkt-2', subject: 'Add a team member to two brands', message: 'Can one manager be assigned to both of our client brands?', status: 'resolved', createdAt: ago(6 * DAY), adminNotes: 'Yes — open Teams, pick the member and tick both brands under Access.' },
    { id: 'tkt-1', subject: 'Invoice for the October campaign', message: 'Please share the GST invoice for the Festive Sweets advance payment.', status: 'closed', createdAt: ago(14 * DAY), adminNotes: null },
];

// ── Money ──

function transactions() {
    const list: Array<Record<string, unknown>> = [];
    for (const { campaign, roster } of rosters()) {
        const paid = roster.filter((ci) => ci.status !== 'applied' && toNumber(ci.agreedBudget) > 0);
        if (paid.length === 0) continue;
        const feePercent = toNumber(campaign.platformFeePercent ?? campaign.budget?.platformFeePercent) || 5;
        const round = (type: 'advance' | 'final', creators: CampaignInfluencer[], daysAgo: number, index: number) => {
            const budget = creators.reduce((sum, ci) => sum + toNumber(ci.agreedBudget) / 2, 0);
            const fee = Math.round((budget * feePercent) / 100);
            list.push({
                id: `demo-tx-${campaign.id}-${type}`,
                campaignId: campaign.id,
                campaignName: campaign.name,
                campaignType: campaign.type,
                paymentType: type,
                round: index,
                status: 'captured',
                influencerBudgetTotal: budget,
                platformFeePercent: feePercent,
                platformFeeAmount: fee,
                totalAmount: budget + fee,
                currency: 'INR',
                gatewayOrderId: `order_demo_${campaign.id}_${type}`,
                capturedAt: ago(daysAgo * DAY),
                createdAt: ago(daysAgo * DAY + HOUR),
                creators: creators.map((ci) => ({ name: ci.userName ?? null, handle: ci.handle ?? null })),
                invoiceAvailable: type === 'final',
            });
        };
        round('advance', paid, 9 + list.length, 1);
        const finished = paid.filter((ci) => ci.status === 'completed');
        if (finished.length > 0) round('final', finished, 2 + list.length, 2);
    }
    const sumOf = (type: string) => list.filter((t) => t.paymentType === type).reduce((sum, t) => sum + toNumber(t.totalAmount), 0);
    return {
        success: true,
        data: {
            transactions: list,
            summary: { advancePaid: sumOf('advance'), finalPaid: sumOf('final'), totalPaid: sumOf('advance') + sumOf('final'), roundCount: list.length },
        },
        meta: { page: 1, limit: 50, total: list.length, totalPages: 1 },
    };
}

function paymentSummary(campaignId: string) {
    const found = demoRosterSnapshot(campaignId);
    if (!found) return undefined;
    const feePercent = toNumber(found.campaign.platformFeePercent ?? found.campaign.budget?.platformFeePercent) || 5;
    const roundOf = (creators: CampaignInfluencer[]) => {
        const influencerTotal = creators.reduce((sum, ci) => sum + toNumber(ci.agreedBudget) / 2, 0);
        const platformFee = Math.round((influencerTotal * feePercent) / 100);
        return { count: creators.length, influencerTotal, platformFee, grandTotal: influencerTotal + platformFee, currency: 'INR', ciIds: creators.map((ci) => ci.id) };
    };
    // Final round: creators whose work is approved (proof stage) and not yet settled.
    const finalDue = found.roster.filter((ci) => ci.status === 'proof_review');
    return {
        success: true,
        data: {
            nextAdvanceRound: roundOf([]),
            nextFinalRound: roundOf(finalDue),
            paymentRounds: [],
            paymentBypassEnabled: false,
        },
    };
}

// ── Analytics overview (the Analytics page) ──

function analyticsOverview() {
    const all = rosters();
    const proofs = all.flatMap((entry) => entry.proofs.map((proof) => ({ ...proof, campaignId: entry.campaign.id, campaignName: entry.campaign.name })));
    const total = (rows: typeof proofs, pick: (p: (typeof proofs)[number]) => number) => rows.reduce((sum, p) => sum + pick(p), 0);
    const metricsOf = (rows: typeof proofs) => {
        const reach = total(rows, (p) => p.scrapedReach);
        const interactions = total(rows, (p) => p.scrapedTotalInteractions);
        return {
            format: 'reel', label: 'Reel', requested: true,
            proofCount: rows.length,
            creatorCount: new Set(rows.map((p) => p.influencerId)).size,
            lastFetchedAt: new Date().toISOString(),
            totalReach: reach,
            totalViews: total(rows, (p) => p.scrapedViews),
            totalLikes: total(rows, (p) => p.scrapedLikes),
            totalComments: total(rows, (p) => p.scrapedComments),
            totalShares: total(rows, (p) => p.scrapedShares),
            totalSaved: total(rows, (p) => p.scrapedSaved),
            totalEngagements: interactions,
            totalReplies: null, totalFollows: null,
            averageWatchTime: 11.4,
            totalWatchTime: Math.round(total(rows, (p) => p.scrapedViews) * 11.4),
            engagementRate: reach > 0 ? Number(((interactions / reach) * 100).toFixed(2)) : null,
            metricAvailability: {},
        };
    };
    const group = <K extends string>(key: (p: (typeof proofs)[number]) => K, label: (p: (typeof proofs)[number]) => string, handle?: (p: (typeof proofs)[number]) => string) => {
        const map = new Map<K, typeof proofs>();
        for (const p of proofs) map.set(key(p), [...(map.get(key(p)) ?? []), p]);
        return [...map.entries()].map(([id, rows]) => ({ id, name: label(rows[0]), handle: handle?.(rows[0]) ?? null, metrics: metricsOf(rows) }));
    };
    const reel = {
        ...metricsOf(proofs),
        campaignCount: new Set(proofs.map((p) => p.campaignId)).size,
        campaigns: group((p) => p.campaignId, (p) => p.campaignName),
        influencers: group((p) => p.influencerId, (p) => p.influencerName, (p) => p.influencerHandle),
    };
    return { success: true, data: { formats: proofs.length > 0 ? [reel] : [], generatedAt: new Date().toISOString() } };
}

// ── Router ──

/**
 * The demo answer for a request, or undefined to let it go to the network. `url` is the
 * request URL as the hooks build it (with or without the API base in front).
 */
export function demoApiResponse(method: string | undefined, url: string | undefined): unknown {
    if (!url || !isDevDemoSession()) return undefined;
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '').replace(/^.*?\/v\d+(?=\/)/, '');
    const verb = (method ?? 'get').toLowerCase();

    if (verb === 'get') {
        if (path === '/notifications') {
            const list = notifications();
            return { success: true, data: list, unreadCount: list.filter((n) => !n.isRead).length, meta: { page: 1, limit: list.length, total: list.length, totalPages: 1 } };
        }
        if (path === '/messages') return { success: true, data: conversations() };
        const thread = path.match(/^\/messages\/([^/]+)$/);
        if (thread) return conversationThread(thread[1]);
        if (path === '/support/faqs') return { success: true, data: FAQS };
        if (path === '/support/tickets') return { success: true, data: TICKETS };
        if (path === '/support/info') return { success: true, data: { email: 'connect@mutinytalent.com', phone: '+91 79958 96438' } };
        if (path === '/transactions') return transactions();
        if (path === '/analytics/overview') return analyticsOverview();
        const payment = path.match(/^\/campaigns\/([^/]+)\/payment\/summary$/);
        if (payment) return paymentSummary(payment[1]);
        return undefined;
    }

    // Password change: the demo account has no real password, so accept it (Settings' button plays through).
    if (verb === 'post' && path === '/brand/auth/change-password') return { success: true, data: { message: 'Password updated' } };
    // Support ticket: accepted, so the Submit button's sending animation plays through to "sent".
    if (verb === 'post' && path === '/support/contact') return { success: true, data: { id: `tkt-demo-${Date.now()}`, status: 'open' } };

    // Marking notifications read: accept quietly so the bell clears without a network error.
    if (verb === 'post' && (/^\/notifications\/[^/]+\/read$/.test(path) || path === '/notifications/read-all')) return { success: true };
    return undefined;
}
