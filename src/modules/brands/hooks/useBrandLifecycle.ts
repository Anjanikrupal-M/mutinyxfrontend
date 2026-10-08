import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import { isDevDemoSession, demoListDeactivatedBrands, demoSetBrandActive } from '@/mocks/devBrands';

// Soft deactivation of a client brand (owner-only). A deactivated brand drops out of
// everyone's accessible set on the backend — owner operations, assigned managers, and
// scoped agents all lose access — but campaigns/payments/history are kept, and
// reactivating restores everything. The backend refuses to deactivate the owner's
// only active brand.

export interface DeactivatedBrand {
    id: string;
    brandName: string;
    brandLogoUrl: string | null;
    industry: string | null;
    deactivatedAt: string;
    createdAt: string;
}

export function useDeactivatedBrands(enabled = true) {
    return useQuery<DeactivatedBrand[]>({
        queryKey: queryKeys.brandProfiles.deactivated,
        queryFn: () => (isDevDemoSession() ? demoListDeactivatedBrands() : http.get(API.brandProfiles.deactivatedList).then((r) => r.data.data)),
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        enabled,
    });
}

function invalidateBrandLists(queryClient: ReturnType<typeof useQueryClient>) {
    queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.overview });
    queryClient.invalidateQueries({ queryKey: queryKeys.brandProfiles.deactivated });
}

export function useDeactivateBrand() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (brandId: string) =>
            isDevDemoSession() ? demoSetBrandActive(brandId, false) : http.post(API.brandProfiles.deactivate(brandId)).then((r) => r.data.data),
        onSuccess: () => invalidateBrandLists(queryClient),
    });
}

export function useReactivateBrand() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (brandId: string) =>
            isDevDemoSession() ? demoSetBrandActive(brandId, true) : http.post(API.brandProfiles.reactivate(brandId)).then((r) => r.data.data),
        onSuccess: () => invalidateBrandLists(queryClient),
    });
}
