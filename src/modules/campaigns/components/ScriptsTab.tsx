import { useState, useMemo, useEffect } from 'react';
import { FileText, Check, X, MessageSquare, Loader2, ChevronLeft, ChevronRight, Search, AlertTriangle, CheckCircle, MoreVertical, UserRoundX } from 'lucide-react';
import http from '@/core/http';
import { API } from '@/core/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { DeliverableSlotsPanel } from '@/modules/campaigns/components/DeliverableSlotsPanel';
import { buildDeliverableSlots } from '@/modules/campaigns/utils/deliverableSlots';
import type { Campaign } from '@/shared/types/campaign';
import { useApproveScript, useRequestScriptRevision, useScripts } from '../hooks/useScripts';
import { useApplications } from '../hooks/useApplications';
import { SubmissionMediaViewer } from './SubmissionMediaViewer';
import { aggregateFormatCardStatus, formatCountLabel, formatSlotsFromItems, itemDeliverableFormat, requiredSlotsFromCampaign, slotItemLabel } from '../utils/instagramContentFormat';
import { FormatSlotsList } from './FormatSlotsList';
import { InfluencerQuickView } from './InfluencerQuickView';
import { CopyReviewLinkButton } from './CopyReviewLinkButton';
import { CopyBulkReviewLinkButton } from './CopyBulkReviewLinkButton';
import { ReplaceCreatorModal } from './ReplaceCreatorModal';
import { ConvertToPrivateModal } from './ConvertToPrivateModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { ReviewCardsSkeleton } from './TabSkeletons';

// Post-payment stages where the brand may swap the creator out (pending covers
// revision-requested creators too) — mirrors REPLACEABLE_STATUSES on the backend.
const REPLACEABLE_CI_STATUSES = new Set(['script_pending', 'script_review', 'work_pending', 'work_review']);

interface ScriptsTabProps {
    campaign: Campaign;
    scripts?: any[];
    isReadOnly?: boolean;
}

