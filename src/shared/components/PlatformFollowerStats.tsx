import { Instagram, Youtube } from 'lucide-react';

/**
 * Per-platform follower stat lines — shows Instagram and YouTube counts separately
 * instead of one combined total. Used by the Applications tab, Discover influencer
 * cards and the campaign Invite page so all creator cards read the same way.
 */

import { PlatformEntry, getPlatformFollowerEntries } from '@/shared/utils/platformStats';

const formatFollowers = (n: number) => {
    if (!n) return '0';
    return Math.round(n).toLocaleString('en-IN');
};
export function PlatformFollowerStats({
    platforms,
    totalFallback,
}: {
    platforms?: PlatformEntry[] | null;
    /** Combined count shown when no per-platform data is available. */
    totalFallback?: number | null;
}) {
    const entries = getPlatformFollowerEntries(platforms);

    if (entries.length === 0) {
        return (
            <p className="text-sm font-bold text-foreground tabular-nums">
                {formatFollowers(Number(totalFallback) || 0)}
            </p>
        );
    }

    return (
        <div className="space-y-0.5">
            {entries.map((e) => (
                <p key={e.platform} className="flex items-center gap-1 text-sm font-bold text-foreground tabular-nums leading-tight">
                    {e.platform === 'instagram'
                        ? <Instagram className="w-3 h-3 text-muted-foreground shrink-0" />
                        : <Youtube className="w-3 h-3 text-muted-foreground shrink-0" />}
                    {formatFollowers(e.followers)}
                </p>
            ))}
        </div>
    );
}
