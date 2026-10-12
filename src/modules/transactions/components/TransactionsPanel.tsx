import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    Receipt, Search, ChevronLeft, ChevronRight,
    Wallet, CheckCircle2, X, ArrowRight, FileText, Clock3, ArrowUpRight,
} from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { SegmentedTabs } from '@/shared/components/SegmentedTabs';
import { Skeleton } from '@/shared/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
    useTransactions,
    type Transaction, type TransactionFilters, type TransactionStatus,
} from '../hooks/useTransactions';
import { InvoicePreviewModal } from './InvoicePreviewModal';

const PAGE_LIMIT = 15;

// The gateway exposes eleven statuses; a brand only cares about three outcomes. Each is
// mapped onto an existing StatusBadge palette entry with a label a brand recognises.
const STATUS_PRESENTATION: Record<TransactionStatus, { badge: string; label: string }> = {
    captured:   { badge: 'paid',      label: 'Paid' },
    created:    { badge: 'pending',   label: 'Pending' },
    initiated:  { badge: 'pending',   label: 'Pending' },
    pending:    { badge: 'pending',   label: 'Pending' },
    processing: { badge: 'pending',   label: 'Processing' },
    authorized: { badge: 'pending',   label: 'Authorized' },
    cancelled:  { badge: 'cancelled', label: 'Cancelled' },
    failed:     { badge: 'failed',    label: 'Failed' },
    expired:    { badge: 'expired',   label: 'Expired' },
    refunded:   { badge: 'refunded',  label: 'Refunded' },
    reversed:   { badge: 'reversed',  label: 'Reversed' },
};

