import { describe, expect, it } from 'vitest';
import { addDays, istDate, istInputToIso, isoToIstInput } from './dates';

describe('istDate', () => {
  it('returns the IST calendar date', () => {
    expect(istDate('2026-11-13T18:00:00Z')).toBe('2026-11-13'); // 23:30 IST
  });

  it('rolls over at IST midnight, not UTC midnight', () => {
    expect(istDate('2026-11-13T18:30:00Z')).toBe('2026-11-14'); // 00:00 IST
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('IST datetime-local conversion', () => {
  it('converts an IST input value to UTC ISO and back', () => {
    expect(istInputToIso('2026-11-20T10:00')).toBe('2026-11-20T04:30:00.000Z');
    expect(isoToIstInput('2026-11-20T04:30:00.000Z')).toBe('2026-11-20T10:00');
  });
});
