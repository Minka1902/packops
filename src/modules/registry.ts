// ─── Module registry ──────────────────────────────────────────────────────────
// Aggregates every module manifest (full + stub) and exposes the queries the
// router, nav, dashboard and Module Store need. Adding a module means adding its
// manifest import here (plus its id in ids.ts) — nothing else. Manifests are
// lightweight (lazy thunks only), so importing them all does not defeat
// code-splitting.

import { ALL_MODULE_IDS, type ModuleId } from './ids';
import { isModuleUnlocked } from './permissions';
import type { ModuleManifest, NavItemDef, RouteDef } from './types';
import {
  missingDependencies as graphMissing,
  dependentModules as graphDependents,
  unlockClosure as graphClosure,
  type DependencyGraph,
} from './unlock';
import { staffManifest } from './staff/manifest';
import { rolesManifest } from './roles/manifest';
import { STUB_MANIFESTS } from './stubs';
import { BUSINESS_MODULE_PAGES } from './businessPages';

// Full manifests (implemented modules). Stubs cover the rest.
const FULL_MANIFESTS: ModuleManifest[] = [staffManifest, rolesManifest];

export const MODULE_REGISTRY: Record<ModuleId, ModuleManifest> = (() => {
  const map = {} as Record<ModuleId, ModuleManifest>;
  for (const m of [...FULL_MANIFESTS, ...STUB_MANIFESTS]) map[m.id] = m;
  // Business CRM pages are declared once in businessPages.ts and folded onto
  // their module here, so nav and routing derive from the module id rather than
  // from a parallel list keyed by the legacy BusinessModule union.
  for (const [id, pages] of Object.entries(BUSINESS_MODULE_PAGES)) {
    const manifest = map[id as ModuleId];
    if (!manifest) continue;
    map[id as ModuleId] = {
      ...manifest,
      navItems: [...(manifest.navItems ?? []), ...(pages.navItems ?? [])],
      routes: [...(manifest.routes ?? []), ...(pages.routes ?? [])],
    };
  }
  return map;
})();

// All manifests in canonical catalog order.
export const ALL_MANIFESTS: ModuleManifest[] = ALL_MODULE_IDS.map((id) => MODULE_REGISTRY[id]);

export const DEPENDENCY_GRAPH: DependencyGraph = Object.fromEntries(
  ALL_MANIFESTS.map((m) => [m.id, m.dependencies]),
) as DependencyGraph;

export function getManifest(id: ModuleId): ModuleManifest {
  return MODULE_REGISTRY[id];
}

// ─── Dependency queries (registry-bound wrappers over unlock.ts) ──────────────

export function missingDependencies(id: ModuleId, unlocked: Iterable<ModuleId>): ModuleId[] {
  return graphMissing(DEPENDENCY_GRAPH, id, new Set(unlocked));
}

export function unlockClosure(id: ModuleId, unlocked: Iterable<ModuleId>): ModuleId[] {
  return graphClosure(DEPENDENCY_GRAPH, id, new Set(unlocked));
}

export function dependentModules(id: ModuleId, unlocked: Iterable<ModuleId>): ModuleId[] {
  return graphDependents(DEPENDENCY_GRAPH, ALL_MODULE_IDS, id, new Set(unlocked));
}

// ─── Route & nav aggregation ──────────────────────────────────────────────────

// Relative RouteDefs (e.g. 'staff', 'staff/:userId') for every unlocked module,
// to be mounted under the /business tree by the router.
export function moduleRoutes(unlocked: Iterable<ModuleId>): RouteDef[] {
  const set = [...unlocked];
  return ALL_MANIFESTS
    .filter((m) => isModuleUnlocked(m.id, set))
    .flatMap((m) => m.routes ?? []);
}

export interface ResolvedNavItem extends NavItemDef {
  moduleId: ModuleId;
}

// Nav items for every unlocked module, tagged with their module so callers can
// filter by the viewer's effective permissions.
export function moduleNavItems(unlocked: Iterable<ModuleId>): ResolvedNavItem[] {
  const set = [...unlocked];
  return ALL_MANIFESTS
    .filter((m) => isModuleUnlocked(m.id, set))
    .flatMap((m) => (m.navItems ?? []).map((n) => ({ ...n, moduleId: m.id })));
}
