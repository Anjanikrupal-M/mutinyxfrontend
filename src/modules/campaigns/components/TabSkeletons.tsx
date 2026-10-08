import { cn } from '@/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';

/*
 * Loading placeholders for the campaign detail tabs. Each mirrors the real card's box —
 * same grid, padding, radius and element sizes — so nothing jumps when data arrives.
 */

const cardClass = 'bg-card border border-border rounded-xl sm:rounded-2xl';

function Line({ className }: { className?: string }) {
    return <Skeleton className={cn('h-3 rounded-full', className)} />;
}

/** Avatar + name + handle — the header every review card starts with. */
function PersonRow({ avatar = 'w-9 h-9' }: { avatar?: string }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <Skeleton className={cn('rounded-full shrink-0', avatar)} />
            <div className="min-w-0 flex-1 space-y-1.5">
                <Line className="w-2/5" />
                <Line className="h-2.5 w-1/4" />
            </div>
        </div>
    );
}

/** Applications: two-up creator cards (square avatar + details) with the payment sidebar. */
export function ApplicationsSkeleton({ withSidebar = true, count = 6 }: { withSidebar?: boolean; count?: number }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6" aria-busy="true" aria-label="Loading applications">
            <div className={cn('space-y-4', withSidebar ? 'lg:col-span-3' : 'lg:col-span-4')}>
                <div className="flex flex-wrap gap-2">
                    {[88, 72, 96, 80].map((w) => <Skeleton key={w} className="h-8 rounded-full" style={{ width: w }} />)}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                    {Array.from({ length: count }, (_, i) => (
                        <div key={i} className={cn(cardClass, 'p-3 sm:p-4 flex flex-col gap-4')}>
                            <div className="flex gap-3 sm:gap-4">
                                <Skeleton className="w-16 h-16 sm:w-[100px] sm:h-[100px] rounded-xl shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2.5 pt-1">
                                    <div className="flex justify-between gap-3">
                                        <Line className="h-3.5 w-2/5" />
                                        <Skeleton className="h-5 w-20 rounded-full" />
                                    </div>
                                    <Line className="w-1/4" />
                                    <div className="flex gap-2 pt-1">
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                        <Skeleton className="h-5 w-20 rounded-full" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map((j) => <Skeleton key={j} className="h-12 rounded-lg" />)}
                            </div>
                            <Skeleton className="h-9 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
            {withSidebar && (
                <div className={cn(cardClass, 'p-4 sm:p-5 space-y-4 self-start')}>
                    <Line className="h-3.5 w-1/2" />
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-between gap-3">
                            <Line className="w-2/5" />
                            <Line className="w-1/5" />
                        </div>
                    ))}
                    <Skeleton className="h-10 rounded-lg" />
                </div>
            )}
        </div>
    );
}

/** One Status Board creator card, sized like the real one. */
export function KanbanCardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5">
            <PersonRow avatar="w-8 h-8" />
            <div className="flex gap-2">
                <Line className="h-2.5 w-12" />
                <Line className="h-2.5 w-10" />
            </div>
            <Skeleton className="h-4 w-16 rounded" />
        </div>
    );
}

/** Scripts / Work Submissions: three-up review cards with a content preview block. */
export function ReviewCardsSkeleton({ count = 6, withHeader = false }: { count?: number; withHeader?: boolean }) {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
            {withHeader && (
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                        <Line className="h-4 w-36" />
                        <Line className="h-2.5 w-64" />
                    </div>
                    <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {Array.from({ length: count }, (_, i) => (
                    <div key={i} className={cn(cardClass, 'p-4 space-y-3')}>
                        <div className="flex items-start justify-between gap-2">
                            <PersonRow />
                            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                        </div>
                        <Line className="h-2.5 w-24" />
                        <Skeleton className="h-16 rounded-lg" />
                        <Line className="h-2.5 w-1/3" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Proof of Work: header, three-up proof cards, and the summary sidebar. */
export function ProofOfWorkSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6" aria-busy="true" aria-label="Loading proof of work">
            <div className="lg:col-span-3 min-w-0 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                        <Line className="h-4 w-32" />
                        <Line className="h-2.5 w-72" />
                    </div>
                    <Skeleton className="h-9 w-40 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className={cn(cardClass, 'p-3 sm:p-4 space-y-3')}>
                            <div className="flex items-start justify-between gap-2">
                                <PersonRow />
                                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                            </div>
                            <div className="flex gap-1.5">
                                <Skeleton className="h-5 w-14 rounded-full" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                            <Skeleton className="h-10 rounded-lg" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 flex-1 rounded-lg" />
                                <Skeleton className="h-8 flex-1 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className={cn(cardClass, 'p-4 sm:p-5 space-y-4 self-start')}>
                <Line className="h-3.5 w-1/2" />
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between gap-3">
                        <Line className="w-2/5" />
                        <Line className="w-1/5" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Analytics: headline tiles, a chart, and a row of post cards. */
export function AnalyticsSkeleton() {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Loading analytics">
            <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-8 w-72 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="surface grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-3 xl:grid-cols-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-card px-4 py-3.5 space-y-2.5">
                        <Line className="w-1/2" />
                        <Skeleton className="h-6 w-2/3 rounded-md" />
                        <Line className="h-2.5 w-3/4" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                {['lg:col-span-8', 'lg:col-span-4', 'lg:col-span-7', 'lg:col-span-5'].map((span) => (
                    <div key={span} className={cn('surface rounded-2xl p-4 space-y-3', span)}>
                        <Line className="h-3.5 w-36" />
                        <Skeleton className="h-48 rounded-xl" />
                    </div>
                ))}
            </div>
            <div className="surface rounded-2xl p-4 space-y-3">
                <Line className="h-3.5 w-28" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-xl" />)}
                </div>
            </div>
        </div>
    );
}
