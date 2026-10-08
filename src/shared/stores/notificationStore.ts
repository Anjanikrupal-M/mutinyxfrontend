import { create } from 'zustand';

export interface Notification {
    id: string;
    userId?: string;
    type: 'application' | 'script' | 'submission' | 'negotiation' | 'payment' | 'chat' | 'system' | 'campaign_invite';
    title: string;
    message: string;
    campaignId?: string;
    campaignName?: string;
    influencerId?: string;
    influencerName?: string;
    actionUrl?: string;
    isRead: boolean;
    createdAt: string;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Notification) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    setNotifications: (notifications: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
        }));
    },

    markAsRead: (id) => {
        set((state) => {
            const found = state.notifications.find((n) => n.id === id && !n.isRead);
            return {
                notifications: state.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n),
                unreadCount: found ? state.unreadCount - 1 : state.unreadCount,
            };
        });
    },

    markAllAsRead: () => {
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
        }));
    },

    setNotifications: (notifications) => {
        set({
            notifications,
            unreadCount: notifications.filter((n) => !n.isRead).length,
        });
    },
}));

export function tabByNotificationType(type: Notification['type']): string | null {
    switch (type) {
        case 'application':
        case 'negotiation':
        case 'payment':
            return 'applications';
        case 'script':
            return 'scripts';
        case 'submission':
            return 'submissions';
        default:
            return null;
    }
}

export function resolveNotificationUrl(notif: Partial<Notification>): string {
    const raw = notif.actionUrl?.trim();
    const campaignId = notif.campaignId;
    const tab = notif.type ? tabByNotificationType(notif.type) : null;

    // Normalize legacy deep links to existing frontend routes.
    if (raw) {
        const normalizedRaw = (() => {
            try {
                if (raw.startsWith('http://') || raw.startsWith('https://')) {
                    const parsed = new URL(raw);
                    return `${parsed.pathname}${parsed.search}`;
                }
            } catch {
                // Ignore malformed URLs and keep original raw string.
            }
            return raw;
        })();

        const campaignTabMatch = normalizedRaw.match(/^\/campaigns\/([^/?#]+)\/(applications|scripts|submissions|kanban|proof-of-work|analytics|invite)(?:[?#].*)?$/i);
        if (campaignTabMatch) {
            const [, id, tabName] = campaignTabMatch;
            if (tabName.toLowerCase() === 'invite') return `/campaigns/${id}/invite`;
            return `/campaigns/${id}?tab=${tabName.toLowerCase()}`;
        }

        // Legacy negotiation links from backend: /negotiation/:campaignId/:influencerId
        // Route users to campaign applications tab where negotiation UI exists.
        const legacyNegotiationMatch = normalizedRaw.match(/^\/negotiation\/([^/?#]+)\/([^/?#]+)(?:[?#].*)?$/i);
        if (legacyNegotiationMatch) {
            const [, id] = legacyNegotiationMatch;
            return `/campaigns/${id}?tab=applications`;
        }

        // If the actionUrl is just a generic campaign URL (or has legacy queries like ?screen=track), append the appropriate tab if known.
        const baseCampaignMatch = normalizedRaw.match(/^\/campaigns\/([^/?#]+)(?:[?#].*)?$/i);
        if (baseCampaignMatch && tab) {
            const [, id] = baseCampaignMatch;
            // If the backend already embedded an explicit ?tab= param, honour it instead of
            // overriding with the type-derived tab (e.g. proof-of-work uses type:'submission'
            // but should land on tab=proof-of-work, not tab=submissions).
            const explicitTab = normalizedRaw.match(/[?&]tab=([^&#]+)/i);
            if (explicitTab) {
                return `/campaigns/${id}?tab=${explicitTab[1]}`;
            }
            return `/campaigns/${id}?tab=${tab}`;
        }

        return normalizedRaw;
    }

    if (campaignId && tab) return `/campaigns/${campaignId}?tab=${tab}`;
    if (campaignId) return `/campaigns/${campaignId}`;
    return '#';
}
