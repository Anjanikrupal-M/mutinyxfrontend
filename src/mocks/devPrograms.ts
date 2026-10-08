// ─────────────────────────────────────────────────────────────
// Dev-only demo program store for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`, the program hooks
// read and write programs here instead of the API, in this browser's localStorage. It is
// seeded once with sample programs whose phases point at the demo campaigns (devCampaigns.ts)
// and whose enrollments are demo creators (devInfluencers.ts), so the list and detail pages
// have real-looking data to design against. Nothing ever reaches a server.
// ─────────────────────────────────────────────────────────────

import type { Campaign, EnrollmentStatus, Program, ProgramEnrollment, ProgramPhase } from '@/shared/types/campaign';
import type { PaginatedResponse } from '@/core/types';
import { demoCampaignSnapshot, demoLinkCampaignsToPrograms, isDevDemoSession } from './devCampaigns';
import { demoCreatorList } from './devInfluencers';

export { isDevDemoSession };

const STORE_KEY = 'mutiny:dev-demo-programs-v2';
const LATENCY_MS = 350;

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const cover = (id: string) => `https://images.unsplash.com/${id}?w=800&h=500&fit=crop&q=80`;

/** What is stored per program; phases and counts are derived on read. */
interface StoredProgram extends Omit<Program, 'phases' | 'campaignCount' | 'totalBudget' | 'enrollmentCount' | 'acceptedCount' | 'canAddPhase'> {
    /** Campaign ids in phase order. */
    phaseCampaignIds: string[];
    phaseNames: Record<string, string>;
    enrollments: StoredEnrollment[];
}

interface StoredEnrollment {
    id: string;
    influencerId: string;
    status: EnrollmentStatus;
    note: string | null;
    enrolledAt: string;
    reviewedAt: string | null;
    invitedCampaignIds: string[];
}

