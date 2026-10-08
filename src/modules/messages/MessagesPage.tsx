import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    useConversations,
    useInfiniteMessages,
    useSendMessage,
    useConversationRealtime,
    useConversationListRealtime,
    type InfiniteMessagesPage,
} from './hooks/useMessages';
import { Loader2 } from 'lucide-react';
import { useMobile } from '@/shared/hooks';
import { useAuthStore } from '@/shared/stores/authStore';
import { useSidebarStore } from '@/shared/stores/sidebarStore';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatWindow } from './components/ChatWindow';
import { MessagesEmptyState } from './components/MessagesEmptyState';
import ws from '@/core/websocket';
import { WS_EVENTS } from '@/core/api';
import type { TypingPayload } from '@/core/websocketSetup';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryKeys';
import type { Conversation } from '@/shared/types/campaign';

// Messages is the one route that renders as a full-height app surface rather than a
// page-in-a-card: the negative margins cancel AppShell's <main> padding (p-4 md:p-6,
// pb-36 md:pb-20) so the chat runs edge to edge. Height is the viewport minus the
// sticky Topbar (h-16), and on mobile minus the fixed BottomTabBar (h-16) as well,
// so the composer is never hidden behind it.
const FULL_BLEED =
    'animate-fade-in flex -m-4 md:-m-6 -mb-36 md:-mb-20 h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] bg-background overflow-hidden ' +
    // The hover-expanding nav rail is `fixed` and overlays page content. Every other
    // page absorbs that in its padding, but here the conversation list sits flush at
    // the rail's edge and would be covered. Slide out of the way while it is open,
    // matching the rail's own 300ms width transition so the two move as one.
    'transition-[padding] duration-300 ease-in-out';

