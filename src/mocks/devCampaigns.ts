// ─────────────────────────────────────────────────────────────
// Dev-only demo campaign store for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`,
// the campaign hooks read and write campaigns here instead of the API:
// Save draft / Publish store them in this browser's localStorage, and the
// list, detail, edit and dashboard pages read them back. It is seeded once
// with the sample campaigns from data.ts. Nothing ever reaches a server.
// Production builds and real accounts always use the real API.
// ─────────────────────────────────────────────────────────────

import type { Campaign } from '@/shared/types/campaign';
import type { PaginatedResponse } from '@/core/types';
import { useAuthStore } from '@/shared/stores/authStore';
import { MOCK_CAMPAIGNS } from './data';
import { isDevDemoUser } from './devAuth';

const STORE_KEY = 'mutiny:dev-demo-campaigns';
// Which sample campaigns this browser's store has already been offered. Bump SEED_VERSION when
// data.ts gains sample campaigns: stores seeded earlier then pick up the new ones once (and only
// once, so a sample campaign someone deleted afterwards stays deleted).
const SEED_VERSION_KEY = 'mutiny:dev-demo-campaigns:seed';
const SEED_VERSION = '2';
const LATENCY_MS = 400;

/** True when campaign reads/writes should use this store (dev server + demo account). */
export function isDevDemoSession(): boolean {
    return isDevDemoUser(useAuthStore.getState().user);
}

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

/** Sample campaigns, given the flat fields the pages read (the API returns both shapes). */
function seedCampaigns(): Campaign[] {
    return (MOCK_CAMPAIGNS as unknown as Campaign[]).map((c) => ({
        ...c,
        budgetTotal: c.budget?.total,
        budgetMode: c.budget?.mode,
        budgetTierPricing: c.budget?.tierPricing,
        niches: c.niche,
        brief: c.brief ?? `${c.name} — sample campaign for the demo account.`,
        applicationDeadline: c.applicationDeadline ?? c.deadline,
    }));
}

function readStore(): Campaign[] {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const stored = JSON.parse(raw) as Campaign[];
            if (localStorage.getItem(SEED_VERSION_KEY) === SEED_VERSION) return stored;
            // Seeded from an older data.ts: add the sample campaigns it has never seen.
            const known = new Set(stored.map((c) => c.id));
            const topped = [...stored, ...seedCampaigns().filter((c) => !known.has(c.id))];
            writeStore(topped);
            localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
            return topped;
        }
    } catch {
        // Unreadable or blocked storage: fall through to a fresh seed.
    }
    const seeded = seedCampaigns();
    writeStore(seeded);
    try {
        localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
    } catch {
        // Blocked storage: nothing to remember.
    }
    return seeded;
}

function writeStore(campaigns: Campaign[]) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(campaigns));
    } catch {
        // Usually the storage quota (large cover images); the change lives until reload.
    }
}

function saveCampaign(campaign: Campaign): Campaign {
    const all = readStore();
    const index = all.findIndex((c) => c.id === campaign.id);
    if (index >= 0) all[index] = campaign;
    else all.unshift(campaign);
    writeStore(all);
    return campaign;
}

function notFound(id: string): never {
    throw Object.assign(new Error(`Demo campaign ${id} not found`), { response: { status: 404 } });
}

// ── Builder payload → campaign ──
// The builder sends { basics, deliverables, budget, timeline, meta } (see buildPayload in
// CampaignBuilderPage). The API flattens that into a Campaign; this mirrors the fields the
// list, detail and edit pages read back.
type BuilderPayload = {
    basics?: Record<string, any>;
    deliverables?: Record<string, any>;
    budget?: Record<string, any>;
    timeline?: Record<string, any>;
    meta?: Record<string, any>;
};

