import { PageHeader } from '@/shared/components/PageHeader';
import { Save, User, Lock, Loader2, CreditCard, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';
import { useMe, useUpdateAccount, useChangePassword } from '@/shared/hooks/useAuth';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'sonner';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';
import { TransactionsPanel } from '@/modules/transactions/components/TransactionsPanel';

const BASE_TABS = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
];

const TRANSACTIONS_TAB = { key: 'transactions', label: 'Transactions', icon: Receipt };
const SUBSCRIPTION_TAB = { key: 'subscription', label: 'Subscription', icon: CreditCard };

interface DecodedToken {
    email: string;
    name: string;
    role: string;
    userId: string;
    [key: string]: any;
}

// ─── Subscription Tab ─────────────────────────────────────────────────────────

function SubscriptionTab() {
    const { data: subscription, isLoading } = useCurrentSubscription();

    const PLAN_LABELS: Record<string, string> = {
        free: 'Free',
        brand: 'Brand',
        agency: 'Agencies',
    };

    const STATUS_COLORS: Record<string, string> = {
        active: 'bg-green-500/10 text-green-600',
        past_due: 'bg-yellow-500/10 text-yellow-700',
        cancelled: 'bg-muted text-muted-foreground',
        expired: 'bg-destructive/10 text-destructive',
    };

    const planLabel = subscription ? (PLAN_LABELS[subscription.plan] ?? subscription.plan) : '—';
    const statusColor = subscription ? (STATUS_COLORS[subscription.status] ?? 'bg-muted text-muted-foreground') : '';

    const periodEnd = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    // Days remaining for paid plans
    const daysLeft = subscription?.currentPeriodEnd
        ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && subscription?.plan !== 'free';

    // Cancellation is scheduled but the paid period is still running — access continues
    // until periodEnd, then the plan lapses to Free instead of prompting a renewal.
    const isCancelScheduled = !!subscription?.cancelledAt && subscription.status === 'active' && subscription.plan !== 'free';

    return (
        <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-base font-semibold font-display mb-4">Current Plan</h3>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading subscription…
                    </div>
                ) : subscription ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold font-display">{planLabel}</p>
                                {periodEnd && subscription.plan !== 'free' && (
                                    <p className={cn('text-sm mt-0.5', isExpiringSoon && !isCancelScheduled ? 'text-orange-600 font-medium' : 'text-muted-foreground')}>
                                        {isCancelScheduled
                                            ? `Cancels on ${periodEnd} — full access until then`
                                            : isExpiringSoon
                                                ? `⚠ Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — renew to avoid interruption`
                                                : `Active until ${periodEnd}`}
                                    </p>
                                )}
                                {subscription.plan === 'free' && (
                                    <p className="text-sm text-muted-foreground mt-0.5">No billing — free forever</p>
                                )}
                            </div>
                            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium capitalize', isCancelScheduled ? 'bg-muted text-muted-foreground' : statusColor)}>
                                {isCancelScheduled ? 'Cancelling' : subscription.status.replace('_', ' ')}
                            </span>
                        </div>

                        {subscription.pendingPlan && (
                            <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
                                ⏳ Payment in progress for <strong className="capitalize">{PLAN_LABELS[subscription.pendingPlan] ?? subscription.pendingPlan}</strong> plan.
                                Complete the checkout to activate it.
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No subscription data found.</p>
                )}

                <div className="mt-5 pt-4 border-t border-border">
                    <Link
                        to="/subscription"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-premium"
                    >
                        <CreditCard className="w-4 h-4" />
                        {subscription?.plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
    const [searchParams] = useSearchParams();
    // Deep-linkable tab. Falls back to Account.
    const [tab, setTab] = useState(() => searchParams.get('tab') || 'account');
    useEffect(() => {
        const requested = searchParams.get('tab');
        if (requested) setTab(requested);
    }, [searchParams]);
    const token = useAuthStore((s) => s.token);
    const userFromStore = useAuthStore((s) => s.user);
    const isBrandOwner = userFromStore?.role === 'brand_owner';
    const isManager = !!userFromStore?.agencyHeadId;

    // Transactions is the brand's campaign spend, so it shows for agents and managers too;
    // Subscription is the agency head's billing and stays owner-only.
    const isBrandOrAgent = userFromStore?.role === 'brand_owner' || userFromStore?.role === 'agent';
    const TABS = [
        ...BASE_TABS,
        ...(isBrandOrAgent ? [TRANSACTIONS_TAB] : []),
        ...(isBrandOwner && !isManager ? [SUBSCRIPTION_TAB] : []),
    ];

    const [userDetails, setUserDetails] = useState({ name: '', email: '', phoneNumber: '' });
    const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const { mutate: changePassword, isPending: isChangingPassword } = useChangePassword();

    const sanitizeInput = (val: string) => {
        let cleaned = val.replace(/^\s+/, '');
        cleaned = cleaned.replace(/<\/?\s*script[^>]*>/gi, '');
        return cleaned;
    };

    const handleChangePassword = () => {
        if (!passwords.current || !passwords.next || !passwords.confirm) {
            setPasswordError('All fields are required');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(passwords.next)) {
            setPasswordError('Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character');
            return;
        }
        if (passwords.next !== passwords.confirm) {
            setPasswordError('New passwords do not match');
            return;
        }
        setPasswordError(null);
        changePassword(
            { currentPassword: passwords.current, newPassword: passwords.next },
            { onSuccess: () => setPasswords({ current: '', next: '', confirm: '' }) },
        );
    };

    const { data: meData } = useMe();
    const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();
    const activeUser = meData || userFromStore;

    useEffect(() => {
        let name = activeUser?.name || '';
        let email = activeUser?.email || '';
        if (!name && !email && token) {
            try {
                const decoded = jwtDecode<DecodedToken>(token);
                name = decoded.name || '';
                email = decoded.email || '';
            } catch (e) {
                // ignore
            }
        }
        setUserDetails((prev) => ({
            ...prev,
            name: prev.name || name,
            email: prev.email || email,
            phoneNumber: prev.phoneNumber || activeUser?.phoneNumber || '',
        }));
    }, [activeUser, token]);

    const handleSaveProfile = () => {
        if (!userDetails.name.trim()) { toast?.error?.('Name cannot be empty'); return; }
        if (userDetails.name === '""' || userDetails.name === "''") { toast?.error?.('Invalid name'); return; }
        if (userDetails.phoneNumber && userDetails.phoneNumber.length !== 10) {
            toast?.error?.('Phone number must be exactly 10 digits');
            return;
        }
        updateAccount({
            name: userDetails.name,
            email: userDetails.email,
            phoneNumber: userDetails.phoneNumber === '' ? null : userDetails.phoneNumber,
        });
    };

    return (
        <div className="w-full animate-fade-in">
            <PageHeader title="Settings" description="Manage your account preferences" infoTooltip="Manage your account, profile, and preferences." />

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-border">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-premium relative', tab === t.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                        {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fedc03]" />}
                    </button>
                ))}
            </div>

            {tab === 'account' && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                    <div>
                        <label className="text-sm font-semibold mb-2 block">Full Name</label>
                        <input
                            type="text"
                            value={userDetails.name}
                            onChange={(e) => setUserDetails({ ...userDetails, name: sanitizeInput(e.target.value) })}
                            className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold mb-2 block">Email Address</label>
                        <input
                            type="email"
                            value={userDetails.email}
                            disabled
                            className="w-full h-10 px-4 rounded-lg border border-border bg-secondary/50 text-muted-foreground text-sm cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed.</p>
                    </div>
                    <div>
                        <label className="text-sm font-semibold mb-2 block">Phone</label>
                        <input
                            type="tel"
                            value={userDetails.phoneNumber}
                            maxLength={10}
                            placeholder="10-digit mobile number"
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                setUserDetails({ ...userDetails, phoneNumber: numericValue });
                            }}
                            className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Enter 10-digit mobile number without country code.</p>
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={handleSaveProfile}
                            disabled={isUpdating}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-premium disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isUpdating ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {tab === 'security' && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                    <div>
                        <label className="text-sm font-semibold mb-2 block">Current Password</label>
                        <input
                            type="password"
                            value={passwords.current}
                            onChange={(e) => setPasswords({ ...passwords, current: sanitizeInput(e.target.value) })}
                            className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold mb-2 block">New Password</label>
                        <input
                            type="password"
                            value={passwords.next}
                            onChange={(e) => setPasswords({ ...passwords, next: sanitizeInput(e.target.value) })}
                            className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold mb-2 block">Confirm Password</label>
                        <input
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: sanitizeInput(e.target.value) })}
                            className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                    </div>
                    {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                    <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-premium disabled:opacity-50"
                    >
                        {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            )}

            {tab === 'transactions' && isBrandOrAgent && <TransactionsPanel />}

            {tab === 'subscription' && isBrandOwner && !isManager && <SubscriptionTab />}
        </div>
    );
}
