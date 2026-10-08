import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tallest the option list gets (px); it shrinks further when the viewport has less room. */
const PANEL_MAX_HEIGHT = 256;

interface MultiSelectComboboxProps {
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
    /** Cap on rendered matches, for very long lists (thousands of cities). Unset = show all. */
    maxResults?: number;
}

export function MultiSelectCombobox({ options, selected, onChange, placeholder = 'Search...', disabled, error, className, maxResults }: MultiSelectComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [panelRect, setPanelRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            // The panel is portalled to <body>, so it is not inside containerRef —
            // check it separately or every click on an option would close the list.
            const insideTrigger = containerRef.current?.contains(target);
            const insidePanel = panelRef.current?.contains(target);
            if (!insideTrigger && !insidePanel) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // The panel is rendered in a portal with fixed positioning: an ancestor of this
    // component keeps a transform (animate-fade-in uses fill-mode 'both'), which creates
    // a stacking context that would otherwise trap the panel below later siblings —
    // the wizard's Back/Next bar showed through the open list. It sits at z-50 like the
    // other popovers: above the page and topbar (z-30), below the hover-expanded sidebar (z-[100]).
    const syncPanelPosition = useCallback(() => {
        const trigger = containerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        // Open upward when the list would run off the bottom of the viewport and there is
        // more room above (e.g. the last fields of a long form), and never taller than the room.
        const gap = 6;
        const margin = 12;
        const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
        const spaceAbove = rect.top - gap - margin;
        const openUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
        const maxHeight = Math.max(120, Math.min(PANEL_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
        setPanelRect(openUp
            ? { bottom: window.innerHeight - rect.top + gap, left: rect.left, width: rect.width, maxHeight }
            : { top: rect.bottom + gap, left: rect.left, width: rect.width, maxHeight });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        syncPanelPosition();
        window.addEventListener('scroll', syncPanelPosition, true);
        window.addEventListener('resize', syncPanelPosition);
        return () => {
            window.removeEventListener('scroll', syncPanelPosition, true);
            window.removeEventListener('resize', syncPanelPosition);
        };
    }, [open, syncPanelPosition]);

    // Picked options leave the list — they already show as chips above, where they're removed.
    const matches = options.filter((o) => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase()));
    const filtered = maxResults != null ? matches.slice(0, maxResults) : matches;
    const hiddenCount = matches.length - filtered.length;

    const toggle = (opt: string) => {
        if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
        else onChange([...selected, opt]);
    };

    // Picking from the list clears the half-typed search (it otherwise stayed in the input
    // beside the new chip) and keeps focus there so the next search can start right away.
    const pickFromList = (opt: string) => {
        toggle(opt);
        setQuery('');
        inputRef.current?.focus();
    };

    return (
        <div className={cn('relative', className)} ref={containerRef}>
            <div
                onClick={() => !disabled && setOpen(true)}
                className={cn(
                    'min-h-10 px-2.5 py-1.5 rounded-lg border bg-background flex items-start gap-1.5 cursor-text transition-premium',
                    open ? 'border-foreground ring-2 ring-brand/50' : error ? 'border-destructive' : 'border-border',
                    disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
            >
                {/* Chips wrap inside their own box so the chevron stays pinned to the first row
                    on the right instead of being pushed onto the last wrapped line. */}
                <div className="flex-1 min-w-0 min-h-7 flex flex-wrap items-center gap-1.5">
                {selected.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs font-medium">
                        {s}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggle(s);
                            }}
                            className="hover:text-destructive"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={selected.length === 0 ? placeholder : ''}
                    disabled={disabled}
                    className="flex-1 min-w-[80px] bg-transparent text-sm focus:outline-none py-0.5"
                />
                </div>
                <div className="h-7 flex items-center shrink-0">
                    <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </div>
            </div>

            {open && panelRect && createPortal(
                <div
                    ref={panelRef}
                    style={{ top: panelRect.top, bottom: panelRect.bottom, left: panelRect.left, width: panelRect.width, maxHeight: panelRect.maxHeight }}
                    className="fixed z-50 overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card">
                        <button type="button" onClick={() => { onChange([]); setQuery(''); }} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                            Clear all
                        </button>
                        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-foreground">
                            Done
                        </button>
                    </div>
                    {filtered.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                            {query.trim() || selected.length === 0 ? 'No matches' : 'Everything is selected'}
                        </p>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => pickFromList(opt)}
                                className="w-full flex items-center px-3 py-2 text-sm hover:bg-secondary/50 transition-premium text-left"
                            >
                                {opt}
                            </button>
                        ))
                    )}
                    {hiddenCount > 0 && (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground text-center border-t border-border">
                            {hiddenCount.toLocaleString('en-IN')} more — type to narrow down
                        </p>
                    )}
                </div>,
                document.body
            )}
            {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
        </div>
    );
}
