// ─────────────────────────────────────────────────────────────
// Centralized API Endpoint Registry
// All endpoints, HTTP methods, and WebSocket events are defined here.
// Modules import from this file to power their TanStack Query hooks.
// ─────────────────────────────────────────────────────────────

const BASE   = import.meta.env.VITE_API_BASE_URL    || '/api/v1';
// Derive the v2 base from the v1 base when not explicitly provided, so production
// (which only sets VITE_API_BASE_URL) doesn't end up with a relative '/api/v2' that
// gets concatenated onto the v1 baseURL → '/api/v1/api/v2/...'.
const BASE_V2 = import.meta.env.VITE_API_BASE_URL_V2 || BASE.replace(/\/v1\b/, '/v2');

/** Construct a full endpoint path (v1) */
const ep = (path: string) => `${BASE}${path}`;
/** Construct a full endpoint path (v2 — Phase 2 features) */
const ep2 = (path: string) => `${BASE_V2}${path}`;

export const API = {
    auth: {
        // Spec: Role-prefixed — /brand/auth/* for brand users
        login: ep('/brand/auth/login'),
        register: ep('/brand/auth/register'),
        refresh: ep('/brand/auth/refresh'),
        logout: ep('/brand/auth/logout'),
        me: ep('/brand/auth/me'),
        updateMe: ep('/brand/auth/me'),
        forgotPassword: ep('/brand/auth/forgot-password'),
        resetPassword: ep('/brand/auth/reset-password'),
        changePassword: ep('/brand/auth/change-password'),
        verifyEmail: ep('/brand/auth/verify-email'),
        switchBrand: ep('/brand/auth/switch-brand'),
    },

    profile: {
        get: ep('/brand/profile'),
        update: ep('/brand/profile'),
        uploadAvatar: ep('/brand/profile/avatar'),
        deleteAvatar: ep('/brand/profile/avatar'),
        influencerGet: ep('/influencers/profile'),
        influencerUpdate: ep('/influencers/profile'),
        influencerUploadAvatar: ep('/influencers/profile/avatar'),
        influencerDeleteAvatar: ep('/influencers/profile/avatar'),
    },

    // Client brands — Agencies plan owners can create/manage several brand_profiles
    // rows under one login (see /shared/hooks/useBrandProfiles.ts)
    brandProfiles: {
        list: ep('/brand/profiles'),
        create: ep('/brand/profiles'),
        overview: ep('/brand/profiles/overview'),
        getById: (id: string) => ep(`/brand/profiles/${id}`),
        update: (id: string) => ep(`/brand/profiles/${id}`),
        uploadAvatar: (id: string) => ep(`/brand/profiles/${id}/avatar`),
        deleteAvatar: (id: string) => ep(`/brand/profiles/${id}/avatar`),
        // Soft deactivation (owner-only). Deactivated brands leave the accessible set,
        // so they have their own list endpoint for the reactivation UI.
        deactivatedList: ep('/brand/profiles/deactivated'),
        deactivate: (id: string) => ep(`/brand/profiles/${id}/deactivate`),
        reactivate: (id: string) => ep(`/brand/profiles/${id}/reactivate`),
    },

    campaigns: {
        list: ep('/campaigns'),
        create: ep('/campaigns'),
        getById: (id: string) => ep(`/campaigns/${id}`),
        update: (id: string) => ep(`/campaigns/${id}`),
        delete: (id: string) => ep(`/campaigns/${id}`),
        assign: (id: string) => ep(`/campaigns/${id}/assign`),
        launch: (id: string) => ep(`/campaigns/${id}/launch`),
        close: (id: string) => ep(`/campaigns/${id}/close`),
        uploadThumbnail: (id: string) => ep(`/campaigns/${id}/thumbnail`),
        uploadScript: (id: string) => ep(`/campaigns/${id}/script`),
        invite: (id: string) => ep(`/campaigns/${id}/invite`),
        shareTokens: (id: string) => ep(`/campaigns/${id}/share-tokens`),
        recommendations: (id: string) => ep(`/campaigns/${id}/recommendations`),

        applications: {
            list: (campaignId: string) => ep(`/campaigns/${campaignId}/applications`),
            statusBoard: (campaignId: string) => ep(`/campaigns/${campaignId}/applications/status-board`),
            approve: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/approve`),
            reject: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/reject`),
            productShipped: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/product-shipped`),
            productDelivered: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/product-delivered`),
            rate: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/rate`),
            setDeadline: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/deadline`),
            bulkDeadline: (campaignId: string) => ep(`/campaigns/${campaignId}/applications/bulk-deadline`),
            replacePreview: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/replace-preview`),
            replace: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/replace`),
            cancelReplacementIntent: (campaignId: string, appId: string) => ep(`/campaigns/${campaignId}/applications/${appId}/cancel-replacement-intent`),
        },

        negotiation: {
            get: (campaignId: string, influencerId: string) => ep(`/campaigns/${campaignId}/negotiation/${influencerId}`),
            accept: (campaignId: string, influencerId: string) => ep(`/campaigns/${campaignId}/negotiation/${influencerId}/accept`),
            counter: (campaignId: string, influencerId: string) => ep(`/campaigns/${campaignId}/negotiation/${influencerId}/counter`),
        },

        payment: {
            summary: (campaignId: string) => ep(`/campaigns/${campaignId}/payment/summary`),
            initiate: (campaignId: string) => ep(`/campaigns/${campaignId}/payment`),
            verify: (campaignId: string) => ep(`/campaigns/${campaignId}/payment/verify`),
            reconcile: (campaignId: string) => ep(`/campaigns/${campaignId}/payment/reconcile`),
            getRound: (campaignId: string, paymentId: string) =>
                ep(`/campaigns/${campaignId}/payment/${paymentId}`),
        },

        invoice: {
            send: (campaignId: string) => ep(`/campaigns/${campaignId}/invoice/send`),
        },

        scripts: {
            list: (campaignId: string) => ep(`/campaigns/${campaignId}/scripts`),
            approve: (campaignId: string, scriptId: string) => ep(`/campaigns/${campaignId}/scripts/${scriptId}/approve`),
            requestRevision: (campaignId: string, scriptId: string) => ep(`/campaigns/${campaignId}/scripts/${scriptId}/revise`),
        },

        submissions: {
            list: (campaignId: string) => ep(`/campaigns/${campaignId}/submissions`),
            approve: (campaignId: string, subId: string) => ep(`/campaigns/${campaignId}/submissions/${subId}/approve`),
            reject: (campaignId: string, subId: string) => ep(`/campaigns/${campaignId}/submissions/${subId}/reject`),
            proofOfWork: (campaignId: string) => ep(`/campaigns/${campaignId}/submissions/proof-of-work`),
            approveProofOfWork: (campaignId: string, proofId: string) => ep(`/campaigns/${campaignId}/submissions/proof-of-work/${proofId}/approve`),
            rejectProofOfWork: (campaignId: string, proofId: string) => ep(`/campaigns/${campaignId}/submissions/proof-of-work/${proofId}/reject`),
        },

        chat: {
            getMessages: (campaignId: string, influencerId: string) => ep(`/campaigns/${campaignId}/chat/${influencerId}`),
            sendMessage: (campaignId: string, influencerId: string) => ep(`/campaigns/${campaignId}/chat/${influencerId}`),
        },
    },

    discover: {
        search: ep('/influencers/search'),
        getInfluencer: (id: string) => ep(`/influencers/${id}`),
        bookmark: (id: string) => ep(`/influencers/${id}/bookmark`),
        collections: ep('/influencers/bookmarks/collections'),
    },

    analytics: {
        overview: ep('/analytics/overview'),
        campaignSummary: (campaignId: string) => ep(`/analytics/campaigns/${campaignId}/summary`),
        campaignProofs: (campaignId: string) => ep(`/analytics/campaigns/${campaignId}/proofs`),
        campaignHistory: (campaignId: string) => ep(`/analytics/campaigns/${campaignId}/history`),
        refreshProofs: (campaignId: string) => ep(`/analytics/campaigns/${campaignId}/refresh-proofs`),
        contentPerformance: ep('/analytics/content'),
    },

    notifications: {
        list: ep('/notifications'),
        markRead: (id: string) => ep(`/notifications/${id}/read`),
        markAllRead: ep('/notifications/read-all'),
        bulkDelete: ep('/notifications/bulk-delete'),
        registerToken: ep('/notifications/register-token'),
    },

    messages: {
        conversations: ep('/messages'),
        getConversation: (id: string) => ep(`/messages/${id}`),
        sendMessage: (id: string) => ep(`/messages/${id}`),
        /** Brand: create or return existing thread for a campaign–influencer row */
        start: ep('/messages/start'),
    },
    pricing: {
        tierConfig: ep('/pricing/tier-config'),
        predict: ep('/pricing/predict'),
        marketInsight: ep('/pricing/market-insight'),
    },

    ai: {
        chat: ep('/ai/chat'),
        strategy: ep('/ai/strategy'),
        smartSelect: ep('/ai/smart-select'),
        influencerSearch: ep('/ai/influencer-search'),
        analyzeScript: ep('/ai/analyze-script'),
        analyzeScriptFile: ep('/ai/analyze-script-file'),
        detectDuplicateScripts: ep('/ai/detect-duplicate-scripts'),
        // Agentic campaign assistant (replaces the legacy single-shot chat above once at parity).
        assistant: {
            intro: ep('/ai/assistant/intro'),
            conversations: ep('/ai/assistant/conversations'),
            conversation: (id: string) => ep(`/ai/assistant/conversations/${id}`),
            conversationStatus: (id: string) => ep(`/ai/assistant/conversations/${id}/status`),
            messages: (id: string) => ep(`/ai/assistant/conversations/${id}/messages`),
            answer: (id: string) => ep(`/ai/assistant/conversations/${id}/answer`),
            stop: (id: string) => ep(`/ai/assistant/conversations/${id}/stop`),
            proposal: (proposalId: string) => ep(`/ai/assistant/proposals/${proposalId}`),
            confirmProposal: (proposalId: string) => ep(`/ai/assistant/proposals/${proposalId}/confirm`),
            rejectProposal: (proposalId: string) => ep(`/ai/assistant/proposals/${proposalId}/reject`),
        },
        chatSessions: {
            list: ep('/ai/chat/sessions'),
            getById: (id: string) => ep(`/ai/chat/sessions/${id}`),
            linkCampaign: (id: string) => ep(`/ai/chat/sessions/${id}/link-campaign`),
            delete: (id: string) => ep(`/ai/chat/sessions/${id}`),
        },
    },
    composio: {
        analyzeReel: ep('/composio/analyze-reel'),
        connectionStatus: ep('/composio/connection-status'),
        connectInstagram: ep('/composio/connect-instagram'),
    },

    // Social account linking (brand profile — mandatory before campaign/program actions).
    // Shared with the creator mobile app; routes live under /v2/influencers/social but
    // accept brand_owner sessions too (see backend social.router SOCIAL_ROLES).
    social: {
        status: ep2('/influencers/social/status'),
        instagramOAuthStart: ep2('/influencers/social/instagram/oauth/start'),
        instagramOAuthComplete: (transactionId: string) => ep2(`/influencers/social/instagram/oauth/${transactionId}/complete`),
        instagramRefresh: ep2('/influencers/social/instagram/refresh'),
        youtubeAuthUrl: ep2('/influencers/social/youtube/auth-url'),
        connect: ep2('/influencers/social/connect'),
        disconnect: ep2('/influencers/social/disconnect'),
    },

    support: {
        contact: ep('/support/contact'),
        history: ep('/support/tickets'),
        faqs: ep('/support/faqs'),
        info: ep('/support/info'),
    },

    publicReview: {
        campaignOverview: (token: string) => ep(`/public/review/campaign/overview/${token}`),
    },


    // Team members (Agencies plan) — sub-accounts an agency head creates and assigns
    // one or more brands each. See modules/brands/hooks/useTeam.
    team: {
        list: ep('/team'),
        create: ep('/team'),
        getById: (id: string) => ep(`/team/${id}`),
        // Edit a member's profile (PATCH { name?, email?, phoneNumber? }).
        update: (id: string) => ep(`/team/${id}`),
        // Campaigns + programs across the member's brands, tagged with current assignee, plus stats.
        workload: (id: string) => ep(`/team/${id}/workload`),
        setBrands: (id: string) => ep(`/team/${id}/brands`),
        assignBrand: (id: string, brandId: string) => ep(`/team/${id}/brands/${brandId}`),
        unassignBrand: (id: string, brandId: string) => ep(`/team/${id}/brands/${brandId}`),
        // Whole-account activate/deactivate — assignments are kept, login/refresh blocked.
        setStatus: (id: string) => ep(`/team/${id}/status`),
        // Owner sets the member's password outright and signs them out everywhere.
        setPassword: (id: string) => ep(`/team/${id}/password`),
    },

    // Brand-wide money ledger — every payment round across every campaign of the ACTIVE
    // brand. Scoped server-side by campaigns.brand_id, so switching client brands switches
    // ledgers with no extra param here.
    transactions: {
        list: () => ep('/transactions'),
        invoice: (paymentId: string) => ep(`/transactions/${paymentId}/invoice`),
    },

    subscription: {
        me: ep('/subscriptions/me'),
        plans: ep('/subscriptions/plans'),
        upgrade: ep('/subscriptions/upgrade'),
        verify: ep('/subscriptions/verify'),
        // Cancel = end-of-period downgrade (paid access stays until currentPeriodEnd);
        // resume undoes a scheduled cancel while the period is still running.
        cancel: ep('/subscriptions/cancel'),
        resume: ep('/subscriptions/resume'),
        // Dedicated manager callback request — paid-plan perk (GET latest / POST create)
        managerRequest: ep('/subscriptions/manager-request'),
    },

    // ───────────────────────────────────────────────────────────────
    // v2 endpoints — Phase 2 features
    // ───────────────────────────────────────────────────────────────
    programs: {
        list:        ep2('/programs'),
        create:      ep2('/programs'),
        getById:    (id: string) => ep2(`/programs/${id}`),
        update:     (id: string) => ep2(`/programs/${id}`),
        delete:     (id: string) => ep2(`/programs/${id}`),
        assign:     (id: string) => ep2(`/programs/${id}/assign`),
        thumbnail:  (id: string) => ep2(`/programs/${id}/thumbnail`),
        enrollments: {
            list:   (id: string) => ep2(`/programs/${id}/enrollments`),
            enroll: (id: string) => ep2(`/programs/${id}/enroll`),
            review: (id: string, eid: string) => ep2(`/programs/${id}/enrollments/${eid}`),
            invite: (id: string, eid: string) => ep2(`/programs/${id}/enrollments/${eid}/invite`),
        },
    },
} as const;

