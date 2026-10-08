/**
 * Types for the agentic campaign assistant.
 *
 * Mirrors `mutinyX-backend/src/modules/aiAssistant/aiAssistant.types.ts`. The two are kept in
 * sync by hand — a drift shows up as a card that silently fails to render rather than a
 * compile error, so change both sides together.
 */

export type AssistantScope = 'campaign_create' | 'campaign_manage';
export type AssistantConversationStatus = 'active' | 'awaiting_input' | 'completed';
export type AssistantMessageRole = 'user' | 'assistant' | 'tool' | 'event';

export type ProposalKind = 'create_campaign' | 'update_campaign' | 'invite_creators';
export type ProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'expired' | 'superseded';

export type AssistantCardType =
    | 'campaign_preview'
    | 'creator_shortlist'
    | 'budget_breakdown'
    | 'strategy'
    | 'performance';

export interface AssistantCard {
    type: AssistantCardType;
    title: string;
    body: Record<string, unknown>;
    /** Which tools produced the data behind this card — computed server-side, not claimed. */
    sources: string[];
}

export interface AskUserOption {
    label: string;
    description?: string;
}

export interface AskUserQuestion {
    id: string;
    question: string;
    options: AskUserOption[];
    multiSelect?: boolean;
}

export interface AssistantMessage {
    id: string;
    role: AssistantMessageRole;
    content: string;
    eventType?: string | null;
    cardPayload?: unknown;
    proposalId?: string | null;
    createdAt: string;
    /** Client-only: true while tokens are still streaming into this message. */
    streaming?: boolean;
}

export interface AssistantProposal {
    id: string;
    conversationId: string;
    /**
     * The assistant row whose tool call raised this proposal — what the card is anchored to, so
     * it stays at the point in the thread where it was offered instead of sliding to the bottom.
     * Null when the requesting row was a pure tool-call carrier the transcript filters out; the
     * anchor then falls back to `createdAt`.
     */
    messageId: string | null;
    createdAt: string;
    kind: ProposalKind;
    payload: Record<string, unknown>;
    formState: Record<string, unknown> | null;
    status: ProposalStatus;
    expiresAt: string;
    result?: Record<string, unknown> | null;
}

export interface AssistantConversationSummary {
    id: string;
    title: string | null;
    status: AssistantConversationStatus;
    scope: AssistantScope;
    campaignId: string | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
    messages: AssistantMessage[];
    pendingProposals: AssistantProposal[];
    /**
     * Whether a turn is running on the server at this instant. The panel uses it to recover
     * when a live event never arrives: it can poll and tell "still working" from "finished
     * without telling me". Optional so an older backend simply falls back to the watchdog.
     */
    turnActive?: boolean;
}

/** Live status shown under the composer while a turn runs. */
export interface AssistantActivity {
    tool: string;
    label: string;
    summary?: string;
}

export type AssistantErrorCode = 'rate_limited' | 'content_filter' | 'timeout' | 'internal_error';

/** Socket event names. Must match core/events.ts on the backend exactly. */
export const AI_EVENTS = {
    TOKEN: 'ai:token',
    TOOL_CALL: 'ai:tool-call',
    TOOL_RESULT: 'ai:tool-result',
    QUESTION: 'ai:question',
    CARD: 'ai:card',
    DISCARD: 'ai:discard',
    /** A streamed text block is final and has its persisted id — see emitBlockEnd. */
    BLOCK_END: 'ai:block_end',
    PROPOSAL: 'ai:proposal',
    PROPOSAL_UPDATE: 'ai:proposal-update',
    DONE: 'ai:done',
    STOPPED: 'ai:stopped',
    ERROR: 'ai:error',
} as const;
