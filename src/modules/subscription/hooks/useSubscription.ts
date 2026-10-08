import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API } from '@/core/api';
import { queryKeys } from '@/core/queryKeys';
import http from '@/core/http';
import {
    isDevDemoSession,
    demoGetSubscription,
    demoListPlans,
    demoUpgradeUnavailable,
    demoSetCancelled,
    demoGetManagerRequest,
    demoCreateManagerRequest,
} from '@/mocks/devSubscription';

export type SubscriptionPlan = 'free' | 'brand' | 'agency';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired';

export interface Subscription {
    id: string;
    userId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    pendingPlan: SubscriptionPlan | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    createdAt: string;
}

export interface PlanDefinition {
    plan: SubscriptionPlan;
    label: string;
    priceMonthly: number | null;
    priceAnnual: number | null;
    purchasable: boolean;
    description: string;
    features: string[];
    isMostPopular: boolean;
    badgeLabel: string | null;
}

export function useCurrentSubscription(enabled = true) {
    return useQuery<Subscription>({
        queryKey: queryKeys.subscription.me,
        queryFn: () => (isDevDemoSession() ? demoGetSubscription() : http.get(API.subscription.me).then((r) => r.data.data)),
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        enabled,
    });
}

export function usePlans() {
    return useQuery<PlanDefinition[]>({
        queryKey: queryKeys.subscription.plans,
        queryFn: () => (isDevDemoSession() ? demoListPlans() : http.get(API.subscription.plans).then((r) => r.data.data)),
        staleTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export interface UpgradeOrder {
    orderId: string;
    paymentSessionId: string;
    amount: number;
    currency: string;
    plan: SubscriptionPlan;
}

export function useInitiateUpgrade() {
    return useMutation({
        mutationFn: (plan: SubscriptionPlan) =>
            isDevDemoSession() ? demoUpgradeUnavailable() : http.post(API.subscription.upgrade, { plan }).then((r) => r.data.data as UpgradeOrder),
    });
}

export function useVerifyUpgrade() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (orderId: string) =>
            isDevDemoSession() ? demoUpgradeUnavailable() : http.post(API.subscription.verify, { orderId }).then((r) => r.data.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subscription.me });
        },
    });
}

// Cancel keeps paid access until currentPeriodEnd (cancelledAt is set, status stays
// 'active'); the plan lapses to free at period end instead of prompting a renewal.
export function useCancelSubscription() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => (isDevDemoSession() ? demoSetCancelled(true) : http.post(API.subscription.cancel).then((r) => r.data.data as Subscription)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subscription.me });
        },
    });
}

export function useResumeSubscription() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => (isDevDemoSession() ? demoSetCancelled(false) : http.post(API.subscription.resume).then((r) => r.data.data as Subscription)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subscription.me });
        },
    });
}

// ─── Dedicated manager callback request (paid-plan perk) ───────────────────────

export type ManagerRequestStatus = 'pending' | 'contacted' | 'closed';

export interface ManagerRequest {
    id: string;
    contactName: string;
    phoneNumber: string;
    description: string | null;
    status: ManagerRequestStatus;
    createdAt: string;
}

// Latest request regardless of status — pending/contacted means a callback is
// already on its way, so the form is replaced with that state.
export function useMyManagerRequest(enabled = true) {
    return useQuery<ManagerRequest | null>({
        queryKey: queryKeys.subscription.managerRequest,
        queryFn: () => (isDevDemoSession() ? demoGetManagerRequest() : http.get(API.subscription.managerRequest).then((r) => r.data.data)),
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        enabled,
    });
}

export interface CreateManagerRequestInput {
    contactName: string;
    phoneNumber: string;
    description?: string;
}

export function useRequestDedicatedManager() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateManagerRequestInput) =>
            isDevDemoSession() ? demoCreateManagerRequest(input) : http.post(API.subscription.managerRequest, input).then((r) => r.data.data as ManagerRequest),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subscription.managerRequest });
        },
    });
}
