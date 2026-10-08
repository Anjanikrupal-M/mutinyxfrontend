// ─────────────────────────────────────────────────────────────
// Dev-only demo brand store for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`, the brand-profile
// hooks read and write client brands here instead of the API, in this browser's
// localStorage. The demo account is an agency head (devSubscription.ts puts it on the
// Agencies plan), so it owns several brands: Brew & Bloom, the brand it signed up with, plus
// client brands and one deactivated brand. Managers come from the demo team (devTeam.ts).
// Nothing ever reaches a server.
// ─────────────────────────────────────────────────────────────

import type { User } from '@/shared/stores/authStore';
import { useAuthStore } from '@/shared/stores/authStore';
import type { BrandProfileSummary } from '@/shared/hooks/useBrandProfiles';
import type { AgencyOverview, BrandOverview } from '@/modules/brands/hooks/useAgencyOverview';
import type { BrandDetail, BrandDetailCampaign, UpdateBrandDetailPayload } from '@/modules/brands/hooks/useBrandDetail';
import type { DeactivatedBrand } from '@/modules/brands/hooks/useBrandLifecycle';
import type { TeamMemberBrand } from '@/modules/brands/hooks/useTeam';
import { DEV_DEMO_USER } from './devAuth';
import { demoCampaignSnapshot, isDevDemoSession } from './devCampaigns';
import { demoTeamSnapshot } from './devTeam';

export { isDevDemoSession };

const STORE_KEY = 'mutiny:dev-demo-brands-v1';
const LATENCY_MS = 300;

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Inline SVG logo (initials on a tile) so logos render without an upload. */
const logo = (initials: string, bg: string, fg: string) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
        `<rect width="128" height="128" rx="28" fill="${bg}"/>` +
        `<text x="64" y="84" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="${fg}">${initials}</text></svg>`,
    );

interface StoredBrand extends Omit<BrandDetail, 'relation' | 'owner' | 'managers' | 'campaignStats' | 'recentCampaigns'> {
    isActive: boolean;
    deactivatedAt: string | null;
    /** Fixed figures for client brands; the signed-up brand derives its own from the demo campaigns. */
    stats: { campaignCount: number; activeCampaignCount: number; totalBudget: number; totalSpent: number };
    recentCampaigns: BrandDetailCampaign[];
}

const PRIMARY_BRAND_ID = DEV_DEMO_USER.brandId!;

