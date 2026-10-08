import { describe, it, expect } from 'vitest';
import { hasSubstantiveBrief } from './AIStrategistChat';

const user = (...texts: string[]) => texts.map((content) => ({ role: 'user' as const, content }));

/**
 * Guards the gate that decides whether the chat may ask targeted follow-ups (creative style,
 * niche, budget). It must key off what the USER said — the previous gate read the model-filled
 * draft, which is populated on every turn, so the creative-style card fired on "hello".
 */
describe('hasSubstantiveBrief', () => {
    it('is false for messages that state intent but describe nothing', () => {
        expect(hasSubstantiveBrief(user('hello'))).toBe(false);
        expect(hasSubstantiveBrief(user('hi'))).toBe(false);
        expect(hasSubstantiveBrief(user('i want to create a campaign'))).toBe(false);
        expect(hasSubstantiveBrief(user('i want a new campaign'))).toBe(false);
        expect(hasSubstantiveBrief(user('create a campaign'))).toBe(false);
        expect(hasSubstantiveBrief(user('help me'))).toBe(false);
    });

    it('stays false when several content-free messages are combined', () => {
        expect(hasSubstantiveBrief(user('i want to create a campaign', 'hello'))).toBe(false);
    });

    it('is true once the user actually describes something', () => {
        expect(hasSubstantiveBrief(user('i want to promote my new movie in hyderabad'))).toBe(true);
        expect(hasSubstantiveBrief(user('Diwali jewellery campaign on Instagram, 2.2L, Mumbai'))).toBe(true);
        expect(hasSubstantiveBrief(user('protein bar launch, ugc videos, fitness audience'))).toBe(true);
    });

    it('is true when a content-free opener is followed by a real brief', () => {
        expect(hasSubstantiveBrief(user('hello', 'promoting a telugu movie releasing next month'))).toBe(true);
    });

    it('ignores assistant messages entirely', () => {
        const msgs = [
            { role: 'assistant' as const, content: 'Describe your campaign idea and I will architect a strategy for you.' },
            { role: 'user' as const, content: 'hello' },
        ];
        expect(hasSubstantiveBrief(msgs)).toBe(false);
    });
});
