// ─── Shared motion presets ────────────────────────────────────────────────────
// One place for the entrance/emphasis animations used across the bigger screens
// (Module Store grid, walk summary, team list, medical rail) so timings stay
// consistent and every animation has a reduced-motion story.
//
// Reduced motion is handled by callers via `useReducedMotion()` from
// motion/react: pass the flag to the factories below and they collapse the
// movement to a plain opacity fade with no offset.

import type { Variants } from 'motion/react';

// Container that reveals its children one after another. `staggerChildren` is
// small on purpose — a long list should still feel instant, not choreographed.
export function listContainer(reduced: boolean | null): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.04,
        delayChildren: reduced ? 0 : 0.02,
      },
    },
  };
}

// A single card/row rising into place. Pair with `listContainer` on the parent.
export function listItem(reduced: boolean | null): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] },
    },
  };
}

// Spring used by toggles and check marks — snappy, no overshoot wobble.
export function toggleSpring(reduced: boolean | null) {
  return reduced
    ? { duration: 0.12 }
    : { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.7 };
}
