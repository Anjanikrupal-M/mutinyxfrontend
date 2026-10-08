import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';

export type TransactionType = 'advance' | 'final';

export type TransactionStatus =
    | 'created' | 'initiated' | 'pending' | 'processing' | 'authorized'
    | 'captured' | 'cancelled' | 'failed' | 'expired' | 'refunded' | 'reversed';

export interface TransactionCreator {
    name: string | null;
    handle: string | null;
}

export interface Transaction {
    id: string;
    campaignId: string;
    campaignName: string;
    campaignType: string | null;
    paymentType: TransactionType;
    round: number;
    status: TransactionStatus;
    /** Creator budget for this round, before the platform fee. */
    influencerBudgetTotal: number;
    platformFeePercent: number;
    platformFeeAmount: number;
    /** What the brand actually paid — budget + fee. */
    totalAmount: number;
    currency: string;
    gatewayOrderId: string | null;
    capturedAt: string | null;
    createdAt: string;
    creators: TransactionCreator[];
    /** Invoices are issued for captured FINAL rounds only. */
    invoiceAvailable: boolean;
}

export interface TransactionSummary {
    advancePaid: number;
    finalPaid: number;
    totalPaid: number;
    roundCount: number;
}

export interface TransactionFilters {
    type?: TransactionType;
    status?: TransactionStatus;
    campaignId?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

interface TransactionsResponse {
    transactions: Transaction[];
    summary: TransactionSummary;
}

export function useTransactions(filters: TransactionFilters = {}) {
    return useQuery({
        queryKey: queryKeys.transactions.list(filters as Record<string, unknown>),
        queryFn: async () => {
            const res = await http.get(API.transactions.list(), { params: filters });
            return {
                ...(res.data.data as TransactionsResponse),
                pagination: res.data.meta as
                    | { page: number; limit: number; total: number; totalPages: number }
                    | undefined,
            };
        },
        // Payment status can change under the user while a gateway round settles.
        staleTime: 15_000,
        placeholderData: (prev) => prev,
    });
}

/**
 * Fetches an invoice PDF as an object URL.
 *
 * Goes through the axios client rather than a plain anchor href or an <iframe src> pointing
 * at the API: the endpoint is authenticated, and neither of those carries the auth header,
 * so both would render a 401 instead of the document. The caller owns the returned URL and
 * must revoke it.
 */
export async function fetchInvoiceObjectUrl(transaction: Transaction): Promise<string> {
    const res = await http.get(API.transactions.invoice(transaction.id), {
        responseType: 'blob',
        params: { disposition: 'inline' },
    });
    return URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
}

export function invoiceFileName(transaction: Transaction): string {
    return `Invoice_${transaction.campaignName.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
}

/** Saves an already-fetched object URL to disk under the invoice's filename. */
export function saveObjectUrl(objectUrl: string, fileName: string) {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/** One-shot download for callers that don't need a preview first. */
export async function downloadTransactionInvoice(transaction: Transaction) {
    const objectUrl = await fetchInvoiceObjectUrl(transaction);
    saveObjectUrl(objectUrl, invoiceFileName(transaction));
    // Revoked on the next tick so the click has already been handed the URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
