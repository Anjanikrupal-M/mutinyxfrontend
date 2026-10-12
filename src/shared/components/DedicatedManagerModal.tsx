import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Headset, Mail, MessageCircle, PhoneCall } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { useAuthStore } from '@/shared/stores/authStore';
import { ProgressPillButton, useDoneFlash } from '@/shared/components/ProgressPillButton';
import { cn } from '@/lib/utils';
import {
    useMyManagerRequest,
    useRequestDedicatedManager,
} from '@/modules/subscription/hooks/useSubscription';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getSupportInfo } from '@/modules/support/api';

interface DedicatedManagerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

// Mutiny Talent contact details — the single source of truth for the connect options here.
const CONTACT_EMAIL = 'connect@mutinytalent.com';
const CONTACT_PHONE_DISPLAY = '+91 9391869151';
// wa.me needs the number in international format with no +, spaces, or dashes.
const CONTACT_PHONE_WA = '919391869151';

/**
 * Connect with the Mutiny Talent team for a dedicated account manager. Users can reach out
 * instantly over Email or WhatsApp (both open prefilled with an editable template), or leave
 * their number for a callback. Nothing blocks reconnecting — the options are always available.
 */
export function DedicatedManagerModal({ open, onOpenChange }: DedicatedManagerModalProps) {
    const { user } = useAuthStore();
    const { data: supportInfo } = useQuery({ queryKey: ['supportInfo'], queryFn: getSupportInfo });
    const CONTACT_EMAIL_DYN = supportInfo?.email || CONTACT_EMAIL;
    const CONTACT_PHONE_DISPLAY_DYN = supportInfo?.phone || CONTACT_PHONE_DISPLAY;
    const CONTACT_PHONE_WA_DYN = CONTACT_PHONE_DISPLAY_DYN.replace(/\D/g, '');
    // Kept only to show a gentle "you already have a pending callback" hint — it never blocks.
    const { data: existingRequest } = useMyManagerRequest(open);
    const { mutate: requestManager, isPending: isSubmitting } = useRequestDedicatedManager();
    const callbackSent = useDoneFlash();

    const [phoneNumber, setPhoneNumber] = useState('');
    const [message, setMessage] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    // The phone field stays hidden when we already know the user's number — it only
    // appears if the profile has none, or the user chooses to be called on another line.
    const [isEditingPhone, setIsEditingPhone] = useState(false);

    const profilePhone = user?.phoneNumber || user?.phone || '';
    // Name is never asked for — the callback is attributed to the signed-in user.
    const contactName = (user?.name || user?.brandName || '').trim();

    useEffect(() => {
        if (open) {
            setPhoneNumber((current) => current || profilePhone);
            setIsEditingPhone(!profilePhone);
            setPhoneError(null);
        }
    }, [open, profilePhone]);

    const hasPendingCallback = existingRequest?.status === 'pending';

    // Build the shared template, folding in whatever the user typed as their message. They can
    // still edit everything once their mail client / WhatsApp opens.
    const brandLine = user?.brandName ? `\nBrand: ${user.brandName}` : '';
    const needLine = message.trim()
        ? `\n\nWhat I need help with:\n${message.trim()}`
        : '\n\nWhat I need help with:\n(Campaign strategy, onboarding, scaling your brands…)';

    const emailSubject = `Dedicated Manager Request${user?.brandName ? ` — ${user.brandName}` : ''}`;
    const emailBody = `Hi Mutiny Talent team,\n\nI'd like to connect with a dedicated account manager.\n\nName: ${user?.name ?? ''}\nEmail: ${user?.email ?? ''}${brandLine}${needLine}\n\nThanks,\n${user?.name ?? ''}`;
    // mailto: works only when the OS has a mail app registered — on a desktop where the user
    // lives in web Gmail, clicking it silently does nothing. So the primary "Email us" button
    // opens Gmail's web compose (prefilled, new tab); mailto stays on the address text below
    // as a fallback for anyone with a native mail client.
    const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const waText = `Hi Mutiny Talent team, I'd like to connect with a dedicated account manager.\n\nName: ${user?.name ?? ''}${brandLine}${message.trim() ? `\n\nWhat I need help with: ${message.trim()}` : ''}`;
    const whatsappHref = `https://wa.me/${CONTACT_PHONE_WA}?text=${encodeURIComponent(waText)}`;

    const handleSubmit = () => {
        const phone = phoneNumber.trim();
        if (!PHONE_PATTERN.test(phone)) {
            // Surface the field if it was hidden — otherwise the error has nowhere to land.
            setIsEditingPhone(true);
            setPhoneError('Enter a valid phone number');
            return;
        }
        setPhoneError(null);

        // The API requires a contact name and we no longer ask for one, so an empty
        // profile name has to be sent back to the profile rather than failing server-side.
        if (!contactName) {
            toast.error('Add your name in Profile before requesting a callback.');
            return;
        }

        requestManager(
            {
                contactName,
                phoneNumber: phone,
                description: message.trim() || undefined,
            },
            {
                onSuccess: () => {
                    callbackSent.flash();
                    toast.success("Request received! Our team will call you back soon.");
                },
                onError: (error) => {
                    const apiMessage =
                        (error as { response?: { data?: { error?: string; message?: string } } })
                            ?.response?.data?.error || 'Failed to submit the request. Please try again.';
                    toast.error(apiMessage);
                },
            }
        );
    };

    // Quick topics: tap to add one to the message (tap again to take it out).
    const TOPICS = ['Campaign strategy', 'Onboarding', 'Scaling brands', 'Creator sourcing'];
    const toggleTopic = (topic: string) => {
        const parts = message.split(',').map((p) => p.trim()).filter(Boolean);
        const next = parts.includes(topic) ? parts.filter((p) => p !== topic) : [...parts, topic];
        setMessage(next.join(', '));
    };
    const hasTopic = (topic: string) => message.split(',').map((p) => p.trim()).includes(topic);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[400px] gap-0 overflow-hidden rounded-[26px] p-0">
                {/* Header: a yellow headset badge with a soft pulse, title and promise */}
                <div className="relative overflow-hidden px-5 pb-3 pt-4">
                    <span aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-40 w-64 rounded-full bg-brand/30 blur-3xl" />
                    <DialogHeader className="relative space-y-0 text-left">
                        <div className="flex items-center gap-3.5 pr-8">
                            <span className="relative grid h-10 w-10 shrink-0 place-items-center">
                                <span aria-hidden className="absolute inset-0 animate-ping rounded-xl bg-brand/40 [animation-duration:2.4s]" />
                                <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand text-black shadow-[0_8px_20px_-8px_rgb(250_203_3_/_0.9)]">
                                    <Headset className="h-[18px] w-[18px]" />
                                </span>
                            </span>
                            <div className="min-w-0">
                                <DialogTitle className="font-display text-base font-semibold tracking-tight">Your dedicated manager</DialogTitle>
                                <p className="truncate text-[11px] text-muted-foreground">A real person from the Mutiny Talent team.</p>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="space-y-3 px-5 pb-4">
                    {/* What you need — quick topics, then an optional note */}
                    <div>
                        <p className="mb-1.5 text-xs font-semibold">What can we help with?</p>
                        <div className="mb-2 flex flex-wrap gap-1">
                            {TOPICS.map((topic) => {
                                const on = hasTopic(topic);
                                return (
                                    <button
                                        key={topic}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleTopic(topic)}
                                        className={cn(
                                            'flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-all duration-150 active:scale-95',
                                            on ? 'border-foreground bg-brand/20 font-semibold' : 'border-border text-foreground/75 hover:border-foreground/40',
                                        )}
                                    >
                                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                                        {topic}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative">
                            <Textarea
                                id="dm-message"
                                value={message}
                                maxLength={2000}
                                rows={2}
                                placeholder="Anything else? (optional)"
                                onChange={(e) => setMessage(e.target.value)}
                                aria-label="Your message (optional)"
                                className="min-h-[52px] resize-none rounded-xl border-border bg-card py-2 pb-5 text-[13px] focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-foreground/10 focus-visible:ring-offset-0"
                            />
                            <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-muted-foreground">{message.length}/2000</span>
                        </div>
                    </div>

                    {/* Reach us now — two option cards */}
                    <div>
                        <p className="mb-1.5 text-xs font-semibold">Reach us now</p>
                        <div className="grid grid-cols-2 gap-2">
                            <a
                                href={gmailHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/opt relative flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-card"
                            >
                                <span className="contents">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 ring-1 ring-brand/40 transition-colors group-hover/opt:bg-brand"><Mail className="h-4 w-4" /></span>
                                    <ArrowUpRight className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground transition-transform group-hover/opt:-translate-y-0.5 group-hover/opt:translate-x-0.5 group-hover/opt:text-foreground" />
                                </span>
                                <span className="min-w-0 pr-3">
                                    <span className="block text-[13px] font-semibold leading-tight">Email</span>
                                    <span className="block truncate text-[10px] text-muted-foreground">Ready-made note</span>
                                </span>
                            </a>
                            <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/opt relative flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#25D366]/50 hover:shadow-card"
                            >
                                <span className="contents">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#25D366]/15 text-[#128C4B] ring-1 ring-[#25D366]/40 transition-colors group-hover/opt:bg-[#25D366] group-hover/opt:text-white"><MessageCircle className="h-4 w-4" /></span>
                                    <ArrowUpRight className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground transition-transform group-hover/opt:-translate-y-0.5 group-hover/opt:translate-x-0.5 group-hover/opt:text-foreground" />
                                </span>
                                <span className="min-w-0 pr-3">
                                    <span className="block text-[13px] font-semibold leading-tight">WhatsApp</span>
                                    <span className="block truncate text-[10px] text-muted-foreground">Chat with the team</span>
                                </span>
                            </a>
                        </div>
                        {/* Raw details, also clickable — mailto covers native mail clients,
                            which the Gmail-web option above deliberately doesn't. */}
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <a href={mailtoHref} className="transition-colors hover:text-foreground">{CONTACT_EMAIL}</a>
                            <span aria-hidden="true">·</span>
                            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">{CONTACT_PHONE_DISPLAY_DYN}</a>
                        </div>
                    </div>

                    {/* Or a callback */}
                    <div className="rounded-2xl border border-dashed border-border p-3">
                        <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary"><PhoneCall className="h-3.5 w-3.5" /></span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold leading-tight">Prefer a call?</p>
                                {!isEditingPhone ? (
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        We'll call you on <strong className="font-semibold text-foreground">{phoneNumber}</strong>{' · '}
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingPhone(true)}
                                            className="font-semibold text-foreground underline-offset-2 hover:underline"
                                        >
                                            Change
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">Leave a number and we'll ring you back.</p>
                                )}
                            </div>
                        </div>

                        {/* Name and number come from the profile, so the callback is a single
                            button. The field only appears when there's no number to use, or
                            when the user asks to be reached on a different one. */}
                        {isEditingPhone && (
                            <div className="mt-3">
                                <Input
                                    id="dm-phone"
                                    type="tel"
                                    value={phoneNumber}
                                    maxLength={20}
                                    placeholder="+91 98765 43210"
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    aria-label="Phone number"
                                    className="h-10 rounded-xl"
                                />
                                {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
                            </div>
                        )}

                        {hasPendingCallback && (
                            <p className="mt-2.5 truncate rounded-lg bg-brand/10 px-2.5 py-1.5 text-[10px] text-foreground/80">
                                A callback is already queued — you can request again.
                            </p>
                        )}

                        <ProgressPillButton
                            phase={isSubmitting ? 'busy' : callbackSent.done ? 'done' : 'idle'}
                            icon={PhoneCall}
                            labels={{ idle: 'Request a callback', busy: 'Requesting…', done: "We'll call you!" }}
                            onClick={handleSubmit}
                            className="mt-2 w-full"
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
