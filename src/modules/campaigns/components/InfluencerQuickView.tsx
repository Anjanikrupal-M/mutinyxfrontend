import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Users, Globe, BadgeCheck, ExternalLink, Phone, Heart, CalendarDays, Activity, Eye, UserCheck, Bookmark, Trophy, ArrowRight, Instagram, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaThumb } from '@/shared/components/MediaThumb';
import { useInfluencer } from '@/modules/discover/hooks/useInfluencers';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';
import { useAuthStore } from '@/shared/stores/authStore';
import { computeBrandFit, canScoreBrandFit } from '@/shared/utils/brandFit';
import { BrandFitRing } from '@/shared/components/BrandFitRing';
import { deriveTier } from '@/shared/utils/tierHelper';

const formatFollowers = (n: number | undefined | null) => {
    if (n === undefined || n === null) return 'N/A';
    return Math.round(n).toLocaleString('en-IN');
};

const tierFromFollowers = deriveTier;

const compact = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return Math.round(n).toLocaleString('en-IN');
};
const percent = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(2)}%`);

function countryName(code: string | null | undefined) {
    if (!code) return null;
    if (/^[A-Za-z]{2}$/.test(code) && typeof Intl.DisplayNames === 'function') {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
    }
    return code;
}

function QuickStat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
    return (
        <div className="min-w-0 rounded-xl bg-secondary/50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><Icon className="w-3 h-3 shrink-0" /><span className="truncate">{label}</span></p>
            <p className={cn('mt-1 text-base font-bold tabular-nums leading-none truncate', value === '—' && 'text-muted-foreground/50')}>{value}</p>
            {hint && <p className="mt-1 text-[10px] text-muted-foreground truncate">{hint}</p>}
        </div>
    );
}

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

interface QuickViewVisitLocation {
    id: string;
    description: string;
}

interface InfluencerQuickViewProps {
    influencerId: string;
    onClose: () => void;
    renderActions?: (influencer: any) => React.ReactNode;
    showPhone?: boolean;
    /** Visit location this influencer picked at apply time, for campaigns offering >1 location. */
    selectedVisitLocation?: QuickViewVisitLocation | null;
}

export function InfluencerQuickView({ influencerId, onClose, renderActions, showPhone = false, selectedVisitLocation = null }: InfluencerQuickViewProps) {
    const { data: influencer, isLoading } = useInfluencer(influencerId);
    const currentUser = useAuthStore((s) => s.user);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Hooks must be called unconditionally at the top
    const followers = influencer?.followerCount ?? (influencer as any)?.followers ?? 0;

    if (isLoading) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div className="relative bg-card border border-border rounded-2xl shadow-xl p-12 animate-fade-in">
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>,
            document.body
        );
    }

    if (!influencer) return null;

    // API may return userName/handle; support both name and userName for display
    const displayName = (influencer as { name?: string }).name ?? (influencer as { userName?: string }).userName ?? influencer.handle ?? 'Unknown';
    const displayHandle = influencer.handle ?? '';
    const engagement = typeof influencer.engagementRate === 'number' ? influencer.engagementRate : parseFloat(String(influencer.engagementRate ?? 0)) || 0;

    const connectedPlatforms = (influencer?.platforms || []).filter(
        (p: any) => p.handle && p.handle.trim() !== ''
    );

    const normalizedLocation = String(influencer.location ?? '')
        .replace(/[\s\-–—|,]+$/g, '')
        .trim();

    // Brand Fit — same client-side scoring used on the Influencers page & Applications cards.
    const brandFitProfile = { industry: currentUser?.industry, city: currentUser?.city, state: currentUser?.state };
    const brandFit = canScoreBrandFit(brandFitProfile)
        ? computeBrandFit(brandFitProfile, {
            niches: (influencer as any).niches ?? null,
            location: influencer.location ?? null,
            engagementRate: influencer.engagementRate ?? engagement,
        })
        : null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-[46rem] max-h-[88vh] overflow-y-auto scrollbar-thin animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium z-10"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Cover */}
                <div className="h-24 bg-linear-to-r from-secondary via-muted to-secondary rounded-t-2xl" />

                {/* Profile */}
                <div className="px-4 sm:px-5 pb-5 -mt-8">
                    <div className="flex items-end gap-3 mb-3">
                        <div className="w-16 h-16 rounded-xl bg-foreground text-background flex items-center justify-center text-xl font-bold border-4 border-card shrink-0 overflow-hidden">
                            {influencer.userAvatarUrl ? (
                                <ApiImage
                                    src={influencer.userAvatarUrl}
                                    alt={displayName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                displayName.charAt(0)
                            )}
                        </div>
                        <div className="pb-1 min-w-0 flex-1">
                            <h3 className="text-lg font-bold font-display flex items-center gap-1.5">
                                {displayName}
                                {influencer.isVerified && <BadgeCheck className="w-5 h-5 text-blue-500 shrink-0" />}
                            </h3>
                            {displayHandle && displayHandle !== '1' && (
                                <p className="text-xs text-muted-foreground truncate">{displayHandle}</p>
                            )}
                            {connectedPlatforms.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    {connectedPlatforms.map((p: any) => {
                                        const platformName = p.platform;
                                        const Icon = PLATFORM_ICONS[platformName.toLowerCase()];
                                        const profileUrl = getProfileUrl(platformName, p.handle || '');
                                        if (!Icon || !profileUrl) return null;
                                        return (
                                            <a
                                                key={platformName}
                                                href={profileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-8 h-8 rounded-lg bg-secondary hover:bg-[#fedc03]/10 hover:text-[#0a0a0a] hover:border-[#fedc03]/30 flex items-center justify-center text-muted-foreground transition-premium border border-border"
                                                title={`View ${p.handle || platformName} on ${platformName}`}
                                            >
                                                <Icon className="w-4.5 h-4.5" />
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {brandFit && <BrandFitRing fit={brandFit} size={64} className="mb-1" />}
                    </div>

                    {/* Badge pills */}
                    {influencer.badges && influencer.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {(influencer.badges as string[]).map((badgeKey) => {
                                const meta = BADGE_METADATA[badgeKey];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={badgeKey}
                                        title={meta.description}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm transition-all hover:scale-105 cursor-help ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                                    >
                                        <Icon className="w-3 h-3" />
                                        <span>{meta.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {influencer.bio != null && influencer.bio !== '' && (
                        <p className="text-xs text-muted-foreground mb-3 break-words whitespace-pre-wrap">{influencer.bio}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{normalizedLocation || '—'}</span>
                        {showPhone && influencer.userPhoneNumber && (
                            <span className="flex items-center gap-1 font-semibold text-foreground bg-[#fedc03]/10 px-2 py-0.5 rounded border border-[#fedc03]/20 shrink-0">
                                <Phone className="w-3.5 h-3.5 text-[#0a0a0a]" />
                                {influencer.userPhoneNumber}
                            </span>
                        )}
                    </div>

                    {/* Headline numbers — synced Instagram values when connected, profile values otherwise */}
                    {(() => {
                        const ig = (influencer as any).instagramInsights as import('@/modules/discover/influencer-display').InstagramInsightsPayload | null | undefined;
                        const igConnected = !!ig?.connected;
                        const metrics = ig?.accountPerformance?.metrics ?? {};
                        const summary = ig?.summary;
                        const topPosts = (ig?.content ?? [])
                            .filter((item) => item.thumbnailUrl || item.permalink)
                            .sort((a, b) => ((b.metrics?.totalInteractions ?? b.metrics?.reach ?? 0) - (a.metrics?.totalInteractions ?? a.metrics?.reach ?? 0)))
                            .slice(0, 3);
                        const audience = [
                            { label: 'Top country', value: countryName(summary?.topCountry) },
                            { label: 'Top city', value: summary?.topCity ?? null },
                            { label: 'Largest age group', value: summary?.topAgeGroup ?? null },
                        ].filter((item) => item.value);
                        const pastCampaigns = Number((influencer as any).pastCollaborations ?? 0);

                        return (
                            <div className="space-y-4 mb-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <QuickStat icon={Users} label="Followers" value={compact(igConnected ? ig!.profile.followerCount : Number(followers) || null)} hint={tierFromFollowers(Number(igConnected ? ig!.profile.followerCount : followers) || 0) + ' creator'} />
                                    <QuickStat icon={BarChart3} label="Engagement rate" value={percent(engagement || null)} hint="Likes + comments per follower" />
                                    <QuickStat icon={Heart} label="Avg likes / post" value={igConnected ? compact(ig!.performance.avgLikes) : '—'} hint="Recent posts" />
                                    <QuickStat icon={CalendarDays} label="Posts / week" value={igConnected ? ig!.performance.postingFrequency.toFixed(1) : '—'} hint="Posting frequency" />
                                </div>

                                {igConnected ? (
                                    <>
                                        {(metrics.reach != null || summary) && (
                                            <div>
                                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <Instagram className="w-3 h-3" /> Instagram · last 30 days
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    <QuickStat icon={Eye} label="Accounts reached" value={compact(metrics.reach)} />
                                                    <QuickStat icon={UserCheck} label="Accounts engaged" value={compact(metrics.accounts_engaged)} />
                                                    <QuickStat icon={Activity} label="Engagement by reach" value={percent(summary?.engagementByReach)} />
                                                    <QuickStat icon={Bookmark} label="Save rate" value={percent(summary?.saveRate)} />
                                                </div>
                                            </div>
                                        )}

                                        {audience.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {audience.map((item) => (
                                                    <span key={item.label} className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                                                        {item.label}: <span className="font-semibold text-foreground">{item.value}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {topPosts.length > 0 && (
                                            <div>
                                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top recent posts</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {topPosts.map((post) => {
                                                        const card = (
                                                            <>
                                                                <MediaThumb src={post.thumbnailUrl} alt="Instagram post" className="aspect-[4/5] rounded-lg" imageClassName="transition-transform duration-300 group-hover:scale-105" />
                                                                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-b-lg bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-5 text-[10px] font-medium text-white">
                                                                    {post.metrics?.views != null && <span className="inline-flex items-center gap-0.5"><Eye className="w-3 h-3" />{compact(post.metrics.views)}</span>}
                                                                    {post.metrics?.likes != null && <span className="inline-flex items-center gap-0.5"><Heart className="w-3 h-3" />{compact(post.metrics.likes)}</span>}
                                                                </span>
                                                            </>
                                                        );
                                                        return post.permalink
                                                            ? <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="group relative block" title="Open on Instagram">{card}</a>
                                                            : <div key={post.id} className="group relative">{card}</div>;
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="rounded-xl bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                                        {ig?.requiresReconnect ? 'Instagram needs to be reconnected before verified insights can be shown.' : 'Instagram is not connected through official login, so verified insights are not available.'}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fedc03]/15 px-2.5 py-1 text-[11px] font-medium">
                                        <Trophy className="w-3 h-3" /> {pastCampaigns} Mutiny campaign{pastCampaigns === 1 ? '' : 's'} completed
                                    </span>
                                    {connectedPlatforms.map((p: any) => {
                                        const Icon = PLATFORM_ICONS[String(p.platform).toLowerCase()] || Globe;
                                        const profileUrl = getProfileUrl(p.platform, p.handle || '', p.profileUrl);
                                        return profileUrl ? (
                                            <a key={p.platform} href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary transition-premium">
                                                <Icon className="w-3.5 h-3.5" /> {compact(Number(p.followers) || null)} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                            </a>
                                        ) : null;
                                    })}
                                </div>

                                <Link
                                    to={`/discover/${influencer.id}`}
                                    onClick={onClose}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-premium"
                                >
                                    View full profile <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        );
                    })()}

                    {selectedVisitLocation && (
                        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
                            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">Visit Location</p>
                            <div className="p-3 rounded-xl bg-secondary/35 border border-border/20">
                                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                                    {selectedVisitLocation.description}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Niches */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {((influencer.niche ?? influencer.niches) ?? []).map((n) => (
                            <span key={n} className="px-2 py-1 rounded-md bg-secondary text-[11px] font-medium break-words">{n}</span>
                        ))}
                    </div>

                    {renderActions && (
                        <div className="mt-6 pt-4 border-t border-border">
                            {renderActions(influencer)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

