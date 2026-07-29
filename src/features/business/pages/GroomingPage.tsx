import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useBusiness, useGroomServices } from '@/features/business/hooks/useBusiness';
import { usePermissions } from '@/shared/hooks/usePermissions';
import type { GroomService } from '@/shared/types';

interface GroomServiceFormProps {
  initial?: GroomService;
  onSubmit: (data: Omit<GroomService, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

function GroomServiceForm({ initial, onSubmit, onCancel }: GroomServiceFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [duration, setDuration] = useState(initial?.durationMinutes != null ? String(initial.durationMinutes) : '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price) || 0,
        durationMinutes: duration !== '' ? Math.max(0, Math.floor(Number(duration))) || undefined : undefined,
        active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="groom-name">Name <span className="text-destructive">*</span></Label>
        <Input id="groom-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Full groom — medium coat" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="groom-price">Price</Label>
          <Input id="groom-price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="groom-duration">Duration (minutes)</Label>
          <Input id="groom-duration" type="number" min="0" step="5" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="groom-desc">Description</Label>
        <Textarea id="groom-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} />
        Active (shown to customers)
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}

export default function GroomingPage() {
  const { activeBusiness } = useBusiness();
  const { can } = usePermissions();
  const bid = activeBusiness?.id ?? '';
  const currency = activeBusiness?.currency ?? 'USD';
  const { groomServices, loading, createGroomService, updateGroomService, deleteGroomService } = useGroomServices(bid);

  const [addOpen, setAddOpen] = useState(false);
  const [editService, setEditService] = useState<GroomService | null>(null);

  const canView = can('view_grooming');
  const canManage = can('manage_grooming');
  const bookingOpen = activeBusiness?.grooming?.bookingOpen ?? false;

  if (!activeBusiness) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">No business selected.</div>;
  }
  if (!canView && !canManage) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">You don't have access to grooming.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Grooming</h1>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add groom service
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="text-muted-foreground">
            Online grooming bookings are{' '}
            <Badge variant={bookingOpen ? 'secondary' : 'outline'}>{bookingOpen ? 'Live' : 'Off'}</Badge>
          </span>
          {canManage && (
            <Button render={<Link to="/business/settings" />} variant="outline" size="sm">
              {bookingOpen ? 'Manage in Settings' : 'Set up in Settings'}
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : groomServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background py-14">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Scissors className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No groom services</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your groom menu — customers pick from it when booking online.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {groomServices.map(s => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{s.name}</span>
                    {!s.active && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{s.price.toFixed(2)} {currency}</span>
                    {s.durationMinutes != null && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.durationMinutes} min</span>
                    )}
                    {s.description && <span className="truncate">{s.description}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditService(s)} aria-label={`Edit ${s.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => { if (confirm(`Delete ${s.name}?`)) void deleteGroomService(s.id); }} aria-label={`Delete ${s.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add groom service</DialogTitle></DialogHeader>
          <GroomServiceForm
            onSubmit={async data => { await createGroomService(data); setAddOpen(false); }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editService} onOpenChange={o => { if (!o) setEditService(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit groom service</DialogTitle></DialogHeader>
          {editService && (
            <GroomServiceForm
              initial={editService}
              onSubmit={async data => { await updateGroomService(editService.id, data); setEditService(null); }}
              onCancel={() => setEditService(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
