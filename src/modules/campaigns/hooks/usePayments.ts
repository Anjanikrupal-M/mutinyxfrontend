import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';

export interface PaymentRoundSummary {
    count: number;
    influencerTotal: number;
    platformFee: number;
    grandTotal: number;
    currency?: string;
    /** Portion of the upcoming final round covered by carried advance credit (creator replacement). */
    carriedCreditTotal?: number;
    /** Campaign-influencer IDs this round will charge for (backend-authoritative eligibility). */
    ciIds?: string[];
}

export interface PaymentSummary {
    nextAdvanceRound: PaymentRoundSummary;
    nextFinalRound: PaymentRoundSummary;
    paymentRounds: Array<Record<string, unknown>>;
    paymentBypassEnabled: boolean;
}

export interface PaymentOrderResponse {
    orderId: string;
    paymentSessionId: string;
    amount: number;
    currency: string;
    paymentId: string;
    /** Creator replacement: true when every selected CI was fully covered by carried
     *  advance credit — no Cashfree order exists; the CIs are already final-settled. */
    zeroTotal?: boolean;
    settledByCreditCiIds?: string[];
}

interface VerifyPaymentPayload {
    campaignId: string;
    orderId: string;
    paymentId: string;
}

function toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function normalizeRound(raw: unknown): PaymentRoundSummary {
    const row = (raw ?? {}) as Record<string, unknown>;
    const count = toNumber(row.count ?? row.influencersCount ?? row.eligibleCount);
    const influencerTotal = toNumber(row.influencerTotal ?? row.totalAmount ?? row.subtotal);
    const platformFee = toNumber(row.platformFee ?? row.fee);
    const grandTotal = toNumber(row.grandTotal ?? row.amount ?? influencerTotal + platformFee);
    return {
        count,
        influencerTotal,
        platformFee,
        grandTotal,
        currency: typeof row.currency === 'string' ? row.currency : 'INR',
        carriedCreditTotal: toNumber(row.carriedCreditTotal),
        ciIds: Array.isArray(row.ciIds) ? (row.ciIds as unknown[]).map(String) : undefined,
    };
}

export function usePaymentSummary(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.payment.summary(campaignId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<PaymentSummary>>(API.campaigns.payment.summary(campaignId));
            const payload = (data.data ?? {}) as Record<string, unknown>;
            return {
                nextAdvanceRound: normalizeRound(payload.nextAdvanceRound),
                nextFinalRound: normalizeRound(payload.nextFinalRound),
                paymentRounds: Array.isArray(payload.paymentRounds) ? (payload.paymentRounds as Array<Record<string, unknown>>) : [],
                paymentBypassEnabled: payload.paymentBypassEnabled === true,
            } satisfies PaymentSummary;
        },
        enabled: !!campaignId,
    });
}

export function useInitiatePaymentRound() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            paymentType,
            ciIds,
        }: {
            campaignId: string;
            paymentType: 'advance' | 'final';
            ciIds?: string[];
        }) => {
            const { data } = await http.post<ApiResponse<Record<string, unknown>>>(
                API.campaigns.payment.initiate(campaignId),
                ciIds && ciIds.length > 0 ? { paymentType, ciIds } : { paymentType },
            );
            const raw = (data.data ?? {}) as Record<string, unknown>;
            return {
                orderId: (raw.orderId ?? raw.order_id ?? '') as string,
                paymentSessionId: (raw.paymentSessionId ?? raw.payment_session_id ?? '') as string,
                amount: Number(raw.amount ?? 0),
                currency: (raw.currency ?? 'INR') as string,
                paymentId: (raw.paymentId ?? raw.payment_id ?? '') as string,
                zeroTotal: Boolean(raw.zeroTotal),
                settledByCreditCiIds: Array.isArray(raw.settledByCreditCiIds) ? (raw.settledByCreditCiIds as string[]) : undefined,
            } satisfies PaymentOrderResponse;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useVerifyPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, orderId, paymentId }: VerifyPaymentPayload) => {
            const { data } = await http.post<ApiResponse<Record<string, unknown>>>(
                API.campaigns.payment.verify(campaignId),
                { orderId, paymentId },
            );
            return data.data;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaignId) });
        },
    });
}

export function useCancelPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ paymentId, campaignId }: { paymentId: string; campaignId: string }) => {
            const { data } = await http.patch<ApiResponse<Record<string, unknown>>>(
                `/campaigns/${campaignId}/payment/${paymentId}/cancel`,
                { paymentId },
            );
            return data.data;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaignId) });
        },
    });
}

export function useReconcilePayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId }: { campaignId: string }) => {
            const { data } = await http.post<ApiResponse<{ fixed: number; message: string }>>(
                API.campaigns.payment.reconcile(campaignId),
                {},
            );
            return data.data;
        },
        onSuccess: (result, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useSendAdvanceInvoice() {
    return useMutation({
        mutationFn: async ({ campaignId }: { campaignId: string }) => {
            const { data } = await http.post<ApiResponse<Record<string, unknown>>>(
                API.campaigns.invoice.send(campaignId),
                {},
            );
            return data.data;
        },
    });
}
