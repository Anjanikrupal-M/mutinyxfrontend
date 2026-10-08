import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Megaphone,
    MessageCircle,
    Settings,
    UserSearch,
    LifeBuoy,
    Layers,
    Building2,
    Crown,
    Users,
    LockKeyhole,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { MutinyXLogo } from '@/shared/components/MutinyXLogo';

import { useConversations, useConversationListRealtime } from '@/modules/messages/hooks/useMessages';
import { useAuthStore } from '@/shared/stores/authStore';
import { useSidebarStore } from '@/shared/stores/sidebarStore';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';

const MAIN_NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/discover', label: 'Influencers', icon: UserSearch },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/programs', label: 'Programs', icon: Layers },
    { to: '/messages', label: 'Messages', icon: MessageCircle },
];

// Only shown to brand_owners on the Agencies plan — see isAgencyOwner in Sidebar()
const CLIENT_BRANDS_NAV_ITEM = { to: '/brands', label: 'Brands', icon: Building2 };

// Only shown to brand_owners — see isBrandOwner in Sidebar()
const TEAMS_NAV_ITEM = { to: '/teams', label: 'Teams', icon: Users };

// Only shown to brand_owner/agent — see isBrandOrAgent in Sidebar()
const SUBSCRIPTION_NAV_ITEM = { to: '/subscription', label: 'Subscription', icon: Crown };

const BOTTOM_NAV_ITEMS = [
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/support', label: 'Support', icon: LifeBuoy },
];

