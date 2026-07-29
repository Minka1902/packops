// ─── AlertsStrip ──────────────────────────────────────────────────────────────
// Business-wide attention items shown atop the Owner Dashboard. Phase 1 surfaces
// stale permission snapshots; later phases let modules contribute alerts (low
// stock, unpaid invoices, forgotten clock-outs, …).

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useBusiness } from '@/shared/contexts/BusinessContext';
import { useTenantCollection } from '@/shared/lib/tenant/useTenantCollection';

interface Alert {
  id: string;
  tone: 'warn' | 'info';
  message: string;
  to?: string;
  action?: string;
}

export function AlertsStrip() {
  const { tenant, isOwner } = useBusiness();
  const { items: staff } = useTenantCollection(tenant, 'staff');
  const { items: roles } = useTenantCollection(tenant, 'roles');

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    if (isOwner) {
      const stale = staff.filter((s) => {
        const role = roles.find((r) => r.id === s.roleId);
        return role && (s.permsSyncedAt ?? 0) < role.updatedAt;
      }).length;
      if (stale > 0) {
        out.push({
          id: 'stale-perms',
          tone: 'warn',
          message: `${stale} team member${stale === 1 ? '' : 's'} have out-of-date permissions.`,
          to: '/business/roles',
          action: 'Review roles',
        });
      }
    }
    return out;
  }, [staff, roles, isOwner]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
            a.tone === 'warn'
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
              : 'bg-muted/40 text-muted-foreground',
          )}
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{a.message}</span>
          {a.to && a.action && (
            <Link to={a.to} className="font-medium underline underline-offset-2">{a.action}</Link>
          )}
        </div>
      ))}
    </div>
  );
}
