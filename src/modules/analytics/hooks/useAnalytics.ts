// ─────────────────────────────────────────────────────────────
// Analytics Hooks — Overview + Per-Campaign
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { InstagramFormatMetricTotals } from '@/modules/campaigns/hooks/useCampaignAnalytics';

export interface AnalyticsFormatBreakdown {
    id: string;
    name: string;
    handle?: string | null;
    metrics: InstagramFormatMetricTotals;
}

export interface AnalyticsOverviewFormat extends InstagramFormatMetricTotals {
    campaignCount: number;
    campaigns: AnalyticsFormatBreakdown[];
    influencers: AnalyticsFormatBreakdown[];
}

interface AnalyticsOverview {
    formats: AnalyticsOverviewFormat[];
    generatedAt: string;
}

// ── Queries ──

export function useAnalyticsOverview() {
    return useQuery({
        queryKey: queryKeys.analytics.overview,
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<AnalyticsOverview>>(API.analytics.overview);
            return data.data;
        },
        staleTime: 1000 * 60,
    });
}

export interface InfluencerBreakdown {
    influencerName: string;
    influencerHandle: string | null;
    influencerAvatar: string | null;
    agreedBudget: number | null;
    ciStatus: string;
    proofId: string | null;
    proofUrl: string | null;
    proofStatus: string | null;
    thumbnailUrl: string | null;
    mediaType: string | null;
    mediaId: string | null;
    scrapedAt: string | null;
    metricSource: 'meta_graph' | 'legacy_unverified';
    metricStatus: 'fresh' | 'stale' | 'refreshing' | 'failed' | 'reauth_required' | 'unverified';
    metricErrorCode: string | null;
    metricsFetchedAt: string | null;
    graphApiVersion: string | null;
    likes: number | null;
    comments: number | null;
    reach: number | null;
    impressions: number | null;
    shares: number | null;
    saved: number | null;
    engagementRate: string | null;
    cpr: number | null; // cost per 1K reach in ₹
}

export function useRefreshProofAnalytics(campaignId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await http.post<ApiResponse<{ results: Array<{ proofId: string; status: string; errorCode?: string }> }>>(API.analytics.refreshProofs(campaignId), { force: true });
            return data.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.summary(campaignId) });
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.breakdown(campaignId) });
            void qc.invalidateQueries({ queryKey: ['campaign-proof-analytics', campaignId] });
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.overview });
        },
    });
}

export function useApproveProof() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ campaignId, proofId }: { campaignId: string; proofId: string }) => {
            await http.post(API.campaigns.submissions.approveProofOfWork(campaignId, proofId));
        },
        onSuccess: (_, { campaignId }) => {
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.breakdown(campaignId) });
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.summary(campaignId) });
        },
    });
}

export function useRejectProof() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ campaignId, proofId, reviewNote }: { campaignId: string; proofId: string; reviewNote: string }) => {
            await http.post(API.campaigns.submissions.rejectProofOfWork(campaignId, proofId), { reviewNote });
        },
        onSuccess: (_, { campaignId }) => {
            void qc.invalidateQueries({ queryKey: queryKeys.analytics.breakdown(campaignId) });
        },
    });
}
