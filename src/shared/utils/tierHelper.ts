/**
 * Tier helper utilities — mirrors the backend's tierHelper.ts so that
 * client-side tier derivation and eligibility checks stay in sync with
 * server-side apply-stage validation.
 *
 * Canonical order (index 0 = lowest):
 *   nano → micro → mid → macro → mega
 */

export const TIER_ORDER = ['nano', 'micro', 'mid', 'macro', 'mega'] as const;
export type Tier = (typeof TIER_ORDER)[number];

/**
 * Derive a creator tier label from their follower count.
 * Thresholds match the backend exactly (see backend tierHelper.ts).
 */
export function deriveTier(followers: number): Tier {
    if (followers >= 1_000_000) return 'mega';
    if (followers >= 500_000) return 'macro';
    if (followers >= 100_000) return 'mid';
    if (followers >= 10_000) return 'micro';
    return 'nano';
}

export interface CampaignTierInput {
    selectedTier?: string | null;
    creatorSizes?: string[] | null;
    budgetTierPricing?: Array<{ tier: string }> | null;
}

/**
 * Returns the explicit tiers that the campaign targets.
 * Returns an empty array if the campaign has no tier restriction at all.
 */
export function getCampaignTargetTiers(campaign: CampaignTierInput): string[] {
    const targetTiers: string[] = [];

    if (campaign.selectedTier) {
        targetTiers.push(campaign.selectedTier);
    }
    if (Array.isArray(campaign.creatorSizes) && campaign.creatorSizes.length > 0) {
        targetTiers.push(...campaign.creatorSizes);
    }
    if (Array.isArray(campaign.budgetTierPricing) && campaign.budgetTierPricing.length > 0) {
        for (const p of campaign.budgetTierPricing) {
            if (p.tier) targetTiers.push(p.tier);
        }
    }

    return Array.from(new Set(targetTiers.map(t => t.toLowerCase())));
}

/**
 * Checks whether an influencer's tier is eligible for a campaign.
 *   - Returns true if influencer tier is explicitly targeted by the campaign.
 *   - Returns false if not targeted.
 *   - Returns 'no_restriction' if campaign has no tier requirements.
 */
export function isTierEligible(
    influencerTier: string | null | undefined,
    campaign: CampaignTierInput,
): boolean | 'no_restriction' {
    const targetTiers = getCampaignTargetTiers(campaign);
    if (targetTiers.length === 0) return 'no_restriction';

    if (!influencerTier) return false;

    return targetTiers.includes(influencerTier.toLowerCase());
}
