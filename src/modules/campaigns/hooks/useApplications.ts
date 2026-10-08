// ─────────────────────────────────────────────────────────────
// Application Hooks — List, Approve, Reject
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { CampaignInfluencer } from '@/shared/types/campaign';
import ws from '@/core/websocket';

const shouldRetryQuery = (failureCount: number, error: unknown) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403 || status === 404 || status === 429) return false;
    return failureCount < 3;
};

export type RecommendationTag = {
    key: string;
    label: string;
    evidence: Record<string, unknown>;
    source: 'meta_graph' | 'platform_history';
    confidence: 'high' | 'medium' | 'low';
    sampleSize: number;
    calculatedAt: string;
};

export type CampaignFitEvaluation = {
    influencerId: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
    eligible: boolean;
    score: number | null;
    label: 'strong_fit' | 'good_fit' | 'consider' | 'weak_fit' | 'insufficient_data';
    confidence: 'high' | 'medium' | 'low';
    components: Record<string, number | null>;
    reasons: string[];
    warnings: string[];
    tags: RecommendationTag[];
    sampleSize: number;
    modelVersion: string;
    provenance: {
        source: 'meta_graph' | 'legacy_unverified';
        verified: boolean;
        graphVersion: string | null;
        collectedAt: string | null;
        status: 'fresh' | 'stale' | 'failed' | 'reauth_required';
    };
};

// The backend paginates these endpoints (default 20, max 100 per page), but every
// consumer needs the full campaign roster — so walk all pages and merge them.
// Paging stops on meta.total, not on a short page: the backend drops tier-ineligible
// rows after LIMIT, so a page can come back short while more pages remain.
const PAGE_LIMIT = 100;

async function fetchAllPages(url: string): Promise<CampaignInfluencer[]> {
    const byId = new Map<string, CampaignInfluencer>();
    for (let page = 1; ; page++) {
        const { data } = await http.get<ApiResponse<CampaignInfluencer[]>>(url, {
            params: { page, limit: PAGE_LIMIT },
        });
        for (const row of data.data ?? []) byId.set(row.id, row);
        const total = data.meta?.total ?? 0;
        if (!data.meta || page * PAGE_LIMIT >= total) break;
    }
    return Array.from(byId.values());
}

// ── Queries ──

export function useApplications(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.applications(campaignId),
        queryFn: () => fetchAllPages(API.campaigns.applications.list(campaignId)),
        enabled: !!campaignId,
        placeholderData: keepPreviousData,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 30),
        refetchIntervalInBackground: false,
    });
}

export function useStatusBoardApplications(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.statusBoard(campaignId),
        queryFn: () => fetchAllPages(API.campaigns.applications.statusBoard(campaignId)),
        enabled: !!campaignId,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 30),
        refetchIntervalInBackground: false,
    });
}

export function useCampaignRecommendations(campaignId: string, enabled = true) {
    return useQuery({
        queryKey: queryKeys.campaigns.recommendations(campaignId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<CampaignFitEvaluation[]>>(
                API.campaigns.recommendations(campaignId),
            );
            return data.data;
        },
        enabled: enabled && !!campaignId,
        staleTime: 5 * 60 * 1000,
    });
}

// ── Mutations ──

