import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Users, FileText, Send, BarChart3, CheckCircle2, Clock, Kanban, LockKeyhole, Globe, Video, Smile, MessageSquare, Heart, MessageCircle, Share2, LucideIcon, TrendingUp, Trophy, Loader2, MoreVertical, Rocket, UserPlus, Sparkles, Award, Layers, Edit2, Link2, Ban, Copy, Check, X, MapPin, CalendarDays, CalendarClock, UserRound, Eye, Languages, Wallet, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { CampaignStatusBadge } from '../components/CampaignStatusBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { useCampaign, useDeleteCampaign, useLaunchCampaign, useAssignCampaignAgent } from '@/modules/campaigns/hooks/useCampaigns';
import { useCampaignShareTokens } from '@/modules/campaigns/hooks/useCampaignShareTokens';
import { useAuthStore } from '@/shared/stores/authStore';
import { AssignAgentModal } from '@/shared/components/AssignAgentModal';
import { useApplications } from '@/modules/campaigns/hooks/useApplications';
import { toast } from 'sonner';
import ws from '@/core/websocket';
import { queryKeys } from '@/core/queryKeys';
import { WS_EVENTS } from '@/core/api';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationsTab } from '../components/ApplicationsTab';
import { KanbanBoard } from '../components/KanbanBoard';
import { ScriptsTab } from '../components/ScriptsTab';
import { WorkSubmissionsTab } from '../components/WorkSubmissionsTab';
import { ProofOfWorkTab } from '../components/ProofOfWorkTab';
import { AnalyticsTab } from './../components/AnalyticsTab';
import { AIStrategyTab } from '../components/AIStrategyTab';
import { ConvertToPrivateModal } from '../components/ConvertToPrivateModal';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { getCampaignDisplayStatus, isDeadlinePassed, getSkipsCreatorScript, getIsBrandScript, isApprovalRejected, isAwaitingApproval } from '@/modules/campaigns/utils/campaignStatus';
import { useAuthenticatedImageUrl } from '@/shared/hooks/useAuthenticatedImageUrl';
import { splitVisitAtSiteDescription } from '@/modules/campaigns/utils/visitAtSite';
import { useProofOfWorkSubmissions, useSubmissions } from '@/modules/campaigns/hooks/useSubmissions';
import { useScripts } from '@/modules/campaigns/hooks/useScripts';

import type { Campaign, CampaignInfluencer } from '@/shared/types/campaign';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';
import { TARGET_AGE_RANGES, TARGET_GENDERS } from '@/shared/constants/audience';

const PIPELINE_TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'applications', label: 'Applications', icon: Users },
    { key: 'kanban', label: 'Status Board', icon: Kanban },
    { key: 'scripts', label: 'Scripts', icon: FileText },
    { key: 'submissions', label: 'Work Submissions', icon: Send },
    { key: 'proof-of-work', label: 'Proof of Work', icon: Award },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'ai-strategy', label: 'AI Strategy', icon: Sparkles },
];

const TYPE_ICONS: Record<string, LucideIcon> = {
    influencer: Users,
    ugc: Video,
    meme: Smile,
    twitter: MessageSquare,
};

const TYPE_LABELS: Record<string, string> = {
    influencer: 'Influencer Marketing',
    ugc: 'UGC Marketing',
    meme: 'Meme Marketing',
    twitter: 'Twitter Marketing',
};

// IDs match CONTENT_FORMATS_BY_PLATFORM in CampaignBuilderPage.tsx
const formatExactNumber = (value?: number | null) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString('en-IN') : '0';
};
const CONTENT_TYPE_LABELS: Record<string, string> = {
    // Instagram
    reel: 'Reel',
    story: 'Story',
    'feed-post': 'Feed image',
    'feed-image': 'Feed image',
    'feed-video': 'Feed video',
    carousel: 'Carousel',
    // YouTube
    short: 'Short (<60s)',
    integration: 'Integration',
    dedicated: 'Dedicated Video',
    // Twitter / X
    'single-tweet': 'Single Tweet',
    thread: 'Thread',
    'twitter-space': 'Twitter Space',
    // Legacy / alternate IDs that may exist in older campaign records
    instagram_reel: 'Reel',
    instagram_story: 'Story',
    instagram_feed: 'Feed image',
    shorts: 'Short (<60s)',
    youtube_shorts: 'Short (<60s)',
    'long-form': 'Long-form Video',
    youtube_long: 'Long-form Video',
    tweet: 'Tweet',
};

