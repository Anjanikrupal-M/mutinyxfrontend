import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, Loader2, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { useCreateTeamMember } from '../hooks/useTeam';
import { BrandMultiSelect } from './BrandMultiSelect';

function generatePassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '@$!%*?&';
    const all = upper + lower + digits + special;

    const mandatory = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        special[Math.floor(Math.random() * special.length)],
    ];

    const extra = Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)]);
    return [...mandatory, ...extra].sort(() => Math.random() - 0.5).join('');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

interface CreateTeamMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Agency owners can optionally assign the new member to any of their brands; a
    // Brand-plan owner has a single brand, so the member is scoped to it automatically.
    isAgencyOwner: boolean;
    assignableBrands: { id: string; brandName: string }[];
    // The Brand-plan owner's single active brand — the member is scoped to it.
    activeBrandId?: string | null;
}

export function CreateTeamMemberModal({
    open,
    onOpenChange,
    isAgencyOwner,
    assignableBrands,
    activeBrandId,
}: CreateTeamMemberModalProps) {
    const navigate = useNavigate();
    const { mutate: createTeamMember, isPending: isCreating } = useCreateTeamMember();

    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [needsUpgrade, setNeedsUpgrade] = useState(false);

    const sanitize = (val: string) => val.replace(/^\s+/, '').replace(/<\/?\s*script[^>]*>/gi, '');

    const handleGeneratePassword = () => {
        setForm((prev) => ({ ...prev, password: generatePassword() }));
        setShowPassword(true);
    };

    const handleCopyPassword = () => {
        if (!form.password) return;
        navigator.clipboard.writeText(form.password);
        toast.success('Password copied to clipboard');
    };

    const resetAndClose = () => {
        setForm({ name: '', email: '', password: '' });
        setSelectedBrandIds([]);
        setShowPassword(false);
        setFormError(null);
        setNeedsUpgrade(false);
        onOpenChange(false);
    };

    const handleInvite = () => {
        if (!form.name.trim()) { setFormError('Name is required'); return; }
        if (!form.email.trim()) { setFormError('Email is required'); return; }
        if (!EMAIL_REGEX.test(form.email)) { setFormError('Enter a valid email address'); return; }
        if (!form.password) { setFormError('Password is required — use the Generate button or enter one manually'); return; }
        if (!PASSWORD_REGEX.test(form.password)) {
            setFormError('Password must be at least 8 characters and contain uppercase, lowercase, a number, and a special character (@$!%*?&)');
            return;
        }

        // Brand assignment is optional. Agency owners assign the picked brands (or none —
        // they can assign later from a brand's screen); a Brand-plan owner is scoped to
        // their single active brand.
        const brandProfileIds = isAgencyOwner
            ? selectedBrandIds
            : (activeBrandId ? [activeBrandId] : []);

        setFormError(null);
        setNeedsUpgrade(false);
        createTeamMember(
            { name: form.name.trim(), email: form.email.trim(), password: form.password, brandProfileIds },
            {
                onSuccess: () => resetAndClose(),
                onError: (error: any) => {
                    const message = error?.response?.data?.error?.message ?? 'Failed to add team member. Please try again.';
                    setFormError(message);
                    setNeedsUpgrade(error?.response?.data?.error?.code === 'PLAN_UPGRADE_REQUIRED');
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) resetAndClose(); else onOpenChange(next); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Invite a team member</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Team members can manage your campaigns on your behalf. Their login credentials are emailed to them.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-semibold mb-1.5 block">Full Name</label>
                            <input
                                type="text"
                                value={form.name}
                                maxLength={50}
                                placeholder="Team member's full name"
                                onChange={(e) => setForm({ ...form, name: sanitize(e.target.value) })}
                                className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1.5 block">Email Address</label>
                            <input
                                type="email"
                                value={form.email}
                                maxLength={255}
                                placeholder="member@example.com"
                                onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
                                className="w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold mb-1.5 block">Password</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    maxLength={255}
                                    placeholder="Enter or generate a password"
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="w-full h-10 px-4 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-premium"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleGeneratePassword}
                                className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border bg-secondary text-sm font-medium hover:bg-secondary/80 transition-premium whitespace-nowrap"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Generate
                            </button>
                            {form.password && (
                                <button
                                    type="button"
                                    onClick={handleCopyPassword}
                                    className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border bg-secondary text-sm font-medium hover:bg-secondary/80 transition-premium"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            They receive this password by email and can change it via Forgot Password.
                        </p>
                    </div>

                    {/* Agency owners may optionally assign brands now — or leave it empty and
                        assign later from a brand's management screen. */}
                    {isAgencyOwner && (
                        <div>
                            <label className="text-sm font-semibold mb-1.5 block">
                                Assign to brands <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            {assignableBrands.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    You have no brands yet. Add one from the Brands page first.
                                </p>
                            ) : (
                                <BrandMultiSelect
                                    brands={assignableBrands}
                                    selectedIds={selectedBrandIds}
                                    onChange={setSelectedBrandIds}
                                    placeholder="Assign later, or pick brands…"
                                />
                            )}
                        </div>
                    )}

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    {needsUpgrade && (
                        <button
                            onClick={() => { resetAndClose(); navigate('/subscription'); }}
                            className="flex items-center gap-1.5 text-sm font-medium text-primary-foreground bg-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-premium w-fit"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            View plans
                        </button>
                    )}

                    <Button onClick={handleInvite} disabled={isCreating} className="w-full">
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {isCreating ? 'Sending Invitation…' : 'Send Invitation'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
