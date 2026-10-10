import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Award, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Info, Instagram, Link as LinkIcon, Loader2, MessageSquare, Send, Upload, X, RefreshCw, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { SubmissionMediaViewer } from './SubmissionMediaViewer';
import { InfluencerQuickView } from './InfluencerQuickView';
import { CopyReviewLinkButton } from './CopyReviewLinkButton';
import { CopyBulkReviewLinkButton } from './CopyBulkReviewLinkButton';
import { InstagramIcon, YoutubeIcon } from '@/shared/components/SocialIcons';
import { http } from '@/core/http';
import { useProofOfWorkSubmissions } from '../hooks/useSubmissions';
import { queryKeys } from '@/core/queryKeys';
import type { Campaign } from '@/shared/types/campaign';
import { FormatSlotsList } from './FormatSlotsList';
import { DeliverableSlotsPanel } from './DeliverableSlotsPanel';
import { buildDeliverableSlots } from '../utils/deliverableSlots';
import {
  aggregateFormatCardStatus,
  requiredSlotsFromCampaign,
  itemIndexOf,
  formatApprovalToast,
  formatCountLabel,
  formatSlotsFromItems,
  preferredReviewItem,
  slotItemLabel,
  proofInstagramFormat,
  remainingFormatsAfterApproval,
  isStoryProof,
} from '../utils/instagramContentFormat';
import { ProofOfWorkSkeleton } from './TabSkeletons';

interface ProofOfWorkSubmission {
  id: string;
  campaignInfluencerId: string;
  proofUrl: string;
  description?: string;
  /**
   * Which deliverable this proof belongs to. Campaigns running both Instagram and
   * YouTube get one proof row per platform (see submitProofOfWork on the backend),
   * each with its own approve/revise cycle. Null on legacy rows.
   */
  platform?: 'instagram' | 'youtube' | null;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  externalReviewerName?: string | null;
  metricSource?: string | null;
  metricStatus?: string | null;
  metricErrorCode?: string | null;
  metricsFetchedAt?: string | null;
  mediaId?: string | null;
  mediaType?: string | null;
  contentFormat?: string | null;
  /** 1-based item within its format ("Reel 2"). Absent on legacy rows → 1. */
  itemIndex?: number | null;
  scrapedLikes?: number | null;
  scrapedComments?: number | null;
  scrapedViews?: number | null;
  scrapedReach?: number | null;
  scrapedImpressions?: number | null;
  scrapedShares?: number | null;
  scrapedSaved?: number | null;
  scrapedTotalInteractions?: number | null;
  /** "4.52%" for Instagram; a bare number for older/YouTube rows. */
  scrapedEngagementRate?: string | null;
  platformMetrics?: Record<string, unknown> | null;
  providerExpiresAt?: string | null;
  finalCaptureDueAt?: string | null;
  finalCaptureStatus?: 'not_required' | 'pending' | 'captured' | 'missed';
  isFinal?: boolean;
  lastSuccessfulSyncAt?: string | null;
  ci: {
    id: string;
    influencerId: string;
    status?: string;
    agreedBudget?: string | number | null;
    tierRate?: string | number | null;
  };
  influencerId: string;
  influencerName: string;
  influencerHandle: string;
  influencerAvatar?: string | null;
}

interface ProofOfWorkTabProps {
  campaign: Campaign;
  submissions?: any[];
  isReadOnly?: boolean;
}

const formatDateSafe = (value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';

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

const platformMetricText = (metrics: Record<string, unknown> | null | undefined, key: string) => {
  const raw = metrics?.[key];
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
};
const submissionDisplayStatus = (status?: string | null) => {
  const normalized = String(status ?? '').toLowerCase();
  return normalized === 'rejected' ? 'revision_requested' : normalized;
};

function StoryLifecycleMessage({ proof }: { proof: ProofOfWorkSubmission }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const isLive = proof.providerExpiresAt && new Date(proof.providerExpiresAt).getTime() > Date.now();
    if (!isLive) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [proof.providerExpiresAt]);

  const isCapturedOrFrozen = proof.finalCaptureStatus === 'captured' || proof.isFinal || proof.metricStatus === 'frozen';
  if (isCapturedOrFrozen) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
        <Check className="w-3 h-3" />
        Final metrics captured &amp; frozen (Story expired)
      </span>
    );
  }

  if (proof.finalCaptureStatus === 'missed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <AlertTriangle className="w-3 h-3" />
        Final capture missed · showing last live values
      </span>
    );
  }

  const expiry = proof.providerExpiresAt ? new Date(proof.providerExpiresAt).getTime() : Number.NaN;
  if (!Number.isFinite(expiry) || expiry <= now) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border">
        <Clock className="w-3 h-3" />
        Story expired · metrics preserved
      </span>
    );
  }

  const remainingMinutes = Math.max(0, Math.ceil((expiry - now) / 60_000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
      Live Story · expires in {hours}h {minutes}m (auto-capture at ~22.5h)
    </span>
  );
}

