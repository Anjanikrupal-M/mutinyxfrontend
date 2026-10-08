import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import http from '@/core/http';
import { API } from '@/core/api';
import type { AxiosError } from 'axios';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        setIsPending(true);
        try {
            await http.post(API.auth.forgotPassword, { email });
            setSent(true);
        } catch (err: unknown) {
            const error = err as AxiosError;
            const message = (error.response?.data as { message?: string })?.message;
            toast.error(message || 'Failed to send reset email. Try again.');
        } finally {
            setIsPending(false);
        }
    };

    if (sent) {
        return (
            <div className="space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#fedc03]/15 flex items-center justify-center mx-auto">
                    <Mail className="w-7 h-7 text-[#d9bc00]" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Check your email</h2>
                    <p className="text-muted-foreground text-sm">
                        We sent a password reset link to <span className="font-semibold text-foreground">{email}</span>.
                        Check your inbox and follow the link.
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Didn't receive it?{' '}
                    <button
                        type="button"
                        onClick={() => setSent(false)}
                        className="font-semibold text-foreground hover:underline"
                    >
                        Resend
                    </button>
                </p>
                <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to sign in
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold font-display tracking-tight mb-2">Forgot password?</h2>
                <p className="text-muted-foreground text-sm">
                    Enter your account email and we'll send you a reset link.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isPending}
                            className={cn(
                                'w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30',
                                isPending && 'opacity-50'
                            )}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-2"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                </button>
            </form>

            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
            </Link>
        </div>
    );
}
