import { PageHeader } from '@/shared/components/PageHeader';
import { SegmentedTabs } from '@/shared/components/SegmentedTabs';
import { ProgressPillButton, useDoneFlash } from '@/shared/components/ProgressPillButton';
import { Save, User, Lock, Loader2, CreditCard, Receipt, Mail, Phone, KeyRound, ShieldCheck, AlertCircle, CalendarDays, Check, ArrowUpRight } from 'lucide-react';
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
const FIELD_INPUT = 'h-10 w-full rounded-xl border border-transparent bg-secondary/60 px-4 text-sm transition-colors placeholder:text-muted-foreground/60 hover:bg-secondary focus:border-foreground/15 focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/20';
const FIELD_LABEL = 'mb-1.5 block text-[13px] font-semibold';
// Field tile: label inside the top edge, value below it, icon on the right; the whole tile is the hit area.
const FIELD_TILE = 'group/tile flex min-h-[60px] cursor-text items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 transition-all duration-200 hover:border-foreground/25 focus-within:border-foreground/30 focus-within:shadow-card focus-within:ring-4 focus-within:ring-brand/20';
const TILE_LABEL = 'block text-[11px] font-medium text-muted-foreground transition-colors group-focus-within/tile:text-foreground';
const TILE_INPUT = 'mt-0.5 block w-full bg-transparent text-[15px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground/45 focus:outline-none';
const FIELD_HINT = 'mt-1 text-[11px] text-muted-foreground';

