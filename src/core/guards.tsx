import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';

export function AuthGuard() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <Outlet />;
}

/**
 * A brand profile is "complete" once the identity fields are filled AND at least one
 * social account is linked (socialConnected — anchored on the brand owner-of-record,
 * so managers aren't blocked by their own unlinked account). The social check uses
 * `!== false` deliberately: sessions persisted before the flag existed have it
 * undefined until the next /me refresh, and must not be falsely blocked.
 */
type BrandProfileFields = {
    brandName?: string;
    industry?: string;
    brandLogoUrl?: string;
    socialConnected?: boolean;
} | null;

/**
 * The specific things still missing from a brand profile, in display order. Empty means
 * complete. Shared by ProfilePage (the warning list) and useProfileGate (the action toast)
 * so the user is always told what's actually missing — never a hardcoded, possibly-wrong
 * reason. Social uses `!== false` for the same reason isBrandProfileComplete does.
 */
export function getMissingBrandProfileItems(user: BrandProfileFields): string[] {
    return [
        !user?.brandName?.trim() && 'brand name',
        !user?.industry?.trim() && 'industry',
        !user?.brandLogoUrl?.trim() && 'brand logo',
        user?.socialConnected === false && 'at least one connected social account',
    ].filter(Boolean) as string[];
}

export function isBrandProfileComplete(user: BrandProfileFields): boolean {
    if (!user) return false;
    return getMissingBrandProfileItems(user).length === 0;
}

export function ProfileCompleteGuard() {
    const user = useAuthStore((s) => s.user);
    const isHydrated = useAuthStore((s) => s.isHydrated);

    if (!isHydrated) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'brand_owner') return <Outlet />;

    if (!isBrandProfileComplete(user)) return <Navigate to="/profile?incomplete=1" replace />;

    return <Outlet />;
}