type ProofPlatform = 'instagram' | 'youtube';

const PLATFORM_META: Record<ProofPlatform, { label: string; icon: typeof InstagramIcon; badgeClass: string; glyph: typeof Instagram; glyphClass: string }> = {
  instagram: {
    label: 'Instagram',
    icon: InstagramIcon,
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25',
    glyph: Instagram,
    glyphClass: 'text-pink-600',
  },
  youtube: {
    label: 'YouTube',
    icon: YoutubeIcon,
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25',
    glyph: Youtube,
    glyphClass: 'text-red-600',
  },
};

/**
 * The `platform` column is authoritative — it is what the backend keys the
 * per-platform submit/approve gates on. Legacy rows predate the column, so fall
 * back to sniffing the URL, and finally to null (rendered as a generic proof).
 */
const resolveProofPlatform = (proof: Pick<ProofOfWorkSubmission, 'platform' | 'proofUrl'>): ProofPlatform | null => {
  const explicit = String(proof.platform ?? '').toLowerCase();
  if (explicit === 'instagram' || explicit === 'youtube') return explicit;

  const url = String(proof.proofUrl ?? '').toLowerCase();
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
};

function PlatformBadge({ platform, className }: { platform: ProofPlatform | null; className?: string }) {
  if (!platform) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-card text-muted-foreground text-[11px] font-semibold', className)}>
        <LinkIcon className="w-3 h-3" />
        Proof Link
      </span>
    );
  }

  const { label, glyph: Glyph, glyphClass } = PLATFORM_META[platform];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-card text-[11px] font-semibold text-foreground', className)}>
      <Glyph className={cn('w-3 h-3 shrink-0', glyphClass)} strokeWidth={2.25} />
      {label}
    </span>
  );
}

