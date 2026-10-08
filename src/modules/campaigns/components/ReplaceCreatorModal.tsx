import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { X, UserRoundX, ArrowRight, AlertTriangle, Package, Loader2, UserPlus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Campaign, CampaignInfluencer } from '@/shared/types/campaign';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { ApiImage } from '@/shared/components/ApiImage';
import { useReplaceCreator, useReplacePreview } from '../hooks/useApplications';
import { getIsNoScript } from '@/modules/campaigns/utils/campaignStatus';

interface ReplaceCreatorModalProps {
    campaign: Campaign;
    applications: CampaignInfluencer[];
    /** Entry point A: the outgoing creator's card (script_review / work_review). */
    initialOutgoingCiId?: string | null;
    /** Entry point B: a ready-to-accept candidate's card ("Accept & replace…"). */
    initialIncomingCiId?: string | null;
    onClose: () => void;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const displayName = (ci?: CampaignInfluencer | null) =>
    (ci as any)?.userName || ci?.handle || 'Creator';

/**
 * Two-step replace flow (private campaigns only — the caller gates public campaigns
 * behind ConvertToPrivateModal):
 *   1. Pick the counterpart — candidates (applied / negotiating / invite-accepted
 *      unpaid) when entering from the outgoing creator, or the replaceable
 *      script_review / work_review targets when entering from a candidate card.
 *   2. Confirm — carried-advance money math, surplus warning, internal reason.
 *
 * Confirming runs ONE atomic backend transaction: outgoing → 'replaced', incoming
 * accepted with the captured advance carried over (advance round skipped; the
 * difference settles in the final round).
 */
export function ReplaceCreatorModal({
    campaign,
    applications,
    initialOutgoingCiId = null,
    initialIncomingCiId = null,
    onClose,
}: ReplaceCreatorModalProps) {
    const navigate = useNavigate();
    const [outgoingCiId, setOutgoingCiId] = useState<string | null>(initialOutgoingCiId);
    const [incomingCiId, setIncomingCiId] = useState<string | null>(initialIncomingCiId);
    const [reason, setReason] = useState('');
    const [scriptDeadline, setScriptDeadline] = useState('');
    const [workDeadline, setWorkDeadline] = useState('');
    const replaceCreator = useReplaceCreator();
    // Preview needs the outgoing CI — fetch as soon as it is known.
    const { data: preview, isLoading: isPreviewLoading } = useReplacePreview(campaign.id, outgoingCiId);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    const normalizeStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();

    const byId = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);
    const outgoing = outgoingCiId ? byId.get(outgoingCiId) ?? null : null;
    const incoming = incomingCiId ? byId.get(incomingCiId) ?? null : null;

    // Ready-to-accept pool: applicants (their consent = the application itself) and
    // invite-accepted creators who haven't been paid yet. Still-'invited' creators
    // can't be force-accepted — shown greyed below.
    const candidates = useMemo(
        () =>
            applications.filter((ci) => {
                if (ci.replacesCiId) return false; // already a replacement for someone
                const s = normalizeStatus(ci.status);
                if (s === 'applied' || s === 'negotiating') return true;
                return s === 'accepted' && !ci.paidAt;
            }),
        [applications]
    );
    const awaitingInvitees = useMemo(
        () => applications.filter((ci) => normalizeStatus(ci.status) === 'invited'),
        [applications]
    );
    // Replaceable targets (used when entering from a candidate card) — post-payment
    // work stages; pending covers revision-requested creators too.
    const targets = useMemo(
        () =>
            applications.filter((ci) => {
                const s = normalizeStatus(ci.status);
                return s === 'script_pending' || s === 'script_review' || s === 'work_pending' || s === 'work_review';
            }),
        [applications]
    );

    const tierPricing = (campaign.budgetTierPricing || (campaign as any).budget?.tierPricing || []) as Array<{ tier?: string; rate?: number; amount?: number }>;
    const amountFor = (ci?: CampaignInfluencer | null): number => {
        if (!ci) return 0;
        const agreed = Number(ci.agreedBudget ?? 0);
        if (agreed > 0) return agreed;
        const quoted = Number(ci.quotedPrice ?? ci.tierRate ?? 0);
        if (quoted > 0) return quoted;
        const match = tierPricing.find((tp) => tp.tier === (ci.tier as string));
        return Number(match?.rate ?? match?.amount ?? 0);
    };

