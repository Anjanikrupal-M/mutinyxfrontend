import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import type { BrandProfileSummary } from '@/shared/hooks/useBrandProfiles';
import type { TeamMember } from './useTeam';
import { isDevDemoSession, demoAgencyOverview } from '@/mocks/devBrands';

export interface BrandOverview extends BrandProfileSummary {
    campaignCount: number;
    activeCampaignCount: number;
    totalBudget: number;
    totalSpent: number;
}

export interface AgencyOverview {
    brands: BrandOverview[];
    // Response key stays `owners` to match the backend agency-overview payload.
    owners: TeamMember[];
    totals: {
        brandCount: number;
        ownerCount: number;
        campaignCount: number;
        activeCampaignCount: number;
    };
}

// Cross-brand oversight for the agency head — every brand's campaign activity
// plus every team member, without switching into each brand individually.
export function useAgencyOverview(enabled: boolean) {
    return useQuery<AgencyOverview>({
        queryKey: queryKeys.brandProfiles.overview,
        queryFn: () => (isDevDemoSession() ? demoAgencyOverview() : http.get(API.brandProfiles.overview).then((r) => r.data.data)),
        enabled,
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
