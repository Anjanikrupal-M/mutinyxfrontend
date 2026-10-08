import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, ChevronLeft, Globe, Loader2, Mail, MapPin, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateBrandProfile } from '@/shared/hooks/useBrandProfiles';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';

const INDUSTRIES = [
    'Food & Beverage', 'Fashion & Beauty', 'Entertainment & Media',
    'Tech (Apps & SaaS)', 'Education & Coaching', 'Real Estate',
    'Hospitality & Travel', 'Local Business', 'Healthcare / Medical',
    'Agencies', 'Jewellery & Accessories', 'Health & Fitness',
    'Automobiles', 'Finance & Fintech', 'Electronics & Gadgets',
    'Baby & Parenting', 'NGO & Social Cause', 'Others',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateBrandPage() {
    const navigate = useNavigate();
    const { isAgencyOwner } = useIsAgencyOwner();
    const { mutate: createBrandProfile, isPending } = useCreateBrandProfile();

    const [form, setForm] = useState({
        brandName: '',
        industry: '',
        contactEmail: '',
        website: '',
        city: '',
        state: '',
        pincode: '',
        bio: '',
    });

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = form.brandName.trim();
        if (!name) { toast.error('Brand name is required'); return; }
        if (form.brandName.length > 50) { toast.error('Brand name must be 50 characters or fewer.'); return; }
        if (form.website.trim() && !form.website.trim().startsWith('http://') && !form.website.trim().startsWith('https://')) {
            toast.error('Website must start with http:// or https://'); return;
        }
        if (form.contactEmail.trim() && !EMAIL_REGEX.test(form.contactEmail.trim())) {
            toast.error('Enter a valid contact email'); return;
        }

        createBrandProfile(
            {
                brandName: name,
                industry: form.industry || undefined,
                contactEmail: form.contactEmail.trim() || undefined,
                website: form.website.trim() || undefined,
                city: form.city.trim() || undefined,
                state: form.state.trim() || undefined,
                pincode: form.pincode.trim() || undefined,
                bio: form.bio.trim() || undefined,
            },
            {
                onSuccess: () => {
                    toast.success(`${name} created.`);
                    navigate('/brands');
                },
                onError: () => toast.error('Failed to create brand. Please try again.'),
            },
        );
    };

    if (!isAgencyOwner) {
        return (
            <div className="max-w-md mx-auto animate-fade-in text-center py-16">
                <p className="text-sm text-muted-foreground">Adding brands is an Agencies plan feature.</p>
            </div>
        );
    }

    const inputCls = 'w-full h-11 px-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30';
    const iconInputCls = 'w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30';

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
                <button
                    onClick={() => navigate('/brands')}
                    className="p-2 hover:bg-secondary rounded-lg transition-premium text-muted-foreground hover:text-foreground"
                    title="Back to Brands"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold font-display">Add a brand</h1>
                    <p className="text-sm text-muted-foreground">Create a new brand to manage under your Agencies account. You can add a logo after creating it.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Brand name *</label>
                    <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Acme Corp"
                            value={form.brandName}
                            maxLength={50}
                            onChange={set('brandName')}
                            disabled={isPending}
                            autoFocus
                            className={cn(iconInputCls, isPending && 'opacity-50')}
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
                                onChange={set('industry')}
                                disabled={isPending}
                                className={cn(iconInputCls, 'appearance-none', isPending && 'opacity-50')}
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
                                placeholder="contact@brand.com"
                                value={form.contactEmail}
                                maxLength={255}
                                onChange={set('contactEmail')}
                                disabled={isPending}
                                className={cn(iconInputCls, isPending && 'opacity-50')}
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
                            placeholder="https://brand.com"
                            value={form.website}
                            maxLength={255}
                            onChange={set('website')}
                            disabled={isPending}
                            className={cn(iconInputCls, isPending && 'opacity-50')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold">City</label>
                        <div className="relative">
                            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="text" value={form.city} placeholder="Mumbai" maxLength={255} onChange={set('city')} disabled={isPending} className={cn(iconInputCls, isPending && 'opacity-50')} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold">State</label>
                        <input type="text" value={form.state} placeholder="Maharashtra" maxLength={100} onChange={set('state')} disabled={isPending} className={cn(inputCls, isPending && 'opacity-50')} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold">Pincode</label>
                        <input type="text" value={form.pincode} placeholder="400001" maxLength={20} onChange={set('pincode')} disabled={isPending} className={cn(inputCls, isPending && 'opacity-50')} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold">Bio</label>
                    <textarea
                        value={form.bio}
                        maxLength={2000}
                        rows={3}
                        placeholder="What is this brand about?"
                        onChange={set('bio')}
                        disabled={isPending}
                        className={cn('w-full px-4 py-3 rounded-xl border border-border bg-background text-sm transition-all outline-none focus:ring-2 focus:ring-[#fedc03]/30 resize-none', isPending && 'opacity-50')}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isPending || !form.brandName.trim()}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-70 mt-2"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create brand'}
                </button>
            </form>
        </div>
    );
}
