// ─────────────────────────────────────────────────────────────
// Example campaign shown in the builder's phone preview before the
// brand has entered anything, so the preview demonstrates the
// result instead of sitting empty. The poster is an inline SVG.
// ─────────────────────────────────────────────────────────────

const EXAMPLE_POSTER = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2b2f"/><stop offset="1" stop-color="#0c0c0d"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><circle cx="235" cy="85" r="120" fill="#facb03"/><circle cx="60" cy="330" r="90" fill="#facb03" opacity=".18"/><text x="26" y="300" font-family="Arial, sans-serif" font-weight="800" font-size="46" fill="#fff">DIWALI</text><text x="26" y="344" font-family="Arial, sans-serif" font-weight="800" font-size="46" fill="#facb03">LAUNCH</text><text x="28" y="372" font-family="Arial, sans-serif" font-size="15" fill="#fff" opacity=".7">Festive offer · 20% off</text></svg>`,
)}`;

export const EXAMPLE_CAMPAIGN_PREVIEW = {
    name: 'Diwali Launch Offer',
    brief: "We're launching our festive collection. Show your favourite pick in a real setting and mention the 20% launch offer.",
    banner: EXAMPLE_POSTER,
    isPrivate: false,
    categories: ['Fashion & Beauty', 'Lifestyle'],
    tiers: ['Micro'],
    location: 'Pan India',
    openTo: 'All creators',
    usageRights: '30 days',
    script: 'Written by Creator',
    applied: 128,
    budget: 25000,
};
