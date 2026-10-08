// ─────────────────────────────────────────────────────────────
// Programs Hooks — TanStack Query hooks for the Programs feature
// All calls go to /api/v2/programs
// ─────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '@/core/http';
import { API, WS_EVENTS } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import ws from '@/core/websocket';
import type { ApiResponse, PaginatedResponse } from '@/core/types';
import type { Program, ProgramEnrollment } from '@/shared/types/campaign';
import {
    isDevDemoSession,
    demoListPrograms,
    demoGetProgram,
    demoListEnrollments,
    demoCreateProgram,
    demoUpdateProgram,
    demoAssignProgramAgent,
    demoDeleteProgram,
    demoReviewEnrollment,
    demoInviteFromEnrollment,
    demoUploadProgramThumbnail,
} from '@/mocks/devPrograms';
import { demoTeamMemberName } from '@/mocks/devTeam';

interface ProgramFilters {
    [key: string]: any;
    status?: string;
    page?:   number;
    limit?:  number;
}

// ── Queries ──────────────────────────────────────────────────

export function usePrograms(filters?: ProgramFilters) {
    return useQuery({
        queryKey: queryKeys.programs.list(filters),
        queryFn: async () => {
            if (isDevDemoSession()) return demoListPrograms(filters);
            const { data } = await http.get<PaginatedResponse<Program>>(API.programs.list, {
                params: filters,
            });
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useProgram(id: string) {
    return useQuery({
        queryKey: queryKeys.programs.detail(id),
        queryFn: async () => {
            if (isDevDemoSession()) return demoGetProgram(id);
            const { data } = await http.get<ApiResponse<Program>>(API.programs.getById(id));
            return data.data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
}

export function useEnrollments(programId: string) {
    return useQuery({
        queryKey: queryKeys.programs.enrollments(programId),
        queryFn: async () => {
            if (isDevDemoSession()) return demoListEnrollments(programId);
            const { data } = await http.get<ApiResponse<ProgramEnrollment[]>>(
                API.programs.enrollments.list(programId)
            );
            return data.data ?? [];
        },
        enabled: !!programId,
        staleTime: 1000 * 60,
    });
}

/**
 * Refreshes program data when an influencer enrols. Program queries have a multi-minute
 * staleTime, so without this a new enrollment stayed invisible until a manual reload —
 * the bell would light up while the list still showed the old count.
 * Mount on any screen that displays enrollment counts or the enrollment list.
 */
export function useProgramEnrollmentRealtime(programId?: string) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const onEnrollment = () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
            if (programId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.programs.enrollments(programId) });
            }
        };

        ws.on(WS_EVENTS.PROGRAM_ENROLLMENT_RECEIVED, onEnrollment);
        return () => {
            ws.off(WS_EVENTS.PROGRAM_ENROLLMENT_RECEIVED, onEnrollment);
        };
    }, [queryClient, programId]);
}

// ── Mutations ─────────────────────────────────────────────────

export function useCreateProgram() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            name: string;
            description?: string;
            brief?: string;
            niches?: string[];
            enrollmentOpen?: boolean;
        }) => {
            if (isDevDemoSession()) return demoCreateProgram(payload);
            const { data } = await http.post<ApiResponse<Program>>(API.programs.create, payload);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
        },
    });
}

export function useUpdateProgram() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...payload }: {
            id: string;
            name?: string;
            description?: string;
            brief?: string;
            niches?: string[];
            enrollmentOpen?: boolean;
            status?: string;
        }) => {
            if (isDevDemoSession()) return demoUpdateProgram(id, payload);
            const { data } = await http.patch<ApiResponse<Program>>(API.programs.update(id), payload);
            return data.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
        },
    });
}

// Assign or reassign a program to a team member (agentId === null hands it back to the
// brand owner). Mirrors useAssignCampaignAgent.
export function useAssignProgramAgent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, agentId }: { id: string; agentId: string | null }) => {
            if (isDevDemoSession()) return demoAssignProgramAgent(id, agentId, demoTeamMemberName(agentId));
            const { data } = await http.patch<ApiResponse<Program>>(API.programs.assign(id), { agentId });
            return data.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
        },
    });
}

export function useDeleteProgram() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            if (isDevDemoSession()) return demoDeleteProgram(id);
            await http.delete(API.programs.delete(id));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
        },
    });
}

// ── Enrollment Mutations ──────────────────────────────────────

export function useEnrollInProgram() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ programId, note }: { programId: string; note?: string }) => {
            const { data } = await http.post(API.programs.enrollments.enroll(programId), { note });
            return data;
        },
        onSuccess: (_, { programId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.enrollments(programId) });
        },
    });
}

export function useReviewEnrollment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            programId,
            enrollmentId,
            status,
        }: {
            programId:    string;
            enrollmentId: string;
            status:       'accepted' | 'rejected';
        }) => {
            if (isDevDemoSession()) return demoReviewEnrollment(programId, enrollmentId, status);
            const { data } = await http.patch(
                API.programs.enrollments.review(programId, enrollmentId),
                { status }
            );
            return data;
        },
        onSuccess: (_, { programId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.enrollments(programId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) });
        },
    });
}

export function useInviteFromEnrollment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            programId,
            enrollmentId,
            campaignId,
            tierRate,
        }: {
            programId:    string;
            enrollmentId: string;
            campaignId:   string;
            tierRate?:    number;
        }) => {
            if (isDevDemoSession()) return demoInviteFromEnrollment(programId, enrollmentId, campaignId);
            const { data } = await http.post(
                API.programs.enrollments.invite(programId, enrollmentId),
                { campaignId, tierRate }
            );
            return data;
        },
        onSuccess: (_, { programId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.enrollments(programId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) });
        },
    });
}

export function useUploadProgramThumbnail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, file }: { id: string; file: File }) => {
            if (isDevDemoSession()) return demoUploadProgramThumbnail(id, file);
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await http.post<{ thumbnailUrl: string }>(
                API.programs.thumbnail(id),
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            return data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.list() });
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
        },
    });
}
