// ─── Roles summaryView (dashboard widget) ─────────────────────────────────────
// Compact, self-fetching. The dashboard SummaryCard supplies the header/Open
// link; this renders the body only. Bounded: roles/staff are small collections.

import { useMemo } from 'react';
import { useTenant } from '@/contexts/BusinessContext';
import { useTenantCollection } from '@/lib/tenant/useTenantCollection';
import { Skeleton } from '@/components/ui/skeleton';
import { useRoles, memberCountsByRole } from './data';

export default function RolesSummary() {
  const { tenant } = useTenant();
  const { items: roles, loading } = useRoles(tenant);
  const { items: staff } = useTenantCollection(tenant, 'staff');
  const counts = useMemo(() => memberCountsByRole(staff), [staff]);

  const unsynced = useMemo(
    () => staff.filter((s) => {
      const role = roles.find((r) => r.id === s.roleId);
      return role && (s.permsSyncedAt ?? 0) < role.updatedAt;
    }).length,
    [staff, roles],
  );

  if (loading) return <Skeleton className="h-24 w-full" />;

  const maxCount = Math.max(1, ...roles.map((r) => counts[r.id] ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{roles.length}</span>
        <span className="text-sm text-muted-foreground">role{roles.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1.5">
        {roles.slice(0, 5).map((r) => {
          const c = counts[r.id] ?? 0;
          return (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 truncate text-muted-foreground">{r.name}</span>
              <span className="h-2 rounded-full bg-primary/70" style={{ width: `${(c / maxCount) * 100}%`, minWidth: c ? 6 : 0 }} />
              <span className="tabular-nums text-muted-foreground">{c}</span>
            </li>
          );
        })}
      </ul>
      {unsynced > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">{unsynced} member{unsynced === 1 ? '' : 's'} need a permission resync.</p>
      )}
    </div>
  );
}
