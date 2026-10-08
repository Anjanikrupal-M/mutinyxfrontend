// Deterministic, low-saturation avatar background palette — keeps gold reserved
// as the single accent color while still giving each conversation a distinct identity.
const AVATAR_PALETTE = ['#5B7C99', '#B5674A', '#6B8F71', '#7A5C7E', '#55606B', '#8A7150'];

export function getAvatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
