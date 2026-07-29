import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Switch } from '@/shared/ui/switch';
import type { Business, WaiversSettings } from '@/shared/types';

interface Props {
  business: Business;
  onSave: (waivers: WaiversSettings) => Promise<void>;
}

// The owner's waiver answers: are the forms live for clients, and must required
// forms be signed before a client can book. Templates are built on the Waivers page.
export default function WaiversSettingsCard({ business, onSave }: Props) {
  const initial = business.waivers;
  const [published, setPublished] = useState(initial?.published ?? false);
  const [requiredBeforeBooking, setRequiredBeforeBooking] = useState(initial?.requiredBeforeBooking ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ published, requiredBeforeBooking });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Waivers &amp; forms</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Build your intake forms and liability waivers on the{' '}
          <Link to="/business/waivers" className="underline">Waivers page</Link>, then publish them here.
        </p>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-medium">Publish forms to clients</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active templates become available for clients to complete from the directory.
            </p>
          </div>
          <Switch checked={published} onCheckedChange={setPublished} />
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-medium">Require before booking</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Clients must complete every required form before they can book online.
            </p>
          </div>
          <Switch checked={requiredBeforeBooking} onCheckedChange={setRequiredBeforeBooking} disabled={!published} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
