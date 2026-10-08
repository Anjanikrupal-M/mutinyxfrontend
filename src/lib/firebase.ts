import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage, type Messaging } from 'firebase/messaging';
 
// Your web app's Firebase configuration (from .env)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
 
export const firebaseApp = initializeApp(firebaseConfig);

// Analytics is optional (and not supported everywhere, e.g. some dev/test environments)
export async function initFirebaseAnalytics() {
    if (!(await isAnalyticsSupported())) return null;
    return getAnalytics(firebaseApp);
}

let messagingSingleton: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
    if (!(await isMessagingSupported())) return null;
    if (!messagingSingleton) messagingSingleton = getMessaging(firebaseApp);
    return messagingSingleton;
}

async function ensureFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
        // FCM expects the SW at this exact path for web push
        return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch {
        return null;
    }
}

/**
 * Web Push (FCM) token helper:
 * - Requests browser notification permission
 * - Generates (or reuses) the FCM device token
 */
export async function getWebFcmToken(): Promise<string | null> {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    if (!('Notification' in window)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) return null;

    const swReg = await ensureFcmServiceWorker();
    return await getToken(messaging, {
        vapidKey,
        ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });
}

/**
 * Subscribe to foreground FCM messages (app tab is open and focused).
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
    callback: (payload: { title?: string; body?: string; data?: Record<string, string>; actionUrl?: string }) => void
): Promise<() => void> {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};

    return onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title;
        const body = payload.notification?.body || payload.data?.body;
        const data = (payload.data ?? {}) as Record<string, string>;
        const actionUrl = data.actionUrl;
        callback({ title, body, data, actionUrl });
    });
}