import { describe, test, expect } from 'vitest';
import { computePayRunLines, hoursInRange, payRunTotal, shiftHours, timeEntriesFromShifts } from '@/shared/lib/payroll';
import type { PayProfile, Shift, TimeEntry } from '@/shared/types';

const profile = (over: Partial<PayProfile>): PayProfile => ({
  id: 'u1', staffName: 'A', payType: 'hourly', active: true, createdAt: 0, updatedAt: 0, ...over,
});
const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: 't', staffUserId: 'u1', staffName: 'A', date: '2026-06-10', hours: 0,
  source: 'manual', status: 'approved', createdAt: 0, updatedAt: 0, ...over,
});
const shift = (over: Partial<Shift>): Shift => ({
  id: 's', staffUserId: 'u1', staffName: 'A', date: '2026-06-10',
  start: '09:00', end: '17:00', createdAt: 0, updatedAt: 0, ...over,
});

describe('shiftHours', () => {
  test('decimal hours between two times', () => {
    expect(shiftHours('09:00', '17:00')).toBe(8);
    expect(shiftHours('09:00', '12:30')).toBe(3.5);
  });
  test('returns 0 when end is not after start', () => {
    expect(shiftHours('17:00', '09:00')).toBe(0);
    expect(shiftHours('10:00', '10:00')).toBe(0);
  });
});

describe('hoursInRange', () => {
  test('sums approved hours for the staff member within the range', () => {
    const entries = [
      entry({ id: '1', hours: 8, date: '2026-06-10' }),
      entry({ id: '2', hours: 4, date: '2026-06-12' }),
      entry({ id: '3', hours: 5, date: '2026-06-10', status: 'pending' }), // not approved
      entry({ id: '4', hours: 9, date: '2026-07-01' }),                    // out of range
      entry({ id: '5', hours: 3, date: '2026-06-11', staffUserId: 'u2' }), // other staff
    ];
    expect(hoursInRange(entries, 'u1', '2026-06-01', '2026-06-30')).toBe(12);
  });
});

describe('computePayRunLines', () => {
  const period = { periodStart: '2026-06-01', periodEnd: '2026-06-30' };

  test('hourly = approved hours × rate; salary = flat; empties dropped', () => {
    const profiles = [
      profile({ id: 'u1', staffName: 'A', payType: 'hourly', hourlyRate: 20 }),
      profile({ id: 'u2', staffName: 'B', payType: 'salary', salaryPerPeriod: 1000 }),
      profile({ id: 'u3', staffName: 'C', payType: 'hourly', hourlyRate: 15 }), // no hours → dropped
    ];
    const entries = [
      entry({ id: '1', staffUserId: 'u1', hours: 8 }),
      entry({ id: '2', staffUserId: 'u1', hours: 2, status: 'pending' }), // ignored
    ];
    const lines = computePayRunLines(profiles, entries, period);
    expect(lines).toEqual([
      { staffUserId: 'u1', staffName: 'A', payType: 'hourly', hours: 8, rate: 20, amount: 160 },
      { staffUserId: 'u2', staffName: 'B', payType: 'salary', amount: 1000 },
    ]);
    expect(payRunTotal(lines)).toBe(1160);
  });

  test('skips inactive profiles', () => {
    const lines = computePayRunLines(
      [profile({ payType: 'salary', salaryPerPeriod: 500, active: false })],
      [],
      period,
    );
    expect(lines).toEqual([]);
  });
});

describe('timeEntriesFromShifts', () => {
  test('converts in-range shifts to draft hours, skipping already-imported ones', () => {
    const shifts = [
      shift({ id: 's1', date: '2026-06-10', start: '09:00', end: '17:00' }),
      shift({ id: 's2', date: '2026-06-11', start: '08:00', end: '12:00' }),
      shift({ id: 's3', date: '2026-07-01' }), // out of range
    ];
    const existing = [entry({ shiftId: 's1', source: 'shift' })];
    const drafts = timeEntriesFromShifts(shifts, existing, '2026-06-01', '2026-06-30');
    expect(drafts).toEqual([
      { staffUserId: 'u1', staffName: 'A', date: '2026-06-11', hours: 4, source: 'shift', shiftId: 's2' },
    ]);
  });
});
