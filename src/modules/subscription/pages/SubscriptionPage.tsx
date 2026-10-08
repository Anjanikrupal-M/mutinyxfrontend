import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { Building2, Check, ChevronLeft, Loader2, Rocket, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
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
                infoTooltip="Your current plan, billing period, and available upgrades for running campaigns."
            />

            {isLoadingSubscription ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading your current plan…
                </div>
            ) : subscription ? (
                <div className="bg-card border border-border rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">Current plan</p>
                        <p className="text-lg font-bold font-display capitalize">
                            {subscription.plan === 'agency' ? 'Agencies' : subscription.plan}
                        </p>
                        {isPaidActive && subscription.currentPeriodEnd && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {isCancelScheduled
                                    ? `Cancels on ${formatDate(subscription.currentPeriodEnd)} — full access until then.`
                                    : `Active until ${formatDate(subscription.currentPeriodEnd)}.`}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {isBillingOwner && isCancelScheduled && (
                            <Button variant="outline" size="sm" onClick={handleResume} disabled={resumeSubscription.isPending}>
                                {resumeSubscription.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                                Resume plan
                            </Button>
                        )}
                        {isBillingOwner && isPaidActive && !isCancelScheduled && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={handleCancel}
                                disabled={cancelSubscription.isPending}
                            >
                                {cancelSubscription.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                                Cancel plan
                            </Button>
                        )}
                        <Badge
                            variant={subscription.status === 'active' && !isCancelScheduled ? 'default' : 'secondary'}
                            className="capitalize"
                        >
                            {isCancelScheduled ? 'Cancelling' : subscription.status.replace('_', ' ')}
                        </Badge>
                    </div>
                </div>
            ) : null}

            {isLoadingPlans ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading plans…
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {plans?.map((plan) => {
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
                                    'relative bg-card border rounded-2xl p-6 flex flex-col h-full',
                                    'transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl',
                                    isPopular
                                        ? 'border-[#fedc03] shadow-[0_0_0_1px_#fedc03,0_12px_32px_-12px_rgba(254,220,3,0.45)]'
                                        : 'border-border hover:border-foreground/30'
                                )}
                            >
                                {isPopular && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#fedc03] text-black text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                        {plan.badgeLabel || 'Most Popular'}
                                    </span>
                                )}

                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-lg font-bold font-display">{plan.label}</h3>
                                    </div>
                                    {isCurrent && <Badge className="bg-[#fedc03] text-black hover:bg-[#fedc03]">Current</Badge>}
                                </div>

                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-3xl font-bold font-display">{formatPrice(plan)}</span>
                                    {plan.priceMonthly != null && plan.priceMonthly > 0 && (
                                        <span className="text-sm text-muted-foreground">/mo</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>

                                <ul className="space-y-2.5 flex-1 mb-6">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-[#fedc03] shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {isCurrent ? (
                                    <Button variant="outline" disabled className="w-full">
                                        Current Plan
                                    </Button>
                                ) : isBelowCurrent ? (
                                    <Button variant="outline" disabled className="w-full">
                                        Included in your plan
                                    </Button>
                                ) : plan.purchasable ? (
                                    <Button
                                        variant="default"
                                        className="w-full"
                                        disabled={isCheckingOut}
                                        onClick={() => handleUpgrade(plan.plan)}
                                    >
                                        {isCheckingOut ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing…
                                            </>
                                        ) : isRenewal ? (
                                            `Renew ${plan.label}`
                                        ) : (
                                            `Upgrade to ${plan.label}`
                                        )}
                                    </Button>
                                ) : (
                                    <Button variant="outline" disabled className="w-full">
                                        Not available
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
