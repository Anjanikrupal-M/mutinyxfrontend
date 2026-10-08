import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    BarChart3,
    Calendar,
    Check,
    ChevronRight,
    Clock,
    FileText,
    History,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    Rocket,
    Sparkles,
    TrendingUp,
    Trash2,
    Upload,
    Users,
    Wand2,
    Wallet,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import http from '@/core/http';
import { API } from '@/core/api';
import { useTierConfig, type TierConfigEntry } from '../hooks/useTierConfig';
import { useAuthStore } from '@/shared/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCreateCampaign, useLaunchCampaign, useUpdateCampaign, useUploadThumbnail, useUploadScript } from '../hooks/useCampaigns';
import { useAIChatSessionDetail, useAIChatSessions, useDeleteAIChatSession, type AIChatMessage, type AIChatSession } from '../hooks/useAIChatSessions';
import { useQueryClient } from '@tanstack/react-query';
import { AIHistoryModal } from './AIHistoryModal';
import { ApiImage } from '@/shared/components/ApiImage';
import { DEFAULT_PLATFORM_FEE_PERCENT } from '@/shared/constants/platform';

const initDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('mutiny_ai_files_db', 1);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveFileToDB = async (key: string, file: File | null) => {
    try {
        const db = await initDB();
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        if (file) store.put(file, key);
        else store.delete(key);
    } catch (e) {
        console.error('Failed to save file to DB', e);
    }
};

const getFileFromDB = async (key: string): Promise<File | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(key);
            request.onsuccess = () => resolve((request.result as File) || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to get file from DB', e);
        return null;
    }
};

type Stage = 'step1' | 'step2' | 'step3' | 'step4';
type QuestionFlowMode = 'auto' | 'awaiting-consent' | 'manual-edit';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

