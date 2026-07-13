import { describe, it, expect } from 'vitest';
import {
  ALL_MODULE_IDS, ALL_LEVELS, CORE_MODULE_IDS, expandLevel, expandLevels,
  isModuleId, isCoreModule, permToken, type ModuleId,
} from './ids';
import {
  resolveLevels, effectiveLevels, hasLevel, computePermTokens,
  makeEffectivePerms, isModuleUnlocked, strongestLevel, levelsFor,
  type PermResolutionInput,
} from './permissions';

// A non-core module used across resolution tests.
const UNLOCKED: ModuleId[] = ['clients', 'shop'];

function input(over: Partial<PermResolutionInput> = {}): PermResolutionInput {
  return {
    isOwner: false,
    active: true,
    grants: {},
    overrides: undefined,
    unlockedModules: UNLOCKED,
    ...over,
  };
}

describe('ids', () => {
  it('ALL_MODULE_IDS has 37 unique ids', () => {
    expect(ALL_MODULE_IDS).toHaveLength(37);
    expect(new Set(ALL_MODULE_IDS).size).toBe(37);
  });

  it('every id round-trips through isModuleId', () => {
    for (const id of ALL_MODULE_IDS) expect(isModuleId(id)).toBe(true);
    expect(isModuleId('not-a-module')).toBe(false);
  });

  it('core modules are staff and roles', () => {
    expect([...CORE_MODULE_IDS]).toEqual(['staff', 'roles']);
    expect(isCoreModule('staff')).toBe(true);
    expect(isCoreModule('shop')).toBe(false);
  });

  it('expandLevel materialises the implied lower levels', () => {
    expect(expandLevel('read')).toEqual(['read']);
    expect(expandLevel('write')).toEqual(['read', 'write']);
    expect(expandLevel('action')).toEqual(['read', 'write', 'action']);
  });

  it('expandLevels closes over the strongest level present', () => {
    expect(expandLevels(['action'])).toEqual(['read', 'write', 'action']);
    expect(expandLevels(['read', 'action'])).toEqual(['read', 'write', 'action']);
    expect(expandLevels([])).toEqual([]);
  });

  it('permToken formats as module.level', () => {
    expect(permToken('staff', 'read')).toBe('staff.read');
  });
});

describe('resolveLevels', () => {
  it('expands a role grant', () => {
    expect(resolveLevels({ clients: ['write'] }, undefined, 'clients'))
      .toEqual(['read', 'write']);
  });

  it('override with a present key replaces the role default', () => {
    expect(resolveLevels({ clients: ['action'] }, { clients: ['read'] }, 'clients'))
      .toEqual(['read']);
  });

  it('override of [] revokes the role default', () => {
    expect(resolveLevels({ clients: ['action'] }, { clients: [] }, 'clients'))
      .toEqual([]);
  });

  it('absent override key falls through to the role default', () => {
    expect(resolveLevels({ clients: ['read'] }, { shop: ['write'] }, 'clients'))
      .toEqual(['read']);
  });
});

describe('effectiveLevels', () => {
  it('owner short-circuits to all levels on any unlocked module', () => {
    expect(effectiveLevels(input({ isOwner: true }), 'shop')).toEqual([...ALL_LEVELS]);
  });

  it('owner still gets nothing on a locked module', () => {
    expect(effectiveLevels(input({ isOwner: true }), 'payments')).toEqual([]);
  });

  it('owner always gets core modules even when not in unlockedModules', () => {
    expect(effectiveLevels(input({ isOwner: true, unlockedModules: [] }), 'staff'))
      .toEqual([...ALL_LEVELS]);
  });

  it('a locked module grants nothing to a member', () => {
    expect(effectiveLevels(input({ grants: { payments: ['action'] } }), 'payments'))
      .toEqual([]);
  });

  it('an inactive member gets nothing', () => {
    expect(effectiveLevels(input({ active: false, grants: { shop: ['action'] } }), 'shop'))
      .toEqual([]);
  });

  it('resolves member grants on an unlocked module', () => {
    expect(effectiveLevels(input({ grants: { clients: ['write'] } }), 'clients'))
      .toEqual(['read', 'write']);
    expect(hasLevel(input({ grants: { clients: ['write'] } }), 'clients', 'read')).toBe(true);
    expect(hasLevel(input({ grants: { clients: ['write'] } }), 'clients', 'action')).toBe(false);
  });

  it('core modules resolve for members regardless of unlock set', () => {
    expect(effectiveLevels(input({ grants: { roles: ['read'] }, unlockedModules: [] }), 'roles'))
      .toEqual(['read']);
  });
});

describe('isModuleUnlocked', () => {
  it('core modules are always unlocked', () => {
    expect(isModuleUnlocked('staff', [])).toBe(true);
    expect(isModuleUnlocked('shop', [])).toBe(false);
    expect(isModuleUnlocked('shop', ['shop'])).toBe(true);
  });
});

describe('computePermTokens', () => {
  it('produces expanded module.level tokens, not owner/unlock gated', () => {
    const tokens = computePermTokens({ clients: ['write'], payments: ['read'] });
    expect(tokens).toContain('clients.read');
    expect(tokens).toContain('clients.write');
    expect(tokens).not.toContain('clients.action');
    // snapshot is not unlock-gated: payments appears even though it's not core
    expect(tokens).toContain('payments.read');
  });

  it('honours overrides', () => {
    const tokens = computePermTokens({ clients: ['action'] }, { clients: [] });
    expect(tokens.filter((t) => t.startsWith('clients.'))).toEqual([]);
  });
});

describe('makeEffectivePerms', () => {
  it('mirrors can() = hasModule && (owner || active && token)', () => {
    const perms = makeEffectivePerms({
      isOwner: false, active: true,
      tokens: ['clients.read', 'clients.write', 'payments.action'],
      unlockedModules: ['clients'], // payments locked
    });
    expect(perms.has('clients', 'read')).toBe(true);
    expect(perms.has('clients', 'action')).toBe(false);
    expect(perms.has('payments', 'action')).toBe(false); // locked → denied
    expect(perms.levels('clients')).toEqual(['read', 'write']);
  });

  it('owner passes every unlocked / core module', () => {
    const perms = makeEffectivePerms({
      isOwner: true, active: true, tokens: [], unlockedModules: ['shop'],
    });
    expect(perms.has('shop', 'action')).toBe(true);
    expect(perms.has('staff', 'action')).toBe(true);
    expect(perms.has('payments', 'action')).toBe(false); // still locked
  });

  it('inactive member is denied everything', () => {
    const perms = makeEffectivePerms({
      isOwner: false, active: false, tokens: ['staff.action'], unlockedModules: [],
    });
    expect(perms.has('staff', 'read')).toBe(false);
  });
});

describe('level helpers', () => {
  it('strongestLevel returns the top of an expanded set', () => {
    expect(strongestLevel(['read', 'write'])).toBe('write');
    expect(strongestLevel([])).toBe(null);
  });
  it('levelsFor expands a single chosen level', () => {
    expect(levelsFor('write')).toEqual(['read', 'write']);
    expect(levelsFor(null)).toEqual([]);
  });
});
