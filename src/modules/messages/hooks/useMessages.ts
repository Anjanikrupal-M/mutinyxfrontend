// ─────────────────────────────────────────────────────────────
// Messages Hooks — mirrors the mobile app's socket + cache strategy
//
// Pattern (same as ConversationListScreen / ChatScreen on mobile):
//   • Global list: on NEW_MESSAGE/CONVERSATION_UPDATED → invalidate conversations
//   • Chat room:   on NEW_MESSAGE → append directly into the infinite-query cache
//   • No polling — WebSocket is the single source of truth for real-time data
// ─────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import http from '@/core/http';
import { API, WS_EVENTS } from '@/core/api';
import ws from '@/core/websocket';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse } from '@/core/types';
import type { Conversation, Message, ReplyToMessageSnapshot } from '@/shared/types/campaign';
import { useAuthStore } from '@/shared/stores/authStore';

const MESSAGE_EVENT_FALLBACKS = [
    WS_EVENTS.NEW_MESSAGE,
    'new_message',
    'CHAT_MESSAGE',
    'chat:message',
    'message:new',
] as const;

// ─── Normalizers ─────────────────────────────────────────────

function mapConversation(raw: Record<string, unknown>): Conversation {
    const unreadRaw =
        raw.unreadCount ??
        raw.unread ??
        raw.brandUnread ??
        raw.influencerUnread ??
        0;
    const unread = typeof unreadRaw === 'number' ? unreadRaw : Number(unreadRaw) || 0;

    const otherAvatar =
        (raw.otherAvatar as string | undefined) ??
        (raw.influencerAvatarUrl as string | undefined) ??
        (raw.brandLogoUrl as string | undefined) ??
        null;

    // Derive the other party's actual user.id for presence tracking.
    // The backend returns brandUserId / influencerUserId in getConversation (and sometimes in the list).
    // We store whichever one isn't the current user — the ChatWindow will resolve this at display time.
    const brandUserId = asString(raw.brandUserId);
    const influencerUserId = asString(raw.influencerUserId);
    const otherUserId = brandUserId || influencerUserId || null;

    return {
        ...(raw as unknown as Conversation),
        campaignName: (raw.campaignName as string | undefined) ?? 'Campaign',
        otherAvatar,
        influencerAvatarUrl: (raw.influencerAvatarUrl as string | undefined) ?? (otherAvatar as string | null),
        brandLogoUrl: (raw.brandLogoUrl as string | undefined) ?? null,
        influencer: {
            id: String(raw.influencerId ?? ''),
            name:
                (raw.influencerName as string | undefined) ??
                (raw.otherName as string | undefined) ??
                'Chat',
            handle: (raw.influencerHandle as string | undefined) ?? '',
        },
        lastMessage:
            typeof raw.lastMessage === 'string' ? raw.lastMessage : null,
        lastMessageAt:
            typeof raw.lastMessageAt === 'string' ? raw.lastMessageAt : null,
        unread,
        unreadCount: unread,
        brandUserId: brandUserId || null,
        influencerUserId: influencerUserId || null,
        otherUserId: otherUserId || null,
        messages: [],
    };
}

function getConversationSortTime(conversation: Conversation): number {
    const activityIso =
        conversation.lastMessageAt ??
        conversation.createdAt ??
        (conversation as unknown as { updatedAt?: string }).updatedAt ??
        null;

    if (!activityIso) return 0;
    const time = new Date(activityIso).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function sortConversationsByRecent(conversations: Conversation[]): Conversation[] {
    return [...conversations].sort(
        (a, b) => getConversationSortTime(b) - getConversationSortTime(a),
    );
}

function normalizeConversationList(raw: unknown): Conversation[] {
    const o = raw as Record<string, unknown>;
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(o?.data)
            ? o.data
            : Array.isArray(
                    (o?.data as Record<string, unknown> | undefined)
                        ?.conversations,
                )
                ? (
                      (o.data as Record<string, unknown>)
                          .conversations as unknown[]
                  )
                : [];
    return sortConversationsByRecent(
        (list as Record<string, unknown>[]).map(mapConversation),
    );
}

function normalizeConversationStart(raw: unknown): Conversation {
    const o = raw as Record<string, unknown>;
    return {
        ...mapConversation((o?.data ?? o) as Record<string, unknown>),
        messages: [],
    };
}

function apiError(error: unknown): string | undefined {
    const e = error as {
        response?: { data?: { error?: { message?: string }; message?: string } };
    };
    return e.response?.data?.error?.message || e.response?.data?.message;
}

function asString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
}

