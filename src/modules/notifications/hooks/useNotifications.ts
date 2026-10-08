// ─────────────────────────────────────────────────────────────
// Notifications Hooks — List, Mark Read, Mark All Read
// ─────────────────────────────────────────────────────────────

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse, PaginatedResponse } from '@/core/types';
import type { Notification } from '@/shared/stores/notificationStore';
import { useNotificationStore } from '@/shared/stores/notificationStore';
import ws from '@/core/websocket';

interface NotificationParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

const shouldRetryNotificationsQuery = (failureCount: number, error: unknown) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403 || status === 404) return false;
    return failureCount < 3;
};

type RawNotification = Notification & {
    readAt?: string | null;
    read?: boolean;
    is_read?: boolean;
};

interface RawNotificationsResponse {
    success: boolean;
    notifications?: RawNotification[];
    items?: RawNotification[];
    rows?: RawNotification[];
    results?: RawNotification[];
    data?: RawNotification[] | {
        notifications?: RawNotification[];
        items?: RawNotification[];
        rows?: RawNotification[];
        results?: RawNotification[];
        list?: RawNotification[];
        records?: RawNotification[];
        unreadCount?: number;
        unread_count?: number;
        meta?: PaginatedResponse<Notification>['meta'];
    };
    meta?: PaginatedResponse<Notification>['meta'];
    unreadCount?: number;
    unread_count?: number;
}

function toBooleanReadState(notification: RawNotification): boolean {
    if (typeof notification.isRead === 'boolean') return notification.isRead;
    if (typeof notification.read === 'boolean') return notification.read;
    if (typeof notification.is_read === 'boolean') return notification.is_read;
    if (notification.readAt != null) return true;
    return false;
}

export type NotificationsListResult = PaginatedResponse<Notification> & { unreadCount: number };

function normalizeNotificationsResponse(payload: RawNotificationsResponse): NotificationsListResult {
    const dataField = payload?.data;
    const dataObject = !Array.isArray(dataField) && dataField && typeof dataField === 'object'
        ? dataField
        : undefined;

    const list = Array.isArray(dataField)
        ? dataField
        : (dataObject
            ? (dataObject.notifications
                ?? dataObject.items
                ?? dataObject.rows
                ?? dataObject.results
                ?? dataObject.list
                ?? dataObject.records
                ?? [])
            : (payload.notifications
                ?? payload.items
                ?? payload.rows
                ?? payload.results
                ?? []));

    const normalizedList: Notification[] = list.map((item) => ({
        ...item,
        isRead: toBooleanReadState(item),
    }));

    const unreadCount = Number(
        payload.unreadCount
            ?? payload.unread_count
            ?? dataObject?.unreadCount
            ?? dataObject?.unread_count
            ?? normalizedList.filter((item) => !item.isRead).length
    ) || 0;

    return {
        success: payload.success ?? true,
        data: normalizedList,
        meta: payload.meta ?? dataObject?.meta ?? { page: 1, limit: normalizedList.length || 50, total: normalizedList.length },
        unreadCount,
    };
}

// ── Queries ──

export function useNotifications(params?: NotificationParams) {
    const requestParams: Record<string, number | boolean> = {};
    if (typeof params?.page === 'number') requestParams.page = params.page;
    if (typeof params?.limit === 'number') requestParams.limit = params.limit;
    // Only send unreadOnly when true to avoid backend parsers treating "false" as truthy.
    if (params?.unreadOnly === true) requestParams.unreadOnly = true;

    return useQuery<NotificationsListResult>({
        queryKey: queryKeys.notifications.list(params as Record<string, unknown> | undefined),
        queryFn: async () => {
            const { data } = await http.get<RawNotificationsResponse>(API.notifications.list, {
                params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
            });
            return normalizeNotificationsResponse(data);
        },
        // WebSocket-first strategy with disconnected fallback polling.
        staleTime: 1000 * 60 * 5,
        retry: shouldRetryNotificationsQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 60),
        refetchIntervalInBackground: false,
    });
}

