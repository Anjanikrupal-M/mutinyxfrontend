// ─────────────────────────────────────────────────────────────
// Centralized Query Key Factory
// Every hook and WS invalidation references these keys to
// ensure consistent cache management across the app.
// ─────────────────────────────────────────────────────────────

export const queryKeys = {
    auth: {
        me: ['auth', 'me'] as const,
    },

    profile: {
        me: ['profile'] as const,
    },

    campaigns: {
        all: ['campaigns'] as const,
        list: (filters?: Record<string, unknown>) => ['campaigns', 'list', filters] as const,
        detail: (id: string) => ['campaigns', id] as const,
        applications: (campaignId: string) => ['campaigns', campaignId, 'applications'] as const,
        recommendations: (campaignId: string) => ['campaigns', campaignId, 'recommendations'] as const,
        statusBoard: (campaignId: string) => ['campaigns', campaignId, 'applications', 'status-board'] as const,
        negotiation: (campaignId: string, influencerId: string) =>
            ['campaigns', campaignId, 'negotiation', influencerId] as const,
        payment: {
            summary: (campaignId: string) => ['campaigns', campaignId, 'payments', 'summary'] as const,
        },
        scripts: (campaignId: string) => ['campaigns', campaignId, 'scripts'] as const,
        submissions: (campaignId: string) => ['campaigns', campaignId, 'submissions'] as const,
        proofOfWork: (campaignId: string) => ['campaigns', campaignId, 'proof-of-work'] as const,
    },

    discover: {
        search: (params?: Record<string, unknown>) => ['influencers', 'search', params] as const,
        detail: (id: string) => ['influencers', id] as const,
    },

    messages: {
        all: ['messages'] as const,
        detail: (conversationId: string) => ['messages', conversationId] as const,
        infinite: (conversationId: string, limit: number) => ['messages', conversationId, { limit, infinite: true }] as const,
    },

    notifications: {
        all: ['notifications'] as const,
        list: (params?: Record<string, unknown>) => ['notifications', 'list', params] as const,
    },

    analytics: {
        all: ['analytics'] as const,
        overview: ['analytics', 'overview'] as const,
        campaign: (campaignId: string) => ['analytics', campaignId] as const,
        summary: (campaignId: string) => ['analytics', campaignId, 'summary'] as const,
        breakdown: (campaignId: string) => ['analytics', campaignId, 'breakdown'] as const,
    },

    pricing: {
        tierConfig: ['pricing', 'tier-config'] as const,
    },

    programs: {
        all:         ['programs'] as const,
        list:        (filters?: Record<string, unknown>) => ['programs', 'list', filters] as const,
        detail:      (id: string) => ['programs', id] as const,
        enrollments: (id: string) => ['programs', id, 'enrollments'] as const,
    },

    subscription: {
        me: ['subscription', 'me'] as const,
        plans: ['subscription', 'plans'] as const,
        managerRequest: ['subscription', 'managerRequest'] as const,
    },

    transactions: {
        all: ['transactions'] as const,
        list: (filters?: Record<string, unknown>) => ['transactions', 'list', filters] as const,
    },

    brandProfiles: {
        all: ['brandProfiles'] as const,
        overview: ['brandProfiles', 'overview'] as const,
        deactivated: ['brandProfiles', 'deactivated'] as const,
        detail: (id: string) => ['brandProfiles', id] as const,
    },

    team: {
        all: ['team'] as const,
        detail: (id: string) => ['team', id] as const,
        workload: (id: string) => ['team', id, 'workload'] as const,
    },

    social: {
        status: ['social', 'status'] as const,
    },
} as const;
