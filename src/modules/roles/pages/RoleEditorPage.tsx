// ─── Role editor ──────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/contexts/BusinessContext';
import PermissionMatrix from '../PermissionMatrix';
import { useRoles, createRole, saveRole, RoleConflictError } from '../data';
import type { Grants } from '../../permissions';
import type { TenantRole } from '../types';

export default function RoleEditorPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const isNew = roleId === 'new';
  const navigate = useNavigate();
  const { tenant, perms, unlockedModules } = useTenant();
  const { items: roles, loading } = useRoles(tenant);

  const existing = useMemo<TenantRole | undefined>(
    () => (isNew ? undefined : roles.find((r) => r.id === roleId)),
    [isNew, roles, roleId],
  );
  const readOnly = !!existing?.isSystem || !perms.has('roles', 'write');

  const [name, setName] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grants | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed local state from the loaded role (or blank for new).
  const seededName = name ?? existing?.name ?? '';
  const seededGrants = grants ?? existing?.grants ?? {};

  if (!isNew && loading && !existing) {
    return <div className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-64 w-full rounded-xl" /></div>;
  }
  if (!isNew && !loading && !existing) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-muted-foreground">This role no longer exists.</p>
        <Link to="/business/roles" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Back to roles</Link>
      </div>
    );
  }

  const submit = async () => {
    if (!tenant) return;
    if (!seededName.trim()) { setError('Give the role a name.'); return; }
    setBusy(true); setError(null);
    try {
      if (isNew) await createRole(tenant, perms, seededName.trim(), seededGrants);
      else await saveRole(tenant, perms, existing!, { name: seededName.trim(), grants: seededGrants });
      navigate('/business/roles');
    } catch (e) {
      setError(e instanceof RoleConflictError ? e.message : e instanceof Error ? e.message : 'Could not save the role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="flex items-center gap-2">
        <Link to="/business/roles" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">{isNew ? 'New role' : existing?.name}</h1>
      </div>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="size-4" />
          {existing?.isSystem ? 'The owner role has every permission and can’t be edited.' : 'You have read-only access to roles.'}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="role-name">Role name</Label>
        <Input
          id="role-name"
          value={seededName}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Front desk"
          disabled={readOnly}
          className="max-w-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <PermissionMatrix
          value={seededGrants}
          onChange={setGrants}
          unlockedModules={unlockedModules}
          disabled={readOnly}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!readOnly && (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/80 py-3 backdrop-blur">
          <Link to="/business/roles" className={buttonVariants({ variant: 'outline' })}>Cancel</Link>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {isNew ? 'Create role' : 'Save changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
