import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBusiness, useExpenses } from '@/hooks/useBusiness';
import { usePermissions } from '@/hooks/usePermissions';
import ExpenseForm, { type ExpenseFormData } from '@/components/business/ExpenseForm';
import { approvedExpenseTotal, expensesByCategory } from '@/lib/expenses';
import { todayStr } from '@/lib/occupancy';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type Expense, type ExpenseCategory } from '@/types';

const monthStart = () => `${todayStr().slice(0, 7)}-01`;

export default function ExpensesPage() {
  const { activeBusiness } = useBusiness();
  const { can, isOwner } = usePermissions();
  const bid = activeBusiness?.id ?? '';
  const currency = activeBusiness?.currency ?? 'USD';
  const { expenses, loading, createExpense, updateExpense, setExpenseApproved, deleteExpense } = useExpenses(bid);

  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const canManage = can('manage_expenses');

  const monthTotal = useMemo(() => approvedExpenseTotal(expenses, monthStart()), [expenses]);
  const pendingTotal = useMemo(
    () => Math.round(expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0) * 100) / 100,
    [expenses],
  );
  const byCategory = useMemo(() => expensesByCategory(expenses), [expenses]);
  const visible = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  if (!activeBusiness) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">No business selected.</div>;
  }
  if (!can('view_expenses') && !canManage) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">You don't have access to expenses.</div>;
  }

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setFormOpen(true); };

  const submit = async (data: ExpenseFormData) => {
    if (editing) await updateExpense(editing.id, data);
    else await createExpense(data);
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Expenses</h1>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add expense
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-lg font-bold">{monthTotal.toFixed(2)} {currency}</p>
            <p className="text-xs text-muted-foreground">Approved this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-lg font-bold">{pendingTotal.toFixed(2)} {currency}</p>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="py-4">
            <p className="text-lg font-bold">{byCategory[0]?.category ? EXPENSE_CATEGORY_LABELS[byCategory[0].category] : '—'}</p>
            <p className="text-xs text-muted-foreground">Top category</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Records</CardTitle>
          <Select value={filter} onValueChange={v => setFilter((v as ExpenseCategory | 'all') ?? 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.category} value={c.category}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            visible.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <Badge variant={e.status === 'approved' ? 'secondary' : 'outline'}>
                      {e.status === 'approved' ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.date} · {EXPENSE_CATEGORY_LABELS[e.category]}{e.vendor ? ` · ${e.vendor}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums">{e.amount.toFixed(2)} {currency}</span>
                  {/* Owner-only approval — the money sign-off. */}
                  {isOwner && (
                    e.status === 'pending' ? (
                      <Button size="sm" className="gap-1" onClick={() => void setExpenseApproved(e.id, true)}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => void setExpenseApproved(e.id, false)} disabled={!!e.payRunId}>
                        <RotateCcw className="h-3.5 w-3.5" /> Unapprove
                      </Button>
                    )
                  )}
                  {canManage && !e.payRunId && (
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(e)} aria-label="Edit expense">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManage && !e.payRunId && (
                    <Button
                      variant="ghost" size="icon-sm" aria-label="Delete expense"
                      onClick={() => { if (confirm('Delete this expense?')) void deleteExpense(e.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit expense' : 'Add expense'}</DialogTitle></DialogHeader>
          <ExpenseForm
            initial={editing ?? undefined}
            onSubmit={submit}
            onCancel={() => { setFormOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
