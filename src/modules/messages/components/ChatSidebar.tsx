import type { Conversation } from '@/shared/types/campaign';
import type { User } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { usePresence } from '../hooks/usePresence';
import { getAvatarColor } from './avatarColor';

interface ChatSidebarProps {
    conversations: Conversation[];
    activeConversationId?: string | null;
    currentUser: User | null;
    onSelect: (conversationId: string) => void;
    isLoading?: boolean;
}

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function resolveTitle(conv: Conversation, isBrand: boolean): string {
    return isBrand
        ? conv.otherName || conv.influencer?.name || conv.campaignName || 'Chat'
        : conv.otherName || conv.campaignName || conv.influencer?.name || 'Chat';
}

interface ConversationItemProps {
    conv: Conversation;
    isBrand: boolean;
    /** Brand owner or agent — both chat on the brand's behalf. */
    isBrandSide: boolean;
    isActive: boolean;
    onSelect: (id: string) => void;
}

function ConversationItem({ conv, isBrand, isBrandSide, isActive, onSelect }: ConversationItemProps) {
    // Determine the partner's userId for presence tracking.
    // Brand-side users (owner or agent) track the influencer's userId, and vice versa.
    const partnerUserId = isBrandSide
        ? conv.influencerUserId ?? null
        : conv.brandUserId ?? null;

    const isOnline = usePresence(partnerUserId);

    const unreadRaw =
        (conv as any).unreadCount ??
        (conv as any).brandUnread ??
        (conv as any).influencerUnread ??
        (conv as any).unread ??
        0;
    const unread = isBrandSide
        ? (conv as any).brandUnread ?? unreadRaw
        : (conv as any).influencerUnread ?? unreadRaw;
    const effectiveUnread = isActive ? 0 : unread;

    const title = resolveTitle(conv, isBrand);
    const campaignSubtitle = conv.campaignName?.trim() || '';
    const avatarLetter = title.charAt(0) || '#';
    const avatarSrc = conv.otherAvatar || conv.influencerAvatarUrl || conv.brandLogoUrl || null;
    const avatarColor = getAvatarColor(conv.id);

    return (
        <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
                // Flat, edge-to-edge row — the list reads as one continuous scroll,
                // not a stack of cards.
                'w-full text-left px-4 py-3 flex gap-3 items-start relative transition-premium border-b border-border/50',
                isActive ? 'bg-secondary' : 'hover:bg-secondary/50',
            )}
        >
            {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
            )}
            {/* Avatar with online indicator */}
            <div className="relative shrink-0">
                {avatarSrc ? (
                    <div className="w-[42px] h-[42px] rounded-full overflow-hidden border border-border bg-secondary">
                        <ApiImage
                            src={avatarSrc}
                            alt={title}
                            className="w-full h-full object-cover"
                            fallbackText={avatarLetter}
                        />
                    </div>
                ) : (
                    <div
                        className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                        style={{ backgroundColor: avatarColor }}
                    >
                        {avatarLetter}
                    </div>
                )}
                {isOnline && (
                    <span className="absolute -bottom-px -right-px w-[11px] h-[11px] rounded-full bg-emerald-500 border-2 border-card" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-[13.5px] truncate', effectiveUnread > 0 ? 'font-bold' : 'font-semibold')}>
                        {title}
                    </p>
                    <span className="text-[10.5px] text-muted-foreground shrink-0 tabular-nums">
                        {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                </div>
                {campaignSubtitle && campaignSubtitle.toLowerCase() !== title.toLowerCase() && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{campaignSubtitle}</p>
                )}
                <div className="mt-0.5 flex items-center justify-between gap-2 min-h-[16px]">
                    <p
                        className={cn(
                            'text-xs truncate flex-1 min-w-0',
                            effectiveUnread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                        )}
                    >
                        {conv.lastMessage || ' '}
                    </p>
                    {effectiveUnread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[10.5px] font-extrabold px-1.5 shrink-0 tabular-nums">
                            {effectiveUnread > 9 ? '9+' : effectiveUnread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

export function ChatSidebar({
    conversations,
    activeConversationId,
    currentUser,
    onSelect,
    isLoading,
}: ChatSidebarProps) {
    const [query, setQuery] = useState('');
    const isBrand = currentUser?.role === 'brand_owner';
    const isBrandSide = isBrand || currentUser?.role === 'agent';

    const sorted = useMemo(
        () =>
            [...conversations].sort((a, b) => {
                const aActivity = a.lastMessageAt ?? a.createdAt ?? null;
                const bActivity = b.lastMessageAt ?? b.createdAt ?? null;
                const aTime = aActivity ? new Date(aActivity).getTime() : 0;
                const bTime = bActivity ? new Date(bActivity).getTime() : 0;
                return bTime - aTime;
            }),
        [conversations],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((conv) => {
            const title = resolveTitle(conv, isBrand).toLowerCase();
            const campaign = (conv.campaignName || '').toLowerCase();
            return title.includes(q) || campaign.includes(q);
        });
    }, [sorted, query, isBrand]);

    return (
        <div className="flex flex-col h-full min-h-0 bg-card">
            {/* Page identity lives here rather than in a PageHeader — the Messages
                route is full-bleed, so there is no page chrome above the chat. */}
            <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between gap-2">
                <h1 className="text-lg font-bold font-display tracking-tight truncate">Messages</h1>
                <HireManagerButton compact />
            </div>

            <div className="px-4 pb-3 shrink-0">
                <div className="flex items-center gap-2 bg-background border border-border rounded-full px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search conversations"
                        className="flex-1 min-w-0 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            <div className="overflow-y-auto scrollbar-thin flex-1 border-t border-border">
                {isLoading ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                        Loading conversations…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="px-2 py-10 text-center text-sm text-muted-foreground">
                        {sorted.length === 0
                            ? 'No conversations yet. Connect with an influencer to start chatting.'
                            : 'No conversations match your search.'}
                    </div>
                ) : (
                    filtered.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            conv={conv}
                            isBrand={isBrand}
                            isBrandSide={isBrandSide}
                            isActive={activeConversationId === conv.id}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
