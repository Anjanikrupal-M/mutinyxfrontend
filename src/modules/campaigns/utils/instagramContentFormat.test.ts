import { describe, expect, it } from 'vitest';
import {
  aggregateFormatCardStatus,
  allRequiredFormatsApproved,
  formatApprovalToast,
  formatCountLabel,
  formatSlotsFromItems,
  formatSlotsSummary,
  joinFormatLabels,
  preferredReviewItem,
  remainingFormatsAfterApproval,
  allowedInstagramFormatsFromCampaign,
  parseInstagramContentFormat,
  requiredSlotsFromCampaign,
  slotItemLabel,
} from './instagramContentFormat';

const reelFeed = ['reel', 'feed-video'] as const;

describe('formatSlotsFromItems', () => {
  it('uses five canonical formats while keeping feed-post as a read alias', () => {
    expect(allowedInstagramFormatsFromCampaign(['reel', 'story', 'feed-image', 'feed-video', 'carousel'])).toEqual([
      'reel', 'story', 'feed-image', 'feed-video', 'carousel',
    ]);
    expect(parseInstagramContentFormat('feed-post')).toBe('feed-image');
  });

  it('tracks each required format independently instead of the latest row', () => {
    const slots = formatSlotsFromItems([...reelFeed], [
      { type: 'feed-video', status: 'approved', submittedAt: '2026-08-25T15:19:00' },
    ]);
    expect(slots.map((slot) => `${slot.format}:${slot.status}`)).toEqual([
      'reel:missing',
      'feed-video:approved',
    ]);
    expect(allRequiredFormatsApproved(slots)).toBe(false);
    expect(formatSlotsSummary(slots)).toBe('Reel NEEDED · Feed video APPROVED');
  });

  it('falls back when submissions have no parseable format', () => {
    const slots = formatSlotsFromItems([...reelFeed], [
      { type: 'file', status: 'approved', submittedAt: '2026-08-25' },
    ]);
    expect(slots).toEqual([]);
    expect(aggregateFormatCardStatus(slots)).toBeNull();
  });

  it('uses the newest row for a format when older versions exist', () => {
    const slots = formatSlotsFromItems(['reel'], [
      { type: 'reel', status: 'rejected', submittedAt: '2026-08-24T08:00:00' },
      { type: 'reel', status: 'pending', submittedAt: '2026-08-25T15:00:00' },
    ]);
    expect(slots[0]?.status).toBe('pending');
  });
});

describe('payout and review helpers', () => {
  it('does not treat a creator as fully approved when another format is still needed', () => {
    const slots = formatSlotsFromItems([...reelFeed], [
      { type: 'feed-video', status: 'approved', submittedAt: '2026-08-25' },
    ]);
    expect(aggregateFormatCardStatus(slots)).toBe('work_review');
    expect(formatCountLabel(1, slots)).toBe('1/2 formats');
  });

  it('opens the pending format first when one format is already approved', () => {
    const items = [
      { id: 'feed', type: 'feed-video', status: 'approved', submittedAt: '2026-08-25T12:00:00' },
      { id: 'reel', type: 'reel', status: 'pending', submittedAt: '2026-08-24T12:00:00' },
    ];
    expect(preferredReviewItem(items, [...reelFeed])?.id).toBe('reel');
  });

  it('tells the brand another format is still waiting after a partial approve', () => {
    const slots = formatSlotsFromItems([...reelFeed], [
      { type: 'feed-video', status: 'approved', submittedAt: '2026-08-25' },
      { type: 'reel', status: 'pending', submittedAt: '2026-08-24' },
    ]);
    const remaining = remainingFormatsAfterApproval(slots, 'feed-video');
    expect(joinFormatLabels(remaining.map((slot) => slot.format))).toBe('Reel');
    expect(formatApprovalToast('feed-video', remaining)).toBe(
      'Feed video approved. Still waiting for Reel',
    );
  });
});

