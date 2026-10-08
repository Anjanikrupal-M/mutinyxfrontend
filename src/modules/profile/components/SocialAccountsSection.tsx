import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Unlink, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    useSocialStatus,
    useStartInstagramOAuth,
    useCompleteInstagramOAuth,
    useStartYoutubeOAuth,
    useConnectYoutubeOAuth,
    useDisconnectSocial,
    type SocialConnectionEntry,
} from '../hooks/useSocial';

const YOUTUBE_OAUTH_STATE_KEY = 'mutinyx_youtube_oauth_state';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    OAUTH_CANCELLED: 'Connection was cancelled.',
    OAUTH_STATE_INVALID: 'Connection session was invalid. Please try again.',
    OAUTH_TRANSACTION_EXPIRED: 'Connection session expired. Please try again.',
    META_PERMISSION_DENIED: 'Instagram did not grant the required permissions.',
    META_RATE_LIMITED: 'Instagram is rate-limiting requests. Please try again in a few minutes.',
    INSTAGRAM_ACCOUNT_UNAVAILABLE: 'Instagram profile data could not be loaded. Please try again.',
    access_denied: 'Connection was cancelled.',
};

function formatFollowers(count: number): string {
    const trim = (v: number, decimals: number) => {
        const factor = 10 ** decimals;
        return String(Math.trunc(v * factor) / factor);
    };
    if (count >= 1_000_000) return `${trim(count / 1_000_000, 2)}M`;
    if (count >= 1_000) return `${trim(count / 1_000, 1)}K`;
    return String(count);
}

function InstagramLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <defs>
                <radialGradient id="ig-logo-grad" cx="30%" cy="107%" r="150%">
                    <stop offset="0%" stopColor="#fdf497" />
                    <stop offset="5%" stopColor="#fdf497" />
                    <stop offset="45%" stopColor="#fd5949" />
                    <stop offset="60%" stopColor="#d6249f" />
                    <stop offset="90%" stopColor="#285AEB" />
                </radialGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-logo-grad)" />
            <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
            <circle cx="16.7" cy="7.3" r="1.15" fill="#fff" />
        </svg>
    );
}

function YoutubeLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="0.5" y="4.5" width="23" height="15" rx="3.8" fill="#FF0000" />
            <path d="M9.8 8.9v6.2l5.6-3.1z" fill="#fff" />
        </svg>
    );
}