    const isPayLater = Boolean(preview?.payLaterMode);
    const carried = Number(preview?.carriedAdvance ?? 0);
    const incomingGross = amountFor(incoming);
    const finalShare = isPayLater ? incomingGross : incomingGross * 0.5;
    const finalPayable = Math.max(0, finalShare - carried);
    const surplus = Math.max(0, carried - finalShare);
    const isProductMode = ['product', 'paid_product'].includes(String(campaign.budgetMode ?? (campaign as any).budget?.mode ?? ''));
    const isIndividualDeadlines = preview?.deadlineMode === 'individual';
    // "Script not required" campaigns have no script stage, so only the work date is asked.
    const needsScriptDeadline = !getIsNoScript(campaign);
    const missingIndividualDeadlines = isIndividualDeadlines && ((needsScriptDeadline && !scriptDeadline) || !workDeadline);

    const step: 'pick' | 'confirm' = outgoing && incoming ? 'confirm' : 'pick';
    // What the pick step is picking depends on which side is preset.
    const pickingIncoming = !!outgoing && !incoming;

    const handleConfirm = () => {
        if (!outgoing || !incoming || replaceCreator.isPending) return;
        replaceCreator.mutate(
            {
                campaignId: campaign.id,
                appId: outgoing.id,
                incomingCiId: incoming.id,
                reason: reason.trim() || undefined,
                scriptDeadline: needsScriptDeadline && scriptDeadline ? new Date(scriptDeadline).toISOString() : undefined,
                workDeadline: workDeadline ? new Date(workDeadline).toISOString() : undefined,
            },
            {
                onSuccess: () => {
                    toast.success(`${displayName(outgoing)} replaced with ${displayName(incoming)}`);
                    onClose();
                },
                onError: (err: any) => {
                    const apiError = err?.response?.data?.error;
                    toast.error(apiError?.message ?? 'Failed to replace creator. Please try again.');
                },
            }
        );
    };

