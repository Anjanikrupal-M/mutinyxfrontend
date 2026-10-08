import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowUpRight, MapPin, Users, BarChart3, Bookmark, Globe, Loader2, X, Trophy, Star,
    BadgeCheck, Heart, CalendarDays, Link2, Languages, MessageCircle, ChevronRight, Sparkles, Tag,
    TrendingUp, Check, Send,
} from 'lucide-react';
import { useInfluencer, useToggleBookmark } from './hooks/useInfluencers';
import { useCampaign } from '@/modules/campaigns/hooks/useCampaigns';
import { useApplications } from '@/modules/campaigns/hooks/useApplications';
import { cn } from '@/lib/utils';
import { ConnectModal } from './components/ConnectModal';
import { SaveToCollectionModal } from './components/SaveToCollectionModal';
import { toast } from 'sonner';
import { ApiImage } from '@/shared/components/ApiImage';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';
import { useProfileGate } from '@/shared/hooks/useProfileGate';
import { useAuthStore } from '@/shared/stores/authStore';
import { computeBrandFit, canScoreBrandFit, type BrandFitResult } from '@/shared/utils/brandFit';
import { InstagramInsightsPanel } from './components/InstagramInsightsPanel';
import { PreviousWorkSection } from './components/PreviousWorkSection';
import { PricingValueSection } from './components/PricingValueSection';

type PlatformEntry = { platform: string; handle?: string | null; followers?: number | null; followerCount?: number | null; profileUrl?: string };

/** The page's one surface style — every section sits on the same shared `.surface` token. */
const profileSurface = 'rounded-[28px] border border-border bg-card shadow-card';

// Springy timing for the paper-plane hand-off (arbitrary property: Tailwind reads ease-[…] as ambiguous).
const EASE_BACK = '[transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]';

/**
 * Connect — brand-yellow pill with a paper plane. On hover the plane flies off to the top-right
 * while a fresh one glides in from the bottom-left; the colour never changes. Disabled renders
 * the same shape, muted, without the motion.
 */
function ConnectButton({ onClick, disabled, children, className }: { onClick: () => void; disabled?: boolean; children: ReactNode; className?: string }) {
    if (disabled) {
        return (
            <button type="button" disabled className={cn('inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-muted-foreground', className)}>
                <Send className="h-4 w-4 shrink-0" />
                <span className="truncate">{children}</span>
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group/connect inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-black shadow-[0_6px_20px_-6px_rgb(250_203_3_/_0.9)] transition-all duration-300 hover:shadow-[0_10px_26px_-6px_rgb(250_203_3_/_1)] active:scale-95',
                className,
            )}
        >
            {/* Two planes in a clipped box: one leaves up-right, the next arrives from down-left. */}
            <span className="relative h-4 w-4 shrink-0 overflow-hidden" aria-hidden>
                <Send className={cn('absolute inset-0 h-4 w-4 transition-transform duration-500 group-hover/connect:-translate-y-5 group-hover/connect:translate-x-5', EASE_BACK)} />
                <Send className={cn('absolute inset-0 h-4 w-4 -translate-x-5 translate-y-5 transition-transform delay-100 duration-500 group-hover/connect:translate-x-0 group-hover/connect:translate-y-0', EASE_BACK)} />
            </span>
            <span className="truncate">{children}</span>
        </button>
    );
}

function isDeadlinePassed(value?: string | Date | null) {
    if (!value) return false;
    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) return false;
    deadline.setHours(23, 59, 59, 999);
    return deadline.getTime() < Date.now();
}

