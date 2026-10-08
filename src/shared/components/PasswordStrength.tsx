import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
    password: string;
}

export function validatePassword(password: string) {
    return {
        length: password.length >= 8 && password.length <= 100,
        capital: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password),
    };
}

export function isPasswordStrong(password: string) {
    const checks = validatePassword(password);
    return Object.values(checks).every(Boolean);
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
    if (!password) return null;

    const checks = validatePassword(password);
    const score = Object.values(checks).filter(Boolean).length;
    
    const getProgressColor = () => {
        if (score === 1) return 'bg-red-500';
        if (score === 2) return 'bg-orange-500';
        if (score === 3) return 'bg-yellow-500';
        if (score === 4) return 'bg-green-500';
        return 'bg-muted';
    };

    return (
        <div className="space-y-2 mt-2">
            <div className="flex gap-1 h-1.5 w-full">
                {[1, 2, 3, 4].map((step) => (
                    <div
                        key={step}
                        className={cn(
                            "h-full flex-1 rounded-full transition-colors",
                            score >= step ? getProgressColor() : "bg-muted"
                        )}
                    />
                ))}
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 mt-3">
                <div className={cn("flex items-center gap-2 transition-colors", checks.length ? "text-green-500" : "")}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    8-100 characters
                </div>
                <div className={cn("flex items-center gap-2 transition-colors", checks.capital ? "text-green-500" : "")}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    Contains a capital letter
                </div>
                <div className={cn("flex items-center gap-2 transition-colors", checks.lowercase ? "text-green-500" : "")}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    Contains lowercase letters
                </div>
                <div className={cn("flex items-center gap-2 transition-colors", checks.symbol ? "text-green-500" : "")}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    Contains a symbol
                </div>
            </div>
        </div>
    );
}
