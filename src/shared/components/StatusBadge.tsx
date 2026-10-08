import { cn } from '@/lib/utils';

type Status = 'draft' | 'active' | 'closed' | 'pending' | 'approved' | 'rejected' | 'revision' | 'revision_requested' | 'payment_pending' | 'final_payment_pending' | 'cancelled' | 'failed' | 'expired' | 'refunded' | 'reversed' | 'countered' | 'completed' | 'script' | 'work' | 'withdrawn' | 'accepted' | 'invited' | 'applied' | 'negotiating' | 'paid' | 'product_pending' | 'script_pending' | 'script_review' | 'work_pending' | 'work_review' | 'proof_review' | 'archived' | 'settled' | 'paused' | 'replaced'
    | 'waiting_approval' | 'changes_requested' | 'applications_open' | 'inviting_creators' | 'applications_received' | 'in_progress' | 'pending_review' | 'past_deadline';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-50', text: 'text-gray-600' },
    active: { bg: 'bg-green-50', text: 'text-green-700' },
    closed: { bg: 'bg-slate-100', text: 'text-slate-600' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
    approved: { bg: 'bg-green-50', text: 'text-green-700' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700' },
    revision: { bg: 'bg-orange-50', text: 'text-orange-700' },
    revision_requested: { bg: 'bg-orange-50', text: 'text-orange-700' },
    payment_pending: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
    final_payment_pending: { bg: 'bg-orange-50', text: 'text-orange-700' },
    cancelled: { bg: 'bg-slate-100', text: 'text-slate-700' },
    failed: { bg: 'bg-red-50', text: 'text-red-700' },
    expired: { bg: 'bg-orange-50', text: 'text-orange-700' },
    refunded: { bg: 'bg-blue-50', text: 'text-blue-700' },
    reversed: { bg: 'bg-violet-50', text: 'text-violet-700' },
    countered: { bg: 'bg-blue-50', text: 'text-blue-700' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    settled: { bg: 'bg-teal-50', text: 'text-teal-700' },
    script: { bg: 'bg-violet-50', text: 'text-violet-700' },
    work: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    withdrawn: { bg: 'bg-rose-50', text: 'text-rose-600' },
    accepted: { bg: 'bg-green-50', text: 'text-green-700' },
    invited: { bg: 'bg-sky-50', text: 'text-sky-700' },
    applied: { bg: 'bg-blue-50', text: 'text-blue-700' },
    negotiating: { bg: 'bg-amber-50', text: 'text-amber-800' },
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    product_pending: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
    script_pending: { bg: 'bg-violet-50', text: 'text-violet-700' },
    script_review: { bg: 'bg-purple-50', text: 'text-purple-700' },
    work_pending: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    work_review: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
    proof_review: { bg: 'bg-sky-50', text: 'text-sky-700' },
    archived: { bg: 'bg-slate-50', text: 'text-slate-500' },
    paused: { bg: 'bg-orange-50', text: 'text-orange-700' },
    replaced: { bg: 'bg-slate-100', text: 'text-slate-600' },
    // Campaign phases (see getCampaignPhase)
    waiting_approval: { bg: 'bg-amber-50', text: 'text-amber-700' },
    changes_requested: { bg: 'bg-red-50', text: 'text-red-700' },
    applications_open: { bg: 'bg-sky-50', text: 'text-sky-700' },
    inviting_creators: { bg: 'bg-sky-50', text: 'text-sky-700' },
    applications_received: { bg: 'bg-blue-50', text: 'text-blue-700' },
    in_progress: { bg: 'bg-green-50', text: 'text-green-700' },
    pending_review: { bg: 'bg-violet-50', text: 'text-violet-700' },
    past_deadline: { bg: 'bg-orange-50', text: 'text-orange-700' },
};

interface StatusBadgeProps {
    status: Status;
    label?: string;
    className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
    const normalizedStatus = (() => {
        const raw = String(status ?? '').trim().toLowerCase();
        if (raw === 'settelled' || raw === 'setelled') return 'settled';
        return raw;
    })();
    const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.draft;
    const displayLabel = label || normalizedStatus.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return (
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', style.bg, style.text, className)}>
            {displayLabel}
        </span>
    );
}
