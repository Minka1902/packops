import { useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addDoc } from 'firebase/firestore';
import { MapPin, Clock, Zap, TrendingUp } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useDog } from '@/contexts/DogContext';
import { useAuth } from '@/hooks/useAuth';
import { routinesCol } from '@/lib/firestore';
import { listContainer, listItem } from '@/lib/motion';
import { stripUndefined } from '@/lib/utils';
import DogWalkLogCard, { type DogWalkLog } from '@/components/walk/DogWalkLogCard';

const WalkMap = lazy(() => import('@/components/walk/WalkMap'));

interface WalkState {
  elapsedSeconds: number;
  distanceKm: number;
  avgSpeedKmh: number;
  dogIds?: string[];
  coords?: { lat: number; lng: number }[];
}

// Keep persisted routes compact — sample down to ~300 points for long walks.
function sampleRoute(coords: { lat: number; lng: number }[], max = 300): { lat: number; lng: number }[] {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  const out = coords.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1]);
  return out;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pace(distanceKm: number, seconds: number): string {
  if (distanceKm < 0.05) return '—';
  const mpk = seconds / 60 / distanceKm;
  return `${Math.floor(mpk)}:${String(Math.round((mpk % 1) * 60)).padStart(2, '0')}`;
}

interface StatProps { icon: React.ReactNode; label: string; value: string; sub?: string }
function Stat({ icon, label, value, sub }: StatProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl min-h-[72px]"
      style={{ backgroundColor: 'oklch(0.18 0.014 55)', border: '1px solid oklch(1 0 0 / 6%)' }}
    >
      <div className="text-amber-400 opacity-70">{icon}</div>
      <div
        className="text-3xl font-bold tabular-nums leading-none"
        style={{ fontFamily: 'var(--font-heading)', color: '#F8F0E3', letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'oklch(0.52 0.01 55)' }}>
          {label}
        </p>
        {sub && <p className="text-[10px]" style={{ color: 'oklch(0.42 0.01 55)' }}>{sub}</p>}
      </div>
    </div>
  );
}

const EMPTY_LOG: DogWalkLog = { peed: false, pooped: false, note: '' };

/**
 * Persist one walk per dog. Every dog shares the route and duration but carries
 * its own note and its own pee/poop children, linked back by parentLogId.
 * Module-level so it stays a plain data operation, independent of the component.
 */
async function saveWalkForDogs(
  dogIds: string[],
  logs: (id: string) => DogWalkLog,
  walkStats: Record<string, unknown>,
  now: number,
  by: { loggedBy: string; loggedByName: string; source: 'manual' },
) {
  await Promise.all(dogIds.map(async dogId => {
    const log = logs(dogId);
    const walkRef = await addDoc(routinesCol(dogId), stripUndefined({
      dogId, type: 'walk', ...by, ...walkStats,
      notes: log.note.trim() || undefined,
    }));
    const child = (type: 'pee' | 'poop') => addDoc(routinesCol(dogId), stripUndefined({
      dogId, type, timestamp: now, ...by, parentLogId: walkRef.id,
    }));
    if (log.peed) await child('pee');
    if (log.pooped) await child('poop');
  }));
}

