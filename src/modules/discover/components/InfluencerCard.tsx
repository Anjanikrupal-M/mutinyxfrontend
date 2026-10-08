import { Link } from 'react-router-dom';
import { BadgeCheck, Bookmark, MapPin } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { InfoTooltip } from '@/shared/components/InfoTooltip';
import { PlatformFollowerStats } from '@/shared/components/PlatformFollowerStats';
import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';
import { cn } from '@/lib/utils';
import { type BrandFitResult } from '@/shared/utils/brandFit';

function cleanNiches(niches: string[] | null | undefined): string[] {
    if (!Array.isArray(niches)) return [];
    return niches.filter((n) => {
        if (!n || typeof n !== 'string') return false;
        const t = n.trim();
        if (!t) return false;
        if (t.startsWith('@')) return false;
        if (t.startsWith('http')) return false;
        if (/^[0-9]+$/.test(t)) return false;
        if (t.length > 40) return false;
        if (t.includes('\n') || t.includes('\t')) return false;
        if (/[<>{}\\/|]/.test(t)) return false;
        return true;
    }).map((n) => n.trim());
}

const formatFollowers = (n: number | undefined | null) => {
    if (n == null || n === 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('en-IN');
};

function getRealFollowers(inf: any) {
    if (inf.followerCount && inf.followerCount > 0) return inf.followerCount;
    let total = 0;
    if (Array.isArray(inf.platforms)) {
        total = inf.platforms.reduce((sum: number, p: any) => sum + (Number(p.followers || p.followerCount) || 0), 0);
    }
    if (total === 0 && inf.socialAccounts) {
        total = Object.values(inf.socialAccounts).reduce<number>((sum: number, acc: any) => sum + (Number(acc?.followers) || 0), 0);
    }
    return total;
}

function displayCountry(value: string | null | undefined): string | null {
    if (!value) return null;
    if (/^[A-Za-z]{2}$/.test(value) && typeof Intl.DisplayNames === 'function') {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()) ?? value;
    }
    return value;
}

// Circumference of the mini Brand Fit ring on the photo (r = 7).
const FIT_RING_LENGTH = 2 * Math.PI * 7;

/** One cell of the stat strip at the foot of the card. */
function StatCell({ label, info, children }: { label: string; info: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 px-2 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <span className="truncate">{label}</span>
                <InfoTooltip text={info} iconClassName="w-3 h-3" />
            </p>
            <div className="mt-0.5">{children}</div>
        </div>
    );
}

interface InfluencerCardProps {
    influencer: any;
    campaignId?: string;
    canSave: boolean;
    onSaveClick: () => void;
    /** Brand Fit score for the signed-in brand, if it can be computed. */
    brandFit?: BrandFitResult | null;
    /** Entrance stagger, e.g. "[animation-delay:120ms]". */
    className?: string;
}

/**
 * Discover creator card — a compact header (small rounded photo, name, handle, platforms, Brand
 * Fit and bookmark), then a quiet body (facts, bio, chips) and a divided stat strip pinned to the
 * bottom so numbers line up across a row. Palette: black, white, brand yellow.
 */
