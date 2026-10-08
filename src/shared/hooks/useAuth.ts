// ─────────────────────────────────────────────────────────────
// Auth Hooks — Login, Register, Refresh, Logout, Me
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import http, { authHttp } from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import { useAuthStore } from '@/shared/stores/authStore';
import type { ApiResponse } from '@/core/types';
import type { User } from '@/shared/stores/authStore';
import { DEV_DEMO_USER, isDevDemoLogin, isDevDemoUser } from '@/mocks/devAuth';
import { toast } from 'sonner';

const AUTH_BOOTSTRAP_HINT_KEY = 'mutiny:has-auth-session';

const omitUndefined = <T extends object>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

// ── Queries ──

export function useMe(): UseQueryResult<User, Error> {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isHydrated = useAuthStore((s) => s.isHydrated);

    return useQuery<User, Error>({
        queryKey: queryKeys.auth.me,
        queryFn: async () => {
            const storeUser = useAuthStore.getState().user;
            if (storeUser && isDevDemoUser(storeUser)) return { ...DEV_DEMO_USER, ...storeUser };
            const { data } = await http.get<ApiResponse<User>>(API.auth.me);
            return data.data;
        },
        enabled: isAuthenticated && isHydrated,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false,
        refetchOnWindowFocus: false,
        throwOnError: false,
    });
}

// ── Mutations ──

interface LoginPayload {
    email: string;
    password: string;
}

interface RegisterPayload {
    email: string;
    password: string;
    name: string;
    role: string;
    brandName?: string;
}

interface AuthResponse {
    user?: User;
    accessToken?: string;
    refreshToken?: string;
    requiresVerification?: boolean;
    email?: string;
}

export function useLogin() {
    const setUser = useAuthStore((s) => s.setUser);
    const clearToken = useAuthStore((s) => s.clearToken);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();

    return useMutation({
        onMutate: () => {
            // Ensure a clean login attempt and avoid stale bearer headers from previous sessions.
            clearToken();
            logout();
            queryClient.clear();
        },
        mutationFn: async (payload: LoginPayload): Promise<AuthResponse> => {
            if (isDevDemoLogin(payload.email, payload.password)) {
                return { user: DEV_DEMO_USER };
            }
            const { data } = await http.post<ApiResponse<AuthResponse>>(API.auth.login, payload);
            return data.data;
        },
        onSuccess: async (data) => {
            // Dev-only demo account: no backend session to verify, sign in locally.
            if (isDevDemoUser(data.user)) {
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');
                queryClient.setQueryData(queryKeys.auth.me, DEV_DEMO_USER);
                setUser(DEV_DEMO_USER, null, null);
                return;
            }
            try {
                const { data: meResponse } = await authHttp.get<ApiResponse<User>>(API.auth.me);
                const me = meResponse.data;
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');

                const cachedMe = queryClient.getQueryData<User>(queryKeys.auth.me);
                if (cachedMe?.id && cachedMe.id !== me.id) {
                    queryClient.clear();
                }

                queryClient.setQueryData(queryKeys.auth.me, me);
                setUser(me, data.accessToken ?? null, data.refreshToken ?? null);
                queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            } catch {
                localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                logout();
                queryClient.clear();
                toast.error('Login could not establish a valid session. Please try again.');
            }
        },
    });
}

export function useRegister() {
    const setUser = useAuthStore((s) => s.setUser);
    const clearToken = useAuthStore((s) => s.clearToken);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();

    return useMutation({
        onMutate: () => {
            // Ensure a clean registration attempt and avoid stale bearer headers from previous sessions.
            clearToken();
            logout();
            queryClient.clear();
        },
        mutationFn: async (payload: RegisterPayload) => {
            const { data } = await http.post<ApiResponse<AuthResponse>>(API.auth.register, payload);
            return data.data;
        },
        onSuccess: async (data) => {
            if (data.requiresVerification) {
                // Wait for verifyEmail
                return;
            }
            try {
                const { data: meResponse } = await authHttp.get<ApiResponse<User>>(API.auth.me);
                const me = meResponse.data;
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');

                const cachedMe = queryClient.getQueryData<User>(queryKeys.auth.me);
                if (cachedMe?.id && cachedMe.id !== me.id) {
                    queryClient.clear();
                }

                queryClient.setQueryData(queryKeys.auth.me, me);
                setUser(me, data.accessToken ?? null, data.refreshToken ?? null);
                queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            } catch {
                localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                logout();
                queryClient.clear();
                toast.error('Account created, but session setup failed. Please sign in again.');
            }
        },
    });
}

