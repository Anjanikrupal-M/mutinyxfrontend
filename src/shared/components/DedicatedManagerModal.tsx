import { useEffect, useState } from 'react';
import { Headset, Loader2, Mail, MessageCircle, PhoneCall } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { useAuthStore } from '@/shared/stores/authStore';
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Headset className="w-5 h-5" />
                        Dedicated Manager
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Get a dedicated account manager from the Mutiny Talent team.
                    </p>

                    {/* Optional message — flows into the email / WhatsApp template and the callback note. */}
                    <div className="space-y-1.5">
                        <Label htmlFor="dm-message">
                            Your message{' '}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="dm-message"
                            value={message}
                            maxLength={2000}
                            rows={3}
                            placeholder="Campaign strategy, onboarding, scaling your brands…"
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>

                    {/* Connect instantly */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button asChild variant="outline" className="w-full">
                            <a href={gmailHref} target="_blank" rel="noopener noreferrer">
                                <Mail className="w-4 h-4 mr-1.5" />
                                Email us
                            </a>
                        </Button>
                        <Button asChild className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="w-4 h-4 mr-1.5" />
                                WhatsApp
                            </a>
                        </Button>
                    </div>

                    {/* Raw details, also clickable — mailto covers native mail clients,
                        which the Gmail-web button above deliberately doesn't. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <a href={mailtoHref} className="hover:text-foreground transition-premium">
                            {CONTACT_EMAIL}
                        </a>
                        <span aria-hidden="true">·</span>
                        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-premium">
                            {CONTACT_PHONE_DISPLAY_DYN}
                        </a>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    {hasPendingCallback && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2">
                            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                            You already have a callback request in the queue — you can still reach out above or request again.
                        </p>
                    )}

                    {/* Name and number come from the profile, so the callback is a single
                        button. The field only appears when there's no number to use, or
                        when the user asks to be reached on a different one. */}
                    {isEditingPhone && (
                        <div className="space-y-1.5">
                            <Label htmlFor="dm-phone">Phone number</Label>
                            <Input
                                id="dm-phone"
                                type="tel"
                                value={phoneNumber}
                                maxLength={20}
                                placeholder="+91 98765 43210"
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                            {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Request a callback'
                            )}
                        </Button>
                        {!isEditingPhone && (
                            <p className="text-[11px] text-muted-foreground text-center">
                                We'll call you on {phoneNumber}.{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsEditingPhone(true)}
                                    className="underline underline-offset-2 hover:text-foreground transition-premium"
                                >
                                    Use a different number
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
