import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Users, Video, Smile, MessageSquare, LucideIcon, CalendarDays, Eye, Heart, ArrowUpRight, Layers } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import type { Campaign } from '@/shared/types/campaign';
import { CAMPAIGN_PHASE_LABELS, getCampaignDisplayStatus, getCampaignPhase, type CampaignPhase } from '@/modules/campaigns/utils/campaignStatus';
import { MoreVertical, UserPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { AssignAgentModal } from '@/shared/components/AssignAgentModal';
import { useState } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAssignCampaignAgent } from '@/modules/campaigns/hooks/useCampaigns';
import { useCampaignAnalytics } from '@/modules/campaigns/hooks/useCampaignAnalytics';
import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';

const TYPE_ICONS: Record<string, LucideIcon> = {
    influencer: Users,
    ugc: Video,
    meme: Smile,
    twitter: MessageSquare,
};

// Status dot on the cover chip, in the brand palette: yellow while the campaign is live and
// moving, orange when it is overdue, white once it is finished, faint white before launch.
const LIVE_PHASES: CampaignPhase[] = ['active', 'applications_open', 'inviting_creators', 'applications_received', 'in_progress', 'pending_review'];
function phaseDot(phase: CampaignPhase) {
    if (LIVE_PHASES.includes(phase)) return 'bg-brand shadow-[0_0_8px_rgb(250_203_3_/_0.9)]';
    if (phase === 'past_deadline' || phase === 'changes_requested') return 'bg-orange-400';
    if (phase === 'completed' || phase === 'closed') return 'bg-white';
    return 'bg-white/45';
}

function formatDateShort(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCompactNumber(n: number) {
    return Math.round(n || 0).toLocaleString('en-IN');
}

/** One cell of the stat strip at the foot of the card. */
function StatCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
    return (
        <div className="min-w-0 px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-foreground">{value}</p>
        </div>
    );
}

interface CampaignCardProps {
    campaign: Campaign;
    // The list query string ("?page=3&status=active") to return to, forwarded to the detail
    // page so its Back button can restore the exact list state. Only CampaignListPage owns a
    // paginated list, so it's the only caller that passes this — the card also renders on
    // ProgramDetailPage, where reading the current location would hand back the wrong params.
    listSearch?: string;
    /** Entrance stagger, e.g. "[animation-delay:120ms]". */
    className?: string;
}

/**
 * Campaign card — same family as the Discover creator card: a framed cover with the title over a
 * dark scrim and a frosted status chip, then the schedule and platform, then a divided stat
 * strip pinned to the bottom so numbers line up across a row.
 */