// What each payment is, in the brand's own words: the two halves of a campaign's cost.
// Deliberately says nothing about `round` — that is an internal per-campaign counter that
// also numbers abandoned attempts, so it means nothing to a brand.
const PAYMENT_PRESENTATION: Record<Transaction['paymentType'], { label: string; hint: string; dot: string; chip: string }> = {
    advance: { label: 'Advance', hint: '50% upfront',   dot: 'bg-brand',       chip: 'border-brand/50 bg-brand/10' },
    final:   { label: 'Final',   hint: 'Remaining 50%', dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50' },
};

// Type and status are separate columns server-side, so each option carries which one it sets.
// The type options are a segmented switch; the status options sit in a dropdown beside it.
type PaymentFilter = { value: string; label: string; patch: Partial<TransactionFilters> };

const TYPE_FILTERS: PaymentFilter[] = [
    { value: 'all',     label: 'All',     patch: { type: undefined, status: undefined } },
    { value: 'advance', label: 'Advance', patch: { type: 'advance', status: undefined } },
    { value: 'final',   label: 'Final',   patch: { type: 'final',   status: undefined } },
];

const STATUS_FILTERS: PaymentFilter[] = [
    { value: 'captured', label: 'Paid',             patch: { type: undefined, status: 'captured' } },
    { value: 'pending',  label: 'Awaiting payment', patch: { type: undefined, status: 'pending' } },
    { value: 'failed',   label: 'Failed',           patch: { type: undefined, status: 'failed' } },
    { value: 'refunded', label: 'Refunded',         patch: { type: undefined, status: 'refunded' } },
];

const ALL_FILTERS: PaymentFilter[] = [...TYPE_FILTERS, ...STATUS_FILTERS];

// Rows fade up one after another (literal classes so Tailwind sees them).
const ROW_DELAYS = ['[animation-delay:0ms]', '[animation-delay:40ms]', '[animation-delay:80ms]', '[animation-delay:120ms]', '[animation-delay:160ms]', '[animation-delay:200ms]'];

function formatRupee(value: number): string {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function creatorSummary(creators: Transaction['creators']): string {
    if (!creators.length) return '—';
    // Handles may already carry their "@" — strip it so it's never doubled.
    const names = creators.map((c) => c.handle ? `@${c.handle.replace(/^@+/, '')}` : (c.name ?? 'Creator'));
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function SummaryTile({ icon: Icon, label, value, footer, className }: {
    icon: typeof Wallet; label: string; value: string; footer: ReactNode; className?: string;
}) {
    return (
        <div className={cn('group relative flex animate-fade-up flex-col overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float', className)}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-brand transition-transform duration-500 ease-out group-hover:scale-x-100" />
            <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/15 ring-1 ring-brand/40 transition-all duration-300 group-hover:-rotate-12 group-hover:bg-brand">
                    <Icon className="h-4 w-4" />
                </span>
                {label}
            </span>
            <p className="mt-5 font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
            <p className="mt-auto pt-4 text-xs text-muted-foreground">{footer}</p>
        </div>
    );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TransactionRow({
    transaction,
    index,
    onPreview,
}: {
    transaction: Transaction;
    index: number;
    onPreview: (t: Transaction) => void;
}) {
    const presentation = STATUS_PRESENTATION[transaction.status] ?? { badge: 'draft', label: transaction.status };
    const payment = PAYMENT_PRESENTATION[transaction.paymentType];

    return (
        <tr className={cn('group/row relative animate-fade-up border-b border-border last:border-0 transition-colors hover:bg-brand/[0.05]', ROW_DELAYS[Math.min(index, ROW_DELAYS.length - 1)])}>
            <td className="relative py-3.5 pl-5 pr-4">
                {/* Yellow marker that appears on the hovered row */}
                <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-brand transition-transform duration-300 group-hover/row:scale-y-100" />
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xs font-bold text-foreground/80 transition-colors group-hover/row:bg-brand group-hover/row:text-black">
                        {transaction.campaignName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                        <Link
                            to={`/campaigns/${transaction.campaignId}`}
                            className="line-clamp-1 text-sm font-semibold underline-offset-4 hover:underline"
                        >
                            {transaction.campaignName}
                        </Link>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                            {creatorSummary(transaction.creators)}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3.5">
                <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', payment.chip)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', payment.dot)} />
                    {payment.label}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">{payment.hint}</p>
            </td>
            <td className="px-4 py-3.5 text-right text-sm tabular-nums">
                {formatRupee(transaction.influencerBudgetTotal)}
            </td>
            <td className="px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground">
                {formatRupee(transaction.platformFeeAmount)}
                <span className="ml-1 rounded-full bg-secondary px-1.5 py-px text-[10px] font-semibold">{transaction.platformFeePercent}%</span>
            </td>
            <td className="px-4 py-3.5 text-right font-display text-[15px] font-semibold tabular-nums">
                {formatRupee(transaction.totalAmount)}
            </td>
            <td className="px-4 py-3.5">
                <StatusBadge status={presentation.badge as never} label={presentation.label} />
            </td>
            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">
                {formatDate(transaction.capturedAt ?? transaction.createdAt)}
            </td>
            <td className="py-3.5 pl-4 pr-5 text-right">
                {transaction.invoiceAvailable ? (
                    <button
                        onClick={() => onPreview(transaction)}
                        className="group/inv inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground pl-1 pr-3 text-xs font-semibold text-background transition-shadow hover:shadow-float"
                    >
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-black transition-transform duration-300 group-hover/inv:-rotate-12">
                            <FileText className="h-3 w-3" />
                        </span>
                        Invoice
                    </button>
                ) : (
                    // Advance payments do not get an invoice - say so rather than leaving a
                    // blank cell that reads as a missing document.
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {transaction.paymentType === 'advance' ? <><Clock3 className="h-3 w-3" /> With final payment</> : '—'}
                    </span>
                )}
            </td>
        </tr>
    );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * The brand's campaign money ledger. Rendered as a tab inside Settings, so it carries no
 * page header of its own.
 */
export function TransactionsPanel() {
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [previewing, setPreviewing] = useState<Transaction | null>(null);
    const debouncedSearch = useDebounce(search, 400);

    const filters = useMemo<TransactionFilters>(() => {
        const patch = ALL_FILTERS.find((f) => f.value === paymentFilter)?.patch ?? {};
        return {
            ...patch,
            q: debouncedSearch || undefined,
            page,
            limit: PAGE_LIMIT,
        };
    }, [paymentFilter, debouncedSearch, page]);

    const { data, isLoading, isError } = useTransactions(filters);

    const transactions = data?.transactions ?? [];
    const summary = data?.summary;
    const pagination = data?.pagination;
    const hasFilters = paymentFilter !== 'all' || search.length > 0;
    const statusFilter = STATUS_FILTERS.some((f) => f.value === paymentFilter) ? paymentFilter : '';

    const totalPaid = summary?.totalPaid ?? 0;
    const advancePaid = summary?.advancePaid ?? 0;
    const finalPaid = summary?.finalPaid ?? 0;
    const advanceShare = totalPaid > 0 ? Math.round((advancePaid / totalPaid) * 100) : 0;

    const pick = (value: string) => { setPaymentFilter(value); setPage(1); };
    const clearFilters = () => {
        setPaymentFilter('all');
        setSearch('');
        setPage(1);
    };

    return (
        <div className="animate-fade-in space-y-5">
            {/* How payments work — two steps instead of a paragraph */}
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-xs sm:flex-row sm:items-center">
                <span className="font-semibold text-muted-foreground">How you pay</span>
                <span className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-black">1</span>
                    <span><strong className="font-semibold">50% advance</strong> <span className="text-muted-foreground">when creators are accepted</span></span>
                </span>
                <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                <span className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">2</span>
                    <span><strong className="font-semibold">50% final</strong> <span className="text-muted-foreground">once their work is approved — with an invoice</span></span>
                </span>
            </div>

            {/* Summary — total paid (featured, with the advance / final split) beside two tiles */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Dark card (like the Analytics hero): white figures, a soft yellow glow in the corner. */}
                <div className="group/total relative isolate flex animate-fade-up flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-800 via-neutral-900 to-black p-5 text-white shadow-float sm:col-span-2">
                    <span aria-hidden className="stat-glow pointer-events-none absolute -right-14 -top-20 -z-10 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
                    <div className="relative flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand text-black"><Wallet className="h-4 w-4" /></span>
                            Total paid
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/80 ring-1 ring-white/10">
                            {summary?.roundCount ?? 0} payments
                        </span>
                    </div>
                    <p className="relative mt-4 font-display text-[40px] font-semibold leading-none tracking-tight tabular-nums">
                        {isLoading && !summary ? '—' : formatRupee(totalPaid)}
                    </p>
                    {/* Advance vs final, as one split bar with its legend */}
                    <div className="relative mt-auto pt-5">
                        <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-2 w-full overflow-hidden rounded-full" aria-label={`Advance ${advanceShare}%, final ${totalPaid > 0 ? 100 - advanceShare : 0}%`}>
                            <rect width="100" height="4" className="fill-white/10" />
                            {totalPaid > 0 && <rect width={advanceShare} height="4" className="fill-brand" />}
                            {totalPaid > 0 && <rect x={advanceShare} width={100 - advanceShare} height="4" className="fill-emerald-500" />}
                        </svg>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Advance <strong className="font-semibold text-white">{advanceShare}%</strong></span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Final <strong className="font-semibold text-white">{totalPaid > 0 ? 100 - advanceShare : 0}%</strong></span>
                        </div>
                    </div>
                </div>
                <SummaryTile
                    icon={ArrowUpRight}
                    label="Advance paid"
                    value={formatRupee(advancePaid)}
                    footer="50% upfront, as creators are accepted"
                    className="[animation-delay:60ms]"
                />
                <SummaryTile
                    icon={CheckCircle2}
                    label="Final paid"
                    value={formatRupee(finalPaid)}
                    footer="Released once work is approved"
                    className="[animation-delay:120ms]"
                />
            </div>

            {/* Toolbar — search, the payment-type switch, and a status dropdown */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="group/search flex h-10 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 shadow-sm transition-all focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-brand/20">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground group-focus-within/search:text-foreground" />
                    <input
                        type="text"
                        placeholder="Search by campaign or payment reference…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
                        aria-label="Search payments"
                    />
                    {search && (
                        <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </label>

                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedTabs
                        ariaLabel="Payment type"
                        value={TYPE_FILTERS.some((f) => f.value === paymentFilter) ? paymentFilter : ''}
                        onChange={pick}
                        items={TYPE_FILTERS.map((f) => ({
                            value: f.value,
                            label: f.label,
                            dot: f.value === 'all' ? undefined : PAYMENT_PRESENTATION[f.value as Transaction['paymentType']].dot,
                        }))}
                    />
                    <Select value={statusFilter} onValueChange={pick}>
                        <SelectTrigger className={cn('h-10 w-44 rounded-full bg-card shadow-sm', statusFilter && 'border-foreground/40')}>
                            <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_FILTERS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
                {isLoading && transactions.length === 0 ? (
                    <div className="space-y-3 p-5">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                    </div>
                ) : isError ? (
                    <EmptyState
                        icon={Receipt}
                        title="Couldn't load transactions"
                        description="Something went wrong fetching your payment history. Please refresh and try again."
                    />
                ) : transactions.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title={hasFilters ? 'No matching payments' : 'No payments yet'}
                        description={
                            hasFilters
                                ? 'Try a different filter or clear your search.'
                                : 'Once you pay for accepted creators on a campaign, every payment will appear here with its invoice.'
                        }
                        {...(hasFilters ? { action: { label: 'Clear filters', onClick: clearFilters } } : {})}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="py-3 pl-5 pr-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Campaign</th>
                                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Payment</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Creator budget</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Platform fee</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total paid</th>
                                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Date</th>
                                    <th className="py-3 pl-4 pr-5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Invoice</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t, i) => (
                                    <TransactionRow key={t.id} transaction={t} index={i} onPreview={setPreviewing} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        Page <strong className="font-semibold text-foreground">{pagination.page}</strong> of {pagination.totalPages} · {pagination.total} payments
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                            aria-label="Previous page"
                            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:border-foreground disabled:opacity-40 disabled:hover:border-border"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            aria-label="Next page"
                            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:border-foreground disabled:opacity-40 disabled:hover:border-border"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <InvoicePreviewModal transaction={previewing} onClose={() => setPreviewing(null)} />
        </div>
    );
}
