// ─── Module manifest types ────────────────────────────────────────────────────
// A manifest is the lightweight, aggregatable description of a module: identity,
// price, dependencies, permission semantics, and LAZY thunks for its routes /
// nav / dashboard widget. It must never import page component code directly, so
// that importing every manifest (the registry does) does not defeat
// code-splitting. Routes use react-router v7 `lazy`; summaryView uses React.lazy.

import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId, PermissionLevel } from './ids';

export type ModuleCategory = 'core' | 'operations' | 'customer' | 'specialty';

export const MODULE_CATEGORIES: { id: ModuleCategory; label: string }[] = [
  { id: 'core',       label: 'Core' },
  { id: 'operations', label: 'Operations' },
  { id: 'customer',   label: 'Customer' },
  { id: 'specialty',  label: 'Specialty' },
];

// A tenant collection this module owns, and the level required to touch it.
// `access` drives Firestore-rules generation:
//   read → can(read), create/update → can(write), delete → can(action).
// `custom` opts the collection out of generation in favour of a hand-written
// snippet in scripts/rules-snippets/<name>.rules (see gen-rules.ts).
export interface DataModelDef {
  collection: string;
  module: ModuleId;
  custom?: boolean;
  // Legacy capabilities OR'd into the generated rule during migration. Dropped
  // in the P7 cleanup once the tenant sweep is complete.
  legacyCaps?: string[];
}

// react-router v7 route object using a lazy thunk. Kept structural (not the
// library type) so this module stays dependency-light for tests.
export interface RouteDef {
  path: string;
  lazy: () => Promise<{ Component: ComponentType<unknown> }>;
  // When true the route is the module's index screen (mounted at its base path).
  index?: boolean;
}

export interface NavItemDef {
  to: string;
  label: string;
  icon: LucideIcon;
  // Minimum level the viewer must hold in this module to see the item.
  level?: PermissionLevel;
}

// Lazy compact dashboard widget. Fetches its own data via useTenant() with
// bounded queries. Rendered inside Suspense with a skeleton fallback.
export interface SummaryViewDef {
  component: LazyExoticComponent<ComponentType<unknown>>;
}

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  category: ModuleCategory;
  icon: LucideIcon;
  priceCents: number;
  isDefaultUnlocked: boolean;
  lockable: boolean;
  dependencies: ModuleId[];
  // The levels this module actually defines (most define all three).
  permissions: PermissionLevel[];
  // Human-readable meaning of each level in THIS module (from the catalog's
  // R/W/A rows). Surfaced in the PermissionMatrix as tooltips.
  abilities?: Partial<Record<PermissionLevel, string>>;
  navItems?: NavItemDef[];
  routes?: RouteDef[];
  dataModels?: DataModelDef[];
  summaryView?: SummaryViewDef;
  clientFacing?: boolean;
  requiresSetup?: (business: { unlockedModules?: ModuleId[] }) => boolean;
}

// A stub manifest carries only the Module-Store-visible fields. Helper to build
// one without repeating the defaults (no routes/nav/summaryView/dataModels).
export type StubManifestInput = Pick<
  ModuleManifest,
  'id' | 'name' | 'description' | 'category' | 'priceCents' | 'dependencies'
> &
  Partial<Pick<ModuleManifest, 'icon' | 'lockable' | 'isDefaultUnlocked' | 'clientFacing' | 'permissions'>> & {
    icon: LucideIcon;
  };