function normalizeSenderRole(value: unknown): Message['senderRole'] {
    const role = asString(value).toLowerCase();
    if (role === 'brand' || role === 'brand_owner') return 'brand';
    if (role === 'influencer') return 'influencer';
    return 'system';
}

function extractConversationId(payload: unknown): string | null {
    const root = payload as Record<string, unknown>;
    const inner = (root?.data ?? root) as Record<string, unknown>;
    const message = (inner?.message ?? inner) as Record<string, unknown>;

    const messageConversation = message?.conversation as
        | string
        | { id?: string | number }
        | undefined;
    const innerConversation = inner?.conversation as
        | string
        | { id?: string | number }
        | undefined;
    const rootConversation = root?.conversation as
        | string
        | { id?: string | number }
        | undefined;

    const messageConversationId =
        typeof messageConversation === 'string'
            ? messageConversation
            : asString(messageConversation?.id);
    const innerConversationId =
        typeof innerConversation === 'string' ? innerConversation : asString(innerConversation?.id);
    const rootConversationId =
        typeof rootConversation === 'string' ? rootConversation : asString(rootConversation?.id);

    return (
        asString(message.conversationId) ||
        asString(message.conversation_id) ||
        messageConversationId ||
        asString(inner.conversationId) ||
        asString(inner.conversation_id) ||
        innerConversationId ||
        asString(root.conversationId) ||
        asString(root.conversation_id) ||
        rootConversationId ||
        null
    );
}

function normalizeIncomingMessage(payload: unknown): Message | null {
    const root = payload as Record<string, unknown>;
    const inner = (root?.data ?? root) as Record<string, unknown>;
    const msg = (inner?.message ?? inner) as Record<string, unknown>;

    const id = asString(msg?.id ?? msg?.messageId).trim();
    const conversationId = extractConversationId(payload) ?? '';
    if (!id || !conversationId) return null;

    const createdAtRaw = msg?.createdAt ?? msg?.created_at ?? msg?.timestamp ?? msg?.sentAt;
    const createdAt = createdAtRaw ? new Date(createdAtRaw as string | number | Date).toISOString() : new Date().toISOString();

    const senderCandidate =
        (msg?.sender as Record<string, unknown> | string | undefined) ??
        (msg?.user as Record<string, unknown> | string | undefined);

    const senderId = asString(
        msg?.senderId ??
            msg?.sender_id ??
            (typeof senderCandidate === 'object' ? senderCandidate?.id : '') ??
            msg?.fromUserId,
    );

    const senderRole = normalizeSenderRole(
        msg?.senderRole ??
            msg?.sender_role ??
            (typeof senderCandidate === 'object' ? senderCandidate?.role : senderCandidate) ??
            msg?.sender,
    );

    const content = asString(msg?.content ?? msg?.text ?? msg?.body ?? msg?.message);
    const attachmentUrl =
        (msg?.attachmentUrl ?? msg?.attachment_url ?? msg?.mediaUrl ?? msg?.fileUrl ?? msg?.url ?? null) as
            | string
            | null;
    const attachmentType =
        (msg?.attachmentType ?? msg?.attachment_type ?? msg?.mediaType ?? msg?.fileType ?? null) as
            | string
            | null;

    const replyToMessageId = asString(msg?.replyToMessageId ?? msg?.reply_to_message_id) || null;
    const replyToRaw = (msg?.replyToMessage ?? msg?.reply_to_message) as
        | Record<string, unknown>
        | null
        | undefined;
    let replyToMessage: ReplyToMessageSnapshot | null = null;
    if (replyToRaw && typeof replyToRaw === 'object') {
        const replySenderId = asString(replyToRaw.senderId ?? replyToRaw.sender_id);
        const replySenderRole = asString(
            replyToRaw.senderRole ?? replyToRaw.sender_role ?? replyToRaw.sender,
        );
        const replyId = asString(replyToRaw.id);
        if (replyId) {
            replyToMessage = {
                id: replyId,
                senderId: replySenderId,
                senderRole: replySenderRole,
                content: asString(replyToRaw.content ?? replyToRaw.text ?? replyToRaw.body),
                attachmentUrl:
                    (replyToRaw.attachmentUrl ?? replyToRaw.attachment_url ?? null) as string | null,
                attachmentType:
                    (replyToRaw.attachmentType ?? replyToRaw.attachment_type ?? null) as string | null,
            };
        }
    }

    return {
        id,
        conversationId,
        senderId,
        senderRole,
        sender: senderRole,
        content,
        attachmentUrl,
        attachmentType,
        replyToMessageId: replyToMessageId || null,
        replyToMessage,
        isRead: Boolean(msg?.isRead),
        timestamp: createdAt,
        createdAt,
    };
}

