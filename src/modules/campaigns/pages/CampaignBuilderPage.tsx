import { cn } from '@/lib/utils';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';
import { ApiImage } from '@/shared/components/ApiImage';
import type { Campaign } from '@/shared/types/campaign';
import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    ArrowLeft,
    ArrowRight,
    Baby,
    BarChart2,
    BookOpen,
    Building2,
    CalendarDays,
    Camera,
    Car,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Crop,
    Dumbbell,
    Eye,
    Film,
    FileText,
    Gem,
    Globe,
    Hash,
    HeartHandshake,
    ImagePlus,
    IndianRupee,
    Landmark,
    Layers,
    LayoutGrid,
    ListChecks,
    Loader2,
    Lock,
    LockKeyhole,
    MapPin,
    MapPinned,
    MessageSquare,
    Minus,
    Monitor,
    PenLine,
    Plane,
    Play,
    Plus,
    RefreshCw,
    Rocket,
    Save,
    ShieldCheck,
    ShoppingBag,
    Smartphone,
    Sparkles,
    RotateCcw,
    Tags,
    Target,
    Trash2,
    TrendingUp,
    Upload,
    User,
    UserCheck,
    Users,
    Utensils,
    Video,
    Wallet,
    X,
    Zap
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCampaign, useCreateCampaign, useLaunchCampaign, useUpdateCampaign, useUploadThumbnail, useUploadScript } from '../hooks/useCampaigns';
import { INDIAN_STATES, getIndianCities, getIndianCityStateOptions } from '@/shared/constants/locations';
import { TARGET_AGE_RANGES, TARGET_GENDERS, TARGET_LANGUAGES, type TargetGender } from '@/shared/constants/audience';
import { useTierConfig } from '../hooks/useTierConfig';
import ws from '@/core/websocket';
import http from '@/core/http';
import { API } from '@/core/api';
import AIStrategistChat from '@/modules/campaigns/components/AIStrategistChat';
import AssistantPanel from '@/modules/campaigns/components/assistant/AssistantPanel';

/**
 * Rollout flag for the agentic assistant. While false the original AIStrategistChat wizard
 * runs exactly as before, so a regression in the new panel cannot break campaign creation.
 * Set VITE_ASSISTANT_V2=true to switch the AI Strategist tab over to the new engine.
 */
const USE_ASSISTANT_V2 = import.meta.env.VITE_ASSISTANT_V2 === 'true';
import {
    Confirm,
    Counter,
    ErrorText,
    Field,
    LockedBadge,
    Note,
    OptionCard,
    PickerHeader,
    ProgressRing,
    Segmented,
    Summary,
    Switch,
    Tile,
    choiceClass,
    fieldBorder,
    fieldClass,
    useTypingPlaceholder,
} from '@/shared/components/BentoUi';
import { BuilderDatePicker } from '@/modules/campaigns/components/builder/BuilderDatePicker';
import { AgeLine, LanguageKeys } from '@/modules/campaigns/components/builder/AudiencePickers';
import { CityBoard, BOARD_CITIES } from '@/modules/campaigns/components/builder/CityBoard';
import { CoverCropper } from '@/modules/campaigns/components/builder/CoverCropper';
import { ScriptOptimizerPanel } from '@/modules/campaigns/components/builder/ScriptOptimizerPanel';
import { PhonePreview } from '@/modules/campaigns/components/builder/PhonePreview';
import { TOPBAR_SLOT_ID } from '@/shared/components/Topbar';
import { EXAMPLE_CAMPAIGN_PREVIEW } from '@/mocks/campaignPreview';
import { useAuthStore } from '@/shared/stores/authStore';
import { InviteCreatorsPromptModal } from '@/modules/campaigns/components/InviteCreatorsPromptModal';
import { ConvertToPrivateModal } from '@/modules/campaigns/components/ConvertToPrivateModal';

// ── Steps ──
const STEPS = [
    { id: 1, title: 'Basics', desc: 'Name, type & niche' },
    { id: 2, title: 'Deliverables', desc: 'Platform, content & guidelines' },
    { id: 3, title: 'Budget', desc: 'Tiers, pricing & timeline' },
];
// Step-change celebration: confetti bits flying out of the new step's circle (direction, colour,
// shape and delay as literal classes so Tailwind can see them) and a cheer per step reached.
const STEP_CONFETTI = [
    '[--dx:-16px] [--dy:-14px] bg-brand rounded-full',
    '[--dx:14px] [--dy:-16px] bg-foreground rounded-[1px] rotate-12',
    '[--dx:20px] [--dy:2px] bg-brand rounded-[1px]',
    '[--dx:12px] [--dy:16px] bg-foreground rounded-full',
    '[--dx:-4px] [--dy:20px] bg-brand rounded-[1px] -rotate-12',
    '[--dx:-18px] [--dy:12px] bg-foreground rounded-[1px]',
    '[--dx:-21px] [--dy:-2px] bg-brand rounded-full',
    '[--dx:2px] [--dy:-21px] bg-foreground rounded-full',
];
const STEP_CHEERS: Record<number, string> = { 2: 'Nice! 🔥', 3: 'Almost there ✨' };
const MAX_COVER_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_SCRIPT_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_SCRIPT_FILE_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const CAMPAIGN_BUILDER_LOCAL_DRAFT_KEY = 'mutiny:campaign-builder:draft';
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_SCRIPT_FLOW_LENGTH = 2000;
const MAX_BUDGET_INPUT_LENGTH = 15;
const MAX_REFERENCE_LENGTH = 300;
const MAX_NICHES = 3;

// ── Builder UI option lists ──
// Rotated through the campaign-name placeholder. Module-level so the typing effect keeps a
// stable reference and doesn't restart on every render.
const NAME_EXAMPLES = ['Summer Sale 2025', 'Diwali Launch Offer', 'New Store Opening', 'Movie Trailer Promo'];

// Starter briefs; [brackets] mark the parts the brand should replace.
const BRIEF_EXAMPLES = [
    { label: 'Product launch', text: "We're launching [product]. Show it in everyday use and highlight what makes it different. Keep the tone upbeat and honest. Mention the launch offer and tag our brand handle." },
    { label: 'Store opening', text: 'Our new store is opening in [city]. Visit, show the space and your favourite picks, and invite your followers to the opening week. Friendly, local tone. Include the store location.' },
    { label: 'Movie promotion', text: 'Promote our upcoming film [title]. Share your reaction to the trailer or recreate a scene. Keep it fun and spoiler-free. Mention the release date and use the official hashtag.' },
    { label: 'Festive sale', text: "Announce our festive sale. Show your top picks and the deals you'd grab. Warm, celebratory tone. Mention the sale dates and the discount code." },
    { label: 'Unboxing & review', text: 'Unbox [product] on camera and share your honest first impressions. Cover the look, the key features and who it suits. Natural, unscripted tone. End with where to buy it.' },
    { label: 'App download', text: 'Introduce our app [app name]. Show how you use it and the one feature you like most. Simple, helpful tone. Ask followers to download it using the link in your bio.' },
    { label: 'Restaurant visit', text: 'Visit [restaurant] and try our signature dishes. Show the food, the ambience and your genuine reaction. Casual, mouth-watering tone. Mention the location and opening hours.' },
    { label: 'Event or concert', text: 'Promote [event] happening on [date] in [city]. Build excitement around the line-up and what to expect. Energetic tone. Share the ticket link and booking deadline.' },
    { label: 'Giveaway', text: 'Host a giveaway for [prize]. Explain how to enter, the rules and the closing date. Fun, engaging tone. Ask followers to follow our page and tag a friend.' },
    { label: 'Brand awareness', text: 'Introduce [brand] to your audience. Share what we do and why you would recommend us. Authentic, personal tone. Tag our handle and use our brand hashtag.' },
];

// "Other" isn't offered in the builder. It stays in TARGET_GENDERS (the backend enum), so
// campaigns saved with it still load; the switch then simply shows no segment selected.
const GENDER_OPTIONS = TARGET_GENDERS.filter((g) => g.value !== 'other').map((g) => ({
    value: g.value as string,
    label: g.label as string,
    icon: g.value === 'all' ? Users : undefined,
}));

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
    instagram: 'Reels, stories & posts',
    youtube: 'Shorts & videos',
    both: 'Both platforms',
};

const COLLAB_TAG_OPTIONS = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'optional', label: 'Optional' },
];
const SCRIPT_PROVIDERS = [
    { value: 'brand', label: 'Brand provides' },
    { value: 'creator', label: 'Creator writes' },
];
const YES_NO_OPTIONS = [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' },
];

const BUDGET_MODES = [
    { value: 'paid', label: 'Paid' },
    { value: 'product', label: 'Product' },
    { value: 'paid_product', label: 'Paid + Product' },
];
const BUDGET_MODE_NOTES: Record<string, string> = {
    paid: 'Creators are paid in money for the content they make.',
    product: 'Creators get your product instead of money. Describe it below.',
    paid_product: 'Creators get your product and a payment. Enter the payment budget and describe the product.',
};
const QUICK_BUDGETS = [10000, 25000, 50000, 100000];
/** ₹1,00,000 → ₹1L, ₹25,000 → ₹25K */
const shortRupees = (amount: number) =>
    amount >= 100000 ? `₹${amount / 100000}L` : amount >= 1000 ? `₹${amount / 1000}K` : `₹${amount}`;

const TIER_QUICK_PICKS = [
    { label: 'Small creators', tiers: ['nano', 'micro'] },
    { label: 'Growing', tiers: ['micro', 'mid'] },
    { label: 'Big reach', tiers: ['macro', 'mega'] },
];

const DEADLINE_STRATEGIES = [
    { value: 'common', label: 'Common deadline' },
    { value: 'individual', label: 'Individual deadlines' },
];

// Excludes tab, LF and CR (\u0009, \u000A, \u000D) -- those are legitimate whitespace,
// not the invisible/control input this guards against. Stripping them unconditionally used
// to defeat the allowNewlines option below: it collapsed \n before that check ever ran,
// silently discarding line breaks from every allowNewlines:true field (Campaign Brief,
// Product Details, Script Flow, Visit Description) and breaking any string assembled with
// an embedded blank-line separator (see joinVisitAtSiteDescription).
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ONLY_QUOTES_REGEX = /^["']+$/;
const WRAPPED_IN_QUOTES_REGEX = /^\s*(["']).*\1\s*$/;

function sanitizeInputText(
    value: string,
    options?: { allowNewlines?: boolean; maxLength?: number }
): string {
    let next = String(value ?? '');
    next = next.replace(CONTROL_CHAR_REGEX, '');
    if (!options?.allowNewlines) {
        next = next.replace(/[\r\n]+/g, ' ');
    }
    next = next.replace(/[<>]/g, '');
    if (typeof options?.maxLength === 'number') {
        next = next.slice(0, options.maxLength);
    }
    return next;
}

function normalizeRequiredText(
    value: unknown,
    options?: { allowNewlines?: boolean; maxLength?: number }
): string {
    const cleaned = sanitizeInputText(String(value ?? ''), options).trim();
    if (!cleaned) return '';
    if (ONLY_QUOTES_REGEX.test(cleaned)) return '';
    return cleaned;
}

function sanitizeForSave(
    value: unknown,
    options?: { allowNewlines?: boolean; maxLength?: number }
): string {
    let cleaned = sanitizeInputText(String(value ?? ''), options);
    cleaned = cleaned.replace(/^\s+/, '');
    cleaned = cleaned.trimEnd();
    if (!cleaned) return '';
    if (ONLY_QUOTES_REGEX.test(cleaned.trim())) return '';
    return cleaned;
}

function toOptionalText(
    value: unknown,
    options?: { allowNewlines?: boolean; maxLength?: number }
): string | undefined {
    const cleaned = sanitizeForSave(value, options);
    return cleaned ? cleaned : undefined;
}

function isHttpUrl(value: string): boolean {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
    } catch {
        return false;
    }
}

function normalizeCoverImageForPayload(value: unknown): string | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;

    // Never send local previews/base64 blobs to create/update payload.
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return undefined;

    // Defensive cap to avoid backend zod maxTextLength violations on basics fields.
    if (raw.length > 9500) return undefined;

    // Allow full URLs and known upload key/path formats.
    if (isHttpUrl(raw) || raw.startsWith('/') || raw.startsWith('campaigns/')) return raw;

    return undefined;
}

function splitLocationParts(value: unknown): { cities: string[]; states: string[] } {
    const raw = String(value ?? '').trim();
    if (!raw) return { cities: [], states: [] };

    if (raw === 'Pan India') return { cities: [], states: ['Pan India'] };

    if (raw.includes('|')) {
        const parts = raw.split('|');
        const statePart = parts.pop()?.trim() || '';
        const citiesStr = parts.join('|').trim();
        const cities = citiesStr.split(',').map(s => s.trim()).filter(Boolean);
        const states = statePart.split(',').map(s => s.trim()).filter(Boolean);
        return { cities, states };
    }

    // No pipe — treat all comma parts as states
    const states = raw.split(',').map(s => s.trim()).filter(Boolean);
    return { cities: [], states };
}

function joinLocationParts(cities: string[], states: string[]): string {
    if (states.length === 1 && states[0] === 'Pan India') return 'Pan India';
    const c = cities.filter(Boolean).join(', ');
    const s = states.filter(Boolean).join(', ');
    if (c && s) return `${c} | ${s}`;
    return s || c;
}

function isAllowedCoverImageFile(file: File): boolean {
    if (ALLOWED_COVER_IMAGE_MIME_TYPES.has(file.type)) return true;
    const lowerName = file.name.toLowerCase();
    return lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png');
}

function isAllowedScriptFile(file: File): boolean {
    const lowerName = file.name.toLowerCase();
    return ALLOWED_SCRIPT_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

function formatDateStr(dateStr: string | undefined | null): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

type ApiErrorEnvelope = {
    response?: {
        data?: {
            error?: {
                code?: string;
                message?: string;
                details?: unknown;
            };
            message?: string;
        };
    };
    status?: number;
};

function getApiErrorMessage(error: unknown, fallback: string): string {
    const err = error as ApiErrorEnvelope;
    const baseMessage = err.response?.data?.error?.message || err.response?.data?.message || fallback;
    const details = err.response?.data?.error?.details;

    if (!details || typeof details !== 'object') return baseMessage;

    const detailsRecord = details as Record<string, unknown>;
    const messages = Object.entries(detailsRecord)
        .flatMap(([field, rawValue]) => {
            if (Array.isArray(rawValue)) {
                return rawValue
                    .map((v) => String(v || '').trim())
                    .filter(Boolean)
                    .map((m) => `${field} - ${m}`);
            }

            const message = String(rawValue || '').trim();
            return message ? [`${field} - ${message}`] : [];
        })
        .slice(0, 4);

    if (messages.length === 0) return baseMessage;

    return `${baseMessage}: ${messages.join(' | ')}`;
}

// ── Campaign Types ──
const CAMPAIGN_TYPES: { key: string; label: string; icon: LucideIcon; desc: string; info: string }[] = [
    {
        key: 'influencer',
        label: 'Influencer Marketing',
        icon: Users,
        desc: 'Traditional influencer partnerships',
        info: 'Creators post content on their own profile to their existing audience. Best for brand awareness, reach, and social proof. The creator owns the channel — you get the exposure.',
    },
    {
        key: 'ugc',
        label: 'UGC Marketing',
        icon: Video,
        desc: 'User-generated content campaigns',
        info: 'Creators shoot raw content that your brand publishes on its own channels. You receive full usage rights and decide where and how the content gets posted — no creator audience required.',
    },
];

const VISIBILITY_OPTIONS: { key: string; label: string; icon: LucideIcon; desc: string }[] = [
    { key: 'public', label: 'Public', icon: Globe, desc: 'All influencers can see and apply' },
    { key: 'private', label: 'Private', icon: LockKeyhole, desc: 'Only invited influencers can see this' },
];

// ── Niche ──
const NICHE_CATEGORIES: { key: string; label: string; icon: LucideIcon }[] = [
    { key: 'food-beverage', label: 'Food & Beverage', icon: Utensils },
    { key: 'fashion-beauty', label: 'Fashion & Beauty', icon: ShoppingBag },
    { key: 'entertainment', label: 'Entertainment & Media', icon: Film },
    { key: 'tech', label: 'Tech (Apps & SaaS)', icon: Monitor },
    { key: 'education', label: 'Education & Coaching', icon: BookOpen },
    { key: 'realestate', label: 'Real Estate', icon: Building2 },
    { key: 'hospitality', label: 'Hospitality & Travel', icon: Plane },
    { key: 'healthcare', label: 'Healthcare / Medical', icon: Activity },
    { key: 'jewellery', label: 'Jewellery & Accessories', icon: Gem },
    { key: 'fitness', label: 'Health & Fitness', icon: Dumbbell },
    { key: 'lifestyle', label: 'Lifestyle', icon: Sparkles },
    { key: 'automobiles', label: 'Automobiles', icon: Car },
    { key: 'finance', label: 'Finance & Fintech', icon: Landmark },
    { key: 'electronics', label: 'Electronics & Gadgets', icon: Smartphone },
    { key: 'parenting', label: 'Baby & Parenting', icon: Baby },
    { key: 'ngo', label: 'NGO & Social Cause', icon: HeartHandshake },
];

// ── Platforms (no LinkedIn) ──
// 'both' means the campaign runs on Instagram *and* YouTube; deliverables from either can be requested.
const PLATFORMS: { key: string; label: string; icon: LucideIcon }[] = [
    { key: 'instagram', label: 'Instagram', icon: Camera },
    { key: 'youtube', label: 'YouTube', icon: Play },
    { key: 'both', label: 'Instagram + YouTube', icon: Layers },
];

// ── Content formats per platform ──
// Max items a brand can ask for per format. The backend enforces the same cap.
const MAX_DELIVERABLE_COUNT = 5;

const INSTAGRAM_CONTENT_FORMATS = [
    { id: 'reel', label: 'Reel', description: 'A short video in the Reels tab' },
    { id: 'story', label: 'Story', description: 'A photo or video that disappears in 24 hours' },
    { id: 'feed-image', label: 'Feed image', description: 'One photo on the Instagram grid' },
    { id: 'feed-video', label: 'Feed video', description: 'One non-Reel video on the Instagram grid' },
    { id: 'carousel', label: 'Carousel', description: 'Several photos or videos you swipe through' },
];

const YOUTUBE_CONTENT_FORMATS = [
    { id: 'short', label: 'Short', description: 'Vertical short-form video for Shorts feed' },
    { id: 'integration', label: 'Integration', description: 'Sponsored segment within an existing video' },
    { id: 'dedicated', label: 'Dedicated Video', description: 'Full video focused on your brand' },
];

const CONTENT_FORMATS_BY_PLATFORM: Record<string, { id: string; label: string; description: string }[]> = {
    instagram: INSTAGRAM_CONTENT_FORMATS,
    youtube: YOUTUBE_CONTENT_FORMATS,
    // Format ids are unique across platforms, so a plain concat is unambiguous.
    both: [
        ...INSTAGRAM_CONTENT_FORMATS.map((f) => ({ ...f, label: `Instagram ${f.label}` })),
        ...YOUTUBE_CONTENT_FORMATS.map((f) => ({ ...f, label: `YouTube ${f.label}` })),
    ],
    twitter: [
        { id: 'single-tweet', label: 'Single Tweet', description: 'Standalone promotional tweet with image or text' },
        { id: 'thread', label: 'Thread', description: 'Series of connected tweets telling a story' },
        { id: 'twitter-space', label: 'Twitter Space', description: 'Live audio conversation with the audience' },
    ],
};

/** True when the campaign runs on Instagram — either directly or via the 'both' platform option. */
function platformIncludesInstagram(platform: string): boolean {
    return platform === 'instagram' || platform === 'both';
}

// New writes use canonical ids. Hydration still accepts old display labels and aliases.
function normalizeContentTypeToId(value: string): string {
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) return value;
    if (needle === 'post' || needle === 'feed post' || needle === 'instagram post') return 'feed-image';
    for (const formats of Object.values(CONTENT_FORMATS_BY_PLATFORM)) {
        const hit = formats.find((f) => f.id === needle || f.label.toLowerCase() === needle);
        if (hit) return hit.id;
    }
    return value;
}

// ── Usage rights ──
// Values are stored as a day count suffixed with 'd' (e.g. '45d'). Anything outside
// the preset list is a custom duration entered by the brand.
const USAGE_RIGHTS_PRESETS = ['30d', '45d', '60d', '90d'] as const;
const USAGE_RIGHTS_LABELS: Record<string, string> = {
    '30d': '30 days',
    '45d': '45 days',
    '60d': '60 days',
    '90d': '90 days',
};

/** Formats any stored usage-rights value for display, including custom day counts. */
function formatUsageRights(value: string): string {
    if (!value) return '—';
    if (USAGE_RIGHTS_LABELS[value]) return USAGE_RIGHTS_LABELS[value];
    const days = value.replace(/\D/g, '');
    return days ? `${days} days` : value;
}

const NICHE_KEY_ALIASES: Record<string, string> = {
    'food': 'food-beverage',
    'foodbeverage': 'food-beverage',
    'fashion': 'fashion-beauty',
    'fashionbeauty': 'fashion-beauty',
    'entertainmentmedia': 'entertainment',
    'real-estate': 'realestate',
    'realestate': 'realestate',
    'local-business': 'local',
    'localbusiness': 'local',
    'health': 'healthcare',
    'health-care': 'healthcare',
    'agency': 'agencies',
    'jewelry': 'jewellery',
    'accessories': 'jewellery',
    'auto': 'automobiles',
    'fintech': 'finance',
    'baby': 'parenting',
    'social-cause': 'ngo',
};

function normalizeNicheKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';

    // 1. Direct key match (e.g. 'hospitality')
    if (NICHE_CATEGORIES.some((n) => n.key === raw)) return raw;

    // 2. Label match — handles round-tripping stored labels back to keys
    //    e.g. 'Hospitality & Travel' → 'hospitality', 'Food & Beverage' → 'food-beverage'
    const byLabel = NICHE_CATEGORIES.find((n) => n.label.toLowerCase() === raw);
    if (byLabel) return byLabel.key;

    // 3. Hyphenated form (e.g. 'food_beverage' → 'food-beverage')
    const hyphenated = raw.replace(/[\s_]+/g, '-');
    if (NICHE_CATEGORIES.some((n) => n.key === hyphenated)) return hyphenated;

    // 4. Compact alias table (e.g. 'foodbeverage' → 'food-beverage')
    const compact = raw.replace(/[^a-z0-9]/g, '');
    return NICHE_KEY_ALIASES[raw] || NICHE_KEY_ALIASES[hyphenated] || NICHE_KEY_ALIASES[compact] || '';
}

