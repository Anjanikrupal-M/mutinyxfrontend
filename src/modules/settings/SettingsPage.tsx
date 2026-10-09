import { PageHeader } from '@/shared/components/PageHeader';
import { Save, User, Lock, Loader2, CreditCard, Receipt, Mail, Phone, KeyRound, ShieldCheck, AlertCircle, CalendarDays } from 'lucide-react';
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

// Shared surface + field styles for every Settings section.
// While a field inside is focused, the card gets a soft yellow outline and lifts slightly.
const SECTION_CARD = 'animate-fade-up overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-foreground/[0.07] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:shadow-float focus-within:ring-2 focus-within:ring-brand/60';
const FIELD_INPUT = 'h-11 w-full rounded-xl border border-transparent bg-secondary/60 px-4 text-sm transition-colors placeholder:text-muted-foreground/60 hover:bg-secondary focus:border-foreground/15 focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/20';
const FIELD_LABEL = 'mb-2 block text-[13px] font-semibold';
const FIELD_HINT = 'mt-1.5 text-xs text-muted-foreground';
const PRIMARY_BUTTON = 'flood-btn group/save flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground pl-1.5 pr-5 text-sm font-semibold text-background duration-300 hover:shadow-float disabled:pointer-events-none disabled:opacity-50 sm:w-auto';

interface DecodedToken {
    email: string;
    name: string;
    role: string;
    userId: string;
    [key: string]: any;
}

