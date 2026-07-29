// ─── Staff summaryView (dashboard widget) ─────────────────────────────────────

import { useMemo } from 'react';
import { Users, ShieldAlert, UserPlus } from 'lucide-react';
import { useTenant } from '@/shared/contexts/BusinessContext';
import { Skeleton } from '@/shared/ui/skeleton';
import { KpiTile } from '@/features/dashboard/components/KpiTile';
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

  return (
    <div className="grid grid-cols-3 gap-2">
      <KpiTile icon={Users} label="Active" value={stats.active} />
      <KpiTile icon={ShieldAlert} label="Certs expiring" value={stats.expiring} tone={stats.expiring > 0 ? 'warn' : 'default'} />
      <KpiTile icon={UserPlus} label="Joined (30d)" value={stats.recent} />
    </div>
  );
}