// ── Budget data — icons only; costs/ranges come from API via useTierConfig ──
const TIER_ICONS: Record<string, LucideIcon> = {
    nano: User, micro: Users, mid: BarChart2, macro: TrendingUp, mega: Zap,
};

interface TierConfig {
    tier: string;
    count: number;
    amount: string;
}

interface VisitLocationDraft {
    id: string;
    description: string;
}

function makeEmptyVisitLocation(): VisitLocationDraft {
    return {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: '',
    };
}

/** Normalizes a loaded campaign's visitAtSite.options into local draft shape for form state. */
function toVisitLocationDrafts(campaignAny: Record<string, unknown>): VisitLocationDraft[] {
    const visitAtSite = campaignAny.visitAtSite as { enabled?: boolean; options?: Array<Record<string, unknown>> } | undefined;
    const options = Array.isArray(visitAtSite?.options) ? visitAtSite.options : [];
    if (options.length > 0) {
        return options.map((opt) => ({
            id: String(opt.id || makeEmptyVisitLocation().id),
            description: String(opt.description || ''),
        }));
    }
    // Legacy fallback: single flat description field, no options array yet.
    if (campaignAny.visitAtSiteEnabled) {
        return [{
            ...makeEmptyVisitLocation(),
            description: String(campaignAny.visitAtSiteDescription || '') || 'Site Visit',
        }];
    }
    return [];
}

