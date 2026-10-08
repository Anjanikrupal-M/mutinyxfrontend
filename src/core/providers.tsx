import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { Toaster } from '@/shared/ui/sonner';
import { useMe } from '@/shared/hooks/useAuth';
import { useAuthStore } from '@/shared/stores/authStore';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authHttp } from '@/core/http';
import { API } from '@/core/api';
import { initWebSocketListeners } from './websocketSetup';
import ws from './websocket';
// Firebase is dynamically imported inside AuthInitializerInner effects so the
// SDK (and its auto-started Analytics) never loads on public read-only routes.
import { useRegisterNotificationToken } from '@/modules/notifications/hooks/useRegisterNotificationToken';
import type { User } from '@/shared/stores/authStore';

const AUTH_BOOTSTRAP_HINT_KEY = 'mutiny:has-auth-session';

// Decode a JWT's exp claim. Returns true if the token is missing, malformed,
// expired, or expiring within `skewSeconds`. Used at boot to decide whether
// the persisted access token is still usable, so we can refresh proactively
// instead of letting the first batch of queries fail with 401s.
function isAccessTokenStale(token: string | null | undefined, skewSeconds = 60): boolean {
    if (!token) return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
        if (!exp) return true;
        const nowSeconds = Math.floor(Date.now() / 1000);
        return exp - nowSeconds <= skewSeconds;
    } catch {
        return true;
    }
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

// Initialize global WS → QueryClient invalidation listeners.
initWebSocketListeners(queryClient);

// Global post-reconnect resync: when socket reconnects after a server restart or
// transport drop, events emitted during the disconnect window are lost (recipients: 0).
  // We mark them stale so they refetch smoothly when the window is focused or needed,
  // instead of aggressively forcing HTTP calls (which hits the 429 rate limit).
  ws.on('__resync__', () => {
      // On reconnect, only soft-invalidate the lightweight top-level queries.
      // Heavy per-campaign queries (status-board, submissions, scripts, etc.) are
      // NOT wiped here — they have their own event-driven invalidation via WS events.
      // A full invalidateQueries() was hammering the API with dozens of requests on every reconnect.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
  });

function AuthInitializer({ children }: { children: React.ReactNode }) {
    // Public read-only routes don't need auth session initialization.
    // Skipping prevents spurious /me calls and the "Initializing..." spinner on shared links.
    const isPublicRoute = window.location.pathname.startsWith('/review/');
    if (isPublicRoute) {
        return <>{children}</>;
    }
    return <AuthInitializerInner>{children}</AuthInitializerInner>;
}

