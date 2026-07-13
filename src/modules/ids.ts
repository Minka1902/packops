// ─── Module identity & permission levels ─────────────────────────────────────
// The single source of truth for which modules exist and what a permission level
// means. Kept dependency-free (no Firestore, no React) so it can be imported by
// rules generation, tests, and both app trees.

export type ModuleId =
  // core (default-unlocked, lockable: false, price 0)
  | 'staff' | 'roles'
  // clients & operations
  | 'clients' | 'appointments'
  // consumer front
  | 'consumer' | 'tracking' | 'messaging'
  // money in
  | 'pos' | 'shop' | 'invoicing' | 'payments' | 'wallet'
  | 'subscriptions' | 'memberships' | 'promotions' | 'loyalty'
  // stock & logistics
  | 'inventory' | 'deliveries' | 'transport'
  // people
  | 'workforce'
  // service lines
  | 'grooming' | 'boarding' | 'veterinary' | 'training' | 'walking' | 'breeding'
  // rescue & nonprofit
  | 'rescue' | 'donations' | 'events' | 'lostfound'
  // governance & insight
  | 'documents' | 'reviews' | 'support' | 'facilities' | 'insurance'
  | 'analytics' | 'branches';

// Modules that always exist regardless of the unlock set. Rules treat these as
// permanently unlocked so a business can never lock itself out of staff/roles.
export const CORE_MODULE_IDS = ['staff', 'roles'] as const;

// Every id, in catalog order. Kept in sync with the ModuleId union by an
// exhaustiveness test in permissions.test.ts.
export const ALL_MODULE_IDS: ModuleId[] = [
  'staff', 'roles',
  'clients', 'appointments',
  'consumer', 'tracking', 'messaging',
  'pos', 'shop', 'invoicing', 'payments', 'wallet',
  'subscriptions', 'memberships', 'promotions', 'loyalty',
  'inventory', 'deliveries', 'transport',
  'workforce',
  'grooming', 'boarding', 'veterinary', 'training', 'walking', 'breeding',
  'rescue', 'donations', 'events', 'lostfound',
  'documents', 'reviews', 'support', 'facilities', 'insurance',
  'analytics', 'branches',
];

export function isModuleId(value: string): value is ModuleId {
  return (ALL_MODULE_IDS as string[]).includes(value);
}

export function isCoreModule(id: ModuleId): boolean {
  return (CORE_MODULE_IDS as readonly string[]).includes(id);
}

// ─── Permission levels ────────────────────────────────────────────────────────
// A module grants access at one of three cumulative levels. Higher levels imply
// the lower ones; the expansion is materialised (not inferred by rules) so a
// single `perms` token check is enough.

export type PermissionLevel = 'read' | 'write' | 'action';

// Ascending capability order. Index = strength.
export const LEVEL_ORDER: PermissionLevel[] = ['read', 'write', 'action'];

export const ALL_LEVELS: PermissionLevel[] = LEVEL_ORDER;

export function isPermissionLevel(value: string): value is PermissionLevel {
  return (LEVEL_ORDER as string[]).includes(value);
}

// Expand one level to every level it implies: write ⇒ [read, write],
// action ⇒ [read, write, action]. Order-preserving, deduped.
export function expandLevel(level: PermissionLevel): PermissionLevel[] {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx < 0 ? [] : LEVEL_ORDER.slice(0, idx + 1);
}

// Expand a set of levels to the closure of everything they imply.
export function expandLevels(levels: readonly PermissionLevel[]): PermissionLevel[] {
  const strongest = levels.reduce(
    (max, l) => Math.max(max, LEVEL_ORDER.indexOf(l)),
    -1,
  );
  return strongest < 0 ? [] : LEVEL_ORDER.slice(0, strongest + 1);
}

// The denormalized `perms` token rules check in one read, e.g. 'staff.read'.
export function permToken(moduleId: ModuleId, level: PermissionLevel): string {
  return `${moduleId}.${level}`;
}
