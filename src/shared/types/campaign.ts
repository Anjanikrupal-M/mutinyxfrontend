// ─────────────────────────────────────────────────────────────
// AI Strategy
// ─────────────────────────────────────────────────────────────

export interface AICampaignStrategy {
    thesis: string;
    whyThisApproach: string;
    hooks: string[];
    contentIdeas: string[];
    reachLow: number;
    reachHigh: number;
    engageLow: number;
    engageHigh: number;
    clicksLow: number;
    clicksHigh: number;
    confidenceLabel: string;
    confidencePct: number;
    timeline: string[];
    recommendations: string[];
    creatorBrief: string;
    creatorMix?: Array<{ tier: string; count: number; spend: number; range: string; why: string }>;
    contentMixPct?: number[];
}

// ─────────────────────────────────────────────────────────────
// Campaign Lifecycle Types
// ─────────────────────────────────────────────────────────────

export type CampaignType = 'influencer' | 'ugc' | 'meme' | 'twitter';
export type CampaignVisibility = 'private' | 'public';
export type CampaignStatus = 'draft' | 'active' | 'script' | 'work' | 'completed' | 'closed' | 'withdrawn' | 'expired';
/** Admin approval gate — tracked separately from CampaignStatus. See Campaign.approvalStatus. */
export type CampaignApprovalStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type BudgetMode = 'paid' | 'product' | 'paid_product';
export type CreatorTier = 'nano' | 'micro' | 'mid' | 'macro' | 'mega';

export interface TierPricing {
    tier: CreatorTier;
    amount: number; // ₹ per creator for this tier
}

export interface CampaignBudget {
    mode: BudgetMode;
    tierPricing: TierPricing[];    // per-tier rates set by brand
    total: number;                 // calculated total budget
    platformFeePercent: number;    // admin-configurable, e.g. 10
}

export interface CampaignAnalytics {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalReach: number;
    engagementRate: number;
}

export interface ProofReelAnalytics {
    proofId: string;
    proofUrl: string;
    description?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    influencerName: string;
    influencerHandle: string | null;
    influencerAvatar: string | null;
    scrapedLikes: number | null;
    scrapedComments: number | null;
    scrapedViews: number | null;
    scrapedReach?: number | null;
    scrapedImpressions?: number | null;
    scrapedShares?: number | null;
    scrapedSaved?: number | null;
    scrapedTotalInteractions?: number | null;
    scrapedEngagementRate?: string | null;
    metricSource?: 'meta_graph' | 'youtube_analytics' | 'legacy_unverified';
    metricStatus?: string;
    metricErrorCode?: string | null;
    metricsFetchedAt?: string | null;
    mediaId?: string | null;
    mediaType?: string | null;
    contentFormat?: string | null;
    platformMetrics?: Record<string, unknown> | null;
    thumbnailUrl: string | null;
    scrapedAt: string | null;
    mediaProductType?: string | null;
    providerExpiresAt?: string | null;
    finalCaptureDueAt?: string | null;
    finalCaptureStatus?: 'not_required' | 'pending' | 'captured' | 'missed';
    isFinal?: boolean;
    lastSuccessfulSyncAt?: string | null;
    /** Links the proof to its daily history points (CampaignMetricHistory.contentPoints[].contentId). */
    metricContentId?: string | null;
}

export interface TopPerformer {
    id: string;
    name: string;
    handle: string;
    avatar?: string;
    reach: number;
    engagement: number;
}

export interface VisitAtSiteOption {
    id: string;
    description: string;
}

