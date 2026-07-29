import { describe, it, expect } from 'vitest';
import { ALL_MODULE_IDS, CORE_MODULE_IDS, isModuleId, type ModuleId } from './ids';
import {
  MODULE_REGISTRY, ALL_MANIFESTS, DEPENDENCY_GRAPH,
  missingDependencies, unlockClosure, dependentModules, moduleNavItems,
} from './registry';

describe('registry completeness', () => {
  it('has exactly one manifest per module id', () => {
    expect(ALL_MANIFESTS).toHaveLength(ALL_MODULE_IDS.length);
    for (const id of ALL_MODULE_IDS) {
      expect(MODULE_REGISTRY[id]).toBeDefined();
      expect(MODULE_REGISTRY[id].id).toBe(id);
    }
  });

  it('is ordered canonically', () => {
    expect(ALL_MANIFESTS.map((m) => m.id)).toEqual(ALL_MODULE_IDS);
  });

  it('every manifest carries the Store-visible fields', () => {
    for (const m of ALL_MANIFESTS) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.priceCents).toBeGreaterThanOrEqual(0);
      expect(['core', 'operations', 'customer', 'specialty']).toContain(m.category);
      expect(m.icon).toBeTruthy();
      expect(m.permissions.length).toBeGreaterThan(0);
    }
  });
});

describe('core modules', () => {
  it('are default-unlocked, free and not lockable', () => {
    for (const id of CORE_MODULE_IDS) {
      const m = MODULE_REGISTRY[id];
      expect(m.isDefaultUnlocked).toBe(true);
      expect(m.lockable).toBe(false);
      expect(m.priceCents).toBe(0);
      expect(m.category).toBe('core');
      expect(m.abilities).toBeDefined();
    }
  });

  it('non-core modules cost money and are lockable', () => {
    for (const m of ALL_MANIFESTS) {
      if ((CORE_MODULE_IDS as readonly string[]).includes(m.id)) continue;
      expect(m.priceCents).toBeGreaterThan(0);
      expect(m.lockable).toBe(true);
      expect(m.isDefaultUnlocked).toBe(false);
    }
  });
});

describe('dependency graph', () => {
  it('references only real module ids', () => {
    for (const m of ALL_MANIFESTS) {
      for (const dep of m.dependencies) {
        expect(isModuleId(dep)).toBe(true);
        expect(m.dependencies).not.toContain(m.id); // no self-dependency
      }
    }
  });

  it('is acyclic', () => {
    const WHITE = 0, GREY = 1, BLACK = 2;
    const color = new Map<ModuleId, number>();
    const graph = DEPENDENCY_GRAPH;
    let cyclic = false;
    const visit = (id: ModuleId) => {
      color.set(id, GREY);
      for (const dep of graph[id] ?? []) {
        const c = color.get(dep) ?? WHITE;
        if (c === GREY) cyclic = true;
        else if (c === WHITE) visit(dep);
      }
      color.set(id, BLACK);
    };
    for (const id of ALL_MODULE_IDS) if ((color.get(id) ?? WHITE) === WHITE) visit(id);
    expect(cyclic).toBe(false);
  });
});

describe('unlock queries', () => {
  it('missingDependencies returns transitive unmet deps only', () => {
    // consumer → shop → inventory, plus appointments. Nothing unlocked.
    const missing = missingDependencies('consumer', []);
    expect(missing).toEqual(expect.arrayContaining(['shop', 'inventory', 'appointments']));
    expect(missing).not.toContain('consumer');
  });

  it('core dependencies are never reported missing', () => {
    // No module depends on core, but core is always treated as unlocked.
    expect(missingDependencies('shop', ['inventory'])).toEqual([]);
  });

  it('unlockClosure lists deps first, then the module', () => {
    const closure = unlockClosure('shop', []);
    expect(closure[closure.length - 1]).toBe('shop');
    expect(closure).toContain('inventory');
  });

  it('dependentModules blocks locking a depended-on module', () => {
    // With shop unlocked (which needs inventory), inventory has a dependent.
    expect(dependentModules('inventory', ['inventory', 'shop'])).toContain('shop');
    // Nothing depends on inventory when shop is not unlocked.
    expect(dependentModules('inventory', ['inventory'])).toEqual([]);
  });
});

describe('nav aggregation', () => {
  it('exposes staff & roles nav for a fresh business', () => {
    const items = moduleNavItems(['staff', 'roles']);
    const targets = items.map((i) => i.to);
    expect(targets).toContain('/business/staff');
    expect(targets).toContain('/business/roles');
    for (const i of items) expect(isModuleId(i.moduleId)).toBe(true);
  });
});
