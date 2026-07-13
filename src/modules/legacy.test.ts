import { describe, it, expect } from 'vitest';
import { ALL_CAPABILITIES, ALL_MODULES, type Capability } from '@/types';
import { ALL_MODULE_IDS, isModuleId, isPermissionLevel } from './ids';
import {
  CAPABILITY_TO_PERM, UNMAPPED_CAPABILITIES,
  grantsFromCapabilities, permsFromCapabilities, capabilitiesFromGrants,
  LEGACY_MODULE_TO_ID, ID_TO_LEGACY_MODULES,
  idsFromLegacyModules, legacyModulesFromIds, resolveUnlockedModules,
} from './legacy';

describe('CAPABILITY_TO_PERM', () => {
  it('maps every capability (exhaustive) to a real module + level, or null', () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(Object.prototype.hasOwnProperty.call(CAPABILITY_TO_PERM, cap)).toBe(true);
      const ref = CAPABILITY_TO_PERM[cap];
      if (ref === null) continue;
      expect(isModuleId(ref.module)).toBe(true);
      expect(isPermissionLevel(ref.level)).toBe(true);
    }
  });

  it('lists exactly the null-mapped caps in UNMAPPED_CAPABILITIES', () => {
    const nulls = ALL_CAPABILITIES.filter((c) => CAPABILITY_TO_PERM[c] === null);
    expect(new Set(UNMAPPED_CAPABILITIES)).toEqual(new Set(nulls));
    expect(UNMAPPED_CAPABILITIES).toContain('manage_business');
    expect(UNMAPPED_CAPABILITIES).toContain('manage_own_appointments');
  });
});

describe('grants / perms derivation', () => {
  it('unions and expands levels per module', () => {
    const grants = grantsFromCapabilities(['view_customers', 'manage_customers']);
    // manage_customers → clients/action expands to read+write+action
    expect(grants.clients).toEqual(['read', 'write', 'action']);
  });

  it('record_payments contributes write (not action) to invoicing', () => {
    const grants = grantsFromCapabilities(['record_payments']);
    expect(grants.invoicing).toEqual(['read', 'write']);
  });

  it('permsFromCapabilities produces expanded tokens', () => {
    const tokens = permsFromCapabilities(['manage_inventory']);
    expect(tokens).toContain('inventory.read');
    expect(tokens).toContain('inventory.write');
    expect(tokens).toContain('inventory.action');
  });

  it('capabilitiesFromGrants is the inverse for mapped caps', () => {
    const caps = capabilitiesFromGrants({ clients: ['read', 'write', 'action'] });
    expect(caps).toContain('view_customers');
    expect(caps).toContain('manage_customers');
    // null-mapped caps never come back from grants
    expect(caps).not.toContain('manage_business');
  });

  it('the full owner capability set is preserved for mapped caps round-trip', () => {
    const grants = grantsFromCapabilities(ALL_CAPABILITIES);
    const back = capabilitiesFromGrants(grants);
    const mapped = ALL_CAPABILITIES.filter((c) => CAPABILITY_TO_PERM[c] !== null);
    expect(new Set(back)).toEqual(new Set(mapped as Capability[]));
  });
});

describe('legacy module ↔ id mapping', () => {
  it('every legacy module maps to a real module id', () => {
    for (const m of ALL_MODULES) expect(isModuleId(LEGACY_MODULE_TO_ID[m])).toBe(true);
  });

  it('id → legacy modules only references real legacy modules', () => {
    for (const list of Object.values(ID_TO_LEGACY_MODULES)) {
      for (const m of list ?? []) expect(ALL_MODULES).toContain(m);
    }
  });

  it('collapses many legacy modules onto one id', () => {
    expect(idsFromLegacyModules(['orders', 'services'])).toEqual(['shop']);
    expect(idsFromLegacyModules(['inventory', 'purchasing'])).toEqual(['inventory']);
  });

  it('expands one id back to its legacy modules for the mirror', () => {
    expect(legacyModulesFromIds(['shop'])).toEqual(['orders', 'services']);
    expect(legacyModulesFromIds(['messaging'])).toEqual(['messages', 'report_cards']);
  });
});

describe('resolveUnlockedModules', () => {
  it('prefers an explicit unlockedModules set (plus core)', () => {
    const ids = resolveUnlockedModules({ unlockedModules: ['shop'] });
    expect(ids).toContain('shop');
    expect(ids).toContain('staff');
    expect(ids).toContain('roles');
  });

  it('derives from legacy modules when unmigrated', () => {
    const ids = resolveUnlockedModules({ modules: ['customers', 'orders'] });
    expect(ids).toEqual(expect.arrayContaining(['clients', 'shop', 'staff', 'roles']));
    expect(ids).not.toContain('boarding');
  });

  it('falls back to all legacy modules when modules is undefined', () => {
    const ids = resolveUnlockedModules({});
    // ALL_MODULES collapses to a subset of ids; core always present
    expect(ids).toContain('staff');
    expect(ids).toContain('clients');
    expect(ids.every(isModuleId)).toBe(true);
  });

  it('null business yields just the core modules', () => {
    expect(new Set(resolveUnlockedModules(null))).toEqual(new Set(['staff', 'roles']));
  });

  it('only ever emits ids that exist', () => {
    const ids = resolveUnlockedModules({ modules: ALL_MODULES });
    for (const id of ids) expect(ALL_MODULE_IDS).toContain(id);
  });
});