export interface Campaign {
    id: string;
    name: string;
    type: CampaignType;
    visibility: CampaignVisibility;
    objective: string;
    status: CampaignStatus;
    budget: CampaignBudget;
    location: string;
    // Target audience (empty array / 'all' = no preference)
    targetLocations?: string[];
    targetAgeRanges?: string[];
    targetGender?: 'all' | 'male' | 'female' | 'other' | null;
    // Preferred gender of the creators themselves (not the audience); null = any.
    creatorGender?: 'all' | 'male' | 'female' | 'other' | null;
    targetLanguages?: string[];
    niche: string[];
    creatorSize: CreatorTier;
    creatorsInvited: number;
    creatorsAccepted: number;
    applicationsCount: number;
    pendingApplications?: number;
    pendingProductShipments?: number;
    pendingScripts: number;
    pendingSubmissions: number;
    progress: number;
    createdAt: string;
    deadline: string;
    thumbnail?: string;
    thumbnailUrl?: string;
    analytics?: CampaignAnalytics;
    topPerformers?: TopPerformer[];
    // Flat fields from backend
    budgetTotal?: string | number;
    budgetMode?: BudgetMode;
    budgetTierPricing?: TierPricing[];
    platformFeePercent?: string | number;
    niches?: string[];
    creatorSizes?: string[];
    coverImageUrl?: string;
    // Creative settings
    faceRequired?: boolean;
    voiceRequired?: boolean;
    shootType?: string;
    language?: string;
    scriptControl?: number;
    deliverables?: Array<string | { type?: string; count?: number }>;
    usageRights?: string;
    postingPermission?: string;
    productDetails?: string;
    proofOfWorkRequired?: boolean;
    proofOfWorkReq?: boolean;
    visitAtSiteEnabled?: boolean;
    visitAtSiteDescription?: string;
    visitAtSiteDate?: string;
    visitAtSiteTime?: string;
    visitAtSite?: {
        enabled: boolean;
        options: VisitAtSiteOption[];
    };
    platform?: string;
    contentTypes?: string[];
    postingType?: 'creator' | 'brand' | string;
    // 'none' = script not required: no script content, no script deadline, no script stages.
    scriptType?: 'creator' | 'brand' | 'none' | string;
    scriptFlow?: string;
    scriptFileKey?: string;
    mixMode?: boolean;
    selectedTier?: CreatorTier | string;
    applicationDeadline?: string;
    workDeadline?: string;
    scriptDeadline?: string;
    proofOfWorkDeadline?: string;
    payLaterMode?: boolean;
    brandId?: string;
    // Admin approval gate. A campaign stays on status 'draft' with approvalStatus 'pending'
    // until an admin approves it, at which point it becomes 'active'. Approval is granted
    // once — later edits and re-launches skip the queue.
    approvalStatus?: CampaignApprovalStatus;
    approvalSubmittedAt?: string | null;
    approvalRejectionReason?: string | null;
    launchedAt?: string;
    closedAt?: string | null;
    brief?: string;
    dos?: string[];
    donts?: string[];
    referenceUrls?: string[];
    hashtags?: string[];
    requirements?: {
        platform?: string;
        contentTypes?: string[];
        postingType?: string;
        /** Channel the creator invites as Instagram collaborator (postingType 'collab' / 'collab_optional'). */
        collabChannel?: string;
        brandGuidelines?: string;
        references?: string;
        scriptType?: string;
        scriptFlow?: string;
        mainContentType?: string | string[];
        usageRights?: string;
    };
    timeline?: {
        applicationDeadline?: string;
        scriptDeadline?: string;
        workDeadline?: string;
        proofOfWorkDeadline?: string;
    };
    aiStrategy?: AICampaignStrategy;
    /**
     * Which surface created the campaign. This — not `aiStrategy` — is what the list's
     * "AI Strategy" tab filters on: the strategy blob is written only by the legacy
     * AIStrategistChat, so campaigns built by the agentic assistant never carried one.
     */
    createdVia?: 'builder' | 'ai_assistant' | 'ai_strategist';
    // Programs (Phase 2) — nullable, present only when campaign is part of a program
    programId?: string | null;
    agentId?: string | null;
    agentName?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Campaign–Influencer Relationship
// ─────────────────────────────────────────────────────────────

export type InfluencerOrigin = 'brand_invite' | 'influencer_application';
export type InfluencerCampaignStatus =
    | 'invited'
    | 'applied'
    | 'accepted'
    | 'negotiating'
    | 'payment_pending'
    | 'paid'
    | 'product_pending'
    | 'script_pending'
    | 'script_review'
    | 'work_pending'
    | 'work_review'
    | 'proof_review'
    | 'completed'
    | 'settled'
    | 'rejected'
    | 'withdrawn'
    | 'replaced';

export type PaymentStatus = 'pending_first' | 'first_paid' | 'pending_final' | 'completed';
export type PaymentBadgeStatus = 'payment_pending' | 'cancelled' | 'failed' | 'expired' | 'refunded' | 'reversed' | null;

export interface NegotiationEntry {
    id: string;
    party: 'brand' | 'influencer';
    amount: number | string; // Drizzle returns numeric as string
    note?: string | null;
    createdAt: string;
}

export interface NegotiationPermissions {
    canAccept: boolean;
    canCounter: boolean;
}

export interface NegotiationData {
    campaignId: string;
    influencerId: string;
    status: string;
    tierRate: string | null;
    agreedBudget: string | null;
    lastOfferBy: 'brand' | 'influencer' | null;
    permissions: NegotiationPermissions;
    history: NegotiationEntry[];
}

export interface CampaignInfluencer {
    id: string;
    campaignId: string;
    influencerId: string;
    origin: InfluencerOrigin;
    status: InfluencerCampaignStatus;
    chatEnabled: boolean;
    // Budget & payment
    tierRate: number;           // rate from tier pricing
    quotedPrice?: number | null; // alias of tierRate returned by backend
    negotiations: NegotiationEntry[];
    agreedBudget: number | null;
    platformFee: number;
    firstPayment: number;       // 50% of (budget + fee)
    finalPayment: number;       // remaining 50%
    paymentStatus: PaymentStatus;
    paymentBadgeStatus?: PaymentBadgeStatus;
    paymentActionRequired?: boolean;
    effectiveStatus?: InfluencerCampaignStatus;
    // Script versions
    scriptVersions: ScriptVersion[];
    // Work submissions
    workSubmissions: WorkSubmission[];
    // Product delivery (for paid + product campaigns)
    proofOfDelivery?: string;
    productShippedAt?: string;
    productReceived?: boolean;
    productReceivedAt?: string;
    // Timestamps
    connectedAt: string;
    acceptedAt?: string;
    paidAt?: string;
    completedAt?: string;
    // Per-influencer deadlines set by brand
    scriptDeadline?: string | null;
    workDeadline?: string | null;
    // Enriched rows from status-board endpoint
    userName?: string;
    userAvatarUrl?: string;
    userPhoneNumber?: string;
    handle?: string;
    // Creator replacement linkage (numeric columns arrive as strings from Drizzle)
    replacedByCiId?: string | null;  // set on the replaced (outgoing) creator
    replacesCiId?: string | null;    // set on the replacement (incoming) creator
    carriedAdvance?: number | string | null;
    // Earmarked replacement intent set at invite time — id of the outgoing CI this
    // (incoming, not-yet-accepted) creator is meant to replace once the swap completes.
    pendingReplacementForCiId?: string | null;
    tier?: CreatorTier | string;
    bio?: string;
    followerCount?: number;
    platform?: string;
    profileComplete?: boolean;
    profileCompletionIssues?: string[];
    featuredPortfolioIds?: string[];
    portfolioUrls?: string[];
    bankDetailsId?: string | null;
    // Platform the influencer applied under (distinct from `platform` above, their connected account)
    appliedPlatform?: 'instagram' | 'youtube' | 'both' | string | null;
    // Visit location the influencer picked at apply time (snapshot copy); null when no choice was needed
    selectedVisitLocation?: VisitAtSiteOption | null;
    // Measured average reach per recent post (IG insights) / avg views (YouTube); null when not connected
    avgReach?: { instagram: number | null; youtube: number | null } | null;
    // Measured average views per recent post / video; null when the creator has no insights connected
    avgViews?: { instagram: number | null; youtube: number | null } | null;
    // Instagram follower demographics as 0–1 shares; null when Meta withheld them (small accounts)
    audience?: CreatorAudience | null;
}

/** Shares (0–1) of a creator's Instagram followers per Meta bucket. Cities are Meta's top cities only. */
export interface CreatorAudience {
    /** Meta age buckets — same keys as TARGET_AGE_RANGES ('18-24', '25-34', …). */
    age: Record<string, number>;
    /** Meta gender keys: 'F', 'M', 'U'. */
    gender: Record<string, number>;
    /** "City, State" keys. */
    cities: Record<string, number>;
    collectedAt: string;
}

/** Why Smart Select did or did not recommend a creator (POST /ai/smart-select). */
export type SmartSelectReasonCode = 'recommended' | 'no_price' | 'location_mismatch' | 'weak_fit' | 'over_budget' | 'low_value' | 'unverified_reach';

export interface SmartSelectReasonDetails {
    /** Best pick only: why it beats the runner-up. */
    lead: string | null;
    facts: string[];
    notes: string[];
}

/** One creator's Smart Select outcome. Price and budget are resolved on the server. */
export interface SmartSelectResult {
    influencerId: string;
    ciId?: string;
    status?: string;
    score: number;
    confidence?: number;
    recommended?: boolean;
    reasonCode?: SmartSelectReasonCode;
    reason: string;
    /** One short line for the card; `reason` is the full explanation. */
    summary?: string;
    /** The full explanation as separate facts and notes, shown in the "Why?" dialog. */
    details?: SmartSelectReasonDetails;
    price?: number | null;
    verifiedData?: boolean;
    /** The single best recommended creator; its reason is in SmartSelectMeta.topPick. */
    topPick?: boolean;
}

/** Budget context Smart Select used, returned alongside the per-creator results. */
export interface SmartSelectMeta {
    budgetTotal: number | null;
    committedSpend: number;
    remainingBudget: number | null;
    recommendedSpend: number;
    recommendedCount: number;
    candidateCount: number;
    /** The best recommended creator and why they beat the next best. */
    topPick?: { influencerId: string; reason: string; summary?: string; details?: SmartSelectReasonDetails } | null;
}

export interface ScriptVersion {
    id: string;
    version: number;
    fileUrl?: string;
    fileName?: string;
    externalUrl?: string;
    mediaUrl?: string;
    textContent?: string;
    influencerId?: string;
    influencerName?: string;
    influencerHandle?: string;
    influencerAvatar?: string;
    status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
    submittedAt: string;
    reviewedAt?: string;
    reviewNote?: string;
    shareToken?: string | null;
    externalReviewerName?: string | null;
}

export interface WorkSubmission {
    id: string;
    /** 1-based item within its format ("Reel 2"). Absent on rows from before multi-item support. */
    itemIndex?: number | null;
    campaignId?: string;
    campaignInfluencerId?: string;
    influencerId?: string;
    influencerName?: string;
    influencerHandle?: string;
    influencerAvatar?: string;
    type: 'file' | 'link';
    url: string;
    externalUrl?: string;
    mediaUrl?: string;
    fileUrl?: string;
    fileName?: string;
    textContent?: string;
    proofOfWorkUrl?: string;  // optional posted link
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    reviewedAt?: string;
    reviewNote?: string;
    shareToken?: string | null;
    externalReviewerName?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────────────────────

export type ConversationStatus = 'pending' | 'active' | 'archived';

export interface ReplyToMessageSnapshot {
    id: string;
    senderId: string;
    senderRole: string;
    content: string;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    senderRole: 'brand' | 'influencer' | 'system';
    sender: 'brand' | 'influencer' | 'system'; // keeping for compatibility if needed
    content: string;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    replyToMessageId?: string | null;
    replyToMessage?: ReplyToMessageSnapshot | null;
    isRead: boolean;
    timestamp: string;
    createdAt?: string;
}

export interface Conversation {
    id: string;
    campaignId: string;
    brandId?: string;
    influencerId?: string;
    campaignName: string;
    brandName?: string;
    brandLogoUrl?: string | null;
    influencerHandle?: string;
    influencerAvatarUrl?: string | null;
    otherName?: string;
    otherAvatar?: string | null;
    influencer: {
        id: string;
        name: string;
        handle: string;
    };
    status: ConversationStatus;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unread: number;
    unreadCount?: number;
    brandUnread?: number;
    influencerUnread?: number;
    chatWritable?: boolean;
    otherUserId?: string | null;    // the actual user.id of the other party (for presence tracking)
    brandUserId?: string | null;    // user.id of the brand side (from getConversation)
    influencerUserId?: string | null; // user.id of the influencer side (from getConversation)
    messages: Message[];
    createdAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Chat unlock (Conversation created only in script/work phase)
// ─────────────────────────────────────────────────────────────

const CHAT_UNLOCKED_STATUSES: InfluencerCampaignStatus[] = [
    'product_pending',
    'script_pending',
    'script_review',
    'work_pending',
    'work_review',
    'proof_review',
];

/** True when the influencer has reached script or work phase and chat is available. */
export function canChatByInfluencerStatus(status: InfluencerCampaignStatus): boolean {
    return CHAT_UNLOCKED_STATUSES.includes(status);
}

// ─────────────────────────────────────────────────────────────
// Final-payment gate (between work approval and proof of work)
// ─────────────────────────────────────────────────────────────
// Backend flips the status to `proof_review` as soon as work is approved, but for
// monetary campaigns the creator cannot submit proof until the final payment is
// captured (finalPaidAt). This helper lets the UI show a distinct "Awaiting Final
// Payment" state during that window so it doesn't look like the payment was skipped.
export function isAwaitingFinalPayment(
    status: InfluencerCampaignStatus | null | undefined,
    finalPaidAt: string | Date | null | undefined,
    budgetMode: string | null | undefined,
): boolean {
    return status === 'proof_review' && budgetMode !== 'product' && !finalPaidAt;
}

// ───────────────────────────────────────────────────────────────
// Programs (Phase 2)
// ───────────────────────────────────────────────────────────────

export type ProgramStatus = 'active' | 'paused' | 'completed' | 'archived';
export type EnrollmentStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ProgramPhase {
    id:          string;
    phaseNumber: number;
    phaseName:   string | null;
    createdAt:   string;
    campaign: {
        id:               string;
        name:             string;
        status:           CampaignStatus;
        type:             CampaignType;
        visibility:       CampaignVisibility;
        budgetTotal:      string | number | null;
        progress:         number;
        creatorsAccepted: number;
        launchedAt:       string | null;
        closedAt:         string | null;
        createdAt:        string;
        thumbnailUrl?:    string | null;
        thumbnail?:       string | null;
        location?:        string | null;
        deadline?:        string | null;
        niches?:          string[] | null;
        budgetMode?:      BudgetMode | null;
        budgetTierPricing?: TierPricing[] | null;
    };
}

export interface ProgramEnrollment {
    id:           string;
    influencerId: string;
    status:       EnrollmentStatus;
    note:         string | null;
    enrolledAt:   string;
    reviewedAt:   string | null;
    // Enriched influencer fields
    name?:         string | null;
    handle?:       string | null;
    avatarUrl?:    string | null;
    bio?:          string | null;
    followerCount?: number | null;
    niches?:       string[] | null;
    tier?:         string | null;
    // True if this influencer has been invited to any campaign in this program
    hasBeenInvited?: boolean;
    // IDs of campaigns this influencer has already been invited to within this program
    invitedCampaignIds?: string[];
}

export interface Program {
    id:             string;
    name:           string;
    description:    string | null;
    brief?:         string | null;
    enrollmentOpen?: boolean;
    niches?:        string[];
    thumbnailUrl?:  string | null;
    status:         ProgramStatus;
    createdAt:      string;
    updatedAt:      string;
    // Only present on detail response
    phases?:         ProgramPhase[];
    campaignCount?:  number;
    totalBudget?:    number;
    canAddPhase?:    boolean;
    enrollmentCount?: number;
    acceptedCount?:   number;
    agentId?: string | null;
    agentName?: string | null;
}