function PlatformRow({
    platform,
    entry,
    canManage,
    isConnecting,
    isDisconnecting,
    onConnect,
    onDisconnect,
}: {
    platform: 'instagram' | 'youtube';
    entry: SocialConnectionEntry | null;
    canManage: boolean;
    isConnecting: boolean;
    isDisconnecting: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
}) {
    const isConnected = Boolean(entry?.isConnected);
    const label = platform === 'instagram' ? 'Instagram' : 'YouTube';
    const followerLabel = platform === 'instagram' ? 'followers' : 'subscribers';

    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                    {platform === 'instagram'
                        ? <InstagramLogo className="w-8 h-8" />
                        : <YoutubeLogo className="w-8 h-8" />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold">{label}</p>
                        {isConnected && <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                    {isConnected && entry ? (
                        <p className="text-xs text-muted-foreground truncate">
                            {entry.platformHandle ? `@${entry.platformHandle}` : 'Connected'}
                            {entry.followerCount > 0 && ` · ${formatFollowers(entry.followerCount)} ${followerLabel}`}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                </div>
            </div>
            {canManage && (
                isConnected ? (
                    <button
                        onClick={onDisconnect}
                        disabled={isDisconnecting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-destructive hover:bg-destructive/10 transition-premium shrink-0"
                    >
                        {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                        Disconnect
                    </button>
                ) : (
                    <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-premium shrink-0"
                    >
                        {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Connect
                    </button>
                )
            )}
        </div>
    );
}

export function SocialAccountsSection({
    canManage,
    socialConnected,
}: {
    canManage: boolean;
    socialConnected?: boolean;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    // Managers fetch too (read-only): the backend anchors status on the brand's owner-of-record,
    // so they see the brand's actual connected accounts rather than their own empty set.
    const { data: status, isLoading } = useSocialStatus(true);
    const startInstagram = useStartInstagramOAuth();
    const completeInstagram = useCompleteInstagramOAuth();
    const startYoutube = useStartYoutubeOAuth();
    const connectYoutube = useConnectYoutubeOAuth();
    const disconnect = useDisconnectSocial();
    const oauthReturnHandled = useRef(false);

    useEffect(() => {
        if (oauthReturnHandled.current) return;
        const igStatus = searchParams.get('ig_status');
        const igTransaction = searchParams.get('ig_transaction');
        const igError = searchParams.get('ig_error');
        const ytStatus = searchParams.get('yt_status');
        const ytCode = searchParams.get('yt_code');
        const ytState = searchParams.get('yt_state');

        if (!igStatus && !ytStatus) return;
        oauthReturnHandled.current = true;

        const cleaned = new URLSearchParams(searchParams);
        ['ig_status', 'ig_transaction', 'ig_error', 'yt_status', 'yt_code', 'yt_state', 'yt_error']
            .forEach((k) => cleaned.delete(k));
        setSearchParams(cleaned, { replace: true });

        if (igStatus === 'ready' && igTransaction) {
            completeInstagram.mutate(igTransaction, {
                onSuccess: (result) => toast.success(`Instagram connected${result?.handle ? ` — @${result.handle}` : ''}!`),
                onError: () => toast.error('Failed to finish Instagram connection. Please try again.'),
            });
        } else if (igStatus === 'error') {
            toast.error(OAUTH_ERROR_MESSAGES[igError ?? ''] ?? 'Instagram connection failed. Please try again.');
        } else if (ytStatus) {
            const expectedState = sessionStorage.getItem(YOUTUBE_OAUTH_STATE_KEY);
            sessionStorage.removeItem(YOUTUBE_OAUTH_STATE_KEY);
            if (ytStatus === 'ready' && ytCode && ytState && expectedState === ytState) {
                connectYoutube.mutate(ytCode, {
                    onSuccess: (result) => toast.success(`YouTube connected${result?.platformHandle ? ` — ${result.platformHandle}` : ''}!`),
                    onError: () => toast.error('Failed to finish YouTube connection. Please try again.'),
                });
            } else {
                toast.error('YouTube connection failed or expired. Please try again.');
            }
        }
    }, [searchParams, completeInstagram, connectYoutube, setSearchParams]);

    const handleConnectInstagram = () => {
        startInstagram.mutate(undefined, {
            onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
            onError: () => toast.error('Could not start Instagram authorization. Please try again.'),
        });
    };

    const handleConnectYoutube = () => {
        const state = `web_${crypto.randomUUID()}`;
        sessionStorage.setItem(YOUTUBE_OAUTH_STATE_KEY, state);
        startYoutube.mutate(state, {
            onSuccess: (authUrl) => window.location.assign(authUrl),
            onError: () => {
                sessionStorage.removeItem(YOUTUBE_OAUTH_STATE_KEY);
                toast.error('Could not start YouTube authorization. Please try again.');
            },
        });
    };

    const handleDisconnect = (platform: 'instagram' | 'youtube') => {
        if (!window.confirm(`Disconnect ${platform === 'instagram' ? 'Instagram' : 'YouTube'} from your brand profile?`)) return;
        disconnect.mutate(platform, {
            onSuccess: () => toast.success('Disconnected successfully.'),
            onError: () => toast.error('Failed to disconnect. Please try again.'),
        });
    };

    const statusHasConnection = Boolean(status?.instagram?.isConnected || status?.youtube?.isConnected);
    // Owners rely on live status; managers additionally fall back to the owner-anchored
    // `socialConnected` flag from /me, so a connected brand still reads as connected even if the
    // owner-anchored status endpoint isn't available yet (e.g. before that backend ships).
    const anyConnected = statusHasConnection || (!canManage && Boolean(socialConnected));
    const isFinalizing = completeInstagram.isPending || connectYoutube.isPending;

    return (
        <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold">
                    Social Accounts <span className="text-destructive font-semibold">*</span>
                </h3>
                {!anyConnected && !isFinalizing && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Required
                    </span>
                )}
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {canManage
                    ? 'Connect at least one social account to your brand profile.'
                    : anyConnected
                        ? 'Social accounts connected to this brand.'
                        : 'The brand owner needs to connect at least one social account.'}
            </p>

            {isFinalizing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Finishing connection…
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            ) : canManage ? (
                <div className="divide-y divide-border">
                    <PlatformRow
                        platform="instagram"
                        entry={status?.instagram ?? null}
                        canManage
                        isConnecting={startInstagram.isPending || completeInstagram.isPending}
                        isDisconnecting={disconnect.isPending && disconnect.variables === 'instagram'}
                        onConnect={handleConnectInstagram}
                        onDisconnect={() => handleDisconnect('instagram')}
                    />
                    <PlatformRow
                        platform="youtube"
                        entry={status?.youtube ?? null}
                        canManage
                        isConnecting={startYoutube.isPending || connectYoutube.isPending}
                        isDisconnecting={disconnect.isPending && disconnect.variables === 'youtube'}
                        onConnect={handleConnectYoutube}
                        onDisconnect={() => handleDisconnect('youtube')}
                    />
                </div>
            ) : statusHasConnection ? (
                /* Manager read-only view — show the brand's connected accounts (owner-anchored,
                   see backend getSocialStatus) without any connect/disconnect controls. */
                <div className="divide-y divide-border">
                    <PlatformRow
                        platform="instagram"
                        entry={status?.instagram ?? null}
                        canManage={false}
                        isConnecting={false}
                        isDisconnecting={false}
                        onConnect={() => {}}
                        onDisconnect={() => {}}
                    />
                    <PlatformRow
                        platform="youtube"
                        entry={status?.youtube ?? null}
                        canManage={false}
                        isConnecting={false}
                        isDisconnecting={false}
                        onConnect={() => {}}
                        onDisconnect={() => {}}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {anyConnected ? (
                        <>
                            <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            Connected social account.
                        </>
                    ) : (
                        <>Only the brand owner can connect accounts.</>
                    )}
                </div>
            )}
        </div>
    );
}
