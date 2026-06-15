import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDirectoryEntry, usePublicWaivers, useMyWaiverSubmissions, useSubmitWaiver } from '@/hooks/useDirectory';
import type { PublicWaiverItem } from '@/types';

interface WaiverFormProps {
  template: PublicWaiverItem;
  onSubmit: (answers: Record<string, string | boolean>, signedName?: string) => Promise<void>;
}

function WaiverForm({ template, onSubmit }: WaiverFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [signedName, setSignedName] = useState('');
  const [saving, setSaving] = useState(false);

  const hasSignature = template.fields.some(f => f.type === 'signature');
  const missingRequired = template.fields.some(f => {
    if (!f.required) return false;
    const v = answers[f.id];
    return f.type === 'checkbox' ? v !== true : !String(v ?? '').trim();
  }) || (hasSignature && !signedName.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingRequired) return;
    setSaving(true);
    try {
      await onSubmit(answers, signedName.trim() || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {template.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{template.body}</p>}
      {template.fields.map(f => (
        <div key={f.id} className="space-y-1.5">
          {f.type !== 'checkbox' && (
            <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
          )}
          {f.type === 'textarea' ? (
            <Textarea
              value={String(answers[f.id] ?? '')}
              onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
              rows={3}
            />
          ) : f.type === 'checkbox' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={answers[f.id] === true}
                onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.checked }))}
              />
              {f.label}{f.required && <span className="text-destructive"> *</span>}
            </label>
          ) : f.type === 'signature' ? (
            <Input
              value={signedName}
              onChange={e => setSignedName(e.target.value)}
              placeholder="Type your full name to sign"
            />
          ) : (
            <Input
              type={f.type === 'date' ? 'date' : 'text'}
              value={String(answers[f.id] ?? '')}
              onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <Button type="submit" className="w-full" disabled={saving || missingRequired}>
        {saving ? 'Submitting…' : 'Submit form'}
      </Button>
    </form>
  );
}

export default function BusinessWaiversPage() {
  const { bid } = useParams<{ bid: string }>();
  const { entry, loading } = useDirectoryEntry(bid);
  const { waivers, loading: waiversLoading } = usePublicWaivers(bid);
  const { submissions } = useMyWaiverSubmissions(bid);
  const { submit } = useSubmitWaiver();
  const [justSigned, setJustSigned] = useState<Record<string, boolean>>({});

  const signedIds = new Set([...submissions.map(s => s.templateId), ...Object.keys(justSigned)]);

  if (loading) {
    return <div className="mx-auto max-w-xl space-y-4 p-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  }
  if (!entry) {
    return (
      <div className="mx-auto max-w-xl py-14 text-center text-sm text-muted-foreground">
        Business not found. <Link to="/discover" className="underline">Back to discover</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-1 sm:p-2">
      <Button render={<Link to={`/discover/${bid}`} />} variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> {entry.name}
      </Button>

      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Forms for {entry.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Complete these once — required forms must be signed before booking.</p>
      </div>

      {waiversLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : waivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FileSignature className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No forms to complete right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {waivers.map(w => {
            const signed = signedIds.has(w.id);
            return (
              <Card key={w.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {w.title}
                    {w.required && <Badge variant="secondary">Required</Badge>}
                    {signed && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                {!signed && (
                  <CardContent>
                    <WaiverForm
                      template={w}
                      onSubmit={async (answers, signedName) => {
                        await submit(bid!, { template: w, answers, signedName });
                        setJustSigned(prev => ({ ...prev, [w.id]: true }));
                      }}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
