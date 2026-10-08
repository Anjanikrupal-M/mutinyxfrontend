import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Mail, Lock, User, Eye, EyeOff, Briefcase, KeyRound } from 'lucide-react';
import { useRegister, useVerifyEmail } from '@/shared/hooks/useAuth';
import { PasswordStrength, isPasswordStrong } from '@/shared/components/PasswordStrength';
import { useAuthStore } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

export default function RegisterPage() {
    const navigate = useNavigate();
    const registerMutation = useRegister();
    const verifyMutation = useVerifyEmail();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [role, setRole] = useState<'influencer' | 'brand_owner'>('influencer');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [brandName, setBrandName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // OTP State
    const [requiresVerification, setRequiresVerification] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !password) {
            toast.error('Please fill in required fields');
            return;
        }
        if (role === 'brand_owner' && !brandName) {
            toast.error('Please enter your Brand Name');
            return;
        }
        if (name.trim().length > 255) {
            toast.error('Name must be 255 characters or fewer');
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
        const normalizedEmail = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            toast.error('Please enter a valid email address.');
            return;
        }

        registerMutation.mutate({
            email: normalizedEmail,
            password,
            name,
            role: 'brand_owner',
            brandName: 'Test Brand',
        }, {
            onSuccess: (data: any) => {
                if (data?.requiresVerification) {
                    setRegisteredEmail(data.email);
                    setRequiresVerification(true);
                    toast.success('Verification code sent to your email.');
                } else {
                    toast.success('Account created successfully!');
                }
            },
            onError: (err: unknown) => {
                const error = err as AxiosError;
                if (error.response?.status === 409) {
                    toast.error('This email is already registered. Please log in.');
                } else {
                    const message = (error.response?.data as { message?: string })?.message;
                    toast.error(message || 'Failed to create account');
                }
            },
        });
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        if (otpCode.length !== 6) {
            toast.error('Please enter a valid 6-digit code');
            return;
        }
        verifyMutation.mutate({
            email: registeredEmail,
            code: otpCode
        }, {
            onSuccess: () => {
                toast.success('Email verified successfully!');
                navigate('/dashboard', { replace: true });
            },
            onError: (err: unknown) => {
                const error = err as AxiosError;
                const message = (error.response?.data as { error?: { message?: string } })?.error?.message;
                toast.error(message || 'Invalid or expired verification code');
            }
        });
    }

    if (requiresVerification) {
        return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-3xl font-bold font-display tracking-tight mb-2">Check your email</h2>
                    <p className="text-muted-foreground text-sm">
                        We sent a 6-digit verification code to <span className="font-medium text-foreground">{registeredEmail}</span>
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Verification Code *</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="123456"
                                value={otpCode}
                                maxLength={6}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                disabled={verifyMutation.isPending}
                                className={cn(
                                    "w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30 tracking-widest font-mono text-lg",
                                    verifyMutation.isPending && "opacity-50"
                                )}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={verifyMutation.isPending || otpCode.length !== 6}
                        className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-6"
                    >
                        {verifyMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Verify & Continue
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold font-display tracking-tight mb-2">Create an account</h2>
                <p className="text-muted-foreground text-sm">
                    Enter your details below to get started
                </p>
            </div>

            {/* Role Toggle (Commented out as requested) 
            <div className="flex p-1 bg-muted rounded-xl w-full">
                <button
                    type="button"
                    onClick={() => setRole('influencer')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                        role === 'influencer' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    I am a Creator
                </button>
                <button
                    type="button"
                    onClick={() => setRole('brand_owner')}
                    className={cn(
                        "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                        role === 'brand_owner' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    I am a Brand
                </button>
            </div>
            */}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Your name *</label>
                    <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="John Doe"
                            value={name}
                            maxLength={255}
                            onChange={(e) => setName(e.target.value)}
                            disabled={registerMutation.isPending}
                            className={cn(
                                "w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                registerMutation.isPending && "opacity-50"
                            )}
                        />
                    </div>
                </div>

                {/* Brand Name (Commented out as requested)
                {role === 'brand_owner' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-sm font-semibold">Brand Name *</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Acme Corp"
                                value={brandName}
                                maxLength={255}
                                onChange={(e) => setBrandName(e.target.value)}
                                disabled={registerMutation.isPending}
                                className={cn(
                                    "w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                    registerMutation.isPending && "opacity-50"
                                )}
                            />
                        </div>
                    </div>
                )}
                */}

                <div className="space-y-2">
                    <label className="text-sm font-semibold">Email *</label>
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            maxLength={254}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={registerMutation.isPending}
                            className={cn(
                                "w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                registerMutation.isPending && "opacity-50"
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold">Password *</label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            maxLength={100}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={registerMutation.isPending}
                            className={cn(
                                "w-full h-12 pl-10 pr-11 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30",
                                registerMutation.isPending && "opacity-50"
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={registerMutation.isPending}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-premium disabled:opacity-50"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <PasswordStrength password={password} />
                </div>

                <button
                    type="submit"
                    disabled={registerMutation.isPending || !isPasswordStrong(password)}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-6"
                >
                    {registerMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Create Account
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="text-center text-sm">
                <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-foreground hover:underline">
                        Sign in instead
                    </Link>
                </p>
            </div>
        </div>
    );
}
