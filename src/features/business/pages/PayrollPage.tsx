import { useMemo, useState } from 'react';
import { Banknote, Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  useBusiness, useBusinessStaff, useMyPayslips, usePayProfiles, usePayRuns, useShifts, useTimeEntries,
} from '@/features/business/hooks/useBusiness';
import { useAuth } from '@/shared/hooks/useAuth';
import { usePermissions } from '@/shared/hooks/usePermissions';
import PayProfileEditor from '@/features/business/components/PayProfileEditor';
import PayRunCard from '@/features/business/components/PayRunCard';
import { todayStr } from '@/shared/lib/occupancy';

const monthStart = () => `${todayStr().slice(0, 7)}-01`;

type Tab = 'runs' | 'timesheets' | 'rates' | 'mypay';

export default function PayrollPage() {
  const { activeBusiness } = useBusiness();
  const { user } = useAuth();
  const { can, isOwner } = usePermissions();
  const bid = activeBusiness?.id ?? '';
  const currency = activeBusiness?.currency ?? 'USD';

  const canView = can('view_payroll');
  const canManage = can('manage_payroll');

  const { staff } = useBusinessStaff(canView ? bid : '');
  const { profiles, savePayProfile } = usePayProfiles(canView ? bid : '');
  const { timeEntries, logTime, importFromShifts, setTimeEntryApproved, deleteTimeEntry } = useTimeEntries(canView ? bid : '');
  const { payRuns, loading, createPayRun, recomputePayRun, approvePayRun, markPayRunPaid, deletePayRun } = usePayRuns(canView ? bid : '');
  const { shifts } = useShifts(canView ? bid : '');
  const { payslips } = useMyPayslips(bid, user?.uid);

  const [tab, setTab] = useState<Tab>(canView ? 'runs' : 'mypay');
  const [periodStart, setPeriodStart] = useState(monthStart());
  const [periodEnd, setPeriodEnd] = useState(todayStr());
  const [importMsg, setImportMsg] = useState('');

  // Manual time-entry form
  const [teStaffId, setTeStaffId] = useState(user?.uid ?? '');
  const [teDate, setTeDate] = useState(todayStr());
  const [teHours, setTeHours] = useState('');

  const activeStaff = useMemo(() => staff.filter(s => s.active), [staff]);
  const profileFor = (uid: string) => profiles.find(p => p.id === uid);
  const pendingEntries = timeEntries.filter(e => e.status === 'pending').length;

  if (!activeBusiness) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">No business selected.</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    ...(canView ? [
      { key: 'runs' as const, label: 'Pay runs' },
      { key: 'timesheets' as const, label: 'Timesheets' },
      ...(canManage ? [{ key: 'rates' as const, label: 'Pay rates' }] : []),
    ] : []),
    { key: 'mypay', label: 'My pay' },
  ];

  const submitTimeEntry = async () => {
    const targetId = canManage ? teStaffId : (user?.uid ?? '');
    const member = staff.find(s => s.userId === targetId);
    if (!targetId || !teHours || Number(teHours) <= 0) return;
    await logTime({
      staffUserId: targetId,
      staffName: member?.displayName,
      date: teDate,
      hours: Number(teHours),
    });
    setTeHours('');
  };

  const runImport = async () => {
    const n = await importFromShifts(shifts, periodStart, periodEnd);
    setImportMsg(n > 0 ? `Imported ${n} shift${n !== 1 ? 's' : ''} as draft hours — approve them below.` : 'No new shifts to import for this period.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Banknote className="h-5 w-5" /> Payroll
        </h1>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
            {t.label}{t.key === 'timesheets' && isOwner && pendingEntries > 0 ? ` (${pendingEntries})` : ''}
          </Button>
        ))}
      </div>

      {/* Shared pay period — drives run creation and shift import. */}
      {canView && (tab === 'runs' || tab === 'timesheets') && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pay period</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="pr-start" className="text-xs">From</Label>
              <Input id="pr-start" type="date" className="w-40" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-end" className="text-xs">To</Label>
              <Input id="pr-end" type="date" className="w-40" min={periodStart} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
            {tab === 'runs' && canManage && (
              <Button
                size="sm" className="gap-1.5" disabled={periodEnd < periodStart}
                onClick={() => void createPayRun({ periodStart, periodEnd }, profiles, timeEntries)}
              >
                <Plus className="h-3.5 w-3.5" /> Create draft run
              </Button>
            )}
            {tab === 'timesheets' && canManage && (
              <Button size="sm" variant="outline" disabled={periodEnd < periodStart} onClick={() => void runImport()}>
                Import hours from rota
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Pay runs ── */}
      {tab === 'runs' && canView && (
        loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : payRuns.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No pay runs yet. Set a period above and create a draft.</p>
        ) : (
          <div className="space-y-4">
            {payRuns.map(run => (
              <PayRunCard
                key={run.id}
                run={run}
                currency={currency}
                isOwner={isOwner}
                canManage={canManage}
                onApprove={() => void approvePayRun(run)}
                onMarkPaid={() => void markPayRunPaid(run)}
                onRecompute={() => void recomputePayRun(run, profiles, timeEntries)}
                onDelete={() => { if (confirm('Delete this draft run?')) void deletePayRun(run.id); }}
              />
            ))}
          </div>
        )
      )}

      {/* ── Timesheets ── */}
      {tab === 'timesheets' && canView && (
        <>
          {importMsg && <p className="text-xs text-muted-foreground">{importMsg}</p>}
          <Card>
            <CardHeader><CardTitle className="text-base">Log hours</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              {canManage && (
                <div className="space-y-1">
                  <Label className="text-xs">Staff</Label>
                  <Select value={teStaffId} onValueChange={v => setTeStaffId(v ?? '')}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Pick staff" /></SelectTrigger>
                    <SelectContent>
                      {activeStaff.map(s => <SelectItem key={s.userId} value={s.userId}>{s.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="te-date" className="text-xs">Date</Label>
                <Input id="te-date" type="date" className="w-40" value={teDate} onChange={e => setTeDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="te-hours" className="text-xs">Hours</Label>
                <Input id="te-hours" type="number" min="0" step="0.25" className="w-24" value={teHours} onChange={e => setTeHours(e.target.value)} />
              </div>
              <Button size="sm" className="gap-1.5" disabled={!teHours || Number(teHours) <= 0} onClick={() => void submitTimeEntry()}>
                <Plus className="h-3.5 w-3.5" /> Log
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent entries</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {timeEntries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No time logged yet.</p>
              ) : (
                timeEntries.slice(0, 60).map(e => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{e.staffName} <span className="font-normal text-muted-foreground">· {e.hours}h</span></p>
                      <p className="text-xs text-muted-foreground">{e.date} · {e.source === 'shift' ? 'from rota' : 'manual'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={e.status === 'approved' ? 'secondary' : 'outline'}>
                        {e.status === 'approved' ? 'Approved' : 'Pending'}
                      </Badge>
                      {/* Owner-only approval. */}
                      {isOwner && (e.status === 'pending' ? (
                        <Button size="sm" className="gap-1" onClick={() => void setTimeEntryApproved(e.id, true)}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => void setTimeEntryApproved(e.id, false)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Undo
                        </Button>
                      ))}
                      {(canManage || (e.staffUserId === user?.uid && e.status === 'pending')) && (
                        <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => void deleteTimeEntry(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Pay rates ── */}
      {tab === 'rates' && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pay rates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activeStaff.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No active staff.</p>
            ) : (
              activeStaff.map(s => (
                <PayProfileEditor
                  key={s.userId}
                  staff={s}
                  profile={profileFor(s.userId)}
                  currency={currency}
                  onSave={data => savePayProfile(s.userId, data)}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ── My pay (every member) ── */}
      {tab === 'mypay' && (
        <Card>
          <CardHeader><CardTitle className="text-base">My pay</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payslips.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No payslips yet.</p>
            ) : (
              payslips.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{p.periodStart} → {p.periodEnd}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.payType === 'hourly' ? `${p.hours ?? 0}h × ${(p.rate ?? 0).toFixed(2)}` : 'Salary'}
                      {p.status === 'paid' && p.paidAt ? ` · paid ${new Date(p.paidAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === 'paid' ? 'secondary' : 'outline'}>{p.status === 'paid' ? 'Paid' : 'Approved'}</Badge>
                    <span className="font-semibold tabular-nums">{p.amount.toFixed(2)} {currency}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
