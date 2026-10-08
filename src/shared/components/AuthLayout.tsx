import { Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { MutinyXLogo } from '@/shared/components/MutinyXLogo';

export function AuthLayout() {
    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-background">
            {/* Left side - Dynamic branding */}
            <div className="hidden lg:flex relative bg-foreground overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#gridPattern)" />
                    </svg>
                </div>

                <div className="relative z-10 flex flex-col justify-between p-12 w-full h-full text-background">
                    <div className="flex items-center gap-3">
                        <MutinyXLogo className="h-6" />
                    </div>

                    <div className="max-w-md">
                        <h1 className="text-4xl font-bold font-display leading-[1.1] mb-6">
                            Scale your influencer marketing organically.
                        </h1>
                        <p className="text-background/70 text-lg mb-8">
                            Join the fastest growing network of brands and creators shifting the culture.
                        </p>

                        <div className="flex items-center gap-3 text-sm font-medium">
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-foreground bg-secondary flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-foreground" />
                                    </div>
                                ))}
                            </div>
                            <span>Trusted by 10,000+ creators</span>
                        </div>
                    </div>

                    <div className="text-sm font-medium text-background/50">
                        © {new Date().getFullYear()} MUTINY TALENT PRIVATE LIMITED
                    </div>
                </div>
            </div>

            {/* Right side - Auth Form */}
            <div className="flex flex-col flex-1 p-6 md:p-12">
                <div className="lg:hidden flex items-center gap-3 mb-12">
                    <MutinyXLogo className="h-5" />
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-sm animate-fade-in">
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
}
