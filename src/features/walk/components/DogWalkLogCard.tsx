// ─── DogWalkLogCard ───────────────────────────────────────────────────────────
// One dog's outcome from a shared walk: whether it peed, whether it pooped, and
// a free-text note. A group walk produces one card per dog, because dogs on the
// same walk don't do the same things.
//
// Styled against the walk summary's own dark surface (fixed oklch values rather
// than theme tokens) so it reads as part of that screen.

import { motion } from 'motion/react';
import { toggleSpring } from '@/shared/lib/motion';

export interface DogWalkLog {
  peed: boolean;
  pooped: boolean;
  note: string;
}

interface Props {
  dogName: string;
  value: DogWalkLog;
  onChange: (next: DogWalkLog) => void;
  /** Group walks label each card; a solo walk doesn't need the dog's name twice. */
  showName?: boolean;
  reduced: boolean | null;
}

const SURFACE = 'oklch(0.18 0.014 55)';
const HAIRLINE = 'oklch(1 0 0 / 8%)';
const MUTED = 'oklch(0.52 0.01 55)';
const CREAM = '#F8F0E3';

function ToggleRow({
  label, active, accent, onToggle, reduced,
}: {
  label: string; active: boolean; accent: string; onToggle: () => void; reduced: boolean | null;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="flex w-full min-h-[48px] items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
      style={{
        backgroundColor: active ? `${accent}18` : 'transparent',
        border: `1.5px solid ${active ? `${accent}60` : HAIRLINE}`,
      }}
    >
      <span className="text-sm font-medium" style={{ color: CREAM }}>{label}</span>
      <motion.span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        animate={{
          backgroundColor: active ? accent : 'rgba(255,255,255,0.08)',
          scale: active && !reduced ? [1, 1.25, 1] : 1,
        }}
        transition={toggleSpring(reduced)}
        style={{ border: `1.5px solid ${active ? accent : 'oklch(1 0 0 / 20%)'}` }}
      >
        {active && <span className="text-[10px] font-bold text-black">✓</span>}
      </motion.span>
    </button>
  );
}

export default function DogWalkLogCard({ dogName, value, onChange, showName = true, reduced }: Props) {
  const noteId = `walk-note-${dogName.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className="space-y-3 rounded-2xl p-4"
      style={{ backgroundColor: SURFACE, border: `1px solid oklch(1 0 0 / 6%)` }}
    >
      {showName && (
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: '#F59E0B18', color: '#F59E0B' }}
          >
            {dogName.slice(0, 1).toUpperCase()}
          </div>
          <p className="truncate text-sm font-semibold capitalize" style={{ color: CREAM }}>{dogName}</p>
        </div>
      )}

      <ToggleRow
        label="🌿 Went pee"
        active={value.peed}
        accent="#84CC16"
        reduced={reduced}
        onToggle={() => onChange({ ...value, peed: !value.peed })}
      />
      <ToggleRow
        label="💩 Went poop"
        active={value.pooped}
        accent="#A78BFA"
        reduced={reduced}
        onToggle={() => onChange({ ...value, pooped: !value.pooped })}
      />

      <div className="space-y-1.5">
        <label
          htmlFor={noteId}
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: MUTED }}
        >
          Note {showName ? `about ${dogName}` : 'about the walk'}
        </label>
        <textarea
          id={noteId}
          rows={2}
          value={value.note}
          onChange={e => onChange({ ...value, note: e.target.value })}
          placeholder="Pulled a lot, met a friend, limping…"
          className="w-full resize-y rounded-xl px-3 py-2 text-sm outline-none transition-colors placeholder:opacity-50 focus:border-amber-500/60"
          style={{
            backgroundColor: 'oklch(0.14 0.014 55)',
            border: `1.5px solid ${HAIRLINE}`,
            color: CREAM,
          }}
        />
      </div>
    </div>
  );
}