function seed(): StoredBrand[] {
    const camp = (id: string, name: string, status: string, budgetTotal: number, createdDaysAgo: number): BrandDetailCampaign =>
        ({ id, name, status, budgetTotal, createdAt: daysAgo(createdDaysAgo) });

    return [
        {
            id: PRIMARY_BRAND_ID,
            brandName: DEV_DEMO_USER.brandName ?? 'Brew & Bloom',
            brandLogoUrl: DEV_DEMO_USER.brandLogoUrl ?? null,
            industry: DEV_DEMO_USER.industry ?? 'Food & Beverage',
            website: DEV_DEMO_USER.website ?? null,
            city: DEV_DEMO_USER.city ?? null,
            state: DEV_DEMO_USER.state ?? null,
            pincode: DEV_DEMO_USER.pincode ?? null,
            primaryLanguage: DEV_DEMO_USER.primaryLanguage ?? null,
            bio: DEV_DEMO_USER.bio ?? null,
            contactEmail: DEV_DEMO_USER.email,
            socialLinks: DEV_DEMO_USER.socialLinks,
            createdAt: daysAgo(400),
            isActive: true,
            deactivatedAt: null,
            stats: { campaignCount: 0, activeCampaignCount: 0, totalBudget: 0, totalSpent: 0 },
            recentCampaigns: [],
        },
        {
            id: 'demo-brand-02',
            brandName: 'Lumen Skincare',
            brandLogoUrl: logo('LS', '#f4e6dc', '#7a3e1d'),
            industry: 'Fashion & Beauty',
            website: 'https://lumenskin.example.com',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400050',
            primaryLanguage: 'English',
            bio: 'Clean, fragrance-free skincare made for humid Indian summers.',
            contactEmail: 'brand@lumenskin.example.com',
            socialLinks: { instagram: 'https://instagram.com/lumenskin' },
            createdAt: daysAgo(210),
            isActive: true,
            deactivatedAt: null,
            stats: { campaignCount: 6, activeCampaignCount: 2, totalBudget: 1_250_000, totalSpent: 780_000 },
            recentCampaigns: [
                camp('lumen-c1', 'Monsoon SPF Launch', 'active', 450_000, 12),
                camp('lumen-c2', 'Vitamin C Serum Reviews', 'work', 300_000, 34),
                camp('lumen-c3', 'Bridal Glow Edit', 'completed', 250_000, 90),
                camp('lumen-c4', 'Night Repair UGC', 'draft', 120_000, 3),
            ],
        },
        {
            id: 'demo-brand-03',
            brandName: 'Volt Gadgets',
            brandLogoUrl: logo('VG', '#0f172a', '#38bdf8'),
            industry: 'Technology',
            website: 'https://voltgadgets.example.com',
            city: 'Hyderabad',
            state: 'Telangana',
            pincode: '500081',
            primaryLanguage: 'English',
            bio: 'Affordable smart accessories: earbuds, chargers and wearables.',
            contactEmail: 'marketing@voltgadgets.example.com',
            socialLinks: { instagram: 'https://instagram.com/voltgadgets', youtube: 'https://youtube.com/@voltgadgets' },
            createdAt: daysAgo(150),
            isActive: true,
            deactivatedAt: null,
            stats: { campaignCount: 4, activeCampaignCount: 1, totalBudget: 900_000, totalSpent: 410_000 },
            recentCampaigns: [
                camp('volt-c1', 'Earbuds Pro Unboxing', 'script', 350_000, 8),
                camp('volt-c2', 'Festive Tech Gifting', 'completed', 300_000, 120),
                camp('volt-c3', 'Smartwatch Fitness Challenge', 'closed', 250_000, 160),
            ],
        },
        {
            id: 'demo-brand-04',
            brandName: 'PaisaPal',
            brandLogoUrl: logo('PP', '#dcfce7', '#166534'),
            industry: 'Finance',
            website: 'https://paisapal.example.com',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560102',
            primaryLanguage: 'Hindi',
            bio: 'A savings app that makes UPI auto-save simple for first-jobbers.',
            contactEmail: 'growth@paisapal.example.com',
            socialLinks: { youtube: 'https://youtube.com/@paisapal' },
            createdAt: daysAgo(45),
            isActive: true,
            deactivatedAt: null,
            stats: { campaignCount: 2, activeCampaignCount: 1, totalBudget: 400_000, totalSpent: 90_000 },
            recentCampaigns: [
                camp('paisa-c1', 'First Salary Savings Explainers', 'active', 280_000, 10),
                camp('paisa-c2', 'UPI Safety Week', 'draft', 120_000, 2),
            ],
        },
        {
            id: 'demo-brand-05',
            brandName: 'Kettle & Co.',
            brandLogoUrl: logo('KC', '#fef3c7', '#92400e'),
            industry: 'Lifestyle',
            website: 'https://kettleandco.example.com',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            primaryLanguage: 'English',
            bio: 'Handmade kitchenware. Contract paused for the season.',
            contactEmail: 'hello@kettleandco.example.com',
            createdAt: daysAgo(300),
            isActive: false,
            deactivatedAt: daysAgo(40),
            stats: { campaignCount: 3, activeCampaignCount: 0, totalBudget: 360_000, totalSpent: 360_000 },
            recentCampaigns: [camp('kettle-c1', 'Diwali Kitchen Makeover', 'completed', 360_000, 250)],
        },
    ];
}

function readStore(): StoredBrand[] {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw) as StoredBrand[];
    } catch {
        // Unreadable or blocked storage: fall through to a fresh seed.
    }
    const seeded = seed();
    writeStore(seeded);
    return seeded;
}

function writeStore(brands: StoredBrand[]) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(brands));
    } catch {
        // Usually the storage quota (uploaded logos); the change lives until reload.
    }
}

function update(id: string, change: (b: StoredBrand) => StoredBrand): StoredBrand {
    const all = readStore();
    const index = all.findIndex((b) => b.id === id);
    if (index < 0) notFound(id);
    all[index] = change(all[index]);
    writeStore(all);
    return all[index];
}

