// ─────────────────────────────────────────────────────────────
// Dev-only demo subscription for the demo account.
//
// While signed in as the demo user (see devAuth.ts) under `npm run dev`, the subscription
// hooks read here instead of the API. The demo account sits on the Agencies plan, the plan
// that unlocks the most of the app (client brands, brand switching, team brand access), so
// every page can be reviewed and designed against. Nothing ever reaches a server.
// ─────────────────────────────────────────────────────────────

import type { ManagerRequest, PlanDefinition, Subscription, CreateManagerRequestInput } from '@/modules/subscription/hooks/useSubscription';
import { DEV_DEMO_USER } from './devAuth';
import { isDevDemoSession } from './devCampaigns';

export { isDevDemoSession };

const STORE_KEY = 'mutiny:dev-demo-subscription-v1';
const LATENCY_MS = 250;

const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

interface StoredSubscription {
    subscription: Subscription;
    managerRequest: ManagerRequest | null;
}

const PLANS: PlanDefinition[] = [
    {
        plan: 'free',
        label: 'Free',
        priceMonthly: 0,
        priceAnnual: 0,
        purchasable: false,
        description: 'Try MutinyX with one brand and a single live campaign.',
        features: ['1 brand', '1 live campaign', 'Creator discovery', 'Email support'],
        isMostPopular: false,
        badgeLabel: null,
    },
    {
        plan: 'brand',
        label: 'Brand',
        priceMonthly: 4999,
        priceAnnual: 49990,
        purchasable: true,
        description: 'For growing brands running campaigns every month.',
        features: ['1 brand', 'Unlimited campaigns', 'Team members', 'Programs', 'Priority support'],
        isMostPopular: true,
        badgeLabel: 'Most popular',
    },
    {
        plan: 'agency',
        label: 'Agencies',
        priceMonthly: 14999,
        priceAnnual: 149990,
        purchasable: true,
        description: 'Run campaigns for many client brands from one login.',
        features: ['Unlimited client brands', 'Brand switching', 'Team access per brand', 'Agency overview', 'Dedicated manager'],
        isMostPopular: false,
        badgeLabel: 'Best for agencies',
    },
];

function seed(): StoredSubscription {
    return {
        subscription: {
            id: 'demo-sub-01',
            userId: DEV_DEMO_USER.id,
            plan: 'agency',
            status: 'active',
            pendingPlan: null,
            currentPeriodStart: daysFromNow(-65),
            currentPeriodEnd: daysFromNow(300),
            cancelledAt: null,
            createdAt: daysFromNow(-400),
        },
        managerRequest: null,
    };
}

function readStore(): StoredSubscription {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw) as StoredSubscription;
    } catch {
        // Unreadable or blocked storage: fall through to a fresh seed.
    }
    const seeded = seed();
    writeStore(seeded);
    return seeded;
}

function writeStore(store: StoredSubscription) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
        // Storage blocked; the change lives until reload.
    }
}

// ── Operations used by the subscription hooks ──

export function demoGetSubscription(): Promise<Subscription> {
    return wait(readStore().subscription);
}

export function demoListPlans(): Promise<PlanDefinition[]> {
    return wait(PLANS);
}

export function demoUpgradeUnavailable(): Promise<never> {
    return Promise.reject(Object.assign(new Error('Plan changes are disabled for the demo account'), {
        response: { status: 400, data: { success: false, message: 'Plan changes are disabled for the demo account' } },
    }));
}

export function demoSetCancelled(cancelled: boolean): Promise<Subscription> {
    const store = readStore();
    store.subscription = { ...store.subscription, cancelledAt: cancelled ? new Date().toISOString() : null };
    writeStore(store);
    return wait(store.subscription);
}

export function demoGetManagerRequest(): Promise<ManagerRequest | null> {
    return wait(readStore().managerRequest);
}

export function demoCreateManagerRequest(input: CreateManagerRequestInput): Promise<ManagerRequest> {
    const store = readStore();
    store.managerRequest = {
        id: `demo-mreq-${Date.now()}`,
        contactName: input.contactName,
        phoneNumber: input.phoneNumber,
        description: input.description ?? null,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    writeStore(store);
    return wait(store.managerRequest);
}
