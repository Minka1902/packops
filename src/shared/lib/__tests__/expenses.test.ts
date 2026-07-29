import { describe, test, expect } from 'vitest';
import { approvedExpenseTotal, expensesByCategory, expensesByDay, profitAndLoss } from '@/shared/lib/expenses';
import type { Expense, Invoice } from '@/shared/types';

// "Now" pinned so date bucketing is deterministic (2026-06-12 local noon).
const NOW = new Date(2026, 5, 12, 12, 0, 0);
const at = (daysAgo: number) => new Date(2026, 5, 12 - daysAgo, 10, 0, 0).getTime();
const dstr = (daysAgo: number) => {
  const d = new Date(2026, 5, 12 - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const exp = (over: Partial<Expense>): Expense => ({
  id: 'e', description: 'x', category: 'supplies', amount: 0, date: dstr(0),
  status: 'approved', createdAt: 0, updatedAt: 0, createdBy: 'u', ...over,
});

const inv = (payments: { amount: number; paidAt: number }[]): Invoice => ({
  id: 'i', number: '1', customerId: 'c', customerName: 'Ada', lineItems: [],
  subtotal: 0, total: 0, amountPaid: 0, status: 'paid',
  payments: payments.map(p => ({ ...p, method: 'cash', recordedBy: 'u' })),
  createdAt: 0, updatedAt: 0, createdBy: 'u',
});

describe('expensesByCategory', () => {
  test('groups approved expenses and sorts by total desc', () => {
    const result = expensesByCategory([
      exp({ category: 'rent', amount: 1000 }),
      exp({ category: 'supplies', amount: 50 }),
      exp({ category: 'supplies', amount: 30 }),
    ]);
    expect(result).toEqual([
      { category: 'rent', total: 1000 },
      { category: 'supplies', total: 80 },
    ]);
  });

  test('ignores pending expenses', () => {
    const result = expensesByCategory([
      exp({ category: 'rent', amount: 1000, status: 'pending' }),
      exp({ category: 'supplies', amount: 50 }),
    ]);
    expect(result).toEqual([{ category: 'supplies', total: 50 }]);
  });
});

describe('approvedExpenseTotal', () => {
  test('sums approved only, optionally filtered by from date', () => {
    const expenses = [
      exp({ amount: 100, date: dstr(2) }),
      exp({ amount: 200, date: dstr(40) }),
      exp({ amount: 999, date: dstr(0), status: 'pending' }),
    ];
    expect(approvedExpenseTotal(expenses)).toBe(300);
    expect(approvedExpenseTotal(expenses, dstr(10))).toBe(100);
  });
});

describe('expensesByDay', () => {
  test('buckets approved expenses across the window', () => {
    const points = expensesByDay([
      exp({ amount: 10, date: dstr(0) }),
      exp({ amount: 5, date: dstr(0) }),
      exp({ amount: 99, date: dstr(0), status: 'pending' }),
    ], 7, NOW);
    expect(points).toHaveLength(7);
    expect(points[points.length - 1]).toEqual({ date: dstr(0), value: 15 });
  });
});

describe('profitAndLoss', () => {
  test('revenue (payments) minus approved expenses over the window', () => {
    const invoices = [inv([{ amount: 500, paidAt: at(1) }, { amount: 300, paidAt: at(40) }])];
    const expenses = [
      exp({ amount: 200, date: dstr(1) }),
      exp({ amount: 50, date: dstr(2), status: 'pending' }), // ignored
    ];
    expect(profitAndLoss(invoices, expenses, 30, NOW)).toEqual({ revenue: 500, expenses: 200, net: 300 });
  });
});