// ─── Queries ─────────────────────────────────────────────────

export function useConversations() {
    return useQuery({
        queryKey: queryKeys.messages.all,
        queryFn: async () => {
            const { data } = await http.get(API.messages.conversations);
            return normalizeConversationList(data);
        },
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 30),
        refetchIntervalInBackground: false,
    });
}

export interface InfiniteMessagesPage {
    conversation: Conversation;
    messages: Message[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useInfiniteMessages(
    conversationId: string,
    limit = 50,
    options?: { enabled?: boolean },
) {
    const queryClient = useQueryClient();

    return useInfiniteQuery({
        queryKey: queryKeys.messages.infinite(conversationId, limit),
        queryFn: async ({ pageParam = 1 }) => {
            const { data } = await http.get(
                API.messages.getConversation(conversationId),
                { params: { limit, page: pageParam } },
            );
            const root = (data?.data ?? data) as Record<string, unknown>;

            let msgs: Message[] = [];
            if (Array.isArray(root?.messages))
                msgs = root.messages as Message[];

            const meta = (root?.meta as {
                total: number;
                page: number;
                limit: number;
                totalPages: number;
            }) || {
                total: msgs.length,
                page: pageParam,
                limit,
                totalPages: 1,
            };
            const convRaw =
                (root?.conversation as Record<string, unknown>) ?? root;
            
            const mappedConv = mapConversation(convRaw);

            // Optimistically clear the unread badge in the list view when a page is read
            queryClient.setQueryData<Conversation[] | undefined>(
                queryKeys.messages.all,
                (previous) => {
                    if (!previous?.length) return previous;
                    return previous.map((c) =>
                        c.id === conversationId ? { ...c, unread: 0, unreadCount: 0, brandUnread: 0, influencerUnread: 0 } : c,
                    );
                },
            );

            return {
                conversation: mappedConv,
                messages: msgs,
                meta,
            } as InfiniteMessagesPage;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const { page, totalPages, total, limit: lim } = lastPage.meta;
            const hasMore =
                page < totalPages ||
                (total > 0 && lastPage.messages.length === lim);
            return hasMore ? page + 1 : undefined;
        },
        enabled:
            options?.enabled !== undefined
                ? !!conversationId && options.enabled
                : !!conversationId,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 45),
        refetchIntervalInBackground: false,
    });
}

// ─── Realtime – Conversation List (sidebar) ───────────────────
//
// Mirrors ConversationListScreen.tsx on mobile:
//   • Listens for NEW_MESSAGE and CONVERSATION_UPDATED globally.
//   • On either event → invalidate the conversations list so React Query
//     refetches the sidebar in the background.
//   • No manual state mutation — let the server be the source of truth.

export function useConversationListRealtime(activeConversationId?: string | null) {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);

