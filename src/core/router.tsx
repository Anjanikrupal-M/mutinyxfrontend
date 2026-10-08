import { AppShell } from '@/shared/components/AppShell';
import { AuthLayout } from '@/shared/components/AuthLayout';
import ErrorPage from '@/shared/components/ErrorPage';
import NotFoundPage from '@/shared/components/NotFoundPage';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router-dom';
import { AuthGuard, ProfileCompleteGuard } from './guards';

// Render errors anywhere in the tree reach the route's errorElement (ErrorPage). A class
// ErrorBoundary here would catch them first and, sitting above <Outlet />, never reset on
// navigation — one crash would blank every page until a manual retry.
const RootLayout = () => (
    <>
        <ScrollRestoration />
        <Outlet />
    </>
);

// Lazy-loaded module pages
import AnalyticsPage from '@/modules/analytics/AnalyticsPage';
import ForgotPasswordPage from '@/modules/auth/ForgotPasswordPage';
import LoginPage from '@/modules/auth/LoginPage';
import RegisterPage from '@/modules/auth/RegisterPage';
import ResetPasswordPage from '@/modules/auth/ResetPasswordPage';
import CampaignBuilderPage from '@/modules/campaigns/pages/CampaignBuilderPage';
import CampaignDetailPage from '@/modules/campaigns/pages/CampaignDetailPage';
import CampaignInvitePage from '@/modules/campaigns/pages/CampaignInvitePage';
import CampaignListPage from '@/modules/campaigns/pages/CampaignListPage';
import DashboardPage from '@/modules/dashboard/DashboardPage';
import PendingTasksPage from '@/modules/dashboard/PendingTasksPage';
import DiscoverPage from '@/modules/discover/DiscoverPage';
import InfluencerProfilePage from '@/modules/discover/InfluencerProfilePage';
import InfluencerComparePage from '@/modules/discover/InfluencerComparePage';
import SavedCreatorsPage from '@/modules/discover/SavedCreatorsPage';
import MessagesPage from '@/modules/messages/MessagesPage';
import NotificationsPage from '@/modules/notifications/NotificationsPage';
import ProfilePage from '@/modules/profile/ProfilePage';
import LandingPage from '@/modules/landing/LandingPage';
import LandingBrandsPage from '@/modules/landing/BrandsPage';
import AgenciesPage from '@/modules/landing/AgenciesPage';
import CreatorsPage from '@/modules/landing/CreatorsPage';
import SettingsPage from '@/modules/settings/SettingsPage';
import TermsPage from '@/modules/legal/TermsPage';
import PrivacyPage from '@/modules/legal/PrivacyPage';
import DownloadPage from '@/modules/landing/DownloadPage';

import ContactPage from '@/modules/support/ContactPage';
import SupportPage from '@/modules/support/SupportPage';
import PublicReviewPage from '@/modules/publicReview/PublicReviewPage';
import CampaignReviewPage from '@/modules/publicReview/CampaignReviewPage';
import PublicCampaignOverviewPage from '@/modules/publicReview/PublicCampaignOverviewPage';
import ProgramsListPage from '@/modules/programs/pages/ProgramsListPage';
import ProgramDetailPage from '@/modules/programs/pages/ProgramDetailPage';
import SubscriptionPage from '@/modules/subscription/pages/SubscriptionPage';
import BrandsPage from '@/modules/brands/pages/BrandsPage';
import CreateBrandPage from '@/modules/brands/pages/CreateBrandPage';
import BrandDetailPage from '@/modules/brands/pages/BrandDetailPage';
import TeamsPage from '@/modules/brands/pages/TeamsPage';
import TeamMemberDetailPage from '@/modules/brands/pages/TeamMemberDetailPage';

