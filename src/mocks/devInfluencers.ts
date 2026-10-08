// ─────────────────────────────────────────────────────────────
// Dev-only demo creators for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`,
// the Influencers page, a creator's profile and the bookmark/saved-list
// hooks read from here instead of the API, so the pages can be designed
// without a server. Saved creators are kept in this browser's localStorage.
// Production builds and real accounts always use the real API.
// ─────────────────────────────────────────────────────────────

import type { PaginatedResponse } from '@/core/types';
import type { Influencer } from '@/modules/discover/hooks/useInfluencers';
import { isDevDemoSession } from './devCampaigns';

export { isDevDemoSession };

const SAVED_KEY = 'mutiny:dev-demo-saved-creators';
const LATENCY_MS = 350;
const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

// Unsplash portraits (cropped square). Creators without one show the letter avatar.
const photo = (id: string) => `https://images.unsplash.com/${id}?w=640&h=520&fit=crop&crop=faces&q=80`;

type DemoCreator = Partial<Influencer> & Pick<Influencer, 'id' | 'userName' | 'location' | 'bio' | 'niches' | 'tier'>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const CREATORS: DemoCreator[] = [
    {
        id: 'demo-inf-01', userName: 'omkar', handle: '', location: 'Visakhapatnam, India',
        userAvatarUrl: photo('photo-1506794778202-cad84cf45f1d'),
        bio: 'good\nboy who loves food walks and street fashion around Vizag. DM for collabs.',
        niches: ['Food & Beverage', 'Fashion & Beauty'], tier: 'nano', badges: ['top_creator', 'brand_favourite'],
        platforms: [{ platform: 'instagram', handle: 'omkar.eats', followers: 206 }, { platform: 'youtube', handle: 'omkarvlogs', followers: 6_030_000 }],
        engagementRate: null as unknown as number, dataTrust: 'self_reported', pastCollaborations: 14, rating: 4.8,
    },
    {
        id: 'demo-inf-02', userName: 'Pragnatej', handle: 'pragnatej.k', location: 'Hyderabad, India',
        userAvatarUrl: photo('photo-1500648767791-00dcc994a43e'),
        bio: 'My bio of the me and then — tech, startups and the occasional movie review.',
        niches: ['Entertainment & Media'], tier: 'nano', badges: ['top_creator', 'brand_favourite'],
        platforms: [{ platform: 'instagram', handle: 'pragnatej.k', followers: 3_574 }, { platform: 'youtube', handle: 'pragnatej', followers: 5_140_000 }],
        engagementRate: 9.26, dataTrust: 'verified_not_refreshing', dataRefreshedAt: '2026-07-26T10:00:00Z',
        instagramConnected: true, instagramDataCoverage: 'partial', pastCollaborations: 11, rating: 4.6,
        // Profile-page sample data, so the pricing, audience and previous-work cards all render.
        rateCard: { instagram_reel: 18_000, instagram_post: 12_000, instagram_story: 6_000, youtube_short: 25_000, youtube_video: 60_000 },
        demographics: {
            age: { '18-24': 42, '25-34': 38, '35-44': 14, '45+': 6 },
            gender: { male: 64, female: 36 },
            topLocations: ['Hyderabad', 'Bengaluru', 'Mumbai', 'Pune'],
        },
        previousWork: [
            {
                id: 'demo-pw-01', campaignId: 'camp-002', campaignName: 'Viral Meme Challenge #BreakTheInternet',
                campaignThumbnailUrl: `https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=480&h=600&fit=crop&q=80`,
                platform: 'instagram', brand: { name: 'Brew & Bloom', logoUrl: null, industry: 'Food & Beverage' },
                completedAt: daysAgo(40), rating: 5, review: 'Fast turnaround and the reel landed perfectly with our audience.',
                results: { posts: 2, views: 412_000, likes: 38_400, comments: 1_260, reach: 298_000, shares: 2_140, saves: 960 },
                posts: [],
            },
            {
                id: 'demo-pw-02', campaignId: 'camp-004', campaignName: 'UGC Product Unboxing — Tech Gadgets',
                campaignThumbnailUrl: `https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=480&h=600&fit=crop&q=80`,
                platform: 'youtube', brand: { name: 'Pixel Labs', logoUrl: null, industry: 'Technology' },
                completedAt: daysAgo(95), rating: 4, review: 'Clear, honest unboxing — strong watch time.',
                results: { posts: 1, views: 186_000, likes: 9_800, comments: 640, reach: null, shares: null, saves: null },
                posts: [],
            },
            {
                id: 'demo-pw-03', campaignId: 'camp-005', campaignName: 'Food Review Series — Restaurant Chain',
                campaignThumbnailUrl: `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=480&h=600&fit=crop&q=80`,
                platform: 'instagram', brand: { name: 'Spice Route', logoUrl: null, industry: 'Food & Beverage' },
                completedAt: daysAgo(150), rating: 5, review: null,
                results: { posts: 3, views: 254_000, likes: 21_300, comments: 870, reach: 190_000, shares: 1_120, saves: 2_400 },
                posts: [],
            },
        ],
    },
    {
        id: 'demo-inf-03', userName: 'Raju', handle: '', location: 'Urvasi, India',
        bio: 'Hey iam an influencer — lifestyle, jewellery and food from small-town India.',
        niches: ['Entertainment & Media', 'Jewellery & Accessories', 'Fashion & Beauty', 'Lifestyle', 'Food & Beverage'],
        tier: 'nano', badges: ['top_creator', 'brand_favourite'],
        platforms: [{ platform: 'instagram', handle: 'raju.official', followers: 334 }, { platform: 'youtube', handle: 'rajutalks', followers: 1_480_000 }],
        engagementRate: 28.04, dataTrust: 'self_reported', pastCollaborations: 12, rating: 4.7,
    },
    {
        id: 'demo-inf-04', userName: 'Harini V', handle: 'harini.v', location: 'Hyderabad, India',
        userAvatarUrl: photo('photo-1494790108377-be9c29b29330'),
        bio: 'Relatable & Attainable — everyday makeup, outfit ideas and honest reviews.',
        niches: ['Fashion & Beauty', 'Entertainment & Media'], tier: 'micro', badges: ['rising_star'],
        platforms: [{ platform: 'instagram', handle: 'harini.v', followers: 34_900 }],
        engagementRate: 3.5, dataTrust: 'verified', instagramConnected: true, instagramDataCoverage: 'full',
        instagramTopCountry: 'IN', instagramTopAgeGroup: '18-24', instagramFollowerGrowth30d: 4.2,
        medianReelViews: 18_400, verifiedCampaignResults: 3, pastCollaborations: 6, rating: 4.9,
    },
    {
        id: 'demo-inf-05', userName: 'Ala_mana_nellore_lo', handle: 'ala_mana_nellore_lo', location: 'Nellore, India',
        bio: 'Nellore food, places and people — the best local spots, every week.',
        niches: ['Food & Beverage', 'Hospitality & Travel'], tier: 'micro', badges: [],
        platforms: [{ platform: 'instagram', handle: 'ala_mana_nellore_lo', followers: 18_901 }],
        engagementRate: 7.97, dataTrust: 'self_reported', pastCollaborations: 2, rating: null,
    },
    {
        id: 'demo-inf-06', userName: 'Taradh', handle: 'taradh.travels', location: 'Goa, India',
        userAvatarUrl: photo('photo-1517841905240-472988babdf9'),
        bio: 'Slow travel, beach cafés and hidden stays along the Konkan coast.',
        niches: ['Hospitality & Travel'], tier: 'nano', badges: ['top_creator', 'brand_favourite'],
        platforms: [{ platform: 'instagram', handle: 'taradh.travels', followers: 7_031 }],
        engagementRate: 2.13, dataTrust: 'self_reported', pastCollaborations: 10, rating: 4.4,
    },
    {
        id: 'demo-inf-07', userName: 'Naveen', handle: 'naveen.glow', location: 'Visakhapatnam, India',
        bio: 'Skincare for Indian weather — routines that actually work on humid days.',
        niches: ['Fashion & Beauty'], tier: 'nano', badges: [],
        platforms: [{ platform: 'instagram', handle: 'naveen.glow', followers: 3_688 }],
        engagementRate: 16.57, dataTrust: 'self_reported', pastCollaborations: 1, rating: null,
    },
    {
        id: 'demo-inf-08', userName: 'Tej Sabareesh', handle: 'tej.sabareesh', location: 'Hyderabad, India',
        userAvatarUrl: photo('photo-1507003211169-0a1dd7228f2d'),
        bio: '11th mile Co-founder and CPO @mutinytalent — building, shipping, eating biryani.',
        niches: ['Fashion & Beauty', 'Food & Beverage'], tier: 'nano', badges: ['viral_creator'],
        platforms: [{ platform: 'instagram', handle: 'tej.sabareesh', followers: 3_577 }],
        engagementRate: 9.26, dataTrust: 'verified_not_refreshing', dataRefreshedAt: '2026-07-25T10:00:00Z',
        instagramConnected: true, instagramDataCoverage: 'partial', pastCollaborations: 4, rating: 4.5,
    },
    {
        id: 'demo-inf-09', userName: 'Ananya Iyer', handle: 'ananya.bakes', location: 'Bengaluru, India',
        userAvatarUrl: photo('photo-1544005313-94ddf0286df2'),
        bio: 'Home baker sharing eggless recipes, café hops and weekend bakes across Bengaluru.',
        niches: ['Food & Beverage', 'Lifestyle'], tier: 'mid', badges: ['trending', 'fast_delivery'],
        platforms: [{ platform: 'instagram', handle: 'ananya.bakes', followers: 182_000 }, { platform: 'youtube', handle: 'ananyabakes', followers: 41_200 }],
        engagementRate: 5.8, engagementBasis: 'meta_reach', dataTrust: 'verified', instagramConnected: true,
        instagramDataCoverage: 'full', instagramTopCountry: 'IN', instagramTopAgeGroup: '25-34', instagramTopCity: 'Bengaluru, India',
        instagramReach30d: 412_000, instagramFollowerGrowth30d: 2.6, medianReelViews: 96_000, verifiedCampaignResults: 9,
        pastCollaborations: 27, rating: 4.9,
    },
    {
        id: 'demo-inf-10', userName: 'Teja', handle: 'teja.frames', location: 'Anantapur, India',
        bio: 'A professional photographer — food, portraits and product shoots.',
        niches: ['Food & Beverage', 'Fashion & Beauty'], tier: 'nano', badges: [],
        platforms: [{ platform: 'instagram', handle: 'teja.frames', followers: 1_428 }],
        engagementRate: 24.24, dataTrust: 'self_reported', pastCollaborations: 0, rating: null,
    },
    {
        id: 'demo-inf-11', userName: 'Dwaraka', handle: 'dwaraka.cares', location: 'Goa, India',
        userAvatarUrl: photo('photo-1534528741775-53994a69daeb'),
        bio: 'Calm and cool — mindful living, volunteering and sustainable swaps.',
        niches: ['Lifestyle', 'NGO & Social Cause'], tier: 'nano', badges: [],
        platforms: [{ platform: 'instagram', handle: 'dwaraka.cares', followers: 1_360 }],
        engagementRate: 27.48, dataTrust: 'self_reported', pastCollaborations: 1, rating: null,
    },
    {
        id: 'demo-inf-12', userName: 'Rohit Verma', handle: 'rohitfitlife', location: 'Mumbai, India',
        userAvatarUrl: photo('photo-1539571696357-5a69c17a67c6'),
        bio: 'Coach. 5 AM workouts, high-protein Indian meals and no-nonsense fitness tips.',
        niches: ['Health & Fitness', 'Lifestyle'], tier: 'macro', badges: ['top_creator', 'trending'],
        platforms: [{ platform: 'instagram', handle: 'rohitfitlife', followers: 742_000 }, { platform: 'youtube', handle: 'rohitfitlife', followers: 218_000 }],
        engagementRate: 4.1, engagementBasis: 'meta_reach', dataTrust: 'verified', instagramConnected: true,
        instagramDataCoverage: 'full', instagramTopCountry: 'IN', instagramTopAgeGroup: '25-34',
        instagramReach30d: 1_960_000, instagramFollowerGrowth30d: 1.4, medianReelViews: 310_000, verifiedCampaignResults: 21,
        pastCollaborations: 58, rating: 4.8,
    },
    {
        id: 'demo-inf-13', userName: 'Meera Krishnan', handle: 'meera.eats', location: 'Chennai, India',
        userAvatarUrl: photo('photo-1438761681033-6461ffad8d80'),
        bio: 'Filter coffee loyalist. Chennai’s best tiffin, temple food and new openings.',
        niches: ['Food & Beverage'], tier: 'micro', badges: ['fast_delivery'],
        platforms: [{ platform: 'instagram', handle: 'meera.eats', followers: 64_300 }],
        engagementRate: 6.4, dataTrust: 'verified', instagramConnected: true, instagramDataCoverage: 'full',
        instagramTopCountry: 'IN', instagramTopAgeGroup: '25-34', medianReelViews: 38_000, verifiedCampaignResults: 5,
        pastCollaborations: 16, rating: 4.7,
    },
    {
        id: 'demo-inf-14', userName: 'Kabir Shah', handle: 'kabirtechtalks', location: 'Pune, India',
        bio: 'Gadget reviews in plain English — phones, laptops and apps worth your money.',
        niches: ['Electronics & Gadgets', 'Tech (Apps & SaaS)'], tier: 'mid', badges: ['brand_favourite'],
        platforms: [{ platform: 'youtube', handle: 'kabirtechtalks', followers: 356_000 }, { platform: 'instagram', handle: 'kabirtechtalks', followers: 121_000 }],
        engagementRate: 3.2, dataTrust: 'self_reported', pastCollaborations: 33, rating: 4.6,
    },
    {
        id: 'demo-inf-15', userName: 'Sana Mirza', handle: 'sana.styles', location: 'Delhi, India',
        userAvatarUrl: photo('photo-1524504388940-b1c1722653e1'),
        bio: 'Modest fashion, festive edits and accessories that go with everything.',
        niches: ['Fashion & Beauty', 'Jewellery & Accessories'], tier: 'mega', badges: ['top_creator', 'viral_creator', 'brand_favourite'],
        platforms: [{ platform: 'instagram', handle: 'sana.styles', followers: 1_840_000 }],
        engagementRate: 2.7, engagementBasis: 'meta_reach', dataTrust: 'verified', instagramConnected: true,
        instagramDataCoverage: 'full', instagramTopCountry: 'IN', instagramTopAgeGroup: '18-24',
        instagramReach30d: 4_300_000, instagramFollowerGrowth30d: 0.8, medianReelViews: 820_000, verifiedCampaignResults: 40,
        pastCollaborations: 96, rating: 4.9,
    },
    {
        id: 'demo-inf-16', userName: 'Arjun Nair', handle: 'arjun.wanders', location: 'Kochi, India',
        bio: 'Kerala backwaters to Himalayan treks — travel films on a student budget.',
        niches: ['Hospitality & Travel', 'Entertainment & Media'], tier: 'micro', badges: ['rising_star'],
        platforms: [{ platform: 'instagram', handle: 'arjun.wanders', followers: 52_800 }, { platform: 'youtube', handle: 'arjunwanders', followers: 23_500 }],
        engagementRate: 8.9, dataTrust: 'self_reported', pastCollaborations: 3, rating: 4.3,
    },
];

