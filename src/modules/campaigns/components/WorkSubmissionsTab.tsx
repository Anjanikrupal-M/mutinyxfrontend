import { useState, useEffect, useMemo, Fragment } from 'react';
import { ArrowRight, Check, Link as LinkIcon, Wallet, Loader2, MessageSquare, Upload, Send, ChevronLeft, ChevronRight, MoreVertical, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { StatusBadge } from '@/shared/components/StatusBadge';
import type { Campaign } from '@/shared/types/campaign';
import { FormatSlotsList } from './FormatSlotsList';
import { DeliverableSlotsPanel } from './DeliverableSlotsPanel';
import { buildDeliverableSlots } from '../utils/deliverableSlots';
import {
    aggregateFormatCardStatus,
    allRequiredFormatsApproved,
    requiredSlotsFromCampaign,
    itemIndexOf,
    formatApprovalToast,
    formatCountLabel,
    formatSlotsFromItems,
    preferredReviewItem,
    slotItemLabel,
    proofInstagramFormat,
    remainingFormatsAfterApproval,
} from '../utils/instagramContentFormat';
import { useApproveSubmission, useRejectSubmission, useSubmissions } from '../hooks/useSubmissions';
import { useApplications } from '../hooks/useApplications';
import { ReplaceCreatorModal } from './ReplaceCreatorModal';
import { ConvertToPrivateModal } from './ConvertToPrivateModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { useInitiatePaymentRound, usePaymentSummary, useVerifyPayment, useCancelPayment } from '../hooks/usePayments';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryKeys';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { SubmissionMediaViewer } from './SubmissionMediaViewer';
import { InfluencerQuickView } from './InfluencerQuickView';
import { CopyReviewLinkButton } from './CopyReviewLinkButton';
import { CopyBulkReviewLinkButton } from './CopyBulkReviewLinkButton';
import { PaymentSummary } from './PaymentSummary';
import { load } from '@cashfreepayments/cashfree-js';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';
import { ReviewCardsSkeleton } from './TabSkeletons';

interface SubmissionsTabProps {
    campaign: Campaign;
    submissions?: any[];
    isReadOnly?: boolean;
}

export function WorkSubmissionsTab({ campaign, submissions: initialSubmissions, isReadOnly }: SubmissionsTabProps) {
    const queryClient = useQueryClient();
    const { data: fetchedSubmissions = [], isLoading: isFetching } = useSubmissions(isReadOnly ? '' : campaign.id);
    const submissions = isReadOnly ? (initialSubmissions ?? []) : fetchedSubmissions;
    const isLoading = isReadOnly ? false : isFetching;
    const approveSubmission = useApproveSubmission();
    const rejectSubmission = useRejectSubmission();
    const [openedSubmissionId, setOpenedSubmissionId] = useState<string | null>(null);
    const [openedInfluencerKey, setOpenedInfluencerKey] = useState<string>('');
    const [modalSubmissionSnapshot, setModalSubmissionSnapshot] = useState<any | null>(null);
    const [revisionMessage, setRevisionMessage] = useState<string>('');
    const [isRevisionFormOpen, setIsRevisionFormOpen] = useState(false);
    const [acceptMessage, setAcceptMessage] = useState<string>('');
    const [isAcceptFormOpen, setIsAcceptFormOpen] = useState(false);
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    const isSubmissionModalOpen = Boolean(openedSubmissionId);
    // Creator replacement — CI list for the replace flow (post-payment stages only;
    // pending covers revision-requested creators). Mirrors backend REPLACEABLE_STATUSES.
    const { data: campaignInfluencers = [] } = useApplications(isReadOnly ? '' : campaign.id);
    const REPLACEABLE_CI_STATUSES = new Set(['script_pending', 'script_review', 'work_pending', 'work_review']);
    const [replaceOutgoingCiId, setReplaceOutgoingCiId] = useState<string | null>(null);
    const [convertIntentCiId, setConvertIntentCiId] = useState<string | null>(null);
    const openReplaceFlow = (ciId: string) => {
        setOpenedSubmissionId(null); // close the review dialog under the replace overlay
        setModalSubmissionSnapshot(null);
        if ((campaign.visibility ?? 'public') === 'private') {
            setReplaceOutgoingCiId(ciId);
        } else {
            setConvertIntentCiId(ciId);
        }
    };
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    // Held true from the moment the Cashfree modal closes until the refetched payment
    // summary lands. Without it the component re-renders against the stale cache the
    // instant the modal dismisses, so the brand sees a live "Pay Final" button for the
    // creator they just paid — then it flips to "done" a beat later.
    const [isSettlingPayment, setIsSettlingPayment] = useState(false);
    const [cashfree, setCashfree] = useState<any>(null);

    const budgetMode = campaign.budgetMode || campaign.budget?.mode || 'paid';
    const isProductOnlyCampaign = budgetMode === 'product';
    const canShowFinalPayout = !isReadOnly && !isProductOnlyCampaign;

    const { data: paymentSummary, isLoading: isLoadingPaymentSummary } = usePaymentSummary(canShowFinalPayout ? campaign.id : '');
    const showFinalPayout = canShowFinalPayout && paymentSummary?.paymentBypassEnabled !== true;
    const initiatePaymentRound = useInitiatePaymentRound();
    const verifyPayment = useVerifyPayment();
    const cancelPayment = useCancelPayment();

    useEffect(() => {
        if (!showFinalPayout) return;
        load({ mode: import.meta.env.VITE_CASHFREE_ENV === 'production' ? 'production' : 'sandbox' })
            .then((cf) => setCashfree(cf))
            .catch((err) => console.error('Failed to load Cashfree', err));
    }, [showFinalPayout]);

    const groupedSubmissions = useMemo(() => {
        return submissions.reduce<Record<string, any[]>>((acc, ws) => {
            const key = ws.influencerId ?? ws.influencerHandle ?? ws.influencerName ?? 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(ws);
            return acc;
        }, {});
    }, [submissions]);

    // Cards are ordered the same way the Applications tab ranks its own: whatever still needs
    // the brand's attention floats to the top, anything already settled sinks to the bottom.
    // Ranked here rather than badged on the card — with staggered final rounds, a settled
    // creator sitting between two unpaid ones is what made the list unreadable.
    const groupSortRank = (workSubmissions: any[]): number => {
        const latest = workSubmissions[0];
        const submissionStatus = String(latest?.status ?? '').toLowerCase();
        if (latest?.ci?.finalPaidAt) return 4;          // paid — bottom
        if (submissionStatus === 'pending') return 1;   // needs review
        if (submissionStatus === 'approved') return 2;  // approved, awaiting final payout
        return 3;                                       // rejected / revision requested
    };

    const groups = useMemo(() => {
        const built = Object.entries(groupedSubmissions).map(([influencerKey, workSubmissions]) => ({
            influencerKey,
            workSubmissions: [...workSubmissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
        }));

        return built.sort((a, b) => {
            const rankDiff = groupSortRank(a.workSubmissions) - groupSortRank(b.workSubmissions);
            if (rankDiff !== 0) return rankDiff;
            // Tie-break: most recent submission first, matching the Applications tab default.
            const aTime = new Date(a.workSubmissions[0]?.submittedAt ?? 0).getTime();
            const bTime = new Date(b.workSubmissions[0]?.submittedAt ?? 0).getTime();
            return bTime - aTime;
        });
    }, [groupedSubmissions]);

    const requiredSlots = useMemo(
        () => requiredSlotsFromCampaign(campaign),
        [campaign.deliverables, campaign.contentTypes],
    );

    const latestApprovedGroups = useMemo(() => {
        return groups.filter((g) => {
            const slots = formatSlotsFromItems(requiredSlots, g.workSubmissions);
            if (requiredSlots.length > 1) return allRequiredFormatsApproved(slots);
            const latest = g.workSubmissions[0];
            return String(latest?.status ?? '').toLowerCase() === 'approved';
        });
    }, [groups, requiredSlots]);

    const flatSubmissions = useMemo(() => {
        return [...submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }, [submissions]);

    const isActionLoading = approveSubmission.isPending || rejectSubmission.isPending;
    const isCampaignWithdrawn = campaign.status === 'withdrawn';
    const isCampaignClosed = campaign.status === 'closed';
    const isCampaignDisabled = isCampaignWithdrawn || isCampaignClosed;

    // ── Final payout (paid on work approval; proof of work is verified after) ──
    const pendingWorkCount = groups.filter((g) => {
        const slots = formatSlotsFromItems(requiredSlots, g.workSubmissions);
        if (requiredSlots.length > 1) return slots.some((slot) => slot.status === 'pending');
        return String(g.workSubmissions[0]?.status ?? '').toLowerCase() === 'pending';
    }).length;
    const incompleteFormatCount = groups.filter((g) => {
        const slots = formatSlotsFromItems(requiredSlots, g.workSubmissions);
        if (requiredSlots.length <= 1) return false;
        const waiting = slots.some((slot) => slot.status === 'missing' || slot.status === 'rejected');
        return waiting && !slots.some((slot) => slot.status === 'pending');
    }).length;
    const hasPendingWork = pendingWorkCount > 0;
    const hasApprovedWork = latestApprovedGroups.length > 0;

    const fallbackFinalSummary = useMemo(() => {
        const feePercent = Number(campaign.platformFeePercent ?? campaign.budget?.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT);
        const multiplier = campaign.payLaterMode ? 1 : 0.5;
        const influencerTotal = latestApprovedGroups.reduce((sum, g) => {
            const ci = g.workSubmissions[0]?.ci;
            const budget = Number(ci?.agreedBudget ?? ci?.tierRate ?? 0) || 0;
            return sum + budget * multiplier;
        }, 0);
        const platformFee = (influencerTotal * feePercent) / 100;
        return {
            count: latestApprovedGroups.length,
            influencerTotal,
            platformFee,
            grandTotal: influencerTotal + platformFee,
        };
    }, [latestApprovedGroups, campaign.platformFeePercent, campaign.budget?.platformFeePercent, campaign.payLaterMode]);

    const apiFinalSummary = paymentSummary?.nextFinalRound;
    const finalSummary = (apiFinalSummary?.count ?? 0) > 0 ? apiFinalSummary : fallbackFinalSummary;
    const hasBackendEligibleFinal = (apiFinalSummary?.count ?? 0) > 0;

    // ── Who is in this payout vs already settled ──────────────────────────────
    // Final payouts run in staggered rounds, so "approved work" alone no longer tells the
    // brand anything useful. The backend's eligibility list is the source of truth for the
    // upcoming round; finalPaidAt on the CI marks creators an earlier round already settled.
    const finalEligibleCiIds = useMemo(
        () => new Set(apiFinalSummary?.ciIds ?? []),
        [apiFinalSummary?.ciIds],
    );

    // Divider anchor: the key of the first already-settled group, used to drop a subtle
    // full-width separator between the active creators and the paid ones. Mirrors
    // dividerBeforeCiId in ApplicationsTab. Null when one side of the split is empty.
    const dividerBeforeGroupKey = useMemo(() => {
        let sawActive = false;
        for (const g of groups) {
            if (!g.workSubmissions[0]?.ci?.finalPaidAt) {
                sawActive = true;
                continue;
            }
            return sawActive ? g.influencerKey : null;
        }
        return null;
    }, [groups]);

    type FinalPayoutState = 'paid' | 'in_round' | 'processing' | 'not_ready';
    const finalPayoutState = (submission: any): FinalPayoutState => {
        const ci = submission?.ci;
        const ciId = submission?.campaignInfluencerId ?? ci?.id;
        if (ci?.finalPaidAt) return 'paid';
        if (ciId && finalEligibleCiIds.has(ciId)) {
            return String(ci?.status ?? '').toLowerCase() === 'payment_pending' ? 'processing' : 'in_round';
        }
        return 'not_ready';
    };

    // Named breakdown for the payout card, built from the same submission groups the list
    // renders so the two panels can never disagree about who is where.
    const finalPayoutRoster = useMemo(() => {
        const inRound: Array<{ id: string; name: string; amount: number }> = [];
        const paid: Array<{ id: string; name: string }> = [];
        for (const g of groups) {
            const latest = g.workSubmissions[0];
            if (!latest) continue;
            const ci = latest.ci;
            const ciId = latest.campaignInfluencerId ?? ci?.id;
            const name = latest.influencerName || latest.influencerHandle || 'Unknown creator';
            if (ci?.finalPaidAt) {
                paid.push({ id: ciId, name });
            } else if (ciId && finalEligibleCiIds.has(ciId)) {
                const budget = Number(ci?.agreedBudget ?? ci?.tierRate ?? 0) || 0;
                inRound.push({ id: ciId, name, amount: budget * (campaign.payLaterMode ? 1 : 0.5) });
            }
        }
        return { inRound, paid };
    }, [groups, finalEligibleCiIds, campaign.payLaterMode]);
    const isPayLater = Boolean(campaign.payLaterMode);
    const finalRoundLabel = isPayLater ? 'Final Payout (100%)' : 'Final Payout (50%)';

    // Final payment waits until every submitted work has been reviewed — paying
    // while a submission is still pending would release funds for work the
    // brand hasn't actually approved yet.
    const canPayFinal = hasBackendEligibleFinal && hasApprovedWork && !hasPendingWork;
    const isProcessingFinalPayment = isCheckoutOpen || initiatePaymentRound.isPending || isSettlingPayment;

    const hasOpenFinalPaymentRound = (paymentSummary?.paymentRounds ?? []).some((round) => {
        const row = round as Record<string, unknown>;
        if (String(row.paymentType ?? '').toLowerCase() !== 'final') return false;
        // Trust the backend classification; never infer open-state from status text alone.
        return typeof row.isOpen === 'boolean' ? row.isOpen : false;
    });

    // "Final Payment Completed" means nothing is LEFT to pay — not merely that one final
    // round was captured. Final payouts are per-creator and staggered (creators finish work
    // at different times, and replacements join later), so the backend keeps returning newly
    // eligible creators in nextFinalRound after the first capture. Gating on "any captured
    // final round exists" locked the button forever after the first payout and stranded every
    // later creator as unpayable. Mirrors hasCompletedAdvancePayment in ApplicationsTab.
    const hasCompletedFinalPayment =
        !hasOpenFinalPaymentRound &&
        (apiFinalSummary?.count ?? 0) === 0 &&
        (paymentSummary?.paymentRounds ?? []).some((round) => {
            const type = String(round.paymentType ?? '').toLowerCase();
            const status = String(round.status ?? '').toLowerCase();
            return type === 'final' && status === 'captured';
        });

    const invalidateAfterPayment = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaign.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaign.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaign.id) }),
    ]);

    const handlePayFinal = async () => {
        if (!canPayFinal) {
            toast.error('No backend-eligible approved submissions found for final payment yet. Please refresh and try again.');
            return;
        }

        try {
            setIsCheckoutOpen(true);
            const order = await initiatePaymentRound.mutateAsync({
                campaignId: campaign.id,
                paymentType: 'final',
                // Charge exactly the creators the panel just listed. Sending undefined let the
                // backend re-derive the set at request time, so the brand could be billed for a
                // creator who became eligible after the summary they were looking at was fetched.
                ciIds: apiFinalSummary?.ciIds?.length ? apiFinalSummary.ciIds : undefined,
            });

            // Creator replacement: every eligible CI was covered by carried advance
            // credit — the backend settled them directly, no Cashfree order exists.
            if (order.zeroTotal) {
                setIsSettlingPayment(true);
                setIsCheckoutOpen(false);
                toast.success('Final settlement fully covered by carried advance — creators marked complete.');
                try {
                    await invalidateAfterPayment();
                } finally {
                    setIsSettlingPayment(false);
                }
                return;
            }

            if (!cashfree) {
                toast.error('Payment gateway is unavailable.');
                setIsCheckoutOpen(false);
                return;
            }

            cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_modal',
            }).then(async (result: any) => {
                if (result.error) {
                    setIsSettlingPayment(true);
                    setIsCheckoutOpen(false);
                    const msg = result.error.message || 'Payment failed or cancelled.';
                    if (msg !== 'Payment Cancelled' && result.error.type !== 'modal_closed' && result.error.type !== 'window_closed') {
                        toast.error(msg);
                    }
                    try {
                        await cancelPayment.mutateAsync({ paymentId: order.paymentId, campaignId: campaign.id });
                    } catch {}
                    try {
                        await invalidateAfterPayment();
                    } finally {
                        setIsSettlingPayment(false);
                    }
                    return;
                }

                // Cashfree can take a few seconds to update the order status to PAID after
                // the modal closes — retry a few times before giving up.
                let verified = false;
                let lastVerifyError: unknown;
                for (let attempt = 0; attempt < 3; attempt++) {
                    if (attempt > 0) await new Promise<void>((res) => setTimeout(res, 2000));
                    try {
                        await verifyPayment.mutateAsync({
                            campaignId: campaign.id,
                            orderId: order.orderId,
                            paymentId: order.paymentId,
                        });
                        verified = true;
                        break;
                    } catch (e) {
                        lastVerifyError = e;
                        const errMsg = String(
                            (e as any)?.response?.data?.error?.message ||
                            (e as any)?.response?.data?.message || '',
                        ).toLowerCase();
                        // Stop retrying for non-timing errors (e.g. cancelled, forbidden)
                        if (!errMsg.includes('not yet') && !errMsg.includes('pending')) break;
                    }
                }

                if (verified) {
                    toast.success('Final payment verified.');
                } else {
                    console.error('Final payment verification failed', lastVerifyError);
                    const errMsg = String(
                        (lastVerifyError as any)?.response?.data?.error?.message ||
                        (lastVerifyError as any)?.response?.data?.message || '',
                    ).toLowerCase();
                    if (!errMsg.includes('not yet') && !errMsg.includes('pending')) {
                        // Definitive failure — safe to attempt cancellation
                        try {
                            await cancelPayment.mutateAsync({ paymentId: order.paymentId, campaignId: campaign.id });
                        } catch {}
                        toast.error('Payment was not captured. Please retry final payment.');
                    } else {
                        // Still timing out — don't cancel (payment likely succeeded); user should refresh
                        toast.error('Payment verification timed out. Please refresh to check payment status.');
                    }
                }
                // Order matters: the summary refetch must land before the button is released,
                // otherwise the just-paid creator briefly renders as still payable.
                setIsSettlingPayment(true);
                setIsCheckoutOpen(false);
                try {
                    await invalidateAfterPayment();
                } finally {
                    setIsSettlingPayment(false);
                }
            });
        } catch (error) {
            setIsCheckoutOpen(false);
            const err = error as { response?: { data?: { message?: string; error?: { message?: string } } } };
            const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Payment initiation failed.';
            toast.error(msg);
        }
    };

    const handleApprove = async (subId: string, note?: string) => {
        try {
            await approveSubmission.mutateAsync({
                campaignId: campaign.id,
                subId,
                reviewNote: note?.trim() || undefined,
            });
            // Patch the snapshot immediately so the modal shows "Already reviewed."
            // before the background refetch lands. The hook's onSuccess already patched
            // the query cache; this covers the snapshot that drives the visible modal state.
            setModalSubmissionSnapshot((prev) =>
                prev && prev.id === subId
                    ? { ...prev, status: 'approved' as const, reviewedAt: new Date().toISOString() }
                    : prev
            );
            setIsAcceptFormOpen(false);
            setAcceptMessage('');
            const approved = submissions.find((ws) => ws.id === subId);
            const slots = formatSlotsFromItems(requiredSlots, submissions.filter((ws) => (
                (ws.influencerId ?? ws.influencerHandle ?? ws.influencerName ?? 'unknown')
                === (approved?.influencerId ?? approved?.influencerHandle ?? approved?.influencerName ?? 'unknown')
            )));
            toast.success(formatApprovalToast(
                proofInstagramFormat(approved ?? {}),
                remainingFormatsAfterApproval(slots, proofInstagramFormat(approved ?? {}), itemIndexOf(approved ?? {})),
                { itemIndex: approved?.itemIndex, slots },
            ));
            // Invalidate payment summary as it may have changed
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaign.id) });
        } catch (error) {
            const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to approve submission');
        }
    };

    const handleRequestRevision = async (subId: string) => {
        if (!revisionMessage.trim()) {
            toast.error('Please add a revision note');
            return;
        }

        try {
            await rejectSubmission.mutateAsync({ campaignId: campaign.id, subId, reviewNote: revisionMessage });
            // Patch the snapshot immediately so the modal shows "Already reviewed."
            setModalSubmissionSnapshot((prev) =>
                prev && prev.id === subId
                    ? { ...prev, status: 'rejected' as const, reviewedAt: new Date().toISOString() }
                    : prev
            );
            toast.success('Revision request sent to creator');
            setRevisionMessage('');
            setIsRevisionFormOpen(false);
        } catch (error) {
            const err = error as { response?: { data?: { error?: { message?: string }; message?: string } } };
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to request revision');
        }
    };

    const openSubmissionModal = (ws: any) => {
        const influencerKey = ws.influencerId ?? ws.influencerHandle ?? ws.influencerName ?? 'unknown';
        setOpenedInfluencerKey(influencerKey);
        setModalSubmissionSnapshot(ws);
        setOpenedSubmissionId(ws.id);
    };

    const navigateSubmission = (direction: 'next' | 'prev') => {
        const currentIndex = groups.findIndex(g => g.influencerKey === openedInfluencerKey);
        if (currentIndex === -1) return;

        let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        
        // Wrap around or clamp? The user usually expects clamping or wrapping.
        // Let's implement clamping as it's more standard for "Next/Prev".
        if (nextIndex < 0) nextIndex = groups.length - 1;
        if (nextIndex >= groups.length) nextIndex = 0;

        const nextGroup = groups[nextIndex];
        if (nextGroup?.workSubmissions?.[0]) {
            openSubmissionModal(nextGroup.workSubmissions[0]);
        }
    };

    const modalSubmission = useMemo(() => {
        if (!openedSubmissionId) return null;
        return submissions.find((ws) => ws.id === openedSubmissionId) || modalSubmissionSnapshot;
    }, [openedSubmissionId, submissions, modalSubmissionSnapshot]);

    useEffect(() => {
        if (!openedSubmissionId) return;
        const latest = submissions.find((ws) => ws.id === openedSubmissionId);
        if (latest) setModalSubmissionSnapshot(latest);
    }, [openedSubmissionId, submissions]);

    useEffect(() => {
        setRevisionMessage('');
        setIsRevisionFormOpen(false);
        setAcceptMessage('');
        setIsAcceptFormOpen(false);
    }, [openedSubmissionId]);

    useEffect(() => {
        if (isSubmissionModalOpen) return;
        // Safety cleanup: in some Radix edge-cases, body pointer lock can remain after rapid state changes.
        document.body.style.pointerEvents = '';
    }, [isSubmissionModalOpen]);

    const modalHistory = useMemo(() => {
        if (!modalSubmission) return [] as any[];

        const grouped = groups.find((g) => g.influencerKey === openedInfluencerKey)?.workSubmissions ?? [];
        const rawHistory = Array.isArray((modalSubmission as any).history)
            ? ((modalSubmission as any).history as any[])
            : [];

        const normalizedHistory = rawHistory.map((entry, index) => {
            const e = entry as Record<string, unknown>;
            const submittedAt =
                (e.submittedAt as string | undefined) ??
                (e.createdAt as string | undefined) ??
                (e.timestamp as string | undefined) ??
                '';

            return {
                id: String(e.id ?? `history-${index}-${submittedAt || 'na'}`),
                type: (String((e.type ?? modalSubmission.type) || 'link').toLowerCase() === 'file' ? 'file' : 'link') as 'file' | 'link',
                status: String(e.status ?? 'pending').toLowerCase(),
                submittedAt,
                url:
                    (e.url as string | undefined) ??
                    (e.fileUrl as string | undefined) ??
                    (e.externalUrl as string | undefined) ??
                    (e.mediaUrl as string | undefined) ??
                    '',
                reviewNote: (e.reviewNote as string | undefined) ?? '',
                source: 'history' as const,
            };
        });

        const merged = [...grouped, ...normalizedHistory];
        const seen = new Set<string>();
        const unique = merged.filter((item: any) => {
            const key = String(item.id || `${item.submittedAt || ''}-${item.url || item.externalUrl || item.fileUrl || ''}`);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return unique.sort((a: any, b: any) => {
            const ta = new Date(a.submittedAt || 0).getTime();
            const tb = new Date(b.submittedAt || 0).getTime();
            return tb - ta;
        });
    }, [modalSubmission, groups, openedInfluencerKey]);

    const formatDateSafe = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
        if (!value) return '—';

        // Preserve DB calendar date to prevent timezone-based date shifts.
        const datePart = (() => {
            if (typeof value === 'string') return value.trim().split('T')[0];
            if (value instanceof Date) return value.toISOString().split('T')[0];
            return String(value).trim().split('T')[0];
        })();

        const dateOnlyMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) {
            const year = Number(dateOnlyMatch[1]);
            const monthIndex = Number(dateOnlyMatch[2]) - 1;
            const day = Number(dateOnlyMatch[3]);
            const safeDate = new Date(Date.UTC(year, monthIndex, day));
            return safeDate.toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short' });
        }

        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleDateString('en-IN', opts);
    };

    const inferMediaKind = (row: any): 'image' | 'video' | 'link' => {
        const mediaType = String(row?.mediaType || '').toLowerCase();
        if (mediaType.startsWith('image/')) return 'image';
        if (mediaType.startsWith('video/')) return 'video';

        const candidates = [row?.mediaUrl, row?.url, row?.externalUrl]
            .map((v: unknown) => String(v || '').toLowerCase())
            .filter(Boolean);

        const hasImage = candidates.some((u) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i.test(u));
        if (hasImage) return 'image';
        const hasVideo = candidates.some((u) => /\.(mp4|mov|webm|ogg|m4v|mkv)(\?|#|$)/i.test(u));
        if (hasVideo) return 'video';

        return 'link';
    };

    const formatTierPricing = () => {
        const pricing = campaign.budgetTierPricing || campaign.budget?.tierPricing || [];
        const totalBudget = Number(campaign.budget?.total ?? campaign.budgetTotal ?? 0);
        if ((campaign.budgetMode || campaign.budget?.mode) === 'product') return 'Product Only';
        const values = pricing
            .map((tp: any) => Number(tp?.amount ?? tp?.rate ?? 0))
            .filter((amount: number) => Number.isFinite(amount) && amount > 0);
        if (!values.length) {
            return totalBudget > 0 ? `₹${totalBudget.toLocaleString('en-IN')}` : '—';
        }
        return values.map((amount: number) => `₹${amount.toLocaleString('en-IN')}`).join(' / ');
    };

    // The opened creator's submissions grouped by deliverable: left column lists the
    // deliverables, right column only the selected deliverable's versions.
    const modalSlots = useMemo(() => {
        const items = groups.find((g) => g.influencerKey === openedInfluencerKey)?.workSubmissions ?? [];
        return buildDeliverableSlots(requiredSlots, items);
    }, [groups, openedInfluencerKey, requiredSlots]);
    const selectedSlotKey = modalSubmission ? modalSlots.keyOf(modalSubmission) : null;
    const selectedSlot = modalSlots.slots.find((slot) => slot.key === selectedSlotKey) ?? null;
    // History rows attached to the open submission are its own earlier versions; grouped rows
    // count only when they were made for the same deliverable.
    const slotHistory = useMemo(
        () => modalHistory.filter((ws: any) => ws.source === 'history' || (selectedSlotKey != null && modalSlots.keyOf(ws) === selectedSlotKey)),
        [modalHistory, modalSlots, selectedSlotKey],
    );

    const workNumberById = useMemo(() => {
        return new Map(
            [...slotHistory]
                .sort((a: any, b: any) => {
                    const ta = new Date(a.submittedAt || 0).getTime();
                    const tb = new Date(b.submittedAt || 0).getTime();
                    return ta - tb;
                })
                .map((ws: any, index: number) => [ws.id, index + 1] as const)
        );
    }, [slotHistory]);

    const submissionDisplayStatus = (status?: string | null) => {
        const normalized = String(status ?? '').toLowerCase();
        return normalized === 'rejected' ? 'revision_requested' : normalized;
    };

    const influencerCardStatus = (submission: any, slots: ReturnType<typeof formatSlotsFromItems>) => {
        const fromSlots = aggregateFormatCardStatus(slots);
        if (fromSlots) return fromSlots;

        const submissionStatus = submissionDisplayStatus(submission?.status);
        const ciStatus = String(
            submission?.ci?.status ??
            submission?.applicationStatus ??
            submission?.campaignInfluencerStatus ??
            '',
        )
            .trim()
            .toLowerCase();

        if (submissionStatus === 'approved' || submissionStatus === 'rejected' || submissionStatus === 'revision_requested') {
            return submissionStatus;
        }

        if (ciStatus === 'settelled' || ciStatus === 'setelled') return 'settled';
        if (ciStatus === 'completed') return 'completed';
        if (ciStatus === 'proof_review') return submissionStatus === 'pending' ? 'proof_review' : submissionStatus;

        return ciStatus || submissionStatus;
    };

    return (
        <div className={cn("grid grid-cols-1 gap-6", showFinalPayout && "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]")}>
            <div className="space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-card">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-black">
                            <Send className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="font-display text-lg font-semibold leading-6 tracking-tight">Work Submissions</h2>
                            <p className="text-xs text-muted-foreground">Share one link to let anyone review every work submission for this campaign.</p>
                        </div>
                    </div>
                    {/* Where the work stands: waiting on you, approved, sent back. */}
                    {groups.length > 0 && (() => {
                        const tally = { waiting: 0, approved: 0, rejected: 0 };
                        for (const group of groups) {
                            const statuses = group.workSubmissions.map((ws: any) => String(ws.status ?? '').toLowerCase());
                            if (statuses.includes('pending')) tally.waiting += 1;
                            else if (statuses.includes('rejected')) tally.rejected += 1;
                            else tally.approved += 1;
                        }
                        return (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold', tally.waiting > 0 ? 'bg-brand text-black' : 'bg-secondary text-muted-foreground')}>
                                    <span className="tabular-nums">{tally.waiting}</span> to review
                                </span>
                                <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground/80">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="tabular-nums">{tally.approved}</span> approved
                                </span>
                                {tally.rejected > 0 && (
                                    <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground/80">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /><span className="tabular-nums">{tally.rejected}</span> sent back
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                    {!isReadOnly && (
                        <CopyBulkReviewLinkButton
                            kind="work"
                            campaignId={campaign.id}
                            disabled={flatSubmissions.length === 0}
                            disabledReason="No work submissions yet — nothing to share."
                        />
                    )}
                </div>
                {isLoading ? (
                    <ReviewCardsSkeleton />
                ) : flatSubmissions.length === 0 ? (
                    <div className="flex min-h-[250px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground"><Send className="h-5 w-5" /></span>
                        <p className="text-sm font-semibold">No work submissions yet</p>
                        <p className="text-xs text-muted-foreground">Posts and files show up here as creators submit them.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {groups.map((group) => {
                            const latestSub = preferredReviewItem(group.workSubmissions, requiredSlots)
                                ?? group.workSubmissions[0];
                            if (!latestSub) return null;
                            const slots = formatSlotsFromItems(requiredSlots, group.workSubmissions);
                            const countLabel = formatCountLabel(group.workSubmissions.length, slots);
                            const displayName = latestSub.influencerName || 'Unknown Influencer';
                            // Anything still waiting on the brand gets the yellow outline and a "Review" call to action.
                            const isWaiting = group.workSubmissions.some((ws: any) => String(ws.status ?? '').toLowerCase() === 'pending');
                            const cardBody = (
                                <button
                                    type="button"
                                    onClick={() => openSubmissionModal(latestSub)}
                                    className={cn(
                                        "text-left border rounded-2xl p-4 flex flex-col justify-between group shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
                                        isWaiting ? "border-brand bg-brand/5 hover:border-foreground/40" : "border-border bg-card hover:border-foreground/20",
                                    )}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); setQuickViewId(latestSub.influencerId); }}
                                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 cursor-pointer ring-2 ring-brand/40 ring-offset-1 ring-offset-card hover:ring-brand transition-all"
                                                >
                                                    {latestSub.influencerAvatar ? (
                                                        <ApiImage src={latestSub.influencerAvatar} alt={displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        displayName.charAt(0)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p 
                                                        onClick={(e) => { e.stopPropagation(); setQuickViewId(latestSub.influencerId); }}
                                                        className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                                                    >
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">{latestSub.influencerHandle || '@unknown'}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                <StatusBadge status={influencerCardStatus(latestSub, slots) as any} />
                                                {/* Settled creators carry no payout tag — they sink to the
                                                    bottom of the grid instead (see groupSortRank). */}
                                                {showFinalPayout && (() => {
                                                    const payoutState = finalPayoutState(latestSub);
                                                    if (payoutState === 'not_ready' || payoutState === 'paid') return null;
                                                    const payoutBadge = {
                                                        in_round: { label: 'To be paid', className: 'bg-brand/20 text-foreground border-brand/50' },
                                                        processing: { label: 'Payment processing', className: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800' },
                                                    }[payoutState];
                                                    return (
                                                        <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap', payoutBadge.className)}>
                                                            {payoutBadge.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Deliverable format info */}
                                        {slots.length > 1 ? (
                                            <FormatSlotsList slots={slots} />
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
                                                {latestSub.type === 'file' ? <Upload className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                                                <span>{slotItemLabel({ type: String(latestSub.type ?? ''), contentFormat: String(latestSub.type ?? ''), itemIndex: latestSub.itemIndex }, requiredSlots)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                        <span className="flex min-w-0 items-center gap-2">
                                            {countLabel && (
                                                <span className="inline-flex shrink-0 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold lowercase tracking-normal">
                                                    {countLabel}
                                                </span>
                                            )}
                                            <span className="truncate">
                                                {new Date(latestSub.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </span>
                                        {isWaiting ? (
                                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-foreground py-1 pl-3 pr-2 text-[11px] font-semibold text-background transition-transform duration-200 group-hover:translate-x-0.5">
                                                Review <ArrowRight className="h-3 w-3" />
                                            </span>
                                        ) : (
                                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-foreground/60 transition-colors duration-200 group-hover:bg-foreground group-hover:text-brand">
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );

                            return (
                                <Fragment key={group.influencerKey}>
                                    {group.influencerKey === dividerBeforeGroupKey && (
                                        <div className="col-span-full flex items-center gap-3 pt-3 pb-1" aria-hidden="true">
                                            <div className="h-px flex-1 bg-border" />
                                            <span className="rounded-full bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                                                Final payout settled
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

            {showFinalPayout && (
                <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 p-4 sm:p-5 sticky top-20 shadow-card">
                        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
                        <h3 className="relative mb-4 flex items-center gap-2.5 font-display text-base font-semibold tracking-tight">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-black"><Wallet className="h-4 w-4" /></span>
                            Final payout
                        </h3>
                        {isLoadingPaymentSummary || !finalSummary ? (
                            <div className="text-xs text-muted-foreground">Loading payment summary...</div>
                        ) : (
                            <div className="relative">
                                <PaymentSummary title={finalRoundLabel} summary={finalSummary} />

                                {/* Name the creators in this round — with staggered payouts a bare
                                    total tells the brand nothing about who it covers. */}
                                {finalPayoutRoster.inRound.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-foreground/15">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                            Paying now ({finalPayoutRoster.inRound.length})
                                        </p>
                                        <ul className="space-y-1.5">
                                            {finalPayoutRoster.inRound.map((entry) => (
                                                <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                                                    <span className="truncate font-medium">{entry.name}</span>
                                                    <span className="shrink-0 text-muted-foreground">
                                                        ₹{entry.amount.toLocaleString('en-IN')}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        {(apiFinalSummary?.count ?? 0) > finalPayoutRoster.inRound.length && (
                                            <p className="text-[10px] text-muted-foreground mt-1.5">
                                                +{(apiFinalSummary?.count ?? 0) - finalPayoutRoster.inRound.length} more eligible creator(s) not shown in this list.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {finalPayoutRoster.paid.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-foreground/15">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                            Already paid ({finalPayoutRoster.paid.length})
                                        </p>
                                        <ul className="space-y-1.5">
                                            {finalPayoutRoster.paid.map((entry) => (
                                                <li key={entry.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                    <span className="truncate">{entry.name}</span>
                                                    <span className="shrink-0 text-emerald-700 dark:text-emerald-400 font-medium">Settled</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <button
                                    onClick={() => void handlePayFinal()}
                                    disabled={!canPayFinal || isProcessingFinalPayment || hasCompletedFinalPayment || isCampaignDisabled}
                                    className={cn(
                                        'w-full mt-4 h-11 px-4 font-semibold rounded-full transition-all duration-200 disabled:cursor-not-allowed text-xs',
                                        isCampaignDisabled
                                            ? 'bg-secondary text-muted-foreground border border-border'
                                            : hasCompletedFinalPayment
                                                ? 'bg-emerald-600/15 text-emerald-700 border border-emerald-300'
                                                : canPayFinal
                                                    ? 'bg-foreground text-background shadow-sm hover:-translate-y-0.5 hover:shadow-float'
                                                    : 'bg-card/70 text-muted-foreground border border-dashed border-foreground/20'
                                    )}
                                >
                                    {isCampaignWithdrawn
                                        ? 'Campaign Withdrawn'
                                        : isCampaignClosed
                                            ? 'Campaign Closed'
                                            : isSettlingPayment
                                                ? 'Updating payout status...'
                                                : isProcessingFinalPayment
                                                    ? 'Opening Cashfree...'
                                                    : hasCompletedFinalPayment
                                                        ? '✓ All Final Payouts Done'
                                                        : canPayFinal
                                                            ? 'Pay Final'
                                                             : hasPendingWork
                                                                 ? `Review ${pendingWorkCount} pending submission${pendingWorkCount === 1 ? '' : 's'} to pay final`
                                                                 : incompleteFormatCount > 0
                                                                     ? 'Waiting for remaining formats'
                                                                     : !hasApprovedWork
                                                                         ? 'Approve a work submission to pay final'
                                                                         : 'No eligible final payouts'}
                                </button>
                                {(campaign.proofOfWorkRequired || campaign.proofOfWorkReq) && (
                                    <p className="text-[11px] leading-relaxed text-muted-foreground mt-3">
                                        After payment, creators post their content and share proof links in the Proof of Work tab. Approving the proof completes the campaign.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Dialog
                open={isSubmissionModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setOpenedSubmissionId(null);
                        setModalSubmissionSnapshot(null);
                        setRevisionMessage('');
                        setIsRevisionFormOpen(false);
                        setAcceptMessage('');
                        setIsAcceptFormOpen(false);
                    }
                }}
            >
                {modalSubmission && (
                    <DialogContent className="max-w-7xl w-[95vw] h-[92vh] max-h-[92vh] overflow-hidden p-0 flex flex-col rounded-3xl gap-0">
                        <DialogHeader className="px-4 py-3 md:px-5 border-b border-border bg-card shrink-0">
                            <DialogTitle className="flex items-center gap-3 pr-10">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-black">
                                    <Send className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-display text-base font-semibold leading-5 tracking-tight">Work submission review</span>
                                    <span className="block truncate text-xs font-normal text-muted-foreground">{modalSubmission.influencerName} · {campaign.name}</span>
                                </span>
                                <StatusBadge status={submissionDisplayStatus(modalSubmission.status) as any} />
                                {/* Creator replacement — offered while the creator sits in a
                                    post-payment stage (incl. revision) */}
                                {!isReadOnly && (() => {
                                    const reviewedCi = campaignInfluencers.find(
                                        (ci: any) => String(ci.influencerId) === String(modalSubmission.influencerId)
                                    );
                                    if (!reviewedCi || !REPLACEABLE_CI_STATUSES.has(String(reviewedCi.status ?? '').toLowerCase())) return null;
                                    // modal={false}: avoid stacking a second Radix modal layer inside the
                                    // Dialog; z-[70]: the Dialog content sits at z-[60], above the dropdown's
                                    // default z-50 — without this the menu opens invisibly behind the dialog.
                                    return (
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label="More actions"
                                                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-52 z-[70]">
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => openReplaceFlow(reviewedCi.id)}
                                                >
                                                    <UserRoundX className="w-4 h-4 mr-2" />
                                                    Replace creator…
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    );
                                })()}
                                {groups.length > 1 && (
                                    <span className="ml-auto mr-2 flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary/50 p-1">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); navigateSubmission('prev'); }}
                                            className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-sm transition-colors hover:bg-foreground hover:text-brand"
                                            title="Previous creator"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <span className="px-1.5 text-xs font-semibold tabular-nums">
                                            {groups.findIndex(g => g.influencerKey === openedInfluencerKey) + 1} <span className="text-muted-foreground">of {groups.length}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); navigateSubmission('next'); }}
                                            className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-sm transition-colors hover:bg-foreground hover:text-brand"
                                            title="Next creator"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </span>
                                )}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Review submitted media, take approval actions, and inspect submission history.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden bg-secondary/40 p-4 md:p-5 relative">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
                                {/* Left Column: Campaign Details, Deliverables, Creator */}
                                <div className="flex flex-col lg:col-span-3 gap-4 lg:h-full lg:overflow-hidden">
                                    {/* Who made it — a yellow-tinted card like the dashboard's stat cards. */}
                                    <div className="hidden lg:block relative overflow-hidden rounded-3xl border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 p-4 shrink-0 shadow-card">
                                        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/30 blur-3xl" />
                                        <div className="relative flex items-center gap-3">
                                            <div
                                                onClick={() => setQuickViewId(modalSubmission.influencerId)}
                                                className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-base font-bold text-brand ring-2 ring-brand ring-offset-2 ring-offset-card"
                                            >
                                                {modalSubmission.influencerAvatar ? (
                                                    <ApiImage src={modalSubmission.influencerAvatar} alt={modalSubmission.influencerName || ''} className="w-full h-full object-cover" />
                                                ) : (
                                                    (modalSubmission.influencerName || '?').charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p
                                                    onClick={() => setQuickViewId(modalSubmission.influencerId)}
                                                    className="truncate font-display text-base font-semibold tracking-tight cursor-pointer underline-offset-2 hover:underline"
                                                >
                                                    {modalSubmission.influencerName}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">{modalSubmission.influencerHandle || '@unknown'}</p>
                                            </div>
                                        </div>
                                        <dl className="relative mt-4 grid grid-cols-2 gap-1.5 text-[11px]">
                                            {[
                                                { label: 'Budget', value: formatTierPricing() },
                                                { label: 'Work due', value: formatDateSafe(campaign.workDeadline || campaign.timeline?.workDeadline || campaign.deadline, { day: 'numeric', month: 'short' }) },
                                                { label: 'Type', value: String(campaign.type ?? '—') },
                                                ...((campaign.proofOfWorkRequired || campaign.proofOfWorkReq)
                                                    ? [{ label: 'Proof due', value: formatDateSafe(campaign.proofOfWorkDeadline || campaign.timeline?.proofOfWorkDeadline, { day: 'numeric', month: 'short' }) }]
                                                    : [{ label: 'Status', value: String(campaign.status ?? '—') }]),
                                            ].map((fact) => (
                                                <div key={fact.label} className="min-w-0 rounded-xl border border-border bg-card px-2.5 py-2">
                                                    <dt className="text-muted-foreground">{fact.label}</dt>
                                                    <dd className="mt-0.5 truncate font-semibold capitalize" title={fact.value}>{fact.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>

                                    <DeliverableSlotsPanel
                                        slots={modalSlots.slots}
                                        selectedKey={selectedSlotKey}
                                        versionNoun="submission"
                                        onSelect={(slot) => slot.versions[0]?.id && setOpenedSubmissionId(slot.versions[0].id)}
                                        className="lg:flex-1 lg:min-h-0 overflow-y-auto scrollbar-thin"
                                    />

                                </div>

                                {/* Main Content Column */}
                                <div className="lg:col-span-6 rounded-3xl border border-border bg-card p-4 shadow-card flex min-h-0 flex-col overflow-y-auto lg:overflow-hidden scrollbar-hide">
                                    {modalSubmission.reviewedAt && (
                                        <div className="mb-3 flex text-[11px]">
                                            <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground/80">
                                                <Check className="h-3 w-3" />
                                                Reviewed {formatDateSafe(modalSubmission.reviewedAt, { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    )}

                                    <div className="min-h-[420px] lg:min-h-0 lg:flex-1">
                                        <SubmissionMediaViewer submission={modalSubmission} fill />
                                    </div>

                                    {/* Notes below the post scroll on their own, so the post never moves. */}
                                    <div className="shrink-0 lg:max-h-40 lg:overflow-y-auto scrollbar-thin">

                                    {modalSubmission.textContent && (
                                        <div className="mt-4 shrink-0 rounded-2xl border-l-[3px] border-brand bg-secondary/50 overflow-hidden">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2.5 pb-1">Note from the creator</p>
                                            <div className="p-3 text-sm whitespace-pre-wrap leading-6 italic max-h-64 overflow-y-auto scrollbar-thin">
                                                "{modalSubmission.textContent}"
                                            </div>
                                        </div>
                                    )}

                                    {(modalSubmission.reviewNote || (modalSubmission as any).externalReviewerName) && modalSubmission.status !== 'pending' && (
                                        <div className={cn(
                                            'flex items-start gap-2 p-3 rounded-2xl text-xs mt-4',
                                            modalSubmission.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-secondary'
                                        )}>
                                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="font-bold">
                                                    {(modalSubmission as any).externalReviewerName
                                                        ? `Reviewed by ${(modalSubmission as any).externalReviewerName} (via shared link)`
                                                        : 'Reviewer note'}
                                                </p>
                                                {modalSubmission.reviewNote && (
                                                    <p className="break-words break-all whitespace-pre-wrap">{modalSubmission.reviewNote}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                </div>

                                {/* Right Panel (Actions + History) */}
                                <div className="lg:col-span-3 lg:flex lg:flex-col gap-4 overflow-y-auto scrollbar-hide">
                                    {!isReadOnly && <div className="rounded-3xl border border-border bg-card p-4 shrink-0 shadow-card">
                                        <p className="mb-3 font-display text-sm font-semibold tracking-tight">Your decision</p>
                                        <CopyReviewLinkButton
                                            kind="work"
                                            shareToken={(modalSubmission as any).shareToken}
                                            disabled={modalSubmission.status !== 'pending'}
                                            className="w-full mb-3"
                                        />
                                        {modalSubmission.status === 'pending' ? (
                                            <div className="flex flex-col gap-3">
                                                <button
                                                    onClick={() => {
                                                        setIsRevisionFormOpen(false);
                                                        setRevisionMessage('');
                                                        setIsAcceptFormOpen((prev) => !prev);
                                                    }}
                                                    disabled={isActionLoading}
                                                    className="group/approve flex h-11 items-center justify-center gap-2 rounded-full bg-brand pl-1.5 pr-4 text-sm font-semibold text-black shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    <span className="grid h-8 w-8 place-items-center rounded-full bg-card transition-transform duration-200 group-hover/approve:scale-110"><Check className="h-4 w-4" strokeWidth={3} /></span>
                                                    <span className="flex-1 pr-8 text-center">Approve</span>
                                                </button>

                                                {isAcceptFormOpen && (
                                                    <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-2.5 animate-in fade-in slide-in-from-top-1">
                                                        <textarea
                                                            value={acceptMessage}
                                                            onChange={(e) => setAcceptMessage(e.target.value.slice(0, 300))}
                                                            maxLength={300}
                                                            placeholder="Add a message for the creator (optional)..."
                                                            className="w-full text-xs p-2.5 rounded-xl border border-border bg-card resize-none min-h-[88px] focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                                                        />
                                                        <p className="text-right text-[10px] text-muted-foreground">{acceptMessage.length}/300</p>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsAcceptFormOpen(false);
                                                                    setAcceptMessage('');
                                                                }}
                                                                className="h-8 px-3 rounded-full border border-border bg-card text-xs font-semibold transition-colors hover:border-foreground"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isActionLoading}
                                                                onClick={() => {
                                                                    void handleApprove(modalSubmission.id, acceptMessage);
                                                                }}
                                                                className="h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold transition-all hover:shadow-card disabled:opacity-50 flex items-center gap-2"
                                                            >
                                                                {approveSubmission.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                                                Confirm Approve
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setIsAcceptFormOpen(false);
                                                        setAcceptMessage('');
                                                        setIsRevisionFormOpen((prev) => !prev);
                                                    }}
                                                    disabled={isActionLoading}
                                                    className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:border-foreground disabled:opacity-50"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    Request Revision
                                                </button>

                                                {isRevisionFormOpen && (
                                                    <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-2.5 animate-in fade-in slide-in-from-top-1">
                                                        <textarea
                                                            value={revisionMessage}
                                                            onChange={(e) => setRevisionMessage(e.target.value.slice(0, 500))}
                                                            maxLength={500}
                                                            placeholder="Specify what needs to be improved..."
                                                            className="w-full text-xs p-2.5 rounded-xl border border-border bg-card resize-none min-h-[88px] focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/10"
                                                        />
                                                        <p className="text-right text-[10px] text-muted-foreground">{revisionMessage.length}/500</p>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsRevisionFormOpen(false);
                                                                    setRevisionMessage('');
                                                                }}
                                                                className="h-8 px-3 rounded-full border border-border bg-card text-xs font-semibold transition-colors hover:border-foreground"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isActionLoading || !revisionMessage.trim()}
                                                                onClick={() => {
                                                                    void handleRequestRevision(modalSubmission.id);
                                                                }}
                                                                className="h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold transition-all hover:shadow-card disabled:opacity-50"
                                                            >
                                                                Send revision request
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 py-4 text-xs font-medium text-muted-foreground">
                                                <Check className="h-3.5 w-3.5" />
                                                Already reviewed
                                            </div>
                                        )}
                                    </div>}

                                    <div className="rounded-3xl border border-border bg-card p-4 shrink-0 shadow-card">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-wider">
                                            Versions{selectedSlot && <span className="font-medium normal-case tracking-normal"> · {selectedSlot.label}</span>}
                                        </p>
                                        <div className="space-y-1.5 overflow-y-auto max-h-[300px] pr-1 scrollbar-hide">
                                            {slotHistory.length === 0 && (
                                                <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded-xl px-3 py-2">
                                                    No history available.
                                                </div>
                                            )}
                                            {slotHistory.map((ws: any) => {
                                                const isOpenable = submissions.some((s) => s.id === ws.id);
                                                return (
                                                <button
                                                    key={ws.id}
                                                    type="button"
                                                    onClick={() => isOpenable && setOpenedSubmissionId(ws.id)}
                                                    disabled={!isOpenable}
                                                    className={cn(
                                                        'w-full text-left px-2.5 py-2 rounded-xl border text-[10px] transition-all duration-200',
                                                        ws.id === modalSubmission.id
                                                            ? 'border-brand bg-brand/10'
                                                            : 'border-border bg-card hover:border-foreground/30',
                                                        !isOpenable && 'opacity-80 cursor-default'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="font-bold flex items-center gap-1">
                                                            <Upload className="w-2.5 h-2.5" />
                                                            {`Work ${workNumberById.get(ws.id) ?? 1}`}
                                                        </span>
                                                        <StatusBadge status={submissionDisplayStatus(ws.status) as any} className="scale-75 origin-right" />
                                                    </div>
                                                    <p className="text-muted-foreground opacity-70">
                                                        {formatDateSafe(ws.submittedAt, { day: 'numeric', month: 'short' })}
                                                    </p>
                                                </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
            {quickViewId && (
                <InfluencerQuickView
                    influencerId={quickViewId}
                    onClose={() => setQuickViewId(null)}
                />
            )}

            {/* Creator replacement flow (opened from the review modal's 3-dot menu) */}
            {replaceOutgoingCiId && !isReadOnly && (
                <ReplaceCreatorModal
                    campaign={campaign}
                    applications={campaignInfluencers as any}
                    initialOutgoingCiId={replaceOutgoingCiId}
                    onClose={() => setReplaceOutgoingCiId(null)}
                />
            )}
            {convertIntentCiId && !isReadOnly && (
                <ConvertToPrivateModal
                    campaign={campaign}
                    onClose={() => setConvertIntentCiId(null)}
                    onConverted={() => {
                        setReplaceOutgoingCiId(convertIntentCiId);
                        setConvertIntentCiId(null);
                    }}
                />
            )}
        </div>
    );
}

