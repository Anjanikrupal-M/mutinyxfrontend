import {
    deliverableFormatLabel,
    itemDeliverableFormat,
    itemIndexOf,
    parseYouTubeContentFormat,
    slotItemLabel,
    type FormatItem,
    type RequiredSlot,
} from '@/modules/campaigns/utils/instagramContentFormat';

export type DeliverableSlotStatus = 'missing' | 'pending' | 'approved' | 'revision';
export type DeliverableSlotPlatform = 'instagram' | 'youtube' | 'other';

/** One deliverable in a review modal's left column, with the submissions made against it. */
export interface DeliverableSlotView<T> {
    key: string;
    label: string;
    /** Which platform the deliverable is posted on; 'other' for unclassified legacy rows. */
    platform: DeliverableSlotPlatform;
    status: DeliverableSlotStatus;
    /** Newest first. */
    versions: T[];
}

const OTHER_KEY = 'other|1';

function slotKey(format: string, itemIndex: number): string {
    return `${format}|${itemIndex}`;
}

function platformOfKey(key: string): DeliverableSlotPlatform {
    if (key === OTHER_KEY) return 'other';
    const format = key.split('|')[0];
    return parseYouTubeContentFormat(format) ? 'youtube' : 'instagram';
}

function toSlotStatus(raw: string | null | undefined): DeliverableSlotStatus {
    const status = String(raw ?? '').trim().toLowerCase();
    if (status === 'pending') return 'pending';
    if (status === 'approved') return 'approved';
    if (status === 'rejected' || status === 'revision' || status === 'revision_requested') return 'revision';
    return 'missing';
}

function submittedTime(item: FormatItem): number {
    return item.submittedAt ? new Date(item.submittedAt).getTime() : 0;
}

/**
 * Groups one creator's scripts or work submissions by the deliverable they were made for
 * ("Reel 1", "Reel 2", "Feed image"), so a review modal can list deliverables on the left
 * and only the selected deliverable's versions on the right.
 *
 * Every required deliverable is listed, including ones with nothing submitted yet. Rows from
 * before per-deliverable tracking carry no format: on a one-deliverable campaign they belong
 * to that deliverable, otherwise they are gathered under "Other".
 */
export function buildDeliverableSlots<T extends FormatItem>(
    requiredSlots: RequiredSlot[],
    items: T[],
): { slots: DeliverableSlotView<T>[]; keyOf: (item: T) => string } {
    const requiredKeys = new Set(requiredSlots.map((s) => slotKey(s.format, s.itemIndex)));

    const keyOf = (item: T): string => {
        const format = itemDeliverableFormat(item);
        // An unrequested format still gets its own row, appended after the required ones.
        if (format) return slotKey(format, itemIndexOf(item));
        if (requiredSlots.length === 1) return slotKey(requiredSlots[0].format, requiredSlots[0].itemIndex);
        return OTHER_KEY;
    };

    const byKey = new Map<string, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        byKey.set(key, [...(byKey.get(key) ?? []), item]);
    }

    const view = (key: string, label: string): DeliverableSlotView<T> => {
        const versions = [...(byKey.get(key) ?? [])].sort((a, b) => submittedTime(b) - submittedTime(a));
        return { key, label, platform: platformOfKey(key), status: versions.length > 0 ? toSlotStatus(versions[0].status) : 'missing', versions };
    };

    const slots: DeliverableSlotView<T>[] = requiredSlots.map((slot) => {
        const many = requiredSlots.filter((s) => s.format === slot.format).length > 1;
        const label = deliverableFormatLabel(slot.format) + (many ? ` ${slot.itemIndex}` : '');
        return view(slotKey(slot.format, slot.itemIndex), label);
    });

    for (const key of byKey.keys()) {
        if (requiredKeys.has(key)) continue;
        const sample = byKey.get(key)![0];
        const label = key === OTHER_KEY ? (slots.length > 0 ? 'Other' : 'Submission') : (slotItemLabel(sample, requiredSlots) || 'Submission');
        slots.push(view(key, label));
    }

    return { slots, keyOf };
}

export function deliverableSlotStatusLabel(status: DeliverableSlotStatus): string {
    if (status === 'missing') return 'Not submitted';
    if (status === 'pending') return 'In review';
    if (status === 'approved') return 'Approved';
    return 'Revision';
}
