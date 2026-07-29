import { describe, test, expect } from 'vitest';
import {
  computeInvoiceTotals, ALL_CAPABILITIES, CAPABILITY_CATALOG, CAPABILITY_LABELS,
  DEFAULT_ROLE_TEMPLATES, BUSINESS_TYPES, ALL_MODULES, MODULE_CATALOG, isModuleEnabled,
  moduleOpenFlag, isModuleClientReady, clientFacingModuleStatuses,
} from '@/shared/types';
import { distanceKm, formatDistance } from '@/shared/lib/geo';

describe('computeInvoiceTotals', () => {
  test('sums line items with no tax', () => {
    const { subtotal, total } = computeInvoiceTotals(
      [{ description: 'a', quantity: 2, unitPrice: 50 }, { description: 'b', quantity: 1, unitPrice: 25 }],
    );
    expect(subtotal).toBe(125);
    expect(total).toBe(125);
  });

  test('applies tax rate and rounds to cents', () => {
    const { subtotal, total } = computeInvoiceTotals(
      [{ description: 'groom', quantity: 1, unitPrice: 100 }], 17,
    );
    expect(subtotal).toBe(100);
    expect(total).toBe(117);
  });

  test('handles empty line items', () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, total: 0 });
  });
});

describe('capability catalog', () => {
  test('catalog and ALL_CAPABILITIES stay in sync', () => {
    expect(ALL_CAPABILITIES).toEqual(CAPABILITY_CATALOG.map(c => c.capability));
  });

  test('every capability has a label', () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(CAPABILITY_LABELS[cap]).toBeTruthy();
    }
  });

  test('default role templates only reference real capabilities', () => {
    for (const tpl of DEFAULT_ROLE_TEMPLATES) {
      for (const cap of tpl.capabilities) {
        expect(ALL_CAPABILITIES).toContain(cap);
      }
    }
  });

  test('business types are non-empty', () => {
    expect(BUSINESS_TYPES.length).toBeGreaterThan(5);
  });
});

describe('module gating', () => {
  test('undefined modules means everything is enabled (back-compat)', () => {
    for (const m of ALL_MODULES) {
      expect(isModuleEnabled({ modules: undefined }, m)).toBe(true);
      expect(isModuleEnabled(null, m)).toBe(true);
    }
  });

  test('only listed modules are enabled when the set is explicit', () => {
    const biz = { modules: ['customers', 'appointments'] as typeof ALL_MODULES };
    expect(isModuleEnabled(biz, 'customers')).toBe(true);
    expect(isModuleEnabled(biz, 'appointments')).toBe(true);
    expect(isModuleEnabled(biz, 'inventory')).toBe(false);
    expect(isModuleEnabled(biz, 'shipments')).toBe(false);
  });

  test('catalog and ALL_MODULES stay in sync', () => {
    expect(ALL_MODULES).toEqual(MODULE_CATALOG.map(m => m.module));
  });
});

describe('module setup-gate framework', () => {
  test('moduleOpenFlag reads each module\'s own open flag', () => {
    expect(moduleOpenFlag({ bookable: true }, 'appointments')).toBe(true);
    expect(moduleOpenFlag({ bookable: false }, 'appointments')).toBe(false);
    expect(moduleOpenFlag({ commerce: { ordersOpen: true } }, 'orders')).toBe(true);
    expect(moduleOpenFlag({ boarding: { requestsOpen: true } }, 'boarding')).toBe(true);
    expect(moduleOpenFlag({ grooming: { bookingOpen: true } }, 'grooming')).toBe(true);
    expect(moduleOpenFlag({ waivers: { published: true } }, 'waivers')).toBe(true);
  });

  test('moduleOpenFlag defaults to false when the flag is unset', () => {
    expect(moduleOpenFlag({}, 'grooming')).toBe(false);
    expect(moduleOpenFlag({}, 'waivers')).toBe(false);
    expect(moduleOpenFlag(null, 'grooming')).toBe(false);
  });

  test('modules without a dedicated open flag default to open', () => {
    expect(moduleOpenFlag({}, 'classes')).toBe(true);
    expect(moduleOpenFlag({}, 'adoptions')).toBe(true);
  });

  test('isModuleClientReady requires enabled AND open', () => {
    const biz = { modules: ['grooming'] as typeof ALL_MODULES, grooming: { bookingOpen: true } };
    expect(isModuleClientReady(biz, 'grooming')).toBe(true);
    // enabled but not turned on
    expect(isModuleClientReady({ modules: ['grooming'] as typeof ALL_MODULES }, 'grooming')).toBe(false);
    // turned on but not enabled
    expect(isModuleClientReady({ modules: ['customers'] as typeof ALL_MODULES, grooming: { bookingOpen: true } }, 'grooming')).toBe(false);
  });

  test('clientFacingModuleStatuses flags enabled-but-unconfigured modules as needsSetup', () => {
    const biz = { modules: ['grooming', 'waivers', 'classes'] as typeof ALL_MODULES, waivers: { published: true } };
    const statuses = clientFacingModuleStatuses(biz);
    const grooming = statuses.find(s => s.module === 'grooming')!;
    const waivers = statuses.find(s => s.module === 'waivers')!;
    const classes = statuses.find(s => s.module === 'classes')!;

    expect(grooming).toMatchObject({ enabled: true, live: false, needsSetup: true });
    expect(waivers).toMatchObject({ enabled: true, live: true, needsSetup: false });
    // classes is client-facing but doesn't require setup, so never "needsSetup"
    expect(classes).toMatchObject({ enabled: true, live: true, needsSetup: false });
  });

  test('only client-facing modules appear in statuses', () => {
    const statuses = clientFacingModuleStatuses({ modules: undefined });
    expect(statuses.every(s => MODULE_CATALOG.find(m => m.module === s.module)?.clientFacing)).toBe(true);
  });
});

describe('geo distance', () => {
  test('distance between identical points is zero', () => {
    const p = { lat: 32.08, lng: 34.78 };
    expect(distanceKm(p, p)).toBeCloseTo(0, 5);
  });

  test('Tel Aviv → Jerusalem is roughly 55 km', () => {
    const telAviv = { lat: 32.0853, lng: 34.7818 };
    const jerusalem = { lat: 31.7683, lng: 35.2137 };
    const d = distanceKm(telAviv, jerusalem);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(65);
  });

  test('formatDistance switches to metres under 1 km', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(3.21)).toBe('3.2 km');
    expect(formatDistance(42)).toBe('42 km');
  });
});
