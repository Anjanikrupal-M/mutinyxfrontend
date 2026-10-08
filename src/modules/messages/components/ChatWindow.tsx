// ─────────────────────────────────────────────────────────────
// ChatWindow
//
// Strategy (mirrors mobile ChatScreen.tsx):
//   • Normal flex-col list — items are in DOM order (oldest top, newest bottom)
//   • On initial load: scroll to bottom instantly
//   • On new message: auto-scroll if pinned to bottom; badge if scrolled up
//   • Pagination: IntersectionObserver on a top sentinel element
//     (equivalent to onEndReached on an inverted FlatList)
//   • maintainVisibleContentPosition: before loading older messages, capture
//     scrollHeight and restore after (scroll delta compensation)
// ─────────────────────────────────────────────────────────────

import { Fragment, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import type { Conversation, Message } from '@/shared/types/campaign';
import type { User } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { Send, Loader2, ChevronLeft, MoreHorizontal, ChevronDown, Paperclip, X, Check, Clock, Download, Reply, Image as ImageIcon, FileText, Video } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import { MessageContent } from './MessageContent';
import { MessageAttachmentViewer, type AttachmentKind } from './MessageAttachmentViewer';
import { toApiV1RelativePath, shouldFetchImageWithAuth } from '@/shared/hooks/useAuthenticatedImageUrl';
import http from '@/core/http';
import { toast } from 'sonner';
import { getImageUrl } from '@/lib/utils';
import { usePresence } from '../hooks/usePresence';
import { getAvatarColor } from './avatarColor';

interface ViewerState {
    src: string;
    kind: AttachmentKind;
    fileName: string;
}

async function downloadAttachment(src: string, fileName: string) {
    try {
        let blob: Blob;
        if (shouldFetchImageWithAuth(src)) {
            const res = await http.get(toApiV1RelativePath(src), { responseType: 'blob' });
            blob = res.data as Blob;
        } else {
            const res = await fetch(src);
            blob = await res.blob();
        }
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName || 'attachment';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    } catch {
        toast.error('Could not download file');
    }
}

interface ChatWindowProps {
    conversation: Conversation | null;
    messages: Message[];
    currentUser: User | null;
    onSend: (payload: { content: string; files: File[]; replyToMessageId?: string }) => Promise<void> | void;
    onTyping?: (isTyping: boolean) => void;
    isSending?: boolean;
    isLoadingHistory?: boolean;
    isTyping?: boolean;
    onBack?: () => void;
    showMobileBack?: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isFetchingMore?: boolean;
}

/** Distance from bottom (px) to consider the user "pinned to bottom".
 *  Generous so a tall incoming bubble (image/video) doesn't push us past the
 *  threshold mid-render and silently kill the autoscroll. */
const BOTTOM_THRESHOLD = 400;

/** Day divider label: "Today", "Yesterday", or "12 Jun 2026". */
function formatDayLabel(timestamp: string): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChatWindow({
    conversation,
    messages,
    currentUser,
    onSend,
    onTyping,
    isSending,
    isLoadingHistory,
    isTyping,
    onBack,
    showMobileBack = false,
    onLoadMore,
    hasMore = false,
    isFetchingMore = false,
}: ChatWindowProps) {
    const [input, setInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [viewerAttachment, setViewerAttachment] = useState<ViewerState | null>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);

    // ── Resolve the other party's user.id for presence tracking ──
    // Brand users talk to influencers; influencers talk to brands.
    const isBrandUser = currentUser?.role === 'brand_owner' || currentUser?.role === 'agent';
    const otherUserId = isBrandUser
        ? (conversation?.influencerUserId ?? conversation?.otherUserId ?? null)
        : (conversation?.brandUserId ?? conversation?.otherUserId ?? null);
    const isOtherOnline = usePresence(otherUserId);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingActiveRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '40px';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;

            // Toggle scrollbar visibility
            if (scrollHeight <= 150) {
                textareaRef.current.style.overflowY = 'hidden';
            } else {
                textareaRef.current.style.overflowY = 'auto';
            }
        }
    }, [input]);

    // Refs to avoid stale closure issues in scroll handlers
    const isPinnedRef = useRef(true);
    const prevMsgCountRef = useRef(0);
    const prevScrollHeightRef = useRef(0);
    const isLoadingMoreRef = useRef(false);
    // Tracks the last conversation we've already scrolled to bottom for.
    // When this differs from the active conversation.id, we know it's an open
    // (initial mount or a switch to a different chat) and snap to bottom.
    // Initialized to a non-null sentinel so the guard never falsely matches when
    // conversation.id is null/undefined on first load.
    const lastScrolledConvRef = useRef<string | null>('__initial__');

    // ── Helper: is the user at the bottom? ───────────────────
    const checkPinned = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
        setUnreadCount(0);
        isPinnedRef.current = true;
    }, []);

    // ── Initial load / conversation switch: jump to bottom ────
    // Fires the first time messages render for a given conversation.id, so
    // opening a thread (or switching to a different one) always lands at the
    // newest message — not in the middle. Re-scrolls after a tick to catch
    // height growth from images/videos that finish loading after layout.
    // Uses scrollIntoView on the bottom anchor (same as new-message scrolling)
    // because it is more reliable than scrollTo+scrollHeight in nested flex containers
    // where scrollHeight may be mis-reported during the layout effect phase.
    useLayoutEffect(() => {
        if (messages.length === 0) return;
        const convId = conversation?.id ?? null;
        if (convId === lastScrolledConvRef.current) return;

        lastScrolledConvRef.current = convId;
        prevMsgCountRef.current = messages.length;
        isPinnedRef.current = true;
        setUnreadCount(0);
        bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'end' });
        const t = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'end' });
            isPinnedRef.current = true;
        }, 250);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation?.id, messages.length]);

    // ── Restore scroll position after older messages are loaded ──
    // Before loading: capture scrollHeight
    // After loading:  el.scrollTop += (newScrollHeight - prevScrollHeight)
    // This is the web equivalent of maintainVisibleContentPosition.
    useEffect(() => {
        if (isFetchingMore && !isLoadingMoreRef.current) {
            isLoadingMoreRef.current = true;
            prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0;
        }
    }, [isFetchingMore]);

    useEffect(() => {
        if (!isFetchingMore && isLoadingMoreRef.current) {
            isLoadingMoreRef.current = false;
            const el = scrollRef.current;
            if (el && prevScrollHeightRef.current > 0) {
                const delta = el.scrollHeight - prevScrollHeightRef.current;
                if (delta > 0) {
                    el.scrollTop += delta;
                }
                prevScrollHeightRef.current = 0;
            }
        }
    }, [isFetchingMore]);

    // ── New messages: auto-scroll if pinned, badge if not ────
    // Read isMine inline from the latest messages array so there's no race with
    // a separate ref-updater effect. checkPinned() is captured BEFORE the new
    // bubble inflates layout further (e.g. images loading) by using the previous
    // pinned state as the source of truth, then re-checking after layout.
    useEffect(() => {
        const newCount = messages.length;
        const prevCount = prevMsgCountRef.current;
        prevMsgCountRef.current = newCount;

        // Skip if we haven't done the initial scroll for this conversation yet —
        // the initial-load effect will handle it.
        if (newCount === 0 || lastScrolledConvRef.current !== (conversation?.id ?? null)) return;

        // Skip if this is just pagination adding older messages
        if (isLoadingMoreRef.current) return;

        if (newCount > prevCount) {
            const added = newCount - prevCount;
            const lastMsg = messages[newCount - 1];
            const isMine = !!lastMsg && !!currentUser?.id && lastMsg.senderId === currentUser.id;

            // Use the pin state captured by the scroll handler BEFORE the new
            // bubble was inserted — that's the true "user was at bottom" signal.
            const wasPinned = isPinnedRef.current;
            // Also re-check now in case the user is still near the bottom even
            // after layout (BOTTOM_THRESHOLD is generous on purpose).
            const stillNearBottom = checkPinned();

            if (isMine || wasPinned || stillNearBottom) {
                // Scroll on the next frame so the DOM has flushed and the new
                // bubble's height is reflected in scrollHeight. scrollIntoView
                // on the bottom anchor is more reliable than scrollTo+scrollHeight
                // when nested flex containers misreport scrollHeight.
                requestAnimationFrame(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    setUnreadCount(0);
                    isPinnedRef.current = true;
                });
            } else {
                setUnreadCount((n) => n + added);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length]);

    // ── Typing indicator: nudge scroll if pinned ─────────────
    useEffect(() => {
        if (isTyping && isPinnedRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isTyping]);

    // ── Scroll handler: track pin state ──────────────────────
    const handleScroll = useCallback(() => {
        isPinnedRef.current = checkPinned();
        if (isPinnedRef.current) setUnreadCount(0);
    }, [checkPinned]);

    // ── IntersectionObserver: trigger pagination ──────────────
    // Observes the sentinel div at the TOP of the list.
    // When it becomes visible, the user has scrolled to the top →
    // load older messages (equivalent to onEndReached on inverted FlatList).
    useEffect(() => {
        const sentinel = topSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !isFetchingMore && !isLoadingMoreRef.current) {
                    onLoadMore?.();
                }
            },
            {
                root: scrollRef.current,
                threshold: 0.1,
            },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isFetchingMore, onLoadMore]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showAttachmentMenu) {
                setShowAttachmentMenu(false);
            }
        };
        if (showAttachmentMenu) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showAttachmentMenu]);

    // ── Reset state when conversation changes ─────────────────
    // Note: lastScrolledConvRef is intentionally NOT reset here — it stores
    // the previous conversation.id so the initial-load effect detects the switch.
    // Also DO NOT reset prevMsgCountRef here: the initial-load useLayoutEffect
    // (which fires first) sets it to the new conversation's messages.length, and
    // overwriting it to 0 here makes the next inbound WS message compute a huge
    // diff (e.g. badge "54 new messages" — the entire history) instead of 1.
    useEffect(() => {
        isPinnedRef.current = true;
        isLoadingMoreRef.current = false;
        prevScrollHeightRef.current = 0;
        setUnreadCount(0);
        setReplyTo(null);
    }, [conversation?.id]);

    // ── Focus the composer on conversation open and when starting a reply ──
    // Prevents the cursor from "jumping out" when the chat is opened or when
    // the user clicks a Reply button (which would otherwise capture focus).
    useEffect(() => {
        if (!conversation?.id) return;
        // Defer until after the layout/scroll effects above have settled so
        // the focus call doesn't race the autoscroll.
        const t = setTimeout(() => textareaRef.current?.focus(), 0);
        return () => clearTimeout(t);
    }, [conversation?.id]);

    useEffect(() => {
        if (replyTo) textareaRef.current?.focus();
    }, [replyTo]);

    // ── Typing indicator emit ─────────────────────────────────
    // Only emit TYPING_START on the first keystroke of a typing session,
    // not on every subsequent keystroke — prevents flooding the mobile with events.
    const handleInputChange = (value: string) => {
        setInput(value);
        if (!onTyping) return;
        if (value.trim()) {
            if (!isTypingActiveRef.current) {
                isTypingActiveRef.current = true;
                onTyping(true);
            }
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => {
                isTypingActiveRef.current = false;
                onTyping(false);
            }, 2000);
        } else {
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            isTypingActiveRef.current = false;
            onTyping(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() && selectedFiles.length === 0) return;

        const payload = {
            content: input.trim(),
            files: [...selectedFiles],
            replyToMessageId: replyTo?.id,
        };

        setInput('');
        setSelectedFiles([]);
        setReplyTo(null);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        onTyping?.(false);
        // Keep focus in the composer so the user can keep typing without re-clicking.
        textareaRef.current?.focus();
        try {
            await onSend(payload);
        } catch {
            // handled by mutation's onError
        } finally {
            textareaRef.current?.focus();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);

        // Validate file sizes (max 10MB per file)
        const validFiles = files.filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} is larger than 10MB`);
                return false;
            }
            return true;
        });

        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const triggerFileInput = (type: 'image/*' | 'video/*' | 'application/pdf,.doc,.docx' | '*') => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = type;
            fileInputRef.current.click();
        }
        setShowAttachmentMenu(false);
    };

    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center h-full">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Send className="w-5 h-5" />
                </div>
                <p className="text-sm">Select a conversation to start chatting</p>
            </div>
        );
    }

    const currentUserId = currentUser?.id;
    const isWritable = conversation.chatWritable !== false;

    const headerTitle =
        conversation.influencer?.name ||
        (conversation.otherName && conversation.otherName.toLowerCase() !== 'chat'
            ? conversation.otherName
            : '') ||
        conversation.campaignName ||
        'Chat';
    const headerAvatarSrc = conversation.otherAvatar || conversation.influencerAvatarUrl || conversation.brandLogoUrl || null;
    const headerAvatarColor = getAvatarColor(conversation.id);
    const hasCampaignChip = !!conversation?.campaignName && conversation.campaignName.toLowerCase() !== headerTitle.toLowerCase();

    return (
        <div className="flex flex-col h-full bg-background relative pb-[env(safe-area-inset-bottom)]">

            {/* ── Header ── */}
            <div className="px-4 md:px-5 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-card sticky top-0 z-10">
                {showMobileBack && onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium shrink-0"
                        aria-label="Back"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
                {headerAvatarSrc ? (
                    <div className="relative w-9 h-9 shrink-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-secondary">
                            <ApiImage
                                src={headerAvatarSrc}
                                alt={headerTitle}
                                className="w-full h-full object-cover"
                                fallbackText={(headerTitle || '#').charAt(0).toUpperCase()}
                            />
                        </div>
                        {isOtherOnline && (
                            <div className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
                        )}
                    </div>
                ) : (
                    <div className="relative w-9 h-9 shrink-0">
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: headerAvatarColor }}
                        >
                            {(headerTitle || '#').charAt(0)}
                        </div>
                        {isOtherOnline && (
                            <div className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
                        )}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate tracking-tight leading-tight">{headerTitle}</p>
                    {isTyping ? (
                        <p className="text-xs text-emerald-600 font-semibold">typing…</p>
                    ) : (
                        <p className={cn('text-xs font-medium', isOtherOnline ? 'text-emerald-600' : 'text-muted-foreground')}>
                            {isOtherOnline ? 'Online now' : 'Offline'}
                        </p>
                    )}
                    {hasCampaignChip && (
                        <span className="inline-flex items-center gap-1.5 mt-1 max-w-full bg-background border border-border rounded-full pl-1.5 pr-2.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            <span className="text-[11px] font-semibold truncate">{conversation.campaignName}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ── Message list ── */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative scrollbar-thin bg-secondary/25"
            >
                {/* Full-screen history loader */}
                {isLoadingHistory && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/50 z-10">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="text-sm">Loading messages…</p>
                    </div>
                )}

                {/* Pagination sentinel — sits at the very top of the list.
                    When it scrolls into view, the IntersectionObserver fires onLoadMore. */}
                <div ref={topSentinelRef} className="h-1 w-full" />

                {/* Pagination loader */}
                {isFetchingMore && (
                    <div className="flex justify-center py-3">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* "Beginning of conversation" marker */}
                {!hasMore && messages.length > 0 && !isLoadingHistory && !isFetchingMore && (
                    <div className="text-center text-xs text-muted-foreground py-4 border-b border-border/40 mx-4 mb-2 opacity-50">
                        Beginning of conversation
                    </div>
                )}

                <div className="px-4 md:px-5 pb-2 flex flex-col gap-1.5">
                    {/* Empty state */}
                    {!isLoadingHistory && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground text-sm">
                            <p>No messages yet.</p>
                            <p className="text-xs mt-1">Send the first message below.</p>
                        </div>
                    )}

                    {/* Message bubbles — oldest at top, newest at bottom */}
                    {!isLoadingHistory && messages.map((msg, index) => {
                        const m = msg as unknown as Record<string, unknown>;
                        const senderId = m.senderId as string | undefined;
                        const isOwnById = senderId && currentUserId ? senderId === currentUserId : false;
                        const senderRole = (m.senderRole ?? m.sender) as string | undefined;
                        const isOwnByRole =
                            !isOwnById &&
                            !!currentUser &&
                            ((isBrandUser &&
                                (senderRole === 'brand' || senderRole === 'brand_owner')) ||
                                (currentUser.role === 'influencer' &&
                                    senderRole === 'influencer'));
                        const isOwn = isOwnById || isOwnByRole;
                        const isOptimistic = msg.id.startsWith('optimistic-');
                        
                        const prevMsg = index > 0 ? messages[index - 1] as unknown as Record<string, unknown> : null;
                        const nextMsg = index < messages.length - 1 ? messages[index + 1] as unknown as Record<string, unknown> : null;
                        
                        const prevSenderId = prevMsg?.senderId as string | undefined;
                        const nextSenderId = nextMsg?.senderId as string | undefined;
                        const prevSenderRole = (prevMsg?.senderRole ?? prevMsg?.sender) as string | undefined;
                        const nextSenderRole = (nextMsg?.senderRole ?? nextMsg?.sender) as string | undefined;

                        const isPrevSameSender = prevMsg ? (prevSenderId && senderId ? prevSenderId === senderId : prevSenderRole === senderRole) : false;
                        const isNextSameSender = nextMsg ? (nextSenderId && senderId ? nextSenderId === senderId : nextSenderRole === senderRole) : false;
                        
                        const timestamp =
                            (m.createdAt as string | undefined) ??
                            (m.timestamp as string | undefined);
                        const prevTimestamp =
                            (prevMsg?.createdAt as string | undefined) ??
                            (prevMsg?.timestamp as string | undefined);
                        const dayKey = timestamp ? new Date(timestamp).toDateString() : '';
                        const showDateDivider =
                            !!dayKey && (!prevTimestamp || new Date(prevTimestamp).toDateString() !== dayKey);
                        const attachmentPath = m.attachmentUrl as string | undefined;
                        const attachmentType = m.attachmentType as string | undefined;
                        const attachmentUrl = attachmentPath ? getImageUrl(attachmentPath) : '';
                        const isImageAttachment =
                            !!attachmentUrl &&
                            (attachmentType?.startsWith('image/') ||
                                /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachmentUrl));
                        const isVideoAttachment =
                            !!attachmentUrl &&
                            !isImageAttachment &&
                            (attachmentType?.startsWith('video/') ||
                                /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(attachmentUrl));
                        const isPdfAttachment =
                            !!attachmentUrl &&
                            !isImageAttachment &&
                            !isVideoAttachment &&
                            (attachmentType === 'application/pdf' ||
                                /\.pdf$/i.test(attachmentUrl));
                        const attachmentName = attachmentPath
                            ? decodeURIComponent(attachmentPath.split('/').pop() || 'attachment')
                            : 'attachment';

                        const replyParent = msg.replyToMessage;
                        const replyAuthorIsOwn = replyParent
                            ? replyParent.senderId === currentUserId
                            : false;
                        const replyAuthorName = replyParent
                            ? replyAuthorIsOwn
                                ? 'You'
                                : conversation.influencer?.name ||
                                    conversation.otherName ||
                                    (replyParent.senderRole === 'brand' ? 'Brand' : 'Them')
                            : '';
                        const replyPreview = replyParent
                            ? (replyParent.content || '').trim() ||
                                (replyParent.attachmentType?.startsWith('image/')
                                    ? '📷 Photo'
                                    : replyParent.attachmentType?.startsWith('video/')
                                        ? '🎥 Video'
                                        : replyParent.attachmentType === 'application/pdf'
                                            ? '📄 PDF'
                                            : replyParent.attachmentUrl
                                                ? '📎 Attachment'
                                                : '')
                            : '';

                        return (
                            <Fragment key={msg.id}>
                            {showDateDivider && (
                                <div className="flex justify-center my-3">
                                    <span className="px-3 py-1 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                                        {formatDayLabel(timestamp!)}
                                    </span>
                                </div>
                            )}
                            <div
                                className={cn(
                                    'flex items-end gap-2 group',
                                    isOwn ? 'justify-end' : 'justify-start',
                                    !isPrevSameSender && index !== 0 && !showDateDivider && 'mt-3'
                                )}
                            >
                                {isOwn && !isOptimistic && (
                                    <button
                                        type="button"
                                        onClick={() => setReplyTo(msg)}
                                        className="opacity-0 group-hover:opacity-100 transition-precision w-7 h-7 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground flex items-center justify-center shrink-0"
                                        title="Reply"
                                        aria-label="Reply to message"
                                    >
                                        <Reply className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {!isOwn && (
                                    isNextSameSender ? (
                                        <div className="w-7 shrink-0" />
                                    ) : headerAvatarSrc ? (
                                        <div className="w-7 h-7 rounded-full overflow-hidden border border-border bg-secondary shrink-0">
                                            <ApiImage
                                                src={headerAvatarSrc}
                                                alt={headerTitle}
                                                className="w-full h-full object-cover"
                                                fallbackText={(headerTitle || '#').charAt(0).toUpperCase()}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white shrink-0"
                                            style={{ backgroundColor: headerAvatarColor }}
                                        >
                                            {(headerTitle || '#').charAt(0)}
                                        </div>
                                    )
                                )}
                                <div
                                    className={cn(
                                        'max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 shadow-sm text-sm break-all relative flex flex-col transition-all rounded-[17px]',
                                        isOwn
                                            ? 'bg-foreground text-background rounded-br-[5px]'
                                            : 'bg-secondary text-foreground rounded-bl-[5px]',
                                        isOptimistic && 'opacity-60',
                                    )}
                                >
                                    <div className="flex flex-col gap-0.5">
                                        {replyParent && (
                                            <div
                                                className={cn(
                                                    'mb-1.5 px-2 py-1 rounded-md border-l-[3px] border-accent',
                                                    isOwn ? 'bg-white/10' : 'bg-foreground/[0.06]',
                                                )}
                                            >
                                                <p
                                                    className={cn(
                                                        'text-[10px] font-bold leading-tight tracking-tight',
                                                        isOwn ? 'text-accent' : 'text-foreground',
                                                    )}
                                                >
                                                    {replyAuthorName}
                                                </p>
                                                <p
                                                    className={cn(
                                                        'text-[11px] leading-snug line-clamp-2 break-words mt-0.5',
                                                        isOwn ? 'text-background/75' : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {replyPreview || ' '}
                                                </p>
                                            </div>
                                        )}
                                        {!!msg.content?.trim() && <MessageContent content={msg.content} />}

                                        {!!attachmentUrl && (
                                            <div className={msg.content?.trim() ? 'mt-2' : ''}>
                                                {isImageAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setViewerAttachment({
                                                                src: attachmentUrl,
                                                                kind: 'image',
                                                                fileName: attachmentName,
                                                            })
                                                        }
                                                        className="block overflow-hidden rounded-xl"
                                                    >
                                                        <div className="w-full max-w-[280px] h-auto bg-secondary/20">
                                                            <ApiImage
                                                                src={attachmentUrl}
                                                                alt={attachmentName}
                                                                className="w-full h-auto max-h-[260px] object-cover"
                                                            />
                                                        </div>
                                                    </button>
                                                ) : isVideoAttachment ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setViewerAttachment({
                                                                src: attachmentUrl,
                                                                kind: 'video',
                                                                fileName: attachmentName,
                                                            })
                                                        }
                                                        className="relative block overflow-hidden rounded-xl group/video"
                                                    >
                                                        <video
                                                            src={attachmentUrl}
                                                            preload="metadata"
                                                            muted
                                                            playsInline
                                                            disablePictureInPicture
                                                            onContextMenu={(e) => e.preventDefault()}
                                                            className="w-full max-w-[280px] max-h-[260px] object-cover bg-black"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/video:bg-black/40 transition-precision">
                                                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                                                <svg viewBox="0 0 24 24" className="w-5 h-5 ml-0.5 fill-foreground">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ) : isPdfAttachment ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setViewerAttachment({
                                                                    src: attachmentUrl,
                                                                    kind: 'pdf',
                                                                    fileName: attachmentName,
                                                                })
                                                            }
                                                            className={cn(
                                                                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:opacity-80 transition-premium',
                                                                isOwn
                                                                    ? 'bg-background/20 text-background'
                                                                    : 'bg-background border border-border text-foreground',
                                                            )}
                                                        >
                                                            <Paperclip className="w-3.5 h-3.5" />
                                                            <span className="truncate max-w-[160px]">{attachmentName}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void downloadAttachment(attachmentUrl, attachmentName)}
                                                            className={cn(
                                                                'inline-flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-premium shrink-0',
                                                                isOwn
                                                                    ? 'bg-background/20 text-background'
                                                                    : 'bg-background border border-border text-foreground',
                                                            )}
                                                            aria-label={`Download ${attachmentName}`}
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => void downloadAttachment(attachmentUrl, attachmentName)}
                                                        className={cn(
                                                            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:opacity-80 transition-premium',
                                                            isOwn
                                                                ? 'bg-background/20 text-background'
                                                                : 'bg-background border border-border text-foreground',
                                                        )}
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                        <span className="truncate max-w-[140px]">{attachmentName}</span>
                                                        <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                    </div>

                                    <div className="flex items-center justify-end gap-1 mt-1 leading-none">
                                        <span
                                            className={cn(
                                                'text-[9px] leading-none tabular-nums',
                                                isOwn ? 'text-background/70' : 'text-muted-foreground',
                                            )}
                                        >
                                            {timestamp
                                                ? new Date(timestamp).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })
                                                : ''}
                                        </span>
                                        {isOwn && (
                                            <span className="inline-flex items-center shrink-0">
                                                {isOptimistic ? (
                                                    <Clock className="w-3 h-3 text-background/70" />
                                                ) : msg.isRead ? (
                                                    <span className="inline-flex items-center text-sky-400">
                                                        <Check className="w-3 h-3" strokeWidth={3} />
                                                        <Check className="w-3 h-3 -ml-[6px]" strokeWidth={3} />
                                                    </span>
                                                ) : (
                                                    <Check className="w-3 h-3 text-background/80" strokeWidth={3} />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    {isOwn && index === messages.length - 1 && msg.isRead && (
                                        <div className="flex justify-end mt-0.5 leading-none">
                                            <span className="text-[10px] leading-none text-sky-400 font-bold tracking-tight animate-in fade-in slide-in-from-top-1">Seen</span>
                                        </div>
                                    )}
                                </div>
                                {!isOwn && !isOptimistic && (
                                    <button
                                        type="button"
                                        onClick={() => setReplyTo(msg)}
                                        className="opacity-0 group-hover:opacity-100 transition-precision w-7 h-7 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground flex items-center justify-center shrink-0"
                                        title="Reply"
                                        aria-label="Reply to message"
                                    >
                                        <Reply className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            </Fragment>
                        );
                    })}

                    {/* Typing indicator removed from here, moved to header subtitle */}

                    {/* Invisible anchor at the bottom — used for scrollToBottom */}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* "N new messages" badge — shown when scrolled up and new messages arrive */}
            {unreadCount > 0 && (
                <button
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-medium shadow-lg hover:opacity-90 transition-premium z-20"
                >
                    <ChevronDown className="w-3 h-3" />
                    {unreadCount} new message{unreadCount > 1 ? 's' : ''}
                </button>
            )}

            {/* ── Reply preview ── */}
            {replyTo && (
                <div className="shrink-0 bg-card border-t border-border px-4 md:px-5 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 bg-secondary/60 border-l-2 border-accent rounded-r-md">
                        {replyTo.attachmentType?.startsWith('image/') ? (
                            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : replyTo.attachmentType?.startsWith('video/') ? (
                            <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : replyTo.attachmentType === 'application/pdf' ? (
                            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : replyTo.attachmentUrl ? (
                            <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                            <Reply className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold tracking-tight text-foreground/80">
                                Replying to {replyTo.senderId === currentUserId
                                    ? 'yourself'
                                    : conversation.influencer?.name || conversation.otherName || 'them'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {(replyTo.content || '').trim() ||
                                    (replyTo.attachmentType?.startsWith('image/')
                                        ? 'Photo'
                                        : replyTo.attachmentType === 'application/pdf'
                                            ? 'PDF'
                                            : replyTo.attachmentUrl
                                                ? 'Attachment'
                                                : '')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center shrink-0"
                        aria-label="Cancel reply"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── File attachments preview ── */}
            {selectedFiles.length > 0 && (
                <div className="shrink-0 bg-card border-t border-border px-4 md:px-5 py-2 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Attached files:</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg border border-border text-xs"
                            >
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(idx)}
                                    className="ml-1 text-muted-foreground hover:text-foreground transition-precision"
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Composer ── */}
            <div className="shrink-0 bg-card border-t border-border px-4 md:px-5 py-3.5">
                <div className="flex items-end gap-1 bg-background border border-border rounded-[22px] pl-3.5 pr-1.5 py-1.5">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,video/*,application/pdf,.doc,.docx"
                        aria-label="Upload media"
                    />
                    <div className="relative shrink-0 mb-0.5">
                        {showAttachmentMenu && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute bottom-full mb-2 left-0 w-40 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-30"
                            >
                                <button onClick={() => triggerFileInput('image/*')} className="w-full px-4 py-2 text-left text-xs hover:bg-secondary transition-colors border-b border-border/50">Photos</button>
                                <button onClick={() => triggerFileInput('video/*')} className="w-full px-4 py-2 text-left text-xs hover:bg-secondary transition-colors border-b border-border/50">Videos</button>
                                <button onClick={() => triggerFileInput('application/pdf,.doc,.docx')} className="w-full px-4 py-2 text-left text-xs hover:bg-secondary transition-colors">Documents</button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAttachmentMenu(!showAttachmentMenu);
                            }}
                            disabled={isSending || isLoadingHistory || !isWritable}
                            className={cn(
                                "w-9 h-9 rounded-full text-muted-foreground flex items-center justify-center hover:bg-secondary hover:text-foreground transition-premium shrink-0 disabled:opacity-50",
                                showAttachmentMenu && "bg-secondary text-foreground"
                            )}
                            title="Attach files"
                        >
                            <Paperclip className="w-4 h-4" />
                        </button>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void handleSend();
                            }
                        }}
                        placeholder={
                            isWritable ? 'Write a message…' : 'Chat is read-only at this stage.'
                        }
                        className="flex-1 min-h-[36px] max-h-[150px] resize-none py-2 px-1 bg-transparent text-sm focus:outline-none disabled:opacity-50"
                        // Don't disable while sending — that blurs the textarea and the user has to click back in.
                        // The Send button is still gated by isSending below.
                        disabled={isLoadingHistory || !isWritable}
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || isLoadingHistory || !isWritable || (!input.trim() && selectedFiles.length === 0)}
                        className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-premium shrink-0 disabled:opacity-50 mb-0.5"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            {viewerAttachment && (
                <MessageAttachmentViewer
                    open={!!viewerAttachment}
                    onOpenChange={(open) => {
                        if (!open) setViewerAttachment(null);
                    }}
                    src={viewerAttachment.src}
                    kind={viewerAttachment.kind}
                    fileName={viewerAttachment.fileName}
                />
            )}
        </div>
    );
}