export function InfluencerCard({ influencer: inf, campaignId, canSave, onSaveClick, brandFit, className }: InfluencerCardProps) {
    const initial = (inf.userName?.[0] ?? '?').toUpperCase();
    const niches = cleanNiches(inf.niches);
    const platforms: Array<{ platform: string; handle?: string }> = (inf.platforms || []).filter((p: any) => p?.platform);
    const badges = (((inf as any).badges as string[] | undefined) ?? []).filter((key) => BADGE_METADATA[key]);
    const isVerified = !!inf.instagramConnected;
    const fitScore = brandFit ? Math.round(Math.max(0, Math.min(100, brandFit.score))) : null;
    const handle = inf.handle ? String(inf.handle).replace(/^@/, '') : null;
    // Chip row stays on one line: the first niche, up to three badge icons, and a +N for the rest.
    const shownBadges = badges.slice(0, 3);
    const hiddenChips = [...niches.slice(1), ...badges.slice(3).map((key) => BADGE_METADATA[key].label)];

    // Meta provenance details (verified creators only) — country, age band, growth.
    const metaDetail = isVerified
        ? [
            inf.instagramDataCoverage && inf.instagramDataCoverage !== 'full' ? 'Some insights unavailable' : null,
            displayCountry(inf.instagramTopCountry),
            inf.instagramTopAgeGroup,
            inf.instagramFollowerGrowth30d != null
                ? `${inf.instagramFollowerGrowth30d >= 0 ? '+' : ''}${inf.instagramFollowerGrowth30d.toFixed(1)}% / 30d`
                : null,
        ].filter(Boolean).join(' · ')
        : '';

    // Evidence — stored facts only; self-reported or stale numbers are called out.
    const evidence: Array<{ text: string; tone: 'muted' | 'warn' | 'good' }> = [];
    if (inf.dataTrust === 'self_reported') {
        evidence.push({ text: 'Self-reported metrics', tone: 'warn' });
    } else if (inf.dataTrust === 'verified_not_refreshing') {
        evidence.push({
            text: inf.dataRefreshedAt
                ? `Not refreshed since ${new Date(inf.dataRefreshedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                : 'Verified data not refreshing',
            tone: 'warn',
        });
    }
    if (inf.audienceCityMatch && inf.instagramTopCity) {
        evidence.push({ text: `Top follower city: ${inf.instagramTopCity.split(',')[0]} (Meta)`, tone: 'good' });
    }
    if (inf.medianReelViews != null) {
        evidence.push({ text: `Median reel views ${formatFollowers(inf.medianReelViews)}`, tone: 'muted' });
    }
    if (inf.similarCampaigns != null && inf.similarCampaigns > 0) {
        evidence.push({ text: `Worked on ${inf.similarCampaigns} similar campaign${inf.similarCampaigns === 1 ? '' : 's'}`, tone: 'good' });
    }
    if ((inf.verifiedCampaignResults ?? 0) > 0) {
        evidence.push({ text: 'Verified campaign results', tone: 'good' });
    }

    return (
        <Link
            to={`/discover/${inf.id}${campaignId ? `?campaignId=${campaignId}` : ''}`}
            /* h-full + flex-col: the grid stretches every card to the tallest in its row and the
               stat strip is pinned with mt-auto, so the numbers line up across a row. */
            className={cn(
                'group relative flex h-full animate-fade-up flex-col rounded-[24px] border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-float',
                className,
            )}
        >
            {/* ── Header: small rounded photo (or a black tile with a yellow initial), identity beside
                it, then the Brand Fit chip and the bookmark on the right ── */}
            <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-foreground shadow-sm ring-1 ring-black/[0.06]">
                    {inf.userAvatarUrl ? (
                        <ApiImage
                            src={inf.userAvatarUrl}
                            alt={inf.userName}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            placeholderClassName="bg-foreground font-display text-xl text-brand"
                            fallbackText={initial}
                        />
                    ) : (
                        <span className="grid h-full w-full select-none place-items-center font-display text-xl font-semibold text-brand">{initial}</span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-display text-[15px] font-semibold leading-tight tracking-tight underline-offset-4 group-hover:underline" title={inf.userName ?? 'Unknown'}>
                            {inf.userName ?? 'Unknown'}
                        </span>
                        {isVerified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" aria-label="Meta verified" />}
                    </p>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {handle && <span className="truncate">@{handle}</span>}
                        {platforms.length > 0 && (
                            <span className="flex shrink-0 items-center gap-1">
                                {platforms.map((p) => {
                                    const Icon = PLATFORM_ICONS[p.platform.toLowerCase()];
                                    return (
                                        <span key={p.platform} className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-foreground/70" title={p.platform}>
                                            {Icon ? <Icon className="h-3 w-3" /> : <span className="text-[9px] font-bold uppercase">{p.platform[0]}</span>}
                                        </span>
                                    );
                                })}
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 self-start">
                    {/* Brand Fit — a mini yellow ring with the score. */}
                    {brandFit && fitScore != null && (
                        <span
                            className="flex items-center gap-1 rounded-full bg-foreground py-1 pl-1 pr-2 text-[11px] font-semibold text-background"
                            title={`Brand Fit score: ${fitScore}% · ${brandFit.label}`}
                        >
                            <svg viewBox="0 0 18 18" className="h-4 w-4 -rotate-90" aria-hidden>
                                <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2.5" className="stroke-white/20" />
                                <circle
                                    cx="9" cy="9" r="7" fill="none" strokeWidth="2.5" strokeLinecap="round"
                                    strokeDasharray={FIT_RING_LENGTH}
                                    strokeDashoffset={FIT_RING_LENGTH * (1 - fitScore / 100)}
                                    className="stroke-brand"
                                />
                            </svg>
                            <span className="tabular-nums">{fitScore}%</span>
                        </span>
                    )}
                    {canSave && (
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveClick(); }}
                            className={cn(
                                'grid h-7 w-7 place-items-center rounded-full border transition-all duration-200 hover:scale-110',
                                inf.isBookmarked
                                    ? 'border-brand bg-brand text-black'
                                    : 'border-border bg-card text-foreground hover:border-foreground',
                            )}
                            title={inf.isBookmarked ? 'Manage Save Options' : 'Save Creator'}
                            aria-label={inf.isBookmarked ? `Manage saved ${inf.userName}` : `Save ${inf.userName}`}
                            aria-pressed={!!inf.isBookmarked}
                        >
                            <Bookmark className={cn('h-3.5 w-3.5', inf.isBookmarked && 'fill-current')} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col pt-3">
                {/* Facts row: location · tier · Meta status */}
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    {inf.location && (
                        <span className="flex min-w-0 items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{inf.location}</span>
                        </span>
                    )}
                    {/* Tier sits here only when the stat strip shows 30d reach instead of it. */}
                    {inf.tier && inf.instagramReach30d != null && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-px text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70">
                            {inf.tier}
                        </span>
                    )}
                    {isVerified && (
                        <span
                            className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-px text-[10px] font-medium text-muted-foreground"
                            title={[
                                inf.instagramLastSyncedAt ? `Official Meta data synced ${new Date(inf.instagramLastSyncedAt).toLocaleDateString('en-IN')}` : 'Official Meta connection',
                                metaDetail,
                            ].filter(Boolean).join(' — ')}
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            Meta verified
                        </span>
                    )}
                </div>

                {/* Insight line: Meta details + evidence, one quiet truncated line (full text on hover). */}
                {(metaDetail || evidence.length > 0) && (() => {
                    const parts = [
                        ...(metaDetail ? [{ text: metaDetail, tone: 'muted' as const }] : []),
                        ...evidence,
                    ];
                    return (
                        <p className="mt-1 truncate text-[11px] leading-5" title={parts.map((p) => p.text).join(' · ')}>
                            {parts.map((part, idx) => (
                                <span key={part.text}>
                                    {idx > 0 && <span className="text-muted-foreground/60"> · </span>}
                                    <span className={cn(
                                        part.tone === 'warn' && 'font-medium text-orange-600 dark:text-orange-400',
                                        part.tone === 'good' && 'font-medium text-foreground/80',
                                        part.tone === 'muted' && 'text-muted-foreground',
                                    )}>
                                        {part.text}
                                    </span>
                                </span>
                            ))}
                        </p>
                    );
                })()}

                {/* overflow-wrap:anywhere breaks the unspaced strings creators sometimes paste. */}
                {inf.bio && (
                    <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-foreground/80 [overflow-wrap:anywhere]">
                        {inf.bio}
                    </p>
                )}

                {/* One chip row: niches as light chips, earned badges as black chips with a yellow icon. */}
                {(niches.length > 0 || badges.length > 0) && (
                    <div className="mt-2 flex items-center gap-1 overflow-hidden">
                        {niches.slice(0, 1).map((n) => (
                            <span key={n} className="min-w-0 shrink truncate rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground/75" title={n}>
                                {n}
                            </span>
                        ))}
                        {shownBadges.map((badgeKey) => {
                            const meta = BADGE_METADATA[badgeKey];
                            const Icon = meta.icon;
                            return (
                                <span
                                    key={badgeKey}
                                    title={`${meta.label} — ${meta.description}`}
                                    aria-label={meta.label}
                                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-foreground transition-transform duration-200 hover:scale-110"
                                >
                                    <Icon className="h-3 w-3" />
                                </span>
                            );
                        })}
                        {hiddenChips.length > 0 && (
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-1 text-[11px] font-medium text-muted-foreground" title={hiddenChips.join(', ')}>
                                +{hiddenChips.length}
                            </span>
                        )}
                    </div>
                )}

                {/* Stat strip pinned to the bottom so numbers line up across a row of cards. */}
                <div className="mt-auto pt-2.5">
                    <div className="grid grid-cols-[1.35fr_1fr_1fr] divide-x divide-border rounded-xl border border-border bg-secondary/40 transition-colors duration-300 group-hover:bg-secondary/70">
                        <StatCell label="Followers" info="Followers per connected platform.">
                            <PlatformFollowerStats platforms={inf.platforms} totalFallback={getRealFollowers(inf)} />
                        </StatCell>
                        <StatCell
                            label={inf.engagementBasis === 'meta_reach' ? 'Eng. reach' : 'Eng. rate'}
                            info={inf.engagementBasis === 'meta_reach'
                                ? 'From Meta: interactions ÷ accounts reached, last 30 days.'
                                : 'Likes + comments ÷ followers, averaged over recent posts. Self-reported unless the creator is Meta-connected.'}
                        >
                            <p className="truncate text-sm font-bold tabular-nums">{inf.engagementRate != null ? `${inf.engagementRate}%` : '—'}</p>
                        </StatCell>
                        <StatCell
                            label={inf.instagramReach30d != null ? '30d reach' : 'Tier'}
                            info={inf.instagramReach30d != null ? 'Accounts reached during the latest rolling 30-day Meta window.' : 'Creator size band based on follower count: Nano, Micro, Mid, Macro, or Mega.'}
                        >
                            <p className="truncate text-sm font-bold capitalize tabular-nums">{inf.instagramReach30d != null ? formatFollowers(inf.instagramReach30d) : (inf.tier ?? '—')}</p>
                        </StatCell>
                    </div>
                </div>
            </div>
        </Link>
    );
}