function applyPayload(base: Partial<Campaign>, payload: BuilderPayload): Partial<Campaign> {
    const { basics = {}, deliverables = {}, budget = {}, timeline = {}, meta = {} } = payload;
    const next: Record<string, any> = { ...base };
    const set = (key: string, value: unknown) => {
        if (value !== undefined) next[key] = value;
    };

    set('name', basics.campaignName);
    set('brief', basics.description);
    set('type', basics.type);
    set('visibility', basics.visibility);
    set('location', basics.location);
    set('creatorGender', basics.creatorGender);
    if (basics.niche) {
        next.niches = basics.niche;
        next.niche = basics.niche;
    }
    if (basics.targetAudience) {
        next.targetAgeRanges = basics.targetAudience.ageRanges;
        next.targetGender = basics.targetAudience.gender;
        next.targetLocations = basics.targetAudience.locations;
        next.targetLanguages = basics.targetAudience.languages;
    }
    if (basics.coverImageUrl) {
        next.thumbnail = basics.coverImageUrl;
        next.thumbnailUrl = basics.coverImageUrl;
    }

    next.requirements = {
        ...(base.requirements ?? {}),
        ...Object.fromEntries(Object.entries({
            platform: deliverables.platform,
            contentTypes: deliverables.contentTypes,
            postingType: deliverables.postingType,
            collabChannel: deliverables.collabChannel ?? undefined,
            references: deliverables.references,
            scriptType: deliverables.scriptType,
            scriptFlow: deliverables.scriptFlow,
            usageRights: deliverables.usageRights,
        }).filter(([, v]) => v !== undefined)),
    };
    set('platform', deliverables.platform);
    set('contentTypes', deliverables.contentTypes);
    set('postingType', deliverables.postingType);
    set('scriptType', deliverables.scriptType);
    set('scriptFlow', deliverables.scriptFlow);
    set('usageRights', deliverables.usageRights);
    set('visitAtSite', deliverables.visitAtSite);
    set('referenceUrls', deliverables.references);
    if (deliverables.contentTypes) {
        next.deliverables = (deliverables.contentTypes as string[]).map((type) => ({
            type,
            count: deliverables.contentTypeCounts?.[type] ?? 1,
        }));
    }

    set('budgetMode', budget.budgetMode);
    set('budgetTotal', budget.totalBudget);
    set('mixMode', budget.mixMode);
    set('selectedTier', budget.selectedTier);
    set('creatorSizes', budget.creatorSizes);
    set('budgetTierPricing', budget.tierConfig);
    set('productDetails', budget.productDetails);
    set('platformFeePercent', budget.platformFeePercent);
    next.budget = {
        ...(base.budget ?? {}),
        mode: budget.budgetMode ?? base.budget?.mode ?? 'paid',
        total: Number(budget.totalBudget ?? base.budget?.total ?? 0),
        tierPricing: budget.tierConfig ?? base.budget?.tierPricing ?? [],
        platformFeePercent: budget.platformFeePercent ?? base.budget?.platformFeePercent ?? 0,
    };
    if (budget.creatorSizes?.[0]) next.creatorSize = budget.creatorSizes[0];

    const dates = { ...budget, ...timeline };
    set('applicationDeadline', dates.applicationDeadline);
    set('scriptDeadline', dates.scriptDeadline);
    set('workDeadline', dates.workDeadline);
    set('proofOfWorkDeadline', dates.proofOfWorkDeadline);
    next.timeline = {
        applicationDeadline: next.applicationDeadline,
        scriptDeadline: next.scriptDeadline,
        workDeadline: next.workDeadline,
        proofOfWorkDeadline: next.proofOfWorkDeadline,
    };
    if (next.applicationDeadline) next.deadline = next.applicationDeadline;

    set('deadlineMode', meta.deadlineMode);
    set('programId', meta.programId);
    set('proofOfWorkRequired', meta.proofOfWorkReq);
    return next as Partial<Campaign>;
}

function newCampaign(): Campaign {
    const brandId = useAuthStore.getState().user?.brandId;
    return {
        id: `dev-campaign-${Date.now()}`,
        name: 'Untitled campaign',
        type: 'influencer',
        visibility: 'public',
        objective: '',
        status: 'draft',
        budget: { mode: 'paid', tierPricing: [], total: 0, platformFeePercent: 0 },
        location: 'Pan India',
        niche: [],
        creatorSize: 'micro',
        creatorsInvited: 0,
        creatorsAccepted: 0,
        applicationsCount: 0,
        pendingApplications: 0,
        pendingProductShipments: 0,
        pendingScripts: 0,
        pendingSubmissions: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
        deadline: '',
        createdVia: 'builder',
        brandId,
    } as Campaign;
}

// ── Operations used by the campaign hooks ──

