// ─────────────────────────────────────────────────────────────
// Influencer / Discover Hooks — Search, Detail, Invite, Bulk Invite
// ─────────────────────────────────────────────────────────────

import { useQuery, useQueries, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import type { ApiResponse, PaginatedResponse } from '@/core/types';
import type { InstagramInsightsPayload } from '../influencer-display';
import {
    demoBookmarkCollections,
    demoGetInfluencer,
    demoSearchInfluencers,
    demoToggleBookmark,
    isDevDemoSession,
} from '@/mocks/devInfluencers';

export interface PreviousWorkPost {
    id: string;
    permalink: string;
    platform: string | null;
    contentFormat: string | null;
    contentType: string | null;
    thumbnailUrl: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    reach: number | null;
    shares: number | null;
    saves: number | null;
}

/** A completed Mutiny campaign on the creator's profile. Carries no money fields by design. */
export interface PreviousWorkItem {
    id: string;
    campaignId: string;
    campaignName: string;
    campaignThumbnailUrl: string | null;
    platform: string | null;
    brand: { name: string; logoUrl: string | null; industry: string | null };
    completedAt: string | null;
    rating: number | null;
    review: string | null;
    results: {
        posts: number;
        views: number | null;
        likes: number | null;
        comments: number | null;
        reach: number | null;
        shares: number | null;
        saves: number | null;
    };
    posts: PreviousWorkPost[];
}

export interface Influencer {
    id: string;
    userName: string;
    handle: string;
    userAvatarUrl?: string | null;
    userPhoneNumber?: string;
    bio: string;
    location: string;
    platforms: Array<{
        handle: string;
        platform: string;
        followers: number;
    }>;
    followerCount: number;
    engagementRate: string | number;
    tier: string;
    niche: string[]; // Keep for internal use if needed, but API usually sends 'niches'
    niches: string[];
    avgViews?: number;
    contentCount?: number;
    languages?: string[];
    demographics?: {
        age?: Record<string, number>;
        gender?: { male?: number; female?: number };
        topLocations?: string[];
    };
    socialAccounts?: Record<string, {
        handle?: string;
        followers?: number;
        profileUrl?: string;
    }>;
    pastCollaborations: number;
    experience?: string;
    rating: number | null;
    ratingCount?: number;
    rateCard?: Record<string, number>;
    isVerified?: boolean;
    profileComplete?: boolean;
    profileCompletionIssues?: string[];
    portfolio?: Array<{
        id: string;
        title?: string;
        description?: string;
        mediaUrl: string;
        mediaType: 'image' | 'video' | 'link';
        thumbnailUrl?: string;
        externalUrl?: string;
        platform?: string;
    }>;
    isBookmarked?: boolean;
    collectionName?: string | null;
    badges?: string[];
    instagramInsights?: InstagramInsightsPayload | null;
    previousWork?: PreviousWorkItem[];
    instagramConnected?: boolean;
    instagramDataCoverage?: 'full' | 'partial' | 'limited';
    instagramLastSyncedAt?: string | null;
    instagramReach30d?: number | null;
    instagramInteractions30d?: number | null;
    instagramFollowerGrowth30d?: number | null;
    instagramEngagementByReach?: number | null;
    instagramSaveRate?: number | null;
    instagramShareRate?: number | null;
    instagramTopCountry?: string | null;
    instagramTopCity?: string | null;
    instagramTopAgeGroup?: string | null;
    /** A searched place is this creator's top follower city according to Meta. */
    audienceCityMatch?: boolean;
    /** Which engagement `engagementRate` holds: Meta's by-reach figure, or the per-follower post rate. */
    engagementBasis?: 'meta_reach' | 'posts';
    /** Where the metrics come from: verified and refreshing, verified but stale, or self-reported. */
    dataTrust?: 'verified' | 'verified_not_refreshing' | 'self_reported';
    dataRefreshedAt?: string | null;
    /** Median views over the creator's recent reels (Meta-verified); null with fewer than 3 reels. */
    medianReelViews?: number | null;
    /** Completed campaigns in the niches the search asked about; null when it didn't ask. */
    similarCampaigns?: number | null;
    /** Campaign posts with Meta-verified results. */
    verifiedCampaignResults?: number;
}

interface SearchParams {
    q?: string;
    niche?: string | string[];
    platform?: string;
    tier?: string | 'Nano' | 'Micro' | 'Mid' | 'Macro' | 'Mega';
    location?: string;
    minFollowers?: number;
    maxFollowers?: number;
    minEngagement?: number;
    /** Median views across recent reels (Meta-verified only). */
    minReelViews?: number;
    /** Accounts reached in the last 30 days (Meta-verified, fresh data only). */
    minReach?: number;
    /** How many creators were asked for; fewer matching returns meta.shortfall. */
    wanted?: number;
    /** 'any' or pipe-separated niche labels: creators with completed campaigns in them. */
    workedOn?: string;
    page?: number;
    limit?: number;
    savedOnly?: boolean;
    creatorSize?: string;
    collectionName?: string;
    /** Comma-separated badge keys; filtered in SQL so it spans every page, not just this one. */
    badges?: string;
    /** 'fit' ranks the whole match set by Brand Fit server-side (what the AI search uses). */
    sort?: 'relevance' | 'fit' | 'best' | 'engagement' | 'followers' | 'reach';
    /** 'canonical' resolves every stored niche spelling through the taxonomy; see DiscoverPage. */
    nicheMatch?: 'substring' | 'canonical';
}

// ── Queries ──

/** Why a search that asked for N creators found fewer — real counts from the server. */
export interface SearchShortfall {
    requested: number;
    found: number;
    reasons: string[];
}

export type InfluencerSearchResponse = PaginatedResponse<Influencer> & {
    meta: PaginatedResponse<Influencer>['meta'] & { shortfall?: SearchShortfall };
};

export function useInfluencerSearch(params?: SearchParams) {
    return useQuery({
        queryKey: queryKeys.discover.search(params as Record<string, unknown>),
        queryFn: async () => {
            if (isDevDemoSession()) return demoSearchInfluencers(params as Record<string, unknown>) as Promise<InfluencerSearchResponse>;
            const { data } = await http.get<InfluencerSearchResponse>(API.discover.search, {
                params,
            });
            return data;
        },
        // Keep the current cards on screen while the next filter/search result loads,
        // instead of flashing the skeleton grid on every change.
        placeholderData: keepPreviousData,
    });
}

/**
 * Parsed filter values the AI extracts from a free-text creator-search query.
 *
 * Every dimension is a list because users routinely name several ("influencers from vizag
 * and hyderabad and chennai"); the search ORs them. An empty list means the query said
 * nothing about that dimension — the parser is explicitly told never to fill one in, since
 * an invented platform or tier quietly discards most of the creators the user asked for.
 */
export interface AiSearchFilters {
    niches: string[];
    platforms: string[];
    tiers: string[];
    locations: string[];
    badges: string[];
    keywords: string | null;
    /** Read from the query text, never guessed by the model. */
    minFollowers?: number | null;
    maxFollowers?: number | null;
    minReelViews?: number | null;
    minEngagement?: number | null;
    /** Accounts reached in 30 days (Meta), read from the query text. */
    minReach?: number | null;
    /** How many creators the query asked for ("give me 3"). */
    resultCount?: number | null;
    workedOn?: { niches: string[] } | null;
    rankBy?: 'best' | 'engagement' | 'followers';
    /** How the request was interpreted, and anything that could not be applied. */
    notes?: string[];
    /** True when the model call failed and this is a keyword-only fallback, not a real parse. */
    aiUnavailable?: boolean;
}

export interface AiSearchOptions {
    niches: string[];
    platforms: string[];
    tiers: string[];
    badges: Array<{ key: string; label: string }>;
    locations: string[];
}

/**
 * Sends a natural-language creator-search query to the AI parser, which returns the
 * structured niche/platform/tier/location/badge/keyword filters to apply. The available
 * option vocabulary is passed in so the model can only ever return real filter values.
 */
export function useAiInfluencerSearch() {
    return useMutation({
        mutationFn: async ({ query, options }: { query: string; options: AiSearchOptions }) => {
            const { data } = await http.post<ApiResponse<AiSearchFilters>>(API.ai.influencerSearch, {
                query,
                options,
            });
            return data.data;
        },
    });
}

const influencerDetailQuery = (id: string) => ({
    queryKey: queryKeys.discover.detail(id),
    queryFn: async () => {
        if (isDevDemoSession()) return demoGetInfluencer(id);
        const { data } = await http.get<ApiResponse<Influencer>>(API.discover.getInfluencer(id));
        return data.data;
    },
    enabled: !!id,
});

export function useInfluencer(id: string) {
    return useQuery(influencerDetailQuery(id));
}

/** Several profiles at once (the compare table), sharing the cache with useInfluencer. */
export function useInfluencersByIds(ids: string[]) {
    return useQueries({ queries: ids.map(influencerDetailQuery) });
}

// ── Mutations ──

export function useInviteInfluencer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            influencerId,
            campaignId,
            message,
        }: {
            influencerId: string;
            campaignId: string;
            message?: string;
        }) => {
            const { data } = await http.post<ApiResponse<unknown>>(API.campaigns.invite(campaignId), {
                influencerIds: [influencerId],
                message,
            });
            return data.data;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useBulkInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            influencerIds,
            campaignId,
            message,
        }: {
            influencerIds: string[];
            campaignId: string;
            message?: string;
        }) => {
            const { data } = await http.post<ApiResponse<unknown>>(API.campaigns.invite(campaignId), {
                influencerIds,
                message,
            });
            return data.data;
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.applications(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.submissions(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.statusBoard(campaignId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
        },
    });
}

