import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import {
    Save, Upload, Building2, Globe, MapPin, Languages, Tag,
    Loader2, User, AlertTriangle, ChevronLeft, Trash2, Pencil, X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useMe, useUpdateProfile, useUploadAvatar, useDeleteAvatar, useUpdateAccount } from '@/shared/hooks/useAuth';
import type { User as AuthUser } from '@/shared/stores/authStore';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useBrandProfiles, useSwitchBrand, getBrandRoleLabel } from '@/shared/hooks/useBrandProfiles';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';
import { getMissingBrandProfileItems } from '@/core/guards';
import { SocialAccountsSection } from './components/SocialAccountsSection';

const INDUSTRIES = [
    'Food & Beverage', 'Fashion & Beauty', 'Entertainment & Media',
    'Tech (Apps & SaaS)', 'Education & Coaching', 'Real Estate',
    'Hospitality & Travel', 'Local Business', 'Healthcare / Medical',
    'Agencies', 'Jewellery & Accessories', 'Health & Fitness',
    'Automobiles', 'Finance & Fintech', 'Electronics & Gadgets',
    'Baby & Parenting', 'NGO & Social Cause', 'Others',
];
const LANGUAGES = [
    'Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam',
    'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Odia', 'Assamese',
    'Urdu', 'Sanskrit',
];

