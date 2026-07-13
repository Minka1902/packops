# Module `foundation` — Phase 1 architecture

> Not a business module — this is the shared plumbing every module rides on.
> Written before implementation per the plan's process rule. Companion docs:
> [`roles.md`](./roles.md), [`staff.md`](./staff.md). Source of truth for the
> full catalog: [`module&seed_plan.md`](./module&seed_plan.md) Part B.

## Scope

Build the tenant-scoped data layer, module registry, module-scoped
read/write/action permission system, Firestore-rules generator, lazy migration
from the legacy capability/module model, Owner Dashboard shell, and Module
Store. After this phase the app still runs on legacy data (dual-write mirrors +
legacy rules OR-clauses) while `staff` and `roles` become the first two modules
built on the new architecture.

## Data model (new / changed docs)

### `businesses/{bid}` (business doc — additive fields)
- `unlockedModules?: ModuleId[]` — the authoritative unlock set. `undefined` ⇒
  tenant not yet migrated (see migration). Core modules (`staff`, `roles`) are
  always effectively unlocked even if absent.
- `modules?: BusinessModule[]` — **legacy mirror**, kept dual-written until P7.

### `businesses/{bid}/roles/{roleId}` → `TenantRole`
```
{ name, isSystem?, grants: Partial<Record<ModuleId, PermissionLevel[]>>,
  capabilities?: Capability[] /* legacy mirror */, createdAt, updatedAt }
```
Levels stored **expanded**: writing `write` stores `['read','write']`;
`action` stores `['read','write','action']`. Rules never infer hierarchy.

### `businesses/{bid}/staff/{userId}` → `StaffMember` (extends `BusinessStaff`)
- `roleId: string`
- `overrides?: Partial<Record<ModuleId, PermissionLevel[]>>` — present key
  REPLACES the role default for that module; `[]` = explicit revoke.
- `perms: string[]` — denormalized effective snapshot as tokens
  `'<moduleId>.<level>'` (e.g. `'staff.read'`). This is what rules check in a
  single doc read — same 2-read budget as today's `hasCap`.
- `permsSyncedAt: number`
- `capabilities: Capability[]` — **legacy mirror**, dual-written until P7.
- `certifications?: StaffCertification[]` — used by the staff module.

### `businesses/{bid}/moduleEvents/{eventId}` → `ModuleEvent` (new, audit)
```
{ type: 'unlock' | 'lock', moduleId, byUserId, byName, at }
```
Owner-create only, member-read, immutable (no update/delete).

## Effective-permission resolution (pure, unit-tested)
```
effectiveLevels(moduleId) =
  overrides[moduleId] ?? role.grants[moduleId] ?? []
owner short-circuits to ALL levels for every module.
A locked module grants NO levels regardless of snapshot (enforced by rules
`hasModule() &&`; the client mirrors this so UI matches rules).
```
`perms` tokens are `effectiveLevels` flattened across unlocked modules. Because
locking is enforced by `hasModule()` in rules, we do **not** recompute the
snapshot on lock/unlock — only on role edits, override edits, and reassignment.

## Module registry — `src/modules/`
- `ids.ts` — `ModuleId` union (37 ids), `ALL_MODULE_IDS`, `CORE_MODULE_IDS`
  (`['staff','roles']`), `PermissionLevel`, `LEVEL_ORDER`, `expandLevel()`.
- `types.ts` — `ModuleManifest`, `ModuleCategory`, `NavItemDef`, `RouteDef`,
  `SummaryViewDef`, `DataModelDef`.
- `permissions.ts` — `effectiveLevels`, `permsFromGrantsAndOverrides`,
  `hasLevel`, `expandLevels`, owner/locked handling. Pure, no Firestore.
- `legacy.ts` — capability↔module/level mapping + migration helpers (see below
  and [`roles.md`](./roles.md)).
- `unlock.ts` — `missingDependencies` (transitive), `dependentModules`,
  `transitiveClosure`, `canLock`, `canUnlock`.
