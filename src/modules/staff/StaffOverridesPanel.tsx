// ─── Staff overrides panel ────────────────────────────────────────────────────
// Reuses PermissionMatrix in three-state override mode. A present entry replaces
// the role default for that module; "None" revokes it; "Inherit" clears the
// override. Requires staff.action.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/contexts/BusinessContext';
import PermissionMatrix from '../roles/PermissionMatrix';
import { setOverrides } from './data';
import type { Grants } from '../permissions';
import type { TenantRole } from '../roles/types';
import type { StaffMember } from './types';

export default function StaffOverridesPanel({ member, role }: { member: StaffMember; role: TenantRole | undefined }) {
  const { tenant, perms, unlockedModules } = useTenant();
  const canAction = perms.has('staff', 'action') && member.roleId !== 'owner';
  const [overrides, setLocal] = useState<Grants>(member.overrides ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(overrides) !== JSON.stringify(member.overrides ?? {});

  const save = async () => {
    if (!tenant || !role) return;
    setBusy(true); setError(null);
    try {
      await setOverrides(tenant, perms, member, role, overrides);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save overrides.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Overrides replace this member’s role defaults for specific modules.
      </p>
      <PermissionMatrix
        mode="override"
        value={overrides}
        onChange={setLocal}
        roleGrants={role?.grants ?? {}}
        unlockedModules={unlockedModules}
        disabled={!canAction}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {canAction && (
        <div className="flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setLocal(member.overrides ?? {})} disabled={busy}>Reset</Button>}
          <Button onClick={save} disabled={busy || !dirty}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save overrides
          </Button>
        </div>
      )}
    </div>
  );
}
