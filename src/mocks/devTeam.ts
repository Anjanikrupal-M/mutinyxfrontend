// ─────────────────────────────────────────────────────────────
// Dev-only demo team store for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`, the team hooks
// read and write team members here instead of the API, in this browser's localStorage. It is
// seeded once with sample members of the demo brand, some of them already assigned demo
// campaigns (devCampaigns.ts) and programs (devPrograms.ts), so the Teams list and member
// detail pages have real-looking data to design against. Nothing ever reaches a server.
// ─────────────────────────────────────────────────────────────

import type { Campaign } from '@/shared/types/campaign';
import type { TeamMember, TeamMemberBrand, TeamMemberWorkload, CreateTeamMemberPayload } from '@/modules/brands/hooks/useTeam';
import { useAuthStore } from '@/shared/stores/authStore';
import { DEV_DEMO_USER } from './devAuth';
import { demoCampaignSnapshot, demoSeedCampaignAgents, isDevDemoSession } from './devCampaigns';
import { demoProgramSnapshot } from './devPrograms';
import { demoBrandRefs } from './devBrands';

export { isDevDemoSession };

const STORE_KEY = 'mutiny:dev-demo-team-v2';
const LATENCY_MS = 300;

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const PRIMARY_BRAND: TeamMemberBrand = {
    id: DEV_DEMO_USER.brandId!,
    brandName: DEV_DEMO_USER.brandName ?? null,
    brandLogoUrl: DEV_DEMO_USER.brandLogoUrl ?? null,
};

const activeBrandId = () => useAuthStore.getState().user?.brandId ?? PRIMARY_BRAND.id;

const ACTIVE_CAMPAIGN_STATUSES = ['active', 'script', 'work'];

function seed(): TeamMember[] {
    return [
        {
            id: 'demo-agent-01',
            name: 'Neha Iyer',
            email: 'neha.iyer@brewandbloom.example.com',
            phoneNumber: '+91 98450 11223',
            isActive: true,
            createdAt: daysAgo(120),
            brands: demoBrandRefs([PRIMARY_BRAND.id, 'demo-brand-02']),
        },
        {
            id: 'demo-agent-02',
            name: 'Rohan Malhotra',
            email: 'rohan.m@brewandbloom.example.com',
            phoneNumber: '+91 99001 45678',
            isActive: true,
            createdAt: daysAgo(74),
            brands: demoBrandRefs([PRIMARY_BRAND.id, 'demo-brand-03']),
        },
        {
            id: 'demo-agent-03',
            name: 'Simran Kaur',
            email: 'simran.kaur@brewandbloom.example.com',
            phoneNumber: null,
            isActive: true,
            createdAt: daysAgo(9),
            brands: demoBrandRefs(['demo-brand-04']),
        },
        {
            id: 'demo-agent-04',
            name: 'Karthik Rao',
            email: 'karthik.rao@brewandbloom.example.com',
            phoneNumber: '+91 90080 77665',
            isActive: false,
            createdAt: daysAgo(210),
            brands: demoBrandRefs([PRIMARY_BRAND.id]),
        },
    ];
}

/** Seeded campaign assignments, so member workloads aren't empty on first load. */
const SEED_CAMPAIGN_AGENTS: Record<string, string> = {
    'camp-001': 'demo-agent-01',
    'camp-003': 'demo-agent-01',
    'camp-002': 'demo-agent-02',
    'camp-005': 'demo-agent-02',
    'camp-004': 'demo-agent-04',
};

function readStore(): TeamMember[] {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw) as TeamMember[];
    } catch {
        // Unreadable or blocked storage: fall through to a fresh seed.
    }
    const seeded = seed();
    writeStore(seeded);
    const names = new Map(seeded.map((m) => [m.id, m.name]));
    demoSeedCampaignAgents(Object.fromEntries(
        Object.entries(SEED_CAMPAIGN_AGENTS).map(([campaignId, agentId]) => [campaignId, { agentId, agentName: names.get(agentId) ?? null }]),
    ));
    return seeded;
}

function writeStore(members: TeamMember[]) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(members));
    } catch {
        // Storage quota or blocked storage; the change lives until reload.
    }
}

function update(id: string, change: (m: TeamMember) => TeamMember): TeamMember {
    const all = readStore();
    const index = all.findIndex((m) => m.id === id);
    if (index < 0) notFound(id);
    all[index] = change(all[index]);
    writeStore(all);
    return all[index];
}

function notFound(id: string): never {
    throw Object.assign(new Error(`Demo team member ${id} not found`), { response: { status: 404 } });
}

function assertEmailFree(email: string, exceptId?: string) {
    const taken = readStore().some((m) => m.id !== exceptId && m.email.toLowerCase() === email.trim().toLowerCase());
    if (taken) {
        throw Object.assign(new Error('Email already in use'), {
            response: { status: 409, data: { success: false, message: 'A user with this email already exists' } },
        });
    }
}

// ── Lookups used by the demo brand store ──