function notFound(id: string): never {
    throw Object.assign(new Error(`Demo brand ${id} not found`), { response: { status: 404 } });
}

function attempt<T>(run: () => T): Promise<T> {
    try {
        return wait(run());
    } catch (err) {
        return Promise.reject(err);
    }
}

const toNumber = (v: unknown) => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Campaign figures: the signed-up brand reads the live demo campaigns, client brands use their seed. */
function statsFor(brand: StoredBrand) {
    if (brand.id !== PRIMARY_BRAND_ID) return { stats: brand.stats, recent: brand.recentCampaigns };
    const campaigns = demoCampaignSnapshot();
    const budgets = campaigns.map((c) => toNumber((c as unknown as Record<string, unknown>).budgetTotal ?? c.budget?.total));
    const totalBudget = budgets.reduce((a, b) => a + b, 0);
    return {
        stats: {
            campaignCount: campaigns.length,
            activeCampaignCount: campaigns.filter((c) => ['active', 'script', 'work'].includes(c.status)).length,
            totalBudget,
            totalSpent: Math.round(totalBudget * 0.45),
        },
        recent: [...campaigns]
            .sort((a, b) => String((b as any).createdAt ?? '').localeCompare(String((a as any).createdAt ?? '')))
            .slice(0, 5)
            .map((c, i) => ({ id: c.id, name: c.name, status: c.status, budgetTotal: budgets[campaigns.indexOf(c)] ?? 0, createdAt: (c as any).createdAt ?? daysAgo(10 + i) })),
    };
}

const toSummary = (b: StoredBrand): BrandProfileSummary => ({
    id: b.id,
    brandName: b.brandName,
    brandLogoUrl: b.brandLogoUrl,
    industry: b.industry,
    contactEmail: b.contactEmail,
    createdAt: b.createdAt,
    isActive: b.isActive,
    relation: 'owned',
});

const owner = { id: DEV_DEMO_USER.id, name: DEV_DEMO_USER.name, email: DEV_DEMO_USER.email, isActive: true };

// ── Lookups used by the demo team store ──

/** Brand chips for the given ids (active or not), in the given order. */
export function demoBrandRefs(ids: string[]): TeamMemberBrand[] {
    const byId = new Map(readStore().map((b) => [b.id, b]));
    return ids
        .map((id) => byId.get(id))
        .filter((b): b is StoredBrand => !!b)
        .map((b) => ({ id: b.id, brandName: b.brandName, brandLogoUrl: b.brandLogoUrl }));
}

// ── Operations used by the brand hooks ──

export function demoListBrandProfiles(): Promise<BrandProfileSummary[]> {
    // Earliest-created first, like the backend: the first entry is the brand signed up with.
    return wait(readStore().filter((b) => b.isActive).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toSummary));
}

export function demoAgencyOverview(): Promise<AgencyOverview> {
    const brands: BrandOverview[] = readStore()
        .filter((b) => b.isActive)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((b) => ({ ...toSummary(b), ...statsFor(b).stats }));
    const owners = demoTeamSnapshot();
    return wait({
        brands,
        owners,
        totals: {
            brandCount: brands.length,
            ownerCount: owners.length,
            campaignCount: brands.reduce((s, b) => s + b.campaignCount, 0),
            activeCampaignCount: brands.reduce((s, b) => s + b.activeCampaignCount, 0),
        },
    });
}

export function demoGetBrandDetail(id: string): Promise<BrandDetail> {
    return attempt(() => {
        const brand = readStore().find((b) => b.id === id);
        if (!brand) notFound(id);
        const { stats, recent } = statsFor(brand);
        const { isActive: _a, deactivatedAt: _d, stats: _s, recentCampaigns: _r, ...fields } = brand;
        return {
            ...fields,
            relation: 'owned' as const,
            owner,
            managers: demoTeamSnapshot()
                .filter((m) => m.brands.some((b) => b.id === id))
                .map((m) => ({ id: m.id, name: m.name, email: m.email, isActive: m.isActive })),
            campaignStats: stats,
            recentCampaigns: recent,
        };
    });
}

