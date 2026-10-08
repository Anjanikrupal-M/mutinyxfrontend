import { describe, it, expect } from 'vitest';
import { audienceMatchShare, hasAudienceTarget } from './audienceMatch';

const audience = {
    age: { '18-24': 0.4, '25-34': 0.35, '35-44': 0.25 },
    gender: { F: 0.6, M: 0.38, U: 0.02 },
    cities: { 'Mumbai, Maharashtra': 0.3, 'Pune, Maharashtra': 0.1 },
    collectedAt: '2026-10-01T00:00:00.000Z',
};

describe('audienceMatchShare', () => {
    it('multiplies age, gender and city shares', () => {
        const share = audienceMatchShare(audience, { targetAgeRanges: ['18-24', '25-34'], targetGender: 'female', targetLocations: ['Mumbai, Maharashtra'] });
        expect(share).toBeCloseTo(0.75 * 0.6 * 0.3);
    });

    it('ignores dimensions the campaign does not target', () => {
        expect(audienceMatchShare(audience, { targetAgeRanges: ['35-44'], targetGender: 'all', targetLocations: [] })).toBeCloseTo(0.25);
    });

    it('returns null without demographics', () => {
        expect(audienceMatchShare(null, { targetAgeRanges: ['18-24'] })).toBeNull();
        expect(audienceMatchShare({ ...audience, cities: {} }, { targetLocations: ['Pune, Maharashtra'] })).toBeNull();
    });

    it('detects whether a target is set', () => {
        expect(hasAudienceTarget({ targetGender: 'all' })).toBe(false);
        expect(hasAudienceTarget({ targetGender: 'male' })).toBe(true);
    });
});
