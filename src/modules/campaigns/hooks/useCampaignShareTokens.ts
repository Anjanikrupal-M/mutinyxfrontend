/**
 * Fetches the campaign-level public review tokens (one per kind: script,
 * work, proof). Backend lazily generates any missing tokens on read.
 */

import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';

interface CampaignShareTokens {
    scriptReviewToken: string | null;
    workReviewToken: string | null;
    proofReviewToken: string | null;
    overviewToken: string | null;
}

export function useCampaignShareTokens(campaignId: string | undefined) {
    return useQuery({
        queryKey: ['campaigns', 'share-tokens', campaignId],
        queryFn: async () => {
            const { data } = await http.get<{ success: boolean; data: CampaignShareTokens }>(
                API.campaigns.shareTokens(campaignId!),
            );
            return data?.data || (data as unknown as CampaignShareTokens);
        },
        enabled: Boolean(campaignId),
        staleTime: 1000 * 60 * 60, // tokens are stable; cache for an hour
    });
}
