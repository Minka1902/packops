// ─── Legacy ↔ v2 bridge (pure) ────────────────────────────────────────────────
// Maps the old capability/module model onto the new module/level model, in both
// directions, so that during migration:
//   • pre-migration clients derive v2 perms from their capability snapshot;
//   • the v2 role editor keeps writing a legacy `capabilities` mirror;
//   • the Module Store keeps writing a legacy `modules` mirror;
//   • legacy firestore.rules OR-clauses keep enforcing until the P7 cleanup.
// No Firestore, no React. The Firestore-touching migrateTenantToV2 lives in
// migrate.ts (Step 5) and reuses these helpers.

import {
  ALL_CAPABILITIES, ALL_MODULES,
  type BusinessModule, type Capability,
} from '@/types';
import {
  CORE_MODULE_IDS, expandLevels,
  type ModuleId, type PermissionLevel,
} from './ids';
import { computePermTokens, type Grants } from './permissions';

type PermRef = { module: ModuleId; level: PermissionLevel };
const M = (module: ModuleId, level: PermissionLevel): PermRef => ({ module, level });

// Exhaustive by construction: Record<Capability, …> makes TS fail if a
// capability is added without a mapping. `null` = no direct v2 equivalent
// (owner-only or enforced only by a retained legacy rule clause).
export const CAPABILITY_TO_PERM: Record<Capability, PermRef | null> = {
  // staff & roles
  manage_staff:            M('staff', 'action'),
  manage_roles:            M('roles', 'action'),
  manage_business:         null, // owner-only going forward; legacy clause retained
  view_business:           null, // dashboard view — any active member
  // customers & pets → clients
  view_customers:          M('clients', 'read'),
  manage_customers:        M('clients', 'action'),
  // appointments
  view_appointments:       M('appointments', 'read'),
  manage_appointments:     M('appointments', 'action'),
  manage_own_appointments: null, // narrower than module write; legacy clause enforces
  // invoices & billing → invoicing
  view_invoices:           M('invoicing', 'read'),
  manage_invoices:         M('invoicing', 'action'),
  record_payments:         M('invoicing', 'write'),
  // inventory & shipping
  view_inventory:          M('inventory', 'read'),
  manage_inventory:        M('inventory', 'action'),
  view_shipments:          M('deliveries', 'read'),
  manage_shipments:        M('deliveries', 'action'),
  // orders → shop
  view_orders:             M('shop', 'read'),
  manage_orders:           M('shop', 'action'),
  // boarding & daycare
  view_boarding:           M('boarding', 'read'),
  manage_boarding:         M('boarding', 'action'),
  // services & price list → shop
  view_services:           M('shop', 'read'),
  manage_services:         M('shop', 'action'),
  // shifts → workforce
  view_shifts:             M('workforce', 'read'),
  manage_shifts:           M('workforce', 'action'),
  // purchasing → inventory
  view_purchasing:         M('inventory', 'read'),
  manage_purchasing:       M('inventory', 'action'),
  // reports → analytics
  view_reports:            M('analytics', 'read'),
  // messaging
  view_messages:           M('messaging', 'read'),
  manage_messages:         M('messaging', 'action'),
  // report cards → messaging (folded in as visit updates)
  view_report_cards:       M('messaging', 'read'),
  manage_report_cards:     M('messaging', 'write'),
  // packages → memberships
  view_packages:           M('memberships', 'read'),
  manage_packages:         M('memberships', 'action'),
  // shelter adoptions → rescue
  view_adoptions:          M('rescue', 'read'),
  manage_adoptions:        M('rescue', 'action'),
  // vet patient charts → veterinary
  view_patients:           M('veterinary', 'read'),
  manage_patients:         M('veterinary', 'action'),
  // trainer group classes → events
  view_classes:            M('events', 'read'),
  manage_classes:          M('events', 'action'),
  // breeder litters & waitlist → breeding
  view_breeding:           M('breeding', 'read'),
  manage_breeding:         M('breeding', 'action'),
};