    useEffect(() => {
        const invalidateList = () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.messages.all,
                exact: true,
            });
        };

        // Backend emits NEW_MESSAGE to both conversation room and personal user room.
        // Deduplicate so one incoming message increments unread only once.
        const processedMessageIds = new Set<string>();

        const onNewMessage = (payload: unknown) => {
            const incoming = normalizeIncomingMessage(payload);
            if (!incoming) {
                invalidateList();
                return;
            }

            if (incoming.id) {
                if (processedMessageIds.has(incoming.id)) return;
                processedMessageIds.add(incoming.id);
            }

            let matched = false;

            queryClient.setQueryData<Conversation[] | undefined>(queryKeys.messages.all, (previous) => {
                if (!previous?.length) return previous;

                const updated = previous.map((conv) => {
                    if (conv.id !== incoming.conversationId) return conv;

                    matched = true;

                    const userRole = currentUser?.role;
                    const isFromCurrentUser =
                        !!currentUser?.id && asString(incoming.senderId) === asString(currentUser.id);
                    const baseUnread = Number(conv.unreadCount ?? conv.unread ?? 0) || 0;
                    const baseBrandUnread = Number(conv.brandUnread ?? baseUnread) || 0;
                    const baseInfluencerUnread = Number(conv.influencerUnread ?? baseUnread) || 0;

                    let nextBrandUnread = baseBrandUnread;
                    let nextInfluencerUnread = baseInfluencerUnread;

                    if (!isFromCurrentUser && incoming.conversationId !== activeConversationId) {
                        if (userRole === 'brand_owner') {
                            nextBrandUnread = baseBrandUnread + 1;
                        } else {
                            nextInfluencerUnread = baseInfluencerUnread + 1;
                        }
                    } else if (incoming.conversationId === activeConversationId && !isFromCurrentUser) {
                        // We are already looking at this conversation, so unread count should be 0
                        if (userRole === 'brand_owner') {
                            nextBrandUnread = 0;
                        } else {
                            nextInfluencerUnread = 0;
                        }
                    }

                    const nextUnreadForUser =
                        userRole === 'brand_owner' ? nextBrandUnread : nextInfluencerUnread;

                    const hasText = String(incoming.content || '').trim().length > 0;
                    const lastMessage = hasText ? incoming.content : incoming.attachmentUrl ? 'Attachment' : conv.lastMessage;
                    const lastMessageAt = incoming.createdAt ?? incoming.timestamp ?? new Date().toISOString();

                    return {
                        ...conv,
                        lastMessage,
                        lastMessageAt,
                        unread: nextUnreadForUser,
                        unreadCount: nextUnreadForUser,
                        brandUnread: nextBrandUnread,
                        influencerUnread: nextInfluencerUnread,
                    };
                });

                return updated;
            });

            if (!matched) {
                //console.log('[WS-DEBUG] useConversationListRealtime -> Conversation not found in cache to update, invalidating list');
                invalidateList();
            } else {
                //console.log('[WS-DEBUG] useConversationListRealtime -> Conversation updated via cache', incoming.conversationId);
            }
        };

        MESSAGE_EVENT_FALLBACKS.forEach((event) => ws.on(event, onNewMessage));
        ws.on('CONVERSATION_UPDATED', invalidateList);
        ws.on('conversation_updated', invalidateList);

        return () => {
            MESSAGE_EVENT_FALLBACKS.forEach((event) => ws.off(event, onNewMessage));
            ws.off('CONVERSATION_UPDATED', invalidateList);
            ws.off('conversation_updated', invalidateList);
        };
    }, [currentUser?.id, currentUser?.role, queryClient, activeConversationId]);
}

// ─── Realtime – Chat Room ─────────────────────────────────────
//
// Mirrors useRealtimeMessages(conversationId) on mobile:
//   • Scoped to the currently open conversation.
//   • On NEW_MESSAGE → immediately append the incoming message into the
//     first page of the infinite-query cache (if it has a valid id).
//   • Falls back to invalidation if the payload lacks an id.
//   • Deduplicates against existing messages by id.

export function useConversationRealtime(
    conversationId: string | null,
    limit = 20,
) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!conversationId) return;

        const handler = (payload: unknown) => {
            //console.log('[WS-DEBUG] useConversationRealtime -> NEW_MESSAGE received', payload);
            const payloadConvId = extractConversationId(payload);
            const newMsg = normalizeIncomingMessage(payload);

            // Ignore messages for other conversations; allow through if convId is missing
            if (payloadConvId && payloadConvId !== conversationId) {
                //console.log('[WS-DEBUG] useConversationRealtime -> Ignored message for a different conversation id');
                return;
            }

            if (newMsg?.id) {
                //console.log('[WS-DEBUG] useConversationRealtime -> Successfully extracted message id, appending to cache', newMsg.id);
                // Append directly into the cache (no refetch needed)
                queryClient.setQueryData<{
                    pages: InfiniteMessagesPage[];
                    pageParams: unknown[];
                }>(
                    queryKeys.messages.infinite(conversationId, limit),
                    (old) => {
                        if (!old || !old.pages.length) {
                            queryClient.invalidateQueries({
                                queryKey: queryKeys.messages.infinite(conversationId, limit),
                                exact: true,
                            });
                            return old;
                        }

                        const pages = [...old.pages];
                        const firstPage = { ...pages[0] };

                        // Deduplicate by id
                        if (
                            !firstPage.messages.some(
                                (m) => m.id === newMsg.id,
                            )
                        ) {
                            //console.log('[WS-DEBUG] useConversationRealtime -> Inserted new message into cache success!');
                            firstPage.messages = [
                                ...firstPage.messages,
                                newMsg,
                            ];
                            pages[0] = firstPage;
                        } else {
                            //console.log('[WS-DEBUG] useConversationRealtime -> Message already existed in cache, deduplicated.');
                        }

                        return { ...old, pages };
                    },
                );
            } else {
                //console.log('[WS-DEBUG] useConversationRealtime -> Falling back to refetch, missing newMsg id');
                // Payload doesn't have an id → fall back to a targeted refetch
                queryClient.invalidateQueries({
                    queryKey: queryKeys.messages.infinite(
                        conversationId,
                        limit,
                    ),
                    exact: true,
                });
                queryClient.refetchQueries({
                    queryKey: queryKeys.messages.infinite(conversationId, limit),
                    exact: true,
                    type: 'active',
                });
            }
        };

        MESSAGE_EVENT_FALLBACKS.forEach((event) => ws.on(event, handler));

        return () => {
            MESSAGE_EVENT_FALLBACKS.forEach((event) => ws.off(event, handler));
        };
    }, [conversationId, queryClient, limit]);
}

