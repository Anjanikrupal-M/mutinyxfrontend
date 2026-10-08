import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, Search, UserPlus, CheckCircle2, Loader2,
    Sparkles, Globe, Users, MapPin,
    Plus, Minus, Clock, Filter, ChevronRight, ChevronLeft, UserRoundX,
} from 'lucide-react';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { cn } from '@/lib/utils';
import { useCampaign } from '@/modules/campaigns/hooks/useCampaigns';
import { useInviteInfluencers } from '@/modules/campaigns/hooks/useCampaignInvite';
import { useApplications } from '@/modules/campaigns/hooks/useApplications';
import { useEnrollments } from '@/modules/programs/hooks/usePrograms';
import type { ProgramEnrollment } from '@/shared/types/campaign';
import { useQuery } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { ApiImage } from '@/shared/components/ApiImage';
import { PlatformFollowerStats } from '@/shared/components/PlatformFollowerStats';
import { toast } from 'sonner';
import { InfluencerQuickView } from '../components/InfluencerQuickView';

function isDeadlinePassed(value?: string | Date | null) {
    if (!value) return false;

    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) return false;

    // Only force end-of-day if the string is purely a date (YYYY-MM-DD) with no time component
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        deadline.setHours(23, 59, 59, 999);
    }
    return deadline.getTime() < Date.now();
}

interface Influencer {
    id: string;
    userName: string;
    userAvatarUrl: string;
    handle: string;
    tier: string;
    followerCount: number;
    engagementRate: string;
    location: string;
    niches: string[];
    platforms: Array<{ platform: string; followers: number; handle?: string }>;
    bio?: string;
    languages?: string[];
    demographics?: {
        age?: Record<string, number>;
        gender?: { male?: number; female?: number };
        topLocations?: string[];
    };
    badges?: string[];
}


const NICHES = [
    'All',
    'Tech (Apps & SaaS)',
    'Food & Beverage',
    'Fashion & Beauty',
    'Entertainment & Media',
    'Education & Coaching',
    'Real Estate',
    'Hospitality & Travel',
    'Local Business',
    'Healthcare / Medical',
    'Agencies',
    'Jewellery & Accessories',
    'Health & Fitness',
    'Automobiles',
    'Finance & Fintech',
    'Electronics & Gadgets',
    'Baby & Parenting',
    'NGO & Social Cause',
    'Others',
];
const PLATFORMS = [
    { key: 'all', label: 'All' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'twitter', label: 'Twitter' },
];
const CREATOR_SIZES = ['All', 'Nano', 'Micro', 'Mid', 'Macro', 'Mega'];


