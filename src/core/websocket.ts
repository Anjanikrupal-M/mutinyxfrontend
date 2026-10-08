import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from './api';
import { useAuthStore } from '@/shared/stores/authStore';

type EventHandler = (...args: unknown[]) => void;

class WebSocketManager {
    private socket: Socket | null = null;
    private listeners = new Map<string, Set<EventHandler>>();
    private joinedCampaigns = new Set<string>();
    /** Pending retry after an auth rejection, which Socket.IO does not retry on its own. */
    private authRetry: ReturnType<typeof setTimeout> | null = null;
    private pendingCampaignLeaves = new Map<string, ReturnType<typeof setTimeout>>();

    private flushCampaignJoins() {
        if (!this.socket) return;
        this.joinedCampaigns.forEach((campaignId) => {
            this.socket?.emit(WS_EVENTS.JOIN_CAMPAIGN, campaignId);
            this.socket?.emit('campaign:join', { campaignId });
        });
    }

    connect(token?: string) {
        if (this.socket?.connected) {
            this.flushCampaignJoins();
            return;
        }

        if (this.socket) {
            (this.socket as unknown as { auth: unknown }).auth = token ? { token } : {};
            this.socket.connect();
            this.flushCampaignJoins();
            return;
        }

        let url = import.meta.env.VITE_WS_URL;

        // Upgrade insecure WS connections to WSS if we are on a secure HTTPS origin
        // This prevents the Mixed Content "blocked" error when the env var is misconfigured.
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('ws://')) {
            url = url.replace('ws://', 'wss://');
        }

        this.socket = io(url, {
            auth: token ? { token } : undefined,
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnection: true,
            // Was 10. Ten failures — a laptop asleep, a flaky network, a backend restart — and
            // the socket gave up for the rest of the session: every live feature then looked
            // simply broken, with no error and no way back short of a reload.
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10_000,
        });

        // Debug output for connection lifecycle
        this.socket.on('connect', () => {
            console.log('[WS] Connected to', url);
        });

        this.socket.on('connect_error', (error: Error) => {
            console.error('[WS] Connection error:', {
                message: error.message,
                url,
                active: this.socket?.active,
                transports: this.socket?.io?.engine?.transport?.name,
            });

            /**
             * A rejection by the server's auth middleware is NOT retried by Socket.IO: it sets
             * `socket.active = false` and stops, on the reasoning that the credentials will not
             * fix themselves. Ours do — the access token is refreshed constantly — so an
             * expired token at handshake time used to kill live updates permanently while the
             * app carried on happily over HTTP. Retry with whatever token the store holds now.
             */
            if (this.socket && !this.socket.active) {
                if (this.authRetry) clearTimeout(this.authRetry);
                this.authRetry = setTimeout(() => {
                    this.authRetry = null;
                    const freshToken = useAuthStore.getState().token;
                    if (!freshToken || !this.socket || this.socket.connected) return;
                    (this.socket as unknown as { auth: unknown }).auth = { token: freshToken };
                    this.socket.connect();
                }, 3000);
            }
        });

        this.socket.on('disconnect', (reason: string) => {
            console.log('[WS] Disconnected:', reason);
        });

        // Debug all incoming WS events
        this.socket.onAny((event, ...args) => {
            if (!['NOTIFICATION', 'PRESENCE_STATUS', 'USER_ONLINE', 'USER_OFFLINE'].includes(event)) {
                console.log(`[WS] ${event}`, args);
            }
        });

        // Attach all global listeners once immediately after socket creation.
        // Socket.IO internally preserves these across reconnects.
        this.listeners.forEach((handlers, event) => {
            handlers.forEach((handler) => {
                this.socket?.on(event, handler);
            });
        });

        // Track if this is the first connection
        let isInitialConnect = true;

        // Ensure campaign room subscriptions are restored on initial connect and every reconnect.
        this.socket.on('connect', () => {
            this.flushCampaignJoins();
            
            if (isInitialConnect) {
                isInitialConnect = false;
                return; // Do not trigger a massive resync on the very first page load
            }

            // After true reconnect, fire registered resync callbacks after a short delay.
            // Delay lets JOIN_CAMPAIGN be processed by the server so missed events
            // during the disconnect window are caught via explicit refetch.
            setTimeout(() => {
                this.listeners.get('__resync__')?.forEach((cb) => cb());
            }, 600);
        });

        // A backgrounded tab is where sockets die quietly — the machine sleeps, the connection
        // is dropped, and nothing on screen asks for it back. Checking on focus means the worst
        // case is one dead connection noticed the moment the user returns to the tab.
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState !== 'visible') return;
                if (!this.socket || this.socket.connected) return;
                const freshToken = useAuthStore.getState().token;
                (this.socket as unknown as { auth: unknown }).auth = freshToken ? { token: freshToken } : {};
                this.socket.connect();
            });
        }

        // Refresh auth token on each reconnect attempt so the server
        // always receives a valid (non-expired) token after a long gap.
        this.socket.io.on('reconnect_attempt', (_attempt: number) => {
            const freshToken = useAuthStore.getState().token;
            if (this.socket) {
                (this.socket as unknown as { auth: unknown }).auth = freshToken ? { token: freshToken } : {};
            }
        });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }

    isConnected() {
        return !!this.socket?.connected;
    }

    on(event: string, handler: EventHandler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
        this.socket?.on(event, handler);
    }

    off(event: string, handler: EventHandler) {
        this.listeners.get(event)?.delete(handler);
        this.socket?.off(event, handler);
    }

    emit(event: string, data?: unknown) {
        this.socket?.emit(event, data);
    }

    emitWithAck<T = unknown>(event: string, data?: unknown, callback?: (response: T) => void) {
        if (!this.socket) return;
        if (callback) {
            this.socket.emit(event, data, callback);
        } else {
            this.socket.emit(event, data);
        }
    }

    joinCampaign(campaignId: string) {
        const pendingLeave = this.pendingCampaignLeaves.get(campaignId);
        if (pendingLeave) {
            clearTimeout(pendingLeave);
            this.pendingCampaignLeaves.delete(campaignId);
        }

        this.joinedCampaigns.add(campaignId);
        this.emit(WS_EVENTS.JOIN_CAMPAIGN, campaignId);
        this.emit('campaign:join', { campaignId });
    }

    leaveCampaign(campaignId: string) {
        const existing = this.pendingCampaignLeaves.get(campaignId);
        if (existing) {
            clearTimeout(existing);
        }

        // Grace period avoids transient leave/join churn from fast remounts
        // (e.g. React StrictMode development double-invoke or quick route flips).
        const timer = setTimeout(() => {
            this.pendingCampaignLeaves.delete(campaignId);
            this.joinedCampaigns.delete(campaignId);
            this.emit(WS_EVENTS.LEAVE_CAMPAIGN, campaignId);
            this.emit('campaign:leave', { campaignId });
        }, 600);

        this.pendingCampaignLeaves.set(campaignId, timer);
    }
}

export const ws = new WebSocketManager();
export default ws;