const formatFollowers = (n: number | undefined | null) => {
    if (n == null || n === 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('en-IN');
};

const getRealTotalFollowers = (inf: { followerCount?: number; platforms?: PlatformEntry[]; socialAccounts?: Record<string, { followers?: number }> }) => {
    if (inf.followerCount && inf.followerCount > 0) return inf.followerCount;
    let total = 0;
    if (Array.isArray(inf.platforms)) {
        total = inf.platforms.reduce((sum, p) => sum + (Number(p.followers || p.followerCount) || 0), 0);
    }
    if (total === 0 && inf.socialAccounts) {
        total = Object.values(inf.socialAccounts).reduce<number>((sum, acc) => sum + (Number(acc?.followers) || 0), 0);
    }
    return total;
};

const getProfileUrl = (platform: string, handle: string, profileUrl?: string) => {
    if (profileUrl) return profileUrl;
    const h = handle.replace(/^@/, '');
    switch (platform.toLowerCase()) {
        case 'instagram': return `https://www.instagram.com/${h}/`;
        case 'youtube': return `https://www.youtube.com/@${h}`;
        case 'twitter':
        case 'x': return `https://x.com/${h}`;
        default: return null;
    }
};

// The creator's name rises word by word, like the other page headers.
const TITLE_RISE_DELAYS = ['[animation-delay:150ms]', '[animation-delay:240ms]', '[animation-delay:330ms]'];

const displayWebsite = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

/** One metric in the hero's bottom row: icon tile, label, value (the hint shows on hover). */
function StatTile({ icon: Icon, label, value, hint, className }: { icon: typeof Users; label: string; value: string; hint?: string; className?: string }) {
    const missing = value === '—';
    return (
        <div className={cn('group/stat flex min-w-0 animate-fade-up items-center gap-2.5 bg-card px-3.5 py-2.5 transition-colors duration-300 hover:bg-secondary/40', className)} title={hint}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground text-brand transition-transform duration-300 group-hover/stat:-rotate-6 group-hover/stat:scale-110">
                <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-muted-foreground">{label}</span>
                <span className={cn('mt-0.5 block truncate font-display text-lg font-semibold leading-tight tracking-tight tabular-nums', missing && 'text-muted-foreground/40')}>
                    {value}
                </span>
            </span>
        </div>
    );
}

// Circumference of the Brand Fit ring in the hero (r = 42).
const FIT_RING = 2 * Math.PI * 42;
// Stats bar cells and lower sections enter one after another (literal classes so Tailwind sees them).
const STAT_DELAYS = ['[animation-delay:260ms]', '[animation-delay:310ms]', '[animation-delay:360ms]', '[animation-delay:410ms]', '[animation-delay:460ms]', '[animation-delay:510ms]'];

/**
 * Brand Fit in the hero: a soft panel with a yellow ring that sweeps in, and the three parts it
 * is built from as yellow bars that grow in. Same score as the Discover cards.
 */
function HeroBrandFit({ fit }: { fit: BrandFitResult | null }) {
    if (!fit) {
        return (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-black">
                    <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                <p className="text-sm font-semibold">Brand Fit</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Add your brand’s category and city in your profile to see how well this creator matches you.
                </p>
                </div>
            </div>
        );
    }

    const score = Math.round(Math.max(0, Math.min(100, fit.score)));
    const parts = [
        { key: 'category', label: 'Category', icon: Tag, ...fit.reasons.category },
        { key: 'location', label: 'Location', icon: MapPin, ...fit.reasons.location },
        { key: 'quality', label: 'Engagement', icon: TrendingUp, ...fit.reasons.quality, matched: fit.reasons.quality.score >= fit.reasons.quality.max * 0.8 },
    ];

    return (
        <div className="flex flex-col rounded-2xl border border-border bg-secondary/50 p-3" title="Brand Fit for your brand’s category and city">
            <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center">
                    <svg viewBox="0 0 96 96" className="absolute inset-0 -rotate-90" aria-hidden>
                        <circle cx="48" cy="48" r="42" fill="none" strokeWidth="9" className="stroke-black/[0.08]" />
                        <circle
                            cx="48" cy="48" r="42" fill="none" strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={FIT_RING}
                            strokeDashoffset={FIT_RING * (1 - score / 100)}
                            className="profile-fit-ring stroke-brand [filter:drop-shadow(0_0_4px_rgb(250_203_3_/_0.5))]"
                        />
                    </svg>
                    <span className="relative font-display text-sm font-bold tabular-nums">{score}%</span>
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Brand Fit score</p>
                    <p className="font-display text-base font-semibold leading-tight tracking-tight">{fit.label}</p>
                </div>
            </div>

            <ul className="mt-2.5 space-y-2 border-t border-border pt-2.5">
                {parts.map((part, i) => {
                    const ratio = part.max > 0 ? part.score / part.max : 0;
                    return (
                        <li key={part.key} className="flex min-w-0 cursor-help items-center gap-2 text-xs" title={part.note}>
                            <part.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="w-[74px] shrink-0 truncate font-medium">{part.label}</span>
                            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" aria-hidden>
                                <rect width="100" height="6" className="fill-black/[0.08]" />
                                <rect width={Math.max(ratio * 100, 3)} height="6" rx="3" className={cn('stat-seg fill-brand', STAT_DELAYS[i + 2])} />
                            </svg>
                            <span className="flex w-11 shrink-0 items-center justify-end gap-0.5 font-semibold tabular-nums" title={`${part.score} of ${part.max} points`}>
                                {part.matched && <Check className="h-3 w-3 shrink-0" aria-label="Matched" />}
                                {Math.round(ratio * 100)}%
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function InfluencerProfilePage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const campaignId = searchParams.get('campaignId');
    const navigate = useNavigate();
    const { data: influencer, isLoading, error } = useInfluencer(id!);
    const { data: campaign } = useCampaign(campaignId || '');
    const { data: linkedInfluencers = [] } = useApplications(campaignId || '');
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const toggleBookmark = useToggleBookmark();
    const { requireCompleteProfile } = useProfileGate();
    const user = useAuthStore((state) => state.user);

    const applicationDeadlinePassed = isDeadlinePassed(campaign?.applicationDeadline);

    const isAlreadyInvited = !!campaignId && !!influencer && linkedInfluencers.some(
        (ci) => String(ci.influencerId) === String(influencer.id),
    );
    const canConnect = !isAlreadyInvited && !applicationDeadlinePassed;

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !influencer) {
        return (
            <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                    <X className="w-6 h-6" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold">Profile Not Found</p>
                    <p className="text-xs text-muted-foreground mt-1">Failed to load influencer profile. Please try again.</p>
                </div>
                <button onClick={() => navigate(-1)} className="text-sm font-medium text-foreground hover:underline cursor-pointer">
                    Back to Influencers
                </button>
            </div>
        );
    }

    const connectedPlatforms = ((influencer.platforms || []) as PlatformEntry[]).filter((p) => p.handle && p.handle.trim() !== '');

    // Legacy creator-entered demographics are only a fallback for old API responses.
    // Official Instagram intelligence owns this section whenever provenance is present.
    const demo = influencer.instagramInsights ? undefined : influencer.demographics;
    const hasDemographics = !!demo && (
        (demo.age && Object.keys(demo.age).length > 0) ||
        !!demo.gender ||
        (demo.topLocations && demo.topLocations.length > 0)
    );
    const igInsights = influencer.instagramInsights;
    const igConnected = !!igInsights?.connected;
    const engagementNumber = Number(influencer.engagementRate);
    const engagementValue = influencer.engagementRate != null && influencer.engagementRate !== '' && Number.isFinite(engagementNumber)
        ? `${engagementNumber.toFixed(2)}%`
        : '—';
    const website = igConnected ? igInsights!.profile.website : null;

    // Same inputs as the Discover cards, so the score here matches the card the brand clicked.
    const brandProfile = { industry: user?.industry, city: user?.city, state: user?.state };
    const brandFit = canScoreBrandFit(brandProfile)
        ? computeBrandFit(brandProfile, {
            niches: influencer.niches,
            location: influencer.location,
            engagementRate: influencer.engagementRate,
        })
        : null;

    const handleConnect = () => {
        if (isAlreadyInvited) {
            toast.info('This influencer is already invited to this campaign.');
            return;
        }
        if (applicationDeadlinePassed) {
            toast.info('The application deadline for this campaign has passed.');
            return;
        }
        // Connecting with creators requires a complete brand profile incl. a linked social account.
        if (!requireCompleteProfile()) return;
        setShowConnectModal(true);
    };

    const metrics = [
        { icon: Users, label: 'Followers', value: formatFollowers(igConnected ? igInsights!.profile.followerCount : getRealTotalFollowers(influencer)), hint: igConnected ? 'Instagram, live' : 'Across platforms' },
        { icon: BarChart3, label: 'Engagement rate', value: engagementValue, hint: 'Likes + comments per follower' },
        { icon: Heart, label: 'Avg likes / post', value: igConnected ? formatFollowers(igInsights!.performance.avgLikes) : '—', hint: 'Recent posts' },
        { icon: MessageCircle, label: 'Avg comments', value: igConnected ? formatFollowers(igInsights!.performance.avgComments) : '—', hint: 'Per recent post' },
        { icon: CalendarDays, label: 'Posts / week', value: igConnected ? igInsights!.performance.postingFrequency.toFixed(1) : '—', hint: 'Posting frequency' },
        { icon: Trophy, label: 'Mutiny campaigns', value: String(influencer.pastCollaborations || 0), hint: influencer.experience || 'Completed' },
    ];
    const initial = influencer.userName?.charAt(0)?.toUpperCase() || '?';

    return (
        // One centred column (85% wide on desktop) so every card shares the same edges.
        <div className="mx-auto w-full animate-fade-in pb-16 lg:w-[85%]">
            {/* ── Hero: one compact white card. Identity on the left; actions above a slim Brand Fit
                on the right; the six key numbers as the bottom row. Faint dots, a soft yellow glow. ── */}
            <section className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
                <span aria-hidden className="stat-glow pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />

                <div className="relative p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
                        {/* Identity */}
                        <div className="min-w-0">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <button
                                    onClick={() => navigate(-1)}
                                    title="Back to Influencers"
                                    aria-label="Back to Influencers"
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:-translate-x-0.5 hover:border-foreground"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <div className="relative w-fit shrink-0 animate-pop [animation-delay:120ms]">
                                    <span aria-hidden className="absolute -inset-1.5 rounded-[26px] bg-brand/30 blur-xl" />
                                    <div className="relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-[20px] bg-foreground font-display text-2xl font-semibold text-brand shadow-card ring-4 ring-card">
                                        {influencer.userAvatarUrl ? (
                                            <ApiImage src={influencer.userAvatarUrl} alt={influencer.userName} className="h-full w-full object-cover" placeholderClassName="bg-foreground text-brand" fallbackText={initial} />
                                        ) : initial}
                                    </div>
                                    {(influencer.isVerified || igConnected) && (
                                        <span title="Verified creator" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-card">
                                            <BadgeCheck className="h-5 w-5 fill-brand text-black" />
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="flex animate-slide-in-left items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground [animation-delay:80ms]">
                                        Influencers <ChevronRight className="h-3 w-3" />
                                        <span className="text-foreground">Creator profile</span>
                                    </p>
                                    <h1 className="flex flex-wrap gap-x-[0.28em] font-display text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">
                                        {(influencer.userName || 'Anonymous Creator').split(' ').map((word, i) => (
                                            <span key={i} className="-mb-1.5 overflow-hidden pb-1.5">
                                                <span className={cn('block animate-rise', TITLE_RISE_DELAYS[Math.min(i, TITLE_RISE_DELAYS.length - 1)])}>{word}</span>
                                            </span>
                                        ))}
                                    </h1>
                                    <div className="flex animate-fade-up flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground [animation-delay:300ms]">
                                        {influencer.handle && <span className="font-medium text-foreground/80">@{String(influencer.handle).replace(/^@/, '')}</span>}
                                        {influencer.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{influencer.location}</span>}
                                        {influencer.languages && influencer.languages.length > 0 && (
                                            <span className="inline-flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{influencer.languages.join(', ')}</span>
                                        )}
                                        {influencer.rating != null && (
                                            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                                <Star className="h-3.5 w-3.5 fill-brand text-brand" />
                                                {influencer.rating}
                                                {influencer.ratingCount ? <span className="font-normal text-muted-foreground">({influencer.ratingCount})</span> : null}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* One chip row: tier, platforms (links), earned badges, niches, website. */}
                            <div className="mt-3 flex animate-fade-up flex-wrap items-center gap-1.5 [animation-delay:360ms]">
                                {influencer.tier && (
                                    <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-black">
                                        {influencer.tier} creator
                                    </span>
                                )}
                                {connectedPlatforms.map((p) => {
                                    const Icon = PLATFORM_ICONS[p.platform.toLowerCase()] || Globe;
                                    const profileUrl = getProfileUrl(p.platform, p.handle || '', p.profileUrl);
                                    const followers = Number(p.followers || p.followerCount) || 0;
                                    const chipClass = 'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground';
                                    const chip = (
                                        <>
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            {followers > 0 ? <span className="tabular-nums">{formatFollowers(followers)}</span> : <span className="capitalize">{p.platform}</span>}
                                            {profileUrl && <ArrowUpRight className="h-3 w-3 text-muted-foreground transition-colors group-hover/plat:text-foreground" />}
                                        </>
                                    );
                                    return profileUrl ? (
                                        <a
                                            key={p.platform}
                                            href={profileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(chipClass, 'group/plat transition-colors hover:border-foreground')}
                                            title={`View @${(p.handle || '').replace(/^@/, '')} on ${p.platform}`}
                                        >
                                            {chip}
                                        </a>
                                    ) : (
                                        <span key={p.platform} className={chipClass} title={p.platform}>{chip}</span>
                                    );
                                })}
                                {(influencer.badges ?? []).map((badgeKey) => {
                                    const meta = BADGE_METADATA[badgeKey];
                                    if (!meta) return null;
                                    const Icon = meta.icon;
                                    return (
                                        <span
                                            key={badgeKey}
                                            title={meta.description}
                                            className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background"
                                        >
                                            <Icon className="h-3.5 w-3.5 text-brand" />
                                            {meta.label}
                                        </span>
                                    );
                                })}
                                {(influencer.niches ?? []).map((n) => (
                                    <span key={n} className="max-w-full rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/70 [overflow-wrap:anywhere]">
                                        {n}
                                    </span>
                                ))}
                                {website && (
                                    <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{displayWebsite(website)}</span>
                                    </a>
                                )}
                            </div>

                            <p
                                className={cn(
                                    'mt-2.5 max-w-2xl animate-fade-up text-sm leading-relaxed line-clamp-2 [animation-delay:420ms] [overflow-wrap:anywhere]',
                                    influencer.bio ? 'text-foreground/75' : 'italic text-muted-foreground',
                                )}
                                title={influencer.bio || undefined}
                            >
                                {influencer.bio || 'No bio provided.'}
                            </p>
                        </div>

                        {/* Actions above the slim Brand Fit panel. */}
                        <div className="flex min-w-0 flex-col gap-2.5">
                            <div className="flex animate-fade-up items-center justify-end gap-2 [animation-delay:200ms]">
                                <button
                                    onClick={() => setShowSaveModal(true)}
                                    disabled={toggleBookmark.isPending}
                                    aria-label={influencer.isBookmarked ? 'Saved' : 'Save'}
                                    title={influencer.isBookmarked ? 'Saved — manage list' : 'Save creator'}
                                    className={cn(
                                        'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-95 lg:flex-none',
                                        influencer.isBookmarked
                                            ? 'bg-foreground text-background'
                                            : 'border border-border bg-card text-foreground hover:border-foreground',
                                    )}
                                >
                                    <Bookmark className={cn('h-4 w-4', influencer.isBookmarked && 'fill-brand text-brand')} />
                                    {influencer.isBookmarked ? 'Saved' : 'Save'}
                                </button>
                                <ConnectButton onClick={handleConnect} disabled={!canConnect} className="flex-1 lg:flex-none">
                                    {isAlreadyInvited ? 'Already Invited' : applicationDeadlinePassed ? 'Applications Closed' : 'Connect'}
                                </ConnectButton>
                            </div>
                            <div className="animate-fade-up [animation-delay:240ms]">
                                <HeroBrandFit fit={brandFit} />
                            </div>
                        </div>
                    </div>

                    {/* Key numbers — the card's bottom row. gap-px over a border-coloured grid draws
                        the hairlines; six cells divide evenly into 2, 3 or 6 columns. */}
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-border">
                        <div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6">
                            {metrics.map((metric, i) => (
                                <StatTile key={metric.label} {...metric} className={STAT_DELAYS[i]} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Detail sections — each fades up after the hero. ── */}
            <div className="mt-5 space-y-5">
                {/* Pricing sits right under the profile: a brand weighs the rate and what it buys
                    before digging into the analytics. */}
                <div className="animate-fade-up [animation-delay:500ms]">
                    <PricingValueSection rateCard={influencer.rateCard} insights={influencer.instagramInsights} />
                </div>

                {influencer.instagramInsights && (
                    <div className="animate-fade-up [animation-delay:580ms]">
                        <InstagramInsightsPanel insights={influencer.instagramInsights} />
                    </div>
                )}

                <div className="animate-fade-up [animation-delay:660ms]">
                    <PreviousWorkSection
                        items={influencer.previousWork ?? []}
                        totalCampaigns={influencer.pastCollaborations || 0}
                        experience={influencer.experience}
                    />
                </div>

                {/* Legacy creator-entered demographics — only when Instagram insights are absent.
                Full width, its three parts side by side, so no half-empty row is left behind. */}
                {hasDemographics && (
                        <section className={cn(profileSurface, 'animate-fade-up p-4 sm:p-5 space-y-4 [animation-delay:740ms]')}>
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-brand">
                                    <Users className="h-[18px] w-[18px]" />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="font-display text-lg font-semibold tracking-tight">Audience</h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Shared by the creator</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                            {demo?.age && Object.keys(demo.age).length > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-3 font-medium">Age distribution</p>
                                    <div className="space-y-2.5">
                                        {Object.entries(demo.age)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([range, pct]) => (
                                                <div key={range} className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground w-11 shrink-0">{range}</span>
                                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                                        <div className="h-full bg-[#fedc03] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Number(pct) || 0)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-semibold tabular-nums w-10 text-right shrink-0">{pct}%</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {demo?.gender && (demo.gender.female != null || demo.gender.male != null) && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-3 font-medium">Gender split</p>
                                    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-secondary gap-0.5 mb-2">
                                        <div style={{ width: `${demo.gender.female || 0}%` }} className="h-full bg-[#fedc03]" />
                                        <div style={{ width: `${demo.gender.male || 0}%` }} className="h-full bg-foreground" />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#fedc03]" />Female <span className="font-semibold text-foreground">{demo.gender.female || 0}%</span></span>
                                        <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-foreground" />Male <span className="font-semibold text-foreground">{demo.gender.male || 0}%</span></span>
                                    </div>
                                </div>
                            )}

                            {demo?.topLocations && demo.topLocations.length > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2 font-medium">Top locations</p>
                                    <ol className="divide-y divide-border/60">
                                        {demo.topLocations.map((loc, i) => (
                                            <li key={loc} className="flex items-center gap-3 py-2">
                                                <span className="text-[11px] font-semibold text-muted-foreground/60 w-4 shrink-0 tabular-nums">{i + 1}</span>
                                                <span className="text-sm flex-1 min-w-0 [overflow-wrap:anywhere]">{loc}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                            </div>
                        </section>
                )}
            </div>

            {showConnectModal && (
                <ConnectModal
                    influencerId={influencer.id}
                    influencerName={influencer.userName}
                    profileComplete={influencer.profileComplete}
                    profileCompletionIssues={influencer.profileCompletionIssues}
                    defaultCampaignId={campaignId}
                    onClose={() => setShowConnectModal(false)}
                />
            )}
            {showSaveModal && (
                <SaveToCollectionModal
                    influencerId={influencer.id}
                    influencerName={influencer.userName}
                    currentCollection={influencer.collectionName ?? undefined}
                    isSaved={!!influencer.isBookmarked}
                    onClose={() => setShowSaveModal(false)}
                />
            )}
        </div>
    );
}
