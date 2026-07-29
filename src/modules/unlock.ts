// ─── Module dependency math (pure) ───────────────────────────────────────────
// Drives the Module Store: what must be unlocked before a module can be, and
// what would break if a module were locked. Operates on a plain dependency
// graph so it is trivially unit-testable; registry.ts supplies the real graph.

import { isCoreModule, type ModuleId } from './ids';

export type DependencyGraph = Partial<Record<ModuleId, readonly ModuleId[]>>;

function directDeps(graph: DependencyGraph, id: ModuleId): readonly ModuleId[] {
  return graph[id] ?? [];
}

// All modules `id` depends on, directly or transitively. Cycle-safe.
export function transitiveDependencies(graph: DependencyGraph, id: ModuleId): ModuleId[] {
  const seen = new Set<ModuleId>();
  const visit = (m: ModuleId) => {
    for (const dep of directDeps(graph, m)) {
      if (!seen.has(dep)) {
        seen.add(dep);
        visit(dep);
      }
    }
  };
  visit(id);
  return [...seen];
}

// Dependencies of `id` that are not yet unlocked (core modules count as always
// unlocked). These block unlocking `id` on their own.
export function missingDependencies(
  graph: DependencyGraph,
  id: ModuleId,
  unlocked: ReadonlySet<ModuleId>,
): ModuleId[] {
  return transitiveDependencies(graph, id).filter(
    (d) => !isCoreModule(d) && !unlocked.has(d),
  );
}

// The set to unlock together when unlocking `id`: its missing transitive deps
// followed by `id` itself (dependency order — deps first).
export function unlockClosure(
  graph: DependencyGraph,
  id: ModuleId,
  unlocked: ReadonlySet<ModuleId>,
): ModuleId[] {
  return [...missingDependencies(graph, id, unlocked), id];
}

// Currently-unlocked modules that (transitively) depend on `id`. Locking `id`
// is blocked while this is non-empty.
export function dependentModules(
  graph: DependencyGraph,
  allIds: readonly ModuleId[],
  id: ModuleId,
  unlocked: ReadonlySet<ModuleId>,
): ModuleId[] {
  return allIds.filter(
    (m) => m !== id && unlocked.has(m) && transitiveDependencies(graph, m).includes(id),
  );
}