- `registry.ts` — imports each module's manifest, exposes `MODULE_REGISTRY`
  (`Record<ModuleId, ModuleManifest>`), `ALL_MANIFESTS`, `moduleRoutes()`,
  `moduleNavItems()`.

### `ModuleManifest` (lightweight — types + icons + lazy thunks only)
```
{ id, name, description, category, icon (LucideIcon),
  priceCents, isDefaultUnlocked, lockable, dependencies: ModuleId[],
  permissions: PermissionLevel[],           // levels this module defines
  abilities?: Record<PermissionLevel,string>,// human labels (from Part B R/W/A)
  navItems?: NavItemDef[], routes?: RouteDef[],
  dataModels?: DataModelDef[],              // collection → level mapping (rules gen)
  summaryView?: SummaryViewDef,             // lazy compact dashboard widget
  clientFacing?: boolean, requiresSetup?: (b)=>boolean }
```
Manifests **never** import page components directly — routes use react-router
v7 `route.lazy` thunks and summaryViews are `lazy(() => import(...))`, so
aggregating all manifests does not defeat code-splitting. ESLint + a registry
test guard this.

Phase 1 registers **full** manifests for `staff` + `roles` and **stub**
manifests (id/name/description/category/priceCents/deps/icon/lockable only) for
the other 35 so the Module Store is complete from day one.

## Tenant data layer — `src/lib/tenant/`
- `schema.ts` — `TenantSchema` map (collection name → doc type) via
  `withConverter`; grows one line per migrated module. Phase 1 seeds it with
  `roles`, `staff`, `moduleEvents`.
- `tenantDb.ts` — `tenantDb(tenantId): TenantDb`. The ONLY door to tenant data.
  Builds paths internally as `businesses/{tid}/{col}`; exposes `col(name)`,
  `doc(name,id)`, `batch()`, `runTransaction()`, `directoryDoc(bid)`.
  Module code never assembles Firestore paths → cross-tenant access is not
  expressible client-side (rules remain the real guarantee).
- `useTenantCollection.ts` / `useTenantDoc.ts` — realtime hooks, typed
  successors of `useCollection` in `useBusiness.ts`, with bounded-query support
  (`constraints`, `limit`).

### BusinessContext extension
Add to the context value: `tenant: TenantDb | null`, `perms: EffectivePerms`,
`unlockedModules: ModuleId[]`. New `useTenant()` hook returns
`{ tenant, perms, unlockedModules, business, myStaff, isOwner }`.
`perms` derives from `myStaff.perms` when present, else falls back to
`permsFromCapabilities(myStaff.capabilities)` (pre-migration clients). Owner
short-circuits to all.

## Firestore rules
New helpers inside `match /businesses/{bid}`:
- `hasModule(bid, m)` — `m in CORE || (get(business).data.unlockedModules)
  contains m` (reads the business doc rules already `get()` for owner check).
- `hasPerm(bid, m, level)` — `isBizOwner(bid) || (isBizMember && active &&
  staff.perms.hasAny(['<m>.<level>']))`.
- `can(bid, m, level) = hasModule(bid,m) && hasPerm(bid,m,level)`.
Existing `hasCap` stays during transition.

Generated section: markers `// GEN:MODULE-RULES:START/END` inside
`match /businesses/{bid}`. `scripts/gen-rules.ts` (npm `gen:rules`, run via
`tsx`) emits per-collection blocks from `ALL_MANIFESTS[].dataModels`
(`read→can(read)`, create/update→`can(write)`, delete→`can(action)`, each
`|| hasCap(<legacy>)` while migrating). `custom:` dataModels map to hand-written
snippets in `scripts/rules-snippets/`. A vitest snapshot test asserts the
committed rules match generator output (drift guard).

Phase-1 hand-written bits (outside the generated section):
- owner-only field-scoped update of `unlockedModules`
  (`affectedKeys().hasOnly(['unlockedModules','modules','updatedAt'])`).
