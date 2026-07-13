// ─── Staff detail ─────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Mail, ShieldAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/contexts/BusinessContext';
import { useStaff, assignRole, setStaffActive, removeStaff, updateCertifications } from '../data';
import { useRoles } from '../../roles/data';
import { certStatus, type CertStatus } from '../certs';
import StaffOverridesPanel from '../StaffOverridesPanel';
import type { StaffCertification, StaffMember } from '../types';

const STATUS_BADGE: Record<CertStatus, { label: string; className: string } | null> = {
  none: null,
  valid: { label: 'Valid', className: 'text-muted-foreground' },
  expiring: { label: 'Expiring soon', className: 'border-amber-500/40 text-amber-600 dark:text-amber-500' },
  expired: { label: 'Expired', className: 'border-destructive/40 text-destructive' },
};

export default function StaffDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { tenant, perms, myStaff } = useTenant();
  const { items: staff, loading } = useStaff(tenant);
  const { items: roles } = useRoles(tenant);

  const member = useMemo(() => staff.find((s) => s.userId === userId), [staff, userId]);
  const role = useMemo(() => roles.find((r) => r.id === member?.roleId), [roles, member]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !member) {
    return <div className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton className="h-9 w-40" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  }
  if (!member) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-2">
        <p className="text-sm text-muted-foreground">This team member no longer exists.</p>
        <Link to="/business/staff" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Back to staff</Link>
      </div>
    );
  }

  const isOwnerRow = member.roleId === 'owner';
  const isSelf = member.userId === myStaff?.userId;
  const canWrite = perms.has('staff', 'write') && !isOwnerRow;
  const canAction = perms.has('staff', 'action') && !isOwnerRow;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  };

  const changeRole = (roleId: string) => {
    const next = roles.find((r) => r.id === roleId);
    if (tenant && next) void run(() => assignRole(tenant, perms, member, next));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Link to="/business/staff" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">{member.displayName}</h1>
        {!member.active && <Badge variant="secondary">Inactive</Badge>}
        {isOwnerRow && <Badge variant="outline">Owner</Badge>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Contact & role</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="size-4" /> {member.email}</p>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={member.roleId} onValueChange={(v) => v && changeRole(v)} disabled={!canWrite || busy}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id} disabled={r.isSystem && r.id !== 'owner'}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isOwnerRow && <p className="text-xs text-muted-foreground">The owner always has every permission.</p>}
          </div>
        </CardContent>
      </Card>

      <CertificationsCard member={member} canEdit={canWrite} busy={busy} onSave={(certs) => tenant && run(() => updateCertifications(tenant, perms, member, certs))} />

      {!isOwnerRow && (
        <Card>
          <CardHeader><CardTitle className="text-base">Permission overrides</CardTitle></CardHeader>
          <CardContent><StaffOverridesPanel member={member} role={role} /></CardContent>
        </Card>
      )}

      {canAction && (
        <Card>
          <CardHeader><CardTitle className="text-base">Danger zone</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={busy || isSelf}
              onClick={() => tenant && run(() => setStaffActive(tenant, perms, member, !member.active))}
            >
              {member.active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || isSelf}
              onClick={() => tenant && run(() => removeStaff(tenant, perms, member))}
            >
              <Trash2 className="size-4" /> Remove from business
            </Button>
            {isSelf && <p className="text-xs text-muted-foreground">You can’t deactivate or remove yourself.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CertificationsCard({
  member, canEdit, busy, onSave,
}: {
  member: StaffMember;
  canEdit: boolean;
  busy: boolean;
  onSave: (certs: StaffCertification[]) => void;
}) {
  const certs = member.certifications ?? [];
  const [name, setName] = useState('');
  const [expires, setExpires] = useState('');

  const add = () => {
    if (!name.trim()) return;
    const cert: StaffCertification = { name: name.trim(), expiresAt: expires ? new Date(`${expires}T12:00:00`).getTime() : undefined };
    onSave([...certs, cert]);
    setName(''); setExpires('');
  };
  const remove = (i: number) => onSave(certs.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Certifications</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {certs.length === 0 && <p className="text-sm text-muted-foreground">No certifications recorded.</p>}
        <ul className="space-y-2">
          {certs.map((c, i) => {
            const badge = STATUS_BADGE[certStatus(c)];
            return (
              <li key={`${c.name}-${i}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="flex-1 truncate font-medium">{c.name}</span>
                {c.expiresAt && <span className="text-xs text-muted-foreground">{new Date(c.expiresAt).toLocaleDateString()}</span>}
                {badge && <Badge variant="outline" className={`gap-1 ${badge.className}`}>{badge.label === 'Expiring soon' && <ShieldAlert className="size-3" />}{badge.label}</Badge>}
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" disabled={busy} onClick={() => remove(i)} aria-label={`Remove ${c.name}`}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1.5"><Label htmlFor="cert-name">Certification</Label><Input id="cert-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pet First Aid" /></div>
            <div className="space-y-1.5"><Label htmlFor="cert-exp">Expires</Label><Input id="cert-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
            <Button variant="outline" onClick={add} disabled={busy || !name.trim()}><Plus className="size-4" /> Add</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
