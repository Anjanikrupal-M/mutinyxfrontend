import { useState, useEffect, useRef } from 'react';
import { X, Plus, Folder, Check, Trash2, Loader2, BookmarkX, FolderPlus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useToggleBookmark, useBookmarkCollections } from '../hooks/useInfluencers';
import { createPortal } from 'react-dom';

interface SaveToCollectionModalProps {
    influencerId: string;
    influencerName: string;
    currentCollection: string | null | undefined;
    isSaved: boolean;
    onClose: () => void;
}

// Deterministic colour palette for collection icons
const COLLECTION_COLOURS = [
    { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200/60 dark:border-violet-800/40', dot: 'bg-violet-500' },
    { bg: 'bg-sky-500/15',    text: 'text-sky-600 dark:text-sky-400',       border: 'border-sky-200/60 dark:border-sky-800/40',       dot: 'bg-sky-500' },
    { bg: 'bg-emerald-500/15',text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-200/60 dark:border-emerald-800/40',dot: 'bg-emerald-500' },
    { bg: 'bg-amber-500/15',  text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-200/60 dark:border-amber-800/40',   dot: 'bg-amber-500' },
    { bg: 'bg-rose-500/15',   text: 'text-rose-600 dark:text-rose-400',     border: 'border-rose-200/60 dark:border-rose-800/40',     dot: 'bg-rose-500' },
    { bg: 'bg-fuchsia-500/15',text: 'text-fuchsia-600 dark:text-fuchsia-400',border: 'border-fuchsia-200/60 dark:border-fuchsia-800/40',dot: 'bg-fuchsia-500' },
];

function getColour(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLLECTION_COLOURS[Math.abs(hash) % COLLECTION_COLOURS.length];
}

export function SaveToCollectionModal({
    influencerId,
    influencerName,
    currentCollection = null,
    isSaved,
    onClose,
}: SaveToCollectionModalProps) {
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [showNewInput, setShowNewInput] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: collectionsData, isLoading: isLoadingCollections } = useBookmarkCollections();
    const collections = collectionsData?.collections ?? [];
    const toggleBookmarkMutation = useToggleBookmark();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (showNewInput) inputRef.current?.focus();
    }, [showNewInput]);

    const handleSave = (collectionName: string | null) => {
        const toastId = toast.loading(
            collectionName ? `Saving to "${collectionName}"…` : 'Saving creator…'
        );
        toggleBookmarkMutation.mutate(
            { influencerId, collectionName, action: 'save' },
            {
                onSuccess: () => {
                    toast.success(collectionName ? `Saved to "${collectionName}"!` : 'Saved!', { id: toastId });
                    onClose();
                },
                onError: (error: any) => {
                    toast.error(error.response?.data?.message || 'Failed to save', { id: toastId });
                },
            }
        );
    };

    const handleUnsave = () => {
        const toastId = toast.loading('Removing from bookmarks…');
        toggleBookmarkMutation.mutate(
            { influencerId, action: 'unsave' },
            {
                onSuccess: () => { toast.success('Removed!', { id: toastId }); onClose(); },
                onError: (error: any) => {
                    toast.error(error.response?.data?.message || 'Failed to remove', { id: toastId });
                },
            }
        );
    };

    const handleCreateAndSave = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newCollectionName.trim();
        if (!trimmed) return;
        setIsCreating(true);
        handleSave(trimmed);
    };

    const isBusy = toggleBookmarkMutation.isPending;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Sheet / Modal */}
            <div
                className="relative bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-slide-up sm:animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-border" />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-6 h-6 rounded-full bg-[#fedc03]/20 flex items-center justify-center">
                                <Folder className="w-3 h-3 text-[#0a0a0a]" />
                            </div>
                            <h3 className="text-base font-bold font-display">Save Creator</h3>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8">
                            {isSaved
                                ? <>Currently {currentCollection ? <>in <span className="font-semibold text-foreground">"{currentCollection}"</span></> : 'saved (uncategorised)'}. Move or remove below.</>
                                : <>Add <span className="font-semibold text-foreground">{influencerName}</span> to a list</>
                            }
                        </p>
                    </div>
                    <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Quick save without collection */}
                    <button
                        onClick={() => handleSave(null)}
                        disabled={isBusy}
                        className={cn(
                            "w-full flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all duration-150 text-left cursor-pointer group",
                            isSaved && !currentCollection
                                ? "bg-[#fedc03]/10 border-[#fedc03]/50"
                                : "bg-secondary/30 border-border hover:border-foreground/20 hover:bg-secondary/60"
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border shrink-0",
                            isSaved && !currentCollection
                                ? "bg-[#fedc03]/20 border-[#fedc03]/40"
                                : "bg-muted border-border"
                        )}>
                            <Tag className={cn("w-4 h-4", isSaved && !currentCollection ? "text-[#0a0a0a]" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className={cn("block font-semibold", isSaved && !currentCollection ? "text-[#0a0a0a]" : "")}>
                                Save without a list
                            </span>
                            <span className="text-[11px] text-muted-foreground">Appears under Uncategorised</span>
                        </div>
                        {isSaved && !currentCollection && (
                            <Check className="w-4 h-4 text-[#0a0a0a] shrink-0" />
                        )}
                    </button>

                    {/* Existing collections */}
                    {isLoadingCollections ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : collections.length > 0 ? (
                        <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">My Lists</p>
                            <div className="space-y-1.5">
                                {collections.map((col) => {
                                    const isSelected = isSaved && currentCollection === col.name;
                                    const colour = getColour(col.name);
                                    return (
                                        <button
                                            key={col.name}
                                            onClick={() => handleSave(col.name)}
                                            disabled={isBusy}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 text-left cursor-pointer",
                                                isSelected
                                                    ? `${colour.bg} ${colour.border}`
                                                    : "bg-card border-border hover:bg-secondary/40"
                                            )}
                                        >
                                            {/* Colour dot icon */}
                                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center border shrink-0", colour.bg, colour.border)}>
                                                <Folder className={cn("w-3.5 h-3.5", colour.text)} />
                                            </div>
                                            <span className={cn("flex-1 truncate", isSelected ? colour.text : "")}>{col.name}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">{col.count} {col.count === 1 ? 'creator' : 'creators'}</span>
                                            {isSelected && <Check className={cn("w-3.5 h-3.5 shrink-0", colour.text)} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {/* New collection */}
                    {showNewInput ? (
                        <form onSubmit={handleCreateAndSave} className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">New List</p>
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="e.g. Favourites, Summer 2025…"
                                    value={newCollectionName}
                                    onChange={(e) => setNewCollectionName(e.target.value)}
                                    disabled={isCreating}
                                    maxLength={50}
                                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/40 transition-all font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={!newCollectionName.trim() || isCreating || isBusy}
                                    className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-85 transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                    Save
                                </button>
                            </div>
                            <button type="button" onClick={() => { setShowNewInput(false); setNewCollectionName(''); }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1">
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowNewInput(true)}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-dashed border-border hover:border-[#fedc03]/50 hover:bg-[#fedc03]/5 text-sm text-muted-foreground hover:text-foreground font-medium transition-all duration-150 cursor-pointer group"
                        >
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center border border-border group-hover:bg-[#fedc03]/10 group-hover:border-[#fedc03]/30 transition-colors">
                                <FolderPlus className="w-3.5 h-3.5" />
                            </div>
                            Create new list
                        </button>
                    )}
                </div>

                {/* Footer - Remove button */}
                {isSaved && (
                    <div className="px-5 pb-5 pt-1">
                        <div className="h-px bg-border mb-4" />
                        <button
                            onClick={handleUnsave}
                            disabled={isBusy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-500/8 text-rose-500 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkX className="w-3.5 h-3.5" />}
                            Remove from Saved
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