export default function ProfilePage() {
    const navigate = useNavigate();
    const meQuery = useMe();
    const profile = meQuery.data as AuthUser | undefined;
    const { isLoading } = meQuery;
    const isInfluencer = profile?.role === 'influencer';
    const isAgent = profile?.role === 'agent';
    const { isAgencyOwner, isManager } = useIsAgencyOwner();
    const { data: brandProfiles } = useBrandProfiles(isAgencyOwner || isManager);
    const { mutate: switchBrand, isPending: isSwitchingBrand } = useSwitchBrand();
    const { mutateAsync: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile();
    const { mutateAsync: updateAccount, isPending: isUpdatingAccount } = useUpdateAccount();
    const isPending = isUpdatingProfile || isUpdatingAccount;
    const { mutate: uploadAvatar, isPending: isUploading } = useUploadAvatar();
    const { mutateAsync: deleteAvatar, isPending: isDeleting } = useDeleteAvatar();
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
    const [portfolioInput, setPortfolioInput] = useState('');
    const [searchParams] = useSearchParams();
    const [isEditing, setIsEditing] = useState(false);

    const missingProfileItems = getMissingBrandProfileItems(profile ?? null);
    const isProfileComplete = missingProfileItems.length === 0;
    const showIncompleteWarning = searchParams.get('incomplete') === '1' && !isProfileComplete;

    const [form, setForm] = useState({
        name: '', brandName: '', website: '', pincode: '', city: '', state: '',
        primaryLanguage: '', industry: '', bio: '', acceptingCollabs: true,
        featuredPortfolioIds: [] as string[],
        socialLinks: { instagram: '', youtube: '' },
        settings: { theme: 'system' as 'light' | 'dark' | 'system', compactMode: false, emailNotifications: true },
    });

    const resetForm = (p: AuthUser) => setForm({
        name: p.name || '', brandName: p.brandName || '', website: p.website || '',
        pincode: p.pincode || '', city: p.city || '', state: p.state || '',
        primaryLanguage: p.primaryLanguage || '', industry: p.industry || '',
        bio: p.bio || '', acceptingCollabs: p.acceptingCollabs ?? true,
        featuredPortfolioIds: p.featuredPortfolioIds || [],
        socialLinks: {
            instagram: p.socialLinks?.instagram || '',
            youtube: p.socialLinks?.youtube || '',
        },
        settings: {
            theme: (p.settings?.theme as 'light' | 'dark' | 'system') || 'system',
            compactMode: Boolean(p.settings?.compactMode),
            emailNotifications: p.settings?.emailNotifications ?? true,
        },
    });

    useEffect(() => { if (profile) resetForm(profile); }, [profile]);

    const isDirty = useMemo(() => {
        if (!profile) return false;
        const init = {
            name: profile.name || '', brandName: profile.brandName || '', website: profile.website || '',
            pincode: profile.pincode || '', city: profile.city || '', state: profile.state || '',
            primaryLanguage: profile.primaryLanguage || '', industry: profile.industry || '',
            bio: profile.bio || '', acceptingCollabs: profile.acceptingCollabs ?? true,
            featuredPortfolioIds: profile.featuredPortfolioIds || [],
            socialLinks: {
                instagram: profile.socialLinks?.instagram || '',
                youtube: profile.socialLinks?.youtube || '',
            },
            settings: {
                theme: (profile.settings?.theme as 'light' | 'dark' | 'system') || 'system',
                compactMode: Boolean(profile.settings?.compactMode),
                emailNotifications: profile.settings?.emailNotifications ?? true,
            },
        };
        return JSON.stringify(form) !== JSON.stringify(init);
    }, [profile, form]);

    const update = (key: string, value: unknown) => setForm(p => ({ ...p, [key]: value }));

    const fieldErrors = {
        website: form.website.length > 255 ? 'Max 255 chars.'
            : (form.website.trim() && !form.website.trim().startsWith('https://') && !form.website.trim().startsWith('http://'))
                ? 'Must start with http:// or https://' : '',
        state: form.state.length > 100 ? 'Max 100 chars.' : '',
        city: form.city.length > 255 ? 'Max 255 chars.' : '',
    };

    useEffect(() => {
        if (form.pincode && form.pincode.length === 6) {
            fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
                .then(r => r.json())
                .then(data => {
                    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
                        const po = data[0].PostOffice[0];
                        setForm(p => ({ ...p, city: po.District || po.Region || p.city, state: po.State || p.state }));
                    }
                })
                .catch(() => {});
        }
    }, [form.pincode]);

    const handleSave = async () => {
        const errs: string[] = [];
        if (!form.name.trim()) errs.push(isInfluencer ? 'Full Name is required.' : isAgent ? 'Agent Name is required.' : 'Brand Owner Name is required.');
        else if (form.name.length > 50) errs.push('Name cannot exceed 50 characters.');
        if (!isInfluencer) {
            if (!form.brandName.trim()) errs.push('Brand Name is required.');
            else if (form.brandName.length > 50) errs.push('Brand Name cannot exceed 50 characters.');
            if (form.bio.length > 2000) errs.push('Bio cannot exceed 2000 characters.');
            if (!form.city.trim()) errs.push('City / Region is required.');
            if (!form.industry) errs.push('Industry is required.');
            if (!form.primaryLanguage) errs.push('Primary Language is required.');
        }
        if (errs.length > 0) { errs.forEach(e => toast.error(e)); return; }
        if (Object.values(fieldErrors).some(Boolean)) { toast.error('Please correct the highlighted fields.'); return; }
        try {
            if (isAgent) await updateAccount({ name: form.name, email: profile?.email || '' });
            else await updateProfile(form);
            toast.success('Profile updated successfully.');
            setIsEditing(false);
        } catch { /* hook handles */ }
    };

    const handleCancel = () => { if (profile) resetForm(profile); setIsEditing(false); };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.error('Only JPG/PNG allowed.'); e.target.value = ''; return; }
        if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB.'); e.target.value = ''; return; }
        if (!window.confirm('Upload this image as your logo?')) { e.target.value = ''; return; }
        setLocalAvatarUrl(URL.createObjectURL(file));
        uploadAvatar(file, {
            onSuccess: () => setTimeout(() => setLocalAvatarUrl(null), 1000),
            onError: () => setLocalAvatarUrl(null),
        });
        e.target.value = '';
    };

    // For brands the logo is brandLogoUrl only — do NOT fall back to the user's avatarUrl.
    // The fallback showed a non-logo image when no logo was set (which the completion gate
    // correctly ignores) and kept a stale preview after deletion even though the header —
    // which reads brandLogoUrl alone — had already cleared. This keeps both in sync.
    const avatarSrc = isInfluencer ? profile?.avatarUrl : profile?.brandLogoUrl;
    const avatarFallback = (isInfluencer ? form.name : form.brandName)?.charAt(0)?.toUpperCase() || 'B';

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[40vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="w-full animate-fade-in">

            {/* ── Page header ── */}
            <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 hover:bg-secondary rounded-lg transition-premium text-muted-foreground hover:text-foreground"
                        title="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold font-display tracking-tight">
                                {isInfluencer ? 'Influencer Profile' : 'Brand Profile'}
                            </h1>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {isInfluencer ? 'Manage your creator profile' : 'Manage your brand details and preferences'}
                        </p>
                    </div>
                </div>

                {isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleCancel}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-premium">
                            <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                        <button onClick={handleSave} disabled={isPending || !isDirty}
                            className={cn(
                                'flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-premium',
                                isDirty && !isPending
                                    ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-[0_0_0_3px_hsl(51_99%_50%/0.2)]'
                                    : 'bg-primary/40 text-primary-foreground cursor-not-allowed'
                            )}>
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Incomplete warning ── */}
            {showIncompleteWarning && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Complete your profile to create campaigns</p>
                        <ul className="text-xs text-amber-700 mt-1 list-disc list-inside space-y-0.5">
                            {missingProfileItems.map(item => <li key={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            {/* ── Main 2-col grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">

                {/* LEFT COLUMN */}
                <div className="space-y-3">

                    {/* Avatar card */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        {/* Coloured banner */}
                        <div className="h-16 bg-gradient-to-r from-[#fedc03]/30 via-[#fedc03]/10 to-transparent" />
                        <div className="px-5 pb-5 -mt-9">
                            {/* Avatar */}
                            <div className="relative w-16 h-16 mb-3">
                                <div className="w-16 h-16 rounded-2xl bg-secondary border-2 border-card overflow-hidden flex items-center justify-center text-xl font-bold text-muted-foreground shadow-md">
                                    {localAvatarUrl ? (
                                        <img src={localAvatarUrl} alt="Logo" className="w-full h-full object-cover" />
                                    ) : avatarSrc ? (
                                        <ApiImage src={avatarSrc} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{avatarFallback}</span>
                                    )}
                                </div>
                                {(isUploading || isDeleting) && (
                                    <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Name — inline editable when editing */}
                            {isEditing && !isAgent ? (
                                <input
                                    type="text"
                                    value={isInfluencer ? form.name : form.brandName}
                                    onChange={e => update(isInfluencer ? 'name' : 'brandName', e.target.value)}
                                    maxLength={50}
                                    placeholder={isInfluencer ? 'Your name' : 'Brand name'}
                                    className="w-full text-base font-bold font-display bg-transparent border-b-2 border-[#fedc03]/70 focus:outline-none focus:border-[#fedc03] pb-0.5 mb-0.5 transition-colors"
                                />
                            ) : (
                                <p className="text-base font-bold font-display truncate">{profile?.brandName || profile?.name}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>

                            {/* Badges */}
                            {isInfluencer && profile?.badges && profile.badges.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {profile.badges.map(bk => {
                                        const meta = BADGE_METADATA[bk];
                                        if (!meta) return null;
                                        const Icon = meta.icon;
                                        return (
                                            <div key={bk} title={meta.description}
                                                className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border', meta.bgClass, meta.textClass, meta.borderClass)}>
                                                <Icon className="w-2.5 h-2.5" /><span>{meta.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Upload / delete */}
                            {!isAgent && (
                                <div className="flex items-center gap-2 mt-3">
                                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-secondary transition-premium cursor-pointer">
                                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                        {isUploading ? 'Uploading…' : isInfluencer ? 'Upload Photo' : 'Upload Logo'}
                                        <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
                                    </label>
                                    {(avatarSrc || localAvatarUrl) && (
                                        <button
                                            onClick={async () => {
                                                if (window.confirm('Delete your logo?')) {
                                                    try { await deleteAvatar(); setLocalAvatarUrl(null); toast.success('Logo deleted.'); } catch { /* handled */ }
                                                }
                                            }}
                                            disabled={isUploading || isPending || isDeleting}
                                            className="p-1.5 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-premium"
                                            title="Delete logo"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Social Accounts */}
                    {isInfluencer ? (
                        <SocialAccountsSection canManage={true} socialConnected={profile?.socialConnected} />
                    ) : !isAgent ? (
                        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold">Brand Social Accounts</h3>
                                <p className="text-xs text-muted-foreground">Official social media handles for {profile?.brandName || 'your brand'}.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                                    <input
                                        type="text"
                                        value={form.socialLinks.instagram}
                                        readOnly={!isEditing}
                                        onClick={() => { if (!isEditing) setIsEditing(true); }}
                                        placeholder="@brand or profile URL"
                                        onChange={(e) => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, instagram: e.target.value } }))}
                                        className={cn('w-full h-9 px-3 rounded-xl border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-[#fedc03]/30 transition-all cursor-pointer', isEditing && 'cursor-text')}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">YouTube</label>
                                    <input
                                        type="text"
                                        value={form.socialLinks.youtube}
                                        readOnly={!isEditing}
                                        onClick={() => { if (!isEditing) setIsEditing(true); }}
                                        placeholder="@channel or URL"
                                        onChange={(e) => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, youtube: e.target.value } }))}
                                        className={cn('w-full h-9 px-3 rounded-xl border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-[#fedc03]/30 transition-all cursor-pointer', isEditing && 'cursor-text')}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Brand Switcher */}
                    {(isAgencyOwner ? (brandProfiles?.length ?? 0) > 0 : (brandProfiles?.length ?? 0) > 1) && (
                        <div className="bg-card border border-border rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Managing brand</p>
                                {isAgencyOwner && (
                                    <button onClick={() => navigate('/brands')} className="text-xs font-semibold text-foreground hover:underline">
                                        Manage all →
                                    </button>
                                )}
                            </div>
                            <Select
                                value={profile?.brandId}
                                disabled={isSwitchingBrand}
                                onValueChange={(brandId) => {
                                    if (brandId === profile?.brandId) return;
                                    switchBrand(brandId, { onError: () => toast.error('Failed to switch brand.') });
                                }}
                            >
                                <SelectTrigger className="w-full h-9 text-sm">
                                    <SelectValue placeholder="Select a brand" />
                                </SelectTrigger>
                                <SelectContent>
                                    {brandProfiles.map((b, i) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.brandName} — {getBrandRoleLabel(b, i)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                        <span className="w-1 h-4 rounded-full bg-[#fedc03] shrink-0" />
                        <p className="text-sm font-semibold text-foreground">
                            {isInfluencer ? 'Creator Details' : isAgent ? 'Agent Details' : 'Brand Details'}
                        </p>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <EField label={isInfluencer ? 'Full Name' : isAgent ? 'Agent Name' : 'Brand Owner Name'} icon={User} required>
                                <input
                                    type="text"
                                    value={form.name}
                                    readOnly={!isEditing}
                                    onClick={() => { if (!isEditing) setIsEditing(true); }}
                                    onChange={e => update('name', e.target.value)}
                                    maxLength={50}
                                    className={cn('w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text')}
                                />
                            </EField>
                            {!isInfluencer && (
                                <EField label="Brand Name" icon={Building2} required>
                                    <input
                                        type="text"
                                        value={form.brandName}
                                        readOnly={!isEditing}
                                        disabled={isAgent}
                                        onClick={() => { if (!isEditing) setIsEditing(true); }}
                                        onChange={e => update('brandName', e.target.value)}
                                        maxLength={50}
                                        className={cn('w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed')}
                                    />
                                </EField>
                            )}
                        </div>

                        {!isInfluencer && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <EField label="Website / App Link" icon={Globe}>
                                        <input
                                            type="url"
                                            value={form.website}
                                            readOnly={!isEditing}
                                            disabled={isAgent}
                                            onClick={() => { if (!isEditing) setIsEditing(true); }}
                                            onChange={e => update('website', e.target.value)}
                                            placeholder="https://"
                                            maxLength={255}
                                            className={cn('w-full h-10 px-3.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed', fieldErrors.website ? 'border-destructive' : 'border-border')}
                                        />
                                        {fieldErrors.website && <p className="text-xs text-destructive mt-1">{fieldErrors.website}</p>}
                                    </EField>
                                    <EField label="City / Region" icon={MapPin} required>
                                        <input
                                            type="text"
                                            value={form.city}
                                            readOnly={!isEditing}
                                            disabled={isAgent}
                                            onClick={() => { if (!isEditing) setIsEditing(true); }}
                                            onChange={e => update('city', e.target.value)}
                                            placeholder="City…"
                                            maxLength={255}
                                            className={cn('w-full h-10 px-3.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed', fieldErrors.city ? 'border-destructive' : 'border-border')}
                                        />
                                        {fieldErrors.city && <p className="text-xs text-destructive mt-1">{fieldErrors.city}</p>}
                                    </EField>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <EField label="State" icon={MapPin}>
                                        <input
                                            type="text"
                                            value={form.state}
                                            readOnly={!isEditing}
                                            disabled={isAgent}
                                            onClick={() => { if (!isEditing) setIsEditing(true); }}
                                            onChange={e => update('state', e.target.value)}
                                            placeholder="State"
                                            maxLength={100}
                                            className={cn('w-full h-10 px-3.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed', fieldErrors.state ? 'border-destructive' : 'border-border')}
                                        />
                                    </EField>
                                    <EField label="Pincode" icon={MapPin}>
                                        <input
                                            type="text"
                                            value={form.pincode}
                                            readOnly={!isEditing}
                                            disabled={isAgent}
                                            onClick={() => { if (!isEditing) setIsEditing(true); }}
                                            onChange={e => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="6-digit pincode"
                                            maxLength={6}
                                            className={cn('w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed')}
                                        />
                                    </EField>
                                </div>

                                <EField label="Bio / Description">
                                    <textarea
                                        value={form.bio}
                                        readOnly={!isEditing}
                                        disabled={isAgent}
                                        onClick={() => { if (!isEditing) setIsEditing(true); }}
                                        onChange={e => update('bio', e.target.value)}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Tell creators about your brand…"
                                        className={cn('w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25 focus:border-[#fedc03]/70 resize-none transition-all cursor-pointer', isEditing && 'cursor-text', isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed')}
                                    />
                                    {isEditing && <p className="text-right text-xs text-muted-foreground mt-1">{form.bio.length}/2000</p>}
                                </EField>

                                <EField label="Industry" icon={Building2} required>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {INDUSTRIES.map(i => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => {
                                                    if (!isEditing) setIsEditing(true);
                                                    update('industry', i);
                                                }}
                                                disabled={isAgent}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer',
                                                    form.industry === i
                                                        ? 'border-[#fedc03] bg-[#fedc03] text-black shadow-sm font-bold opacity-100 scale-105'
                                                        : 'border-border bg-background text-muted-foreground/80 hover:border-foreground/30 hover:text-foreground',
                                                    isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed'
                                                )}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                </EField>

                                <EField label="Primary Language" icon={Languages} required>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {LANGUAGES.map(l => (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => {
                                                    if (!isEditing) setIsEditing(true);
                                                    update('primaryLanguage', l);
                                                }}
                                                disabled={isAgent}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer',
                                                    form.primaryLanguage === l
                                                        ? 'border-[#fedc03] bg-[#fedc03] text-black shadow-sm font-bold opacity-100 scale-105'
                                                        : 'border-border bg-background text-muted-foreground/80 hover:border-foreground/30 hover:text-foreground',
                                                    isAgent && 'disabled:opacity-50 disabled:cursor-not-allowed'
                                                )}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </EField>
                            </>
                        )}

                        {isInfluencer && (
                            <>
                                <EField label="Available for Work" icon={Tag}>
                                    {isEditing ? (
                                        <button type="button" onClick={() => update('acceptingCollabs', !form.acceptingCollabs)}
                                            className={cn('px-4 py-2 rounded-xl border text-sm font-medium transition-premium',
                                                form.acceptingCollabs
                                                    ? 'border-[#fedc03] bg-[#fedc03] text-black'
                                                    : 'border-border text-muted-foreground hover:border-foreground/30'
                                            )}>
                                            {form.acceptingCollabs ? 'Yes, accepting collaborations' : 'Not accepting collaborations'}
                                        </button>
                                    ) : (
                                        <p className="text-sm font-semibold">{form.acceptingCollabs ? 'Yes, accepting collaborations' : 'Not accepting collaborations'}</p>
                                    )}
                                </EField>

                                <EField label="Featured Portfolio IDs (max 10)">
                                    {isEditing ? (
                                        <>
                                            <div className="flex gap-2 mb-2">
                                                <input type="text" value={portfolioInput} onChange={e => setPortfolioInput(e.target.value)}
                                                    placeholder="Enter portfolio item ID"
                                                    className="flex-1 h-10 px-3.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/25" />
                                                <button type="button" onClick={() => {
                                                    const next = portfolioInput.trim();
                                                    if (!next) return;
                                                    setForm(p => {
                                                        if (p.featuredPortfolioIds.includes(next) || p.featuredPortfolioIds.length >= 10) return p;
                                                        return { ...p, featuredPortfolioIds: [...p.featuredPortfolioIds, next] };
                                                    });
                                                    setPortfolioInput('');
                                                }} disabled={form.featuredPortfolioIds.length >= 10}
                                                    className="px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-premium disabled:opacity-50">Add</button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {form.featuredPortfolioIds.map(id => (
                                                    <button key={id} type="button"
                                                        onClick={() => setForm(p => ({ ...p, featuredPortfolioIds: p.featuredPortfolioIds.filter(x => x !== id) }))}
                                                        className="text-xs px-2 py-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-premium">{id} ×</button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {form.featuredPortfolioIds.length > 0 ? form.featuredPortfolioIds.map(id => (
                                                <span key={id} className="text-xs px-2.5 py-1 rounded-lg border border-border bg-secondary font-medium">{id}</span>
                                            )) : <p className="text-sm text-muted-foreground/40 italic">—</p>}
                                        </div>
                                    )}
                                </EField>

                                <EField label="Settings">
                                    {isEditing ? (
                                        <div className="flex flex-wrap gap-2">
                                            <select value={form.settings.theme}
                                                onChange={e => update('settings', { ...form.settings, theme: e.target.value as 'light' | 'dark' | 'system' })}
                                                className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none">
                                                <option value="system">Theme: System</option>
                                                <option value="light">Theme: Light</option>
                                                <option value="dark">Theme: Dark</option>
                                            </select>
                                            <button type="button" onClick={() => update('settings', { ...form.settings, compactMode: !form.settings.compactMode })}
                                                className={cn('h-9 px-3 rounded-lg border text-sm font-medium transition-premium', form.settings.compactMode ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/30')}>
                                                Compact: {form.settings.compactMode ? 'On' : 'Off'}
                                            </button>
                                            <button type="button" onClick={() => update('settings', { ...form.settings, emailNotifications: !form.settings.emailNotifications })}
                                                className={cn('h-9 px-3 rounded-lg border text-sm font-medium transition-premium', form.settings.emailNotifications ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/30')}>
                                                Email: {form.settings.emailNotifications ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-medium text-muted-foreground">Theme: {form.settings.theme} · Compact: {form.settings.compactMode ? 'On' : 'Off'}</p>
                                    )}
                                </EField>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Field wrapper for edit mode ── */
function EField({ label, icon: Icon, required, children }: {
    label: string; icon?: React.ElementType; required?: boolean; children: React.ReactNode;
}) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                {label}
                {required && <span className="text-destructive text-xs ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

/* ── Cell for view mode grid ── */
function VCell({ label, value, isLink, highlight, colSpan }: {
    label: string; value?: string; isLink?: boolean; highlight?: boolean; colSpan?: number;
}) {
    const cls = colSpan === 2 ? 'col-span-2' : colSpan === 3 ? 'col-span-3' : '';
    return (
        <div className={cn('px-6 py-4', cls)}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            {value ? (
                isLink ? (
                    <a href={value} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:underline truncate block">{value}</a>
                ) : (
                    <p className={cn('text-sm font-semibold truncate', highlight && 'text-foreground')}>{value}</p>
                )
            ) : (
                <p className="text-sm text-muted-foreground/40 italic">—</p>
            )}
        </div>
    );
}
