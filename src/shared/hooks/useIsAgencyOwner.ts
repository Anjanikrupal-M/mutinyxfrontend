// An "agency owner" (agency head) is a brand_owner on the Agencies plan who is not
// themselves a manager — see backend shared/access/brandAccess.ts isAgencyHead for the
// server-side equivalent. Centralizes a check that used to be independently re-derived
// (with a special case for a head temporarily acting as a manager) in Topbar, Sidebar,
// ProfilePage, BrandsPage, and CreateBrandPage — now that switching brands never changes
// the caller's own identity, there's no special case left to carry.
import { useAuthStore } from '@/shared/stores/authStore';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';

export interface AgencyOwnerStatus {
    isBrandOwner: boolean;
    // A brand manager — created by an agency head, scoped to assigned brands only.
    isManager: boolean;
    isAgencyOwner: boolean;
}

export function useIsAgencyOwner(): AgencyOwnerStatus {
    const user = useAuthStore((s) => s.user);
    const isBrandOwner = user?.role === 'brand_owner';
    const isManager = isBrandOwner && !!user?.agencyHeadId;
    const { data: subscription } = useCurrentSubscription(isBrandOwner);
    const isAgencyOwner = isBrandOwner && !isManager && subscription?.plan === 'agency';

    return { isBrandOwner, isManager, isAgencyOwner };
}
