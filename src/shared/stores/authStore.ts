import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    phoneNumber?: string;
    role: 'brand_owner' | 'influencer' | 'agent';
    avatarUrl?: string;
    brandId?: string;
    influencerId?: string;
    brandOwnerId?: string; // agent only — userId of the brand owner who created this agent
    agencyHeadId?: string; // brand manager only — userId of the agency head who created this account; also identifies the "manager" role (see shared/hooks/useIsAgencyOwner)
    // Brand Profile Fields
    brandName?: string;
    brandLogoUrl?: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    pincode?: string;
    primaryLanguage?: string;
    bio?: string;
    socialLinks?: {
        instagram?: string;
        youtube?: string;
    };
    // Whether the brand has at least one linked social account (anchored on the brand's
    // owner-of-record). Required — gates campaign/program/invite actions (see core/guards).
    socialConnected?: boolean;
    // Influencer Profile Fields
    handle?: string;
    location?: string;
    niches?: string[];
    tier?: string;
    followerCount?: number;
    acceptingCollabs?: boolean;
    featuredPortfolioIds?: string[];
    badges?: string[];
    settings?: {
        theme?: 'light' | 'dark' | 'system';
        compactMode?: boolean;
        emailNotifications?: boolean;
        [key: string]: unknown;
    };
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isHydrated: boolean;
    isCheckingSession: boolean;
    isSwitchingBrand: boolean;
    refreshToken: string | null;
    setUser: (user: User, token?: string | null, refreshToken?: string | null) => void;
    updateUser: (user: Partial<User>) => void;
    logout: () => void;
    clearToken: () => void;
    setLoading: (loading: boolean) => void;
    setHydrated: (hydrated: boolean) => void;
    setCheckingSession: (checking: boolean) => void;
    setIsSwitchingBrand: (switching: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            isHydrated: false,
            isCheckingSession: false,
            isSwitchingBrand: false,

            setUser: (user, token, refreshToken) => {
                set({ user, token: token ?? null, refreshToken: refreshToken ?? null, isAuthenticated: true });
            },
            updateUser: (user) => {
                set((state) => ({
                    user: state.user ? { ...state.user, ...user } : (user as User)
                }));
            },

            logout: () => {
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
            },

            clearToken: () => set({ token: null }),

            setLoading: (isLoading) => set({ isLoading }),
            setHydrated: (isHydrated) => set({ isHydrated }),
            setCheckingSession: (isCheckingSession) => set({ isCheckingSession }),
            setIsSwitchingBrand: (isSwitchingBrand) => set({ isSwitchingBrand }),
        }),
        {
            name: 'auth-storage',
            version: 3,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: (state) => {
                return () => {
                    state?.setHydrated(true);
                };
            },
        }
    )
);
