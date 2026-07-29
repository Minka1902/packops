import type { PayProfile, PayRunLine, Shift, TimeEntry } from '@/shared/types';

// Pure payroll math for the Payroll page and tests. Pay-run lines are derived
// from approved time entries (hourly staff) or a flat salary amount; nothing here
// touches Firestore.

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Decimal hours between two 'HH:MM' times on the same day (0 if end <= start). */
export function shiftHours(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const mins = toMin(end) - toMin(start);
  return mins > 0 ? round2(mins / 60) : 0;
}

/** Sum of approved worked hours for a staff member within [from, to] inclusive. */
export function hoursInRange(entries: TimeEntry[], staffUserId: string, from: string, to: string): number {
  return round2(entries
    .filter(e => e.staffUserId === staffUserId && e.status === 'approved' && e.date >= from && e.date <= to)
    .reduce((s, e) => s + e.hours, 0));
}

export interface PayPeriod { periodStart: string; periodEnd: string }

/**
 * Build pay-run lines for the active staff in the period. Salaried staff get
 * their flat amount; hourly staff get approved hours × rate. Zero-amount hourly
 * lines (no approved hours) are dropped so a run only lists who is actually paid.
 */
export function computePayRunLines(
  profiles: PayProfile[],
  entries: TimeEntry[],
  period: PayPeriod,
): PayRunLine[] {
  const lines: PayRunLine[] = [];
  for (const p of profiles) {
    if (!p.active) continue;
    if (p.payType === 'salary') {
      const amount = round2(p.salaryPerPeriod ?? 0);
      if (amount <= 0) continue;
      lines.push({ staffUserId: p.id, staffName: p.staffName, payType: 'salary', amount });
    } else {
      const hours = hoursInRange(entries, p.id, period.periodStart, period.periodEnd);
      if (hours <= 0) continue;
      const rate = p.hourlyRate ?? 0;
      lines.push({ staffUserId: p.id, staffName: p.staffName, payType: 'hourly', hours, rate, amount: round2(hours * rate) });
    }
  }
  return lines;
}

/** Sum of a pay run's line amounts. */
export function payRunTotal(lines: PayRunLine[]): number {
  return round2(lines.reduce((s, l) => s + l.amount, 0));
}

/**
 * Turn scheduled shifts in a date range into draft time entries (one per shift),
 * skipping shifts that already have a generated entry. Used by "generate from
 * rota" so a manager doesn't re-key hours staff were rostered for.
 */
export function timeEntriesFromShifts(
  shifts: Shift[],
  existing: TimeEntry[],
  from: string,
  to: string,
): { staffUserId: string; staffName: string; date: string; hours: number; source: 'shift'; shiftId: string }[] {
  const haveShiftIds = new Set(existing.filter(e => e.shiftId).map(e => e.shiftId));
  return shifts
    .filter(s => s.date >= from && s.date <= to && !haveShiftIds.has(s.id))
    .map(s => ({
      staffUserId: s.staffUserId,
      staffName: s.staffName,
      date: s.date,
      hours: shiftHours(s.start, s.end),
      source: 'shift' as const,
      shiftId: s.id,
    }))
    .filter(e => e.hours > 0);
}
