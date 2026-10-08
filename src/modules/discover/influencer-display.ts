export type SocialAccountEntry = {
  platform: string;
  handle: string | null;
  followerCount: number | null;
};

export type InstagramInsightsPayload = {
  connected: boolean;
  connectMethod: 'instagram_login' | null;
  requiresReconnect?: boolean;
  lastSyncedAt: string | null;
  profile: {
    username: string | null;
    displayName: string | null;
    profilePictureUrl: string | null;
    biography: string | null;
    website: string | null;
    followerCount: number;
    followsCount: number | null;
    mediaCount: number | null;
    accountType: string | null;
  };
  performance: {
    engagementRate: number;
    avgLikes: number;
    avgComments: number;
    postingFrequency: number;
    contentMix: { image: number; video: number; carousel: number };
    lastPostDate: string | null;
  };
  accountPerformance?: {
    period: 'day';
    since: string | null;
    until: string | null;
    metrics: Record<string, number>;
    breakdowns: Array<{
      metric: string;
      dimension: string;
      values: Record<string, number>;
    }>;
    availability: AnalyticsAvailability;
  };
  audience?: {
    followers?: AudienceBreakdown;
    engaged?: AudienceBreakdown;
    availability: AnalyticsAvailability;
  };
  topPosts: Array<{
    permalink: string;
    mediaType: string;
    likeCount: number;
    commentsCount: number;
    timestamp: string;
    thumbnail?: string;
  }>;
  summary?: {
    followerGrowth30d: number | null;
    engagementByReach: number | null;
    saveRate: number | null;
    shareRate: number | null;
    topCountry: string | null;
    topCity: string | null;
    topAgeGroup: string | null;
  };
  performanceTrend?: Array<{
    collectedAt: string;
    since: string;
    until: string;
    reach: number | null;
    views: number | null;
    interactions: number | null;
    saves: number | null;
    shares: number | null;
  }>;
  content?: Array<{
    id: string;
    format: string;
    mediaType: string | null;
    mediaProductType: string | null;
    caption: string | null;
    permalink: string | null;
    thumbnailUrl: string | null;
    publishedAt: string | null;
    carouselItemCount: number;
    metricsCollectedAt: string | null;
    insightsStatus: 'available' | 'unavailable' | 'not_refreshed';
    metrics: {
      views: number | null;
      reach: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      saves: number | null;
      totalInteractions: number | null;
      replies: number | null;
      follows: number | null;
      averageWatchTimeMs: number | null;
      totalWatchTimeMs: number | null;
      engagementRate: number | null;
    } | null;
  }>;
  scores: {
    engagementScore: number;
    consistencyScore: number;
    overallCreatorScore: number;
  };
  provenance?: {
    source: 'meta_graph' | 'legacy_unverified';
    verified: boolean;
    graphVersion: string | null;
    collectedAt: string | null;
    status: 'fresh' | 'stale' | 'failed' | 'reauth_required';
  };
  dataCoverage?: {
    level: 'full' | 'partial' | 'limited';
    notes: string[];
  };
};

export type AudienceBreakdown = {
  age?: Record<string, number>;
  gender?: Record<string, number>;
  countries?: Record<string, number>;
  cities?: Record<string, number>;
};

export type AnalyticsAvailability = {
  status: 'available' | 'partial' | 'unavailable';
  reason?: 'below_meta_threshold' | 'permission_or_metric_unavailable' | 'request_failed';
  collectedAt: string | null;
};

export type PortfolioItem = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  externalUrl?: string | null;
  platform?: string | null;
  title?: string | null;
};

export function normalizeSocialAccounts(
  socialAccounts?: SocialAccountEntry[] | Record<string, { handle?: string; followers?: number }> | null,
  platforms?: Array<{ platform: string; handle?: string; followers?: number }>,
): SocialAccountEntry[] {
  if (Array.isArray(socialAccounts) && socialAccounts.length > 0) {
    return socialAccounts.map((a) => ({
      platform: a.platform,
      handle: a.handle ?? null,
      followerCount: a.followerCount ?? null,
    }));
  }
  if (socialAccounts && !Array.isArray(socialAccounts)) {
    return Object.entries(socialAccounts).map(([platform, account]) => ({
      platform,
      handle: account?.handle ?? null,
      followerCount: account?.followers ?? null,
    }));
  }
  if (platforms?.length) {
    return platforms.map((p) => ({
      platform: p.platform,
      handle: p.handle ?? null,
      followerCount: p.followers ?? null,
    }));
  }
  return [];
}
