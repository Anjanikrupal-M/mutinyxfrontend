import axios from 'axios';
import { useAuthStore } from '@/shared/stores/authStore';
import { API } from '@/core/api';

export const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // Required for CSRF protection
    },
    withCredentials: true,
});

// Create a separate instance for auth requests (like refresh) to avoid infinite interceptor loops
export const authHttp = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // Required for CSRF protection
    },
    withCredentials: true,
});

// ── Request interceptor: attach auth token ──
http.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token && token !== 'null' && token !== 'undefined' && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);


// Add the same interceptor to authHttp
authHttp.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token && token !== 'null' && token !== 'undefined' && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 / errors ──
let isRefreshing = false;
let failedQueue: { resolve: (value?: string | null) => void; reject: (reason?: unknown) => void }[] = [];

const isRefreshRequest = (url?: string): boolean => {
    if (!url) return false;
    return url.endsWith('/brand/auth/refresh') || url === API.auth.refresh;
};

const isAuthMutationRequest = (url?: string): boolean => {
    if (!url) return false;
    return (
        url.endsWith('/brand/auth/login') ||
        url.endsWith('/brand/auth/register') ||
        url === API.auth.login ||
        url === API.auth.register
    );
};

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Set by authenticate.ts's assertBrandAccess check on the backend (middleware/authenticate.ts,
// shared/access/brandAccess.ts) — thrown whenever the JWT's active brandId is no longer in the
// caller's accessible set (e.g. a manager was unassigned from the brand mid-session). Matched by
// exact message rather than just the 403 status/FORBIDDEN code, since ForbiddenError is also used
// for unrelated authorization failures (plan gates, role checks) that must NOT bounce the user.
const BRAND_ACCESS_DENIED_MESSAGE = 'Brand access denied';

http.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 403 &&
            error.response?.data?.error?.message === BRAND_ACCESS_DENIED_MESSAGE &&
            typeof window !== 'undefined' &&
            window.location.pathname !== '/profile'
        ) {
            // The active brand is no longer accessible — clear it locally so a stale value
            // doesn't linger, then send the caller to the brand picker (ProfilePage's switcher)
            // rather than leaving them stuck on a page that will keep 403ing.
            useAuthStore.getState().updateUser({ brandId: undefined });
            window.location.assign('/profile');
            return Promise.reject(error);
        }

        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !isRefreshRequest(originalRequest.url) &&
            !isAuthMutationRequest(originalRequest.url)
        ) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    if (token) {
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    } else {
                        delete originalRequest.headers['Authorization'];
                    }
                    return http(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const currentRefreshToken = useAuthStore.getState().refreshToken;
                // Preserve the active brand across refresh — the expired token no longer carries
                // it, so re-supply from the store (backend re-validates access before honoring it).
                const activeBrandId = useAuthStore.getState().user?.brandId;
                // Use the dedicated authHttp instance to hit exactly the same base URL but without the interceptors
                const { data } = await authHttp.post(API.auth.refresh, {
                    refreshToken: currentRefreshToken,
                    brandId: activeBrandId,
                });

                // Handle various token field names, or fallback to cookies
                const payload = data.data ?? data;
                const accessToken = payload?.accessToken ?? payload?.token ?? payload?.access_token;
                const newRefreshToken = payload?.refreshToken;
                const user = payload?.user;

                if (accessToken) {
                    useAuthStore.getState().setUser(user ?? useAuthStore.getState().user!, accessToken, newRefreshToken ?? null);
                    processQueue(null, accessToken);
                    originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                } else {
                    // Cookie-based refresh: clear stale token header
                    if (user) useAuthStore.getState().updateUser(user);
                    useAuthStore.getState().clearToken?.();
                    processQueue(null, null);
                    delete originalRequest.headers['Authorization'];
                }

                return http(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as Error, null);

                const status = (refreshError as { response?: { status?: number } })?.response?.status;

                if (status === 401) {
                    // Token rotation race: another tab may have just rotated the cookie.
                    // Wait briefly so the browser has time to pick up the new Set-Cookie,
                    // then try the refresh one more time before giving up.
                    await new Promise((r) => setTimeout(r, 200));
                    try {
                        const currentRefreshToken = useAuthStore.getState().refreshToken;
                        const activeBrandId = useAuthStore.getState().user?.brandId;
                        const retryRefreshData = await authHttp.post(API.auth.refresh, {
                            refreshToken: currentRefreshToken,
                            brandId: activeBrandId,
                        });
                        const retryPayload = retryRefreshData.data?.data ?? retryRefreshData.data;
                        const retryToken =
                            retryPayload?.accessToken ??
                            retryPayload?.token ??
                            retryPayload?.access_token;
                        if (retryToken) {
                            const currentUser = useAuthStore.getState().user;
                            const retryRefreshToken = retryPayload?.refreshToken;
                            useAuthStore.getState().setUser(
                                retryPayload?.user ?? currentUser!,
                                retryToken,
                                retryRefreshToken ?? null
                            );
                            originalRequest.headers['Authorization'] = `Bearer ${retryToken}`;
                            return http(originalRequest);
                        }
                    } catch {
                        // second refresh also failed — fall through to logout
                    }

                    useAuthStore.getState().clearToken?.();
                    useAuthStore.getState().logout();
                    return Promise.reject(refreshError);
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export default http;