export default function WalkSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeDog, dogs } = useDog();
  const { user } = useAuth();
  const reduced = useReducedMotion();

  const state = location.state as WalkState | null;

  // Dogs that were actually on this walk, in the order they were picked. Falls
  // back to the active dog for a solo walk (or a summary reached without state).
  const walkedDogIds = state?.dogIds?.length ? state.dogIds : (activeDog ? [activeDog.id] : []);
  const walkedDogs = walkedDogIds
    .map(id => dogs.find(d => d.id === id) ?? (id === activeDog?.id ? activeDog : null))
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // Each dog gets its own outcome — on a group walk one dog may go and another
  // may not, and the note that matters is usually about a specific dog.
  const [logs, setLogs] = useState<Record<string, DogWalkLog>>({});
  const [saving, setSaving] = useState(false);
  // Without this a failed write left the button stuck on "Saving…" forever.
  const [saveError, setSaveError] = useState<string | null>(null);
  const logFor = (id: string): DogWalkLog => logs[id] ?? EMPTY_LOG;
  const setLogFor = (id: string, next: DogWalkLog) => setLogs(prev => ({ ...prev, [id]: next }));

  // If no state, this page was reached directly — redirect home
  if (!state || !activeDog) {
    navigate('/', { replace: true });
    return null;
  }

  const { elapsedSeconds, distanceKm, avgSpeedKmh } = state;
  const route = state.coords ?? [];
  const distStr = distanceKm >= 0.05 ? `${distanceKm.toFixed(2)}` : '<0.05';
  const speedStr = avgSpeedKmh >= 0.5 ? `${avgSpeedKmh.toFixed(1)}` : '—';
  const paceStr = pace(distanceKm, elapsedSeconds);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const now = new Date().getTime();
    const sampled = sampleRoute(route);
    const walkStats = {
      walkDurationMin: Math.round(elapsedSeconds / 60 * 10) / 10,
      walkDistanceKm: parseFloat(distanceKm.toFixed(3)),
      walkAvgSpeedKmh: parseFloat(avgSpeedKmh.toFixed(2)),
      walkRoute: sampled.length > 1 ? sampled : undefined,
      timestamp: now,
    };

    try {
      await saveWalkForDogs(
        walkedDogs.map(d => d.id),
        logFor,
        walkStats,
        now,
        { loggedBy: user!.uid, loggedByName: user!.displayName ?? '', source: 'manual' },
      );
      navigate('/routine', { replace: true });
    } catch (err) {
      console.error('[WalkSummary] could not save the walk', err);
      setSaveError('Could not save the walk. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto"
      style={{ backgroundColor: 'oklch(0.14 0.014 55)' }}
    >
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 pt-12 pb-[88px]">

        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: '#F59E0B18', border: '2px solid #F59E0B40' }}
          >
            <span className="text-3xl">🐾</span>
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: '#F8F0E3', letterSpacing: '-0.02em' }}
          >
            Walk Complete
          </h1>
          <p className="text-sm mt-1.5 capitalize" style={{ color: 'oklch(0.52 0.01 55)' }}>
            {walkedDogs.length > 1
              ? walkedDogs.map(d => d.name).join(', ')
              : activeDog.name} · great job!
          </p>
        </div>

        {/* Route map */}
        {route.length > 1 && (
          <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{ height: 220, border: '1px solid oklch(1 0 0 / 8%)' }}
          >
            <Suspense fallback={<div className="w-full h-full" style={{ backgroundColor: '#e8e4dc' }} />}>
              <WalkMap coords={route} completed />
            </Suspense>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Stat icon={<Clock className="h-5 w-5" />} label="Duration" value={fmtDuration(elapsedSeconds)} />
          <Stat icon={<MapPin className="h-5 w-5" />} label="Distance" value={distStr} sub="km" />
          <Stat icon={<Zap className="h-5 w-5" />} label="Avg Speed" value={speedStr} sub="km/h" />
          <Stat icon={<TrendingUp className="h-5 w-5" />} label="Pace" value={paceStr} sub="min/km" />
        </div>

        {/* Per-dog outcome: one card each, so a group walk records what each dog
            actually did rather than applying one answer to all of them. */}
        <motion.div
          variants={listContainer(reduced)}
          initial="hidden"
          animate="show"
          className="mb-8 space-y-3"
        >
          <p
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'oklch(0.52 0.01 55)' }}
          >
            {walkedDogs.length > 1 ? `Log for each dog (${walkedDogs.length})` : `Also log for ${activeDog.name}`}
          </p>
          {walkedDogs.map(dog => (
            <motion.div key={dog.id} variants={listItem(reduced)}>
              <DogWalkLogCard
                dogName={dog.name}
                value={logFor(dog.id)}
                onChange={next => setLogFor(dog.id, next)}
                showName={walkedDogs.length > 1}
                reduced={reduced}
              />
            </motion.div>
          ))}
        </motion.div>

        {saveError && (
          <p className="mb-3 text-sm" style={{ color: '#F87171' }}>{saveError}</p>
        )}

        {/* Save / Discard */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 rounded-2xl text-sm font-bold tracking-wide transition-opacity disabled:opacity-60 active:scale-[0.98]"
            style={{ backgroundColor: '#F59E0B', color: 'oklch(0.14 0.014 55)' }}
          >
            {saving ? 'Saving…' : 'Save Walk'}
          </button>

          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full h-10 text-sm transition-opacity"
            style={{ color: 'oklch(0.42 0.01 55)' }}
            disabled={saving}
          >
            Discard walk
          </button>
        </div>
      </div>
    </div>
  );
}
