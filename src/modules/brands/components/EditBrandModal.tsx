import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Globe, Loader2, Mail, MapPin, Save, Tag, Trash2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { ApiImage } from '@/shared/components/ApiImage';
import {
    useUpdateBrandDetail,
    useUploadBrandDetailLogo,
    useDeleteBrandDetailLogo,
    type BrandDetail,
} from '../hooks/useBrandDetail';

const INDUSTRIES = [
    'Food & Beverage', 'Fashion & Beauty', 'Entertainment & Media',
    'Tech (Apps & SaaS)', 'Education & Coaching', 'Real Estate',
    'Hospitality & Travel', 'Local Business', 'Healthcare / Medical',
    'Agencies', 'Jewellery & Accessories', 'Health & Fitness',
    'Automobiles', 'Finance & Fintech', 'Electronics & Gadgets',
    'Baby & Parenting', 'NGO & Social Cause', 'Others'
];

interface EditBrandModalProps {
    brand: BrandDetail;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditBrandModal({ brand, open, onOpenChange }: EditBrandModalProps) {
    const { mutate: updateBrand, isPending: isSaving } = useUpdateBrandDetail(brand.id);
    const { mutate: uploadLogo, isPending: isUploading } = useUploadBrandDetailLogo(brand.id);
    const { mutateAsync: deleteLogo, isPending: isDeletingLogo } = useDeleteBrandDetailLogo(brand.id);

    const [form, setForm] = useState({
        brandName: '',
        industry: '',
        website: '',
        city: '',
        state: '',
        pincode: '',
        primaryLanguage: '',
        bio: '',
        contactEmail: '',
        socialLinks: {
            instagram: '',
            youtube: '',
        },
    });

    // Reset the form to the current brand's values every time the modal opens, rather
    // than once at mount — the modal instance is reused across brands/reopens.
    useEffect(() => {
        if (!open) return;
        setForm({
            brandName: brand.brandName || '',
            industry: brand.industry || '',
            website: brand.website || '',
            city: brand.city || '',
            state: brand.state || '',
            pincode: brand.pincode || '',
            primaryLanguage: brand.primaryLanguage || '',
            bio: brand.bio || '',
            contactEmail: brand.contactEmail || '',
            socialLinks: {
                instagram: brand.socialLinks?.instagram || '',
                youtube: brand.socialLinks?.youtube || '',
            },
        });
    }, [open, brand]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowedMimeTypes = new Set(['image/jpeg', 'image/png']);
        if (!allowedMimeTypes.has(file.type)) {
            toast.error('Only JPG and PNG images are allowed.');
            return;
        }
        uploadLogo(file, {
            onSuccess: () => toast.success('Logo updated'),
            onError: () => toast.error('Failed to upload logo. Please try again.'),
        });
        e.target.value = '';
    };

    const handleDeleteLogo = async () => {
        if (!window.confirm('Remove this brand\'s logo?')) return;
        try {
            await deleteLogo();
            toast.success('Logo removed');
        } catch {
            toast.error('Failed to remove logo. Please try again.');
        }
    };

    const handleSave = () => {
        if (!form.brandName.trim()) {
            toast.error('Brand name is required');
            return;
        }
        if (form.brandName.length > 50) {
            toast.error('Brand name must be 50 characters or fewer.');
            return;
        }
        if (form.website.trim() && !form.website.trim().startsWith('http://') && !form.website.trim().startsWith('https://')) {
            toast.error('Website must start with http:// or https://');
            return;
        }
        updateBrand(form, {
            onSuccess: () => {
                toast.success('Brand profile updated');
                onOpenChange(false);
            },
            onError: () => toast.error('Failed to update brand. Please try again.'),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit brand profile</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Logo */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary border border-border shrink-0">
                            <ApiImage
                                src={brand.brandLogoUrl}
                                alt={brand.brandName}
                                className="w-full h-full object-cover"
                                fallbackText={brand.brandName.charAt(0)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium cursor-pointer">
                                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                Upload logo
                                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleLogoChange} disabled={isUploading} />
                            </label>
                            {brand.brandLogoUrl && (
                                <button
                                    type="button"
                                    onClick={handleDeleteLogo}
                                    disabled={isDeletingLogo}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-destructive hover:bg-destructive/10 transition-premium disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Brand name *</label>
                        <div className="relative">
                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={form.brandName}
                                maxLength={50}
                                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Industry</label>
                            <div className="relative">
                                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                                <select
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30 appearance-none"
                                >
                                    <option value="">Select industry</option>
                                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Contact email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={form.contactEmail}
                                    maxLength={255}
                                    placeholder="contact@brand.com"
                                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Website</label>
                        <div className="relative">
                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={form.website}
                                maxLength={255}
                                placeholder="https://brand.com"
                                onChange={(e) => setForm({ ...form, website: e.target.value })}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">City</label>
                            <div className="relative">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={form.city}
                                    placeholder="Mumbai"
                                    maxLength={255}
                                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">State</label>
                            <input
                                type="text"
                                value={form.state}
                                placeholder="Maharashtra"
                                maxLength={100}
                                onChange={(e) => setForm({ ...form, state: e.target.value })}
                                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Pincode</label>
                            <input
                                type="text"
                                value={form.pincode}
                                placeholder="400001"
                                maxLength={20}
                                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border">
                        <label className="text-sm font-semibold">Social Media Handles / Links</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground font-medium">Instagram</span>
                                <input
                                    type="text"
                                    value={form.socialLinks.instagram}
                                    placeholder="@brand or url"
                                    onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })}
                                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground font-medium">YouTube</span>
                                <input
                                    type="text"
                                    value={form.socialLinks.youtube}
                                    placeholder="@channel or url"
                                    onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, youtube: e.target.value } })}
                                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Bio</label>
                        <textarea
                            value={form.bio}
                            maxLength={2000}
                            placeholder="What is this brand about?"
                            rows={3}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