/** Fills the fields every Influencer carries, so the cards and the profile page never see undefined. */
function toInfluencer(c: DemoCreator): Influencer {
    const followerCount = (c.platforms ?? []).reduce((sum, p) => sum + p.followers, 0);
    return {
        handle: '',
        userAvatarUrl: null,
        platforms: [],
        engagementRate: null as unknown as number,
        niche: c.niches,
        pastCollaborations: 0,
        rating: null,
        languages: ['English', 'Hindi'],
        portfolio: [],
        badges: [],
        dataTrust: 'self_reported',
        instagramLastSyncedAt: c.instagramConnected ? daysAgo(2) : null,
        ...c,
        followerCount,
        isBookmarked: savedIds().has(c.id),
        collectionName: savedCollections()[c.id] ?? null,
    } as Influencer;
}

// ── Saved creators (bookmarks) ──

function readSaved(): Record<string, string | null> {
    try {
        return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') as Record<string, string | null>;
    } catch {
        return {};
    }
}
const savedIds = () => new Set(Object.keys(readSaved()));
const savedCollections = () => readSaved();

export function demoToggleBookmark(influencerId: string, collectionName?: string | null, action?: 'save' | 'unsave') {
    const saved = readSaved();
    const save = action ? action === 'save' : !(influencerId in saved);
    if (save) saved[influencerId] = collectionName ?? null;
    else delete saved[influencerId];
    try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
        // storage blocked: the change lasts until reload
    }
    return wait({ isBookmarked: save, collectionName: save ? collectionName ?? null : null });
}

