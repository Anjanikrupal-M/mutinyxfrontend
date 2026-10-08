import { cn } from '@/lib/utils';
import {
  formatSlotStatusLabel,
  type FormatSlot,
  type DeliverableFormat,
} from '../utils/instagramContentFormat';

export function FormatSlotsList({
  slots,
  onSelect,
}: {
  slots: FormatSlot[];
  onSelect?: (format: DeliverableFormat, itemIndex: number) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {slots.map((slot) => {
        const statusClass = cn(
          'font-semibold',
          slot.status === 'approved' && 'text-emerald-700',
          slot.status === 'pending' && 'text-amber-700',
          slot.status === 'rejected' && 'text-destructive',
          slot.status === 'missing' && 'text-muted-foreground',
        );
        if (onSelect && slot.status !== 'missing') {
          return (
            <li key={`${slot.format}-${slot.itemIndex}`}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(slot.format, slot.itemIndex);
                }}
                className="flex w-full items-center justify-between gap-2 text-[11px] hover:underline"
              >
                <span className="font-semibold text-foreground">{slot.label}</span>
                <span className={statusClass}>{formatSlotStatusLabel(slot.status)}</span>
              </button>
            </li>
          );
        }
        return (
          <li key={`${slot.format}-${slot.itemIndex}`} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-foreground">{slot.label}</span>
            <span className={statusClass}>{formatSlotStatusLabel(slot.status)}</span>
          </li>
        );
      })}
    </ul>
  );
}
