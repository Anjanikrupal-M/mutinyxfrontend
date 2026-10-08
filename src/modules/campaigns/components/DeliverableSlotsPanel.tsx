import { ChevronRight, Instagram, Layers, Youtube, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    deliverableSlotStatusLabel,
    type DeliverableSlotPlatform,
    type DeliverableSlotStatus,
    type DeliverableSlotView,
} from '@/modules/campaigns/utils/deliverableSlots';

const STATUS_CLASS: Record<DeliverableSlotStatus, string> = {
    missing: 'bg-secondary text-muted-foreground',
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    revision: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

const PLATFORM_GROUPS: { platform: DeliverableSlotPlatform; label: string; icon: LucideIcon; iconClass: string }[] = [
    { platform: 'instagram', label: 'Instagram', icon: Instagram, iconClass: 'text-pink-600' },
    { platform: 'youtube', label: 'YouTube', icon: Youtube, iconClass: 'text-red-600' },
    { platform: 'other', label: 'Other', icon: Layers, iconClass: 'text-muted-foreground' },
];

/**
 * Left column of the script / work review modals: every deliverable the campaign asks for,
 * with the status of its latest submission. Selecting one opens that deliverable's latest
 * version; its older versions are listed in the modal's right column. Deliverables are
 * grouped by platform so Instagram and YouTube items read as separate lists.
 */
export function DeliverableSlotsPanel<T>({
    slots,
    selectedKey,
    onSelect,
    versionNoun,
    className,
}: {
    slots: DeliverableSlotView<T>[];
    selectedKey: string | null;
    onSelect: (slot: DeliverableSlotView<T>) => void;
    /** "script" / "submission" — used in the version count. */
    versionNoun: string;
    className?: string;
}) {
    return (
        <div className={cn('bg-secondary/30 border border-border rounded-xl p-3', className)}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 px-1 tracking-wider">
                Deliverables <span className="font-medium normal-case tracking-normal">· {slots.length}</span>
            </p>
            <div className="space-y-3">
                {PLATFORM_GROUPS.map((group) => {
                    const groupSlots = slots.filter((slot) => slot.platform === group.platform);
                    if (groupSlots.length === 0) return null;
                    const Icon = group.icon;
                    return (
                        <section key={group.platform}>
                            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-foreground">
                                <Icon className={cn('h-3.5 w-3.5', group.iconClass)} />
                                {group.label}
                                <span className="font-medium text-muted-foreground">· {groupSlots.length}</span>
                            </p>
                            <div className="space-y-1.5">
                                {groupSlots.map((slot) => (
                                    <SlotRow
                                        key={slot.key}
                                        slot={slot}
                                        selected={slot.key === selectedKey}
                                        onSelect={onSelect}
                                        versionNoun={versionNoun}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

function SlotRow<T>({
    slot,
    selected,
    onSelect,
    versionNoun,
}: {
    slot: DeliverableSlotView<T>;
    selected: boolean;
    onSelect: (slot: DeliverableSlotView<T>) => void;
    versionNoun: string;
}) {
    const empty = slot.versions.length === 0;
    return (
        <button
            type="button"
            disabled={empty}
            onClick={() => onSelect(slot)}
            className={cn(
                'w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-premium',
                selected
                    ? 'border-foreground/40 bg-card shadow-sm'
                    : 'border-border bg-card/60 hover:bg-card',
                empty && 'opacity-60 cursor-default hover:bg-card/60',
            )}
        >
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{slot.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {empty
                        ? 'Nothing submitted yet'
                        : `${slot.versions.length} ${versionNoun}${slot.versions.length === 1 ? '' : 's'}`}
                </p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_CLASS[slot.status])}>
                {deliverableSlotStatusLabel(slot.status)}
            </span>
            {!empty && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', selected && 'text-foreground')} />}
        </button>
    );
}
