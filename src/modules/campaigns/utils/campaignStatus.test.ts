import { describe, it, expect } from 'vitest';
import { getCampaignDisplayStatus, getCampaignPhase, type PhaseCampaign } from './campaignStatus';

const NOW = new Date('2026-10-03T12:00:00').getTime();
const PAST = '2026-09-20';
const FUTURE = '2026-10-20';

const live = (overrides: Partial<PhaseCampaign> = {}): PhaseCampaign => ({
    status: 'active',
    applicationDeadline: FUTURE,
    applicationsCount: 0,
    creatorsAccepted: 0,
    pendingScripts: 0,
    pendingSubmissions: 0,
    ...overrides,
});

describe('getCampaignDisplayStatus', () => {
    it('never turns a completed campaign back into active', () => {
        expect(getCampaignDisplayStatus({ status: 'completed', applicationDeadline: FUTURE }, NOW)).toBe('completed');
    });

    it('expires a live campaign whose window shut with nobody in it', () => {
        expect(getCampaignDisplayStatus(live({ applicationDeadline: PAST }), NOW)).toBe('expired');
    });

    it('does not expire a private campaign with accepted invitees', () => {
        expect(getCampaignDisplayStatus(live({ applicationDeadline: PAST, creatorsAccepted: 2 }), NOW)).toBe('active');
    });

    it('does not relabel closed or withdrawn campaigns as expired', () => {
        expect(getCampaignDisplayStatus({ status: 'closed', applicationDeadline: PAST, applicationsCount: 0, creatorsAccepted: 0 }, NOW)).toBe('closed');
        expect(getCampaignDisplayStatus({ status: 'withdrawn', applicationDeadline: PAST, applicationsCount: 0, creatorsAccepted: 0 }, NOW)).toBe('withdrawn');
    });
});

describe('getCampaignPhase', () => {
    it('separates approval states from plain drafts', () => {
        expect(getCampaignPhase({ status: 'draft' }, NOW)).toBe('draft');
        expect(getCampaignPhase({ status: 'draft', approvalStatus: 'pending' }, NOW)).toBe('waiting_approval');
        expect(getCampaignPhase({ status: 'draft', approvalStatus: 'rejected' }, NOW)).toBe('changes_requested');
    });

    it('ignores a stale approval status once live', () => {
        expect(getCampaignPhase(live({ approvalStatus: 'rejected' }), NOW)).toBe('applications_open');
    });

    it('walks a live campaign through its phases', () => {
        expect(getCampaignPhase(live(), NOW)).toBe('applications_open');
        expect(getCampaignPhase(live({ applicationsCount: 4 }), NOW)).toBe('applications_received');
        expect(getCampaignPhase(live({ applicationsCount: 4, creatorsAccepted: 2 }), NOW)).toBe('in_progress');
        expect(getCampaignPhase(live({ creatorsAccepted: 2, pendingSubmissions: 1 }), NOW)).toBe('pending_review');
    });

    it('flags overdue only when creators are working past the final deadline', () => {
        expect(getCampaignPhase(live({ creatorsAccepted: 2, proofOfWorkDeadline: PAST }), NOW)).toBe('past_deadline');
        expect(getCampaignPhase(live({ creatorsAccepted: 2, workDeadline: PAST, proofOfWorkDeadline: FUTURE }), NOW)).toBe('in_progress');
    });

    it('trusts pendingApplications when present', () => {
        expect(getCampaignPhase(live({ applicationsCount: 4, pendingApplications: 0 }), NOW)).toBe('applications_open');
    });

    it('says inviting creators for a private campaign with nobody in yet', () => {
        expect(getCampaignPhase(live({ visibility: 'private' }), NOW)).toBe('inviting_creators');
    });

    it('falls back to plain active when counters are missing', () => {
        expect(getCampaignPhase({ status: 'active', applicationDeadline: FUTURE }, NOW)).toBe('active');
    });

    it('passes final states through', () => {
        expect(getCampaignPhase({ status: 'completed', applicationDeadline: FUTURE }, NOW)).toBe('completed');
        expect(getCampaignPhase(live({ applicationDeadline: PAST }), NOW)).toBe('expired');
    });
});