export default function CampaignInvitePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const replaceCiId = searchParams.get('replaceCiId');
    const { data: campaign, isLoading: isCampaignLoading } = useCampaign(id!);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'suggested' | 'all'>('suggested');
    const [openProfileId, setOpenProfileId] = useState<string | null>(null);
    const [nicheFilter, setNicheFilter] = useState('All');
    const [platformFilter, setPlatformFilter] = useState('all');
    const [tierFilter, setTierFilter] = useState('All');
    const [page, setPage] = useState(1);

    /**
     * "Suggested" is driven by the campaign's OWN targeting — niches, platform, creator tiers
     * and location — and is available on every campaign.
     *
     * It used to be gated on `Boolean(campaign.aiStrategy)`, a blob only the legacy AI
     * Strategist ever writes. Every campaign built through the agentic assistant or the
     * step-by-step builder therefore had the tab hidden, was force-switched to "All Creators",
     * and never had its own niche or platform applied to the search — the brief was on screen
     * and the results ignored it.
     */

    // Reset to page 1 whenever filters or search changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, activeTab, nicheFilter, platformFilter, tierFilter]);

    const inviteMutation = useInviteInfluencers(id!);
    const { data: applications } = useApplications(id!);
    const invitedIds = useMemo(
        () => new Set((applications || []).map((app) => app.influencerId)),
        [applications],
    );

    // Influencers already enrolled in this campaign's program get first preference when
    // inviting — they've opted in ahead of time, so surface them before cold outreach.
    const { data: programEnrollments = [] } = useEnrollments(campaign?.programId || '');
    const enrolledIds = useMemo(
        () => new Set(
            (programEnrollments as ProgramEnrollment[])
                .filter((e) => e.status !== 'withdrawn')
                .map((e) => e.influencerId)
        ),
        [programEnrollments],
    );
    const outgoingCi = useMemo(
        () => (replaceCiId ? (applications || []).find((app) => app.id === replaceCiId) : undefined),
        [applications, replaceCiId],
    );
    const outgoingName = (outgoingCi as any)?.userName || (outgoingCi as any)?.handle || 'this creator';
    const applicationDeadlinePassed = isDeadlinePassed(campaign?.applicationDeadline);

    const { data: influencerData, isLoading: isInfluencersLoading } = useQuery({
        queryKey: ['influencers', 'search', searchQuery, activeTab, nicheFilter, platformFilter, tierFilter, campaign?.niches, campaign?.platform, campaign?.type, campaign?.creatorSizes, campaign?.location, page],
        queryFn: async () => {
            // 15 = five full rows of the 3-column card grid — never a ragged last row.
            const params: any = { q: searchQuery, limit: 15, page };
            if (nicheFilter !== 'All') params.niche = nicheFilter;
            if (platformFilter !== 'all') params.platform = platformFilter;
            if (tierFilter !== 'All') params.tier = tierFilter.toLowerCase();
            if (activeTab === 'suggested' && campaign) {
                // Manual filters always win — these only fill what the user has not set.
                if (!params.niche && campaign.niches?.length) {
                    params.niche = campaign.niches;
                    // Campaign and creator niches are stored in three vocabularies at once, so
                    // the default substring match both misses real matches and invents wrong
                    // ones ('it' is a tech alias and a substring of "Hospitality & Travel").
                    params.nicheMatch = 'canonical';
                }
                if (!params.platform) {
                    if (campaign.type === 'twitter') params.platform = 'twitter';
                    else if (campaign.platform) params.platform = campaign.platform;
                }
                if (!params.tier && campaign.creatorSizes?.length) params.tier = campaign.creatorSizes;
                // "Pan India" is the builder's word for "everywhere", but creator locations are
                // free text like "Hyderabad, India" and none of them literally read that — so
                // sending it as a filter matches nobody. A nationwide brief means do not narrow.
                if (campaign.location && campaign.location.toLowerCase() !== 'pan india') {
                    params.location = campaign.location;
                }
            }
            const { data } = await http.get(API.discover.search, { params });
            const influencers = (data?.data?.influencers ?? data?.data ?? []) as Influencer[];
            const meta: { page: number; limit: number; total: number; totalPages: number } =
                data?.meta ?? { page: 1, limit: 15, total: influencers.length, totalPages: 1 };
            return { influencers, meta };
        },
        enabled: !!campaign || activeTab === 'all',
    });

    const rawInfluencers = influencerData?.influencers ?? [];
    const paginationMeta = influencerData?.meta ?? { page: 1, limit: 15, total: 0, totalPages: 1 };

    // Stable sort: within the current page, enrolled influencers float to the top while
    // keeping the existing (AI/relevance) order intact within each group.
    const influencers = useMemo(() => {
        if (enrolledIds.size === 0) return rawInfluencers;
        return [...rawInfluencers].sort(
            (a, b) => Number(enrolledIds.has(b.id)) - Number(enrolledIds.has(a.id))
        );
    }, [rawInfluencers, enrolledIds]);

    const selectedInfluencers = useMemo(
        () => influencers.filter((inf) => selectedIds.has(inf.id)),
        [influencers, selectedIds],
    );

    const toggleSelection = (influencerId: string) => {
        if (invitedIds.has(influencerId)) {
            toast.info('This creator is already invited.');
            return;
        }
        // Replacement invites target exactly one creator — picking a new one swaps
        // the selection instead of adding to it.
        if (replaceCiId) {
            setSelectedIds((prev) => (prev.has(influencerId) ? new Set() : new Set([influencerId])));
            return;
        }
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(influencerId)) next.delete(influencerId);
            else next.add(influencerId);
            return next;
        });
    };

    const handleInvite = async () => {
        const inviteIds = Array.from(selectedIds).filter((iid) => !invitedIds.has(iid));
        if (inviteIds.length === 0) {
            toast.info('All selected creators are already invited.');
            return;
        }
        try {
            const result = await inviteMutation.mutateAsync({
                influencerIds: inviteIds,
                ...(replaceCiId ? { replacementForCiId: replaceCiId } : {}),
            });
            toast.success(
                replaceCiId
                    ? 'Replacement invite sent!'
                    : `Successfully invited ${result.succeeded} influencer${result.succeeded !== 1 ? 's' : ''}!`
            );
            if (result.failed > 0) {
                const reasons = (result.errors || []).map((e) => e.reason).filter(Boolean);
                const detail = reasons.length > 0 ? `: ${reasons.join(', ')}` : '.';
                toast.error(`Failed to invite ${result.failed} influencer(s)${detail}`);
            }
            setSelectedIds(new Set());
            if (replaceCiId && result.succeeded > 0) {
                navigate(`/campaigns/${id}?tab=applications`);
            }
        } catch (error: any) {
            const apiMsg =
                error?.response?.data?.error?.message ||
                error?.response?.data?.message ||
                error?.message ||
                'Failed to send invites';
            toast.error(apiMsg);
        }
    };

    if (isCampaignLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#fedc03]" />
            </div>
        );
    }

    if (campaign && campaign.visibility !== 'private') {
        return (
            <div className="w-full animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-2xl text-center gap-4">
                    <Globe className="w-12 h-12 text-muted-foreground" />
                    <h2 className="text-xl font-bold">Public campaigns don't use invites</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        This is a public campaign — any influencer can apply directly. Invitations are only available for private campaigns.
                    </p>
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary transition-all text-sm font-medium"
                    >
                        ← Back to Campaign
                    </Link>
                </div>
            </div>
        );
    }

    if (campaign && campaign.status === 'draft') {
        return (
            <div className="w-full animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-2xl text-center gap-4">
                    <Clock className="w-12 h-12 text-muted-foreground" />
                    <h2 className="text-xl font-bold">Campaign is in Draft</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        This campaign is not published yet. You must publish the campaign before inviting influencers.
                    </p>
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary transition-all text-sm font-medium"
                    >
                        ← Back to Campaign
                    </Link>
                </div>
            </div>
        );
    }

    if (campaign && applicationDeadlinePassed) {
        return (
            <div className="w-full animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-2xl text-center gap-4">
                    <Clock className="w-12 h-12 text-muted-foreground" />
                    <h2 className="text-xl font-bold">Applications are closed</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        The application deadline for this campaign has passed, so new invites and applications are disabled.
                    </p>
                    <Link
                        to={`/campaigns/${id}`}
                        replace
                        className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary transition-all text-sm font-medium"
                    >
                        ← Back to Campaign
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link
                    to={`/campaigns/${id}`}
                    replace
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {replaceCiId ? 'Invite a Replacement' : 'Invite Influencers'}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Campaign: <span className="text-foreground font-medium">{campaign?.name}</span>
                    </p>
                </div>
            </div>

            {replaceCiId && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#fedc03]/40 bg-[#fedc03]/10 px-4 py-3">
                    <UserRoundX className="w-5 h-5 text-foreground/70 shrink-0" />
                    <p className="text-sm font-medium">
                        Inviting a replacement for <span className="font-bold">{outgoingName}</span>. Pick one creator below — once they accept, you'll complete the swap from the Applications tab.
                    </p>
                </div>
            )}

            {/* Full-width content — the invite list lives in a floating action bar below,
                so the creator cards get the whole row instead of fighting a side panel. */}
            <div className="pb-24">
                    {/* Controls */}
                    <div className="flex flex-col gap-3 mb-6">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by name or handle..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#fedc03]/20 transition-all text-sm"
                                />
                            </div>
                            <div className="flex bg-card border border-border p-1 rounded-xl shrink-0">
                                <button
                                    onClick={() => setActiveTab('suggested')}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                        activeTab === 'suggested' ? 'bg-[#fedc03] text-black shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Suggested
                                </button>
                                <button
                                    onClick={() => setActiveTab('all')}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                        activeTab === 'all' ? 'bg-[#fedc03] text-black shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Globe className="w-4 h-4" />
                                    All Creators
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                            <div className="relative min-w-[140px]">
                                <select
                                    value={nicheFilter}
                                    onChange={(e) => setNicheFilter(e.target.value)}
                                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-border bg-card text-[13px] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 transition-all cursor-pointer"
                                >
                                    <option value="All">All Categories</option>
                                    {NICHES.filter(n => n !== 'All').map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            </div>

                            <div className="relative min-w-[120px]">
                                <select
                                    value={platformFilter}
                                    onChange={(e) => setPlatformFilter(e.target.value)}
                                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-border bg-card text-[13px] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 transition-all cursor-pointer"
                                >
                                    {PLATFORMS.map((p) => (
                                        <option key={p.key} value={p.key}>{p.label} (Platform)</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none rotate-90" />
                            </div>

                            <div className="relative min-w-[120px]">
                                <select
                                    value={tierFilter}
                                    onChange={(e) => setTierFilter(e.target.value)}
                                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-border bg-card text-[13px] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 transition-all cursor-pointer"
                                >
                                    <option value="All">All Tiers</option>
                                    {CREATOR_SIZES.filter(s => s !== 'All').map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    {isInfluencersLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-52 rounded-2xl bg-card border border-border animate-pulse" />
                            ))}
                        </div>
                    ) : influencers.length === 0 ? (
                        <div className="text-center py-20 bg-card border border-border rounded-2xl">
                            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                            <h3 className="text-base font-semibold">No influencers found</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                                Try adjusting your filters or searching for someone else.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {influencers.map((influencer) => {
                                const alreadyInvited = invitedIds.has(influencer.id);
                                const isSelected = selectedIds.has(influencer.id);

                                // Card layout mirrors the Discover InfluencerCard (square avatar left,
                                // niche chips, partitioned stats footer) so creator cards read the same
                                // everywhere — only the select/invited affordances differ here.
                                return (
                                    <div
                                        key={influencer.id}
                                        className={cn(
                                            'group relative flex flex-col rounded-2xl border bg-card p-4 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.08)]',
                                            isSelected ? 'border-[#fedc03] ring-1 ring-[#fedc03]' : 'border-transparent',
                                            alreadyInvited && 'opacity-60',
                                        )}
                                    >
                                        {/* Top: square avatar (left) + details (right) */}
                                        <div className="flex gap-4">
                                            <div
                                                onClick={() => setOpenProfileId(influencer.id)}
                                                className="relative w-[108px] h-[108px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-secondary cursor-pointer hover:ring-2 hover:ring-[#fedc03]/40 transition-all"
                                            >
                                                <ApiImage
                                                    src={influencer.userAvatarUrl}
                                                    alt={influencer.userName}
                                                    className="w-full h-full object-cover"
                                                    fallbackText={influencer.userName?.charAt(0).toUpperCase()}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0 flex flex-col">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div
                                                        onClick={() => setOpenProfileId(influencer.id)}
                                                        className="min-w-0 cursor-pointer"
                                                    >
                                                        <p className="text-[15px] font-bold font-display truncate hover:text-primary transition-colors">{influencer.userName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">@{influencer.handle}</p>
                                                    </div>
                                                    {alreadyInvited ? (
                                                        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground font-semibold">
                                                            Invited
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => toggleSelection(influencer.id)}
                                                            className={cn(
                                                                'shrink-0 w-7 h-7 -mr-1 -mt-1 rounded-full flex items-center justify-center transition-all border',
                                                                isSelected
                                                                    ? 'bg-[#fedc03] border-[#fedc03] text-black'
                                                                    : 'border-border text-muted-foreground hover:border-[#fedc03] hover:text-foreground',
                                                            )}
                                                            title={isSelected ? 'Remove' : 'Select'}
                                                        >
                                                            {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </div>

                                                {enrolledIds.has(influencer.id) && (
                                                    <span className="inline-flex items-center gap-1 w-fit mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#fedc03]/15 text-foreground font-semibold">
                                                        Enrolled
                                                    </span>
                                                )}

                                                {(influencer.niches?.length ?? 0) > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                                        {influencer.niches.slice(0, 3).map((niche) => (
                                                            <span
                                                                key={niche}
                                                                className="px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-semibold text-foreground/70 max-w-[120px] truncate capitalize"
                                                                title={niche}
                                                            >
                                                                {niche}
                                                            </span>
                                                        ))}
                                                        {(influencer.niches?.length ?? 0) > 3 && (
                                                            <span className="text-[10px] font-semibold text-muted-foreground" title={influencer.niches.slice(3).join(', ')}>
                                                                +{influencer.niches.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {influencer.bio && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1.5">{influencer.bio}</p>
                                                )}

                                                <div className="flex items-center gap-3 mt-auto pt-1.5 text-[11px] text-muted-foreground">
                                                    {influencer.location && (
                                                        <span className="flex items-center gap-1 min-w-0 truncate">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">{influencer.location}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Badge pills */}
                                        {influencer.badges && influencer.badges.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                {influencer.badges.map((badgeKey) => {
                                                    const meta = BADGE_METADATA[badgeKey];
                                                    if (!meta) return null;
                                                    const Icon = meta.icon;
                                                    return (
                                                        <span
                                                            key={badgeKey}
                                                            title={meta.description}
                                                            className={cn(
                                                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold',
                                                                meta.bgClass,
                                                                meta.textClass,
                                                                meta.borderClass,
                                                            )}
                                                        >
                                                            <Icon className="w-2.5 h-2.5" />
                                                            {meta.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Stats footer — full width, partitioned, matching the Discover card */}
                                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                                            <div className="flex items-stretch divide-x divide-border">
                                                <div className="pr-5">
                                                    <p className="text-[11px] text-muted-foreground mb-0.5">Followers</p>
                                                    <PlatformFollowerStats platforms={influencer.platforms} totalFallback={influencer.followerCount} />
                                                </div>
                                                <div className="px-5">
                                                    <p className="text-[11px] text-muted-foreground mb-0.5">Engagement</p>
                                                    <p className="text-sm font-bold text-foreground tabular-nums">{influencer.engagementRate != null ? `${influencer.engagementRate}%` : '—'}</p>
                                                </div>
                                                <div className="pl-5">
                                                    <p className="text-[11px] text-muted-foreground mb-0.5">Tier</p>
                                                    <p className="text-sm font-bold text-foreground capitalize">{influencer.tier ?? '—'}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setOpenProfileId(influencer.id)}
                                                className="w-9 h-9 rounded-full bg-[#fedc03]/15 flex items-center justify-center shrink-0 hover:bg-[#fedc03] transition-colors duration-300"
                                                title="View full profile"
                                            >
                                                <ChevronRight className="w-4 h-4 text-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {!isInfluencersLoading && paginationMeta.totalPages > 1 && (
                        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 mt-6 pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground sm:absolute sm:left-0">
                                Showing {((paginationMeta.page - 1) * paginationMeta.limit) + 1}–{Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.total)} of {paginationMeta.total} creators
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: paginationMeta.totalPages }, (_, i) => i + 1).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            'flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-semibold transition-all',
                                            page === p
                                                ? 'border-[#fedc03] bg-[#fedc03] text-black'
                                                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary',
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage((p) => Math.min(paginationMeta.totalPages, p + 1))}
                                    disabled={page === paginationMeta.totalPages}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            {/* Floating invite bar — replaces the old right-hand Invite List panel so the
                cards get the full width. Appears only while creators are selected.
                Portaled to <body>: the page root's animate-fade-in keeps a transform applied
                (fill-mode both), which would otherwise trap position:fixed inside the page. */}
            {selectedIds.size > 0 && createPortal(
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl">
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-xl px-4 py-3">
                        {/* Avatar stack of the first few selected creators */}
                        <div className="flex -space-x-2 shrink-0">
                            {selectedInfluencers.slice(0, 4).map((inf) => (
                                <div key={inf.id} className="w-8 h-8 rounded-full overflow-hidden border-2 border-card bg-secondary">
                                    <ApiImage src={inf.userAvatarUrl} alt={inf.userName} className="w-full h-full object-cover" fallbackText={inf.userName?.charAt(0).toUpperCase()} />
                                </div>
                            ))}
                            {selectedIds.size > 4 && (
                                <div className="w-8 h-8 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-[10px] font-bold">
                                    +{selectedIds.size - 4}
                                </div>
                            )}
                        </div>
                        <p className="text-sm font-semibold flex-1 min-w-0 truncate">
                            {selectedIds.size} creator{selectedIds.size !== 1 ? 's' : ''} selected
                        </p>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                            Clear all
                        </button>
                        <button
                            onClick={handleInvite}
                            disabled={inviteMutation.isPending}
                            className="h-10 px-5 rounded-xl bg-[#fedc03] text-black font-bold text-sm hover:bg-[#f0d000] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                            {inviteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <UserPlus className="w-4 h-4" />
                            )}
                            {replaceCiId ? 'Send Replacement Invite' : `Send ${selectedIds.size} Invite${selectedIds.size !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>,
                document.body,
            )}

            {/* Influencer profile dialog */}
            {openProfileId && (
                <InfluencerQuickView
                    influencerId={openProfileId}
                    onClose={() => setOpenProfileId(null)}
                    renderActions={() => {
                        const isSelected = selectedIds.has(openProfileId);
                        const isAlreadyInvited = invitedIds.has(openProfileId);
                        return (
                            <button
                                onClick={() => {
                                    if (isAlreadyInvited) return;
                                    toggleSelection(openProfileId);
                                }}
                                disabled={isAlreadyInvited}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm',
                                    isAlreadyInvited
                                        ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border'
                                        : isSelected
                                            ? 'bg-foreground text-background hover:bg-foreground/90'
                                            : 'bg-[#fedc03] text-black hover:bg-[#f0d000]'
                                )}
                            >
                                {isAlreadyInvited ? (
                                    'Already Invited'
                                ) : isSelected ? (
                                    <><Minus className="w-4 h-4" /> Remove from selection</>
                                ) : (
                                    <><Plus className="w-4 h-4" /> Add to selection</>
                                )}
                            </button>
                        );
                    }}
                />
            )}
        </div>
    );
}
