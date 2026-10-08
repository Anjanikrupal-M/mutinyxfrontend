// ─────────────────────────────────────────────────────────────
// Scripts Hooks — List, Approve, Request Revision
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { ScriptVersion } from '@/shared/types/campaign';

// ── Queries ──

export function useScripts(campaignId: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.scripts(campaignId),
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<ScriptVersion[]>>(
                API.campaigns.scripts.list(campaignId),
            );
            if (!data?.success) return [];
            const payload: unknown = (data as unknown as ApiResponse<unknown>).data;
            if (Array.isArray(payload)) return payload as ScriptVersion[];
            // Some backends wrap lists under { items: [] } or { scripts: [] }
            const asObj = payload as Record<string, unknown> | null;
            const maybeItems = asObj?.items;
            if (Array.isArray(maybeItems)) return maybeItems as ScriptVersion[];
            const maybeScripts = asObj?.scripts;
            if (Array.isArray(maybeScripts)) return maybeScripts as ScriptVersion[];
            return [];
        },
        enabled: !!campaignId,
    });
}

// ── Mutations ──

/**
 * Write a review result into the cached list the moment the server confirms it, so the review
 * modal flips out of 'pending' immediately instead of re-showing Approve / Request Revision
 * until the background refetch lands. Only the review fields are copied.
 */
function patchReviewedScript(
    queryClient: ReturnType<typeof useQueryClient>,
    campaignId: string,
    scriptId: string,
    updated: Partial<ScriptVersion> | undefined,
    fallbackStatus: ScriptVersion['status'],
    reviewNote?: string,
) {
    queryClient.setQueryData<ScriptVersion[]>(queryKeys.campaigns.scripts(campaignId), (rows) =>
        Array.isArray(rows)
            ? rows.map((row) => (row.id === scriptId
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

export function useApproveScript() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, scriptId, reviewNote }: { campaignId: string; scriptId: string; reviewNote?: string }) => {
            const { data } = await http.post<ApiResponse<ScriptVersion>>(
                API.campaigns.scripts.approve(campaignId, scriptId),
                reviewNote ? { reviewNote } : {},
            );
            return data.data;
        },
        onSuccess: (updated, { campaignId, scriptId, reviewNote }) => {
            patchReviewedScript(queryClient, campaignId, scriptId, updated, 'approved', reviewNote);
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.scripts(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            // Refresh dashboard pending counts.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useRequestScriptRevision() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignId,
            scriptId,
            reviewNote,
        }: {
            campaignId: string;
            scriptId: string;
            reviewNote: string;
        }) => {
            const { data } = await http.post<ApiResponse<ScriptVersion>>(
                API.campaigns.scripts.requestRevision(campaignId, scriptId),
                { reviewNote },
            );
            return data.data;
        },
        onSuccess: (updated, { campaignId, scriptId, reviewNote }) => {
            patchReviewedScript(queryClient, campaignId, scriptId, updated, 'revision_requested', reviewNote);
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.scripts(campaignId) });
            // Refresh dashboard pending counts.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}