/** Icon tile + title + description used at the top of each Settings section card. */
function SectionHeader({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
    return (
        <div className="flex items-center gap-3 border-b border-foreground/[0.06] px-6 py-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
                <h3 className="font-display text-base font-bold tracking-tight">{title}</h3>
                <p className="text-[13px] text-muted-foreground">{description}</p>
            </div>
        </div>
    );
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
        <section className={SECTION_CARD}>
            <SectionHeader icon={CreditCard} title="Current Plan" description="Your plan and billing period." />

            <div className="px-6 py-6">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading subscription…
                    </div>
                ) : subscription ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-secondary/50 p-5">
                            <div className="flex items-center gap-4">
                                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-black">
                                    <CreditCard className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="font-display text-2xl font-bold tracking-tight">{planLabel}</p>
                                    {periodEnd && subscription.plan !== 'free' && (
                                        <p className={cn('mt-0.5 flex items-center gap-1.5 text-sm', isExpiringSoon && !isCancelScheduled ? 'font-medium text-orange-600' : 'text-muted-foreground')}>
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                            {isCancelScheduled
                                                ? `Cancels on ${periodEnd} — full access until then`
                                                : isExpiringSoon
                                                    ? `⚠ Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — renew to avoid interruption`
                                                    : `Active until ${periodEnd}`}
                                        </p>
                                    )}
                                    {subscription.plan === 'free' && (
                                        <p className="mt-0.5 text-sm text-muted-foreground">No billing — free forever</p>
                                    )}
                                </div>
                            </div>
                            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold capitalize', isCancelScheduled ? 'bg-muted text-muted-foreground' : statusColor)}>
                                {isCancelScheduled ? 'Cancelling' : subscription.status.replace('_', ' ')}
                            </span>
                        </div>

                        {subscription.pendingPlan && (
                            <p className="rounded-xl border-l-[3px] border-brand bg-brand/10 px-4 py-3 text-xs text-foreground/80">
                                ⏳ Payment in progress for <strong className="capitalize">{PLAN_LABELS[subscription.pendingPlan] ?? subscription.pendingPlan}</strong> plan.
                                Complete the checkout to activate it.
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No subscription data found.</p>
                )}
            </div>

            <div className="flex justify-end border-t border-foreground/[0.06] bg-secondary/30 px-6 py-4">
                <Link to="/subscription" className={PRIMARY_BUTTON}>
                    <span className="flood-btn-icon grid h-8 w-8 place-items-center rounded-full bg-brand text-black">
                        <CreditCard className="h-4 w-4" />
                    </span>
                    <span className="flood-btn-label">{subscription?.plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}</span>
                </Link>
            </div>
        </section>
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

    // Initials for the profile avatar (first letters of the first two words of the name).
    const initials = (userDetails.name || userDetails.email || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <div className="w-full animate-fade-in pb-10">
            <PageHeader title="Settings" description="Manage your account preferences" infoTooltip="Manage your account, profile, and preferences." animated size="lg" />

            {/* Tabs */}
            <div className="mb-6 overflow-x-auto scrollbar-hide">
                <div className="inline-flex gap-1 rounded-full bg-secondary p-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200',
                                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <t.icon className={cn('h-4 w-4', tab === t.key && 'text-foreground')} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'account' && (
                <div className="space-y-5">
                    {/* Profile summary */}
                    <section className={cn(SECTION_CARD, 'relative flex items-center gap-4 p-6')}>
                        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
                        <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand font-display text-xl font-bold text-black">
                            {initials}
                        </span>
                        <div className="relative min-w-0">
                            <p className="truncate font-display text-xl font-bold tracking-tight">{userDetails.name || '—'}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                {userDetails.email}
                            </p>
                        </div>
                    </section>

                    {/* Personal details form */}
                    <section className={cn(SECTION_CARD, '[animation-delay:80ms]')}>
                        <SectionHeader icon={User} title="Personal details" description="Update your name and contact number." />
                        <div className="grid grid-cols-1 gap-5 px-6 py-6 md:grid-cols-2">
                            <div>
                                <label className={FIELD_LABEL}>Full Name</label>
                                <input
                                    type="text"
                                    value={userDetails.name}
                                    onChange={(e) => setUserDetails({ ...userDetails, name: sanitizeInput(e.target.value) })}
                                    className={FIELD_INPUT}
                                />
                            </div>
                            <div>
                                <label className={FIELD_LABEL}>Phone</label>
                                <div className="relative">
                                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="tel"
                                        value={userDetails.phoneNumber}
                                        maxLength={10}
                                        placeholder="10-digit mobile number"
                                        onChange={(e) => {
                                            const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                            setUserDetails({ ...userDetails, phoneNumber: numericValue });
                                        }}
                                        className={cn(FIELD_INPUT, 'pl-11 tabular-nums')}
                                    />
                                </div>
                                <p className={FIELD_HINT}>Enter 10-digit mobile number without country code.</p>
                            </div>
                            <div className="md:col-span-2">
                                <label className={FIELD_LABEL}>Email Address</label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={userDetails.email}
                                        disabled
                                        className="h-11 w-full cursor-not-allowed rounded-xl border border-dashed border-foreground/10 bg-secondary/30 pl-11 pr-11 text-sm text-muted-foreground"
                                    />
                                    <Lock className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                                </div>
                                <p className={FIELD_HINT}>Email address cannot be changed.</p>
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-foreground/[0.06] bg-secondary/30 px-6 py-4">
                            <button type="button" onClick={handleSaveProfile} disabled={isUpdating} className={PRIMARY_BUTTON}>
                                <span className="flood-btn-icon grid h-8 w-8 place-items-center rounded-full bg-brand text-black">
                                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </span>
                                <span className="flood-btn-label">{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {tab === 'security' && (
                <section className={SECTION_CARD}>
                    <SectionHeader icon={ShieldCheck} title="Change password" description="Use a strong password you don't use anywhere else." />
                    <div className="grid grid-cols-1 gap-5 px-6 py-6 md:grid-cols-2">
                        <div className="md:col-span-2 md:max-w-[calc(50%-10px)]">
                            <label className={FIELD_LABEL}>Current Password</label>
                            <div className="relative">
                                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({ ...passwords, current: sanitizeInput(e.target.value) })}
                                    className={cn(FIELD_INPUT, 'pl-11')}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={FIELD_LABEL}>New Password</label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={passwords.next}
                                    onChange={(e) => setPasswords({ ...passwords, next: sanitizeInput(e.target.value) })}
                                    className={cn(FIELD_INPUT, 'pl-11')}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={FIELD_LABEL}>Confirm Password</label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({ ...passwords, confirm: sanitizeInput(e.target.value) })}
                                    className={cn(FIELD_INPUT, 'pl-11')}
                                />
                            </div>
                        </div>
                        {passwordError && (
                            <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive md:col-span-2">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                {passwordError}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end border-t border-foreground/[0.06] bg-secondary/30 px-6 py-4">
                        <button type="button" onClick={handleChangePassword} disabled={isChangingPassword} className={PRIMARY_BUTTON}>
                            <span className="flood-btn-icon grid h-8 w-8 place-items-center rounded-full bg-brand text-black">
                                {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            </span>
                            <span className="flood-btn-label">{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
                        </button>
                    </div>
                </section>
            )}

            {tab === 'transactions' && isBrandOrAgent && <TransactionsPanel />}

            {tab === 'subscription' && isBrandOwner && !isManager && <SubscriptionTab />}
        </div>
    );
}
