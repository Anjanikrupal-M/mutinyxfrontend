// ─────────────────────────────────────────────────────────────
// Social Account Linking Hooks (brand profile)
// Brands must connect at least one social account (Instagram or
// YouTube) before campaign/program/invite actions unlock — the
// backend reflects this via `socialConnected` on /me, and the
// ProfileCompleteGuard enforces it (see core/guards.tsx).
// Endpoints are shared with the creator mobile app.
// ─────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import { useAuthStore, type User } from '@/shared/stores/authStore';
import type { ApiResponse } from '@/core/types';

export interface SocialConnectionEntry {
    platform: 'instagram' | 'youtube';
    platformHandle: string | null;
    followerCount: number;
    engagementRate: string | null;
    isConnected: boolean;
    tokenExpiry: string | null;
    isExpired: boolean;
    metadata?: {
        displayName?: string;
        profilePictureUrl?: string;
        downloadedAvatarUrl?: string;
        mediaCount?: number;
        followsCount?: number;
        [key: string]: unknown;
    };
}

export interface SocialStatus {
    instagram: SocialConnectionEntry | null;
    youtube: SocialConnectionEntry | null;
}

/**
 * Refresh everything that mirrors the social-connection state: the status query,
 * and the `socialConnected` flag on /me — which must also be pushed into the auth
 * store because ProfileCompleteGuard reads the store, not the query cache.
 */
async function syncSocialState(queryClient: QueryClient): Promise<void> {
    queryClient.invalidateQueries({ queryKey: queryKeys.social.status });
    try {
        const { data } = await http.get<ApiResponse<User>>(API.auth.me);
        const me = data.data;
        queryClient.setQueryData(queryKeys.auth.me, me);
        useAuthStore.getState().updateUser({ socialConnected: me.socialConnected });
    } catch {
        // Non-fatal — the flag will refresh on the next /me fetch.
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    }
}

// ── Queries ──────────────────────────────────────────────────

export function useSocialStatus(enabled = true) {
    return useQuery({
        queryKey: queryKeys.social.status,
        queryFn: async () => {
            const { data } = await http.get<ApiResponse<SocialStatus>>(API.social.status);
            return data.data;
        },
        enabled,
        staleTime: 1000 * 60,
    });
}

// ── Mutations ─────────────────────────────────────────────────

export function useStartInstagramOAuth() {
    return useMutation({
        mutationFn: async () => {
            const { data } = await http.post<ApiResponse<{ authorizationUrl: string; transactionId: string; expiresAt: string }>>(
                API.social.instagramOAuthStart,
                { channel: 'web' },
            );
            return data.data;
        },
    });
}

export function useCompleteInstagramOAuth() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (transactionId: string) => {
            const { data } = await http.post<ApiResponse<{ connected: boolean; handle: string; followerCount: number }>>(
                API.social.instagramOAuthComplete(transactionId),
                {},
            );
            return data.data;
        },
        onSuccess: () => syncSocialState(queryClient),
    });
}

export function useStartYoutubeOAuth() {
    return useMutation({
        mutationFn: async (state: string) => {
            const { data } = await http.get<ApiResponse<{ authUrl: string }>>(
                API.social.youtubeAuthUrl,
                { params: { state } },
            );
            return data.data.authUrl;
        },
    });
}

export function useConnectYoutubeOAuth() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (code: string) => {
            const { data } = await http.post<ApiResponse<SocialConnectionEntry>>(API.social.connect, {
                platform: 'youtube',
                code,
            });
            return data.data;
        },
        onSuccess: () => syncSocialState(queryClient),
    });
}

export function useDisconnectSocial() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (platform: 'instagram' | 'youtube') => {
            await http.post(API.social.disconnect, { platform });
        },
        onSuccess: () => syncSocialState(queryClient),
    });
}