export function useToggleBookmark() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            influencerId,
            collectionName,
            action,
        }: {
            influencerId: string;
            collectionName?: string | null;
            action?: 'save' | 'unsave';
        }) => {
            if (isDevDemoSession()) return demoToggleBookmark(influencerId, collectionName, action);
            const { data } = await http.post<ApiResponse<{ isBookmarked: boolean; collectionName?: string | null }>>(
                API.discover.bookmark(influencerId),
                { collectionName, action }
            );
            return data.data;
        },
        // Optimistic update
        onMutate: async ({ influencerId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.discover.detail(influencerId) });
            const previous = queryClient.getQueryData<Influencer>(queryKeys.discover.detail(influencerId));

            if (previous) {
                queryClient.setQueryData<Influencer>(queryKeys.discover.detail(influencerId), {
                    ...previous,
                    isBookmarked: !previous.isBookmarked,
                });
            }

            return { previous };
        },
        onError: (err, { influencerId }, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.discover.detail(influencerId), context.previous);
            }
        },
        onSettled: (data, err, { influencerId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discover.detail(influencerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.discover.search({}) });
            queryClient.invalidateQueries({ queryKey: ['bookmark-collections'] });
        },
    });
}

export interface BookmarkCollectionsResponse {
    collections: Array<{ name: string; count: number; coverUrl: string | null }>;
    uncategorizedCount: number;
    totalCount: number;
}

export function useBookmarkCollections() {
    const user = useAuthStore((state) => state.user);
    return useQuery({
        queryKey: ['bookmark-collections'],
        queryFn: async () => {
            if (isDevDemoSession()) return demoBookmarkCollections();
            const { data } = await http.get<ApiResponse<BookmarkCollectionsResponse>>(
                API.discover.collections
            );
            return data.data;
        },
        // Collections belong to the brand owner only.
        // Agents have no bookmark collections — the endpoint returns 401 for them.
        enabled: !!user && user.role !== 'agent',
    });
}
