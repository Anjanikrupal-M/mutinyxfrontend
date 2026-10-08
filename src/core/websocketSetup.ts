// ─────────────────────────────────────────────────────────────
// WebSocket ↔ React Query Cache Invalidation
// Listens to WS events and automatically refreshes relevant queries.
// Import and call `initWebSocketListeners` once in AppShell or Providers.
// ─────────────────────────────────────────────────────────────

import { QueryClient } from '@tanstack/react-query';
import ws from './websocket';
import { WS_EVENTS } from './api';
import { queryKeys } from './queryKeys';
import { useNotificationStore, type Notification } from '@/shared/stores/notificationStore';
import type { Conversation } from '@/shared/types/campaign';

// Type for typing indicator payload
export interface TypingPayload {
    conversationId: string;
    userId: string;
}

function extractCampaignId(payload: unknown): string | undefined {
    const p = payload as {
        id?: string;
        campaignId?: string;
        campaign_id?: string;
        applicationId?: string;
        campaign?: { id?: string };
        data?: { id?: string; campaignId?: string };
        notification?: { campaignId?: string };
        actionUrl?: string;
    } | null;

    const explicitCampaignId =
        p?.campaignId ||
        p?.campaign_id ||
        p?.notification?.campaignId ||
        p?.campaign?.id ||
        p?.data?.campaignId;

    if (explicitCampaignId) return explicitCampaignId;

    const fromActionUrl = String(p?.actionUrl || '').match(/\/campaigns\/([^/]+)/)?.[1];
    if (fromActionUrl) return fromActionUrl;

    return p?.id || p?.data?.id;
}