interface VerifyEmailPayload {
    email: string;
    code: string;
}

export function useVerifyEmail() {
    const setUser = useAuthStore((s) => s.setUser);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: VerifyEmailPayload) => {
            const { data } = await http.post<ApiResponse<AuthResponse>>(API.auth.verifyEmail, payload);
            return data.data;
        },
        onSuccess: async (data) => {
            try {
                const { data: meResponse } = await authHttp.get<ApiResponse<User>>(API.auth.me);
                const me = meResponse.data;
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');

                queryClient.setQueryData(queryKeys.auth.me, me);
                setUser(me, data.accessToken ?? null, data.refreshToken ?? null);
                queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            } catch {
                localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                logout();
                queryClient.clear();
                toast.error('Session setup failed. Please sign in again.');
            }
        },
    });
}

export function useRefreshToken() {
    const setUser = useAuthStore((s) => s.setUser);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            // Preserve the active brand across refresh — see refresh() on the backend.
            const activeBrandId = useAuthStore.getState().user?.brandId;
            const { data } = await authHttp.post<ApiResponse<AuthResponse>>(API.auth.refresh, {
                brandId: activeBrandId,
            });
            return data.data;
        },
        onSuccess: async (data) => {
            try {
                const { data: meResponse } = await authHttp.get<ApiResponse<User>>(API.auth.me);
                const me = meResponse.data;
                localStorage.setItem(AUTH_BOOTSTRAP_HINT_KEY, '1');

                const cachedMe = queryClient.getQueryData<User>(queryKeys.auth.me);
                if (cachedMe?.id && cachedMe.id !== me.id) {
                    queryClient.clear();
                }

                queryClient.setQueryData(queryKeys.auth.me, me);
                setUser(me, data.accessToken ?? null, data.refreshToken ?? null);
                queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            } catch {
                localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                logout();
                queryClient.clear();
            }
        },
        onError: (error) => {
            // Logout only if refresh fails with 401. A 403 can come from a role mismatch
            // or a forbidden downstream response and should not invalidate the whole session.
            const status = (error as any)?.response?.status;
            if (status === 401) {
                localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
                logout();
            }
        },
    });
}

export function useLogout() {
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await http.post(API.auth.logout);
        },
        onSettled: () => {
            localStorage.removeItem(AUTH_BOOTSTRAP_HINT_KEY);
            logout();
            queryClient.clear();
        },
    });
}

// ── Profile Mutations ──

export function useUpdateProfile() {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);
    const currentUser = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async (payload: Partial<User>) => {
            const isInfluencer = currentUser?.role === 'influencer';
            const backendPayload = {
                name: payload.name,
                brandName: payload.brandName,
                industry: payload.industry,
                website: payload.website,
                city: payload.city,
                state: payload.state,
                pincode: payload.pincode,
                primaryLanguage: payload.primaryLanguage,
                bio: payload.bio,
                acceptingCollabs: payload.acceptingCollabs,
                featuredPortfolioIds: payload.featuredPortfolioIds,
                settings: payload.settings,
                avatarUrl: payload.avatarUrl,
                brandLogoUrl: payload.brandLogoUrl,
                socialLinks: payload.socialLinks,
            };
            if (isDevDemoUser(currentUser)) {
                return omitUndefined({ ...currentUser, ...backendPayload } as User);
            }
            const endpoint = isInfluencer ? API.profile.influencerUpdate : API.profile.update;
            const { data } = await http.put<ApiResponse<User>>(endpoint, backendPayload);
            return data.data;
        },
        onSuccess: (data) => {
            updateUser(data);
            queryClient.setQueryData(queryKeys.auth.me, (old: unknown) => {
                if (!old || typeof old !== 'object') return data;
                return { ...(old as object), ...data };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
        onError: () => {
            toast.error('Failed to update profile');
        },
    });
}

