import { Link, useNavigate } from 'react-router-dom';
import { Bell, UserCheck, ClipboardList, Send, MessageCircle, CreditCard, AlertCircle, Loader2, ChevronLeft, Trash2 } from 'lucide-react';
import { useInfiniteNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, useDeleteNotifications } from './hooks/useNotifications';
import { cn } from '@/lib/utils';
import { type Notification, useNotificationStore, resolveNotificationUrl } from '@/shared/stores/notificationStore';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, React.ElementType> = {
    application: UserCheck, script: ClipboardList, submission: Send,
    negotiation: MessageCircle, payment: CreditCard, chat: MessageCircle, system: AlertCircle,
};

const TYPE_COLORS: Record<string, string> = {
    application: 'text-green-600 bg-green-50', script: 'text-blue-600 bg-blue-50',
    submission: 'text-purple-600 bg-purple-50', negotiation: 'text-amber-600 bg-amber-50',
    payment: 'text-emerald-600 bg-emerald-50', chat: 'text-sky-600 bg-sky-50', system: 'text-gray-600 bg-gray-50',
};

export default function NotificationsPage() {
    const navigate = useNavigate();
    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteNotifications();
    const serverList = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

    const markAllRead = useMarkAllNotificationsRead();
    const markRead = useMarkNotificationRead();
    const storeNotifications = useNotificationStore((s) => s.notifications);
    const markAsReadLocal = useNotificationStore((s) => s.markAsRead);
    const markAllAsReadLocal = useNotificationStore((s) => s.markAllAsRead);
    const deleteNotifications = useDeleteNotifications();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Optimistic overlays over the paginated server data: the shared store only tracks the most
    // recent page (maintained by the Topbar), so older items surfaced here by "Load more" need
    // their own read/removed bookkeeping until the next refetch reflects it from the server.
    const [readOverrides, setReadOverrides] = useState<Set<string>>(new Set());
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

    // The rendered list: every loaded server page, with recent live (WS) store-only items
    // prepended and read state overlaid from the store + local optimistic marks. Newest first.
    const displayedNotifications = useMemo(() => {
        const storeById = new Map(storeNotifications.map((n) => [n.id, n]));
        const serverIds = new Set(serverList.map((n) => n.id));

        const base: Notification[] = serverList.map((n) => ({
            ...n,
            isRead: n.isRead || readOverrides.has(n.id) || (storeById.get(n.id)?.isRead ?? false),
        }));

        // Only surface a store-only (WS-delivered) item if it's recent and not yet on any loaded
        // server page — mirrors the grace window used elsewhere to avoid resurrecting stale rows
        // for a brand the user has since switched away from.
        const LOCAL_ONLY_GRACE_MS = 30_000;
        const now = Date.now();
        const liveOnly: Notification[] = storeNotifications
            .filter((n) => !serverIds.has(n.id) && now - new Date(n.createdAt).getTime() < LOCAL_ONLY_GRACE_MS)
            .map((n) => ({ ...n, isRead: n.isRead || readOverrides.has(n.id) }));

        const seen = new Set<string>();
        const combined: Notification[] = [];
        for (const notif of [...liveOnly, ...base]) {
            if (seen.has(notif.id) || removedIds.has(notif.id)) continue;
            seen.add(notif.id);
            combined.push(notif);
        }
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return combined;
    }, [serverList, storeNotifications, readOverrides, removedIds]);

    const unreadCount = useMemo(
        () => displayedNotifications.filter((n) => !n.isRead).length,
        [displayedNotifications],
    );

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(displayedNotifications.map((n) => n.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        deleteNotifications.mutate(ids, {
            onSuccess: () => {
                // Keep them hidden even if an in-flight refetch momentarily returns them.
                setRemovedIds((prev) => new Set([...prev, ...ids]));
                setSelectedIds(new Set());
                toast.success('Selected notifications deleted');
            },
        });
    };

    const handleMarkAllRead = () => {
        if (unreadCount === 0 || markAllRead.isPending) return;
        markAllAsReadLocal();
        setReadOverrides((prev) => {
            const next = new Set(prev);
            displayedNotifications.forEach((n) => next.add(n.id));
            return next;
        });
        markAllRead.mutate();
    };

    const handleMarkOneRead = (notif: Notification) => {
        if (notif.isRead) return;
        setReadOverrides((prev) => new Set(prev).add(notif.id));
        markAsReadLocal(notif.id);
        markRead.mutate(notif.id);
    };

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError) {
        const err = error as { response?: { status?: number; data?: { error?: { message?: string }; message?: string } }; message?: string } | null;
        const status = err?.response?.status;
        const message = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to load notifications.';

        return (
            <div className="w-full animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-secondary rounded-lg transition-premium text-muted-foreground hover:text-foreground"
                        title="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold font-display">Notifications</h1>
                        <p className="text-sm text-muted-foreground">Stay updated on campaign activity</p>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                    <p className="text-sm font-medium text-foreground mb-1">Unable to load notifications</p>
                    <p className="text-sm text-muted-foreground">{status ? `HTTP ${status}: ${message}` : message}</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="mt-4 h-9 px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-premium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isFetching ? 'Retrying...' : 'Retry'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-secondary rounded-lg transition-premium text-muted-foreground hover:text-foreground"
                    title="Go back"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold font-display">Notifications</h1>
                    <p className="text-sm text-muted-foreground">Stay updated on campaign activity</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={handleDeleteSelected}
                            disabled={deleteNotifications.isPending}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-premium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleteNotifications.isPending ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0 || markAllRead.isPending}
                        className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-premium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {markAllRead.isPending ? 'Marking...' : 'Mark all read'}
                    </button>
                </div>
            </div>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                {displayedNotifications.length > 0 && (
                    <div className="px-5 py-3 flex items-center justify-between bg-secondary/10">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={displayedNotifications.length > 0 && selectedIds.size === displayedNotifications.length}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                            />
                            <span className="text-sm font-medium text-foreground">Select All</span>
                        </label>
                    </div>
                )}
                {displayedNotifications.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-muted-foreground">No notifications yet.</div>
                ) : displayedNotifications.map((notif) => {
                    const Icon = TYPE_ICONS[notif.type] || Bell;
                    const color = TYPE_COLORS[notif.type] || 'text-gray-600 bg-gray-50';
                    const isSelected = selectedIds.has(notif.id);
                    return (
                        <div
                            key={notif.id}
                            className={cn('flex items-start gap-4 px-5 py-4 transition-premium', 
                                isSelected ? 'bg-secondary/40' : (!notif.isRead ? 'bg-primary/[0.03] hover:bg-secondary/30' : 'hover:bg-secondary/30')
                            )}
                        >
                            <div className="flex items-center h-full mt-1 mr-1">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                        const newSet = new Set(selectedIds);
                                        if (e.target.checked) newSet.add(notif.id);
                                        else newSet.delete(notif.id);
                                        setSelectedIds(newSet);
                                    }}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                                />
                            </div>
                            <Link
                                to={resolveNotificationUrl(notif)}
                            onClick={() => handleMarkOneRead(notif)}
                            className="flex-1 min-w-0 flex items-start gap-4"
                        >
                            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', color)}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={cn('text-sm', !notif.isRead ? 'font-bold text-foreground' : 'font-medium text-foreground')}>{notif.title}</p>
                                    {!notif.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                                </div>
                                <p className={cn('text-sm mt-0.5', !notif.isRead ? 'text-foreground font-medium' : 'text-muted-foreground')}>{notif.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(notif.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    {notif.campaignName && <span> · {notif.campaignName}</span>}
                                </p>
                            </div>
                        </Link>
                        </div>
                    );
                })}
                {hasNextPage && (
                    <div className="px-5 py-4 flex justify-center">
                        <button
                            type="button"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-premium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFetchingNextPage ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Loading…
                                </>
                            ) : (
                                'Load more'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
