import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import { toast } from 'sonner';
import {
    isDevDemoSession,
    demoListTeamMembers,
    demoGetTeamMember,
    demoGetTeamMemberWorkload,
    demoUpdateTeamMember,
    demoSetTeamMemberPassword,
    demoSetTeamMemberBrands,
    demoCreateTeamMember,
    demoAssignTeamMemberBrand,
    demoSetTeamMemberStatus,
    demoUnassignTeamMemberBrand,
} from '@/mocks/devTeam';

export interface TeamMemberBrand {
    id: string;
    brandName: string | null;
    brandLogoUrl: string | null;
}

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string | null;
    isActive: boolean;
    createdAt: string;
    // A team member can manage more than one brand — see useAssignTeamMemberBrand.
    brands: TeamMemberBrand[];
}

export interface CreateTeamMemberPayload {
    name: string;
    email: string;
    password: string;
    // Optional — brands can be assigned any time afterward via useAssignTeamMemberBrand.
    brandProfileIds?: string[];
}

// One campaign/program under a brand the member manages, tagged with its current assignee
// (agentId === member.id means it's assigned to this member).
export interface TeamWorkloadCampaign {
    id: string;
    name: string;
    type: string;
    status: string;
    brandId: string;
    brandName: string | null;
    thumbnailUrl: string | null;
    agentId: string | null;
    agentName: string | null;
    applicationDeadline: string | null;
    createdAt: string;
}

export interface TeamWorkloadProgram {
    id: string;
    name: string;
    status: string;
    brandId: string;
    brandName: string | null;
    thumbnailUrl: string | null;
    agentId: string | null;
    agentName: string | null;
    createdAt: string;
}

export interface TeamMemberWorkload {
    stats: {
        assignedCampaigns: number;
        activeCampaigns: number;
        assignedPrograms: number;
        brandsManaged: number;
    };
    campaigns: TeamWorkloadCampaign[];
    programs: TeamWorkloadProgram[];
}

export function useTeamMembers() {
    return useQuery<TeamMember[]>({
        queryKey: queryKeys.team.all,
        queryFn: () => (isDevDemoSession() ? demoListTeamMembers() : http.get(API.team.list).then((r) => r.data.data)),
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamMember(id: string | undefined) {
    return useQuery<TeamMember>({
        queryKey: queryKeys.team.detail(id ?? ''),
        queryFn: () => (isDevDemoSession() ? demoGetTeamMember(id!) : http.get(API.team.getById(id!)).then((r) => r.data.data)),
        enabled: !!id,
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useTeamMemberWorkload(id: string | undefined) {
    return useQuery<TeamMemberWorkload>({
        queryKey: queryKeys.team.workload(id ?? ''),
        queryFn: () => (isDevDemoSession() ? demoGetTeamMemberWorkload(id!) : http.get(API.team.workload(id!)).then((r) => r.data.data)),
        enabled: !!id,
        staleTime: 15_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

// Updates a member's editable profile fields. Email doubles as their login identifier, so
// the backend uniqueness-checks it before writing and a clash comes back as a 409.
export function useUpdateTeamMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, ...patch }: {
            managerId: string;
            name?: string;
            email?: string;
            phoneNumber?: string | null;
        }) => (isDevDemoSession()
            ? demoUpdateTeamMember(managerId, patch)
            : http.patch(API.team.update(managerId), patch).then((r) => r.data.data)),
        onSuccess: (_data, { managerId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.team.detail(managerId) });
            toast.success('Team member updated');
        },
    });
}

// Sets a member's password. No current-password field - the owner created the account and
// is acting on it. Every session that member has open is revoked server-side.
export function useSetTeamMemberPassword() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, password }: { managerId: string; password: string }) =>
            isDevDemoSession()
                ? demoSetTeamMemberPassword(managerId)
                : http.patch(API.team.setPassword(managerId), { password }).then((r) => r.data),
        onSuccess: (_data, { managerId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.detail(managerId) });
            toast.success('Password updated - the member has been signed out everywhere');
        },
    });
}

// Sets the full brand list for a team member in one call — any brand left out is
// unassigned, any newly-included one is assigned (backend does the diff).
export function useSetTeamMemberBrands() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, brandProfileIds }: { managerId: string; brandProfileIds: string[] }) =>
            isDevDemoSession()
                ? demoSetTeamMemberBrands(managerId, brandProfileIds)
                : http.patch(API.team.setBrands(managerId), { brandProfileIds }).then((r) => r.data.data),
        onSuccess: (_data, { managerId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.team.detail(managerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.team.workload(managerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all, refetchType: 'all' });
            toast.success('Brand assignments updated');
        },
    });
}

export function useCreateTeamMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateTeamMemberPayload) =>
            isDevDemoSession() ? demoCreateTeamMember(payload) : http.post(API.team.create, payload).then((r) => r.data.data),
        onSuccess: (member: TeamMember & { email: string; name: string }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            // A new member may be created already assigned to brands — refetch brand detail
            // (even if inactive) so the brand's Team section reflects it without a refresh.
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all, refetchType: 'all' });
            toast.success(`${member.name} added successfully! Credentials sent to ${member.email}.`);
        },
    });
}

// Assigns one existing team member to one brand — additive, used by BrandDetailPage's
// "assign existing user" flow.
export function useAssignTeamMemberBrand() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, brandId }: { managerId: string; brandId: string }) =>
            isDevDemoSession()
                ? demoAssignTeamMemberBrand(managerId, brandId)
                : http.post(API.team.assignBrand(managerId, brandId)).then((r) => r.data.data),
        onSuccess: (_data, { brandId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            // refetchType 'all' refetches even a brand-detail query that isn't the active
            // observer at this moment (e.g. behind the open modal), so the brand's Team
            // section updates without a manual page refresh.
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all, refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId), refetchType: 'all' });
            toast.success('Team member assigned to this brand');
        },
    });
}

// Whole-account activate/deactivate for a team member — brand assignments are kept, but a
// deactivated member can no longer log in or refresh their session (their live session
// dies once the short-lived access token expires; the backend also revokes their
// refresh tokens). Distinct from unassigning them from one brand.
export function useSetTeamMemberStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, isActive }: { managerId: string; isActive: boolean; brandId?: string }) =>
            isDevDemoSession()
                ? demoSetTeamMemberStatus(managerId, isActive)
                : http.patch(API.team.setStatus(managerId), { isActive }).then((r) => r.data.data),
        onSuccess: (_data, { isActive, brandId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            if (brandId) queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId) });
            toast.success(isActive ? 'Team member account reactivated' : 'Team member account deactivated');
        },
    });
}

export function useUnassignTeamMemberBrand() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ managerId, brandId }: { managerId: string; brandId: string }) =>
            isDevDemoSession()
                ? demoUnassignTeamMemberBrand(managerId, brandId).then(() => undefined)
                : http.delete(API.team.unassignBrand(managerId, brandId)).then(() => undefined),
        onSuccess: (_data, { brandId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all, refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId), refetchType: 'all' });
            toast.success('Team member removed from this brand');
        },
    });
}