    const renderPersonRow = (
        ci: CampaignInfluencer,
        opts: { onPick?: () => void; disabled?: boolean; disabledNote?: string } = {}
    ) => (
        <button
            key={ci.id}
            type="button"
            disabled={!!opts.disabled || !opts.onPick}
            onClick={opts.onPick}
            className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-premium',
                opts.disabled
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-foreground/40 hover:bg-secondary/20'
            )}
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0">
                <ApiImage
                    src={(ci as any).userAvatarUrl}
                    alt={displayName(ci)}
                    className="w-full h-full object-cover"
                    fallbackText={displayName(ci).charAt(0)}
                    placeholderClassName="bg-foreground text-background"
                />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{displayName(ci)}</p>
                <p className="text-xs text-muted-foreground truncate">
                    {opts.disabledNote ?? (amountFor(ci) > 0 ? fmt(amountFor(ci)) : 'No quote yet')}
                </p>
            </div>
            <StatusBadge status={ci.status as any} />
        </button>
    );

    const modal = (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="replace-creator-title"
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-border shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                <UserRoundX className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h2 id="replace-creator-title" className="text-base font-bold font-display leading-tight">
                                    {step === 'confirm' ? 'Confirm replacement' : pickingIncoming ? 'Pick a replacement creator' : 'Who are they replacing?'}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {step === 'confirm'
                                        ? 'The paid advance carries over — the difference settles in the final round.'
                                        : pickingIncoming
                                            ? `Choose who takes ${displayName(outgoing)}'s place in the pipeline.`
                                            : `Choose the creator ${displayName(incoming)} will replace.`}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium shrink-0 -mt-0.5"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4 overflow-y-auto">
                    {step === 'pick' && pickingIncoming && (
                        <div className="space-y-2">
                            {candidates.length > 0 ? (
                                candidates.map((ci) => renderPersonRow(ci, { onPick: () => setIncomingCiId(ci.id) }))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No ready-to-accept creators yet. Invite creators below — once they accept, replace from their card.
                                </p>
                            )}

                            {awaitingInvitees.length > 0 && (
                                <>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide pt-2 flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" /> Awaiting creator response
                                    </p>
                                    {awaitingInvitees.map((ci) =>
                                        renderPersonRow(ci, { disabled: true, disabledNote: 'Invited — waiting for them to accept' })
                                    )}
                                </>
                            )}

                            {/* Inviting opens the invite page pre-tagged with this outgoing
                                creator — the invited candidate is earmarked as their
                                replacement so they can't be paid a normal advance before
                                the swap completes (see pendingReplacementForCiId). */}
                            <button
                                type="button"
                                onClick={() => { onClose(); navigate(`/campaigns/${campaign.id}/invite?replaceCiId=${outgoingCiId}`); }}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-premium mt-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Invite new creators
                            </button>
                        </div>
                    )}

                    {step === 'pick' && !pickingIncoming && (
                        <div className="space-y-2">
                            {targets.length > 0 ? (
                                targets.map((ci) => renderPersonRow(ci, { onPick: () => setOutgoingCiId(ci.id) }))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No creators in the script or work stages right now — replacement is only available after the advance is paid.
                                </p>
                            )}
                        </div>
                    )}

                    {step === 'confirm' && outgoing && incoming && (
                        <div className="space-y-4">
                            {/* Who → who */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-muted-foreground">Replacing</p>
                                    <p className="text-sm font-semibold truncate">{displayName(outgoing)}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1 text-right">
                                    <p className="text-xs text-muted-foreground">With</p>
                                    <p className="text-sm font-semibold truncate">{displayName(incoming)}</p>
                                </div>
                            </div>

                            {/* Money math */}
                            {isPreviewLoading ? (
                                <div className="flex items-center justify-center py-4 text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Calculating…
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border divide-y divide-border text-sm">
                                    <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-muted-foreground">{displayName(incoming)}'s rate</span>
                                        <span className="font-semibold">{fmt(incomingGross)}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-muted-foreground">Advance carried from {displayName(outgoing)}</span>
                                        <span className="font-semibold text-emerald-600">− {fmt(Math.min(carried, finalShare))}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-2.5 bg-secondary/20">
                                        <span className="font-semibold">Due at final round</span>
                                        <span className="font-bold">{fmt(finalPayable)} <span className="font-normal text-xs text-muted-foreground">+ platform fee</span></span>
                                    </div>
                                </div>
                            )}

                            {isPayLater && (
                                <p className="text-xs text-muted-foreground">
                                    Pay-later campaign — no advance exists; the new creator is paid in full at the end as usual.
                                </p>
                            )}

                            {surplus > 0 && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p className="text-xs leading-snug">
                                        The carried advance exceeds {displayName(incoming)}'s final amount by <strong>{fmt(surplus)}</strong>.
                                        This surplus is recorded and flagged to Mutiny admins for a manual refund.
                                    </p>
                                </div>
                            )}

                            {isProductMode && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800">
                                    <Package className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p className="text-xs leading-snug">
                                        You'll need to ship the product to {displayName(incoming)} — the product sent to {displayName(outgoing)} is not recovered by the platform.
                                    </p>
                                </div>
                            )}

                            {isIndividualDeadlines && (
                                <div className="grid grid-cols-2 gap-3">
                                    {needsScriptDeadline && (
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground">
                                                Script deadline <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={scriptDeadline}
                                                onChange={(e) => setScriptDeadline(e.target.value)}
                                                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">
                                            Work deadline <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={workDeadline}
                                            onChange={(e) => setWorkDeadline(e.target.value)}
                                            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                        />
                                    </div>
                                    {missingIndividualDeadlines && (
                                        <p className="col-span-2 text-[11px] text-red-500">
                                            {needsScriptDeadline
                                                ? 'This campaign uses individual deadlines — set both dates before completing the replacement.'
                                                : 'This campaign uses individual deadlines — set the work deadline before completing the replacement.'}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">
                                    Reason <span className="font-normal">(internal — never shown to the creator)</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    maxLength={1000}
                                    placeholder="e.g. Repeated missed deadlines"
                                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                            </div>

                            <p className="text-[11px] text-muted-foreground leading-snug">
                                {displayName(outgoing)} will be removed from the pipeline, receive no further payment, and get a
                                neutral notification. {displayName(incoming)} restarts the flow from the beginning with the advance
                                stage already covered. This cannot be undone.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'confirm' && (
                    <div className="px-4 pb-4 pt-2 flex gap-2 shrink-0 border-t border-border">
                        <button
                            type="button"
                            onClick={() => (initialIncomingCiId ? setOutgoingCiId(null) : setIncomingCiId(null))}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/40 transition-premium"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={replaceCreator.isPending || isPreviewLoading || incomingGross <= 0 || missingIndividualDeadlines}
                            onClick={handleConfirm}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-premium flex items-center justify-center gap-2"
                        >
                            {replaceCreator.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Replace creator
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
