/**
 * Last-known opening screen, per brand, so reopening the panel does not flash a generic
 * screen at a brand the assistant already knows.
 *
 * The intro is computed server-side from the brand's whole campaign history, which takes a
 * second or two on a cold snapshot cache. The panel used to fill that gap with a brand-neutral
 * fallback ("Let's build a campaign" + four generic prompts) and then swap in the real one —
 * so every open showed the user two different screens, the first of which said the assistant
 * did not know them.
 *
 * Caching turns that into a single render for every visit after the first: the brand's own
 * starters paint immediately, the request still goes out, and the result is applied ONLY if it
 * actually differs. `sameIntro` is what keeps a refresh that returns identical content from
 * re-rendering the cards under the user's cursor.
 *
 * Keyed by brand AND scope: an agency head switching brands must not inherit the previous
 * brand's screen, and a campaign-scoped panel gets manage-shaped starters the create-scoped
 * one never has.
 */

export interface CachedStarter {
    label: string;
    prompt: string;
}

export interface CachedIntro {
    heading: string;
    subtitle?: string;
    starters: CachedStarter[];
}

const PREFIX = 'mutiny_assistant_intro';

export function introCacheKey(brandId: string | null | undefined, campaignId?: string): string | null {
    // No brand means no way to tell whose screen this is. Better to show the loading state
    // every time than to serve one brand's history to another.
    if (!brandId) return null;
    return `${PREFIX}:${brandId}:${campaignId ?? 'new'}`;
}

/** Shape-checked on the way out: a half-written or stale-format entry must not reach render. */
export function parseCachedIntro(raw: string | null): CachedIntro | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const candidate = parsed as Partial<CachedIntro>;
        if (typeof candidate.heading !== 'string' || !candidate.heading) return null;
        if (!Array.isArray(candidate.starters) || candidate.starters.length === 0) return null;
        const starters = candidate.starters.filter(
            (s): s is CachedStarter =>
                Boolean(s) && typeof s === 'object'
                && typeof (s as CachedStarter).label === 'string'
                && typeof (s as CachedStarter).prompt === 'string',
        );
        if (starters.length !== candidate.starters.length) return null;
        return {
            heading: candidate.heading,
            subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined,
            starters,
        };
    } catch {
        return null;
    }
}

export function readCachedIntro(brandId: string | null | undefined, campaignId?: string): CachedIntro | null {
    const key = introCacheKey(brandId, campaignId);
    if (!key) return null;
    try {
        return parseCachedIntro(localStorage.getItem(key));
    } catch {
        // Private mode / storage disabled. The panel still works, it just loads cold.
        return null;
    }
}

export function writeCachedIntro(
    brandId: string | null | undefined,
    campaignId: string | undefined,
    intro: CachedIntro,
): void {
    const key = introCacheKey(brandId, campaignId);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(intro));
    } catch {
        // Quota or disabled storage — the cache is an optimisation, never a requirement.
    }
}

/**
 * True when the freshly fetched intro says exactly what is already on screen.
 *
 * Order matters here on purpose: the server ranks starters by relevance, so a reordering IS a
 * change worth showing.
 */
export function sameIntro(a: CachedIntro | null, b: CachedIntro | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.heading !== b.heading) return false;
    if ((a.subtitle ?? '') !== (b.subtitle ?? '')) return false;
    if (a.starters.length !== b.starters.length) return false;
    return a.starters.every((s, i) => s.label === b.starters[i].label && s.prompt === b.starters[i].prompt);
}
