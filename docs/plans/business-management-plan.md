# PackOps — Dog & Pet Business Management System + "Get Something" Ordering App

## Context

PackOps ("Dog Life") is a React 19 + TypeScript + Vite + Tailwind v4 SPA backed entirely by Firebase (Auth/Firestore/Storage, no app server; `firestore.rules` is the security boundary). It already contains a personal dog-care app AND a bolted-on business CRM: 22-module catalog with setup gates (`src/types/business.ts`), a ~50-capability role system denormalized onto staff docs, ~30 business pages, and a marketplace-style consumer "Discover" surface (`businessDirectory` projections).

The goal is to rebuild this properly per the user's spec: a multi-tenant back office where businesses unlock self-contained **modules** (35-module catalog, real prices shown free with a "present" ribbon), a module-scoped **read/write/action** permission system (role defaults + per-worker overrides), an **Owner Dashboard** aggregating every module's `summaryView`, and a Wolt-style **"Get Something"** consumer marketplace (browse → order → pay → track → chat → rate).

**Confirmed decisions (user answered):**
1. **Refactor in place** — migrate existing business code into the new `src/modules/<id>/` architecture, reusing working logic.
2. **Firestore rules are the authoritative "server"** — `assertModule`/`assertPermission` exist as client guards mirrored by rules helpers; no Cloud Functions.
3. **Marketplace confirmed** — dog owners order from any participating business.
4. **Tooling: plan as if Context7 MCP, 21st.dev MCP, impeccable plugin, and Playwright plugin are available** — use them when present; if absent at execution time, fall back to WebFetch/WebSearch for current docs, the `ui-ux-pro-max` skill for frontend design, and the repo's own Playwright suite.
5. User meta-rule: **if an instruction must be changed/added/ignored, clarify first** (small → ask before proceeding on it; big → ask immediately).

**Process rules (from the spec, apply to every module):** write `plans/<moduleId>.md` (scope, data model, deps, r/w/a meaning, summaryView, screens, edge cases, acceptance criteria) BEFORE implementing it; verify end-to-end with Playwright at all four viewports after; a module is done only when it registers cleanly, respects unlock + all three permission levels, ships its summaryView, is responsive, handles empty/error/edge states, passes Playwright, and the user confirms. Wait for user confirmation between phases.

---

## Architecture (Phase 1 builds this; everything else rides on it)

### Tenant-scoped data layer — `src/lib/tenant/`
- `tenantDb(tenantId): TenantDb` facade — the ONLY door to tenant data. Builds paths internally as `businesses/{tenantId}/{col}`; module code never assembles Firestore paths, so cross-tenant access is not expressible client-side (rules are the real guarantee).
- `schema.ts`: central `TenantSchema` map (collection name → doc type), typed via `withConverter`; grows one line per migrated module.
- `useTenantCollection`/`useTenantDoc` realtime hooks (typed successors of `useCollection` in `useBusiness.ts`).
- `BusinessContext` extended with `tenant: TenantDb`, `perms: EffectivePerms`, `unlockedModules: string[]`; new `useTenant()` hook.
- ESLint `no-restricted-imports`: `src/modules/**` may not import raw `firebase/firestore` path builders, `@/lib/firestore`, or `@/hooks/useBusiness`.

### Module registry — `src/modules/`
- `ids.ts` (ModuleId union), `types.ts` (`ModuleManifest`), `registry.ts` (`MODULE_REGISTRY`, `ALL_MANIFESTS`, `missingDependencies` (transitive), `dependentModules`, `moduleRoutes()`, `moduleNavItems()`), `permissions.ts`, `legacy.ts`, `unlock.ts`.
- Manifest: `{ id, name, description, category, icon, priceCents, isDefaultUnlocked, lockable, dependencies: ModuleId[], permissions: PermissionLevel[], navItems, routes, dataModels, summaryView, clientFacing?, requiresSetup? }`. Manifests are lightweight (types + icons + lazy thunks only — never page code) so aggregation preserves code-splitting; routes use react-router v7 `route.lazy`.
- Adding a module touches only its folder + `ids.ts` + one import in `registry.ts`.
- Guards: `assertModule(business, moduleId)` / `assertPermission(business, member, moduleId, level)` (typed errors, called at top of every mutation in module `data.ts`), `<ModuleGate moduleId>` (layout route rendering `<Outlet/>` or a "locked — open Module Store" screen), `usePermission(moduleId)`, `<Can moduleId level fallback?>`.
- **Every module ships a `summaryView`** — lazy compact widget, fetches its own data via `useTenant()` with `limit()`-bounded queries (+ `getCountFromServer` for counts; never unbounded subscriptions).
- Phase 1 registers full manifests for `staff` + `roles` and **stub manifests** (id/name/category/price/deps/icon only) for the whole 35-module catalog so the Module Store is complete from day one.

