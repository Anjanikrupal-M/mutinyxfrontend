import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Globe, MessageCircle, ExternalLink } from 'lucide-react';
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

import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';
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
                'bg-card border border-border rounded-2xl p-3 sm:p-4 flex flex-col',
                !isReadOnly && 'md:h-[var(--fill-h)] md:-mb-14',
            )}
        >
            <div className="flex-1 min-h-0 overflow-x-auto scrollbar-thin pb-2">
                <div className="flex gap-4 w-full h-full">
                {visibleColumns.map((col) => {
                    const colItems = Array.isArray(campaignInfluencers)
                        ? campaignInfluencers.filter((ci) => columnKeyFor(ci) === col.key)
                        : [];

                    return (
                        <div key={col.key} className="flex-1 min-w-[260px] flex flex-col min-h-0">
                            {/* Column header */}
                            <div className="flex items-center justify-between mb-2.5 px-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-semibold tracking-wide">{col.label}</h4>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                                    {colItems.length}
                                </span>
                            </div>

                            {/* Column body fills the board's height and scrolls on its own */}
                            <div className={cn(
                                'flex flex-col gap-2.5 overflow-y-auto scrollbar-thin bg-secondary/40 rounded-xl p-3 border border-border/60',
                                isReadOnly ? 'h-[560px]' : 'h-[520px] md:h-auto md:flex-1 md:min-h-0',
                            )}>
                                {isLoadingBoard ? (
                                    Array.from({ length: 3 }, (_, i) => <KanbanCardSkeleton key={i} />)
                                ) : colItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center flex-1 text-center opacity-60">
                                        <div className="w-10 h-10 rounded-full bg-background border border-border/50 flex items-center justify-center mb-3 shadow-sm">
                                            <span className="text-muted-foreground text-sm font-semibold">0</span>
                                        </div>
                                        <p className="text-[12px] text-muted-foreground font-medium">No creators in this stage</p>
                                    </div>
                                ) : (
                                    colItems.map((ci) => {
                                        const days = getDaysInStatus(ci);
                                        const displayName = String((ci as any).userName ?? (ci as any).influencerName ?? (ci as any).handle ?? 'Unknown');
                                        const displayHandle = String((ci as any).handle ?? (ci as any).influencerHandle ?? '');
                                        const avatarLetter = displayName.charAt(0) || '#';
                                        const PlatformIcon = PLATFORM_ICONS[(ci as any).platform] || Globe;
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
                                                className="bg-card border border-border rounded-2xl p-3.5 hover:border-foreground/30 hover:shadow-md transition-all duration-300 group flex flex-col"
                                            >
                                                {/* Avatar + name */}
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <div 
                                                        onClick={() => setQuickViewId(String(ci.influencerId))}
                                                        className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#fedc03] transition-all"
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
                                                            className="text-xs font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                                                        >
                                                            {displayName}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{displayHandle}</p>
                                                    </div>
                                                </div>

                                                {/* Social + stats */}
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                                                    <span className="flex items-center gap-0.5">
                                                        <PlatformIcon className="w-3 h-3" />
                                                        {formatFollowers((ci as any).followerCount ?? (ci as any).followersCount ?? 0)}
                                                    </span>
                                                    {(ci as any).tier && (
                                                        <span className="flex items-center gap-0.5">
                                                            <span className="uppercase">{String((ci as any).tier).slice(0, 1)}</span>
                                                            {String((ci as any).tier)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Days indicator */}
                                                <div className={cn(
                                                    'text-[10px] font-medium px-1.5 py-0.5 rounded inline-block',
                                                    days > 7 ? 'bg-red-50 text-red-600' :
                                                        days > 3 ? 'bg-amber-50 text-amber-600' :
                                                            'bg-secondary text-muted-foreground'
                                                )}>
                                                    {days}d in stage
                                                </div>

                                                {awaitingFinalPay && (
                                                    <div className="mt-3 rounded-lg border border-orange-200/70 bg-orange-50/70 px-2.5 py-2 text-[10px] text-orange-700">
                                                        <p className="font-semibold mb-0.5">Final Payment Pending</p>
                                                        <p className="text-orange-700/80 leading-snug">
                                                            Work approved. Pay the final round in the Work Submissions tab to unlock proof of work.
                                                        </p>
                                                    </div>
                                                )}

                                                {showProofBox && (
                                                    <div className="mt-3 rounded-lg border border-sky-200/70 bg-sky-50/70 px-2.5 py-2 text-[10px] text-sky-700">
                                                        <p className="font-semibold mb-1">{proofLink ? 'Review Proof' : 'Proof of Work'}</p>
                                                        {proofLink ? (
                                                            <a
                                                                href={proofLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 hover:underline"
                                                            >
                                                                View Proof Link
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-sky-700/80">Waiting for proof link from mobile app.</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Product Shipment Action (Brand Owner) */}
                                                {!isReadOnly && effectiveStatus(ci.status) === 'product_pending' && isProductMode && currentUser?.role === 'brand_owner' && (
                                                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
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
                                                                'w-full flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-md border transition-premium whitespace-nowrap',
                                                                isShipped
                                                                    ? 'bg-fuchsia-100 text-fuchsia-600 border-fuchsia-300 opacity-60 cursor-not-allowed'
                                                                    : 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-100'
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
                                                {!isReadOnly && <div className="mt-3 pt-2.5 border-t border-border/50 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
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
                                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-premium disabled:opacity-60"
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
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 cursor-not-allowed">
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
                                                            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-premium"
                                                        >
                                                            <MessageCircle className="w-3 h-3" />
                                                            Message
                                                        </Link>
                                                    ) : (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 cursor-not-allowed">
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
