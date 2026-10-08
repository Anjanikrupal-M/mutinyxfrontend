import { useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';

interface InviteResult {
    succeeded: number;
    failed: number;
    errors: { reason: string }[];
    total: number;
}

export function useInviteInfluencers(campaignId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            influencerIds,
            message,
            replacementForCiId,
        }: {
            influencerIds: string[];
            message?: string;
            // Set when this invite is meant to replace an existing (post-payment)
            // creator — the outgoing CI's id. Only valid with a single influencerId.
            replacementForCiId?: string;
        }) => {
            const { data } = await http.post<{ success: boolean; data: InviteResult }>(
                API.campaigns.invite(campaignId),
                { influencerIds, message, replacementForCiId },
            );
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
        },
    });
}