// ─────────────────────────────────────────────────────────────
// WebSocket Event Registry
// ─────────────────────────────────────────────────────────────

export const WS_EVENTS = {
    // Inbound (server → client)
    NOTIFICATION: 'NOTIFICATION',
    CAMPAIGN_UPDATE: 'campaign:update',
    // This is the actual event name the backend emits (CAMPAIGN_UPDATED, not campaign:update)
    CAMPAIGN_UPDATED: 'CAMPAIGN_UPDATED',
    CHAT_MESSAGE: 'NEW_MESSAGE',
    NEW_MESSAGE: 'NEW_MESSAGE',
    APPLICATION_RECEIVED: 'APPLICATION_RECEIVED',
    // Emitted to the brand owner + assigned agent when an influencer enrols in a program.
    PROGRAM_ENROLLMENT_RECEIVED: 'PROGRAM_ENROLLMENT_RECEIVED',
    SCRIPT_SUBMITTED: 'script:submitted',
    WORK_SUBMITTED: 'work:submitted',
    NEGOTIATION_UPDATE: 'negotiation:update',
    PAYMENT_STATUS: 'payment:status',

    // Outbound (client → server)
    JOIN_CAMPAIGN: 'JOIN_CAMPAIGN',
    LEAVE_CAMPAIGN: 'LEAVE_CAMPAIGN',
    SEND_MESSAGE: 'SEND_MESSAGE',
    MARK_READ: 'MARK_READ',
    TYPING_START: 'TYPING_START',
    TYPING_STOP: 'TYPING_STOP',
} as const;