export function demoListCampaigns(filters: Record<string, unknown> = {}): Promise<PaginatedResponse<Campaign>> {
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = (c: Campaign) =>
        c.status === 'active' && !!c.applicationDeadline && String(c.applicationDeadline).slice(0, 10) < today && !c.applicationsCount;

    let list = readStore();
    const status = filters.status as string | undefined;
    if (status === 'expired') list = list.filter(isExpired);
    else if (status === 'awaiting_approval') list = list.filter((c) => c.status === 'draft' && c.approvalStatus === 'pending');
    else if (status) list = list.filter((c) => c.status === status);
    if (filters.visibility) list = list.filter((c) => c.visibility === filters.visibility);
    if (filters.aiOnly === 'true') list = list.filter((c) => c.createdVia === 'ai_assistant' || c.createdVia === 'ai_strategist');
    if (filters.agentOnly === 'true') list = list.filter((c) => !!c.agentId);
    const search = String(filters.search ?? '').trim().toLowerCase();
    if (search) list = list.filter((c) => c.name?.toLowerCase().includes(search));

    const limit = Math.max(1, Number(filters.limit) || 20);
    const page = Math.max(1, Number(filters.page) || 1);
    return wait({
        success: true,
        data: list.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: list.length },
    });
}

export function demoGetCampaign(id: string): Promise<Campaign> {
    const campaign = readStore().find((c) => c.id === id);
    return campaign ? wait(campaign) : Promise.reject(notFound(id));
}

export function demoCreateCampaign(payload: BuilderPayload): Promise<Campaign> {
    const campaign = { ...newCampaign(), ...applyPayload({}, payload) } as Campaign;
    if (payload.meta?.status === 'active') campaign.status = 'active';
    return wait(saveCampaign(campaign));
}

export function demoUpdateCampaign(id: string, payload: BuilderPayload): Promise<Campaign> {
    const existing = readStore().find((c) => c.id === id);
    if (!existing) return Promise.reject(notFound(id));
    const updated = { ...existing, ...applyPayload(existing, payload) } as Campaign;
    if (payload.meta?.status) updated.status = payload.meta.status;
    return wait(saveCampaign(updated));
}

/** Publishing goes straight live for the demo account (there is no admin to approve it). */
export function demoLaunchCampaign(id: string): Promise<Campaign> {
    const existing = readStore().find((c) => c.id === id);
    if (!existing) return Promise.reject(notFound(id));
    return wait(saveCampaign({ ...existing, status: 'active', approvalStatus: 'approved', launchedAt: new Date().toISOString() } as Campaign));
}

export function demoCloseCampaign(id: string): Promise<Campaign> {
    const existing = readStore().find((c) => c.id === id);
    if (!existing) return Promise.reject(notFound(id));
    return wait(saveCampaign({ ...existing, status: 'closed', closedAt: new Date().toISOString() } as Campaign));
}

export function demoDeleteCampaign(id: string): Promise<void> {
    writeStore(readStore().filter((c) => c.id !== id));
    return wait(undefined);
}

/** Keeps the cover as a data URL so it survives a reload (ApiImage renders data: URLs directly). */
export async function demoUploadThumbnail(id: string, file: File): Promise<Campaign> {
    const existing = readStore().find((c) => c.id === id);
    if (!existing) return notFound(id);
    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
    return wait(saveCampaign({ ...existing, thumbnail: url, thumbnailUrl: url, coverImageUrl: url }));
}

/** Only the file name is kept; there is no file storage behind the demo account. */
export function demoUploadScript(id: string, file: File): Promise<Campaign> {
    const existing = readStore().find((c) => c.id === id);
    if (!existing) return Promise.reject(notFound(id));
    return wait(saveCampaign({ ...existing, scriptFileKey: `demo/${file.name}` }));
}

/** Current demo campaigns, read synchronously (the demo program store builds its phases from them). */
export function demoCampaignSnapshot(): Campaign[] {
    return readStore();
}

/** Links demo campaigns to demo programs; called once when the demo program store seeds. */
export function demoLinkCampaignsToPrograms(links: Record<string, string>) {
    writeStore(readStore().map((c) => (links[c.id] && !c.programId ? { ...c, programId: links[c.id] } : c)));
}

/** Tags demo campaigns with seeded team-member assignees; called once when the demo team store seeds. */
export function demoSeedCampaignAgents(links: Record<string, { agentId: string; agentName: string | null }>) {
    writeStore(readStore().map((c) => (links[c.id] && !c.agentId ? { ...c, ...links[c.id] } : c)));
}

export function demoAssignCampaignAgent(id: string, agentId: string | null, agentName: string | null = null): Promise<Campaign> {
    const all = readStore();
    const index = all.findIndex((c) => c.id === id);
    if (index < 0) return Promise.reject(Object.assign(new Error(`Demo campaign ${id} not found`), { response: { status: 404 } }));
    all[index] = { ...all[index], agentId, agentName: agentId ? agentName : null };
    writeStore(all);
    return wait(all[index]);
}
