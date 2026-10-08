// ─────────────────────────────────────────────────────────────
// Campaign Hooks — List, Detail, Create, Update, Delete, Launch, Close
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import type { ApiResponse, PaginatedResponse } from '@/core/types';
import type { Campaign } from '@/shared/types/campaign';
import ws from '@/core/websocket';
import {
    demoCloseCampaign,
    demoCreateCampaign,
    demoDeleteCampaign,
    demoGetCampaign,
    demoLaunchCampaign,
    demoListCampaigns,
    demoUpdateCampaign,
    demoUploadScript,
    demoUploadThumbnail,
    demoAssignCampaignAgent,
    isDevDemoSession,
} from '@/mocks/devCampaigns';
import { demoTeamMemberName } from '@/mocks/devTeam';

interface CampaignFilters {
    status?: string;
    type?: string;
    visibility?: string;
    page?: number;
    limit?: number;
    sort?: string;
    [key: string]: unknown;
}

// ── Queries ──

export function useCampaigns(filters?: CampaignFilters) {
    return useQuery({
        queryKey: queryKeys.campaigns.list(filters),
        queryFn: async () => {
            if (isDevDemoSession()) return demoListCampaigns(filters);
            const { data } = await http.get<PaginatedResponse<Campaign>>(API.campaigns.list, {
                params: filters,
            });
            return data;
        },
        // ── Optimized for real-time: ──
        // WebSocket-first strategy with disconnected fallback polling.
        staleTime: 1000 * 60 * 5,
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 60),
        refetchIntervalInBackground: false,
    });
}

export function useCampaign(id: string) {
    return useQuery({
        queryKey: queryKeys.campaigns.detail(id),
        queryFn: async () => {
            if (isDevDemoSession()) return demoGetCampaign(id);
            const { data } = await http.get<ApiResponse<Campaign>>(API.campaigns.getById(id));
            return data.data;
        },
        enabled: !!id,
        // ── Optimized for real-time: ──
        // WebSocket-first strategy with disconnected fallback polling.
        staleTime: 1000 * 60 * 5,
        refetchOnReconnect: true,
        refetchInterval: () => (ws.isConnected() ? false : 1000 * 45),
        refetchIntervalInBackground: false,
    });
}

// ── Mutations ──

/**
 * `background: true` (the builder's step autosave) marks campaign data stale without refetching
 * it on the spot. Otherwise every save fired a GET of each mounted campaign query — twice when a
 * file upload followed — for data the builder never re-reads; it refreshes on next use instead.
 */
type BackgroundOption = { background?: boolean };
const invalidateMode = (variables: BackgroundOption) =>
    variables.background ? { refetchType: 'none' as const } : {};

export function useCreateCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ background: _background, ...payload }: Partial<Campaign> & BackgroundOption) => {
            if (isDevDemoSession()) return demoCreateCampaign(payload);
            const { data } = await http.post<ApiResponse<Campaign>>(API.campaigns.create, payload);
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all, ...invalidateMode(variables) });
        },
    });
}

export function useUpdateCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, background: _background, ...payload }: Partial<Campaign> & { id: string } & BackgroundOption) => {
            if (isDevDemoSession()) return demoUpdateCampaign(id, payload);
            const { data } = await http.put<ApiResponse<Campaign>>(API.campaigns.update(id), payload);
            return data.data;
        },
        onSuccess: (_, variables) => {
            // The detail key sits under `all`, so one prefix invalidation covers both.
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all, ...invalidateMode(variables) });
        },
    });
}

export function useDeleteCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            if (isDevDemoSession()) return demoDeleteCampaign(id);
            await http.delete(API.campaigns.delete(id));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
        },
    });
}

export function useLaunchCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            if (isDevDemoSession()) return demoLaunchCampaign(id);
            const { data } = await http.post<ApiResponse<Campaign>>(API.campaigns.launch(id));
            return data.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
        },
    });
}

export function useCloseCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            if (isDevDemoSession()) return demoCloseCampaign(id);
            const { data } = await http.post<ApiResponse<Campaign>>(API.campaigns.close(id));
            return data.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
        },
    });
}

export function useUploadThumbnail() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, file }: { id: string; file: File } & BackgroundOption) => {
            if (isDevDemoSession()) return demoUploadThumbnail(id, file);
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await http.post<ApiResponse<Campaign>>(
                API.campaigns.uploadThumbnail(id),
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all, ...invalidateMode(variables) });
        },
    });
}

export function useUploadScript() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, file }: { id: string; file: File } & BackgroundOption) => {
            if (isDevDemoSession()) return demoUploadScript(id, file);
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await http.post<ApiResponse<Campaign>>(
                API.campaigns.uploadScript(id),
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all, ...invalidateMode(variables) });
        },
    });
}

export function useAssignCampaignAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, agentId }: { id: string; agentId: string | null }) => {
            if (isDevDemoSession()) return demoAssignCampaignAgent(id, agentId, demoTeamMemberName(agentId));
            const { data } = await http.patch<ApiResponse<Campaign>>(API.campaigns.assign(id), { agentId });
            return data.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
        },
    });
}