export function initWebSocketListeners(queryClient: QueryClient) {
    // Use a WeakMap so each queryClient instance gets its own listener setup.
    // This avoids the window guard silently skipping re-registration after HMR.
    const initialized = (initWebSocketListeners as any)._initialized ??= new WeakMap();
    if (initialized.has(queryClient)) return;
    initialized.set(queryClient, true);

    const invalidateCooldownMs = 600;  // was 1500 — too slow for real-time UX
    const campaignBatchDelayMs = 60;   // was 180 — batch window, not a full pause
    const lastInvalidatedAt = new Map<string, number>();
    const pendingCampaignKeys = new Map<string, Set<string>>();
    const pendingCampaignTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const keyRegistry = new Map<string, readonly unknown[]>();

    const keyToId = (key: readonly unknown[]) => JSON.stringify(key);

    const invalidateWithCooldown = (key: readonly unknown[]) => {
        const keyId = keyToId(key);
        const now = Date.now();
        const last = lastInvalidatedAt.get(keyId) ?? 0;
        if (now - last < invalidateCooldownMs) return;

        lastInvalidatedAt.set(keyId, now);
        queryClient.invalidateQueries({ queryKey: key });
    };

    const queueCampaignKey = (campaignId: string, key: readonly unknown[]) => {
        const keyId = keyToId(key);
        keyRegistry.set(keyId, key);

        if (!pendingCampaignKeys.has(campaignId)) {
            pendingCampaignKeys.set(campaignId, new Set<string>());
        }
        pendingCampaignKeys.get(campaignId)?.add(keyId);

        const existing = pendingCampaignTimers.get(campaignId);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            const queued = pendingCampaignKeys.get(campaignId);
            pendingCampaignTimers.delete(campaignId);
            pendingCampaignKeys.delete(campaignId);
            if (!queued || queued.size === 0) return;

            queued.forEach((queuedKeyId) => {
                const resolvedKey = keyRegistry.get(queuedKeyId);
                if (resolvedKey) {
                    invalidateWithCooldown(resolvedKey);
                }
            });
        }, campaignBatchDelayMs);

        pendingCampaignTimers.set(campaignId, timer);
    };

    // --- Core helper ---
    const refetch = (key: readonly unknown[]) => {
        invalidateWithCooldown(key);
    };

    // ─── Campaign batch-refetch helper ────────────────────────────────────────
    const refetchCampaign = (campaignId: string, extra?: readonly (readonly unknown[])[], includeStatusBoard = false) => {
        queueCampaignKey(campaignId, queryKeys.campaigns.detail(campaignId));
        queueCampaignKey(campaignId, queryKeys.campaigns.applications(campaignId));
        if (includeStatusBoard) {
            queueCampaignKey(campaignId, queryKeys.campaigns.statusBoard(campaignId));
        }
        refetch(queryKeys.campaigns.all);
        extra?.forEach((key) => queueCampaignKey(campaignId, key));
    };

    // ─── Notifications ────────────────────────────────────────────────────────
    const onNotification = (payload: unknown) => {
        const notification = payload as Notification;
        if (notification) {
            useNotificationStore.getState().addNotification(notification);
        }
        refetch(queryKeys.notifications.all);

        // If this is a chat notification, also refresh the messages list so the
        // recipient sees the new message in real-time (even if NEW_MESSAGE WS fails)
        if (notification?.type === 'chat') {
            // Always refresh the conversation list sidebar
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });

            // Try to extract the conversationId from the actionUrl (e.g. /messages?id=xxx)
            const actionUrl = (notification as any).actionUrl as string | undefined;
            if (actionUrl) {
                const match = actionUrl.match(/[?&]id=([^&]+)/);
                const conversationId = match?.[1];
                if (conversationId) {
                    // Force-refetch the active conversation so new message appears
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.messages.infinite(conversationId, 50),
                        exact: true,
                    });
                    queryClient.refetchQueries({
                        queryKey: queryKeys.messages.infinite(conversationId, 50),
                        exact: true,
                        type: 'active',
                    });
                }
            }
        }
    };
    ws.on(WS_EVENTS.NOTIFICATION, onNotification);
    ws.on('notification:new', onNotification);

    // ─── CAMPAIGN_UPDATE (legacy lowercase event) ─────────────────────────────
    ws.on(WS_EVENTS.CAMPAIGN_UPDATE, (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;
        refetch(queryKeys.campaigns.detail(campaignId));
        refetch(queryKeys.campaigns.all);
    });

    // ─── CAMPAIGN_UPDATED (primary backend event) ─────────────────────────────
    ws.on(WS_EVENTS.CAMPAIGN_UPDATED, (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;
        refetchCampaign(campaignId, [
            queryKeys.campaigns.scripts(campaignId),
            queryKeys.campaigns.submissions(campaignId),
            queryKeys.campaigns.payment.summary(campaignId),
        ]);
    });

    // ─── Chat messages — global handler for real-time updates ─────────────────
    // This ensures NEW_MESSAGE events always update the cache regardless of which
    // component is currently mounted. Per-component hooks (useConversationRealtime)
    // still exist for deduplication safety, but this is the primary real-time driver.
    const MESSAGE_EVENTS = [WS_EVENTS.NEW_MESSAGE, 'new_message', 'CHAT_MESSAGE', 'chat:message', 'message:new'];

    const extractConvId = (payload: unknown): string | null => {
        const root = payload as Record<string, unknown>;
        const inner = (root?.data ?? root) as Record<string, unknown>;
        const msg = (inner?.message ?? inner) as Record<string, unknown>;
        const asStr = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
        return (
            asStr(msg?.conversationId) ||
            asStr(msg?.conversation_id) ||
            asStr(inner?.conversationId) ||
            asStr(root?.conversationId) ||
            null
        );
    };

    const onNewMessageGlobal = (payload: unknown) => {
        console.log('[WS-GLOBAL] NEW_MESSAGE received', payload);
        const conversationId = extractConvId(payload);
        if (!conversationId) {
            console.log('[WS-GLOBAL] NEW_MESSAGE: could not extract conversationId, invalidating all');
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
            return;
        }

        const root = payload as Record<string, unknown>;
        const inner = (root?.data ?? root) as Record<string, unknown>;
        const msg = (inner?.message ?? inner) as Record<string, unknown>;
        const asStr = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

        const msgId = asStr(msg?.id ?? msg?.messageId);
        const senderId = asStr(msg?.senderId ?? msg?.sender_id);
        const senderRole = (() => {
            const r = asStr(msg?.senderRole ?? msg?.sender_role ?? '').toLowerCase();
            return r === 'brand' || r === 'brand_owner' ? 'brand' : r === 'influencer' ? 'influencer' : 'system';
        })() as 'brand' | 'influencer' | 'system';
        const content = asStr(msg?.content ?? msg?.text ?? msg?.body ?? '');
        const createdAt = (() => {
            const raw = msg?.createdAt ?? msg?.created_at ?? msg?.timestamp;
            return raw ? new Date(raw as string | number).toISOString() : new Date().toISOString();
        })();
        const attachmentUrl = (msg?.attachmentUrl ?? msg?.attachment_url ?? null) as string | null;
        const attachmentType = (msg?.attachmentType ?? msg?.attachment_type ?? null) as string | null;

        // 1. Update conversations list (sidebar preview + unread count)
        queryClient.setQueryData<Conversation[] | undefined>(
            queryKeys.messages.all,
            (prev) => {
                if (!prev?.length) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
                    return prev;
                }
                const matched = prev.some(c => c.id === conversationId);
                if (!matched) {
                    queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
                    return prev;
                }
                return prev.map(conv => {
                    if (conv.id !== conversationId) return conv;
                    const hasText = content.trim().length > 0;
                    const lastMsg = hasText ? content : attachmentUrl ? '📎 Attachment' : conv.lastMessage;
                    return {
                        ...conv,
                        lastMessage: lastMsg,
                        lastMessageAt: createdAt,
                    };
                });
            }
        );

        // 2. Append to active chat's infinite cache
        if (msgId) {
            const cacheKey = queryKeys.messages.infinite(conversationId, 50);
            queryClient.setQueryData(
                cacheKey,
                (old: any) => {
                    if (!old?.pages?.length) {
                        queryClient.invalidateQueries({ queryKey: cacheKey, exact: true });
                        return old;
                    }
                    const pages = [...old.pages];
                    const firstPage = { ...pages[0] };
                    const alreadyExists = firstPage.messages?.some((m: any) => m.id === msgId);
                    if (!alreadyExists) {
                        const newMsg = {
                            id: msgId,
                            conversationId,
                            senderId,
                            senderRole,
                            sender: senderRole,
                            content,
                            createdAt,
                            attachmentUrl,
                            attachmentType,
                            replyToMessageId: asStr(msg?.replyToMessageId) || null,
                            replyToMessage: (msg?.replyToMessage ?? null) as null,
                            isRead: Boolean(msg?.isRead),
                            timestamp: createdAt,
                        };
                        firstPage.messages = [...(firstPage.messages ?? []), newMsg];
                        pages[0] = firstPage;
                    }
                    return { ...old, pages };
                }
            );
        }
    };

    MESSAGE_EVENTS.forEach(event => ws.on(event, onNewMessageGlobal));


    // ─── APPLICATION_RECEIVED ────────────────────────────────────────────────
    const onApplicationReceived = (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;
        refetchCampaign(campaignId);
    };
    ws.on(WS_EVENTS.APPLICATION_RECEIVED, onApplicationReceived);  // 'APPLICATION_RECEIVED'
    ws.on('application:received', onApplicationReceived);           // lowercase compat variant

    // ─── Script submitted ─────────────────────────────────────────────────────
    const onScriptSubmitted = (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;

        // Keep the normal batched invalidation path for broad campaign data.
        refetchCampaign(campaignId, [queryKeys.campaigns.scripts(campaignId)]);

        // Force-refresh active Scripts queries once for immediate in-tab updates.
        // This bypasses cooldown in cases where script and campaign events arrive back-to-back.
        void queryClient.refetchQueries({
            queryKey: queryKeys.campaigns.scripts(campaignId),
            type: 'active',
        });
    };
    ws.on(WS_EVENTS.SCRIPT_SUBMITTED, onScriptSubmitted);
    ws.on('SCRIPT_SUBMITTED', onScriptSubmitted);

    // ─── Work submitted ───────────────────────────────────────────────────────
    ws.on(WS_EVENTS.WORK_SUBMITTED, (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;
        refetchCampaign(campaignId, [queryKeys.campaigns.submissions(campaignId)]);
    });

    // ─── Application status changed ───────────────────────────────────────────
    // Use refetchQueries (not just invalidate) so active subscribers get fresh
    // data immediately — this is the event that drives the accept/status UI.
    ws.on('APPLICATION_STATUS_CHANGED', (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;

        // Force-refetch the two queries that drive the card UI instantly.
        void queryClient.refetchQueries({
            queryKey: queryKeys.campaigns.applications(campaignId),
            type: 'active',
        });
        void queryClient.refetchQueries({
            queryKey: queryKeys.campaigns.statusBoard(campaignId),
            type: 'active',
        });

        // Batch-invalidate the rest (detail, scripts, submissions, payment) — including statusBoard.
        refetchCampaign(campaignId, [
            queryKeys.campaigns.scripts(campaignId),
            queryKeys.campaigns.submissions(campaignId),
            queryKeys.campaigns.payment.summary(campaignId),
        ], true);
    });

    // ─── Negotiation update ───────────────────────────────────────────────────
    const onNegotiationUpdate = (payload: unknown) => {
        const p = payload as { campaignId?: string; influencerId?: string };
        const campaignId = p?.campaignId;
        const influencerId = p?.influencerId;
        if (campaignId && influencerId) {
            refetch(queryKeys.campaigns.negotiation(campaignId, influencerId));
        }
        if (campaignId) {
            refetchCampaign(campaignId);
        }
    };
    ws.on(WS_EVENTS.NEGOTIATION_UPDATE, onNegotiationUpdate);  // = 'negotiation:update'
    ws.on('NEGOTIATION_UPDATED', onNegotiationUpdate);          // uppercase variant also emitted by backend

    // ─── Payment status update ────────────────────────────────────────────────
    ws.on(WS_EVENTS.PAYMENT_STATUS, (payload: unknown) => {
        const campaignId = extractCampaignId(payload);
        if (!campaignId) return;
        refetchCampaign(campaignId, [queryKeys.campaigns.payment.summary(campaignId)]);
    });

    // ─── Typing indicators — handled directly in MessagesPage via ws.on ───────
    ws.on(WS_EVENTS.TYPING_START, (_payload: unknown) => { /* component handles */ });
    ws.on(WS_EVENTS.TYPING_STOP, (_payload: unknown) => { /* component handles */ });

}
