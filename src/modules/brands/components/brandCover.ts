// Each brand gets its own cover wash (picked from the brand id) under its blurred logo, so
// brands are told apart at a glance on the Brands list and the brand detail hero.
// Soft, warm tones only — yellow stays the accent.
const COVER_TINTS = [
    'from-brand/35 to-brand/5',
    'from-amber-200/70 to-orange-50',
    'from-stone-300/70 to-stone-50',
    'from-orange-200/60 to-amber-50',
    'from-neutral-300/70 to-neutral-50',
    'from-yellow-200/70 to-lime-50',
];

export function coverTint(id: string) {
    let hash = 0;
    for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return COVER_TINTS[hash % COVER_TINTS.length];
}
