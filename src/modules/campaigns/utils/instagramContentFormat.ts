export type InstagramContentFormat = 'reel' | 'story' | 'feed-image' | 'feed-video' | 'carousel';
export type InstagramAnalyticsFormat = Exclude<InstagramContentFormat, 'story'> | 'story-image' | 'story-video';

export function instagramContentFormatLabel(format: string | null | undefined): string {
  const key = (format ?? '').toLowerCase().trim();
  if (key === 'reel' || key === 'reels') return 'Reel';
  if (key === 'story' || key === 'stories') return 'Story';
  if (key === 'story-image') return 'Story image';
  if (key === 'story-video') return 'Story video';
  if (key === 'feed-image' || key === 'feed_image' || key === 'feed image' || key === 'image' || key === 'photo') return 'Feed image';
  if (key === 'feed-video' || key === 'feed_video' || key === 'feed video' || key === 'video') return 'Feed video';
  if (key === 'feed-post' || key === 'feed_post' || key === 'feed post' || key === 'post') return 'Feed image';
  if (key === 'carousel' || key === 'carousel_album' || key === 'carousel-album') return 'Carousel';
  if (!format) return 'Post';
  return format.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseInstagramContentFormat(value: string | null | undefined): InstagramContentFormat | null {
  const key = (value ?? '').toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
  if (key === 'reel' || key === 'reels' || key === 'instagram reel') return 'reel';
  if (key === 'story' || key === 'stories' || key === 'instagram story') return 'story';
  if (key === 'carousel' || key === 'carousels' || key === 'carousel album' || key === 'instagram carousel') return 'carousel';
  if (key === 'feed-video' || key === 'feed video' || key === 'instagram feed video' || key === 'instagram video' || key === 'video') return 'feed-video';
  if (key === 'feed-image' || key === 'feed image' || key === 'instagram feed image' || key === 'instagram image' || key === 'image' || key === 'photo') return 'feed-image';
  if (
    key === 'feed-post' || key === 'feed post' || key === 'post' || key === 'posts'
    || key === 'instagram post' || key === 'image'
  ) return 'feed-image';
  return null;
}

export type YouTubeContentFormat = 'short' | 'integration' | 'dedicated';
/** Any deliverable format, on either platform. Mirrors the backend's DeliverableFormat. */
export type DeliverableFormat = InstagramContentFormat | YouTubeContentFormat;

export function parseYouTubeContentFormat(value: string | null | undefined): YouTubeContentFormat | null {
  const key = (value ?? '').toLowerCase().trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  if (key === 'short' || key === 'shorts' || key === 'yt short' || key === 'youtube short' || key === 'youtube shorts') return 'short';
  if (key === 'integration' || key === 'yt integration' || key === 'youtube integration') return 'integration';
  if (
    key === 'dedicated' || key === 'dedicated video' || key === 'yt dedicated'
    || key === 'youtube dedicated' || key === 'youtube dedicated video'
  ) return 'dedicated';
  return null;
}

export function deliverableFormatLabel(format: DeliverableFormat): string {
  if (format === 'short') return 'Short';
  if (format === 'integration') return 'Integration';
  if (format === 'dedicated') return 'Dedicated Video';
  return instagramContentFormatLabel(format);
}

/** Format of a script/work/proof row on either platform. Instagram proofs carry it in
 *  contentFormat (from Graph); YouTube rows only have the creator-declared type. */
export function itemDeliverableFormat(item: {
  contentFormat?: string | null;
  mediaType?: string | null;
  type?: string | null;
  contentType?: string | null;
}): DeliverableFormat | null {
  return proofInstagramFormat(item)
    ?? parseInstagramContentFormat(item.contentType)
    ?? parseYouTubeContentFormat(item.contentFormat)
    ?? parseYouTubeContentFormat(item.type)
    ?? parseYouTubeContentFormat(item.contentType);
}

export function proofFormatLabel(proof: { contentFormat?: string | null; mediaType?: string | null; type?: string | null }): string {
  return instagramContentFormatLabel(proof.contentFormat || proof.type || proof.mediaType);
}

/** proofFormatLabel plus the item number when the campaign wants several of that
 *  format — "Reel 2" — so two reels from one creator aren't both just "Reel". */
export function slotItemLabel(
  item: { contentFormat?: string | null; mediaType?: string | null; type?: string | null; contentType?: string | null; itemIndex?: number | null },
  requiredSlots: Array<{ format: DeliverableFormat; itemIndex: number }>,
): string {
  const format = itemDeliverableFormat(item);
  const label = format ? deliverableFormatLabel(format) : proofFormatLabel(item);
  if (!format || requiredSlots.filter((slot) => slot.format === format).length <= 1) return label;
  return `${label} ${Math.max(1, Number(item.itemIndex) || 1)}`;
}

export function isStoryProof(proof: { contentFormat?: string | null; mediaType?: string | null }): boolean {
  return parseInstagramContentFormat(proof.contentFormat) === 'story'
    || /story/i.test(proof.mediaType ?? '');
}

export function allowedInstagramFormatsFromCampaign(contentTypes: string[] | null | undefined): InstagramContentFormat[] {
  const allowed = (contentTypes ?? [])
    .map((type) => parseInstagramContentFormat(type))
    .filter((format): format is InstagramContentFormat => format != null);
  return [...new Set(allowed)];
}

export function proofInstagramFormat(proof: {
  contentFormat?: string | null;
  mediaType?: string | null;
  type?: string | null;
}): InstagramContentFormat | null {
  return parseInstagramContentFormat(proof.contentFormat)
    || parseInstagramContentFormat(proof.type)
    || parseInstagramContentFormat(proof.mediaType);
}

export function proofInstagramAnalyticsFormat(proof: {
  contentFormat?: string | null;
  mediaType?: string | null;
  type?: string | null;
}): InstagramAnalyticsFormat | null {
  const raw = String(proof.contentFormat ?? '').toLowerCase().replace(/_/g, '-');
  if (raw === 'story-image' || raw === 'story-video') return raw;
  const format = proofInstagramFormat(proof);
  if (format !== 'story') return format;
  return String(proof.mediaType ?? '').toUpperCase() === 'VIDEO' ? 'story-video' : 'story-image';
}

export type FormatSlotStatus = 'missing' | 'pending' | 'approved' | 'rejected';

/** One required deliverable: a format plus which item of it (1-based) — "Reel 2". */
export type RequiredSlot = { format: DeliverableFormat; itemIndex: number };

export type FormatSlot = {
  format: DeliverableFormat;
  itemIndex: number;
  label: string;
  status: FormatSlotStatus;
};

export type FormatItem = {
  id?: string;
  contentFormat?: string | null;
  type?: string | null;
  mediaType?: string | null;
  status?: string | null;
  submittedAt?: string | Date | null;
  /** Creator-declared deliverable type (scripts, YouTube proofs). */
  contentType?: string | null;
  /** 1-based item within its format. Rows from before multi-item support have none → 1. */
  itemIndex?: number | null;
};

export function itemIndexOf(item: FormatItem): number {
  return Math.max(1, Number(item.itemIndex) || 1);
}

function toRequiredSlots(required: Array<DeliverableFormat | RequiredSlot>): RequiredSlot[] {
  return required.map((r) => (typeof r === 'string' ? { format: r, itemIndex: 1 } : r));
}

/**
 * Every item the campaign requires, e.g. 2 reels + 1 story → [{reel,1},{reel,2},{story,1}].
 * Mirrors the backend's requiredDeliverableSlotsFromCampaign: `deliverables` (with counts)
 * wins, campaigns without it fall back to contentTypes at 1 each, and every YouTube item
 * counts too (1 Short alongside a Reel is its own deliverable).
 */
export function requiredSlotsFromCampaign(campaign: {
  deliverables?: Array<string | { type?: string; count?: number }> | null;
  contentTypes?: string[] | null;
}): RequiredSlot[] {
  const instagram = expandSlots(campaign, parseInstagramContentFormat);
  const youtube = expandSlots(campaign, parseYouTubeContentFormat);
  return [...instagram, ...youtube];
}

function expandSlots(
  campaign: { deliverables?: Array<string | { type?: string; count?: number }> | null; contentTypes?: string[] | null },
  parse: (value: string | null | undefined) => DeliverableFormat | null,
): RequiredSlot[] {
  const deliverables = Array.isArray(campaign.deliverables) ? campaign.deliverables : [];
  const source = deliverables.length > 0
    ? deliverables.map((d) => (typeof d === 'string' ? { type: d, count: 1 } : d))
    : (campaign.contentTypes ?? []).map((type) => ({ type, count: 1 }));
  const slots: RequiredSlot[] = [];
  const seen = new Set<string>();
  for (const d of source) {
    const format = parse(d.type);
    if (!format) continue;
    const count = Math.max(1, Number(d.count) || 1);
    for (let itemIndex = 1; itemIndex <= count; itemIndex++) {
      const key = `${format}|${itemIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ format, itemIndex });
    }
  }
  return slots;
}

/** "Reel" when the campaign wants one reel, "Reel 2" when it wants several. */
function slotLabel(slot: RequiredSlot, all: RequiredSlot[]): string {
  const label = deliverableFormatLabel(slot.format);
  const many = all.filter((s) => s.format === slot.format).length > 1;
  return many ? `${label} ${slot.itemIndex}` : label;
}

export function formatSlotsFromItems(
  required: Array<DeliverableFormat | RequiredSlot>,
  items: FormatItem[],
): FormatSlot[] {
  const requiredSlots = toRequiredSlots(required);
  const slots = requiredSlots.map((slot) => {
    const latest = latestItemForFormat(items, slot.format, slot.itemIndex);
    const raw = String(latest?.status ?? '').toLowerCase();
    let status: FormatSlotStatus = 'missing';
    if (raw === 'pending') status = 'pending';
    else if (raw === 'approved') status = 'approved';
    // Scripts say 'revision_requested' where work and proofs say 'rejected'.
    else if (raw === 'rejected' || raw === 'revision_requested') status = 'rejected';
    return { format: slot.format, itemIndex: slot.itemIndex, label: slotLabel(slot, requiredSlots), status };
  });
  if (
    required.length > 0
    && items.length > 0
    && slots.every((slot) => slot.status === 'missing')
    && !items.some((item) => itemDeliverableFormat(item) != null)
  ) {
    return [];
  }
  return slots;
}

export function latestItemForFormat<T extends FormatItem>(
  items: T[],
  format: DeliverableFormat,
  itemIndex = 1,
): T | undefined {
  const matches = items.filter((item) => itemDeliverableFormat(item) === format && itemIndexOf(item) === itemIndex);
  if (matches.length === 0) return undefined;
  return [...matches].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  }).at(-1);
}

export function preferredReviewItem<T extends FormatItem>(
  items: T[],
  requiredSlots: Array<DeliverableFormat | RequiredSlot>,
): T | undefined {
  const required = [...new Set(toRequiredSlots(requiredSlots).map((slot) => slot.format))];
  if (items.length === 0) return undefined;
  const newestFirst = [...items].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTime - aTime;
  });
  const pending = newestFirst.find((item) => {
    if (String(item.status ?? '').toLowerCase() !== 'pending') return false;
    const format = itemDeliverableFormat(item);
    return !format || required.length === 0 || required.includes(format);
  });
  return pending ?? newestFirst[0];
}

export function formatSlotStatusLabel(status: FormatSlotStatus): string {
  if (status === 'missing') return 'Needed';
  if (status === 'pending') return 'In review';
  if (status === 'approved') return 'Approved';
  return 'Revision needed';
}

export function formatSlotsSummary(slots: FormatSlot[]): string {
  return slots
    .map((slot) => {
      const status = slot.status === 'missing' ? 'needed' : slot.status;
      return `${slot.label} ${status.toUpperCase()}`;
    })
    .join(' · ');
}

export function joinFormatLabels(formats: DeliverableFormat[]): string {
  const labels = formats.map((format) => deliverableFormatLabel(format));
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function remainingFormatsAfterApproval(
  slots: FormatSlot[],
  approvedFormat: DeliverableFormat | null,
  approvedItemIndex = 1,
): FormatSlot[] {
  return slots.filter((slot) => (
    !(slot.format === approvedFormat && slot.itemIndex === approvedItemIndex) && slot.status !== 'approved'
  ));
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/** Toast after approving one item. Pass `approved.slots` (from formatSlotsFromItems) so the
 *  item is named "Reel 2" rather than just "Reel" on multi-item campaigns. */
export function formatApprovalToast(
  approvedFormat: DeliverableFormat | null,
  remaining: FormatSlot[],
  approved?: { itemIndex?: number | null; slots?: FormatSlot[] },
): string {
  const approvedIndex = Math.max(1, Number(approved?.itemIndex) || 1);
  const approvedSlot = approved?.slots?.find((slot) => slot.format === approvedFormat && slot.itemIndex === approvedIndex);
  const approvedLabel = approvedSlot?.label ?? (approvedFormat ? deliverableFormatLabel(approvedFormat) : 'Submission');
  if (remaining.length === 0) return `${approvedLabel} approved`;
  return `${approvedLabel} approved. Still waiting for ${joinLabels(remaining.map((slot) => slot.label))}`;
}

export function allRequiredFormatsApproved(slots: FormatSlot[]): boolean {
  return slots.length > 0 && slots.every((slot) => slot.status === 'approved');
}

export function aggregateFormatCardStatus(
  slots: FormatSlot[],
): 'pending' | 'approved' | 'revision_requested' | 'work_review' | null {
  if (slots.length === 0) return null;
  if (slots.some((slot) => slot.status === 'pending')) return 'pending';
  if (allRequiredFormatsApproved(slots)) return 'approved';
  if (slots.some((slot) => slot.status === 'rejected')) return 'revision_requested';
  if (slots.some((slot) => slot.status === 'missing')) return 'work_review';
  return null;
}

export function formatCountLabel(itemCount: number, slots: FormatSlot[]): string | null {
  if (slots.length > 1) {
    const submitted = slots.filter((slot) => slot.status !== 'missing').length;
    const unit = slots.some((slot) => slot.itemIndex > 1) ? 'items' : 'formats';
    return `${submitted}/${slots.length} ${unit}`;
  }
  if (itemCount > 1) return `${itemCount} versions`;
  return null;
}
