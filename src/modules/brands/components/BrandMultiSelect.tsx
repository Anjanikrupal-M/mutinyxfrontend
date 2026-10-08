import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { useState } from 'react';

interface BrandOption {
    id: string;
    brandName: string;
}

interface BrandMultiSelectProps {
    brands: BrandOption[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Dropdown multi-select for assigning brands to a team member. Shows the chosen
 * brands as removable pills in the trigger and a searchable, checkable list in the
 * popover. Used by the Teams create flow where brand assignment is optional.
 */
export function BrandMultiSelect({
    brands,
    selectedIds,
    onChange,
    placeholder = 'Select brands…',
    disabled,
}: BrandMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const selected = brands.filter((b) => selectedIds.includes(b.id));

    const toggle = (id: string) =>
        onChange(selectedIds.includes(id) ? selectedIds.filter((b) => b !== id) : [...selectedIds, id]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className="w-full min-h-10 px-3 py-1.5 flex items-center gap-1.5 flex-wrap rounded-lg border border-border bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed"
                >
                    {selected.length === 0 ? (
                        <span className="text-muted-foreground py-0.5">{placeholder}</span>
                    ) : (
                        selected.map((brand) => (
                            <span
                                key={brand.id}
                                className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium max-w-full"
                            >
                                <span className="truncate max-w-[150px]">{brand.brandName}</span>
                                <span
                                    role="button"
                                    tabIndex={-1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(brand.id);
                                    }}
                                    className="p-0.5 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-3 h-3" />
                                </span>
                            </span>
                        ))
                    )}
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 ml-auto self-center" />
                </button>
            </PopoverTrigger>
            {/* z-[70] to sit above DialogContent (z-[60]); this select is used inside the Teams invite Dialog. */}
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] z-[70]" align="start">
                <Command>
                    <CommandInput placeholder="Search brands…" />
                    <CommandList>
                        <CommandEmpty>No brands found.</CommandEmpty>
                        <CommandGroup>
                            {brands.map((brand) => {
                                const checked = selectedIds.includes(brand.id);
                                return (
                                    <CommandItem key={brand.id} value={brand.brandName} onSelect={() => toggle(brand.id)}>
                                        <span
                                            className={cn(
                                                'w-4 h-4 mr-2 rounded border flex items-center justify-center shrink-0',
                                                checked ? 'border-foreground bg-foreground text-background' : 'border-border',
                                            )}
                                        >
                                            {checked && <Check className="w-3 h-3" />}
                                        </span>
                                        <span className="truncate">{brand.brandName}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