export function CampaignCard({ campaign, listSearch, className }: CampaignCardProps) {
    const { user } = useAuthStore();
    const isBrandOwner = user?.role === 'brand_owner';
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const { mutateAsync: assignAgent } = useAssignCampaignAgent();

    const TypeIcon = TYPE_ICONS[campaign.type] || Users;
    const displayStatus = getCampaignDisplayStatus(campaign);
    const phase = getCampaignPhase(campaign);
    const coverUrl = campaign.thumbnailUrl || campaign.thumbnail;
    const isProgramLinked = !!campaign.programId;
    const primaryNiche = (campaign.niches || campaign.niche || [])[0];

    const hasLaunched = displayStatus !== 'draft';

    // Fetch analytics data specifically for this card if launched
    const { data: analyticsData } = useCampaignAnalytics(hasLaunched ? campaign.id : '');

    const strategy = campaign.aiStrategy;
    const plannedReach = strategy ? Math.round((strategy.reachLow + strategy.reachHigh) / 2) : null;
    const plannedEngagement = strategy ? (strategy.engageLow + strategy.engageHigh) / 2 : null;
    const instagramSections = analyticsData?.instagramByFormat ?? [];
    const reportedFormats = instagramSections.filter((section) => section.proofCount > 0).length;
    const approvedProofs = instagramSections.reduce((total, section) => total + section.proofCount, 0);
    const youtubeViews = analyticsData?.youtube?.totalViews ?? null;
    const youtubeEngagement = analyticsData?.youtube?.engagementRate ?? null;
    const isInstagramCampaign = String(campaign.platform ?? '').toLowerCase().includes('instagram') || campaign.platform === 'both';
    const reachDisplay = hasLaunched && isInstagramCampaign
        ? `${reportedFormats}/${instagramSections.length || (campaign.contentTypes?.length ?? 0)}`
        : hasLaunched
            ? (youtubeViews != null && youtubeViews > 0 ? formatCompactNumber(youtubeViews) : '—')
            : (plannedReach != null ? formatCompactNumber(plannedReach) : '—');
    const engagementDisplay = hasLaunched && isInstagramCampaign
        ? approvedProofs.toLocaleString('en-IN')
        : hasLaunched
            ? (youtubeEngagement != null ? `${youtubeEngagement.toFixed(2)}%` : '—')
            : (plannedEngagement != null ? `${plannedEngagement.toFixed(2)}%` : '—');
    const reachLabel = !hasLaunched
        ? 'Est. reach'
        : isInstagramCampaign ? 'Formats' : 'Views';
    const engagementLabel = hasLaunched && isInstagramCampaign ? 'Proofs' : hasLaunched ? 'Eng. rate' : 'Est. eng.';

    const PlatformIcon = campaign.platform ? PLATFORM_ICONS[campaign.platform.toLowerCase()] : null;
    const contentTypes = campaign.contentTypes || [];
    const startDate = formatDateShort(campaign.launchedAt || campaign.createdAt);
    const endDate = formatDateShort(campaign.deadline);

    return (
        <>
        <Link
            to={`/campaigns/${campaign.id}`}
            state={listSearch ? { listSearch } : undefined}
            className={cn(
                'group relative flex h-full animate-fade-up flex-col rounded-[24px] border border-border bg-card p-1.5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-float',
                className,
            )}
        >
            {/* ── Cover: image (or a black panel with the type icon) under a dark scrim ── */}
            <div className="relative h-32 shrink-0 overflow-hidden rounded-[19px] bg-foreground">
                {coverUrl ? (
                    <ApiImage
                        src={coverUrl}
                        alt={campaign.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        placeholderClassName="bg-foreground"
                    />
                ) : (
                    <span className="relative block h-full w-full overflow-hidden">
                        <span aria-hidden className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgb(255_255_255)_1px,transparent_1px)] [background-size:14px_14px]" />
                        <TypeIcon aria-hidden className="absolute -bottom-5 -right-3 h-28 w-28 -rotate-12 text-brand/25 transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-105" strokeWidth={1.25} />
                    </span>
                )}
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

                {/* Status — frosted chip, the dot carries the state. */}
                <span className="absolute left-2.5 top-2.5 flex max-w-[70%] items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', phaseDot(phase))} />
                    <span className="truncate">{CAMPAIGN_PHASE_LABELS[phase]}</span>
                </span>

                {isBrandOwner && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/60"
                                aria-label="Campaign options"
                            >
                                <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); setIsAssignModalOpen(true); }}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                {campaign.agentId ? 'Change team member' : 'Assign team member'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Title over the scrim; the yellow arrow slides in on hover (the whole card is the link). */}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
                    <div className="min-w-0 text-white">
                        {isProgramLinked && (
                            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-black" title="Part of a Program">
                                <Layers className="h-2.5 w-2.5" />
                                Program
                            </span>
                        )}
                        <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight tracking-tight" title={campaign.name}>
                            {campaign.name}
                        </h3>
                        {primaryNiche && <p className="mt-0.5 truncate text-[11px] text-white/65">{primaryNiche}</p>}
                    </div>
                    <span className="grid h-7 w-7 shrink-0 translate-y-2 place-items-center rounded-full bg-brand text-black opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col px-1.5 pb-0.5 pt-2.5">
                {/* Schedule on the left, platform + formats on the right. */}
                <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                    {(startDate || endDate) && (
                        <span className="flex min-w-0 items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{startDate}{startDate && endDate ? ' → ' : ''}{endDate}</span>
                        </span>
                    )}
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                        {PlatformIcon && (
                            <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-secondary" title={campaign.platform}>
                                <PlatformIcon className="h-3 w-3" />
                            </span>
                        )}
                        {contentTypes.slice(0, 2).map((ct) => (
                            <span key={ct} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize text-foreground/70">
                                {ct}
                            </span>
                        ))}
                        {contentTypes.length > 2 && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={contentTypes.slice(2).join(', ')}>
                                +{contentTypes.length - 2}
                            </span>
                        )}
                    </span>
                </div>

                {/* Stat strip pinned to the bottom so numbers line up across a row of cards. */}
                <div className="mt-auto pt-2.5">
                    <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-secondary/40 transition-colors duration-300 group-hover:bg-secondary/70">
                        <StatCell icon={Eye} label={reachLabel} value={reachDisplay} />
                        <StatCell icon={Heart} label={engagementLabel} value={engagementDisplay} />
                        <StatCell icon={Users} label="Creators" value={campaign.creatorsAccepted || 0} />
                    </div>
                </div>
            </div>
        </Link>

        {isBrandOwner && (
            <AssignAgentModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                currentAgentId={campaign.agentId}
                brandId={campaign.brandId}
                itemName="this campaign"
                onAssign={async (agentId) => {
                    await assignAgent({ id: campaign.id, agentId });
                }}
            />
        )}
        </>
    );
}
