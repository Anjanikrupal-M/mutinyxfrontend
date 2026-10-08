// ─────────────────────────────────────────────────────────────
// Dev-only demo login — lets you into the app without a backend.
// Only honoured when import.meta.env.DEV is true (npm run dev);
// production builds never accept these credentials.
// ─────────────────────────────────────────────────────────────

import type { User } from '@/shared/stores/authStore';

export const DEV_DEMO_CREDENTIALS = {
    email: 'demo@mutinyx.dev',
    password: 'demo1234',
};

// Inline SVG so the logo renders without a backend upload.
const DEMO_BRAND_LOGO =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
        '<rect width="128" height="128" rx="28" fill="#0a0a0a"/>' +
        '<text x="64" y="84" font-family="Arial, sans-serif" font-size="56" font-weight="700" ' +
        'text-anchor="middle" fill="#fedc03">BB</text></svg>'
    );

export const DEV_DEMO_USER: User = {
    id: 'dev-demo-user',
    email: DEV_DEMO_CREDENTIALS.email,
    name: 'Aarav Mehta',
    phoneNumber: '+91 98765 43210',
    role: 'brand_owner',
    brandId: 'dev-demo-brand',
    brandName: 'Brew & Bloom',
    brandLogoUrl: DEMO_BRAND_LOGO,
    avatarUrl: DEMO_BRAND_LOGO,
    industry: 'Food & Beverage',
    website: 'https://brewandbloom.example.com',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    primaryLanguage: 'English',
    bio: 'Brew & Bloom is a specialty coffee and tea brand from Bengaluru. We partner with food, lifestyle and wellness creators to bring single-origin brews to everyday rituals.',
    socialLinks: {
        instagram: 'https://instagram.com/brewandbloom',
        youtube: 'https://youtube.com/@brewandbloom',
    },
    socialConnected: true,
    acceptingCollabs: true,
    settings: {
        theme: 'light',
        compactMode: false,
        emailNotifications: true,
    },
};

export function isDevDemoLogin(email: string, password: string): boolean {
    return (
        import.meta.env.DEV &&
        email.trim().toLowerCase() === DEV_DEMO_CREDENTIALS.email &&
        password === DEV_DEMO_CREDENTIALS.password
    );
}

export function isDevDemoUser(user?: Pick<User, 'id'> | null): boolean {
    return import.meta.env.DEV && user?.id === DEV_DEMO_USER.id;
}
