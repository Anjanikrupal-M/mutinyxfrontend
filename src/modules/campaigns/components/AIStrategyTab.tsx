import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Calendar, Users, BarChart3, Check, Wallet, Lightbulb, Loader2 } from 'lucide-react';
import type { Campaign, AICampaignStrategy } from '@/shared/types/campaign';
import http from '@/core/http';
import { API } from '@/core/api';
import { ApiImage } from '@/shared/components/ApiImage';
import { Link } from 'react-router-dom';

interface Props {
    campaign: Campaign;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <Icon className="w-5 h-5 text-[#fedc03]" />
            <h3 className="font-bold text-lg">{title}</h3>
        </div>
    );
}

/**
 * Creator shortlist matched to the campaign's own targeting.
 *
 * Its own component because it has to render in two places: inside the full strategy view, and
 * on its own for a campaign that has no AI strategy blob. Private campaigns take no
 * applications, so invites are the only way they ever get creators — gating this on a legacy
 * artefact left those campaigns with no suggestions at all.
 */
function RecommendedCreators({ campaign, shortlist, isShortlistLoading, creatorDebug }: {
    campaign: Campaign;
    shortlist: any[];
    isShortlistLoading: boolean;
    creatorDebug: { params: Record<string, unknown>; meta?: any; count: number } | null;
}) {
    return (
        <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={Users} title="Recommended Creators" />
                {campaign.visibility === 'private' && (
                    <Link
                        to={`/campaigns/${campaign.id}/invite`}
                        className="text-xs font-semibold text-[#0a0a0a] hover:underline"
                    >
                        Invite creators
                    </Link>
                )}
            </div>

            {campaign.visibility !== 'private' ? (
                <p className="text-xs text-muted-foreground">
                    Creator invites are available only for private campaigns.
                </p>
            ) : isShortlistLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading creators matched to this brief...
                </div>
            ) : shortlist.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No creators found for this brief yet. Try Invite Creators to refine filters.
                </p>
            ) : (
                <div className="space-y-2">
                    {shortlist.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                            <ApiImage
                                src={c.userAvatarUrl || c.avatarUrl}
                                alt={c.userName || c.name || 'Creator'}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">{c.userName || c.name || c.handle}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {c.handle} · {c.location || c.city || 'India'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase text-muted-foreground">{c.tier || 'micro'}</p>
                                <p className="text-xs font-semibold">
                                    {Math.round((c.followerCount || c.followers || 0) / 1000)}K · {Number(c.engagementRate || 0).toFixed(1)}% ER
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {import.meta.env.MODE !== 'production' && creatorDebug && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
                    <p className="font-semibold text-[11px] mb-1">Debug: creator search</p>
                    <div>Params: {JSON.stringify(creatorDebug.params)}</div>
                    <div>Count: {creatorDebug.count}</div>
                    <div>Meta: {JSON.stringify(creatorDebug.meta)}</div>
                </div>
            )}
        </div>
    );
}