// ─── Mutations ────────────────────────────────────────────────

export function useSendMessage(limit = 50) {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async ({
            conversationId,
            content,
            file,
            replyToMessageId,
        }: {
            conversationId: string;
            content?: string;
            file?: File;
            replyToMessageId?: string;
        }) => {
            const trimmed = (content ?? '').trim();
            const payload = file
                ? (() => {
                      const form = new FormData();
                      if (trimmed) form.append('content', trimmed);
                      if (replyToMessageId) form.append('replyToMessageId', replyToMessageId);
                      form.append('file', file);
                      return form;
                  })()
                : {
                      content: trimmed,
                      ...(replyToMessageId ? { replyToMessageId } : {}),
                  };

            const { data } = await http.post(API.messages.sendMessage(conversationId), payload, file
                ? { headers: { 'Content-Type': 'multipart/form-data' } }
                : undefined,
            );
            const body = data as ApiResponse<Message> | { data?: Message };
            const msg =
                (body as ApiResponse<Message>).data ??
                (body as { data: Message }).data;
            return msg as Message;
        },

        // ── Optimistic Update (mirrors isOptimistic flag on mobile) ──
        // Immediately show the message with lower opacity while awaiting server.
        onMutate: async ({ conversationId, content, file, replyToMessageId }) => {
            // Cancel any in-flight refetch to prevent it from overwriting our optimistic state
            await queryClient.cancelQueries({
                queryKey: queryKeys.messages.infinite(conversationId, limit),
            });
            const prev = queryClient.getQueryData<{
                pages: InfiniteMessagesPage[];
                pageParams: unknown[];
            }>(queryKeys.messages.infinite(conversationId, limit));

            const tempId = `optimistic-${Date.now()}`;
            const localAttachmentUrl = file ? URL.createObjectURL(file) : undefined;
            const senderRole =
                currentUser?.role === 'brand_owner' || currentUser?.role === 'agent'
                    ? 'brand'
                    : 'influencer';

            // Resolve reply snapshot from cache for optimistic UI; server validates the ID.
            let optimisticReplySnapshot: ReplyToMessageSnapshot | null = null;
            if (replyToMessageId && prev) {
                for (const page of prev.pages) {
                    const parent = page.messages.find((m) => m.id === replyToMessageId);
                    if (parent) {
                        optimisticReplySnapshot = {
                            id: parent.id,
                            senderId: parent.senderId,
                            senderRole: parent.senderRole,
                            content: parent.content,
                            attachmentUrl: parent.attachmentUrl ?? null,
                            attachmentType: parent.attachmentType ?? null,
                        };
                        break;
                    }
                }
            }

            const optimistic: Message = {
                id: tempId,
                conversationId,
                content: (content ?? '').trim(),
                senderId: currentUser?.id ?? '',
                senderRole,
                sender: senderRole,
                attachmentUrl: localAttachmentUrl,
                attachmentType: file?.type,
                replyToMessageId: replyToMessageId ?? null,
                replyToMessage: optimisticReplySnapshot,
                isRead: false,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            queryClient.setQueryData<{
                pages: InfiniteMessagesPage[];
                pageParams: unknown[];
            }>(
                queryKeys.messages.infinite(conversationId, limit),
                (old) => {
                    if (!old || !old.pages.length) return old;
                    const pages = [...old.pages];
                    const firstPage = { ...pages[0] };
                    firstPage.messages = [...firstPage.messages, optimistic];
                    pages[0] = firstPage;
                    return { ...old, pages };
                },
            );

            const optimisticMessageAt = new Date().toISOString();
            queryClient.setQueryData<Conversation[] | undefined>(
                queryKeys.messages.all,
                (previous) => {
                    if (!previous?.length) return previous;
                    const trimmed = (content ?? '').trim();
                    const optimisticLastMessage =
                        trimmed || (file ? 'Attachment' : null);

                    const updated = previous.map((conversation) =>
                        conversation.id === conversationId
                            ? {
                                  ...conversation,
                                  lastMessage:
                                      optimisticLastMessage ??
                                      conversation.lastMessage,
                                  lastMessageAt: optimisticMessageAt,
                              }
                            : conversation,
                    );

                    return sortConversationsByRecent(updated);
                },
            );

            return { prev, conversationId, tempId, localAttachmentUrl };
        },

        onSuccess: (newMsg, _vars, context) => {
            // Replace the optimistic placeholder with the confirmed server message
            if (!context?.conversationId || !context?.tempId) return;

            queryClient.setQueryData<{
                pages: InfiniteMessagesPage[];
                pageParams: unknown[];
            }>(
                queryKeys.messages.infinite(context.conversationId, limit),
                (old) => {
                    if (!old || !old.pages.length) return old;
                    const pages = [...old.pages];
                    const firstPage = { ...pages[0] };

                    const withoutOptimistic = firstPage.messages.filter(
                        (m) => m.id !== context.tempId,
                    );
                    if (newMsg && withoutOptimistic.some((m) => m.id === newMsg.id)) {
                        // Server-confirmed message already arrived via socket — just drop optimistic
                        firstPage.messages = withoutOptimistic;
                    } else if (newMsg) {
                        firstPage.messages = [...withoutOptimistic, newMsg];
                    } else {
                        firstPage.messages = withoutOptimistic;
                    }

                    pages[0] = firstPage;
                    return { ...old, pages };
                },
            );
        },

        onError: (error, _vars, context) => {
            // Roll back optimistic message on failure
            if (context?.prev) {
                queryClient.setQueryData(
                    queryKeys.messages.infinite(
                        context.conversationId,
                        limit,
                    ),
                    context.prev,
                );
            }
            const status = (
                error as { response?: { status?: number } }
            ).response?.status;
            if (status === 403) {
                toast.error(
                    apiError(error) || 'This conversation is read-only right now.',
                );
            } else if (status === 400) {
                toast.error(
                    apiError(error) || 'Chat is not available at this stage.',
                );
            } else {
                toast.error('Failed to send message. Please try again.');
            }
        },

        onSettled: (_data, _error, _vars, context) => {
            if (context?.localAttachmentUrl) {
                URL.revokeObjectURL(context.localAttachmentUrl);
            }
        },
    });
}