function renderAnalysisMarkdown(md: string) {
    if (!md) return '';
    const lines = md.split('\n');
    let inList = false;
    let html = '';
    
    for (let line of lines) {
        let trimmed = line.trim();
        
        // Escape HTML
        trimmed = trimmed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Handle headers
        if (trimmed.startsWith('###')) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<h4 class="text-xs font-bold text-foreground mt-4 mb-1.5 uppercase tracking-wide border-b border-border/40 pb-1">${trimmed.replace(/^###\s*/, '')}</h4>`;
            continue;
        }
        if (trimmed.startsWith('##')) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<h3 class="text-sm font-bold text-foreground mt-4 mb-2 uppercase tracking-wide border-b border-border/40 pb-1">${trimmed.replace(/^##\s*/, '')}</h3>`;
            continue;
        }
        
        // Handle bullet lists
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            if (!inList) {
                html += '<ul class="list-disc pl-4 space-y-1 my-1.5">';
                inList = true;
            }
            let itemText = trimmed.replace(/^[-*]\s*/, '');
            itemText = itemText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
            html += `<li class="text-[11px] leading-relaxed text-muted-foreground">${itemText}</li>`;
            continue;
        }
        
        // Handle numbered lists (e.g. 1. or 2.)
        if (/^\d+\.\s/.test(trimmed)) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            let itemText = trimmed.replace(/^\d+\.\s*/, '');
            itemText = itemText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>');
            html += `<div class="font-semibold text-[11px] text-foreground mt-2 mb-1">${trimmed.match(/^\d+\./)?.[0]} ${itemText}</div>`;
            continue;
        }
        
        // Plain lines
        if (trimmed.length > 0) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            let plainText = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
            html += `<p class="mb-1 text-[11px] leading-relaxed text-muted-foreground">${plainText}</p>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
        }
    }
    
    if (inList) {
        html += '</ul>';
    }
    
    return html;
}

export function ScriptsTab({ campaign, scripts: initialScripts, isReadOnly }: ScriptsTabProps) {
    const { data: fetchedScripts = [], isLoading: isFetchingScripts } = useScripts(isReadOnly ? '' : campaign.id);
    const { data: fetchedCampaignInfluencers = [] } = useApplications(isReadOnly ? '' : campaign.id);
    const scripts = isReadOnly ? (initialScripts ?? []) : fetchedScripts;
    const campaignInfluencers = isReadOnly ? [] : fetchedCampaignInfluencers;
    const isLoading = isReadOnly ? false : isFetchingScripts;
    const approveScript = useApproveScript();
    const requestRevision = useRequestScriptRevision();

    const [openedScriptId, setOpenedScriptId] = useState<string | null>(null);
    const [openedInfluencerKey, setOpenedInfluencerKey] = useState<string>('');
    const [revisionForScriptId, setRevisionForScriptId] = useState<string | null>(null);
    const [acceptForScriptId, setAcceptForScriptId] = useState<string | null>(null);
    const [quickViewId, setQuickViewId] = useState<string | null>(null);
    // Creator replacement — outgoing CI preset for the replace flow; public campaigns
    // route through the convert-to-private popup first (feature is private-only).
    const [replaceOutgoingCiId, setReplaceOutgoingCiId] = useState<string | null>(null);
    const [convertIntentCiId, setConvertIntentCiId] = useState<string | null>(null);
    const openReplaceFlow = (ciId: string) => {
        setOpenedScriptId(null); // close the review dialog under the replace overlay
        if ((campaign.visibility ?? 'public') === 'private') {
            setReplaceOutgoingCiId(ciId);
        } else {
            setConvertIntentCiId(ciId);
        }
    };

    // Optimistic UI updates
    const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, any>>({});

    // Duplicate Script Detection States
    const [detectingDuplicates, setDetectingDuplicates] = useState(false);
    const [duplicateResult, setDuplicateResult] = useState<any | null>(null);
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

    const handleDetectDuplicates = async () => {
        if (latestScripts.length === 0) return;
        setDetectingDuplicates(true);
        setDuplicateDialogOpen(true);
        setDuplicateResult(null);

        try {
            const scriptsPayload = latestScripts.map((s) => ({
                influencerName: s.influencerName || 'Unknown Creator',
                textContent: s.textContent || undefined,
                fileUrl: s.fileUrl || undefined,
            }));

            const response = await http.post(API.ai.detectDuplicateScripts, {
                scripts: scriptsPayload,
                campaignContext: {
                    name: campaign.name,
                    objective: campaign.objective,
                },
            });

            setDuplicateResult(response.data.data);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to analyze scripts. Please make sure scripts contain text.');
            setDuplicateDialogOpen(false);
        } finally {
            setDetectingDuplicates(false);
        }
    };
    const [reviewNote, setReviewNote] = useState('');
    const [acceptNote, setAcceptNote] = useState('');

    const fallbackScripts = useMemo(() => {
        return campaignInfluencers.flatMap((ci: any) => {
            const versions = Array.isArray(ci?.scriptVersions) ? ci.scriptVersions : [];
            return versions.map((sv: any) => ({
                ...sv,
                influencerId: sv?.influencerId ?? ci?.influencerId,
                influencerName: sv?.influencerName ?? ci?.userName ?? ci?.handle ?? 'Unknown',
                influencerHandle: sv?.influencerHandle ?? ci?.handle ?? '@unknown',
                influencerAvatar: sv?.influencerAvatar ?? ci?.userAvatarUrl,
            }));
        });
    }, [campaignInfluencers]);

    const effectiveScripts = useMemo(() => {
        let base = scripts.length > 0 ? scripts : [];
        if (base.length === 0) {
            const seen = new Set<string>();
            base = fallbackScripts.filter((sv: any) => {
                const id = String(sv?.id || '');
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }
        return base.map((s: any) => optimisticUpdates[s.id] ? { ...s, ...optimisticUpdates[s.id] } : s);
    }, [scripts, fallbackScripts, optimisticUpdates]);

    const groupedScripts = useMemo(() => {
        return effectiveScripts.reduce<Record<string, any[]>>((acc, s) => {
            const key = s.influencerId ?? s.influencerHandle ?? s.influencerName ?? 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(s);
            return acc;
        }, {});
    }, [effectiveScripts]);

    const groups = useMemo(() => {
        return Object.entries(groupedScripts).map(([influencerKey, scriptVersions]) => ({
            influencerKey,
            scriptVersions: [...scriptVersions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
        }));
    }, [groupedScripts]);

    const latestScripts = useMemo(() => {
        return groups.map(g => g.scriptVersions[0]).filter(Boolean);
    }, [groups]);

    // Multi-item campaigns (e.g. 2 reels) get one script track per item.
    const requiredSlots = useMemo(
        () => requiredSlotsFromCampaign(campaign),
        [campaign.deliverables, campaign.contentTypes],
    );

    const openScriptModal = (sv: any) => {
        const influencerKey = sv.influencerId ?? sv.influencerHandle ?? sv.influencerName ?? 'unknown';
        setOpenedInfluencerKey(influencerKey);
        setOpenedScriptId(sv.id);
    };

    const navigateScript = (direction: 'next' | 'prev') => {
        const currentIndex = groups.findIndex(g => g.influencerKey === openedInfluencerKey);
        if (currentIndex === -1) return;

        let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        
        if (nextIndex < 0) nextIndex = groups.length - 1;
        if (nextIndex >= groups.length) nextIndex = 0;

        const nextGroup = groups[nextIndex];
        if (nextGroup?.scriptVersions?.[0]) {
            openScriptModal(nextGroup.scriptVersions[0]);
        }
    };

    const modalScript = effectiveScripts.find((sv) => sv.id === openedScriptId) || null;

    // The opened creator's scripts grouped by deliverable: left column lists the
    // deliverables, right column only the selected deliverable's versions.
    const modalSlots = useMemo(() => {
        const versions = groups.find((g) => g.influencerKey === openedInfluencerKey)?.scriptVersions ?? [];
        return buildDeliverableSlots(requiredSlots, versions);
    }, [groups, openedInfluencerKey, requiredSlots]);
    const selectedSlotKey = modalScript ? modalSlots.keyOf(modalScript) : null;
    const selectedSlot = modalSlots.slots.find((slot) => slot.key === selectedSlotKey) ?? null;

    useEffect(() => {
        setRevisionForScriptId(null);
        setAcceptForScriptId(null);
        setReviewNote('');
        setAcceptNote('');
    }, [openedScriptId]);

    const handleApprove = async (scriptId: string, note?: string) => {
        try {
            const updated = await approveScript.mutateAsync({
                campaignId: campaign.id,
                scriptId,
                reviewNote: note?.trim() || undefined,
            });
            // Use the server response if present; otherwise create a minimal status patch
            // so the modal can't re-show the Approve button while the refetch is in-flight.
            setOptimisticUpdates((prev) => ({
                ...prev,
                [scriptId]: updated ?? { status: 'approved', reviewedAt: new Date().toISOString() },
            }));
            toast.success('Script approved');
            setAcceptForScriptId(null);
            setAcceptNote('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to approve script');
        }
    };

    const handleRequestRevision = async () => {
        if (!revisionForScriptId || !reviewNote.trim()) return;
        try {
            const updated = await requestRevision.mutateAsync({
                campaignId: campaign.id,
                scriptId: revisionForScriptId,
                reviewNote,
            });
            setOptimisticUpdates((prev) => ({
                ...prev,
                [revisionForScriptId]: updated ?? { status: 'revision_requested', reviewedAt: new Date().toISOString() },
            }));
            toast.success('Revision requested');
            setRevisionForScriptId(null);
            setReviewNote('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to request revision');
        }
    };

    const renderScriptTextWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium break-all">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // Returns true when textContent consists only of URLs/whitespace — no real prose text.
    // Used to suppress the "Script Description" box when the creator only pasted a link.
    const isTextContentPurelyUrls = (text?: string) => {
        if (!text) return false;
        const stripped = text.replace(/https?:\/\/[^\s]+/gi, '').replace(/\s+/g, '').trim();
        return stripped.length === 0;
    };

    const getFirstHttpUrl = (text?: string) => {
        if (!text) return null;
        const match = text.match(/https?:\/\/[^\s)\]}>"']+/i);
        if (!match?.[0]) return null;
        try {
            const parsed = new URL(match[0]);
            if (!['http:', 'https:'].includes(parsed.protocol)) return null;
            return parsed.toString();
        } catch {
            return null;
        }
    };

    const hasScriptPreviewContent = (sv: any) => {
        const mediaCandidates = [
            sv?.fileUrl,
            sv?.mediaUrl,
            sv?.url,
            sv?.externalUrl,
            sv?.proofOfWorkUrl,
            getFirstHttpUrl(sv?.textContent),
        ];

        return mediaCandidates.some((value) => String(value || '').trim().length > 0);
    };

    const formatShortDate = (value?: string | Date) => {
        if (!value) return '—';

        // Preserve DB calendar date to avoid timezone-based day drift.
        const datePart = (() => {
            if (typeof value === 'string') return value.trim().split('T')[0];
            if (value instanceof Date) return value.toISOString().split('T')[0];
            return String(value).trim().split('T')[0];
        })();

        const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = Number(match[3]);
            const monthIndex = Number(match[2]) - 1;
            if (monthIndex >= 0 && monthIndex < monthShort.length) {
                return `${day} ${monthShort[monthIndex]}`;
            }
        }

        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const formatCampaignBudget = () => {
        const pricing = campaign.budgetTierPricing || campaign.budget?.tierPricing || [];
        const totalBudget = Number(campaign.budget?.total ?? campaign.budgetTotal ?? 0);
        const mode = campaign.budgetMode || campaign.budget?.mode || 'paid';
        if (mode === 'product') return 'Product Only';

        const tierValues = pricing
            .map((tp: any) => Number(tp?.amount ?? tp?.rate ?? 0))
            .filter((amount: number) => Number.isFinite(amount) && amount > 0);

        if (tierValues.length > 0) {
            return tierValues.map((amount: number) => `₹${amount.toLocaleString('en-IN')}`).join(' / ');
        }

        if (totalBudget > 0) {
            return `₹${totalBudget.toLocaleString('en-IN')}`;
        }

        return 'Paid';
    };

    const resolveScriptDeadline = () => {
        const toDatePart = (value?: string | Date | null) => {
            if (!value) return null;
            if (typeof value === 'string') {
                const datePart = value.trim().split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
            }
            const dt = new Date(value);
            if (Number.isNaN(dt.getTime())) return null;
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const candidates = [
            toDatePart(campaign.scriptDeadline),
            toDatePart(campaign.timeline?.scriptDeadline),
        ].filter(Boolean) as string[];

        if (candidates.length === 0) return undefined;
        return [...candidates].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0];
    };

    const getScriptBadgeStatus = (status?: string) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'rejected') return 'revision_requested';
        return normalized;
    };

    const getScriptBadgeLabel = (status?: string) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'rejected' || normalized === 'revision' || normalized === 'revision_requested') return 'Revision';
        return undefined;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-semibold">Scripts</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Share one link to let anyone review every script for this campaign.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleDetectDuplicates}
                        disabled={latestScripts.length === 0}
                        className={cn(
                            "flex items-center gap-1.5 px-4 h-9 rounded-lg border border-border bg-card text-xs font-bold transition-all shadow-sm",
                            latestScripts.length === 0
                                ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                : "hover:bg-secondary/40 text-foreground"
                        )}
                        title={latestScripts.length === 0 ? "No scripts have been submitted yet — detection disabled." : "Run AI duplicate detection analysis."}
                    >
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        Duplicate Script Detection
                    </button>
                    {!isReadOnly && (
                        <CopyBulkReviewLinkButton
                            kind="script"
                            campaignId={campaign.id}
                            disabled={latestScripts.length === 0}
                            disabledReason="No scripts have been submitted yet — nothing to share."
                        />
                    )}
                </div>
            </div>
            {isLoading ? (
                <ReviewCardsSkeleton />
            ) : latestScripts.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl min-h-[250px] p-12 text-center text-muted-foreground text-sm flex items-center justify-center">
                    No scripts submitted yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => {
                        // A pending script must never hide behind a newer approved one — for
                        // another item, or an older version of the same item still awaiting review.
                        const pendingScript = group.scriptVersions.find((sv: any) => String(sv.status ?? '').toLowerCase() === 'pending');
                        const latestScript = pendingScript || group.scriptVersions[0];
                        if (!latestScript) return null;
                        const displayName = latestScript.influencerName || 'Unknown';
                        // Same per-deliverable breakdown as the work card: what's in review,
                        // approved, sent back, and still needed.
                        const slots = formatSlotsFromItems(requiredSlots, group.scriptVersions);
                        const countLabel = formatCountLabel(group.scriptVersions.length, slots);
                        // Card status covers every version, not just the newest: anything still
                        // awaiting review wins, then the per-deliverable roll-up.
                        const aggregate = aggregateFormatCardStatus(slots);
                        const cardBadge = pendingScript
                            ? { status: 'pending', label: undefined }
                            : aggregate === 'work_review'
                                ? { status: 'pending', label: 'Awaiting scripts' }
                                : aggregate
                                    ? { status: aggregate, label: aggregate === 'revision_requested' ? 'Revision' : undefined }
                                    : { status: getScriptBadgeStatus(latestScript.status), label: getScriptBadgeLabel(latestScript.status) };
                        return (
                            <button
                                key={group.influencerKey}
                                type="button"
                                onClick={() => openScriptModal(latestScript)}
                                className="text-left bg-card border border-border hover:border-foreground/30 hover:shadow-md transition-all duration-300 rounded-2xl p-4 flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); setQuickViewId(latestScript.influencerId); }}
                                                className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-[#fedc03] transition-all"
                                            >
                                                {latestScript.influencerAvatar ? (
                                                    <ApiImage src={latestScript.influencerAvatar} alt={displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    displayName.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p 
                                                    onClick={(e) => { e.stopPropagation(); setQuickViewId(latestScript.influencerId); }}
                                                    className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                                                >
                                                    {displayName}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">{latestScript.influencerHandle || '@unknown'}</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={cardBadge.status as any} label={cardBadge.label} />
                                    </div>

                                    {/* Deliverable format info */}
                                    {slots.length > 1 ? (
                                        <FormatSlotsList slots={slots} />
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1 uppercase tracking-wider text-muted-foreground">
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>{itemDeliverableFormat(latestScript) ? slotItemLabel(latestScript, requiredSlots) : 'Script & concept'}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                    {countLabel ? (
                                        <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold lowercase tracking-normal">
                                            {countLabel}
                                        </span>
                                    ) : <span />}
                                    <span>
                                        Latest: {new Date(latestScript.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <Dialog
                open={!!modalScript}
                onOpenChange={(open) => {
                    if (!open) {
                        setOpenedScriptId(null);
                        setRevisionForScriptId(null);
                        setReviewNote('');
                    }
                }}
            >
                {modalScript && (
                    <DialogContent className="max-w-7xl w-[95vw] h-[92vh] max-h-[92vh] overflow-hidden p-0 flex flex-col font-sans">
                        <DialogHeader className="p-4 md:p-5 border-b border-border shrink-0">
                            <DialogTitle className="flex items-center gap-3 pr-10">
                                <span className="flex items-center gap-2 text-sm md:text-base">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    Script Review
                                </span>
                                {modalScript.status === 'pending' && (
                                    <StatusBadge
                                        status={getScriptBadgeStatus(modalScript.status) as any}
                                        label={getScriptBadgeLabel(modalScript.status)}
                                    />
                                )}
                                {/* Creator replacement — offered while the creator sits in a
                                    post-payment stage (incl. revision) */}
                                {!isReadOnly && (() => {
                                    const reviewedCi = campaignInfluencers.find(
                                        (ci: any) => String(ci.influencerId) === String(modalScript.influencerId)
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
                            </DialogTitle>
                        </DialogHeader>

                        <div className={cn(
                            "flex-1 overflow-y-auto lg:overflow-hidden p-4 md:p-5 relative",
                            groups.length > 1 && "lg:px-12"
                        )}>
                            {/* Navigation Arrows — positioned outside the grid columns, inside the extra px-12 padding */}
                            {groups.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateScript('prev');
                                        }}
                                        className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-xl hover:bg-primary hover:text-primary-foreground transition-premium"
                                        title="Previous Application"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateScript('next');
                                        }}
                                        className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-xl hover:bg-primary hover:text-primary-foreground transition-premium"
                                        title="Next Application"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>

                                    {/* Mobile nav row — shown below header on small screens */}
                                    <div className="flex lg:hidden items-center justify-between mb-3">
                                        <button
                                            onClick={() => navigateScript('prev')}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Prev
                                        </button>
                                        <span className="text-xs text-muted-foreground font-semibold">
                                            {groups.findIndex(g => g.influencerKey === openedInfluencerKey) + 1} / {groups.length}
                                        </span>
                                        <button
                                            onClick={() => navigateScript('next')}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium"
                                        >
                                            Next <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Page Indicator (desktop only) */}
                                    <div className="hidden lg:block absolute top-2 right-14 z-50 px-2 py-1 rounded-md bg-secondary/50 backdrop-blur-sm text-[10px] font-bold text-muted-foreground">
                                        {groups.findIndex(g => g.influencerKey === openedInfluencerKey) + 1} / {groups.length}
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-full">
                                {/* Left Column: Campaign Details, Deliverables, Creator */}
                                <div className="flex flex-col lg:col-span-3 gap-4 lg:h-full lg:overflow-hidden">
                                    <div className="hidden lg:block bg-secondary/30 border border-border rounded-xl p-4 shrink-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">Campaign Details</p>
                                        <p className="text-sm font-semibold">{campaign.name}</p>
                                        <div className="space-y-1.5 mt-2 text-[11px]">
                                            <p><span className="text-muted-foreground">Type:</span> <span className="capitalize">{campaign.type}</span></p>
                                            <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{campaign.status}</span></p>
                                            <p><span className="text-muted-foreground">Budget:</span> {formatCampaignBudget()}</p>
                                            <p>
                                                <span className="text-muted-foreground">Script Deadline:</span>{' '}
                                                {formatShortDate(resolveScriptDeadline())}
                                            </p>
                                            
                                        </div>
                                    </div>

                                    <DeliverableSlotsPanel
                                        slots={modalSlots.slots}
                                        selectedKey={selectedSlotKey}
                                        versionNoun="script"
                                        onSelect={(slot) => slot.versions[0] && setOpenedScriptId(slot.versions[0].id)}
                                        className="lg:flex-1 lg:min-h-0 overflow-y-auto scrollbar-thin"
                                    />

                                    <div className="hidden lg:block bg-card border border-border rounded-2xl p-4 shrink-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-wider">Creator</p>
                                        <div className="flex items-center gap-3">
                                            <div 
                                                onClick={() => setQuickViewId(modalScript.influencerId)}
                                                className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-[#fedc03] transition-all"
                                            >
                                                {modalScript.influencerAvatar ? (
                                                    <ApiImage src={modalScript.influencerAvatar} alt={modalScript.influencerName || ''} className="w-full h-full object-cover" />
                                                ) : (
                                                    (modalScript.influencerName || '?').charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p 
                                                    onClick={() => setQuickViewId(modalScript.influencerId)}
                                                    className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                                                >
                                                    {modalScript.influencerName || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">{modalScript.influencerHandle || '@unknown'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Column: Script Content */}
                                <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 flex flex-col overflow-y-auto">
                                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mb-3">
                                        <span>Submitted {new Date(modalScript.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        {modalScript.reviewedAt && (
                                            <span>Reviewed {new Date(modalScript.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        )}
                                    </div>

                                    {hasScriptPreviewContent(modalScript) && (
                                        <SubmissionMediaViewer submission={modalScript as any} showEmptyState={false} />
                                    )}

                                    {modalScript.textContent && (
                                        <div className="mt-4 shrink-0 rounded-lg border border-border bg-secondary/30 overflow-hidden">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2.5 pb-1.5 border-b border-border/60">Script Description</p>
                                            <div className="p-3 text-sm whitespace-pre-wrap wrap-anywhere leading-6 italic max-h-64 overflow-y-auto scrollbar-thin">
                                                {renderScriptTextWithLinks(modalScript.textContent)}
                                            </div>
                                        </div>
                                    )}

                                    {(modalScript.reviewNote || (modalScript as any).externalReviewerName) && modalScript.status !== 'pending' && (
                                        <div className={cn(
                                            'flex items-start gap-2 p-3 rounded-lg text-xs mt-4',
                                            getScriptBadgeStatus(modalScript.status) === 'revision_requested'
                                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                : 'bg-secondary'
                                        )}>
                                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="font-bold">
                                                    {(modalScript as any).externalReviewerName
                                                        ? `Reviewed by ${(modalScript as any).externalReviewerName} (via shared link)`
                                                        : 'Reviewer note'}
                                                </p>
                                                {modalScript.reviewNote && (
                                                    <p className="break-words break-all whitespace-pre-wrap">{modalScript.reviewNote}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Actions + History */}
                                <div className="lg:col-span-3 lg:flex lg:flex-col gap-4 overflow-y-auto">
                                    {!isReadOnly && <div className="bg-secondary/30 border border-border rounded-xl p-4 shrink-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-wider">Actions</p>
                                        <CopyReviewLinkButton
                                            kind="script"
                                            shareToken={(modalScript as any).shareToken}
                                            disabled={modalScript.status !== 'pending'}
                                            className="w-full mb-2"
                                        />
                                        {modalScript.status === 'pending' ? (
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => {
                                                        setRevisionForScriptId(null);
                                                        setReviewNote('');
                                                        setAcceptForScriptId((prev) => (prev === modalScript.id ? null : modalScript.id));
                                                    }}
                                                    disabled={approveScript.isPending || requestRevision.isPending}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-premium disabled:opacity-50"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    Accept Script
                                                </button>

                                                {acceptForScriptId === modalScript.id && (
                                                    <div className="space-y-2 rounded-lg border border-border bg-background p-2">
                                                        <textarea
                                                            value={acceptNote}
                                                            onChange={(e) => setAcceptNote(e.target.value.slice(0, 300))}
                                                            rows={3}
                                                            maxLength={300}
                                                            placeholder="Add a message for the creator (optional)..."
                                                            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/20 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                                        />
                                                        <p className="text-right text-[10px] text-muted-foreground">{acceptNote.length}/300</p>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setAcceptForScriptId(null);
                                                                    setAcceptNote('');
                                                                }}
                                                                className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-secondary transition-premium"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleApprove(modalScript.id, acceptNote)}
                                                                disabled={approveScript.isPending}
                                                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-premium disabled:opacity-50 flex items-center gap-2"
                                                            >
                                                                {approveScript.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                                                Confirm Accept
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setAcceptForScriptId(null);
                                                        setAcceptNote('');
                                                        setRevisionForScriptId(modalScript.id);
                                                    }}
                                                    disabled={approveScript.isPending || requestRevision.isPending}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-premium disabled:opacity-50"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    Request Revision
                                                </button>

                                                {revisionForScriptId === modalScript.id && (
                                                    <div className="space-y-2 rounded-lg border border-border bg-background p-2">
                                                        <textarea
                                                            value={reviewNote}
                                                            onChange={(e) => setReviewNote(e.target.value.slice(0, 500))}
                                                            rows={4}
                                                            maxLength={500}
                                                            placeholder="Type your feedback here..."
                                                            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/20 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                                        />
                                                        <p className="text-right text-[10px] text-muted-foreground">{reviewNote.length}/500</p>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRevisionForScriptId(null);
                                                                    setReviewNote('');
                                                                }}
                                                                className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-secondary transition-premium"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleRequestRevision()}
                                                                disabled={requestRevision.isPending || !reviewNote.trim()}
                                                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-premium disabled:opacity-50 flex items-center gap-2"
                                                            >
                                                                {requestRevision.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                                                Send Feedback
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground text-center py-4 bg-background/50 rounded-lg border border-border">
                                                Already reviewed.
                                            </div>
                                        )}
                                    </div>}

                                    <div className="bg-secondary/20 border border-border rounded-xl p-3 shrink-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">
                                            Versions{selectedSlot && <span className="font-medium normal-case tracking-normal"> · {selectedSlot.label}</span>}
                                        </p>
                                        <div className="space-y-1.5 overflow-y-auto max-h-[300px] pr-1">
                                            {(() => {
                                                // Only the selected deliverable's scripts — a revision and its resubmission
                                                // are versions of one deliverable, not separate deliverables.
                                                const currentVersions = selectedSlot?.versions ?? [modalScript];

                                                // Version numbers are chronological: oldest submission is Script 1.
                                                const versionNumberById = new Map(
                                                    [...currentVersions]
                                                        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
                                                        .map((sv, index) => [sv.id, index + 1] as const)
                                                );

                                                return currentVersions.map((sv) => (
                                                    <button
                                                        key={sv.id}
                                                        type="button"
                                                        onClick={() => setOpenedScriptId(sv.id)}
                                                        className={cn(
                                                            'w-full text-left p-2 rounded-lg border text-[10px] transition-premium',
                                                            sv.id === modalScript.id
                                                                ? 'border-primary/50 bg-primary/5 shadow-sm'
                                                                : 'border-border bg-card hover:bg-secondary'
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className="font-bold flex items-center gap-1">
                                                                <FileText className="w-2.5 h-2.5" />
                                                                {`Script ${versionNumberById.get(sv.id) ?? 1}`}
                                                            </span>
                                                            {(sv.status === 'pending' || getScriptBadgeStatus(sv.status) === 'revision_requested') && (
                                                                <StatusBadge
                                                                    status={getScriptBadgeStatus(sv.status) as any}
                                                                    label={getScriptBadgeLabel(sv.status)}
                                                                    className="scale-75 origin-right"
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground opacity-70">
                                                            {new Date(sv.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        </p>
                                                    </button>
                                                ));
                                            })()}
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

            {/* Duplicate Script Detection Results Dialog */}
            {duplicateDialogOpen && (
                <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                    <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl gap-0 border flex flex-col max-h-[85vh]">
                        {detectingDuplicates ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center gap-5">
                                <div className="relative flex items-center justify-center">
                                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                                    <FileText className="w-6 h-6 text-primary absolute animate-pulse" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-lg font-bold text-foreground">Analyzing Campaign Scripts...</h3>
                                    <p className="text-xs text-muted-foreground max-w-sm">
                                        Downloading attached documents, extracting plain texts, and executing AI similarity checks to safeguard content freshness.
                                    </p>
                                </div>
                            </div>
                        ) : duplicateResult ? (
                            <div className="flex flex-col h-full max-h-[85vh]">
                                {/* Header */}
                                <div className="p-5 border-b border-border/60 flex items-center justify-between bg-card shrink-0">
                                    <div>
                                        <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                                            <Search className="w-4 h-4 text-primary" />
                                            AI Duplicate Detection Report
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Scanned {duplicateResult.scriptsReviewedCount} creator script submission{duplicateResult.scriptsReviewedCount !== 1 ? 's' : ''}.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDuplicateDialogOpen(false)}
                                        className="h-7 px-3 text-[10px] font-bold border rounded-lg bg-secondary hover:bg-secondary/80 transition"
                                    >
                                        Close
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Duplicate Alert Card */}
                                    {duplicateResult.hasDuplicates ? (
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3.5 items-start">
                                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Potential Duplicate Content Detected</h4>
                                                <p className="text-xs text-amber-700/85 dark:text-amber-400/80 mt-1 leading-relaxed">
                                                    Some creators have submitted scripts that share highly similar hooks, structures, or phrase patterns. Check the comparison report below.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex gap-3.5 items-start">
                                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-bold text-green-800 dark:text-green-400">Unique & Diverse Content Flow</h4>
                                                <p className="text-xs text-green-700/85 dark:text-green-400/80 mt-1 leading-relaxed">
                                                    AI analysis confirms all scripts have distinct hooks, unique structures, and diverse angles. Excellent freshness across the entire campaign!
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Duplicate Groups Details */}
                                    {duplicateResult.hasDuplicates && duplicateResult.duplicateGroups && duplicateResult.duplicateGroups.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Identified Similar Pairs</h4>
                                            <div className="grid gap-3">
                                                {duplicateResult.duplicateGroups.map((g: any, idx: number) => (
                                                    <div key={idx} className="rounded-xl border border-border/80 p-3.5 bg-muted/20 text-xs">
                                                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                                            <span className="font-bold text-foreground">
                                                                {g.creatorA} ↔️ {g.creatorB}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-extrabold text-[10px]">
                                                                {g.similarityScore}% Similar
                                                            </span>
                                                        </div>
                                                        <p className="text-muted-foreground leading-relaxed">{g.explanation}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Analysis Details */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Content Analysis & Recommendations</h4>
                                        <div 
                                            className="p-5 rounded-xl border bg-muted/10 text-xs text-foreground/80 leading-relaxed select-text font-sans space-y-3"
                                            dangerouslySetInnerHTML={{ __html: renderAnalysisMarkdown(duplicateResult.analysis) }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
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

