import { describe, it, expect, beforeEach } from 'vitest';
import {
    introCacheKey,
    parseCachedIntro,
    readCachedIntro,
    writeCachedIntro,
    sameIntro,
    type CachedIntro,
} from './assistantIntroCache';

const INTRO: CachedIntro = {
    heading: "What's next for Spotmies, Raju?",
    subtitle: undefined,
    starters: [
        { label: 'Start our next campaign', prompt: 'Create our next Instagram campaign in Food & Beverage.' },
        { label: 'Beat our record', prompt: 'Build the campaign that beats everything we have run.' },
    ],
};

describe('introCacheKey', () => {
    it('separates brands so a switched brand never inherits the previous screen', () => {
        expect(introCacheKey('brand-a')).not.toBe(introCacheKey('brand-b'));
    });

    it('separates create scope from a campaign-scoped panel', () => {
        expect(introCacheKey('brand-a')).not.toBe(introCacheKey('brand-a', 'camp-1'));
    });

    it('is null without a brand, so nothing is cached under an unknown owner', () => {
        expect(introCacheKey(null)).toBeNull();
        expect(introCacheKey(undefined)).toBeNull();
    });
});

describe('parseCachedIntro', () => {
    it('round-trips a real intro', () => {
        expect(parseCachedIntro(JSON.stringify(INTRO))).toEqual({ ...INTRO, subtitle: undefined });
    });

    it('rejects junk rather than rendering it', () => {
        expect(parseCachedIntro(null)).toBeNull();
        expect(parseCachedIntro('not json')).toBeNull();
        expect(parseCachedIntro('null')).toBeNull();
        expect(parseCachedIntro('"a string"')).toBeNull();
    });

    it('rejects an entry with no usable starters — the empty state would have no cards', () => {
        expect(parseCachedIntro(JSON.stringify({ heading: 'Hi', starters: [] }))).toBeNull();
        expect(parseCachedIntro(JSON.stringify({ heading: 'Hi' }))).toBeNull();
    });

    it('rejects a stale format where a starter lost a field', () => {
        expect(parseCachedIntro(JSON.stringify({ heading: 'Hi', starters: [{ label: 'x' }] }))).toBeNull();
    });

    it('rejects a blank heading, which would render an empty title', () => {
        expect(parseCachedIntro(JSON.stringify({ ...INTRO, heading: '' }))).toBeNull();
    });
});

describe('read/write', () => {
    beforeEach(() => localStorage.clear());

    it('returns what was written for the same brand and scope', () => {
        writeCachedIntro('brand-a', undefined, INTRO);
        expect(readCachedIntro('brand-a')).toEqual({ ...INTRO, subtitle: undefined });
    });

    it('does not leak one brand screen to another', () => {
        writeCachedIntro('brand-a', undefined, INTRO);
        expect(readCachedIntro('brand-b')).toBeNull();
    });

    it('does not serve the create-scope screen to a campaign-scoped panel', () => {
        writeCachedIntro('brand-a', undefined, INTRO);
        expect(readCachedIntro('brand-a', 'camp-1')).toBeNull();
    });

    it('writes nothing when there is no brand', () => {
        writeCachedIntro(null, undefined, INTRO);
        expect(localStorage.length).toBe(0);
    });
});

describe('sameIntro', () => {
    it('is true for identical content, so a no-op refresh does not re-render the cards', () => {
        expect(sameIntro(INTRO, JSON.parse(JSON.stringify(INTRO)))).toBe(true);
    });

    it('treats a missing subtitle and an empty one as the same', () => {
        expect(sameIntro({ ...INTRO, subtitle: undefined }, { ...INTRO, subtitle: '' })).toBe(true);
    });

    it('detects a changed heading', () => {
        expect(sameIntro(INTRO, { ...INTRO, heading: 'Something else' })).toBe(false);
    });

    it('detects a reorder — the server ranks starters, so order is meaning', () => {
        expect(sameIntro(INTRO, { ...INTRO, starters: [...INTRO.starters].reverse() })).toBe(false);
    });

    it('detects a changed prompt behind an unchanged label', () => {
        const changed = { ...INTRO, starters: [{ ...INTRO.starters[0], prompt: 'different' }, INTRO.starters[1]] };
        expect(sameIntro(INTRO, changed)).toBe(false);
    });

    it('is false when either side is missing', () => {
        expect(sameIntro(null, INTRO)).toBe(false);
        expect(sameIntro(INTRO, null)).toBe(false);
        expect(sameIntro(null, null)).toBe(true);
    });
});
