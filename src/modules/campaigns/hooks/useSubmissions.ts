// ─────────────────────────────────────────────────────────────
// Submissions Hooks — List, Approve, Reject
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { WorkSubmission } from '@/shared/types/campaign';
import ws from '@/core/websocket';

const shouldRetryQuery = (failureCount: number, error: unknown) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403 || status === 404 || status === 429) return false;
    return failureCount < 3;
};

// ── Queries ──

export function useSubmissions(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.submissions(campaignId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<WorkSubmission[]>>(
                API.campaigns.submissions.list(campaignId),
            );
            if (!data?.success) return [];
            const payload: unknown = (data as unknown as ApiResponse<unknown>).data;
            const normalizeWorkSubmissions = (rows: unknown): WorkSubmission[] => {
                if (!Array.isArray(rows)) return [];
                return rows.map((row) => {
                    const { proofOfWorkUrl, ...rest } = row as Record<string, unknown>;
                    return rest as unknown as WorkSubmission;
                });
            };

            if (Array.isArray(payload)) {
                return normalizeWorkSubmissions(payload);
            }
            // Some backends wrap lists under { items: [] } or { submissions: [] }
            const asObj = payload as Record<string, unknown> | null;
            const maybeItems = asObj?.items;
            if (Array.isArray(maybeItems)) {
                return normalizeWorkSubmissions(maybeItems);
            }
            const maybeSubmissions = asObj?.submissions;
            if (Array.isArray(maybeSubmissions)) {
                return normalizeWorkSubmissions(maybeSubmissions);
            }
            return [];
        },
        enabled: !!campaignId,
    });
}

export function useProofOfWorkSubmissions(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.proofOfWork(campaignId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<unknown>>(
                API.campaigns.submissions.proofOfWork(campaignId),
            );
            const payload = data?.data ?? data;
            return Array.isArray(payload) ? (payload as any[]) : [];
        },
        enabled: !!campaignId,
        // Several pages (CampaignDetailPage, KanbanBoard, ProofOfWorkTab) subscribe to
        // this same key. Without a staleTime, every new subscriber that mounts treats
        // the cache as stale and fires a fresh GET. WS invalidations bypass staleTime,
        // so updates are still timely.
        staleTime: 30_000,
        placeholderData: keepPreviousData,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 30),
        refetchIntervalInBackground: false,
    });
}

// ── Mutations ──

/**
 * Write a review result into the cached list the moment the server confirms it, so the review
 * modal flips out of 'pending' immediately instead of re-showing Approve / Request Revision
 * until the background refetch lands. Only the review fields are copied: the list rows carry
 * joined fields (creator name, history, …) that the bare mutation response lacks.
 */
function patchReviewedSubmission(
    queryClient: ReturnType<typeof useQueryClient>,
    campaignId: string,
    subId: string,
    updated: Partial<WorkSubmission> | undefined,
    fallbackStatus: WorkSubmission['status'],
    reviewNote?: string,
) {
    queryClient.setQueryData<WorkSubmission[]>(queryKeys.campaigns.submissions(campaignId), (rows) =>
        Array.isArray(rows)
            ? rows.map((row) => (row.id === subId
                ? {
                    ...row,
                    status: updated?.status ?? fallbackStatus,
                    reviewNote: updated?.reviewNote ?? reviewNote ?? row.reviewNote,
                    reviewedAt: updated?.reviewedAt ?? new Date().toISOString(),
                }
                : row))
            : rows,
    );
}

export function useApproveSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, subId, reviewNote }: { campaignId: string; subId: string; reviewNote?: string }) => {
            const { data } = await http.post<ApiResponse<WorkSubmission>>(
                API.campaigns.submissions.approve(campaignId, subId),
                reviewNote ? { reviewNote } : {},
            );
            return data.data;
        },
        onSuccess: (updated, { campaignId, subId, reviewNote }) => {
            patchReviewedSubmission(queryClient, campaignId, subId, updated, 'approved', reviewNote);
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            // Invalidate the campaigns list so dashboard's pendingSubmissions count updates immediately.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useRejectSubmission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            subId,
            reviewNote,
        }: {
            campaignId: string;
            subId: string;
            reviewNote: string;
        }) => {
            const { data } = await http.post<ApiResponse<WorkSubmission>>(
                API.campaigns.submissions.reject(campaignId, subId),
                { reviewNote },
            );
            return data.data;
        },
        onSuccess: (updated, { campaignId, subId, reviewNote }) => {
            patchReviewedSubmission(queryClient, campaignId, subId, updated, 'rejected', reviewNote);
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaignId) });
            // Invalidate the campaigns list so dashboard's pending counts update immediately.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}
