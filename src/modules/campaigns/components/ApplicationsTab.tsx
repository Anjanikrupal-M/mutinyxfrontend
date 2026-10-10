import { Fragment, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Check, CheckCircle2, CheckSquare, Square, Users, BarChart3, Globe, Sparkles, RefreshCcw, MessageCircle, Clock, Brain, Star, X, Mail, FileText, Shield, FileCheck, CalendarDays, Pencil, Loader2, Lock, IndianRupee, MoreVertical, UserRoundX, Wallet, Info, Trophy, Heart, Target, Users2 } from 'lucide-react';
import http from '@/core/http';
import { API } from '@/core/api';
import { cn } from '@/lib/utils';
import {
    ApplicationFilters,
    EMPTY_APPLICATION_FILTERS,
    filterApplications,
    type ApplicationFilterValue,
} from './ApplicationFilters';
import { useApplications, useApproveApplication, useRejectApplication, useRateApplication, useCancelReplacementIntent } from '../hooks/useApplications';
import { ReplaceCreatorModal } from './ReplaceCreatorModal';
import { ConvertToPrivateModal } from './ConvertToPrivateModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { useSetDeadline, useBulkSetDeadlines } from '../hooks/useDeadlines';
import { useAcceptNegotiation, useCounterOffer, useNegotiation } from '../hooks/useNegotiation';
import { useInitiatePaymentRound, usePaymentSummary, useVerifyPayment, useCancelPayment, useReconcilePayment } from '../hooks/usePayments';
import type { Campaign, CampaignInfluencer, InfluencerCampaignStatus, PaymentBadgeStatus, SmartSelectMeta, SmartSelectReasonDetails, SmartSelectResult } from '@/shared/types/campaign';
import { canChatByInfluencerStatus, isAwaitingFinalPayment } from '@/shared/types/campaign';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { InfluencerQuickView } from './InfluencerQuickView';
import { useStartConversation } from '@/modules/messages/hooks/useMessages';
import { useAuthStore } from '@/shared/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryKeys';
import { PaymentSummary } from './PaymentSummary';
import { load } from '@cashfreepayments/cashfree-js';
import { ApiImage } from '@/shared/components/ApiImage';
import type { PaymentRoundSummary } from '../hooks/usePayments';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';
import { computeBrandFit, canScoreBrandFit, type BrandFitResult } from '@/shared/utils/brandFit';
import { audienceMatchShare, hasAudienceTarget } from '@/shared/utils/audienceMatch';
import { computeCampaignFit } from '@/shared/utils/campaignFit';
import { CampaignFitRing } from '@/shared/components/CampaignFitRing';
import { deriveTier, isTierEligible, type CampaignTierInput } from '@/shared/utils/tierHelper';

const CHAT_LOCKED_TOOLTIP = 'Chat unlocks when this creator reaches Script or Work stage.';

import { Instagram, Youtube, Twitter, type LucideIcon } from 'lucide-react';
import { PlatformFollowerStats } from '@/shared/components/PlatformFollowerStats';
import { getPlatformFollowerEntries } from '@/shared/utils/platformStats';
import { estimateCreatorReach } from '@/shared/utils/estimatedReach';
import { getIsNoScript } from '@/modules/campaigns/utils/campaignStatus';
import { ApplicationsSkeleton } from './TabSkeletons';
const CREATOR_SIZE_LABELS: Record<string, string> = {
    nano: 'Nano', micro: 'Micro', mid: 'Mid', macro: 'Macro', mega: 'Mega',
};

// Ordering intent (top → bottom):
//   1. Brand-new / needs-action creators the brand must respond to (applied, negotiating, invited)
//   2. Ready to pay (accepted, retryable payment_pending)
//   3. In-progress creators already accepted + paid and moved into the pipeline
//      (product/script/work/proof stages)
//   4. Done / terminal at the very bottom (completed, settled, rejected, withdrawn)
// The `ATTENTION_MAX_RANK` boundary below separates group 1+2 (needs attention)
// from everything past payment, which drives the subtle in-grid divider.
const BRAND_APPLICATION_RANK: Record<string, number> = {
    applied: 1,
    negotiating: 2,
    invited: 3,
    accepted: 4,
    payment_pending: 5,
    product_pending: 6,
    script_pending: 7,
    script_review: 8,
    work_pending: 9,
    work_review: 10,
    proof_review: 11,
    paid: 12,
    completed: 13,
    settled: 14,
    replaced: 15,
    rejected: 16,
    withdrawn: 17,
};

// Cards ranked at or below this boundary still need the brand's attention
// (respond / accept / pay). Anything above it has already moved past payment.
const ATTENTION_MAX_RANK = 5;

// Indian notation, mirroring compactCount in AnalyticsTab — a 51 lakh follower total must
// not push the tile beside it off its line.
/** Line glyphs for the platform bead on an applicant card. */
const CARD_PLATFORM_GLYPHS: Record<string, LucideIcon> = {
    instagram: Instagram,
    youtube: Youtube,
    twitter: Twitter,
    x: Twitter,
};

function formatCompactNumber(value: number): string {
    if (value >= 1e7) return `${Number((value / 1e7).toFixed(2))} Cr`;
    if (value >= 1e5) return `${Number((value / 1e5).toFixed(2))} L`;
    if (value >= 1e3) return `${Number((value / 1e3).toFixed(1))}K`;
    return String(Math.round(value));
}

const BUDGET_ALLOCATED_STATUSES = new Set([
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
]);

const INCOMPLETE_WARNING_STATUSES = new Set([
    'invited',
    'applied',
    'negotiating',
]);