describe('multi-item deliverables', () => {
  const campaign = { deliverables: [{ type: 'reel', count: 2 }, { type: 'Story', count: 1 }] };

  it('expands deliverable counts into one slot per item', () => {
    expect(requiredSlotsFromCampaign(campaign)).toEqual([
      { format: 'reel', itemIndex: 1 },
      { format: 'reel', itemIndex: 2 },
      { format: 'story', itemIndex: 1 },
    ]);
  });

  it('falls back to contentTypes at one each when deliverables are empty', () => {
    expect(requiredSlotsFromCampaign({ deliverables: [], contentTypes: ['reel', 'youtube_video'] })).toEqual([
      { format: 'reel', itemIndex: 1 },
    ]);
  });

  it('tracks each reel separately and labels them Reel 1 / Reel 2', () => {
    const slots = formatSlotsFromItems(requiredSlotsFromCampaign(campaign), [
      { type: 'reel', itemIndex: 1, status: 'approved', submittedAt: '2026-09-01' },
      { type: 'reel', itemIndex: 2, status: 'pending', submittedAt: '2026-09-02' },
    ]);
    expect(slots.map((s) => [s.label, s.status])).toEqual([
      ['Reel 1', 'approved'],
      ['Reel 2', 'pending'],
      ['Story', 'missing'],
    ]);
    expect(allRequiredFormatsApproved(slots)).toBe(false);
    expect(formatCountLabel(2, slots)).toBe('2/3 items');
  });

  it('treats legacy rows without itemIndex as item 1', () => {
    const slots = formatSlotsFromItems(requiredSlotsFromCampaign(campaign), [
      { type: 'reel', status: 'approved', submittedAt: '2026-09-01' },
    ]);
    expect(slots[0].status).toBe('approved');
    expect(slots[1].status).toBe('missing');
  });

  it('names the approved item and the items still owed in the toast', () => {
    const slots = formatSlotsFromItems(requiredSlotsFromCampaign(campaign), [
      { type: 'reel', itemIndex: 2, status: 'pending', submittedAt: '2026-09-02' },
    ]);
    const remaining = remainingFormatsAfterApproval(slots, 'reel', 2);
    expect(formatApprovalToast('reel', remaining, { itemIndex: 2, slots })).toBe(
      'Reel 2 approved. Still waiting for Reel 1 and Story',
    );
  });

  it('only numbers an item label when the format has several items', () => {
    const slots = requiredSlotsFromCampaign(campaign);
    expect(slotItemLabel({ type: 'reel', itemIndex: 2 }, slots)).toBe('Reel 2');
    expect(slotItemLabel({ type: 'story', itemIndex: 1 }, slots)).toBe('Story');
  });
});

describe('YouTube multi-item deliverables', () => {
  it('requires a single YouTube item alongside Instagram items', () => {
    expect(requiredSlotsFromCampaign({ deliverables: [{ type: 'reel', count: 1 }, { type: 'short', count: 1 }] })).toEqual([
      { format: 'reel', itemIndex: 1 },
      { format: 'short', itemIndex: 1 },
    ]);
  });

  it('tracks each YouTube item once a format is requested twice', () => {
    const slots = requiredSlotsFromCampaign({ deliverables: [{ type: 'short', count: 2 }, { type: 'dedicated', count: 1 }] });
    expect(slots).toEqual([
      { format: 'short', itemIndex: 1 },
      { format: 'short', itemIndex: 2 },
      { format: 'dedicated', itemIndex: 1 },
    ]);
    const formatSlots = formatSlotsFromItems(slots, [
      { type: 'short', itemIndex: 2, status: 'pending', submittedAt: '2026-09-02' },
      { contentType: 'dedicated', status: 'approved', submittedAt: '2026-09-03' },
    ]);
    expect(formatSlots.map((s) => [s.label, s.status])).toEqual([
      ['Short 1', 'missing'],
      ['Short 2', 'pending'],
      ['Dedicated Video', 'approved'],
    ]);
    expect(slotItemLabel({ type: 'short', itemIndex: 2 }, slots)).toBe('Short 2');
  });
});
