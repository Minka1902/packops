// ─── Staff list ───────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ChevronRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/contexts/BusinessContext';
import { useStaff } from '../data';
import { useRoles } from '../../roles/data';
import { activeHeadcount, expiringCertCount } from '../certs';
import InviteStaffDialog from '../InviteStaffDialog';

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function StaffListPage() {
  const { tenant, perms } = useTenant();
  const { items: staff, loading } = useStaff(tenant);
  const { items: roles } = useRoles(tenant);
  const roleName = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);
  const [inviting, setInviting] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const active = activeHeadcount(staff);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground">{active} active · {staff.length} total</p>
        </div>
        {perms.has('staff', 'action') && (
          <Button size="sm" onClick={() => setInviting(true)}><UserPlus className="size-4" /> Invite</Button>
        )}
      </header>

      <div className="space-y-2.5">
        {staff.map((s) => {
          const expiring = expiringCertCount(s);
          return (
            <Link key={s.userId} to={`/business/staff/${s.userId}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="size-10">
                    {s.photoURL && <AvatarImage src={s.photoURL} alt={s.displayName} />}
                    <AvatarFallback>{initials(s.displayName || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{s.displayName}</p>
                      {!s.active && <Badge variant="secondary">Inactive</Badge>}
                      {s.roleId === 'owner' && <Badge variant="outline">Owner</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{roleName[s.roleId] ?? 'No role'} · {s.email}</p>
                  </div>
                  {expiring > 0 && (
                    <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-500">
                      <ShieldAlert className="size-3.5" /> {expiring}
                    </Badge>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {inviting && <InviteStaffDialog roles={roles} onClose={() => setInviting(false)} />}
    </div>
  );
}