export default function MessagesPage() {
    const { conversationId: conversationIdParam } = useParams<{ conversationId?: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: rawConversations = [], isLoading: listLoading } = useConversations();
    const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
    const currentUser = useAuthStore((s) => s.user);

    const [activeConv, setActiveConv] = useState<string | null>(null);
    const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
    const isMobile = useMobile();

    // Inset by the nav rail's overlay width while it is hover-expanded (68px → 240px),
    // so it never covers the conversation list. Desktop only — the rail is md:flex.
    const sidebarExpanded = useSidebarStore((s) => s.expanded);
    const shellClass = cn(FULL_BLEED, sidebarExpanded && 'md:pl-[172px]');

    // Hide conversations that have no messages, unless they are currently active/selected
    const conversations = useMemo(() => {
        return rawConversations.filter(c => Boolean(c.lastMessage) || c.id === activeConv || c.id === conversationIdParam);
    }, [rawConversations, activeConv, conversationIdParam]);

    const clearUnreadForConversation = useCallback(
        (conversationId: string) => {
            queryClient.setQueryData(
                queryKeys.messages.all,
                (previous: Conversation[] | undefined) => {
                    if (!previous?.length) return previous;
                    return previous.map((conv) => {
                        if (conv.id !== conversationId) return conv;

                        return {
                            ...conv,
                            unread: 0,
                            unreadCount: 0,
                            brandUnread:
                                currentUser?.role === 'brand_owner' || currentUser?.role === 'agent'
                                    ? 0
                                    : conv.brandUnread,
                            influencerUnread:
                                currentUser?.role === 'influencer'
                                    ? 0
                                    : conv.influencerUnread,
                        };
                    });
                },
            );
        },
        [currentUser?.role, queryClient],
    );


    // ── Chat room realtime: appends messages directly into cache ──
    // Mirrors useRealtimeMessages(conversationId) on mobile.
    useConversationRealtime(activeConv, 50);

    // ── Sidebar realtime: updates conversation list when new messages arrive ──
    useConversationListRealtime(activeConv);
    
    // ── Invalidate conversations list when viewing a conversation (to clear unread count) ──
    useEffect(() => {
        if (activeConv) {
            // Optimistically clear unread in cache so sidebar badge closes instantly.
            // We intentionally DO NOT invalidate the list here, otherwise it triggers a 
            // race condition where the server returns the old unread count before we mark it read!
            clearUnreadForConversation(activeConv);
        }
    }, [activeConv, clearUnreadForConversation]);

    // ── Realtime: typing indicators ──
    useEffect(() => {
        const onTypingStart = (payload: unknown) => {
            const { conversationId, userId } = payload as TypingPayload;
            if (userId === currentUser?.id) return;
            setTypingUsers((prev) => ({
                ...prev,
                [conversationId]: Array.from(
                    new Set([...(prev[conversationId] ?? []), userId]),
                ),
            }));
        };
        const onTypingStop = (payload: unknown) => {
            const { conversationId, userId } = payload as TypingPayload;
            setTypingUsers((prev) => ({
                ...prev,
                [conversationId]: (prev[conversationId] ?? []).filter(
                    (id) => id !== userId,
                ),
            }));
        };
        ws.on(WS_EVENTS.TYPING_START, onTypingStart);
        ws.on(WS_EVENTS.TYPING_STOP, onTypingStop);
        return () => {
            ws.off(WS_EVENTS.TYPING_START, onTypingStart);
            ws.off(WS_EVENTS.TYPING_STOP, onTypingStop);
        };
    }, [currentUser?.id]);

    // ── Load conversation from URL param ──
    useEffect(() => {
        if (conversationIdParam) {
            setActiveConv(conversationIdParam);
        }
    }, [conversationIdParam]);

    // ── Auto-select first conversation on desktop ONLY ──
    useEffect(() => {
        if (isMobile) return; // Never auto-select on mobile – let user choose
        if (activeConv || conversations.length === 0 || conversationIdParam) return;
        const firstId = conversations[0].id;
        setActiveConv(firstId);
        navigate(`/messages/${firstId}`, { replace: true });
    }, [isMobile, activeConv, conversations, conversationIdParam, navigate]);

    const detailQuery = useInfiniteMessages(activeConv ?? '', 50, { enabled: !!activeConv });
    const {
        data: infiniteData,
        isPending: detailPending,
        isError,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = detailQuery;

    // ── 404 guard ──
    useEffect(() => {
        if (!activeConv || !isError || !error) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
            toast.error('This conversation has not started yet.');
            navigate('/messages', { replace: true });
            setActiveConv(null);
        }
    }, [activeConv, isError, error, navigate]);

    const handleSelectConversation = useCallback(
        (id: string) => {
            // Optimistically clear unread for opened conversation in local cache.
            clearUnreadForConversation(id);

            setActiveConv(id);
            navigate(`/messages/${id}`, { replace: false });
        },
        [clearUnreadForConversation, navigate],
    );

    // ── Join/leave conversation room for presence events ──
    useEffect(() => {
        if (!activeConv) return;
        ws.emit('JOIN_CONVERSATION', activeConv);
        return () => {
            ws.emit('LEAVE_CONVERSATION', activeConv);
        };
    }, [activeConv]);

    const detailConv = infiniteData?.pages[0]?.conversation;

    const sidebarConversations = useMemo(() => {
        const raw = [...conversations];
        if (detailConv?.id && !raw.some((c) => c.id === detailConv.id)) {
            raw.push(detailConv);
        }
        
        // Deduplicate by ID
        const seen = new Set<string>();
        return raw.filter((c) => {
            if (!c.id || seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [conversations, detailConv]);

    const listRow = activeConv ? conversations.find((c) => c.id === activeConv) : null;
    const displayConv = detailConv ?? listRow ?? null;

    // ── Flat, deduplicated, chronologically sorted message list ──
    // Dedup by id, then sort oldest→newest so the UI renders top-to-bottom.
    const messages = useMemo(() => {
        if (!infiniteData) return [];
        const seen = new Set<string>();
        const all = infiniteData.pages.flatMap((p) => p.messages);
        
        // Dedup by id, and also dedup optimistic messages against their real counterparts
        const unique = all.filter((m) => {
            if (seen.has(m.id)) return false;

            // If this is an optimistic message, check if a real message with same content already exists in the list
            if (m.id.startsWith('optimistic-')) {
                const hasRealCounterpart = all.some(other => 
                    !other.id.startsWith('optimistic-') && 
                    other.content === m.content &&
                    Math.abs(new Date(other.createdAt || 0).getTime() - new Date(m.createdAt || 0).getTime()) < 30000
                );
                if (hasRealCounterpart) return false;
            }

            seen.add(m.id);
            return true;
        });

        return unique.sort((a, b) => {
            const tA = new Date(
                (a as unknown as { createdAt?: string }).createdAt ??
                    (a as unknown as { timestamp?: string }).timestamp ??
                    '',
            ).getTime();
            const tB = new Date(
                (b as unknown as { createdAt?: string }).createdAt ??
                    (b as unknown as { timestamp?: string }).timestamp ??
                    '',
            ).getTime();
            return tA - tB;
        });
    }, [infiniteData]);

    // ── Join/leave campaign room for campaign-scoped events ──
    // Conversation room join/leave is handled by the dedicated effect above.
    const campaignId = displayConv?.campaignId;
    useEffect(() => {
        if (campaignId) ws.joinCampaign(campaignId);

        return () => {
            if (campaignId) ws.leaveCampaign(campaignId);
        };
    }, [campaignId]);

    const handleSend = async ({ content, files, replyToMessageId }: { content: string; files: File[]; replyToMessageId?: string }) => {
        if (!activeConv) return;
        const text = content.trim();

        if (files.length === 0) {
            await sendMessage({ conversationId: activeConv, content: text, replyToMessageId });
            return;
        }

        // Backend accepts one file per message. Send selected files sequentially,
        // attaching caption text to the first file message. Reply pointer rides on the
        // first message only — subsequent files are standalone follow-ups.
        for (let i = 0; i < files.length; i += 1) {
            await sendMessage({
                conversationId: activeConv,
                content: i === 0 ? text : '',
                file: files[i],
                replyToMessageId: i === 0 ? replyToMessageId : undefined,
            });
        }
    };

    // ── Emit typing events while the user is composing ──
    // Backend expects `recipientUserId` (the OTHER party) — without it the
    // server-side emitToUser(undefined, ...) drops the event silently.
    const handleTyping = useCallback(
        (isTyping: boolean) => {
            if (!activeConv || !currentUser) return;
            const recipientUserId =
                currentUser.role === 'brand_owner' || currentUser.role === 'agent'
                    ? displayConv?.influencerUserId
                    : displayConv?.brandUserId;
            if (!recipientUserId) return;
            const event = isTyping ? WS_EVENTS.TYPING_START : WS_EVENTS.TYPING_STOP;
            ws.emit(event, {
                conversationId: activeConv,
                recipientUserId,
                userId: currentUser.id,
            });
        },
        [activeConv, currentUser, displayConv?.brandUserId, displayConv?.influencerUserId],
    );

    // ── Realtime read-sync for opened conversation ──
    // If a new message arrives for the currently open thread, clear unread locally
    // and notify backend so server-side counters stay aligned.
    useEffect(() => {
        if (!activeConv || !currentUser?.id) return;
        const messageEvents = [
            WS_EVENTS.NEW_MESSAGE,
            'new_message',
            'CHAT_MESSAGE',
            'chat:message',
            'message:new',
        ];

        const asString = (value: unknown) => {
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return String(value);
            return '';
        };

        const normalizeConversationId = (payload: unknown) => {
            const p = payload as Record<string, unknown>;
            const inner = (p?.data ?? p) as Record<string, unknown>;
            const message = (inner?.message ?? inner) as Record<string, unknown>;

            const messageConversation = message?.conversation as
                | string
                | { id?: string | number }
                | undefined;
            const innerConversation = inner?.conversation as
                | string
                | { id?: string | number }
                | undefined;

            return (
                asString(message.conversationId) ||
                asString(message.conversation_id) ||
                (typeof messageConversation === 'string'
                    ? messageConversation
                    : asString(messageConversation?.id)) ||
                asString(inner.conversationId) ||
                asString(inner.conversation_id) ||
                (typeof innerConversation === 'string' ? innerConversation : asString(innerConversation?.id)) ||
                asString(p.conversationId) ||
                asString(p.conversation_id) ||
                null
            );
        };

        const normalizeSenderId = (payload: unknown) => {
            const p = payload as Record<string, unknown>;
            const inner = (p?.data ?? p) as Record<string, unknown>;
            const message = (inner?.message ?? inner) as Record<string, unknown>;

            const senderObj = (message?.sender ?? message?.user) as
                | string
                | { id?: string | number }
                | undefined;

            return (
                asString(message.senderId) ||
                asString(message.sender_id) ||
                asString(message.fromUserId) ||
                (typeof senderObj === 'object' ? asString(senderObj?.id) : '') ||
                null
            );
        };

        const emitReadAck = () => {
            ws.emit(WS_EVENTS.MARK_READ, { conversationId: activeConv, userId: currentUser.id });
            ws.emit('conversation:read', { conversationId: activeConv, userId: currentUser.id });
        };

        // Backend emits NEW_MESSAGE to both the conversation room AND the personal user room,
        // so any open chat window receives two copies of the same event within ~1ms.
        // This set prevents the double MARK_READ / double unread-clear that would otherwise fire.
        const processedMessageIds = new Set<string>();

        const onNewMessage = (payload: unknown) => {
            const payloadConvId = normalizeConversationId(payload);
            if (!payloadConvId || payloadConvId !== activeConv) return;

            // Deduplicate by message id
            const rawMsg = (payload as Record<string, unknown>);
            const msgId = asString(rawMsg.id ?? rawMsg.messageId);
            if (msgId) {
                if (processedMessageIds.has(msgId)) return;
                processedMessageIds.add(msgId);
            }

            queryClient.setQueryData(queryKeys.messages.all, (previous: Conversation[] | undefined) => {
                if (!previous) return previous;
                return previous.map((conv) =>
                    conv.id === activeConv
                        ? { ...conv, unread: 0, unreadCount: 0, brandUnread: 0, influencerUnread: 0 }
                        : conv,
                );
            });

            const senderId = normalizeSenderId(payload);
            if (!senderId || senderId !== asString(currentUser.id)) {
                emitReadAck();
            }
        };

        const onReadReceipt = (payload: unknown) => {
            const { conversationId, userId } = payload as { conversationId: string; userId: string };
            if (conversationId !== activeConv || userId === currentUser?.id) return;

            queryClient.setQueryData<{
                pages: InfiniteMessagesPage[];
                pageParams: unknown[];
            }>(queryKeys.messages.infinite(activeConv, 50), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        messages: page.messages.map((m) => 
                            m.senderId === currentUser?.id ? { ...m, isRead: true } : m
                        ),
                    })),
                };
            });
        };

        messageEvents.forEach((event) => ws.on(event, onNewMessage));
        ws.on('READ_RECEIPT', onReadReceipt);
        ws.on('connect', emitReadAck);

        // Initial read ack when opening the conversation.
        emitReadAck();

        return () => {
            messageEvents.forEach((event) => ws.off(event, onNewMessage));
            ws.off('READ_RECEIPT', onReadReceipt);
            ws.off('connect', emitReadAck);
        };
    }, [activeConv, currentUser?.id, queryClient]);

    // ── Loading states ──
    const showFullPageLoader = listLoading && !conversationIdParam && conversations.length === 0;
    const showDirectLinkLoader =
        listLoading &&
        !!conversationIdParam &&
        conversations.length === 0 &&
        !detailConv &&
        !isError;

    if (showFullPageLoader || showDirectLinkLoader) {
        return (
            <div className={cn(shellClass, 'items-center justify-center')}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const showEmpty =
        !listLoading &&
        conversations.length === 0 &&
        !conversationIdParam &&
        !detailConv;

    if (showEmpty) {
        return (
            <div className={cn(shellClass, 'items-center justify-center bg-card')}>
                <MessagesEmptyState />
            </div>
        );
    }

    const showMobileChat = isMobile && !!activeConv;
    const isTypingInActiveConv = !!activeConv && (typingUsers[activeConv]?.length ?? 0) > 0;

    return (
        <div className={shellClass}>
            {/* Two-pane split starts at md (769px) to match useMobile's ≤768px cutoff —
                between the two, both panes render and would otherwise stack. */}
            <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] w-full h-full min-h-0">
                {(!isMobile || !showMobileChat) && (
                    <div className="border-r border-border min-h-0">
                        <ChatSidebar
                            conversations={sidebarConversations}
                            activeConversationId={activeConv}
                            currentUser={currentUser}
                            onSelect={handleSelectConversation}
                            isLoading={listLoading && sidebarConversations.length === 0}
                        />
                    </div>
                )}

                {(!isMobile || showMobileChat) && (
                    <div className="flex flex-col h-full min-h-0">
                        <ChatWindow
                            conversation={displayConv}
                            messages={messages}
                            currentUser={currentUser}
                            onSend={handleSend}
                            onTyping={handleTyping}
                            isSending={isSending}
                            isLoadingHistory={!!activeConv && detailPending}
                            onLoadMore={() =>
                                hasNextPage && !isFetchingNextPage && fetchNextPage()
                            }
                            hasMore={hasNextPage}
                            isFetchingMore={isFetchingNextPage}
                            isTyping={isTypingInActiveConv}
                            showMobileBack={isMobile}
                            onBack={() => {
                                setActiveConv(null);
                                navigate('/messages', { replace: false });
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
