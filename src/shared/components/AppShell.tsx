import { Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomTabBar } from './BottomTabBar';
import { CampaignRoomSync } from './CampaignRoomSync';
import { useAuthStore } from '@/shared/stores/authStore';

// A manager can end up with zero assigned brands (e.g. unassigned mid-session, or
// never assigned one) — every brand-scoped route (campaigns, programs, messages,
// analytics...) would otherwise 403 immediately after login, so this waits them at
// the door with a clear explanation instead.
function NoBrandAssignedNotice() {
    return (
        <div className="max-w-md mx-auto mt-16 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold font-display mb-1.5">No brand assigned yet</h2>
            <p className="text-sm text-muted-foreground">
                Your agency hasn't assigned you a brand to manage yet. You'll get full access to campaigns,
                messages, and analytics as soon as a brand is assigned to your account.
            </p>
        </div>
    );
}

export function AppShell() {
    const user = useAuthStore((s) => s.user);
    const isBrandlessTeamMember = user?.role === 'brand_owner' && !!user?.agencyHeadId && !user?.brandId;

    return (
        // overflow-x-CLIP, not hidden: `hidden` turns this div into a scroll container (overflow-y
        // computes to auto), and because it never scrolls itself every position:sticky below it
        // (Topbar, the campaign builder's stepper and live preview) silently stopped sticking.
        <div className="relative min-h-screen w-full flex flex-col bg-background overflow-x-clip">
            {/* Sidebar: hidden on mobile, visible on md+ */}
            {/* White backing behind the floating rail so its gutter matches the white Topbar */}
            <div className="hidden md:block fixed left-0 top-0 z-[99] h-screen w-[80px] bg-white" />
            <Sidebar />

            {/* Main content: desktop uses fixed sidebar offset (mini-width) */}
            <div className="md:pl-[80px]">
                <Topbar />
                {/* Bottom padding must clear the fixed overlays at full scroll:
                    mobile = BottomTabBar (64px) + ScrollToTop above it (ends ~136px);
                    desktop = ScrollToTop at bottom-6 (ends ~64px). */}
                <main className="p-4 md:p-6 pb-36 md:pb-20">
                    {isBrandlessTeamMember ? <NoBrandAssignedNotice /> : <Outlet />}
                </main>
            </div>

            {/* Bottom tab bar: mobile only, md:hidden inside component */}
            <BottomTabBar />
        </div>
    );
}