// Paginated feed for the full Notifications page — accumulates pages so the user can load
// older notifications (the flat useNotifications above only ever holds one page and is used
// for the Topbar bell badge). Keyed under the shared ['notifications'] prefix so the mark-read
// / delete mutations' invalidateQueries refetches every loaded page.
export function useInfiniteNotifications(limit = 20) {
    return useInfiniteQuery<NotificationsListResult>({
        queryKey: queryKeys.notifications.list({ infinite: true, limit }),
        queryFn: async ({ pageParam }) => {
            const { data } = await http.get<RawNotificationsResponse>(API.notifications.list, {
                params: { page: pageParam as number, limit },
            });
            return normalizeNotificationsResponse(data);
        },
        initialPageParam: 1,
        // Backend exposes total (not totalPages) — stop once we've loaded everything.
        getNextPageParam: (lastPage, allPages) => {
            const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
            return loaded < (lastPage.meta?.total ?? 0) ? allPages.length + 1 : undefined;
        },
        staleTime: 1000 * 60 * 5,
        retry: shouldRetryNotificationsQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnReconnect: true,
    });
}

// ── Mutations ──

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    const markAsRead = useNotificationStore((s) => s.markAsRead);

    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await http.post<ApiResponse<unknown>>(API.notifications.markRead(id));
            return data;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });

            const previous = queryClient.getQueriesData<NotificationsListResult>({
                queryKey: queryKeys.notifications.all,
            });

            queryClient.setQueriesData<NotificationsListResult>(
                { queryKey: queryKeys.notifications.all },
                (old) => {
                    // Skip the infinite-query cache (shape { pages }) — this updater only
                    // understands the flat { data } list used by the bell badge.
                    if (!old || !Array.isArray((old as { data?: unknown }).data)) return old;

                    let wasUnread = false;
                    const nextData = old.data.map((n) => {
                        if (n.id !== id) return n;
                        if (!n.isRead) wasUnread = true;
                        return { ...n, isRead: true };
                    });

                    return {
                        ...old,
                        data: nextData,
                        unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
                    };
                }
            );

            // Update local store immediately for bell badge + list dot state.
            markAsRead(id);

            return { previous };
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
        },
        onError: (_err, _id, context) => {
            context?.previous?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

    return useMutation({
        mutationFn: async () => {
            const { data } = await http.post<ApiResponse<unknown>>(API.notifications.markAllRead);
            return data;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });

            const previous = queryClient.getQueriesData<NotificationsListResult>({
                queryKey: queryKeys.notifications.all,
            });

            queryClient.setQueriesData<NotificationsListResult>(
                { queryKey: queryKeys.notifications.all },
                (old) => {
                    // Skip the infinite-query cache (shape { pages }) — see useMarkNotificationRead.
                    if (!old || !Array.isArray((old as { data?: unknown }).data)) return old;

                    return {
                        ...old,
                        data: old.data.map((n) => ({ ...n, isRead: true })),
                        unreadCount: 0,
                    };
                }
            );

            // Keep zustand in sync immediately.
            markAllAsRead();

            return { previous };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
        },
        onError: (_err, _vars, context) => {
            context?.previous?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
    });
}

export function useDeleteNotifications() {
    const queryClient = useQueryClient();
    const setNotificationsLocal = useNotificationStore((s) => s.setNotifications);

    return useMutation({
        mutationFn: async (notificationIds: string[]) => {
            const { data } = await http.post<ApiResponse<unknown>>(API.notifications.bulkDelete, { notificationIds });
            return data;
        },
        onSuccess: (_data, notificationIds) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
            
            // Remove from local store so UI updates immediately and doesn't get preserved
            const current = useNotificationStore.getState().notifications;
            setNotificationsLocal(current.filter(n => !notificationIds.includes(n.id)));
        },
    });
}
