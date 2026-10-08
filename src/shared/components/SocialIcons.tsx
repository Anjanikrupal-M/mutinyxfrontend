import React from 'react';

export const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={props.className} {...props}>
        <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FED373" />
                <stop offset="25%" stopColor="#F15245" />
                <stop offset="50%" stopColor="#D92E7F" />
                <stop offset="75%" stopColor="#9B3CB7" />
                <stop offset="100%" stopColor="#3766C6" />
            </linearGradient>
        </defs>
        <rect width="22" height="22" rx="6" x="1" y="1" fill="url(#ig-grad)" />
        <rect width="12" height="12" rx="3" x="6" y="6" fill="none" stroke="white" strokeWidth={1.5} />
        <circle cx="12" cy="12" r="3" fill="none" stroke="white" strokeWidth={1.5} />
        <circle cx="15.5" cy="8.5" r="0.75" fill="white" />
    </svg>
);

export const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={props.className} {...props}>
        <rect width="22" height="16" rx="4.5" x="1" y="4" fill="#FF0000" />
        <path d="M10 8.5L15.5 12L10 15.5V8.5Z" fill="white" />
    </svg>
);

export const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={props.className} {...props}>
        <rect width="22" height="22" rx="5" x="1" y="1" fill="#000000" />
        <path d="M16.5 6h1.83l-4 4.57L19 18h-3.68l-2.88-3.77L9.14 18H7.31l4.28-4.9L7 6h3.78l2.6 3.44L16.5 6zm-.64 10.9h1.01L10.66 7H9.57l6.29 9.9z" fill="white" />
    </svg>
);

export const PLATFORM_ICONS: Record<string, React.ElementType> = {
    instagram: InstagramIcon,
    youtube: YoutubeIcon,
    twitter: TwitterIcon,
    x: TwitterIcon
};
