import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type ExpensePaymentMethod } from '@/types';
import { todayStr } from '@/lib/occupancy';

export type ExpenseFormData = Omit<
  Expense,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status' | 'approvedBy' | 'approvedAt' | 'payRunId'
>;

const PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Other' },
];

interface Props {
  initial?: Partial<Expense>;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  onCancel: () => void;
}

export default function ExpenseForm({ initial, onSubmit, onCancel }: Props) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'supplies');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [vendor, setVendor] = useState(initial?.vendor ?? '');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod | ''>(initial?.paymentMethod ?? '');
  const [receiptURL, setReceiptURL] = useState(initial?.receiptURL ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setSaving(true);
    try {
      await onSubmit({
        description: description.trim(),
        category,
        amount: Number(amount),
        date,
        vendor: vendor.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        receiptURL: receiptURL.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="exp-desc">Description <span className="text-destructive">*</span></Label>
        <Input id="exp-desc" value={description} onChange={e => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory((v as ExpenseCategory) ?? 'supplies')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.category} value={c.category}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-amount">Amount <span className="text-destructive">*</span></Label>
          <Input id="exp-amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-date">Date</Label>
          <Input id="exp-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-vendor">Vendor</Label>
          <Input id="exp-vendor" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Who was paid" />
        </div>
        <div className="space-y-1.5">
          <Label>Payment method</Label>
          <Select value={paymentMethod} onValueChange={v => setPaymentMethod((v as ExpensePaymentMethod) ?? '')}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-receipt">Receipt URL</Label>
        <Input id="exp-receipt" value={receiptURL} onChange={e => setReceiptURL(e.target.value)} placeholder="Link to a receipt (optional)" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exp-notes">Notes</Label>
        <Textarea id="exp-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !description.trim() || !amount}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}
