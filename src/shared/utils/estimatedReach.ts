import { deriveTier, type Tier } from '@/shared/utils/tierHelper';
import { getPlatformFollowerEntries, type PlatformEntry } from '@/shared/utils/platformStats';

export interface MeasuredAvgReach {
    instagram?: number | null;
    youtube?: number | null;
}

/**
 * Typical share of followers one post reaches, by creator size. Used only when a creator has
 * no measured reach (Instagram insights / YouTube avg views) — smaller accounts reach a larger
 * slice of their audience, so a flat rate would overstate big creators and understate small ones.
 */
const REACH_RATE_BY_TIER: Record<Tier, number> = {
    nano: 0.3,
    micro: 0.2,
    mid: 0.12,
    macro: 0.08,
    mega: 0.05,
};

export interface CreatorReachEstimate {
    /** Accounts one post from this creator is expected to reach. */
    reach: number;
    /** True when every counted platform used measured data rather than the follower estimate. */
    measured: boolean;
}

/**
 * Expected reach of one post from a creator on the platform(s) they are working on.
 * A 'both' campaign counts one post on each platform.
 */
export function estimateCreatorReach(
    platforms: PlatformEntry[] | null | undefined,
    measuredReach: MeasuredAvgReach | null | undefined,
    platform: string | null | undefined,
    /** Total follower count, for legacy rows with no per-platform breakdown. */
    fallbackFollowers = 0,
): CreatorReachEstimate {
    const entries = getPlatformFollowerEntries(platforms);
    const targets: Array<'instagram' | 'youtube'> =
        platform === 'youtube' ? ['youtube'] : platform === 'both' ? ['instagram', 'youtube'] : ['instagram'];

    let reach = 0;
    let measured = true;
    for (const target of targets) {
        const actual = Number(measuredReach?.[target]);
        if (Number.isFinite(actual) && actual > 0) {
            reach += actual;
            continue;
        }
        const followers = entries.find((e) => e.platform === target)?.followers ?? 0;
        if (followers <= 0) continue;
        measured = false;
        reach += followers * REACH_RATE_BY_TIER[deriveTier(followers)];
    }
    if (reach === 0 && entries.length === 0 && fallbackFollowers > 0) {
        return { reach: Math.round(fallbackFollowers * REACH_RATE_BY_TIER[deriveTier(fallbackFollowers)]), measured: false };
    }
    return { reach: Math.round(reach), measured: reach > 0 && measured };
}
