import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Compass, MessageCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversations } from '@/modules/messages/hooks/useMessages';

const BOTTOM_TABS = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/discover', label: 'Influencers', icon: Compass },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/messages', label: 'Messages', icon: MessageCircle, badge: true },
];

export function BottomTabBar() {
    const location = useLocation();
    const { data: conversations = [] } = useConversations();
    const totalUnread = conversations.reduce(
        (sum, conv) => sum + ((conv as any).unreadCount ?? conv.unread ?? 0),
        0,
    );
    const hasUnreadMessages = totalUnread > 0;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.08)] md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex items-center h-16">
                {BOTTOM_TABS.map(({ to, label, icon: Icon, badge }) => {
                    const isActive =
                        location.pathname === to ||
                        (to !== '/dashboard' && location.pathname.startsWith(to));

                    return (
                        <NavLink
                            key={to}
                            to={to}
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full transition-premium',
                                isActive ? 'text-foreground' : 'text-muted-foreground'
                            )}
                        >
                            {/* Active bar indicator at top */}
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#fedc03]" />
                            )}

                            {/* Icon with optional badge */}
                            <div className="relative mt-1">
                                <Icon
                                    className={cn(
                                        'w-[22px] h-[22px]',
                                        isActive ? 'stroke-[2.5]' : 'stroke-2'
                                    )}
                                />
                                {badge && hasUnreadMessages && (
                                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#fedc03] border border-sidebar" />
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className={cn(
                                    'text-[10px] leading-none',
                                    isActive ? 'font-semibold' : 'font-medium'
                                )}
                            >
                                {label}
                            </span>
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
}