function getIsoTime(value?: string | null): number {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

// Visit locations no longer have a separate name — build a short chip label
// from the free-text description (~35 chars, ellipsis if truncated).
function truncateVisitLocationLabel(description: string, maxLength = 35): string {
    const trimmed = description.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

// Counter-offer entry point for public-campaign applications (status === 'applied').
// Mirrors the counter form inside NegotiationActions; once the brand counters,
// backend flips status → 'negotiating' and the regular NegotiationActions UI takes over.
function ApplicationCounterButton({
    campaignId,
    influencerId,
    prefillAmount,
}: {
    campaignId: string;
    influencerId: string;
    prefillAmount: number | undefined;
}) {
    const [counterOpen, setCounterOpen] = useState(false);
    const [counterValue, setCounterValue] = useState('');
    const [counterNote, setCounterNote] = useState('');
    const counterOffer = useCounterOffer();

    return (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setCounterOpen(true);
                    setCounterValue(prefillAmount ? String(prefillAmount) : '');
                    setCounterNote('');
                }}
                disabled={counterOffer.isPending}
                className="h-8 px-3 text-xs font-semibold rounded-full border border-border transition-colors hover:border-foreground disabled:opacity-60"
            >
                Counter
            </button>
            {counterOpen && (
                <form
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 basis-full w-full mt-1"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const amount = Number(counterValue) || 0;
                        if (amount <= 0) return;

                        const trimmedNote = counterNote.trim();
                        const noteAsNumber = Number(trimmedNote);
                        const noteLooksLikeAmount =
                            trimmedNote.length > 0 &&
                            Number.isFinite(noteAsNumber) &&
                            noteAsNumber > 0;

                        if (noteLooksLikeAmount && prefillAmount && amount === prefillAmount && noteAsNumber !== amount) {
                            toast.error(`New counter amount looks like ₹${noteAsNumber.toLocaleString('en-IN')} in comments. Please enter it in the amount field.`);
                            return;
                        }

                        counterOffer.mutate({
                            campaignId,
                            influencerId,
                            amount,
                            note: trimmedNote || undefined,
                        });
                        setCounterOpen(false);
                        setCounterNote('');
                    }}
                >
                    <input
                        type="number"
                        min={0}
                        value={counterValue}
                        onChange={(e) => setCounterValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-24 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60"
                        placeholder="Amount"
                    />
                    <input
                        type="text"
                        value={counterNote}
                        onChange={(e) => setCounterNote(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 flex-1 min-w-[120px] px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60"
                        placeholder="Additional comments (optional)"
                    />
                    <button
                        type="submit"
                        disabled={counterOffer.isPending}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-[#fedc03] text-black font-medium hover:opacity-90 transition-premium disabled:opacity-60"
                    >
                        Send
                    </button>
                </form>
            )}
        </>
    );
}

function NegotiationActions({
    campaignId,
    influencerId,
    tierAmount,
    totalBudget,
    allocatedBudget,
    onShowMOU,
}: {
    campaignId: string;
    influencerId: string;
    tierAmount: number | undefined;
    totalBudget: number;
    allocatedBudget: number;
    onShowMOU?: (amount: number) => void;
}) {
    const [counterOpen, setCounterOpen] = useState(false);
    const [counterValue, setCounterValue] = useState('');
    const [counterNote, setCounterNote] = useState('');
    const [showFullHistory, setShowFullHistory] = useState(false);
    const { data: negotiationData, isLoading } = useNegotiation(campaignId, influencerId);
    const acceptNegotiation = useAcceptNegotiation();
    const counterOffer = useCounterOffer();

    // Deduplicate consecutive identical entries (e.g. from accidental double-clicks)
    const rawHistory = negotiationData?.history ?? [];
    const history = rawHistory.filter((entry: any, index: number, arr: any[]) => {
        if (index === 0) return true;
        const prev = arr[index - 1];
        return prev.party !== entry.party || Number(prev.amount) !== Number(entry.amount) || (prev.note || null) !== (entry.note || null);
    });

    const latestAmount = (() => {
        if (history.length > 0) {
            const raw = history[history.length - 1].amount;
            const n = typeof raw === 'string' ? parseFloat(raw) : raw;
            return Number.isFinite(n) ? n : tierAmount;
        }
        return tierAmount;
    })();

    // If the history starts with a brand entry but the backend tierRate is higher
    // (creator's original quote, preserved by backend), prepend it so the full
    // offer chain is visible. Skipped when tierRate === first entry amount because
    // that means it was already overwritten (old records) — no data to recover.
    const initialCreatorAmount = Number(negotiationData?.tierRate ?? 0);
    const firstEntryAmount = Number(history[0]?.amount ?? 0);
    const shouldPrependInitialQuote =
        history.length > 0 &&
        history[0].party === 'brand' &&
        Number.isFinite(initialCreatorAmount) &&
        initialCreatorAmount > 0 &&
        initialCreatorAmount !== firstEntryAmount;

    const fullHistory: typeof history = shouldPrependInitialQuote
        ? [
            {
                id: 'initial-quote',
                party: 'influencer' as const,
                amount: initialCreatorAmount,
                note: 'Initial quote',
                createdAt: history[0].createdAt,
            } as any,
            ...history,
        ]
        : history;

    const latestEntries = fullHistory.slice(-3).reverse();
    const allEntries = [...fullHistory].reverse();

    if (isLoading) return null;

    const { canAccept, canCounter } = negotiationData?.permissions ?? { canAccept: false, canCounter: false };

    const wouldExceedBudget = totalBudget > 0 && latestAmount != null && latestAmount > 0
        && (allocatedBudget + latestAmount) > totalBudget;
    const overBy = wouldExceedBudget && latestAmount != null
        ? (allocatedBudget + latestAmount) - totalBudget
        : 0;

    if (!canAccept && !canCounter) {
        return (
            <div className="flex flex-col gap-2">
                {latestEntries.length > 0 && (
                    <div className="space-y-1.5">
                        {(showFullHistory ? allEntries : latestEntries).map((entry: any) => {
                            const amount = Number(entry?.amount ?? 0);
                            const party = String(entry?.party || '').toLowerCase() === 'brand' ? 'Brand' : 'Creator';
                            const note = String(entry?.note || '').trim();
                            return (
                                <div key={String(entry?.id ?? `${entry?.createdAt}-${entry?.amount}`)} className="rounded-lg border border-border bg-secondary/20 px-2 py-1.5">
                                    <p className="text-[10px] font-medium text-foreground/90">
                                        {party}: ₹{Number.isFinite(amount) ? amount.toLocaleString('en-IN') : entry?.amount}
                                    </p>
                                    {note && (
                                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                                            <span className="font-medium text-foreground/80">Additional comments:</span> {note}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                        {history.length > 3 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowFullHistory((v) => !v); }}
                                className="w-full text-[10px] font-medium text-muted-foreground hover:text-foreground py-1 rounded-lg border border-dashed border-border hover:bg-secondary/40 transition-premium"
                            >
                                {showFullHistory ? 'Hide offer history' : `View all ${history.length} offers`}
                            </button>
                        )}
                    </div>
                )}
                {/* Status after the offers it refers to. */}
                <p className="text-xs text-muted-foreground italic">
                    Waiting for influencer to respond
                    {latestAmount ? ` · ₹${latestAmount.toLocaleString('en-IN')}` : ''}…
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {wouldExceedBudget && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-2">
                    <span className="text-[10px] leading-relaxed text-amber-700">
                        Accepting this offer will exceed your campaign budget by ₹{overBy.toLocaleString('en-IN')}.
                    </span>
                </div>
            )}
            <div className="flex items-center gap-2">
                {canAccept && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!latestAmount || latestAmount <= 0) return;
                            if (onShowMOU) {
                                onShowMOU(latestAmount);
                            } else {
                                const confirmMsg = wouldExceedBudget
                                    ? `This will exceed your budget by ₹${overBy.toLocaleString('en-IN')}. Accept ₹${latestAmount.toLocaleString('en-IN')} anyway?`
                                    : `Are you sure you want to accept this counter offer of ₹${latestAmount.toLocaleString('en-IN')}?`;
                                if (!window.confirm(confirmMsg)) return;
                                acceptNegotiation.mutate({ campaignId, influencerId, amount: latestAmount });
                            }
                        }}
                        disabled={(!onShowMOU && acceptNegotiation.isPending) || !latestAmount}
                        className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-premium disabled:opacity-60"
                    >
                        Accept {latestAmount ? `₹${latestAmount.toLocaleString('en-IN')}` : ''}
                    </button>
                )}
                {canCounter && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setCounterOpen(true);
                            setCounterValue(latestAmount ? String(latestAmount) : '');
                            setCounterNote('');
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary transition-premium"
                    >
                        Counter
                    </button>
                )}
            </div>
            {counterOpen && (
                <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const amount = Number(counterValue) || 0;
                        if (amount <= 0) return;

                        const trimmedNote = counterNote.trim();
                        const noteAsNumber = Number(trimmedNote);
                        const noteLooksLikeAmount =
                            trimmedNote.length > 0 &&
                            Number.isFinite(noteAsNumber) &&
                            noteAsNumber > 0;

                        // Common UX mistake: users type new amount into comments while amount input remains unchanged.
                        if (noteLooksLikeAmount && latestAmount && amount === latestAmount && noteAsNumber !== amount) {
                            toast.error(`New counter amount looks like ₹${noteAsNumber.toLocaleString('en-IN')} in comments. Please enter it in the amount field.`);
                            return;
                        }

                        if (import.meta.env.DEV) {
                            console.debug('[NEGOTIATION_DEBUG] Submitting counter offer', {
                                campaignId,
                                influencerId,
                                latestAmount,
                                typedAmount: amount,
                                note: trimmedNote || null,
                            });
                        }

                        counterOffer.mutate({
                            campaignId,
                            influencerId,
                            amount,
                            note: trimmedNote || undefined,
                        });
                        setCounterOpen(false);
                        setCounterNote('');
                    }}
                >
                    <input
                        type="number"
                        min={0}
                        value={counterValue}
                        onChange={(e) => setCounterValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 w-24 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60"
                        placeholder="Amount"
                    />
                    <input
                        type="text"
                        value={counterNote}
                        onChange={(e) => setCounterNote(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 flex-1 min-w-[120px] px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60"
                        placeholder="Additional comments (optional)"
                    />
                    <button
                        type="submit"
                        disabled={counterOffer.isPending}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-[#fedc03] text-black font-medium hover:opacity-90 transition-premium disabled:opacity-60"
                    >
                        Send
                    </button>
                </form>
            )}

            {latestEntries.length > 0 && (
                <div className="space-y-1.5 mt-1">
                    {(showFullHistory ? allEntries : latestEntries).map((entry: any) => {
                        const amount = Number(entry?.amount ?? 0);
                        const party = String(entry?.party || '').toLowerCase() === 'brand' ? 'Brand' : 'Creator';
                        const note = String(entry?.note || '').trim();
                        return (
                            <div key={String(entry?.id ?? `${entry?.createdAt}-${entry?.amount}`)} className="rounded-lg border border-border bg-secondary/20 px-2 py-1.5">
                                <p className="text-[10px] font-medium text-foreground/90">
                                    {party}: ₹{Number.isFinite(amount) ? amount.toLocaleString('en-IN') : entry?.amount}
                                </p>
                                {note && (
                                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                                        <span className="font-medium text-foreground/80">Additional comments:</span> {note}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                    {history.length > 3 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowFullHistory((v) => !v); }}
                            className="w-full text-[10px] font-medium text-muted-foreground hover:text-foreground py-1 rounded-lg border border-dashed border-border hover:bg-secondary/40 transition-premium"
                        >
                            {showFullHistory
                                ? 'Hide offer history'
                                : `View all ${history.length} offers`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}



// ── Per-influencer Deadline Section (inside accepted card) ────────────────────

function DeadlineSection({
    campaignId,
    appId,
    scriptDeadline,
    workDeadline,
    proofOfWorkDeadline,
    showScript = true,
}: {
    campaignId: string;
    appId: string;
    scriptDeadline?: string | null;
    workDeadline?: string | null;
    proofOfWorkDeadline?: string | null;
    /** False for "script not required" campaigns — no script deadline is shown or asked. */
    showScript?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [scriptDate, setScriptDate] = useState(
        showScript && scriptDeadline ? new Date(scriptDeadline).toISOString().split('T')[0] : ''
    );
    const [workDate, setWorkDate] = useState(
        workDeadline ? new Date(workDeadline).toISOString().split('T')[0] : ''
    );
    const [proofDate, setProofDate] = useState(
        proofOfWorkDeadline ? new Date(proofOfWorkDeadline).toISOString().split('T')[0] : ''
    );
    const { mutateAsync: setDeadline, isPending } = useSetDeadline();

    const hasDeadlines = !!((showScript && scriptDeadline) || workDeadline || proofOfWorkDeadline);

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const handleSave = async () => {
        if (!scriptDate && !workDate && !proofDate) {
            toast.error('Set at least one deadline date.');
            return;
        }

        // ── Client-side validation (mirrors campaign creation rules) ──────────
        const today = new Date();
        today.setHours(0, 0, 0, 0); // start of today for comparison

        const script = scriptDate ? new Date(scriptDate) : null;
        const work = workDate ? new Date(workDate) : null;
        const proof = proofDate ? new Date(proofDate) : null;

        // Future-date checks
        if (script && script < today) {
            toast.error('Script deadline must be in the future.');
            return;
        }
        if (work && work < today) {
            toast.error('Work deadline must be in the future.');
            return;
        }
        if (proof && proof < today) {
            toast.error('Proof of work deadline must be in the future.');
            return;
        }

        // Ordering: script must not be after work — same day is allowed (mirrors the
        // DB's campaigns_deadline_order_check, which only rejects a strictly later date).
        if (script && work && script > work) {
            toast.error('Script deadline cannot be after the work deadline.');
            return;
        }

        // Ordering: proof must not be before work — same day is allowed.
        if (work && proof && proof < work) {
            toast.error('Proof of work deadline cannot be before the work deadline.');
            return;
        }

        // Ordering: script must not be after proof — same day is allowed.
        if (script && proof && script > proof) {
            toast.error('Script deadline cannot be after the proof of work deadline.');
            return;
        }

        try {
            await setDeadline({
                campaignId,
                appId,
                ...(showScript && { scriptDeadline: scriptDate ? new Date(scriptDate).toISOString() : null }),
                workDeadline: workDate ? new Date(workDate).toISOString() : null,
                proofOfWorkDeadline: proofDate ? new Date(proofDate).toISOString() : null,
            });
            toast.success('Deadlines saved.');
            setOpen(false);
        } catch (err: any) {
            // Surface backend validation errors granularly
            const apiErr = err?.response?.data?.error;
            const detail = Array.isArray(apiErr?.details)
                ? apiErr.details.map((d: any) => d.message).join(' • ')
                : apiErr?.message;
            toast.error(detail ?? 'Failed to save deadlines.');
        }
    };

    return (
        <div className="mt-2.5 pt-2.5 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            {!open ? (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {hasDeadlines ? (
                            <>
                                {showScript && scriptDeadline && (
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <CalendarDays className="w-3 h-3" />
                                            Script
                                        </span>
                                        <span className="font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded-md border border-border/50">
                                            {formatDate(scriptDeadline)}
                                        </span>
                                    </div>
                                )}
                                {workDeadline && (
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <CalendarDays className="w-3 h-3" />
                                            Work
                                        </span>
                                        <span className="font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded-md border border-border/50">
                                            {formatDate(workDeadline)}
                                        </span>
                                    </div>
                                )}
                                {proofOfWorkDeadline && (
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <CalendarDays className="w-3 h-3" />
                                            Proof
                                        </span>
                                        <span className="font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded-md border border-border/50">
                                            {formatDate(proofOfWorkDeadline)}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="text-[11px] text-muted-foreground italic">No deadlines set</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className={cn(
                            "shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-premium",
                            hasDeadlines
                                ? "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                                : "border-[#fedc03]/50 bg-[#fedc03]/10 text-[#0a0a0a] dark:text-[#fedc03] hover:bg-[#fedc03]/20 shadow-sm"
                        )}
                    >
                        {hasDeadlines
                            ? <><Pencil className="w-3 h-3" />Edit</>
                            : <><CalendarDays className="w-3 h-3" />Set Deadlines</>}
                    </button>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                    <p className="text-[11px] font-semibold text-foreground/70">Set deadlines</p>
                    <div className={cn("grid gap-2", showScript ? "grid-cols-3" : "grid-cols-2")}>
                        {showScript && (
                            <div>
                                <label className="block text-[10px] text-muted-foreground mb-1">Script</label>
                                <input
                                    type="date"
                                    value={scriptDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setScriptDate(e.target.value)}
                                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60 transition-colors"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1">Work</label>
                            <input
                                type="date"
                                value={workDate}
                                min={scriptDate || new Date().toISOString().split('T')[0]}
                                onChange={(e) => setWorkDate(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-muted-foreground mb-1">Proof</label>
                            <input
                                type="date"
                                value={proofDate}
                                min={workDate || new Date().toISOString().split('T')[0]}
                                onChange={(e) => setProofDate(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setScriptDate(showScript && scriptDeadline ? new Date(scriptDeadline).toISOString().split('T')[0] : '');
                                setWorkDate(workDeadline ? new Date(workDeadline).toISOString().split('T')[0] : '');
                                setProofDate(proofOfWorkDeadline ? new Date(proofOfWorkDeadline).toISOString().split('T')[0] : '');
                            }}
                            className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary text-muted-foreground transition-premium"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg bg-[#fedc03] text-black font-bold hover:opacity-90 disabled:opacity-60 transition-premium"
                        >
                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ApplicationsTabProps {
    campaign: Campaign;
    applications?: any[];
    isReadOnly?: boolean;
}

// ── Inline Star Rating Widget ──────────────────────────────────────────────
function RatingWidget({
    campaignId,
    appId,
    existingRating,
    existingReview,
}: {
    campaignId: string;
    appId: string;
    existingRating?: number | null;
    existingReview?: string | null;
}) {
    const rateApplication = useRateApplication();
    const [hovered, setHovered] = useState<number>(0);
    const [selected, setSelected] = useState<number>(existingRating ?? 0);
    const [open, setOpen] = useState(false);
    const [review, setReview] = useState(existingReview ?? '');
    // Local confirmed state so UI doesn't flicker when refetch is in-flight
    const [confirmedRating, setConfirmedRating] = useState<number | null>(existingRating ?? null);
    const [confirmedReview, setConfirmedReview] = useState<string | null>(existingReview ?? null);

    // Sync from server only when NOT in an open editing session
    useEffect(() => {
        if (!open) {
            if (existingRating != null) setConfirmedRating(existingRating);
            if (existingReview != null) setConfirmedReview(existingReview);
            setSelected(existingRating ?? 0);
            setReview(existingReview ?? '');
        }
    }, [existingRating, existingReview, open]);

    const displayRating = hovered || selected;
    const isRated = confirmedRating != null && confirmedRating > 0;

    const handleSubmit = async () => {
        if (selected === 0) {
            toast.error('Please select a star rating before submitting.');
            return;
        }
        try {
            await rateApplication.mutateAsync({
                campaignId,
                appId,
                rating: selected,
                review: review.trim() || undefined,
            });
            // Immediately update local confirmed state — don't wait for refetch
            setConfirmedRating(selected);
            setConfirmedReview(review.trim() || null);
            toast.success(isRated ? 'Rating updated!' : 'Rating submitted!');
            setOpen(false);
        } catch (err: any) {
            const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to submit rating.';
            toast.error(msg);
        }
    };

    const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

    return (
        <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            {!open ? (
                // Compact display row
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        {isRated ? (
                            // Show filled stars for confirmed rating
                            <>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                        key={s}
                                        className={cn(
                                            'w-3.5 h-3.5 transition-colors',
                                            s <= (confirmedRating ?? 0)
                                                ? 'fill-[#fedc03] text-[#fedc03]'
                                                : 'text-border'
                                        )}
                                    />
                                ))}
                                <span className="text-xs text-muted-foreground ml-1">
                                    {ratingLabels[confirmedRating ?? 0]}
                                </span>
                                {confirmedReview && (
                                    <span
                                        className="text-[10px] text-muted-foreground ml-1 truncate max-w-[100px]"
                                        title={confirmedReview}
                                    >
                                        · "{confirmedReview}"
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">Not rated yet</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setSelected(confirmedRating ?? 0);
                            setReview(confirmedReview ?? '');
                            setOpen(true);
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border hover:bg-secondary hover:text-foreground text-muted-foreground transition-premium flex items-center gap-1 shrink-0"
                    >
                        <Star className="w-3 h-3" />
                        {isRated ? 'Edit' : 'Rate'}
                    </button>
                </div>
            ) : (
                // Expanded rating panel
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                    {/* Label */}
                    <p className="text-[11px] font-semibold text-foreground/70 mb-1">
                        {isRated ? 'Update your rating' : 'Rate this influencer'}
                    </p>

                    {/* Stars */}
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <button
                                key={s}
                                type="button"
                                onMouseEnter={() => setHovered(s)}
                                onMouseLeave={() => setHovered(0)}
                                onClick={() => setSelected(s)}
                                className="p-0.5 rounded transition-transform hover:scale-110 active:scale-95"
                                aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
                            >
                                <Star
                                    className={cn(
                                        'w-7 h-7 transition-all duration-150',
                                        s <= displayRating
                                            ? 'fill-[#fedc03] text-[#fedc03] drop-shadow-[0_0_8px_rgba(254,220,3,0.6)]'
                                            : 'text-border hover:text-[#fedc03]/40'
                                    )}
                                />
                            </button>
                        ))}
                        {displayRating > 0 && (
                            <span className="ml-2 text-xs font-semibold text-foreground/80 animate-in fade-in duration-100">
                                {ratingLabels[displayRating]}
                            </span>
                        )}
                    </div>

                    {/* Review textarea */}
                    <textarea
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        placeholder="Add a review comment (optional)..."
                        rows={2}
                        maxLength={500}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-[#fedc03]/60 text-foreground placeholder:text-muted-foreground/50 transition-premium"
                    />
                    <p className="text-[10px] text-muted-foreground text-right -mt-1">{review.length}/500</p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setSelected(confirmedRating ?? 0);
                                setReview(confirmedReview ?? '');
                                setHovered(0);
                            }}
                            className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary text-muted-foreground transition-premium"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={rateApplication.isPending || selected === 0}
                            className="flex-1 py-1.5 text-xs rounded-lg bg-[#fedc03] text-black font-bold hover:bg-[#f0d000] transition-premium disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                            {rateApplication.isPending ? (
                                <RefreshCcw className="w-3 h-3 animate-spin" />
                            ) : (
                                <Star className="w-3 h-3 fill-black/20" />
                            )}
                            {rateApplication.isPending ? 'Saving...' : isRated ? 'Update Rating' : 'Submit Rating'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ApplicationsTab({ campaign, applications, isReadOnly }: ApplicationsTabProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [cashfree, setCashfree] = useState<any>(null);
    const cancelPayment = useCancelPayment();

    useEffect(() => {
        load({ mode: import.meta.env.VITE_CASHFREE_ENV === 'production' ? 'production' : 'sandbox' })
            .then((cf) => setCashfree(cf))
            .catch((err) => console.error("Failed to load Cashfree", err));
    }, []);
    const currentUser = useAuthStore((s) => s.user);
    const startConversation = useStartConversation();
    const { mutateAsync: reconcilePendingPayments, isPending: isReconcilingPayments } = useReconcilePayment();
    const acceptNegotiation = useAcceptNegotiation();
    const lastReconcileSignatureRef = useRef<string>('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    // Applied-stage selection — kept separate from the payment `selected` set so it
    // never leaks into payment totals/checkout. Drives the bulk-accept action.
    const [selectedApplied, setSelectedApplied] = useState<Set<string>>(new Set());
    // Bulk-accept MOU template modal: holds the list of applied creators about to be accepted.
    const [bulkAcceptData, setBulkAcceptData] = useState<Array<{ ci: CampaignInfluencer; inf: any; agreedBudget: number }> | null>(null);
    const [isBulkAccepting, setIsBulkAccepting] = useState(false);

    const [quickViewId, setQuickViewId] = useState<{ influencerId: string; ciId: string } | null>(null);
    const [mouPreviewData, setMouPreviewData] = useState<{ ci: CampaignInfluencer; inf: any; agreedBudget: number; mode: 'approve' | 'accept_negotiation' } | null>(null);
    // Creator replacement — which side of the swap was preset by the 3-dot menu.
    const [replaceModal, setReplaceModal] = useState<{ outgoingCiId?: string; incomingCiId?: string } | null>(null);
    // Public campaigns: replace requires private → popup with a one-click switch. The
    // intent is remembered so the replace modal reopens right after converting.
    const [convertToPrivateIntent, setConvertToPrivateIntent] = useState<{ outgoingCiId?: string; incomingCiId?: string } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isAISelected, setIsAISelected] = useState(false);
    // AI Smart Select: per-influencer reason from backend
    const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
    // Short one-line version of each reason, shown by default; the full reason sits behind "Why?".
    const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
    // "Why?" opens one dialog with the full reason — expanding it inside a card stretched every
    // card in the same grid row.
    const [reasonDialog, setReasonDialog] = useState<{
        name: string; verdict: string; summary: string; reason: string; details?: SmartSelectReasonDetails;
    } | null>(null);
    const [aiDetails, setAiDetails] = useState<Record<string, SmartSelectReasonDetails>>({});
    // AI Smart Select: per-influencer confidence (0–1) — how much of the backend rubric was
    // backed by real data. Below ~0.5 the score is a provisional read, and the card says so.
    const [aiConfidence, setAiConfidence] = useState<Record<string, number>>({});
    // AI Smart Select: creators it recommends (applied → accept, accepted → pay). Highlighted, never auto-ticked.
    const [aiRecommendedIds, setAiRecommendedIds] = useState<Set<string>>(new Set());
    // Budget context of the last Smart Select run (remaining budget after committed spend).
    const [smartSelectMeta, setSmartSelectMeta] = useState<SmartSelectMeta | null>(null);
    // Dynamic strategic advice generated after smart select
    const [aiAdviceText, setAiAdviceText] = useState<string>('');
    const [filters, setFilters] = useState<ApplicationFilterValue>(EMPTY_APPLICATION_FILTERS);
    const debugNegotiationSignatureRef = useRef<string>('');

    // Get influencers related to this campaign via API hooks
    const { data: fetchedInfluencers = [], isLoading: isLoadingApplications } = useApplications(isReadOnly ? '' : campaign.id);
    const campaignInfluencers = isReadOnly ? (applications ?? []) : fetchedInfluencers;
    const { data: paymentSummary, isLoading: isLoadingPaymentSummary } = usePaymentSummary(isReadOnly ? '' : campaign.id);
    const paymentBypassEnabled = paymentSummary?.paymentBypassEnabled === true;

    const budgetMode = campaign.budgetMode || campaign.budget?.mode || 'paid';
    const normalizeStatus = (value: unknown) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'settelled' || raw === 'setelled') return 'settled';
        return raw;
    };
    const normalizePaymentBadgeStatus = (value: unknown): PaymentBadgeStatus => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (!raw || raw === 'null' || raw === 'undefined') return null;
        if (raw === 'payment_pending') return 'payment_pending';
        if (raw === 'cancelled') return 'cancelled';
        if (raw === 'failed') return 'failed';
        if (raw === 'expired') return 'expired';
        if (raw === 'refunded') return 'refunded';
        if (raw === 'reversed') return 'reversed';
        return null;
    };
    const getPaymentBadgeStatus = (ci?: CampaignInfluencer | null): PaymentBadgeStatus =>
        normalizePaymentBadgeStatus((ci as any)?.paymentBadgeStatus ?? (ci as any)?.payment_badge_status);
    const isPaymentActionRequired = (ci?: CampaignInfluencer | null): boolean =>
        Boolean((ci as any)?.paymentActionRequired ?? (ci as any)?.payment_action_required);
    const hasOpenAdvancePaymentRound = (paymentSummary?.paymentRounds ?? []).some((round) => {
        const row = round as Record<string, unknown>;
        const type = String(row.paymentType ?? '').toLowerCase();
        const isOpen = row.isOpen;
        if (type !== 'advance') return false;

        // Trust backend classification first when available.
        if (typeof isOpen === 'boolean') return isOpen;

        // If backend does not provide isOpen, do not force open-state from text alone.
        return false;
    });
    const hasAdvanceEligibleFromSummary = (paymentSummary?.nextAdvanceRound?.count ?? 0) > 0;
    const isProductCampaign = budgetMode === 'product';
    const effectiveStatus = (ci?: CampaignInfluencer | null): InfluencerCampaignStatus => {
        const normalized = normalizeStatus((ci as any)?.effectiveStatus ?? (ci as any)?.effective_status ?? ci?.status);
        // Product-only campaigns skip payment stage in UI flow.
        // Backend may still return "accepted" right after approval; treat it as product_pending.
        if (isProductCampaign && normalized === 'accepted') return 'product_pending';
        return normalized as InfluencerCampaignStatus;
    };
    const campaignTierPricing = campaign.budgetTierPricing || campaign.budget?.tierPricing || [];
    const getTierAmount = (tp: unknown): number => {
        const row = (tp ?? {}) as { amount?: unknown; rate?: unknown };
        const n = Number(row.amount ?? row.rate ?? 0);
        return Number.isFinite(n) ? n : 0;
    };
    const isSelectableForPayment = (ci?: CampaignInfluencer | null) => {
        if (isProductCampaign || paymentBypassEnabled) return false;
        // Earmarked replacement candidates settle via carried-over credit at final
        // payment, not a normal advance — see "Complete replacement" CTA on the card.
        if (ci?.pendingReplacementForCiId) return false;
        const normalized = normalizeStatus(ci?.status);
        return normalized === 'accepted' || isPaymentActionRequired(ci);
    };
    // Applied-stage creators can be selected for a bulk accept (with MOU template).
    const isSelectableForAccept = (ci?: CampaignInfluencer | null) => {
        if (isReadOnly) return false;
        return normalizeStatus(ci?.status) === 'applied';
    };

    // ── Creator replacement ──────────────────────────────────────────────────
    // Replace is offered at work stages, including creators sent back for revision.
    const isReplaceableOutgoing = (ci?: CampaignInfluencer | null) => {
        const s = normalizeStatus(ci?.status);
        return s === 'script_pending' || s === 'script_review' || s === 'work_pending' || s === 'work_review';
    };
    // Ready-to-accept candidates: applicants, negotiators, and invite-accepted
    // creators not yet paid — provided they aren't already a replacement themselves.
    const isReplacementCandidate = (ci?: CampaignInfluencer | null) => {
        // Already earmarked for a specific outgoing creator — not a free-floating candidate.
        if (!ci || ci.replacesCiId || ci.pendingReplacementForCiId) return false;
        const s = normalizeStatus(ci.status);
        if (s === 'applied' || s === 'negotiating') return true;
        return s === 'accepted' && !ci.paidAt;
    };
    const hasReplaceableTargets = useMemo(
        () => campaignInfluencers.some((ci) => isReplaceableOutgoing(ci)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [campaignInfluencers]
    );
    const isPrivateCampaign = (campaign.visibility ?? 'public') === 'private';

    // ── Tier-qualified vs other applicants (public campaigns only) ─────────────
    // Uses the same ≥ minimum tier logic as the backend apply-stage (isTierEligible).
    // Tier-qualified applicants are the default view; a toggle swaps to the "other" bucket.
    const campaignTierInput = useMemo((): CampaignTierInput => {
        const campaignAny = campaign as any;
        return {
            selectedTier: campaignAny.selectedTier || (campaignAny.mixMode ? null : (campaignAny.creatorSize || null)),
            creatorSizes: Array.isArray(campaignAny.creatorSizes) ? campaignAny.creatorSizes : null,
            budgetTierPricing: campaignAny.budgetTierPricing ?? campaignAny.budget?.tierPricing ?? null,
        };
    }, [campaign]);
    const isTierMatched = (creatorSize?: string | null) => {
        const result = isTierEligible(creatorSize, campaignTierInput);
        // 'no_restriction' means campaign has no tier targeting — everyone qualifies.
        return result === 'no_restriction' || result === true;
    };
    const [showInterested, setShowInterested] = useState(false);

    // Public campaigns still SHOW the option — clicking routes through the
    // convert-to-private popup first (feature is private-only).
    const openReplaceFlow = (intent: { outgoingCiId?: string; incomingCiId?: string }) => {
        if (!isPrivateCampaign) {
            setConvertToPrivateIntent(intent);
        } else {
            setReplaceModal(intent);
        }
    };
    const totalBudgetValue = Number(campaign.budget?.total ?? campaign.budgetTotal ?? 0);
    const platformFeePercentValue = Number(campaign.platformFeePercent ?? campaign.budget?.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT);

    const rankedCampaignInfluencers = useMemo(() => {
        const sorted = [...campaignInfluencers];
        sorted.sort((a, b) => {
            const aAny = a as any;
            const bAny = b as any;
            const aRank = BRAND_APPLICATION_RANK[effectiveStatus(a)] ?? 999;
            const bRank = BRAND_APPLICATION_RANK[effectiveStatus(b)] ?? 999;
            if (aRank !== bRank) return aRank - bRank;

            const aUpdated = getIsoTime(aAny.updatedAt ?? aAny.completedAt ?? aAny.finalPaidAt ?? a.connectedAt);
            const bUpdated = getIsoTime(bAny.updatedAt ?? bAny.completedAt ?? bAny.finalPaidAt ?? b.connectedAt);

            if (effectiveStatus(a) === 'payment_pending') {
                // Surface oldest pending captures first.
                return aUpdated - bUpdated;
            }

            const normalizedAStatus = effectiveStatus(a);
            if (normalizedAStatus === 'completed' || normalizedAStatus === 'settled') {
                // Completed/settled: newest completion first.
                return bUpdated - aUpdated;
            }

            // Default tie-break: latest update first.
            return bUpdated - aUpdated;
        });
        return sorted;
    }, [campaignInfluencers, isProductCampaign]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;

        const negotiatingRows = rankedCampaignInfluencers
            .filter((ci) => effectiveStatus(ci) === 'negotiating')
            .map((ci) => ({
                ciId: ci.id,
                influencerId: ci.influencerId,
                name: (ci as any).userName ?? (ci as any).handle ?? 'unknown',
                status: ci.status,
                effectiveStatus: effectiveStatus(ci),
                agreedBudget: ci.agreedBudget,
                quotedPrice: ci.quotedPrice,
                tierRate: ci.tierRate,
                pickedForCard:
                    (ci.quotedPrice ?? ci.tierRate ?? ci.agreedBudget ?? null),
            }));

        const signature = JSON.stringify(negotiatingRows);
        if (signature === debugNegotiationSignatureRef.current) return;
        debugNegotiationSignatureRef.current = signature;

        // Debug trace for stale negotiated amount issues in Applications cards.
        console.debug('[NEGOTIATION_DEBUG] Applications negotiating rows', {
            campaignId: campaign.id,
            rows: negotiatingRows,
        });
    }, [campaign.id, rankedCampaignInfluencers]);

    // Normalize backend campaignInfluencer rows into a lightweight influencer view model (id as string for consistent Set selection)
    const influencers = rankedCampaignInfluencers.map((ci) => {
        const ciAny = ci as any;
        const followers = ciAny.followerCount ?? ciAny.followers ?? ciAny.followersCount ?? (Array.isArray(ciAny.platforms) ? ciAny.platforms.reduce((s: number, p: any) => s + (Number(p.followers) || 0), 0) : 0);
        const rawHandle = ciAny.handle ?? ciAny.influencerHandle ?? '';
        const handle = (rawHandle && rawHandle !== '1') ? rawHandle : '';

        return {
            id: String(ci.influencerId ?? ''),
            ciId: ci.id,
            name: ciAny.userName ?? ciAny.influencerName ?? ciAny.handle ?? 'Unknown',
            handle,
            followers,
            // Raw connected-platforms array so cards can show IG/YT follower counts separately.
            platforms: Array.isArray(ciAny.platforms) ? ciAny.platforms : [],
            // Platform the influencer chose when applying (instagram | youtube | both) — null for invites/legacy.
            appliedPlatform: (ciAny.appliedPlatform as string | null) ?? null,
            // Visit location the influencer picked at apply time (snapshot copy) — null when no
            // choice was needed (no visit requirement, or a single-location campaign).
            selectedVisitLocation: ciAny.selectedVisitLocation ?? null,
            engagement: Number(ciAny.engagementRate ?? 0),
            // Expected reach of one post on the platform(s) this creator works on — measured
            // (IG insights / YT avg views) when available, otherwise a follower-based estimate.
            estReach: estimateCreatorReach(
                Array.isArray(ciAny.platforms) ? ciAny.platforms : [],
                ci.avgReach,
                // The campaign's platform decides what counts: Instagram-only → Instagram reach,
                // YouTube-only → YouTube, 'both' → both. The creator's applied platform is only a
                // fallback for rows whose campaign has no platform on record.
                campaign.platform || (ciAny.appliedPlatform as string | null),
                Number(followers) || 0,
            ),
            // Instagram follower demographics (shares) for the target-audience match.
            audience: ci.audience ?? null,
            // Measured views of one post on the platform(s) this creator works on — summed
            // like reach for a 'both' campaign. Null when nothing is measured: views are never
            // guessed from followers, so a big linked channel can't inflate the average.
            estViews: (() => {
                const target = campaign.platform || (ciAny.appliedPlatform as string | null);
                const platformsToCount = target === 'youtube' ? ['youtube'] : target === 'both' ? ['instagram', 'youtube'] : ['instagram'];
                const measured = platformsToCount
                    .map((p) => Number(ci.avgViews?.[p as 'instagram' | 'youtube']))
                    .filter((v) => Number.isFinite(v) && v > 0);
                return measured.length ? measured.reduce((sum, v) => sum + v, 0) : null;
            })(),
            // A single-platform campaign leaves no ambiguity — every applicant/invitee is
            // relevant on that platform regardless of what else they happen to have connected,
            // so don't let connected-account array order override it. Only a 'both' campaign
            // (with no appliedPlatform on record, e.g. invites) needs the connected-account guess.
            platform: (() => {
                if (campaign.platform && campaign.platform !== 'both') return campaign.platform;
                const connected = (Array.isArray(ciAny.platforms) ? ciAny.platforms : []).filter(
                    (p: any) => p.handle && p.handle.trim() !== ''
                );
                return connected.length > 0 ? connected[0].platform : (ciAny.platform || 'instagram');
            })(),
            // Tier must reflect the platform(s) THIS campaign runs on, not an overall/profile
            // tier — otherwise a creator with a huge YouTube following can show as "Mega" on
            // an Instagram-only campaign right next to their real (tiny) Instagram count.
            // 'both' campaigns take whichever platform is larger, per platform.
            creatorSize: (() => {
                const platformEntries = getPlatformFollowerEntries(Array.isArray(ciAny.platforms) ? ciAny.platforms : []);
                if (platformEntries.length === 0) {
                    // No per-platform breakdown on record (legacy row) — fall back to
                    // whatever tier/total we do have rather than defaulting to nano.
                    return ciAny.tier || deriveTier(followers);
                }
                const igFollowers = platformEntries.find((p) => p.platform === 'instagram')?.followers ?? 0;
                const ytFollowers = platformEntries.find((p) => p.platform === 'youtube')?.followers ?? 0;
                const relevantFollowers = campaign.platform === 'youtube'
                    ? ytFollowers
                    : campaign.platform === 'both'
                        ? Math.max(igFollowers, ytFollowers)
                        : igFollowers;
                return deriveTier(relevantFollowers);
            })(),
            niche: ciAny.niches ?? ciAny.niche ?? [],
            location: ciAny.location ?? ciAny.userLocation ?? null,
            avatar: ciAny.userAvatarUrl ?? ciAny.influencerAvatar ?? null,
            phoneNumber: ciAny.userPhoneNumber ?? ciAny.phoneNumber ?? null,
        };
    });
    // ── Filtering ─────────────────────────────────────────────────────────────
    // Augment each row with the fields the filter panel reads but the card view model does
    // not carry: the effective workflow status and whatever price is known for the creator.
    const filterableInfluencers = useMemo(
        () =>
            influencers.map((inf) => {
                const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
                const rawPrice = ci
                    ? (ci.agreedBudget != null && Number(ci.agreedBudget) > 0
                        ? Number(ci.agreedBudget)
                        : Number(ci.quotedPrice ?? ci.tierRate ?? NaN))
                    : NaN;

                return {
                    ...inf,
                    // Filter on the platform the creator actually applied/quoted with when
                    // known (asked by the app on 'both' campaigns); connected platform otherwise.
                    platform: inf.appliedPlatform || inf.platform,
                    status: ci ? effectiveStatus(ci) : null,
                    price: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
                };
            }),
        [influencers, rankedCampaignInfluencers],
    );

    // Tier-matched applicants are the default view; interested-but-mismatched
    // applicants are only ever reachable via the toggle, and only on public campaigns.
    // Once the brand has acted on someone (accepted, negotiating, paid, etc.) they belong
    // in the default view regardless of tier — the interested bucket is only for raw,
    // not-yet-reviewed organic interest sitting in 'applied'.
    const { matchedInfluencers, interestedInfluencers } = useMemo(() => {
        if (isPrivateCampaign) return { matchedInfluencers: filterableInfluencers, interestedInfluencers: [] as typeof filterableInfluencers };
        const matched: typeof filterableInfluencers = [];
        const interested: typeof filterableInfluencers = [];
        filterableInfluencers.forEach((inf) => {
            const isUnreviewedApplication = inf.status === 'applied';
            (isUnreviewedApplication && !isTierMatched(inf.creatorSize) ? interested : matched).push(inf);
        });
        return { matchedInfluencers: matched, interestedInfluencers: interested };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterableInfluencers, isPrivateCampaign, campaignTierInput]);

    const tierScopedInfluencers = isPrivateCampaign
        ? filterableInfluencers
        : (showInterested ? interestedInfluencers : matchedInfluencers);

    const visibleInfluencers = useMemo(
        () => filterApplications(tierScopedInfluencers, filters),
        [tierScopedInfluencers, filters],
    );

    // Bulk actions operate on what the brand can actually see — filtering to three creators
    // and hitting "select all" must not quietly select twenty.
    const selectableInfluencers = visibleInfluencers.filter((inf) => {
        const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
        return !!ci && isSelectableForPayment(ci);
    });
    // Applied-stage creators — Smart Select analyzes these to recommend whom to accept.
    const appliedInfluencers = visibleInfluencers.filter((inf) => {
        const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
        return !!ci && normalizeStatus(ci.status) === 'applied';
    });
    // Creators in negotiation — Smart Select recommends them too, but they are accepted one
    // at a time from their card (negotiation accept + MOU), never through the bulk selection.
    const negotiatingInfluencers = visibleInfluencers.filter((inf) => {
        const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
        return !!ci && normalizeStatus(ci.status) === 'negotiating';
    });

    // Brand Fit — same client-side scoring as the Influencers/Discover page.
    // Only meaningful when the signed-in brand has a category or location on file.
    const brandFitProfile = { industry: currentUser?.industry, city: currentUser?.city, state: currentUser?.state };
    const canShowBrandFit = canScoreBrandFit(brandFitProfile);

    // Precompute every creator's Brand Fit ONCE per data/profile change (aggregated
    // into a lookup map) instead of recomputing the tokenizing scorer for each card
    // on every render — this tab re-renders frequently (payment polling, selection).
    const brandFitByCiId = useMemo(() => {
        const map = new Map<string, BrandFitResult>();
        if (!canShowBrandFit) return map;
        for (const ci of rankedCampaignInfluencers) {
            const ciAny = ci as any;
            map.set(ci.id, computeBrandFit(brandFitProfile, {
                niches: ciAny.niches ?? ciAny.niche ?? null,
                location: ciAny.location ?? ciAny.userLocation ?? null,
                engagementRate: ciAny.engagementRate ?? null,
            }));
        }
        return map;
        // brandFitProfile is derived from the three user fields listed below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rankedCampaignInfluencers, canShowBrandFit, currentUser?.industry, currentUser?.city, currentUser?.state]);

    // Divider anchor: the ciId of the first card that has moved PAST the
    // needs-attention groups (past payment). Used to drop a subtle full-width
    // separator between "needs action / ready to pay" and "in progress / done".
    const dividerBeforeCiId = (() => {
        let sawAttention = false;
        for (const inf of influencers) {
            const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
            if (!ci) continue;
            const rank = BRAND_APPLICATION_RANK[effectiveStatus(ci)] ?? 999;
            if (rank <= ATTENTION_MAX_RANK) {
                sawAttention = true;
                continue;
            }
            return sawAttention ? inf.ciId : null;
        }
        return null;
    })();


    const approveApplication = useApproveApplication();
    const cancelReplacementIntent = useCancelReplacementIntent();
    const rejectApplication = useRejectApplication();
    const initiatePaymentRound = useInitiatePaymentRound();
    const verifyPayment = useVerifyPayment();

    // Single source of truth for per-influencer amount (application rate or campaign tier pricing)
    // Uses ciId (from inf.ciId) for unambiguous CI lookup — avoids wrong record when two CIs share an influencerId.
    const getAmountForInfluencer = (infId: string): number => {
        const inf = influencers.find((i) => i.id === infId);
        if (!inf) return 0;
        // Prefer ciId lookup (exact match); fall back to influencerId for safety.
        const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId)
            ?? rankedCampaignInfluencers.find((c) => String(c.influencerId) === infId);
        // A not-yet-negotiated row carries agreedBudget = 0, and `??` only skips
        // null/undefined — so chaining it here resolved applied creators to ₹0 and hid
        // their quoted price. Treat a non-positive amount as "not set", which is exactly
        // what the card does when it renders the price (see tierRateRaw below).
        const firstPositive = (...values: Array<number | string | null | undefined>) => {
            for (const value of values) {
                if (value == null) continue;
                const amount = Number(value);
                if (Number.isFinite(amount) && amount > 0) return amount;
            }
            return null;
        };
        const fromApp = ci != null
            ? firstPositive(ci.agreedBudget, ci.quotedPrice, ci.tierRate)
            : null;
        const tierPrice = campaignTierPricing.find((tp) => (tp as { tier?: string }).tier === inf.creatorSize);
        return fromApp ?? getTierAmount(tierPrice) ?? 0;
    };

    const isDeadlineMissing = (ci: any) => {
        if ((campaign as any).deadlineMode === 'individual') {
            return !ci?.scriptDeadline && !ci?.workDeadline;
        }
        return false;
    };

    const toggleSelectApplied = (id: string) => {
        const willSelect = !selectedApplied.has(id);
        setSelectedApplied((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        // Accepting applicants and paying accepted creators are mutually exclusive
        // intents — starting an accept-selection clears any pending payment selection.
        if (willSelect) {
            setSelected(new Set());
            setShowRecommendation(false);
        }
    };

    const toggleSelect = (id: string) => {
        // id is inf.id (influencerId); use ciId from inf for unambiguous CI lookup.
        const inf = influencers.find((i) => i.id === id);
        const ci = inf
            ? (rankedCampaignInfluencers.find((c) => c.id === inf.ciId)
                ?? rankedCampaignInfluencers.find((c) => String(c.influencerId) === id))
            : rankedCampaignInfluencers.find((c) => String(c.influencerId) === id);

        // Applied-stage creators go into the separate accept-selection set.
        if (ci && isSelectableForAccept(ci)) {
            toggleSelectApplied(id);
            return;
        }

        if (!ci || !isSelectableForPayment(ci)) {
            return;
        }

        // Block manual add when deadlines are missing, but always allow deselecting
        // (Smart Select may have picked a creator without deadlines).
        if (isDeadlineMissing(ci) && !selected.has(id)) {
            toast.error('Please assign deadlines before selecting this creator for payment.');
            return;
        }

        // Payment selection is mutually exclusive with accept-selection.
        if (!selected.has(id)) setSelectedApplied(new Set());

        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);

            const nextEstimate = Array.from(next).reduce((sum, infId) => sum + getAmountForInfluencer(infId), 0);
            setShowRecommendation(nextEstimate > totalBudgetValue);
            return next;
        });
    };

    // Drop any selection that the current filters have hidden. Without this a brand could
    // filter down to one creator, hit Pay, and settle others they can no longer see.
    // Also drop any selection whose creator has moved out of that stage — e.g. an applicant
    // ticked for bulk accept then accepted/rejected/countered from its own card. Otherwise
    // the card keeps a tick that no longer belongs to any selection (the payment set is empty).
    useEffect(() => {
        const ciFor = (id: string) => {
            const inf = visibleInfluencers.find((i) => i.id === id);
            return inf ? rankedCampaignInfluencers.find((c) => c.id === inf.ciId) : undefined;
        };
        const prune = (keep: (ci?: CampaignInfluencer) => boolean) => (prev: Set<string>) => {
            const next = new Set(Array.from(prev).filter((id) => keep(ciFor(id))));
            return next.size === prev.size ? prev : next;
        };
        setSelected(prune((ci) => !!ci && isSelectableForPayment(ci)));
        setSelectedApplied(prune((ci) => !!ci && isSelectableForAccept(ci)));
    }, [visibleInfluencers, rankedCampaignInfluencers]);

    const validSelectableInfluencers = useMemo(() => {
        return selectableInfluencers.filter(i => {
            const ci = rankedCampaignInfluencers.find((c) => c.id === i.ciId);
            return !!ci && !isDeadlineMissing(ci);
        });
    }, [selectableInfluencers, rankedCampaignInfluencers, campaign]);

    // Full Smart Select pool: applied and negotiating creators (accept recommendations) +
    // accepted creators (payment selection). Deadlines are not required to
    // analyze — a post-selection nudge reminds the brand to set them.
    const smartSelectCandidates = (() => {
        const seen = new Set<string>();
        return [...appliedInfluencers, ...negotiatingInfluencers, ...selectableInfluencers].filter((i) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });
    })();

    const selectAll = () => {
        // Any existing payment selection (e.g. from Select recommended) clears first; only an
        // empty selection selects everyone. Selecting all over a partial pick couldn't be undone.
        if (selected.size > 0) {
            setSelected(new Set());
            setShowRecommendation(false);
        } else {
            if (validSelectableInfluencers.length < selectableInfluencers.length) {
                toast.info('Some creators were skipped because their deadlines are not set.');
            }
            const allIds = validSelectableInfluencers.map((i) => i.id);
            setSelected(new Set(allIds));
            // Payment selection is mutually exclusive with accept-selection.
            setSelectedApplied(new Set());
            const allEstimate = allIds.reduce((sum, infId) => sum + getAmountForInfluencer(infId), 0);
            if (allEstimate > totalBudgetValue) setShowRecommendation(true);
        }
    };

    // ── Bulk accept (applied-stage) ─────────────────────────────────────────────
    // Opens a multi-creator MOU template so the brand can review, in one place, the
    // agreement that will be sent to every selected applicant before accepting them.
    const openBulkAccept = () => {
        const appliedCIs = rankedCampaignInfluencers.filter(
            (ci) => selectedApplied.has(String(ci.influencerId ?? '')) && normalizeStatus(ci.status) === 'applied',
        );
        if (appliedCIs.length === 0) {
            toast.error('Select at least one applied creator to accept.');
            return;
        }

        const acceptable = appliedCIs.filter((ci) => (ci as any).profileComplete !== false);
        const skipped = appliedCIs.length - acceptable.length;
        if (acceptable.length === 0) {
            toast.error('Selected creators have incomplete profiles and cannot be accepted yet.');
            return;
        }
        if (skipped > 0) {
            toast.info(`${skipped} creator${skipped !== 1 ? 's' : ''} skipped due to incomplete profiles.`);
        }

        const rows = acceptable.map((ci) => {
            const inf =
                influencers.find((i) => i.ciId === ci.id) ??
                influencers.find((i) => i.id === String(ci.influencerId ?? ''));
            return { ci, inf, agreedBudget: getAmountForInfluencer(String(ci.influencerId ?? '')) };
        });
        setBulkAcceptData(rows);
    };

    const confirmBulkAccept = async () => {
        if (!bulkAcceptData || bulkAcceptData.length === 0) return;
        setIsBulkAccepting(true);

        let ok = 0;
        let fail = 0;
        const acceptedInfIds: string[] = [];
        for (const row of bulkAcceptData) {
            try {
                await approveApplication.mutateAsync({ campaignId: campaign.id, appId: row.ci.id });
                ok++;
                acceptedInfIds.push(String(row.ci.influencerId ?? ''));
            } catch {
                fail++;
            }
        }

        setIsBulkAccepting(false);
        setBulkAcceptData(null);
        // Drop the ones we accepted from the applied-selection set.
        setSelectedApplied((prev) => {
            const next = new Set(prev);
            for (const id of acceptedInfIds) next.delete(id);
            return next;
        });

        if (ok > 0) toast.success(`Accepted ${ok} creator${ok !== 1 ? 's' : ''} — MOU${ok !== 1 ? 's' : ''} sent via email.`);
        if (fail > 0) toast.error(`${fail} acceptance${fail !== 1 ? 's' : ''} failed. Please retry.`);
    };

    // Status and price of every application. Smart Select's results are only valid for the
    // applications as they were when it ran — accepting, rejecting, paying or a negotiation
    // moving on changes the candidates and the budget, so the results are then cleared.
    const smartSelectStateKey = rankedCampaignInfluencers
        .map((ci) => `${ci.id}:${normalizeStatus(ci.status)}:${ci.agreedBudget ?? ''}:${ci.tierRate ?? ''}`)
        .sort()
        .join('|');
    const smartSelectRunKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (smartSelectRunKeyRef.current == null || smartSelectRunKeyRef.current === smartSelectStateKey) return;
        smartSelectRunKeyRef.current = null;
        setAiRecommendedIds(new Set());
        setAiReasons({});
        setAiSummaries({});
        setAiDetails({});
        setAiConfidence({});
        setReasonDialog(null);
        setSmartSelectMeta(null);
        toast.info('Applications changed — run Smart Select again for up-to-date recommendations.');
    }, [smartSelectStateKey]);

    const handleSmartSelect = async () => {
        if (isAnalyzing) return;

        if (smartSelectCandidates.length === 0) {
            toast.error('No creators available for Smart Select yet. Wait for applications to come in.');
            return;
        }

        setIsAnalyzing(true);
        // Smart Select recommends; it never touches the brand's own selection.
        setAiRecommendedIds(new Set());
        setAnalyzedIds(new Set());
        setAiReasons({});
        setAiSummaries({});
        setAiDetails({});
        setReasonDialog(null);
        setAiConfidence({});
        setSmartSelectMeta(null);

        // Brief scan animation across the candidates — capped at ~1.2s in total so a long
        // applicant list doesn't make the brand wait on a decoration.
        const animDelay = Math.min(400, 1200 / Math.max(smartSelectCandidates.length, 1));
        for (const inf of smartSelectCandidates) {
            setAnalyzedIds(prev => new Set([...prev, inf.id]));
            await new Promise(resolve => setTimeout(resolve, animDelay));
        }

        try {
            // Only the pool the brand can see is sent. Prices, committed spend and the
            // remaining budget are resolved on the server — the browser is not trusted with them.
            const { data: responseData } = await http.post<{
                success: boolean;
                data: SmartSelectResult[];
                meta?: SmartSelectMeta;
            }>(API.ai.smartSelect, {
                campaignId: campaign.id,
                candidateInfluencerIds: smartSelectCandidates.map((i) => i.id),
            });

            const results = responseData?.data ?? [];
            const reasonMap: Record<string, string> = {};
            const summaryMap: Record<string, string> = {};
            const detailsMap: Record<string, SmartSelectReasonDetails> = {};
            const confidenceMap: Record<string, number> = {};
            const recommended = new Set<string>();
            for (const r of results) {
                if (!r.influencerId) continue;
                const id = String(r.influencerId);
                reasonMap[id] = r.reason ?? '';
                summaryMap[id] = r.summary ?? '';
                if (r.details) detailsMap[id] = r.details;
                if (typeof r.confidence === 'number') confidenceMap[id] = r.confidence;
                if (r.recommended) recommended.add(id);
            }
            setAiReasons(reasonMap);
            setAiSummaries(summaryMap);
            setAiDetails(detailsMap);
            setAiConfidence(confidenceMap);
            setAiRecommendedIds(recommended);
            setSmartSelectMeta(responseData?.meta ?? null);
            smartSelectRunKeyRef.current = smartSelectStateKey;

            if (recommended.size === 0) {
                toast.info('Smart Select found no creator to recommend — each card says why.');
            } else {
                const meta = responseData?.meta;
                const spend = meta && meta.recommendedSpend > 0
                    ? meta.remainingBudget != null
                        ? ` · ₹${meta.recommendedSpend.toLocaleString('en-IN')} of ₹${meta.remainingBudget.toLocaleString('en-IN')} remaining`
                        : ` · ₹${meta.recommendedSpend.toLocaleString('en-IN')} total`
                    : '';
                toast.success(`Smart Select recommends ${recommended.size} of ${results.length} creator${results.length !== 1 ? 's' : ''}${spend}. Review and select the ones you want.`);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'AI selection failed. Try again.';
            toast.error(msg);
        }

        setIsAnalyzing(false);
        setAnalyzedIds(new Set());
        setIsAISelected(true);
    };

    // Recommended creators the bulk selection can take: applied (accept) and accepted (pay).
    // Recommended negotiating creators are left for their card's own Accept button.
    const bulkRecommendedIds = (() => {
        const bulkIdSet = new Set([...appliedInfluencers, ...selectableInfluencers].map((i) => i.id));
        return [...aiRecommendedIds].filter((id) => bulkIdSet.has(id));
    })();
    const recommendedNegotiatingCount = negotiatingInfluencers.filter((i) => aiRecommendedIds.has(i.id)).length;

    // True once every bulk-selectable recommendation is ticked — the button then clears instead.
    const recommendedAllSelected = bulkRecommendedIds.length > 0
        && bulkRecommendedIds.every((id) => selectedApplied.has(id) || selected.has(id));
    const clearSelection = () => {
        setSelectedApplied(new Set());
        setSelected(new Set());
        setShowRecommendation(false);
    };

    // One click to act on Smart Select's recommendations. Applied creators go into the
    // accept-selection, accepted creators into the payment selection — the brand still has
    // to confirm "Accept & Send MOU" or "Pay", and can untick anyone first.
    const selectRecommended = () => {
        const appliedIdSet = new Set(appliedInfluencers.map((i) => i.id));
        const payableIdSet = new Set(selectableInfluencers.map((i) => i.id));
        const nextApplied = new Set<string>();
        const nextPayment = new Set<string>();
        for (const id of aiRecommendedIds) {
            if (appliedIdSet.has(id)) nextApplied.add(id);
            else if (payableIdSet.has(id)) nextPayment.add(id);
        }
        if (nextApplied.size === 0 && nextPayment.size === 0) {
            toast.info('None of the recommended creators are visible with the current filters.');
            return;
        }
        setSelectedApplied(nextApplied);
        setSelected(nextPayment);
        if (recommendedNegotiatingCount > 0) {
            toast.info(`${recommendedNegotiatingCount} recommended creator${recommendedNegotiatingCount !== 1 ? 's are' : ' is'} in negotiation — accept from their card.`);
        }

        const estimate = [...nextApplied, ...nextPayment].reduce((sum, id) => sum + getAmountForInfluencer(id), 0);
        setShowRecommendation(totalBudgetValue > 0 && allocatedBudget + estimate > totalBudgetValue);

        const missingDeadlineCount = Array.from(nextPayment).filter((id) => {
            const inf = influencers.find((i) => i.id === id);
            const ci = inf ? rankedCampaignInfluencers.find((c) => c.id === inf.ciId) : null;
            return !!ci && isDeadlineMissing(ci);
        }).length;
        if (missingDeadlineCount > 0) {
            toast.info(`Tip: set deadlines for ${missingDeadlineCount} selected creator${missingDeadlineCount !== 1 ? 's' : ''} so timelines are clear after payment.`);
        }
    };

    const selectedEstimate = Array.from(selected).reduce((sum, infId) => sum + getAmountForInfluencer(infId), 0);
    // What a bulk accept would commit. Applied creators are in neither
    // BUDGET_ALLOCATED_STATUSES nor the payment `selected` set, so this is additive —
    // it double counts nothing. Shown in the budget bar so the brand can see the cost
    // of an accept BEFORE committing to it, but deliberately kept out of every payment
    // total below: accepting is not paying, and only accepted creators are payable.
    const appliedSelectedEstimate = Array.from(selectedApplied).reduce(
        (sum, infId) => sum + getAmountForInfluencer(infId),
        0,
    );
    const allocatedBudget = rankedCampaignInfluencers.reduce((sum, ci) => {
        // Exclude selected items from allocated so we don't double count if they somehow overlap
        if (selected.has(String(ci.influencerId ?? ''))) return sum;
        if (!BUDGET_ALLOCATED_STATUSES.has(normalizeStatus(ci.status))) return sum;
        const amount =
            (ci.agreedBudget != null ? Number(ci.agreedBudget) : null) ??
            (ci.quotedPrice != null ? Number(ci.quotedPrice) : null) ??
            (ci.tierRate != null ? Number(ci.tierRate) : null) ??
            0;
        return sum + amount;
    }, 0);
    // The audience the budget is buying — computed over exactly the creators the budget
    // figures cover (money already allocated, plus anything ticked for payment or bulk
    // accept), so the numbers below and the rupees above always describe the same roster.
    //
    // Reach is the average one post is expected to reach per creator: measured per-post
    // reach (IG insights) / avg views (YouTube) where the creator has connected them,
    // otherwise a tier-based share of followers. Labelled "Est." for that reason.
    const budgetAudience = useMemo(() => {
        const counted = influencers.filter((inf) => {
            if (selected.has(inf.id) || selectedApplied.has(inf.id)) return true;
            const ci = rankedCampaignInfluencers.find((row) => row.id === inf.ciId);
            return !!ci && BUDGET_ALLOCATED_STATUSES.has(normalizeStatus(ci.status));
        });
        const withReach = counted.filter((inf) => inf.estReach.reach > 0);
        const avgReach = withReach.length
            ? Math.round(withReach.reduce((sum, inf) => sum + inf.estReach.reach, 0) / withReach.length)
            : null;
        const measuredCount = withReach.filter((inf) => inf.estReach.measured).length;
        const withEngagement = counted.filter((inf) => Number(inf.engagement) > 0);
        const avgEngagement = withEngagement.length
            ? withEngagement.reduce((sum, inf) => sum + Number(inf.engagement), 0) / withEngagement.length
            : null;
        const withViews = counted.filter((inf) => inf.estViews != null);
        const avgViews = withViews.length
            ? Math.round(withViews.reduce((sum, inf) => sum + (inf.estViews ?? 0), 0) / withViews.length)
            : null;
        // Roster totals for the forecast card. Views and engagements scale with how many posts
        // each creator delivers; reach stays one post's worth, since repeat posts mostly reach
        // the same followers. Engagements are each creator's reach × their own ER.
        const postsPerCreator = Math.max(1, (campaign.deliverables ?? [])
            .reduce((sum, d) => sum + (d && typeof d === 'object' && d.type ? Math.max(1, Number(d.count) || 1) : 0), 0)
            || (campaign.contentTypes?.length ?? 1));
        const totalReach = withReach.length ? withReach.reduce((sum, inf) => sum + inf.estReach.reach, 0) : null;
        const totalViews = withViews.length ? withViews.reduce((sum, inf) => sum + (inf.estViews ?? 0), 0) * postsPerCreator : null;
        const engaged = withReach.filter((inf) => Number(inf.engagement) > 0);
        const totalEngagements = engaged.length
            ? Math.round(engaged.reduce((sum, inf) => sum + inf.estReach.reach * (Number(inf.engagement) / 100), 0) * postsPerCreator)
            : null;
        // Cost metrics divide each metric by the fees of exactly the creators it was measured
        // on, so partial data coverage can't inflate them.
        const feesOf = (rows: typeof counted) => rows.reduce((sum, inf) => sum + getAmountForInfluencer(inf.id), 0);
        const perUnit = (fees: number, amount: number | null, per = 1) => (amount && fees > 0 ? (fees / amount) * per : null);
        const cpv = perUnit(feesOf(withViews), totalViews);
        const cpm = perUnit(feesOf(withReach), totalReach, 1000);
        const cpe = perUnit(feesOf(engaged), totalEngagements);
        // Brand fit, weighted by reach: "how much of the audience we're buying comes from
        // creators who fit the brand". Only creators with a score and reach take part.
        const scored = withReach
            .map((inf) => ({ reach: inf.estReach.reach, fit: brandFitByCiId.get(inf.ciId) }))
            .filter((row): row is { reach: number; fit: BrandFitResult } => row.fit != null);
        const scoredReach = scored.reduce((sum, row) => sum + row.reach, 0);
        const fitScore = scoredReach > 0 ? Math.round(scored.reduce((sum, row) => sum + row.fit.score * row.reach, 0) / scoredReach) : null;
        const fitReach = scored.filter((row) => row.fit.band === 'excellent' || row.fit.band === 'good').reduce((sum, row) => sum + row.reach, 0);
        // Target-audience match from Meta follower demographics, weighted by reach. Only
        // creators Meta returned demographics for take part; the card says how many.
        const audienceTarget = { targetAgeRanges: campaign.targetAgeRanges, targetGender: campaign.targetGender, targetLocations: campaign.targetLocations };
        const matched = hasAudienceTarget(audienceTarget)
            ? withReach
                .map((inf) => ({ reach: inf.estReach.reach, share: audienceMatchShare(inf.audience, audienceTarget) }))
                .filter((row): row is { reach: number; share: number } => row.share != null)
            : [];
        const matchBaseReach = matched.reduce((sum, row) => sum + row.reach, 0);
        const matchReach = matched.reduce((sum, row) => sum + row.reach * row.share, 0);
        return {
            creators: counted.length, avgReach, measuredCount, avgEngagement, avgViews, viewsCount: withViews.length,
            totalReach, totalViews, totalEngagements, fitScore, fitReach, fitScoredCount: scored.length,
            postsPerCreator, cpv, cpm, cpe, perCreator: counted.length ? feesOf(counted) / counted.length : null,
            matchPct: matchBaseReach > 0 ? Math.round((matchReach / matchBaseReach) * 100) : null,
            matchReach: Math.round(matchReach), matchBaseReach, matchCount: matched.length,
        };
        // getAmountForInfluencer reads influencers + rankedCampaignInfluencers, both listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [influencers, rankedCampaignInfluencers, selected, selectedApplied, brandFitByCiId, campaign.targetAgeRanges, campaign.targetGender, campaign.targetLocations, campaign.deliverables, campaign.contentTypes]);

    const advanceSummary = paymentSummary?.nextAdvanceRound;
    const payableInfluencers = rankedCampaignInfluencers.filter(
        (ci) => normalizeStatus(ci.status) === 'accepted' || isPaymentActionRequired(ci),
    );
    const rawPaymentPendingInfluencers = rankedCampaignInfluencers.filter(
        (ci) => normalizeStatus(ci.status) === 'payment_pending',
    );
    const requiresRetrySelection = (advanceSummary?.count ?? 0) === 0 && payableInfluencers.length > 0;
    const selectedPayableForPreview = rankedCampaignInfluencers.filter(
        (ci) => selected.has(String(ci.influencerId ?? '')) && (normalizeStatus(ci.status) === 'accepted' || isPaymentActionRequired(ci)),
    );
    const previewInfluencerTotal = selectedPayableForPreview.reduce((sum, ci) => {
        const amount =
            (ci.agreedBudget != null ? Number(ci.agreedBudget) : null) ??
            (ci.quotedPrice != null ? Number(ci.quotedPrice) : null) ??
            (ci.tierRate != null ? Number(ci.tierRate) : null) ??
            0;
        return sum + amount;
    }, 0);
    const previewAdvanceInfluencerTotal = previewInfluencerTotal * 0.5;
    const previewPlatformFee = previewAdvanceInfluencerTotal * (platformFeePercentValue / 100);

    // Always calculate advance summary based on current selection
    const displayAdvanceSummary: PaymentRoundSummary = {
        count: selectedPayableForPreview.length,
        influencerTotal: previewAdvanceInfluencerTotal,
        platformFee: previewPlatformFee,
        grandTotal: previewAdvanceInfluencerTotal + previewPlatformFee,
        currency: advanceSummary?.currency || 'INR',
    };
    const hasSelectedPaymentPending = rankedCampaignInfluencers.some(
        (ci) => selected.has(String(ci.influencerId ?? '')) && normalizeStatus(ci.status) === 'payment_pending' && !isPaymentActionRequired(ci),
    );
    const hasAnyPaymentPending = rawPaymentPendingInfluencers.length > 0;
    const hasSelectedPayable = rankedCampaignInfluencers.some(
        (ci) => selected.has(String(ci.influencerId ?? '')) && (normalizeStatus(ci.status) === 'accepted' || isPaymentActionRequired(ci)),
    );
    const selectedAcceptedCount = rankedCampaignInfluencers.filter(
        (ci) => selected.has(String(ci.influencerId ?? '')) && normalizeStatus(ci.status) === 'accepted' && !isPaymentActionRequired(ci),
    ).length;
    const selectedRetryCount = rankedCampaignInfluencers.filter(
        (ci) => selected.has(String(ci.influencerId ?? '')) && isPaymentActionRequired(ci),
    ).length;
    const acceptedPayableCount = payableInfluencers.filter(
        (ci) => normalizeStatus(ci.status) === 'accepted' && !isPaymentActionRequired(ci),
    ).length;
    const retryPayableCount = payableInfluencers.filter((ci) => isPaymentActionRequired(ci)).length;

    const isPaymentOverBudget = totalBudgetValue > 0 && allocatedBudget > totalBudgetValue;
    const paymentOverBy = isPaymentOverBudget ? allocatedBudget - totalBudgetValue : 0;

    // User must explicitly select influencers to pay. Being over budget WARNS but does
    // not block: acceptance already commits the brand (MOU emailed), so a hard block
    // here would strand accepted creators as permanently unpayable — the button used to
    // fall through to a misleading "No accepted influencers to pay" in that state.
    const canPayAdvance = hasSelectedPayable;
    const isProcessingPayment = isCheckoutOpen || initiatePaymentRound.isPending;
    const isCampaignWithdrawn = campaign.status === 'withdrawn';
    const isCampaignClosed = campaign.status === 'closed';
    const isCampaignDisabled = isCampaignWithdrawn || isCampaignClosed;

    // "Advance Payment Completed" = zero accepted influencers remain to pay
    // AND at least one captured advance payment round exists for this campaign.
    const hasCompletedAdvancePayment =
        !hasOpenAdvancePaymentRound &&
        (advanceSummary?.count ?? 0) === 0 &&
        (paymentSummary?.paymentRounds ?? []).some((round) => {
            const row = round as Record<string, unknown>;
            const type = String(row.paymentType ?? '').toLowerCase();
            const status = String(row.status ?? '').toLowerCase();
            return type === 'advance' && status === 'captured';
        });

    // Self-heal stale payment_pending rows (e.g. expired or already-settled rounds)
    // so cards don't stay stuck in pending status.
    useEffect(() => {
        if (isProductCampaign || isCampaignDisabled || isReconcilingPayments || !hasAnyPaymentPending) {
            return;
        }

        const pendingSignature = rawPaymentPendingInfluencers
            .map((ci) => `${ci.id}:${String((ci as any).updatedAt ?? '')}`)
            .sort()
            .join('|');

        if (!pendingSignature || lastReconcileSignatureRef.current === pendingSignature) {
            return;
        }

        lastReconcileSignatureRef.current = pendingSignature;

        void reconcilePendingPayments({ campaignId: campaign.id }).catch(() => {
            // Allow retry on next state change if reconcile fails.
            lastReconcileSignatureRef.current = '';
        });
    }, [
        campaign.id,
        hasAnyPaymentPending,
        isCampaignDisabled,
        isProductCampaign,
        isReconcilingPayments,
        rawPaymentPendingInfluencers,
        reconcilePendingPayments,
    ]);

    const handlePayRound = async (paymentType: 'advance') => {
        if (!canPayAdvance) return;

        const rollbackPendingToAccepted = (ciIds: string[]) => {
            if (ciIds.length === 0) return;

            const targetIds = new Set(ciIds);
            const patchRows = (rows: any[] | undefined) =>
                rows?.map((row) => {
                    const rowId = String(row?.id ?? '');
                    const rowStatus = normalizeStatus(row?.status);
                    if (!targetIds.has(rowId) || rowStatus !== 'payment_pending') return row;
                    return {
                        ...row,
                        status: 'accepted',
                        paymentBadgeStatus: 'cancelled',
                        paymentActionRequired: true,
                    };
                });

            queryClient.setQueryData(
                queryKeys.campaigns.applications(campaign.id),
                (old: any[] | undefined) => patchRows(old),
            );
            queryClient.setQueryData(
                queryKeys.campaigns.statusBoard(campaign.id),
                (old: any[] | undefined) => patchRows(old),
            );
        };

        // If nothing selected, treat as "pay all eligible accepted influencers"
        const allPayable = rankedCampaignInfluencers.filter(
            (ci) => normalizeStatus(ci.status) === 'accepted' || isPaymentActionRequired(ci),
        );

        // Separate selected CIs by status (if any selected)
        const selectedPayable = rankedCampaignInfluencers.filter(
            (ci) => selected.has(String(ci.influencerId ?? '')) && (normalizeStatus(ci.status) === 'accepted' || isPaymentActionRequired(ci)),
        );
        const selectedPending = rankedCampaignInfluencers.filter(
            (ci) => selected.has(String(ci.influencerId ?? '')) && normalizeStatus(ci.status) === 'payment_pending' && !isPaymentActionRequired(ci),
        );

        // If ONLY payment_pending are selected (no accepted), backend can't initiate — explain why
        if (selected.size > 0 && selectedPayable.length === 0 && selectedPending.length > 0) {
            toast.error(
                'These influencers already have a payment in progress. They will revert to "accepted" once the pending payment expires.',
                { duration: 6000 },
            );
            return;
        }

        // Determine which CIs to pay:
        const cisToPay = selectedPayable;

        if (cisToPay.length === 0) {
            toast.error('Please select an accepted influencer to pay.');
            return;
        }

        // Validate all CIs to pay have a quoted/agreed budget
        const missingBudget = cisToPay.filter(
            (ci) => !ci.agreedBudget && !ci.quotedPrice && !ci.tierRate,
        );
        if (missingBudget.length > 0) {
            const names = missingBudget
                .map((ci) => (ci as any).userName || `Influencer ${ci.influencerId}`)
                .join(', ');
            toast.error(`Missing quoted price for: ${names}. Please add their quoted price before payment.`);
            return;
        }

        // Deadlines must be set before money moves — Smart Select allows picking
        // creators without deadlines, so payment is the hard gate.
        const missingDeadlines = cisToPay.filter((ci) => isDeadlineMissing(ci));
        if (missingDeadlines.length > 0) {
            const names = missingDeadlines
                .map((ci) => (ci as any).userName || `Influencer ${ci.influencerId}`)
                .join(', ');
            toast.error(
                `Set script/work deadlines before paying: ${names}. Use "Set Deadlines" on their cards.`,
                { duration: 6000 },
            );
            return;
        }

        try {
            setIsCheckoutOpen(true);
            const ciIds = cisToPay.map((ci) => ci.id);
            const order = await initiatePaymentRound.mutateAsync({
                campaignId: campaign.id,
                paymentType,
                ciIds,
            });
            if (!order.orderId || !order.paymentSessionId) {
                toast.error('Payment order creation failed — missing order ID. Please try again.');
                setIsCheckoutOpen(false);
                return;
            }

            if (!cashfree) {
                toast.error('Payment gateway is unavailable right now.');
                setIsCheckoutOpen(false);
                return;
            }

            cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: "_modal",
            }).then(async (result: any) => {
                console.info('[Cashfree] checkout result', result);
                if (result.error) {
                    setIsCheckoutOpen(false);
                    const msg = result.error.message || 'Payment failed or cancelled.';
                    if (msg !== 'Payment Cancelled' && result.error.type !== 'modal_closed' && result.error.type !== 'window_closed') {
                        toast.error(msg);
                    }
                    // Universal rollback — always revert payment_pending → accepted on any error
                    try {
                        await cancelPayment.mutateAsync({ paymentId: order.paymentId, campaignId: campaign.id });
                        rollbackPendingToAccepted(ciIds);
                    } catch (e) {
                        console.error('Failed to cancel payment round', e);
                        // Even if cancel API fails or is delayed, keep UI from being stuck in pending.
                        rollbackPendingToAccepted(ciIds);
                    }
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
                    ]);
                    return;
                }

                // Some gateway success callbacks may not include paymentDetails.
                // If there is no explicit error, still verify with our server order/payment IDs.
                try {
                    await verifyPayment.mutateAsync({
                        campaignId: campaign.id,
                        orderId: order.orderId,
                        paymentId: order.paymentId,
                    });

                    toast.success(`Payment verified for ${cisToPay.length} influencer(s).`);
                    // Clear the selected state properly so UI hides "1 Selected"
                    setSelected(new Set());
                    setShowRecommendation(false);
                } catch (verifyError) {
                    console.error('Payment verification failed, attempting cancel/rollback', verifyError);
                    try {
                        await cancelPayment.mutateAsync({ paymentId: order.paymentId, campaignId: campaign.id });
                        rollbackPendingToAccepted(ciIds);
                    } catch (cancelError) {
                        console.error('Failed to cancel after verification failure', cancelError);
                        rollbackPendingToAccepted(ciIds);
                    }
                    toast.error('Payment was not captured. You can retry payment now.');
                } finally {
                    setIsCheckoutOpen(false);
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaign.id) }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
                    ]);
                }
            });
        } catch (err) {
            setIsCheckoutOpen(false);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaign.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaign.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaign.id) }),
            ]);
            const apiMsg = (err as { response?: { data?: { message?: string; error?: { message?: string } } } })
                ?.response?.data?.message ||
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message;
            toast.error(apiMsg || 'Unable to start payment. Please try again.');
        }
    };

    const isPayLater = Boolean(campaign.payLaterMode);

    if (!isReadOnly && isLoadingApplications) return <ApplicationsSkeleton withSidebar={!isProductCampaign} />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Main content — influencer cards */}
            <div className={cn(isProductCampaign ? 'lg:col-span-4' : 'lg:col-span-3')}>
                {/* Pay Later notice */}
                {isPayLater && !isReadOnly && (
                    <div className="flex items-start gap-3 mb-5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pay Later mode is active</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                                Advance payment is skipped for this campaign. Accepted influencers move directly to the next stage. Full payment will be released at final payout.
                            </p>
                        </div>
                    </div>
                )}
                {/* Toolbar — shown when there are applied creators (Smart Select accept
                    recommendations) or payment-selectable creators (hidden for read-only;
                    payment selection additionally hidden for pay-later) */}
                {!isReadOnly && (appliedInfluencers.length > 0 || negotiatingInfluencers.length > 0 || (!isPayLater && selectableInfluencers.length > 0)) && (() => {
                    const acceptedCIs = rankedCampaignInfluencers.filter(
                        (ci) => normalizeStatus(ci.status) === 'accepted'
                    );
                    const acceptedWithoutDeadlineCount = acceptedCIs.filter(
                        (ci) => !(ci as any).scriptDeadline && !(ci as any).workDeadline
                    ).length;

                    const appliedIds = appliedInfluencers.map((i) => i.id);
                    const selectedAppliedCount = appliedIds.filter((id) => selectedApplied.has(id)).length;
                    const toggleSelectAllApplied = () => {
                        // Any ticks clear; only an empty selection selects every applicant.
                        if (selectedAppliedCount > 0) {
                            setSelectedApplied(new Set());
                        } else {
                            setSelectedApplied(new Set(appliedIds));
                            // Mutually exclusive with payment selection.
                            setSelected(new Set());
                            setShowRecommendation(false);
                        }
                    };

                    return (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                            <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3 flex-wrap">
                                {appliedInfluencers.length > 0 && (
                                    <button
                                        onClick={toggleSelectAllApplied}
                                        className="flex items-center gap-2 h-9 px-4 rounded-full border border-border bg-card text-xs font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:border-foreground hover:text-foreground"
                                    >
                                        {selectedAppliedCount > 0
                                            ? <CheckSquare className="w-3.5 h-3.5" />
                                            : <Square className="w-3.5 h-3.5" />
                                        }
                                        {selectedAppliedCount > 0 ? `${selectedAppliedCount} applicant${selectedAppliedCount !== 1 ? 's' : ''}` : 'Select Applicants'}
                                    </button>
                                )}

                                {selectedAppliedCount > 0 && (
                                    <button
                                        onClick={openBulkAccept}
                                        disabled={approveApplication.isPending || isBulkAccepting}
                                        className="flex items-center gap-2 h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow-float disabled:opacity-60"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Accept {selectedAppliedCount} & Send MOU
                                    </button>
                                )}

                                {!isPayLater && selectableInfluencers.length > 0 && (
                                    <button
                                        onClick={selectAll}
                                        className="flex items-center gap-2 h-9 px-4 rounded-full border border-border bg-card text-xs font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:border-foreground hover:text-foreground"
                                    >
                                        {selected.size > 0
                                            ? <CheckSquare className="w-3.5 h-3.5" />
                                            : <Square className="w-3.5 h-3.5" />
                                        }
                                        {selected.size > 0 ? `${selected.size} to pay` : 'Select Accepted'}
                                    </button>
                                )}

                                <button
                                    onClick={handleSmartSelect}
                                    disabled={isAnalyzing || smartSelectCandidates.length === 0}
                                    // The page's main action: the app's black pill with a yellow icon that floods on hover.
                                    className={cn(
                                        "flood-btn group flex h-9 items-center gap-2 rounded-full pl-1 pr-4 text-xs font-semibold shadow-sm duration-300",
                                        isAnalyzing
                                            ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                            : "bg-foreground text-background hover:shadow-float"
                                    )}
                                >
                                    <span className="flood-btn-icon grid h-7 w-7 place-items-center rounded-full bg-brand text-black">
                                        {isAnalyzing ? (
                                            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                        )}
                                    </span>
                                    <span className="flood-btn-label">{isAnalyzing ? "AI Analyzing..." : "Smart Select"}</span>
                                </button>

                                {!isAnalyzing && bulkRecommendedIds.length > 0 && (
                                    <button
                                        onClick={recommendedAllSelected ? clearSelection : selectRecommended}
                                        className="flex items-center gap-2 h-9 px-4 rounded-full border border-brand bg-brand/10 text-xs font-semibold transition-colors hover:bg-brand/25"
                                        title={recommendedAllSelected ? 'Untick every selected creator.' : 'Tick the recommended creators. You still confirm Accept or Pay.'}
                                    >
                                        {recommendedAllSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                                        {recommendedAllSelected ? 'Clear selection' : `Select recommended (${bulkRecommendedIds.length})`}
                                    </button>
                                )}

                                {!isAnalyzing && smartSelectMeta && smartSelectMeta.remainingBudget != null && (
                                    <span
                                        className="text-[11px] text-muted-foreground tabular-nums"
                                        title="Campaign budget minus money already committed to creators in payment or later stages"
                                    >
                                        ₹{smartSelectMeta.remainingBudget.toLocaleString('en-IN')} budget left
                                        {smartSelectMeta.committedSpend > 0 && ` after ₹${smartSelectMeta.committedSpend.toLocaleString('en-IN')} committed`}
                                    </span>
                                )}

                                {(campaign as any).deadlineMode === 'individual' && acceptedWithoutDeadlineCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        {acceptedWithoutDeadlineCount} accepted creator{acceptedWithoutDeadlineCount !== 1 ? 's' : ''} missing deadlines
                                    </span>
                                )}
                            </div>
                            {selected.size === 0 && (
                                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                                    {visibleInfluencers.length} influencer{visibleInfluencers.length !== 1 ? 's' : ''}
                                </span>
                            )}


                        </div>
                    );
                })()}

                {/* Smart Select's single best recommendation and why it beats the next best. */}
                {!isAnalyzing && smartSelectMeta?.topPick && (() => {
                    const topPick = smartSelectMeta.topPick;
                    const pick = influencers.find((i) => i.id === topPick.influencerId);
                    if (!pick) return null;
                    return (
                        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-3.5 py-3 animate-in fade-in">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-black"><Trophy className="w-3.5 h-3.5" /></span>
                            <div className="min-w-0 text-xs leading-relaxed text-foreground">
                                <p>
                                    <span className="font-bold">Best pick: {pick.name}</span>
                                    <span className="text-muted-foreground"> — {topPick.summary || topPick.reason.replace(/^Best pick: /, '')}</span>
                                    {topPick.summary && (
                                        <button
                                            type="button"
                                            onClick={() => setReasonDialog({ name: pick.name, verdict: 'Best pick', summary: topPick.summary ?? '', reason: topPick.reason, details: topPick.details })}
                                            className="ml-1.5 font-semibold underline underline-offset-2 text-foreground/80 hover:text-foreground"
                                        >
                                            Why?
                                        </button>
                                    )}
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* Full Smart Select reason for one creator, opened from "Why?". */}
                <Dialog open={!!reasonDialog} onOpenChange={(open) => { if (!open) setReasonDialog(null); }}>
                    <DialogContent className="max-w-md">
                        {reasonDialog && (() => {
                            // The server sends the reason as separate facts; older responses only
                            // have the sentence, shown whole.
                            const details = reasonDialog.details ?? {
                                lead: null,
                                facts: [reasonDialog.reason.replace(/^(Not recommended|Recommended|Best pick): /, '')],
                                notes: [],
                            };
                            return (
                                <>
                                    <DialogHeader>
                                        <DialogTitle className="break-words">{reasonDialog.name}</DialogTitle>
                                        <DialogDescription>
                                            <span className="font-semibold text-foreground">{reasonDialog.verdict}</span>
                                            {reasonDialog.summary && <> — {reasonDialog.summary}</>}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="min-w-0 space-y-3 text-sm">
                                        {details.lead && <p className="text-foreground">{details.lead}</p>}
                                        {details.facts.length > 1 ? (
                                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                                {details.facts.map((fact) => <li key={fact}>{fact}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground">{details.facts[0]}</p>
                                        )}
                                        {details.notes.length > 0 && (
                                            <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                                                <p className="font-semibold text-foreground">Note</p>
                                                <ul className="mt-0.5 space-y-0.5">
                                                    {details.notes.map((n) => <li key={n}>{n}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </DialogContent>
                </Dialog>

                {influencers.length > 0 && (
                    <ApplicationFilters
                        applications={tierScopedInfluencers}
                        value={filters}
                        onChange={setFilters}
                        resultCount={visibleInfluencers.length}
                    />
                )}

                {!isPrivateCampaign && influencers.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setShowInterested((prev) => !prev)}
                            className={cn(
                                "inline-flex h-9 items-center gap-2 px-4 rounded-full text-xs font-semibold transition-all duration-200 shadow-sm cursor-pointer border",
                                showInterested
                                    ? "bg-foreground text-background border-foreground hover:shadow-float"
                                    : interestedInfluencers.length > 0
                                        ? "bg-brand/15 text-foreground border-brand hover:bg-brand/30"
                                        : "bg-card text-foreground/80 border-border hover:border-foreground"
                            )}
                        >
                            <Users className="w-4 h-4" />
                            {showInterested
                                ? `Back to tier-qualified applicants (${matchedInfluencers.length})`
                                : `Other applicants (${interestedInfluencers.length})`}
                        </button>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                                        aria-label="More info"
                                    >
                                        <Info className="w-4 h-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                    {showInterested
                                        ? "Showing creators whose tier falls below your campaign's minimum tier requirement."
                                        : "Creators who applied but their tier falls below the campaign's minimum tier requirement."}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}

                {influencers.length === 0 ? (
                    <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground text-sm shadow-card">
                        No applications or invites yet.
                    </div>
                ) : visibleInfluencers.length === 0 ? (
                    <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-card">
                        <p className="text-sm text-muted-foreground">No creators match these filters.</p>
                        <button
                            type="button"
                            onClick={() => setFilters(EMPTY_APPLICATION_FILTERS)}
                            className="mt-3 inline-flex h-9 items-center gap-1.5 px-4 rounded-full border border-border text-xs font-semibold transition-colors hover:border-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 items-stretch">
                        {visibleInfluencers.map((inf) => {
                            const ci = rankedCampaignInfluencers.find((c) => c.id === inf.ciId);
                            const paymentBadgeStatus = getPaymentBadgeStatus(ci);
                            const workflowStatus: InfluencerCampaignStatus | null = ci ? effectiveStatus(ci) : null;
                            // Work approved but final payment not yet captured → surface a
                            // distinct "Awaiting Final Payment" badge instead of "Proof of Work".
                            const awaitingFinalPayment = isAwaitingFinalPayment(
                                workflowStatus,
                                (ci as any)?.finalPaidAt,
                                budgetMode,
                            );
                            const statusForBadge = (
                                awaitingFinalPayment
                                    ? 'final_payment_pending'
                                    : (paymentBadgeStatus ?? workflowStatus ?? ci?.status ?? null)
                            ) as InfluencerCampaignStatus | PaymentBadgeStatus | null;
                            // Selection now spans two intents: applied-stage bulk accept and
                            // accepted-stage payment. A card is "selected" if it sits in either set.
                            const isAppliedSelected = selectedApplied.has(inf.id);
                            const isSelected = selected.has(inf.id) || isAppliedSelected;
                            const canSelectCard = !!ci && (isSelectableForPayment(ci) || isSelectableForAccept(ci));
                            // Smart Select recommends at two stages: applied/negotiating (accept) and
                            // accepted (pay). Only meaningful while the card can still be selected, or
                            // accepted from its own negotiation actions.
                            const canShowSmartSelect = canSelectCard || workflowStatus === 'negotiating';
                            const isAiRecommended = aiRecommendedIds.has(inf.id) && canShowSmartSelect;
                            const isAnalyzingCard = analyzedIds.has(inf.id);
                            const tierPrice = campaignTierPricing.find((tp) => (tp as { tier?: string }).tier === inf.creatorSize);
                            const tierRateRaw = ci
                                ? (workflowStatus === 'negotiating'
                                    // Hide the stale quoted price during active negotiation —
                                    // NegotiationActions below already shows the current offer amount.
                                    ? null
                                    : (ci.agreedBudget != null && Number(ci.agreedBudget) > 0
                                        ? ci.agreedBudget
                                        : (ci.quotedPrice ?? ci.tierRate ?? null)))
                                : null;
                            const tierAmount = tierRateRaw != null ? Number(tierRateRaw) : getTierAmount(tierPrice);

                            if (import.meta.env.DEV && workflowStatus === 'negotiating') {
                                console.debug('[NEGOTIATION_DEBUG] Card amount resolved', {
                                    campaignId: campaign.id,
                                    influencerId: inf.id,
                                    name: inf.name,
                                    agreedBudget: ci?.agreedBudget,
                                    quotedPrice: ci?.quotedPrice,
                                    tierRate: ci?.tierRate,
                                    selectedRaw: tierRateRaw,
                                    selectedAmount: tierAmount,
                                });
                            }

                            // A clean line glyph in the card's black-and-yellow bead; the coloured tiles in
                            // PLATFORM_ICONS are miniature app icons and look dated at this size.
                            const PlatformIcon = CARD_PLATFORM_GLYPHS[inf.platform] || Globe;
                            const status: InfluencerCampaignStatus | null = workflowStatus;
                            const profileComplete = ci?.profileComplete !== false;
                            const profileIssues = ci?.profileCompletionIssues ?? [];
                            const canRetryPayment = isPaymentActionRequired(ci);

                            const rawAiReason = aiReasons[inf.id] ?? null;
                            // Reasons are generated from data on the server (no LLM), so they are shown as-is.
                            const aiReason = rawAiReason || null;
                            // Below half the rubric backed by real data — flag the read as
                            // provisional rather than letting a thin guess look authoritative.
                            const aiLowConfidence = (aiConfidence[inf.id] ?? 1) < 0.5;

                            // Brand Fit — precomputed once in brandFitByCiId (see above).
                            const brandFit = brandFitByCiId.get(inf.ciId) ?? null;
                            // Campaign Fit: this creator against this campaign, seven signals with a breakdown on hover.
                            const campaignFit = computeCampaignFit({
                                brandFit,
                                audienceMatchPct: (() => {
                                    const target = { targetAgeRanges: campaign.targetAgeRanges, targetGender: campaign.targetGender, targetLocations: campaign.targetLocations };
                                    const share = hasAudienceTarget(target) ? audienceMatchShare(inf.audience, target) : null;
                                    return share == null ? null : share * 100;
                                })(),
                                engagementRate: inf.engagement || null,
                                pastCollaborations: (ci as any)?.pastCollaborations ?? null,
                                rating: (ci as any)?.rating ?? null,
                                price: tierAmount ?? null,
                                followers: inf.followers || null,
                                campaignPlatform: campaign.platform ?? null,
                                creatorPlatform: inf.appliedPlatform ?? inf.platform ?? null,
                            });

                            const cardBody = (
                                <div
                                    key={inf.ciId}
                                    className={cn(
                                        'bg-card border rounded-2xl p-3 h-full transition-all duration-300 group relative overflow-hidden flex flex-col shadow-card hover:shadow-float hover:-translate-y-0.5',
                                        isReadOnly
                                            ? 'cursor-default border-border'
                                            : isSelected
                                                ? 'cursor-pointer border-brand bg-brand/5 ring-2 ring-brand/40'
                                                : isAiRecommended
                                                    // Recommended but not chosen: dashed, so it can't be mistaken for a selection.
                                                    ? cn(canSelectCard ? 'cursor-pointer' : 'cursor-default', 'border-dashed border-brand bg-brand/5')
                                                : isAnalyzingCard
                                                    ? 'cursor-pointer border-brand bg-brand/5'
                                                    : canSelectCard
                                                        ? 'cursor-pointer border-border hover:border-foreground/20'
                                                        : 'cursor-default border-border'
                                    )}
                                    onClick={() => { if (!isReadOnly && canSelectCard) toggleSelect(inf.id); }}
                                >
                                    {/* AI Scanning Line Animation */}
                                    {isAnalyzingCard && !isSelected && (
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-brand animate-scan opacity-60" />
                                    )}

                                    {/* Top: square avatar (left) + details (right) */}
                                    <div className="flex gap-2.5">
                                        <div className="relative w-12 h-12 shrink-0 rounded-full bg-secondary/60 ring-2 ring-brand/50 ring-offset-2 ring-offset-card">
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setQuickViewId({ influencerId: inf.id, ciId: inf.ciId }); }}
                                                className={cn(
                                                    "w-full h-full rounded-full text-background flex items-center justify-center text-xl font-bold transition-transform duration-500 cursor-pointer group-hover:scale-105 overflow-hidden",
                                                    isAnalyzingCard && "animate-pulse"
                                                )}
                                            >
                                                <ApiImage
                                                    src={inf.avatar}
                                                    alt={inf.name}
                                                    className="w-full h-full object-cover"
                                                    fallbackText={(inf.name ?? inf.handle ?? '?').charAt(0)}
                                                    placeholderClassName="bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand"
                                                />
                                            </div>
                                            {/* Select indicator — only on cards that can actually be
                                                selected (applied for bulk accept, or accepted/retry for payment).
                                                A square checkbox, always visible, so it reads as "picked for
                                                the bulk action" rather than an approved/accepted status. */}
                                            {!isReadOnly && canSelectCard && (
                                                <div className={cn(
                                                    'absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all shadow-sm',
                                                    isSelected ? 'bg-brand border-brand' : 'bg-card/90 border-border'
                                                )}>
                                                    {isSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col">
                                            <div className="flex items-start justify-between gap-2 min-w-0">
                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    <h3
                                                        onClick={(e) => { e.stopPropagation(); setQuickViewId({ influencerId: inf.id, ciId: inf.ciId }); }}
                                                        className="font-display font-semibold text-sm tracking-tight leading-snug line-clamp-2 break-words cursor-pointer underline-offset-2 hover:underline"
                                                    >
                                                        {inf.name || inf.handle || 'Unknown'}
                                                    </h3>
                                                    {inf.handle && (
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {inf.handle}
                                                        </p>
                                                    )}
                                                    {statusForBadge && (
                                                        <div className="mt-1">
                                                            <StatusBadge
                                                                status={statusForBadge as any}
                                                                label={awaitingFinalPayment ? 'Awaiting Final Payment' : undefined}
                                                            />
                                                        </div>
                                                    )}
                                                    {inf.phoneNumber && (() => {
                                                        const isPhoneUnlocked = ci ? (!!(ci as any)?.paidAt || (status && canChatByInfluencerStatus(status))) : false;
                                                        return isPhoneUnlocked ? (
                                                            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                                                                <span className="font-medium text-foreground/80">{inf.phoneNumber}</span>
                                                            </p>
                                                        ) : (
                                                            <TooltipProvider delayDuration={120}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span
                                                                            tabIndex={0}
                                                                            aria-label="Phone number unlocks after payment"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="mt-1.5 inline-flex cursor-help items-center gap-1.5 group/lock"
                                                                        >
                                                                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 text-foreground ring-1 ring-brand/50 transition-colors duration-200 group-hover/lock:bg-brand">
                                                                                <Lock className="h-2.5 w-2.5" />
                                                                            </span>
                                                                            <span className="truncate text-[10px] text-muted-foreground">Phone number</span>
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-[11px]">
                                                                        Unlocks after payment
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        );
                                                    })()}
                                                </div>
                                                {/* Right: the Campaign Fit ring (hover for the breakdown), then the actions menu. */}
                                                <div className="flex items-start gap-0.5 shrink-0">
                                                    <CampaignFitRing fit={campaignFit} size={44} />
                                                    <div className="flex items-center">
                                                    {/* Creator replacement 3-dot menu — review stages get "Replace",
                                                        ready-to-accept candidates get "Accept & replace" (only when a
                                                        replaceable target exists). Card click = select, so everything
                                                        here stops propagation. */}
                                                    {!isReadOnly && ci && (isReplaceableOutgoing(ci) || (isReplacementCandidate(ci) && hasReplaceableTargets)) && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    aria-label="More actions"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium"
                                                                >
                                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                                                                {isReplaceableOutgoing(ci) ? (
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            openReplaceFlow({ outgoingCiId: ci.id });
                                                                        }}
                                                                    >
                                                                        <UserRoundX className="w-4 h-4 mr-2" />
                                                                        Replace creator…
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            openReplaceFlow({ incomingCiId: ci.id });
                                                                        }}
                                                                    >
                                                                        <UserRoundX className="w-4 h-4 mr-2" />
                                                                        Accept &amp; replace…
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Creator replacement chips */}
                                            {ci?.replacesCiId && (() => {
                                                const replacedCi = rankedCampaignInfluencers.find((c) => c.id === ci.replacesCiId);
                                                const replacedName = (replacedCi as any)?.userName || replacedCi?.handle || 'a creator';
                                                const carriedAmount = Number(ci.carriedAdvance ?? 0);
                                                return (
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                                            <UserRoundX className="w-2.5 h-2.5" />
                                                            Replaced {replacedName}
                                                        </span>
                                                        {carriedAmount > 0 && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                                                                <Wallet className="w-2.5 h-2.5" />
                                                                Advance carried · ₹{carriedAmount.toLocaleString('en-IN')}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Earmarked (not-yet-completed) replacement intent */}
                                            {ci?.pendingReplacementForCiId && (() => {
                                                const outgoingForPending = rankedCampaignInfluencers.find((c) => c.id === ci.pendingReplacementForCiId);
                                                const outgoingName = (outgoingForPending as any)?.userName || outgoingForPending?.handle || 'a creator';
                                                return (
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-semibold">
                                                            <UserRoundX className="w-2.5 h-2.5" />
                                                            Pending replacement for {outgoingName}
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 mt-2 mb-2 flex-wrap">
                                        <span className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-foreground text-brand" title={inf.platform}>
                                            <PlatformIcon className="w-3 h-3" strokeWidth={2.25} />
                                        </span>
                                        {/* Platform the influencer chose when applying (mobile asks on 'both' campaigns) */}
                                        {inf.appliedPlatform && (
                                            <span
                                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-brand/20 text-foreground capitalize shrink-0"
                                                title="Platform this creator selected when applying"
                                            >
                                                Applied on {inf.appliedPlatform === 'both' ? 'Instagram + YouTube' : inf.appliedPlatform}
                                            </span>
                                        )}
                                        {/* Visit location the influencer picked at apply time — only meaningful when the campaign actually offered a choice */}
                                        {(campaign.visitAtSite?.options?.length ?? 0) > 1 && inf.selectedVisitLocation && (
                                            <span
                                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-brand/20 text-foreground shrink-0"
                                                title={inf.selectedVisitLocation.description}
                                            >
                                                Visiting {truncateVisitLocationLabel(inf.selectedVisitLocation.description)}
                                            </span>
                                        )}
                                        {inf.creatorSize && (
                                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-border text-foreground/70 capitalize shrink-0">
                                                {CREATOR_SIZE_LABELS[inf.creatorSize] || inf.creatorSize}
                                            </span>
                                        )}
                                        {(inf.niche ?? []).slice(0, 2).map((n) => (
                                            <span key={n} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-border text-foreground/70 capitalize shrink-0">{n}</span>
                                        ))}
                                    </div>

                                    {!profileComplete && INCOMPLETE_WARNING_STATUSES.has(status ?? '') && (
                                        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                                            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                                Incomplete profile cannot accept this invite.
                                            </p>
                                            {profileIssues.length > 0 && (
                                                <p className="mt-1 text-[10px] text-amber-700/90 dark:text-amber-200/90">
                                                    Missing: {profileIssues.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    )}


                                    {/* Warning banner */}
                                    {status === 'accepted' && !isProductCampaign && !isPayLater && !paymentBypassEnabled && !isReadOnly && !ci?.pendingReplacementForCiId && (
                                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-orange-400/50 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                                            <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                                                Action Required: Pay Advance Payment
                                            </p>
                                        </div>
                                    )}

                                    {/* Earmarked replacement — no separate advance; settled via the
                                        carried-over credit once the swap completes. */}
                                    {status === 'accepted' && ci?.pendingReplacementForCiId && !isReadOnly && (
                                        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-sky-400/50 bg-sky-50 dark:bg-sky-950/30 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                                            <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                                                No advance needed — settled at final payment
                                            </p>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!window.confirm('Cancel this pending replacement? This creator will become payable normally again.')) return;
                                                        cancelReplacementIntent.mutate(
                                                            { campaignId: campaign.id, appId: ci.id },
                                                            {
                                                                onSuccess: () => toast.success('Replacement intent cancelled'),
                                                                onError: () => toast.error('Failed to cancel replacement intent'),
                                                            }
                                                        );
                                                    }}
                                                    disabled={cancelReplacementIntent.isPending}
                                                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline disabled:opacity-60"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openReplaceFlow({ outgoingCiId: ci.pendingReplacementForCiId!, incomingCiId: ci.id });
                                                    }}
                                                    className="px-2.5 py-1 rounded-md bg-sky-600 text-white text-[10px] font-bold hover:bg-sky-700 transition-premium"
                                                >
                                                    Complete replacement
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Negotiation actions */}
                                    {status === 'applied' && !isReadOnly && (
                                        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!profileComplete) {
                                                        toast.error('Incomplete profile cannot accept this invite.');
                                                        return;
                                                    }
                                                    setMouPreviewData({
                                                        ci,
                                                        inf,
                                                        agreedBudget: tierAmount,
                                                        mode: 'approve',
                                                    });
                                                }}
                                                disabled={approveApplication.isPending || rejectApplication.isPending || !profileComplete}
                                                className="group/accept flex flex-1 min-w-[76px] h-8 items-center justify-center gap-1.5 rounded-full border border-brand bg-brand/20 pl-0.5 pr-2.5 text-xs font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand hover:shadow-card active:translate-y-0 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none"
                                            >
                                                {/* Soft yellow pill (solid black was dominating the card): fills solid yellow on hover, and the tick bead grows. */}
                                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm transition-transform duration-200 group-hover/accept:scale-110"><Check className="h-3 w-3" strokeWidth={3} /></span>
                                                <span className="flex-1 text-center">{profileComplete ? 'Accept' : 'Incomplete'}</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!window.confirm(`Are you sure you want to reject ${inf.name || inf.handle || 'this creator'}?`)) return;
                                                    rejectApplication.mutate(
                                                        { campaignId: campaign.id, appId: ci.id },
                                                        {
                                                            onSuccess: () => toast.success('Application rejected'),
                                                            onError: () => toast.error('Failed to reject application'),
                                                        }
                                                    );
                                                }}
                                                disabled={approveApplication.isPending || rejectApplication.isPending}
                                                className="flex-1 min-w-[76px] h-8 px-2.5 text-xs font-semibold rounded-full border border-destructive/30 bg-card text-destructive transition-all duration-200 hover:-translate-y-0.5 hover:border-destructive hover:bg-destructive/5 hover:shadow-card active:translate-y-0 active:scale-[0.97] disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                            {campaign.budgetMode !== 'product' && ci?.influencerId && (
                                                <ApplicationCounterButton
                                                    campaignId={campaign.id}
                                                    influencerId={ci.influencerId}
                                                    prefillAmount={tierAmount}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Product pending — shipment action is handled in Status Board only */}
                                    {status === 'product_pending' && (
                                        <div className="mb-3 space-y-1.5">
                                            <p className="text-[10px] leading-relaxed text-muted-foreground break-words break-all">
                                                Manage shipment updates from Status Board. Delivery confirmation is done by the creator.
                                            </p>
                                        </div>
                                    )}

                                    {status === 'negotiating' && !isReadOnly && ci.influencerId && (
                                        <div className="mb-3">
                                            <NegotiationActions
                                                campaignId={campaign.id}
                                                influencerId={ci.influencerId}
                                                tierAmount={
                                                    // Pass the best-known rate so latestAmount never resolves to 0.
                                                    // When negotiation history is empty, fall back to ci.tierRate or
                                                    // ci.quotedPrice (influencer's original quote) instead of the
                                                    // getTierAmount(tierPrice) which may be 0 if no tier pricing exists.
                                                    tierAmount && tierAmount > 0
                                                        ? tierAmount
                                                        : (Number(ci.tierRate ?? 0) > 0 ? Number(ci.tierRate) : Number(ci.quotedPrice ?? 0)) || undefined
                                                }
                                                totalBudget={totalBudgetValue}
                                                allocatedBudget={allocatedBudget}
                                                onShowMOU={(amount) => setMouPreviewData({ ci, inf, agreedBudget: amount, mode: 'accept_negotiation' })}
                                            />
                                        </div>
                                    )}

                                    {/* Smart Select reason — every analysed creator gets one: why they
                                        were recommended, or the main reason they were not. */}
                                    {aiReason && canShowSmartSelect && (
                                        <div className={cn(
                                            'mb-3 flex items-start gap-1.5 rounded-xl border px-2.5 py-1.5 animate-in fade-in slide-in-from-top-1',
                                            isAiRecommended
                                                ? 'border-brand/40 bg-brand/10'
                                                : 'border-border bg-secondary/40',
                                        )}>
                                            <Brain className={cn('w-3 h-3 shrink-0 mt-0.5', isAiRecommended ? 'text-foreground' : 'text-muted-foreground')} />
                                            <div className={cn(
                                                'min-w-0 text-[11px] leading-snug',
                                                isAiRecommended ? 'text-foreground' : 'text-muted-foreground',
                                            )}>
                                                <p className="font-bold">
                                                    {isAiRecommended
                                                        ? `${smartSelectMeta?.topPick?.influencerId === inf.id ? 'Best pick' : 'Recommended'}${workflowStatus === 'applied' || workflowStatus === 'negotiating' ? ' to accept' : ' to pay'}`
                                                        : 'Not recommended'}
                                                </p>
                                                <p>
                                                    {aiSummaries[inf.id] || aiReason.replace(/^(Not recommended|Recommended): /, '')}
                                                    {aiSummaries[inf.id] && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReasonDialog({
                                                                    name: inf.name || inf.handle || 'Creator',
                                                                    verdict: isAiRecommended
                                                                        ? `${smartSelectMeta?.topPick?.influencerId === inf.id ? 'Best pick' : 'Recommended'}${workflowStatus === 'applied' || workflowStatus === 'negotiating' ? ' to accept' : ' to pay'}`
                                                                        : 'Not recommended',
                                                                    summary: aiSummaries[inf.id],
                                                                    reason: aiReason,
                                                                    details: aiDetails[inf.id],
                                                                });
                                                            }}
                                                            className="ml-1.5 font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
                                                        >
                                                            Why?
                                                        </button>
                                                    )}
                                                </p>
                                                {aiLowConfidence && (
                                                    <span
                                                        className="ml-1 font-semibold opacity-80"
                                                        title="This creator's profile is missing data (category, engagement or size), so the score is an estimate rather than a firm read."
                                                    >
                                                        · provisional — limited profile data
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}



                                    {/* Deadline section — only for accepted creators when using individual deadline mode */}
                                    {status === 'accepted' && !isReadOnly && ci && (campaign as any).deadlineMode === 'individual' && (
                                        <DeadlineSection
                                            campaignId={campaign.id}
                                            appId={ci.id}
                                            scriptDeadline={(ci as any).scriptDeadline ?? null}
                                            workDeadline={(ci as any).workDeadline ?? null}
                                            proofOfWorkDeadline={(ci as any).proofOfWorkDeadline ?? null}
                                            showScript={!getIsNoScript(campaign)}
                                        />
                                    )}

                                    {/* Rating widget — only for completed/settled */}
                                    {(status === 'completed' || status === 'settled') && !isReadOnly && ci && (
                                        <RatingWidget
                                            campaignId={campaign.id}
                                            appId={ci.id}
                                            existingRating={(ci as any).brandRating ?? null}
                                            existingReview={(ci as any).brandReview ?? null}
                                        />
                                    )}

                                    {/* Actions — styled footer strip like CampaignCard */}
                                    <div className="mt-auto">
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div className="min-w-0 rounded-xl border border-border bg-secondary/40 px-2 py-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <Users className="w-3 h-3" />
                                                    Followers
                                                </div>
                                                <PlatformFollowerStats platforms={inf.platforms} totalFallback={inf.followers} />
                                            </div>
                                            <div className="min-w-0 rounded-xl border border-border bg-secondary/40 px-2 py-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <BarChart3 className="w-3 h-3" />
                                                    Eng. Rate
                                                </div>
                                                <p className="text-[13px] font-bold text-foreground tabular-nums">
                                                    {inf.engagement}%
                                                </p>
                                            </div>
                                            <div className="min-w-0 rounded-xl border border-brand/30 bg-brand/10 px-2 py-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <IndianRupee className="w-3 h-3" />
                                                    Price
                                                </div>
                                                <p className="text-[13px] font-bold text-foreground tabular-nums">
                                                    {!isReadOnly && tierAmount != null && tierAmount > 0
                                                        ? `₹${tierAmount.toLocaleString('en-IN')}`
                                                        : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Buttons if actionable */}
                                    <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => setQuickViewId({ influencerId: inf.id, ciId: inf.ciId })}
                                                className="flex-1 flex h-8 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-xs font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background whitespace-nowrap"
                                            >
                                                <Eye className="w-3 h-3" />
                                                View Profile
                                            </button>
                                        )}
                                        {!isReadOnly && (() => {
                                            const chatUnlocked = ci && status ? canChatByInfluencerStatus(status) : false;
                                            const isBrand = currentUser?.role === 'brand_owner';

                                            if (isBrand && ci) {
                                                const ciAny = ci as any;
                                                const chatEnabledFlag = !!ciAny.chatEnabled;
                                                const writable = !!status && canChatByInfluencerStatus(status);

                                                // Match the Status Board: the chat is available whenever the
                                                // creator's status unlocks it, OR chat was already enabled and the
                                                // campaign has completed (read-only history). The chatEnabled flag
                                                // only affects the button LABEL — it must not gate availability,
                                                // otherwise the button stays stuck disabled even after the creator
                                                // reaches the script/work stage.
                                                const canOpenChat = writable || (chatEnabledFlag && status === 'completed');

                                                if (!canOpenChat) {
                                                    return (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        type="button"
                                                                        disabled
                                                                        className="flex-1 flex h-8 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-xs font-semibold bg-secondary/60 text-muted-foreground cursor-not-allowed whitespace-nowrap"
                                                                    >
                                                                        <MessageCircle className="w-3 h-3" />
                                                                        Message
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="top"
                                                                    className="max-w-[220px] text-[11px] leading-relaxed text-center"
                                                                >
                                                                    {CHAT_LOCKED_TOOLTIP}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    );
                                                }

                                                const chatLabel = chatEnabledFlag
                                                    ? (writable ? 'Open Chat' : 'View Chat')
                                                    : 'Start Chat';

                                                return (
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
                                                                toast.error('Could not open chat. Try again.');
                                                            }
                                                        }}
                                                        className="flex-1 flex h-8 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-xs font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-60 whitespace-nowrap"
                                                    >
                                                        <MessageCircle className="w-3 h-3" />
                                                        {chatLabel}
                                                    </button>
                                                );
                                            }

                                            const messageButton = chatUnlocked ? (
                                                <Link
                                                    to="/messages"
                                                    className="flex-1 flex h-8 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-xs font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background whitespace-nowrap"
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                    Message
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="flex-1 flex h-8 items-center justify-center gap-1.5 px-3 rounded-full border border-border text-xs font-semibold bg-secondary/60 text-muted-foreground cursor-not-allowed whitespace-nowrap"
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                    Message
                                                </button>
                                            );
                                            return chatUnlocked ? messageButton : (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>{messageButton}</TooltipTrigger>
                                                        <TooltipContent
                                                            side="top"
                                                            className="max-w-[220px] text-[11px] leading-relaxed text-center"
                                                        >
                                                            {CHAT_LOCKED_TOOLTIP}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );

                            return (
                                <Fragment key={inf.ciId}>
                                    {inf.ciId === dividerBeforeCiId && (
                                        <div className="col-span-full flex items-center gap-3 pt-3 pb-1" aria-hidden="true">
                                            <div className="h-px flex-1 bg-border" />
                                            <span className="rounded-full bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                                                Accepted &amp; in progress
                                            </span>
                                            <div className="h-px flex-1 bg-border" />
                                        </div>
                                    )}
                                    {cardBody}
                                </Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pricing sidebar — always shown except product-only campaigns */}
            {!isReadOnly && !isProductCampaign && <div className="space-y-4">
                {/* Never scrolls or sticks: a sticky card taller than the viewport would hide the
                    Pay button below the fold, so it sits in the column at full height. */}
                <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 p-4 sm:p-5 flex flex-col shadow-card">
                    <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />

                    {/* Progress bar — fills based on selected estimate against total */}
                    {(() => {
                        const total = totalBudgetValue;
                        const hasAppliedSelection = selectedApplied.size > 0;
                        const hasSelection = selected.size > 0 || hasAppliedSelection;
                        // Money already committed, plus whatever is selected for payment.
                        const committedBudget = allocatedBudget + selectedEstimate;
                        // Plus what a pending bulk-accept would add on top.
                        const dynamicBudget = committedBudget + appliedSelectedEstimate;
                        const isExceeded = dynamicBudget > total;
                        const usedPct = total > 0 ? (dynamicBudget / total) * 100 : 0;
                        const displayPct = Math.min(usedPct, 100);
                        // Committed vs pending-accept split, so the bar shows which part
                        // of the fill is real spend and which is only a proposal.
                        const rawCommittedPct = total > 0 ? Math.min((committedBudget / total) * 100, 100) : 0;
                        // On huge budgets a real spend can be a sub-pixel share (e.g. ₹32k of
                        // ₹3.4Cr = 0.09%), which reads as "the bar never moves". Clamp any
                        // non-zero fill to a small visible sliver.
                        const committedPct = committedBudget > 0 ? Math.max(rawCommittedPct, 2) : 0;
                        const rawPendingPct = Math.max(0, displayPct - rawCommittedPct);
                        const pendingPct = dynamicBudget - committedBudget > 0
                            ? Math.min(Math.max(rawPendingPct, 1.5), 100 - committedPct)
                            : 0;
                        const remainingBudget = Math.max(0, total - dynamicBudget);
                        // "0%" while money is committed is misleading — show decimals below 1%.
                        const usedPctLabel = usedPct > 0 && usedPct < 1 ? usedPct.toFixed(2) : usedPct.toFixed(0);

                        return (
                            <div className="relative space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="flex items-center gap-2.5 font-display text-base font-semibold tracking-tight">
                                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-black"><Wallet className="h-4 w-4" /></span>
                                        Budget
                                    </h3>
                                    <span className={cn(
                                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                        isExceeded ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                                    )}>
                                        {isExceeded ? 'Over budget' : 'On track'}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-[11px] font-medium text-muted-foreground">{hasSelection ? 'Spent + selected' : 'Spent so far'}</p>
                                    <p className="mt-0.5 font-display text-[28px] font-semibold tracking-tight tabular-nums leading-tight">
                                        ₹{dynamicBudget.toLocaleString('en-IN')}
                                        <span className="ml-1.5 text-sm font-medium text-muted-foreground">/ ₹{total.toLocaleString('en-IN')}</span>
                                    </p>
                                </div>

                                {/* Donut — solid = committed/payable, translucent = pending accept,
                                    grey track = what is left; fully red once over budget. */}
                                {(() => {
                                    const size = 104;
                                    const stroke = 12;
                                    const r = (size - stroke) / 2;
                                    const c = 2 * Math.PI * r;
                                    const committedLen = ((isExceeded ? 100 : committedPct) / 100) * c;
                                    const pendingLen = isExceeded ? 0 : (pendingPct / 100) * c;
                                    return (
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0" style={{ width: size, height: size }}>
                                                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                                                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
                                                    {committedLen > 0 && (
                                                        <circle
                                                            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
                                                            strokeDasharray={`${committedLen} ${c}`}
                                                            className={cn('transition-[stroke-dasharray] duration-500', isExceeded ? 'stroke-rose-500' : 'stroke-brand')}
                                                        />
                                                    )}
                                                    {pendingLen > 0 && (
                                                        <circle
                                                            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
                                                            strokeDasharray={`${pendingLen} ${c}`}
                                                            strokeDashoffset={-committedLen}
                                                            className="stroke-brand/45 transition-[stroke-dasharray] duration-500"
                                                        />
                                                    )}
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className={cn('font-display text-lg font-semibold tabular-nums leading-none', isExceeded && 'text-rose-700 dark:text-rose-400')}>{usedPctLabel}%</span>
                                                    <span className="mt-1 text-[10px] text-muted-foreground">used</span>
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-2.5">
                                                <div className="flex items-start gap-2">
                                                    <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', isExceeded ? 'bg-rose-500' : 'bg-brand')} />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] text-muted-foreground">Used</p>
                                                        <p className="text-base font-semibold tabular-nums">₹{dynamicBudget.toLocaleString('en-IN')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', isExceeded ? 'bg-rose-500/30' : 'bg-secondary ring-1 ring-border')} />
                                                    <div className="min-w-0">
                                                        <p className={cn('text-[11px]', isExceeded ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground')}>{isExceeded ? 'Over by' : 'Left'}</p>
                                                        <p className={cn('text-base font-semibold tabular-nums', isExceeded && 'text-rose-700 dark:text-rose-400')}>
                                                            ₹{(isExceeded ? dynamicBudget - total : remainingBudget).toLocaleString('en-IN')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* What the committed spend is buying — 2×2 metrics, each with its cost
                                    underneath, then the audience match. Same roster as the rupees above. */}
                                {budgetAudience.creators > 0 && (() => {
                                    const a = budgetAudience;
                                    const er = a.totalReach && a.totalEngagements != null ? (a.totalEngagements / a.totalReach) * 100 : null;
                                    const rupees = (value: number) => `₹${value >= 100 ? Math.round(value).toLocaleString('en-IN') : value.toFixed(value >= 10 ? 1 : 2)}`;
                                    const cells = [
                                        { label: 'Views', value: a.totalViews == null ? null : formatCompactNumber(a.totalViews), cost: a.cpv, unit: 'per view', short: '/view', partial: a.viewsCount < a.creators,
                                            title: `Measured for ${a.viewsCount} of ${a.creators} creators; views are never guessed from followers` },
                                        { label: 'Reach', value: a.totalReach == null ? null : formatCompactNumber(a.totalReach), cost: a.cpm, unit: 'per 1K reach', short: ' CPM', partial: a.measuredCount < a.creators,
                                            title: `${a.measuredCount} of ${a.creators} measured from insights, rest estimated from followers` },
                                        { label: 'Engagements', value: a.totalEngagements == null ? null : formatCompactNumber(a.totalEngagements), cost: a.cpe, unit: 'per engagement', short: '/eng', partial: false,
                                            title: "Each creator's reach × their engagement rate" },
                                        { label: 'Eng. rate', value: er == null ? null : `${er.toFixed(1)}%`, cost: a.perCreator, unit: 'per creator', short: '/creator', partial: false,
                                            title: 'Engagements ÷ reach' },
                                    ];
                                    const isMatch = a.matchPct != null;
                                    const fitPct = isMatch ? a.matchPct : a.fitScore;
                                    const ringR = 15;
                                    const ringC = 2 * Math.PI * ringR;
                                    return (
                                        <div className="space-y-2 border-t border-dashed border-foreground/15 pt-3">
                                            <p
                                                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                                title={`Across ${a.creators} creator${a.creators === 1 ? '' : 's'} · ${a.postsPerCreator} post${a.postsPerCreator === 1 ? '' : 's'} each. Each cost uses the fees of the creators that metric covers.`}
                                            >
                                                Estimated <Info className="h-3 w-3" />
                                            </p>
                                            <dl className="grid grid-cols-2 gap-1.5">
                                                {cells.map((cell) => (
                                                    <div key={cell.label} className="min-w-0 rounded-xl border border-border bg-card px-2.5 py-2" title={cell.cost == null ? cell.title : `${cell.title} · ${rupees(cell.cost)} ${cell.unit}`}>
                                                        <dt className="truncate text-[10px] leading-tight text-muted-foreground">{cell.label}{cell.partial && '*'}</dt>
                                                        <dd className="flex min-w-0 items-baseline gap-1 leading-tight">
                                                            <span className="text-sm font-semibold tabular-nums">{cell.value ?? '—'}</span>
                                                            {cell.cost != null && <span className="truncate text-[10px] tabular-nums text-muted-foreground">{rupees(cell.cost)}{cell.short}</span>}
                                                        </dd>
                                                    </div>
                                                ))}
                                            </dl>
                                            {fitPct != null && (
                                                <div
                                                    className="flex items-center gap-2.5"
                                                    title={isMatch
                                                        ? `Share of followers inside your target age, gender and cities (Meta demographics), weighted by reach. Based on ${a.matchCount} of ${a.creators} creators. Estimate.`
                                                        : 'No creator audience demographics yet — Brand Fit (niche, location, engagement) weighted by reach.'}
                                                >
                                                    <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
                                                        <circle cx="18" cy="18" r={ringR} fill="none" strokeWidth="5" className="stroke-secondary" />
                                                        <circle cx="18" cy="18" r={ringR} fill="none" strokeWidth="5" strokeDasharray={`${(fitPct / 100) * ringC} ${ringC}`} className="stroke-emerald-500" />
                                                    </svg>
                                                    <div className="min-w-0 leading-tight">
                                                        <p className="text-sm font-semibold tabular-nums">{fitPct}% <span className="text-xs font-medium text-muted-foreground">{isMatch ? 'audience match' : 'brand fit'}</span></p>
                                                        <p className="truncate text-[11px] text-muted-foreground">
                                                            {isMatch
                                                                ? `~${formatCompactNumber(a.matchReach)} of ${formatCompactNumber(a.matchBaseReach)} reach`
                                                                : a.totalReach ? `~${formatCompactNumber(a.fitReach)} of ${formatCompactNumber(a.totalReach)} reach` : `${a.fitScoredCount} creators scored`}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Recommendation Box — dynamic, AI-generated advice */}
                                {showRecommendation && !isAnalyzing && (
                                    <div className="mt-6 p-4 rounded-xl bg-[#fedc03]/10 border border-[#fedc03]/30 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-4 h-4 text-[#d9bc00]" />
                                            <span className="text-xs font-bold text-[#d9bc00] uppercase tracking-wider">AI Insight</span>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-muted-foreground mb-3">
                                            {aiAdviceText || 'Your selection goes slightly over budget. Increase your budget or trim the selection to proceed.'}
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => {
                                                    setShowRecommendation(false);
                                                    // ?step=3 = Budget step in CampaignBuilderPage
                                                    navigate(`/campaigns/${campaign.id}/edit?step=3&action=increase_budget`);
                                                }}
                                                className="w-full py-2 bg-foreground text-background text-xs font-bold rounded-lg hover:opacity-90 transition-all text-center"
                                            >
                                                Increase Budget
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Trim selection back within budget, keeping best-efficiency ones
                                                    const totalBudget = totalBudgetValue;
                                                    let current = 0;
                                                    const trimmed = new Set<string>();

                                                    // Sort selected by price asc (cheapest first) to fit max count within budget
                                                    const sortedSelected = Array.from(selected)
                                                        .map(id => ({ id, price: getAmountForInfluencer(id) }))
                                                        .sort((a, b) => a.price - b.price);

                                                    for (const item of sortedSelected) {
                                                        if (current + item.price <= totalBudget) {
                                                            trimmed.add(item.id);
                                                            current += item.price;
                                                        }
                                                    }
                                                    setSelected(trimmed.size > 0 ? trimmed : new Set([sortedSelected[0]?.id].filter(Boolean)));
                                                    setShowRecommendation(false);
                                                }}
                                                className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground hover:font-semibold transition-all"
                                            >
                                                Continue within budget
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Payment Summary + CTA */}
                    <div className="mt-5 pt-5 border-t border-border flex flex-col gap-3">
                        {paymentBypassEnabled ? (
                            <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
                                <p className="font-semibold mb-0.5">Payment bypass active</p>
                                <p className="text-emerald-700/80 dark:text-emerald-400/70">Advance and final payment collection are skipped for this environment.</p>
                            </div>
                        ) : isPayLater ? (
                            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                                <p className="font-semibold mb-0.5">Pay Later mode active</p>
                                <p className="text-amber-700/80 dark:text-amber-400/70">Advance payment is skipped. Full payout will be released at final settlement.</p>
                            </div>
                        ) : isLoadingPaymentSummary || !displayAdvanceSummary ? (
                            <div className="text-xs text-muted-foreground">Loading payment summary...</div>
                        ) : (
                            <>
                                <PaymentSummary title="Next Advance Round (50%)" summary={displayAdvanceSummary} />

                                {/* Over-budget is a warning, not a block — see canPayAdvance */}
                                {isPaymentOverBudget && !hasCompletedAdvancePayment && !isCampaignDisabled && (
                                    <div className="rounded-xl border border-orange-400/40 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 text-xs text-orange-700 dark:text-orange-400">
                                        <p className="font-semibold mb-0.5">Over planned budget by ₹{paymentOverBy.toLocaleString('en-IN')}</p>
                                        <p className="text-orange-700/80 dark:text-orange-400/70">
                                            Committed spend exceeds this campaign's ₹{totalBudgetValue.toLocaleString('en-IN')} budget. You can still pay accepted creators, or raise the budget in campaign settings.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => void handlePayRound('advance')}
                                    disabled={!canPayAdvance || isProcessingPayment || hasCompletedAdvancePayment || isCampaignDisabled}
                                    className={cn(
                                        'w-full py-3 text-sm font-semibold rounded-xl transition-all disabled:cursor-not-allowed',
                                        isCampaignDisabled
                                            ? 'bg-secondary text-muted-foreground border border-border'
                                            : hasCompletedAdvancePayment
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                : canPayAdvance
                                                    ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20'
                                                    : 'bg-secondary text-muted-foreground border border-border'
                                    )}
                                >
                                    {isCampaignWithdrawn
                                        ? 'Campaign Withdrawn'
                                        : isCampaignClosed
                                            ? 'Campaign Closed'
                                            : isProcessingPayment
                                                ? 'Opening Cashfree...'
                                                : isReconcilingPayments
                                                    ? 'Syncing payment status...'
                                                    : hasCompletedAdvancePayment
                                                        ? '✓ All advance payments done'
                                                        : payableInfluencers.length > 0 && !hasSelectedPayable
                                                            ? 'Select influencer to Pay'
                                                            : canPayAdvance
                                                                ? `${selectedAcceptedCount > 0 ? 'Pay Advance' : selectedRetryCount > 0 ? 'Pay Again' : 'Pay Selected'} (${selected.size} selected)`
                                                                : hasAnyPaymentPending
                                                                    ? 'Payment in progress'
                                                                    : 'No accepted influencers to pay'}
                                </button>
                            </>
                        )}

                        {!isCampaignDisabled && hasCompletedAdvancePayment ? (
                            <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                All eligible advance payouts are settled.
                            </p>
                        ) : (
                            <p className="text-[11px] text-muted-foreground text-center">
                                {isCampaignDisabled ? 'Payments are frozen for this campaign.' : 'Payment status updates after webhook capture.'}
                            </p>
                        )}
                    </div>
                </div>
            </div>}
            {/* MOU Preview Modal — rendered via portal so fixed positioning is always viewport-relative */}
            {mouPreviewData && (() => {
                const { ci, inf, agreedBudget, mode } = mouPreviewData;
                const platformFee = agreedBudget * (platformFeePercentValue / 100);
                const netPayout = agreedBudget - platformFee;
                const isPayLater = Boolean(campaign.payLaterMode);
                const firstPayment = netPayout * 0.5;
                const finalPayment = isPayLater ? netPayout : netPayout * 0.5;
                const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                const isMOUPending = mode === 'approve' ? approveApplication.isPending : acceptNegotiation.isPending;

                return createPortal(
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setMouPreviewData(null)}
                    >
                        <div
                            className="relative bg-card border border-border rounded-2xl shadow-[0_0_50px_rgba(254,220,3,0.15)] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header Accent Line */}
                            <div className="h-1.5 w-full bg-[#fedc03]" />

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-2 rounded-lg bg-[#fedc03]/10 text-[#0a0a0a] shrink-0">
                                        <FileCheck className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm sm:text-base font-bold font-display text-foreground">Collaboration MOU Preview</h3>
                                        <p className="text-xs text-muted-foreground hidden sm:block">Review and lock terms before campaign acceptance</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMouPreviewData(null)}
                                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-premium shrink-0 ml-2"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Scrollable MOU Document Content */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 scrollbar-thin">
                                <div className="border border-border/80 rounded-xl p-3 sm:p-5 bg-secondary/15 text-sm space-y-4">
                                    <div className="text-center border-b border-border pb-3">
                                        <h4 className="text-sm sm:text-base font-bold font-display text-foreground uppercase tracking-wide">Campaign Collaboration Memorandum of Understanding</h4>
                                        <p className="text-[11px] text-muted-foreground mt-1">MutinyX Creator Network · Date: {today}</p>
                                    </div>

                                    {/* Parties Section */}
                                    <div>
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">1. Parties & Representatives</h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="p-3 sm:p-3.5 rounded-xl bg-card border border-border/60">
                                                <p className="text-[10px] text-[#0a0a0a] font-bold uppercase tracking-wider mb-1">Brand (First Party)</p>
                                                <p className="font-bold text-sm text-foreground">{(campaign as any).brandName || 'Brand Partner'}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Platform Host / Sponsor</p>
                                            </div>
                                            <div className="p-3 sm:p-3.5 rounded-xl bg-card border border-border/60">
                                                <p className="text-[10px] text-[#0a0a0a] font-bold uppercase tracking-wider mb-1">Creator (Second Party)</p>
                                                <p className="font-bold text-sm text-foreground">{inf.name || 'Influencer Partner'}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{inf.handle ? `@${inf.handle.replace(/^@/, '')}` : 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Campaign Deliverables */}
                                    <div>
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">2. Campaign Deliverables & Timelines</h5>
                                        <div className="p-3 sm:p-3.5 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Campaign Name</span>
                                                <span className="font-semibold text-foreground text-right min-w-0 break-words">{campaign.name}</span>
                                            </div>
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Publishing Platform</span>
                                                <span className="font-semibold text-foreground capitalize text-right">{inf.platform || campaign.platform || 'Instagram'}</span>
                                            </div>
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Application Deadline</span>
                                                <span className="font-semibold text-foreground text-right">{campaign.applicationDeadline ? new Date(campaign.applicationDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                            </div>
                                            {!getIsNoScript(campaign) && (
                                                <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                    <span className="text-muted-foreground shrink-0">Script Deadline</span>
                                                    <span className="font-semibold text-foreground text-right">{campaign.scriptDeadline ? new Date(campaign.scriptDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Work Submission Deadline</span>
                                                <span className="font-semibold text-foreground text-right">{campaign.workDeadline ? new Date(campaign.workDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-3 py-1">
                                                <span className="text-muted-foreground shrink-0">Agreed Deliverables</span>
                                                <span className="font-semibold text-foreground text-right min-w-0 break-words">
                                                    {campaign.deliverables && campaign.deliverables.length > 0
                                                        ? campaign.deliverables.map((d: any) => `${d.count}x ${String(d.type || '').replace(/_/g, ' ')}`).join(', ')
                                                        : 'As defined in MutinyX creative brief'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div>
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">3. Financial Terms & Platform Split</h5>
                                        <div className="p-3 sm:p-3.5 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Gross Creator Budget</span>
                                                <span className="font-semibold text-foreground tabular-nums">₹{agreedBudget.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between gap-3 py-1 border-b border-border/40">
                                                <span className="text-muted-foreground shrink-0">Platform Fee ({platformFeePercentValue}%)</span>
                                                <span className="font-semibold text-muted-foreground tabular-nums">-₹{platformFee.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between gap-3 py-1 font-bold text-sm text-foreground">
                                                <span>Net Creator Payout</span>
                                                <span className="text-[#0a0a0a] tabular-nums">₹{netPayout.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Milestone & Payment Schedule */}
                                    <div>
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">4. Payment Milestones</h5>
                                        <div className="bg-[#fedc03]/5 border border-[#fedc03]/20 rounded-xl p-3 sm:p-4 space-y-3">
                                            <div className="flex justify-between items-start gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground">Milestone 1: Advance Payout (50%)</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">Funded into escrow on Campaign approval</p>
                                                </div>
                                                <span className="font-bold text-foreground tabular-nums shrink-0">
                                                    {isPayLater ? '₹0.00' : `₹${firstPayment.toLocaleString('en-IN')}`}
                                                </span>
                                            </div>
                                            <div className="h-px bg-border/40" />
                                            <div className="flex justify-between items-start gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground">Milestone 2: Final Payout (50%)</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">Released upon final deliverable approval</p>
                                                </div>
                                                <span className="font-bold text-foreground tabular-nums shrink-0">
                                                    ₹{finalPayment.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FTC disclosure & compliance */}
                                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4 flex gap-3">
                                        <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1 min-w-0">
                                            <h6 className="text-xs font-bold text-amber-700 dark:text-amber-400">FTC Compliance & Disclosure Guidelines</h6>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                The Creator must strictly follow FTC guidelines by including clear and visible disclosures (e.g. #ad, #sponsored, or the platform's paid partnership tag) in all campaign assets. Brand retains usage rights for a period of {campaign.usageRights || '30 days'} from content publish.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Digital Signatures representation */}
                                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase">Signed By Brand</p>
                                            <p className="text-xs font-semibold font-display italic text-[#0a0a0a] opacity-80">✓ Verified digitally</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase">Signed By Creator</p>
                                            <p className="text-xs font-semibold font-display italic text-[#0a0a0a] opacity-80">✓ Verified digitally</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-secondary/10 flex items-center justify-between shrink-0 gap-3">
                                <button
                                    onClick={() => setMouPreviewData(null)}
                                    className="px-3 sm:px-4 py-2.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold transition-premium"
                                >
                                    Cancel & Close
                                </button>
                                <button
                                    disabled={isMOUPending}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (mode === 'approve') {
                                            approveApplication.mutate(
                                                { campaignId: campaign.id, appId: ci.id },
                                                {
                                                    onSuccess: () => {
                                                        toast.success('Creator accepted and MOU sent via email!');
                                                        setMouPreviewData(null);
                                                    },
                                                    onError: (err: any) => {
                                                        const msg = err?.response?.data?.message || 'Failed to accept creator & generate MOU';
                                                        toast.error(msg);
                                                    }
                                                }
                                            );
                                        } else {
                                            acceptNegotiation.mutate(
                                                { campaignId: campaign.id, influencerId: ci.influencerId!, amount: agreedBudget },
                                                {
                                                    onSuccess: () => {
                                                        toast.success('Offer accepted and MOU sent via email!');
                                                        setMouPreviewData(null);
                                                    },
                                                    onError: (err: any) => {
                                                        const msg = err?.response?.data?.message || 'Failed to accept negotiation offer';
                                                        toast.error(msg);
                                                    }
                                                }
                                            );
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#fedc03] text-black text-xs font-bold hover:shadow-[0_0_20px_rgba(254,220,3,0.3)] transition-all duration-300 disabled:opacity-60"
                                >
                                    {isMOUPending ? (
                                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Mail className="w-3.5 h-3.5" />
                                    )}
                                    {isMOUPending ? 'Generating MOU...' : 'Confirm & Send MOU'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* Bulk Accept — multi-creator MOU template preview */}
            {bulkAcceptData && bulkAcceptData.length > 0 && (() => {
                const isPayLater = Boolean(campaign.payLaterMode);
                const rows = bulkAcceptData.map(({ ci, inf, agreedBudget }) => {
                    const platformFee = agreedBudget * (platformFeePercentValue / 100);
                    const netPayout = agreedBudget - platformFee;
                    const firstPayment = isPayLater ? 0 : netPayout * 0.5;
                    const finalPayment = isPayLater ? netPayout : netPayout * 0.5;
                    return { ci, inf, agreedBudget, platformFee, netPayout, firstPayment, finalPayment };
                });
                const grossTotal = rows.reduce((s, r) => s + r.agreedBudget, 0);
                const netTotal = rows.reduce((s, r) => s + r.netPayout, 0);
                const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

                return createPortal(
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => { if (!isBulkAccepting) setBulkAcceptData(null); }}
                    >
                        <div
                            className="relative bg-card border border-border rounded-2xl shadow-[0_0_50px_rgba(254,220,3,0.15)] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="h-1.5 w-full bg-[#fedc03]" />

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-2 rounded-lg bg-[#fedc03]/10 text-[#0a0a0a] shrink-0">
                                        <FileCheck className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm sm:text-base font-bold font-display text-foreground">
                                            Bulk MOU Preview — {rows.length} Creator{rows.length !== 1 ? 's' : ''}
                                        </h3>
                                        <p className="text-xs text-muted-foreground hidden sm:block">
                                            This agreement is generated per creator and emailed to each on acceptance
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { if (!isBulkAccepting) setBulkAcceptData(null); }}
                                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-premium shrink-0 ml-2 disabled:opacity-50"
                                    disabled={isBulkAccepting}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 scrollbar-thin">
                                {/* Shared campaign terms */}
                                <div className="border border-border/80 rounded-xl p-3 sm:p-4 bg-secondary/15 text-sm space-y-3">
                                    <div className="text-center border-b border-border pb-2.5">
                                        <h4 className="text-sm font-bold font-display text-foreground uppercase tracking-wide">
                                            Campaign Collaboration MOU
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            {(campaign as any).brandName || 'Brand Partner'} · {campaign.name} · {today}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                        <div className="p-2 rounded-lg bg-card border border-border/60">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Creators</p>
                                            <p className="text-sm font-bold text-foreground tabular-nums">{rows.length}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-card border border-border/60">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gross</p>
                                            <p className="text-sm font-bold text-foreground tabular-nums">₹{grossTotal.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-card border border-border/60">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Net Payout</p>
                                            <p className="text-sm font-bold text-foreground tabular-nums">₹{netTotal.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-card border border-border/60">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Split</p>
                                            <p className="text-sm font-bold text-foreground">{isPayLater ? '100% final' : '50 / 50'}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                                        Each creator below receives an individual, legally-sound MOU covering deliverables,
                                        usage rights ({campaign.usageRights || '30 days'}), FTC disclosure and the payment
                                        schedule shown. Amounts are per creator at their listed/agreed price.
                                    </p>
                                </div>

                                {/* Per-creator rows */}
                                <div className="space-y-2">
                                    {rows.map(({ ci, inf, agreedBudget, platformFee, netPayout, firstPayment, finalPayment }) => (
                                        <div key={ci.id} className="rounded-xl border border-border/60 bg-card p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-foreground truncate">{inf?.name || inf?.handle || 'Creator'}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">
                                                        {inf?.handle ? `@${String(inf.handle).replace(/^@/, '')}` : 'N/A'}
                                                        {inf?.creatorSize ? ` · ${CREATOR_SIZE_LABELS[inf.creatorSize] || inf.creatorSize}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gross</p>
                                                    <p className="text-sm font-bold text-foreground tabular-nums">₹{agreedBudget.toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[11px]">
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Platform fee ({platformFeePercentValue}%)</span>
                                                    <span className="font-semibold text-foreground tabular-nums">-₹{platformFee.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Net payout</span>
                                                    <span className="font-semibold text-foreground tabular-nums">₹{netPayout.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Advance (50%)</span>
                                                    <span className="font-semibold text-foreground tabular-nums">₹{firstPayment.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Final</span>
                                                    <span className="font-semibold text-foreground tabular-nums">₹{finalPayment.toLocaleString('en-IN')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-secondary/10 flex items-center justify-between shrink-0 gap-3">
                                <button
                                    onClick={() => setBulkAcceptData(null)}
                                    disabled={isBulkAccepting}
                                    className="px-3 sm:px-4 py-2.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold transition-premium disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isBulkAccepting}
                                    onClick={() => void confirmBulkAccept()}
                                    className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#fedc03] text-black text-xs font-bold hover:shadow-[0_0_20px_rgba(254,220,3,0.3)] transition-all duration-300 disabled:opacity-60"
                                >
                                    {isBulkAccepting ? (
                                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Mail className="w-3.5 h-3.5" />
                                    )}
                                    {isBulkAccepting ? 'Accepting…' : `Confirm & Accept ${rows.length} · Send MOU${rows.length !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* Quick View Modal */}
            {quickViewId && !isReadOnly && (() => {
                // Use ciId for unambiguous CI resolution (avoids wrong record when two CIs share an influencerId).
                const quickViewCi = rankedCampaignInfluencers.find((c) => c.id === quickViewId.ciId)
                    ?? rankedCampaignInfluencers.find((c) => String(c.influencerId) === quickViewId.influencerId);
                const quickViewStatus = quickViewCi ? effectiveStatus(quickViewCi) : null;
                const isPhoneUnlocked = quickViewCi ? (!!(quickViewCi as any)?.paidAt || !!(quickViewStatus && canChatByInfluencerStatus(quickViewStatus))) : false;
                // Only surface the visit-location pick when the campaign actually offered a choice.
                const quickViewVisitLocation = (campaign.visitAtSite?.options?.length ?? 0) > 1
                    ? (quickViewCi?.selectedVisitLocation ?? null)
                    : null;

                return (
                    <InfluencerQuickView
                        influencerId={quickViewId.influencerId}
                        onClose={() => setQuickViewId(null)}
                        showPhone={isPhoneUnlocked}
                        selectedVisitLocation={quickViewVisitLocation}
                    />
                );
            })()}

            {/* Creator replacement flow */}
            {replaceModal && !isReadOnly && (
                <ReplaceCreatorModal
                    campaign={campaign}
                    applications={rankedCampaignInfluencers}
                    initialOutgoingCiId={replaceModal.outgoingCiId ?? null}
                    initialIncomingCiId={replaceModal.incomingCiId ?? null}
                    onClose={() => setReplaceModal(null)}
                />
            )}
            {convertToPrivateIntent && !isReadOnly && (
                <ConvertToPrivateModal
                    campaign={campaign}
                    onClose={() => setConvertToPrivateIntent(null)}
                    onConverted={() => {
                        // Continue where the brand left off once the campaign is private.
                        setReplaceModal(convertToPrivateIntent);
                        setConvertToPrivateIntent(null);
                    }}
                />
            )}
        </div>
    );
}
