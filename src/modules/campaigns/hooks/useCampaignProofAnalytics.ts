import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';
import type { ProofReelAnalytics } from '@/shared/types/campaign';
import { isDevDemoSession } from '@/mocks/devCampaigns';
import { demoListProofAnalytics } from '@/mocks/devCampaignTabs';

export function useCampaignProofAnalytics(campaignId: string, refetchInterval?: number | false) {
    return useQuery<ProofReelAnalytics[]>({
        queryKey: ['campaign-proof-analytics', campaignId],
        // Demo account in development: served from the browser (see mocks/devCampaignTabs.ts), no server call.
        queryFn: () => (isDevDemoSession()
            ? demoListProofAnalytics(campaignId)
            : http.get(API.analytics.campaignProofs(campaignId)).then((r) => r.data.data ?? [])),
        staleTime: 0,
        enabled: !!campaignId,
        refetchInterval,
    });
}
