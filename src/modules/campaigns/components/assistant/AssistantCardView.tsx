import { Users, Wallet, Sparkles, BarChart3, FileText } from 'lucide-react';
import type { AssistantCard, AssistantCardType } from '@/shared/types/assistant';

/**
 * Renders a structured card the assistant produced via `present_card`.
 *
 * Every value shown here came from a real tool result — the server rejects a card citing data
 * it never looked up — so these are safe to display as fact rather than as a suggestion.
 */

const CARD_ICONS: Record<AssistantCardType, React.ElementType> = {
    creator_shortlist: Users,
    budget_breakdown: Wallet,
    campaign_preview: FileText,
    strategy: Sparkles,
    performance: BarChart3,
};

function fmtINR(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtCompact(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            <span className="text-xs font-medium text-right">{value}</span>
        </div>
    );
}

function CreatorShortlist({ body }: { body: Record<string, unknown> }) {
    const creators = Array.isArray(body.creators) ? body.creators : [];
    return (
        <div className="space-y-2">
            {creators.map((raw, i) => {
                const c = raw as Record<string, unknown>;
                return (
                    <div key={String(c.influencerId ?? i)} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/50">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold truncate">{String(c.name ?? 'Creator')}</span>
                                {c.handle ? <span className="text-xs text-muted-foreground truncate">@{String(c.handle)}</span> : null}
                                {c.tier ? (
                                    <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-background border border-border">
                                        {String(c.tier)}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                <span>{fmtCompact(c.followers)} followers</span>
                                {c.engagementRate != null ? <span>{Number(c.engagementRate).toFixed(1)}% eng</span> : null}
                                {c.fee != null ? <span className="font-medium text-foreground">{fmtINR(c.fee)}</span> : null}
                            </div>
                            {c.reason ? <p className="text-[11px] text-muted-foreground mt-1">{String(c.reason)}</p> : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function BudgetBreakdown({ body }: { body: Record<string, unknown> }) {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    return (
        <div className="space-y-2">
            {rows.map((raw, i) => {
                const r = raw as Record<string, unknown>;
                return (
                    <div key={i} className="p-2.5 rounded-lg bg-secondary/50">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold capitalize">
                                {String(r.tier ?? '')} × {String(r.count ?? 0)}
                            </span>
                            <span className="text-sm font-bold">{fmtINR(r.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{fmtINR(r.unitFee)} each</span>
                        </div>
                        {/* The provenance line is the point of this card — a fallback estimate
                            must never be presented with the same authority as measured data. */}
                        {r.basis ? <p className="text-[10px] text-muted-foreground mt-1 italic">{String(r.basis)}</p> : null}
                    </div>
                );
            })}
            {body.totalBudget != null ? (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs font-semibold">Total budget</span>
                    <span className="text-sm font-bold">{fmtINR(body.totalBudget)}</span>
                </div>
            ) : null}
            {body.note ? <p className="text-[11px] text-muted-foreground">{String(body.note)}</p> : null}
        </div>
    );
}

function CampaignPreview({ body }: { body: Record<string, unknown> }) {
    const niche = Array.isArray(body.niche) ? body.niche.join(', ') : String(body.niche ?? '—');
    const contentTypes = Array.isArray(body.contentTypes) ? body.contentTypes.join(', ') : String(body.contentTypes ?? '—');
    return (
        <div>
            {body.description ? <p className="text-xs text-muted-foreground mb-3">{String(body.description)}</p> : null}
            <Row label="Type" value={<span className="capitalize">{String(body.type ?? '—')}</span>} />
            <Row label="Platform" value={<span className="capitalize">{String(body.platform ?? '—')}</span>} />
            <Row label="Niche" value={niche} />
            <Row label="Location" value={String(body.location ?? '—')} />
            <Row label="Deliverables" value={contentTypes} />
            <Row label="Script" value={<span className="capitalize">{String(body.scriptType ?? '—')}</span>} />
            <Row label="Posting" value={<span className="capitalize">{String(body.postingType ?? '—')}</span>} />
            {body.totalBudget != null ? <Row label="Budget" value={fmtINR(body.totalBudget)} /> : null}
        </div>
    );
}

function StringList({ title, items }: { title: string; items: unknown }) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</p>
            <ul className="space-y-1">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{String(item)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function StrategyBody({ body }: { body: Record<string, unknown> }) {
    return (
        <div>
            {body.thesis ? <p className="text-xs text-muted-foreground">{String(body.thesis)}</p> : null}
            <StringList title="Hooks" items={body.hooks} />
            <StringList title="Content ideas" items={body.contentIdeas} />
            <StringList title="Recommendations" items={body.recommendations} />
        </div>
    );
}

function PerformanceBody({ body }: { body: Record<string, unknown> }) {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    return (
        <div>
            {rows.map((raw, i) => {
                const r = raw as Record<string, unknown>;
                return (
                    <Row
                        key={i}
                        label={String(r.campaignName ?? 'Campaign')}
                        value={`${fmtCompact(r.reach)} reach · ${r.engagementRate != null ? `${Number(r.engagementRate).toFixed(1)}%` : '—'}`}
                    />
                );
            })}
        </div>
    );
}

export function AssistantCardView({ card }: { card: AssistantCard }) {
    const Icon = CARD_ICONS[card.type] ?? FileText;
    const body = (card.body ?? {}) as Record<string, unknown>;

    return (
        <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold">{card.title}</h4>
            </div>

            {card.type === 'creator_shortlist' && <CreatorShortlist body={body} />}
            {card.type === 'budget_breakdown' && <BudgetBreakdown body={body} />}
            {card.type === 'campaign_preview' && <CampaignPreview body={body} />}
            {card.type === 'strategy' && <StrategyBody body={body} />}
            {card.type === 'performance' && <PerformanceBody body={body} />}

            {card.sources?.length > 0 ? (
                <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
                    From {card.sources.map((s) => s.replace(/_/g, ' ')).join(', ')}
                </p>
            ) : null}
        </div>
    );
}