export function demoUpdateBrandDetail(id: string, payload: UpdateBrandDetailPayload): Promise<StoredBrand> {
    return attempt(() => {
        const updated = update(id, (b) => ({ ...b, ...payload }));
        syncActiveBrand(updated);
        return updated;
    });
}

export async function demoUploadBrandLogo(id: string, file: File): Promise<{ brandLogoUrl: string }> {
    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
    const updated = update(id, (b) => ({ ...b, brandLogoUrl: url }));
    syncActiveBrand(updated);
    return wait({ brandLogoUrl: url });
}

export function demoDeleteBrandLogo(id: string): Promise<void> {
    return attempt(() => {
        syncActiveBrand(update(id, (b) => ({ ...b, brandLogoUrl: null })));
    });
}

export function demoListDeactivatedBrands(): Promise<DeactivatedBrand[]> {
    return wait(readStore()
        .filter((b) => !b.isActive)
        .map((b) => ({
            id: b.id,
            brandName: b.brandName,
            brandLogoUrl: b.brandLogoUrl,
            industry: b.industry,
            deactivatedAt: b.deactivatedAt ?? b.createdAt,
            createdAt: b.createdAt,
        })));
}

export function demoSetBrandActive(id: string, isActive: boolean): Promise<StoredBrand> {
    return attempt(() => {
        if (!isActive) {
            const active = readStore().filter((b) => b.isActive);
            if (active.length <= 1) {
                throw Object.assign(new Error('Cannot deactivate your only active brand'), {
                    response: { status: 400, data: { success: false, message: 'You cannot deactivate your only active brand' } },
                });
            }
            if (useAuthStore.getState().user?.brandId === id) {
                throw Object.assign(new Error('Switch to another brand first'), {
                    response: { status: 400, data: { success: false, message: 'Switch to another brand before deactivating this one' } },
                });
            }
        }
        return update(id, (b) => ({ ...b, isActive, deactivatedAt: isActive ? null : new Date().toISOString() }));
    });
}

export function demoCreateBrandProfile(payload: Partial<UpdateBrandDetailPayload> & { brandName: string }): Promise<BrandProfileSummary> {
    const brand: StoredBrand = {
        id: `demo-brand-${Date.now()}`,
        brandName: payload.brandName,
        brandLogoUrl: null,
        industry: payload.industry ?? null,
        website: payload.website ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
        primaryLanguage: payload.primaryLanguage ?? null,
        bio: payload.bio ?? null,
        contactEmail: payload.contactEmail ?? null,
        createdAt: new Date().toISOString(),
        isActive: true,
        deactivatedAt: null,
        stats: { campaignCount: 0, activeCampaignCount: 0, totalBudget: 0, totalSpent: 0 },
        recentCampaigns: [],
    };
    writeStore([...readStore(), brand]);
    return wait(toSummary(brand));
}

/** Makes `id` the active brand: the signed-in user carries its name, logo and profile fields. */
export function demoSwitchBrand(id: string): Promise<{ user: User }> {
    return attempt(() => {
        const brand = readStore().find((b) => b.id === id && b.isActive);
        if (!brand) notFound(id);
        const current = useAuthStore.getState().user ?? DEV_DEMO_USER;
        return { user: { ...current, ...brandUserFields(brand) } };
    });
}

function brandUserFields(brand: StoredBrand): Partial<User> {
    return {
        brandId: brand.id,
        brandName: brand.brandName,
        brandLogoUrl: brand.brandLogoUrl ?? undefined,
        industry: brand.industry ?? undefined,
        website: brand.website ?? undefined,
        city: brand.city ?? undefined,
        state: brand.state ?? undefined,
        pincode: brand.pincode ?? undefined,
        primaryLanguage: brand.primaryLanguage ?? undefined,
        bio: brand.bio ?? undefined,
    };
}

/** Editing the active brand also refreshes what the topbar and profile show for it. */
function syncActiveBrand(brand: StoredBrand) {
    const { user, token, refreshToken, setUser } = useAuthStore.getState();
    if (user?.brandId === brand.id) setUser({ ...user, ...brandUserFields(brand) }, token, refreshToken);
}
