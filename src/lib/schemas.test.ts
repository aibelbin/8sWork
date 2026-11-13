import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { applicationSchema, roundSchema, withAppliedOn } from './schemas';

const valid = { company: 'Acme', role: 'SDE Intern', status: 'applied', apply_method: 'email', source: 'college_group' };

describe('applicationSchema', () => {
  it('accepts the quick-add fields and turns blank optional fields into null', () => {
    const r = applicationSchema.parse({ ...valid, job_url: '', notes: '   ' });
    expect(r.company).toBe('Acme');
    expect(r.job_url).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.deadline).toBeNull();
    expect(r.job_type).toBeNull();
  });

  it('requires company and role', () => {
    const r = applicationSchema.safeParse({ ...valid, company: '  ', role: '' });
    expect(r.success).toBe(false);
    expect(z.flattenError(r.error!).fieldErrors).toMatchObject({
      company: ['Company is required'],
      role: ['Role is required'],
    });
  });

  it('requires choosing how you applied and where you found it', () => {
    const r = applicationSchema.safeParse({ ...valid, apply_method: '', source: '' });
    expect(z.flattenError(r.error!).fieldErrors).toMatchObject({
      apply_method: ['Choose how you applied'],
      source: ['Choose where you found it'],
    });
  });

  it('only accepts http(s) job links', () => {
    expect(applicationSchema.safeParse({ ...valid, job_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(applicationSchema.parse({ ...valid, job_url: 'https://acme.com/jobs/1' }).job_url).toBe('https://acme.com/jobs/1');
  });

  it('rejects malformed emails and dates', () => {
    expect(applicationSchema.safeParse({ ...valid, contact_email: 'not-an-email' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, deadline: '2026-13-40' }).success).toBe(false);
  });
});

describe('withAppliedOn', () => {
  it('clears applied_on for to_apply', () => {
    expect(withAppliedOn({ status: 'to_apply', applied_on: '2026-11-01' }, '2026-11-13').applied_on).toBeNull();
  });

  it('defaults applied_on to today once applied', () => {
    expect(withAppliedOn({ status: 'applied', applied_on: null }, '2026-11-13').applied_on).toBe('2026-11-13');
  });

  it('keeps an existing applied_on', () => {
    expect(withAppliedOn({ status: 'in_progress', applied_on: '2026-11-01' }, '2026-11-13').applied_on).toBe('2026-11-01');
  });
});

describe('roundSchema', () => {
  it('converts the IST datetime-local value to UTC ISO', () => {
    const r = roundSchema.parse({ name: 'OA', scheduled_at: '2026-11-20T10:00', result: 'upcoming', notes: '' });
    expect(r.scheduled_at).toBe('2026-11-20T04:30:00.000Z');
    expect(r.notes).toBeNull();
  });

  it('allows no time but requires a name', () => {
    expect(roundSchema.parse({ name: 'HR', scheduled_at: '', result: 'awaiting' }).scheduled_at).toBeNull();
    expect(roundSchema.safeParse({ name: ' ', result: 'upcoming' }).success).toBe(false);
  });
});
