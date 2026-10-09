import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { ArrowRight, Building2, CalendarDays, Check, ChevronLeft, Loader2, Rocket, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/shared/components/PageHeader';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import {
    useCancelSubscription,
    useCurrentSubscription,
    useInitiateUpgrade,
    usePlans,
    useResumeSubscription,
    useVerifyUpgrade,
    type PlanDefinition,
    type SubscriptionPlan,
} from '../hooks/useSubscription';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PLAN_ICON: Record<SubscriptionPlan, React.ComponentType<{ className?: string }>> = {
    free: Sparkles,
    brand: Rocket,
    agency: Building2,
};

const PLAN_RANK: Record<SubscriptionPlan, number> = {
    free: 0,
    brand: 1,
    agency: 2,
};

function formatPrice(plan: PlanDefinition) {
    if (plan.priceMonthly === 0) return 'Free';
    if (plan.priceMonthly == null) return plan.purchasable ? 'Custom pricing' : 'Contact us';
    return `₹${plan.priceMonthly.toLocaleString('en-IN')}`;
}

// Staggered entrance for the plan cards and their feature rows; Tailwind needs full class names.
const PLAN_DELAYS = ['[animation-delay:80ms]', '[animation-delay:180ms]', '[animation-delay:280ms]'];
const FEATURE_DELAYS = ['[animation-delay:250ms]', '[animation-delay:310ms]', '[animation-delay:370ms]', '[animation-delay:430ms]', '[animation-delay:490ms]', '[animation-delay:550ms]'];

