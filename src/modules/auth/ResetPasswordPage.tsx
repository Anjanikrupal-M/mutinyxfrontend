import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import http from '@/core/http';
import { API } from '@/core/api';
import type { AxiosError } from 'axios';
import { PasswordStrength, isPasswordStrong } from '@/shared/components/PasswordStrength';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isPending, setIsPending] = useState(false);

    if (!token) {
        return (
            <div className="space-y-6 text-center">
                <h2 className="text-2xl font-bold font-display tracking-tight">Invalid reset link</h2>
                <p className="text-muted-foreground text-sm">
                    This password reset link is invalid or has expired.
                </p>
                <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline">
                    Request a new link
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || !confirm) {
            toast.error('Please fill in both fields');
            return;
        }
        if (password.length > 100) {
            toast.error('Password must be 100 characters or fewer');
            return;
        }
        if (!isPasswordStrong(password)) {
            toast.error('Please ensure your password meets all requirements');
            return;
        }
        if (password !== confirm) {
            toast.error('Passwords do not match');
            return;
        }

        setIsPending(true);
        try {
            await http.post(API.auth.resetPassword, { token, password });
            toast.success('Password reset successfully. Please sign in.');
            navigate('/login');
        } catch (err: unknown) {
            const error = err as AxiosError;
            const message = (error.response?.data as { message?: string })?.message;
            toast.error(message || 'Reset failed. The link may have expired.');
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold font-display tracking-tight mb-2">Set new password</h2>
                <p className="text-muted-foreground text-sm">
                    Choose a strong password for your account.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold">New password</label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            placeholder="At least 8 characters"
                            value={password}
                            maxLength={100}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isPending}
                            className={cn(
                                'w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30',
                                isPending && 'opacity-50'
                            )}
                        />
                    </div>
                    <PasswordStrength password={password} />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold">Confirm password</label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            placeholder="Repeat your password"
                            value={confirm}
                            maxLength={100}
                            onChange={(e) => setConfirm(e.target.value)}
                            disabled={isPending}
                            className={cn(
                                'w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30',
                                confirm && password !== confirm ? 'border-destructive focus:ring-destructive/30' : '',
                                isPending && 'opacity-50'
                            )}
                        />
                    </div>
                    {confirm && password !== confirm && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isPending || !isPasswordStrong(password)}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-2"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset password'}
                </button>
            </form>

            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
            </Link>
        </div>
    );
}
