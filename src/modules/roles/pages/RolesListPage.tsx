// ─── Roles list ───────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShieldCheck, Users, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/contexts/BusinessContext';
import { useTenantCollection } from '@/lib/tenant/useTenantCollection';
import { useRoles, memberCountsByRole, deleteRole, bulkReassignRole, resyncRolePerms } from '../data';
import type { TenantRole } from '../types';

export default function RolesListPage() {
  const { tenant, perms } = useTenant();
  const can = (level: 'read' | 'write' | 'action') => perms.has('roles', level);
  const { items: roles, loading } = useRoles(tenant);
  const { items: staff } = useTenantCollection(tenant, 'staff');
  const counts = useMemo(() => memberCountsByRole(staff), [staff]);

  const unsynced = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of staff) {
      const role = roles.find((r) => r.id === s.roleId);
      if (role && (s.permsSyncedAt ?? 0) < role.updatedAt) map[role.id] = (map[role.id] ?? 0) + 1;
    }
    return map;
  }, [staff, roles]);

  const [deleting, setDeleting] = useState<TenantRole | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resync = async (role: TenantRole) => {
    if (!tenant) return;
    setBusyId(role.id);
    try { await resyncRolePerms(tenant, perms, role.id, role.grants); } finally { setBusyId(null); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Roles &amp; permissions</h1>
          <p className="text-sm text-muted-foreground">{roles.length} role{roles.length === 1 ? '' : 's'}</p>
        </div>
        {can('write') && (
          <Link to="/business/roles/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="size-4" /> New role
          </Link>
        )}
      </header>

      <div className="space-y-2.5">
        {roles.map((role) => {
          const count = counts[role.id] ?? 0;
          const stale = unsynced[role.id] ?? 0;
          return (
            <Card key={role.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{role.name}</p>
                    {role.isSystem && <Badge variant="secondary">System</Badge>}
                  </div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="size-3.5" /> {count} member{count === 1 ? '' : 's'}
                    {stale > 0 && <span className="text-amber-600 dark:text-amber-500">· {stale} need resync</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {stale > 0 && can('write') && (
                    <Button variant="outline" size="sm" onClick={() => resync(role)} disabled={busyId === role.id}>
                      {busyId === role.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      Resync
                    </Button>
                  )}
                  <Link
                    to={`/business/roles/${role.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    aria-label={`Edit ${role.name}`}
                  >
                    <Pencil className="size-4" /> {role.isSystem ? 'View' : 'Edit'}
                  </Link>
                  {!role.isSystem && can('action') && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(role)} aria-label={`Delete ${role.name}`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {deleting && (
        <DeleteRoleDialog
          role={deleting}
          memberCount={counts[deleting.id] ?? 0}
          otherRoles={roles.filter((r) => r.id !== deleting.id && !r.isSystem)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function DeleteRoleDialog({
  role, memberCount, otherRoles, onClose,
}: {
  role: TenantRole;
  memberCount: number;
  otherRoles: TenantRole[];
  onClose: () => void;
}) {
  const { tenant, perms } = useTenant();
  const [target, setTarget] = useState<string>(otherRoles[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = memberCount > 0 && otherRoles.length === 0;

  const confirm = async () => {
    if (!tenant) return;
    setBusy(true); setError(null);
    try {
      if (memberCount > 0) {
        const dest = otherRoles.find((r) => r.id === target);
        if (!dest) throw new Error('Pick a role to reassign members to.');
        await bulkReassignRole(tenant, perms, role.id, dest);
      }
      await deleteRole(tenant, perms, role.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{role.name}”?</DialogTitle>
          <DialogDescription>
            {memberCount === 0
              ? 'This role has no members and will be removed.'
              : blocked
                ? `This role has ${memberCount} member${memberCount === 1 ? '' : 's'} and there is no other role to move them to. Create another role first.`
                : `Move its ${memberCount} member${memberCount === 1 ? '' : 's'} to another role, then delete it.`}
          </DialogDescription>
        </DialogHeader>

        {memberCount > 0 && !blocked && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reassign members to</label>
            <Select value={target} onValueChange={(v) => setTarget(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>
                {otherRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || blocked}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {memberCount > 0 ? 'Reassign & delete' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
