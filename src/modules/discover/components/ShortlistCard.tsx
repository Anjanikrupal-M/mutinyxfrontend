import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, GitCompareArrows, Plus, X } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';
import { cn } from '@/lib/utils';
import { useBookmarkCollections } from '../hooks/useInfluencers';
import { MAX_COMPARE, useCompareStore } from '../stores/compareStore';

/**
 * "Your shortlist" — the right half of the Influencers hero: how many creators are saved (and
 * in which lists), and who is lined up for side-by-side comparison. Sits beside the Ask AI card
 * so the page opens on "find" next to "what I've found".
 */
export function ShortlistCard({ className }: { className?: string }) {
    const { data: collectionsData } = useBookmarkCollections();
    const compareCreators = useCompareStore((s) => s.creators);
    const removeFromCompare = useCompareStore((s) => s.remove);

    const savedTotal = collectionsData?.totalCount ?? 0;
    const lists = collectionsData?.collections ?? [];
    const emptySlots = Math.max(0, MAX_COMPARE - compareCreators.length);
    const canCompare = compareCreators.length >= 2;

    return (
        <section className={cn('flex animate-fade-up flex-col rounded-3xl border border-border bg-card p-4 shadow-card', className)}>
            <header className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary">
                    <Bookmark className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                    <p className="font-display text-[15px] font-semibold leading-5 tracking-tight">Your shortlist</p>
                    <p className="truncate text-[11px] text-muted-foreground">Saved creators and who you're comparing.</p>
                </div>
            </header>

            {/* Saved */}
            <Link
                to="/saved-creators"
                className="group mt-3 flex items-center gap-2.5 rounded-xl bg-secondary/70 px-3 py-2 transition-colors hover:bg-secondary"
            >
                <span className="font-display text-[22px] font-semibold leading-none tabular-nums">{savedTotal}</span>
                <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">Saved creators</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                        {lists.length > 0
                            ? lists.slice(0, 3).map((l) => `${l.name} · ${l.count}`).join('  ·  ')
                            : savedTotal > 0 ? 'Not in a list yet' : 'Tap the bookmark on any card'}
                    </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>

            {/* Compare tray */}
            <div className="mt-3">
                <p className="flex items-center justify-between text-xs font-medium">
                    Compare
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {compareCreators.length}/{MAX_COMPARE}
                    </span>
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                    {compareCreators.map((c) => (
                        <span key={c.id} className="group/slot relative" title={c.name}>
                            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-secondary ring-2 ring-card">
                                {c.avatarUrl ? (
                                    <ApiImage src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" fallbackText={c.name.charAt(0)} />
                                ) : (
                                    <span className="font-display text-sm font-semibold">{c.name.charAt(0).toUpperCase()}</span>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeFromCompare(c.id)}
                                aria-label={`Remove ${c.name} from compare`}
                                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 scale-75 place-items-center rounded-full bg-foreground text-background opacity-0 transition-all group-hover/slot:scale-100 group-hover/slot:opacity-100"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    {Array.from({ length: emptySlots }, (_, i) => (
                        <span key={i} aria-hidden className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-border text-muted-foreground/50">
                            <Plus className="h-3.5 w-3.5" />
                        </span>
                    ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {compareCreators.length === 0
                        ? 'Add creators from their profile to compare.'
                        : canCompare ? 'Ready to compare.' : 'Add one more to compare.'}
                </p>
            </div>

            {/* Pinned to the bottom so the card lines up with the AI card beside it. */}
            <div className="mt-auto pt-3">
            <Link
                to="/discover/compare"
                aria-disabled={!canCompare}
                className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-full text-xs font-semibold transition-all duration-200',
                    canCompare
                        ? 'bg-foreground text-background hover:-translate-y-0.5 hover:shadow-float'
                        : 'pointer-events-none border border-border bg-card text-muted-foreground',
                )}
            >
                <GitCompareArrows className="h-3.5 w-3.5" />
                Compare {compareCreators.length > 0 ? compareCreators.length : ''} creators
            </Link>
            </div>
        </section>
    );
}
