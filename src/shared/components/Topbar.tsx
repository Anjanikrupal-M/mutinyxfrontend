import { useEffect, useRef, useState } from 'react';
import { Bell, User, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { useNotificationStore } from '@/shared/stores/notificationStore';
import { useAuthStore } from '@/shared/stores/authStore';
import { MutinyXLogo } from '@/shared/components/MutinyXLogo';
import { useLogout } from '@/shared/hooks/useAuth';
import { useBrandProfiles, useSwitchBrand } from '@/shared/hooks/useBrandProfiles';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { ApiImage } from '@/shared/components/ApiImage';
import ws from '@/core/websocket';
import { WS_EVENTS } from '@/core/api';
import type { Notification } from '@/shared/stores/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryKeys';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * In the 'dock' layout the page in view can render into this part of the top bar
 * (via a portal), so its progress stays visible while the page scrolls. Used by the
 * campaign builder.
 */
export const TOPBAR_SLOT_ID = 'topbar-slot';

interface TopbarProps {
    /**
     * 'default' — white bar beside the full-height sidebar (every page).
     * 'dock'    — bar on the page colour with the logo on the left, a centre slot and
     *             pill-shaped controls; pairs with the floating sidebar dock.
     */
    variant?: 'default' | 'dock';
}

export function Topbar({ variant = 'default' }: TopbarProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { unreadCount } = useNotificationStore();
    const setNotifications = useNotificationStore((s) => s.setNotifications);
    const { user } = useAuthStore();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const logoutMutation = useLogout();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const { data: notificationsData } = useNotifications({ page: 1, limit: 50 });
    const avatarSrc = user?.role === 'influencer' ? (user?.avatarUrl || user?.brandLogoUrl) : user?.brandLogoUrl;

    // A manager may be assigned several brands and switches between only those; an
    // agency head switches between every brand they own. Fetch the list for either case.
    const { isAgencyOwner, isManager } = useIsAgencyOwner();

    const { data: brandProfiles = [] } = useBrandProfiles(isAgencyOwner || isManager);
    const showBrandSwitcher = isAgencyOwner ? brandProfiles.length > 0 : brandProfiles.length > 1;
    const { mutate: switchBrand, isPending: isSwitchingBrandMutation } = useSwitchBrand();
    const isGlobalSwitchingBrand = useAuthStore((s) => s.isSwitchingBrand);
    const isSwitchingBrand = isSwitchingBrandMutation || isGlobalSwitchingBrand;

    // Sync notifications into Zustand so the is accurate everywhere.
    useEffect(() => {
        if (!notificationsData) return;

        const apiList = notificationsData.data ?? [];
        const currentStore = useNotificationStore.getState().notifications;
        const localById = new Map(currentStore.map((n) => [n.id, n]));

        // Reconcile server payload with local WS updates so stale API unread counts
        // do not overwrite optimistic/local realtime increments.
        const merged = apiList.map((serverNotification) => {
            const local = localById.get(serverNotification.id);
            if (!local) return serverNotification;

            return {
                ...serverNotification,
                isRead: local.isRead || serverNotification.isRead,
            };
        });

        // Keep a local-only entry (arrived via WS, not yet reflected by this API
        // response) only if it's very recent — otherwise a notification for a brand
        // the user has since switched away from (Agencies share one socket across
        // client brands) would get resurrected forever, since a correctly brand-scoped
        // refetch will never include it.
        const LOCAL_ONLY_GRACE_MS = 30_000;
        const now = Date.now();
        for (const localNotification of currentStore) {
            const isRecent = now - new Date(localNotification.createdAt).getTime() < LOCAL_ONLY_GRACE_MS;
            if (isRecent && !merged.some((item) => item.id === localNotification.id)) {
                merged.push(localNotification);
            }
        }

        merged.sort((a, b) => {
            const left = new Date(a.createdAt).getTime();
            const right = new Date(b.createdAt).getTime();
            return right - left;
        });

        setNotifications(merged);
    }, [notificationsData, setNotifications]);

    // Fallback realtime path: keep bell badge responsive even if a reconnect
    // race causes the global websocketSetup listener to miss a notification.
    useEffect(() => {
        const scheduleNotificationResync = () => {
            if (resyncTimerRef.current) {
                clearTimeout(resyncTimerRef.current);
            }

            // 800ms debounce: coalesces rapid WS events into a single API call.
            resyncTimerRef.current = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
                // invalidateQueries already triggers a refetch for active queries;
                // calling refetchQueries separately would double-fire the API.
            }, 800);
        };

        const parseNotification = (payload: unknown): Notification | null => {
            const wrapper = payload as {
                notification?: Partial<Notification> & Record<string, unknown>;
                data?: Partial<Notification> & Record<string, unknown>;
            } | null;
            const candidate = (wrapper?.notification || wrapper?.data || payload) as (Partial<Notification> & Record<string, unknown>) | null;

            const id = (candidate?.id as string | undefined) || (candidate?.['notification_id'] as string | undefined);
            if (!id) {
                return null;
            }

            return {
                id,
                type: (candidate.type as Notification['type']) || 'system',
                title: String(candidate.title || candidate['notification_title'] || 'New notification'),
                message: String(candidate.message || candidate['notification_message'] || ''),
                isRead: Boolean(candidate.isRead ?? candidate['is_read']),
                createdAt: String(candidate.createdAt || candidate['created_at'] || new Date().toISOString()),
                userId: (candidate.userId as string | undefined) || (candidate['user_id'] as string | undefined),
                campaignId: (candidate.campaignId as string | undefined) || (candidate['campaign_id'] as string | undefined),
                campaignName: (candidate.campaignName as string | undefined) || (candidate['campaign_name'] as string | undefined),
                influencerId: (candidate.influencerId as string | undefined) || (candidate['influencer_id'] as string | undefined),
                influencerName: (candidate.influencerName as string | undefined) || (candidate['influencer_name'] as string | undefined),
                actionUrl: (candidate.actionUrl as string | undefined) || (candidate['action_url'] as string | undefined),
            };
        };

        const onNotification = (payload: unknown) => {
            const incoming = parseNotification(payload);
            if (!incoming) return;

            const store = useNotificationStore.getState();
            const exists = store.notifications.some((n) => n.id === incoming.id);
            if (!exists) {
                store.addNotification(incoming);
            }

            scheduleNotificationResync();
        };

        ws.on(WS_EVENTS.NOTIFICATION, onNotification);
        ws.on('notification:new', onNotification);

        // First-step application/quote flows can sometimes emit campaign/application
        // events before notification event is observed; this keeps badge in sync.
        const notificationRelatedEvents = [
            WS_EVENTS.CAMPAIGN_UPDATED,
            WS_EVENTS.APPLICATION_RECEIVED,   // = 'APPLICATION_RECEIVED' (now correct)
            'application:received',            // lowercase co-emitted backend variant
            'APPLICATION_STATUS_CHANGED',
            WS_EVENTS.NEGOTIATION_UPDATE,     // = 'negotiation:update'
            'NEGOTIATION_UPDATED',
        ] as const;
        notificationRelatedEvents.forEach((eventName) => {
            ws.on(eventName, scheduleNotificationResync);
        });

        const onReconnect = () => {
            // If realtime notification was missed during transport close,
            // this will reconcile unread badge from API immediately.
            scheduleNotificationResync();
        };

        ws.on('connect', onReconnect);

        return () => {
            ws.off(WS_EVENTS.NOTIFICATION, onNotification);
            ws.off('notification:new', onNotification);
            notificationRelatedEvents.forEach((eventName) => {
                ws.off(eventName, scheduleNotificationResync);
            });
            ws.off('connect', onReconnect);
            if (resyncTimerRef.current) {
                clearTimeout(resyncTimerRef.current);
            }
        };
    }, [queryClient]);

    // Was previously nested inside the WS-setup effect above, which only depends on
    // [queryClient] and so only ever ran once at mount — it captured isDropdownOpen as
    // false forever and never re-attached the listener, meaning the dropdown could only
    // be closed by clicking the avatar again, never by clicking elsewhere.
    useEffect(() => {
        if (!isDropdownOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    // Profile menu (brand switcher, profile, logout) — shared by both top bar layouts.
    const dropdownMenu = (
        <div className={cn(
            "absolute right-0 top-full mt-2 bg-white border border-border rounded-2xl shadow-[0_4px_8px_-2px_rgba(0,0,0,0.06),0_16px_32px_-8px_rgba(0,0,0,0.16)] py-1.5 z-50",
            showBrandSwitcher ? "w-64" : "w-48",
            isDropdownOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
        )}>
            {showBrandSwitcher && (
                <>
                    {/* Brand list — show max 5, then a "More brands" link */}
                    <div className="max-h-56 overflow-y-auto">
                        {brandProfiles.slice(0, 5).map((brand) => (
                            <button
                                key={brand.id}
                                type="button"
                                disabled={isSwitchingBrand || brand.isActive}
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    switchBrand(brand.id, {
                                        onError: () => toast.error('Failed to switch brand. Please try again.'),
                                    });
                                }}
                                className={cn(
                                    "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground transition-colors rounded-lg mx-auto text-left disabled:cursor-default",
                                    brand.isActive
                                        ? "bg-foreground text-primary-foreground font-medium"
                                        : "hover:bg-secondary/70"
                                )}
                            >
                                {brand.brandLogoUrl ? (
                                    <div className="w-6 h-6 shrink-0 rounded-full overflow-hidden border border-border bg-secondary">
                                        <ApiImage
                                            src={brand.brandLogoUrl}
                                            alt={brand.brandName}
                                            className="w-full h-full object-cover"
                                            fallbackText={brand.brandName.charAt(0)}
                                        />
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                        brand.isActive
                                            ? "bg-primary-foreground text-foreground"
                                            : "bg-foreground text-primary-foreground"
                                    )}>
                                        {brand.brandName.charAt(0)}
                                    </div>
                                )}
                                <span className="flex-1 min-w-0 truncate">{brand.brandName}</span>
                            </button>
                        ))}
                    </div>
                    {brandProfiles.length > 5 && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsDropdownOpen(false);
                                navigate('/brands');
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors rounded-lg"
                        >
                            More brands
                            <ChevronRight className="w-3 h-3 ml-auto" />
                        </button>
                    )}
                    <div className="h-px bg-border mx-3 my-1" />
                </>
            )}
            <Link
                to="/profile"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-foreground hover:bg-secondary/70 transition-colors rounded-lg mx-auto"
            >
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Go to Profile</span>
            </Link>
            <div className="h-px bg-border mx-3 my-1" />
            {showLogoutConfirm ? (
                <div className="px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-2">Are you sure you want to log out?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowLogoutConfirm(false)}
                            className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { setShowLogoutConfirm(false); logoutMutation.mutate(); }}
                            disabled={logoutMutation.isPending}
                            className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
                        >
                            {logoutMutation.isPending ? 'Logging out...' : 'Log out'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Logout</span>
                </button>
            )}
        </div>
    );

    const brandInitial = user?.brandName?.charAt(0) || user?.name?.charAt(0) || 'B';

    if (variant === 'dock') {
        return (
            <>
            {isSwitchingBrand && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm animate-fade-in">
                    <Loader2 className="w-8 h-8 animate-spin text-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Switching brand…</p>
                </div>
            )}
            <header className="sticky top-0 z-30 isolate flex h-16 items-center gap-3 bg-background pl-4 pr-4 md:pl-6 sm:pr-6 lg:pr-[42px]">
                <Link to="/dashboard" className="shrink-0">
                    <MutinyXLogo className="h-5" />
                </Link>

                <div id={TOPBAR_SLOT_ID} className="flex min-w-0 flex-1 justify-start px-2" />

                <Link
                    to="/notifications"
                    aria-label="Notifications"
                    className="bell-btn relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm transition-all duration-300 hover:border-foreground"
                >
                    <Bell className="h-[17px] w-[17px] stroke-[1.75]" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-0.5 text-[8px] font-bold text-background ring-2 ring-background">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Link>

                <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isDropdownOpen}
                        onClick={() => { setIsDropdownOpen((o) => { if (o) setShowLogoutConfirm(false); return !o; }); }}
                        className="flex h-10 items-center gap-2.5 rounded-full border border-border bg-card pl-1 pr-1 sm:pr-4 text-left shadow-sm transition-colors hover:border-foreground"
                    >
                        {avatarSrc ? (
                            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary">
                                <ApiImage
                                    src={avatarSrc}
                                    alt={user?.brandName || user?.name || 'User avatar'}
                                    className="h-full w-full object-cover"
                                    fallbackText={brandInitial}
                                />
                            </span>
                        ) : (
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-muted-foreground to-foreground text-xs font-semibold text-background">
                                {brandInitial}
                            </span>
                        )}
                        <span className="hidden sm:block leading-tight min-w-0">
                            <span className="block max-w-[140px] truncate font-display text-[13px] font-bold leading-4 tracking-tight">
                                {user?.brandName || 'Your Brand'}
                            </span>
                            <span className="block max-w-[140px] truncate text-[11px] leading-[14px] text-muted-foreground">
                                {user?.name || 'Brand Owner'}
                            </span>
                        </span>
                    </button>
                    {dropdownMenu}
                </div>
            </header>
            </>
        );
    }

    return (
        <>
        {/* Full-screen loader while a brand switch is in flight — the dropdown closes on
            click and every brand-scoped query refetches, so this is the only feedback
            the user gets that the switch is happening. */}
        {isSwitchingBrand && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm animate-fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Switching brand…</p>
            </div>
        )}
        <header className="sticky top-0 z-30 h-16 bg-white flex items-center justify-between px-4 md:px-6 gap-4 shadow-[0_1px_0_hsl(var(--border)),0_4px_16px_-8px_rgba(0,0,0,0.08)]" style={{ isolation: 'isolate' }}>
            {/* Mobile: brand logo — hidden on desktop where sidebar shows it */}
            <Link to="/dashboard" className="flex items-center gap-2 md:hidden shrink-0">
                <MutinyXLogo className="h-5" />
            </Link>

            {/* Desktop: spacer (sidebar handles expansion) */}
            <div className="hidden md:block w-8" />

            <div className="flex-1" />

            {/* Right side */}
            <div className="flex items-center gap-2 md:gap-3 md:ml-4 shrink-0">
                {/* Notification bell */}
                <Link
                    to="/notifications"
                    className="bell-btn relative p-2 rounded-lg text-muted-foreground transition-all duration-300 hover:text-foreground hover:bg-secondary/60"
                >
                    <Bell className="w-[18px] h-[18px]" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#fedc03] text-[10px] font-bold text-black flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Link>

                {/* Profile avatar with dropdown */}
                <div className="relative pl-3 border-l border-border" ref={dropdownRef}>
                    {/* Avatar trigger */}
                    <button 
                        onClick={() => { setIsDropdownOpen((o) => { if (o) setShowLogoutConfirm(false); return !o; }); }}
                        className="flex items-center gap-2.5 cursor-pointer max-w-[180px] lg:max-w-[220px] min-w-0"
                    >
                        {avatarSrc ? (
                            <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-border bg-secondary">
                                <ApiImage
                                    src={avatarSrc}
                                    alt={user?.brandName || user?.name || 'User avatar'}
                                    className="w-full h-full object-cover"
                                    fallbackText={user?.brandName?.charAt(0) || user?.name?.charAt(0) || 'B'}
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 shrink-0 rounded-full bg-foreground text-primary-foreground flex items-center justify-center text-xs font-semibold">
                                {user?.brandName?.charAt(0) || user?.name?.charAt(0) || 'B'}
                            </div>
                        )}
                        <div className="hidden md:block text-sm text-left min-w-0 flex-1">
                            <p className="font-bold leading-none truncate max-w-[100px] lg:max-w-[140px]">{user?.brandName || 'Your Brand'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px] lg:max-w-[140px]">{user?.name || 'Brand Owner'}</p>
                        </div>
                    </button>

                    {dropdownMenu}
                </div>
            </div>
        </header>
        </>
    );
}
