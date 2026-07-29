import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import type { Business, GroomingSettings } from '@/shared/types';

interface Props {
  business: Business;
  onSave: (grooming: GroomingSettings) => Promise<void>;
}

// The owner's grooming answers: a default appointment length and whether pet
// parents can book grooming online. Bookings ride on the appointments pipeline.
export default function GroomingSettingsCard({ business, onSave }: Props) {
  const initial = business.grooming;
  const [bookingOpen, setBookingOpen] = useState(initial?.bookingOpen ?? false);
  const [defaultDuration, setDefaultDuration] = useState(
    initial?.defaultDurationMinutes != null ? String(initial.defaultDurationMinutes) : '',
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        bookingOpen,
        defaultDurationMinutes: defaultDuration !== ''
          ? Math.max(0, Math.floor(Number(defaultDuration))) || undefined
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Grooming</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="groom-duration">Default appointment length (minutes)</Label>
          <Input
            id="groom-duration"
            type="number"
            min="0"
            step="5"
            value={defaultDuration}
            onChange={e => setDefaultDuration(e.target.value)}
            placeholder="e.g. 60"
          />
          <p className="text-xs text-muted-foreground">
            Used when a groom service doesn't set its own duration. Manage the groom menu on the{' '}
            <Link to="/business/grooming" className="underline">Grooming page</Link>.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-medium">Accept grooming bookings online</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pet parents book a groom from the directory; it lands for you to confirm.
              Add at least one active groom service first.
            </p>
          </div>
          <Switch checked={bookingOpen} onCheckedChange={setBookingOpen} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