export function useStartConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            campaignInfluencerId,
        }: {
            campaignInfluencerId: string;
        }) => {
            const { data } = await http.post(API.messages.start, {
                campaignInfluencerId,
            });
            return normalizeConversationStart(data);
        },
        onSuccess: (conv) => {
            queryClient.setQueryData<Conversation[] | undefined>(
                queryKeys.messages.all,
                (previous) => {
                    const seededConversation: Conversation = {
                        ...conv,
                        lastMessageAt:
                            conv.lastMessageAt ??
                            conv.createdAt ??
                            new Date().toISOString(),
                    };

                    if (!previous?.length) {
                        return [seededConversation];
                    }

                    const withoutCurrent = previous.filter(
                        (conversation) => conversation.id !== seededConversation.id,
                    );
                    return sortConversationsByRecent([
                        seededConversation,
                        ...withoutCurrent,
                    ]);
                },
            );

            queryClient.invalidateQueries({
                queryKey: queryKeys.messages.all,
                exact: true,
            });
            if (conv?.id) {
                queryClient.setQueryData(queryKeys.messages.detail(conv.id), conv);
            }
        },
        onError: (error) => {
            const err = error as { response?: { status?: number } };
            if (err.response?.status === 400) {
                toast.error(
                    apiError(error) || 'Chat is not available at this stage.',
                );
            }
        },
    });
}