// Main Router Configuration
export const router = createBrowserRouter([
    {
        element: <RootLayout />,
        errorElement: <ErrorPage />,
        children: [
            {
                path: '/',
                element: <LandingPage />,
            },
            {
                // Public marketing page. Must NOT be '/brands' — that path belongs to the
                // in-app agency Brands list below, and a root-level match would shadow it.
                path: '/for-brands',
                element: <LandingBrandsPage />,
            },
            {
                path: '/agencies',
                element: <AgenciesPage />,
            },
            {
                path: '/creators',
                element: <CreatorsPage />,
            },
            {
                path: '/terms',
                element: <TermsPage />,
            },
            {
                path: '/privacy',
                element: <PrivacyPage />,
            },
            {
                path: '/download',
                element: <DownloadPage />,
            },
            {
                path: '/contact',
                element: <ContactPage />,
            },
            {
                path: '/review/:kind/:token',
                element: <PublicReviewPage />,
            },
            {
                path: '/review/campaign/overview/:token',
                element: <PublicCampaignOverviewPage />,
            },
            {
                path: '/review/campaign/:kind/:token',
                element: <CampaignReviewPage />,
            },
            {
                element: <AuthLayout />,
                errorElement: <ErrorPage />,
                children: [
                    { path: '/login', element: <LoginPage /> },
                    { path: '/register', element: <RegisterPage /> },
                    { path: '/forgot-password', element: <ForgotPasswordPage /> },
                    { path: '/reset-password', element: <ResetPasswordPage /> },
                ],
            },
            {
                element: <AuthGuard />,
                errorElement: <ErrorPage />,
                children: [
                    {
                        element: <AppShell />,
                        children: [
                            // Intermediate route: catches any rendering error in children
                            // while keeping AppShell (sidebar + topbar) in the layout.
                            {
                                errorElement: <ErrorPage />,
                                children: [
                                    { path: '/dashboard', element: <DashboardPage /> },
                                    { path: '/dashboard/pending-tasks', element: <PendingTasksPage /> },

                                    // Campaigns
                                    { path: '/campaigns', element: <CampaignListPage /> },
                                    { path: '/campaigns/:id', element: <CampaignDetailPage /> },
                                    { path: '/campaigns/:id/edit', element: <CampaignBuilderPage /> },
                                    // Profile must be complete (incl. a connected social account)
                                    // to create campaigns or invite creators
                                    {
                                        element: <ProfileCompleteGuard />,
                                        children: [
                                            { path: '/campaigns/create', element: <CampaignBuilderPage /> },
                                            { path: '/campaigns/:id/invite', element: <CampaignInvitePage /> },
                                        ],
                                    },

                                    // Discover
                                    { path: '/discover', element: <DiscoverPage /> },
                                    { path: '/discover/compare', element: <InfluencerComparePage /> },
                                    { path: '/saved-creators', element: <SavedCreatorsPage /> },
                                    { path: '/discover/:id', element: <InfluencerProfilePage /> },

                                    // Analytics
                                    { path: '/analytics', element: <AnalyticsPage /> },

                                    // Profile
                                    { path: '/profile', element: <ProfilePage /> },

                                    // Notifications
                                    { path: '/notifications', element: <NotificationsPage /> },

                                    // Messages (list and conversation by id)
                                    { path: '/messages', element: <MessagesPage /> },
                                    { path: '/messages/:conversationId', element: <MessagesPage /> },

                                    // Subscription
                                    { path: '/subscription', element: <SubscriptionPage /> },

                                    // Client brands (Agencies plan)
                                    { path: '/brands', element: <BrandsPage /> },
                                    { path: '/brands/new', element: <CreateBrandPage /> },
                                    { path: '/brands/:id', element: <BrandDetailPage /> },

                                    // Teams (brand owners)
                                    { path: '/teams', element: <TeamsPage /> },
                                    { path: '/teams/:id', element: <TeamMemberDetailPage /> },

                                    // Settings and Support
                                    { path: '/settings', element: <SettingsPage /> },
                                    { path: '/support', element: <SupportPage /> },

                                    // Programs (Phase 2)
                                    { path: '/programs', element: <ProgramsListPage /> },
                                    { path: '/programs/:id', element: <ProgramDetailPage /> },

                                    // 404
                                    { path: '*', element: <NotFoundPage /> },
                                ],
                            },

                            // Discover
                            { path: '/discover', element: <DiscoverPage /> },
                            { path: '/discover/compare', element: <InfluencerComparePage /> },
                            { path: '/saved-creators', element: <SavedCreatorsPage /> },
                            { path: '/discover/:id', element: <InfluencerProfilePage /> },

                            // Analytics
                            { path: '/analytics', element: <AnalyticsPage /> },

                            // Profile
                            { path: '/profile', element: <ProfilePage /> },

                            // Notifications
                            { path: '/notifications', element: <NotificationsPage /> },

                            // Messages (list and conversation by id)
                            { path: '/messages', element: <MessagesPage /> },
                            { path: '/messages/:conversationId', element: <MessagesPage /> },

                            // Subscription
                            { path: '/subscription', element: <SubscriptionPage /> },

                            // Transactions (brand money ledger) moved into Settings as a tab.
                            // Kept as a redirect so old links and bookmarks still resolve.
                            { path: '/transactions', element: <Navigate to="/settings?tab=transactions" replace /> },

                            // Client brands (Agencies plan)
                            { path: '/brands', element: <BrandsPage /> },
                            { path: '/brands/new', element: <CreateBrandPage /> },
                            { path: '/brands/:id', element: <BrandDetailPage /> },

                            // Teams (brand owners)
                            { path: '/teams', element: <TeamsPage /> },
                            { path: '/teams/:id', element: <TeamMemberDetailPage /> },

                            // Settings and Support
                            { path: '/settings', element: <SettingsPage /> },
                            { path: '/support', element: <SupportPage /> },

                            // Programs (Phase 2)
                            { path: '/programs', element: <ProgramsListPage /> },
                            { path: '/programs/:id', element: <ProgramDetailPage /> },

                            // 404
                            { path: '*', element: <NotFoundPage /> },
                        ],
                    },
                ],
            },
        ]
    }
]);