function formatContentTypeLabel(id: string): string {
    return CONTENT_TYPE_LABELS[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "3× Reel, Short (<60s)" — the count comes from deliverables, which is written from the
 *  same values as contentTypes. Counts of 1 are left implicit. */
function contentTypeLabelsWithCounts(campaign: Campaign): string[] {
    const counts = new Map<string, number>();
    for (const d of campaign.deliverables ?? []) {
        if (d && typeof d === 'object' && d.type) counts.set(d.type, Math.max(1, Number(d.count) || 1));
    }
    return (campaign.contentTypes ?? []).map((id) => {
        const label = formatContentTypeLabel(id);
        const count = counts.get(id) ?? 1;
        return count > 1 ? `${count}× ${label}` : label;
    });
}

function getPublishBlockingFields(campaign: Campaign): string[] {
    const missing: string[] = [];
    const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

    if (!hasText(campaign.name)) missing.push('Campaign Name');
    if (!hasText(campaign.brief)) missing.push('Description');
    if (!hasText(campaign.thumbnailUrl || campaign.thumbnail)) missing.push('Cover Image');
    if (!campaign.type) missing.push('Campaign Type');

    if (!hasText(campaign.location)) missing.push('Location');
    if (!Array.isArray(campaign.niches) || campaign.niches.length === 0) missing.push('Industry');

    if (!hasText(campaign.platform)) missing.push('Platform');
    if (!Array.isArray(campaign.contentTypes) || campaign.contentTypes.length === 0) missing.push('Deliverables');
    if (!hasText(campaign.postingType)) missing.push('Posting Type');
    if (campaign.postingType === 'brand' && !hasText(campaign.usageRights)) missing.push('Usage Rights');

    if (!hasText(campaign.scriptType)) {
        // Backend stores deliverables.scriptType into requirements.scriptType — check there first
        if (hasText(campaign.requirements?.scriptType)) {
            campaign.scriptType = campaign.requirements!.scriptType!;
        } else {
            // Legacy fallback: infer from scriptFlow presence
            campaign.scriptType = hasText(campaign.scriptFlow) ? 'brand' : 'creator';
        }
    }

    if (campaign.scriptType === 'brand') {
        const hasScriptFlow = hasText(campaign.scriptFlow);
        const hasScriptFile = hasText(campaign.scriptFileKey);
        if (!hasScriptFlow && !hasScriptFile) {
            missing.push('Script Content or Script File');
        } else if (hasScriptFlow && !hasScriptFile && String(campaign.scriptFlow).trim().length < 30) {
            missing.push('Script Content (min 30 characters)');
        }
    }

    if (!campaign.budgetMode) missing.push('Budget Mode');
    if ((campaign.budgetMode === 'product' || campaign.budgetMode === 'paid_product') && !hasText(campaign.productDetails)) {
        missing.push('Product Details');
    }

    if (campaign.budgetMode !== 'product') {
        const budget = Number(campaign.budgetTotal || campaign.budget?.total || 0);
        if (!budget || budget <= 0) missing.push('Total Budget');

        if (campaign.visibility === 'public') {
            const isMix = Boolean(campaign.mixMode);
            const hasTier = isMix
                ? Array.isArray(campaign.creatorSizes) && campaign.creatorSizes.length > 0
                : hasText(campaign.selectedTier);
            if (!hasTier) missing.push('Creator Tier');
        }
    }

    if (!campaign.applicationDeadline) missing.push('Application Deadline');
    if (!campaign.workDeadline) missing.push('Work Deadline');
    if (campaign.scriptType === 'creator' && !campaign.scriptDeadline) missing.push('Script Deadline');
    if ((campaign.proofOfWorkRequired || campaign.proofOfWorkReq) && !campaign.proofOfWorkDeadline) missing.push('Proof of Work Deadline');

    return missing;
}

export default function CampaignDetailPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams<{ id: string }>();
    const [params, setParams] = useSearchParams();
    const activeTab = params.get('tab') || 'overview';

    // The list query string CampaignCard came from, so Back restores the page and filters the
    // user was on. Empty on a deep link or a card opened from anywhere without a paginated
    // list, which lands on the unfiltered first page — the previous behaviour.
    const location = useLocation();
    const navState = location.state;
    const listSearch = (navState as { listSearch?: string } | null)?.listSearch ?? '';

    const { data: campaign, isLoading, error } = useCampaign(id!);
    const { data: campaignInfluencers = [] } = useApplications(id!);
    const { data: proofSubmissions = [] } = useProofOfWorkSubmissions(id!);
    const { data: scriptVersions = [] } = useScripts(id!);
    const { data: workSubmissions = [] } = useSubmissions(id!);
    const { data: shareTokens } = useCampaignShareTokens(id);
    const deleteCampaignMutation = useDeleteCampaign();
    const launchCampaignMutation = useLaunchCampaign();
    const assignAgentMutation = useAssignCampaignAgent();
    const { user } = useAuthStore();
    const isBrandOwner = user?.role === 'brand_owner';
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showConvertToPrivateModal, setShowConvertToPrivateModal] = useState(false);
    const [justCopied, setJustCopied] = useState(false);

    const campaignUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (showPublishModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showPublishModal]);

    useEffect(() => {
        if (!id) return;
        ws.joinCampaign(id);

        // Full resync: only on genuine catch-all signals. The global websocketSetup
        // already invalidates per-event (scripts on SCRIPT_SUBMITTED, applications on
        // APPLICATION_STATUS_CHANGED, etc.), so the page-level handler does NOT need
        // to duplicate those. Doing so caused proof-of-work and applications to refetch
        // on every unrelated event (negotiation, payment, script edits).
        const handleFullResync = () => {
            if (campaignUpdateTimerRef.current) {
                clearTimeout(campaignUpdateTimerRef.current);
            }
            campaignUpdateTimerRef.current = setTimeout(() => {
                const keys = [
                    queryKeys.campaigns.detail(id),
                    queryKeys.campaigns.applications(id),
                    queryKeys.campaigns.statusBoard(id),
                    queryKeys.campaigns.payment.summary(id),
                    queryKeys.campaigns.scripts(id),
                    queryKeys.campaigns.submissions(id),
                    queryKeys.campaigns.proofOfWork(id),
                ] as const;

                keys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
            }, 600);
        };

        // Proof-of-work refresh: only on events that actually change it.
        const handleProofOfWorkUpdate = () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.proofOfWork(id) });
        };

        ws.on(WS_EVENTS.CAMPAIGN_UPDATED, handleFullResync);
        ws.on(WS_EVENTS.CAMPAIGN_UPDATE, handleFullResync);
        ws.on('__resync__', handleFullResync);
        ws.on('proof_of_work:submitted', handleProofOfWorkUpdate);
        ws.on('proof_of_work:reviewed', handleProofOfWorkUpdate);

        return () => {
            if (campaignUpdateTimerRef.current) clearTimeout(campaignUpdateTimerRef.current);
            ws.off(WS_EVENTS.CAMPAIGN_UPDATED, handleFullResync);
            ws.off(WS_EVENTS.CAMPAIGN_UPDATE, handleFullResync);
            ws.off('__resync__', handleFullResync);
            ws.off('proof_of_work:submitted', handleProofOfWorkUpdate);
            ws.off('proof_of_work:reviewed', handleProofOfWorkUpdate);
            ws.leaveCampaign(id);
        };
    }, [id, queryClient]);

    // Brand-provided script or no script at all — either way creators have no script stage.
    const isBrandScript = getSkipsCreatorScript(campaign);

    const isCreatorProvidedScript = campaign
        ? !isBrandScript
        : false;

    const visibleTabs = PIPELINE_TABS.filter((t) => {
        // The tab carries two things: the legacy AI strategy blob, and the creator shortlist.
        // Gating the whole tab on the blob hid the shortlist from every campaign not built by
        // the legacy strategist — which is now most of them — and a private campaign has no
        // other route to creator suggestions, since it takes no applications.
        if (t.key === 'ai-strategy' && !campaign?.aiStrategy && campaign?.visibility !== 'private') return false;
        if (t.key === 'scripts' && isBrandScript) return false;
        return true;
    });

    // Redirect away from scripts tab if brand provides the script
    useEffect(() => {
        if (!campaign || !isBrandScript) return;
        if (activeTab === 'scripts') {
            setParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', 'overview');
                return next;
            }, { replace: true, state: navState });
        }
    }, [campaign, activeTab, isBrandScript, setParams, navState]);

    const handlePublish = async () => {
        if (!campaign) return;
        setShowPublishModal(false);
        try {
            const toastId = toast.loading('Publishing campaign...');
            await launchCampaignMutation.mutateAsync(campaign.id);
            toast.success('Campaign published successfully!', { id: toastId });
        } catch (error) {
            const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
            const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to publish campaign';
            toast.error(msg);
        }
    };

    const handleCopyShareLink = async () => {
        if (!shareTokens?.overviewToken) {
            toast.error('Share link is not ready yet. Please try again in a moment.');
            return;
        }
        const url = `${window.location.origin}/review/campaign/overview/${shareTokens.overviewToken}`;
        try {
            await navigator.clipboard.writeText(url);
            setJustCopied(true);
            toast.success('Shareable link copied to clipboard');
            setTimeout(() => setJustCopied(false), 1800);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setJustCopied(true);
                toast.success('Shareable link copied to clipboard');
                setTimeout(() => setJustCopied(false), 1800);
            } catch {
                toast.error('Could not copy link. Long-press to copy manually.');
            } finally {
                document.body.removeChild(ta);
            }
        }
    };

    const handleWithdraw = async () => {
        if (!campaign) return;

        const confirmed = window.confirm(
            'Are you sure you want to withdraw this campaign? This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            const toastId = toast.loading('Withdrawing campaign...');
            await deleteCampaignMutation.mutateAsync(campaign.id);
            toast.success('Campaign withdrawn successfully', { id: toastId });
            navigate('/campaigns');
        } catch (error) {
            const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
            const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to withdraw campaign';
            toast.error(msg);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="w-full flex items-center justify-center min-h-[60vh]">
                <p className="text-sm text-destructive">Failed to load campaign details. Please try again.</p>
            </div>
        );
    }

    const displayStatus = getCampaignDisplayStatus(campaign);
    const applicationDeadlinePassed = isDeadlinePassed(campaign.applicationDeadline);
    // A campaign waiting on admin review is still status 'draft' — surface the real state so
    // the brand isn't left wondering why Publish did nothing.
    const awaitingApproval = isAwaitingApproval(campaign);
    const approvalRejected = isApprovalRejected(campaign);
    // Going private only makes sense while the campaign can still take creators — a finished,
    // withdrawn or expired campaign has nobody left to invite.
    const canSwitchToPrivate = displayStatus === 'draft' || displayStatus === 'active';

    // The Proof of Work badge counts creators with something awaiting review in that tab, read
    // from the tab's own list. The creator's overall status can't be used: on multi-deliverable
    // campaigns a creator still in the script stage can already have work in review.
    const creatorsAwaitingReview = (rows: Array<{ id?: unknown; status?: string | null; influencerId?: unknown; influencerHandle?: string | null }>) => new Set(
        rows
            .filter((row) => String(row?.status ?? '').toLowerCase() === 'pending')
            .map((row) => String(row.influencerId ?? row.influencerHandle ?? row.id)),
    ).size;
    // Scripts and Work Submissions show every creator who has submitted, whatever the review
    // state — the same total-style count as Applications, and one per card in the tab.
    const creatorsWithRows = (rows: Array<{ id?: unknown; influencerId?: unknown; influencerHandle?: string | null }>) => new Set(
        rows.map((row) => String(row.influencerId ?? row.influencerHandle ?? row.id)),
    ).size;
    const appCount = campaignInfluencers.length;
    const scriptCount = creatorsWithRows(scriptVersions);
    const submissionCount = creatorsWithRows(workSubmissions);
    // Only count rows from the dedicated proof_of_work_submissions table.
    // The backend list also merges in legacy work_submissions rows with a
    // proofOfWorkUrl, but their `status` reflects the WORK status, not the
    // proof status — so they'd inflate the badge even when no real proof is
    // pending review. Legacy rows have ids prefixed `legacy-`.
    const proofReviewCount = creatorsAwaitingReview(
        proofSubmissions.filter((p: any) => !String(p.id ?? '').startsWith('legacy-')),
    );

    const tabCounts: Record<string, number> = {
        applications: appCount,
        scripts: isBrandScript ? 0 : scriptCount,
        submissions: submissionCount,
        'proof-of-work': proofReviewCount,
    };

    const publishBlockingFields = getPublishBlockingFields(campaign);
    const canPublishCampaign = publishBlockingFields.length === 0;

    const hasCompletedWork = campaignInfluencers.some((ci) => 
        ['work_review', 'proof_review', 'completed'].includes(String(ci.status))
    );

    return (
        <div className="w-full px-3 sm:px-0 animate-fade-in">
            {/* Header — the back control sits inline with the title instead of taking its own row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="flex items-start gap-3 min-w-0 w-full sm:flex-1">
                    <button
                        type="button"
                        onClick={() => campaign?.programId ? navigate(`/programs/${campaign.programId}`) : navigate(`/campaigns${listSearch}`)}
                        aria-label={campaign?.programId ? 'Back to program' : 'Back to campaigns'}
                        title={campaign?.programId ? 'Back to program' : 'Back to campaigns'}
                        className="mt-1.5 sm:mt-2.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    {(campaign.thumbnailUrl || campaign.thumbnail) ? (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-border bg-secondary shrink-0 flex items-center justify-center p-0.5">
                            <ApiImage
                                src={campaign.thumbnailUrl || campaign.thumbnail}
                                alt={campaign.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-border bg-secondary shrink-0 flex items-center justify-center">
                            {(() => {
                                const Icon = TYPE_ICONS[campaign.type] || Users;
                                return <Icon className="w-6 h-6 text-[#fedc03]" />;
                            })()}
                        </div>
                    )}

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-lg sm:text-2xl font-bold font-display tracking-tight leading-tight break-words sm:truncate sm:max-w-lg md:max-w-2xl">{campaign.name}</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <CampaignStatusBadge campaign={campaign} />
                            {campaign.programId && (
                                <Link to={`/programs/${campaign.programId}`} className="text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 bg-[#fedc03]/90 text-black shadow-sm hover:bg-[#fedc03] transition-colors" title="View Program">
                                    <Layers className="w-3 h-3" /> Program
                                </Link>
                            )}
                            {campaign.agentId && campaign.agentName && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 bg-foreground/5 text-foreground" title="Team member">
                                    <Users className="w-3 h-3" /> {campaign.agentName}
                                </span>
                            )}
                            {campaign.visibility === 'private' ? (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 bg-foreground/5 text-foreground">
                                    <LockKeyhole className="w-3 h-3 text-amber-500" /> Private
                                </span>
                            ) : (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 bg-foreground/5 text-foreground">
                                    <Globe className="w-3 h-3" /> Public
                                </span>
                            )}
                            {campaign.location && (
                                <span className="text-sm text-muted-foreground truncate max-w-[160px]" title={campaign.location}>{campaign.location}</span>
                            )}
                            <span className="hidden sm:inline text-sm text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground">{TYPE_LABELS[campaign.type] ?? campaign.type}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex items-center justify-end gap-2">
                    {/* Publish CTA — only shown for draft campaigns not already in the queue.
                        While awaiting approval there is nothing for the brand to do, so the
                        button is replaced by a read-only status pill below. */}
                    {displayStatus === 'draft' && awaitingApproval && (
                        <span className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold">
                            <Clock className="w-4 h-4" />
                            Awaiting admin approval
                        </span>
                    )}

                    {displayStatus === 'draft' && !awaitingApproval && (
                        <button
                            type="button"
                            onClick={() => {
                                if (!canPublishCampaign) {
                                    const firstFew = publishBlockingFields.slice(0, 4).join(', ');
                                    const suffix = publishBlockingFields.length > 4 ? ` and ${publishBlockingFields.length - 4} more` : '';
                                    toast.error(`Complete required details first: ${firstFew}${suffix}`);
                                    return;
                                }
                                setShowPublishModal(true);
                            }}
                            disabled={launchCampaignMutation.isPending || !canPublishCampaign}
                            title={!canPublishCampaign ? 'Complete required campaign details before publishing' : undefined}
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#fedc03] text-black text-sm font-bold hover:bg-[#f0d000] transition-premium disabled:opacity-60"
                        >
                            {launchCampaignMutation.isPending
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Rocket className="w-4 h-4" />
                            }
                            {launchCampaignMutation.isPending
                                ? 'Publishing...'
                                : canPublishCampaign
                                    ? 'Publish Campaign'
                                    : 'Complete Details to Publish'}
                        </button>
                    )}

                    {displayStatus === 'active' && campaign.visibility === 'private' && !applicationDeadlinePassed && (
                        <Link
                            to={`/campaigns/${campaign.id}/invite`}
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#fedc03] text-black text-sm font-bold hover:bg-[#f0d000] transition-premium shadow-lg shadow-[#fedc03]/20"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite Influencers
                        </Link>
                    )}

                    {(displayStatus === 'draft' || displayStatus === 'active') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary transition-premium"
                                    aria-label="Campaign actions"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem asChild>
                                    <Link to={`/campaigns/${campaign.id}/edit`} className="cursor-pointer">
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Edit Campaign
                                    </Link>
                                </DropdownMenuItem>
                                {displayStatus === 'active' && campaign.visibility === 'private' && !applicationDeadlinePassed && (
                                    <DropdownMenuItem asChild>
                                        <Link to={`/campaigns/${campaign.id}/invite`} className="cursor-pointer">
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Invite Influencers
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                {campaign.visibility !== 'private' && canSwitchToPrivate && (
                                    <DropdownMenuItem onClick={() => setShowConvertToPrivateModal(true)} className="cursor-pointer">
                                        <LockKeyhole className="w-4 h-4 mr-2 text-amber-500" />
                                        Switch to Private
                                    </DropdownMenuItem>
                                )}
                                {isBrandOwner && (
                                    <DropdownMenuItem onClick={() => setShowAssignModal(true)}>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        {campaign.agentId ? 'Change team member' : 'Assign team member'}
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={handleCopyShareLink}>
                                    {justCopied ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <Link2 className="w-4 h-4 mr-2" />}
                                    {justCopied ? 'Copied' : 'Share Campaign'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleWithdraw}
                                    disabled={deleteCampaignMutation.isPending || hasCompletedWork}
                                    className="text-destructive focus:text-destructive"
                                    title={hasCompletedWork ? 'Cannot withdraw: Influencer work is completed or awaiting review' : undefined}
                                >
                                    <Ban className="w-4 h-4 mr-2" />
                                    {deleteCampaignMutation.isPending ? 'Withdrawing...' : 'Withdraw Campaign'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Approval state banners — the campaign is on 'draft' in both cases, so without
                these the brand has no way to tell why it is not live. */}
            {awaitingApproval && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 mb-6">
                    <Clock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900">Waiting for admin approval</p>
                        <p className="text-xs text-amber-800 mt-0.5">
                            This campaign is not visible to creators yet. It goes live automatically once an admin approves it.
                        </p>
                    </div>
                </div>
            )}

            {approvalRejected && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-300 bg-red-50 mb-6">
                    <Ban className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-red-900">Changes requested by admin</p>
                        {campaign.approvalRejectionReason && (
                            <p className="text-xs text-red-800 mt-0.5 whitespace-pre-line break-words">
                                {campaign.approvalRejectionReason}
                            </p>
                        )}
                        <p className="text-xs text-red-800 mt-1.5">
                            Edit the campaign and publish again to resubmit it for approval.
                        </p>
                    </div>
                </div>
            )}

            {/* Pipeline Tabs */}
            <div className="-mx-3 sm:mx-0 px-3 sm:px-0 flex items-stretch gap-1 mb-4 sm:mb-6 border-b border-border overflow-x-auto scrollbar-hide">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.key}
                        // replace, not push: otherwise every tab click stacks a history entry and
                        // the browser's Back button walks backwards through tabs instead of
                        // returning to the campaign list. `state` must be carried over by hand —
                        // a replace without it drops listSearch and breaks Back after a tab click.
                        onClick={() => setParams({ tab: tab.key }, { replace: true, state: navState })}
                        className={cn(
                            'flex min-w-[86px] sm:min-w-0 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2.5 text-[11px] sm:text-sm font-medium transition-premium relative whitespace-nowrap rounded-t-lg',
                            activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tabCounts[tab.key] !== undefined && tabCounts[tab.key] > 0 && (
                            <span className="ml-1 opacity-60">
                                ({tabCounts[tab.key]})
                            </span>
                        )}
                        {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fedc03]" />}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in min-w-0">
                <ErrorBoundary key={activeTab}>
                    {activeTab === 'overview' && <OverviewTab campaign={campaign} influencers={campaignInfluencers} />}
                    {activeTab === 'analytics' && <AnalyticsTab key={campaign.id} campaign={campaign} influencers={campaignInfluencers} />}
                    {activeTab === 'applications' && <ApplicationsTab campaign={campaign} />}
                    {activeTab === 'kanban' && <KanbanBoard campaign={campaign} />}
                    {activeTab === 'scripts' && !isBrandScript && <ScriptsTab campaign={campaign} />}
                    {activeTab === 'submissions' && <WorkSubmissionsTab campaign={campaign} />}
                    {activeTab === 'proof-of-work' && <ProofOfWorkTab campaign={campaign} />}
                    {activeTab === 'ai-strategy' && <AIStrategyTab campaign={campaign} />}
                </ErrorBoundary>
            </div>

            {/* Publish Confirmation Modal */}
            {showPublishModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-[#fedc03]/15 flex items-center justify-center shrink-0">
                                <Rocket className="w-5 h-5 text-[#0a0a0a]" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold">Publish Campaign?</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">This will go live immediately</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                            You're about to publish <span className="font-semibold text-foreground">{campaign.name}</span>.
                        </p>
                        <p className="text-sm text-muted-foreground mb-6">
                            Influencers will be able to see and apply to it. Make sure all campaign details are correct before publishing.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPublishModal(false)}
                                disabled={launchCampaignMutation.isPending}
                                className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-premium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                disabled={launchCampaignMutation.isPending}
                                className="flex-1 h-10 rounded-xl bg-[#fedc03] text-black text-sm font-bold hover:bg-[#f0d000] transition-premium disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {launchCampaignMutation.isPending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
                                    : <><Rocket className="w-4 h-4" /> Publish Now</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Agent Modal */}
            {isBrandOwner && campaign && (
                <AssignAgentModal
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    currentAgentId={campaign.agentId ?? null}
                    brandId={campaign.brandId}
                    itemName={campaign.name}
                    onAssign={async (agentId) => {
                        await assignAgentMutation.mutateAsync({ id: campaign.id, agentId });
                    }}
                />
            )}

            {/* Convert to Private Modal */}
            {showConvertToPrivateModal && campaign && (
                <ConvertToPrivateModal
                    campaign={campaign}
                    onClose={() => setShowConvertToPrivateModal(false)}
                    reason="general"
                />
            )}
        </div>
    );
}

// ── Overview Tab ──

export function OverviewTab({ campaign, influencers, isReadOnly }: { campaign: Campaign; influencers?: CampaignInfluencer[]; isReadOnly?: boolean }) {
    const formatDateFromDb = (value?: string | Date | null) => {
        if (!value) return '—';

        // Preserve DB calendar date from ISO strings to avoid timezone day shift in UI.
        if (typeof value === 'string') {
            const datePart = value.split('T')[0];
            const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) {
                const year = Number(m[1]);
                const month = Number(m[2]);
                const day = Number(m[3]);
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December',
                ];
                return `${day} ${monthNames[month - 1]} ${year}`;
            }
        }

        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const safeInfluencers = influencers ?? [];
    const statusCounts = {
        scriptPending: safeInfluencers.filter((ci) => ci.status === 'script_pending').length,
        scriptReview: safeInfluencers.filter((ci) => ci.status === 'script_review').length,
        workPending: safeInfluencers.filter((ci) => ci.status === 'work_pending').length,
        workReview: safeInfluencers.filter((ci) => ci.status === 'work_review').length,
        proofReview: safeInfluencers.filter((ci) => ci.status === 'proof_review').length,
        completed: safeInfluencers.filter((ci) => ci.status === 'completed').length,
    };

    const budgetMode = campaign.budgetMode || campaign.budget?.mode || 'paid';
    const isProductMode = budgetMode === 'product' || budgetMode === 'paid_product';
    const isProductOnlyCampaign = budgetMode === 'product';
    const isBrandProvidedScript = getSkipsCreatorScript(campaign);

    const hasAnyStatus = (statuses: string[]) =>
        safeInfluencers.some((ci) => statuses.includes(String(ci.status)));

    // Payment is considered done once any influencer moves beyond plain "accepted"
    // into payment/product/script/work pipeline or has a paid timestamp/status.
    const paymentReceivedDone = safeInfluencers.some((ci) => {
        const s = String(ci.status);
        return (
            [
                'payment_pending',
                'paid',
                'product_pending',
                'script_pending',
                'script_review',
                'work_pending',
                'work_review',
                'proof_review',
                'completed',
                'settled',
            ].includes(s) ||
            !!(ci as any).paidAt ||
            ci.paymentStatus === 'first_paid' ||
            ci.paymentStatus === 'completed'
        );
    });

    // Product delivery is considered done once influencer confirms receipt
    // OR flow has moved to script/work/completed states.
    const productDeliveryDone = safeInfluencers.some((ci) => {
        const s = String(ci.status);
        return (
            [
                'script_pending',
                'script_review',
                'work_pending',
                'work_review',
                'proof_review',
                'completed',
                'settled',
            ].includes(s) ||
            !!(ci as any).productReceivedAt ||
            !!ci.productReceived ||
            !!ci.proofOfDelivery
        );
    });

    const basePipelineSteps = [
        { label: 'Campaign Created', done: true },
        { label: 'Receiving Applications', done: campaign.applicationsCount > 0 || (!isDeadlinePassed(campaign.applicationDeadline) && campaign.status !== 'draft' && campaign.status !== 'withdrawn') },
        { label: 'Influencers Accepted', done: campaign.creatorsAccepted > 0 },
        ...(!isProductOnlyCampaign ? [{ label: 'Payment Received', done: paymentReceivedDone }] : []),
    ];

    const productStep = isProductMode ? [
        { label: 'Product Delivery', done: productDeliveryDone },
    ] : [];

    const displayStatus = getCampaignDisplayStatus(campaign);

    const workSteps = [
        ...(!isBrandProvidedScript
            ? [{ label: 'Scripts In Progress', done: hasAnyStatus(['script_pending', 'script_review', 'work_pending', 'work_review', 'proof_review', 'completed', 'settled']) }]
            : []),
        { label: 'Work In Progress', done: hasAnyStatus(['work_pending', 'work_review', 'proof_review', 'completed', 'settled']) },
        ...(campaign.proofOfWorkRequired || campaign.proofOfWorkReq
            ? [{ label: 'Proof of Work Review', done: hasAnyStatus(['proof_review', 'completed', 'settled']) }]
            : []),
        { label: 'Campaign Completed', done: displayStatus === 'completed' || displayStatus === 'closed' },
    ];

    const pipelineSteps = [...basePipelineSteps, ...productStep, ...workSteps];
    const computedProgress = Math.round((pipelineSteps.filter((s) => s.done).length / pipelineSteps.length) * 100);
    const formattedApplicationDeadline = formatDateFromDb(campaign.applicationDeadline);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-6">
            <div className="space-y-4 sm:space-y-6 min-w-0">
                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <MiniStat label="Applications" value={campaign.applicationsCount} />
                    <MiniStat label="Accepted" value={campaign.creatorsAccepted} />
                    <MiniStat label="In Progress" value={statusCounts.scriptPending + statusCounts.scriptReview + statusCounts.workPending + statusCounts.workReview + statusCounts.proofReview} />
                    <MiniStat label="Completed" value={statusCounts.completed} />
                </div>

                {/* Campaign Performance */}
                {campaign.analytics && (
                    <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-[#fedc03]" />
                            <h3 className="text-sm font-semibold">Campaign Performance</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
                            <PerformanceStat
                                label="Total Reach"
                                value={formatExactNumber(campaign.analytics.totalReach)}
                                icon={Globe}
                            />
                            <PerformanceStat
                                label="Engagement"
                                value={`${campaign.analytics.engagementRate}%`}
                                icon={BarChart3}
                            />
                            <PerformanceStat
                                label="Total Likes"
                                value={formatExactNumber(campaign.analytics.totalLikes)}
                                icon={Heart}
                            />
                            <PerformanceStat
                                label="Comments"
                                value={formatExactNumber(campaign.analytics.totalComments)}
                                icon={MessageCircle}
                            />
                            <PerformanceStat
                                label="Total Shared"
                                value={formatExactNumber(campaign.analytics.totalShares)}
                                icon={Share2}
                            />
                        </div>
                    </div>
                )}

                {/* Top Performers */}
                {campaign.topPerformers && campaign.topPerformers.length > 0 && (
                    <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-4 h-4 text-[#fedc03]" />
                            <h3 className="text-sm font-semibold">Top Performers</h3>
                        </div>
                        <div className="space-y-3">
                            {campaign.topPerformers.map((performer) => (
                                <div key={performer.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#fedc03] flex items-center justify-center text-black font-bold text-xs">
                                            {performer.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{performer.name}</p>
                                            <p className="text-xs text-muted-foreground">{performer.handle}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Reach</p>
                                            <p className="text-sm font-semibold">
                                                {formatExactNumber(performer.reach)}
                                            </p>
                                        </div>
                                        <div className="text-right min-w-[70px]">
                                            <p className="text-xs text-muted-foreground">Engagement</p>
                                            <p className="text-sm font-semibold text-emerald-500">{performer.engagement}%</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Progress */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                    <h3 className="text-sm font-semibold mb-3">Campaign Progress</h3>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-[#fedc03] rounded-full" style={{ width: `${computedProgress}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground">{computedProgress}% complete</p>
                </div>

                {/* Details — brief on top, facts as a tile grid, lists as chips; nothing stretches
                    a label and its value to opposite edges of a wide card. */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-5">
                    <h3 className="text-sm font-semibold">Details</h3>

                    {campaign.brief && (
                        <div className="rounded-xl bg-secondary/40 px-4 py-3.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brief</p>
                            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{campaign.brief}</p>
                        </div>
                    )}

                    {getIsBrandScript(campaign) && <BrandScriptBlock campaign={campaign} />}

                    <dl className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                        <DetailFact icon={MapPin} label="Location" value={campaign.location || '—'} />
                        <DetailFact icon={CalendarDays} label="Created" value={campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                        <DetailFact icon={CalendarClock} label="Application deadline" value={formattedApplicationDeadline} />
                        {campaign.agentId && <DetailFact icon={UserRound} label="Team member" value={campaign.agentName || '—'} />}
                        <DetailFact icon={Users} label="Creator size" value={(() => {
                            const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                            const single = campaign.creatorSize || campaign.selectedTier;
                            if (single) return fmt(single);
                            if (Array.isArray(campaign.creatorSizes) && campaign.creatorSizes.length > 0)
                                return campaign.creatorSizes.map(fmt).join(', ');
                            return '—';
                        })()} />
                        <DetailFact icon={Eye} label="Visibility" value={campaign.visibility === 'private' ? 'Private' : 'Public'} />
                        {campaign.language && <DetailFact icon={Languages} label="Language" value={campaign.language} />}
                        {!isReadOnly && (
                            <DetailFact icon={Wallet} label="Budget mode" value={(campaign.budgetMode || campaign.budget?.mode || 'paid').replace('_', ' + ').replace(/\b\w/g, (c) => c.toUpperCase())} />
                        )}
                        {!isReadOnly && !isProductOnlyCampaign && (
                            <DetailFact icon={Percent} label="Platform fee" value={`${campaign.platformFeePercent || campaign.budget?.platformFeePercent || DEFAULT_PLATFORM_FEE_PERCENT}%`} />
                        )}
                    </dl>

                    {(() => {
                        const niches = campaign.niches || campaign.niche || [];
                        const contentTypes = contentTypeLabelsWithCounts(campaign);
                        const tiers = !isReadOnly && !isProductOnlyCampaign
                            ? (campaign.budgetTierPricing || campaign.budget?.tierPricing || []).filter((tp) => tp.amount != null && tp.amount > 0)
                            : [];
                        if (niches.length === 0 && contentTypes.length === 0 && tiers.length === 0) return null;
                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {niches.length > 0 && (
                                    <DetailChips label="Niches">
                                        {niches.map((n) => <span key={n} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium [overflow-wrap:anywhere]">{n}</span>)}
                                    </DetailChips>
                                )}
                                {contentTypes.length > 0 && (
                                    <DetailChips label="Content types">
                                        {contentTypes.map((c) => <span key={c} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{c}</span>)}
                                    </DetailChips>
                                )}
                                {tiers.length > 0 && (
                                    <DetailChips label="Tier pricing">
                                        {tiers.map((tp) => (
                                            <span key={tp.tier} className="rounded-full bg-[#fedc03]/15 px-2.5 py-1 text-xs">
                                                <span className="capitalize font-medium">{tp.tier}</span> <span className="font-semibold tabular-nums">₹{(tp.amount ?? 0).toLocaleString('en-IN')}</span>
                                            </span>
                                        ))}
                                    </DetailChips>
                                )}
                            </div>
                        );
                    })()}

                    {/* Target audience from the builder's Basics step. Hidden for campaigns with no
                        preference set. Locations are the "City, State" picks only — campaigns created
                        before this block copied their creator location ("Pan India") in here. */}
                    {(() => {
                        const ages = TARGET_AGE_RANGES.filter((r) => campaign.targetAgeRanges?.includes(r));
                        const gender = campaign.targetGender && campaign.targetGender !== 'all'
                            ? TARGET_GENDERS.find((g) => g.value === campaign.targetGender)?.label ?? null
                            : null;
                        const locations = (campaign.targetLocations ?? []).filter((loc) => loc.includes(', '));
                        const languages = campaign.targetLanguages ?? [];
                        if (ages.length === 0 && !gender && locations.length === 0 && languages.length === 0) return null;
                        const chip = 'rounded-full border border-border px-2.5 py-1 text-xs font-medium [overflow-wrap:anywhere]';
                        return (
                            <div className="rounded-xl border border-border/70 px-4 py-3.5">
                                <p className="mb-3 text-sm font-semibold">Target audience</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailChips label="Age">
                                        {ages.length > 0
                                            ? ages.map((a) => <span key={a} className={cn(chip, 'tabular-nums')}>{a}</span>)
                                            : <span className={chip}>All ages</span>}
                                    </DetailChips>
                                    <DetailChips label="Gender">
                                        <span className={chip}>{gender ?? 'All'}</span>
                                    </DetailChips>
                                    <DetailChips label="Locations">
                                        {locations.length > 0
                                            ? locations.map((l) => <span key={l} className={chip}>{l}</span>)
                                            : <span className={chip}>Anywhere</span>}
                                    </DetailChips>
                                    <DetailChips label="Languages">
                                        {languages.length > 0
                                            ? languages.map((l) => <span key={l} className={chip}>{l}</span>)
                                            : <span className={chip}>Any language</span>}
                                    </DetailChips>
                                </div>
                            </div>
                        );
                    })()}

                    {((campaign.dos?.length ?? 0) > 0 || (campaign.donts?.length ?? 0) > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {campaign.dos && campaign.dos.length > 0 && (
                                <DetailList label="Dos" tone="good" items={campaign.dos} />
                            )}
                            {campaign.donts && campaign.donts.length > 0 && (
                                <DetailList label="Don'ts" tone="bad" items={campaign.donts} />
                            )}
                        </div>
                    )}

                    {campaign.visitAtSite?.options && campaign.visitAtSite.options.length > 0 && (
                        <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {campaign.visitAtSite.options.length > 1 ? 'Visit locations' : 'Visit at site'}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                {campaign.visitAtSite.options.map((loc, idx) => (
                                    <div key={loc.id || idx} className="rounded-xl border border-border/70 p-3">
                                        {campaign.visitAtSite!.options.length > 1 && (
                                            <p className="font-semibold text-xs mb-1">Location {idx + 1}</p>
                                        )}
                                        <p className="text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{loc.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right sidebar — pipeline & influencer status. Fixed sleek width so it never becomes too wide. */}
            <div className="flex flex-col gap-4 sm:gap-6">
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-1 shadow-sm">
                    <h3 className="text-base font-semibold mb-4">Pipeline Status</h3>
                    <div className="flex flex-col gap-3.5 lg:flex-1 lg:justify-evenly">
                        {pipelineSteps.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-xs', item.done ? 'bg-[#fedc03]' : 'bg-secondary')}>
                                    {item.done ? <CheckCircle2 className="w-4 h-4 text-black" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                                </div>
                                <span className={cn('text-sm', item.done ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick status counts with clear, legible text and badges */}
                <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-1 shadow-sm">
                    <h3 className="text-base font-semibold mb-3.5">Influencer Status</h3>
                    <div className="flex flex-col gap-2.5 lg:flex-1 lg:justify-evenly">
                        {[
                            ...(!isBrandProvidedScript
                                ? [
                                    { label: 'Script Pending', count: statusCounts.scriptPending, color: 'bg-violet-500' },
                                    { label: 'Script Review', count: statusCounts.scriptReview, color: 'bg-purple-500' },
                                ]
                                : []),
                            { label: 'Work Pending', count: statusCounts.workPending, color: 'bg-indigo-500' },
                            { label: 'Work Review', count: statusCounts.workReview, color: 'bg-cyan-500' },
                            ...((campaign.proofOfWorkRequired || campaign.proofOfWorkReq)
                                ? [{ label: 'Proof Review', count: statusCounts.proofReview, color: 'bg-sky-500' }]
                                : []),
                            { label: 'Completed', count: statusCounts.completed, color: 'bg-emerald-500' },
                        ].map((s) => (
                            <div key={s.label} className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-sm font-medium text-foreground/85">{s.label}</span>
                                </div>
                                <span className="text-xs font-bold tabular-nums bg-secondary/80 px-2.5 py-0.5 rounded-md border border-border/60">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Helpers ──

/** The script the brand supplied in the builder: typed text, an uploaded file, or both. */
function BrandScriptBlock({ campaign }: { campaign: Campaign }) {
    const scriptText = String(campaign.scriptFlow || campaign.requirements?.scriptFlow || '').trim();
    const fileKey = campaign.scriptFileKey || null;
    const { url: fileUrl } = useAuthenticatedImageUrl(fileKey);
    const fileName = fileKey ? fileKey.split('/').pop() : null;

    return (
        <div className="rounded-xl border border-border/70 px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                Brand script
            </p>
            {scriptText && (
                <p className="mt-1.5 max-h-80 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{scriptText}</p>
            )}
            {fileKey && (
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary transition-premium"
                >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{fileName}</span>
                </a>
            )}
            {!scriptText && !fileKey && (
                <p className="mt-1.5 text-sm text-muted-foreground">No script added yet.</p>
            )}
        </div>
    );
}

function PerformanceStat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-lg font-bold font-display">{value}</p>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-2xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
    );
}

function DetailFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-xl border border-border/70 px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
            </dt>
            <dd className="mt-1 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{value}</dd>
        </div>
    );
}

function DetailChips({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

function DetailList({ label, tone, items }: { label: string; tone: 'good' | 'bad'; items: string[] }) {
    const Icon = tone === 'good' ? Check : X;
    return (
        <div className={cn('min-w-0 rounded-xl px-4 py-3', tone === 'good' ? 'bg-emerald-500/[0.06]' : 'bg-rose-500/[0.06]')}>
            <p className={cn('mb-2 text-[11px] font-semibold uppercase tracking-wide', tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>{label}</p>
            <ul className="space-y-1.5">
                {items.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm leading-snug">
                        <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', tone === 'good' ? 'text-emerald-600' : 'text-rose-600')} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

