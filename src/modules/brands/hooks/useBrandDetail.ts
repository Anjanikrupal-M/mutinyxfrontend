import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import { isDevDemoSession, demoGetBrandDetail, demoUpdateBrandDetail, demoUploadBrandLogo, demoDeleteBrandLogo } from '@/mocks/devBrands';

export interface BrandDetailOwner {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
}

export interface BrandDetailCampaignStats {
    campaignCount: number;
    activeCampaignCount: number;
    totalBudget: number;
    totalSpent: number;
}

export interface BrandDetailCampaign {
    id: string;
    name: string;
    status: string;
    budgetTotal: number;
    createdAt: string;
}

export interface BrandDetail {
    id: string;
    brandName: string;
    brandLogoUrl: string | null;
    industry: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    primaryLanguage: string | null;
    bio: string | null;
    contactEmail: string | null;
    socialLinks?: {
        instagram?: string;
        youtube?: string;
    };
    createdAt: string;
    // The caller's own relation to this brand — 'owned' for the agency head, 'managed'
    // for an assigned manager (see backend brand.service.ts getBrandDetail).
    relation: 'owned' | 'managed';
    // The brand's owner of record.
    owner: BrandDetailOwner | null;
    // Every manager currently assigned — a brand can have more than one (co-management).
    managers: BrandDetailOwner[];
    campaignStats: BrandDetailCampaignStats;
    // Most recent 5 campaigns, newest first.
    recentCampaigns: BrandDetailCampaign[];
}

export type UpdateBrandDetailPayload = Partial<
    Pick<BrandDetail, 'brandName' | 'industry' | 'website' | 'city' | 'state' | 'pincode' | 'primaryLanguage' | 'bio' | 'contactEmail' | 'socialLinks'>
>;

// View/edit any brand under the agency head's account — their own, or one handed off to
// a client owner — without switching identity into it (see BrandDetailPage.tsx).
export function useBrandDetail(brandId: string | undefined) {
    return useQuery<BrandDetail>({
        queryKey: queryKeys.brandProfiles.detail(brandId ?? ''),
        queryFn: () => (isDevDemoSession() ? demoGetBrandDetail(brandId!) : http.get(API.brandProfiles.getById(brandId!)).then((r) => r.data.data)),
        enabled: !!brandId,
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useUpdateBrandDetail(brandId: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateBrandDetailPayload) =>
            isDevDemoSession()
                ? demoUpdateBrandDetail(brandId!, payload)
                : http.put(API.brandProfiles.update(brandId!), payload).then((r) => r.data.data),
        onSuccess: () => {
            // The update response is a partial brand-fields-only shape (no owner/managers/
            // campaignStats) — invalidate and let the next render refetch the full detail
            // rather than clobbering the richer cached shape with a partial one.
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId ?? '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.overview });
        },
    });
}

export function useUploadBrandDetailLogo(brandId: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => {
            if (isDevDemoSession()) return demoUploadBrandLogo(brandId!, file);
            const formData = new FormData();
            formData.append('avatar', file);
            return http.post(API.brandProfiles.uploadAvatar(brandId!), formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then((r) => r.data.data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId ?? '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all });
        },
    });
}

export function useDeleteBrandDetailLogo(brandId: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => (isDevDemoSession() ? demoDeleteBrandLogo(brandId!) : http.delete(API.brandProfiles.deleteAvatar(brandId!)).then(() => undefined)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.detail(brandId ?? '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all });
        },
    });
}