export function AIStrategyTab({ campaign }: Props) {
    const [strategy, setStrategy] = useState<AICampaignStrategy | null>(null);
    const [shortlist, setShortlist] = useState<any[]>([]);
    const [isShortlistLoading, setIsShortlistLoading] = useState(false);
    const [creatorDebug, setCreatorDebug] = useState<{ params: Record<string, unknown>; meta?: any; count: number } | null>(null);

    useEffect(() => {
        // Primary: strategy stored in DB and returned with the campaign object
        if (campaign.aiStrategy) {
            setStrategy(campaign.aiStrategy as AICampaignStrategy);
            return;
        }
        // Fallback: localStorage for campaigns created before DB persistence was added
        try {
            const raw = localStorage.getItem(`mutiny_ai_strategy_${campaign.id}`);
            if (raw) setStrategy(JSON.parse(raw) as AICampaignStrategy);
        } catch {
            // Corrupt storage — leave strategy null
        }
    }, [campaign.id, campaign.aiStrategy]);

    useEffect(() => {
        let cancelled = false;

        const loadShortlist = async () => {
            if (campaign.visibility !== 'private') {
                setShortlist([]);
                return;
            }

            setIsShortlistLoading(true);
            try {
                const params: Record<string, unknown> = { limit: 10 };

                const niches = campaign.niches?.length
                    ? campaign.niches
                    : Array.isArray(campaign.niche)
                        ? campaign.niche
                        : campaign.niche
                            ? [campaign.niche]
                            : [];
                if (niches.length > 0) {
                    params.niche = niches;
                    // Campaign and creator niches are stored in three vocabularies at once
                    // (display labels, canonical slugs, hand-typed variants), so the default
                    // substring match both misses real matches and produces accidental ones.
                    // Canonical resolves every stored spelling through the taxonomy in SQL.
                    params.nicheMatch = 'canonical';
                }

                if (campaign.type === 'twitter') params.platform = 'twitter';
                else if (campaign.platform) params.platform = campaign.platform;

                // The tiers the campaign is actually buying. Without this the shortlist ignored
                // the brief's creator sizes entirely and offered megas for a nano budget.
                if (campaign.creatorSizes?.length) params.tier = campaign.creatorSizes;

                if (campaign.location && campaign.location.toLowerCase() !== 'pan india') {
                    params.location = campaign.location;
                }

                const fetchInfluencers = async (searchParams: Record<string, unknown>) => {
                    const { data } = await http.get(API.discover.search, { params: searchParams });
                    return {
                        list: (data?.data?.influencers ?? data?.data ?? []) as any[],
                        meta: data?.meta,
                    };
                };

                let result = await fetchInfluencers(params);
                if (result.list.length === 0 && (params.niche || params.platform || params.location)) {
                    result = await fetchInfluencers({ limit: 8 });
                }

                if (!cancelled) {
                    setShortlist(result.list.slice(0, 8));
                    setCreatorDebug({ params, meta: result.meta, count: result.list.length });
                }
            } catch {
                if (!cancelled) setShortlist([]);
            } finally {
                if (!cancelled) setIsShortlistLoading(false);
            }
        };

        loadShortlist();
        return () => {
            cancelled = true;
        };
    }, [campaign.id, campaign.visibility, campaign.niches, campaign.niche, campaign.platform, campaign.type, campaign.location, campaign.creatorSizes]);

    /**
     * No strategy blob — but that is not the same as nothing to show.
     *
     * `aiStrategy` is only ever written by the legacy AI Strategist, so every campaign built
     * through the agentic assistant or the step-by-step builder arrives here. This used to
     * return an empty state and stop, which took the creator shortlist down with it: a private
     * campaign, whose ONLY route to creators is inviting them, was left with no suggestions
     * anywhere in the product. The strategy sections genuinely have nothing to render, so they
     * say so — the shortlist renders on its own regardless.
     */
    if (!strategy) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">No AI strategy found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        This campaign was not created through the AI Strategist, so there is no saved strategy to show.
                    </p>
                </div>

                <RecommendedCreators
                    campaign={campaign}
                    shortlist={shortlist}
                    isShortlistLoading={isShortlistLoading}
                    creatorDebug={creatorDebug}
                />
            </div>
        );
    }

    const fmtINR = (n: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-linear-to-br from-[#fedc03]/10 to-[#fedc03]/5 border border-[#fedc03]/30 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#fedc03] flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">AI-Generated Strategy</p>
                        <h2 className="text-xl font-bold leading-snug">{campaign.name}</h2>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{strategy.thesis}</p>
                    </div>
                </div>
            </div>

            {/* Creator Mix Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(strategy.creatorMix?.length
                    ? strategy.creatorMix
                    : estimateMix(Number(campaign.budgetTotal || (campaign.budget as any)?.total || 150000))
                ).map((item) => (
                    <div key={item.tier} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{item.tier} · {item.range}</p>
                        <p className="text-xl font-bold">{item.count} creators</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{fmtINR(item.spend)}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">{item.why}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Why this approach */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={TrendingUp} title="Why This Approach" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{strategy.whyThisApproach}</p>
                    </div>

                    {/* Content strategy */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={Sparkles} title="Content Strategy" />

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

                    {/* Key recommendations */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={Lightbulb} title="Key Recommendations" />
                        <ul className="space-y-4">
                            {strategy.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm">
                                    <span className="mt-0.5 w-6 h-6 rounded-full bg-[#fedc03]/15 text-[#0a0a0a] text-[11px] font-bold flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-muted-foreground leading-relaxed">{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Creator brief */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={Users} title="Creator Brief" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{strategy.creatorBrief}</p>
                    </div>

                    <RecommendedCreators campaign={campaign} shortlist={shortlist} isShortlistLoading={isShortlistLoading} creatorDebug={creatorDebug} />
                </div>

                <div className="space-y-6">
                    {/* Timeline */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={Calendar} title="Campaign Timeline" />
                        <ol className="space-y-3">
                            {strategy.timeline.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm">
                                    <span className="mt-0.5 w-5 h-5 rounded-full bg-[#fedc03]/20 text-[#0a0a0a] text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Budget snapshot */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <SectionHeader icon={Wallet} title="Budget Snapshot" />
                        <div className="space-y-3 text-sm">
                            {campaign.budgetTotal && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Total Budget</span>
                                    <span className="font-semibold">{fmtINR(Number(campaign.budgetTotal))}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Budget Mode</span>
                                <span className="font-semibold capitalize">{campaign.budgetMode === 'paid' ? 'Paid' : campaign.budgetMode === 'product' ? 'Product Only' : 'Paid + Product'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Platform</span>
                                <span className="font-semibold capitalize">{campaign.platform || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Script Type</span>
                                <span className="font-semibold">{campaign.scriptType === 'brand' ? 'Brand Provided' : campaign.scriptType === 'none' ? 'Not Required' : 'Creator Creates'}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