export function demoBookmarkCollections() {
    const saved = readSaved();
    const counts = new Map<string, number>();
    let uncategorizedCount = 0;
    Object.values(saved).forEach((name) => {
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
        else uncategorizedCount += 1;
    });
    return wait({
        collections: [...counts].map(([name, count]) => ({ name, count, coverUrl: null })),
        uncategorizedCount,
        totalCount: Object.keys(saved).length,
    });
}

// ── Search / detail ──

const splitValues = (raw: unknown) => String(raw ?? '').split('|').map((v) => v.trim().toLowerCase()).filter(Boolean);

export function demoSearchInfluencers(params: Record<string, unknown> = {}): Promise<PaginatedResponse<Influencer>> {
    let list = CREATORS.map(toInfluencer);

    const q = String(params.q ?? '').trim().toLowerCase();
    if (q) list = list.filter((c) => [c.userName, c.handle, c.bio].some((t) => t?.toLowerCase().includes(q)));

    const niches = splitValues(params.niche);
    if (niches.length) list = list.filter((c) => c.niches.some((n) => niches.includes(n.toLowerCase())));

    const platforms = splitValues(params.platform);
    if (platforms.length) list = list.filter((c) => c.platforms.some((p) => platforms.includes(p.platform)));

    const tiers = splitValues(params.tier);
    if (tiers.length) list = list.filter((c) => tiers.includes(c.tier.toLowerCase()));

    // City names have more than one spelling (the dropdown offers "Bangalore", creators say "Bengaluru").
    const CITY_ALIASES: Record<string, string> = { bangalore: 'bengaluru', bombay: 'mumbai', madras: 'chennai', vizag: 'visakhapatnam', 'new delhi': 'delhi' };
    const locations = splitValues(params.location).map((l) => l.split(',')[0].trim()).map((l) => CITY_ALIASES[l] ?? l);
    if (locations.length) list = list.filter((c) => locations.some((l) => c.location.toLowerCase().includes(l)));

    const badges = splitValues(params.badges);
    if (badges.length) list = list.filter((c) => (c.badges ?? []).some((b) => badges.includes(b)));

    if (params.minFollowers) list = list.filter((c) => c.followerCount >= Number(params.minFollowers));
    if (params.maxFollowers) list = list.filter((c) => c.followerCount <= Number(params.maxFollowers));
    if (params.minEngagement) list = list.filter((c) => Number(c.engagementRate ?? 0) >= Number(params.minEngagement));
    if (params.savedOnly) {
        list = list.filter((c) => c.isBookmarked);
        if (params.collectionName) list = list.filter((c) => c.collectionName === params.collectionName);
    }

    if (params.sort === 'followers' || params.sort === 'best') list = [...list].sort((a, b) => b.followerCount - a.followerCount);
    if (params.sort === 'engagement') list = [...list].sort((a, b) => Number(b.engagementRate ?? -1) - Number(a.engagementRate ?? -1));

    const limit = Math.max(1, Number(params.limit) || 12);
    const page = Math.max(1, Number(params.page) || 1);
    return wait({
        success: true,
        data: list.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: list.length },
    });
}

export function demoGetInfluencer(id: string): Promise<Influencer> {
    const creator = CREATORS.find((c) => c.id === id);
    if (!creator) {
        return Promise.reject(Object.assign(new Error(`Demo creator ${id} not found`), { response: { status: 404 } }));
    }
    return wait(toInfluencer(creator));
}

/** All demo creators, read synchronously (the demo program store builds its enrollments from them). */
export function demoCreatorList(): Influencer[] {
    return CREATORS.map(toInfluencer);
}