export default function SubscriptionPage() {
    const navigate = useNavigate();
    const { data: subscription, isLoading: isLoadingSubscription } = useCurrentSubscription();
    const { data: plans, isLoading: isLoadingPlans } = usePlans();
    const initiateUpgrade = useInitiateUpgrade();
    const verifyUpgrade = useVerifyUpgrade();
    const cancelSubscription = useCancelSubscription();
    const resumeSubscription = useResumeSubscription();
    const user = useAuthStore((s) => s.user);
    const [cashfree, setCashfree] = useState<any>(null);
    const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);

    // Billing actions belong to the account owner alone — agents ride on their owner's
    // plan and managed accounts on their agency head's; the backend rejects both.
    const isBillingOwner = user?.role === 'brand_owner' && !user?.agencyHeadId;
    const isPaidActive = !!subscription && subscription.plan !== 'free' && subscription.status === 'active';
    const isCancelScheduled = isPaidActive && !!subscription?.cancelledAt;
    // Backend never resets `plan` on lapse (only `status`) — expired/cancelled subscriptions
    // are enforced as free (see subscriptions.guards.ts getPlanForOwner), so the UI must treat
    // them as free too, otherwise the lapsed plan's card looks "current" and hides the button
    // that would let the owner renew it.
    const isLapsed = subscription?.status === 'expired' || subscription?.status === 'cancelled';
    const effectivePlan: SubscriptionPlan = isLapsed ? 'free' : (subscription?.plan ?? 'free');

    function handleCancel() {
        if (!subscription) return;
        const endDate = subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
        const warning =
            subscription.plan === 'agency'
                ? 'After that, creating brands and team members is paused (existing brands and data are kept).'
                : 'After that, paid features like team agents and private campaigns are paused.';
        if (!window.confirm(`Cancel your plan?${endDate ? ` You keep full access until ${endDate}.` : ''} ${warning}`)) return;
        cancelSubscription.mutate(undefined, {
            onSuccess: () => toast.success('Plan cancelled — you keep access until the end of the period.'),
            onError: () => toast.error('Could not cancel the plan. Please try again.'),
        });
    }

    function handleResume() {
        resumeSubscription.mutate(undefined, {
            onSuccess: () => toast.success('Cancellation undone — your plan stays active.'),
            onError: () => toast.error('Could not resume the plan. Please try again.'),
        });
    }

    useEffect(() => {
        load({ mode: import.meta.env.VITE_CASHFREE_ENV === 'production' ? 'production' : 'sandbox' })
            .then((cf) => setCashfree(cf))
            .catch((err) => console.error('Failed to load Cashfree', err));
    }, []);

    async function handleUpgrade(plan: SubscriptionPlan) {
        if (!cashfree) {
            toast.error('Payment gateway is unavailable right now.');
            return;
        }

        try {
            setCheckoutPlan(plan);
            const order = await initiateUpgrade.mutateAsync(plan);
            if (!order.orderId || !order.paymentSessionId) {
                toast.error('Could not start checkout. Please try again.');
                setCheckoutPlan(null);
                return;
            }

            const result = await cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_modal',
            });

            if (result.error) {
                const msg = result.error.message || 'Payment failed or cancelled.';
                if (result.error.type !== 'modal_closed' && result.error.type !== 'window_closed') {
                    toast.error(msg);
                }
                return;
            }

            await verifyUpgrade.mutateAsync(order.orderId);
            toast.success(`You're now on the ${plan === 'brand' ? 'Brand' : 'Agencies'} plan.`);
        } catch (err) {
            console.error('Subscription upgrade failed', err);
            toast.error('Payment was not captured. You can retry.');
        } finally {
            setCheckoutPlan(null);
        }
    }

    return (
        <div className="w-full animate-fade-in">
            <div className="mb-2">
                <button
                    onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/settings')}
                    className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-premium"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </button>
            </div>
            <PageHeader
                title="Subscription"
                description="Choose the plan that fits how your brand runs campaigns."
                animated
                size="lg"
                infoTooltip="Your current plan, billing period, and available upgrades for running campaigns."
            />

            {isLoadingSubscription ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading your current plan…
                </div>
            ) : subscription ? (
                // Premium "membership" card — same dark surface + breathing brand glow as the Dashboard stat cards.
                <div className="group relative mb-8 overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white shadow-card transition-premium hover:shadow-float animate-fade-in">
                    <span aria-hidden className="stat-glow pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl" />
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

                    <div className="relative flex flex-wrap items-center justify-between gap-5">
                        <div className="flex min-w-0 items-center gap-4">
                            {(() => {
                                const CurrentIcon = PLAN_ICON[subscription.plan];
                                return (
                                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-black shadow-[0_0_24px_-4px_rgb(250_203_3_/_0.7)]">
                                        <CurrentIcon className="h-6 w-6" />
                                    </span>
                                );
                            })()}
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Current plan</p>
                                <p className="mt-0.5 font-display text-2xl font-bold capitalize tracking-tight">
                                    {subscription.plan === 'agency' ? 'Agencies' : subscription.plan}
                                </p>
                                {isPaidActive && subscription.currentPeriodEnd && (
                                    <p className="mt-1 flex items-center gap-1.5 text-sm text-white/55">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        {isCancelScheduled
                                            ? `Cancels on ${formatDate(subscription.currentPeriodEnd)} — full access until then.`
                                            : `Active until ${formatDate(subscription.currentPeriodEnd)}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {isBillingOwner && isCancelScheduled && (
                                <button
                                    type="button"
                                    onClick={handleResume}
                                    disabled={resumeSubscription.isPending}
                                    className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black transition-premium hover:brightness-95 disabled:opacity-60"
                                >
                                    {resumeSubscription.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Resume plan
                                </button>
                            )}
                            {isBillingOwner && isPaidActive && !isCancelScheduled && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={cancelSubscription.isPending}
                                    className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-white/50 transition-premium hover:bg-white/5 hover:text-red-400 disabled:opacity-60"
                                >
                                    {cancelSubscription.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Cancel plan
                                </button>
                            )}
                            <span
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize',
                                    subscription.status === 'active' && !isCancelScheduled
                                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                                        : 'border-orange-400/30 bg-orange-400/10 text-orange-300',
                                )}
                            >
                                <span className="relative flex h-2 w-2">
                                    {subscription.status === 'active' && !isCancelScheduled && (
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                    )}
                                    <span className={cn('relative inline-flex h-2 w-2 rounded-full', subscription.status === 'active' && !isCancelScheduled ? 'bg-emerald-400' : 'bg-orange-400')} />
                                </span>
                                {isCancelScheduled ? 'Cancelling' : subscription.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                </div>
            ) : null}

            {isLoadingPlans ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading plans…
                </div>
            ) : (
                <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
                    {plans?.map((plan, index) => {
                        const Icon = PLAN_ICON[plan.plan];
                        const isCurrent = !!subscription && effectivePlan === plan.plan;
                        const isPopular = plan.isMostPopular;
                        const isCheckingOut = checkoutPlan === plan.plan;
                        const isBelowCurrent = !isCurrent && !!subscription && PLAN_RANK[plan.plan] < PLAN_RANK[effectivePlan];
                        const isRenewal = isLapsed && subscription?.plan === plan.plan;

                        return (
                            <div
                                key={plan.plan}
                                className={cn(
                                    'group relative flex h-full animate-fade-up flex-col overflow-hidden rounded-3xl transition-all duration-300 ease-out hover:-translate-y-1',
                                    PLAN_DELAYS[Math.min(index, PLAN_DELAYS.length - 1)],
                                    'bg-card shadow-card hover:shadow-float',
                                    // Popular plan: yellow outline + glow; current plan: a slightly stronger neutral outline.
                                    isPopular ? 'ring-2 ring-brand' : isCurrent ? 'ring-1 ring-foreground/20' : 'ring-1 ring-foreground/[0.07]',
                                )}
                            >
                                {/* ── Top: identity + price ── */}
                                <div className="relative px-6 pb-5 pt-6">
                                    {isPopular && (
                                        <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-brand/30 blur-3xl" />
                                    )}

                                    <div className="relative flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6',
                                                    isPopular ? 'bg-brand text-black' : 'bg-brand/20 text-foreground',
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <h3 className="font-display text-base font-bold tracking-tight">{plan.label}</h3>
                                        </div>
                                        {isPopular ? (
                                            <span className="plan-badge-shine relative overflow-hidden rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                                                {plan.badgeLabel || 'Most popular'}
                                            </span>
                                        ) : isCurrent ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground">
                                                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                                Current
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="relative mt-5 flex items-end gap-1.5">
                                        <span className="font-display text-[38px] font-extrabold leading-none tabular-nums tracking-[-0.04em]">{formatPrice(plan)}</span>
                                        {plan.priceMonthly != null && plan.priceMonthly > 0 && (
                                            <span className="pb-1 text-sm font-medium text-muted-foreground">/mo</span>
                                        )}
                                    </div>
                                    <p className="relative mt-2.5 min-h-[40px] text-[13px] leading-relaxed text-muted-foreground">{plan.description}</p>
                                </div>

                                {/* ── Bottom: features + action, on a slightly recessed surface ── */}
                                <div
                                    className={cn(
                                        'relative mx-1.5 mb-1.5 flex flex-1 flex-col rounded-[20px] px-4 pb-4 pt-4',
                                        isPopular ? 'bg-brand/[0.08]' : 'bg-secondary/70',
                                    )}
                                >
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                        What's included
                                    </p>
                                    <ul className="mb-5 flex-1 space-y-2.5">
                                        {plan.features.map((feature, i) => (
                                            <li
                                                key={feature}
                                                className={cn('flex animate-fade-up items-center gap-2.5 text-[13px] font-medium', FEATURE_DELAYS[Math.min(i, FEATURE_DELAYS.length - 1)])}
                                            >
                                                <span
                                                    className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-black"
                                                >
                                                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                                </span>
                                                <span className="text-foreground/85">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {isCurrent || isBelowCurrent || !plan.purchasable ? (
                                        <div
                                            className={cn(
                                                'flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold',
                                                isCurrent
                                                    ? 'bg-brand/15 text-foreground ring-1 ring-inset ring-brand/50'
                                                    : 'bg-card text-muted-foreground ring-1 ring-inset ring-foreground/[0.08]',
                                            )}
                                        >
                                            {(isCurrent || isBelowCurrent) && (
                                                <Check className="h-4 w-4" strokeWidth={2.5} />
                                            )}
                                            {isCurrent ? 'Your current plan' : isBelowCurrent ? 'Included in your plan' : 'Not available'}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={isCheckingOut}
                                            onClick={() => handleUpgrade(plan.plan)}
                                            className={cn(
                                                'flood-btn group/cta flex h-10 w-full items-center justify-center gap-2 rounded-full pl-1.5 pr-5 text-sm font-semibold duration-300 hover:shadow-float disabled:opacity-70',
                                                'bg-foreground text-background',
                                            )}
                                        >
                                            <span className="flood-btn-icon mr-auto grid h-7 w-7 place-items-center rounded-full bg-brand text-black">
                                                {isCheckingOut ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:-rotate-45" />
                                                )}
                                            </span>
                                            <span className="flood-btn-label mr-auto">
                                                {isCheckingOut ? 'Processing…' : isRenewal ? `Renew ${plan.label}` : `Upgrade to ${plan.label}`}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
