// ─── Staff summaryView (dashboard widget) ─────────────────────────────────────

import { useMemo } from 'react';
import { Users, ShieldAlert, UserPlus } from 'lucide-react';
import { useTenant } from '@/contexts/BusinessContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaff } from './data';
import { activeHeadcount, expiringCertCount } from './certs';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default function StaffSummary() {
  const { tenant } = useTenant();
  const { items: staff, loading } = useStaff(tenant);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      active: activeHeadcount(staff),
      expiring: staff.reduce((n, s) => n + expiringCertCount(s, now), 0),
      recent: staff.filter((s) => now - s.joinedAt <= RECENT_WINDOW_MS).length,
    };
  }, [staff]);

  if (loading) return <Skeleton className="h-24 w-full" />;

  const tiles = [
    { icon: Users, label: 'Active', value: stats.active },
    { icon: ShieldAlert, label: 'Certs expiring', value: stats.expiring, warn: stats.expiring > 0 },
    { icon: UserPlus, label: 'Joined (30d)', value: stats.recent },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border p-2.5">
          <t.icon className={`size-4 ${t.warn ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`} />
          <p className={`mt-1 text-xl font-semibold tabular-nums ${t.warn ? 'text-amber-600 dark:text-amber-500' : ''}`}>{t.value}</p>
          <p className="text-xs text-muted-foreground">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