function seed(): StoredProgram[] {
    const enroll = (id: string, influencerId: string, status: EnrollmentStatus, enrolledDaysAgo: number, note: string | null = null, invitedCampaignIds: string[] = []): StoredEnrollment => ({
        id, influencerId, status, note, invitedCampaignIds,
        enrolledAt: daysAgo(enrolledDaysAgo),
        reviewedAt: status === 'pending' ? null : daysAgo(Math.max(0, enrolledDaysAgo - 1)),
    });

    return [
        {
            id: 'demo-prog-01',
            name: 'Glow Ambassadors 2026',
            description: 'Year-round skincare ambassadors who launch every Brew & Bloom glow drop first.',
            brief: 'Long-term ambassadors for our skincare line. Expect one hero reel and two stories per drop, honest routines, no heavy filters.',
            enrollmentOpen: true,
            niches: ['Fashion & Beauty', 'Lifestyle'],
            thumbnailUrl: cover('photo-1556228578-8c89e6adf883'),
            status: 'active',
            createdAt: daysAgo(64),
            updatedAt: daysAgo(2),
            phaseCampaignIds: ['camp-001'],
            phaseNames: { 'camp-001': 'Summer launch' },
            enrollments: [
                enroll('demo-enr-01', 'demo-inf-04', 'accepted', 20, 'Would love to do a 30-day glow routine series.', ['camp-001']),
                enroll('demo-enr-02', 'demo-inf-02', 'pending', 3, 'My audience asks about skincare for men a lot.'),
                enroll('demo-enr-03', 'demo-inf-03', 'pending', 1),
                enroll('demo-enr-04', 'demo-inf-01', 'rejected', 15),
            ],
        },
        {
            id: 'demo-prog-02',
            name: 'Brew & Bloom Food Club',
            description: 'Food creators who review every new café menu across Hyderabad and Bengaluru.',
            brief: 'Visit the café, try the seasonal menu, post a reel within 5 days. Bills are reimbursed in full.',
            enrollmentOpen: true,
            niches: ['Food & Beverage', 'Hospitality & Travel'],
            thumbnailUrl: cover('photo-1495474472287-4d71bcdd2085'),
            status: 'active',
            createdAt: daysAgo(41),
            updatedAt: daysAgo(1),
            phaseCampaignIds: ['camp-005'],
            phaseNames: { 'camp-005': 'Restaurant review series' },
            enrollments: [
                enroll('demo-enr-05', 'demo-inf-01', 'accepted', 30, 'Street food is my thing — happy to cover the Vizag outlet too.', ['camp-005']),
                enroll('demo-enr-06', 'demo-inf-03', 'accepted', 22),
                enroll('demo-enr-07', 'demo-inf-16', 'pending', 2, 'Can cover the Kochi launch.'),
            ],
        },
        {
            id: 'demo-prog-03',
            name: 'Meme Squad',
            description: 'A rotating crew of meme pages for fast, funny launch moments.',
            brief: 'Turnaround in 24 hours. Keep the brand mention natural — no hard sell.',
            enrollmentOpen: false,
            niches: ['Entertainment & Media'],
            thumbnailUrl: null,
            status: 'active',
            createdAt: daysAgo(28),
            updatedAt: daysAgo(6),
            phaseCampaignIds: ['camp-002'],
            phaseNames: { 'camp-002': '#BreakTheInternet' },
            enrollments: [
                enroll('demo-enr-08', 'demo-inf-02', 'accepted', 25, null, ['camp-002']),
            ],
        },
        {
            id: 'demo-prog-04',
            name: 'Tech Unboxed',
            description: 'Gadget reviewers for unboxing drops — paused until the next product batch lands.',
            brief: 'Unbox on camera within 48 hours of delivery. Show the real setup process.',
            enrollmentOpen: false,
            niches: ['Technology', 'Entertainment & Media'],
            thumbnailUrl: cover('photo-1519389950473-47ba0277781c'),
            status: 'paused',
            createdAt: daysAgo(90),
            updatedAt: daysAgo(12),
            phaseCampaignIds: ['camp-004'],
            phaseNames: { 'camp-004': 'Gadget unboxing wave 1' },
            enrollments: [
                enroll('demo-enr-09', 'demo-inf-02', 'accepted', 70, null, ['camp-004']),
                enroll('demo-enr-10', 'demo-inf-16', 'withdrawn', 50),
            ],
        },
        {
            id: 'demo-prog-05',
            name: 'FinTech Voices',
            description: 'Creators who explain money simply — run by the growth team.',
            brief: 'Explainers and live Spaces on saving and UPI safety. Compliance review before posting.',
            enrollmentOpen: true,
            niches: ['Finance', 'Education'],
            thumbnailUrl: cover('photo-1554224155-6726b3ff858f'),
            status: 'active',
            createdAt: daysAgo(15),
            updatedAt: daysAgo(3),
            agentId: 'demo-agent-01',
            agentName: 'Neha Iyer',
            phaseCampaignIds: ['camp-003'],
            phaseNames: { 'camp-003': 'Spaces pilot' },
            enrollments: [
                enroll('demo-enr-11', 'demo-inf-04', 'pending', 4),
            ],
        },
        {
            id: 'demo-prog-06',
            name: 'Festive Collective',
            description: 'Last season’s Diwali gifting collective — wrapped up with 9 creators.',
            brief: 'Festive gifting reels and unboxings across October–November.',
            enrollmentOpen: false,
            niches: ['Lifestyle', 'Jewellery & Accessories'],
            thumbnailUrl: cover('photo-1513151233558-d860c5398176'),
            status: 'completed',
            createdAt: daysAgo(330),
            updatedAt: daysAgo(280),
            phaseCampaignIds: [],
            phaseNames: {},
            enrollments: [
                enroll('demo-enr-12', 'demo-inf-03', 'accepted', 320),
                enroll('demo-enr-13', 'demo-inf-04', 'accepted', 318),
            ],
        },
    ];
}

