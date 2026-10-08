export type PlatformEntry = {
    platform?: string;
    handle?: string;
    followers?: number | string | null;
    followerCount?: number | string | null;
};

const parseFollowers = (val: string | number | null | undefined): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).toLowerCase().replace(/,/g, '').trim();
    let multiplier = 1;
    if (str.endsWith('k')) {
        multiplier = 1000;
        str = str.slice(0, -1);
    } else if (str.endsWith('m')) {
        multiplier = 1000000;
        str = str.slice(0, -1);
    }
    const num = Number(str);
    return isNaN(num) ? 0 : num * multiplier;
};

/** Instagram/YouTube entries that actually carry a follower count. */
export function getPlatformFollowerEntries(platforms?: PlatformEntry[] | null) {
    const entries = (Array.isArray(platforms) ? platforms : [])
        .filter((p) => p.platform === 'instagram' || p.platform === 'youtube')
        .map((p) => ({ 
            platform: p.platform as 'instagram' | 'youtube', 
            followers: parseFollowers(p.followers ?? p.followerCount) 
        }))
        .filter((p) => p.followers > 0);
        
    return entries.sort((a, b) => {
        if (a.platform === 'instagram' && b.platform !== 'instagram') return -1;
        if (b.platform === 'instagram' && a.platform !== 'instagram') return 1;
        return 0;
    });
}
