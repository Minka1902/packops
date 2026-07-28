import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BusinessStaff, PayProfile, PayType } from '@/types';

interface Props {
  staff: BusinessStaff;
  profile?: PayProfile;
  currency: string;
  onSave: (data: Omit<PayProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export default function PayProfileEditor({ staff, profile, currency, onSave }: Props) {
  const [payType, setPayType] = useState<PayType>(profile?.payType ?? 'hourly');
  const [hourlyRate, setHourlyRate] = useState(profile?.hourlyRate?.toString() ?? '');
  const [salary, setSalary] = useState(profile?.salaryPerPeriod?.toString() ?? '');
  const [active, setActive] = useState(profile?.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        staffName: staff.displayName,
        payType,
        hourlyRate: payType === 'hourly' && hourlyRate ? Number(hourlyRate) : undefined,
        salaryPerPeriod: payType === 'salary' && salary ? Number(salary) : undefined,
        active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border px-3 py-3">
      <div className="min-w-32 flex-1">
        <p className="text-sm font-medium">{staff.displayName}</p>
        <p className="text-xs text-muted-foreground">{staff.email}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Pay type</Label>
        <Select value={payType} onValueChange={v => setPayType((v as PayType) ?? 'hourly')}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="salary">Salary</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {payType === 'hourly' ? (
        <div className="space-y-1">
          <Label className="text-xs">Rate / hr ({currency})</Label>
          <Input className="w-28" type="number" min="0" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Salary / run ({currency})</Label>
          <Input className="w-32" type="number" min="0" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} />
        </div>
      )}
      <div className="flex items-center gap-2 pb-1.5">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">In runs</span>
      </div>
      <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}
