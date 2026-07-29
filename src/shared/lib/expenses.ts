import type { Expense, ExpenseCategory, Invoice } from '@/shared/types';
import { addDays, todayStr } from '@/shared/lib/occupancy';

// Pure aggregations for the Expenses page and the Reports profit & loss view.
// Only approved expenses count — pending costs await the owner's sign-off.

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DayPoint { date: string; value: number }

/** 'YYYY-MM-DD' for a ms timestamp, local calendar. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Approved expense amounts per day over the trailing window (includes today). */
export function expensesByDay(expenses: Expense[], days: number, now: Date = new Date()): DayPoint[] {
  const from = addDays(todayStr(now), -(days - 1));
  const byDate: Record<string, number> = {};
  for (let i = 0; i < days; i++) byDate[addDays(from, i)] = 0;
  for (const e of expenses) {
    if (e.status !== 'approved') continue;
    if (e.date in byDate) byDate[e.date] += e.amount;
  }
  return Object.keys(byDate).sort().map(date => ({ date, value: round2(byDate[date]) }));
}

export interface CategoryTotal { category: ExpenseCategory; total: number }

/** Approved expense totals grouped by category, largest first. */
export function expensesByCategory(expenses: Expense[]): CategoryTotal[] {
  const by: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of expenses) {
    if (e.status !== 'approved') continue;
    by[e.category] = (by[e.category] ?? 0) + e.amount;
  }
  return (Object.entries(by) as [ExpenseCategory, number][])
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

/** Sum of approved expenses on/after `from` ('YYYY-MM-DD'). */
export function approvedExpenseTotal(expenses: Expense[], from?: string): number {
  return round2(expenses
    .filter(e => e.status === 'approved' && (!from || e.date >= from))
    .reduce((s, e) => s + e.amount, 0));
}

export interface ProfitAndLoss { revenue: number; expenses: number; net: number }

/**
 * Profit & loss over the trailing window: revenue (invoice payments received)
 * minus approved expenses. Mirrors revenueByDay's payment-based revenue so the
 * two figures are directly comparable.
 */
export function profitAndLoss(
  invoices: Invoice[],
  expenses: Expense[],
  days: number,
  now: Date = new Date(),
): ProfitAndLoss {
  const from = addDays(todayStr(now), -(days - 1));
  const revenue = round2(invoices.reduce((sum, inv) =>
    sum + inv.payments
      .filter(p => dayKey(p.paidAt) >= from)
      .reduce((a, p) => a + p.amount, 0), 0));
  const expense = approvedExpenseTotal(expenses, from);
  return { revenue, expenses: expense, net: round2(revenue - expense) };
}
