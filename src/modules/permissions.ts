// ─── Effective-permission resolution (pure) ──────────────────────────────────
// Mirrors firestore.rules exactly so the client UI shows precisely what the
// server will allow:
//   can(module, level) = hasModule(module) && hasPerm(module, level)
//   hasPerm            = owner || (active member && perms token present)
//   hasModule          = core module || module in unlockedModules
// Levels are materialised (write ⇒ read, action ⇒ write+read) so a single token
// lookup answers any level query. No Firestore, no React — unit-tested in
// permissions.test.ts.

import {
  ALL_LEVELS, ALL_MODULE_IDS, expandLevels, isCoreModule, permToken,
  type ModuleId, type PermissionLevel,
} from './ids';

// Role defaults and per-worker overrides share this shape. For overrides, a
// PRESENT key replaces the role default for that module; `[]` means "revoke".
export type Grants = Partial<Record<ModuleId, PermissionLevel[]>>;

export interface PermResolutionInput {
  isOwner: boolean;
  active: boolean;
  grants: Grants;
  overrides?: Grants;
  unlockedModules: ModuleId[];
}

export function isModuleUnlocked(moduleId: ModuleId, unlockedModules: readonly ModuleId[]): boolean {
  return isCoreModule(moduleId) || unlockedModules.includes(moduleId);
}

// Raw resolved levels for a module BEFORE unlock gating / owner short-circuit.
// override (if the key is present) wins over role default; both are expanded.
export function resolveLevels(
  grants: Grants,
  overrides: Grants | undefined,
  moduleId: ModuleId,
): PermissionLevel[] {
  const hasOverride = !!overrides && Object.prototype.hasOwnProperty.call(overrides, moduleId);
  const raw = hasOverride ? overrides![moduleId] ?? [] : grants[moduleId] ?? [];
  return expandLevels(raw);
}

// Final levels a member effectively holds in a module (unlock + owner + active
// applied). Owner short-circuits to all levels; a locked non-core module grants
// none; an inactive member grants none.
export function effectiveLevels(input: PermResolutionInput, moduleId: ModuleId): PermissionLevel[] {
  if (!isModuleUnlocked(moduleId, input.unlockedModules)) return [];
  if (input.isOwner) return [...ALL_LEVELS];
  if (!input.active) return [];
  return resolveLevels(input.grants, input.overrides, moduleId);
}

export function hasLevel(input: PermResolutionInput, moduleId: ModuleId, level: PermissionLevel): boolean {
  return effectiveLevels(input, moduleId).includes(level);
}

// ─── Denormalized snapshot (staff.perms) ──────────────────────────────────────
// The tokens written onto the staff doc. Deliberately NOT unlock-gated and NOT
// owner-aware: locking is enforced by rules `hasModule()`, and the owner never
// relies on the snapshot. So the snapshot only changes on role/override/role-
// assignment edits — never on lock/unlock.

export function computePermTokens(grants: Grants, overrides?: Grants): string[] {
  const tokens: string[] = [];
  for (const id of ALL_MODULE_IDS) {
    for (const level of resolveLevels(grants, overrides, id)) {
      tokens.push(permToken(id, level));
    }
  }
  return tokens;
}

// ─── Runtime gate used by hooks / <Can> / <ModuleGate> ────────────────────────

export interface EffectivePerms {
  isOwner: boolean;
  has(moduleId: ModuleId, level: PermissionLevel): boolean;
  levels(moduleId: ModuleId): PermissionLevel[];
}

export function makeEffectivePerms(args: {
  isOwner: boolean;
  active: boolean;
  tokens: Iterable<string>;
  unlockedModules: readonly ModuleId[];
}): EffectivePerms {
  const tokenSet = new Set(args.tokens);
  const has = (moduleId: ModuleId, level: PermissionLevel): boolean => {
    if (!isModuleUnlocked(moduleId, args.unlockedModules)) return false;
    if (args.isOwner) return true;
    if (!args.active) return false;
    return tokenSet.has(permToken(moduleId, level));
  };
  return {
    isOwner: args.isOwner,
    has,
    levels: (moduleId) => ALL_LEVELS.filter((l) => has(moduleId, l)),
  };
}

// Build a grants entry from a single chosen level (UI helper): picking 'write'
// stores ['read','write']. Empty when no level chosen.
export function levelsFor(level: PermissionLevel | null): PermissionLevel[] {
  return level ? expandLevels([level]) : [];
}

// The strongest level in a set, or null if empty. Used to render the matrix's
// current selection from stored (expanded) levels.
export function strongestLevel(levels: readonly PermissionLevel[]): PermissionLevel | null {
  return expandLevels(levels).slice(-1)[0] ?? null;
}