// Returns the number of days until a date string, or null if no date.
function daysUntil(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface SidebarProps {
    /**
     * 'default' — full-height rail on every page.
     * 'dock'    — floating rounded dock under the top bar, icon + its name; widens on hover.
     *             Pairs with Topbar variant 'dock' (campaign builder).
     */
    variant?: 'default' | 'dock';
}

export function Sidebar({ variant = 'default' }: SidebarProps) {
    // Hover state is published to the store (not local) so full-bleed pages can inset
    // themselves out from under the rail as it expands (Messages does this).
    const isHovered = useSidebarStore((s) => s.expanded);
    const setIsHovered = useSidebarStore((s) => s.setExpanded);
    const location = useLocation();
    const { data: conversations = [] } = useConversations();
    const currentUser = useAuthStore((state) => state.user);

    // "Advanced Support" label is a Brand+Agencies plan perk (see SupportPage's Priority Support card)
    const isBrandOrAgent = currentUser?.role === 'brand_owner' || currentUser?.role === 'agent';
    const { isAgencyOwner, isManager, isBrandOwner } = useIsAgencyOwner();
    const { data: subscription } = useCurrentSubscription(isBrandOrAgent);
    const isPriorityPlan = subscription?.plan === 'brand' || subscription?.plan === 'agency';
    const isFreePlanNav = isBrandOwner && subscription?.plan === 'free';

    // Show expiry warning when plan is paid and expires within 7 days
    const daysLeft = daysUntil(subscription?.currentPeriodEnd);
    const isSubscriptionExpiringSoon =
        subscription?.plan !== 'free' &&
        subscription?.status === 'active' &&
        daysLeft !== null &&
        daysLeft <= 7 &&
        daysLeft >= 0;

    // Managers have no subscription of their own — billing lives with the agency head.
    const bottomNavItems = (
        isBrandOrAgent && !isManager 
            ? [SUBSCRIPTION_NAV_ITEM, ...BOTTOM_NAV_ITEMS] 
            : BOTTOM_NAV_ITEMS
    ).map((item) =>
        item.to === '/support' && isBrandOrAgent && isPriorityPlan
            ? { ...item, label: 'Advanced Support' }
            : item
    );

    // Team management is a brand-owner perk (managers/agents don't invite team members);
    // the icon swaps to a lock while on the free plan, matching the Subscription treatment.
    const teamsNavItem = isFreePlanNav ? { ...TEAMS_NAV_ITEM, icon: LockKeyhole } : TEAMS_NAV_ITEM;

    // Multi-client-brand management is an agency-head-only perk (agents and managers
    // never create/assign brands — a manager only switches between their own assignments).
    const mainNavItems = [
        ...MAIN_NAV_ITEMS,
        ...(isBrandOwner ? [teamsNavItem] : []),
        ...(isAgencyOwner ? [CLIENT_BRANDS_NAV_ITEM] : []),
    ];

    // Globally listen to new messages and update unread dot proactively!
    // Extracting the conversation ID from url if we are actively viewing a message screen:
    const activeConversationId = location.pathname.startsWith('/messages/') ? location.pathname.split('/')[2] : null;
    useConversationListRealtime(activeConversationId);

    // Calculate total unread messages with compatibility across backend shapes.
    const totalUnread = conversations.reduce((sum, conv) => {
        const asNumbers = conv as unknown as {
            unreadCount?: number;
            unread?: number;
            brandUnread?: number;
            influencerUnread?: number;
        };

        const isBrandSide = currentUser?.role === 'brand_owner' || currentUser?.role === 'agent';
        const unreadRaw = isBrandSide
            ? asNumbers.brandUnread ?? asNumbers.unreadCount ?? asNumbers.unread ?? 0
            : asNumbers.influencerUnread ?? asNumbers.unreadCount ?? asNumbers.unread ?? 0;

        const unread = typeof unreadRaw === 'number' ? unreadRaw : Number(unreadRaw) || 0;
        return sum + unread;
    }, 0);

    const renderNavItem = (item: { to: string; label: string; icon: any }) => {
        const isActive =
            location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to));

        const hasUnread = item.to === '/messages' && totalUnread > 0;
        const isSubscriptionItem = item.to === '/subscription';
        const isExpiring = isSubscriptionItem && isSubscriptionExpiringSoon;
        // Subscription is a premium upsell entry — it stays gold-glowing at all times
        // (not just on hover/active) to keep it noticeable. Expiry state still wins with orange.
        const isGlowing = isSubscriptionItem && !isExpiring;

        return (
            <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsHovered(false)}
                title={isExpiring ? `Plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : undefined}
                className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 group relative',
                    isActive
                        ? 'bg-[#fedc03]/15 text-sidebar-foreground'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    hasUnread && !isActive && 'text-[#fedc03]',
                    // Persistent gold glow for the Subscription upsell entry
                    isGlowing && '!text-sidebar-foreground bg-[#fedc03]/15',
                    isExpiring && '!text-orange-400'
                )}
            >
                {/* Gold accent indicator */}
                {isActive && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-[4px] h-6 rounded-r-md bg-[#fedc03] shadow-[0_0_8px_rgba(254,220,3,0.6)]" />
                )}
                <item.icon className={cn(
                    'w-5 h-5 shrink-0',
                    // Active item takes the rail's ink — the gold left-accent bar + tinted
                    // pill already signal "selected"; the icon itself no longer turns yellow.
                    isActive && 'text-sidebar-foreground',
                    hasUnread && !isActive && 'text-[#fedc03]',
                    // Subscription crown glows gold permanently (no hover needed).
                    isGlowing && '!text-[#fedc03] drop-shadow-[0_0_6px_rgba(254,220,3,0.7)]',
                    isExpiring && '!text-orange-400',
                    isExpiring && 'group-hover:drop-shadow-[0_0_6px_rgba(251,146,60,0.55)]'
                )} />
                {/* Unread badge for messages / expiry badge for subscription */}
                {(hasUnread || isExpiring) && (
                    <span className={cn(
                        "absolute top-2.5 right-2.5 w-2.5 h-2.5 border-2 border-sidebar rounded-full",
                        isExpiring ? 'bg-orange-500' : 'bg-[#fedc03]'
                    )} />
                )}
                <span className={cn(
                    "transition-opacity duration-150 whitespace-nowrap",
                    isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}>
                    {item.label}
                </span>
            </NavLink>
        );
    };

    if (variant === 'dock') {
        const renderDockItem = (item: { to: string; label: string; icon: typeof LayoutDashboard }) => {
            const isActive =
                location.pathname === item.to ||
                (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
            const hasUnread = item.to === '/messages' && totalUnread > 0;
            const isSubscriptionItem = item.to === '/subscription';
            const isExpiring = isSubscriptionItem && isSubscriptionExpiringSoon;
            const Icon = item.icon;
            // Subscription is the highlighted upsell: brand-coloured icon and label with a dot.
            const dotClass = cn('h-1.5 w-1.5 rounded-full', isSubscriptionItem ? 'bg-orange-500' : 'bg-brand');
            const showDot = isSubscriptionItem || hasUnread;

            return (
                <li key={item.to} className="relative px-1.5">
                    {isActive && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand" />}
                    <NavLink
                        to={item.to}
                        aria-label={item.label}
                        onClick={() => setIsHovered(false)}
                        title={isExpiring ? `Plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : undefined}
                        className={cn(
                            'flex h-[50px] w-full items-center rounded-2xl text-left transition-colors',
                            isActive
                                ? 'bg-sidebar-accent text-sidebar-foreground'
                                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                    >
                        <span className="relative flex h-[50px] w-[60px] shrink-0 flex-col items-center justify-center gap-[3px]">
                            <Icon className={cn('h-[19px] w-[19px] stroke-[1.75]', isSubscriptionItem && 'text-brand')} />
                            {/* Same name as the expanded label, so a section is called one thing everywhere. Tight
                                tracking fits "Subscription"; two-word names wrap onto a second line. */}
                            <span className="max-w-[58px] text-center text-[9px] font-medium leading-[10px] tracking-tight group-hover/sidebar:hidden">{item.label}</span>
                            {showDot && <span className={cn(dotClass, 'absolute right-[15px] top-2 group-hover/sidebar:hidden')} />}
                        </span>
                        <span
                            className={cn(
                                'whitespace-nowrap text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100',
                                isSubscriptionItem && 'text-brand',
                            )}
                        >
                            {item.label}
                        </span>
                        {showDot && <span className={cn(dotClass, 'ml-auto mr-3.5 hidden group-hover/sidebar:block')} />}
                    </NavLink>
                </li>
            );
        };

        return (
            // A floating dock: detached from the edges and rounded, not a full-height wall.
            <aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group/sidebar fixed bottom-3 left-3 top-[76px] z-40 hidden w-[72px] flex-col overflow-hidden rounded-3xl bg-sidebar shadow-float transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:w-60 md:flex"
            >
                <nav className="flex flex-1 flex-col justify-between overflow-y-auto overflow-x-hidden py-2 scrollbar-hide">
                    <ul className="space-y-0.5">{mainNavItems.map(renderDockItem)}</ul>
                    <ul className="space-y-0.5 border-t border-sidebar-border pt-2">{bottomNavItems.map(renderDockItem)}</ul>
                </nav>
            </aside>
        );
    }

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'hidden md:flex fixed left-0 top-0 z-[100] h-screen bg-sidebar border-r border-sidebar-border flex-col shadow-[4px_0_24px_-8px_rgba(0,0,0,0.22)] transition-[width] duration-300 ease-in-out',
                isHovered ? 'w-[240px]' : 'w-[68px]'
            )}
        >
            {/* Logo */}
            <NavLink
                to="/dashboard"
                className="flex items-center h-16 border-b border-sidebar-border shrink-0 overflow-hidden hover:opacity-90 transition-opacity"
            >
                <div className={cn(
                    "transition-all duration-300 ease-in-out flex items-center",
                    isHovered ? "w-[240px] justify-start pl-5" : "w-[68px] justify-center"
                )}>
                    {isHovered ? (
                        <MutinyXLogo variant="plain" className="h-5 transition-all duration-300" />
                    ) : (
                        <img
                            src="/favicon.svg"
                            alt="MutinyX"
                            className="h-7 w-7 object-contain transition-all duration-300"
                        />
                    )}
                </div>
            </NavLink>

            {/* Main Nav */}
            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
                {mainNavItems.map(renderNavItem)}
            </nav>

            {/* Bottom Nav */}
            <div className="py-3 px-2 space-y-0.5 border-t border-sidebar-border">
                {bottomNavItems.map(renderNavItem)}
            </div>
        </aside>
    );
}
