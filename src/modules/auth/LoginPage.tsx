import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useLogin } from '@/shared/hooks/useAuth';
import { useAuthStore } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

export default function LoginPage() {
    const navigate = useNavigate();
    const loginMutation = useLogin();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            toast.error('Please enter a valid email address.');
            return;
        }

        loginMutation.mutate({ email: email.trim(), password }, {
            onSuccess: () => {
                toast.success('Welcome back!');
            },
            onError: (err: unknown) => {
                const error = err as AxiosError;
                const message = (error.response?.data as { message?: string })?.message;
                toast.error(message || 'Invalid email or password');
            },
        });
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold font-display tracking-tight mb-2">Welcome back</h2>
                <p className="text-muted-foreground text-sm">
                    Enter your email below to log into your account
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
                            maxLength={254}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loginMutation.isPending}
                            className={cn(
                                "w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                loginMutation.isPending && "opacity-50"
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold">Password</label>
                        <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors">
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loginMutation.isPending}
                            className={cn(
                                "w-full h-12 pl-10 pr-11 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                loginMutation.isPending && "opacity-50"
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={loginMutation.isPending}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-premium disabled:opacity-50"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-6"
                >
                    {loginMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Sign In
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="text-center text-sm">
                <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-semibold text-foreground hover:underline">
                        Sign up instead
                    </Link>
                </p>
            </div>
        </div>
    );
}