export default function CampaignBuilderPage() {
    const navigate = useNavigate();
    const authUser = useAuthStore((state) => state.user);
    const { id } = useParams<{ id: string }>();
    const isInitialEdit = useRef(!!id).current;
    const isEdit = !!id;
    const [searchParams, setSearchParams] = useSearchParams();
    const returnRef = searchParams.get('ref');
    const programIdFromUrl = searchParams.get('programId');
    // ?step=N lets callers deep-link straight to a specific wizard step (e.g. step=3 for Budget)
    const initialStep = Math.min(Math.max(Number(searchParams.get('step')) || 1, 1), STEPS.length);
    // Set by the assistant's "Open in builder" handoff. The way back to the conversation and the
    // clear-everything control only make sense for someone who arrived from chat — a user who
    // opened this campaign from the list has no chat to return to.
    const cameFromAssistant = searchParams.get('from') === 'ai';
    // Visibility is chosen up front in CampaignVisibilityModal and locked in for the whole builder —
    // there is no picker in step 1. Anything other than an explicit 'private' falls back to public,
    // which also covers someone opening /campaigns/create directly without the modal.
    const visibilityFromUrl = searchParams.get('visibility') === 'private' ? 'private' : 'public';

    const { data: campaignData, isLoading: isLoadingCampaign } = useCampaign(id!);
    // When editing, also fall back to the campaign's own programId (present when the URL lacks ?programId=)
    const programId = programIdFromUrl || (campaignData as any)?.programId || null;
    const createCampaignMutation = useCreateCampaign();
    const updateCampaignMutation = useUpdateCampaign();
    const launchCampaignMutation = useLaunchCampaign();
    const uploadThumbnailMutation = useUploadThumbnail();
    const uploadScriptMutation = useUploadScript();

    // Tier config from API — falls back to hardcoded values while loading or if API unavailable
    const { tiers: apiTiers, tierCosts } = useTierConfig();
    // Minimum budget to unlock any creator tier (driven by the lowest tier's minimum price)
    const minTierBudget = apiTiers[0]?.minBudget ?? 1000;
    const creatorSizes = apiTiers.map((t) => ({
        key: t.tier as string,
        label: t.label,
        range: t.range,
        icon: TIER_ICONS[t.tier] ?? User,
    }));

    // The URL is the ONLY source of truth for which tab is open: ?tab= if present, otherwise
    // the step-by-step builder.
    //
    // This used to fall back to a remembered tab in localStorage, which was a bug factory. Any
    // navigation that did not name a tab inherited whatever the user last opened — and since
    // they had just been in the assistant, that was always 'ai'. So "Create campaign" opened
    // the assistant instead of the wizard; confirming an AI draft bounced back into an empty
    // chat instead of the campaign it had just created; and "Edit campaign", the budget link
    // in ApplicationsTab and "Create campaign" from a program all did the same.
    //
    // Anything arriving without a tab genuinely means "open the form".
    //
    // Derived straight from the URL, with NO mirroring useState. It was briefly held in state
    // and kept in sync by two effects pointing in opposite directions — state→URL and URL→state
    // — which is unfixable in principle and broke in two separate ways in practice:
    //
    //   1. The state→URL effect listed setSearchParams as a dependency and called it on every
    //      run. react-router's setSearchParams always calls navigate(), even when the updater
    //      returns an unchanged value, and its identity is rebuilt on each navigation (it is a
    //      useCallback over [navigate, searchParams]). So it re-armed itself forever:
    //      "Maximum update depth exceeded", and the error boundary tore the builder down before
    //      any tab could open.
    //   2. Even with that guarded, the two effects fought whenever the URL changed from outside
    //      — the post-confirm navigate to ?tab=manual. Effects run in declaration order, so
    //      state→URL saw (url=manual, state=ai) and pushed the URL back to ai, while URL→state
    //      set the state to manual. Each pass swapped them and the pair oscillated.
    //
    // One owner, no sync, no loop. Reload, back/forward and shared links all still work, because
    // the tab IS the URL — per the ?tab= convention in CLAUDE.md section 7.
    const activeTab: 'ai' | 'manual' = searchParams.get('tab') === 'ai' ? 'ai' : 'manual';

    const setActiveTab = useCallback((tab: 'ai' | 'manual') => {
        // replace: true so flipping tabs does not stack history entries.
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    const [step, setStep] = useState(initialStep);
    // Which way the last step change went, so the step content slides in from that side.
    // Updated only when the step actually changes, so later re-renders don't replay the slide.
    const lastStepRef = useRef(step);
    const stepDirectionRef = useRef<'forward' | 'back'>('forward');
    if (lastStepRef.current !== step) {
        stepDirectionRef.current = step > lastStepRef.current ? 'forward' : 'back';
        lastStepRef.current = step;
    }

    /**
     * Deep links have to work even when this page is ALREADY mounted.
     *
     * `useState(initialStep)` reads the URL exactly once, and React Router reuses this same
     * component instance across a route-param change — so the assistant's handoff to
     * `?step=3` (the final step, now that Preview lives beside the form) silently stayed on step 1 for anyone who was already sitting in the builder,
     * which is the very thing that handoff exists to avoid.
     *
     * Keyed on the raw param so it only fires when the LINK changes: Next/Back move the step
     * without touching the URL, and must never be overridden by this.
     */
    const stepParam = searchParams.get('step');
    const lastAppliedStepParam = useRef(stepParam);
    useEffect(() => {
        if (stepParam === lastAppliedStepParam.current) return;
        lastAppliedStepParam.current = stepParam;
        if (!stepParam) return;
        const parsed = Number(stepParam);
        if (!Number.isFinite(parsed)) return;
        setStep(Math.min(Math.max(parsed, 1), STEPS.length));
    }, [stepParam]);

    const [draftCampaignId, setDraftCampaignId] = useState<string | null>(id ?? null);
    // Set once a private campaign launches — drives the "invite creators now?" prompt.
    const [launchedPrivateCampaignId, setLaunchedPrivateCampaignId] = useState<string | null>(null);
    const [showConvertToPrivateModal, setShowConvertToPrivateModal] = useState(false);
    const coverImageFileRef = useRef<File | null>(null);
    const scriptFileRef = useRef<File | null>(null);
    const [cropperSrc, setCropperSrc] = useState<string | null>(null);
    // The photo as picked, before cropping, so "Adjust" can re-crop from the full image.
    const coverOriginalSrcRef = useRef<string | null>(null);
    const [isCoverDragActive, setIsCoverDragActive] = useState(false);

    const lastSavedDraftSignatureRef = useRef('');
    const autoSaveInFlightRef = useRef(false);
    // Step-change autosaves run in the background; they are chained here so they never overlap,
    // and Save as Draft / Publish wait on it — otherwise a create still in flight would make them
    // create a second campaign.
    const pendingAutoSaveRef = useRef<Promise<unknown>>(Promise.resolve());
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    // Files already sent to the server, so each step's autosave doesn't re-upload them.
    const uploadedCoverFileRef = useRef<File | null>(null);
    const uploadedScriptFileRef = useRef<File | null>(null);
    const hasHydratedFromCampaignRef = useRef(false);
    const initialDatesRef = useRef<{ applicationDeadline?: string; scriptDeadline?: string; workDeadline?: string; proofOfWorkDeadline?: string }>({});
    const draftCampaignIdRef = useRef<string | null>(id ?? null);
    /**
     * The empty form, as a factory rather than an inline literal, so "Clear info" can put the
     * builder back to exactly the state it starts in instead of unsetting fields one by one
     * and drifting out of sync whenever a field is added.
     */
    const buildEmptyForm = useCallback(() => ({
        // Step 1 – Basics
        campaignName: '',
        description: '',
        coverImageName: '',
        coverImagePreview: '',
        // Campaign Type picker was removed from step 1 (the block is commented out below).
        // `type` is still NOT NULL in the DB and required by the backend for active
        // campaigns, so it is pinned to 'influencer' — the only flow the builder now offers.
        type: 'influencer',
        niche: [] as string[],
        // Programs force private; otherwise the modal's choice (?visibility=) decides.
        visibility: programId ? 'private' : visibilityFromUrl,
        location: '',
        locationStates: ['Pan India'] as string[],
        locationCities: [] as string[],
        // Creator Specifications — preferred gender of the creators themselves ('all' = any).
        creatorGender: 'all' as TargetGender,
        // Target audience — all optional; empty / 'all' = no preference.
        audienceAgeRanges: [] as string[],
        audienceGender: 'all' as TargetGender,
        audienceLocations: [] as string[],
        audienceLanguages: [] as string[],
        // Step 2 – Deliverables
        platform: '',
        contentType: [] as string[],
        // Items owed per selected format id (1..MAX_DELIVERABLE_COUNT). Missing = 1.
        contentTypeCounts: {} as Record<string, number>,
        postingType: 'creator' as 'creator' | 'brand' | 'collab' | 'collab_optional',
        // Instagram channel the creator should invite as collaborator (collab / collab_optional).
        collabChannel: '',
        references: [] as string[],
        // 'none' = "Script required" toggled off: no script content, no script deadline, no script stages.
        scriptType: 'creator' as 'brand' | 'creator' | 'none',
        scriptFileName: '',
        scriptFileUrl: '',
        scriptFlow: '',
        proofOfWorkRequired: true,
        visitAtSiteEnabled: false,
        visitAtSiteOptions: [] as VisitLocationDraft[],
        // Step 3 – Budget
        totalBudget: '',
        creatorStrategy: 'bulk' as 'single' | 'bulk',
        // Creator tiers are always multi-select — the Mix toggle was removed, so this
        // stays true for every campaign and `selectedTier` is no longer used.
        mixMode: true,
        selectedTier: '',
        creatorSizes: [] as string[],
        tierConfig: [] as TierConfig[],
        budgetMode: 'paid',
        productDetails: '',
        applicationDeadline: '',
        scriptDeadline: '',
        workDeadline: '',
        proofOfWorkDeadline: '',
        usageRights: '',
        deadlineMode: 'common' as 'common' | 'individual',
    }), [programId, visibilityFromUrl]);

    const [form, setForm] = useState(buildEmptyForm);

    useEffect(() => {
        if (id) return;
        // Strip ?fresh=true from URL without side effects.
        if (searchParams.get('fresh') === 'true') {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('fresh');
            const queryString = newParams.toString();
            navigate(`/campaigns/create${queryString ? '?' + queryString : ''}`, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Keep edit page subscribed to campaign-scoped realtime events.
    useEffect(() => {
        if (!id) return;
        ws.joinCampaign(id);
        return () => {
            ws.leaveCampaign(id);
        };
    }, [id]);

    // Scroll to top on component mount and whenever step changes
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, [step]);

    const normalizedNiche = Array.isArray(form.niche)
        ? (form.niche[0] || '')
        : (normalizeNicheKey(form.niche) || form.niche);

    useEffect(() => {
        if (campaignData && !hasHydratedFromCampaignRef.current) {
            // Flat fields from backend vs nested fields from frontend
            const totalBudget = campaignData.budgetTotal || campaignData.budget?.total || '';
            const budgetMode = campaignData.budgetMode || campaignData.budget?.mode || 'paid';
            const tierPricing = campaignData.budgetTierPricing || campaignData.budget?.tierPricing || [];
            const nichesRaw = campaignData.niches || campaignData.niche || [];
            const niches = Array.isArray(nichesRaw) ? nichesRaw : [nichesRaw].filter(Boolean);
            const mappedNiches = niches.map((n: string) => normalizeNicheKey(n) || n).filter(Boolean);

            const req = campaignData.requirements;
            const timeline = campaignData.timeline;
            const campaignAny = campaignData as Campaign & Record<string, unknown>;

            const rawReferences = req?.references ?? campaignData.referenceUrls ?? [];
            const referencesArray = Array.isArray(rawReferences)
                ? (rawReferences.filter(Boolean).length > 0 ? rawReferences.filter(Boolean) : [''])
                : typeof rawReferences === 'string' && rawReferences.trim()
                    ? rawReferences.split('\n').map((s: string) => s.trim()).filter(Boolean)
                    : [''];

            const deliverableTypes = Array.isArray(campaignData.deliverables)
                ? campaignData.deliverables
                    .map((d) => {
                        const row = d as { type?: string };
                        return row.type || '';
                    })
                    .filter(Boolean)
                : [];

            const contentTypes = (req?.contentTypes || (campaignAny.contentTypes as string[] | undefined) || deliverableTypes)
                // Stored as labels since Jul 2026 (legacy rows hold ids) — the picker needs ids.
                .map(normalizeContentTypeToId);

            // deliverables[].type may be a legacy label ("Reel") — key counts by picker id.
            const contentTypeCounts: Record<string, number> = {};
            if (Array.isArray(campaignData.deliverables)) {
                for (const d of campaignData.deliverables as Array<{ type?: string; count?: number }>) {
                    const count = Math.trunc(Number(d.count) || 1);
                    if (d.type && count > 1) {
                        contentTypeCounts[normalizeContentTypeToId(d.type)] = Math.min(MAX_DELIVERABLE_COUNT, count);
                    }
                }
            }

            const pickDate = (value?: string | Date | null) => {
                if (!value) return '';

                // Preserve the calendar date from API/DB values to avoid timezone day shifts.
                if (typeof value === 'string') {
                    const datePart = value.trim().split('T')[0];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                        return datePart;
                    }
                }

                const d = typeof value === 'string' ? new Date(value) : value;
                if (!d || Number.isNaN(d.getTime())) return '';

                // Always use UTC methods for calendar dates (YYYY-MM-DD) to prevent 
                // timezone-based day shifts (e.g., 30th appearing as 29th).
                const year = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const resolvedScriptFlow = req?.scriptFlow || (campaignAny.scriptFlow as string | undefined) || '';
            const resolvedScriptType = (
                req?.scriptType ||
                (campaignAny.scriptType as string | undefined) ||
                (resolvedScriptFlow ? 'brand' : 'creator')
            ) as 'brand' | 'creator' | 'none';

            const scriptFileName = campaignAny.scriptFileKey
                ? String(campaignAny.scriptFileKey).split('/').pop() || ''
                : '';



            const initAppDeadline = pickDate((campaignData as any).applicationDeadline || campaignData.deadline);
            const initScriptDeadline = pickDate((campaignData as any).scriptDeadline || timeline?.scriptDeadline);
            const initWorkDeadline = pickDate((campaignData as any).workDeadline || timeline?.workDeadline);
            const initProofOfWorkDeadline = pickDate((campaignData as any).proofOfWorkDeadline || timeline?.proofOfWorkDeadline);

            initialDatesRef.current = {
                applicationDeadline: initAppDeadline,
                scriptDeadline: initScriptDeadline,
                workDeadline: initWorkDeadline,
                proofOfWorkDeadline: initProofOfWorkDeadline,
            };

            setForm({
                campaignName: campaignData.name || '',
                description: campaignData.brief || '',
                coverImageName: (campaignData.thumbnail || campaignData.thumbnailUrl) ? 'Current Cover' : '',
                coverImagePreview: campaignData.thumbnail || campaignData.thumbnailUrl || '',
                type: campaignData.type || '',
                niche: mappedNiches,
                visibility: campaignData.visibility || 'public',
                location: campaignData.location || '',
                locationCities: splitLocationParts(campaignData.location).cities,
                locationStates: splitLocationParts(campaignData.location).states,
                creatorGender: (campaignData.creatorGender || 'all') as TargetGender,
                audienceAgeRanges: Array.isArray(campaignData.targetAgeRanges) ? campaignData.targetAgeRanges : [],
                audienceGender: (campaignData.targetGender || 'all') as TargetGender,
                // Older campaigns stored their creator location here (e.g. "Pan India") —
                // only keep entries in the "City, State" form this picker offers.
                audienceLocations: (Array.isArray(campaignData.targetLocations) ? campaignData.targetLocations : [])
                    .filter((loc) => getIndianCityStateOptions().includes(loc)),
                audienceLanguages: Array.isArray(campaignData.targetLanguages) ? campaignData.targetLanguages : [],
                // Step 2
                platform: req?.platform || (campaignAny.platform as string | undefined) || '',
                contentType: contentTypes,
                contentTypeCounts,
                postingType: (req?.postingType || (campaignAny.postingType as string | undefined) || 'creator') as 'creator' | 'brand' | 'collab' | 'collab_optional',
                collabChannel: String(req?.collabChannel || campaignAny.collabChannel || ''),
                references: referencesArray.length > 0 ? referencesArray : [''],
                scriptType: resolvedScriptType,
                scriptFileName,
                scriptFileUrl: '',
                scriptFlow: resolvedScriptFlow,
                proofOfWorkRequired: true,
                visitAtSiteEnabled: Boolean(campaignAny.visitAtSite?.enabled ?? campaignAny.visitAtSiteEnabled),
                visitAtSiteOptions: toVisitLocationDrafts(campaignAny),
                // Step 3
                totalBudget: totalBudget && Number(totalBudget) > 0 ? String(Number(totalBudget)) : '',
                creatorStrategy: (campaignData.budget as any)?.strategy || (campaignAny.selectedTier ? 'single' : 'bulk'),
                mixMode: Boolean((campaignData as any).mixMode ?? (campaignData.budget as any)?.mixMode),
                selectedTier: (campaignData as any).selectedTier || (campaignData.budget as any)?.selectedTier || '',
                creatorSizes: campaignData.creatorSizes || (campaignData.budget as any)?.creatorSizes || [],
                tierConfig: tierPricing.map(tp => ({
                    tier: (tp as any).tier,
                    count: (tp as any).count || 1,
                    amount: (tp as any).amount && Number((tp as any).amount) > 0
                        ? String(Number((tp as any).amount))
                        : ((tp as any).rate && Number((tp as any).rate) > 0 ? String(Number((tp as any).rate)) : ''),
                })),
                budgetMode: budgetMode as 'paid' | 'product' | 'paid_product',
                productDetails: campaignData.productDetails || (campaignData.budget as any)?.productDetails || '',
                applicationDeadline: initAppDeadline,
                scriptDeadline: initScriptDeadline,
                workDeadline: initWorkDeadline,
                proofOfWorkDeadline: initProofOfWorkDeadline,
                usageRights: req?.usageRights || campaignData.usageRights || '',
                deadlineMode: ((campaignAny as any).deadlineMode === 'individual' ? 'individual' : 'common') as 'common' | 'individual',
            });

            // A saved duration outside the preset pills means the brand entered a custom
            // day count — reopen the input so it stays editable instead of silently
            // snapping back to a preset on the next save.
            const savedUsageRights = req?.usageRights || campaignData.usageRights || '';
            setIsCustomUsageRights(
                Boolean(savedUsageRights) && !USAGE_RIGHTS_PRESETS.includes(savedUsageRights as typeof USAGE_RIGHTS_PRESETS[number])
            );

            hasHydratedFromCampaignRef.current = true;
        }
    }, [campaignData]);

    const [scriptAnalysis, setScriptAnalysis] = useState<{
        overallScore: number;
        hook: { score: number; issue: string; suggestion: string };
        cta: { score: number; issue: string; suggestion: string };
        tone: { score: number; issue: string; suggestion: string };
        topWin: string;
        quickFix: string;
        improvedScript: string;
    } | null>(null);
    const [isAnalyzingScript, setIsAnalyzingScript] = useState(false);
    const [scriptAnalysisError, setScriptAnalysisError] = useState<string | null>(null);
    const [improvedScript, setImprovedScript] = useState<string | null>(null);
    const [isGeneratingImprovedScript, setIsGeneratingImprovedScript] = useState(false);
    const [improvedScriptError, setImprovedScriptError] = useState<string | null>(null);

    const handleAnalyzeScript = async () => {
        setIsAnalyzingScript(true);
        setScriptAnalysisError(null);
        setImprovedScript(null);
        setImprovedScriptError(null);
        try {
            if (scriptFileRef.current) {
                const formData = new FormData();
                formData.append('file', scriptFileRef.current);
                formData.append('campaignContext', JSON.stringify({
                    name: form.campaignName,
                    platform: form.platform,
                    niche: form.niche
                }));

                const res = await http.post(API.ai.analyzeScriptFile, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data?.success && res.data?.data) {
                    setScriptAnalysis(res.data.data);
                    if (res.data.data.improvedScript) {
                        setImprovedScript(res.data.data.improvedScript);
                    }
                    toast.success('Script analyzed & improved!');
                } else {
                    throw new Error(res.data?.message || 'Failed to analyze script document');
                }
            } else {
                const text = (form.scriptFlow || '').trim();
                if (!text || text.length < 10) {
                    toast.error(form.scriptFileName ? 'Please re-upload your document file to analyze it.' : 'Please write a script flow of at least 10 characters to analyze.');
                    setIsAnalyzingScript(false);
                    return;
                }

                const res = await http.post(API.ai.analyzeScript, {
                    scriptText: text,
                    campaignContext: {
                        name: form.campaignName,
                        platform: form.platform,
                        niche: form.niche
                    }
                });
                if (res.data?.success && res.data?.data) {
                    setScriptAnalysis(res.data.data);
                    if (res.data.data.improvedScript) {
                        setImprovedScript(res.data.data.improvedScript);
                    }
                    toast.success('Script analyzed & improved!');
                } else {
                    throw new Error(res.data?.message || 'Failed to analyze script');
                }
            }
        } catch (error: any) {
            console.error('Script analysis error:', error);
            const msg = error?.response?.data?.message || error?.message || 'Failed to analyze script';
            setScriptAnalysisError(msg);
            toast.error(msg);
        } finally {
            setIsAnalyzingScript(false);
        }
    };

    // handleGenerateImprovedScript — re-shows the script already returned by the analyze call.
    // Since the backend returns improvedScript in one shot, this just re-triggers the analyze call
    // (so "Regenerate" always fetches a fresh improved version).
    const handleGenerateImprovedScript = async () => {
        if (!scriptAnalysis) return;
        setIsGeneratingImprovedScript(true);
        setImprovedScriptError(null);
        setImprovedScript(null);
        try {
            if (scriptFileRef.current) {
                const formData = new FormData();
                formData.append('file', scriptFileRef.current);
                formData.append('campaignContext', JSON.stringify({
                    name: form.campaignName,
                    platform: form.platform,
                    niche: form.niche
                }));
                const res = await http.post(API.ai.analyzeScriptFile, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data?.success && res.data?.data?.improvedScript) {
                    setImprovedScript(res.data.data.improvedScript);
                    setScriptAnalysis(res.data.data);
                } else {
                    throw new Error(res.data?.message || 'Failed to regenerate improved script');
                }
            } else {
                const text = (form.scriptFlow || '').trim();
                if (!text || text.length < 10) return;
                const res = await http.post(API.ai.analyzeScript, {
                    scriptText: text,
                    campaignContext: {
                        name: form.campaignName,
                        platform: form.platform,
                        niche: form.niche
                    }
                });
                if (res.data?.success && res.data?.data?.improvedScript) {
                    setImprovedScript(res.data.data.improvedScript);
                    setScriptAnalysis(res.data.data);
                } else {
                    throw new Error(res.data?.message || 'Failed to regenerate improved script');
                }
            }
        } catch (error: any) {
            const msg = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Failed to regenerate';
            setImprovedScriptError(msg);
        } finally {
            setIsGeneratingImprovedScript(false);
        }
    };

    const handleUseImprovedScript = () => {
        const script = improvedScript || scriptAnalysis?.improvedScript;
        if (!script) return;
        if (form.scriptFileUrl?.startsWith('blob:')) URL.revokeObjectURL(form.scriptFileUrl);
        update('scriptFileName', '');
        update('scriptFileUrl', '');
        scriptFileRef.current = null;
        update('scriptFlow', script.slice(0, MAX_SCRIPT_FLOW_LENGTH));
        setScriptAnalysis(null);
        setImprovedScript(null);
        setImprovedScriptError(null);
        toast.success('Script updated with AI-improved version!');
    };

    // Clear AI script analysis when script content is completely removed or toggled off
    useEffect(() => {
        if (form.scriptType !== 'brand') {
            setScriptAnalysis(null);
            setScriptAnalysisError(null);
            setImprovedScript(null);
            setImprovedScriptError(null);
            return;
        }
        if (!form.scriptFlow.trim() && !form.scriptFileName) {
            setScriptAnalysis(null);
            setScriptAnalysisError(null);
            setImprovedScript(null);
            setImprovedScriptError(null);
        }
    }, [form.scriptFlow, form.scriptFileName, form.scriptType]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    /**
     * Wipes everything the builder is holding and returns to step 1.
     *
     * Deliberately local-only: it does NOT delete the campaign or touch the server. It clears
     * what is on screen so the form can be filled again from scratch — including the two file
     * refs, which are not part of `form` and so would otherwise survive a reset and silently
     * re-upload the previous cover image or script on the next save.
     */
    const clearAllInfo = () => {
        setForm(buildEmptyForm());
        setErrors({});
        coverImageFileRef.current = null;
        scriptFileRef.current = null;
        setCropperSrc(null);
        setStep(1);
        toast.success('Cleared. Start filling the campaign again.');
    };

    useEffect(() => {
        setDraftCampaignId(id ?? null);
        draftCampaignIdRef.current = id ?? null;
        hasHydratedFromCampaignRef.current = false;
    }, [id]);

    const update = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

    const clearError = (key: string) =>
        setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });



    // Re-validates all deadline cross-field ordering whenever any one deadline changes.
    // Called from each deadline DateField's onChange so errors update on typing, not just on Next.
    // `field` + `newValue` represent the field being changed — we substitute newValue for it
    // instead of reading from `form` to avoid the stale-closure problem (state hasn't flushed yet).
    const validateDeadlineField = (
        field: 'applicationDeadline' | 'scriptDeadline' | 'workDeadline' | 'proofOfWorkDeadline',
        newValue: string,
    ) => {
        // Incomplete typed dates come in as "" — nothing to validate yet.
        if (!newValue) { clearError(field); return; }

        const today = new Date().toISOString().split('T')[0];
        const v = {
            applicationDeadline: field === 'applicationDeadline' ? newValue : form.applicationDeadline,
            scriptDeadline: field === 'scriptDeadline' ? newValue : form.scriptDeadline,
            workDeadline: field === 'workDeadline' ? newValue : form.workDeadline,
            proofOfWorkDeadline: field === 'proofOfWorkDeadline' ? newValue : form.proofOfWorkDeadline,
        };

        const errs: Record<string, string> = {};
        const hasScriptPhase = form.scriptType === 'creator';

        // Each deadline must be in the future, and they must run in order —
        // application ≤ script ≤ work ≤ proof. Sharing a date is allowed; only a
        // strictly earlier date is an error. Mirrors validateStep(3) and the backend.
        if (v.applicationDeadline && v.applicationDeadline <= today)
            errs.applicationDeadline = 'Application deadline must be in the future';

        if (hasScriptPhase && v.scriptDeadline) {
            if (v.scriptDeadline <= today)
                errs.scriptDeadline = 'Script deadline must be in the future';
            else if (v.applicationDeadline && v.scriptDeadline < v.applicationDeadline)
                errs.scriptDeadline = 'Script deadline cannot be before the application deadline';
        }

        if (v.workDeadline) {
            if (v.workDeadline <= today)
                errs.workDeadline = 'Work deadline must be in the future';
            else if (hasScriptPhase && v.scriptDeadline && v.workDeadline < v.scriptDeadline)
                errs.workDeadline = 'Work deadline cannot be before the script deadline';
            else if (v.applicationDeadline && v.workDeadline < v.applicationDeadline)
                errs.workDeadline = 'Work deadline cannot be before the application deadline';
        }

        if (form.proofOfWorkRequired && v.proofOfWorkDeadline) {
            if (v.proofOfWorkDeadline <= today)
                errs.proofOfWorkDeadline = 'Proof of work deadline must be in the future';
            // Enforced by the DB's campaigns_deadline_order_check — same day is allowed.
            else if (v.workDeadline && v.proofOfWorkDeadline < v.workDeadline)
                errs.proofOfWorkDeadline = 'Proof of work deadline cannot be before the work deadline';
        }

        setErrors(prev => {
            const next = { ...prev };
            delete next.applicationDeadline;
            delete next.scriptDeadline;
            delete next.workDeadline;
            delete next.proofOfWorkDeadline;
            return { ...next, ...errs };
        });
    };

    const handleCoverImageFile = (file: File) => {
        if (!isAllowedCoverImageFile(file)) {
            setErrors((prev) => ({
                ...prev,
                coverImagePreview: 'Only JPG and PNG images are allowed.',
            }));
            toast.error('Only JPG and PNG images are allowed.');
            return;
        }
        if (file.size > MAX_COVER_IMAGE_SIZE_BYTES) {
            setErrors((prev) => ({
                ...prev,
                coverImagePreview: 'Cover image must be 5MB or smaller.',
            }));
            toast.error('Cover image must be 5MB or smaller.');
            return;
        }

        update('coverImageName', file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            coverOriginalSrcRef.current = reader.result as string;
            setCropperSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
        clearError('coverImagePreview');
    };

    const scrollToFirstValidationError = (firstErrorMessage?: string) => {
        requestAnimationFrame(() => {
            const errorNodes = Array.from(document.querySelectorAll('p.text-red-500, p.text-destructive'));
            if (errorNodes.length === 0) return;

            const matched = firstErrorMessage
                ? errorNodes.find((node) => node.textContent?.trim() === firstErrorMessage)
                : null;
            const target = (matched ?? errorNodes[0]) as HTMLElement;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    };

    const validateStep = (stepNum: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (stepNum === 1) {
            if (!isLiveStatus) {
                const campaignNameValue = normalizeRequiredText(form.campaignName);
                const descriptionValue = normalizeRequiredText(form.description, { allowNewlines: true, maxLength: MAX_DESCRIPTION_LENGTH });

                if (!campaignNameValue) newErrors.campaignName = 'Campaign name is required';
                if (!descriptionValue) {
                    newErrors.description = 'Campaign brief is required';
                } else if (descriptionValue.length > MAX_DESCRIPTION_LENGTH) {
                    newErrors.description = `Campaign brief must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
                }
                if (!form.coverImagePreview) newErrors.coverImagePreview = 'Please upload a cover image';
                // Campaign Type picker removed — `type` is pinned to 'influencer', so there is
                // nothing for the user to get wrong here. Restore alongside the JSX block.
                // if (!form.type) newErrors.type = 'Please select a campaign type';
                if (form.locationStates.length === 0) newErrors.locationStates = 'Select at least one city, or choose Pan India';
            }
        }

        if (stepNum === 2) {
            if (!isLiveStatus) {
                if (!form.niche || form.niche.length === 0) newErrors.niche = 'Please select an industry';
                if (!form.platform) newErrors.platform = 'Please select a platform';
                if (form.platform) {
                    if (form.contentType.length === 0) {
                        newErrors.contentType = 'Please select at least one deliverable';
                    } else if (form.platform === 'both') {
                        const hasInsta = form.contentType.some(id => INSTAGRAM_CONTENT_FORMATS.some(f => f.id === id));
                        const hasYt = form.contentType.some(id => YOUTUBE_CONTENT_FORMATS.some(f => f.id === id));
                        // contentType is non-empty here, so exactly one platform can be missing.
                        if (!hasInsta) {
                            newErrors.contentType = 'Please select at least one Instagram deliverable';
                        } else if (!hasYt) {
                            newErrors.contentType = 'Please select at least one YouTube deliverable';
                        }
                    }
                }
                if (isCustomUsageRights && !form.usageRights.replace(/\D/g, '')) {
                    // Picking Custom without typing a number would otherwise save an empty value.
                    newErrors.usageRights = 'Please enter the number of days';
                }
                // Once the tag is a firm Yes the creator must know which channel to send the
                // collaborator invite to. 'Optional' leaves both the tag and the handle open.
                if (form.postingType === 'collab' && !normalizeRequiredText(form.collabChannel)) {
                    newErrors.collabChannel = 'Please enter the channel to collaborate with';
                }
                const scriptFlowValue = normalizeRequiredText(form.scriptFlow, { allowNewlines: true, maxLength: MAX_SCRIPT_FLOW_LENGTH });
                if (form.scriptType === 'brand' && !scriptFlowValue && !form.scriptFileName) {
                    newErrors.scriptFlow = 'Please provide a script flow or upload a file';
                } else if (form.scriptType === 'brand' && scriptFlowValue && !form.scriptFileName && scriptFlowValue.length < 30) {
                    newErrors.scriptFlow = 'Script content must be at least 30 characters';
                }
                if (form.scriptType === 'brand' && scriptFlowValue && scriptFlowValue.length > MAX_SCRIPT_FLOW_LENGTH) {
                    newErrors.scriptFlow = `Script content must be ${MAX_SCRIPT_FLOW_LENGTH} characters or fewer`;
                }
                if (form.visitAtSiteEnabled) {
                    if (form.visitAtSiteOptions.length === 0) {
                        newErrors.visitAtSiteOptions = 'At least one visit location is required';
                    } else {
                        form.visitAtSiteOptions.forEach((loc) => {
                            if (!normalizeRequiredText(loc.description, { allowNewlines: true })) {
                                newErrors[`visitAtSiteOption_${loc.id}_description`] = 'Location description is required';
                            }
                        });
                    }
                }

                const invalidReference = (form.references || [])
                    .map((ref) => sanitizeForSave(ref, { maxLength: MAX_REFERENCE_LENGTH }))
                    .find((ref) => ref.length > 0 && !isHttpUrl(ref));
                if (invalidReference) {
                    newErrors.references = 'References must be full URLs starting with http:// or https://';
                }
            }
        }

        if (stepNum === 3) {
            if (!isLiveStatus) {
                // For product-only campaigns, skip budget and tier validation
                if (form.budgetMode !== 'product') {
                    const budget = Number(form.totalBudget) || 0;
                    if (!form.totalBudget || budget <= 0) newErrors.totalBudget = 'Please enter a valid budget amount';

                    if (isPublic) {
                        const hasTier = isMix ? form.creatorSizes.length > 0 : !!form.selectedTier;
                        if (!hasTier) {
                            if (budget > 0) {
                                const affordableTiers = creatorSizes.filter(s => isTierAffordable(s.key)).map(s => s.label).join(', ');
                                if (affordableTiers) {
                                    newErrors.creatorTier = `Please select from available tiers: ${affordableTiers}`;
                                } else {
                                    const minTier = creatorSizes[0];
                                    const minBudget = tierCosts[minTier.key]?.min ?? 0;
                                    newErrors.creatorTier = `Your budget is too low. Minimum ₹${minBudget.toLocaleString('en-IN')} required for any tier.`;
                                }
                            } else {
                                newErrors.creatorTier = 'Please select at least one creator tier';
                            }
                        }

                        // Selected tier must be affordable
                        if (!isMix && form.selectedTier && budget > 0 && !isTierAffordable(form.selectedTier)) {
                            newErrors.creatorTier = `Budget too low for the selected tier. Minimum ₹${(tierCosts[form.selectedTier]?.min ?? 0).toLocaleString('en-IN')} required. Increase budget or select a lower tier.`;
                        }
                    }
                }

                // The mix-mode "planned reach exceeds budget" check lived here. It was only
                // resolvable through the Detailed Breakdown's creator-count steppers; with that
                // section removed the user has no way to lower the projection, so blocking on it
                // would be a dead end. Per-tier affordability above still gates tier selection.

                if ((form.budgetMode === 'product' || form.budgetMode === 'paid_product') && !normalizeRequiredText(form.productDetails, { allowNewlines: true })) {
                    newErrors.productDetails = 'Product details are required for product-based campaigns';
                }
            }

            if (isLiveStatus) {
                const oldTotalBudget = Number(campaignData?.budgetTotal || (campaignData as any)?.budget?.total || 0);
                const currentBudget = Number(form.totalBudget) || 0;
                if (currentBudget < oldTotalBudget) {
                    newErrors.totalBudget = `Cannot decrease budget below the active campaign budget (₹${oldTotalBudget.toLocaleString('en-IN')})`;
                }

                // Deadlines no longer have to run in sequence — any of them may share a date.
                // The one exception is proof-of-work, which the DB enforces with the
                // campaigns_deadline_order_check constraint (work_deadline <= proof_of_work_deadline).
                // Same-day passes that constraint; an earlier proof date would raise a raw DB error.
                if (form.deadlineMode !== 'individual' && form.proofOfWorkRequired) {
                    if (form.workDeadline && form.proofOfWorkDeadline && form.proofOfWorkDeadline < form.workDeadline) {
                        newErrors.proofOfWorkDeadline = 'Proof of work deadline cannot be before the work deadline';
                    }
                }

                // Extensions must keep the application ≤ script ≤ work order (same day OK).
                if (form.deadlineMode !== 'individual') {
                    if (form.scriptType === 'creator' && form.scriptDeadline && form.applicationDeadline &&
                        form.scriptDeadline < form.applicationDeadline) {
                        newErrors.scriptDeadline = 'Script deadline cannot be before the application deadline';
                    }
                    if (form.workDeadline) {
                        if (form.scriptType === 'creator' && form.scriptDeadline && form.workDeadline < form.scriptDeadline) {
                            newErrors.workDeadline = 'Work deadline cannot be before the script deadline';
                        } else if (form.applicationDeadline && form.workDeadline < form.applicationDeadline) {
                            newErrors.workDeadline = 'Work deadline cannot be before the application deadline';
                        }
                    }
                }
            }

            // Deadline validation — skip entirely when updating/editing an already-launched campaign.
            // Dates are required for new campaign creation and when editing a draft that has never been launched.
            const isRelaunch = campaignData?.launchedAt != null;
            const isIndividualDeadline = form.deadlineMode === 'individual';
            if (!isRelaunch) {
                // Every deadline must land strictly after today. They are otherwise
                // independent — application, script, work and proof may all share a date.
                const today = new Date().toISOString().split('T')[0];
                const isPastOrToday = (value: string) => value <= today;

                // Application deadline is required even in individual-deadline mode when the
                // campaign is public — it's still what closes applications. Script/work/proof
                // are deferred to per-creator entry during review in that mode, so they're
                // skipped below.
                if (!isIndividualDeadline || isPublic) {
                    if (!form.applicationDeadline) {
                        newErrors.applicationDeadline = 'Application deadline is required';
                    } else if (isPastOrToday(form.applicationDeadline)) {
                        newErrors.applicationDeadline = 'Application deadline must be in the future';
                    }
                }

                // Script/work/proof deadlines aren't collected on this form in individual-deadline
                // mode — they're set per creator during review — so skip their validation here.
                if (!isIndividualDeadline) {
                    if (!form.workDeadline) {
                        newErrors.workDeadline = 'Work deadline is required';
                    } else if (isPastOrToday(form.workDeadline)) {
                        newErrors.workDeadline = 'Work deadline must be in the future';
                    }

                    if (form.scriptType === 'creator') {
                        if (!form.scriptDeadline) {
                            newErrors.scriptDeadline = 'Script deadline is required';
                        } else if (isPastOrToday(form.scriptDeadline)) {
                            newErrors.scriptDeadline = 'Script deadline must be in the future';
                        }
                    }

                    if (form.proofOfWorkRequired) {
                        if (!form.proofOfWorkDeadline) {
                            newErrors.proofOfWorkDeadline = 'Proof of work deadline is required';
                        } else if (isPastOrToday(form.proofOfWorkDeadline)) {
                            newErrors.proofOfWorkDeadline = 'Proof of work deadline must be in the future';
                        } else if (form.workDeadline && form.proofOfWorkDeadline < form.workDeadline) {
                            // Enforced by the DB's campaigns_deadline_order_check — same day is fine.
                            newErrors.proofOfWorkDeadline = 'Proof of work deadline cannot be before the work deadline';
                        }
                    }

                    // Deadline ordering: application ≤ script ≤ work (≤ proof, checked above).
                    // Sharing a date is allowed — only a strictly earlier date is rejected.
                    if (!newErrors.scriptDeadline && form.scriptType === 'creator' && form.scriptDeadline &&
                        form.applicationDeadline && form.scriptDeadline < form.applicationDeadline) {
                        newErrors.scriptDeadline = 'Script deadline cannot be before the application deadline';
                    }
                    if (!newErrors.workDeadline && form.workDeadline) {
                        if (form.scriptType === 'creator' && form.scriptDeadline && form.workDeadline < form.scriptDeadline) {
                            newErrors.workDeadline = 'Work deadline cannot be before the script deadline';
                        } else if (form.applicationDeadline && form.workDeadline < form.applicationDeadline) {
                            newErrors.workDeadline = 'Work deadline cannot be before the application deadline';
                        }
                    }
                }
            }

        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            const firstErrorMessage = Object.values(newErrors)[0];
            scrollToFirstValidationError(firstErrorMessage);
            toast.error('Please complete all required fields');
            return false;
        }
        return true;
    };

    const toggleContentType = (id: string) => {
        setForm((prev) => {
            const removing = prev.contentType.includes(id);
            const { [id]: _dropped, ...restCounts } = prev.contentTypeCounts;
            return {
                ...prev,
                contentType: removing
                    ? prev.contentType.filter((f) => f !== id)
                    : [...prev.contentType, id],
                // Deselecting forgets the quantity, so re-selecting starts again at 1.
                contentTypeCounts: removing ? restCounts : prev.contentTypeCounts,
            };
        });
    };

    const setContentTypeCount = (id: string, count: number) => {
        const next = Math.min(MAX_DELIVERABLE_COUNT, Math.max(1, count));
        setForm((prev) => ({ ...prev, contentTypeCounts: { ...prev.contentTypeCounts, [id]: next } }));
    };

    // toggleMixMode / selectSingleTier were removed alongside the Mix toggle and the
    // Detailed Breakdown section — tiers are now always multi-select.
    const toggleCreatorSize = (sizeKey: string) => {
        setForm((prev) => {
            const sizes = prev.creatorSizes.includes(sizeKey)
                ? prev.creatorSizes.filter((s) => s !== sizeKey)
                : [...prev.creatorSizes, sizeKey];
            const existingMap = new Map(prev.tierConfig.map((t) => [t.tier, t]));
            const tierConfig = sizes.map((s) => existingMap.get(s) || { tier: s, count: 1, amount: '' });
            return { ...prev, creatorSizes: sizes, tierConfig };
        });
    };

    // updateTierCount / updateTierAmount were the Detailed Breakdown controls. With that
    // section gone every selected tier carries the default count of 1 and no per-tier
    // amount — creators quote their own price on public campaigns anyway.

    // Earliest date any deadline may take: tomorrow. Deadlines are otherwise independent
    // of each other, so every picker shares this floor (proof-of-work additionally cannot
    // precede the work deadline — see validateStep).
    const minDeadlineDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    // ── Usage rights / collaboration tag ──
    // The custom flag is UI-only: the canonical value always lives in form.usageRights.
    const [isCustomUsageRights, setIsCustomUsageRights] = useState(false);
    const usageRightsCustomDays = isCustomUsageRights ? form.usageRights.replace(/\D/g, '') : '';
    // Collab posts are an Instagram feature. The brand/creator publish picker is gone, so
    // platform is the only gate left (legacy 'brand' campaigns simply show the tag as "No").
    const isCollabTagAvailable = platformIncludesInstagram(form.platform);
    const isCollabTagOn = form.postingType === 'collab';
    // 'collab_optional' = brand is happy either way; the creator decides whether to tag.
    const isCollabTagOptional = form.postingType === 'collab_optional';

    // ── Derived state ──
    const isPublic = form.visibility === 'public';
    const activeStrategy = isPublic ? form.creatorStrategy : 'bulk';
    const isBulk = activeStrategy === 'bulk';
    const isMix = form.mixMode && isBulk;
    const shouldUseCreatorTiers = isPublic && form.budgetMode !== 'product';
    const totalBudgetNum = Number(form.totalBudget) || 0;

    const affordabilityEstimates = useMemo(() => {
        if (totalBudgetNum <= 0) return [];

        const feeMultiplier = 1.1; // 10% platform fee
        const remaining = totalBudgetNum;

        return creatorSizes.map((tier) => {
            const minCost = tierCosts[tier.key]?.min ?? 0;
            const perCreatorCost = minCost * feeMultiplier;
            const count = Math.floor(remaining / perCreatorCost);

            return {
                ...tier,
                count,
                perCreatorCost,
            };
        }).filter(t => t.count > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalBudgetNum, creatorSizes, tierCosts]);

    // For private campaigns, always use bulk multi-select (mix mode) and hide the toggle button.
    useEffect(() => {
        if (!isPublic && isBulk && !form.mixMode) {
            setForm((prev) => ({
                ...prev,
                mixMode: true,
            }));
        }
    }, [isPublic, isBulk, form.mixMode]);

    // Posting type used to be driven by campaign type: UGC offered all three options,
    // everything else was forced to "creator posts". With the Campaign Type picker removed
    // and `type` pinned to 'influencer', that rule would pin postingType to 'creator'
    // permanently and make Publishing & Rights unreachable — so it no longer applies.
    // Posting type is now chosen freely in step 2.

    // Collab posts are an Instagram feature — 'both' still includes Instagram, so it stays allowed.
    // Reset 'collab' when the platform no longer covers Instagram (UGC only).
    useEffect(() => {
        if ((form.postingType === 'collab' || form.postingType === 'collab_optional') && !platformIncludesInstagram(form.platform)) {
            update('postingType', 'creator');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.platform]);

    // Private campaigns should not keep creator-tier selections or breakdown in state.
    useEffect(() => {
        if (isPublic) return;

        setForm((prev) => {
            const needsReset = Boolean(
                prev.selectedTier ||
                prev.creatorSizes.length > 0 ||
                prev.tierConfig.length > 0 ||
                prev.mixMode
            );

            if (!needsReset) return prev;

            return {
                ...prev,
                mixMode: false,
                selectedTier: '',
                creatorSizes: [],
                tierConfig: [],
            };
        });

        setErrors((prev) => {
            if (!prev.creatorTier) return prev;
            const next = { ...prev };
            delete next.creatorTier;
            return next;
        });
    }, [isPublic]);

    // A tier is affordable if the budget covers at least 1 creator at the tier's minimum rate
    const isTierAffordable = (tierKey: string): boolean => {
        if (totalBudgetNum <= 0) return true; // no budget entered yet — don't lock anything
        return totalBudgetNum >= (tierCosts[tierKey]?.min ?? 0);
    };

    // Auto-deselect tiers that become unaffordable when budget changes
    useEffect(() => {
        if (totalBudgetNum <= 0) return;
        setForm((prev) => {
            const hadChange =
                (prev.selectedTier && !isTierAffordable(prev.selectedTier)) ||
                prev.creatorSizes.some((s) => !isTierAffordable(s));
            if (!hadChange) return prev;
            const newSelected = prev.selectedTier && isTierAffordable(prev.selectedTier) ? prev.selectedTier : '';
            const newSizes = prev.creatorSizes.filter((s) => isTierAffordable(s));
            const existingMap = new Map(prev.tierConfig.map((t) => [t.tier, t]));
            const newTierConfig = newSizes.map((s) => existingMap.get(s) || { tier: s, count: 1, amount: '' });
            return { ...prev, selectedTier: newSelected, creatorSizes: newSizes, tierConfig: newTierConfig };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalBudgetNum]);

    const singleTierEstimate = (() => {
        if (!shouldUseCreatorTiers || isMix || !isBulk || !form.selectedTier || totalBudgetNum <= 0) return null;
        const ranges = tierCosts[form.selectedTier];
        if (!ranges) return null;
        return {
            min: Math.max(1, Math.floor(totalBudgetNum / ranges.max)),
            max: Math.max(1, Math.floor(totalBudgetNum / ranges.min)),
        };
    })();

    // consumedBudget / remainingBudget / progressPct / isOverBudget / totalCreatorsInMix were
    // dropped with the preview's Tier Breakdown + Est. Budget Used rows — nothing renders them.

    const isLiveStatus = isEdit && campaignData?.status === 'active';
    const isIncreaseBudgetIntent = searchParams.get('action') === 'increase_budget';
    const isBudgetLocked = isLiveStatus && !isIncreaseBudgetIntent;
    const isoToDateInput = (iso: string | null | undefined): string =>
        iso ? String(iso).split('T')[0] : '';

    // City data derived from all selected non-PanIndia states (deduplicated)
    const nonPanStates = form.locationStates.filter(s => s !== 'Pan India');
    const stateCities = [...new Set(nonPanStates.flatMap(s => getIndianCities(s)))];
    // Built once and cached inside the helper (~4k "City, State" entries).
    const audienceCityOptions = getIndianCityStateOptions();

    // Sidebar display helpers
    const selectedNiche = NICHE_CATEGORIES.find(n => n.key === normalizedNiche);
    const selectedContentTypes = (CONTENT_FORMATS_BY_PLATFORM[form.platform] || []).filter(f => form.contentType.includes(f.id));
    // Creator-location summary for the live phone preview.
    const previewLocation = form.locationStates.includes('Pan India')
        ? 'Pan India'
        : [
            nonPanStates.length > 2 ? `${nonPanStates.slice(0, 2).join(', ')} +${nonPanStates.length - 2}` : nonPanStates.join(', '),
            form.locationCities.length > 0 ? `${form.locationCities.length} ${form.locationCities.length === 1 ? 'city' : 'cities'}` : '',
        ].filter(Boolean).join(' · ');
    // Per-creator rate for the preview's ₹ pill: one amount, or the min–max across tiers.
    const previewRateAmounts = form.budgetMode === 'product'
        ? []
        : form.tierConfig.map((t) => Number(t.amount)).filter((n) => n > 0);
    const previewRate = previewRateAmounts.length === 0
        ? ''
        : Math.min(...previewRateAmounts) === Math.max(...previewRateAmounts)
            ? previewRateAmounts[0].toLocaleString('en-IN')
            : `${Math.min(...previewRateAmounts).toLocaleString('en-IN')} – ${Math.max(...previewRateAmounts).toLocaleString('en-IN')}`;

    // Product-only campaigns should not retain stale paid-budget/tier state.
    useEffect(() => {
        if (form.budgetMode !== 'product') return;

        setForm((prev) => {
            const needsReset = Boolean(
                prev.totalBudget ||
                prev.selectedTier ||
                prev.creatorSizes.length > 0 ||
                prev.tierConfig.length > 0 ||
                prev.mixMode
            );

            if (!needsReset) return prev;

            return {
                ...prev,
                totalBudget: '',
                mixMode: false,
                selectedTier: '',
                creatorSizes: [],
                tierConfig: [],
            };
        });

        setErrors((prev) => {
            if (!prev.totalBudget && !prev.creatorTier) return prev;
            const next = { ...prev };
            delete next.totalBudget;
            delete next.creatorTier;
            return next;
        });
    }, [form.budgetMode]);

    const buildPayload = (status: 'draft' | 'active') => {
        const totalBudgetNum = Number(form.totalBudget) || 0;
        const includePaidBudget = form.budgetMode !== 'product';
        const includeCreatorTiers = includePaidBudget && isPublic;

        const tierConfig = form.tierConfig
            .filter((t) => t.tier)
            .map((t) => ({
                tier: t.tier as 'nano' | 'micro' | 'mid' | 'macro' | 'mega',
                count: t.count || 1,
                amount: t.amount ? Number(t.amount) : 0,
            }));

        const referencesArray = (form.references || [])
            .map((s) => sanitizeForSave(s, { maxLength: MAX_REFERENCE_LENGTH }))
            .filter(Boolean);

        const campaignNameValue = toOptionalText(form.campaignName, { maxLength: 100 });
        const descriptionValue = toOptionalText(form.description, { allowNewlines: true, maxLength: MAX_DESCRIPTION_LENGTH });
        const locationValue = form.locationStates[0] === 'Pan India'
            ? 'Pan India'
            : toOptionalText(joinLocationParts(form.locationCities, form.locationStates), { maxLength: 200 });
        const scriptFlowValue = toOptionalText(form.scriptFlow, { allowNewlines: true });
        const scriptFileNameValue = toOptionalText(form.scriptFileName, { maxLength: 255 });
        const productDetailsValue = toOptionalText(form.productDetails, { allowNewlines: true, maxLength: 1000 });
        const visitAtSiteOptionsValue = form.visitAtSiteOptions.map((loc) => ({
            // Client-generated ids double as stable opaque identifiers for new locations;
            // the server keeps them as-is (or generates one if omitted).
            id: loc.id,
            description: normalizeRequiredText(loc.description, { allowNewlines: true, maxLength: 1000 }),
        }));
        const coverImageValue = normalizeCoverImageForPayload(form.coverImagePreview);


        return {
            basics: {
                campaignName: campaignNameValue,
                description: descriptionValue,
                // Never send temporary local preview URIs/base64 to API.
                // Cover file is uploaded via /thumbnail endpoint after draft save.
                coverImageUrl: coverImageValue,
                // Guard: empty string fails Zod strict enum — send undefined when not yet selected
                type: form.type ? (form.type as 'influencer' | 'ugc' | 'meme' | 'twitter') : undefined,
                niche: form.niche.length > 0
                    ? form.niche.map(key => NICHE_CATEGORIES.find(n => n.key === key)?.label || key)
                    : undefined,
                visibility: form.visibility as 'public' | 'private',
                location: locationValue,
                creatorGender: form.creatorGender,
                targetAudience: {
                    ageRanges: TARGET_AGE_RANGES.filter((r) => form.audienceAgeRanges.includes(r)),
                    gender: form.audienceGender,
                    locations: form.audienceLocations,
                    languages: form.audienceLanguages,
                },
            },
            deliverables: {
                industry: form.niche.length > 0
                    ? form.niche.map(key => NICHE_CATEGORIES.find(n => n.key === key)?.label || key)
                    : undefined,
                platform: form.platform ? (form.platform as 'instagram' | 'youtube' | 'twitter' | 'both') : undefined,
                // Send labels ("Dedicated Video"), not ids ("dedicated") — creators read these raw.
                contentTypes: form.contentType.length > 0
                    ? [...form.contentType]
                    : undefined,
                contentTypeCounts: form.contentType.length > 0
                    ? Object.fromEntries(form.contentType.map((id) => [id, form.contentTypeCounts[id] ?? 1]))
                    : undefined,
                // 'collab'/'collab_optional' are sent through as-is so the Collaboration Tag
                // round-trips on edit.
                postingType: form.postingType || undefined,
                // null (not undefined) when the tag is off, so switching Yes → No clears the
                // stored handle on partial updates instead of being skipped.
                collabChannel: form.postingType === 'collab' || form.postingType === 'collab_optional'
                    ? (toOptionalText(form.collabChannel, { maxLength: 100 }) ?? null)
                    : null,
                usageRights: form.usageRights || undefined,
                references: referencesArray.length > 0 ? referencesArray : undefined,
                scriptType: form.scriptType || undefined,
                scriptFlow:
                    form.scriptType === 'brand' && scriptFlowValue && !scriptFileNameValue
                        ? scriptFlowValue
                        : undefined,
                scriptFileName:
                    form.scriptType === 'brand' && scriptFileNameValue
                        ? scriptFileNameValue
                        : undefined,
                visitAtSite: form.visitAtSiteEnabled
                    ? {
                        enabled: true,
                        options: visitAtSiteOptionsValue,
                    }
                    : {
                        enabled: false,
                        options: [],
                    },
                proofOfWorkRequired: true,
            },
            budget: {
                budgetMode: form.budgetMode as 'paid' | 'product' | 'paid_product',
                totalBudget: includePaidBudget && totalBudgetNum > 0 ? totalBudgetNum : undefined,
                creatorStrategy: includePaidBudget ? (activeStrategy as 'single' | 'bulk') : undefined,
                mixMode: includeCreatorTiers ? form.mixMode : false,
                selectedTier: includeCreatorTiers && !form.mixMode ? (form.selectedTier || undefined) : undefined,
                creatorSizes: includeCreatorTiers && form.mixMode ? form.creatorSizes : [],
                tierConfig: includeCreatorTiers ? tierConfig : [],
                platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
                productDetails:
                    form.budgetMode === 'product' || form.budgetMode === 'paid_product'
                        ? productDetailsValue
                        : undefined,
                // Application deadline still applies in individual-deadline mode for public
                // campaigns — it's what closes applications; only script/work/proof are deferred.
                applicationDeadline: (form.deadlineMode === 'individual' && !isPublic) ? undefined : (form.applicationDeadline || undefined),
                workDeadline: form.deadlineMode === 'individual' ? undefined : (form.workDeadline || undefined),
                scriptDeadline:
                    form.deadlineMode === 'individual' ? undefined : (form.scriptType === 'creator' ? (form.scriptDeadline || undefined) : undefined),
                proofOfWorkDeadline: form.deadlineMode === 'individual' ? undefined : (form.proofOfWorkRequired ? (form.proofOfWorkDeadline || undefined) : undefined),
            },
            timeline: {
                // Application deadline still applies in individual-deadline mode for public
                // campaigns — it's what closes applications; only script/work/proof are deferred.
                applicationDeadline: (form.deadlineMode === 'individual' && !isPublic) ? undefined : (form.applicationDeadline || undefined),
                workDeadline: form.deadlineMode === 'individual' ? undefined : (form.workDeadline || undefined),
                scriptDeadline:
                    form.deadlineMode === 'individual' ? undefined : (form.scriptType === 'creator' ? (form.scriptDeadline || undefined) : undefined),
                proofOfWorkDeadline: form.deadlineMode === 'individual' ? undefined : (form.proofOfWorkRequired ? (form.proofOfWorkDeadline || undefined) : undefined),
            },
            meta: {
                status,
                proofOfWorkReq: true,
                referenceUrls: referencesArray.length > 0 ? referencesArray : undefined,
                ...(programId && !isEdit ? { programId } : {}),
                deadlineMode: form.deadlineMode,
            },
        };
    };

    const draftSignature = JSON.stringify(buildPayload('draft'));

    const hasAnyDraftContent = () => {
        const nonEmptyText = [
            sanitizeForSave(form.campaignName, { maxLength: 100 }),
            sanitizeForSave(form.description, { allowNewlines: true, maxLength: MAX_DESCRIPTION_LENGTH }),
            sanitizeForSave(form.type),
            form.niche.length > 0 ? 'yes' : '',
            sanitizeForSave(joinLocationParts(form.locationCities, form.locationStates), { maxLength: 200 }),
            sanitizeForSave(form.platform),
            sanitizeForSave(form.scriptFlow, { allowNewlines: true }),
            sanitizeForSave(form.totalBudget),
            sanitizeForSave(form.productDetails, { allowNewlines: true, maxLength: 1000 }),
            sanitizeForSave(form.applicationDeadline),
            sanitizeForSave(form.scriptDeadline),
            sanitizeForSave(form.workDeadline),
            sanitizeForSave(form.proofOfWorkDeadline),
            sanitizeForSave(form.scriptFileName),
            sanitizeForSave(form.coverImagePreview),
        ].some((v) => v.length > 0);

        const hasArrays =
            (form.contentType || []).length > 0 ||
            (form.references || []).some((r) => sanitizeForSave(r, { maxLength: MAX_REFERENCE_LENGTH }).length > 0) ||

            (form.creatorSizes || []).length > 0 ||
            (form.tierConfig || []).length > 0 ||
            (form.visitAtSiteOptions || []).length > 0;

        return nonEmptyText || hasArrays || form.visitAtSiteEnabled;
    };

    const saveDraftInternal = async ({
        mode,
        showToast,
        uploadFiles,
        skipNavigation = false,
    }: {
        mode: 'manual' | 'autosave';
        showToast: boolean;
        uploadFiles: boolean;
        /** When true the function saves but never redirects — caller handles navigation. */
        skipNavigation?: boolean;
    }) => {
        if (!hasAnyDraftContent()) {
            if (showToast) {
                toast.error('Add at least one detail before saving draft.');
            }
            return null;
        }

        if (autoSaveInFlightRef.current) return null;
        autoSaveInFlightRef.current = true;

        const targetId = draftCampaignIdRef.current || id || null;
        const toastId = showToast ? toast.loading(targetId ? 'Updating draft...' : 'Saving draft...') : undefined;

        try {
            const background = mode === 'autosave';
            let campaignId = targetId;
            if (campaignId) {
                await updateCampaignMutation.mutateAsync({ id: campaignId, background, ...(buildPayload('draft') as any) });
            } else {
                const campaign = await createCampaignMutation.mutateAsync({ background, ...(buildPayload('draft') as any) });
                campaignId = campaign.id;
                draftCampaignIdRef.current = campaignId;
                setDraftCampaignId(campaignId);
            }

            if (uploadFiles && campaignId) {
                if (mode === 'manual' || coverImageFileRef.current !== uploadedCoverFileRef.current) {
                    await uploadCoverImage(campaignId, background);
                }
                if (mode === 'manual' || scriptFileRef.current !== uploadedScriptFileRef.current) {
                    await uploadScriptFile(campaignId, background);
                }
            }

            lastSavedDraftSignatureRef.current = draftSignature;
            autoSaveInFlightRef.current = false;

            if (showToast && toastId) {
                toast.success('Draft saved successfully!', { id: toastId });
            }

            if (!skipNavigation) {
                if (mode === 'manual') {
                    try {
                        window.localStorage.removeItem(CAMPAIGN_BUILDER_LOCAL_DRAFT_KEY);
                    } catch {
                        // no-op
                    }
                    if (programId && !id) {
                        navigate(`/programs/${programId}`);
                    } else {
                        navigate('/campaigns');
                    }
                } else if (mode === 'autosave' && campaignId && !id) {
                    const searchParamsString = programId ? `?programId=${programId}${returnRef ? `&ref=${returnRef}` : ''}` : (returnRef ? `?ref=${returnRef}` : '');
                    navigate(`/campaigns/${campaignId}/edit${searchParamsString}`, { replace: true });
                }
            }

            return campaignId;
        } catch (error) {
            autoSaveInFlightRef.current = false;
            const msg = getApiErrorMessage(error, 'Failed to save draft');
            const code = (error as ApiErrorEnvelope)?.response?.data?.error?.code;

            if (showToast && toastId) {
                toast.dismiss(toastId);
                if (code === 'PLAN_UPGRADE_REQUIRED') {
                    toast.error(msg, { action: { label: 'View plans', onClick: () => navigate('/subscription') } });
                } else {
                    toast.error(msg);
                }
            }

            // Don't surface auto-save errors.

            return null;
        }
    };

    const uploadCoverImage = async (campaignId: string, background = false): Promise<boolean> => {
        // Recover the File from the local preview if the ref hasn't been set yet
        // (e.g. user clicked Launch before the cropper's async blob conversion landed).
        if (!coverImageFileRef.current) {
            const preview = String(form.coverImagePreview || '');
            if (preview.startsWith('data:') || preview.startsWith('blob:')) {
                try {
                    const blob = await (await fetch(preview)).blob();
                    coverImageFileRef.current = new File(
                        [blob],
                        form.coverImageName || 'cover.jpg',
                        { type: blob.type || 'image/jpeg' }
                    );
                } catch {
                    toast.error('Cover image could not be prepared for upload. Please re-upload it.');
                    return false;
                }
            }
        }

        if (coverImageFileRef.current) {
            try {
                await uploadThumbnailMutation.mutateAsync({ id: campaignId, file: coverImageFileRef.current, background });
                uploadedCoverFileRef.current = coverImageFileRef.current;
                return true;
            } catch {
                toast.error('Campaign saved, but cover image upload failed. You can re-upload it later.');
                return false;
            }
        }
        return true;
    };

    const uploadScriptFile = async (campaignId: string, background = false): Promise<boolean> => {
        // A "script not required" campaign has no script file — the backend rejects the upload.
        if (scriptFileRef.current && form.scriptType !== 'none') {
            try {
                await uploadScriptMutation.mutateAsync({ id: campaignId, file: scriptFileRef.current, background });
                uploadedScriptFileRef.current = scriptFileRef.current;
                return true;
            } catch {
                toast.error('Campaign saved, but script file upload failed. You can re-upload it later.');
                return false;
            }
        }
        return true;
    };

    // Covers the WHOLE publish run (save → uploads → launch → navigate). The mutations'
    // isPending flags alone leave gaps between calls where a second click restarts the flow.
    // The ref blocks a double click within the same render; the state disables the button.
    const launchInFlightRef = useRef(false);
    const [isLaunching, setIsLaunching] = useState(false);

    const handleLaunch = async () => {
        if (launchInFlightRef.current) return;
        await pendingAutoSaveRef.current;
        // Validate required inputs across steps before hitting API.
        if (!validateStep(1)) {
            setStep(1);
            return;
        }
        if (!validateStep(2)) {
            setStep(2);
            return;
        }
        if (!validateStep(3)) {
            setStep(3);
            return;
        }

        // For product-only campaigns, tier selection is not required
        if (form.budgetMode !== 'product' && isPublic) {
            const hasTier = form.tierConfig.some((t) => t.tier) || !!form.selectedTier;
            if (!hasTier) {
                setStep(3);
                toast.error('Please select at least one creator tier before continuing.');
                return;
            }
        }

        launchInFlightRef.current = true;
        setIsLaunching(true);
        // Released only on failure. On success the page navigates away (or shows the invite
        // prompt), so the button stays disabled rather than allowing a second publish.
        const releaseLaunch = () => {
            launchInFlightRef.current = false;
            setIsLaunching(false);
        };

        const toastId = toast.loading(isEdit ? (isLiveStatus ? 'Updating campaign...' : 'Updating and launching...') : 'Creating your campaign...');
        try {
            let campaignId = id;

            if (isEdit) {
                const targetStatus = isLiveStatus ? 'active' : 'draft';
                await updateCampaignMutation.mutateAsync({ id: id!, ...(buildPayload(targetStatus) as any) });
                campaignId = id;
            } else {
                const existingDraftId = draftCampaignIdRef.current;
                if (existingDraftId) {
                    await updateCampaignMutation.mutateAsync({ id: existingDraftId, ...(buildPayload('draft') as any) });
                    campaignId = existingDraftId;
                } else {
                    const campaign = await createCampaignMutation.mutateAsync(buildPayload('draft') as any);
                    campaignId = campaign.id;
                    draftCampaignIdRef.current = campaignId;
                    setDraftCampaignId(campaignId);
                }
            }

            // Upload cover image if one was selected
            const coverUploadOk = await uploadCoverImage(campaignId!);
            const scriptUploadOk = await uploadScriptFile(campaignId!);

            if (!coverUploadOk || !scriptUploadOk) {
                toast.dismiss(toastId);
                toast.error('Please fix file upload errors before launching the campaign.');
                releaseLaunch();
                return;
            }

            // Publishing submits the campaign for admin approval instead of going live
            // immediately. The API tells us which happened via approvalStatus.
            let isAwaitingApproval = false;

            if (!isLiveStatus) {
                toast.loading('Publishing campaign...', { id: toastId });
                const published = await launchCampaignMutation.mutateAsync(campaignId!);
                isAwaitingApproval = (published as any)?.approvalStatus === 'pending';
                if (isAwaitingApproval) {
                    toast.success('Sent for approval', {
                        id: toastId,
                        description: 'Your campaign goes live as soon as an admin approves it.',
                    });
                } else {
                    toast.success('Campaign published successfully!', { id: toastId });
                }
            } else {
                toast.success('Campaign updated successfully!', { id: toastId });
            }
            try {
                window.localStorage.removeItem(CAMPAIGN_BUILDER_LOCAL_DRAFT_KEY);
                window.localStorage.removeItem('mutiny_ai_strategist_state');
            } catch { /* ignore */ }
            const searchParamsString = searchParams.get('programId');
            if (searchParamsString && !isEdit) {
                navigate(`/programs/${searchParamsString}`);
                return;
            }

            // A private campaign is invisible until creators are invited, so prompt for that
            // instead of dropping the user on an empty campaign page. Skipped for programs
            // (they auto-invite enrollments above), for the discover `ref` flow, which
            // already has its own destination, and while the campaign awaits approval.
            if (!isPublic && !isLiveStatus && !isAwaitingApproval && !returnRef && campaignId) {
                setLaunchedPrivateCampaignId(campaignId);
                return;
            }

            navigate(returnRef ? `/discover/${returnRef}` : `/campaigns/${campaignId}`);
        } catch (error) {
            releaseLaunch();
            toast.dismiss(toastId);
            const msg = getApiErrorMessage(error, 'Failed to launch campaign');
            const code = (error as ApiErrorEnvelope)?.response?.data?.error?.code;
            if (code === 'PLAN_UPGRADE_REQUIRED') {
                toast.error(msg, { action: { label: 'View plans', onClick: () => navigate('/subscription') } });
            } else {
                toast.error(msg);
            }
        }
    };

    const handleSaveDraft = async () => {
        await pendingAutoSaveRef.current;
        await saveDraftInternal({ mode: 'manual', showToast: true, uploadFiles: true });
    };

    /**
     * Saves the draft in the background whenever the user changes step, so every section they
     * fill is on the server. Only drafts: a draft payload would take a live campaign off air,
     * and the API rejects edits to closed/withdrawn ones.
     * Stays on the current URL (no create → edit redirect): that route change re-hydrates the
     * form from the server and would drop local-only state such as a cover not yet uploaded.
     */
    const autoSaveDraft = () => {
        if (isEdit && campaignData?.status !== 'draft') return;
        if (!hasAnyDraftContent()) return;
        const fileNotUploaded = (current: File | null, uploaded: File | null) => current !== null && current !== uploaded;
        const filesPending = fileNotUploaded(coverImageFileRef.current, uploadedCoverFileRef.current)
            || fileNotUploaded(scriptFileRef.current, uploadedScriptFileRef.current);
        if (draftSignature === lastSavedDraftSignatureRef.current && !filesPending) return;
        setAutoSaveStatus('saving');
        pendingAutoSaveRef.current = pendingAutoSaveRef.current
            .then(() => saveDraftInternal({ mode: 'autosave', showToast: false, uploadFiles: true, skipNavigation: true }))
            .then((savedId) => setAutoSaveStatus(savedId ? 'saved' : 'error'))
            // Never leave the chain rejected — Save as Draft and Publish await it.
            .catch(() => setAutoSaveStatus('error'));
    };

    const goToStep = (target: number) => {
        setStep(target);
        autoSaveDraft();
    };

    const handleNext = () => {
        if (!validateStep(step)) return;
        goToStep(Math.min(STEPS.length, step + 1));
    };



    // ── Warn on accidental close when there are truly unsaved changes ─────────
    useEffect(() => {
        if (isLiveStatus) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasAnyDraftContent() && draftSignature !== lastSavedDraftSignatureRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftSignature, isLiveStatus]);

    const aiInitialData = useMemo(() => {
        if (!isEdit || !campaignData) return undefined;
        const c = campaignData as any;
        const req = c.requirements;
        const niches: string[] = c.niches || c.niche || [];
        const niche = String(niches[0] || c.niche || '');
        const pickDate = (val?: string | null) => {
            if (!val) return '';
            const part = String(val).trim().split('T')[0];
            return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : '';
        };
        return {
            campaignName: c.name || '',
            description: c.brief || '',
            type: c.type || '',
            objective: c.objective || '',
            location: c.location || '',
            visibility: c.visibility || 'public',
            niche,
            platform: req?.platform || c.platform || '',
            contentType: req?.contentTypes || c.contentTypes || [],
            postingType: req?.postingType || c.postingType || 'creator',
            scriptType: req?.scriptType || c.scriptType || 'creator',
            budgetMode: c.budgetMode || c.budget?.mode || 'paid',
            totalBudget: String(c.budgetTotal || c.budget?.total || ''),
            mixMode: Boolean(c.mixMode ?? c.budget?.mixMode),
            selectedTier: c.selectedTier || c.budget?.selectedTier || '',
            creatorSizes: c.creatorSizes || c.budget?.creatorSizes || [],
            productDetails: c.productDetails || c.budget?.productDetails || '',
            usageRights: req?.usageRights || c.usageRights || '',
            applicationDeadline: pickDate(c.applicationDeadline || c.deadline),
            scriptDeadline: pickDate(c.scriptDeadline || c.timeline?.scriptDeadline),
            workDeadline: pickDate(c.workDeadline || c.timeline?.workDeadline),
            proofOfWorkDeadline: pickDate(c.proofOfWorkDeadline || c.timeline?.proofOfWorkDeadline),
            deadlineMode: (c.deadlineMode === 'individual' ? 'individual' : 'common') as 'common' | 'individual',
            visitAtSiteEnabled: Boolean(c.visitAtSiteEnabled),
            visitAtSiteDescription: String(c.visitAtSiteDescription || ''),
        };
    }, [isEdit, campaignData]);

    const aiInitialDates = useMemo(() => {
        if (!isEdit || !campaignData) return undefined;
        const c = campaignData as any;
        return {
            applicationDeadline: c.applicationDeadline || c.budget?.applicationDeadline || c.timeline?.applicationDeadline || '',
            scriptDeadline: c.scriptDeadline || c.budget?.scriptDeadline || c.timeline?.scriptDeadline || '',
            workDeadline: c.workDeadline || c.budget?.workDeadline || c.timeline?.workDeadline || '',
        };
    }, [isEdit, campaignData]);

    // Jump to any completed step freely; jumping ahead validates every skipped step first.
    const handleStepClick = (targetStep: number) => {
        if (targetStep < step) {
            goToStep(targetStep);
        } else if (targetStep > step) {
            for (let i = step; i < targetStep; i++) {
                if (!validateStep(i)) return;
            }
            goToStep(targetStep);
        }
    };


    // ── Presentation-only state & helpers for the step-by-step builder UI ──
    const [showBriefExamples, setShowBriefExamples] = useState(false);
    // A starter brief clicked while the brand's own writing is in the box, waiting for a yes/no.
    const [pendingBriefExample, setPendingBriefExample] = useState<string | null>(null);
    // A platform clicked that would drop deliverables already picked, waiting for a yes/no.
    const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
    // Each publish click replays the rocket; each blocked one replays the shake.
    const [launchAttempts, setLaunchAttempts] = useState(0);
    const [refusals, setRefusals] = useState(0);
    const namePlaceholder = useTypingPlaceholder(NAME_EXAMPLES, form.campaignName === '');
    // The top bar's slot for this page's progress controls (see Topbar variant 'dock').
    const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null);
    useEffect(() => setTopbarSlot(document.getElementById(TOPBAR_SLOT_ID)), []);

    const isPanIndia = form.locationStates.includes('Pan India');
    const isPrivate = form.visibility === 'private';
    const isIndividualDeadline = form.deadlineMode === 'individual';
    const showTierTile = isPublic && form.budgetMode !== 'product';
    const isScriptRequired = form.scriptType !== 'none';

    const applyBrief = (text: string) => {
        update('description', sanitizeInputText(text, { allowNewlines: true, maxLength: MAX_DESCRIPTION_LENGTH }));
        clearError('description');
    };
    const pickBriefExample = (text: string) => {
        const ownWriting = form.description.trim() !== '' && !BRIEF_EXAMPLES.some((example) => example.text === form.description);
        if (ownWriting) setPendingBriefExample(text);
        else applyBrief(text);
    };

    const removeCoverImage = () => {
        update('coverImageName', '');
        update('coverImagePreview', '');
        coverImageFileRef.current = null;
        coverOriginalSrcRef.current = null;
        clearError('coverImagePreview');
    };
    // The cropper can only reopen a local image; a server URL may be blocked by CORS.
    const canAdjustCover = Boolean(coverOriginalSrcRef.current) || form.coverImagePreview.startsWith('data:') || form.coverImagePreview.startsWith('blob:');

    const applyCoverCrop = (cropped: Blob) => {
        coverImageFileRef.current = new File([cropped], form.coverImageName || 'cover.jpg', { type: cropped.type || 'image/jpeg' });
        // Kept as a data URL: the save/upload path recovers the file from it if needed.
        const reader = new FileReader();
        reader.onloadend = () => {
            update('coverImagePreview', reader.result as string);
            clearError('coverImagePreview');
        };
        reader.readAsDataURL(cropped);
        setCropperSrc(null);
    };

    // Picked cities drive the states saved with the campaign; states with no city on the board
    // (e.g. from an older campaign) are kept as they were.
    const setCreatorCities = (cities: string[]) => {
        const boardStates = new Set(BOARD_CITIES.map((c) => c.state));
        const pickedStates = BOARD_CITIES.filter((c) => cities.includes(c.city)).map((c) => c.state);
        const otherStates = form.locationStates.filter((st) => st !== 'Pan India' && !boardStates.has(st));
        setForm((prev) => ({ ...prev, locationCities: cities, locationStates: [...new Set([...pickedStates, ...otherStates])] }));
        clearError('locationStates');
    };

    const switchToPrivate = () => {
        if (isPrivate) return;
        if (id || draftCampaignId) {
            setShowConvertToPrivateModal(true);
        } else {
            update('visibility', 'private');
            toast.success('Switched to Private (Invite Only).');
        }
    };

    const formatIdsFor = (platformKey: string) => (CONTENT_FORMATS_BY_PLATFORM[platformKey] || []).map((f) => f.id);
    const formatLabel = (formatId: string) =>
        (CONTENT_FORMATS_BY_PLATFORM[form.platform] || []).find((f) => f.id === formatId)?.label ?? formatId;
    const platformLabel = (platformKey: string) => PLATFORMS.find((p) => p.key === platformKey)?.label ?? platformKey;
    const droppedByPlatform = (platformKey: string) => form.contentType.filter((f) => !formatIdsFor(platformKey).includes(f));
    // Keeps whichever picked deliverables the new platform also offers (ids are shared with 'both').
    const switchPlatform = (platformKey: string) => {
        const keep = formatIdsFor(platformKey);
        setForm((prev) => ({
            ...prev,
            platform: platformKey,
            contentType: prev.contentType.filter((f) => keep.includes(f)),
            contentTypeCounts: Object.fromEntries(Object.entries(prev.contentTypeCounts).filter(([f]) => keep.includes(f))),
        }));
        setPendingPlatform(null);
        clearError('platform');
        clearError('contentType');
    };
    const pickPlatform = (platformKey: string) => {
        if (form.platform === platformKey) {
            setPendingPlatform(null);
            return;
        }
        if (droppedByPlatform(platformKey).length > 0) setPendingPlatform(platformKey);
        else switchPlatform(platformKey);
    };

    const totalDeliverablePieces = form.contentType.reduce((sum, f) => sum + (form.contentTypeCounts[f] ?? 1), 0);
    const deliverablesSummary = form.contentType.length === 0
        ? 'None chosen'
        : `${form.contentType.length} ${form.contentType.length === 1 ? 'type' : 'types'} · ${totalDeliverablePieces} ${totalDeliverablePieces === 1 ? 'piece' : 'pieces'}`;

    const usageRightsDays = form.usageRights.replace(/\D/g, '');
    const usageRightsNote = !form.usageRights && !isCustomUsageRights
        ? "Not set. You can share the creator's post, but not reuse it in your own ads."
        : !usageRightsDays
            ? 'Enter how many days you want to reuse the content for.'
            : `You can reuse the content in your own posts and ads for ${usageRightsDays} ${usageRightsDays === '1' ? 'day' : 'days'} after it goes live.`;

    const pickUsageRights = (value: string) => {
        const currentSelected = isCustomUsageRights ? 'custom' : (form.usageRights || '');
        if (value === currentSelected) {
            update('usageRights', '');
            setIsCustomUsageRights(false);
        } else {
            update('usageRights', value === 'custom' ? '' : value);
            setIsCustomUsageRights(value === 'custom');
        }
        clearError('usageRights');
    };

    const setScriptRequired = (required: boolean) => {
        if (required) {
            update('scriptType', 'creator');
            return;
        }
        if (form.scriptFileUrl?.startsWith('blob:')) URL.revokeObjectURL(form.scriptFileUrl);
        scriptFileRef.current = null;
        setForm((prev) => ({
            ...prev,
            scriptType: 'none',
            scriptFlow: '',
            scriptFileName: '',
            scriptFileUrl: '',
            scriptDeadline: '',
        }));
        clearError('scriptFlow');
        clearError('scriptDeadline');
    };

    const attachScriptFile = (file: File) => {
        if (!isAllowedScriptFile(file)) {
            toast.error('Only PDF, DOC, DOCX, and TXT files are allowed.');
            return;
        }
        if (file.size > MAX_SCRIPT_FILE_SIZE_BYTES) {
            toast.error('Script file must be 100MB or smaller.');
            return;
        }
        scriptFileRef.current = file;
        update('scriptFileUrl', URL.createObjectURL(file));
        update('scriptFileName', file.name);
        update('scriptFlow', '');
        clearError('scriptFlow');
    };
    const removeScriptFile = () => {
        if (form.scriptFileUrl && form.scriptFileUrl.startsWith('blob:')) URL.revokeObjectURL(form.scriptFileUrl);
        update('scriptFileName', '');
        update('scriptFileUrl', '');
        scriptFileRef.current = null;
    };

    const setVisitRequired = (enabled: boolean) => {
        setForm((prev) => ({
            ...prev,
            visitAtSiteEnabled: enabled,
            visitAtSiteOptions: enabled
                ? (prev.visitAtSiteOptions.length > 0 ? prev.visitAtSiteOptions : [makeEmptyVisitLocation()])
                : [],
        }));
        clearError('visitAtSiteOptions');
    };

    const setTotalBudget = (value: string) => {
        let raw = value.toLowerCase().replace(/[^0-9.k]/g, '');
        const parts = raw.split('.');
        if (parts.length > 2) {
            raw = parts[0] + '.' + parts.slice(1).join('').replace(/\./g, '');
        }
        // "25k" → 25000
        if (raw.endsWith('k')) {
            const num = parseFloat(raw.replace('k', ''));
            raw = isNaN(num) ? '' : (num * 1000).toString();
        }
        if (Number(raw) > 9999999999) return;
        if (raw.length > MAX_BUDGET_INPUT_LENGTH) raw = raw.slice(0, MAX_BUDGET_INPUT_LENGTH);
        update('totalBudget', raw);
        clearError('totalBudget');
    };

    const setCreatorSizes = (sizes: string[]) => {
        setForm((prev) => {
            const ordered = creatorSizes.map((s) => s.key).filter((k) => sizes.includes(k));
            const existingMap = new Map(prev.tierConfig.map((t) => [t.tier, t]));
            const tierConfig = ordered.map((s) => existingMap.get(s) || { tier: s, count: 1, amount: '' });
            return { ...prev, creatorSizes: ordered, tierConfig };
        });
        clearError('creatorTier');
    };
    const tierPickable = (key: string) => totalBudgetNum >= minTierBudget && isTierAffordable(key);
    const tiersSummary = form.creatorSizes.length === 0
        ? 'None chosen'
        : form.creatorSizes.length === creatorSizes.length
            ? 'All tiers'
            : form.creatorSizes.length <= 2
                ? form.creatorSizes.map((k) => creatorSizes.find((c) => c.key === k)?.label ?? k).join(', ')
                : `${form.creatorSizes.length} tiers`;

    type DeadlineKey = 'applicationDeadline' | 'scriptDeadline' | 'workDeadline' | 'proofOfWorkDeadline';
    const deadlineFields: { key: DeadlineKey; label: string; min: string }[] = [
        ...(!isIndividualDeadline || isPublic
            ? [{
                key: 'applicationDeadline' as const,
                label: 'Application deadline',
                min: isLiveStatus ? (isoToDateInput(campaignData?.applicationDeadline) || form.applicationDeadline) : minDeadlineDate,
            }]
            : []),
        ...(!isIndividualDeadline && form.scriptType === 'creator'
            ? [{
                key: 'scriptDeadline' as const,
                label: 'Script deadline',
                min: isLiveStatus ? (isoToDateInput(campaignData?.scriptDeadline) || form.scriptDeadline) : (form.applicationDeadline || minDeadlineDate),
            }]
            : []),
        ...(!isIndividualDeadline
            ? [{
                key: 'workDeadline' as const,
                label: 'Work deadline',
                min: isLiveStatus
                    ? (isoToDateInput(campaignData?.workDeadline) || form.workDeadline)
                    : ((form.scriptType === 'creator' && form.scriptDeadline) || form.applicationDeadline || minDeadlineDate),
            }]
            : []),
        ...(!isIndividualDeadline && form.proofOfWorkRequired
            ? [{
                key: 'proofOfWorkDeadline' as const,
                label: 'Proof deadline',
                min: isLiveStatus ? (isoToDateInput(campaignData?.proofOfWorkDeadline) || form.proofOfWorkDeadline) : (form.workDeadline || minDeadlineDate),
            }]
            : []),
    ];

    // A quick read on what each step still needs. The real gate is still validateStep().
    const stepChecklist: boolean[][] = [
        isLiveStatus ? [] : [
            Boolean(normalizeRequiredText(form.campaignName)),
            Boolean(normalizeRequiredText(form.description, { allowNewlines: true })),
            Boolean(form.coverImagePreview),
            form.locationStates.length > 0,
        ],
        isLiveStatus ? [] : [
            form.niche.length > 0,
            Boolean(form.platform),
            form.contentType.length > 0,
        ],
        isLiveStatus ? [] : [
            ...(form.budgetMode !== 'product' ? [totalBudgetNum > 0] : []),
            ...(showTierTile ? [form.creatorSizes.length > 0] : []),
            ...(form.budgetMode !== 'paid' ? [Boolean(normalizeRequiredText(form.productDetails, { allowNewlines: true }))] : []),
            ...deadlineFields.map((f) => Boolean(form[f.key])),
        ],
    ];
    const stepRequired = stepChecklist[step - 1] ?? [];
    const stepMissing = stepRequired.filter((ok) => !ok).length;
    const isLastStep = step === STEPS.length;

    const handleContinue = () => {
        if (!isLastStep) {
            handleNext();
            return;
        }
        if (stepMissing > 0) setRefusals((n) => n + 1);
        else setLaunchAttempts((n) => n + 1);
        handleLaunch();
    };

    // What the "Campaigns › New" crumb says about saving. Edits start from saved data, so an
    // empty last-saved signature there doesn't mean anything is unsaved.
    const hasUnsavedChanges = !isInitialEdit && hasAnyDraftContent() && draftSignature !== lastSavedDraftSignatureRef.current;
    const saveState: 'saving' | 'error' | 'unsaved' | 'saved' | null = isLiveStatus
        ? null
        : autoSaveStatus === 'saving'
            ? 'saving'
            : autoSaveStatus === 'error'
                ? 'error'
                : hasUnsavedChanges
                    ? 'unsaved'
                    : autoSaveStatus === 'saved'
                        ? 'saved'
                        : null;

    const lockedBadge = isLiveStatus ? <LockedBadge icon={LockKeyhole} /> : undefined;

    // The phone shows an example campaign until the brand enters a name, a brief or a cover.
    const showingExamplePreview = !(form.campaignName || form.description || form.coverImagePreview);
    const creatorGenderLabel = TARGET_GENDERS.find((g) => g.value === form.creatorGender)?.label ?? 'All';
    const phonePreview = showingExamplePreview
        ? EXAMPLE_CAMPAIGN_PREVIEW
        : {
            name: form.campaignName,
            brief: form.description,
            banner: form.coverImagePreview || null,
            isPrivate,
            categories: form.niche.map((key) => NICHE_CATEGORIES.find((nc) => nc.key === key)?.label || key),
            tiers: isPublic ? form.creatorSizes.map((k) => creatorSizes.find((c) => c.key === k)?.label ?? k) : [],
            location: previewLocation || 'Select states',
            openTo: form.creatorGender === 'all' ? 'All creators' : `${creatorGenderLabel} creators`,
            usageRights: form.usageRights ? formatUsageRights(form.usageRights) : '',
            // The script question belongs to step 2, so the phone doesn't answer it before then.
            script: step === 1
                ? ''
                : !isScriptRequired
                    ? 'Not Required'
                    : form.scriptType === 'creator'
                        ? 'Written by Creator'
                        : 'Provided by Brand',
            applied: 0,
            budget: 0,
        };

    // Title row of the left column (and of the AI tab).
    const pageHeader = (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
                <button
                    type="button"
                    aria-label={isInitialEdit && id ? 'Back to campaign details' : 'Back to dashboard'}
                    title={isInitialEdit && id ? 'Back to campaign details' : 'Back to dashboard'}
                    onClick={() => {
                        // Goes where the label says. Editing an existing campaign returns to that
                        // campaign's detail page; a campaign reached from a program still gets back
                        // there via its own flow.
                        navigate(isInitialEdit && id ? `/campaigns/${id}` : '/dashboard');
                    }}
                    className="group grid h-10 w-10 shrink-0 animate-pop place-items-center rounded-full border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:border-foreground hover:bg-foreground hover:text-background"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </button>
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground [animation-delay:80ms]">
                        Campaigns <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{isInitialEdit ? 'Edit' : 'New'}</span>
                        {activeTab === 'manual' && saveState && (
                            <span
                                key={saveState}
                                className="ml-1.5 flex animate-pop items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] normal-case tracking-normal text-foreground/80 ring-1 ring-border"
                            >
                                {saveState === 'saving' && <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving draft…</>}
                                {saveState === 'saved' && <><Check className="h-2.5 w-2.5 stroke-[3]" /> Draft saved</>}
                                {saveState === 'unsaved' && <><span className="h-1.5 w-1.5 rounded-full bg-brand ring-1 ring-foreground/20" /> Unsaved changes</>}
                                {saveState === 'error' && <span className="text-destructive">Couldn't auto-save. Use Save draft</span>}
                            </span>
                        )}
                    </p>
                    <h1 className="flex gap-[0.28em] font-display text-2xl sm:text-[28px] font-semibold leading-8 tracking-tight">
                        {/* Extra bottom padding keeps the clip from cutting descenders. */}
                        <span className="-mb-1.5 overflow-hidden pb-1.5">
                            <span className="block animate-rise [animation-delay:150ms]">{isInitialEdit ? 'Edit' : 'Create'}</span>
                        </span>
                        <span className="-mb-1.5 overflow-hidden pb-1.5">
                            <span className="block animate-rise [animation-delay:260ms]">campaign</span>
                        </span>
                    </h1>
                </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
                {/* Shown only when the assistant handed off to this form: a way back to the
                    conversation that filled it in, and a way to empty it and start over. */}
                {cameFromAssistant && activeTab === 'manual' && (
                    <>
                        <button
                            type="button"
                            onClick={clearAllInfo}
                            className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:border-foreground hover:text-foreground"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Clear info</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('ai')}
                            className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:border-foreground hover:text-foreground"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Go to chat</span>
                        </button>
                    </>
                )}
                {/* Drafts belong to the form; a live campaign can't go back to draft. */}
                {activeTab === 'manual' && !isLiveStatus && (
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                        title="Save this campaign as a draft"
                        className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground hover:text-foreground hover:shadow-float active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        Save draft
                    </button>
                )}
                <button
                    type="button"
                    aria-pressed={activeTab === 'ai'}
                    onClick={() => setActiveTab('ai')}
                    className={cn(
                        'mode-btn flex h-9 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97]',
                        activeTab === 'ai'
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card text-foreground/80 hover:border-foreground hover:text-foreground',
                    )}
                >
                    <Sparkles className="mode-icon mode-icon-sparkles h-4 w-4" />
                    AI Strategist
                </button>
                {/* Only on the AI Strategist screen: the way back to the form. On the form itself the
                    button would just repeat where you already are, so it is hidden there. */}
                {activeTab === 'ai' && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('manual')}
                        className="mode-btn flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground hover:text-foreground hover:shadow-float active:translate-y-0 active:scale-[0.97]"
                    >
                        <ListChecks className="mode-icon mode-icon-steps h-4 w-4" />
                        <span className="hidden sm:inline">Step-by-step builder</span>
                        <span className="sm:hidden">Builder</span>
                    </button>
                )}
            </div>
        </div>
    );

    // Progress and saving live in the top bar (portal), so they stay put while the form scrolls.
    const builderControls = (
        <div className="flex h-11 w-full max-w-[760px] items-center gap-2 rounded-full border border-border bg-card pl-2 pr-2 shadow-sm">
                <ol className="flex min-w-0 flex-1 items-center gap-2.5">
                    {STEPS.map((s, i) => {
                        const done = s.id < step;
                        const current = s.id === step;
                        return (
                            <li key={s.id} className={cn('flex items-center gap-2.5', i > 0 && 'flex-1')}>
                                {i > 0 && (
                                    <span className="relative h-0.5 min-w-3 flex-1 overflow-hidden rounded-full bg-border">
                                        <span
                                            className={cn(
                                                'block h-full rounded-full bg-foreground transition-[width] duration-500 ease-out',
                                                s.id <= step ? 'w-full' : 'w-0',
                                            )}
                                        />
                                        {/* Moving forward: a yellow streak races along the line into the new step */}
                                        {current && stepDirectionRef.current === 'forward' && (
                                            <span key={`run-${step}`} aria-hidden className="step-runner pointer-events-none absolute inset-y-0" />
                                        )}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    disabled={!done}
                                    onClick={() => goToStep(s.id)}
                                    title={s.desc}
                                    aria-current={current ? 'step' : undefined}
                                    className="group flex items-center gap-2 text-left disabled:cursor-default"
                                >
                                    <span
                                        className={cn(
                                            'relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all duration-300',
                                            current || done
                                                ? 'bg-brand text-foreground'
                                                : 'border border-border bg-card text-muted-foreground group-hover:border-foreground group-hover:text-foreground',
                                        )}
                                    >
                                        {done ? (
                                            <Check className="h-3.5 w-3.5 animate-pop stroke-[2.5]" />
                                        ) : (
                                            // Reaching a step: the number bounces in like jelly
                                            <span key={current ? `n-${step}` : 'n'} className={cn(current && stepDirectionRef.current === 'forward' && 'step-jelly')}>{s.id}</span>
                                        )}
                                        {current && stepDirectionRef.current === 'forward' && step > 1 && (
                                            <span key={`burst-${step}`} aria-hidden className="pointer-events-none absolute inset-0">
                                                {STEP_CONFETTI.map((bit, i) => (
                                                    <span key={i} className={cn('step-confetti absolute left-1/2 top-1/2 h-[5px] w-[5px]', bit)} />
                                                ))}
                                                {STEP_CHEERS[step] && (
                                                    <span className="step-cheer absolute left-1/2 top-full z-10 mt-2 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background shadow-float">
                                                        {STEP_CHEERS[step]}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            'hidden whitespace-nowrap text-[13px] transition-colors xl:block',
                                            current ? 'font-semibold text-foreground' : done ? 'font-medium text-foreground' : 'font-medium text-muted-foreground',
                                        )}
                                    >
                                        {s.title}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <span className="h-5 w-px shrink-0 bg-border" />

                <button
                    type="button"
                    onClick={stepMissing > 0 ? () => validateStep(step) : undefined}
                    title={stepMissing > 0 ? "Show what's missing" : 'This step is complete'}
                    className={cn(
                        'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors',
                        stepMissing > 0 ? 'hover:bg-secondary hover:text-foreground' : 'cursor-default',
                    )}
                >
                    {stepMissing > 0 ? (
                        <ProgressRing done={stepRequired.length - stepMissing} total={stepRequired.length} />
                    ) : (
                        <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-foreground text-background">
                            <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                    )}
                    <span className="whitespace-nowrap">
                        {stepMissing > 0 ? (
                            <><span className="font-semibold tabular-nums text-foreground">{stepMissing}</span> left</>
                        ) : (
                            <span className="font-medium text-foreground">Ready</span>
                        )}
                    </span>
                </button>
            </div>
    );

    // No animate-fade-in on this wrapper: its fill-mode keeps a transform here, which would make it
    // the containing block for every position:fixed child (dialogs, scroll-to-top). The tiles
    // animate in on their own.
    return (
        <div className={cn("w-full selection:bg-brand/45", activeTab === 'ai' && "builder-density mx-auto flex max-w-[1500px] flex-1 flex-col gap-4")}>
            <InviteCreatorsPromptModal
                open={Boolean(launchedPrivateCampaignId)}
                onInvite={() => navigate(`/campaigns/${launchedPrivateCampaignId}/invite`)}
                onLater={() => navigate(`/campaigns/${launchedPrivateCampaignId}`)}
            />

            {showConvertToPrivateModal && (id || draftCampaignId) && (
                <ConvertToPrivateModal
                    campaign={{ id: (id || draftCampaignId)!, name: form.campaignName || 'Campaign' }}
                    onClose={() => setShowConvertToPrivateModal(false)}
                    onConverted={() => {
                        update('visibility', 'private');
                    }}
                    reason="general"
                />
            )}

            {activeTab === 'ai' && pageHeader}

            {activeTab === 'ai' && USE_ASSISTANT_V2 ? (
                <AssistantPanel campaignId={id} />
            ) : activeTab === 'ai' ? (
                <AIStrategistChat
                    isEdit={isEdit}
                    isLive={isLiveStatus}
                    campaignId={id}
                    initialData={aiInitialData}
                    existingThumbnailUrl={(campaignData as any)?.thumbnail || (campaignData as any)?.thumbnailUrl || undefined}
                    existingScriptFileKey={(campaignData as any)?.scriptFileKey || undefined}
                />
            ) : (
                <>
                    {/* Progress controls: in the top bar's slot when the layout has one (Topbar variant
                        'dock'); otherwise a slim bar pinned under the standard top bar. */}
                    {topbarSlot ? createPortal(builderControls, topbarSlot) : (
                        <div className="sticky top-[72px] z-20 mb-4 flex justify-start">{builderControls}</div>
                    )}

                    <div className="flex items-start gap-8">
                        <div className="min-w-0 flex-1 pb-10">
                            {pageHeader}

                            <div key={step} className={cn('mt-3', stepDirectionRef.current === 'forward' ? 'step-enter-forward' : 'step-enter-back')}>
                            {/* ─── Step 1: Basics ─── */}
                            {step === 1 && (
                                <div className="mt-2 grid grid-cols-12 gap-4">
                                    <Tile icon={PenLine} title="Campaign identity" description="The name, brief and cover creators see first.">
                                        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                                            <div className="flex flex-col gap-5">
                                                <Field label="Campaign name" htmlFor="campaign-name" required error={errors.campaignName}>
                                                    <div className="relative">
                                                        <input
                                                            id="campaign-name"
                                                            autoComplete="off"
                                                            value={form.campaignName}
                                                            maxLength={60}
                                                            onChange={(e) => {
                                                                update('campaignName', sanitizeInputText(e.target.value, { maxLength: 60 }));
                                                                clearError('campaignName');
                                                            }}
                                                            placeholder={namePlaceholder}
                                                            className={cn(fieldClass, 'h-11 pr-16', fieldBorder(Boolean(errors.campaignName)))}
                                                        />
                                                        <Counter length={form.campaignName.length} max={60} className="right-4 top-1/2 -translate-y-1/2" />
                                                    </div>
                                                </Field>

                                                <Field label="Campaign brief" htmlFor="campaign-brief" required error={errors.description}>
                                                    <div className="relative">
                                                        <textarea
                                                            id="campaign-brief"
                                                            value={form.description}
                                                            maxLength={MAX_DESCRIPTION_LENGTH}
                                                            onChange={(e) => {
                                                                update('description', sanitizeInputText(e.target.value, { allowNewlines: true, maxLength: MAX_DESCRIPTION_LENGTH }));
                                                                clearError('description');
                                                            }}
                                                            placeholder="Key message, tone, and requirements for creators..."
                                                            className={cn(fieldClass, 'block h-[132px] resize-none pb-8 pt-3 leading-6', fieldBorder(Boolean(errors.description)))}
                                                        />
                                                        <Counter length={form.description.length} max={MAX_DESCRIPTION_LENGTH} className="bottom-2.5 right-4" />
                                                    </div>

                                                    {/* Starter briefs stay folded away so they don't compete with the brief itself. */}
                                                    <button
                                                        type="button"
                                                        aria-expanded={showBriefExamples}
                                                        onClick={() => setShowBriefExamples(!showBriefExamples)}
                                                        className="mt-2.5 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                    >
                                                        <Hash className="h-3.5 w-3.5" /> Not sure what to write? Use an example
                                                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', showBriefExamples && 'rotate-180')} />
                                                    </button>
                                                    {showBriefExamples && (
                                                        <div className="mt-2 flex animate-fade-up flex-wrap gap-1.5">
                                                            {BRIEF_EXAMPLES.map(({ label, text }) => (
                                                                <button
                                                                    key={label}
                                                                    type="button"
                                                                    aria-pressed={form.description === text}
                                                                    onClick={() => pickBriefExample(text)}
                                                                    className={cn('h-[26px] rounded-full px-2.5 text-xs font-medium', choiceClass(form.description === text))}
                                                                >
                                                                    {label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {pendingBriefExample && (
                                                        <div className="mt-2">
                                                            <Confirm
                                                                message="This will replace what you've written."
                                                                keepLabel="Keep mine"
                                                                confirmLabel="Replace"
                                                                onKeep={() => setPendingBriefExample(null)}
                                                                onConfirm={() => {
                                                                    applyBrief(pendingBriefExample);
                                                                    setPendingBriefExample(null);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </Field>
                                            </div>

                                            <Field label="Cover banner" required error={errors.coverImagePreview}>
                                                <input
                                                    id="cover-banner"
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                                    className="peer sr-only"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleCoverImageFile(file);
                                                        // Cleared so picking the same file again still fires a change.
                                                        e.target.value = '';
                                                    }}
                                                />
                                                {form.coverImagePreview ? (
                                                    <div
                                                        className={cn(
                                                            'relative aspect-[3/4] w-full animate-fade-up overflow-hidden rounded-xl bg-foreground',
                                                            isCoverDragActive && 'ring-2 ring-brand',
                                                        )}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = 'copy';
                                                            setIsCoverDragActive(true);
                                                        }}
                                                        onDragLeave={() => setIsCoverDragActive(false)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsCoverDragActive(false);
                                                            const file = e.dataTransfer.files?.[0];
                                                            if (file) handleCoverImageFile(file);
                                                        }}
                                                    >
                                                        <ApiImage
                                                            src={form.coverImagePreview}
                                                            alt="Cover banner preview"
                                                            className="absolute inset-0 h-full w-full object-cover"
                                                        />
                                                        {/* Image overlay: always dark so the white text reads on any cover. */}
                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-12 text-white">
                                                            <p className="truncate text-xs font-semibold leading-4">{form.coverImageName || 'Cover image'}</p>
                                                            <p className="text-[11px] leading-4 text-white/70">Ready</p>
                                                            <div className="mt-2.5 flex gap-1.5">
                                                                {canAdjustCover && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCropperSrc(coverOriginalSrcRef.current || form.coverImagePreview)}
                                                                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-xs font-semibold text-black transition-colors hover:bg-brand"
                                                                    >
                                                                        <Crop className="h-3.5 w-3.5" /> Adjust
                                                                    </button>
                                                                )}
                                                                <label
                                                                    htmlFor="cover-banner"
                                                                    aria-label="Replace cover banner"
                                                                    title="Replace"
                                                                    className={cn(
                                                                        'grid h-8 cursor-pointer place-items-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/30',
                                                                        canAdjustCover ? 'w-8' : 'flex-1',
                                                                    )}
                                                                >
                                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={removeCoverImage}
                                                                    aria-label="Remove cover banner"
                                                                    title="Remove"
                                                                    className="grid h-8 w-8 place-items-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/30"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label
                                                        htmlFor="cover-banner"
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = 'copy';
                                                            setIsCoverDragActive(true);
                                                        }}
                                                        onDragLeave={() => setIsCoverDragActive(false)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setIsCoverDragActive(false);
                                                            const file = e.dataTransfer.files?.[0];
                                                            if (file) handleCoverImageFile(file);
                                                        }}
                                                        className={cn(
                                                            'group flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 text-center transition-all duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-foreground/10',
                                                            isCoverDragActive
                                                                ? 'border-foreground bg-secondary'
                                                                : errors.coverImagePreview
                                                                    ? 'border-destructive bg-secondary/40 hover:bg-secondary'
                                                                    : 'border-muted-foreground/40 bg-secondary/40 hover:border-foreground hover:bg-secondary',
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'grid h-10 w-10 place-items-center rounded-full shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-foreground group-hover:text-background',
                                                                isCoverDragActive ? '-translate-y-1 bg-foreground text-background' : 'bg-card',
                                                            )}
                                                        >
                                                            <ImagePlus className="h-4 w-4" />
                                                        </span>
                                                        <span className="mt-2.5 text-[13px] font-semibold leading-[18px]">
                                                            {isCoverDragActive ? 'Drop to upload' : 'Drop your cover here'}
                                                        </span>
                                                        <span className="mt-0.5 text-[11px] leading-4 text-muted-foreground">PNG or JPG · up to 5MB</span>
                                                        <span className="mt-3 flex h-7 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold text-background transition-transform duration-200 group-hover:scale-[1.03]">
                                                            <Upload className="h-3.5 w-3.5" /> Choose file
                                                        </span>
                                                    </label>
                                                )}

                                                {cropperSrc && (
                                                    <CoverCropper
                                                        key={cropperSrc}
                                                        src={cropperSrc}
                                                        onCancel={() => setCropperSrc(null)}
                                                        onApply={applyCoverCrop}
                                                    />
                                                )}
                                            </Field>
                                        </div>
                                    </Tile>

                                    <Tile
                                        icon={UserCheck}
                                        title="Who can apply"
                                        description="Choose which creators are eligible."
                                        aside={lockedBadge}
                                        className={cn(isPanIndia && 'lg:col-span-6', '[animation-delay:140ms]')}
                                    >
                                        <Field label="Creator location" required>
                                            <div className="grid gap-2.5 sm:grid-cols-2">
                                                <OptionCard
                                                    icon={Globe}
                                                    title="Pan India"
                                                    description="All states & cities"
                                                    selected={isPanIndia}
                                                    disabled={isLiveStatus}
                                                    onSelect={() => {
                                                        update('locationStates', ['Pan India']);
                                                        update('locationCities', []);
                                                        clearError('locationStates');
                                                    }}
                                                />
                                                <OptionCard
                                                    icon={MapPin}
                                                    title="Specific locations"
                                                    description={!isPanIndia && form.locationStates.length > 0
                                                        ? `${form.locationCities.length || form.locationStates.length} ${form.locationCities.length ? (form.locationCities.length === 1 ? 'city' : 'cities') : (form.locationStates.length === 1 ? 'state' : 'states')} selected`
                                                        : 'Choose the cities'}
                                                    selected={!isPanIndia}
                                                    disabled={isLiveStatus}
                                                    onSelect={() => {
                                                        if (isPanIndia) {
                                                            update('locationStates', []);
                                                            update('locationCities', []);
                                                            clearError('locationStates');
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </Field>

                                        {/* The same board as audience location further down, so the two location pickers work alike. */}
                                        {!isPanIndia && (
                                            <CityBoard
                                                label="Creator cities"
                                                required
                                                emptySummary="None chosen"
                                                value={form.locationCities}
                                                toValue={(c) => c.city}
                                                toLabel={(v) => BOARD_CITIES.find((c) => c.city === v)?.label ?? v}
                                                onChange={setCreatorCities}
                                                error={errors.locationStates}
                                                disabled={isLiveStatus}
                                                className="animate-fade-up"
                                            />
                                        )}

                                        <Field label="Creator gender">
                                            <Segmented
                                                label="Creator gender"
                                                options={GENDER_OPTIONS}
                                                value={form.creatorGender}
                                                disabled={isLiveStatus}
                                                onChange={(value) => update('creatorGender', value as TargetGender)}
                                            />
                                        </Field>
                                    </Tile>

                                    <Tile
                                        icon={Eye}
                                        title="Visibility"
                                        description="Who can discover this campaign."
                                        className={cn(isPanIndia && 'lg:col-span-6', '[animation-delay:210ms]')}
                                    >
                                        <Field label="Campaign access">
                                            <div className="grid gap-2.5 sm:grid-cols-2">
                                                <OptionCard
                                                    icon={Globe}
                                                    title="Public"
                                                    description="Open applications"
                                                    selected={!isPrivate}
                                                    // Private campaigns can't be made public again.
                                                    disabled={isPrivate}
                                                    onSelect={() => undefined}
                                                />
                                                <OptionCard
                                                    icon={LockKeyhole}
                                                    title="Private"
                                                    description="Invite only"
                                                    selected={isPrivate}
                                                    onSelect={switchToPrivate}
                                                />
                                            </div>
                                        </Field>
                                        <Field label="What this means">
                                            <Note key={form.visibility}>
                                                {isPrivate
                                                    ? "Hidden from the marketplace. Only creators you invite can apply. This can't be switched back to public."
                                                    : 'Listed in the creator marketplace. Any eligible creator can apply.'}
                                            </Note>
                                        </Field>
                                    </Tile>

                                    <Tile
                                        icon={Target}
                                        title="Audience they reach"
                                        description="Narrow down by the creator's followers."
                                        optional
                                        className="[animation-delay:280ms]"
                                    >
                                        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
                                            <AgeLine
                                                value={form.audienceAgeRanges}
                                                onChange={(ages) => update('audienceAgeRanges', ages)}
                                                className="col-span-12 lg:col-span-7"
                                            />
                                            <Field label="Gender" className="col-span-12 lg:col-span-5">
                                                <Segmented
                                                    label="Audience gender"
                                                    options={GENDER_OPTIONS}
                                                    value={form.audienceGender}
                                                    onChange={(value) => update('audienceGender', value as TargetGender)}
                                                />
                                            </Field>
                                            <CityBoard
                                                label="Location"
                                                hint="Where their followers live"
                                                emptySummary="Any city"
                                                value={form.audienceLocations}
                                                toValue={(c) => `${c.city}, ${c.state}`}
                                                toLabel={(v) => BOARD_CITIES.find((c) => `${c.city}, ${c.state}` === v)?.label ?? v.split(',')[0]}
                                                onChange={(next) => update('audienceLocations', next)}
                                                className="col-span-12"
                                            />
                                            <LanguageKeys
                                                value={form.audienceLanguages}
                                                onChange={(languages) => update('audienceLanguages', languages)}
                                                className="col-span-12"
                                            />
                                        </div>
                                    </Tile>
                                </div>
                            )}

                            {/* ─── Step 2: Deliverables ─── */}
                            {step === 2 && (
                                <div className="mt-2 grid grid-cols-12 gap-4">
                                    <Tile
                                        icon={LayoutGrid}
                                        title="Creator niches"
                                        description="The kinds of creators this campaign suits. Pick up to three."
                                        required
                                        aside={
                                            <Summary
                                                summary={`${form.niche.length}/${MAX_NICHES} selected`}
                                                active={form.niche.length > 0}
                                                onClear={() => update('niche', [])}
                                            />
                                        }
                                    >
                                        <div data-invalid={Boolean(errors.niche)}>
                                            <div className="flex flex-wrap gap-2.5 pt-1">
                                                {/* Selected niches move to the front, in the order they were picked; the rest keep their usual order. */}
                                                {[
                                                    ...form.niche.flatMap((k) => NICHE_CATEGORIES.filter((c) => c.key === k)),
                                                    ...NICHE_CATEGORIES.filter((c) => !form.niche.includes(c.key)),
                                                ].map(({ key, label, icon: Icon }) => {
                                                    const selected = form.niche.includes(key);
                                                    return (
                                                        // Icon only; the name pops up on hover, and a selected niche opens out to show it.
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            aria-label={label}
                                                            disabled={!selected && form.niche.length >= MAX_NICHES}
                                                            onClick={() => {
                                                                update('niche', selected ? form.niche.filter((k) => k !== key) : [...form.niche, key]);
                                                                clearError('niche');
                                                            }}
                                                            className={cn(
                                                                'group relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-full text-[13px] font-medium disabled:opacity-40',
                                                                selected ? 'pl-3.5 pr-4' : 'px-0',
                                                                choiceClass(selected),
                                                            )}
                                                        >
                                                            <Icon className="h-[18px] w-[18px] shrink-0 stroke-[1.75] transition-transform duration-200 group-enabled:group-hover:scale-110" />
                                                            {selected && <span className="animate-pop whitespace-nowrap">{label}</span>}
                                                            {!selected && (
                                                                <span
                                                                    role="tooltip"
                                                                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background opacity-0 shadow-float transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                                                                >
                                                                    {label}
                                                                    <span className="absolute left-1/2 top-full -ml-1 -mt-1 h-2 w-2 rotate-45 bg-foreground" />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <ErrorText message={errors.niche} />
                                        </div>
                                    </Tile>

                                    <Tile
                                        icon={Tags}
                                        title="Platform & deliverables"
                                        description="Where the content goes and what each creator makes."
                                        required
                                        aside={lockedBadge}
                                        className="[animation-delay:70ms]"
                                    >
                                        <Field label="Platform" required error={errors.platform}>
                                            <div className="grid gap-2.5 sm:grid-cols-3">
                                                {PLATFORMS.map((p) => (
                                                    <OptionCard
                                                        key={p.key}
                                                        icon={p.icon}
                                                        title={p.label}
                                                        description={PLATFORM_DESCRIPTIONS[p.key] ?? ''}
                                                        selected={form.platform === p.key}
                                                        disabled={isLiveStatus}
                                                        onSelect={() => pickPlatform(p.key)}
                                                    />
                                                ))}
                                            </div>
                                            {pendingPlatform && (
                                                <div className="mt-2">
                                                    <Confirm
                                                        message={`Switching to ${platformLabel(pendingPlatform)} removes ${droppedByPlatform(pendingPlatform).map(formatLabel).join(', ')}.`}
                                                        keepLabel={`Keep ${platformLabel(form.platform)}`}
                                                        confirmLabel="Switch"
                                                        onKeep={() => setPendingPlatform(null)}
                                                        onConfirm={() => switchPlatform(pendingPlatform)}
                                                    />
                                                </div>
                                            )}
                                        </Field>

                                        {form.platform && (
                                            <div data-invalid={Boolean(errors.contentType)} className="animate-fade-up">
                                                <PickerHeader
                                                    label="Deliverables"
                                                    required
                                                    summary={deliverablesSummary}
                                                    active={form.contentType.length > 0}
                                                    onClear={isLiveStatus ? undefined : () => setForm((prev) => ({ ...prev, contentType: [], contentTypeCounts: {} }))}
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    {(CONTENT_FORMATS_BY_PLATFORM[form.platform] || []).map((f) => {
                                                        const selected = form.contentType.includes(f.id);
                                                        return (
                                                            <button
                                                                key={f.id}
                                                                type="button"
                                                                title={f.description}
                                                                aria-pressed={selected}
                                                                disabled={isLiveStatus}
                                                                onClick={() => {
                                                                    toggleContentType(f.id);
                                                                    clearError('contentType');
                                                                }}
                                                                className={cn('h-9 rounded-full px-3.5 text-[13px] font-medium disabled:opacity-50', choiceClass(selected))}
                                                            >
                                                                {f.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {form.contentType.includes('story') && (
                                                    <div className="mt-2.5">
                                                        <Note tone="warning">Stories expire in 24 hours. Creators submit proof on the day they post.</Note>
                                                    </div>
                                                )}
                                                <ErrorText message={errors.contentType} />
                                            </div>
                                        )}

                                        {selectedContentTypes.length > 0 && (
                                            <Field label="How many of each" hint={`Up to ${MAX_DELIVERABLE_COUNT} per format`} className="animate-fade-up">
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedContentTypes.map((f) => {
                                                        const count = form.contentTypeCounts[f.id] ?? 1;
                                                        return (
                                                            <span
                                                                key={f.id}
                                                                className="flex h-10 animate-pop items-center gap-1 rounded-full border border-border bg-card pl-3.5 pr-1 text-[13px] font-medium"
                                                            >
                                                                <span className="mr-1.5">{f.label}</span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Fewer ${f.label}`}
                                                                    disabled={isLiveStatus || count <= 1}
                                                                    onClick={() => setContentTypeCount(f.id, count - 1)}
                                                                    className="grid h-8 w-8 place-items-center rounded-full transition-colors enabled:hover:bg-secondary disabled:text-muted-foreground/40"
                                                                >
                                                                    <Minus className="h-3.5 w-3.5" />
                                                                </button>
                                                                <span key={count} className="w-5 animate-pop text-center font-semibold tabular-nums">{count}</span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`More ${f.label}`}
                                                                    disabled={isLiveStatus || count >= MAX_DELIVERABLE_COUNT}
                                                                    onClick={() => setContentTypeCount(f.id, count + 1)}
                                                                    className="grid h-8 w-8 place-items-center rounded-full transition-colors enabled:hover:bg-secondary disabled:text-muted-foreground/40"
                                                                >
                                                                    <Plus className="h-3.5 w-3.5" />
                                                                </button>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </Field>
                                        )}
                                    </Tile>

                                    <Tile
                                        icon={ShieldCheck}
                                        title="Rights & collaboration"
                                        description="How long you can reuse what creators make."
                                        optional
                                        className="lg:col-span-6 [animation-delay:140ms]"
                                    >
                                        <Field label="Usage rights" error={errors.usageRights}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {[...USAGE_RIGHTS_PRESETS.map((r) => ({ value: r as string, label: USAGE_RIGHTS_LABELS[r] })), { value: 'custom', label: 'Custom' }].map((option) => {
                                                    const selected = (isCustomUsageRights ? 'custom' : form.usageRights) === option.value;
                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            // Clicking the chosen one again clears it.
                                                            onClick={() => pickUsageRights(option.value)}
                                                            className={cn('h-9 rounded-full px-3 text-[13px] font-medium', choiceClass(selected))}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    );
                                                })}
                                                {isCustomUsageRights && (
                                                    <span className="relative animate-fade-up">
                                                        <input
                                                            inputMode="numeric"
                                                            aria-label="Custom usage rights in days"
                                                            value={usageRightsCustomDays}
                                                            onChange={(e) => {
                                                                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                                update('usageRights', digits ? `${digits}d` : '');
                                                                clearError('usageRights');
                                                            }}
                                                            placeholder="0"
                                                            className={cn(fieldClass, fieldBorder(Boolean(errors.usageRights)), 'h-9 w-24 rounded-full pl-3 pr-11 text-[13px]')}
                                                        />
                                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">days</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2.5">
                                                <Note key={`${form.usageRights}-${isCustomUsageRights}`}>{usageRightsNote}</Note>
                                            </div>
                                        </Field>

                                        {isCollabTagAvailable && (
                                            <Field label="Instagram collab tag" error={errors.collabChannel} className="animate-fade-up">
                                                <Segmented
                                                    label="Instagram collab tag"
                                                    options={COLLAB_TAG_OPTIONS}
                                                    value={isCollabTagOn ? 'yes' : isCollabTagOptional ? 'optional' : 'no'}
                                                    onChange={(value) => {
                                                        update('postingType', value === 'yes' ? 'collab' : value === 'optional' ? 'collab_optional' : 'creator');
                                                        clearError('collabChannel');
                                                    }}
                                                />
                                                {(isCollabTagOn || isCollabTagOptional) && (
                                                    <input
                                                        type="text"
                                                        maxLength={100}
                                                        aria-label="Brand handle to collaborate with"
                                                        placeholder="Brand handle (e.g. @yourbrand)"
                                                        value={form.collabChannel}
                                                        onChange={(e) => {
                                                            update('collabChannel', e.target.value);
                                                            clearError('collabChannel');
                                                        }}
                                                        className={cn(fieldClass, fieldBorder(Boolean(errors.collabChannel)), 'mt-2.5 h-10 animate-fade-up')}
                                                    />
                                                )}
                                                <div className="mt-2.5">
                                                    <Note key={form.postingType}>
                                                        {isCollabTagOn
                                                            ? 'Creators must post as an Instagram collab with your handle, so it shows on both profiles.'
                                                            : isCollabTagOptional
                                                                ? 'Creators can add your handle as a collaborator if they want to.'
                                                                : "Posts go on the creator's profile only."}
                                                    </Note>
                                                </div>
                                            </Field>
                                        )}
                                    </Tile>

                                    <Tile
                                        icon={FileText}
                                        title="Script"
                                        description={isScriptRequired ? 'Required, with script review included.' : 'Not required for this campaign.'}
                                        className="lg:col-span-6 [animation-delay:210ms]"
                                        aside={
                                            <Switch
                                                label="Script required"
                                                checked={isScriptRequired}
                                                disabled={isLiveStatus}
                                                onChange={setScriptRequired}
                                            />
                                        }
                                    >
                                        {isScriptRequired && (
                                            <Field label="Who writes it">
                                                <Segmented
                                                    label="Script provider"
                                                    options={SCRIPT_PROVIDERS}
                                                    value={form.scriptType}
                                                    onChange={(value) => update('scriptType', value as 'brand' | 'creator')}
                                                />
                                            </Field>
                                        )}

                                        {form.scriptType === 'brand' && (
                                            <Field label="Your script" required error={errors.scriptFlow} className="animate-fade-up">
                                                {!form.scriptFileName ? (
                                                    <div className="space-y-3">
                                                        <div className="relative">
                                                            <textarea
                                                                aria-label="Script flow"
                                                                value={form.scriptFlow}
                                                                maxLength={MAX_SCRIPT_FLOW_LENGTH}
                                                                onChange={(e) => {
                                                                    update('scriptFlow', sanitizeInputText(e.target.value, { allowNewlines: true, maxLength: MAX_SCRIPT_FLOW_LENGTH }));
                                                                    clearError('scriptFlow');
                                                                }}
                                                                placeholder={'1. Hook — problem statement\n2. Product intro & demo\n3. CTA — link in bio...'}
                                                                className={cn(fieldClass, 'block h-[132px] resize-none pb-8 pt-3 leading-6', fieldBorder(Boolean(errors.scriptFlow)))}
                                                            />
                                                            <Counter length={form.scriptFlow.length} max={MAX_SCRIPT_FLOW_LENGTH} className="bottom-2.5 right-4" />
                                                        </div>

                                                        <ScriptOptimizerPanel
                                                            description="Score hook, CTA & tone — get an improved script instantly."
                                                            analyzeLabel="Analyze Script"
                                                            reAnalyzeLabel="Re-Analyze"
                                                            disabled={form.scriptFlow.trim().length < 10}
                                                            onAnalyze={handleAnalyzeScript}
                                                            isAnalyzing={isAnalyzingScript}
                                                            analysis={scriptAnalysis}
                                                            analysisError={scriptAnalysisError}
                                                            improvedScript={improvedScript}
                                                            isGeneratingImproved={isGeneratingImprovedScript}
                                                            improvedScriptError={improvedScriptError}
                                                            onGenerateImproved={handleGenerateImprovedScript}
                                                            onUseImproved={handleUseImprovedScript}
                                                        />

                                                        <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-muted-foreground/40 bg-secondary/40 px-3.5 py-2.5 transition-all duration-200 hover:border-foreground hover:bg-secondary">
                                                            <input
                                                                type="file"
                                                                accept=".pdf,.doc,.docx,.txt"
                                                                className="sr-only"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) attachScriptFile(file);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card shadow-sm transition-colors group-hover:bg-foreground group-hover:text-background">
                                                                <FileText className="h-4 w-4" />
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block text-[13px] font-semibold">Or upload a script file</span>
                                                                <span className="block text-[11px] text-muted-foreground">PDF, DOCX or TXT · up to 100MB</span>
                                                            </span>
                                                            <span className="flex h-7 items-center rounded-full bg-foreground px-3 text-xs font-semibold text-background">Browse</span>
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
                                                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/30">
                                                                <FileText className="h-4 w-4" />
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-[13px] font-semibold" title={form.scriptFileName}>{form.scriptFileName}</span>
                                                                <span className="block text-[11px] text-muted-foreground">Document attached</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={removeScriptFile}
                                                                aria-label="Remove script file"
                                                                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                        <ScriptOptimizerPanel
                                                            description="Analyze hook, CTA, and tone in your attached script."
                                                            analyzeLabel="Analyze Document"
                                                            reAnalyzeLabel="Re-Analyze"
                                                            disabled={!scriptFileRef.current && !form.scriptFileName}
                                                            onAnalyze={handleAnalyzeScript}
                                                            isAnalyzing={isAnalyzingScript}
                                                            analysis={scriptAnalysis}
                                                            analysisError={scriptAnalysisError}
                                                            improvedScript={improvedScript}
                                                            isGeneratingImproved={isGeneratingImprovedScript}
                                                            improvedScriptError={improvedScriptError}
                                                            onGenerateImproved={handleGenerateImprovedScript}
                                                            onUseImproved={handleUseImprovedScript}
                                                        />
                                                    </div>
                                                )}
                                            </Field>
                                        )}

                                        <Field label="What this means">
                                            <Note key={form.scriptType}>
                                                {!isScriptRequired
                                                    ? 'Creators have creative freedom and go straight to making content. Switch this on to approve a script first.'
                                                    : form.scriptType === 'brand'
                                                        ? 'You share the script. Creators follow it when they shoot.'
                                                        : 'Creators write a script and send it to you for approval before they shoot.'}
                                            </Note>
                                        </Field>
                                    </Tile>

                                    <Tile
                                        icon={MapPinned}
                                        title="Store or on-site visit"
                                        description="Do creators need to shoot at your location?"
                                        optional
                                        className="[animation-delay:280ms]"
                                        aside={
                                            <Segmented
                                                label="Require a physical visit"
                                                options={YES_NO_OPTIONS}
                                                value={form.visitAtSiteEnabled ? 'yes' : 'no'}
                                                onChange={(value) => setVisitRequired(value === 'yes')}
                                                className="w-36 shrink-0"
                                            />
                                        }
                                    >
                                        {form.visitAtSiteEnabled && (
                                            <div className="flex animate-fade-up flex-col gap-3">
                                                <Note>Creators will see that they must shoot at your location, so mostly nearby creators will apply.</Note>
                                                <ErrorText message={errors.visitAtSiteOptions} />
                                                {form.visitAtSiteOptions.map((loc, idx) => {
                                                    const descriptionError = errors[`visitAtSiteOption_${loc.id}_description`];
                                                    return (
                                                        <Field
                                                            key={loc.id}
                                                            label={`Location ${idx + 1}`}
                                                            htmlFor={`visit-${loc.id}`}
                                                            required
                                                            error={descriptionError}
                                                            hint={form.visitAtSiteOptions.length > 1 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setForm((prev) => ({
                                                                            ...prev,
                                                                            visitAtSiteOptions: prev.visitAtSiteOptions.filter((l) => l.id !== loc.id),
                                                                        }));
                                                                        clearError(`visitAtSiteOption_${loc.id}_description`);
                                                                    }}
                                                                    className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-destructive"
                                                                >
                                                                    <X className="h-3.5 w-3.5" /> Remove
                                                                </button>
                                                            ) : undefined}
                                                        >
                                                            <div className="relative">
                                                                <textarea
                                                                    id={`visit-${loc.id}`}
                                                                    value={loc.description}
                                                                    maxLength={200}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setForm((prev) => ({
                                                                            ...prev,
                                                                            visitAtSiteOptions: prev.visitAtSiteOptions.map((l) =>
                                                                                l.id === loc.id ? { ...l, description: sanitizeInputText(value, { allowNewlines: true, maxLength: 200 }) } : l
                                                                            ),
                                                                        }));
                                                                        clearError(`visitAtSiteOption_${loc.id}_description`);
                                                                    }}
                                                                    placeholder="Where to go, opening hours, instructions..."
                                                                    className={cn(fieldClass, 'block h-[84px] resize-none pb-7 pt-2.5 leading-6', fieldBorder(Boolean(descriptionError)))}
                                                                />
                                                                <Counter length={loc.description.length} max={200} className="bottom-2 right-4" />
                                                            </div>
                                                        </Field>
                                                    );
                                                })}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            visitAtSiteOptions: [...prev.visitAtSiteOptions, makeEmptyVisitLocation()],
                                                        }));
                                                        clearError('visitAtSiteOptions');
                                                    }}
                                                    className="flex h-9 w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium transition-colors hover:border-foreground"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Add another location
                                                </button>
                                            </div>
                                        )}
                                    </Tile>
                                </div>
                            )}

                            {/* ─── Step 3: Budget ─── */}
                            {step === 3 && (
                                <div className="mt-2 grid grid-cols-12 gap-4">
                                    {isBudgetLocked && (
                                        <div className="col-span-12 animate-fade-up">
                                            <Note tone="warning">
                                                Budget is locked because this campaign is already live. You can still extend the timeline.
                                            </Note>
                                        </div>
                                    )}

                                    <Tile
                                        icon={Wallet}
                                        title="Budget"
                                        description="How creators are rewarded, and how much."
                                        required
                                        aside={isBudgetLocked ? <LockedBadge icon={Lock} /> : undefined}
                                        className={cn(showTierTile && 'lg:col-span-5')}
                                    >
                                        <Field label="Budget mode">
                                            <Segmented
                                                label="Budget mode"
                                                options={BUDGET_MODES}
                                                value={form.budgetMode}
                                                disabled={isBudgetLocked}
                                                onChange={(mode) => {
                                                    update('budgetMode', mode);
                                                    clearError('productDetails');
                                                }}
                                            />
                                            <div className="mt-2.5">
                                                <Note key={form.budgetMode}>{BUDGET_MODE_NOTES[form.budgetMode]}</Note>
                                            </div>
                                        </Field>

                                        {(form.budgetMode === 'product' || form.budgetMode === 'paid_product') && (
                                            <Field label="Product details" htmlFor="product-details" required error={errors.productDetails} className="animate-fade-up">
                                                <div className="relative">
                                                    <textarea
                                                        id="product-details"
                                                        value={form.productDetails}
                                                        maxLength={1000}
                                                        disabled={isBudgetLocked}
                                                        onChange={(e) => {
                                                            update('productDetails', e.target.value);
                                                            clearError('productDetails');
                                                        }}
                                                        placeholder="What creators receive, its value, and how it's delivered..."
                                                        className={cn(fieldClass, 'block h-[96px] resize-none pb-7 pt-2.5 leading-6', fieldBorder(Boolean(errors.productDetails)))}
                                                    />
                                                    <Counter length={form.productDetails.length} max={1000} className="bottom-2 right-4" />
                                                </div>
                                            </Field>
                                        )}

                                        {form.budgetMode !== 'product' && (
                                            <Field
                                                label="Total campaign budget"
                                                htmlFor="campaign-budget"
                                                required
                                                hint={totalBudgetNum > 0 ? `₹${totalBudgetNum.toLocaleString('en-IN')}` : undefined}
                                                error={errors.totalBudget}
                                            >
                                                <div className="relative">
                                                    <IndianRupee className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <input
                                                        id="campaign-budget"
                                                        inputMode="numeric"
                                                        value={form.totalBudget}
                                                        disabled={isBudgetLocked}
                                                        onChange={(e) => setTotalBudget(e.target.value)}
                                                        onBlur={() => {
                                                            const budget = Number(form.totalBudget) || 0;
                                                            if (budget > 0 && budget < minTierBudget) {
                                                                setErrors((prev) => ({
                                                                    ...prev,
                                                                    totalBudget: `Minimum budget of ₹${minTierBudget.toLocaleString('en-IN')} required.`,
                                                                }));
                                                            }
                                                        }}
                                                        placeholder="10000"
                                                        className={cn(fieldClass, 'h-12 pl-10 text-lg font-semibold tabular-nums', fieldBorder(Boolean(errors.totalBudget)))}
                                                    />
                                                </div>
                                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                                                    <span className="mr-0.5 text-muted-foreground">Quick pick</span>
                                                    {QUICK_BUDGETS.map((amount) => {
                                                        const active = totalBudgetNum === amount;
                                                        return (
                                                            <button
                                                                key={amount}
                                                                type="button"
                                                                aria-pressed={active}
                                                                disabled={isBudgetLocked}
                                                                onClick={() => setTotalBudget(active ? '' : String(amount))}
                                                                className={cn('h-6 rounded-full px-2 font-medium tabular-nums disabled:opacity-50', choiceClass(active))}
                                                            >
                                                                {shortRupees(amount)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </Field>
                                        )}
                                    </Tile>

                                    {showTierTile && (
                                        <Tile
                                            icon={Users}
                                            title="Creator tiers"
                                            description="The follower sizes you want to work with."
                                            required
                                            className="lg:col-span-7 [animation-delay:70ms]"
                                            aside={
                                                <Summary
                                                    summary={tiersSummary}
                                                    active={form.creatorSizes.length > 0}
                                                    onClear={isBudgetLocked ? undefined : () => setCreatorSizes([])}
                                                />
                                            }
                                        >
                                            <div data-invalid={Boolean(errors.creatorTier)} className={cn('flex flex-1 flex-col', isBudgetLocked && 'pointer-events-none opacity-70')}>
                                                {totalBudgetNum === 0 ? (
                                                    <div className="mb-2.5"><Note>Enter a budget to unlock creator tiers.</Note></div>
                                                ) : totalBudgetNum < minTierBudget ? (
                                                    <div className="mb-2.5">
                                                        <Note tone="warning">Budget too low. Minimum ₹{minTierBudget.toLocaleString('en-IN')} required for any tier.</Note>
                                                    </div>
                                                ) : null}
                                                <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
                                                    {creatorSizes.map(({ key, label, range, icon: Icon }) => {
                                                        const selected = isMix ? form.creatorSizes.includes(key) : form.selectedTier === key;
                                                        const affordable = isTierAffordable(key);
                                                        const shortfall = (tierCosts[key]?.min ?? 0) - totalBudgetNum;
                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                aria-pressed={selected}
                                                                disabled={!tierPickable(key)}
                                                                onClick={() => {
                                                                    toggleCreatorSize(key);
                                                                    clearError('creatorTier');
                                                                }}
                                                                className={cn(
                                                                    'relative flex flex-col items-center justify-center rounded-xl px-1 py-3 disabled:opacity-45',
                                                                    choiceClass(selected),
                                                                )}
                                                            >
                                                                {!affordable && totalBudgetNum > 0 && (
                                                                    <Lock className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                                                                )}
                                                                <span className={cn('grid h-8 w-8 place-items-center rounded-xl text-foreground transition-colors duration-200', selected ? 'bg-brand' : 'bg-secondary')}>
                                                                    <Icon className="h-4 w-4 stroke-[1.75]" />
                                                                </span>
                                                                <span className="mt-1.5 text-[13px] font-semibold leading-[18px] text-foreground">{label}</span>
                                                                <span className="text-[11px] leading-[14px] text-muted-foreground">{range}</span>
                                                                {!affordable && totalBudgetNum > 0 && (
                                                                    <span className="mt-1 rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">
                                                                        +₹{shortfall.toLocaleString('en-IN')}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                                                    <span className="mr-0.5 text-muted-foreground">Quick pick</span>
                                                    {TIER_QUICK_PICKS.map(({ label, tiers }) => {
                                                        const available = tiers.filter((t) => creatorSizes.some((c) => c.key === t) && tierPickable(t));
                                                        const active = available.length > 0 && available.every((t) => form.creatorSizes.includes(t));
                                                        return (
                                                            <button
                                                                key={label}
                                                                type="button"
                                                                aria-pressed={active}
                                                                disabled={available.length === 0}
                                                                onClick={() =>
                                                                    setCreatorSizes(active
                                                                        ? form.creatorSizes.filter((t) => !available.includes(t))
                                                                        : [...new Set([...form.creatorSizes, ...available])])
                                                                }
                                                                className={cn('h-6 rounded-full px-2 font-medium disabled:opacity-45', choiceClass(active))}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <ErrorText message={errors.creatorTier} />
                                            </div>
                                        </Tile>
                                    )}

                                    <Tile
                                        icon={CalendarDays}
                                        title="Timeline"
                                        description="The dates creators need to hit."
                                        required={!isIndividualDeadline || isPublic}
                                        aside={isLiveStatus ? <LockedBadge icon={LockKeyhole} label="Extend only" /> : undefined}
                                        className="[animation-delay:140ms]"
                                    >
                                        <Field label="Deadline strategy">
                                            <Segmented
                                                label="Deadline strategy"
                                                options={DEADLINE_STRATEGIES}
                                                value={form.deadlineMode}
                                                onChange={(value) => update('deadlineMode', value as 'common' | 'individual')}
                                                className="max-w-[420px]"
                                            />
                                            <div className="mt-2.5">
                                                <Note key={form.deadlineMode}>
                                                    {!isIndividualDeadline
                                                        ? 'One set of dates for every creator.'
                                                        : isPublic
                                                            ? 'Applications close on one date. Script, work and proof deadlines are set for each creator when you accept them.'
                                                            : 'Script, work and proof deadlines are set for each creator when you accept them.'}
                                                </Note>
                                            </div>
                                        </Field>

                                        {deadlineFields.length > 0 && (
                                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                                {deadlineFields.map(({ key, label, min }, i) => (
                                                    <div key={key} data-invalid={Boolean(errors[key])} className="animate-fade-up">
                                                        <label htmlFor={`deadline-${key}`} className="mb-2 block text-[13px] font-medium">{label}</label>
                                                        <BuilderDatePicker
                                                            id={`deadline-${key}`}
                                                            value={form[key]}
                                                            min={min || undefined}
                                                            invalid={Boolean(errors[key])}
                                                            // Right-hand fields open their calendar leftwards.
                                                            align={i % 2 === 1 ? 'right' : 'left'}
                                                            onChange={(value) => {
                                                                update(key, value);
                                                                validateDeadlineField(key, value);
                                                            }}
                                                        />
                                                        <ErrorText message={errors[key]} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Tile>
                                </div>
                            )}

                            </div>

                            {/* ── Step navigation ── */}
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                                <button
                                    type="button"
                                    disabled={step === 1}
                                    onClick={() => goToStep(Math.max(1, step - 1))}
                                    className="flex h-10 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-[13px] font-medium text-foreground/80 transition-colors enabled:hover:bg-card disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>

                                <div className="flex items-center gap-4">
                                    <span className="hidden text-[13px] text-muted-foreground sm:inline">
                                        Step {step} of {STEPS.length}
                                    </span>
                                    {isLastStep ? (
                                        <button
                                            key={refusals}
                                            type="button"
                                            onClick={handleContinue}
                                            disabled={isLaunching || createCampaignMutation.isPending || launchCampaignMutation.isPending || updateCampaignMutation.isPending}
                                            className={cn(
                                                'group flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-accent-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-60',
                                                refusals > 0 && 'animate-shake',
                                            )}
                                        >
                                            <span
                                                key={launchAttempts}
                                                className={cn(
                                                    'grid place-items-center',
                                                    launchAttempts > 0
                                                        ? 'animate-rocket-hop'
                                                        : 'transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
                                                )}
                                            >
                                                {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                                            </span>
                                            {isEdit ? 'Update campaign' : 'Publish campaign'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleContinue}
                                            className="group flex h-11 items-center gap-2 rounded-full bg-foreground pl-6 pr-5 text-sm font-semibold text-background shadow-card transition-all hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.98]"
                                        >
                                            Continue to {STEPS[step].title.toLowerCase()}
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Live creator app preview. An empty spacer keeps the form column's width; the preview
                            itself is pinned to the viewport (portalled to <body> so no transformed ancestor can
                            re-anchor `fixed`), so the phone sits in exactly the same place while the form scrolls.
                            PhonePreview's height is the viewport minus this offset, the header row and the
                            contact shadow (100vh - 160px), so the whole phone fits in one screen. ── */}
                        <div aria-hidden className="hidden w-[340px] shrink-0 lg:block" />
                        {createPortal(
                        <aside className="fixed right-6 top-[80px] z-10 hidden w-[340px] lg:block">
                            {/* No card around the phone: it would repeat the phone's own outline. */}
                            <div className="flex items-center justify-between gap-3 px-1">
                                <div>
                                    <p className="text-sm font-semibold leading-5">Creator app preview</p>
                                    <p className="text-xs leading-4 text-muted-foreground">Updates as you fill in each step</p>
                                </div>
                                <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                                    <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                    Live
                                </span>
                            </div>

                            <div className="relative mt-3">
                                <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                                    {/* Backdrop disc, strong enough to read as a stage behind the phone. */}
                                    <span className="absolute h-[400px] w-[400px] rounded-full bg-gradient-to-b from-card to-border ring-1 ring-foreground/5" />
                                </div>
                                <PhonePreview brand={authUser?.brandName || 'Your brand'} {...phonePreview} />
                                {/* Contact shadow, so the phone reads as standing on the page. */}
                                <div aria-hidden className="mx-auto mt-2 h-3 w-40 rounded-[100%] bg-foreground/25 blur-md" />
                            </div>
                        </aside>,
                        document.body,
                        )}
                    </div>

                </>
            )}
        </div>
    );
}

// ── Helper sub-components ──

function StepSidebar({
    title,
    children,
    cta,
    tip,
}: {
    title: string;
    children: ReactNode;
    cta: ReactNode;
    tip: string;
}) {
    return (
        <div className="w-[230px] shrink-0 self-start sticky top-4 hidden md:block">
            <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl p-5 space-y-4 shadow-sm">
                <h4 className="text-sm font-bold">{title}</h4>
                <div className="space-y-2.5 pt-1 border-t border-border">
                    {children}
                </div>
                {cta}
                <div className="bg-secondary/60 rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground block mb-0.5">Pro Tip</span>
                        {tip}
                    </p>
                </div>
            </div>
        </div>
    );
}

function SidebarStat({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: 'red' | 'amber';
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            <span className={cn('text-xs font-semibold text-right truncate', highlight === 'red' && 'text-destructive', highlight === 'amber' && 'text-amber-600')}>
                {value}
            </span>
        </div>
    );
}

function BudgetDonut({ pct, isOver }: { pct: number; isOver: boolean }) {
    const size = 130;
    const strokeWidth = 11;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fillPct = Math.min(Math.max(pct, 0), 100);
    const offset = circumference * (1 - fillPct / 100);
    const color = isOver ? 'hsl(var(--destructive))' : pct >= 100 ? 'hsl(var(--success))' : 'hsl(var(--accent))';

    return (
        <div className="relative flex items-center justify-center py-2">
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-secondary" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-400 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-black leading-none">{Math.round(pct)}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">utilized</p>
            </div>
        </div>
    );
}


