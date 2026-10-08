/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_RAZORPAY_KEY_ID?: string;
    readonly RAZORPAY_KEY_ID?: string;
    readonly VITE_DEFAULT_PLATFORM_FEE_PERCENT?: string;
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    prefill?: {
        name?: string;
        email?: string;
    };
    theme?: {
        color?: string;
    };
    handler?: (response: unknown) => void;
    modal?: {
        ondismiss?: () => void;
    };
}

interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
}
