import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSignature, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDirectoryEntry, useBooking, useRequiredWaiverGate } from '@/hooks/useDirectory';
import { generateSlots, dayStartOffset } from '@/lib/availability';
import { DEFAULT_SLOT_MINUTES } from '@/types';

const DAYS_AHEAD = 14;
const fmtSlot = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function toLocalMin(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function BusinessGroomingPage() {
  const { bid } = useParams<{ bid: string }>();
  const { entry, loading } = useDirectoryEntry(bid);
  const { book } = useBooking();
  const { blocked: waiverBlocked, missing } = useRequiredWaiverGate(bid, entry?.waivers?.required);

  const [service, setService] = useState('');
  const [start, setStart] = useState(toLocalMin());
  const [dayOffset, setDayOffset] = useState(0);
  const [slotStart, setSlotStart] = useState<number | null>(null);
  const [petName, setPetName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menu = entry?.groomMenu ?? [];
  const chosen = menu.find(m => m.name === service);

  const hasAvailability = !!entry?.availability?.some(Boolean);
  const slotMin = chosen?.durationMinutes ?? entry?.slotMinutes ?? DEFAULT_SLOT_MINUTES;
  const slots = useMemo(
    () => (hasAvailability
      ? generateSlots(dayStartOffset(dayOffset), entry?.availability, slotMin, entry?.busySlots ?? [])
      : []),
    [hasAvailability, dayOffset, entry?.availability, entry?.busySlots, slotMin],
  );

  const canSubmit = !!service && (hasAvailability ? slotStart !== null : !!start) && !waiverBlocked;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bid || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const startAt = hasAvailability ? slotStart! : new Date(start).getTime();
      const minutes = chosen?.durationMinutes ?? slotMin;
      await book(bid, {
        serviceLabel: service,
        startAt,
        endAt: startAt + minutes * 60_000,
        petName: petName.trim() || undefined,
        notes: notes.trim() || undefined,
        kind: 'grooming',
      });
      setDone(true);
    } catch {
      setError('Could not submit your grooming booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-xl space-y-4 p-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  }
  if (!entry) {
    return (
      <div className="mx-auto max-w-xl py-14 text-center text-sm text-muted-foreground">
        Business not found. <Link to="/discover" className="underline">Back to discover</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-1 sm:p-2">
      <Button render={<Link to={`/discover/${bid}`} />} variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> {entry.name}
      </Button>

      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Book a groom at {entry.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Pick a service and a time — the salon confirms each booking.</p>
      </div>

      {!entry.grooming?.bookingOpen ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            This business isn't accepting online grooming bookings right now.
          </CardContent>
        </Card>
      ) : waiverBlocked ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <FileSignature className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-semibold">Complete required forms first</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.name} requires {missing.length} form{missing.length !== 1 ? 's' : ''} before booking.
              </p>
            </div>
            <Button render={<Link to={`/discover/${bid}/waivers`} />} size="sm">Complete forms</Button>
          </CardContent>
        </Card>
      ) : done ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <div>
              <p className="font-semibold">Grooming requested</p>
              <p className="mt-1 text-sm text-muted-foreground">{entry.name} will confirm your appointment.</p>
            </div>
            <Button render={<Link to="/discover" />} variant="outline" size="sm">Back to discover</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4" /> Request a groom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBook} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Service <span className="text-destructive">*</span></Label>
                {menu.length > 0 ? (
                  <Select value={service} onValueChange={v => setService(v ?? '')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose a groom service" /></SelectTrigger>
                    <SelectContent>
                      {menu.map(m => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name} — {m.price.toFixed(2)} {entry.currency ?? ''}{m.durationMinutes ? ` · ${m.durationMinutes} min` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    No groom services published yet.
                  </p>
                )}
              </div>

              {hasAvailability ? (
                <div className="space-y-2">
                  <Label>Pick a free slot <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {Array.from({ length: DAYS_AHEAD }, (_, i) => i).map(off => {
                      const d = new Date(dayStartOffset(off));
                      const active = off === dayOffset;
                      return (
                        <button
                          key={off}
                          type="button"
                          onClick={() => { setDayOffset(off); setSlotStart(null); }}
                          className={`flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        >
                          <span>{d.toLocaleDateString([], { weekday: 'short' })}</span>
                          <span className="font-semibold">{d.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                  {slots.length === 0 ? (
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">No free slots that day. Try another date.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map(s => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSlotStart(s.start)}
                          className={`rounded-lg border py-1.5 text-sm ${slotStart === s.start ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          {fmtSlot(s.start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="groom-start">Date &amp; time <span className="text-destructive">*</span></Label>
                  <Input id="groom-start" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="groom-pet">Pet name</Label>
                <Input id="groom-pet" value={petName} onChange={e => setPetName(e.target.value)} placeholder="Optional" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="groom-notes">Notes</Label>
                <Textarea id="groom-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Coat condition, behaviour, anything to know" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting || !canSubmit}>
                {submitting ? 'Requesting…' : 'Request groom'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