function readStore(): StoredProgram[] {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw) as StoredProgram[];
    } catch {
        // Unreadable or blocked storage: fall through to a fresh seed.
    }
    const seeded = seed();
    writeStore(seeded);
    // The detail page lists a program's campaigns by their programId, so tag the seeded phases.
    demoLinkCampaignsToPrograms(Object.fromEntries(seeded.flatMap((p) => p.phaseCampaignIds.map((id) => [id, p.id]))));
    return seeded;
}

function writeStore(programs: StoredProgram[]) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(programs));
    } catch {
        // Usually the storage quota (large cover images); the change lives until reload.
    }
}

function update(id: string, change: (p: StoredProgram) => StoredProgram): StoredProgram {
    const all = readStore();
    const index = all.findIndex((p) => p.id === id);
    if (index < 0) notFound(id);
    all[index] = { ...change(all[index]), updatedAt: new Date().toISOString() };
    writeStore(all);
    return all[index];
}

function notFound(id: string): never {
    throw Object.assign(new Error(`Demo program ${id} not found`), { response: { status: 404 } });
}

const toNumber = (v: unknown) => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Phases: the seeded campaign ids, plus any demo campaign the builder linked to this program. */
function phasesFor(program: StoredProgram, campaigns: Campaign[]): ProgramPhase[] {
    const byId = new Map(campaigns.map((c) => [c.id, c]));
    const ids = [
        ...program.phaseCampaignIds,
        ...campaigns.filter((c) => c.programId === program.id && !program.phaseCampaignIds.includes(c.id)).map((c) => c.id),
    ];
    return ids
        .map((id) => byId.get(id))
        .filter((c): c is Campaign => !!c)
        .map((c, i) => {
            const raw = c as Campaign & Record<string, any>;
            return {
                id: `${program.id}-phase-${i + 1}`,
                phaseNumber: i + 1,
                phaseName: program.phaseNames[c.id] ?? null,
                createdAt: raw.createdAt,
                campaign: {
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    type: c.type,
                    visibility: c.visibility,
                    budgetTotal: raw.budgetTotal ?? c.budget?.total ?? null,
                    progress: c.progress ?? 0,
                    creatorsAccepted: c.creatorsAccepted ?? 0,
                    launchedAt: raw.launchedAt ?? null,
                    closedAt: raw.closedAt ?? null,
                    createdAt: raw.createdAt,
                    thumbnailUrl: raw.thumbnailUrl ?? null,
                    thumbnail: raw.thumbnail ?? null,
                    location: c.location ?? null,
                    deadline: c.deadline ?? null,
                    niches: raw.niches ?? c.niche ?? null,
                    budgetMode: raw.budgetMode ?? c.budget?.mode ?? null,
                    budgetTierPricing: raw.budgetTierPricing ?? c.budget?.tierPricing ?? null,
                },
            };
        });
}

function toProgram(stored: StoredProgram, campaigns: Campaign[]): Program {
    const { phaseCampaignIds: _ids, phaseNames: _names, enrollments, ...base } = stored;
    const phases = phasesFor(stored, campaigns);
    return {
        ...base,
        phases,
        campaignCount: phases.length,
        totalBudget: phases.reduce((sum, ph) => sum + toNumber(ph.campaign.budgetTotal), 0),
        canAddPhase: stored.status === 'active',
        enrollmentCount: enrollments.filter((e) => e.status !== 'withdrawn').length,
        acceptedCount: enrollments.filter((e) => e.status === 'accepted').length,
    };
}

/** Current demo programs as stored, read synchronously (the demo team store builds workloads from them). */
export function demoProgramSnapshot(): StoredProgram[] {
    return readStore();
}

// ── Operations used by the program hooks ──

export function demoListPrograms(filters: Record<string, unknown> = {}): Promise<PaginatedResponse<Program>> {
    const campaigns = demoCampaignSnapshot();
    let list = readStore();
    if (filters.status) list = list.filter((p) => p.status === filters.status);
    if (filters.agentOnly === 'true') list = list.filter((p) => !!p.agentId);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const page = Math.max(1, Number(filters.page) || 1);
    return wait({
        success: true,
        data: list.slice((page - 1) * limit, page * limit).map((p) => toProgram(p, campaigns)),
        meta: { page, limit, total: list.length },
    });
}

