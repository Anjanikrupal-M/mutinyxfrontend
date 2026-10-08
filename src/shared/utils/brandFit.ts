// ─────────────────────────────────────────────────────────────
// Brand Fit score — how well a creator matches the signed-in brand.
//
// Fully client-side: compares the brand's own profile (industry/category + city/state)
// against each influencer (niches + location + engagement) and returns a 0–100 score
// with a human breakdown. Used on InfluencerCard, InfluencerProfilePage, the
// "Sort by Brand Fit" option on the Influencers page, and the campaign Applications tab.
// Lives in shared/ because it is consumed by more than one module (discover + campaigns).
//
// Weighting (out of 100):
//   • Category alignment (brand industry ↔ creator niches): 60
//   • Location alignment (brand city/state ↔ creator location): 25
//   • Quality signal (engagement rate, lightly weighted):      15
// ─────────────────────────────────────────────────────────────

export interface BrandFitInput {
    industry?: string | null;
    city?: string | null;
    state?: string | null;
}

export interface InfluencerFitInput {
    niches?: string[] | null;
    location?: string | null;
    engagementRate?: string | number | null;
}

export type BrandFitBand = 'excellent' | 'good' | 'fair' | 'low';

export interface BrandFitResult {
    score: number; // 0–100
    band: BrandFitBand;
    label: string;
    reasons: {
        category: { score: number; max: number; matched: boolean; note: string };
        location: { score: number; max: number; matched: boolean; note: string };
        quality: { score: number; max: number; note: string };
    };
}

const CATEGORY_MAX = 60;
const LOCATION_MAX = 25;
const QUALITY_MAX = 15;

const STOPWORDS = new Set([
    'and', 'the', 'of', 'for', 'to', 'in', 'on', 'a', 'an', '&', 'other', 'others',
    'apps', 'saas', 'media', 'business', 'services', 'products',
]);

function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** True when a brand can be meaningfully scored (has at least an industry or a location). */
export function canScoreBrandFit(brand: BrandFitInput | null | undefined): boolean {
    if (!brand) return false;
    return Boolean(
        (brand.industry && brand.industry.trim()) ||
        (brand.city && brand.city.trim()) ||
        (brand.state && brand.state.trim())
    );
}

function scoreCategory(industry: string | null | undefined, niches: string[]): { score: number; matched: boolean; note: string } {
    const ind = (industry ?? '').trim();
    const cleanNiches = (niches ?? []).filter((n) => typeof n === 'string' && n.trim());

    if (!ind) {
        // Brand hasn't set an industry — can't compare, award neutral partial credit.
        return { score: Math.round(CATEGORY_MAX * 0.5), matched: false, note: 'Brand category not set' };
    }
    if (cleanNiches.length === 0) {
        return { score: Math.round(CATEGORY_MAX * 0.35), matched: false, note: 'Creator has no listed niche' };
    }

    const indLower = ind.toLowerCase();
    const indTokens = new Set(tokenize(ind));

    let best = 0;
    let bestNiche = '';
    for (const niche of cleanNiches) {
        const nLower = niche.toLowerCase();

        // Direct / substring match on the whole label → full marks.
        if (nLower === indLower || nLower.includes(indLower) || indLower.includes(nLower)) {
            return { score: CATEGORY_MAX, matched: true, note: `Niche "${niche}" matches ${ind}` };
        }

        // Otherwise token overlap between the two labels.
        const nTokens = tokenize(niche);
        if (nTokens.length === 0) continue;
        const overlap = nTokens.filter((t) => indTokens.has(t)).length;
        const ratio = overlap / Math.max(1, Math.min(indTokens.size, nTokens.length));
        if (ratio > best) {
            best = ratio;
            bestNiche = niche;
        }
    }

    if (best > 0) {
        const score = Math.round(CATEGORY_MAX * Math.min(1, best));
        return { score, matched: score >= CATEGORY_MAX * 0.5, note: `Partial overlap with "${bestNiche}"` };
    }

    // No overlap — small floor so a single mismatch doesn't zero the whole score.
    return { score: Math.round(CATEGORY_MAX * 0.15), matched: false, note: `No niche overlap with ${ind}` };
}

function scoreLocation(brand: BrandFitInput, location: string | null | undefined): { score: number; matched: boolean; note: string } {
    const city = (brand.city ?? '').trim().toLowerCase();
    const state = (brand.state ?? '').trim().toLowerCase();
    const loc = (location ?? '').trim().toLowerCase();

    if (!city && !state) {
        return { score: Math.round(LOCATION_MAX * 0.6), matched: false, note: 'Brand location not set' };
    }
    if (!loc) {
        return { score: Math.round(LOCATION_MAX * 0.4), matched: false, note: 'Creator location unknown' };
    }
    if (city && loc.includes(city)) {
        return { score: LOCATION_MAX, matched: true, note: 'Same city as your brand' };
    }
    if (state && loc.includes(state)) {
        return { score: Math.round(LOCATION_MAX * 0.7), matched: true, note: 'Same state as your brand' };
    }
    // Different location — creators still reach audiences nationally, so keep a floor.
    return { score: Math.round(LOCATION_MAX * 0.2), matched: false, note: 'Different location' };
}

function scoreQuality(engagementRate: string | number | null | undefined): { score: number; note: string } {
    const er = typeof engagementRate === 'string' ? parseFloat(engagementRate) : Number(engagementRate);
    if (!Number.isFinite(er) || er <= 0) {
        return { score: Math.round(QUALITY_MAX * 0.5), note: 'Engagement not available' };
    }
    // 8%+ engagement = full marks; scales linearly below that.
    const score = Math.round(Math.min(QUALITY_MAX, (er / 8) * QUALITY_MAX));
    return { score, note: `${er}% engagement` };
}

function bandFor(score: number): { band: BrandFitBand; label: string } {
    if (score >= 80) return { band: 'excellent', label: 'Excellent fit' };
    if (score >= 60) return { band: 'good', label: 'Good fit' };
    if (score >= 40) return { band: 'fair', label: 'Fair fit' };
    return { band: 'low', label: 'Low fit' };
}

export function computeBrandFit(brand: BrandFitInput, influencer: InfluencerFitInput): BrandFitResult {
    const category = scoreCategory(brand.industry, influencer.niches ?? []);
    const location = scoreLocation(brand, influencer.location);
    const quality = scoreQuality(influencer.engagementRate);

    const score = Math.max(0, Math.min(100, category.score + location.score + quality.score));
    const { band, label } = bandFor(score);

    return {
        score,
        band,
        label,
        reasons: {
            category: { ...category, max: CATEGORY_MAX },
            location: { ...location, max: LOCATION_MAX },
            quality: { ...quality, max: QUALITY_MAX },
        },
    };
}

/** Tailwind classes for each band — small pill on cards / badge on profile. */
export function brandFitClasses(band: BrandFitBand): { text: string; bg: string; border: string; dot: string; stroke: string } {
    switch (band) {
        case 'excellent':
            return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', stroke: 'stroke-emerald-500' };
        case 'good':
            return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', stroke: 'stroke-blue-500' };
        case 'fair':
            return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', stroke: 'stroke-amber-500' };
        default:
            return { text: 'text-muted-foreground', bg: 'bg-secondary', border: 'border-border', dot: 'bg-muted-foreground', stroke: 'stroke-muted-foreground' };
    }
}