/** Current demo team members, read synchronously (brand detail lists a brand's managers from them). */
export function demoTeamSnapshot(): TeamMember[] {
    return readStore();
}

// ── Operations used by the team hooks ──

export function demoTeamMemberName(id: string | null): string | null {
    if (!id) return null;
    return readStore().find((m) => m.id === id)?.name ?? null;
}

export function demoListTeamMembers(): Promise<TeamMember[]> {
    return wait(readStore());
}

export function demoGetTeamMember(id: string): Promise<TeamMember> {
    const member = readStore().find((m) => m.id === id);
    return member ? wait(member) : Promise.reject(notFound(id));
}

export function demoGetTeamMemberWorkload(id: string): Promise<TeamMemberWorkload> {
    const member = readStore().find((m) => m.id === id);
    if (!member) return Promise.reject(notFound(id));

    const names = new Map(readStore().map((m) => [m.id, m.name]));
    // The demo campaigns and programs all belong to the signed-up brand.
    const managesBrand = member.brands.some((b) => b.id === PRIMARY_BRAND.id);
    const brandName = PRIMARY_BRAND.brandName;

    const campaigns = managesBrand
        ? demoCampaignSnapshot().map((c) => {
            const raw = c as Campaign & Record<string, any>;
            return {
                id: c.id,
                name: c.name,
                type: c.type,
                status: c.status,
                brandId: PRIMARY_BRAND.id,
                brandName,
                thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnail ?? null,
                agentId: c.agentId ?? null,
                agentName: c.agentId ? names.get(c.agentId) ?? c.agentName ?? null : null,
                applicationDeadline: raw.applicationDeadline ?? c.deadline ?? null,
                createdAt: raw.createdAt ?? daysAgo(30),
            };
        })
        : [];

    const programs = managesBrand
        ? demoProgramSnapshot().map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            brandId: PRIMARY_BRAND.id,
            brandName,
            thumbnailUrl: p.thumbnailUrl ?? null,
            agentId: p.agentId ?? null,
            agentName: p.agentId ? names.get(p.agentId) ?? p.agentName ?? null : null,
            createdAt: p.createdAt,
        }))
        : [];

    const mine = campaigns.filter((c) => c.agentId === id);
    return wait({
        stats: {
            assignedCampaigns: mine.length,
            activeCampaigns: mine.filter((c) => ACTIVE_CAMPAIGN_STATUSES.includes(c.status)).length,
            assignedPrograms: programs.filter((p) => p.agentId === id).length,
            brandsManaged: member.brands.length,
        },
        campaigns,
        programs,
    });
}

export function demoCreateTeamMember(payload: CreateTeamMemberPayload): Promise<TeamMember> {
    try {
        assertEmailFree(payload.email);
    } catch (err) {
        return Promise.reject(err);
    }
    const member: TeamMember = {
        id: `demo-agent-${Date.now()}`,
        name: payload.name.trim(),
        email: payload.email.trim(),
        phoneNumber: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        // Without a brand choice the member is scoped to the active brand, like the backend.
        brands: demoBrandRefs(payload.brandProfileIds?.length ? payload.brandProfileIds : [activeBrandId()]),
    };
    writeStore([...readStore(), member]);
    return wait(member);
}

export function demoUpdateTeamMember(id: string, patch: { name?: string; email?: string; phoneNumber?: string | null }): Promise<TeamMember> {
    try {
        if (patch.email) assertEmailFree(patch.email, id);
        return wait(update(id, (m) => ({ ...m, ...patch })));
    } catch (err) {
        return Promise.reject(err);
    }
}

export function demoSetTeamMemberPassword(id: string): Promise<{ success: true }> {
    try {
        update(id, (m) => m);
    } catch (err) {
        return Promise.reject(err);
    }
    return wait({ success: true });
}

export function demoSetTeamMemberBrands(id: string, brandProfileIds: string[]): Promise<TeamMember> {
    try {
        return wait(update(id, (m) => ({ ...m, brands: demoBrandRefs(brandProfileIds) })));
    } catch (err) {
        return Promise.reject(err);
    }
}

export function demoAssignTeamMemberBrand(id: string, brandId: string): Promise<TeamMember> {
    try {
        return wait(update(id, (m) => (m.brands.some((b) => b.id === brandId) ? m : { ...m, brands: [...m.brands, ...demoBrandRefs([brandId])] })));
    } catch (err) {
        return Promise.reject(err);
    }
}

export function demoUnassignTeamMemberBrand(id: string, brandId: string): Promise<TeamMember> {
    try {
        return wait(update(id, (m) => ({ ...m, brands: m.brands.filter((b) => b.id !== brandId) })));
    } catch (err) {
        return Promise.reject(err);
    }
}

export function demoSetTeamMemberStatus(id: string, isActive: boolean): Promise<TeamMember> {
    try {
        return wait(update(id, (m) => ({ ...m, isActive })));
    } catch (err) {
        return Promise.reject(err);
    }
}