### Permissions (replaces the 50-capability system)
- `businesses/{bid}/roles/{roleId}`: `TenantRole { name, isSystem?, grants: Partial<Record<ModuleId, PermissionLevel[]>>, capabilities? (legacy mirror), createdAt, updatedAt }`. Levels stored expanded (write ⇒ read; action ⇒ write+read) so rules never infer hierarchy.
- `businesses/{bid}/staff/{userId}`: `StaffMember` extends existing doc with `roleId`, `overrides?: Partial<Record<ModuleId, PermissionLevel[]>>` (present key REPLACES role default; `[]` = revoke), **`perms: string[]`** — the denormalized effective snapshot as tokens `'<moduleId>.<level>'` rules check in one read (same 2-read budget as today's `hasCap`), `permsSyncedAt`, legacy `capabilities` mirror.
- Effective = `overrides[moduleId] ?? role.grants[moduleId] ?? []`; owner short-circuits to all; locked module grants none (enforced by rules `hasModule() &&` — no snapshot recompute needed on lock/unlock).
- Resync: role save → chunked `writeBatch` (≤450) over `staff where roleId ==`; override/reassign → single doc write; `permsSyncedAt` vs `role.updatedAt` staleness banner + idempotent "Resync"; role editor uses a transaction aborting if `updatedAt` drifted.

### Firestore rules
- New helpers: `hasModule(bid, m)` (checks `unlockedModules` on the business doc rules already `get()`), `hasPerm(bid, m, level)` (owner || active member with token), `can(bid, m, level) = hasModule && hasPerm`. Existing `hasCap` stays during transition.
- **Generated section**: `scripts/gen-rules.ts` (npm script `gen:rules`, run via tsx) emits the block between markers inside `match /businesses/{bid}` from `ALL_MANIFESTS[].dataModels` (`read→can(read)`, create/update→`can(write)`, delete→`can(action)`, each `|| hasCap(legacy)` while migrating). `custom:` keys map to hand-written snippets in `scripts/rules-snippets/` (self-edit anti-escalation, customer self-writes, field-scoped diffs). Vitest snapshot test = drift guard.
- Phase 1 hand-written bits: owner-only field-scoped update of `unlockedModules` (`affectedKeys().hasOnly`), staff self-edit guard extended to `perms`/`roleId`/`overrides`/`capabilities`/`active`, owner-doc deactivate/delete forbidden, `moduleEvents` audit (owner create, member read, immutable).

### Migration & backward compat — `src/modules/legacy.ts`
- `CAPABILITY_TO_PERM: Record<Capability, {module, level}|[]>` (exhaustive by type), `permsFromCapabilities`, `capabilitiesFromGrants` (reverse mirror), `resolveUnlockedModules(b)` = `unlockedModules ?? (modules ?? ALL_MODULES) ∪ core ids`.
- `migrateTenantToV2` — lazy, owner-triggered from BusinessContext when `unlockedModules === undefined`; idempotent chunked batches (business fields, role grants, staff perms). Pre-migration, non-owner clients fall back to `permsFromCapabilities(myStaff.capabilities)` and legacy rules OR-clauses keep enforcement intact.
- Dual-write mirrors (`grants`+`capabilities`, `perms`+`capabilities`, `unlockedModules`+`modules`) until Phase 7 cleanup.

### Owner Dashboard & Module Store
- `OwnerDashboardPage` (route `/business`, replaces `BusinessDashboardPage` content): `<AlertsStrip/>` (stale perms, needs-setup from existing `clientFacingModuleStatuses`, later: low stock/unpaid invoices/etc. contributed by module manifests) + one `<SummaryCard>` per unlocked+readable module (Suspense skeleton, header icon/name/Open link). Shared primitives: `KpiTile`, `SummaryCard`, `AlertsStrip` in `src/components/dashboard/`. Responsive grid 1/2/3/4 cols at 390/768/1440/1920.
- `ModuleStorePage` (route `/business/store`, owner-only): `ModuleCard` grid for all 35 manifests, grouped by category — icon, description, `DependencyBadges` (green unlocked / amber missing), **real price** formatted per business currency under a **`PresentRibbon`** ("currently free" gift ribbon; price stays visible), Unlock/Lock. Unlock with unmet deps → dialog listing them + "unlock N together" (transitive closure) or a clear block message. Lock blocked while `dependentModules()` non-empty; `lockable: false` core modules show a badge. Unlock/lock writes `unlockedModules` + `moduleEvents` audit + legacy `modules` mirror.

---

## Module catalog mapping (prompt's 35 ↔ existing 22)

Existing modules migrate in the phase where their prompt counterpart lands; ids reuse existing strings where they map 1:1.

| Prompt module | Existing basis |
|---|---|
| Staff Management; Roles & Permissions | staff/roles pages + capability system (Phase 1 rebuild) |
| Clients & Pets (CRM) | `customers` (+BusinessPet, `linkedDogId` bridge) |
| Appointments & Scheduling | `appointments` |
| Online Shop & Orders | `orders` + commerce settings |
| Inventory & Stock | `inventory` + `purchasing` |
| Point of Sale | new (deps: inventory) |
| Invoicing & Receipts | `invoices` |
| Consumer App "Get Something"; Live Tracking | new — rebuilds `pages/discover/` on `clientFacing` manifests + `businessDirectory` projections |
| Messaging & Notifications | `messages` (+`report_cards` folded into visit updates) |
| Workforce & Time Tracking | `shifts` + `payroll` + new clock in/out |
| Grooming / Boarding & Daycare / Veterinary / Breeding | `grooming` / `boarding` / `patients` / `breeding` |
| Training; Events & Classes | `classes` split/extended |
| Dog Walking | new (reuse personal-app walk GPS from `src/lib/geo.ts`, walk pages) |
| Deliveries & Logistics | `shipments` reworked |
| Dog Rescue & Adoption | `adoptions` extended (fosters, screening, contracts) |
| Memberships & Plans | `packages` extended |
| Documents & Compliance | `waivers` extended |
| Analytics & Reports | `reports` + `expenses` |
| Payments, Wallet, Subscriptions, Promotions, Loyalty, Pet Transport, Donations, Lost & Found, Reviews & Tips, Support & Disputes, Facilities, Insurance, Multi-Location | new |

---

## Phase 1 — Foundation (implement now, in this order)

Write `plans/foundation.md`, `plans/roles.md`, `plans/staff.md` first (per-module plan rule), then:

1. **Pure core**: `src/modules/{ids,types,permissions,legacy}.ts` + vitest suites (registry invariants, effective-perm resolution incl. owner short-circuit + locked-module denial + write⇒read expansion, exhaustive capability mapping).
2. **Tenant layer**: `src/lib/tenant/{tenantDb,schema,useTenantCollection,useTenantDoc}.ts`; extend `src/contexts/BusinessContext.tsx` (tenant, perms with capability fallback, unlockedModules).
3. **Manifests + registry**: full `staff`/`roles`, stubs for the other 33; `registry.ts`; tests.
4. **Rules**: helpers + generated-section markers + `scripts/gen-rules.ts` + `rules-snippets/`; emit staff/roles/moduleEvents blocks + `unlockedModules` field guard, keep legacy OR-clauses; `@firebase/rules-unit-testing` emulator matrix (`test:rules` script); drift-guard snapshot test.
5. **Migration**: `migrateTenantToV2` wired into BusinessContext (owner-only, idempotent); seed script v2 fixture; `useCreateBusiness` seeds `unlockedModules` + grants-native default roles.
6. **Roles module** (`src/modules/roles/`): list + editor pages, shared `PermissionMatrix` (matrix on desktop, stacked cards on mobile; locked modules greyed; auto-expand levels), `saveRole` transaction + `resyncRolePerms` progress, delete blocked while assigned (bulk-reassign offer), system owner role read-only. Swap route, delete `RolesPage`/`RoleEditor`/`CapabilityMatrix`, extract+delete `useBusinessRoles` from `useBusiness.ts` (rest of the 1705-line monolith stays; it drains module-by-module across phases).
7. **Staff module** (`src/modules/staff/`): list + detail (contact, certifications w/ expiring-soon badges, role select, `StaffOverridesPanel` reusing PermissionMatrix in three-state override mode, deactivate). Edge cases: owner row immutable; deactivate warns on upcoming assigned appointments (limit(1) count) but doesn't block; self-deactivation blocked UI+rules; duplicate invite no-op. Port invite logic (`userLookup.ts`), delete `StaffPage`, extract `useBusinessStaff`.
8. **Router/nav**: `moduleRoutes()` + `ModuleGate` into `src/router/index.tsx` business tree; nav merge in `src/lib/nav.ts` + `BusinessSidebar` (new items filtered by perms, legacy by `can(cap)` during transition).
9. **Owner Dashboard**: KpiTile/SummaryCard/AlertsStrip + staff summary (headcount, expiring certs ≤30d, recent joins) + roles summary (role count, members-per-role, unsynced warning).
10. **Module Store** + unlock/lock flows + `moduleEvents` audit.
11. **ESLint guards**; Playwright `large` project (1920×1080) added to `playwright.config.ts`.
12. **Verify** (see Verification), then stop for user confirmation before Phase 2.

## Phases 2–7 (user's mandated build order — each starts with plans/<id>.md per module, ends with Playwright + user confirmation)

Repeatable migration pattern per module: create `src/modules/<id>/` → move types out of `business.ts` → port hooks from `useBusiness.ts` to `data.ts` on TenantDb → manifest (routes/nav/summaryView/dataModels w/ legacy caps) → `gen:rules` → swap router/nav, delete legacy slice → summaryView appears on dashboard automatically → Playwright smoke.

- **P2 Core commerce**: Clients & Pets, Inventory & Stock, Online Shop & Orders (full lifecycle place→accept→fulfil→complete/cancel/refund; keep existing stock transactions), POS, Invoicing & Receipts.
- **P3 Consumer front**: "Get Something" marketplace page (browse by dog, cart, checkout, reorder — reads Dog Life identity, never re-creates owners), Live Order & Service Tracking (status pipeline + ETA + map via existing Leaflet), Messaging & Notifications.
- **P4 People & scheduling**: Workforce & Time Tracking (clock in/out: open entry = working, block double clock-in, hours computed at close from server timestamps, midnight-crossing, forgotten-clock-out flag/auto-close policy, owner corrections with audit trail; migrate shifts/payroll), Appointments & Scheduling (resource-aware, recurring, waitlist, no-show, reminders).
- **P5 Service lines**: Grooming, Boarding & Daycare, Veterinary, Training, Dog Walking, Breeding & Litters, Pet Transport.
- **P6 Rescue & nonprofit**: Dog Rescue & Adoption, Donations & Fundraising, Events & Classes, Lost & Found (uses existing `Dog.chipId`).
- **P7 Growth & governance**: Payments & Billing, Wallet, Subscriptions, Memberships, Promotions, Loyalty, Deliveries, Documents, Reviews/Ratings/Tips, Support & Disputes, Facilities, Insurance, Analytics, Multi-Location. Then **cleanup**: drop legacy mirrors + rules OR-clauses after tenant sweep, delete drained `useBusiness.ts`, `PermissionGate.tsx`, capability catalog.

---

## Coding standards (hard requirements, every phase)
One component per file; in-file order constants → helpers → component (hooks first inside). Zero duplication — extract on second occurrence, configure via props/variants. Firestore access optimized (fewest reads, bounded queries, batches, indexes) — warn user before any "prettifying" that costs efficiency. No dead code/unused imports. Validate at boundaries; explicit empty/denied/locked/out-of-stock/cancelled states. Every screen responsive at 390/768/1440/1920.

## Verification
- **Vitest**: registry invariants, permission resolution, legacy mapping exhaustiveness, gen-rules drift snapshot; existing suites stay green (`npm test`).
- **Rules emulator**: `npm run test:rules` matrix — owner / member-with-token / member-without / inactive / locked-module across staff, roles, one legacy OR-clause collection.
- **Playwright** (all four viewports: mobile 390, tablet 768, desktop 1440, large 1920 — via Playwright plugin if available, else `npm run test:e2e`): `owner-dashboard.spec.ts`, `module-store.spec.ts` (dep-blocked unlock message, closure unlock adds nav, lock blocked by dependent), `staff-roles.spec.ts` (create role → invite → override → UI reflects perms). Seed via extended `scripts/seed-demo.ts`.
- `npm run lint` + `npm run build` clean.
- Docs for any library API touched: Context7 MCP (fallback WebFetch); frontend work through impeccable plugin and 21st.dev MCP (fallback ui-ux-pro-max skill).
- Commit per numbered step on branch `claude/dog-pet-business-system-vym4o9`; push when Phase 1 is verified.

## Critical files
`src/types/business.ts` · `src/lib/firestore.ts` · `src/hooks/useBusiness.ts` (L293 `useBusinessRoles`, L329 `useBusinessStaff`) · `src/contexts/BusinessContext.tsx` · `src/hooks/usePermissions.ts` · `src/components/business/PermissionGate.tsx` · `src/router/index.tsx` · `src/lib/nav.ts` · `firestore.rules` · `playwright.config.ts` · `scripts/seed-demo.ts`

## Risks
Rules regression on live tenants (mitigate: legacy OR-clauses, emulator matrix, additive-only migration) · interrupted perm-resync batches (`permsSyncedAt` staleness banner + idempotent resync) · manifests accidentally bundling page code (lazy-thunk-only convention + lint/test guard) · self-escalation via new staff fields (rules self-edit guard + tests).