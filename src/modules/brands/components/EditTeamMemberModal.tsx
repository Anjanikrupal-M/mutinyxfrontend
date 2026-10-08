import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { BrandMultiSelect } from './BrandMultiSelect';
import {
    useUpdateTeamMember,
    useSetTeamMemberBrands,
    useSetTeamMemberPassword,
    type TeamMember,
} from '../hooks/useTeam';

interface EditTeamMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: TeamMember;
    // Agency owners can change which brands a member manages; a Brand-plan owner has a
    // single brand and only edits the profile fields.
    isAgencyOwner: boolean;
    assignableBrands: { id: string; brandName: string }[];
}

// Mirrors the backend rule in team.schema.ts — checked here only to give immediate feedback;
// the server re-validates and is the authority.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_HINT =
    'At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character (@$!%*?&).';

const inputClass =
    'w-full h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30';

// Edit a team member's profile (name, email, phone), their brand assignments, and — in a
// separate confirm-style section — their password.
export function EditTeamMemberModal({ open, onOpenChange, member, isAgencyOwner, assignableBrands }: EditTeamMemberModalProps) {
    const { mutateAsync: updateMember, isPending: isUpdating } = useUpdateTeamMember();
    const { mutateAsync: setBrands, isPending: isSettingBrands } = useSetTeamMemberBrands();
    const { mutateAsync: setPassword, isPending: isSettingPassword } = useSetTeamMemberPassword();

    const [name, setName] = useState(member.name);
    const [email, setEmail] = useState(member.email);
    const [phone, setPhone] = useState(member.phoneNumber ?? '');
    const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(member.brands.map((b) => b.id));
    const [error, setError] = useState<string | null>(null);

    // Password lives behind a toggle so the common case (fixing a name) never puts an empty
    // password box in front of the owner.
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [revealPassword, setRevealPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Re-seed local state whenever the modal opens for a (possibly refreshed) member.
    useEffect(() => {
        if (open) {
            setName(member.name);
            setEmail(member.email);
            setPhone(member.phoneNumber ?? '');
            setSelectedBrandIds(member.brands.map((b) => b.id));
            setError(null);
            setShowPasswordSection(false);
            setNewPassword('');
            setRevealPassword(false);
            setPasswordError(null);
        }
    }, [open, member]);

    const sanitize = (val: string) => val.replace(/^\s+/, '').replace(/<\/?\s*script[^>]*>/gi, '');
    const isPending = isUpdating || isSettingBrands;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const originalPhone = member.phoneNumber ?? '';

    const currentBrandIds = member.brands.map((b) => b.id).sort().join(',');
    const nextBrandIds = [...selectedBrandIds].sort().join(',');

    const nameChanged = trimmedName !== member.name && trimmedName.length > 0;
    const emailChanged = trimmedEmail !== member.email.toLowerCase() && trimmedEmail.length > 0;
    const phoneChanged = trimmedPhone !== originalPhone;
    const brandsChanged = isAgencyOwner && nextBrandIds !== currentBrandIds;

    const profileChanged = nameChanged || emailChanged || phoneChanged;
    const canSave = (profileChanged || brandsChanged) && trimmedName.length > 0;

    const handleSave = async () => {
        if (!trimmedName) { setError('Name is required'); return; }
        if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError('Enter a valid email address');
            return;
        }
        setError(null);
        try {
            if (profileChanged) {
                await updateMember({
                    managerId: member.id,
                    ...(nameChanged ? { name: trimmedName } : {}),
                    ...(emailChanged ? { email: trimmedEmail } : {}),
                    // An emptied field clears the number rather than sending "".
                    ...(phoneChanged ? { phoneNumber: trimmedPhone === '' ? null : trimmedPhone } : {}),
                });
            }
            if (brandsChanged) await setBrands({ managerId: member.id, brandProfileIds: selectedBrandIds });
            onOpenChange(false);
        } catch (e: any) {
            setError(e?.response?.data?.error?.message ?? 'Failed to save changes. Please try again.');
        }
    };

    const handleSetPassword = async () => {
        if (!PASSWORD_RULE.test(newPassword)) {
            setPasswordError(PASSWORD_HINT);
            return;
        }
        setPasswordError(null);
        try {
            await setPassword({ managerId: member.id, password: newPassword });
            setNewPassword('');
            setShowPasswordSection(false);
        } catch (e: any) {
            setPasswordError(e?.response?.data?.error?.message ?? 'Failed to update the password. Please try again.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit team member</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold mb-1.5 block">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            maxLength={255}
                            placeholder="Team member's full name"
                            onChange={(e) => setName(sanitize(e.target.value))}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold mb-1.5 block">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            maxLength={255}
                            placeholder="name@company.com"
                            onChange={(e) => setEmail(sanitize(e.target.value))}
                            className={inputClass}
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">
                            This is their login. Changing it changes how they sign in — tell them before you save.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-semibold mb-1.5 block">
                            Phone Number <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            maxLength={20}
                            placeholder="+919876543210"
                            onChange={(e) => setPhone(sanitize(e.target.value))}
                            className={inputClass}
                        />
                    </div>

                    {isAgencyOwner && (
                        <div>
                            <label className="text-sm font-semibold mb-1.5 block">Assigned brands</label>
                            {assignableBrands.length === 0 ? (
                                <p className="text-xs text-muted-foreground">You have no brands yet.</p>
                            ) : (
                                <BrandMultiSelect
                                    brands={assignableBrands}
                                    selectedIds={selectedBrandIds}
                                    onChange={setSelectedBrandIds}
                                    placeholder="Assign brands…"
                                    disabled={isPending}
                                />
                            )}
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Removing a brand also unassigns them from managing it — their past work stays.
                            </p>
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!canSave || isPending}>
                            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                            Save changes
                        </Button>
                    </div>

                    {/* Password sits below its own divider and saves independently of the form
                        above — it is a different kind of action, and mixing it into "Save
                        changes" would make a stray keystroke sign someone out. */}
                    <div className="border-t border-border pt-4">
                        {!showPasswordSection ? (
                            <button
                                type="button"
                                onClick={() => setShowPasswordSection(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4"
                            >
                                <KeyRound className="w-4 h-4" />
                                Change password
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold block">New password</label>
                                <div className="relative">
                                    <input
                                        type={revealPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        autoComplete="new-password"
                                        placeholder="Set a new password"
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={`${inputClass} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setRevealPassword((v) => !v)}
                                        aria-label={revealPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {revealPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                                <p className="text-xs text-muted-foreground">
                                    They'll be signed out on every device and will need the new password to get back in.
                                </p>
                                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                                <div className="flex justify-end gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowPasswordSection(false);
                                            setNewPassword('');
                                            setPasswordError(null);
                                        }}
                                        disabled={isSettingPassword}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSetPassword}
                                        disabled={newPassword.length === 0 || isSettingPassword}
                                    >
                                        {isSettingPassword && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                                        Update password
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
