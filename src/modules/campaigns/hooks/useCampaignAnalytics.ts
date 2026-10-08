import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';

export interface PlatformMetricSection {
    totalReach: number;
    totalViews: number;
    totalImpressions: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaved: number;
    totalEngagements: number;
    estimatedMinutesWatched?: number;
    averageViewDuration?: number | null;
    averageViewPercentage?: number | null;
    subscribersGained?: number;
    subscribersLost?: number;
    engagedViews?: number;
    engagementRate: number;
}

export type InstagramContentFormat = 'reel' | 'story-image' | 'story-video' | 'feed-image' | 'feed-video' | 'carousel';
export type MetricAvailability = 'available' | 'not_returned' | 'not_supported' | 'error';

export interface InstagramFormatMetricTotals {
    format: InstagramContentFormat;
    label: string;
    requested: boolean;
    proofCount: number;
    creatorCount: number;
    lastFetchedAt: string | null;
    totalReach: number | null;
    totalViews: number | null;
    totalLikes: number | null;
    totalComments: number | null;
    totalShares: number | null;
    totalSaved: number | null;
    totalEngagements: number | null;
    totalReplies: number | null;
    totalFollows: number | null;
    averageWatchTime: number | null;
    totalWatchTime: number | null;
    engagementRate: number | null;
    metricAvailability: Record<string, MetricAvailability>;
}

export interface CampaignAnalyticsSummary {
    instagramByFormat: InstagramFormatMetricTotals[];
    requestedInstagramFormats?: InstagramContentFormat[];
    youtube: PlatformMetricSection;
    generatedAt: string;
}

export function useCampaignAnalytics(campaignId: string) {
    return useQuery<CampaignAnalyticsSummary>({
        queryKey: ['campaign-analytics-summary', campaignId],
        queryFn: () =>
            http.get(API.analytics.campaignSummary(campaignId)).then((r) => r.data.data),
        staleTime: 1000 * 60 * 2,
        enabled: !!campaignId,
    });
}

export interface CampaignMetricHistoryPoint {
    platform: string;
    date: string;
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saved: number | null;
    totalInteractions: number | null;
    watchMinutes: number | null;
    contentId?: string;
    campaignInfluencerId?: string;
    influencerName?: string;
    contentFormat?: string;
    providerExpiresAt?: string | null;
    finalCaptureDueAt?: string | null;
    finalCaptureStatus?: 'not_required' | 'pending' | 'captured' | 'missed';
    isFinal?: boolean;
    lastSuccessfulSyncAt?: string | null;
}

type CampaignMetricTotals = Pick<CampaignMetricHistoryPoint, 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saved' | 'totalInteractions' | 'watchMinutes'>;

export interface CampaignMetricHistory {
    campaignId: string;
    series: CampaignMetricHistoryPoint[];
    byFormat: Array<{
        key: string;
        platform: string;
        contentFormat: string;
        totals: CampaignMetricTotals;
    }>;
    influencers: Array<{
        campaignInfluencerId: string;
        influencerName: string;
        totals: CampaignMetricTotals;
        series: Array<Pick<CampaignMetricHistoryPoint, 'date' | 'views' | 'reach' | 'totalInteractions'>>;
    }>;
    contentPoints: CampaignMetricHistoryPoint[];
}

export function useCampaignMetricHistory(campaignId: string) {
    return useQuery<CampaignMetricHistory>({
        queryKey: ['campaign-metric-history', campaignId],
        queryFn: () => http.get(API.analytics.campaignHistory(campaignId)).then((r) => r.data.data),
        staleTime: 1000 * 60 * 2,
        enabled: !!campaignId,
    });
}