type ApiErrorEnvelope = {
    response?: {
        data?: {
            error?: {
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

interface ExtractedData {
    campaignName: string;
    description: string;
    type: string;
    objective: string;
    location: string;
    visibility: 'public' | 'private';
    niche: string;
    platform: string;
    contentType: string[];
    postingType: string;
    usageRights?: string;
    scriptType: string;
    budgetMode: 'paid' | 'product' | 'paid_product';
    productDetails?: string;
    totalBudget: string;
    mixMode: boolean;
    selectedTier: string;
    creatorSizes: string[];
    applicationDeadline: string;
    scriptDeadline?: string;
    workDeadline: string;
    proofOfWorkDeadline?: string;
    proofOfWorkReq?: boolean;
    /** 'common' = one set of dates for all creators; 'individual' = deadlines are set
     *  per creator later while reviewing applications (no dates needed at creation). */
    deadlineMode?: 'common' | 'individual';
    visitAtSiteEnabled?: boolean;
    visitAtSiteDescription?: string;
    visitAtSiteDate?: string;
    visitAtSiteTime?: string;
}

interface ServerChatResult {
    response: string;
    draft: Partial<ExtractedData>;
    ready: boolean;
}

interface Strategy {
    thesis: string;
    whyThisApproach: string;
    hooks: string[];
    contentIdeas: string[];
    reachLow: number;
    reachHigh: number;
    engageLow: number;
    engageHigh: number;
    clicksLow: number;
    clicksHigh: number;
    confidenceLabel: string;
    confidencePct: number;
    timeline: string[];
    recommendations: string[];
    creatorBrief: string;
    creatorMix?: Array<{ tier: string; count: number; spend: number; range: string; why: string }>;
    contentMixPct?: number[];
    suggestedName?: string;
    /** Provenance of the narrative — 'ai' if the LLM wrote it, 'fallback' if the template did
     *  (numbers are real either way; only the copywriting degrades). Persisted with the
     *  campaign so it survives to the read-only AIStrategyTab view later. */
    generatedBy?: 'ai' | 'fallback';
    /** Human-readable citation for each reach/engagement/confidence figure. */
    basis?: string[];
}

interface ExtractionRow {
    label: string;
    value: string;
    ok: boolean;
}

interface FollowUpQuestion {
    id: string;
    field: keyof ExtractedData | 'other';
    q: string;
    opts: string[];
    inputType?: 'date' | 'currency' | 'textarea';
    suggestion?: string;
    helpText?: string;
}

interface CreatorShortlistRow {
    id: string;
    name: string;
    handle: string;
    city: string;
    followers: number;
    engagementRate: number;
    tier: string;
    fee: number;
    why: string;
}

const SAMPLE_PROMPTS = [
    'Diwali campaign for gold jewellery. Budget ₹2.2L, Instagram, target women 22-35 in Mumbai. Goal: sales. Brand provides script.',
    'Protein bar launch in Hyderabad. Budget ₹1.5L, Instagram Reels, gym & college audience. Goal: awareness + sales.',
    'Twitter meme campaign for fintech app. Budget ₹2L, Delhi NCR, 20-34 professionals. Goal: app installs.',
    'UGC skincare campaign. Budget ₹3.5L, paid + product, Instagram Reels. Goal: engagement + conversions.',
];

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TEXT_LENGTH = 1000;

const TIER_LABELS: Record<string, string> = {
    nano: '<10K',
    micro: '10K-50K',
    mid: '50K-500K',
    macro: '500K-1M',
    mega: '1M+',
};

const PLATFORM_FORMATS: Record<string, string[]> = {
    instagram: ['Reels', 'Stories', 'Carousels'],
    youtube: ['Shorts', 'Dedicated Videos', 'Integrations'],
    twitter: ['Single Tweet', 'Thread', 'Twitter Space'],
};

const CAMPAIGN_TYPE_OPTIONS = ['influencer', 'ugc', 'meme', 'twitter'] as const;
const OBJECTIVE_OPTIONS = ['Awareness', 'Sales', 'Engagement', 'App Installs', 'Lead Generation'] as const;
const PLATFORM_OPTIONS = ['instagram', 'youtube', 'twitter'] as const;

const NICHE_OPTIONS = [
    { key: 'fashion-beauty', label: 'Beauty & Fashion' },
    { key: 'food-beverage', label: 'Food & Beverage' },
    { key: 'fitness', label: 'Fitness & Wellness' },
    { key: 'tech', label: 'Technology' },
    { key: 'finance', label: 'Finance & Fintech' },
    { key: 'entertainment', label: 'Entertainment' },
    { key: 'travel', label: 'Travel' },
    { key: 'lifestyle', label: 'Lifestyle' },
    { key: 'healthcare', label: 'Healthcare' },
    { key: 'jewellery', label: 'Jewellery' },
    { key: 'others', label: 'Other' },
];

const POSTING_TYPE_OPTIONS = ['creator', 'brand'];
const SCRIPT_TYPE_OPTIONS = ['creator', 'brand'];
const BUDGET_MODE_OPTIONS = ['paid', 'product', 'paid_product'];
const USAGE_RIGHTS_OPTIONS = ['30d', '90d', '180d', '1y', 'Perpetual'];
const TIER_OPTIONS = ['nano', 'micro', 'mid', 'macro', 'mega'];
const CONTENT_TYPE_OPTIONS: Record<string, string[]> = {
    instagram: ['reel', 'story', 'feed-image', 'feed-video', 'carousel'],
    youtube: ['short', 'video', 'integration'],
    twitter: ['single-tweet', 'thread', 'space'],
};

const NICHE_KEY_ALIASES: Record<string, string> = {
    'beauty': 'fashion-beauty',
    'fashion': 'fashion-beauty',
    'fashionbeauty': 'fashion-beauty',
    'skincare': 'fashion-beauty',
    'food': 'food-beverage',
    'foodbeverage': 'food-beverage',
    'fintech': 'finance',
    'finance': 'finance',
    'health': 'healthcare',
    'health-care': 'healthcare',
    'entertainmentmedia': 'entertainment',
    'humor': 'entertainment',
    'comedy': 'entertainment',
    'jewelry': 'jewellery',
};

const DISCOVER_NICHE_MAP: Record<string, string> = {
    'fashion-beauty': 'Beauty',
    'food-beverage': 'Food',
    'tech': 'Technology',
    'fitness': 'Fitness',
    'finance': 'Finance',
    'entertainment': 'Entertainment',
    'travel': 'Travel',
    'lifestyle': 'Lifestyle',
    'healthcare': 'Health',
    'jewellery': 'Beauty',
};

function parseCampaignReady(content: string): ExtractedData | null {
    const match = content.match(/CAMPAIGN_READY\s*```json\n([\s\S]*?)\n```/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1]) as ExtractedData;
        return parsed;
    } catch {
        return null;
    }
}

function parseStrategyJSON(content: string): Strategy | null {
    const match = content.match(/STRATEGY_READY\s*```json\n([\s\S]*?)\n```/);
    if (!match) return null;
    try {
        const p = JSON.parse(match[1]);
        if (!p.thesis || !Array.isArray(p.hooks)) return null;
        return {
            thesis: String(p.thesis),
            whyThisApproach: String(p.whyThisApproach || ''),
            hooks: (p.hooks as unknown[]).map(String),
            contentIdeas: Array.isArray(p.contentIdeas) ? (p.contentIdeas as unknown[]).map(String) : [],
            reachLow: Number(p.reachLow) || 0,
            reachHigh: Number(p.reachHigh) || 0,
            engageLow: Number(p.engageLow) || 0,
            engageHigh: Number(p.engageHigh) || 0,
            clicksLow: Number(p.clicksLow) || 0,
            clicksHigh: Number(p.clicksHigh) || 0,
            confidenceLabel: String(p.confidenceLabel || 'Medium'),
            confidencePct: Number(p.confidencePct) || 78,
            timeline: Array.isArray(p.timeline) ? (p.timeline as unknown[]).map(String) : [],
            recommendations: Array.isArray(p.recommendations) ? (p.recommendations as unknown[]).map(String) : [],
            creatorBrief: String(p.creatorBrief || ''),
            creatorMix: Array.isArray(p.creatorMix) ? p.creatorMix : undefined,
            contentMixPct: Array.isArray(p.contentMixPct) ? (p.contentMixPct as unknown[]).map(Number) : undefined,
            suggestedName: p.suggestedName ? String(p.suggestedName) : undefined,
        };
    } catch {
        return null;
    }
}

function cleanForDisplay(content: string): string {
    return content
        .replace(/CAMPAIGN_READY\s*```json[\s\S]*?```/g, '')
        .replace(/STRATEGY_READY\s*```json[\s\S]*?```/g, '')
        .trim();
}

// The backend now returns a fully server-validated draft every turn (Structured Outputs on
// its end) instead of a magic CAMPAIGN_READY block the client had to regex-parse. Fields the
// model hasn't determined yet come back as null/undefined and must not clobber what's already
// known locally, so this strips them before spreading the server draft over the local one.
function withoutNullish<T extends object>(obj: T | undefined): Partial<T> {
    if (!obj) return {};
    const out: Partial<T> = {};
    (Object.keys(obj) as Array<keyof T>).forEach((key) => {
        const value = obj[key];
        if (value !== null && value !== undefined) out[key] = value;
    });
    return out;
}

function toNumber(value: unknown): number {
    const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function fmtINR(n: number): string {
    return `₹${Math.max(0, Math.round(n)).toLocaleString('en-IN')}`;
}

function sanitizeText(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
    const cleaned = String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/[<>]/g, '')
        .trim();
    return cleaned.slice(0, maxLength);
}

function titleCase(value: string): string {
    return value
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeNicheKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    const direct = NICHE_OPTIONS.find((n) => n.key === raw);
    if (direct) return direct.key;

    const hyphenated = raw.replace(/[_\s]+/g, '-');
    const directHyphen = NICHE_OPTIONS.find((n) => n.key === hyphenated);
    if (directHyphen) return directHyphen.key;

    const compact = raw.replace(/[^a-z0-9]/g, '');
    return NICHE_KEY_ALIASES[raw] || NICHE_KEY_ALIASES[hyphenated] || NICHE_KEY_ALIASES[compact] || '';
}

function mapNicheToDiscoverLabel(niche: string, type?: string): string {
    const normalized = normalizeNicheKey(niche);
    if (normalized && DISCOVER_NICHE_MAP[normalized]) return DISCOVER_NICHE_MAP[normalized];
    if (normalized) return titleCase(normalized.replace(/-/g, ' '));
    if (type === 'meme') return 'Humor';
    return '';
}

function normalizeChoice(value: unknown, allowed: readonly string[]): string {
    const raw = String(value ?? '').trim().toLowerCase();
    const match = allowed.find((a) => a.toLowerCase() === raw);
    return match || '';
}

function parseBudgetValue(value: unknown): number {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;

    const lower = raw.toLowerCase();
    if (/\bflexible\b/.test(lower)) return 0;

    const normalized = lower.replace(/,/g, '');
    const lakhMatch = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*l(?:akh)?\b/i);
    if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000);

    const thousandMatch = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
    if (thousandMatch) return Math.round(parseFloat(thousandMatch[1]) * 1000);

    const rupeeMatch = normalized.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
    if (rupeeMatch) return Math.round(parseFloat(rupeeMatch[1]));

    const plainMatch = normalized.match(/(\d{4,})(?:\D|$)/);
    if (plainMatch) return Math.round(parseFloat(plainMatch[1]));

    const numeric = Number(normalized.replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderSimpleMarkdown(md: string): string {
    if (!md) return '';
    // escape first
    let out = escapeHtml(md);
    // bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // italics *text*
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // convert ordered lists starting with 1. into <ol>
    out = out.replace(/^\s*\d+\.\s(.+)$/gm, '<li>$1</li>');
    // wrap list items in ol if any
    if (/^\s*<li>/m.test(out)) {
        out = out.replace(/(?:\n\s*)?<li>/, '<ol><li>').replace(/<li>([\s\S]*?)$(?![\s\S]*<li>)/m, '<li>$1</li></ol>');
    }
    // line breaks
    out = out.replace(/\n/g, '<br/>');
    return out;
}

function buildSuggestions(candidate: Partial<ExtractedData> | null, assistantReply: string, user: any) {
    const reply = (assistantReply || '').toLowerCase();
    const suggestions: {
        types: string[];
        objectives: string[];
        budgets: string[];
        locations: string[];
        platforms: string[];
        niches: string[];
        postingTypes: string[];
        scriptTypes: string[];
        budgetModes: string[];
    } = {
        types: [],
        objectives: [],
        budgets: [],
        locations: [],
        platforms: [],
        niches: [],
        postingTypes: [],
        scriptTypes: [],
        budgetModes: [],
    };

    const addUnique = (arr: string[], v?: string) => {
        if (!v) return;
        const cleaned = String(v).trim();
        if (!cleaned) return;
        if (!arr.includes(cleaned)) arr.push(cleaned);
    };

    // Types
    ['influencer', 'ugc', 'meme', 'twitter'].forEach((t) => {
        if (reply.includes(t) || (candidate && String(candidate.type || '').toLowerCase().includes(t))) addUnique(suggestions.types, t);
    });
    addUnique(suggestions.types, candidate?.type || 'influencer');

    // Objectives
    ['Sales', 'Awareness', 'Engagement', 'Lead Generation', 'App Installs'].forEach((o) => {
        if (reply.includes(o.toLowerCase()) || (candidate && String(candidate.objective || '').toLowerCase().includes(o.toLowerCase()))) addUnique(suggestions.objectives, o);
    });
    addUnique(suggestions.objectives, candidate?.objective || 'Awareness');

    // Budgets (prefer numbers)
    const parsedBudget = candidate && candidate.totalBudget ? String(candidate.totalBudget).replace(/[^\d]/g, '') : '';
    if (parsedBudget) addUnique(suggestions.budgets, parsedBudget);
    ['150000', '200000', '400000', '60000'].forEach((b) => addUnique(suggestions.budgets, b));

    // Locations
    addUnique(suggestions.locations, candidate?.location);
    addUnique(suggestions.locations, user?.city);
    addUnique(suggestions.locations, 'Pan India');

    // Platforms
    ['instagram', 'youtube', 'twitter', 'other'].forEach((p) => {
        if (reply.includes(p) || (candidate && String(candidate.platform || '').toLowerCase().includes(p))) addUnique(suggestions.platforms, p);
    });
    addUnique(suggestions.platforms, candidate?.platform || 'instagram');

    // Niches
    NICHE_OPTIONS.forEach((n) => {
        if (reply.includes(n.key) || (candidate && String(candidate.niche || '').toLowerCase().includes(n.key))) addUnique(suggestions.niches, n.key);
    });
    addUnique(suggestions.niches, candidate?.niche || 'others');

    // Posting Types
    if (reply.includes('brand post') || reply.includes('whitelisting')) addUnique(suggestions.postingTypes, 'brand');
    if (reply.includes('creator post') || reply.includes('creator profile')) addUnique(suggestions.postingTypes, 'creator');
    addUnique(suggestions.postingTypes, candidate?.postingType || 'creator');

    // Script Types
    if (reply.includes('brand provides') || reply.includes('brand script')) addUnique(suggestions.scriptTypes, 'brand');
    if (reply.includes('creator creates') || reply.includes('creator script')) addUnique(suggestions.scriptTypes, 'creator');
    addUnique(suggestions.scriptTypes, candidate?.scriptType || 'creator');

    // Budget Modes
    if (reply.includes('product') && !reply.includes('paid')) addUnique(suggestions.budgetModes, 'product');
    if (reply.includes('paid')) addUnique(suggestions.budgetModes, 'paid');
    if (reply.includes('product') && reply.includes('paid')) addUnique(suggestions.budgetModes, 'paid_product');
    addUnique(suggestions.budgetModes, candidate?.budgetMode || 'paid');

    // limit sizes
    suggestions.types = suggestions.types.slice(0, 4);
    suggestions.objectives = suggestions.objectives.slice(0, 4);
    suggestions.budgets = suggestions.budgets.slice(0, 5);
    suggestions.locations = suggestions.locations.slice(0, 4);
    suggestions.platforms = suggestions.platforms.slice(0, 4);
    suggestions.niches = suggestions.niches.slice(0, 4);
    suggestions.postingTypes = suggestions.postingTypes.slice(0, 2);
    suggestions.scriptTypes = suggestions.scriptTypes.slice(0, 2);
    suggestions.budgetModes = suggestions.budgetModes.slice(0, 3);

    return suggestions;
}

function buildFriendlySummary(
    candidate: Partial<ExtractedData>,
    missing: string[],
    name?: string
): string {
    const namePart = name ? `, ${name}` : '';
    const details: string[] = [];

    if (candidate.type) details.push(`${candidate.type} campaign`);
    if (candidate.objective) details.push(`goal: ${candidate.objective.toLowerCase()}`);
    if (candidate.platform) details.push(`on ${candidate.platform}`);
    if (candidate.location) details.push(`in ${candidate.location}`);
    if (candidate.totalBudget) details.push(`budget ${fmtINR(toNumber(candidate.totalBudget))}`);
    const description = sanitizeText(candidate.description || '', 220);

    const brief = details.length > 0
        ? `Got it${namePart}! ${details.join(', ')}.`
        : `Got it${namePart}!`;

    const descriptionLine = description
        ? ` I drafted this brief: "${description}".`
        : '';

    if (missing.length === 0) {
        return `${brief}${descriptionLine} Looks right from my side. Does this look right to you? Reply Yes to continue or No to change anything.`;
    }

    return `${brief}${descriptionLine} I can fill the remaining details with a couple of quick questions. Does this look right so far? Reply Yes to continue or No to change anything.`;
}

function tierFromFollowers(followers: number): string {
    if (followers >= 1_000_000) return 'mega';
    if (followers >= 500_000) return 'macro';
    if (followers >= 50_000) return 'mid';
    if (followers >= 10_000) return 'micro';
    return 'nano';
}

// Last-resort constants — only used if tier config totally failed to load (useTierConfig
// already carries its own fallback array, so this is a final belt-and-suspenders default).
function feeFromTierConstant(tier: string): number {
    if (tier === 'mega') return 120_000;
    if (tier === 'macro') return 70_000;
    if (tier === 'mid') return 25_000;
    if (tier === 'micro') return 12_000;
    return 5_000;
}

// Prefer the creator's own rate card (real, self-set pricing) over a tier-wide median, and the
// tier median (real regression-based pricing, see pricing.service.ts) over a hardcoded guess.
function feeFromRateCardOrTier(
    rateCard: unknown,
    platform: string,
    tier: string,
    tiers: TierConfigEntry[]
): number {
    if (rateCard && typeof rateCard === 'object') {
        const card = rateCard as Record<string, unknown>;
        const candidateKeys = [`${platform}_reel`, `${platform}_video`, `${platform}_post`, `${platform}_short`, `${platform}_thread`, `${platform}_story`];
        for (const key of candidateKeys) {
            const value = Number(card[key]);
            if (Number.isFinite(value) && value > 0) return value;
        }
        const anyValue = Object.values(card).map(Number).find((v) => Number.isFinite(v) && v > 0);
        if (anyValue) return anyValue;
    }
    const tierEntry = tiers.find((t) => t.tier === tier);
    if (tierEntry && tierEntry.suggestedPrice.median > 0) return tierEntry.suggestedPrice.median;
    return feeFromTierConstant(tier);
}

function mapInfluencers(
    list: Array<Record<string, unknown>>,
    draft: ExtractedData,
    effectivePlatform: string,
    tiers: TierConfigEntry[]
): CreatorShortlistRow[] {
    return list.map((row, idx) => {
        const followers = toNumber(row.followerCount ?? row.followers);
        const tier = String(row.tier || tierFromFollowers(followers));
        return {
            id: String(row.id || `mx-${idx}`),
            name: String(row.name || row.userName || `Creator ${idx + 1}`),
            handle: String(row.handle || `@creator${idx + 1}`),
            city: String(row.location || row.city || draft.location || 'India'),
            followers,
            engagementRate: Number(row.engagementRate ?? row.engagement_rate ?? 0),
            tier,
            fee: feeFromRateCardOrTier(row.rateCard, effectivePlatform || 'instagram', tier, tiers),
            why: `Strong fit for ${(draft.objective || 'awareness').toLowerCase()} on ${effectivePlatform || 'instagram'}.`,
        };
    });
}

function extractKnownFromPrompt(prompt: string, user: { city?: string; industry?: string; brandName?: string } | null): Partial<ExtractedData> {
    const p = prompt.toLowerCase();

    // 1. Platform Extraction
    let platform = '';
    if (/\binstagram\b|\breel[s]?\b|\bstor(?:y|ies)\b/i.test(p)) platform = 'instagram';
    else if (/\byoutube\b|\bshort[s]?\b|\bdedicated\b/i.test(p)) platform = 'youtube';
    else if (/\btwitter\b|\bx\b|\btweet[s]?\b/i.test(p)) platform = 'twitter';

    // 2. Budget Mode Extraction
    const hasGiftOrProduct = /\bgift(?:ing)?\b|\bproduct[- ]?led\b|\bsample(?:s)?\b|\bin[- ]kind\b|\bbarter\b|\bproduct only\b/i.test(p);
    const hasPaid = /\bpaid\b|\bcollaboration(?:s)?\b|\bfee\b|\bcompensation\b/i.test(p);
    const budgetMode = hasGiftOrProduct && hasPaid ? 'paid_product' : hasGiftOrProduct ? 'product' : 'paid';

    // 3. Objective Extraction
    let objective = '';
    if (/\bsale[s]?\b|\bconversion[s]?\b|\broas\b/i.test(p)) objective = 'Sales';
    else if (/\baware(?:ness)?\b|\breach\b|\bvisibility\b/i.test(p)) objective = 'Awareness';
    else if (/\binstall[s]?\b|\bdownload[s]?\b/i.test(p)) objective = 'App Installs';
    else if (/\blead[s]?\b|\bcpl\b|\bform\b/i.test(p)) objective = 'Lead Generation';
    else if (/\bengage(?:ment)?\b|\blike[s]?\b|\bcomment[s]?\b/i.test(p)) objective = 'Engagement';

    // 4. Campaign Type Extraction
    let type = '';
    if (/\bugc\b|\buser[- ]generated\b/i.test(p)) type = 'ugc';
    else if (/\bmeme\b|\bhumor\b/i.test(p)) type = 'meme';
    else if (/\btwitter\b|\bx\b/i.test(p)) type = 'twitter';
    else if (/\binfluencer\b|\bcreator\b/i.test(p)) type = 'influencer';

    // 5. Niche Extraction (Expanded regex)
    let niche = '';
    for (const option of NICHE_OPTIONS) {
        if (p.includes(option.key) || p.includes(option.label.toLowerCase())) {
            niche = option.key;
            break;
        }
    }
    if (!niche) {
        if (/\bbeauty\b|\bskincare\b|\bmakeup\b|\bgrooming\b/i.test(p)) niche = 'fashion-beauty';
        else if (/\bfood\b|\bdrink\b|\bbeverage\b|\bsnack\b/i.test(p)) niche = 'food-beverage';
        else if (/\bgym\b|\bprotein\b|\bworkout\b|\bhealth\b/i.test(p)) niche = 'fitness';
        else if (/\bcrypto\b|\bbank\b|\bmoney\b|\binvest\b/i.test(p)) niche = 'finance';
        else if (/\bsoftware\b|\bsaas\b|\bgadget\b|\bphone\b/i.test(p)) niche = 'tech';
    }

    const budgetValue = parseBudgetValue(prompt);
    const extracted: Partial<ExtractedData> = {
        description: prompt.trim(),
        mixMode: false,
        creatorSizes: [],
    };

    // 6. Visibility Extraction
    if (/\bprivate\b|\binvite only\b|\bhand[- ]?pick\b|\bhidden\b/i.test(p)) extracted.visibility = 'private';
    else if (/\bpublic\b|\bopen\b|\ballow all\b/i.test(p)) extracted.visibility = 'public';

    // 7. Posting Type Extraction
    if (/\bbrand post(?:ing)?\b|\bwhitelisting\b|\bbrand page\b/i.test(p)) extracted.postingType = 'brand';
    else if (/\bcreator post(?:ing)?\b|\bon (?:their|the) profile\b/i.test(p)) extracted.postingType = 'creator';

    // 8. Script Type Extraction
    if (/\bbrand (?:provides|gives) script\b|\bi will (?:give|write) (?:the )?script\b|\bfixed script\b/i.test(p)) extracted.scriptType = 'brand';
    else if (/\bcreator (?:makes|creates|writes) script\b|\bcreative freedom\b|\bfreestyle\b/i.test(p)) extracted.scriptType = 'creator';

    // 9. Location Extraction — only match "in <city>" patterns and exclude product/event words
    const LOCATION_NON_WORDS = [
        'india', 'campaign', 'brand', 'collection', 'launch', 'sale', 'sales',
        'awareness', 'budget', 'instagram', 'youtube', 'twitter', 'reel', 'story',
        'goal', 'visibility', 'creator', 'influencer', 'diwali', 'holi', 'eid',
        'festive', 'festival', 'season', 'product', 'store', 'shop', 'content',
        'video', 'post', 'caption', 'thread', 'short', 'platform', 'niche',
    ];
    const locationMatch = p.match(/\bin\s+([a-z][a-z\s]{2,18}?)(?:\s*[.,]|\s+(?:and|with|for|on|by)|$)/i);
    if (locationMatch) {
        const loc = locationMatch[1].trim();
        const isExcluded = LOCATION_NON_WORDS.some((w) => loc.toLowerCase().includes(w));
        if (!isExcluded && loc.length >= 3) extracted.location = titleCase(loc);
    }
    if (!extracted.location && /\bpan india\b|\bacross india\b/i.test(p)) {
        extracted.location = 'Pan India';
    }

    if (/\bproof of work\b|\bproof required\b|\bneeds proof\b/i.test(p)) {
        extracted.proofOfWorkReq = true;
    }

    if (objective) extracted.objective = objective;
    if (type) extracted.type = type;
    if (niche) extracted.niche = niche;
    if (platform) extracted.platform = platform;
    if (budgetValue > 0) extracted.totalBudget = String(budgetValue);
    if (budgetMode) extracted.budgetMode = budgetMode;
    if (platform) extracted.contentType = platform === 'instagram' ? ['reel'] : platform === 'youtube' ? ['short'] : platform === 'twitter' ? ['thread'] : [];

    // We only set the campaign name explicitly if it was provided, or leave it empty so the user can control it.
    // user can provide a name but regex doesn't catch it reliably, so we intentionally don't default it.

    return extracted;
}

function buildExtractionRows(source: Partial<ExtractedData>): ExtractionRow[] {
    const hasBudget = toNumber(source.totalBudget) > 0;
    return [
        { label: 'Campaign type', value: source.type || 'Not specified', ok: Boolean(source.type) },
        { label: 'Product / description', value: source.description ? 'Captured from prompt' : 'Not specified', ok: Boolean(source.description) },
        { label: 'Objective', value: source.objective || 'Not specified', ok: Boolean(source.objective) },
        { label: 'Budget', value: hasBudget ? fmtINR(toNumber(source.totalBudget)) : 'Not specified', ok: hasBudget },
        { label: 'Platform', value: source.platform || 'Not specified', ok: Boolean(source.platform) },
        { label: 'Location', value: source.location || 'Not specified', ok: Boolean(source.location) },
    ];
}

function buildFieldSummary(source: Partial<ExtractedData>): ExtractionRow[] {
    const hasBudget = toNumber(source.totalBudget) > 0;
    const individualDeadlines = source.deadlineMode === 'individual';
    const rows: ExtractionRow[] = [
        { label: 'Campaign name', value: source.campaignName || '—', ok: Boolean(source.campaignName) },
        { label: 'Type', value: source.type || '—', ok: Boolean(source.type) },
        { label: 'Objective', value: source.objective || '—', ok: Boolean(source.objective) },
        { label: 'Niche', value: source.niche || '—', ok: Boolean(source.niche) },
        { label: 'Platform', value: source.platform || '—', ok: Boolean(source.platform) },
        { label: 'Location', value: source.location || '—', ok: Boolean(source.location) },
        { label: 'Budget', value: hasBudget ? fmtINR(toNumber(source.totalBudget)) : (source.budgetMode === 'product' ? 'Product Only' : '—'), ok: hasBudget || source.budgetMode === 'product' },
        { label: 'Visibility', value: source.visibility || '—', ok: Boolean(source.visibility) },
        { label: 'Posting type', value: source.postingType || '—', ok: Boolean(source.postingType) },
        { label: 'Script type', value: source.scriptType || '—', ok: Boolean(source.scriptType) },
        { label: 'Budget mode', value: source.budgetMode || '—', ok: Boolean(source.budgetMode) },
        { label: 'Deadlines', value: individualDeadlines ? 'Per creator' : 'Common', ok: true },
    ];
    if (!individualDeadlines) {
        rows.push({ label: 'App deadline', value: source.applicationDeadline || '—', ok: Boolean(source.applicationDeadline) });
        if (source.scriptType !== 'brand') {
            rows.push({ label: 'Script deadline', value: source.scriptDeadline || '—', ok: Boolean(source.scriptDeadline) });
        }
        rows.push({ label: 'Work deadline', value: source.workDeadline || '—', ok: Boolean(source.workDeadline) });
        rows.push({ label: 'Proof deadline', value: source.proofOfWorkDeadline || '—', ok: Boolean(source.proofOfWorkDeadline) });
    }
    rows.push({
        label: 'Site visit',
        value: source.visitAtSiteEnabled ? (source.visitAtSiteDate ? `Yes · ${source.visitAtSiteDate}` : 'Yes') : 'No',
        ok: !source.visitAtSiteEnabled || Boolean(source.visitAtSiteDescription && source.visitAtSiteDate && source.visitAtSiteTime),
    });
    return rows;
}

const REQUIRED_FIELDS: Array<{
    key: keyof ExtractedData;
    label: string;
    when?: (draft: Partial<ExtractedData>) => boolean;
}> = [
        { key: 'type', label: 'Campaign type' },
        { key: 'objective', label: 'Objective' },
        { key: 'platform', label: 'Platform' },
        { key: 'niche', label: 'Niche' },
        { key: 'location', label: 'Location' },
        { key: 'visibility', label: 'Visibility' },
        { key: 'postingType', label: 'Posting type' },
        { key: 'scriptType', label: 'Script type' },
        { key: 'budgetMode', label: 'Budget mode' },
        { key: 'totalBudget', label: 'Total budget', when: (draft) => draft.budgetMode !== 'product' },
        {
            key: 'productDetails',
            label: 'Product details',
            when: (draft) => draft.budgetMode === 'product' || draft.budgetMode === 'paid_product',
        },
        // Deadlines only apply in "common" mode — with individual deadlines the brand sets
        // dates per creator later while reviewing applications (same rule as the builder).
        { key: 'applicationDeadline', label: 'Applications Close', when: (draft) => draft.deadlineMode !== 'individual' },
        { key: 'scriptDeadline', label: 'Scripts Due', when: (draft) => draft.deadlineMode !== 'individual' && draft.scriptType !== 'brand' },
        { key: 'workDeadline', label: 'Content Goes Live', when: (draft) => draft.deadlineMode !== 'individual' },
        { key: 'proofOfWorkDeadline', label: 'Proof of Work Deadline', when: (draft) => draft.deadlineMode !== 'individual' && draft.proofOfWorkReq !== false },
        // Visit-at-site details become required the moment the toggle is on (builder parity).
        { key: 'visitAtSiteDescription', label: 'Visit description', when: (draft) => Boolean(draft.visitAtSiteEnabled) },
        { key: 'visitAtSiteDate', label: 'Visit date', when: (draft) => Boolean(draft.visitAtSiteEnabled) },
        { key: 'visitAtSiteTime', label: 'Visit time', when: (draft) => Boolean(draft.visitAtSiteEnabled) },
    ];

function getMissingFields(draft: Partial<ExtractedData>): string[] {
    return REQUIRED_FIELDS.filter((field) => {
        if (field.when && !field.when(draft)) return false;
        if (field.key === 'totalBudget') return toNumber(draft.totalBudget) <= 0;
        return !String(draft[field.key] ?? '').trim();
    }).map((field) => field.label);
}

/** Fields the chat deliberately never asks about — they're collected in the step-2 form
 *  (dates via pickers, visit-site details, uploads). The conversation is "complete" once
 *  every field OUTSIDE this set is filled; asking the user for these in chat produced
 *  dead-end turns like "Could you tell me the applications close next?". */
const FORM_ONLY_FIELD_LABELS = new Set([
    'Applications Close', 'Scripts Due', 'Content Goes Live', 'Proof of Work Deadline',
    'Visit description', 'Visit date', 'Visit time',
]);

function getChatAskableMissing(missing: string[]): string[] {
    return missing.filter((label) => !FORM_ONLY_FIELD_LABELS.has(label));
}

/** The closing message of the chat phase: a real recap of everything captured, so the
 *  user gets a proper summary instead of a generic one-liner before moving to details. */
function buildChatFinalSummary(draft: Partial<ExtractedData>, formOnlyMissing: string[]): string {
    const rows: string[] = [];
    const push = (label: string, value?: string) => {
        if (value && String(value).trim()) rows.push(`• **${label}:** ${value}`);
    };
    push('Campaign', draft.campaignName);
    push('Type', draft.type ? titleCase(draft.type) : '');
    push('Objective', draft.objective);
    push('Platform', draft.platform ? titleCase(draft.platform) : '');
    push('Niche', draft.niche ? titleCase(String(draft.niche).replace(/-/g, ' ')) : '');
    push('Location', draft.location);
    if (draft.budgetMode === 'product') {
        push('Budget', 'Product only (barter)');
    } else if (toNumber(draft.totalBudget) > 0) {
        push('Budget', fmtINR(toNumber(draft.totalBudget)));
    }
    push('Budget mode', draft.budgetMode === 'paid_product' ? 'Paid + Product' : draft.budgetMode ? titleCase(draft.budgetMode) : '');
    push('Script', draft.scriptType === 'brand' ? 'Brand provides' : draft.scriptType === 'creator' ? 'Creator writes' : '');
    push('Posting', draft.postingType === 'brand' ? 'Brand posts (whitelisting)' : draft.postingType === 'creator' ? 'Creator posts on profile' : '');
    push('Visibility', draft.visibility ? titleCase(draft.visibility) : '');

    const summaryBlock = rows.length > 0
        ? `Here's a summary of your campaign:\n\n${rows.join('\n')}`
        : 'I have everything I need from our chat.';

    const nextStep = formOnlyMissing.length > 0
        ? `\n\nThat covers the brief! The remaining details (${formOnlyMissing.join(', ').toLowerCase()}) can be set with date pickers in the details form — I'm taking you there now to review everything and build the strategy.`
        : `\n\nEverything is in place — I'm taking you to the details form to review and build the strategy.`;

    return `${summaryBlock}${nextStep}`;
}

function isInitialPromptSufficient(promptText: string): boolean {
    // Require minimum length and word count for initial campaign description
    const trimmed = promptText.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    // Minimum 15 words or 80 characters for initial message
    return wordCount >= 15 || trimmed.length >= 80;
}

// Messages that state intent but describe nothing. The user saying "i want to create a
// campaign" has told us they want a campaign — which we already knew — and nothing else.
const CONTENT_FREE_PATTERNS: RegExp[] = [
    /^(hi+|hello+|hey+|yo|hola|namaste)[\s!.?]*$/i,
    /^(ok|okay|yes|yeah|no|sure|thanks|thank you|cool|done)[\s!.?]*$/i,
    /^i (want|need|would like|wanna) to (create|make|start|build|run|do)( a| an| the)?( new)? campaign[\s!.?]*$/i,
    /^i (want|need)( a| an)?( new)? campaign[\s!.?]*$/i,
    /^(create|make|start|build|new|another)( a| an)?( new)? campaign[\s!.?]*$/i,
    /^help( me)?([\s,]*(with|create|build|make)?( a| an)?( new)? campaign)?[\s!.?]*$/i,
];

function isContentFreeMessage(text: string): boolean {
    const t = String(text ?? '').trim();
    if (!t) return true;
    return CONTENT_FREE_PATTERNS.some((re) => re.test(t));
}

/**
 * Has the USER actually described a campaign yet?
 *
 * This deliberately reads the user's own messages and nothing else. The previous gates keyed
 * off `draft.description` / `draft.niche`, but those are filled by the MODEL — the backend
 * prompt instructs it to infer a niche silently on every turn — so they were true almost
 * immediately and the creative-style question fired while we still knew nothing. A gate that
 * measures the model's output cannot tell us whether the user has said anything.
 */
export function hasSubstantiveBrief(messages: ChatMessage[]): boolean {
    const text = messages
        .filter((m) => m.role === 'user' && !isContentFreeMessage(m.content))
        .map((m) => String(m.content ?? '').trim())
        .filter(Boolean)
        .join(' ');
    const words = text.split(/\s+/).filter(Boolean).length;
    return words >= 6 || text.length >= 30;
}

function buildQuestions(
    source: Partial<ExtractedData>,
    assistantReply: string,
    user: { city?: string } | null,
    hasUserBrief = false
): FollowUpQuestion[] {
    const questions: FollowUpQuestion[] = [];
    const MAX_FOLLOWUP_QUESTIONS = 1;

    const missing = (value: unknown) => !String(value ?? '').trim();
    const add = (q: FollowUpQuestion) => {
        if (questions.length >= MAX_FOLLOWUP_QUESTIONS) return;
        questions.push(q);
    };

    // Never ask targeted follow-ups until the USER has described the campaign. Asking someone
    // to choose Influencer/UGC/Meme before they have said what they are promoting is asking
    // them to answer a question that has no answer yet.
    if (!hasUserBrief) {
        return [];
    }

    // Do not talk over the assistant. This card is built locally and knows nothing about what
    // the model just said, so when the model has already asked something ("Is this for
    // Instagram or YouTube?") a card asking about a DIFFERENT field appears beside it and the
    // user is hit with two unrelated questions at once — which is exactly what derails someone
    // mid-thought. If the model asked, let it own the turn; the card waits.
    if (/\?\s*$/.test(String(assistantReply || '').trim())) {
        return [];
    }

    // ===== CORE QUESTIONS ASKED FIRST =====
    if (missing(source.type)) {
        // Reaching here already means the user gave a real brief (guard above), so the
        // creative-style question is now answerable. It previously also unlocked on
        // `source.niche`, which the model auto-fills on every turn.
        {
            add({
                id: 'type',
                field: 'type',
                q: 'Should this campaign feel Influencer-led for reach, UGC-led for trust, or Meme-led for virality?',
                opts: ['Influencer', 'UGC', 'Meme', 'Twitter'],
                suggestion: 'Pick the style that matches the tone you want creators to use for your audience.',
                helpText: 'This sets the creative direction for the creator briefs'
            });
        }
    }

    if (missing(source.niche)) {
        add({
            id: 'niche',
            field: 'niche',
            q: 'Which niche do you think would resonate most with your brand’s target audience?',
            opts: ['Beauty', 'Food', 'Fitness', 'Tech', 'Finance', 'Entertainment'],
            suggestion: 'Selecting a niche with high affinity to your product ensures better conversion rates.',
            helpText: 'Match your product category to the creator’s audience'
        });
    }

    if (missing(source.platform)) {
        add({
            id: 'platform',
            field: 'platform',
            q: 'Where does your target audience spend the most time? Instagram, YouTube, or Twitter?',
            opts: ['Instagram', 'YouTube', 'Twitter'],
            suggestion: 'Instagram is best for aesthetics/reels; YouTube for demos; Twitter for trend-jacking.',
            helpText: 'Choose the channel with the best organic engagement for your niche'
        });
    }

    if (missing(source.objective)) {
        add({
            id: 'objective',
            field: 'objective',
            q: 'What is the primary KPI we’re optimizing for? (Awareness, Sales, or Engagement?)',
            opts: ['Awareness', 'Sales', 'Engagement', 'App Installs', 'Lead Generation'],
            suggestion: 'Pick Sales for direct ROAS, Awareness for top-of-funnel reach, or Engagement for community building.',
            helpText: 'This determines how the AI builds your reach estimates'
        });
    }

    const needsBudget = toNumber(source.totalBudget) <= 0 && source.budgetMode !== 'product';
    if (needsBudget) {
        add({
            id: 'budget',
            field: 'totalBudget',
            q: 'What budget should I plan around?',
            opts: [],
            inputType: 'currency',
            suggestion: 'Use 10000, 25000, 1.5L, or say flexible. If this is gifting/product-led, I can skip paid budget.',
            helpText: 'Enter amount in INR, k, or L format.'
        });
    }

    if (missing(source.scriptType)) {
        add({
            id: 'scriptType',
            field: 'scriptType',
            q: 'Will you provide the script or should creators make it?',
            opts: ['Brand provides script', 'Creator creates script'],
            suggestion: 'Brand script = consistent messaging, Creator script = authentic & natural feel. Pick based on your brand tone.',
            helpText: 'Creator scripts usually perform better with followers'
        });
    }

    if (missing(source.postingType)) {
        add({
            id: 'postingType',
            field: 'postingType',
            q: 'Who should post the content?',
            opts: ['Creator posts on profile', 'Brand posts (whitelisting)'],
            suggestion: 'Creator posts = higher engagement & authentic reach, Brand posts = full campaign control.',
            helpText: 'Creator posts get 3-5x more engagement typically'
        });
    }

    if (missing(source.budgetMode)) {
        add({
            id: 'budgetMode',
            field: 'budgetMode',
            q: 'How should we structure the budget?',
            opts: ['Paid', 'Product Only', 'Paid + Product'],
            suggestion: 'Paid = direct cost, Product = send samples, Paid + Product = hybrid for premium creators.',
            helpText: 'Paid attracts seasoned creators, Product attracts enthusiasts'
        });
    }

    // Location is always defaulted to user city or Pan India — never ask for it.

    if (!source.visibility && questions.length < MAX_FOLLOWUP_QUESTIONS) {
        add({
            id: 'visibility',
            field: 'visibility',
            q: 'Who should see this campaign?',
            opts: ['Public', 'Private'],
            suggestion: 'Public = anyone can browse & apply. Private = you hand-pick creators.',
            helpText: 'Private campaigns give you more control over creator selection'
        });
    }

    // Dates and description are always collected in step 2's form — never ask them in the chat.

    return questions;
}

function getAssistantResponseSuggestion(content: string): string | null {
    const text = content.toLowerCase();

    // Field-specific strategic recommendations
    if (text.includes('type') || text.includes('campaign type')) {
        return 'UGC-led content typically drives 2x more trust and lower CPAs for D2C brands.';
    }
    if (text.includes('platform')) {
        return 'Instagram Reels are currently the highest-performing format for awareness and discovery.';
    }
    if (text.includes('objective') || text.includes('goal')) {
        return 'Focusing on a single KPI like "Sales" allows us to optimize the creator mix for conversion-depth.';
    }
    if (text.includes('budget mode') || text.includes('paid')) {
        return 'A "Paid + Product" hybrid mix attracts the highest quality creators while keeping your unit costs low.';
    }
    if (text.includes('niche')) {
        return 'Picking a specific sub-niche (like Skincare instead of just Beauty) helps find more focused and loyal audiences.';
    }
    if (text.includes('location')) {
        return 'Starting with a local city focus can build strong regional word-of-mouth before scaling Pan-India.';
    }
    if (text.includes('script')) {
        return 'Allowing creators some creative freedom usually leads to more authentic content that performs better.';
    }

    // Keyword-based fallback
    if (/script|brief|freestyle/.test(text)) return 'Creator freestyle feels more natural and social-first.';
    if (/budget|₹|cost|spend/.test(text)) return 'Share a total budget so we can split it across creators and formats.';
    if (/platform|instagram|youtube|twitter/.test(text)) return 'Choose the platform where your audience spends the most time.';

    return null;
}

function applyQuestionAnswers(base: Partial<ExtractedData>, answers: Record<string, string>): Partial<ExtractedData> {
    const next = { ...base };

    if (answers.type) {
        const normalized = normalizeChoice(answers.type, CAMPAIGN_TYPE_OPTIONS);
        if (normalized) next.type = normalized;
    }

    if (answers.niche) {
        const normalized = normalizeNicheKey(answers.niche);
        if (normalized) next.niche = normalized;
    }

    if (answers.platform) {
        const normalized = normalizeChoice(answers.platform, PLATFORM_OPTIONS);
        if (normalized) next.platform = normalized;
    }

    if (answers.budget) {
        const n = parseBudgetValue(answers.budget);
        if (n > 0) {
            next.totalBudget = n > 9999999999 ? '9999999999' : String(n);
        }
    }

    if (answers.objective || answers.goal) {
        const objectiveValue = answers.objective || answers.goal;
        const normalized = OBJECTIVE_OPTIONS.find((o) => o.toLowerCase() === objectiveValue.toLowerCase());
        if (normalized) {
            next.objective = normalized;
        } else {
            // Intelligent mapping for text replies
            const low = objectiveValue.toLowerCase();
            if (low.includes('sale')) next.objective = 'Sales';
            else if (low.includes('aware')) next.objective = 'Awareness';
            else if (low.includes('engage')) next.objective = 'Engagement';
            else if (low.includes('install')) next.objective = 'App Installs';
            else if (low.includes('lead')) next.objective = 'Lead Generation';
        }
    }

    if (answers.visibility) {
        next.visibility = answers.visibility.toLowerCase().includes('private') ? 'private' : 'public';
    }

    if (answers.scriptType) {
        next.scriptType = answers.scriptType.toLowerCase().includes('brand') ? 'brand' : 'creator';
    }

    if (answers.postingType) {
        next.postingType = answers.postingType.toLowerCase().includes('brand') ? 'brand' : 'creator';
    }

    if (answers.budgetMode) {
        const value = answers.budgetMode.toLowerCase();
        if (value.includes('product') && value.includes('paid')) next.budgetMode = 'paid_product';
        else if (value.includes('product')) next.budgetMode = 'product';
        else next.budgetMode = 'paid';
    }

    if (answers.scriptDeadline) next.scriptDeadline = answers.scriptDeadline;
    if (answers.applicationDeadline) next.applicationDeadline = answers.applicationDeadline;
    if (answers.workDeadline) next.workDeadline = answers.workDeadline;
    if (answers.proofOfWorkDeadline) next.proofOfWorkDeadline = answers.proofOfWorkDeadline;
    if (answers.location) next.location = answers.location;

    if (answers.description !== undefined) {
        const val = answers.description.trim().toLowerCase();
        const keepExisting = /^(choose best|use this|looks good|keep|ok|fine|sure|yes|perfect)/.test(val) || val.length < 12;
        if (!keepExisting) {
            next.description = answers.description.trim();
        }
    }

    return next;
}

function defaultFutureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function isValidDateString(value: string): boolean {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function generateCampaignName(draft: Partial<ExtractedData>, brandName?: string): string {
    if (draft.campaignName) return draft.campaignName;
    const desc = (draft.description || '').toLowerCase();
    const events: [string, string][] = [
        ['diwali', 'Diwali'], ['holi', 'Holi'], ['christmas', 'Christmas'],
        ['eid', 'Eid'], ['navratri', 'Navratri'], ['independence', 'Independence Day'],
        ['launch', 'Launch'], ['sale', 'Sale'], ['summer', 'Summer'],
        ['winter', 'Winter'], ['monsoon', 'Monsoon'], ['festiv', 'Festive'],
        ['ugc', 'UGC'], ['meme', 'Meme'],
    ];
    const brand = brandName?.trim() || '';
    const nicheLabel = draft.niche ? titleCase((draft.niche || '').replace(/-/g, ' ')) : '';
    const platformLabel = draft.platform ? titleCase(draft.platform) : '';
    const objectiveLabel = draft.objective || '';
    let event = '';
    for (const [kw, label] of events) {
        if (desc.includes(kw)) { event = label; break; }
    }
    // With brand name
    if (brand && event) return `${brand} ${event} Campaign`;
    if (brand && objectiveLabel && nicheLabel) return `${brand} ${nicheLabel} ${objectiveLabel}`;
    if (brand && nicheLabel) return `${brand} ${nicheLabel} Campaign`;
    if (brand && objectiveLabel) return `${brand} ${objectiveLabel} Campaign`;
    if (brand) return `${brand} Campaign`;
    // Without brand name — generate from campaign context
    if (event && objectiveLabel) return `${event} ${objectiveLabel} Campaign`;
    if (event && nicheLabel) return `${event} ${nicheLabel} Campaign`;
    if (event) return `${event} Campaign`;
    if (nicheLabel && objectiveLabel && platformLabel) return `${platformLabel} ${nicheLabel} ${objectiveLabel}`;
    if (nicheLabel && objectiveLabel) return `${nicheLabel} ${objectiveLabel} Campaign`;
    if (nicheLabel && platformLabel) return `${platformLabel} ${nicheLabel} Campaign`;
    if (nicheLabel) return `${nicheLabel} Campaign`;
    if (objectiveLabel) return `${objectiveLabel} Campaign`;
    return 'Influencer Campaign';
}

function hydrateDraft(candidate: Partial<ExtractedData>): ExtractedData {
    const normalizedType = normalizeChoice(candidate.type, CAMPAIGN_TYPE_OPTIONS) || 'influencer';
    const normalizedPlatform = normalizeChoice(candidate.platform, PLATFORM_OPTIONS) || 'instagram';
    const normalizedNiche = normalizeNicheKey(candidate.niche) || sanitizeText(candidate.niche || 'others', 100);
    const normalizedScriptType = candidate.scriptType === 'brand' ? 'brand' : 'creator';

    return {
        campaignName: sanitizeText(candidate.campaignName || '', 255),
        description: sanitizeText(candidate.description || 'Campaign generated by AI Strategist.', MAX_DESCRIPTION_LENGTH),
        type: normalizedType,
        objective: sanitizeText(candidate.objective || 'Awareness', 100),
        location: sanitizeText(candidate.location || '', 255),
        visibility: candidate.visibility || 'public',
        niche: normalizedNiche,
        platform: normalizedPlatform,
        contentType: candidate.contentType && candidate.contentType.length > 0 ? candidate.contentType : (normalizedPlatform === 'youtube' ? ['short'] : normalizedPlatform === 'twitter' ? ['thread'] : ['reel']),
        postingType: candidate.postingType || 'creator',
        usageRights: candidate.usageRights || '30d',
        scriptType: normalizedScriptType,
        budgetMode: candidate.budgetMode || 'paid',
        productDetails: sanitizeText(candidate.productDetails || '', MAX_TEXT_LENGTH),
        totalBudget: candidate.totalBudget || '150000',
        mixMode: Boolean(candidate.mixMode),
        selectedTier: candidate.selectedTier || 'micro',
        creatorSizes: candidate.creatorSizes || [],
        applicationDeadline: candidate.applicationDeadline || '',
        scriptDeadline: candidate.scriptDeadline || '',
        workDeadline: candidate.workDeadline || '',
        proofOfWorkDeadline: candidate.proofOfWorkDeadline || '',
        // Proof of work is always required — same as the step-by-step builder.
        proofOfWorkReq: candidate.proofOfWorkReq !== false,
        // Default to 'individual' so dates are not required until explicitly set to 'common'
        deadlineMode: candidate.deadlineMode === 'common' ? 'common' : 'individual',
        visitAtSiteEnabled: Boolean(candidate.visitAtSiteEnabled),
        visitAtSiteDescription: sanitizeText(candidate.visitAtSiteDescription || '', 1000),
        visitAtSiteDate: candidate.visitAtSiteDate || '',
        visitAtSiteTime: candidate.visitAtSiteTime || '',
    };
}

function buildCampaignPayloadFromAIDraft(draft: ExtractedData) {
    const totalBudget = toNumber(draft.totalBudget);
    const includePaidBudget = draft.budgetMode !== 'product';
    const normalizedNiche = normalizeNicheKey(draft.niche) || draft.niche;
    // Individual deadline mode = dates are set per creator while reviewing applications,
    // so none are sent at creation — identical to the step-by-step builder's payload.
    const individualDeadlines = draft.deadlineMode === 'individual';
    const deadlines = {
        applicationDeadline: individualDeadlines ? undefined : (draft.applicationDeadline || undefined),
        workDeadline: individualDeadlines ? undefined : (draft.workDeadline || undefined),
        proofOfWorkDeadline: individualDeadlines ? undefined : (draft.proofOfWorkDeadline || undefined),
        scriptDeadline: individualDeadlines ? undefined : (draft.scriptType === 'creator' ? (draft.scriptDeadline || undefined) : undefined),
    };

    return {
        basics: {
            campaignName: sanitizeText(draft.campaignName, 255),
            description: sanitizeText(draft.description, MAX_DESCRIPTION_LENGTH),
            type: draft.type || 'influencer',
            niche: sanitizeText(normalizedNiche, 100),
            visibility: draft.visibility || 'public',
            objective: sanitizeText(draft.objective, 100),
            location: sanitizeText(draft.location, 255),
        },
        deliverables: {
            industry: sanitizeText(normalizedNiche, 100),
            platform: draft.platform || 'instagram',
            contentTypes: Array.isArray(draft.contentType) && draft.contentType.length > 0 ? draft.contentType : ['reel'],
            postingType: draft.postingType || 'creator',
            usageRights: draft.postingType === 'brand' ? (draft.usageRights || '30d') : undefined,
            scriptType: draft.scriptType || 'creator',
            // Proof of work is always required — same as the step-by-step builder.
            proofOfWorkRequired: true,
            visitAtSite: draft.visitAtSiteEnabled
                ? {
                    enabled: true,
                    description: sanitizeText(draft.visitAtSiteDescription || '', 1000) || undefined,
                    date: draft.visitAtSiteDate || undefined,
                    time: draft.visitAtSiteTime || undefined,
                }
                : { enabled: false },
        },
        budget: {
            budgetMode: draft.budgetMode,
            totalBudget: includePaidBudget && totalBudget > 0 ? totalBudget : undefined,
            mixMode: Boolean(draft.mixMode),
            selectedTier: !draft.mixMode ? (draft.selectedTier || undefined) : undefined,
            creatorSizes: draft.mixMode ? draft.creatorSizes || [] : [],
            tierConfig: [],
            platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
            productDetails:
                draft.budgetMode === 'product' || draft.budgetMode === 'paid_product'
                    ? sanitizeText(draft.productDetails, MAX_TEXT_LENGTH)
                    : undefined,
            ...deadlines,
        },
        timeline: { ...deadlines },
        meta: {
            status: 'draft' as const,
            proofOfWorkReq: true,
            deadlineMode: draft.deadlineMode === 'individual' ? 'individual' : 'common',
        },
    };
}

function buildStrategy(draft: ExtractedData, brandName?: string): Strategy {
    const budget = toNumber(draft.totalBudget) || 150000;
    const platform = (draft.platform || 'instagram').toLowerCase();
    const niche = (draft.niche || 'general').toLowerCase();
    const objective = draft.objective || 'Awareness';
    const objectiveLower = objective.toLowerCase();
    const type = draft.type || 'influencer';
    const location = draft.location || 'Pan India';
    const scriptType = draft.scriptType || 'creator';
    const postingType = draft.postingType || 'creator';
    const budgetMode = draft.budgetMode || 'paid';
    const brand = brandName || 'Your brand';

    const reachLow = Math.max(60, Math.round(budget * 1.5 / 1000));
    const reachHigh = Math.max(110, Math.round(budget * 2.4 / 1000));

    // ── Platform × niche hooks ──────────────────────────────────
    const hookMap: Record<string, Record<string, string[]>> = {
        instagram: {
            beauty: [
                'POV: I finally found a skincare product that actually delivers',
                'I tested it for 7 days straight — here is the honest result',
                'This is the one step missing from your routine',
                'No filter, no edits. This is what it actually does.',
            ],
            food: [
                'I made this in under 10 minutes and it changed my meal prep',
                'Rating every flavour so you do not have to',
                'The taste test no one asked for but everyone needed',
                'This is how I actually use it every single day',
            ],
            fitness: [
                'My results after 30 days — completely unedited',
                'The switch that actually made a difference in my training',
                'What my coach never told me until I found this',
                'Week recap: the one product I kept coming back to',
            ],
            tech: [
                'I replaced my entire setup with this — here is what happened',
                'Real talk: is it actually worth the hype?',
                'One week honest review — the good, the bad, and the great',
                'Why I returned everything else after trying this',
            ],
            finance: [
                'The money move I wish I had made sooner',
                'Breaking down exactly how this works in real terms',
                'What they never tell you in the ads',
                'My actual numbers after using this for a full month',
            ],
            default: [
                'POV: The one change that actually upgraded my routine',
                'I tried this so you do not have to guess',
                'This is what nobody tells you before buying',
                '3-day challenge — here is what genuinely happened',
            ],
        },
        youtube: {
            beauty: [
                'Full routine breakdown using this product — 2-week honest review',
                'I ranked every product in the line. Here is the real order.',
                'Before and after: 14 days of consistent use',
                'Why this replaced my 3-step routine for good',
            ],
            food: [
                'I cooked every meal this week using this — full results',
                'Honest taste test: premium vs budget options',
                'Five ways I actually use this product in my kitchen',
                'What happens when you follow the instructions exactly',
            ],
            default: [
                'Full breakdown after 7 days of daily use',
                'Worth it or overhyped? My completely honest take',
                'What changed and what stayed the same after 2 weeks',
                "Beginner's guide — everything I wish I knew before starting",
            ],
        },
        twitter: {
            default: [
                'Thread: what I actually discovered after using this for a month',
                'Hot take: this solves one real problem nobody else is talking about',
                'Quick honest comparison with the alternatives on the market',
                'Why this matters right now — and what you should know',
            ],
        },
    };

    const platformHooks = hookMap[platform] || hookMap.instagram;
    const nicheKey = Object.keys(platformHooks).find((k) => niche.includes(k)) || 'default';
    const hooks = platformHooks[nicheKey] || (platformHooks.default as string[]);

    // ── Content format ideas ────────────────────────────────────
    const contentIdeasMap: Record<string, string[]> = {
        instagram: [
            'Reels-first with trending audio — keeps the discovery algorithm working for you',
            '"Day in my life" format that naturally features the product in context',
            'Side-by-side comparison with a well-known alternative for credibility',
            'Unboxing + first impressions in under 60 seconds for high retention',
        ],
        youtube: [
            'Long-form review (8–12 min) with clear timestamps to boost watch time',
            'YouTube Shorts cut from the full review for cross-platform reach',
            'Dedicated tutorial or how-to video showing real use cases',
            'Creator collab format for cross-audience exposure',
        ],
        twitter: [
            'Pinned thread with honest findings and a clear CTA to try it',
            'Poll tweet to spark engagement before dropping the full post',
            `Quote-tweet of a trending conversation in the ${niche} space`,
            'Behind-the-scenes hot take series spread across 3–4 days',
        ],
    };
    const contentIdeas = contentIdeasMap[platform] || contentIdeasMap.instagram;

    // ── Thesis ──────────────────────────────────────────────────
    const budgetModeLabel =
        budgetMode === 'paid' ? 'a direct-fee model' :
            budgetMode === 'product' ? 'a product-exchange model' :
                'a paid-plus-product hybrid';
    const scriptLabel = scriptType === 'brand' ? 'brand-scripted content' : 'creator-led authentic content';
    const postingLabel = postingType === 'brand' ? 'posted through the brand channel' : 'posted organically on creator profiles';

    const thesis = `${brand} is set up for a ${platform}-first ${type} campaign targeting ${niche} creators in ${location}. The objective — ${objectiveLower} — is achieved through ${scriptLabel}, ${postingLabel}, running on ${budgetModeLabel}. With ₹${Math.round(budget / 1000)}K in play, the recommended creator mix delivers a strong balance of trusted reach, authentic engagement, and audience relevance across the right tiers.`;

    // ── Why this approach ───────────────────────────────────────
    const whyMap: Record<string, string> = {
        awareness: `${platform.charAt(0).toUpperCase() + platform.slice(1)} is the strongest discovery channel for ${niche} content right now. Awareness campaigns work best when creators who already own the audience do the talking — which is exactly what this creator-first approach delivers. The ${location} focus keeps every impression relevant and seen by people who are likely to follow through.`,
        sales: `Sales-focused campaigns on ${platform} convert best when creators share authentic proof, not scripted pitches. This plan prioritises creators with high engagement rates in the ${niche} space, where purchase intent from creator recommendations consistently outperforms standard ads. ${location}-targeted reach reduces wasted spend on non-convertible audiences.`,
        engagement: `Engagement campaigns succeed when the content feels native to the platform. ${platform.charAt(0).toUpperCase() + platform.slice(1)}-first ${niche} creators have built communities that talk back — driving comments, saves, and shares rather than passive scrolls. The creator-led format here is specifically chosen to trigger that two-way response.`,
        default: `${platform.charAt(0).toUpperCase() + platform.slice(1)} is the right channel for ${niche} content right now, and this plan is built around formats that consistently outperform ads in this category. The combination of platform, niche, and location is well-matched to your ${objectiveLower} objective.`,
    };
    const whyKey = ['awareness', 'sales', 'engagement'].find((k) => objectiveLower.includes(k)) || 'default';
    const whyThisApproach = whyMap[whyKey];

    // ── Timeline using actual dates ─────────────────────────────
    const timeline: string[] = [];
    if (draft.applicationDeadline) {
        timeline.push(`Applications open now → Close ${draft.applicationDeadline} — creator sign-ups and selection`);
    } else {
        timeline.push('Week 1: Lock your creator shortlist and send out briefs');
    }
    if (scriptType !== 'brand') {
        if (draft.scriptDeadline) {
            timeline.push(`Script submissions due ${draft.scriptDeadline} — review and approve creator scripts`);
        } else {
            timeline.push('Week 2: Creators submit scripts — review, feedback, and approve');
        }
    }
    timeline.push('Content production phase: Creators shoot, edit, and prepare their posts');
    if (draft.workDeadline) {
        timeline.push(`Content goes live by ${draft.workDeadline} — phased posting for sustained feed presence`);
    } else {
        timeline.push('Final week: Phased posting schedule for sustained feed presence');
    }
    if (draft.proofOfWorkDeadline) {
        timeline.push(`Proof of work due by ${draft.proofOfWorkDeadline} — verify live links`);
    }
    timeline.push('Post-campaign: Track reach, engagement, and conversion metrics for 7 days');

    // ── Recommendations ─────────────────────────────────────────
    const recMap: Record<string, string[]> = {
        awareness: [
            'Prioritise creators with strong follower-to-engagement ratios over raw follower count',
            'Ask creators to use 1–2 branded hashtags consistently across all posts',
            'Schedule posts across 3–4 days for a sustained "wave" effect in the feed',
            'Repurpose top-performing creator content as paid ads to amplify reach further',
        ],
        sales: [
            'Give each creator a unique trackable discount code to measure direct conversions',
            'Brief creators to include one clear CTA — swipe up, link in bio, or promo code',
            'Lean into micro and nano creators — their audiences trust recommendations far more',
            'Follow up within 48 hours of each post with a brand Story or retargeting push',
        ],
        engagement: [
            'Ask creators to end their post with an open question to drive comment threads',
            `Time posts for peak hours in ${location} — typically 7–9 PM local time`,
            'Seed the first few comments from the brand account within 30 minutes of posting',
            'Use polls, sliders, or quiz stickers in Stories to extend the engagement window',
        ],
        default: [
            'Keep the creator brief focused — one clear message and one clear call to action',
            'Give creators creative freedom within the brief; authentic content always outperforms scripted',
            'Review all content at least 24 hours before posting for any compliance or brand issues',
            'Track results weekly and reallocate budget toward top performers if early data allows',
        ],
    };
    const recKey = ['awareness', 'sales', 'engagement'].find((k) => objectiveLower.includes(k)) || 'default';
    const recommendations = recMap[recKey];

    // ── Creator brief ───────────────────────────────────────────
    const creatorBrief = `You have been selected for the ${brand} campaign on ${platform.charAt(0).toUpperCase() + platform.slice(1)}. We are running a ${objectiveLower} campaign in the ${niche} space targeting ${location}. Create ${scriptLabel} that feels genuinely natural to your audience — we want your real take, not a scripted ad. Showcase the product in your own environment and style. Post ${postingLabel}. Tag the brand, use the provided campaign hashtag, and include the link in your bio or post caption. Keep it honest, keep it you.`;

    return {
        thesis,
        whyThisApproach,
        hooks,
        contentIdeas,
        reachLow,
        reachHigh,
        engageLow: Number((reachLow * 0.07).toFixed(1)),
        engageHigh: Number((reachHigh * 0.09).toFixed(1)),
        clicksLow: Number((reachLow * 0.012).toFixed(1)),
        clicksHigh: Number((reachHigh * 0.02).toFixed(1)),
        confidenceLabel: budget >= 200000 ? 'Medium-High' : 'Medium',
        confidencePct: budget >= 200000 ? 89 : 78,
        timeline,
        recommendations,
        creatorBrief,
    };
}

function estimateMix(budget: number): { tier: string; count: number; spend: number; range: string; why: string }[] {
    if (budget >= 400000) {
        return [
            { tier: 'Macro', count: 2, spend: Math.round(budget * 0.35), range: '200K-500K', why: 'Reach anchors' },
            { tier: 'Micro', count: 8, spend: Math.round(budget * 0.4), range: '10K-100K', why: 'Engagement core' },
            { tier: 'Nano', count: 10, spend: Math.round(budget * 0.18), range: '5K-30K', why: 'Conversion proof' },
        ];
    }

    return [
        { tier: 'Macro', count: 1, spend: Math.round(budget * 0.3), range: '100K-500K', why: 'Trust anchor' },
        { tier: 'Micro', count: 6, spend: Math.round(budget * 0.45), range: '10K-100K', why: 'Balanced reach' },
        { tier: 'Nano', count: 8, spend: Math.round(budget * 0.2), range: '5K-30K', why: 'Authenticity' },
    ];
}

export default function AIStrategistChat({
    isEdit = false,
    isLive = false,
    campaignId,
    initialData,
    existingThumbnailUrl,
    existingScriptFileKey,
}: {
    isEdit?: boolean;
    isLive?: boolean;
    campaignId?: string;
    initialData?: Partial<ExtractedData>;
    existingThumbnailUrl?: string;
    existingScriptFileKey?: string;
}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);

    const [stage, setStage] = useState<Stage>('step1');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [promptText, setPromptText] = useState('');
    const [assistantReply, setAssistantReply] = useState('');
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
    const [step2Extra, setStep2Extra] = useState('');

    const [candidateDraft, setCandidateDraft] = useState<Partial<ExtractedData> | null>(null);
    const [finalDraft, setFinalDraft] = useState<ExtractedData | null>(null);
    const [strategy, setStrategy] = useState<Strategy | null>(null);
    // Real progress phases for the step3 screen — each flips true only when the corresponding
    // network call actually settles, instead of being shown as complete on render (see the old
    // step3 UI, which checked off 4 of 5 steps instantly regardless of real backend state).
    const [buildPhase, setBuildPhase] = useState({ context: false, shortlist: false, strategy: false });

    const [shortlist, setShortlist] = useState<CreatorShortlistRow[]>([]);
    const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
    const [refineMessage, setRefineMessage] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [removedExistingThumbnail, setRemovedExistingThumbnail] = useState(false);
    const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
    const [scriptFile, setScriptFile] = useState<File | null>(null);

    const [showInfluencerPicker, setShowInfluencerPicker] = useState(false);
    const [influencerPool, setInfluencerPool] = useState<CreatorShortlistRow[]>([]);
    const [isInfluencerPoolLoading, setIsInfluencerPoolLoading] = useState(false);
    const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historySessionId, setHistorySessionId] = useState<string | null>(null);

    const [isLoadingSession, setIsLoadingSession] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isConversational, setIsConversational] = useState(false);
    const [questionFlowMode, setQuestionFlowMode] = useState<QuestionFlowMode>('auto');
    const [hasBuiltStrategy, setHasBuiltStrategy] = useState(false);
    // The brief is complete and the recap has been posted, but the user has NOT been moved on
    // yet. Previously the recap and setStage('step2') were dispatched in the same React batch,
    // so the view switched before the summary could be read — it only became visible if the
    // user navigated back. The move to step 2 is now an explicit click.
    const [awaitingSummaryContinue, setAwaitingSummaryContinue] = useState(false);

    const createCampaign = useCreateCampaign();
    const updateCampaign = useUpdateCampaign();
    const launchCampaign = useLaunchCampaign();
    const uploadThumbnail = useUploadThumbnail();
    const uploadScript = useUploadScript();
    const { data: sessions } = useAIChatSessions();
    const { data: historySession, isLoading: isHistoryLoading } = useAIChatSessionDetail(historySessionId);
    const deleteChatSession = useDeleteAIChatSession();

    const mountedRef = useRef(true);
    const hydratedCampaignRef = useRef<string | null>(null);
    const hasRestoredMatchingCampaign = useRef(false);
    const createdCampaignIdRef = useRef<string | null>(null);
    const launchInFlightRef = useRef(false);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const promptInputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow the prompt textarea with a hard cap, and shrink it back down when the
    // text is cleared (after send / start-over / sample-prompt swap). Driven by state
    // instead of the onChange event so every code path that sets promptText resizes it.
    useEffect(() => {
        const el = promptInputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const capped = Math.min(el.scrollHeight, 200);
        el.style.height = `${capped}px`;
        el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
    }, [promptText]);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);



    // Auto-scroll to bottom whenever new messages arrive or the thinking indicator appears
    // Uses smooth behavior so it feels like ChatGPT — messages scroll into view naturally.
    useEffect(() => {
        if (stage !== 'step1') return;
        const el = messagesContainerRef.current;
        if (!el) return;
        // requestAnimationFrame ensures the DOM has painted the new message before scrolling
        requestAnimationFrame(() => {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
    }, [messages, isThinking, stage]);

    // Restore state from local storage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('mutiny_ai_strategist_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only treat stored draft/strategy data as valid if it belongs to the current campaign
                const storedCampaignId = parsed.persistedCampaignId ?? null;
                const isSameCampaign = campaignId ? storedCampaignId === campaignId : !storedCampaignId;

                // Restore persistent data, but NOT transient UI states (stage, isThinking)
                // Session/message history is also campaign-specific — only restore when matching
                if (isSameCampaign) {
                    if (parsed.sessionId !== undefined) setSessionId(parsed.sessionId);
                    if (parsed.messages) setMessages(parsed.messages);
                    if (parsed.promptText !== undefined) setPromptText(parsed.promptText);
                    if (parsed.assistantReply !== undefined) setAssistantReply(parsed.assistantReply);
                    if (parsed.questionAnswers) setQuestionAnswers(parsed.questionAnswers);
                    if (parsed.step2Extra !== undefined) setStep2Extra(parsed.step2Extra);
                }
                // Only restore campaign-specific draft data when the stored campaign matches
                if (isSameCampaign) {
                    if (parsed.candidateDraft !== undefined) setCandidateDraft(parsed.candidateDraft);
                    if (parsed.finalDraft !== undefined) setFinalDraft(parsed.finalDraft);
                    const inferredBuilt = parsed.hasBuiltStrategy !== undefined
                        ? Boolean(parsed.hasBuiltStrategy)
                        : Boolean(parsed.strategy && parsed.finalDraft);
                    setHasBuiltStrategy(inferredBuilt);
                    if (parsed.strategy !== undefined) {
                        const shouldRestoreStrategy = Boolean(campaignId) || inferredBuilt;
                        if (shouldRestoreStrategy) setStrategy(parsed.strategy);
                    }
                    if (parsed.shortlist) setShortlist(parsed.shortlist);
                    if (parsed.selectedCreatorIds) setSelectedCreatorIds(new Set(parsed.selectedCreatorIds));
                    if (parsed.refineMessage !== undefined) setRefineMessage(parsed.refineMessage);
                    if (parsed.influencerPool) setInfluencerPool(parsed.influencerPool);
                    if (parsed.pickerSelectedIds) setPickerSelectedIds(new Set(parsed.pickerSelectedIds));
                    if (parsed.showInfluencerPicker !== undefined) setShowInfluencerPicker(parsed.showInfluencerPicker);
                    // Mark that we restored matching data so the hydration effect can preserve dates
                    if (parsed.candidateDraft) hasRestoredMatchingCampaign.current = true;
                }
                if (parsed.isConversational !== undefined) setIsConversational(parsed.isConversational);
                if (parsed.questionFlowMode !== undefined) setQuestionFlowMode(parsed.questionFlowMode);

                // Determine initial stage based on what data exists (only when campaign matches)
                if (isSameCampaign) {
                    const inferredBuilt = parsed.hasBuiltStrategy !== undefined
                        ? Boolean(parsed.hasBuiltStrategy)
                        : Boolean(parsed.strategy && parsed.finalDraft);
                    if (parsed.finalDraft && parsed.strategy && inferredBuilt) {
                        setStage('step4');
                    } else if (parsed.candidateDraft) {
                        setStage('step2');
                    } else if (parsed.sessionId) {
                        setStage('step1');
                    }
                }
            }

            getFileFromDB('mutiny_ai_cover_file').then((f) => {
                if (f && mountedRef.current) setCoverFile(f);
            });
            getFileFromDB('mutiny_ai_script_file').then((f) => {
                if (f && mountedRef.current) setScriptFile(f);
            });
        } catch (e) {
            console.error('Failed to restore AI Strategist state', e);
        }
    }, []);

    // Hydrate from campaign data when editing or viewing a live campaign.
    // For live campaigns, always auto-advance to step4 (strategy view).
    // For draft edits, preserve user-entered dates from localStorage if present.
    useEffect(() => {
        if (!(isEdit || isLive) || !initialData || !campaignId) return;
        if (hydratedCampaignRef.current === campaignId) return;
        hydratedCampaignRef.current = campaignId;

        if (isLive) {
            const hydrated = hydrateDraft(initialData);
            setCandidateDraft(initialData);
            setFinalDraft((prev) => prev || hydrated);
            setStrategy((prev) => prev || buildStrategy(hydrated, user?.brandName));
            setStage('step4');
            return;
        }

        if (hasRestoredMatchingCampaign.current) {
            // Merge: keep the user's locally-entered dates, refresh everything else from server
            setCandidateDraft((prev) => ({
                ...initialData,
                applicationDeadline: prev?.applicationDeadline || (initialData as any).applicationDeadline || '',
                scriptDeadline: prev?.scriptDeadline || (initialData as any).scriptDeadline || '',
                workDeadline: prev?.workDeadline || (initialData as any).workDeadline || '',
                proofOfWorkDeadline: prev?.proofOfWorkDeadline || (initialData as any).proofOfWorkDeadline || '',
            }));
            // Stage already set by localStorage restore — don't override it
        } else {
            // Fresh hydration: no matching localStorage data for this campaign
            setCandidateDraft(initialData);
            setFinalDraft(hydrateDraft(initialData));
            setStage('step2');
        }
    }, [isEdit, isLive, initialData, campaignId, user?.brandName]);

    useEffect(() => {
        saveFileToDB('mutiny_ai_cover_file', coverFile);
    }, [coverFile]);

    useEffect(() => {
        saveFileToDB('mutiny_ai_script_file', scriptFile);
    }, [scriptFile]);

    useEffect(() => {
        if (stage !== 'step3') return;

        const timer = setTimeout(() => {
            if (!mountedRef.current) return;
            if (finalDraft && strategy) {
                setStage('step4');
                setIsThinking(false);
                toast.success('Strategy ready! Your campaign is optimized and ready to launch.');
            } else {
                setStage('step2');
                setIsThinking(false);
                toast.error('This is taking longer than expected. Please try building again.');
            }
        }, 35000);

        return () => clearTimeout(timer);
    }, [stage, finalDraft, strategy]);

    // Save state to local storage on change (persist only data, not transient UI states)
    useEffect(() => {
        try {
            const stateToSave = {
                persistedCampaignId: campaignId ?? null,
                sessionId,
                messages,
                promptText,
                assistantReply,
                questionAnswers,
                step2Extra,
                candidateDraft,
                finalDraft,
                strategy,
                shortlist,
                selectedCreatorIds: Array.from(selectedCreatorIds),
                refineMessage,
                influencerPool,
                pickerSelectedIds: Array.from(pickerSelectedIds),
                showInfluencerPicker,
                isConversational,
                questionFlowMode,
                hasBuiltStrategy,
            };
            localStorage.setItem('mutiny_ai_strategist_state', JSON.stringify(stateToSave));
        } catch (e) {
            console.error('Failed to save AI Strategist state', e);
        }
    }, [
        campaignId, sessionId, messages, promptText, assistantReply, questionAnswers, step2Extra,
        candidateDraft, finalDraft, strategy, shortlist, selectedCreatorIds, refineMessage,
        influencerPool, pickerSelectedIds, showInfluencerPicker, isConversational, questionFlowMode, hasBuiltStrategy
    ]);

    useEffect(() => {
        if (candidateDraft?.scriptType !== 'brand') {
            setScriptFile(null);
        }
    }, [candidateDraft?.scriptType]);

    // When entering Step 2, auto-initialize fields that have visual defaults in the UI
    // and auto-generate a campaign name if the user hasn't set one yet.
    // This prevents the "Missing Required Fields" block from flagging fields the user
    // can clearly see are already set to a sensible default.
    useEffect(() => {
        if (stage !== 'step2') return;
        setCandidateDraft((prev) => {
            if (!prev) return prev;
            const needsUpdate =
                !prev.postingType || !prev.scriptType || !prev.budgetMode ||
                !prev.visibility || !prev.campaignName || !prev.deadlineMode || prev.proofOfWorkReq !== true;
            if (!needsUpdate) return prev;
            return {
                ...prev,
                postingType: prev.postingType || 'creator',
                scriptType: prev.scriptType || 'creator',
                budgetMode: prev.budgetMode || 'paid',
                visibility: prev.visibility || 'public',
                // Default to 'individual' so no dates are required until explicitly changed
                deadlineMode: prev.deadlineMode || 'individual',
                // Proof of work is always required — same as the step-by-step builder.
                proofOfWorkReq: true,
                // Auto-generate a campaign name so the FieldPanel dot turns green
                campaignName: prev.campaignName || generateCampaignName(prev, user?.brandName),
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);

    useEffect(() => {
        if (!coverFile) {
            setCoverPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(coverFile);
        setCoverPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [coverFile]);

    const mergedCandidate = useMemo(
        () => applyQuestionAnswers(candidateDraft || {}, questionAnswers),
        [candidateDraft, questionAnswers]
    );
    const extractionRows = useMemo(() => buildExtractionRows(candidateDraft || {}), [candidateDraft]);
    // In step4, use finalDraft (fully AI-built, has suggestedName etc.)
    // In all earlier steps, use mergedCandidate so live step2 edits are reflected immediately.
    const fieldSummary = useMemo(
        () => buildFieldSummary(stage === 'step4' ? (finalDraft || mergedCandidate) : mergedCandidate),
        [stage, finalDraft, mergedCandidate]
    );
    const fieldSummaryRows = useMemo(() => {
        if (stage === 'step1') {
            return fieldSummary.filter((row) => row.label !== 'Posting type');
        }
        return fieldSummary;
    }, [fieldSummary, stage]);
    // Derived from candidateDraft, NOT mergedCandidate: mergedCandidate folds in the in-progress
    // questionAnswers, so typing the first digit of a budget made that question "answered",
    // swapped the batch, unmounted the <input> mid-keystroke and let its onBlur auto-submit the
    // single digit (a ₹5 budget). The batch must stay stable until an answer is committed.
    // Computed from the user's own messages, never from the model-filled draft.
    const hasUserBrief = useMemo(() => hasSubstantiveBrief(messages), [messages]);
    const questions = useMemo(() => buildQuestions(candidateDraft || {}, assistantReply, user, hasUserBrief), [candidateDraft, assistantReply, user, hasUserBrief]);

    const { tiers, tierCosts } = useTierConfig();

    const reachEstimates = useMemo(() => {
        const budget = toNumber(mergedCandidate.totalBudget) || 0;
        const feeMultiplier = 1.1;
        return tiers.map(t => {
            const minCost = t.suggestedPrice.minimum;
            const count = budget > 0 ? Math.floor(budget / (minCost * feeMultiplier)) : 0;
            return { ...t, estCount: count };
        }).filter(t => t.estCount > 0);
    }, [tiers, mergedCandidate.totalBudget]);

    const mix = useMemo(() => {
        if (strategy?.creatorMix && strategy.creatorMix.length > 0) return strategy.creatorMix;
        const budget = toNumber(finalDraft?.totalBudget);
        return estimateMix(budget || 150000);
    }, [strategy, finalDraft]);

    const chatTranscript = useMemo(
        () => messages.map((m) => ({ ...m, content: m.role === 'assistant' ? cleanForDisplay(m.content) : m.content })),
        [messages]
    );

    const selectedSpend = useMemo(() => {
        return shortlist.reduce((sum, item) => sum + (selectedCreatorIds.has(item.id) ? item.fee : 0), 0);
    }, [shortlist, selectedCreatorIds]);

    const suggestions = useMemo(() => buildSuggestions(candidateDraft, assistantReply, user), [candidateDraft, assistantReply, user]);
    const missingFields = useMemo(() => getMissingFields(mergedCandidate), [mergedCandidate]);

    const stepLabels = ['Prompt', 'Details', 'Building', 'Strategy'] as const;
    const activeStepIndex = stage === 'step1' ? 0 : stage === 'step2' ? 1 : stage === 'step3' ? 2 : 3;

    const StepHeader = () => (
        <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-3">
                {stage !== 'step2' && (
                    <div>
                        <h2 className="text-2xl font-bold mt-1">{stepLabels[activeStepIndex]}</h2>
                    </div>
                )}
            </div>
        </div>
    );

    const filledCount = fieldSummaryRows.filter((r) => r.ok).length;
    const totalFields = fieldSummaryRows.length;

    const FieldPanel = () => (
        <div className="bg-card border border-border rounded-2xl flex flex-col shadow-sm overflow-hidden">
            <div className="px-3 pt-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold">Campaign Fields</h3>
                    <span className="text-[10px] font-semibold text-[#0a0a0a] bg-[#fedc03]/15 px-1.5 py-0.5 rounded-full">{filledCount}/{totalFields}</span>
                </div>
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#fedc03] rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((filledCount / totalFields) * 100)}%` }}
                    />
                </div>
            </div>
            <div className="p-2 space-y-0 flex-1 overflow-y-auto">
                {fieldSummaryRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-1 px-1 py-1 rounded-lg hover:bg-secondary/50 transition-colors">
                        <span className="text-[11px] text-muted-foreground">{row.label}</span>
                        <div className="flex items-center gap-1 min-w-0">
                            {row.ok ? (
                                <span className="text-[11px] font-medium text-foreground truncate max-w-[80px]">{row.value}</span>
                            ) : (
                                <span className="text-[11px] text-muted-foreground/50">—</span>
                            )}
                            <span className={cn('w-1 h-1 rounded-full shrink-0', row.ok ? 'bg-emerald-500' : 'bg-amber-500/60')} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Real-time Reach Estimates */}
            {reachEstimates.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border bg-secondary/10 px-3 pb-3">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Live Reach Estimate</p>
                    <div className="space-y-1.5">
                        {reachEstimates.map(est => (
                            <div key={est.tier} className="flex items-center justify-between p-1.5 rounded-lg bg-card border border-border/50 shadow-sm">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-lg bg-secondary flex items-center justify-center text-[8px] font-bold">
                                        {est.label[0]}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold leading-tight">{est.label}</p>
                                        <p className="text-[8px] text-muted-foreground">{est.range}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] font-black leading-tight text-emerald-600">~{est.estCount}</p>
                                    <p className="text-[7px] font-bold uppercase tracking-tighter text-muted-foreground/60">Creators</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [chatTranscript, isThinking]);

    const ChatBubble = ({ role, content }: { role: 'user' | 'assistant'; content: string }) => (
        <div className={cn('flex w-full gap-3 px-4 py-1', role === 'user' ? 'justify-end' : 'justify-start')}>
            {role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#fedc03] text-black flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 shadow">
                    M
                </div>
            )}
            <div
                className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    role === 'user'
                        ? 'bg-[#fedc03] text-black font-medium rounded-br-sm'
                        : 'bg-card border border-border text-foreground rounded-bl-sm shadow-sm'
                )}
            >
                {role === 'assistant' ? (
                    <div className="space-y-2">
                        <span dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(content) }} />
                    </div>
                ) : (
                    <span>{content}</span>
                )}
            </div>
            {role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 uppercase">
                    {user?.name?.[0] ?? 'U'}
                </div>
            )}
        </div>
    );

    const loadRealShortlist = async (draft: ExtractedData) => {
        if (draft.visibility !== 'private') {
            setShortlist([]);
            setSelectedCreatorIds(new Set());
            return;
        }
        try {
            const budget = toNumber(draft.totalBudget) || 150000;
            const params: Record<string, unknown> = { limit: 12 };

            // Niche filter — normalize and map to Discover labels for better matching
            const normalizedNiche = normalizeNicheKey(draft.niche);
            const discoverNiche = mapNicheToDiscoverLabel(normalizedNiche || draft.niche, draft.type);
            if (discoverNiche && discoverNiche.toLowerCase() !== 'all') {
                params.niche = discoverNiche;
            }

            // Determine platform: twitter-type campaigns always target twitter;
            // meme campaigns default to instagram if no platform set
            let effectivePlatform = draft.platform;
            if (draft.type === 'twitter') effectivePlatform = 'twitter';
            else if (!effectivePlatform && draft.type === 'meme') effectivePlatform = 'instagram';
            if (effectivePlatform && effectivePlatform !== 'other') params.platform = effectivePlatform;

            // Location filter — skip broad pan-india searches
            if (draft.location && draft.location.toLowerCase() !== 'pan india') {
                params.location = draft.location;
            }

            // Pass all tiers from the budget mix instead of a single selected tier
            const mixTiers = estimateMix(budget).map((m) => m.tier.toLowerCase());
            if (mixTiers.length > 0) params.tier = mixTiers;

            const fetchInfluencers = async (searchParams: Record<string, unknown>) => {
                const { data } = await http.get(API.discover.search, { params: searchParams });
                return (data?.data?.influencers ?? data?.data ?? []) as Array<Record<string, unknown>>;
            };

            let list = await fetchInfluencers(params);
            if (list.length === 0 && params.location) {
                const relaxed = { ...params };
                delete relaxed.location;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.niche) {
                const relaxed = { ...params };
                delete relaxed.niche;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.tier) {
                const relaxed = { ...params };
                delete relaxed.tier;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.platform) {
                const relaxed = { ...params };
                delete relaxed.platform;
                list = await fetchInfluencers(relaxed);
            }

            const mapped = mapInfluencers(list.slice(0, 10), draft, effectivePlatform, tiers);

            if (mapped.length === 0) {
                if (mountedRef.current) {
                    setShortlist([]);
                    setSelectedCreatorIds(new Set());
                }
                toast.info('No creators found for this brief yet. Try adjusting niche, city, or budget.');
                return;
            }

            if (mountedRef.current) {
                setShortlist(mapped);
                setSelectedCreatorIds(new Set(mapped.map((m) => m.id)));
            }
        } catch {
            if (mountedRef.current) {
                setShortlist([]);
                setSelectedCreatorIds(new Set());
            }
            toast.error('Unable to load creators from live data.');
        }
    };

    const loadInfluencerPool = async (draft: ExtractedData) => {
        setIsInfluencerPoolLoading(true);
        try {
            const budget = toNumber(draft.totalBudget) || 150000;
            const params: Record<string, unknown> = { limit: 24 };

            const normalizedNiche = normalizeNicheKey(draft.niche);
            const discoverNiche = mapNicheToDiscoverLabel(normalizedNiche || draft.niche, draft.type);
            if (discoverNiche && discoverNiche.toLowerCase() !== 'all') {
                params.niche = discoverNiche;
            }

            let effectivePlatform = draft.platform;
            if (draft.type === 'twitter') effectivePlatform = 'twitter';
            else if (!effectivePlatform && draft.type === 'meme') effectivePlatform = 'instagram';
            if (effectivePlatform && effectivePlatform !== 'other') params.platform = effectivePlatform;

            if (draft.location && draft.location.toLowerCase() !== 'pan india') {
                params.location = draft.location;
            }

            const mixTiers = estimateMix(budget).map((m) => m.tier.toLowerCase());
            if (mixTiers.length > 0) params.tier = mixTiers;

            const fetchInfluencers = async (searchParams: Record<string, unknown>) => {
                const { data } = await http.get(API.discover.search, { params: searchParams });
                return (data?.data?.influencers ?? data?.data ?? []) as Array<Record<string, unknown>>;
            };

            let list = await fetchInfluencers(params);
            if (list.length === 0 && params.location) {
                const relaxed = { ...params };
                delete relaxed.location;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.niche) {
                const relaxed = { ...params };
                delete relaxed.niche;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.tier) {
                const relaxed = { ...params };
                delete relaxed.tier;
                list = await fetchInfluencers(relaxed);
            }
            if (list.length === 0 && params.platform) {
                const relaxed = { ...params };
                delete relaxed.platform;
                list = await fetchInfluencers(relaxed);
            }

            const mapped = mapInfluencers(list, draft, effectivePlatform || 'instagram', tiers);

            if (mountedRef.current) {
                setInfluencerPool(mapped);
            }
        } catch {
            if (mountedRef.current) {
                setInfluencerPool([]);
            }
            toast.error('Unable to load creators from live data.');
        } finally {
            if (mountedRef.current) setIsInfluencerPoolLoading(false);
        }
    };

    const isConsentYes = (value: string): boolean => {
        const normalized = value.trim().toLowerCase();
        return /^(yes|y|yeah|yep|sure|ok|okay|continue|proceed|go ahead|looks good|build it)\b/.test(normalized);
    };

    const isConsentNo = (value: string): boolean => {
        const normalized = value.trim().toLowerCase();
        return /^(no|n|change|edit|modify|not yet|wait|hold on)\b/.test(normalized);
    };

    const injectDraftDefaults = (draft: Partial<ExtractedData>): Partial<ExtractedData> => {
        // We no longer set hardcoded defaults here to ensure everything is driven by the prompt or user input.
        // Campaign name and location are left explicitly controlled by the user.
        return draft;
    };

    const applyConsentChoice = (approved: boolean) => {
        if (!candidateDraft) return;

        if (approved) {
            const mergedDraft = injectDraftDefaults(applyQuestionAnswers(candidateDraft, questionAnswers));
            const missing = getMissingFields(mergedDraft);
            const chatQuestions = buildQuestions(mergedDraft, assistantReply, user, hasSubstantiveBrief(messages));
            setQuestionFlowMode('auto');
            if (chatQuestions.length > 0) {
                const ack = 'Perfect. Answer these quick options and I will refine the brief.';
                setAssistantReply(ack);
                setMessages((prev) => [...prev, { role: 'user', content: 'Yes' }, { role: 'assistant', content: ack }]);
                return;
            }

            const ack = buildChatFinalSummary(mergedDraft, missing.filter((l) => FORM_ONLY_FIELD_LABELS.has(l)));
            setCandidateDraft(mergedDraft);
            setFinalDraft(hydrateDraft(mergedDraft));
            setIsConversational(false);
            setAssistantReply(ack);
            setMessages((prev) => [...prev, { role: 'user', content: 'Yes' }, { role: 'assistant', content: ack }]);
            setStage('step2');
            return;
        }

        setQuestionFlowMode('manual-edit');
        const ack = 'Sure. Tell me what you want to change, and I will update the brief first.';
        setAssistantReply(ack);
        setMessages((prev) => [...prev, { role: 'user', content: 'No' }, { role: 'assistant', content: ack }]);
    };

    const handleStartOver = () => {
        setStage('step1');
        setAwaitingSummaryContinue(false);
        setSessionId(null);
        setMessages([]);
        setPromptText('');
        setAssistantReply('');
        setQuestionAnswers({});
        setStep2Extra('');
        setCandidateDraft(null);
        setFinalDraft(null);
        setStrategy(null);
        setShortlist([]);
        setSelectedCreatorIds(new Set());
        setRefineMessage('');
        setInfluencerPool([]);
        setPickerSelectedIds(new Set());
        setShowInfluencerPicker(false);
        setIsConversational(false);
        setQuestionFlowMode('auto');
        setHasBuiltStrategy(false);
        try {
            localStorage.removeItem('mutiny_ai_strategist_state');
            localStorage.removeItem('mutiny:campaign-builder:draft');
            saveFileToDB('mutiny_ai_cover_file', null);
            saveFileToDB('mutiny_ai_script_file', null);
        } catch (e) { }
    };

    const handleContinueWithAvailableDetails = () => {
        const sourceDraft = candidateDraft || extractKnownFromPrompt(promptText, {
            city: user?.city,
            industry: user?.industry,
            brandName: user?.brandName,
        });

        const mergedDraft = injectDraftDefaults(applyQuestionAnswers(sourceDraft, questionAnswers));
        const hydrated = hydrateDraft(mergedDraft);

        setCandidateDraft(mergedDraft);
        setFinalDraft(hydrated);
        setStrategy(buildStrategy(hydrated, user?.brandName));
        setIsConversational(false);
        setQuestionFlowMode('auto');
        setStage('step2');
    };

    const buildQuestionAck = (question: FollowUpQuestion, answer: string, nextMissing: string[]): string => {
        const label = question.field === 'totalBudget'
            ? 'budget'
            : question.field === 'budgetMode'
                ? 'budget mode'
                : question.field === 'scriptType'
                    ? 'script preference'
                    : question.field === 'postingType'
                        ? 'posting preference'
                        : question.field === 'niche'
                            ? 'niche'
                            : question.field === 'location'
                                ? 'location'
                                : question.field === 'platform'
                                    ? 'platform'
                                    : question.field === 'type'
                                        ? 'campaign type'
                                        : question.field === 'objective'
                                            ? 'objective'
                                            : question.field || 'detail';

        const value = answer.trim();
        const answerText = question.id === 'budget'
            ? `₹${fmtINR(parseBudgetValue(value)).replace('₹', '')}`
            : titleCase(value || 'noted');

        if (nextMissing.length === 0) {
            return `Thanks — I’ve noted your ${label} as ${answerText}. That’s all I need right now; I’ll move this into details.`;
        }

        return `Nice — I’ve noted your ${label} as ${answerText}. Could you tell me the ${nextMissing[0].toLowerCase()} next?`;
    };

    // Called automatically when every question in the current batch gets an answer.
    // Sends the answers as a user message, lets the AI respond (or emit CAMPAIGN_READY).
    const handleAutoSubmitQA = async (answers: Record<string, string>, currentQuestions: FollowUpQuestion[]) => {
        if (isThinking) return;

        const parts = currentQuestions
            .filter((q) => !!answers[q.id])
            .map((q) => {
                const val = answers[q.id];
                if (q.id === 'budget') return `Budget: ₹${Number(parseBudgetValue(val)).toLocaleString('en-IN')}`;
                return `${q.field ? q.field.charAt(0).toUpperCase() + q.field.slice(1) : q.id}: ${val}`;
            });
        const userMessage = parts.join(' · ');

        const mergedCandidate = injectDraftDefaults(applyQuestionAnswers(candidateDraft || {}, answers));
        setCandidateDraft(mergedCandidate);
        setQuestionAnswers({});

        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
        setMessages(nextMessages);
        const missing = getMissingFields(mergedCandidate);
        // Dates/visit details are collected in the step-2 form, never in chat — once only
        // those remain, the conversation is done and we close with a full recap instead of
        // asking the user for something the chat has no input for.
        const chatMissing = getChatAskableMissing(missing);

        if (chatMissing.length === 0) {
            const summary = buildChatFinalSummary(mergedCandidate, missing.filter((l) => FORM_ONLY_FIELD_LABELS.has(l)));
            setAssistantReply(summary);
            setMessages([...nextMessages, { role: 'assistant', content: summary }]);
            const hydrated = hydrateDraft(mergedCandidate);
            setFinalDraft(hydrated);
            setStrategy(buildStrategy(hydrated, user?.brandName));
            setIsConversational(false);
            setQuestionFlowMode('auto');
            setAwaitingSummaryContinue(true);
        } else {
            const question = currentQuestions[0];
            const ack = question ? buildQuestionAck(question, answers[question.id] || '', chatMissing) : 'Got it.';
            setAssistantReply(ack);
            setMessages([...nextMessages, { role: 'assistant', content: ack }]);
            setQuestionFlowMode('auto');
        }
    };

    const sendToAI = async (nextMessages: ChatMessage[]): Promise<ServerChatResult> => {
        const { data } = await http.post(API.ai.chat, {
            messages: nextMessages,
            brandName: user?.brandName,
            brandIndustry: user?.industry,
            sessionId,
        });

        const response: string = data.data.response;
        const returnedSessionId: string = data.data.sessionId;
        const draft: Partial<ExtractedData> = data.data.draft || {};
        const ready: boolean = Boolean(data.data.ready);

        if (!sessionId) {
            setSessionId(returnedSessionId);
            queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
            // Link to campaign immediately so history is visible regardless of whether launch completes
            if (campaignId) {
                http.patch(API.ai.chatSessions.linkCampaign(returnedSessionId), { campaignId }).catch(() => { });
            }
        }

        return { response, draft, ready };
    };

    // Numbers (reach/engagement/confidence/creator fees) are computed server-side from real
    // tier pricing and real platform engagement data — never invented here. The LLM only
    // writes the narrative (thesis/hooks/etc), and the backend labels which path produced it
    // (`generatedBy: 'ai' | 'fallback'`) so the UI can be honest about provenance either way.
    const fetchAIStrategy = async (draft: ExtractedData): Promise<{ strategy: Strategy; generatedBy: 'ai' | 'fallback' }> => {
        // With individual deadlines there are no campaign dates yet — the strategy endpoint
        // still needs a timeline horizon for its projections, so fall back to the standard
        // 7/12/19-day offsets. These are never written to the campaign itself.
        const applicationDeadline = draft.applicationDeadline || defaultFutureDate(7);
        const { data } = await http.post(API.ai.strategy, {
            brandName: user?.brandName,
            draft: {
                campaignName: draft.campaignName,
                description: draft.description,
                type: draft.type,
                platform: draft.platform,
                niche: draft.niche,
                objective: draft.objective,
                location: draft.location || 'Pan India',
                scriptType: draft.scriptType,
                postingType: draft.postingType,
                budgetMode: draft.budgetMode,
                totalBudget: toNumber(draft.totalBudget) || 150000,
                applicationDeadline,
                scriptDeadline: draft.scriptDeadline || applicationDeadline,
                workDeadline: draft.workDeadline || defaultFutureDate(19),
            },
        });
        return { strategy: data.data.strategy as Strategy, generatedBy: data.data.generatedBy };
    };

    const handleStep1Continue = async () => {
        const text = promptText.trim();
        if (!text) {
            toast.error('Please add your campaign prompt first.');
            return;
        }

        // The user chose to keep talking rather than click through; the previous recap (and its
        // continue button) no longer reflects the conversation.
        setAwaitingSummaryContinue(false);

        if (questionFlowMode === 'awaiting-consent' && candidateDraft) {
            setPromptText('');
            if (isConsentYes(text)) {
                applyConsentChoice(true);
                return;
            }
            if (isConsentNo(text)) {
                applyConsentChoice(false);
                return;
            }
            setQuestionFlowMode('manual-edit');
        }

        // Decide whether this is a short/general conversational input
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const isGreeting = /^(hi|hello|hey|hii|hey there)\b/i.test(text);
        const isShortGeneral = wordCount < 15 || text.length < 80 || isGreeting;

        // If casual / short input, enter conversational mode: let the assistant ask clarifying questions
        const shouldUseConversationalMode = isShortGeneral && !candidateDraft && questionFlowMode !== 'manual-edit';
        if (shouldUseConversationalMode) setIsConversational(true);

        // Only extract known fields automatically when user provides a detailed prompt
        let activeCandidate = candidateDraft;
        if (!isShortGeneral) {
            const extracted = extractKnownFromPrompt(text, {
                city: user?.city,
                industry: user?.industry,
                brandName: user?.brandName,
            });
            // Preserve existing location if new extraction didn't detect one
            if (candidateDraft?.location && !extracted.location) {
                extracted.location = candidateDraft.location;
            }
            activeCandidate = candidateDraft
                ? { ...candidateDraft, ...extracted }
                : injectDraftDefaults(extracted);
            setCandidateDraft(activeCandidate);
        } else if (candidateDraft) {
            // For short messages, detect "Field: Value" patterns typed by the user
            // (e.g. "Niche: Fitness", "Visibility: Private") and apply them to the draft.
            const kvMatch = text.trim().match(/^([a-z\s]+?)\s*[:\-]\s*(.+)$/i);
            if (kvMatch) {
                const rawKey = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '');
                const value = kvMatch[2].trim();
                const KEY_MAP: Record<string, string> = {
                    'type': 'type', 'campaigntype': 'type',
                    'niche': 'niche',
                    'platform': 'platform',
                    'objective': 'objective', 'goal': 'objective',
                    'visibility': 'visibility',
                    'scripttype': 'scriptType', 'script': 'scriptType',
                    'postingtype': 'postingType', 'posting': 'postingType',
                    'budgetmode': 'budgetMode',
                    'budget': 'budget',
                    'location': 'location', 'city': 'location',
                };
                const mappedKey = KEY_MAP[rawKey];
                if (mappedKey) {
                    const fieldAnswer = { [mappedKey]: value };
                    activeCandidate = applyQuestionAnswers(candidateDraft, fieldAnswer);
                    setCandidateDraft(activeCandidate);
                }
            }
        }

        // Append the user's message first so it's always visible in the transcript.
        const nextMessages: ChatMessage[] = messages.length === 0
            ? [
                { role: 'assistant', content: 'I am your Senior Influencer Marketing Strategist. Describe your campaign idea, and I will help you architect a high-performance strategy. I’ll extract the key details or ask strategic questions to refine your approach.' },
                { role: 'user', content: text }
            ]
            : [...messages, { role: 'user', content: text }];
        setMessages(nextMessages);
        // clear input immediately so it feels like a real chat
        setPromptText('');

        // Off-topic detection now happens server-side, on every turn, with full conversation
        // context (see `on_topic` in the structured chat-turn response) — it judges meaning
        // rather than English keywords, so non-English/Hinglish briefs are no longer rejected
        // client-side before the backend ever sees them.
        if (isShortGeneral && !candidateDraft && questionFlowMode !== 'manual-edit') {
            // clear any draft so UI doesn't jump to fields during casual chat
            setCandidateDraft(null);
            setFinalDraft(null);
            setQuestionAnswers({});
        }
        setIsThinking(true);

        try {
            const { response, draft: serverDraft, ready } = await sendToAI(nextMessages);
            const cleaned = cleanForDisplay(response);

            // The server is now the single source of truth for extracted fields — it returns
            // a validated draft every turn (not just on a final magic-marker block), carrying
            // forward everything known from the whole conversation. Local regex extraction is
            // only used to fill in whatever the server hasn't determined yet.
            const merged = activeCandidate
                ? { ...activeCandidate, ...withoutNullish(serverDraft) }
                : injectDraftDefaults(withoutNullish(serverDraft));
            setCandidateDraft(merged);

            const missing = getMissingFields(merged);
            // Dates/visit-site details are step-2 form fields — the chat is complete once
            // everything else is filled and the server has confirmed readiness.
            const chatMissing = getChatAskableMissing(missing);

            // 2. If everything chat-collectable is found and the server set ready=true,
            //    close with a full recap of the campaign and move to Step 2.
            if (ready && chatMissing.length === 0) {
                const hydrated = hydrateDraft(merged);
                setFinalDraft(hydrated);
                setStrategy(buildStrategy(hydrated, user?.brandName));
                const summary = buildChatFinalSummary(merged, missing.filter((l) => FORM_ONLY_FIELD_LABELS.has(l)));
                setAssistantReply(summary);
                setMessages((prev) => [...prev, { role: 'assistant', content: summary }]);
                setStage('step2');
                return;
            }

            // 3. Conversational follow-up: Only ask about the NEXT missing thing the chat
            // can actually collect (never dates — those live in the step-2 form).
            const nextField = chatMissing[0] || '';
            const proactiveHint = getAssistantResponseSuggestion(cleaned || nextField);
            const expertReply = cleaned.includes('?')
                ? cleaned
                : `${cleaned} ${proactiveHint ? `\n\nExpert Tip: ${proactiveHint}` : ''}`;

            setAssistantReply(expertReply);
            setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
            setQuestionFlowMode('auto');
            setStage('step1');
        } catch {
            toast.error('AI service is unavailable. Please try again.');
        } finally {
            setIsThinking(false);
        }
    };

    const handleStep2Build = async () => {
        if (!candidateDraft) return;

        const mergedCandidate = applyQuestionAnswers(candidateDraft, questionAnswers);
        const missing = getMissingFields(mergedCandidate);
        setCandidateDraft(mergedCandidate);

        if (missing.length > 0) {
            const message = `I still need a few details to finish: ${missing.join(', ')}.`;
            setAssistantReply(message);
            setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
            toast.error('Please answer the remaining questions in chat.');
            return;
        }

        setHasBuiltStrategy(true);
        setStage('step3');
        setIsThinking(true);
        // "context" is genuinely already pulled at this point — mergedCandidate/hydrateDraft
        // run synchronously from local state, no network call involved.
        setBuildPhase({ context: true, shortlist: false, strategy: false });

        const finishBuild = async (source: Partial<ExtractedData>) => {
            const hydrated = hydrateDraft(source);
            if (mergedCandidate.applicationDeadline) hydrated.applicationDeadline = mergedCandidate.applicationDeadline;
            if (mergedCandidate.scriptDeadline) hydrated.scriptDeadline = mergedCandidate.scriptDeadline;
            if (mergedCandidate.workDeadline) hydrated.workDeadline = mergedCandidate.workDeadline;
            if (mergedCandidate.proofOfWorkDeadline) hydrated.proofOfWorkDeadline = mergedCandidate.proofOfWorkDeadline;
            if (mergedCandidate.proofOfWorkReq !== undefined) hydrated.proofOfWorkReq = mergedCandidate.proofOfWorkReq;
            setFinalDraft(hydrated);
            // Sync candidateDraft with all hydrated values so the missing-fields checker
            // and question-flow both see the fully resolved data (no stale undefined fields).
            setCandidateDraft((prev) =>
                prev
                    ? {
                        ...prev,
                        type: hydrated.type,
                        platform: hydrated.platform,
                        niche: hydrated.niche,
                        postingType: hydrated.postingType,
                        scriptType: hydrated.scriptType,
                        budgetMode: hydrated.budgetMode,
                        visibility: hydrated.visibility,
                    }
                    : prev
            );

            // The shortlist promise already swallows its own errors — only fetchAIStrategy can
            // still reject here, and if it does we let it propagate to the caller's catch block
            // (toast + back to step2) rather than silently substituting a fabricated strategy.
            // Each promise flips its own step3 checkmark the moment it genuinely settles, rather
            // than the old UI which showed every step as instantly done on render.
            const [{ strategy: fetchedStrategy, generatedBy }] = await Promise.all([
                fetchAIStrategy(hydrated).finally(() => setBuildPhase((p) => ({ ...p, strategy: true }))),
                Promise.race([
                    loadRealShortlist(hydrated),
                    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
                ]).catch(() => { }).finally(() => setBuildPhase((p) => ({ ...p, shortlist: true }))),
            ]);
            const generatedStrategy: Strategy = { ...fetchedStrategy, generatedBy };

            // Apply AI-suggested name if the current name is still a generic/weak fallback
            const isGenericName = !hydrated.campaignName
                || hydrated.campaignName === 'New Campaign'
                || hydrated.campaignName === 'Influencer Campaign'
                || hydrated.campaignName === `${user?.brandName || ''} Campaign`
                || /^(new|influencer|ugc|meme|twitter)\s+campaign$/i.test(hydrated.campaignName)
                || (hydrated.campaignName.endsWith(' Campaign') && hydrated.campaignName.length < 22);

            if (isGenericName && generatedStrategy.suggestedName) {
                const aiName = sanitizeText(generatedStrategy.suggestedName, 255);
                hydrated.campaignName = aiName;
                setFinalDraft({ ...hydrated });
                setCandidateDraft((prev) => prev ? { ...prev, campaignName: aiName } : prev);
            }

            setStrategy(generatedStrategy);

            if (mountedRef.current) {
                setStage('step4');
                setIsThinking(false);
                toast.success('Strategy ready! Your campaign is optimized and ready to launch.');
            }
        };

        // In edit mode the form data is already complete — always skip the AI
        // round-trip and build the strategy instantly from the filled fields.
        if (isEdit) {
            try {
                await finishBuild(mergedCandidate);
            } catch (err) {
                console.error('Error building strategy:', err);
                toast.error('Unable to build strategy right now.');
                setStage('step2');
                setIsThinking(false);
            }
            return;
        }

        const answerTextParts = [
            ...Object.entries(questionAnswers).map(([k, v]) => `${k}: ${v}`),
            step2Extra.trim() ? `extra: ${step2Extra.trim()}` : '',
        ].filter(Boolean);

        const userReply = answerTextParts.join(' | ') || 'Please proceed with smart defaults and build the campaign.';
        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: userReply }];
        setMessages(nextMessages);

        try {
            // Wrap AI call in a 30s timeout so the UI never gets permanently stuck
            let result: ServerChatResult;
            try {
                result = await Promise.race([
                    sendToAI(nextMessages),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 30000)),
                ]);
            } catch {
                // AI call timed out or failed — build from form data directly
                await finishBuild(mergedCandidate);
                return;
            }

            const parsed = result.ready ? { ...mergedCandidate, ...withoutNullish(result.draft) } : null;

            if (parsed) {
                const missingParsed = getMissingFields(parsed);
                if (missingParsed.length > 0) {
                    // AI response is incomplete; proceed with the validated form data instead
                    await finishBuild(mergedCandidate);
                    return;
                }
            }

            await finishBuild(parsed || mergedCandidate);
        } catch (err) {
            console.error('Error building strategy:', err);
            toast.error('Unable to build strategy right now.');
            setStage('step2');
            setIsThinking(false);
        }
    };

    const loadSession = async (session: AIChatSession) => {
        setIsLoadingSession(true);
        try {
            const { data } = await http.get(API.ai.chatSessions.getById(session.id));
            const loaded = data.data as { messages: AIChatMessage[]; status: string };
            const allMessages: ChatMessage[] = loaded.messages.map((m) => ({ role: m.role, content: m.content }));
            // Filter out internal AI strategy generation prompts — these are huge messages
            // containing STRATEGY_READY that were sent to the backend but should never
            // be visible in the user-facing chat history.
            const chatMessages = allMessages.filter(
                (m) => !(m.content.includes('STRATEGY_READY') && m.content.length > 300)
            );
            const firstUser = chatMessages.find((m) => m.role === 'user')?.content || '';
            const lastAssistant = [...chatMessages].reverse().find((m) => m.role === 'assistant')?.content || '';

            setSessionId(session.id);
            setMessages(chatMessages);
            setPromptText('');

            const parsed = parseCampaignReady(lastAssistant);
            if (parsed) {
                const missing = getMissingFields(parsed);
                if (missing.length > 0) {
                    setCandidateDraft(parsed);
                    setIsConversational(false);
                    setAssistantReply(`I still need a few details to finish: ${missing.join(', ')}.`);
                    setStage('step2');
                } else {
                    const hydrated = hydrateDraft(parsed);
                    setCandidateDraft(hydrated);
                    setIsConversational(false);
                    setFinalDraft(hydrated);
                    setStage('step4');
                    try {
                        const { strategy: restoredStrategy, generatedBy } = await fetchAIStrategy(hydrated);
                        setStrategy({ ...restoredStrategy, generatedBy });
                    } catch {
                        // Resuming an old session shouldn't hard-fail just because strategy
                        // regeneration is unavailable right now — show a template as a last resort.
                        setStrategy({ ...buildStrategy(hydrated, user?.brandName), generatedBy: 'fallback' });
                    }
                    await loadRealShortlist(hydrated);
                }
            } else {
                setCandidateDraft(extractKnownFromPrompt(firstUser, { city: user?.city, industry: user?.industry, brandName: user?.brandName }));
                setAssistantReply(cleanForDisplay(lastAssistant));
                setStage('step2');
            }
        } catch (err: any) {
            if (err.response?.status === 404) {
                toast.error('This chat session no longer exists or is not accessible. Starting fresh.');
                handleStartOver();
            } else if (err.response?.status === 401) {
                toast.error('Your session expired. Please log in again.');
            } else {
                toast.error('Failed to load chat session. Please try again.');
            }
        } finally {
            setIsLoadingSession(false);
        }
    };

    const handleRegenerateStrategy = async () => {
        if (!finalDraft) return;
        setIsThinking(true);
        try {
            const { strategy: regenerated, generatedBy } = await fetchAIStrategy(finalDraft);
            setStrategy({ ...regenerated, generatedBy });
            toast[generatedBy === 'ai' ? 'success' : 'error'](
                generatedBy === 'ai' ? 'Strategy regenerated with AI.' : 'AI is still unavailable — showing the template version.'
            );
        } catch {
            toast.error('Unable to regenerate right now. Please try again.');
        } finally {
            setIsThinking(false);
        }
    };

    const toggleCreator = (id: string) => {
        setSelectedCreatorIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const applyRefinement = (type: 'cut-nano' | 'more-micro' | 't2-focus' | 'reduce-budget') => {
        if (!strategy || !finalDraft) return;

        if (type === 'cut-nano') {
            const nanoIds = shortlist.filter((s) => s.tier === 'nano').map((s) => s.id);
            const keep = new Set(selectedCreatorIds);
            nanoIds.slice(Math.ceil(nanoIds.length / 2)).forEach((id) => keep.delete(id));
            setSelectedCreatorIds(keep);
            setRefineMessage('Rebalanced: reduced nano creators; conversion depth preserved with lower spend.');
            return;
        }

        if (type === 'more-micro') {
            const keep = new Set(selectedCreatorIds);
            shortlist.forEach((s) => {
                if (s.tier === 'micro') keep.add(s.id);
                if (s.tier === 'macro') keep.delete(s.id);
            });
            setSelectedCreatorIds(keep);
            setRefineMessage('Rebalanced to favor micro creators for stronger engagement-to-cost efficiency.');
            return;
        }

        if (type === 't2-focus') {
            setRefineMessage('T2-focused mix applied conceptually. Final invite shortlist can now be filtered by city in Discover.');
            return;
        }

        const reduced = Math.round((toNumber(finalDraft.totalBudget) || 0) * 0.75);
        setFinalDraft({ ...finalDraft, totalBudget: String(reduced) });
        setStrategy({
            ...strategy,
            reachLow: Math.round(strategy.reachLow * 0.82),
            reachHigh: Math.round(strategy.reachHigh * 0.84),
        });
        setRefineMessage(`Budget trimmed to ${fmtINR(reduced)} with moderated reach expectations.`);
    };

    const handleLaunch = async () => {
        if (!finalDraft) return;
        if (launchInFlightRef.current) return;

        const budget = toNumber(finalDraft.totalBudget);
        if ((finalDraft.budgetMode === 'paid' || finalDraft.budgetMode === 'paid_product') && budget <= 0) {
            toast.error('Please enter a valid budget amount');
            return;
        }

        if (budget > 9999999999.99) {
            toast.error('Total budget exceeds maximum allowed limit (9,999,999,999.99). Please adjust the budget in Step 2.');
            return;
        }

        launchInFlightRef.current = true;
        const loadingToast = toast.loading('Creating and publishing your campaign...');

        try {
            const payload = buildCampaignPayloadFromAIDraft(finalDraft) as any;
            // Attach filenames for backend to know; actual upload not performed here.
            if (coverFile) payload.basics = { ...(payload.basics || {}), coverImageName: coverFile.name };
            if (referenceFiles && referenceFiles.length > 0) payload.deliverables = { ...(payload.deliverables || {}), references: referenceFiles.map((f) => f.name) };
            if (scriptFile && finalDraft.scriptType === 'brand') payload.basics = { ...(payload.basics || {}), scriptFileName: scriptFile.name };
            if (strategy) payload.aiStrategy = strategy;

            let campaign;
            if (isEdit && campaignId) {
                campaign = await updateCampaign.mutateAsync({ id: campaignId, ...payload });
            } else if (createdCampaignIdRef.current) {
                campaign = await updateCampaign.mutateAsync({ id: createdCampaignIdRef.current, ...payload });
            } else {
                campaign = await createCampaign.mutateAsync(payload);
                createdCampaignIdRef.current = campaign.id;
            }

            if (coverFile) {
                await uploadThumbnail.mutateAsync({ id: campaign.id, file: coverFile }).catch(() => {
                    toast.error('Cover image upload failed, but campaign was created.');
                });
            }

            if (scriptFile && finalDraft.scriptType === 'brand') {
                await uploadScript.mutateAsync({ id: campaign.id, file: scriptFile }).catch(() => {
                    toast.error('Script file upload failed.');
                });
            }

            await launchCampaign.mutateAsync(campaign.id);

            if (finalDraft.visibility === 'private' && selectedCreatorIds.size > 0) {
                await http.post(API.campaigns.invite(campaign.id), {
                    influencerIds: Array.from(selectedCreatorIds),
                }).catch(() => {
                    toast.error('Campaign launched, but some invites could not be sent.');
                });
            }

            if (sessionId) {
                await http.patch(API.ai.chatSessions.linkCampaign(sessionId), { campaignId: campaign.id }).catch(() => {
                    // Non-blocking.
                });
                queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
            }

            toast.success('Campaign launched successfully!', { id: loadingToast });
            launchInFlightRef.current = false;
            createdCampaignIdRef.current = null;
            handleStartOver(); // Clear local state and files
            navigate(`/campaigns/${campaign.id}?tab=ai-strategy`);
        } catch (err: any) {
            launchInFlightRef.current = false;
            const msg = getApiErrorMessage(err, 'Failed to launch campaign');
            toast.error(msg, { id: loadingToast });
        }
    };

    if (stage === 'step3') {
        // Each line reflects a real network call actually settling (see buildPhase updates in
        // handleStep2Build/finishBuild) — not shown as "done" until the corresponding promise
        // resolves. Previously this list checked off 4 of 5 steps immediately on render.
        const lines: Array<{ label: string; done: boolean }> = [
            { label: 'Pulling brand profile and campaign context...', done: buildPhase.context },
            { label: 'Reviewing creator pool from live data...', done: buildPhase.shortlist },
            { label: 'Computing reach, engagement, and creator mix from real pricing data...', done: buildPhase.strategy },
            { label: 'Finalizing strategy and shortlist...', done: buildPhase.shortlist && buildPhase.strategy },
        ];

        return (
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen gap-8 animate-fade-in">
                <div className="w-24 h-24 rounded-3xl bg-[#fedc03] flex items-center justify-center shadow-2xl shadow-[#fedc03]/30 animate-pulse">
                    <Wand2 className="w-12 h-12 text-black animate-bounce" />
                </div>

                <div className="text-center">
                    <h2 className="text-4xl font-bold mb-2">Building your strategy...</h2>
                    <p className="text-muted-foreground text-lg">One step at a time, just like your reference flow.</p>
                </div>

                <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="space-y-3">
                        {lines.map((line, idx) => (
                            <div key={line.label} className="flex items-center gap-3" style={{ animationDelay: `${idx * 120}ms` } as CSSProperties}>
                                {line.done ? (
                                    <Check className="w-4 h-4 text-[#1D9E75] shrink-0" />
                                ) : (
                                    <Loader2 className="w-4 h-4 animate-spin text-[#fedc03] shrink-0" />
                                )}
                                <span className={cn('text-sm font-medium', line.done ? 'text-foreground' : 'text-muted-foreground')}>{line.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground text-center max-w-md">
                    This typically takes 15-30 seconds. Your strategy will be ready soon with creator mix recommendations and reach estimates.
                </p>
            </div>
        );
    }

    if (stage === 'step4' && finalDraft && strategy) {
        const budget = toNumber(finalDraft.totalBudget);
        const buffer = Math.max(10000, Math.round(budget * 0.12));
        const totalBudgetDisplay = selectedSpend > 0 ? selectedSpend + buffer : budget + buffer;
        const formats = PLATFORM_FORMATS[finalDraft.platform] || PLATFORM_FORMATS.instagram;
        const showShortlist = finalDraft.visibility === 'private';
        const shortlistAllSelected = shortlist.length > 0 && selectedCreatorIds.size === shortlist.length;
        const pickerAllSelected = influencerPool.length > 0 && pickerSelectedIds.size === influencerPool.length;
        const shortlistSelectedCount = showShortlist ? selectedCreatorIds.size : 0;

        return (
            <div className="w-full mx-auto animate-fade-in flex flex-col min-h-0 overflow-hidden">
                <div className="shrink-0 mb-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step 4 of 4</p>
                            <div className="flex items-center gap-2">
                                <h2 className="text-3xl font-bold tracking-tight">Your Campaign Strategy</h2>
                                {strategy.generatedBy === 'fallback' && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
                                        Template narrative — AI unavailable
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {strategy.generatedBy === 'fallback' && !isLive && (
                                <button
                                    onClick={handleRegenerateStrategy}
                                    disabled={isThinking}
                                    className="h-10 px-5 rounded-xl border border-border hover:bg-secondary transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Regenerate with AI
                                </button>
                            )}
                            <button
                                onClick={() => { if (!isLive) { setIsThinking(false); setStage('step2'); } }}
                                disabled={isLive}
                                className="h-10 px-5 rounded-xl border border-border hover:bg-secondary transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Back to details
                            </button>
                            {!isEdit && (
                                <button onClick={handleStartOver} className="h-10 px-5 rounded-xl border border-border hover:bg-secondary transition-all text-sm font-medium">
                                    Start Over
                                </button>
                            )}
                            {!isLive && (
                                <button
                                    onClick={handleLaunch}
                                    disabled={createCampaign.isPending || launchCampaign.isPending || updateCampaign.isPending}
                                    className="h-10 px-6 rounded-xl bg-[#fedc03] text-black font-bold text-sm hover:bg-[#f0d000] shadow-lg shadow-[#fedc03]/20 flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {createCampaign.isPending || launchCampaign.isPending || updateCampaign.isPending
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Rocket className="w-4 h-4" />}
                                    Launch Campaign
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 min-h-0">
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,340px] gap-6 px-2">
                        <div className="space-y-6 overflow-hidden">
                            {/* Cover Image Display */}
                            {(() => {
                                const displayUrl = coverPreviewUrl || (!removedExistingThumbnail && existingThumbnailUrl) || null;
                                return displayUrl ? (
                                    <div className="bg-linear-to-br from-[#fedc03]/10 to-[#fedc03]/5 border border-[#fedc03]/30 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="w-full">
                                            <ApiImage
                                                src={displayUrl}
                                                alt="Campaign cover"
                                                className="w-full h-auto max-h-[500px] object-contain"
                                                placeholderClassName="w-full h-56"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-secondary/20 border border-border rounded-2xl h-56 flex items-center justify-center">
                                        <div className="text-center">
                                            <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                                            <p className="text-xs text-muted-foreground">No cover image uploaded</p>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Campaign Thesis</h3>
                                </div>
                                <p className="text-muted-foreground leading-relaxed text-sm">{strategy.thesis}</p>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Why This Approach</h3>
                                </div>
                                <p className="text-muted-foreground leading-relaxed text-sm">{strategy.whyThisApproach}</p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-3">
                                {mix.map((m) => (
                                    <div key={m.tier} className="bg-card border border-border rounded-2xl p-4">
                                        <p className="text-xs text-muted-foreground">{m.tier} · {m.range}</p>
                                        <p className="text-xl font-bold mt-1">{m.count} creators</p>
                                        <p className="text-sm font-semibold mt-1">{fmtINR(m.spend)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{m.why}</p>
                                    </div>
                                ))}
                            </div>

                            {strategy.basis && strategy.basis.length > 0 && (
                                <details className="bg-secondary/10 border border-border rounded-xl px-4 py-3">
                                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                                        Where these numbers come from
                                    </summary>
                                    <ul className="mt-2 space-y-1">
                                        {strategy.basis.map((line, i) => (
                                            <li key={i} className="text-xs text-muted-foreground/80 leading-relaxed">· {line}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Content Strategy</h3>
                                </div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suggested Hooks</p>
                                <ul className="space-y-2 text-sm mb-5">
                                    {strategy.hooks.map((hook) => (
                                        <li key={hook} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 mt-0.5 text-[#0a0a0a] shrink-0" />
                                            <span>{hook}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Format Ideas</p>
                                <ul className="space-y-2 text-sm">
                                    {strategy.contentIdeas.map((idea) => (
                                        <li key={idea} className="flex items-start gap-2 text-muted-foreground">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#fedc03] shrink-0" />
                                            <span>{idea}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Key Recommendations</h3>
                                </div>
                                <ul className="space-y-3">
                                    {strategy.recommendations.map((rec, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <span className="mt-0.5 w-5 h-5 rounded-full bg-[#fedc03]/15 text-[#0a0a0a] text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                            <span className="text-muted-foreground">{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Creator Brief</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">{strategy.creatorBrief}</p>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-lg">Creator Shortlist</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{shortlistSelectedCount} selected</span>
                                        {showShortlist && (
                                            <button
                                                onClick={async () => {
                                                    setShowInfluencerPicker(true);
                                                    setPickerSelectedIds(new Set());
                                                    await loadInfluencerPool(finalDraft);
                                                }}
                                                className="text-xs font-semibold text-[#0a0a0a] hover:underline"
                                            >
                                                Browse creators
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {showShortlist ? (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <button
                                                onClick={() => {
                                                    if (shortlistAllSelected) setSelectedCreatorIds(new Set());
                                                    else setSelectedCreatorIds(new Set(shortlist.map((s) => s.id)));
                                                }}
                                                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                            >
                                                {shortlistAllSelected ? 'Unselect all' : 'Select all'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {shortlist.length === 0 ? (
                                                <div className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4">
                                                    No creators yet. Use "Browse creators" to add your first shortlist.
                                                </div>
                                            ) : (
                                                shortlist.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => toggleCreator(c.id)}
                                                        className={cn(
                                                            'w-full text-left p-3 rounded-xl border transition-all grid grid-cols-[1.4fr,0.8fr,0.9fr,0.9fr,24px] gap-2 items-center',
                                                            selectedCreatorIds.has(c.id)
                                                                ? 'border-[#fedc03] bg-[#fedc03]/5'
                                                                : 'border-border hover:border-[#fedc03]/40'
                                                        )}
                                                    >
                                                        <div>
                                                            <p className="text-sm font-semibold leading-tight">{c.name}</p>
                                                            <p className="text-xs text-muted-foreground">{c.handle} · {c.city}</p>
                                                        </div>
                                                        <p className="text-xs uppercase">{TIER_LABELS[c.tier] || c.tier}</p>
                                                        <p className="text-xs">{Math.round(c.followers / 1000)}K · {c.engagementRate.toFixed(1)}% ER</p>
                                                        <p className="text-xs font-semibold">{fmtINR(c.fee)}</p>
                                                        <input type="checkbox" checked={selectedCreatorIds.has(c.id)} readOnly className="w-4 h-4" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4">
                                        Creator shortlist is available only for private campaigns.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6 overflow-hidden">
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Wallet className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Budget & Results</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Budget</p>
                                        <p className="text-2xl font-bold">{fmtINR(totalBudgetDisplay)}</p>
                                        <p className="text-[11px] text-muted-foreground">Creator spend {fmtINR(selectedSpend || budget)} · Buffer {fmtINR(buffer)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Content Mix</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {formats.map((f, i) => {
                                        const pct = strategy.contentMixPct?.[i] ?? (i === 0 ? 55 : i === 1 ? 30 : 15);
                                        return (
                                            <div key={f}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span>{f}</span>
                                                    <span className="text-muted-foreground">{pct}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                                    <div className="h-full bg-[#1D9E75]" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-5 h-5 text-[#fedc03]" />
                                    <h3 className="font-bold text-lg">Timeline</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {strategy.timeline.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-base mb-3">Refine Strategy</h3>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => applyRefinement('cut-nano')} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary">Cut nano in half</button>
                                    <button onClick={() => applyRefinement('more-micro')} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary">More micro, less macro</button>
                                    <button onClick={() => applyRefinement('t2-focus')} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary">Tier 2 focus</button>
                                    <button onClick={() => applyRefinement('reduce-budget')} className="px-2.5 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary">Reduce budget by 25%</button>
                                </div>
                                {refineMessage && <p className="text-xs text-muted-foreground mt-3">{refineMessage}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {showInfluencerPicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl max-h-[85vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <div>
                                    <h3 className="font-semibold text-lg">Browse creators</h3>
                                    <p className="text-xs text-muted-foreground">Select creators to add to your shortlist.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowInfluencerPicker(false);
                                        setPickerSelectedIds(new Set());
                                    }}
                                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-border">
                                <button
                                    onClick={() => {
                                        if (pickerAllSelected) setPickerSelectedIds(new Set());
                                        else setPickerSelectedIds(new Set(influencerPool.map((s) => s.id)));
                                    }}
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                >
                                    {pickerAllSelected ? 'Unselect all' : 'Select all'}
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{pickerSelectedIds.size} selected</span>
                                    <button
                                        onClick={() => {
                                            const selected = influencerPool.filter((s) => pickerSelectedIds.has(s.id));
                                            if (selected.length === 0) return;
                                            setShortlist((prev) => {
                                                const map = new Map(prev.map((p) => [p.id, p]));
                                                selected.forEach((s) => map.set(s.id, s));
                                                return Array.from(map.values());
                                            });
                                            setSelectedCreatorIds((prev) => {
                                                const next = new Set(prev);
                                                selected.forEach((s) => next.add(s.id));
                                                return next;
                                            });
                                            setShowInfluencerPicker(false);
                                            setPickerSelectedIds(new Set());
                                        }}
                                        className="px-3 py-2 rounded-lg bg-[#fedc03] text-black text-xs font-semibold hover:bg-[#f0d000]"
                                    >
                                        Add to shortlist
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 overflow-y-auto">
                                {isInfluencerPoolLoading ? (
                                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading creators...
                                    </div>
                                ) : influencerPool.length === 0 ? (
                                    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6">
                                        No creators found. Try adjusting your niche, city, or platform.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {influencerPool.map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    setPickerSelectedIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(c.id)) next.delete(c.id);
                                                        else next.add(c.id);
                                                        return next;
                                                    });
                                                }}
                                                className={cn(
                                                    'w-full text-left p-3 rounded-xl border transition-all grid grid-cols-[1.4fr,0.7fr,0.9fr,0.9fr,24px] gap-2 items-center',
                                                    pickerSelectedIds.has(c.id)
                                                        ? 'border-[#fedc03] bg-[#fedc03]/5'
                                                        : 'border-border hover:border-[#fedc03]/40'
                                                )}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold leading-tight">{c.name}</p>
                                                    <p className="text-xs text-muted-foreground">{c.handle} · {c.city}</p>
                                                </div>
                                                <p className="text-xs uppercase">{TIER_LABELS[c.tier] || c.tier}</p>
                                                <p className="text-xs">{Math.round(c.followers / 1000)}K · {c.engagementRate.toFixed(1)}% ER</p>
                                                <p className="text-xs font-semibold">{fmtINR(c.fee)}</p>
                                                <input type="checkbox" checked={pickerSelectedIds.has(c.id)} readOnly className="w-4 h-4" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'step2') {
        const ALL_TYPES = CAMPAIGN_TYPE_OPTIONS;
        const ALL_OBJECTIVES = OBJECTIVE_OPTIONS;
        const ALL_PLATFORMS = PLATFORM_OPTIONS;

        const pill = (active: boolean) =>
            cn(
                'px-4 py-2 rounded-lg text-xs font-semibold border transition-all',
                active
                    ? 'bg-[#fedc03] border-[#fedc03] text-black shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-[#fedc03]/50 hover:text-foreground'
            );

        const setDraft = (patch: Partial<ExtractedData>) =>
            setCandidateDraft((prev) => ({ ...(prev || {}), ...patch }));

        const toggleContentType = (value: string) => {
            const current = candidateDraft?.contentType ?? [];
            const next = current.includes(value)
                ? current.filter((v) => v !== value)
                : [...current, value];
            setDraft({ contentType: next });
        };

        const contentOptions = CONTENT_TYPE_OPTIONS[candidateDraft?.platform || 'instagram'] || CONTENT_TYPE_OPTIONS.instagram;
        const missingDeadlines = missingFields.filter((field) => /deadline/i.test(field));
        const isBrandScript = candidateDraft?.scriptType === 'brand';
        const hasCoverImage = !!coverFile || (!removedExistingThumbnail && !!existingThumbnailUrl);
        const hasScriptFile = !!scriptFile || !!existingScriptFileKey;
        const missingRequiredUploads = !hasCoverImage;
        const buildBlockReason = !hasCoverImage
            ? 'Please upload a cover image before building the strategy.'
            : '';

        return (
            <div className="w-full mx-auto animate-fade-in flex flex-col min-h-0 overflow-hidden">
                <div className="shrink-0 mb-4">
                    <StepHeader />
                </div>

                {/* Two-column layout: left scrolls, right sticks to top */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5 items-start">
                    {/* Left content (Details Editor) with independent scrolling */}
                    <div className="space-y-5 overflow-y-auto pr-1 pb-6 custom-scrollbar lg:max-h-[calc(100dvh-220px)] lg:min-h-[400px]">

                        {/* Extraction summary */}
                        <div className="bg-card border border-border rounded-2xl p-3 shadow-sm">
                            <h3 className="text-xs font-semibold mb-2">What I picked up from your prompt</h3>
                            <div className="space-y-0">
                                {extractionRows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between py-1 border-b border-border last:border-0 text-xs">
                                        <span className="text-muted-foreground">{row.label}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium">{row.value}</span>
                                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', row.ok ? 'bg-[#1D9E75]' : 'bg-[#BA7517]')} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Campaign details editor — sectioned layout */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {/* Basics */}
                            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Campaign Basics</h4>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campaign Name</p>
                                    <input
                                        value={candidateDraft?.campaignName ?? ''}
                                        onChange={(e) => setDraft({ campaignName: e.target.value })}
                                        placeholder="e.g. Diwali Glow-Up 2025"
                                        className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                    />
                                </div>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campaign Type</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ALL_TYPES.map((t) => (
                                            <button key={t} onClick={() => setDraft({ type: t })} className={pill(candidateDraft?.type === t)}>
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
                                    <textarea
                                        value={candidateDraft?.description ?? ''}
                                        onChange={(e) => {
                                            setDraft({ description: e.target.value });
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        rows={3}
                                        placeholder="Brief campaign description..."
                                        style={{ minHeight: '80px' }}
                                        className="w-full p-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors overflow-hidden"
                                    />
                                </div>
                            </div>

                            {/* Strategy */}
                            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Content Strategy</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Objective</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ALL_OBJECTIVES.map((o) => (
                                                <button key={o} onClick={() => setDraft({ objective: o })} className={pill(candidateDraft?.objective === o)}>
                                                    {o}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Platform</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ALL_PLATFORMS.map((p) => (
                                                <button key={p} onClick={() => setDraft({ platform: p })} className={pill(candidateDraft?.platform === p)}>
                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Content Formats</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contentOptions.map((format) => (
                                            <button
                                                key={format}
                                                onClick={() => toggleContentType(format)}
                                                className={pill(candidateDraft?.contentType?.includes(format) ?? false)}
                                            >
                                                {titleCase(format.replace('-', ' '))}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Targeting */}
                            <div className="bg-card border border-border rounded-2xl p-5 space-y-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Targeting</h4>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Niche</p>
                                    <input
                                        value={candidateDraft?.niche ?? ''}
                                        onChange={(e) => setDraft({ niche: e.target.value })}
                                        placeholder="e.g. Beauty & Fashion, Gaming..."
                                        className="w-full p-2.5 mb-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                    />
                                    <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                                        {NICHE_OPTIONS.map((n) => (
                                            <button key={n.key} onClick={() => setDraft({ niche: n.key })} className={pill(candidateDraft?.niche === n.key)}>
                                                {n.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 pt-4 border-t border-border/50">Location</p>
                                    <input
                                        value={candidateDraft?.location ?? ''}
                                        onChange={(e) => setDraft({ location: e.target.value })}
                                        placeholder="e.g. Pan India, Mumbai..."
                                        className="w-full p-2.5 mb-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestions.locations.filter(Boolean).map((l) => (
                                            <button key={l} onClick={() => setDraft({ location: l })} className={pill(candidateDraft?.location === l)}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Budget & Settings */}
                            <div className="bg-card border border-border rounded-2xl p-5 space-y-6">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Budget & Settings</h4>

                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex justify-between">
                                        <span>Total Budget (₹)</span>
                                        {toNumber(candidateDraft?.totalBudget) > 9999999999.99 && (
                                            <span className="text-destructive normal-case tracking-normal">Limit: 9,999,999,999</span>
                                        )}
                                    </p>
                                    <input
                                        value={candidateDraft?.totalBudget ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            if (Number(val) <= 9999999999) {
                                                setDraft({ totalBudget: val });
                                            } else {
                                                setDraft({ totalBudget: '9999999999' });
                                            }
                                        }}
                                        placeholder="e.g. 150000"
                                        className={cn(
                                            "w-full p-2.5 mb-3 rounded-lg border bg-background text-sm focus:outline-none transition-colors",
                                            toNumber(candidateDraft?.totalBudget) > 9999999999.99
                                                ? "border-destructive focus:ring-1 focus:ring-destructive focus:border-destructive"
                                                : "border-border focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03]"
                                        )}
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestions.budgets.slice(0, 4).map((b) => (
                                            <button key={b} onClick={() => setDraft({ totalBudget: b })} className={pill(candidateDraft?.totalBudget === b)}>
                                                {fmtINR(toNumber(b))}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 pt-4 border-t border-border/50">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visibility</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(['public', 'private'] as const).map((v) => (
                                                    <button key={v} onClick={() => setDraft({ visibility: v })} className={pill(candidateDraft?.visibility === v)}>
                                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Budget Mode</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(['paid', 'product', 'paid_product'] as const).map((bm) => (
                                                    <button
                                                        key={bm}
                                                        onClick={() => setDraft({ budgetMode: bm })}
                                                        className={pill((candidateDraft?.budgetMode ?? 'paid') === bm)}
                                                    >
                                                        {bm === 'paid' ? 'Paid' : bm === 'product' ? 'Product Only' : 'Paid + Product'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Posting Type</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button onClick={() => setDraft({ postingType: 'creator' })} className={pill(candidateDraft?.postingType === 'creator')}>
                                                    Creator posts
                                                </button>
                                                <button onClick={() => setDraft({ postingType: 'brand' })} className={pill(candidateDraft?.postingType === 'brand')}>
                                                    Brand posts
                                                </button>
                                            </div>
                                            {candidateDraft?.postingType === 'brand' && (
                                                <div className="mt-4">
                                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 pt-3 border-t border-border/50">Usage rights</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {USAGE_RIGHTS_OPTIONS.map((r) => (
                                                            <button key={r} onClick={() => setDraft({ usageRights: candidateDraft.usageRights === r ? undefined : r })} className={pill(candidateDraft.usageRights === r)}>
                                                                {r}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-red-500/80 mt-3 italic">
                                                        * Note: Creators may charge more for longer usage rights.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Script</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button onClick={() => setDraft({ scriptType: 'creator' })} className={pill(candidateDraft?.scriptType === 'creator')}>
                                                    Creator writes
                                                </button>
                                                <button onClick={() => setDraft({ scriptType: 'brand' })} className={pill(candidateDraft?.scriptType === 'brand')}>
                                                    Brand provides
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(candidateDraft?.budgetMode === 'product' || candidateDraft?.budgetMode === 'paid_product') && (
                                    <div>
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 pt-2 border-t border-border/50">Product Details</p>
                                        <textarea
                                            value={candidateDraft?.productDetails ?? ''}
                                            onChange={(e) => {
                                                setDraft({ productDetails: e.target.value });
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            placeholder="Describe the product(s) to be sent to creators..."
                                            rows={2}
                                            style={{ minHeight: '60px' }}
                                            className="w-full p-2.5 mt-1 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors overflow-hidden"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="bg-card border border-border rounded-2xl p-5 xl:col-span-2 space-y-5">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Campaign Timeline</h4>

                                {/* Deadline strategy — same choice as the step-by-step builder */}
                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Deadline Strategy</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {([
                                            { value: 'common', label: 'Common Deadline', desc: 'One deadline applies to all creators' },
                                            { value: 'individual', label: 'Individual Deadline', desc: 'Set deadlines per creator when reviewing' },
                                        ] as const).map((opt) => {
                                            const selected = (candidateDraft?.deadlineMode ?? 'common') === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDraft({ deadlineMode: opt.value })}
                                                    className={cn(
                                                        'flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all',
                                                        selected
                                                            ? 'border-foreground bg-secondary/60 ring-1 ring-foreground/10'
                                                            : 'border-border hover:border-foreground/20 hover:bg-secondary/30'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        <div className={cn(
                                                            'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                                            selected ? 'border-foreground bg-foreground' : 'border-border'
                                                        )}>
                                                            {selected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                                                        </div>
                                                        <span className="text-sm font-semibold">{opt.label}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground ml-6">{opt.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {candidateDraft?.deadlineMode !== 'individual' && (
                                    <div className={cn("grid grid-cols-1 gap-5", candidateDraft?.scriptType !== 'brand' ? "md:grid-cols-4" : "md:grid-cols-3")}>
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Application Deadline</p>
                                            <input
                                                type="date"
                                                min={new Date().toISOString().split('T')[0]}
                                                max={candidateDraft?.scriptDeadline || candidateDraft?.workDeadline || undefined}
                                                value={candidateDraft?.applicationDeadline ?? ''}
                                                onChange={(e) => setDraft({ applicationDeadline: e.target.value })}
                                                className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                            />
                                        </div>
                                        {candidateDraft?.scriptType !== 'brand' && (
                                            <div>
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Script Deadline</p>
                                                <input
                                                    type="date"
                                                    min={candidateDraft?.applicationDeadline || new Date().toISOString().split('T')[0]}
                                                    max={candidateDraft?.workDeadline || undefined}
                                                    value={candidateDraft?.scriptDeadline ?? ''}
                                                    onChange={(e) => setDraft({ scriptDeadline: e.target.value })}
                                                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Work Deadline</p>
                                            <input
                                                type="date"
                                                min={candidateDraft?.scriptDeadline || candidateDraft?.applicationDeadline || new Date().toISOString().split('T')[0]}
                                                value={candidateDraft?.workDeadline ?? ''}
                                                onChange={(e) => setDraft({ workDeadline: e.target.value })}
                                                className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Proof of Work Deadline</p>
                                            <input
                                                type="date"
                                                min={candidateDraft?.workDeadline || candidateDraft?.scriptDeadline || candidateDraft?.applicationDeadline || new Date().toISOString().split('T')[0]}
                                                value={candidateDraft?.proofOfWorkDeadline ?? ''}
                                                onChange={(e) => setDraft({ proofOfWorkDeadline: e.target.value })}
                                                className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}
                                {candidateDraft?.deadlineMode === 'individual' && (
                                    <p className="text-xs text-muted-foreground">No dates needed now — you'll set deadlines per creator while reviewing applications.</p>
                                )}
                            </div>

                            {/* Visit at Site — parity with the step-by-step builder */}
                            <div className="bg-card border border-border rounded-2xl p-5 xl:col-span-2 space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Visit at Site</h4>
                                <p className="text-xs text-muted-foreground">Does this campaign require the influencer to visit your site, store, or event? (Optional)</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const enabling = !candidateDraft?.visitAtSiteEnabled;
                                        setDraft(enabling
                                            ? { visitAtSiteEnabled: true, visitAtSiteTime: candidateDraft?.visitAtSiteTime || '' }
                                            : { visitAtSiteEnabled: false, visitAtSiteDescription: '', visitAtSiteDate: '', visitAtSiteTime: '' });
                                    }}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all w-full sm:w-auto',
                                        candidateDraft?.visitAtSiteEnabled
                                            ? 'border-foreground bg-secondary/50'
                                            : 'border-border hover:border-foreground/20 hover:bg-secondary/30'
                                    )}
                                >
                                    <div className={cn(
                                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                                        candidateDraft?.visitAtSiteEnabled ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'
                                    )}>
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">Visit at site</p>
                                        <p className="text-xs text-muted-foreground">
                                            {candidateDraft?.visitAtSiteEnabled ? 'Enabled — share schedule and instructions' : 'Disabled — no site visit required'}
                                        </p>
                                    </div>
                                </button>
                                {candidateDraft?.visitAtSiteEnabled && (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visit Description</p>
                                            <textarea
                                                value={candidateDraft?.visitAtSiteDescription ?? ''}
                                                maxLength={1000}
                                                onChange={(e) => setDraft({ visitAtSiteDescription: e.target.value })}
                                                rows={3}
                                                placeholder="Describe the site visit requirement, location, purpose, and any instructions..."
                                                className="w-full p-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div>
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visit Date</p>
                                                <input
                                                    type="date"
                                                    min={candidateDraft?.applicationDeadline || new Date().toISOString().split('T')[0]}
                                                    max="9999-12-31"
                                                    value={candidateDraft?.visitAtSiteDate ?? ''}
                                                    onChange={(e) => setDraft({ visitAtSiteDate: e.target.value })}
                                                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Visit Time</p>
                                                <input
                                                    type="time"
                                                    value={candidateDraft?.visitAtSiteTime ?? ''}
                                                    onChange={(e) => setDraft({ visitAtSiteTime: e.target.value })}
                                                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#fedc03] focus:ring-1 focus:ring-[#fedc03] transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Uploads — styled drag-drop zones */}
                        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold">Optional Uploads</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">These can also be added later from the campaign editor.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Cover Image */}
                                <div>
                                    <p className="text-xs font-semibold mb-2">Cover Image</p>
                                    {coverFile ? (
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#fedc03]/30 bg-[#fedc03]/5">
                                            {coverPreviewUrl ? (
                                                <img
                                                    src={coverPreviewUrl}
                                                    alt="Cover preview"
                                                    className="w-12 h-12 rounded-lg object-contain bg-black/5 border border-[#fedc03]/30"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-[#fedc03]/20 flex items-center justify-center text-[#0a0a0a] shrink-0">
                                                    <ImageIcon className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold truncate">{coverFile.name}</p>
                                                <p className="text-[10px] text-muted-foreground">Cover image ready</p>
                                            </div>
                                            <button
                                                onClick={() => { setCoverFile(null); setCoverPreviewUrl(null); }}
                                                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : existingThumbnailUrl && !removedExistingThumbnail ? (
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#fedc03]/30 bg-[#fedc03]/5">
                                            <ApiImage
                                                src={existingThumbnailUrl}
                                                alt="Current cover"
                                                className="w-12 h-12 rounded-lg object-cover border border-[#fedc03]/30 shrink-0"
                                                placeholderClassName="w-12 h-12 rounded-lg"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold">Current cover image</p>
                                                <p className="text-[10px] text-muted-foreground">From campaign · replace or remove</p>
                                            </div>
                                            <label className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer text-muted-foreground transition-colors" title="Replace cover image">
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png"
                                                    className="sr-only"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f && f.size > 5 * 1024 * 1024) { toast.error('Cover image must be under 5MB'); }
                                                        else if (f) setCoverFile(f);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <Upload className="w-3.5 h-3.5" />
                                            </label>
                                            <button
                                                onClick={() => setRemovedExistingThumbnail(true)}
                                                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                                title="Remove cover image"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label
                                            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-[#fedc03]/40 cursor-pointer transition-all bg-secondary/10 hover:bg-secondary/30 group"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'copy';
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const f = e.dataTransfer.files?.[0];
                                                if (!f) return;
                                                if (!['image/jpeg', 'image/png'].includes(f.type)) {
                                                    toast.error('Only JPG or PNG images are allowed');
                                                    return;
                                                }
                                                if (f.size > 5 * 1024 * 1024) {
                                                    toast.error('Cover image must be under 5MB');
                                                    return;
                                                }
                                                setCoverFile(f);
                                            }}
                                        >
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png"
                                                className="sr-only"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f && !['image/jpeg', 'image/png'].includes(f.type)) {
                                                        toast.error('Only JPG or PNG images are allowed');
                                                    } else if (f && f.size > 5 * 1024 * 1024) {
                                                        toast.error('Cover image must be under 5MB');
                                                    } else if (f) {
                                                        setCoverFile(f);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            />
                                            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-[#fedc03]/20 group-hover:text-[#0a0a0a] transition-all">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs font-semibold text-center">Click or drag to upload</p>
                                            <p className="text-[10px] text-muted-foreground">JPG, PNG · max 5MB · 1200×630px recommended</p>
                                        </label>
                                    )}
                                </div>

                                {/* Script File */}
                                <div>
                                    <p className="text-xs font-semibold mb-2">Script File</p>
                                    {candidateDraft?.scriptType === 'brand' ? (
                                        scriptFile ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl border border-[#fedc03]/30 bg-[#fedc03]/5">
                                                <div className="w-10 h-10 rounded-lg bg-[#fedc03]/20 flex items-center justify-center text-[#0a0a0a] shrink-0">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold truncate">{scriptFile.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">Script file ready</p>
                                                </div>
                                                <button
                                                    onClick={() => setScriptFile(null)}
                                                    className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : existingScriptFileKey ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl border border-[#fedc03]/30 bg-[#fedc03]/5">
                                                <div className="w-10 h-10 rounded-lg bg-[#fedc03]/20 flex items-center justify-center text-[#0a0a0a] shrink-0">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold truncate">{existingScriptFileKey.split('/').pop()}</p>
                                                    <p className="text-[10px] text-muted-foreground">From campaign · upload a new one to replace</p>
                                                </div>
                                                <label className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer text-muted-foreground transition-colors" title="Replace script">
                                                    <input
                                                        type="file"
                                                        accept="application/pdf,.doc,.docx,.txt"
                                                        className="sr-only"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0];
                                                            if (f && f.size > 100 * 1024 * 1024) { toast.error('Script file must be under 100MB'); }
                                                            else if (f) setScriptFile(f);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                    <Upload className="w-3.5 h-3.5" />
                                                </label>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-[#fedc03]/40 cursor-pointer transition-all bg-secondary/10 hover:bg-secondary/30 group">
                                                <input
                                                    type="file"
                                                    accept="application/pdf,.doc,.docx,.txt"
                                                    className="sr-only"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f && f.size > 100 * 1024 * 1024) { toast.error('Script file must be under 100MB'); }
                                                        else if (f) setScriptFile(f);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-[#fedc03]/20 group-hover:text-[#0a0a0a] transition-all">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <p className="text-xs font-semibold text-center">Upload script</p>
                                                <p className="text-[10px] text-muted-foreground">PDF, DOCX, TXT · max 100MB</p>
                                            </label>
                                        )
                                    ) : (
                                        <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/10 text-[11px] text-muted-foreground">
                                            Enable by choosing "Brand provides script."
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reference documents */}
                            <div>
                                <p className="text-xs font-semibold mb-2">Reference Documents / Mood Board</p>
                                {referenceFiles.length === 0 ? (
                                    <label className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-[#fedc03]/40 cursor-pointer transition-all bg-secondary/10 hover:bg-secondary/30 group">
                                        <input
                                            type="file"
                                            accept="application/pdf,image/*,text/*"
                                            multiple
                                            className="sr-only"
                                            onChange={(e) => {
                                                setReferenceFiles(Array.from(e.target.files || []));
                                                e.target.value = '';
                                            }}
                                        />
                                        <Upload className="w-4 h-4 text-muted-foreground group-hover:text-[#0a0a0a] transition-colors" />
                                        <span className="text-xs text-muted-foreground">Upload references — PDF, images, or text · multiple allowed</span>
                                    </label>
                                ) : (
                                    <div className="space-y-2">
                                        {referenceFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/20">
                                                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span className="text-xs flex-1 truncate">{f.name}</span>
                                                <button
                                                    onClick={() => setReferenceFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                    className="p-1 rounded hover:text-destructive text-muted-foreground transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors pt-1">
                                            <input
                                                type="file"
                                                accept="application/pdf,image/*,text/*"
                                                multiple
                                                className="sr-only"
                                                onChange={(e) => {
                                                    setReferenceFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <Upload className="w-3 h-3" /> Add more files
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extra context */}
                        <div className="bg-card border border-border rounded-2xl p-3">
                            <p className="text-xs font-semibold mb-2">Anything else to add?</p>
                            <textarea
                                value={step2Extra}
                                onChange={(e) => {
                                    setStep2Extra(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                rows={2}
                                style={{ minHeight: '60px' }}
                                placeholder="Creator style, language preferences, must-avoid topics..."
                                className="w-full p-2.5 rounded-xl border border-border bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 overflow-hidden"
                            />
                        </div>

                        {/* Missing Fields Warning - Shows when required fields are incomplete */}
                        {missingFields.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-amber-900">Missing Required Fields</p>
                                        <p className="text-[10px] text-amber-800 mt-1 mb-2">Please fill in the following before building the strategy:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {missingFields.map((field) => (
                                                <span key={field} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-medium">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upload Requirements Warning */}
                        {missingRequiredUploads && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-amber-900">Missing Required Uploads</p>
                                        <p className="text-[10px] text-amber-800 mt-1">{buildBlockReason}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Campaign Summary - Shows when all fields are complete */}
                        {missingFields.length === 0 && !missingRequiredUploads && (
                            <div className="bg-linear-to-br from-[#fedc03]/10 to-[#fedc03]/5 border border-[#fedc03]/40 rounded-2xl p-4">
                                <div className="flex items-start gap-2 mb-3">
                                    <Check className="w-4 h-4 text-[#1D9E75] shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-bold text-sm">Campaign Ready to Launch 🚀</h3>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">All details are complete. Review the summary below, then click Build Strategy to generate your creator mix & reach estimates.</p>
                                    </div>
                                </div>

                                <div className="space-y-2 bg-card/50 rounded-lg p-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Campaign Type</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.type || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Platform</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.platform || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Objective</p>
                                            <p className="text-xs font-semibold">{candidateDraft?.objective || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Budget</p>
                                            <p className="text-xs font-semibold">{candidateDraft?.totalBudget ? `₹${toNumber(candidateDraft.totalBudget).toLocaleString('en-IN')}` : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Niche</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.niche || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Location</p>
                                            <p className="text-xs font-semibold">{candidateDraft?.location || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Script Type</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.scriptType === 'brand' ? 'Brand Provided' : 'Creator Creates'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Posting Type</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.postingType === 'brand' ? 'Brand Posts' : 'Creator Posts'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Budget Mode</p>
                                            <p className="text-xs font-semibold capitalize">{candidateDraft?.budgetMode === 'paid' ? 'Paid' : candidateDraft?.budgetMode === 'product' ? 'Product Only' : 'Paid + Product'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Deadline Strategy</p>
                                            <p className="text-xs font-semibold">{candidateDraft?.deadlineMode === 'individual' ? 'Individual (per creator)' : 'Common'}</p>
                                        </div>
                                        {candidateDraft?.deadlineMode !== 'individual' && (
                                            <>
                                                <div>
                                                    <p className="text-[8px] uppercase text-muted-foreground font-semibold">Applications Close</p>
                                                    <p className="text-xs font-semibold">{candidateDraft?.applicationDeadline || '—'}</p>
                                                </div>
                                                {candidateDraft?.scriptType !== 'brand' && (
                                                    <div>
                                                        <p className="text-[8px] uppercase text-muted-foreground font-semibold">Scripts Due</p>
                                                        <p className="text-xs font-semibold">{candidateDraft?.scriptDeadline || '—'}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[8px] uppercase text-muted-foreground font-semibold">Content Goes Live</p>
                                                    <p className="text-xs font-semibold">{candidateDraft?.workDeadline || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] uppercase text-muted-foreground font-semibold">Proof Deadline</p>
                                                    <p className="text-xs font-semibold">{candidateDraft?.proofOfWorkDeadline || '—'}</p>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <p className="text-[8px] uppercase text-muted-foreground font-semibold">Site Visit</p>
                                            <p className="text-xs font-semibold">
                                                {candidateDraft?.visitAtSiteEnabled
                                                    ? `Yes${candidateDraft?.visitAtSiteDate ? ` · ${candidateDraft.visitAtSiteDate}` : ''}`
                                                    : 'No'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setStage('step1')} className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                                </button>
                                <button onClick={handleStartOver} className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                    Clear Info
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                {strategy && finalDraft && (
                                    <button
                                        onClick={() => setStage('step4')}
                                        className="px-3 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-secondary transition-colors"
                                    >
                                        View strategy
                                    </button>
                                )}
                                <button
                                    onClick={handleStep2Build}
                                    disabled={isThinking || missingFields.length > 0 || missingRequiredUploads}
                                    title={missingFields.length > 0 ? `Please complete: ${missingFields.join(', ')}` : missingRequiredUploads ? buildBlockReason : undefined}
                                    className="px-5 py-2.5 rounded-xl bg-[#fedc03] text-black text-sm font-semibold hover:bg-[#f0d000] transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                                >
                                    {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Build strategy
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right panel — sticky at top, scrolls independently */}
                    <div className="self-start sticky top-4 max-h-[calc(100dvh-200px)] overflow-y-auto custom-scrollbar">
                        <FieldPanel />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={rootRef} className="w-full mx-auto px-4 animate-fade-in flex flex-col pb-4 flex-1 min-h-0">
            <div className="shrink-0 mb-2">
                <StepHeader />
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr,320px] gap-6 min-h-0 px-2 items-start">
                {/* Chat Container — flex column so messages scroll and input stays pinned */}
                <div className="bg-card border border-border rounded-2xl flex flex-col shadow-sm overflow-hidden sticky top-24 md:h-[calc(100dvh-200px)] h-[calc(100dvh-220px)] min-h-[500px]">
                    {/* Chat Header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card">
                        <div className="w-9 h-9 rounded-xl bg-[#fedc03] text-black flex items-center justify-center font-bold text-sm shadow">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold">MutinyX AI Strategist</h2>
                            <p className="text-[11px] text-muted-foreground">Describe your campaign naturally — I'll build the strategy</p>
                        </div>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-secondary transition-colors flex items-center gap-1.5"
                            title="View chat history"
                        >
                            <History className="w-3.5 h-3.5" />
                            History
                        </button>
                        <button
                            onClick={handleStartOver}
                            className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-secondary transition-colors"
                        >
                            New chat
                        </button>
                    </div>

                    {/* Messages — scrollable area, input bar is pinned below */}
                    <div
                        ref={messagesContainerRef}
                        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                    >
                        {chatTranscript.length === 0 ? (
                            <>
                                <ChatBubble
                                    role="assistant"
                                    content={`Hey ${user?.name?.split(' ')[0] || 'there'}! Tell me about your campaign idea — product, audience, budget, goal. The more you share upfront, the fewer questions I need to ask.`}
                                />
                                {/* Quick-start prompts shown inside the message stream */}
                                <div className="px-4 pt-3">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Try an example</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {SAMPLE_PROMPTS.map((sample) => (
                                            <button
                                                key={sample}
                                                onClick={() => setPromptText(sample)}
                                                className="text-left p-3 rounded-xl border border-border bg-card hover:border-[#fedc03]/50 hover:bg-[#fedc03]/5 transition-all text-[11px] leading-relaxed text-muted-foreground"
                                            >
                                                {sample}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            chatTranscript.map((m, idx) => (
                                <ChatBubble key={`${m.role}-${idx}`} role={m.role} content={m.content} />
                            ))
                        )}
                        {/* All follow-up questions grouped inside one AI bubble */}
                        {questionFlowMode === 'awaiting-consent' && candidateDraft && !isThinking && (
                            <div className="flex w-full gap-3 px-4 py-1 justify-start">
                                <div className="w-8 h-8 rounded-full bg-[#fedc03] text-black flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 shadow">
                                    M
                                </div>
                                <div className="max-w-[82%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground rounded-bl-sm shadow-sm space-y-3">
                                    <p className="text-sm text-muted-foreground">Does this look right so far?</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => applyConsentChoice(true)}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-[#fedc03] bg-[#fedc03] text-black"
                                        >
                                            Yes, continue
                                        </button>
                                        <button
                                            onClick={() => applyConsentChoice(false)}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background text-muted-foreground hover:border-[#fedc03]/40 hover:text-foreground"
                                        >
                                            No, I want changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {questionFlowMode === 'auto' && candidateDraft && questions.length > 0 && !isThinking && (
                            <div className="flex w-full gap-3 px-4 py-1 justify-start">
                                <div className="w-8 h-8 rounded-full bg-[#fedc03] text-black flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 shadow">
                                    M
                                </div>
                                <div className="max-w-[82%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground rounded-bl-sm shadow-sm space-y-4">
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {/* Honest copy. This used to always read "Just one more thing to lock in
                                            your campaign" whenever exactly ONE question was queued — including on
                                            the very first question, when nothing at all had been captured. It is
                                            keyed to how much is genuinely known, not to the question count. */}
                                        {getMissingFields(mergedCandidate).length <= 2
                                            ? 'Just one more thing to lock in your campaign:'
                                            : 'To shape this properly:'}
                                    </p>
                                    {questions.map((q, qi) => (
                                        <div key={q.id} className={cn('space-y-2', qi > 0 && 'pt-3 border-t border-border/60')}>
                                            <p className="text-sm font-semibold">{q.q}</p>
                                            {q.suggestion && q.inputType !== 'textarea' && (
                                                <p className="text-[11px] text-muted-foreground italic">{q.suggestion}</p>
                                            )}
                                            {q.inputType === 'currency' ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-semibold text-muted-foreground">₹</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        placeholder="e.g. 150000"
                                                        value={questionAnswers[q.id] ?? ''}
                                                        onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const newAnswers = { ...questionAnswers, [q.id]: (e.target as HTMLInputElement).value };
                                                                const allNowAnswered = questions.every(qu => !!newAnswers[qu.id]);
                                                                if (allNowAnswered) handleAutoSubmitQA(newAnswers, questions);
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            const newAnswers = { ...questionAnswers, [q.id]: e.target.value };
                                                            const allNowAnswered = questions.every(qu => !!newAnswers[qu.id]);
                                                            if (allNowAnswered) handleAutoSubmitQA(newAnswers, questions);
                                                        }}
                                                        className="w-full max-w-[180px] p-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                                    />
                                                </div>
                                            ) : q.inputType === 'textarea' ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        rows={3}
                                                        placeholder="Describe the campaign for creators..."
                                                        value={questionAnswers[q.id] ?? (q.suggestion || '')}
                                                        onChange={(e) => {
                                                            setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                                                            e.target.style.height = 'auto';
                                                            e.target.style.height = e.target.scrollHeight + 'px';
                                                        }}
                                                        style={{ minHeight: '80px' }}
                                                        className="w-full p-2.5 rounded-xl border border-border bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30 overflow-hidden"
                                                    />
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {q.opts.map((opt) => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => {
                                                                    const newAnswers = { ...questionAnswers, [q.id]: opt };
                                                                    setQuestionAnswers(newAnswers);
                                                                    const allNowAnswered = questions.every(qu => !!newAnswers[qu.id]);
                                                                    if (allNowAnswered) handleAutoSubmitQA(newAnswers, questions);
                                                                }}
                                                                className={cn(
                                                                    'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                                                                    questionAnswers[q.id] === opt
                                                                        ? 'bg-[#fedc03] border-[#fedc03] text-black'
                                                                        : 'border-border bg-card text-muted-foreground hover:border-[#fedc03]/40 hover:text-foreground'
                                                                )}
                                                            >{opt}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : q.opts.length === 0 ? (
                                                <input
                                                    type="date"
                                                    value={
                                                        questionAnswers[q.id]
                                                        ?? (q.id === 'scriptDeadline' ? (candidateDraft?.scriptDeadline ?? '')
                                                            : q.id === 'applicationDeadline' ? (candidateDraft?.applicationDeadline ?? '')
                                                                : q.id === 'workDeadline' ? (candidateDraft?.workDeadline ?? '')
                                                                    : '')
                                                    }
                                                    onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                                    className="w-full max-w-[200px] p-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-[#fedc03]/30"
                                                />
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {q.opts.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => {
                                                                const newAnswers = { ...questionAnswers, [q.id]: opt };
                                                                setQuestionAnswers(newAnswers);
                                                                const allNowAnswered = questions.every(qu => !!newAnswers[qu.id]);
                                                                if (allNowAnswered) handleAutoSubmitQA(newAnswers, questions);
                                                            }}
                                                            className={cn(
                                                                'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                                                                questionAnswers[q.id] === opt
                                                                    ? 'bg-[#fedc03] border-[#fedc03] text-black'
                                                                    : 'border-border bg-background text-muted-foreground hover:border-[#fedc03]/40 hover:text-foreground'
                                                            )}
                                                        >{opt}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {q.helpText && (
                                                <p className="text-[11px] text-muted-foreground">{q.helpText}</p>
                                            )}
                                        </div>
                                    ))}

                                    {/* Selecting the last answer auto-submits — no continue button needed */}
                                </div>
                            </div>
                        )}
                        {awaitingSummaryContinue && !isThinking && (
                            <div className="flex w-full gap-3 px-4 py-1 justify-start">
                                <div className="w-8 h-8 shrink-0" />
                                <button
                                    onClick={() => { setAwaitingSummaryContinue(false); setStage('step2'); }}
                                    className="px-4 py-2 rounded-xl bg-[#fedc03] text-black text-xs font-semibold hover:bg-[#f0d000] transition-colors inline-flex items-center gap-1.5"
                                >
                                    Review details & build strategy
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {isThinking && (
                            <div className="flex gap-3 px-4 py-1">
                                <div className="w-8 h-8 rounded-full bg-[#fedc03] flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-black" />
                                </div>
                                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Bar — shrink-0 keeps it firmly pinned at the bottom */}
                    <div className="shrink-0 border-t border-border bg-card p-4">
                        <div className="flex items-end gap-3 bg-background border border-border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#fedc03]/30 focus-within:border-[#fedc03]/50 transition-all">
                            <textarea
                                ref={promptInputRef}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (!isThinking && !isLoadingSession && promptText.trim()) handleStep1Continue();
                                    }
                                }}
                                rows={1}
                                placeholder="Describe your campaign idea... (Enter to send, Shift+Enter for new line)"
                                style={{ minHeight: '44px', maxHeight: '200px', overflowY: 'hidden' }}
                                className="flex-1 bg-transparent text-sm resize-none focus:outline-none focus:ring-0 custom-scrollbar py-1"
                            />
                            <button
                                onClick={handleStep1Continue}
                                disabled={isThinking || isLoadingSession || !promptText.trim()}
                                className="shrink-0 w-9 h-9 rounded-lg bg-[#fedc03] text-black flex items-center justify-center hover:bg-[#f0d000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                title={!promptText.trim() ? 'Please type a message to start the chat' : undefined}
                            >
                                {isThinking || isLoadingSession
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                            {!promptText.trim() ? 'Type a message to start the chat' : (!isInitialPromptSufficient(promptText) ? 'Short messages allowed — AI will ask clarifying questions' : 'Shift + Enter for new line · Enter to send')}
                        </p>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-4 pr-1 sticky top-24 max-h-[calc(100dvh-200px)] overflow-y-auto custom-scrollbar">
                    <div className="bg-card border border-border rounded-2xl p-4 shrink-0">
                        <button
                            onClick={handleContinueWithAvailableDetails}
                            disabled={messages.length === 0}
                            title={messages.length === 0 ? 'Start the chat first to extract campaign details' : undefined}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#fedc03] text-black text-sm font-semibold hover:bg-[#f0d000] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#fedc03]"
                        >
                            Continue with available details
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        {messages.length === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center mt-2">Start the chat above first</p>
                        )}
                    </div>

                    {!isConversational && <FieldPanel />}

                    {sessions && sessions.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="px-4 pt-4 pb-2 border-b border-border">
                                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" /> Recent
                                </p>
                            </div>
                            <div className="p-2 space-y-0.5">
                                {sessions.slice(0, 4).map((session) => (
                                    <button
                                        key={session.id}
                                        onClick={() => loadSession(session)}
                                        disabled={isLoadingSession}
                                        className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium truncate">{session.title || 'Campaign chat'}</p>
                                            <p className="text-[10px] text-muted-foreground">{timeAgo(session.updatedAt)}</p>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* AI History Modal */}
            <AIHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                sessions={sessions || []}
                isLoading={false}
                onSessionSelect={loadSession}
                onSessionDelete={async (sessionId: string) => {
                    await deleteChatSession.mutateAsync(sessionId);
                }}
                currentSessionId={sessionId || undefined}
            />
        </div>
    );
}
