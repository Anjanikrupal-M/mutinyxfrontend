/**
 * Public review landing — anyone with a share_token can view a script,
 * work submission, or proof-of-work submission and accept / request-revision
 * without logging in. Mounted at /review/:kind/:token (outside AppShell).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Check, X, FileText, ExternalLink, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SubmissionMediaViewer } from '@/modules/campaigns/components/SubmissionMediaViewer';
import { MutinyXLogo } from '@/shared/components/MutinyXLogo';


type Kind = 'script' | 'work' | 'proof';

const ALLOWED_KINDS: Kind[] = ['script', 'work', 'proof'];

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

// Plain axios instance — bypass the auth interceptor entirely.
const publicHttp = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

interface PublicReviewPayload {
    kind: Kind;
    isClosed: boolean;
    currentStatus: string;
    submission: Record<string, unknown> & {
        id: string;
        status: string;
        reviewNote?: string | null;
        externalReviewerName?: string | null;
        submittedAt?: string;
        reviewedAt?: string | null;
    };
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
    influencer: {
        id: string;
        handle: string;
        name: string;
        avatarUrl?: string | null;
    } | null;
    brandName: string | null;
}

const KIND_LABELS: Record<Kind, { title: string; subtitle: string }> = {
    script: { title: 'Script Review', subtitle: 'Review and approve the script the creator submitted.' },
    work: { title: 'Work Review', subtitle: 'Review and approve the final content the creator submitted.' },
    proof: { title: 'Proof of Work Review', subtitle: 'Review and approve the proof-of-work link.' },
};

export default function PublicReviewPage() {
    const { kind: kindParam, token } = useParams<{ kind: string; token: string }>();
    const kind = (ALLOWED_KINDS.includes(kindParam as Kind) ? kindParam : null) as Kind | null;

    const [data, setData] = useState<PublicReviewPayload | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewerName, setReviewerName] = useState('');
    const [acceptNote, setAcceptNote] = useState('');
    const [revisionNote, setRevisionNote] = useState('');
    const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(null);
    const [expandedAction, setExpandedAction] = useState<'accept' | 'reject' | null>(null);

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
            .get(`/public/review/${kind}/${token}`)
            .then((res) => {
                if (cancelled) return;
                const payload = (res.data?.data ?? res.data) as PublicReviewPayload;
                setData(payload);
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

    const submitAction = async (action: 'accept' | 'reject') => {
        if (!kind || !token) return;
        const trimmedName = reviewerName.trim();
        if (!trimmedName) {
            toast.error('Please enter your name to continue.');
            return;
        }
        if (action === 'reject' && !revisionNote.trim()) {
            toast.error('Please add a note explaining what to change.');
            return;
        }

        const path = action === 'accept' ? 'approve' : 'reject';
        const body: Record<string, string> = { reviewerName: trimmedName };
        if (action === 'accept' && acceptNote.trim()) body.reviewNote = acceptNote.trim();
        if (action === 'reject') body.reviewNote = revisionNote.trim();

        setPendingAction(action);
        try {
            await publicHttp.post(`/public/review/${kind}/${token}/${path}`, body);
            toast.success(action === 'accept' ? 'Submission approved.' : 'Revision requested.');
            // Refetch so the page transitions into its "closed" state.
            const refreshed = await publicHttp.get(`/public/review/${kind}/${token}`);
            const payload = (refreshed.data?.data ?? refreshed.data) as PublicReviewPayload;
            setData(payload);
            setExpandedAction(null);
            setAcceptNote('');
            setRevisionNote('');
        } catch (err: any) {
            const msg = err?.response?.data?.error?.message
                || err?.response?.data?.message
                || `Could not ${action === 'accept' ? 'approve' : 'request revision for'} this submission.`;
            toast.error(msg);
        } finally {
            setPendingAction(null);
        }
    };

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
    const submission = data.submission;
    const status = String(submission.status ?? '').toLowerCase();
    const isPending = status === 'pending';
    const reviewerLabel = submission.externalReviewerName ?? null;
    const submittedAtText = submission.submittedAt
        ? new Date(submission.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;
    const submissionTypeLabel = (() => {
        const t = (submission as any).type;
        return typeof t === 'string' && t.trim().length > 0 ? t.replace(/_/g, ' ') : null;
    })();
    const versionNumber = typeof (submission as any).versionNumber === 'number'
        ? (submission as any).versionNumber as number
        : null;
    const handle = data.influencer?.handle?.trim() || null;
    const isNameEntered = reviewerName.trim().length > 0;

    const initial = (data.influencer?.name?.charAt(0) ?? '?').toUpperCase();

    return (
        <div className="min-h-screen bg-background">
            {/* Branded top bar */}
            <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <MutinyXLogo className="h-4" />
                        <div className="min-w-0 border-l border-border pl-2.5">
                            <p className="text-xs text-muted-foreground truncate">
                                {data.brandName ? `Review request from ${data.brandName}` : 'Submission review'}
                            </p>
                        </div>
                    </div>
                    <span className={cn(
                        'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        isPending
                            ? 'bg-[#fedc03]/15 text-[#0a0a0a] border border-[#fedc03]/40'
                            : status === 'approved'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200',
                    )}>
                        {isPending ? 'Pending review' : status === 'approved' ? 'Approved' : 'Revision Requested'}
                    </span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Title block with yellow accent */}
                <div className="mb-6 pl-3 border-l-4 border-[#fedc03]">
                    <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
                </div>

                {/* Status banner */}
                {!isPending && (
                    <div className={cn(
                        'mb-6 p-4 rounded-xl border text-sm flex items-start gap-3',
                        status === 'approved'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800',
                    )}>
                        {status === 'approved' ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />}
                        <div>
                            <p className="font-semibold">
                                {status === 'approved' ? 'Approved' : 'Revision Requested'}
                                {reviewerLabel ? ` by ${reviewerLabel}` : ''}
                            </p>
                            <p className="opacity-80 mt-0.5">
                                This review link has been used and is no longer active.
                                {submission.reviewedAt ? ` Reviewed on ${new Date(submission.reviewedAt).toLocaleString('en-IN')}.` : ''}
                            </p>
                            {submission.reviewNote && (
                                <p className="mt-2 whitespace-pre-wrap break-words">"{submission.reviewNote}"</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Campaign + creator context */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-5">
                    {data.campaign && (
                        <div className="mb-4 pb-4 border-b border-border">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Campaign</p>
                            <p className="text-base font-semibold mt-1">{data.campaign.name}</p>
                            {data.campaign.objective && (
                                <p className="text-xs text-muted-foreground mt-1">{data.campaign.objective}</p>
                            )}
                            {data.campaign.brief && (
                                <p className="text-xs text-foreground/70 mt-2 leading-relaxed line-clamp-3">
                                    {data.campaign.brief}
                                </p>
                            )}
                        </div>
                    )}
                    {data.influencer && (
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-foreground text-background flex items-center justify-center text-sm font-bold border border-border shrink-0">
                                {/* Initial sits underneath; if the image loads, it covers the initial. If it fails, it stays hidden and the initial shows. */}
                                <span aria-hidden="true">{initial}</span>
                                {data.influencer.avatarUrl && (
                                    <img
                                        src={data.influencer.avatarUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Submitted by</p>
                                <p className="text-sm font-semibold truncate">{data.influencer.name || 'Unknown creator'}</p>
                                {handle && (
                                    <p className="text-xs text-muted-foreground truncate">@{handle}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Submission preview */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Submission{versionNumber ? ` · v${versionNumber}` : ''}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {submissionTypeLabel && (
                                <span className="capitalize px-2 py-0.5 rounded-full bg-secondary border border-border font-medium">
                                    {submissionTypeLabel}
                                </span>
                            )}
                            {submittedAtText && (
                                <span>Submitted {submittedAtText}</span>
                            )}
                        </div>
                    </div>
                    {/* SubmissionMediaViewer reads url/externalUrl/proofOfWorkUrl, but
                        proof-of-work rows store the link in `proofUrl`. Mirror it across
                        so embeds (Instagram reels, YouTube shorts, etc.) render in-place. */}
                    <SubmissionMediaViewer
                        submission={
                            kind === 'proof'
                                ? {
                                    ...(submission as any),
                                    url: (submission as any).proofUrl,
                                    externalUrl: (submission as any).proofUrl,
                                    proofOfWorkUrl: (submission as any).proofUrl,
                                }
                                : (submission as any)
                        }
                        showEmptyState={false}
                    />
                    {typeof submission.textContent === 'string' && submission.textContent.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/30 text-sm whitespace-pre-wrap leading-6 italic">
                            {String(submission.textContent)}
                        </div>
                    )}
                    {typeof (submission as any).description === 'string' && (submission as any).description.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/30 text-sm whitespace-pre-wrap leading-6">
                            {String((submission as any).description)}
                        </div>
                    )}
                    {typeof (submission as any).proofUrl === 'string' && (
                        <a
                            href={String((submission as any).proofUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open proof in new tab
                        </a>
                    )}
                </div>

                {/* Action panel */}
                {isPending && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Your decision</p>

                        <label className="block mb-3">
                            <span className="text-xs font-medium text-foreground/80">Your name <span className="text-destructive">*</span></span>
                            <input
                                type="text"
                                value={reviewerName}
                                onChange={(e) => setReviewerName(e.target.value)}
                                placeholder="e.g. Priya Sharma"
                                className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                                maxLength={120}
                            />
                            <span className="text-[11px] text-muted-foreground mt-1 inline-block">Shown to the brand alongside your decision.</span>
                        </label>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={() => {
                                    setExpandedAction((prev) => (prev === 'accept' ? null : 'accept'));
                                }}
                                disabled={pendingAction !== null || !isNameEntered}
                                title={isNameEntered ? undefined : 'Enter your name to continue'}
                                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Accept
                            </button>
                            <button
                                onClick={() => {
                                    setExpandedAction((prev) => (prev === 'reject' ? null : 'reject'));
                                }}
                                disabled={pendingAction !== null || !isNameEntered}
                                title={isNameEntered ? undefined : 'Enter your name to continue'}
                                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-destructive text-destructive text-sm font-bold hover:bg-destructive/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <X className="w-4 h-4" />
                                Request Revision
                            </button>
                        </div>
                        {!isNameEntered && (
                            <p className="text-[11px] text-muted-foreground mt-2 text-center">
                                Enter your name above to enable Accept and Request Revision.
                            </p>
                        )}

                        {expandedAction === 'accept' && (
                            <div className="mt-4 p-3 rounded-xl border border-border bg-secondary/20 space-y-3">
                                <textarea
                                    value={acceptNote}
                                    onChange={(e) => setAcceptNote(e.target.value)}
                                    rows={3}
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
                                        disabled={pendingAction !== null || reviewerName.trim().length === 0}
                                        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {pendingAction === 'accept' && <Loader2 className="w-3 h-3 animate-spin" />}
                                        Confirm Accept
                                    </button>
                                </div>
                            </div>
                        )}

                        {expandedAction === 'reject' && (
                            <div className="mt-4 p-3 rounded-xl border border-border bg-secondary/20 space-y-3">
                                <textarea
                                    value={revisionNote}
                                    onChange={(e) => setRevisionNote(e.target.value)}
                                    rows={4}
                                    placeholder="What needs to change? (required)"
                                    className="w-full p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30"
                                    maxLength={2000}
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => { setExpandedAction(null); setRevisionNote(''); }}
                                        disabled={pendingAction !== null}
                                        className="h-9 px-4 rounded-lg border border-border text-xs font-bold hover:bg-secondary transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => void submitAction('reject')}
                                        disabled={pendingAction !== null || reviewerName.trim().length === 0 || revisionNote.trim().length === 0}
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

                <p className="text-[11px] text-muted-foreground text-center mt-6">
                    Powered by Mutiny · This is a one-time secure review link. It expires after the first decision.
                </p>
            </div>
        </div>
    );
}