export function ProofOfWorkTab({ campaign, submissions: initialSubmissions, isReadOnly }: ProofOfWorkTabProps) {
  const queryClient = useQueryClient();
  const [openedProofId, setOpenedProofId] = useState<string | null>(null);
  const [openedGroupKey, setOpenedGroupKey] = useState<string>('');
  const [modalProofSnapshot, setModalProofSnapshot] = useState<ProofOfWorkSubmission | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string>('');
  const [isRevisionFormOpen, setIsRevisionFormOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const { data: fetchedProofSubmissions = [], isLoading: isFetching, isError: isFetchError } = useProofOfWorkSubmissions(isReadOnly ? '' : campaign.id);
  const proofSubmissions = isReadOnly ? (initialSubmissions ?? []) : fetchedProofSubmissions;
  const isLoading = isReadOnly ? false : isFetching;
  const isError = isReadOnly ? false : isFetchError;
  const requiredSlots = useMemo(
    () => requiredSlotsFromCampaign(campaign),
    [campaign.deliverables, campaign.contentTypes],
  );

  /**
   * Reflect a review immediately on the reviewed proof. The refetch triggered by
   * the invalidation is the source of truth, but it lands a beat later — and since
   * the dialog now stays open, without this it would keep offering Approve /
   * Request Revision on an already-reviewed proof in the meantime.
   */
  const patchReviewedProofInCache = (proofId: string, updated: unknown, fallbackStatus: 'approved' | 'rejected') => {
    const patch = (updated && typeof updated === 'object' ? updated : {}) as Partial<ProofOfWorkSubmission>;
    const merge = (proof: ProofOfWorkSubmission): ProofOfWorkSubmission => ({
      ...proof,
      ...patch,
      status: patch.status ?? fallbackStatus,
      reviewedAt: patch.reviewedAt ?? new Date().toISOString(),
    });

    queryClient.setQueryData<ProofOfWorkSubmission[]>(
      queryKeys.campaigns.proofOfWork(campaign.id),
      (rows) => (Array.isArray(rows) ? rows.map((row) => (row.id === proofId ? merge(row) : row)) : rows),
    );
    setModalProofSnapshot((prev) => (prev && prev.id === proofId ? merge(prev) : prev));
  };

  const approveMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const response = await http.post(`/campaigns/${campaign.id}/submissions/proof-of-work/${proofId}/approve`, {});
      return response.data;
    },
    onSuccess: (data, proofId) => {
      // Keep the reviewed proof open and update it immediately while the server
      // refetch runs in the background.
      patchReviewedProofInCache(proofId, data?.data ?? data, 'approved');
      const approved = proofSubmissions.find((proof) => proof.id === proofId);
      const groupItems = proofSubmissions.filter((proof) => (
        (proof.influencerId ?? proof.influencerHandle ?? proof.influencerName ?? 'unknown')
        === (approved?.influencerId ?? approved?.influencerHandle ?? approved?.influencerName ?? 'unknown')
      ));
      const slots = formatSlotsFromItems(requiredSlots, groupItems);
      toast.success(formatApprovalToast(
        proofInstagramFormat(approved ?? {}),
        remainingFormatsAfterApproval(slots, proofInstagramFormat(approved ?? {}), itemIndexOf(approved ?? {})),
        { itemIndex: approved?.itemIndex, slots },
      ));
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.proofOfWork(campaign.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Failed to approve proof of work');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const response = await http.post(`/campaigns/${campaign.id}/submissions/proof-of-work/${proofId}/reject`, {
        reviewNote: revisionMessage.trim(),
      });
      return response.data;
    },
    onSuccess: (data, proofId) => {
      // Same as approve: stay on this proof until the reviewer closes the dialog.
      patchReviewedProofInCache(proofId, data?.data ?? data, 'rejected');
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.proofOfWork(campaign.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) });
      toast.success('Proof revision requested');
      setRevisionMessage('');
      setIsRevisionFormOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Failed to request proof revision');
    },
  });

  // One group (one card) per creator. A campaign running both Instagram and YouTube
  // produces an independent proof chain per platform inside that one card — each
  // proof is tagged with the platform it belongs to rather than being split out.
  const groups = useMemo(() => {
    const byKey = new Map<string, { key: string; proofs: ProofOfWorkSubmission[] }>();

    for (const proof of proofSubmissions as ProofOfWorkSubmission[]) {
      const key = proof.influencerId ?? proof.influencerHandle ?? proof.influencerName ?? 'unknown';
      const existing = byKey.get(key);
      if (existing) {
        existing.proofs.push(proof);
      } else {
        byKey.set(key, { key, proofs: [proof] });
      }
    }

    return [...byKey.values()].map((group) => {
      const proofs = [...group.proofs].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      // Distinct platforms present, newest-first so the card lists them in the
      // same order the proofs appear.
      const platforms = [...new Set(proofs.map(resolveProofPlatform))] as Array<ProofPlatform | null>;
      return { ...group, proofs, platforms };
    });
  }, [proofSubmissions]);

  const flatProofs = useMemo(() => {
    return [...proofSubmissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [proofSubmissions]);

  const openProofModal = (proof: ProofOfWorkSubmission) => {
    setOpenedGroupKey(proof.influencerId ?? proof.influencerHandle ?? proof.influencerName ?? 'unknown');
    setModalProofSnapshot(proof);
    setOpenedProofId(proof.id);
  };

  const navigateProof = (direction: 'next' | 'prev') => {
    const currentIndex = groups.findIndex((group) => group.key === openedGroupKey);
    if (currentIndex === -1) return;

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) nextIndex = groups.length - 1;
    if (nextIndex >= groups.length) nextIndex = 0;

    const nextGroup = groups[nextIndex];
    if (nextGroup?.proofs?.[0]) {
      openProofModal(nextGroup.proofs[0]);
    }
  };

  const modalProof = useMemo(() => {
    if (!openedProofId) return null;
    return proofSubmissions.find((proof) => proof.id === openedProofId) || modalProofSnapshot;
  }, [openedProofId, proofSubmissions, modalProofSnapshot]);

  useEffect(() => {
    if (!openedProofId) return;
    const latest = proofSubmissions.find((proof) => proof.id === openedProofId);
    if (latest) setModalProofSnapshot(latest);
  }, [openedProofId, proofSubmissions]);

  useEffect(() => {
    setRevisionMessage('');
    setIsRevisionFormOpen(false);
  }, [openedProofId]);

  useEffect(() => {
    if (openedProofId) return;
    document.body.style.pointerEvents = '';
  }, [openedProofId]);

  const openedGroup = useMemo(
    () => groups.find((group) => group.key === openedGroupKey) ?? null,
    [groups, openedGroupKey],
  );

  // Platform of the proof currently on screen — the creator's history can hold
  // both, so this tracks the open proof rather than the group.
  const modalPlatform = modalProof ? resolveProofPlatform(modalProof) : null;

  const modalHistory = useMemo(() => {
    if (!modalProof) return [] as ProofOfWorkSubmission[];
    const grouped = openedGroup?.proofs ?? [];
    const seen = new Set<string>();

    return [...grouped]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [modalProof, openedGroup]);

  // The opened creator's proofs grouped by deliverable: left column lists the deliverables,
  // right column only the selected deliverable's versions. A deliverable is format + item,
  // so an Instagram reel and a YouTube short are separate rows with separate histories.
  const modalSlots = useMemo(
    () => buildDeliverableSlots(requiredSlots, modalHistory),
    [requiredSlots, modalHistory],
  );
  const selectedSlotKey = modalProof ? modalSlots.keyOf(modalProof) : null;
  const selectedSlot = modalSlots.slots.find((slot) => slot.key === selectedSlotKey) ?? null;
  // Oldest first is Proof 1; the list itself shows newest first.
  const slotVersions = selectedSlot?.versions ?? (modalProof ? [modalProof] : []);
  const proofNumberById = useMemo(
    () => new Map([...slotVersions].reverse().map((proof, index) => [proof.id, index + 1] as const)),
    [slotVersions],
  );

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

  if (isLoading) return <ProofOfWorkSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Award className="w-8 h-8 text-destructive/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Failed to load proof of work</h3>
        <p className="text-sm text-muted-foreground">Could not fetch submissions. Please refresh and try again.</p>
      </div>
    );
  }

  if (flatProofs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <Award className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No proof of work submissions</h3>
        <p className="text-sm text-muted-foreground">Influencers will submit proof of work here when required</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:gap-6", !isReadOnly && "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]")}>
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-black">
              <Award className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold leading-6 tracking-tight">Proof of Work</h2>
              <p className="text-xs text-muted-foreground">Share one link to let anyone review every proof submission for this campaign.</p>
            </div>
          </div>
          {/* Where the proofs stand: waiting on you, approved. */}
          {groups.length > 0 && (() => {
            const waiting = groups.filter((group) => group.proofs.some((proof) => proof.status === 'pending')).length;
            return (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold', waiting > 0 ? 'bg-brand text-black' : 'bg-secondary text-muted-foreground')}>
                  <span className="tabular-nums">{waiting}</span> to review
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="tabular-nums">{groups.length - waiting}</span> approved
                </span>
              </div>
            );
          })()}
          {!isReadOnly && (
            <CopyBulkReviewLinkButton
              kind="proof"
              campaignId={campaign.id}
              disabled={proofSubmissions.length === 0}
              disabledReason="No proof of work submissions yet — nothing to share."
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {groups.map((group) => {
            const latestProof = preferredReviewItem(group.proofs, requiredSlots) ?? group.proofs[0];
            if (!latestProof) return null;
            const slots = formatSlotsFromItems(requiredSlots, group.proofs);
            const countLabel = formatCountLabel(group.proofs.length, slots);
            const cardStatus = aggregateFormatCardStatus(slots) ?? submissionDisplayStatus(latestProof.status);
            // Waiting on the brand: yellow outline, like Scripts and Work Submissions.
            const isWaiting = group.proofs.some((proof) => proof.status === 'pending');

            return (
              <div
                key={group.key}
                role="button"
                tabIndex={0}
                onClick={() => openProofModal(latestProof)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProofModal(latestProof);
                  }
                }}
                className={cn(
                  "text-left border rounded-2xl p-4 flex flex-col justify-between group cursor-pointer shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
                  isWaiting ? "border-brand bg-brand/5 hover:border-foreground/40" : "border-border bg-card hover:border-foreground/20",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewId(latestProof.influencerId);
                      }}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 cursor-pointer ring-2 ring-brand/40 ring-offset-1 ring-offset-card hover:ring-brand transition-all"
                    >
                      {latestProof.influencerAvatar ? (
                        <ApiImage src={latestProof.influencerAvatar} alt={latestProof.influencerName} className="w-full h-full object-cover" />
                      ) : (
                        latestProof.influencerName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewId(latestProof.influencerId);
                        }}
                        className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                      >
                        {latestProof.influencerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{latestProof.influencerHandle || ''}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={cardStatus as any} />
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {group.platforms.map((platform) => (
                    <PlatformBadge key={platform ?? 'other'} platform={platform} />
                  ))}
                  {slots.length <= 1 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/75">
                      <LinkIcon className="w-3 h-3" />
                      {slotItemLabel(latestProof, requiredSlots)}
                    </span>
                  )}
                  {countLabel && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold lowercase tracking-normal">
                      {countLabel}
                    </span>
                  )}
                </div>
                {slots.length > 1 && <FormatSlotsList slots={slots} />}

                <p className="flex min-w-0 items-center gap-1.5 rounded-xl bg-secondary/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{latestProof.proofUrl}</span>
                </p>
                {isStoryProof(latestProof) && (
                  <div className="mt-1.5"><StoryLifecycleMessage proof={latestProof} /></div>
                )}

                <div className="mt-3 pt-3 border-t border-dashed border-border flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(latestProof.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {!isReadOnly && latestProof.status === 'pending' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void approveMutation.mutateAsync(latestProof.id);
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="group/approve inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-brand bg-brand/20 pl-1 pr-3 text-xs font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand hover:shadow-card active:translate-y-0 active:scale-[0.97] disabled:opacity-50"
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-card shadow-sm transition-transform duration-200 group-hover/approve:scale-110">
                        {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      Approve {slotItemLabel(latestProof, requiredSlots)}
                    </button>
                  )}
                  {(isReadOnly || latestProof.status !== 'pending') && (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-foreground/60 transition-colors duration-200 group-hover:bg-foreground group-hover:text-brand">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isReadOnly && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 p-4 sm:p-5 shadow-card lg:sticky lg:top-20">
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
            <div className="relative flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2.5 font-display text-base font-semibold tracking-tight">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-black"><Info className="h-4 w-4" /></span>
                How it works
              </h3>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.proofOfWork(campaign.id) });
                  queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) });
                  toast.success('Refreshed proof of work submissions');
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-foreground hover:text-foreground"
                title="Refresh submissions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {/* The three facts as numbered steps, like the builder's stepper. */}
            <ol className="relative space-y-3 text-xs text-muted-foreground">
              {[
                'Creators post their content and share the live link here.',
                "Approve every required format to mark the creator's campaign complete.",
                'Final payment is collected in the Work Submissions tab once work is approved.',
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-brand">{i + 1}</span>
                  <span className="leading-5">{step}</span>
                </li>
              ))}
            </ol>
            <p className="relative mt-4 flex items-baseline justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs shadow-sm">
              <span className="text-muted-foreground">Campaign budget</span>
              <span className="font-semibold tabular-nums">{formatTierPricing()}</span>
            </p>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(openedProofId)}
        onOpenChange={(open) => {
          if (!open) {
            setOpenedProofId(null);
            setModalProofSnapshot(null);
            setRevisionMessage('');
            setIsRevisionFormOpen(false);
          }
        }}
      >
        {modalProof && (
          <DialogContent className="max-w-[1600px] w-[97vw] h-[94vh] max-h-[94vh] overflow-hidden p-0 flex flex-col">
            <DialogHeader className="p-4 md:p-5 border-b border-border shrink-0">
              <DialogTitle className="flex flex-wrap items-center gap-3 pr-10">
                <span className="flex items-center gap-2 text-sm md:text-base">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  Proof of Work Details
                </span>
                <PlatformBadge platform={modalPlatform} />
                <StatusBadge status={submissionDisplayStatus(modalProof.status) as any} />
              </DialogTitle>
              <DialogDescription className="sr-only">
                Review proof of work submission, take approval actions, and inspect submission history.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 md:p-5 relative">
              {groups.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateProof('prev');
                    }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-xl hover:bg-primary hover:text-primary-foreground transition-premium group"
                    title="Previous Creator"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateProof('next');
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-xl hover:bg-primary hover:text-primary-foreground transition-premium group"
                    title="Next Creator"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  <div className="absolute top-2 right-4 z-50 px-2 py-1 rounded-md bg-secondary/50 backdrop-blur-sm text-[10px] font-bold text-muted-foreground">
                    {groups.findIndex((group) => group.key === openedGroupKey) + 1} / {groups.length}
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:h-full">
                {/* Left Column: Campaign Details, Deliverables, Creator */}
                <div className="flex flex-col lg:col-span-3 gap-4 lg:h-full lg:overflow-hidden">
                  <div className="hidden lg:block bg-secondary/30 border border-border rounded-xl p-4 shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">Campaign Details</p>
                    <p className="text-sm font-semibold">{campaign.name}</p>
                    <div className="space-y-1.5 mt-2 text-[11px]">
                      <p><span className="text-muted-foreground">Type:</span> <span className="capitalize">{campaign.type}</span></p>
                      <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{campaign.status}</span></p>
                      <p>
                        <span className="text-muted-foreground">Budget:</span>{' '}
                        {formatTierPricing()}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Deadline:</span>{' '}
                        {formatDateSafe(campaign.workDeadline || campaign.timeline?.workDeadline || campaign.deadline, { day: 'numeric', month: 'short' })}
                      </p>
                      {(campaign.proofOfWorkRequired || campaign.proofOfWorkReq) && (
                        <p>
                          <span className="text-muted-foreground">Proof Deadline:</span>{' '}
                          {formatDateSafe(campaign.proofOfWorkDeadline || campaign.timeline?.proofOfWorkDeadline, { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <DeliverableSlotsPanel
                    slots={modalSlots.slots}
                    selectedKey={selectedSlotKey}
                    versionNoun="proof"
                    onSelect={(slot) => slot.versions[0]?.id && setOpenedProofId(slot.versions[0].id)}
                    className="lg:flex-1 lg:min-h-0 overflow-y-auto scrollbar-thin"
                  />

                  <div className="hidden lg:block bg-card border border-border rounded-2xl p-4 shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-wider">Creator</p>
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setQuickViewId(modalProof.influencerId)}
                        className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-[#fedc03] transition-all"
                      >
                        {modalProof.influencerAvatar ? (
                          <ApiImage src={modalProof.influencerAvatar} alt={modalProof.influencerName || ''} className="w-full h-full object-cover" />
                        ) : (
                          (modalProof.influencerName || '?').charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          onClick={() => setQuickViewId(modalProof.influencerId)}
                          className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                        >
                          {modalProof.influencerName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{modalProof.influencerHandle || ''}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col overflow-y-visible lg:overflow-y-auto lg:scrollbar-hide">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mb-3">
                    <span>
                      Submitted {formatDateSafe(modalProof.submittedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {modalProof.reviewedAt && (
                      <span>
                        Reviewed {formatDateSafe(modalProof.reviewedAt, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  <SubmissionMediaViewer
                    submission={{
                      ...modalProof,
                      proofOfWorkUrl: modalProof.proofUrl,
                      url: modalProof.proofUrl,
                    }}
                  />

                  {modalProof.description && (
                    <div className="mt-4 shrink-0 rounded-lg border border-border bg-secondary/30 overflow-hidden">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2.5 pb-1.5 border-b border-border/60">Description</p>
                      <div className="p-3 text-sm whitespace-pre-wrap leading-6 italic max-h-64 overflow-y-auto scrollbar-thin">
                        "{modalProof.description}"
                      </div>
                    </div>
                  )}

                  {(modalProof.reviewNote || modalProof.externalReviewerName) && modalProof.status !== 'pending' && (
                    <div className={cn(
                      'flex items-start gap-2 p-3 rounded-lg text-xs mt-4',
                      modalProof.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-secondary',
                    )}>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-bold">
                          {modalProof.externalReviewerName
                            ? `Reviewed by ${modalProof.externalReviewerName} (via shared link)`
                            : 'Reviewer note'}
                        </p>
                        {modalProof.reviewNote && (
                          <p className="break-words break-all whitespace-pre-wrap">{modalProof.reviewNote}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 flex min-h-0 flex-col gap-3 sm:gap-4 overflow-y-auto scrollbar-thin">
                  {!isReadOnly && <div className="bg-secondary/30 border border-border rounded-xl p-3 sm:p-4 shrink-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-wider">Actions</p>
                    <CopyReviewLinkButton
                      kind="proof"
                      shareToken={(modalProof as any).shareToken}
                      disabled={modalProof.status !== 'pending'}
                      className="w-full mb-3"
                    />
                    {modalProof.status === 'pending' ? (
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => {
                            void approveMutation.mutateAsync(modalProof.id);
                          }}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-premium disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => setIsRevisionFormOpen((prev) => !prev)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-premium disabled:opacity-50"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Request Revision
                        </button>

                        {isRevisionFormOpen && (
                          <div className="space-y-2 rounded-lg border border-border bg-background p-2">
                            <textarea
                              value={revisionMessage}
                              onChange={(e) => setRevisionMessage(e.target.value.slice(0, 500))}
                              maxLength={500}
                              placeholder="Specify what needs to be improved..."
                              className="w-full text-xs p-2 rounded-md border border-border bg-background resize-none min-h-[88px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <p className="text-right text-[10px] text-muted-foreground">{revisionMessage.length}/500</p>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsRevisionFormOpen(false);
                                  setRevisionMessage('');
                                }}
                                className="h-8 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-premium"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={rejectMutation.isPending || !revisionMessage.trim()}
                                onClick={() => {
                                  void rejectMutation.mutateAsync(modalProof.id);
                                }}
                                className="h-8 px-3 rounded-md border border-amber-600/30 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-premium disabled:opacity-50"
                              >
                                Send
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
                    <div className="space-y-1.5 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
                      {slotVersions.map((proof) => {
                        const isOpenable = proofSubmissions.some((submission) => submission.id === proof.id);
                        return (
                          <button
                            key={proof.id}
                            type="button"
                            onClick={() => isOpenable && setOpenedProofId(proof.id)}
                            disabled={!isOpenable}
                            className={cn(
                              'w-full text-left p-2 rounded-lg border text-[10px] transition-premium',
                              proof.id === modalProof.id
                                ? 'border-primary/50 bg-primary/5 shadow-sm'
                                : 'border-border bg-card hover:bg-secondary',
                              !isOpenable && 'opacity-80 cursor-default',
                            )}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-bold flex items-center gap-1">
                                <Upload className="w-2.5 h-2.5" />
                                {`Proof ${proofNumberById.get(proof.id) ?? 1}`}
                              </span>
                              <StatusBadge status={submissionDisplayStatus(proof.status) as any} className="scale-75 origin-right" />
                            </div>
                            <p className="text-muted-foreground opacity-70">
                              {formatDateSafe(proof.submittedAt, { day: 'numeric', month: 'short' })}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Proof analytics — every metric fetched from the platform for this proof. The
                      post itself (and its link) is in the centre column, so no URLs repeat here. */}
                  <ProofAnalyticsPanel proof={modalProof} formatLabel={slotItemLabel(modalProof, requiredSlots)} />
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {quickViewId && !isReadOnly && (
        <InfluencerQuickView
          influencerId={quickViewId}
          onClose={() => setQuickViewId(null)}
        />
      )}
    </div>
  );
}

const compactNumber = (value: number) => value.toLocaleString('en-IN');

const secondsLabel = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${m}m ${rest}s` : `${m}m`;
};

const metricNum = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

// metric_source values written by the backend; any other youtube_* source is YouTube-verified.
const metricSourceLabel = (source: string): string => {
  if (source === 'meta_graph') return 'Verified via Instagram';
  if (source === 'legacy_unverified') return 'Unverified';
  if (source.startsWith('youtube')) return 'Verified via YouTube';
  return source.replace(/_/g, ' ');
};

function ProofAnalyticsPanel({ proof, formatLabel }: { proof: ProofOfWorkSubmission; formatLabel: string }) {
  const pm = (proof.platformMetrics ?? {}) as Record<string, unknown>;
  const isYouTube = proof.platform === 'youtube' || proof.metricSource?.startsWith('youtube');

  const engagement = proof.scrapedEngagementRate
    ? (proof.scrapedEngagementRate.includes('%') ? proof.scrapedEngagementRate : `${proof.scrapedEngagementRate}%`)
    : null;

  // Headline numbers first, then the platform-specific ones. Empty metrics are skipped
  // rather than shown as a wall of dashes.
  const tiles: Array<{ label: string; value: string | null }> = [
    { label: 'Views', value: proof.scrapedViews != null ? compactNumber(proof.scrapedViews) : null },
    { label: 'Reach', value: proof.scrapedReach != null ? compactNumber(proof.scrapedReach) : null },
    { label: 'Likes', value: proof.scrapedLikes != null ? compactNumber(proof.scrapedLikes) : null },
    { label: 'Comments', value: proof.scrapedComments != null ? compactNumber(proof.scrapedComments) : null },
    { label: 'Shares', value: proof.scrapedShares != null ? compactNumber(proof.scrapedShares) : null },
    { label: 'Saves', value: proof.scrapedSaved != null ? compactNumber(proof.scrapedSaved) : null },
    { label: 'Interactions', value: proof.scrapedTotalInteractions != null ? compactNumber(proof.scrapedTotalInteractions) : null },
    { label: 'Engagement', value: engagement },
    { label: 'Impressions', value: proof.scrapedImpressions != null ? compactNumber(proof.scrapedImpressions) : null },
  ];
  if (isYouTube) {
    const minutes = metricNum(pm.estimatedMinutesWatched);
    const avgDuration = metricNum(pm.averageViewDuration);
    const avgPct = metricNum(pm.averageViewPercentage);
    const subs = metricNum(pm.subscribersGained);
    const engaged = metricNum(pm.engagedViews);
    tiles.push(
      { label: 'Watch time', value: minutes != null ? `${compactNumber(Math.round(minutes))} min` : null },
      { label: 'Avg. view duration', value: avgDuration != null ? secondsLabel(avgDuration) : null },
      { label: 'Avg. viewed', value: avgPct != null ? `${avgPct.toFixed(1)}%` : null },
      { label: 'Subscribers gained', value: subs != null ? compactNumber(subs) : null },
      { label: 'Engaged views', value: engaged != null ? compactNumber(engaged) : null },
    );
  } else {
    const avgWatchMs = metricNum(pm.ig_reels_avg_watch_time);
    const totalWatchMs = metricNum(pm.ig_reels_video_view_total_time);
    const replies = metricNum(pm.replies);
    const follows = metricNum(pm.follows);
    tiles.push(
      { label: 'Avg. watch time', value: avgWatchMs != null ? secondsLabel(avgWatchMs / 1000) : null },
      { label: 'Total watch time', value: totalWatchMs != null ? secondsLabel(totalWatchMs / 1000) : null },
      { label: 'Replies', value: replies != null ? compactNumber(replies) : null },
      { label: 'Follows', value: follows != null ? compactNumber(follows) : null },
    );
  }
  const shown = tiles.filter((t) => t.value != null);
  const caption = platformMetricText(proof.platformMetrics, 'caption') ?? (typeof pm.title === 'string' ? pm.title : null);

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shrink-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proof Analytics</p>
        {proof.metricSource && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {metricSourceLabel(proof.metricSource)}
          </span>
        )}
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
          {shown.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-secondary/40 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground truncate">{tile.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{tile.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">No metrics fetched yet.</p>
      )}

      <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Format</dt>
          <dd className="font-semibold">{formatLabel || '—'}</dd>
        </div>
        {proof.metricsFetchedAt && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="font-medium">
              {new Date(proof.metricsFetchedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </dd>
          </div>
        )}
      </dl>

      {isStoryProof(proof) && (
        <div className="mt-2.5"><StoryLifecycleMessage proof={proof} /></div>
      )}

      {caption && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{isYouTube ? 'Video title' : 'Caption'}</p>
          <p className="mt-1 max-h-28 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words text-xs leading-5">{caption}</p>
        </div>
      )}
    </div>
  );
}
