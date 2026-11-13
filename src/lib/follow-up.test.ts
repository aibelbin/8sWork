import { describe, expect, it } from 'vitest';
import { suggestFollowUp, type FollowUpInput } from './follow-up';

const today = '2026-11-13';
const app = (patch: Partial<FollowUpInput> = {}): FollowUpInput => ({
  status: 'applied',
  deadline: null,
  applied_on: '2026-11-10',
  rounds: [],
  ...patch,
});

describe('suggestFollowUp', () => {
  it.each(['rejected', 'ghosted', 'withdrawn'] as const)('%s clears the follow-up', (status) => {
    expect(suggestFollowUp(app({ status }), 'status_changed', today)).toBeNull();
  });

  it('to_apply with a deadline: the day before the deadline', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', deadline: '2026-11-20', applied_on: null }), 'created', today)).toBe('2026-11-19');
  });

  it('to_apply without a deadline: no follow-up', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', applied_on: null }), 'created', today)).toBeNull();
  });

  it('checked on to_apply follows the deadline rule', () => {
    expect(suggestFollowUp(app({ status: 'to_apply', deadline: '2026-11-20' }), 'checked', today)).toBe('2026-11-19');
  });

  it('offer: today + 3, whatever the event', () => {
    expect(suggestFollowUp(app({ status: 'offer' }), 'status_changed', today)).toBe('2026-11-16');
    expect(suggestFollowUp(app({ status: 'offer' }), 'checked', today)).toBe('2026-11-16');
  });

  it('upcoming scheduled round: the day after the earliest one, in IST', () => {
    const rounds = [
      { result: 'upcoming' as const, scheduled_at: '2026-11-25T05:00:00Z' },
      { result: 'upcoming' as const, scheduled_at: '2026-11-20T18:30:00Z' }, // 21 Nov 00:00 IST
    ];
    expect(suggestFollowUp(app({ status: 'in_progress', rounds }), 'round_saved', today)).toBe('2026-11-22');
  });

  it('an applied application with an upcoming round also uses the round', () => {
    const rounds = [{ result: 'upcoming' as const, scheduled_at: '2026-11-15T05:00:00Z' }];
    expect(suggestFollowUp(app({ rounds }), 'round_saved', today)).toBe('2026-11-16');
  });

  it('ignores rounds that are finished or unscheduled', () => {
    const rounds = [
      { result: 'passed' as const, scheduled_at: '2026-11-12T05:00:00Z' },
      { result: 'upcoming' as const, scheduled_at: null },
    ];
    expect(suggestFollowUp(app({ status: 'in_progress', rounds }), 'round_saved', today)).toBe('2026-11-18');
  });

  it('in_progress with no upcoming round: today + 5', () => {
    expect(suggestFollowUp(app({ status: 'in_progress' }), 'checked', today)).toBe('2026-11-18');
  });

  it('applied on create or status change: applied_on + 7', () => {
    expect(suggestFollowUp(app(), 'created', today)).toBe('2026-11-17');
    expect(suggestFollowUp(app(), 'status_changed', today)).toBe('2026-11-17');
  });

  it('applied without applied_on falls back to today + 7', () => {
    expect(suggestFollowUp(app({ applied_on: null }), 'created', today)).toBe('2026-11-20');
  });

  it('applied on checked or round saved: today + 7', () => {
    expect(suggestFollowUp(app(), 'checked', today)).toBe('2026-11-20');
    expect(suggestFollowUp(app(), 'round_saved', today)).toBe('2026-11-20');
  });
});
