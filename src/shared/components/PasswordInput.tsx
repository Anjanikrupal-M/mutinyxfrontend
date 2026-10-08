import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function PasswordInput({
    value,
    onChange,
    disabled = false,
    placeholder = '••••••••',
}: PasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
                type={showPassword ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={cn(
                    'w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-card text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30',
                    disabled && 'opacity-50',
                )}
            />
            <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={disabled}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
                {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                ) : (
                    <Eye className="w-4 h-4" />
                )}
            </button>
        </div>
    );
}
