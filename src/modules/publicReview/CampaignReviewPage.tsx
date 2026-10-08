/**
 * Campaign-scoped public review page (one URL → all submissions of one kind).
 *
 * Mounted at /review/campaign/:kind/:token (outside AppShell, no auth).
 * Anyone with the URL sees every script/work/proof for the campaign and can
 * accept or request-revision on each one inline. The reviewer types their
 * name once at the top; that name is sent with every per-item action.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Check, X, FileText, MessageSquare, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SubmissionMediaViewer } from '@/modules/campaigns/components/SubmissionMediaViewer';
import { MutinyXLogo } from '@/shared/components/MutinyXLogo';

type Kind = 'script' | 'work' | 'proof';
const ALLOWED_KINDS: Kind[] = ['script', 'work', 'proof'];

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const publicHttp = axios.create({
    baseURL: API_BASE,
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
});

interface CampaignReviewItem {
    id: string;
    status: string;
    submittedAt?: string;
    reviewedAt?: string | null;
    reviewNote?: string | null;
    externalReviewerName?: string | null;
    versionNumber?: number;
    influencerName?: string | null;
    influencerHandle?: string | null;
    influencerAvatar?: string | null;
    [key: string]: unknown;
}

interface CampaignReviewPayload {
    kind: Kind;
    campaign: {
        id: string;
        name: string;
        type: string;
        objective?: string | null;
        brief?: string | null;
        scriptDeadline?: string | null;
        workDeadline?: string | null;
        proofOfWorkDeadline?: string | null;
    } | null;
    brandName: string | null;
    items: CampaignReviewItem[];
}

const KIND_LABELS: Record<Kind, { title: string; subtitle: string; itemNoun: string }> = {
    script: {
        title: 'Scripts Review',
        subtitle: 'Review and decide on every script the creators submitted for this campaign.',
        itemNoun: 'script',
    },
    work: {
        title: 'Work Submissions Review',
        subtitle: 'Review and decide on every content submission the creators uploaded.',
        itemNoun: 'work submission',
    },
    proof: {
        title: 'Proof of Work Review',
        subtitle: 'Review and decide on every proof-of-work link the creators shared.',
        itemNoun: 'proof submission',
    },
};

function statusPillClasses(status: string) {
    const s = String(status ?? '').toLowerCase();
    if (s === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'rejected' || s === 'revision_requested') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-[#fedc03]/15 text-[#0a0a0a] border-[#fedc03]/40';
}

function statusLabel(status: string) {
    const s = String(status ?? '').toLowerCase();
    if (s === 'pending') return 'Pending';
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Revision Requested';
    if (s === 'revision_requested') return 'Revision Requested';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(value?: string | null) {
    if (!value) return null;
    try {
        return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return null;
    }
}

export default function CampaignReviewPage() {
    const { kind: kindParam, token } = useParams<{ kind: string; token: string }>();
    const kind = (ALLOWED_KINDS.includes(kindParam as Kind) ? kindParam : null) as Kind | null;

    const [data, setData] = useState<CampaignReviewPayload | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewerName, setReviewerName] = useState('');
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [search, setSearch] = useState('');

    const refetch = async () => {
        if (!kind || !token) return;
        try {
            const res = await publicHttp.get(`/public/review/campaign/${kind}/${token}`);
            setData((res.data?.data ?? res.data) as CampaignReviewPayload);
        } catch (err: any) {
            const status = err?.response?.status;
            const msg = err?.response?.data?.error?.message
                || err?.response?.data?.message
                || (status === 404 ? 'This review link is invalid or has been removed.' : 'Could not load this review link.');
            setLoadError(msg);
        }
    };

    useEffect(() => {
        if (!kind || !token) {
            setLoadError('Invalid review link.');
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);
        publicHttp
            .get(`/public/review/campaign/${kind}/${token}`)
            .then((res) => {
                if (cancelled) return;
                setData((res.data?.data ?? res.data) as CampaignReviewPayload);
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                const msg = err?.response?.data?.error?.message
                    || err?.response?.data?.message
                    || (status === 404 ? 'This review link is invalid or has been removed.' : 'Could not load this review link.');
                setLoadError(msg);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [kind, token]);

    const isNameEntered = reviewerName.trim().length > 0;

    const filteredItems = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.items
            .filter((it) => {
                const status = String(it.status ?? '').toLowerCase();
                if (filter === 'pending' && status !== 'pending') return false;
                if (q) {
                    const hay = [it.influencerName ?? '', it.influencerHandle ?? '', it.id]
                        .map((v) => String(v).toLowerCase())
                        .join(' ');
                    if (!hay.includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                // Pending first, then newest submitted.
                const aPending = String(a.status).toLowerCase() === 'pending' ? 0 : 1;
                const bPending = String(b.status).toLowerCase() === 'pending' ? 0 : 1;
                if (aPending !== bPending) return aPending - bPending;
                const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                return bt - at;
            });
    }, [data, filter, search]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (loadError || !data || !kind) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Link unavailable</h1>
                    <p className="text-sm text-muted-foreground">{loadError ?? 'Could not load this review link.'}</p>
                </div>
            </div>
        );
    }

    const labels = KIND_LABELS[kind];
    const totalCount = data.items.length;
    const pendingCount = data.items.filter((it) => String(it.status).toLowerCase() === 'pending').length;
    const approvedCount = data.items.filter((it) => String(it.status).toLowerCase() === 'approved').length;
    const reviseCount = data.items.filter((it) => {
        const s = String(it.status).toLowerCase();
        return s === 'rejected' || s === 'revision_requested';
    }).length;

    return (
        <div className="min-h-screen bg-background">
            {/* Branded sticky header */}
            <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <MutinyXLogo className="h-4" />
                        <div className="min-w-0 border-l border-border pl-2.5">
                            <p className="text-xs text-muted-foreground truncate">
                                {data.brandName ? `Bulk review request from ${data.brandName}` : 'Bulk submission review'}
                            </p>
                        </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {pendingCount} pending · {approvedCount} approved · {reviseCount} revisions
                    </span>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                {/* Title block */}
                <div className="pl-3 border-l-4 border-[#fedc03]">
                    <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
                </div>

                {/* Campaign card */}
                {data.campaign && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Campaign</p>
                        <p className="text-base font-semibold mt-1">{data.campaign.name}</p>
                        {data.campaign.objective && (
                            <p className="text-xs text-muted-foreground mt-1">{data.campaign.objective}</p>
                        )}
                        {data.campaign.brief && (
                            <p className="text-xs text-foreground/70 mt-2 leading-relaxed line-clamp-3">{data.campaign.brief}</p>
                        )}
                    </div>
                )}

                {/* Reviewer name (sticky-ish) */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <label className="block">
                        <span className="text-xs font-medium text-foreground/80">Your name <span className="text-destructive">*</span></span>
                        <input
                            type="text"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            placeholder="e.g. Priya Sharma"
                            className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                            maxLength={120}
                        />
                        <span className="text-[11px] text-muted-foreground mt-1 inline-block">
                            Used for every decision you make below. The brand sees this name alongside each action.
                        </span>
                    </label>
                </div>

                {/* Filter + search */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="inline-flex bg-card border border-border rounded-lg p-1 shrink-0">
                        <button
                            onClick={() => setFilter('pending')}
                            className={cn(
                                'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
                                filter === 'pending' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            Pending ({pendingCount})
                        </button>
                        <button
                            onClick={() => setFilter('all')}
                            className={cn(
                                'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
                                filter === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            All ({totalCount})
                        </button>
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by creator name or handle..."
                            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                {/* Items list */}
                {filteredItems.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-10 text-center">
                        <p className="text-sm font-semibold">Nothing to show</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {filter === 'pending'
                                ? `No pending ${labels.itemNoun}s — every submission has been reviewed.`
                                : 'No submissions match your filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredItems.map((item) => (
                            <ReviewItemCard
                                key={item.id}
                                item={item}
                                kind={kind}
                                token={token!}
                                reviewerName={reviewerName}
                                isNameEntered={isNameEntered}
                                onActionDone={refetch}
                            />
                        ))}
                    </div>
                )}

                <p className="text-[11px] text-muted-foreground text-center mt-6">
                    Powered by Mutiny · Each decision becomes final once submitted. The link stays valid for any remaining pending {labels.itemNoun}s.
                </p>
            </div>
        </div>
    );
}

interface ReviewItemCardProps {
    item: CampaignReviewItem;
    kind: Kind;
    token: string;
    reviewerName: string;
    isNameEntered: boolean;
    onActionDone: () => void | Promise<void>;
}

function ReviewItemCard({ item, kind, token, reviewerName, isNameEntered, onActionDone }: ReviewItemCardProps) {
    const [expandedAction, setExpandedAction] = useState<'accept' | 'reject' | null>(null);
    const [acceptNote, setAcceptNote] = useState('');
    const [rejectNote, setRejectNote] = useState('');
    const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(null);

    const status = String(item.status ?? '').toLowerCase();
    const isPending = status === 'pending';
    const submittedAtText = formatDate(item.submittedAt);

    // proof submissions store the URL in `proofUrl`; mirror it for the viewer.
    const submissionForViewer = useMemo(() => {
        if (kind !== 'proof') return item as Record<string, unknown>;
        const proofUrl = (item as any).proofUrl;
        return {
            ...item,
            url: proofUrl,
            externalUrl: proofUrl,
            proofOfWorkUrl: proofUrl,
        } as Record<string, unknown>;
    }, [item, kind]);

    const submitAction = async (action: 'accept' | 'reject') => {
        const trimmedName = reviewerName.trim();
        if (!trimmedName) {
            toast.error('Please enter your name at the top of the page.');
            return;
        }
        if (action === 'reject' && !rejectNote.trim()) {
            toast.error('Please add a note explaining what to change.');
            return;
        }

        const path = action === 'accept' ? 'approve' : 'reject';
        const body: Record<string, string> = { reviewerName: trimmedName };
        if (action === 'accept' && acceptNote.trim()) body.reviewNote = acceptNote.trim();
        if (action === 'reject') body.reviewNote = rejectNote.trim();

        setPendingAction(action);
        try {
            await publicHttp.post(
                `/public/review/campaign/${kind}/${token}/items/${item.id}/${path}`,
                body,
            );
            toast.success(action === 'accept' ? 'Submission approved.' : 'Revision requested.');
            setExpandedAction(null);
            setAcceptNote('');
            setRejectNote('');
            await onActionDone();
        } catch (err: any) {
            const msg = err?.response?.data?.error?.message
                || err?.response?.data?.message
                || `Could not ${action === 'accept' ? 'approve' : 'request revision for'} this submission.`;
            toast.error(msg);
        } finally {
            setPendingAction(null);
        }
    };

    const initial = (item.influencerName?.charAt(0) ?? '?').toUpperCase();

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-foreground text-background flex items-center justify-center text-xs font-bold border border-border shrink-0">
                        <span aria-hidden="true">{initial}</span>
                        {item.influencerAvatar && (
                            <img
                                src={item.influencerAvatar}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{item.influencerName ?? 'Unknown creator'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                            {item.influencerHandle ? `@${item.influencerHandle}` : '—'}
                            {submittedAtText ? ` · Submitted ${submittedAtText}` : ''}
                            {item.versionNumber ? ` · v${item.versionNumber}` : ''}
                        </p>
                    </div>
                </div>
                <span className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                    statusPillClasses(status),
                )}>
                    {statusLabel(status)}
                </span>
            </div>

            {/* Submission preview */}
            <div className="p-5 space-y-3">
                <SubmissionMediaViewer submission={submissionForViewer as any} showEmptyState={false} />

                {typeof (item as any).textContent === 'string' && (item as any).textContent.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm whitespace-pre-wrap leading-6 italic">
                        {String((item as any).textContent)}
                    </div>
                )}
                {typeof (item as any).description === 'string' && (item as any).description.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm whitespace-pre-wrap leading-6">
                        {String((item as any).description)}
                    </div>
                )}

                {/* Existing reviewer note (when already reviewed) */}
                {!isPending && item.reviewNote && (
                    <div className={cn(
                        'flex items-start gap-2 p-3 rounded-lg text-xs',
                        status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200',
                    )}>
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                                {item.externalReviewerName ? `${item.externalReviewerName} said:` : 'Reviewer note:'}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{item.reviewNote}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Decision panel — only when pending */}
            {isPending && (
                <div className="px-5 pb-5 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={() => {
                                setExpandedAction((prev) => (prev === 'accept' ? null : 'accept'));
                            }}
                            disabled={!isNameEntered || pendingAction !== null}
                            title={isNameEntered ? undefined : 'Enter your name at the top to enable actions'}
                            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            Accept
                        </button>
                        <button
                            onClick={() => {
                                setExpandedAction((prev) => (prev === 'reject' ? null : 'reject'));
                            }}
                            disabled={!isNameEntered || pendingAction !== null}
                            title={isNameEntered ? undefined : 'Enter your name at the top to enable actions'}
                            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-destructive text-destructive text-sm font-bold hover:bg-destructive/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <X className="w-4 h-4" />
                            Request Revision
                        </button>
                    </div>

                    {expandedAction === 'accept' && (
                        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                            <textarea
                                value={acceptNote}
                                onChange={(e) => setAcceptNote(e.target.value)}
                                rows={2}
                                placeholder="Add a message for the creator (optional)..."
                                className="w-full p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                                maxLength={2000}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setExpandedAction(null); setAcceptNote(''); }}
                                    disabled={pendingAction !== null}
                                    className="h-9 px-4 rounded-lg border border-border text-xs font-bold hover:bg-secondary transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => void submitAction('accept')}
                                    disabled={pendingAction !== null}
                                    className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {pendingAction === 'accept' && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Confirm Accept
                                </button>
                            </div>
                        </div>
                    )}

                    {expandedAction === 'reject' && (
                        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                rows={3}
                                placeholder="What needs to change? (required)"
                                className="w-full p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30"
                                maxLength={2000}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setExpandedAction(null); setRejectNote(''); }}
                                    disabled={pendingAction !== null}
                                    className="h-9 px-4 rounded-lg border border-border text-xs font-bold hover:bg-secondary transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => void submitAction('reject')}
                                    disabled={pendingAction !== null || rejectNote.trim().length === 0}
                                    className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {pendingAction === 'reject' && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Send Revision Request
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