/** Any phone input ("+91 98765 43210", "919876543210", "98765-43210") → the 10-digit number. */
const toTenDigits = (value?: string | null) => {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    return digits.slice(0, 10);
};
/** "9876543210" → "98765 43210" (the usual Indian grouping). */
const formatTenDigits = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);

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
        <div className="flex items-center gap-3 border-b border-foreground/[0.06] px-5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <h3 className="font-display text-base font-bold tracking-tight">{title}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
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

            <div className="flex justify-end border-t border-foreground/[0.06] px-5 py-3">
                {/* Same pill as the save buttons; it opens another page, so an arrow slides in on hover. */}
                <Link
                    to="/subscription"
                    className="group/link flex h-11 w-full items-center gap-2 rounded-full bg-foreground py-1.5 pl-1.5 pr-4 text-sm font-semibold text-background transition-shadow duration-300 hover:shadow-float sm:w-auto"
                >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-black transition-transform duration-300 group-hover/link:-rotate-12 group-hover/link:scale-110">
                        <CreditCard className="h-4 w-4" />
                    </span>
                    <span className="flex-1 whitespace-nowrap pl-1 sm:flex-none">{subscription?.plan === 'free' ? 'Upgrade plan' : 'Manage subscription'}</span>
                    <ArrowUpRight className="h-4 w-4 -translate-x-1 text-brand opacity-0 transition-all duration-300 group-hover/link:translate-x-0 group-hover/link:opacity-100" />
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
    const passwordSaved = useDoneFlash();

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
            { onSuccess: () => { setPasswords({ current: '', next: '', confirm: '' }); passwordSaved.flash(); } },
        );
    };

    const { data: meData } = useMe();
    const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();
    const profileSaved = useDoneFlash();
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
            phoneNumber: prev.phoneNumber || toTenDigits(activeUser?.phoneNumber),
        }));
    }, [activeUser, token]);

    // The phone as 10 digits whatever was stored ("+91 98765 43210" included).
    const phoneDigits = toTenDigits(userDetails.phoneNumber);
    const profileDirty = !!activeUser && (
        userDetails.name.trim() !== (activeUser.name ?? '').trim() ||
        phoneDigits !== toTenDigits(activeUser.phoneNumber)
    );

    const handleSaveProfile = () => {
        if (!userDetails.name.trim()) { toast?.error?.('Name cannot be empty'); return; }
        if (userDetails.name === '""' || userDetails.name === "''") { toast?.error?.('Invalid name'); return; }
        if (phoneDigits && phoneDigits.length !== 10) {
            toast?.error?.('Phone number must be exactly 10 digits');
            return;
        }
        updateAccount(
            {
                name: userDetails.name,
                email: userDetails.email,
                phoneNumber: phoneDigits === '' ? null : phoneDigits,
            },
            { onSuccess: () => profileSaved.flash() },
        );
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
                <SegmentedTabs
                    ariaLabel="Settings sections"
                    value={tab}
                    onChange={setTab}
                    items={TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
                />
            </div>

            {tab === 'account' && (
                <div className="space-y-5">
                    {/* Profile summary — a small highlighted name card, only as wide as its content */}
                    <section className="flex w-full animate-fade-up items-center gap-3 rounded-2xl border border-brand/50 bg-brand/10 py-2.5 pl-2.5 pr-5 shadow-sm sm:w-fit">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand font-display text-sm font-bold text-black ring-2 ring-card">
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate font-display text-base font-bold leading-tight tracking-tight">{userDetails.name || '—'}</p>
                            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0" />
                                {userDetails.email}
                            </p>
                        </div>
                    </section>

                    {/* Personal details — field tiles (label inside the tile, value large below it, icon on
                        the right) and a footer that says whether there's anything to save. */}
                    <section className={cn(SECTION_CARD, '[animation-delay:80ms]')}>
                        <div className="flex items-center gap-3 px-5 pb-1 pt-5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                                <User className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <h3 className="font-display text-base font-bold tracking-tight">Personal details</h3>
                                <p className="text-xs text-muted-foreground">How you appear to creators and your team.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
                            <label htmlFor="settings-name" className={FIELD_TILE}>
                                <span className="min-w-0 flex-1">
                                    <span className={TILE_LABEL}>Full name</span>
                                    <input
                                        id="settings-name"
                                        type="text"
                                        autoComplete="name"
                                        value={userDetails.name}
                                        placeholder="Your name"
                                        onChange={(e) => setUserDetails({ ...userDetails, name: sanitizeInput(e.target.value) })}
                                        className={TILE_INPUT}
                                    />
                                </span>
                                <User className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within/tile:text-foreground" />
                            </label>

                            <label htmlFor="settings-phone" className={FIELD_TILE}>
                                <span className="min-w-0 flex-1">
                                    <span className={TILE_LABEL}>Mobile number</span>
                                    <span className="mt-0.5 flex items-center gap-2">
                                        <span className="shrink-0 text-[15px] font-medium text-muted-foreground">+91</span>
                                        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
                                        <input
                                            id="settings-phone"
                                            type="tel"
                                            inputMode="numeric"
                                            autoComplete="tel-national"
                                            value={formatTenDigits(phoneDigits)}
                                            placeholder="98765 43210"
                                            onChange={(e) => setUserDetails({ ...userDetails, phoneNumber: toTenDigits(e.target.value) })}
                                            className={cn(TILE_INPUT, 'mt-0 min-w-0 tracking-wide tabular-nums')}
                                        />
                                    </span>
                                </span>
                                {phoneDigits.length === 10 ? (
                                    <span className="grid h-5 w-5 shrink-0 animate-pop place-items-center rounded-full bg-emerald-500 text-white" title="Valid number">
                                        <Check className="h-3 w-3" strokeWidth={3} />
                                    </span>
                                ) : phoneDigits.length > 0 ? (
                                    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{phoneDigits.length}/10</span>
                                ) : (
                                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                                )}
                            </label>

                            <div className={cn(FIELD_TILE, 'cursor-default border-dashed bg-secondary/30 hover:border-border md:col-span-2')}>
                                <span className="min-w-0 flex-1">
                                    <span className={TILE_LABEL}>Email address</span>
                                    <span className="mt-0.5 block truncate text-[15px] font-medium text-foreground/70">{userDetails.email}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground" title="Email address cannot be changed">
                                    <Lock className="h-3 w-3" /> Locked
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-foreground/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className={cn('flex items-center gap-2 text-xs font-medium', profileDirty ? 'text-foreground' : 'text-muted-foreground')}>
                                <span className={cn('h-2 w-2 shrink-0 rounded-full', profileDirty ? 'animate-pulse bg-brand ring-4 ring-brand/25' : 'bg-emerald-500')} />
                                {profileDirty ? 'You have unsaved changes' : 'Everything is saved'}
                            </span>
                            <ProgressPillButton
                                phase={isUpdating ? 'busy' : profileSaved.done ? 'done' : 'idle'}
                                icon={Save}
                                exit="drop"
                                labels={{ idle: 'Save changes', busy: 'Saving…', done: 'Saved!' }}
                                onClick={handleSaveProfile}
                                className="w-full sm:w-auto"
                            />
                        </div>
                    </section>
                </div>
            )}

            {tab === 'security' && (
                <section className={SECTION_CARD}>
                    <SectionHeader icon={ShieldCheck} title="Change password" description="Use a strong password you don't use anywhere else." />
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 px-5 py-4 md:grid-cols-2">
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
                    <div className="flex justify-end border-t border-foreground/[0.06] px-5 py-3">
                        <ProgressPillButton
                            phase={isChangingPassword ? 'busy' : passwordSaved.done ? 'done' : 'idle'}
                            icon={Lock}
                            exit="drop"
                            labels={{ idle: 'Update password', busy: 'Updating…', done: 'Password updated!' }}
                            onClick={handleChangePassword}
                            className="w-full sm:w-auto"
                        />
                    </div>
                </section>
            )}

            {tab === 'transactions' && isBrandOrAgent && <TransactionsPanel />}

            {tab === 'subscription' && isBrandOwner && !isManager && <SubscriptionTab />}
        </div>
    );
}