// Legacy capabilities that have no v2 equivalent — preserved verbatim on the
// role's `capabilities` mirror when it is re-derived from grants, so retained
// legacy rule clauses keep working (e.g. a Worker's manage_own_appointments).
export const UNMAPPED_CAPABILITIES: Capability[] =
  ALL_CAPABILITIES.filter((c) => CAPABILITY_TO_PERM[c] === null);

// caps → v2 grants (levels expanded and unioned per module).
export function grantsFromCapabilities(caps: readonly Capability[]): Grants {
  const grants: Grants = {};
  for (const cap of caps) {
    const ref = CAPABILITY_TO_PERM[cap];
    if (!ref) continue;
    grants[ref.module] = expandLevels([...(grants[ref.module] ?? []), ref.level]);
  }
  return grants;
}

// caps → v2 perms tokens (the staff.perms snapshot pre-migration clients use).
export function permsFromCapabilities(caps: readonly Capability[]): string[] {
  return computePermTokens(grantsFromCapabilities(caps));
}

// v2 grants → legacy capabilities mirror. Callers append any still-relevant
// UNMAPPED_CAPABILITIES the role previously held (this function can't recover
// them from grants alone).
export function capabilitiesFromGrants(grants: Grants): Capability[] {
  const out: Capability[] = [];
  for (const cap of ALL_CAPABILITIES) {
    const ref = CAPABILITY_TO_PERM[cap];
    if (ref && (grants[ref.module] ?? []).includes(ref.level)) out.push(cap);
  }
  return out;
}

// ─── Module unlock mapping ────────────────────────────────────────────────────
// Several v2 ids absorb more than one legacy module (shop ← orders+services,
// inventory ← inventory+purchasing, messaging ← messages+report_cards).

export const LEGACY_MODULE_TO_ID: Record<BusinessModule, ModuleId> = {
  customers:    'clients',
  appointments: 'appointments',
  invoices:     'invoicing',
  inventory:    'inventory',
  shipments:    'deliveries',
  orders:       'shop',
  boarding:     'boarding',
  services:     'shop',
  shifts:       'workforce',
  purchasing:   'inventory',
  reports:      'analytics',
  messages:     'messaging',
  report_cards: 'messaging',
  packages:     'memberships',
  adoptions:    'rescue',
  patients:     'veterinary',
  classes:      'events',
  breeding:     'breeding',
};

export const ID_TO_LEGACY_MODULES: Partial<Record<ModuleId, BusinessModule[]>> = {
  clients:      ['customers'],
  appointments: ['appointments'],
  invoicing:    ['invoices'],
  inventory:    ['inventory', 'purchasing'],
  deliveries:   ['shipments'],
  shop:         ['orders', 'services'],
  boarding:     ['boarding'],
  workforce:    ['shifts'],
  analytics:    ['reports'],
  messaging:    ['messages', 'report_cards'],
  memberships:  ['packages'],
  rescue:       ['adoptions'],
  veterinary:   ['patients'],
  events:       ['classes'],
  breeding:     ['breeding'],
};

function withCore(ids: readonly ModuleId[]): ModuleId[] {
  return [...new Set<ModuleId>([...CORE_MODULE_IDS, ...ids])];
}

export function idsFromLegacyModules(modules: readonly BusinessModule[]): ModuleId[] {
  return [...new Set(modules.map((m) => LEGACY_MODULE_TO_ID[m]))];
}

export function legacyModulesFromIds(ids: readonly ModuleId[]): BusinessModule[] {
  const set = new Set<BusinessModule>();
  for (const id of ids) for (const m of ID_TO_LEGACY_MODULES[id] ?? []) set.add(m);
  return [...set];
}

// The authoritative unlocked set for a business, tolerant of un-migrated docs:
// explicit unlockedModules ?? derived from legacy `modules` (?? all) ∪ core.
export function resolveUnlockedModules(
  b: { unlockedModules?: ModuleId[]; modules?: BusinessModule[] } | null | undefined,
): ModuleId[] {
  if (!b) return withCore([]);
  if (b.unlockedModules) return withCore(b.unlockedModules);
  return withCore(idsFromLegacyModules(b.modules ?? ALL_MODULES));
}
