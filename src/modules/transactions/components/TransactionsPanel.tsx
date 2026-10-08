import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Receipt, Search, Eye, ChevronLeft, ChevronRight,
    Wallet, TrendingUp, CheckCircle2, X,
} from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { StatCard } from '@/shared/ui/stat-card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
    SelectSeparator, SelectTrigger, SelectValue,
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
const PAYMENT_PRESENTATION: Record<Transaction['paymentType'], { label: string; hint: string; className: string }> = {
    advance: { label: 'Advance paid',  hint: '50% upfront',     className: 'bg-blue-50 text-blue-700' },
    final:   { label: 'Final payment', hint: 'Remaining 50%',   className: 'bg-emerald-50 text-emerald-700' },
};

// Type and status are separate columns server-side, so each option carries which one it
// sets. Split into two groups in the picker because "what the payment was for" and "how it
// ended up" are different questions.
type PaymentFilter = { value: string; label: string; patch: Partial<TransactionFilters> };

const ALL_FILTER: PaymentFilter =
    { value: 'all', label: 'All payments', patch: { type: undefined, status: undefined } };

const TYPE_FILTERS: PaymentFilter[] = [
    { value: 'advance', label: 'Advance paid (50% upfront)',      patch: { type: 'advance', status: undefined } },
    { value: 'final',   label: 'Final payment (remaining 50%)',   patch: { type: 'final',   status: undefined } },
];

const STATUS_FILTERS: PaymentFilter[] = [
    { value: 'captured', label: 'Paid',             patch: { type: undefined, status: 'captured' } },
    { value: 'pending',  label: 'Awaiting payment', patch: { type: undefined, status: 'pending' } },
    { value: 'failed',   label: 'Failed',           patch: { type: undefined, status: 'failed' } },
    { value: 'refunded', label: 'Refunded',         patch: { type: undefined, status: 'refunded' } },
];

const ALL_FILTERS: PaymentFilter[] = [ALL_FILTER, ...TYPE_FILTERS, ...STATUS_FILTERS];

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
    const names = creators.map((c) => c.handle ? `@${c.handle}` : (c.name ?? 'Creator'));
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TransactionRow({
    transaction,
    onPreview,
}: {
    transaction: Transaction;
    onPreview: (t: Transaction) => void;
}) {
    const presentation = STATUS_PRESENTATION[transaction.status] ?? { badge: 'draft', label: transaction.status };
    const payment = PAYMENT_PRESENTATION[transaction.paymentType];

    return (
        <tr className="border-b border-border last:border-0 hover:bg-secondary/40 transition-premium">
            <td className="px-4 py-3">
                <Link
                    to={`/campaigns/${transaction.campaignId}`}
                    className="font-medium text-sm hover:underline underline-offset-4 line-clamp-1"
                >
                    {transaction.campaignName}
                </Link>
                <p className="text-xs text-muted-foreground line-clamp-1">
                    {creatorSummary(transaction.creators)}
                </p>
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                    payment.className,
                )}>
                    {payment.label}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">{payment.hint}</p>
            </td>
            <td className="px-4 py-3 text-right text-sm tabular-nums">
                {formatRupee(transaction.influencerBudgetTotal)}
            </td>
            <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                {formatRupee(transaction.platformFeeAmount)}
                <span className="ml-1 text-[10px]">({transaction.platformFeePercent}%)</span>
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                {formatRupee(transaction.totalAmount)}
            </td>
            <td className="px-4 py-3">
                <StatusBadge status={presentation.badge as never} label={presentation.label} />
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(transaction.capturedAt ?? transaction.createdAt)}
            </td>
            <td className="px-4 py-3 text-right">
                {transaction.invoiceAvailable ? (
                    <button
                        onClick={() => onPreview(transaction)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary transition-premium"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        View
                    </button>
                ) : (
                    // Advance payments do not get an invoice - say so rather than leaving a
                    // blank cell that reads as a missing document.
                    <span className="text-xs text-muted-foreground">
                        {transaction.paymentType === 'advance' ? 'On final payment' : '--'}
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

    const clearFilters = () => {
        setPaymentFilter('all');
        setSearch('');
        setPage(1);
    };

    return (
        <div className="animate-fade-in">
            <p className="text-sm text-muted-foreground mb-5 max-w-3xl">
                Every payment you've made across your campaigns, with invoices. Each campaign is
                paid in two parts — 50% upfront when creators are accepted, and the remaining 50%
                once their work is approved. Invoices are issued for final payments.
            </p>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Total Paid"   value={formatRupee(summary?.totalPaid ?? 0)}   icon={Wallet} />
                <StatCard title="Advance Paid" value={formatRupee(summary?.advancePaid ?? 0)} icon={TrendingUp} delay={0.05} />
                <StatCard title="Final Paid"   value={formatRupee(summary?.finalPaid ?? 0)}   icon={CheckCircle2} delay={0.1} />
                <StatCard title="Payments"     value={summary?.roundCount ?? 0}               icon={Receipt} delay={0.15} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by campaign or payment reference..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="pl-9"
                    />
                </div>
                <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-60">
                        <SelectValue placeholder="All payments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_FILTER.value}>{ALL_FILTER.label}</SelectItem>
                        <SelectSeparator />
                        <SelectGroup>
                            <SelectLabel>Payment</SelectLabel>
                            {TYPE_FILTERS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                            <SelectLabel>Status</SelectLabel>
                            {STATUS_FILTERS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-premium"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {isLoading && transactions.length === 0 ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                        <table className="w-full min-w-[860px]">
                            <thead>
                                <tr className="border-b border-border bg-secondary/50 text-left">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Campaign</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Payment</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">Creator Budget</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">Platform Fee</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">Total Paid</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">Invoice</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t) => (
                                    <TransactionRow key={t.id} transaction={t} onPreview={setPreviewing} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} · {pagination.total} payments
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                            className="p-2 rounded-lg border border-border hover:bg-secondary transition-premium disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="p-2 rounded-lg border border-border hover:bg-secondary transition-premium disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <InvoicePreviewModal transaction={previewing} onClose={() => setPreviewing(null)} />
        </div>
    );
}
