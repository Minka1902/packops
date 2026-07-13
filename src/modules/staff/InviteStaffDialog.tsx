// ─── Invite staff dialog ──────────────────────────────────────────────────────

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/contexts/BusinessContext';
import { inviteStaff } from './data';
import type { TenantRole } from '../roles/types';

export default function InviteStaffDialog({ roles, onClose }: { roles: TenantRole[]; onClose: () => void }) {
  const { tenant, perms, myStaff } = useTenant();
  const assignable = roles.filter((r) => !r.isSystem);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(assignable[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!tenant || !myStaff) return;
    const role = assignable.find((r) => r.id === roleId);
    if (!email.trim() || !role) { setError('Enter an email and pick a role.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await inviteStaff(tenant, perms, myStaff.userId, email.trim(), role);
      if (!res.ok) { setError(res.reason ?? 'Could not invite that user.'); return; }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not invite that user.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They must already have a PackOps account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>
                {assignable.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