export function useUploadAvatar() {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);
    const currentUser = useAuthStore((s) => s.user);

    const extractAvatarKey = (payload: unknown): string => {
        if (!payload || typeof payload !== 'object') return '';
        const row = payload as Record<string, unknown>;
        // Backend may return the updated profile object or a lightweight upload response.
        return String(
            row.avatarUrl ??
            row.logoUrl ??
            row.key ??
            row.url ??
            (row.profile as Record<string, unknown> | undefined)?.avatarUrl ??
            (row.profile as Record<string, unknown> | undefined)?.logoUrl ??
            ''
        );
    };

    return useMutation({
        mutationFn: async (file: File) => {
            if (!(file instanceof File)) {
                throw new Error('Invalid upload payload: avatar must be a File/Blob');
            }
            const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);
            if (!allowedMimeTypes.has(file.type)) {
                throw new Error('Only JPG and PNG images are allowed.');
            }
            const formData = new FormData();
            // Backend expects multer upload.single('avatar')
            formData.append('avatar', file);
            // Do NOT set Content-Type manually — Axios sets it with the correct boundary
            const endpoint = currentUser?.role === 'influencer'
                ? API.profile.influencerUploadAvatar
                : API.profile.uploadAvatar;
            const { data } = await http.post<ApiResponse<Record<string, unknown>>>(
                endpoint,
                formData,
                {
                    // Override global JSON default headers on shared axios instance.
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );
            return data.data;
        },
        onSuccess: (data) => {
            const avatarPath = extractAvatarKey(data);
            const timestampedPath = avatarPath ? `${avatarPath}${avatarPath.includes('?') ? '&' : '?'}_t=${Date.now()}` : '';
            
            updateUser({ avatarUrl: timestampedPath, brandLogoUrl: timestampedPath });
            queryClient.setQueryData(queryKeys.auth.me, (prev: unknown) => {
                if (!prev || typeof prev !== 'object') return prev;
                return {
                    ...(prev as Record<string, unknown>),
                    avatarUrl: timestampedPath,
                    brandLogoUrl: timestampedPath,
                };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            toast.success('Logo uploaded successfully');
        },
        onError: () => {
            toast.error('Upload failed. Please use a JPG or PNG image.');
        },
    });
}

export function useDeleteAvatar() {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);
    const currentUser = useAuthStore((s) => s.user);

    return useMutation({
        mutationFn: async () => {
            const endpoint = currentUser?.role === 'influencer'
                ? API.profile.influencerDeleteAvatar
                : API.profile.deleteAvatar;
            await http.delete(endpoint);
        },
        onSuccess: () => {
            updateUser({ avatarUrl: undefined, brandLogoUrl: undefined });
            queryClient.setQueryData(queryKeys.auth.me, (old: unknown) => {
                if (!old || typeof old !== 'object') return old;
                return { ...(old as object), avatarUrl: null, brandLogoUrl: null };
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
        onError: () => {
            toast.error('Failed to delete photo. Please try again.');
        },
    });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
            const { data } = await http.post<ApiResponse<{ message: string }>>(API.auth.changePassword, payload);
            return data.data;
        },
        onSuccess: () => {
            toast.success('Password updated successfully');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error?.message || 'Failed to update password';
            toast.error(msg);
        },
    });
}

export function useUpdateAccount() {
    const queryClient = useQueryClient();
    const updateUser = useAuthStore((s) => s.updateUser);

    return useMutation({
        mutationFn: async (payload: Pick<User, 'name' | 'email'> & { phoneNumber?: string | null }) => {
            const currentUser = useAuthStore.getState().user;
            if (currentUser && isDevDemoUser(currentUser)) {
                return { ...currentUser, ...payload, phoneNumber: payload.phoneNumber || undefined } as User;
            }
            const { data } = await http.put<ApiResponse<User>>(API.auth.updateMe, {
                name: payload.name,
                email: payload.email,
                phoneNumber: payload.phoneNumber === '' ? null : payload.phoneNumber,
            });
            return data.data;
        },
        onSuccess: (data) => {
            updateUser(data);
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
            toast.success('Account updated successfully');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error?.message || 'Failed to update account';
            toast.error(msg);
        },
    });
}

