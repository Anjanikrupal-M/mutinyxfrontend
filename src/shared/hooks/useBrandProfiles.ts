// ─────────────────────────────────────────────────────────────
// Brand profiles — list/create/switch the active brand across every brand the caller
// owns (Agencies plan) or is assigned to manage (see backend brand_managers). Switching
// only changes which brand is active — the caller's own identity never changes.
// Shared between Topbar (switcher dropdown), ProfilePage (switcher select) and
// BrandsPage/Sidebar (create + manage).
// ─────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import { useAuthStore } from '@/shared/stores/authStore';
import type { User } from '@/shared/stores/authStore';
import { useNotificationStore } from '@/shared/stores/notificationStore';
import { isDevDemoSession, demoListBrandProfiles, demoSwitchBrand, demoCreateBrandProfile } from '@/mocks/devBrands';

export interface BrandProfileSummary {
    id: string;
    brandName: string;
    brandLogoUrl: string | null;
    industry: string | null;
    contactEmail: string | null;
    createdAt: string;
    isActive: boolean;
    // 'owned' when the caller is this brand's owner of record; 'managed' when the caller
    // is an assigned manager (see backend brand.service.ts listMyBrandProfiles and
    // shared/access/brandAccess.ts). A brand can have multiple managers (co-management),
    // so this reflects the caller's own relation to it, not the brand's only relation.
    relation: 'owned' | 'managed';
    // Present only when relation === 'managed' — the brand's owner of record.
    ownerName?: string;
}

// The list is always earliest-created first (see backend listMyBrandProfiles), so the
// first owned entry is the brand the caller actually signed up with — every other owned
// one is a client brand created afterward on the Agencies plan.
export function getBrandRoleLabel(brand: BrandProfileSummary, index: number): string {
    if (brand.relation === 'managed') return brand.ownerName ? `Managed for ${brand.ownerName}` : 'Managed';
    return index === 0 ? 'Your brand' : 'Brand';
}

interface SwitchBrandResponse {
    user: User;
    accessToken?: string;
}

// Applies a switch/create response to the store without clobbering the refresh
// token (these endpoints reissue only the access token, not a new session).
function applyBrandSwitch(user: User, accessToken?: string) {
    const { setUser, refreshToken } = useAuthStore.getState();
    setUser(user, accessToken ?? useAuthStore.getState().token, refreshToken);

    // Agencies share one socket/userId across all client brands, so notifications
    // for the brand we're leaving can already be sitting in the local store.
    // Wipe it now — the brand-scoped refetch below repopulates it for the new brand.
    useNotificationStore.getState().setNotifications([]);
}

export function useBrandProfiles(enabled: boolean) {
    return useQuery<BrandProfileSummary[]>({
        queryKey: queryKeys.brandProfiles.all,
        queryFn: () => (isDevDemoSession() ? demoListBrandProfiles() : http.get(API.brandProfiles.list).then((r) => r.data.data)),
        enabled,
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useSwitchBrand() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    return useMutation({
        onMutate: () => {
            useAuthStore.getState().setIsSwitchingBrand(true);
        },
        mutationFn: (brandId: string): Promise<SwitchBrandResponse> =>
            isDevDemoSession()
                ? demoSwitchBrand(brandId)
                : http.post(API.auth.switchBrand, { brandId }).then((r) => r.data.data as SwitchBrandResponse),
        onSuccess: async ({ user, accessToken }) => {
            applyBrandSwitch(user, accessToken);
            queryClient.setQueryData(queryKeys.auth.me, user);
            // Navigate directly to dashboard after brand switch
            navigate('/dashboard');
            // Await API refetches for the newly active brand on /dashboard before hiding the loader
            await queryClient.invalidateQueries();
        },
        onSettled: () => {
            useAuthStore.getState().setIsSwitchingBrand(false);
        },
    });
}

export function useCreateBrandProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: {
            brandName: string;
            industry?: string;
            contactEmail?: string;
            website?: string;
            city?: string;
            state?: string;
            pincode?: string;
            primaryLanguage?: string;
            bio?: string;
        }) => (isDevDemoSession() ? demoCreateBrandProfile(payload) : http.post(API.brandProfiles.create, payload).then((r) => r.data.data)),
        onSuccess: () => {
            // Creating a brand no longer switches the session into it — the agency stays on
            // its active brand. Just refresh the lists so the new brand shows up.
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.overview });
        },
    });
}
