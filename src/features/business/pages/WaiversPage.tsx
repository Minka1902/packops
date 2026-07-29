import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useBusiness, useWaiverTemplates, useWaiverSubmissions } from '@/features/business/hooks/useBusiness';
import { usePermissions } from '@/shared/hooks/usePermissions';
import type { WaiverField, WaiverFieldType, WaiverTemplate } from '@/shared/types';

const FIELD_TYPES: { type: WaiverFieldType; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'textarea', label: 'Long text' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'signature', label: 'Signature' },
  { type: 'date', label: 'Date' },
];

let fieldSeq = 0;
const newFieldId = () => `f_${Date.now()}_${fieldSeq++}`;

interface TemplateFormProps {
  initial?: WaiverTemplate;
  onSubmit: (data: Omit<WaiverTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

function TemplateForm({ initial, onSubmit, onCancel }: TemplateFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [fields, setFields] = useState<WaiverField[]>(initial?.fields ?? []);
  const [active, setActive] = useState(initial?.active ?? true);
  const [required, setRequired] = useState(initial?.required ?? false);
  const [saving, setSaving] = useState(false);

  const addField = () =>
    setFields(f => [...f, { id: newFieldId(), label: '', type: 'text', required: false }]);
  const updateField = (id: string, patch: Partial<WaiverField>) =>
    setFields(f => f.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const removeField = (id: string) => setFields(f => f.filter(x => x.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        fields: fields
          .filter(f => f.label.trim())
          .map(f => ({ id: f.id, label: f.label.trim(), type: f.type, required: f.required })),
        active,
        required,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="wv-title">Title <span className="text-destructive">*</span></Label>
        <Input id="wv-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Liability waiver" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wv-body">Agreement text</Label>
        <Textarea id="wv-body" value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="The terms the client agrees to…" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Fields</Label>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addField}>
            <Plus className="h-3.5 w-3.5" /> Add field
          </Button>
        </div>
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground">No fields yet — add fields the client must fill in (or just collect a signature).</p>
        )}
        {fields.map(f => (
          <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <Input
              className="min-w-[8rem] flex-1"
              value={f.label}
              onChange={e => updateField(f.id, { label: e.target.value })}
              placeholder="Field label"
            />
            <Select value={f.type} onValueChange={v => updateField(f.id, { type: v as WaiverFieldType })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={f.required ?? false} onCheckedChange={v => updateField(f.id, { required: v })} />
              Required
            </label>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(f.id)} aria-label="Remove field">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} />
        Active (included when forms are published)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={required} onCheckedChange={setRequired} />
        Required before a client can book
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}

export default function WaiversPage() {
  const { activeBusiness } = useBusiness();
  const { can } = usePermissions();
  const bid = activeBusiness?.id ?? '';
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useWaiverTemplates(bid);
  const { submissions, loading: subsLoading } = useWaiverSubmissions(bid);

  const [addOpen, setAddOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<WaiverTemplate | null>(null);

  const canView = can('view_waivers');
  const canManage = can('manage_waivers');
  const published = activeBusiness?.waivers?.published ?? false;

  if (!activeBusiness) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">No business selected.</div>;
  }
  if (!canView && !canManage) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">You don't have access to waivers.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Waivers &amp; forms</h1>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add form
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="text-muted-foreground">
            Forms are{' '}
            <Badge variant={published ? 'secondary' : 'outline'}>{published ? 'Published' : 'Unpublished'}</Badge>
          </span>
          {canManage && (
            <Button render={<Link to="/business/settings" />} variant="outline" size="sm">
              {published ? 'Manage in Settings' : 'Publish in Settings'}
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background py-14">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileSignature className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No forms yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create intake forms and liability waivers, then publish them in Settings.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{t.title}</span>
                    {!t.active && <Badge variant="outline">Hidden</Badge>}
                    {t.required && <Badge variant="secondary">Required</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.fields.length} field{t.fields.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditTemplate(t)} aria-label={`Edit ${t.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => { if (confirm(`Delete ${t.title}?`)) void deleteTemplate(t.id); }} aria-label={`Delete ${t.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" /> Completed forms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subsLoading ? (
            <Skeleton className="h-12 w-full rounded-lg" />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed forms yet.</p>
          ) : (
            submissions.map(s => (
              <div key={s.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{s.templateTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.customerName} · {new Date(s.signedAt).toLocaleDateString()}
                  </span>
                </div>
                {Object.keys(s.answers).length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {Object.entries(s.answers).map(([k, v]) => (
                      <li key={k}>{typeof v === 'boolean' ? `${v ? '✓' : '✗'} ${k}` : `${v}`}</li>
                    ))}
                  </ul>
                )}
                {s.signedName && <p className="mt-1 text-xs italic text-muted-foreground">Signed: {s.signedName}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add form</DialogTitle></DialogHeader>
          <TemplateForm
            onSubmit={async data => { await createTemplate(data); setAddOpen(false); }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTemplate} onOpenChange={o => { if (!o) setEditTemplate(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit form</DialogTitle></DialogHeader>
          {editTemplate && (
            <TemplateForm
              initial={editTemplate}
              onSubmit={async data => { await updateTemplate(editTemplate.id, data); setEditTemplate(null); }}
              onCancel={() => setEditTemplate(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
