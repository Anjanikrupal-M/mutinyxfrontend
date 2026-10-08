// ─────────────────────────────────────────────────────────────
// Deadline Hooks — Set individual + bulk creator deadlines
// ─────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';

interface DeadlinePayload {
    scriptDeadline?: string | null;
    workDeadline?: string | null;
    proofOfWorkDeadline?: string | null;
}

// Set deadlines for a single accepted influencer
export function useSetDeadline() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            campaignId,
            appId,
            ...payload
        }: DeadlinePayload & { campaignId: string; appId: string }) => {
            const { data } = await http.patch(
                API.campaigns.applications.setDeadline(campaignId, appId),
                payload
            );
            return data;
        },
        onSuccess: (_data, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}

// Bulk-set deadlines for all accepted influencers in a campaign (fills blanks only)
export function useBulkSetDeadlines() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            campaignId,
            ...payload
        }: DeadlinePayload & { campaignId: string }) => {
            const { data } = await http.post(
                API.campaigns.applications.bulkDeadline(campaignId),
                payload
            );
            return data;
        },
        onSuccess: (_data, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}
