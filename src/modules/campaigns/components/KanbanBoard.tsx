import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Globe, MessageCircle, ExternalLink, Clock, Instagram, Youtube, Twitter, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProofOfWorkSubmissions } from '../hooks/useSubmissions';
import { useStatusBoardApplications, useMarkProductShipped } from '../hooks/useApplications';
import { PackageCheck } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import { canChatByInfluencerStatus, isAwaitingFinalPayment } from '@/shared/types/campaign';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { useStartConversation } from '@/modules/messages/hooks/useMessages';
import { useFillViewport } from '../hooks/useFillViewport';
import { useAuthStore } from '@/shared/stores/authStore';
import { InfluencerQuickView } from './InfluencerQuickView';
import { KanbanCardSkeleton } from './TabSkeletons';
import type { Campaign } from '@/shared/types/campaign';
import type { InfluencerCampaignStatus } from '@/shared/types/campaign';
import { getSkipsCreatorScript } from '@/modules/campaigns/utils/campaignStatus';

const CHAT_LOCKED_TOOLTIP = 'Chat unlocks automatically during the script & work phase.';

const formatFollowers = (n: number) => Math.round(n || 0).toLocaleString('en-IN');

/**
 * KANBAN COLUMN STATUS FLOW:
 * 
 * PAID ONLY (no product):
 * script_pending → script_review → work_pending → work_review → proof_review → completed
 * 
 * PAID + PRODUCT:
 * product_pending → script_pending → script_review → work_pending → work_review → proof_review → completed
 * 
 * BRAND SCRIPT + PAID:
 * script_pending → script_review → work_pending → work_review → proof_review → completed
 * (Script review happens as delivery review for brand-provided scripts)
 * 
 * BRAND SCRIPT + PAID + PRODUCT:
 * product_pending → script_pending → script_review → work_pending → work_review → proof_review → completed
 * (Product delivered first, then brand script sent, then work/content delivery)
 * 
 * NOTE: When a new influencer accepts a campaign with paid+product mode,
 * they MUST start in product_pending status, not script_pending.
 * Backend should validate and set correct initial status based on campaign budget mode.
 */

interface KanbanColumn {
    key: InfluencerCampaignStatus;
    label: string;
    color: string;
}

// Line glyphs for the platform chip on a card (the coloured app-icon tiles look dated at this size).
const PLATFORM_GLYPHS: Record<string, LucideIcon> = { instagram: Instagram, youtube: Youtube, twitter: Twitter, x: Twitter };
// Each platform's own colour for its glyph, so the chip says which network at a glance.
const PLATFORM_TINT: Record<string, string> = { instagram: 'text-pink-600', youtube: 'text-red-600', twitter: 'text-foreground', x: 'text-foreground' };

