// ─────────────────────────────────────────────────────────────
// Campaign Fit score — how well a creator fits one specific campaign.
//
// Where Brand Fit (brandFit.ts) compares a creator with the brand, this scores
// them against the campaign: seven signals, each 0–100, averaged. A signal with
// no data behind it is shown as "—" and left out of the average instead of
// counting as zero, so a thin profile is not punished for missing fields; the
// confidence label says how many signals the score rests on.
//
// Fully client-side, from fields the Applications tab already has.
// ─────────────────────────────────────────────────────────────

import type { BrandFitResult } from './brandFit';

export interface CampaignFitInput {
    /** Brand Fit for this creator (category, location, engagement), when the brand can be scored. */
    brandFit: BrandFitResult | null;
    /** Share (0–100) of the creator's followers inside the campaign's target audience, when known. */
    audienceMatchPct: number | null;
    /** Engagement rate in %, e.g. 4.2. */
    engagementRate: number | null;
    /** Completed collaborations on the platform. */
    pastCollaborations: number | null;
    /** Average brand rating out of 5. */
    rating: number | null;
    /** Agreed or quoted price in ₹, and followers on the campaign's platform. */
    price: number | null;
    followers: number | null;
    /** The campaign's platform ('instagram' | 'youtube' | 'both') and the one the creator applied on. */
    campaignPlatform: string | null;
    creatorPlatform: string | null;
}

export interface CampaignFitFactor {
    key: string;
    label: string;
    /** 0–100, or null when there is no data for it. */
    score: number | null;
}

export interface CampaignFitResult {
    /** 0–100 average of the factors that have data; null when none do. */
    score: number | null;
    label: string;
    confidence: 'High' | 'Medium' | 'Low';
    factors: CampaignFitFactor[];
}

const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
const known = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

// What one rupee buys, measured as ₹ per 1,000 followers. At or below CHEAP the creator scores
// 100; at DEAR they score 0; linear in between. Rough Indian market range for paid posts.
const CHEAP_PER_1K = 20;
const DEAR_PER_1K = 400;

export function computeCampaignFit(input: CampaignFitInput): CampaignFitResult {
    const pricePer1K = known(input.price) && input.price > 0 && known(input.followers) && input.followers > 0
        ? input.price / (input.followers / 1000)
        : null;
    const platformFit = (() => {
        const campaign = input.campaignPlatform?.toLowerCase();
        const creator = input.creatorPlatform?.toLowerCase();
        if (!campaign || !creator) return null;
        if (campaign === 'both' || creator === 'both' || campaign === creator) return 100;
        return 40;
    })();

    const factors: CampaignFitFactor[] = [
        { key: 'audience', label: 'Audience match', score: known(input.audienceMatchPct) ? clamp(input.audienceMatchPct) : null },
        // 8% engagement or more is full marks, the same bar Brand Fit uses.
        { key: 'resonance', label: 'Content resonance', score: known(input.engagementRate) && input.engagementRate > 0 ? clamp((input.engagementRate / 8) * 100) : null },
        // Brand Fit's category and location parts, out of their 85 points.
        {
            key: 'brand',
            label: 'Brand fit',
            score: input.brandFit
                ? clamp(((input.brandFit.reasons.category.score + input.brandFit.reasons.location.score) / (input.brandFit.reasons.category.max + input.brandFit.reasons.location.max)) * 100)
                : null,
        },
        // A first campaign starts at 40; each completed one adds 2.5, up to 100 at 24.
        { key: 'track', label: 'Track record', score: known(input.pastCollaborations) ? clamp(40 + input.pastCollaborations * 2.5) : null },
        { key: 'price', label: 'Price efficiency', score: pricePer1K == null ? null : clamp(((DEAR_PER_1K - pricePer1K) / (DEAR_PER_1K - CHEAP_PER_1K)) * 100) },
        { key: 'reliability', label: 'Reliability', score: known(input.rating) && input.rating > 0 ? clamp((input.rating / 5) * 100) : null },
        { key: 'platform', label: 'Platform / format fit', score: platformFit },
    ];

    const scored = factors.filter((factor) => factor.score != null);
    const score = scored.length > 0 ? clamp(scored.reduce((sum, factor) => sum + (factor.score as number), 0) / scored.length) : null;
    const label = score == null ? 'Not enough data'
        : score >= 80 ? 'Excellent fit'
            : score >= 60 ? 'Good fit'
                : score >= 40 ? 'Fair fit'
                    : 'Low fit';
    const confidence = scored.length >= 5 ? 'High' : scored.length >= 3 ? 'Medium' : 'Low';
    return { score, label, confidence, factors };
}
