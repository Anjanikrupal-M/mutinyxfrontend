import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';
import type { ProofReelAnalytics } from '@/shared/types/campaign';

export function useCampaignProofAnalytics(campaignId: string, refetchInterval?: number | false) {
    return useQuery<ProofReelAnalytics[]>({
        queryKey: ['campaign-proof-analytics', campaignId],
        queryFn: () =>
            http.get(API.analytics.campaignProofs(campaignId)).then((r) => r.data.data ?? []),
        staleTime: 0,
        enabled: !!campaignId,
        refetchInterval,
    });
}