export function useApproveApplication() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, appId }: { campaignId: string; appId: string }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.approve(campaignId, appId),
            );
            return data.data;
        },
        onMutate: async ({ campaignId, appId }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            const boardKey = queryKeys.campaigns.statusBoard(campaignId);

            await Promise.all([
                queryClient.cancelQueries({ queryKey: appsKey }),
                queryClient.cancelQueries({ queryKey: boardKey }),
            ]);

            const previousApps = queryClient.getQueryData<CampaignInfluencer[]>(appsKey);
            const previousBoard = queryClient.getQueryData<CampaignInfluencer[]>(boardKey);

            // Optimistically mark card as accepted so the button disappears instantly.
            // Patch ALL status fields (status, effectiveStatus, effective_status) because
            // the card renderer uses effectiveStatus first via effectiveStatus() helper.
            const patch = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) =>
                    row.id === appId
                        ? {
                              ...row,
                              status: 'accepted' as const,
                              effectiveStatus: 'accepted' as const,
                              effective_status: 'accepted' as const,
                          }
                        : row
                );

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, patch(previousApps));
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(boardKey, patch(previousBoard));

            return { previousApps, previousBoard };
        },
        onError: (_err, { campaignId }, context) => {
            // Rollback on failure.
            queryClient.setQueryData(queryKeys.campaigns.applications(campaignId), context?.previousApps);
            queryClient.setQueryData(queryKeys.campaigns.statusBoard(campaignId), context?.previousBoard);
        },
        onSuccess: (updated, { campaignId, appId }) => {
            // Merge the real server response so Pay Later status (script_pending etc.) is correct.
            const merge = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) => (row.id === appId ? { ...row, ...updated } : row));

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(
                queryKeys.campaigns.applications(campaignId), (old) => merge(old),
            );
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(
                queryKeys.campaigns.statusBoard(campaignId), (old) => merge(old),
            );

            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

export function useRejectApplication() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, appId }: { campaignId: string; appId: string }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.reject(campaignId, appId),
            );
            return data.data;
        },
        onMutate: async ({ campaignId, appId }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            const boardKey = queryKeys.campaigns.statusBoard(campaignId);

            await Promise.all([
                queryClient.cancelQueries({ queryKey: appsKey }),
                queryClient.cancelQueries({ queryKey: boardKey }),
            ]);

            const previousApps = queryClient.getQueryData<CampaignInfluencer[]>(appsKey);
            const previousBoard = queryClient.getQueryData<CampaignInfluencer[]>(boardKey);

            // Optimistically remove the card by marking it rejected instantly.
            const patch = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) =>
                    row.id === appId
                        ? {
                              ...row,
                              status: 'rejected' as const,
                              effectiveStatus: 'rejected' as const,
                              effective_status: 'rejected' as const,
                          }
                        : row
                );

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, patch(previousApps));
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(boardKey, patch(previousBoard));

            return { previousApps, previousBoard };
        },
        onError: (_err, { campaignId }, context) => {
            queryClient.setQueryData(queryKeys.campaigns.applications(campaignId), context?.previousApps);
            queryClient.setQueryData(queryKeys.campaigns.statusBoard(campaignId), context?.previousBoard);
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

export function useMarkProductShipped() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, appId }: { campaignId: string; appId: string }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.productShipped(campaignId, appId),
            );
            return data.data;
        },
        onMutate: async ({ campaignId, appId }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            const boardKey = queryKeys.campaigns.statusBoard(campaignId);

            await Promise.all([
                queryClient.cancelQueries({ queryKey: appsKey }),
                queryClient.cancelQueries({ queryKey: boardKey }),
            ]);

            const previousApps = queryClient.getQueryData<CampaignInfluencer[]>(appsKey);
            const previousBoard = queryClient.getQueryData<CampaignInfluencer[]>(boardKey);
            const optimisticShippedAt = new Date().toISOString();

            const patchShipped = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) =>
                    row.id === appId
                        ? { ...row, productShippedAt: optimisticShippedAt }
                        : row
                );

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, patchShipped(previousApps));
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(boardKey, patchShipped(previousBoard));

            return { previousApps, previousBoard };
        },
        onError: (_error, { campaignId }, context) => {
            queryClient.setQueryData(queryKeys.campaigns.applications(campaignId), context?.previousApps);
            queryClient.setQueryData(queryKeys.campaigns.statusBoard(campaignId), context?.previousBoard);
        },
        onSuccess: (updated, { campaignId, appId }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            const boardKey = queryKeys.campaigns.statusBoard(campaignId);

            const mergeUpdated = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) => (row.id === appId ? { ...row, ...updated } : row));

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, (old) => mergeUpdated(old));
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(boardKey, (old) => mergeUpdated(old));

            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

export function useMarkProductDelivered() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, appId }: { campaignId: string; appId: string }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.productDelivered(campaignId, appId),
            );
            return data.data;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

// ── Creator replacement ──