export function demoGetProgram(id: string): Promise<Program> {
    const stored = readStore().find((p) => p.id === id);
    return stored ? wait(toProgram(stored, demoCampaignSnapshot())) : Promise.reject(notFound(id));
}

export function demoListEnrollments(programId: string): Promise<ProgramEnrollment[]> {
    const stored = readStore().find((p) => p.id === programId);
    if (!stored) return wait([]);
    const creators = new Map(demoCreatorList().map((c) => [c.id, c]));
    return wait(stored.enrollments.map((e) => {
        const creator = creators.get(e.influencerId);
        return {
            ...e,
            name: creator?.userName ?? null,
            handle: creator?.handle || null,
            avatarUrl: creator?.userAvatarUrl ?? null,
            bio: creator?.bio ?? null,
            followerCount: creator?.followerCount ?? null,
            niches: creator?.niches ?? null,
            tier: creator?.tier ?? null,
            hasBeenInvited: e.invitedCampaignIds.length > 0,
        };
    }));
}

export function demoCreateProgram(payload: { name: string; description?: string; brief?: string; niches?: string[]; enrollmentOpen?: boolean }): Promise<Program> {
    const now = new Date().toISOString();
    const program: StoredProgram = {
        id: `demo-prog-${Date.now()}`,
        name: payload.name,
        description: payload.description ?? null,
        brief: payload.brief ?? null,
        niches: payload.niches ?? [],
        enrollmentOpen: payload.enrollmentOpen ?? false,
        thumbnailUrl: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        phaseCampaignIds: [],
        phaseNames: {},
        enrollments: [],
    };
    writeStore([program, ...readStore()]);
    return wait(toProgram(program, demoCampaignSnapshot()));
}

export function demoUpdateProgram(id: string, payload: Partial<Pick<Program, 'name' | 'description' | 'brief' | 'niches' | 'enrollmentOpen'>> & { status?: string }): Promise<Program> {
    const updated = update(id, (p) => ({ ...p, ...payload, status: (payload.status as Program['status']) ?? p.status }));
    return wait(toProgram(updated, demoCampaignSnapshot()));
}

export function demoAssignProgramAgent(id: string, agentId: string | null, agentName: string | null = null): Promise<Program> {
    const updated = update(id, (p) => ({ ...p, agentId, agentName: agentId ? agentName ?? 'Team member' : null }));
    return wait(toProgram(updated, demoCampaignSnapshot()));
}

export function demoDeleteProgram(id: string): Promise<void> {
    writeStore(readStore().filter((p) => p.id !== id));
    return wait(undefined);
}

export function demoReviewEnrollment(programId: string, enrollmentId: string, status: 'accepted' | 'rejected') {
    update(programId, (p) => ({
        ...p,
        enrollments: p.enrollments.map((e) => (e.id === enrollmentId ? { ...e, status, reviewedAt: new Date().toISOString() } : e)),
    }));
    return wait({ success: true });
}

export function demoInviteFromEnrollment(programId: string, enrollmentId: string, campaignId: string) {
    update(programId, (p) => ({
        ...p,
        enrollments: p.enrollments.map((e) => (e.id === enrollmentId && !e.invitedCampaignIds.includes(campaignId)
            ? { ...e, invitedCampaignIds: [...e.invitedCampaignIds, campaignId] }
            : e)),
    }));
    return wait({ success: true });
}

/** Keeps the cover as a data URL so it survives a reload (ApiImage renders data: URLs directly). */
export async function demoUploadProgramThumbnail(id: string, file: File): Promise<{ thumbnailUrl: string }> {
    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
    update(id, (p) => ({ ...p, thumbnailUrl: url }));
    return wait({ thumbnailUrl: url });
}
