// Target-audience match — what share of a creator's Instagram followers fall inside the
// campaign's target audience (age × gender × location), from Meta follower demographics.
//
// Meta reports each dimension separately, never crossed, so the three shares are multiplied
// as if independent. That is an estimate, and callers label it as one. Cities are only
// Meta's top cities for the account, so a location target can undercount small cities.

import type { CreatorAudience } from '@/shared/types/campaign';

export interface AudienceTarget {
    targetAgeRanges?: string[] | null;
    targetGender?: string | null;
    targetLocations?: string[] | null;
}

const GENDER_KEY: Record<string, string> = { male: 'M', female: 'F' };

const cityName = (value: string) => value.split(',')[0].trim().toLowerCase();

/** True when the campaign narrows its audience on at least one dimension. */
export function hasAudienceTarget(target: AudienceTarget): boolean {
    return (target.targetAgeRanges?.length ?? 0) > 0
        || !!GENDER_KEY[target.targetGender ?? '']
        || (target.targetLocations?.length ?? 0) > 0;
}

/** 0–1 share of the creator's followers inside the target, or null when Meta gave nothing to score. */
export function audienceMatchShare(audience: CreatorAudience | null | undefined, target: AudienceTarget): number | null {
    if (!audience) return null;
    let share = 1;

    const ages = target.targetAgeRanges ?? [];
    if (ages.length > 0) {
        if (Object.keys(audience.age).length === 0) return null;
        share *= ages.reduce((sum, range) => sum + (audience.age[range] ?? 0), 0);
    }

    const genderKey = GENDER_KEY[target.targetGender ?? ''];
    if (genderKey) {
        if (Object.keys(audience.gender).length === 0) return null;
        share *= audience.gender[genderKey] ?? 0;
    }

    const cities = new Set((target.targetLocations ?? []).map(cityName));
    if (cities.size > 0) {
        if (Object.keys(audience.cities).length === 0) return null;
        share *= Object.entries(audience.cities)
            .filter(([key]) => cities.has(cityName(key)))
            .reduce((sum, [, value]) => sum + value, 0);
    }

    return Math.min(1, Math.max(0, share));
}
