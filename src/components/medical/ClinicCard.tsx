// ─── ClinicCard ───────────────────────────────────────────────────────────────
// The vet clinic on a dog's care team, shown on the Medical page: who to call,
// where to go, and whether they are open right now. Everything comes from the
// public directory projection, so it renders whatever the clinic published and
// silently omits what it didn't.

import { Building2, Phone, Mail, MapPin, Clock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BusinessDirectoryEntry, DayHours } from '@/types';

function todayHours(availability?: (DayHours | null)[]): DayHours | null {
  if (!availability || availability.length !== 7) return null;
  return availability[new Date().getDay()] ?? null;
}

function isOpenNow(hours: DayHours | null): boolean {
  if (!hours) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = hours.open.split(':').map(Number);
  const [ch, cm] = hours.close.split(':').map(Number);
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}

function addressOf(entry: BusinessDirectoryEntry): string | null {
  return entry.location?.label ?? entry.city ?? null;
}

function mapsHref(entry: BusinessDirectoryEntry): string | null {
  if (entry.location?.lat !== undefined && entry.location?.lng !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${entry.location.lat},${entry.location.lng}`;
  }
  const address = addressOf(entry);
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

export default function ClinicCard({ entry, dogName }: { entry: BusinessDirectoryEntry; dogName: string }) {
  const hours = todayHours(entry.availability);
  const open = isOpenNow(hours);
  const address = addressOf(entry);
  const maps = mapsHref(entry);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {entry.logoURL
            ? <img src={entry.logoURL} alt="" className="h-full w-full object-cover" />
            : <Building2 className="h-5 w-5 text-primary" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-semibold">{entry.name}</p>
            {hours && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  open
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {open ? 'Open now' : 'Closed'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Veterinary clinic · on <span className="capitalize">{dogName}</span>&rsquo;s care team
          </p>

          {entry.ratingAvg !== undefined && entry.ratingCount ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {entry.ratingAvg.toFixed(1)} ({entry.ratingCount})
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        {hours && (
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Today {hours.open}–{hours.close}
          </p>
        )}
        {entry.phone && (
          <a href={`tel:${entry.phone}`} className="flex min-w-0 items-center gap-2 hover:underline">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {entry.phone}
          </a>
        )}
        {entry.email && (
          <a href={`mailto:${entry.email}`} className="flex min-w-0 items-center gap-2 hover:underline">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{entry.email}</span>
          </a>
        )}
        {address && (
          maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{address}</span>
            </a>
          ) : (
            <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </p>
          )
        )}
      </div>

      {entry.bookable && (
        <Link
          to={`/discover/${entry.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3 w-full')}
        >
          Book an appointment
        </Link>
      )}
    </div>
  );
}