function AuthInitializerInner({ children }: { children: React.ReactNode }) {
    const {
        isAuthenticated,
        token,
        logout,
        isHydrated,
        isCheckingSession,
        setCheckingSession,
        setUser,
        updateUser,
        user: storeUser,
    } = useAuthStore();
    const { data: me, isSuccess } = useMe();
    const registerToken = useRegisterNotificationToken();
    const registerTokenRef = useRef(registerToken);
    useEffect(() => { registerTokenRef.current = registerToken; });
    const fcmRegisteredRef = useRef(false);
    const [hasBootstrappedSession, setHasBootstrappedSession] = useState(false);
    
    // Ref to track if initial refresh has been attempted
    const hasAttemptedRefresh = useRef(false);

    const parseAuthUser = (value: unknown): User | null => {
        if (!value || typeof value !== 'object') return null;

        const candidate = value as Record<string, unknown>;
        const role = candidate.role;

        if (
            typeof candidate.id !== 'string' ||
            typeof candidate.email !== 'string' ||
            typeof candidate.name !== 'string' ||
            (role !== 'brand_owner' && role !== 'influencer')
        ) {
            return null;
        }

        return candidate as unknown as User;
    };

    const applyMeResult = (raw: unknown) => {
        const data = raw as { data?: Record<string, unknown> } | undefined;
        const payload = (data?.data ?? data) as Record<string, unknown> | undefined;
        const user = parseAuthUser(payload?.user ?? payload);

        if (user) {
            // Access token is in HttpOnly cookie for web; keep client token null.
            setUser(user, null);
            localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');
            return user;
        }

        return null;
    };

    const applyRefreshResult = (raw: unknown) => {
        const data = raw as { data?: Record<string, unknown> } | undefined;
        const payload = (data?.data ?? data) as Record<string, unknown> | undefined;
        const accessToken =
            (payload?.accessToken as string | undefined) ??
            (payload?.token as string | undefined) ??
            (payload?.access_token as string | undefined);
        const refreshToken = payload?.refreshToken as string | undefined;
        const user = parseAuthUser(payload?.user);

        if (accessToken) {
            if (user) {
                setUser(user, accessToken, refreshToken ?? null);
            } else if (storeUser) {
                setUser(storeUser, accessToken, refreshToken ?? null);
            }
            localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');
            return accessToken;
        }

        if (user) {
            // Cookie-only web response path
            setUser(user, null);
            localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');
        }

        return null;
    };

    // Sync store with /me data
    useEffect(() => {
        if (isSuccess && me) {
            updateUser(me);
        }
    }, [isSuccess, me, updateUser]);

    // Register the Web FCM token once per authenticated session.
    // Wait for hasBootstrappedSession so we never fire with a stale/expired token
    // on page refresh (isAuthenticated is true from persisted store before the
    // bootstrap refresh completes, which would cause a 401).
    useEffect(() => {
        if (!isAuthenticated) {
            fcmRegisteredRef.current = false;
            return;
        }
        if (!hasBootstrappedSession) return;
        if (fcmRegisteredRef.current) return;
        fcmRegisteredRef.current = true;

        let cancelled = false;
        const run = async () => {
            try {
                const { getWebFcmToken } = await import('@/lib/firebase');
                const fcmToken = await getWebFcmToken();
                if (!fcmToken || cancelled) return;
                await registerTokenRef.current.mutateAsync({ token: fcmToken, deviceType: 'web' });
            } catch {
                // Ignore token errors; app should continue to function.
                fcmRegisteredRef.current = false;
            }
        };
        run();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, hasBootstrappedSession]);

    // Listen for foreground FCM messages (app tab is open)
    useEffect(() => {
        if (!isAuthenticated) return;
        let unsubscribe: (() => void) | undefined;
        import('@/lib/firebase').then(({ onForegroundMessage }) => onForegroundMessage(({ title, body, data }) => {
            toast(title || 'Mutiny', {
                description: body,
                duration: 6000,
            });
            // Refresh notifications list
            queryClient.invalidateQueries({ queryKey: ['notifications'] });

            // If this is a chat notification, refresh messages so the recipient sees it in real-time
            const notifType = (data as Record<string, string> | undefined)?.type;
            const conversationId = (data as Record<string, string> | undefined)?.conversationId;
            const actionUrl = (data as Record<string, string> | undefined)?.actionUrl ?? '';
            const isChat = notifType === 'chat' || String(title || '').toLowerCase().includes('message');

            if (isChat) {
                // Refresh the sidebar conversation list
                queryClient.invalidateQueries({ queryKey: ['messages'] });

                // If we know the conversationId, also force-refetch that specific conversation
                const convId = conversationId || actionUrl.match(/[?&]id=([^&]+)/)?.[1];
                if (convId) {
                    void queryClient.refetchQueries({
                        queryKey: ['messages', convId],
                        type: 'active',
                    });
                }
            }
        }).then((fn) => { unsubscribe = fn; }));
        return () => { unsubscribe?.(); };
    }, [isAuthenticated]);

    // Ensure websocket is connected whenever a session exists (including persisted auth).
    useEffect(() => {
        if (!isHydrated) return;

        if (isAuthenticated) {
            import('@/core/websocket').then(({ ws }) => ws.connect(token || undefined));
            return;
        }

        import('@/core/websocket').then(({ ws }) => ws.disconnect());
    }, [isHydrated, isAuthenticated, token]);

    // 1. Initial session restore on boot if not authenticated.
    // Prefer /me first (access cookie) and use /refresh only as fallback.
    useEffect(() => {
        const initAuth = async () => {
            if (!isHydrated) return;

            const hasBootstrapHint = localStorage.getItem(AUTH_BOOTSTRAP_HINT_KEY) === '1';
            const hasPersistedStoreSession = Boolean(storeUser?.id || token || isAuthenticated);
            const shouldAttemptBootstrap = hasBootstrapHint || hasPersistedStoreSession;

            if (!shouldAttemptBootstrap) {
                setHasBootstrappedSession(true);
                return;
            }

            // Already authenticated from persisted state. If the persisted access token
            // is still fresh, skip the bootstrap refresh. If it's expired/near-expiry,
            // refresh proactively so the first batch of queries doesn't fire with a
            // stale token and trigger 401s on the backend (which clutter logs even
            // though the response interceptor recovers transparently).
            if (isAuthenticated) {
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');
                hasAttemptedRefresh.current = true;

                if (!isAccessTokenStale(token)) {
                    setHasBootstrappedSession(true);
                    return;
                }

                setCheckingSession(true);
                try {
                    const currentRefreshToken = useAuthStore.getState().refreshToken;
                    // Preserve the active brand across the bootstrap refresh — otherwise a
                    // reload with a stale token reverts the session to the default brand.
                    const activeBrandId = useAuthStore.getState().user?.brandId;
                    const { data } = await authHttp.post(API.auth.refresh, {
                        refreshToken: currentRefreshToken,
                        brandId: activeBrandId,
                    });
                    const accessToken = applyRefreshResult(data);
                    import('@/core/websocket').then(({ ws }) => ws.connect(accessToken || undefined));
                } catch (refreshErr) {
                    const status = (refreshErr as { response?: { status?: number } })?.response?.status;
                    if (status === 401) {
                        localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                        logout();
                    }
                    // Network errors: keep persisted session; the HTTP interceptor will
                    // retry once the backend is reachable.
                } finally {
                    setCheckingSession(false);
                    setHasBootstrappedSession(true);
                }
                return;
            }

            if (hasAttemptedRefresh.current) {
                setHasBootstrappedSession(true);
                return;
            }
            
            hasAttemptedRefresh.current = true;
            setCheckingSession(true);
            try {
                // First, try restoring from access cookie directly.
                try {
                    const meResponse = await authHttp.get(API.auth.me);
                    const restoredUser = applyMeResult(meResponse.data);
                    if (restoredUser) {
                        import('@/core/websocket').then(({ ws }) => ws.connect(undefined));
                        return;
                    }
                } catch (meErr) {
                    const meStatus = (meErr as { response?: { status?: number } })?.response?.status;
                    // /me can legitimately fail with 401 on expired access cookie; fall through to refresh.
                    if (meStatus && meStatus !== 401 && meStatus !== 403) {
                        console.warn('[AUTH-DIAG] Initial /me check failed', {
                            status: meStatus,
                            meUrl: API.auth.me,
                        });
                    }
                }

                // Fallback: refresh using HttpOnly refresh cookie (and store token).
                const currentRefreshToken = useAuthStore.getState().refreshToken;
                const activeBrandId = useAuthStore.getState().user?.brandId;
                const { data } = await authHttp.post(API.auth.refresh, {
                    refreshToken: currentRefreshToken,
                    brandId: activeBrandId,
                });
                const accessToken = applyRefreshResult(data);
                import('@/core/websocket').then(({ ws }) => ws.connect(accessToken || undefined));
            } catch (refreshErr) {
                const status = (refreshErr as { response?: { status?: number } })?.response?.status;
                if (status === 401) {
                    // Refresh token is genuinely invalid — clear everything.
                    localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                    logout();
                }
                // Network errors (backend restarting): do NOT logout.
                // The Zustand store already has isAuthenticated:true from localStorage,
                // so the user stays logged in and the next request after the server
                // comes back will trigger a proper token refresh via the interceptor.
            } finally {
                setCheckingSession(false);
                setHasBootstrappedSession(true);
            }
        };

        initAuth();
    }, [isHydrated, isAuthenticated, logout, setCheckingSession, storeUser?.id, token]);

    // Removal of aggressive logout effect on useMe failure
    if (!isHydrated || isCheckingSession || !hasBootstrappedSession) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing Mutiny Maker...</p>
            </div>
        );
    }

    return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <AuthInitializer>
                    {children}
                </AuthInitializer>
                <Toaster />
            </TooltipProvider>
        </QueryClientProvider>
    );
}