- staff self-edit guard extended: a user editing their own staff doc may not
  change `perms`, `roleId`, `overrides`, `capabilities`, or `active`.
- owner staff doc may not be deactivated/deleted.
- `moduleEvents`: owner create, member read, immutable.

## Migration & backward compat — `src/modules/legacy.ts`
- `CAPABILITY_TO_PERM: Record<Capability, { module: ModuleId; level:
  PermissionLevel } | null>` — exhaustive by type (see [`roles.md`](./roles.md)
  for the full table).
- `permsFromCapabilities(caps)` → `string[]` tokens.
- `grantsFromCapabilities(caps)` → `Partial<Record<ModuleId,
  PermissionLevel[]>>` (expanded).
- `capabilitiesFromGrants(grants)` → `Capability[]` (reverse mirror, keeps
  legacy rules OR-clauses working).
- `resolveUnlockedModules(b)` = `b.unlockedModules ?? modulesToIds(b.modules ??
  ALL_LEGACY_MODULES) ∪ CORE_MODULE_IDS`.
- `migrateTenantToV2(tenant, business)` — lazy, owner-triggered from
  BusinessContext when `unlockedModules === undefined`. Idempotent chunked
  batches: business fields (`unlockedModules`), role `grants`, staff `perms`.
  Pre-migration, non-owner clients fall back to
  `permsFromCapabilities(myStaff.capabilities)`; legacy rules OR-clauses keep
  enforcement intact.

## Owner Dashboard & Module Store
- `OwnerDashboardPage` (route `/business`, replaces `BusinessDashboardPage`
  content): `<AlertsStrip/>` + one `<SummaryCard>` per unlocked module the
  viewer can read (Suspense skeleton). Shared primitives `KpiTile`,
  `SummaryCard`, `AlertsStrip` in `src/components/dashboard/`. Grid 1/2/3/4 cols
  at 390/768/1440/1920.
- `ModuleStorePage` (route `/business/store`, owner-only): `ModuleCard` grid of
  all 37 manifests grouped by category — icon, description, `DependencyBadges`
  (green unlocked / amber missing), **real price** (Intl, business currency)
  under a `PresentRibbon` ("currently free"; price stays visible), Unlock/Lock.
  Unlock with unmet deps → dialog listing transitive closure + "unlock N
  together" or a clear block message. Lock blocked while `dependentModules()`
  non-empty; `lockable:false` core modules show a badge. Unlock/lock writes
  `unlockedModules` + `moduleEvents` audit + legacy `modules` mirror.

## Screens
- `/business` — Owner Dashboard (all viewports).
- `/business/store` — Module Store (owner-only; `ModuleGate`-free, `isOwner`).
- `/business/roles`, `/business/staff` — see companion docs.

## Edge cases
- Unmigrated tenant (`unlockedModules === undefined`): owner triggers migration;
  non-owners run on capability fallback; nothing breaks.
- Interrupted resync batch: `permsSyncedAt < role.updatedAt` staleness banner +
  idempotent Resync.
- Locking a module with dependents: blocked with a message naming them.
- Manifest accidentally importing page code: caught by lint + registry test.

## Acceptance criteria
- `src/modules/**` compiles with no raw Firestore/`useBusiness` imports (ESLint).
- Vitest green: registry invariants (unique ids, acyclic deps, every manifest
  has the required fields; full manifests have summaryView), permission
  resolution (override/role/none, owner short-circuit, locked denial, level
  expansion), legacy mapping exhaustiveness, gen-rules drift snapshot.
- `npm run test:rules` matrix green (owner / member-with-token / member-without
  / inactive / locked-module across staff, roles, moduleEvents, one legacy
  OR-clause collection).
- Owner Dashboard renders summaryViews for unlocked modules; Module Store lists
  all 37, blocks dep-unmet unlock and dependent-lock.
- `npm run lint` + `npm run build` clean; existing vitest suites stay green.
