/**
 * usePresence
 *
 * Tracks whether a given user (by userId) is currently online via WebSocket.
 * - On mount: if socket is already connected, ask CHECK_PRESENCE immediately.
 *   Otherwise wait for the next 'connect' event, then ask.
 * - Listens for USER_ONLINE / USER_OFFLINE / PRESENCE_STATUS events.
 * - Polls every 25s as a safety net in case a USER_OFFLINE broadcast was missed.
 */

import { useState, useEffect, useRef } from 'react';
import ws from '@/core/websocket';

const POLL_INTERVAL_MS = 25_000;

export function usePresence(targetUserId: string | null | undefined): boolean {
    const [isOnline, setIsOnline] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!targetUserId) {
            setIsOnline(false);
            return;
        }

        let cancelled = false;

        const fetchStatus = () => {
            if (cancelled) return;
            if (!ws.isConnected()) return;
            try {
                ws.emitWithAck<boolean>('CHECK_PRESENCE', targetUserId, (online: boolean) => {
                    if (!cancelled) setIsOnline(Boolean(online));
                });
            } catch {
                // ignore — will retry on next interval / connect
            }
        };

        // If the socket is already up, ask immediately. Otherwise wait for connect.
        if (ws.isConnected()) {
            fetchStatus();
        }

        // Safety-net poll so we self-heal if a USER_OFFLINE broadcast was missed.
        intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

        const onOnline = (payload: unknown) => {
            const data = payload as { userId?: string };
            if (data?.userId === targetUserId) setIsOnline(true);
        };

        const onOffline = (payload: unknown) => {
            const data = payload as { userId?: string };
            if (data?.userId === targetUserId) setIsOnline(false);
        };

        const onPresenceStatus = (payload: unknown) => {
            const data = payload as { userId?: string; online?: boolean };
            if (data?.userId === targetUserId) setIsOnline(Boolean(data.online));
        };

        // Fires on every (re)connect, including the very first one after this
        // hook mounted while the socket was still handshaking.
        const onConnect = () => fetchStatus();

        ws.on('USER_ONLINE', onOnline);
        ws.on('USER_OFFLINE', onOffline);
        ws.on('PRESENCE_STATUS', onPresenceStatus);
        ws.on('connect', onConnect);

        return () => {
            cancelled = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            ws.off('USER_ONLINE', onOnline);
            ws.off('USER_OFFLINE', onOffline);
            ws.off('PRESENCE_STATUS', onPresenceStatus);
            ws.off('connect', onConnect);
        };
    }, [targetUserId]);

    return isOnline;
}