export interface ReplacePreview {
    carriedAdvance: number;
    rounds: Array<{ paymentId: string; round: number; itemAmount: string | number }>;
    payLaterMode: boolean;
    platformFeePercent: number;
    deadlineMode: string;
    budgetMode: string;
    visibility: string;
}

export interface ReplaceCreatorResult {
    outgoing: CampaignInfluencer;
    incoming: CampaignInfluencer;
    carriedAdvance: number;
    consumedCredit: number;
    surplus: number;
    finalPayable: number;
    replacementId: string;
}

// Money-math preview for the replace confirm step (appId = outgoing creator's CI).
export function useReplacePreview(campaignId: string, appId: string | null) {
    return useQuery({
        queryKey: [...queryKeys.campaigns.applications(campaignId), 'replace-preview', appId],
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<ReplacePreview>>(
                API.campaigns.applications.replacePreview(campaignId, appId as string),
            );
            return data.data;
        },
        enabled: !!campaignId && !!appId,
        retry: shouldRetryQuery,
    });
}

// Atomic replace: outgoing creator (appId) → terminal 'replaced'; incoming creator is
// accepted with the captured advance carried over. No optimistic update — two rows and
// campaign counters change server-side, so we refetch everything on success.
export function useReplaceCreator() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            appId,
            incomingCiId,
            reason,
            scriptDeadline,
            workDeadline,
        }: {
            campaignId: string;
            appId: string;
            incomingCiId: string;
            reason?: string;
            scriptDeadline?: string;
            workDeadline?: string;
        }) => {
            const { data } = await http.post<ApiResponse<ReplaceCreatorResult>>(
                API.campaigns.applications.replace(campaignId, appId),
                { incomingCiId, reason, scriptDeadline, workDeadline },
            );
            return data.data;
        },
        onSuccess: (_result, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.payment.summary(campaignId) });
            // The replaced creator's scripts/works/proofs disappear from active lists
            // server-side — refresh those tabs too so the swap shows immediately.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.scripts(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.proofOfWork(campaignId) });
        },
    });
}

// Clears an earmarked (invite-time) replacement intent on a not-yet-completed
// replacement candidate — e.g. the brand changed their mind, or the outgoing
// creator became unreplaceable before the swap finished.
export function useCancelReplacementIntent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, appId }: { campaignId: string; appId: string }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.cancelReplacementIntent(campaignId, appId),
            );
            return data.data;
        },
        onSuccess: (updated, { campaignId, appId }) => {
            const merge = (rows?: CampaignInfluencer[]) =>
                rows?.map((row) => (row.id === appId ? { ...row, ...updated } : row));

            queryClient.setQueryData<CampaignInfluencer[] | undefined>(
                queryKeys.campaigns.applications(campaignId), (old) => merge(old),
            );
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(
                queryKeys.campaigns.statusBoard(campaignId), (old) => merge(old),
            );
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

export function useRateApplication() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            appId,
            rating,
            review,
        }: {
            campaignId: string;
            appId: string;
            rating: number;
            review?: string;
        }) => {
            const { data } = await http.post<ApiResponse<CampaignInfluencer>>(
                API.campaigns.applications.rate(campaignId, appId),
                { rating, review },
            );
            return data.data;
        },
        onMutate: async ({ campaignId, appId, rating, review }) => {
            const appsKey = queryKeys.campaigns.applications(campaignId);
            await queryClient.cancelQueries({ queryKey: appsKey });
            const previous = queryClient.getQueryData<CampaignInfluencer[]>(appsKey);

            // Optimistically patch the rating into the cache so the UI updates instantly
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(appsKey, (old) =>
                old?.map((row) =>
                    row.id === appId
                        ? { ...row, brandRating: rating, brandReview: review ?? null }
                        : row
                )
            );
            return { previous };
        },
        onError: (_err, { campaignId }, context) => {
            queryClient.setQueryData(queryKeys.campaigns.applications(campaignId), context?.previous);
        },
        onSuccess: (updated, { campaignId, appId }) => {
            // Merge server response
            queryClient.setQueryData<CampaignInfluencer[] | undefined>(
                queryKeys.campaigns.applications(campaignId),
                (old) => old?.map((row) => (row.id === appId ? { ...row, ...updated } : row))
            );
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
        },
    });
}
