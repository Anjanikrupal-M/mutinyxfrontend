import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { StatusBadge } from '@/shared/components/StatusBadge';

export interface AssignableWorkItem {
    id: string;
    name: string;
    status: string;
    brandName: string | null;
    agentId: string | null;
    agentName: string | null;
}

interface AssignWorkToMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memberName: string;
    kind: 'campaign' | 'program';
    // Candidate items in the member's brands that are NOT currently assigned to this member.
    items: AssignableWorkItem[];
    // Assigns the given item to this member; resolves when the mutation settles.
    onAssign: (itemId: string) => Promise<void>;
}

// Picker to hand a campaign or program in the member's brands over to them. Items already
// assigned to another member show who currently holds them (this reassigns from that person).
export function AssignWorkToMemberModal({ open, onOpenChange, memberName, kind, items, onAssign }: AssignWorkToMemberModalProps) {
    const [query, setQuery] = useState('');
    const [pendingId, setPendingId] = useState<string | null>(null);

    const filtered = items.filter((it) => it.name.toLowerCase().includes(query.trim().toLowerCase()));
    const noun = kind === 'campaign' ? 'campaign' : 'program';

    const handleAssign = async (itemId: string) => {
        setPendingId(itemId);
        try {
            await onAssign(itemId);
            // Close as soon as the assign lands — the page refreshes its lists in the
            // background, so the user isn't left staring at a spinner over the same list.
            setQuery('');
            onOpenChange(false);
        } finally {
            setPendingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) setQuery(''); onOpenChange(next); }}>
            <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="capitalize break-words pr-6">Assign a {noun} to {memberName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 min-w-0">
                    <p className="text-sm text-muted-foreground">
                        Pick a {noun} from the brands they manage. It becomes their responsibility to run.
                    </p>

                    {items.length > 5 && (
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={`Search ${noun}s…`}
                                className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-3 py-6 text-center">
                            {items.length === 0
                                ? `No other ${noun}s available in this member's brands.`
                                : `No ${noun}s match your search.`}
                        </p>
                    ) : (
                        <div className="border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
                            {filtered.map((it) => (
                                <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{it.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                            {it.brandName && (
                                                <span className="text-xs text-muted-foreground truncate">{it.brandName}</span>
                                            )}
                                            <StatusBadge status={it.status as never} className="shrink-0" />
                                        </div>
                                        {it.agentId && (
                                            <p className="text-[11px] text-amber-600 mt-0.5 truncate">
                                                Currently: {it.agentName ?? 'another member'}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0"
                                        disabled={pendingId !== null}
                                        onClick={() => handleAssign(it.id)}
                                    >
                                        {/* One label for both cases — the "Currently: X" line above
                                            already says whether this is a takeover. */}
                                        {pendingId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Make owner'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