const KANBAN_COLUMNS: KanbanColumn[] = [
    { key: 'product_pending', label: 'Waiting for Product', color: 'bg-fuchsia-500' },
    { key: 'script_pending', label: 'Script Pending', color: 'bg-violet-500' },
    { key: 'script_review', label: 'Script Review', color: 'bg-purple-500' },
    { key: 'work_pending', label: 'Work Pending', color: 'bg-indigo-500' },
    { key: 'work_review', label: 'Work Review', color: 'bg-cyan-500' },
    { key: 'proof_review', label: 'Proof of Work', color: 'bg-sky-500' },
    { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
];

interface KanbanBoardProps {
    campaign: Campaign;
    applications?: any[];
    isReadOnly?: boolean;
}

export function KanbanBoard({ campaign, applications, isReadOnly }: KanbanBoardProps) {
    const navigate = useNavigate();
    const currentUser = useAuthStore((s) => s.user);
    const startConversation = useStartConversation();
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    // On desktop the board runs to the bottom of the screen and its columns scroll inside it.
    const boardRef = useFillViewport<HTMLDivElement>({ enabled: !isReadOnly });
    const { data: fetchedCampaignInfluencers = [], isLoading: isLoadingBoard } = useStatusBoardApplications(isReadOnly ? '' : campaign.id);
    const campaignInfluencers = isReadOnly ? (applications ?? []) : fetchedCampaignInfluencers;
    const { data: proofSubmissions = [] } = useProofOfWorkSubmissions(isReadOnly ? '' : campaign.id);
    const markProductShipped = useMarkProductShipped();
    const isBrandProvidedScript = getSkipsCreatorScript(campaign);
    const budgetMode = campaign.budget?.mode || campaign.budgetMode || 'paid';
    const isProductMode = budgetMode === 'product' || budgetMode === 'paid_product';
    const effectiveStatus = (status: string) => {
        const normalized = String(status || '').toLowerCase();
        // Product-only campaigns move approved creators directly to product stage in UI.
        if (budgetMode === 'product' && normalized === 'accepted') return 'product_pending';
        return normalized;
    };

    // Kanban column a creator belongs to.
    const columnKeyFor = (ci: any): string => {
        return effectiveStatus(ci.status);
    };

    let visibleColumns = isBrandProvidedScript
        ? KANBAN_COLUMNS.filter((col) => col.key !== 'script_pending' && col.key !== 'script_review')
        : [...KANBAN_COLUMNS];

    if (!isProductMode) {
        visibleColumns = visibleColumns.filter((col) => col.key !== 'product_pending');
    }

    // If brand script is provided, influencers should skip direct script stages and go product -> work
    // If product mode, influencers should start in product_pending before scripts
    if (!isBrandProvidedScript && isProductMode) {
        // For product mode with user scripts, keep product -> scripts -> work flow
    }
    // Note: For brand script campaigns, product_pending is still shown if paid+product

    const getDaysInStatus = (ci: any) => {
        const since = ci.acceptedAt || ci.connectedAt || ci.createdAt;
        if (!since) return 0;
        const time = new Date(since).getTime();
        if (isNaN(time)) return 0;
        const days = Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    };

    const proofSubmissionsByCiId = useMemo(() => {
        return proofSubmissions.reduce<Record<string, any[]>>((acc, submission) => {
            const key = String(submission.campaignInfluencerId || submission.influencerId || '');
            if (!key) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(submission);
            return acc;
        }, {});
    }, [proofSubmissions]);

    const getProofOfWorkLink = (ci: any) => {
        const ciId = String(ci.id || ci.influencerId || '');
        const proofRows = proofSubmissionsByCiId[ciId] ?? [];
        const latestProof = [...proofRows]
            .sort((a, b) => {
                const ta = new Date(a?.submittedAt || 0).getTime();
                const tb = new Date(b?.submittedAt || 0).getTime();
                return tb - ta;
            })
            .find((row) => String(row?.proofUrl || '').trim());

        if (latestProof) {
            return String(latestProof.proofUrl || '').trim();
        }

        const submissions = Array.isArray(ci?.workSubmissions) ? ci.workSubmissions : [];
        if (!submissions.length) return '';

        const sorted = [...submissions].sort((a, b) => {
            const ta = new Date(a?.submittedAt || 0).getTime();
            const tb = new Date(b?.submittedAt || 0).getTime();
            return tb - ta;
        });

        const latest = sorted.find((row) => row?.proofOfWorkUrl || row?.proofUrl || row?.externalUrl || row?.url);
        return String(latest?.proofOfWorkUrl || latest?.proofUrl || latest?.externalUrl || latest?.url || '').trim();
    };

    return (
        /* md:-mb-14 hands back AppShell's md:pb-20 bottom padding (80px) minus the 24px gap
           the hook leaves, so the board ends exactly one page-gutter above the screen edge
           with nothing to scroll past. Mobile keeps natural page scrolling. */
        <div
            ref={boardRef}
            className={cn(
                'bg-card border border-border rounded-3xl p-3 sm:p-4 flex flex-col shadow-card',
                !isReadOnly && 'md:h-[var(--fill-h)] md:-mb-14',
            )}
        >
            <div className="flex-1 min-h-0 overflow-x-auto scrollbar-thin pb-2">
                <div className="flex gap-3 w-full h-full">
                {visibleColumns.map((col, colIndex) => {
                    const colItems = Array.isArray(campaignInfluencers)
                        ? campaignInfluencers.filter((ci) => columnKeyFor(ci) === col.key)
                        : [];

                    return (
                        <div key={col.key} className="flex-1 min-w-[260px] flex flex-col min-h-0">
                            {/* Column header */}
                            {/* Column header: the stage as a numbered step, like the campaign builder's
                                stepper — the number turns yellow while creators are in this stage. */}
                            <div className="mb-2.5 flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 shadow-sm">
                                <span className={cn(
                                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums',
                                    colItems.length > 0 ? 'bg-brand text-black' : 'bg-secondary text-muted-foreground',
                                )}>
                                    {String(colIndex + 1).padStart(2, '0')}
                                </span>
                                <h4 className="min-w-0 flex-1 truncate text-xs font-semibold">{col.label}</h4>
                                <span className={cn(
                                    'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                                    colItems.length > 0 ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground',
                                )}>
                                    {colItems.length}
                                </span>
                            </div>

                            {/* Column body fills the board's height and scrolls on its own */}
                            <div className={cn(
                                'flex flex-col gap-2 overflow-y-auto scrollbar-thin rounded-2xl p-2',
                                colItems.length > 0 ? 'bg-secondary/50' : 'border-2 border-dashed border-border bg-secondary/20',
                                isReadOnly ? 'h-[560px]' : 'h-[520px] md:h-auto md:flex-1 md:min-h-0',
                            )}>
                                {isLoadingBoard ? (
                                    Array.from({ length: 3 }, (_, i) => <KanbanCardSkeleton key={i} />)
                                ) : colItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                                        <p className="text-xs font-medium text-muted-foreground">No creators here</p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">They appear as they reach this stage</p>
                                    </div>
                                ) : (
                                    colItems.map((ci) => {
                                        const days = getDaysInStatus(ci);
                                        const displayName = String((ci as any).userName ?? (ci as any).influencerName ?? (ci as any).handle ?? 'Unknown');
                                        const displayHandle = String((ci as any).handle ?? (ci as any).influencerHandle ?? '');
                                        const avatarLetter = displayName.charAt(0) || '#';
                                        const PlatformIcon = PLATFORM_GLYPHS[(ci as any).platform] || Globe;
                                        const proofLink = getProofOfWorkLink(ci);
                                        const awaitingFinalPay = isAwaitingFinalPayment(
                                            effectiveStatus(ci.status) as any,
                                            (ci as any).finalPaidAt,
                                            budgetMode,
                                        );
                                        const showProofBox = effectiveStatus(ci.status) === 'proof_review' && !awaitingFinalPay;

                                        return (
                                            <div
                                                key={ci.id}
                                                className="bg-card border border-border rounded-2xl p-3 shadow-sm hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-card transition-all duration-200 group flex flex-col"
                                            >
                                                {/* Avatar + name */}
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <div 
                                                        onClick={() => setQuickViewId(String(ci.influencerId))}
                                                        className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden cursor-pointer ring-2 ring-brand/40 ring-offset-1 ring-offset-card hover:ring-brand transition-all"
                                                    >
                                                        {((ci as any).userAvatarUrl ?? (ci as any).influencerAvatar) ? (
                                                            <ApiImage src={(ci as any).userAvatarUrl ?? (ci as any).influencerAvatar} alt={displayName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            avatarLetter
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p 
                                                            onClick={() => setQuickViewId(String(ci.influencerId))}
                                                            className="text-[13px] font-semibold truncate cursor-pointer underline-offset-2 hover:underline"
                                                        >
                                                            {displayName}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground truncate">{displayHandle}</p>
                                                    </div>
                                                </div>

                                                {/* Social + stats */}
                                                {/* Platform and followers, tier, and how long they have sat in this stage. */}
                                                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                                    <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-semibold tabular-nums text-foreground" title="Followers">
                                                        <PlatformIcon className={cn('h-3 w-3', PLATFORM_TINT[(ci as any).platform] ?? 'text-muted-foreground')} strokeWidth={2.25} />
                                                        {formatFollowers((ci as any).followerCount ?? (ci as any).followersCount ?? 0)}
                                                    </span>
                                                    {(ci as any).tier && (
                                                        <span className="rounded-full border border-border px-2 py-0.5 font-medium capitalize text-foreground/75">
                                                            {String((ci as any).tier)}
                                                        </span>
                                                    )}
                                                    <span className={cn(
                                                        'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
                                                        days > 7 ? 'bg-destructive/10 text-destructive' :
                                                            days > 3 ? 'bg-brand/25 text-foreground' :
                                                                'bg-secondary text-muted-foreground'
                                                    )} title="Days in this stage">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {days}d
                                                    </span>
                                                </div>

                                                {awaitingFinalPay && (
                                                    <div className="mt-2.5 rounded-xl border border-brand/40 bg-brand/10 px-2.5 py-2 text-[10px] text-foreground">
                                                        <p className="font-semibold mb-0.5">Final Payment Pending</p>
                                                        <p className="text-muted-foreground leading-snug">
                                                            Work approved. Pay the final round in the Work Submissions tab to unlock proof of work.
                                                        </p>
                                                    </div>
                                                )}

                                                {showProofBox && (
                                                    <div className="mt-2.5 rounded-xl border border-border bg-secondary/50 px-2.5 py-2 text-[10px] text-foreground">
                                                        <p className="font-semibold mb-1">{proofLink ? 'Review Proof' : 'Proof of Work'}</p>
                                                        {proofLink ? (
                                                            <a
                                                                href={proofLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
                                                            >
                                                                View Proof Link
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground">Waiting for proof link from mobile app.</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Product Shipment Action (Brand Owner) */}
                                                {!isReadOnly && effectiveStatus(ci.status) === 'product_pending' && isProductMode && currentUser?.role === 'brand_owner' && (
                                                    <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                                                        {(() => {
                                                            const isShipped = !!(ci as any).productShippedAt;
                                                            const isSubmittingThis = markProductShipped.isPending && markProductShipped.variables?.appId === ci.id;
                                                            return (
                                                        <button
                                                            onClick={() => {
                                                                if (isShipped) return;
                                                                if (!window.confirm('Are you sure you want to mark this product as shipped? This will notify the creator.')) return;
                                                                markProductShipped.mutate(
                                                                    { campaignId: campaign.id, appId: ci.id },
                                                                    {
                                                                        onSuccess: () => toast.success('Product marked as shipped'),
                                                                        onError: () => toast.error('Failed to update status'),
                                                                    }
                                                                );
                                                            }}
                                                            disabled={isSubmittingThis || isShipped}
                                                            className={cn(
                                                                'w-full flex h-8 items-center justify-center gap-1.5 text-[11px] font-semibold px-3 rounded-full border transition-all duration-200 whitespace-nowrap',
                                                                isShipped
                                                                    ? 'bg-secondary text-muted-foreground border-border cursor-not-allowed'
                                                                    : 'bg-brand/20 text-foreground border-brand hover:bg-brand'
                                                            )}
                                                        >
                                                            <PackageCheck className="w-3.5 h-3.5" />
                                                            {isSubmittingThis ? 'Confirming...' : isShipped ? 'Shipped' : 'Confirm Shipment'}
                                                        </button>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                {/* Message — only when chat unlocked (script/work phase) */}
                                                {!isReadOnly && <div className="mt-2.5 pt-2.5 border-t border-dashed border-border flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                                                    {currentUser?.role === 'brand_owner' ? (
                                                        canChatByInfluencerStatus(effectiveStatus(ci.status) as any) || ((ci as any).chatEnabled && effectiveStatus(ci.status) === 'completed') ? (
                                                            <button
                                                                type="button"
                                                                disabled={startConversation.isPending}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const conv = await startConversation.mutateAsync({
                                                                            campaignInfluencerId: ci.id,
                                                                        });
                                                                        navigate(`/messages/${conv.id}`);
                                                                    } catch {
                                                                        toast.error('Could not open chat.');
                                                                    }
                                                                }}
                                                                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
                                                            >
                                                                <MessageCircle className="w-3 h-3" />
                                                                {(ci as any).chatEnabled
                                                                    ? (canChatByInfluencerStatus(effectiveStatus(ci.status) as any) ? 'Open Chat' : 'View Chat')
                                                                    : 'Start Chat'}
                                                            </button>
                                                        ) : (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-muted-foreground cursor-not-allowed">
                                                                            <MessageCircle className="w-3 h-3" />
                                                                            Message
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{CHAT_LOCKED_TOOLTIP}</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )
                                                    ) : canChatByInfluencerStatus(effectiveStatus(ci.status) as any) ? (
                                                        <Link
                                                            to="/messages"
                                                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                                                        >
                                                            <MessageCircle className="w-3 h-3" />
                                                            Message
                                                        </Link>
                                                    ) : (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-muted-foreground cursor-not-allowed">
                                                                        <MessageCircle className="w-3 h-3" />
                                                                        Message
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{CHAT_LOCKED_TOOLTIP}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>
            {quickViewId && !isReadOnly && (
                <InfluencerQuickView
                    influencerId={quickViewId}
                    onClose={() => setQuickViewId(null)}
                />
            )}
        </div>
    );
}
