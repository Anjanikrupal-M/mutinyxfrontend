import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/shared/stores/authStore';
import { getMissingBrandProfileItems, isBrandProfileComplete } from '@/core/guards';

/**
 * Action-level companion to ProfileCompleteGuard for brand actions that live behind
 * buttons/modals rather than routes (program create, creator invite/connect, …).
 *
 * Usage:
 *   const { requireCompleteProfile } = useProfileGate();
 *   const onClick = () => { if (!requireCompleteProfile()) return; ...proceed... };
 *
 * Returns true when the action may proceed; otherwise toasts and redirects the
 * user to /profile?incomplete=1. Non-brand_owner roles always pass (mirrors the
 * route guard).
 */
export function useProfileGate() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();

    const isComplete = user?.role !== 'brand_owner' || isBrandProfileComplete(user);

    const requireCompleteProfile = (): boolean => {
        if (isComplete) return true;
        // Name what's actually missing rather than assuming the social account — the gap is
        // often just the brand logo, and a hardcoded "social account" message misleads.
        const missing = getMissingBrandProfileItems(user);
        toast.error(
            missing.length > 0
                ? `Complete your brand profile to continue — missing: ${missing.join(', ')}.`
                : 'Complete your brand profile to continue.',
        );
        navigate('/profile?incomplete=1');
        return false;
    };

    return { isComplete, requireCompleteProfile };
}
