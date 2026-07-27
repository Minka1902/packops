# PackOps — Dog & Pet Business Management System + "Get Something" — Full Plan (all modules)

## Context

PackOps ("Dog Life") is a React 19 + TypeScript + Vite + Tailwind v4 SPA backed entirely by Firebase (Auth/Firestore/Storage; no app server — `firestore.rules` is the authoritative security boundary). It already contains the personal dog-care app plus a bolted-on business CRM: a 22-module catalog (`src/types/business.ts`), a ~50-capability role system denormalized onto staff docs, ~30 business pages, and a marketplace-style "Discover" consumer surface (`businessDirectory` projections).

We are rebuilding it properly per spec: a multi-tenant back office where businesses unlock self-contained **modules** (full 35+ catalog below, real prices shown under a "present = currently free" ribbon), module-scoped **read/write/action** permissions (role defaults + per-worker overrides, rules-enforced), an **Owner Dashboard** aggregating every module's `summaryView`, and a Wolt-style **"Get Something"** consumer marketplace (browse for your dog → order → pay → live-track → chat → rate/tip).

**Confirmed decisions:** (1) refactor in place, reusing working legacy logic; (2) Firestore rules ARE the server enforcement (no Cloud Functions); (3) consumer front is a marketplace; (4) use Context7 MCP / impeccable plugin / Playwright plugin when available (fallbacks: WebFetch docs, ui-ux-pro-max skill, repo Playwright suite); (5) **this document is the one big plan for ALL modules** — per-module `plans/<moduleId>.md` files are generated from its catalog entries at each module's implementation start; (6) user meta-rule: clarify before changing/adding/ignoring any instruction.

---

## Part A — Architecture (Phase 1 builds this; every module rides on it)

### Tenant-scoped data layer — `src/lib/tenant/`
- `tenantDb(tenantId): TenantDb` — the ONLY door to tenant data; builds paths internally (`businesses/{tid}/{col}`), so module code can never express a cross-tenant query. Typed by central `TenantSchema` map (`schema.ts`, one line per collection) via `withConverter`. `useTenantCollection`/`useTenantDoc` realtime hooks; `batch()`/`runTransaction()` passthroughs; `directoryDoc()` for public projections.
- `BusinessContext` gains `tenant`, `perms`, `unlockedModules`; new `useTenant()`. ESLint `no-restricted-imports`: `src/modules/**` cannot import raw Firestore path builders, `@/lib/firestore`, or `@/hooks/useBusiness`.

### Module registry — `src/modules/`
- `ids.ts` (ModuleId union) · `types.ts` · `registry.ts` (`MODULE_REGISTRY`, `ALL_MANIFESTS`, transitive `missingDependencies`, `dependentModules`, `moduleRoutes()`, `moduleNavItems()`) · `permissions.ts` · `legacy.ts` · `unlock.ts`.
- **Manifest**: `{ id, name, description, category, icon, priceCents, isDefaultUnlocked, lockable, dependencies, permissions: PermissionLevel[], abilities: Record<PermissionLevel, string[]>, navItems, routes, dataModels, summaryView, demoSeeder?, clientFacing?, requiresSetup? }`.
  - `abilities` = the **custom per-module ability/action labels** from Part B, surfaced in the PermissionMatrix (tooltips/expanders) so the owner sees exactly what each level grants in each module.
  - Manifests are lightweight (types + icons + lazy thunks only) — code-splitting preserved; routes via react-router v7 `route.lazy`.
- Adding a module = its folder + `ids.ts` + one registry import. Module available iff unlocked AND all deps unlocked; unlock with unmet deps blocked with a clear message + "unlock N together" closure option.
- Guards: `assertModule(business, id)` / `assertPermission(business, member, id, level)` (typed errors, top of every mutation in each module's `data.ts`), `<ModuleGate moduleId>` layout route, `usePermission(moduleId)`, `<Can moduleId level fallback?>`.
- **Every module ships `summaryView`**: lazy compact widget, self-fetching via `useTenant()` with `limit()`-bounded queries + `getCountFromServer` — never unbounded subscriptions.

### Permissions (replaces the 50-capability system)
- `roles/{roleId}`: `TenantRole { name, isSystem?, grants: Partial<Record<ModuleId, PermissionLevel[]>>, capabilities? (legacy mirror), updatedAt }` — levels stored expanded (write⇒read, action⇒write+read).
- `staff/{userId}`: extends existing doc with `roleId`, `overrides?` (present key REPLACES role default; `[]` = revoke), **`perms: string[]`** tokens `'<moduleId>.<level>'` (the denormalized snapshot rules check in one read — same 2-read budget as today's `hasCap`), `permsSyncedAt`, legacy `capabilities` mirror, `certifications[]`.
- Effective = `override ?? role default ?? none`; owner short-circuits to all; locked module grants none via rules `hasModule() &&` (no snapshot recompute on lock/unlock).
- Resync: role save → chunked `writeBatch` over `staff where roleId==` (+progress UI); override/reassign → single write; staleness banner (`permsSyncedAt` < `role.updatedAt`) + idempotent Resync; role editor transaction aborts on concurrent `updatedAt` drift.

### Firestore rules
- Helpers `hasModule(bid,m)` (reads `unlockedModules` off the business doc rules already `get()`), `hasPerm(bid,m,level)`, `can(bid,m,level)=hasModule&&hasPerm`; legacy `hasCap` kept during transition.
- **Generated section** between markers in `match /businesses/{bid}`: `scripts/gen-rules.ts` (npm `gen:rules`) emits per-collection rules from `ALL_MANIFESTS[].dataModels` (`read→can(read)`, create/update→`can(write)`, delete→`can(action)`, `|| hasCap(legacy)` while migrating); `custom:` keys inline hand-written snippets from `scripts/rules-snippets/` (self-edit anti-escalation, customer self-writes, append-only ledgers, field-scoped diffs). Vitest snapshot = drift guard. Consumer-owned collections (orders they placed, their wallet, chats, reviews) get ownership-based rules, not staff perms.
- Hand-written Phase 1 bits: owner-only field-scoped `unlockedModules` update; staff self-edit guard extended to `perms/roleId/overrides/capabilities/active`; owner-doc deactivate/delete forbidden; `moduleEvents` audit (owner create, immutable).

### Migration & backward compat — `src/modules/legacy.ts`
- Exhaustive `CAPABILITY_TO_PERM` map; `permsFromCapabilities`; `capabilitiesFromGrants` (reverse mirror); `resolveUnlockedModules` = `unlockedModules ?? (modules ?? ALL) ∪ core`.
- `migrateTenantToV2`: lazy, owner-triggered, idempotent chunked batches. Pre-migration, clients fall back to capability-derived perms and legacy rules OR-clauses keep enforcement intact. Dual-write mirrors until Phase 7 cleanup.

### Owner Dashboard & Module Store
- `OwnerDashboardPage` (`/business`): `AlertsStrip` (modules contribute alerts: low stock, unpaid invoices, open incidents, forgotten clock-outs, pending adoption apps, stale perms, needs-setup) + one `SummaryCard` (Suspense + skeleton) per unlocked module the viewer can read. Shared primitives `KpiTile`, `SummaryCard`, `AlertsStrip` in `src/components/dashboard/`. Grid 1/2/3/4 cols at 390/768/1440/1920.
- `ModuleStorePage` (`/business/store`, owner-only): `ModuleCard` grid of ALL manifests by category — icon, description, `DependencyBadges` (green unlocked/amber missing), **real price** (Intl format, business currency) under `PresentRibbon` ("currently free" — price stays visible), Unlock/Lock. Lock blocked while dependents unlocked; `lockable:false` core shows badge; unlock/lock writes `unlockedModules` + `moduleEvents` + legacy `modules` mirror; data always retained on lock.

### "Seed Business" demo data (Owner Dashboard button)
- **UI**: on the Owner Dashboard — a prominent "Seed demo business" call-to-action inside the empty-state hero when the tenant has no data yet, and afterwards tucked into the dashboard's overflow menu alongside its counterpart **"Remove demo data"**. Owner-only (`isOwner`; seeding is an `action`-class operation). Confirm dialog lists exactly what will be created; progress UI streams per-module steps ("Seeding staff… 8 ✓ · Seeding stock… 32 ✓"); completion toast with summary counts.
- **Mechanics**: runs client-side under the owner's auth via `TenantDb` (rules already allow owner writes — no bypass, seeding exercises the same guarded mutations where practical). Every seeded doc carries `demo: true`; "Remove demo data" queries each seeded collection `where('demo','==',true)` and deletes in chunked batches — fully reversible, never touches real data. Re-running with demo data present prompts "Remove & re-seed" instead of duplicating.
- **Registry-driven**: `manifest.demoSeeder?: (ctx: SeedContext) => Promise<SeedResult>` — the button seeds ONLY unlocked modules, ordered by module dependencies (staff/roles → clients → inventory → shop/orders → deliveries/invoices/…), so it automatically grows as modules land. `SeedContext = { tenant, business, rng (seeded PRNG), refs }` where `refs` accumulates created ids (seeded clients get seeded orders referencing seeded products, etc. — cross-module coherence).
- **Generators**: `src/lib/demo/` — pure, dependency-free generators (dog-themed name/breed pools, weighted statuses, date spreads) shared by the button AND `scripts/seed-demo.ts` (the existing 34 KB admin-SDK script is ported to consume the same generators so CLI and in-app seeding can't drift).
- **Content (bounded volumes, spread over the past ~90 days so charts/KPIs read realistically)**: ~8 **workers** (roster-only staff docs with synthetic `demo_*` userIds — client-side code cannot create real Auth accounts; they appear in rosters/assignments/payroll but cannot log in) with roles, certifications, clock-in history incl. one open entry + one forgotten clock-out; ~40 **clients** with ~60 pets (vaccinations, allergies, notes); ~30 **products/variants** with stock levels, low-stock cases, batches/expiry, 3 suppliers, ~6 **purchase orders** (draft/sent/received); ~25 **orders** across the full lifecycle (incl. cancelled + refunded) with status history; **deliveries** in various states with zones/driver assignments; paid/unpaid/overdue **invoices + receipts + payments** producing a believable **revenue** curve; appointments, groom visits, stays, messages, reviews — each arriving with its module's phase.
- **Phase 1 slice**: seeder framework (`SeedContext`, orchestrator in `src/modules/seed.ts`, demo-flag + removal, progress dialog) + `staff`/`roles` seeders. Each later module ships its `demoSeeder` as part of its definition-of-done; the legacy CLI seed script keeps covering not-yet-migrated collections until then.

### Consumer side (personal app tree)
Consumers are dog owners (Dog Life identity — never re-created), not staff: staff perms don't apply; rules gate their data by ownership (`orders where ownerUid==`, own wallet, own threads). Consumer surfaces read `businessDirectory` public projections (existing pattern) which the registry regenerates from `clientFacing` manifests. Full screen-by-screen flow: Part B2.

---

## Part B — Full module catalog (custom abilities & actions per module)

Format: `id` — category · priceCents · deps · legacy basis. **R/W/A** = what read/write/action mean in THIS module (these strings become `manifest.abilities`); **Actions** = the enumerated privileged operations behind the `action` level (each becomes a named guard call + rules clause); **Data** = tenant collections (→ `dataModels`); **Screens** incl. consumer surface where relevant; **Summary** = summaryView KPIs.

### Core (default-unlocked, `lockable: false`, price 0)

**1. Staff Management — `staff`**
- R: view staff directory, contact & certification info · W: invite staff, edit profiles/certifications, assign role · A: deactivate/reactivate, remove staff, set per-worker permission overrides.
- Actions: `deactivateStaff` (warns on upcoming assigned work, never blocks), `removeStaff` (doc delete + `staffUserIds` arrayRemove), `setOverrides`.
- Data: `staff`. Screens: list; detail (contact, certifications w/ expiring badges, role select, `StaffOverridesPanel` = shared PermissionMatrix in three-state override mode). Edge: owner row immutable; self-deactivation blocked UI+rules; duplicate invite no-op.
- Summary: active headcount · certifications expiring ≤30d · recent joins.

**2. Roles & Permissions — `roles`**
- R: view roles and their grants · W: create/edit roles, set per-module R/W/A defaults · A: delete role, bulk-reassign members, force perm resync.
- Actions: `deleteRole` (blocked while assigned; offers bulk-reassign), `resyncRolePerms`, `seedDefaultRoles`.
- Data: `roles`. Screens: list (name, member count); editor = `PermissionMatrix` (rows = all modules w/ ability tooltips from manifests, locked modules greyed "inactive while locked"; cols = R/W/A, auto-expand; table on desktop, stacked cards on mobile). Edge: system `owner` role read-only; concurrent-edit transaction retry; save shows "updating N staff" progress.
- Summary: role count · members-per-role mini bar · unsynced-perms warning.

### Clients & operations

**3. Clients & Pets (CRM) — `clients`** · operations · 1990 · deps: — · legacy `customers`
- R: view clients & pet profiles · W: create/edit clients, pets (breed, weight, DOB, allergies, meds, behavior notes, vaccination records, photos, multi-pet), notes · A: delete/merge clients, export client data, link/unlink a live Dog Life dog (`linkedDogId`, owner-consent gated).
- Actions: `mergeClients`, `deleteClient` (cascade-safe: blocked while open orders/appointments), `exportClients`, `linkDog`.
- Data: `customers`, `pets`. Screens: searchable list; client detail (pets tabs, activity, docs). Summary: clients/pets counts · new this month · vaccinations due.

**4. Appointments & Scheduling — `appointments`** · operations · 2490 · deps: clients · legacy `appointments`
- R: view calendar, waitlist, own assignments · W: book/reschedule, recurring series, waitlist manage, mark no-show, send reminders · A: cancel with fee decision, delete, reassign other staff, configure resources/hours.
- Actions: `cancelWithFee`, `reassignStaff`, `configureResources`.
- Data: `appointments`, `resources`, `waitlist`. Screens: resource-lane day/week calendar; waitlist; settings. Edge: per-resource double-book prevention (transaction), recurring exceptions, no-show tracking. Summary: today's count · resource utilization · no-show rate · next up.

### Consumer front ("Get Something")

**5. Consumer App "Get Something" — `consumer`** · customer · 4990 · deps: shop, appointments
- Business side — R: view storefront config & marketplace stats · W: edit storefront (hours, service area, featured items, dog-suitability tags), publish catalog to directory · A: go live/offline on the marketplace.
- Actions: `setMarketplaceLive`, `publishStorefront` (regenerates directory projections).
- Consumer side (personal app): the full "Get Something" journey — screen-by-screen spec in **Part B2**.
- Data: `storefront` (+ directory projections), `users/{uid}/carts/{bid}`. Screens: storefront editor + live preview; consumer screens per Part B2. Summary: marketplace orders today · storefront status · top items.

**6. Live Order & Service Tracking — `tracking`** · customer · 2990 · deps: shop
- R: view live pipeline boards & order timelines · W: advance order/service status, set ETA, share courier position · A: override/rewind status, cancel in-flight order.
- Actions: `overrideStatus`, `cancelInFlight`.
- Data: `orderEvents` (append-only status history), `courierPositions`. Screens: business kanban pipeline (placed→accepted→preparing→ready→out→done); consumer live-track page (status steps + ETA + Leaflet map, reusing existing map stack). Summary: in-flight count · avg fulfilment time · running late.

**7. Messaging & Notifications — `messaging`** · customer · 1990 · deps: — · legacy `messages` (+`report_cards` folded in as visit-update message type)
- R: view threads · W: reply, message templates, visit updates/photos · A: delete threads, broadcast announcement, notification channel config (push/SMS/email adapters; in-app real, external via pluggable adapter stubs).
- Actions: `deleteThread`, `broadcast`, `configureChannels`.
- Data: `threads`, `messages`. Screens: business inbox/thread; consumer chat per order & per business. Summary: unread · median response time · open threads.

### Money in

**8. Point of Sale — `pos`** · operations · 3990 · deps: inventory
- R: view registers, session history, sales · W: ring up mixed service+product sales (barcode entry, tips), open/close register session · A: void sale, discount beyond role limit, refund, cash reconciliation adjustment.
- Actions: `voidSale`, `refundSale`, `reconcileCash`, `overrideDiscount`.
- Data: `registerSessions`, `sales`. Screens: touch-first register (product grid + barcode + cart + tender: cash/card/wallet/credit); session close with count & variance. Edge: stock decrement in transaction shared with shop; offline warning. Summary: today's takings · open register status · tips today.

**9. Online Shop & Orders — `shop`** · operations · 3990 · deps: inventory · legacy `orders`+`services`+commerce settings
- R: view catalog & orders · W: manage catalog/prices/variants/service menu, advance lifecycle place→accept→fulfil→complete · A: cancel after accept, refund, price override, open/close online ordering.
- Actions: `cancelAcceptedOrder`, `refundOrder` (routes to wallet-credit when wallet unlocked), `overridePrice`, `setOrdersOpen`.
- Data: `services`, `orders` (+status history), `carts`. Keeps existing stock-reservation transactions (`OrderStockError`). Edge: out-of-stock at accept, cancelled-order stock release. Screens: catalog editor (variants, dog-suitability tags); order list/detail with lifecycle buttons. Summary: open orders · today's revenue · cancellation rate.

**10. Invoicing & Receipts — `invoicing`** · operations · 1990 · deps: — · legacy `invoices`
- R: view invoices/receipts · W: create/edit drafts, send, record payment received · A: void, write-off, credit note, delete draft.
- Actions: `voidInvoice`, `writeOff`, `issueCreditNote`.
- Data: `invoices`, `receipts` (auto-issued on payment). Reuses `computeInvoiceTotals`. Summary: unpaid total · overdue count · paid this week.

**11. Payments & Billing — `payments`** · operations · 4990 · deps: invoicing
- R: view transactions & payout ledger · W: configure payment methods, initiate charges, retry failed · A: refund, change recurring mandates, edit gateway credentials.
- Actions: `refundPayment`, `updateGatewayConfig`, `cancelMandate`.
- Data: `payments`, `payouts`, `gatewayConfig`. Provider adapter interface with a sandbox/mock driver (real prices in data, nothing charges — consistent with store). Summary: volume this month · failed payments · pending payouts.

**12. Customer Wallet & Credit — `wallet`** · customer · 2490 · deps: —
- R: view balances & ledgers · W: credit adjustments with reason, process refund-to-credit, issue gift balance · A: debit correction, freeze/unfreeze wallet, large-credit approval.
- Actions: `correctBalance`, `freezeWallet`, `issueGiftBalance`.
- Data: `wallets`, `walletTransactions` (append-only ledger; balance updated transactionally; never negative). Consumer sees balance + history and pays with wallet at checkout. Summary: outstanding liability · top-ups this week · frozen wallets.

**13. Subscriptions & Auto-Ship — `subscriptions`** · customer · 2990 · deps: payments
- R: view plans & subscriber list · W: create plans (recurring food/product boxes), pause/skip/resume cycles, edit next ship date · A: cancel subscription, refund a cycle, reprice live subscriptions.
- Actions: `cancelSubscription`, `refundCycle`, `repriceLive`.
- Data: `subscriptionPlans`, `subscriptions`, `subscriptionCycles` (cycle→order generation). Consumer: manage own subs (pause/skip). Edge: failed renewal retry/dunning states. Summary: active subs · MRR · upcoming shipments · failed renewals.

**14. Memberships & Plans — `memberships`** · customer · 2490 · deps: payments · legacy `packages`
- R: view tiers & members · W: create tiers (VIP, unlimited daycare), enroll, member pricing/perks, prepaid packages/credits · A: cancel/comp membership, change live tier pricing.
- Actions: `compMembership`, `cancelMembership`, `repriceTier`.
- Data: `membershipTiers`, `memberships`, `prepaidPackages`. Member pricing hooks into shop/appointments pricing resolution. Summary: active members · tier breakdown · expiring ≤30d.

**15. Promotions & Deals — `promotions`** · customer · 1990 · deps: —
- R: view promos & redemptions · W: create/edit flash deals, bundles, happy-hour windows, promo codes (caps, validity) · A: activate/deactivate, override stacking rules, delete.
- Actions: `togglePromo`, `overrideStacking`.
- Data: `promotions`, `redemptions`. Pricing resolution order: member price → promo → base (single shared `resolvePrice` helper used by shop/POS/consumer). Edge: expiry windows, per-customer caps, unique codes. Summary: live promos · redemptions today · top promo.

**16. Loyalty & Marketing — `loyalty`** · customer · 2990 · deps: clients
- R: view point balances & campaigns · W: configure earn/burn rules, referral program, campaigns, automated triggers (birthday, vaccine-due, rebook) · A: manual point adjustment, send campaign, delete.
- Actions: `adjustPoints`, `sendCampaign`.
- Data: `loyaltyAccounts`, `pointEvents` (append-only), `campaigns`. Triggers evaluated client-side on dashboard load + on relevant writes (no server). Summary: points liability · active campaigns · referral conversions.

### Stock & logistics

**17. Inventory & Stock — `inventory`** · operations · 2990 · deps: — · legacy `inventory`+`purchasing`
- R: view products, stock levels, suppliers, POs · W: products/variants, stock adjustments (reasoned), suppliers, create/receive POs, batch/expiry data · A: approve PO, stock write-off, delete product, edit cost/margins.
- Actions: `approvePurchaseOrder`, `writeOffStock`, `deleteProduct` (blocked while in open orders).
- Data: `products`, `variants`, `stockLevels` (keyed by location when branches unlocked), `suppliers`, `purchaseOrders`, `stockMovements` (append-only). Edge: negative-stock prevention, low-stock thresholds → dashboard alert, expiring batches. Summary: low-stock alerts · stock value · open POs · expiring batches.

**18. Deliveries & Logistics — `deliveries`** · operations · 2990 · deps: shop · legacy `shipments`
- R: view delivery board & zones · W: create deliveries from orders, assign drivers, zones/fees config · A: reassign in-flight, cancel delivery, fee override.
- Actions: `reassignDriver`, `cancelDelivery`, `overrideFee`.
- Data: `deliveries`, `deliveryZones`. Feeds tracking's courier positions. Summary: out for delivery · on-time rate · unassigned.

**19. Pet Transport / Taxi — `transport`** · specialty · 2990 · deps: clients
- R: view jobs & routes · W: schedule pickup/drop-off jobs, fares, routes, live status updates · A: cancel in-progress job, fare override, driver reassignment.
- Actions: `cancelJob`, `overrideFare`, `reassignJob`.
- Data: `transportJobs`, `transportRoutes`. Consumer books via Get Something, tracks via tracking module. Summary: today's jobs · live now · revenue this week.

### People

**20. Workforce & Time Tracking — `workforce`** · operations · 3990 · deps: — · legacy `shifts`+`payroll`
- R: view rota, timesheets, own entries, leave calendar · W: clock in/out (self), edit rota, submit leave requests, set commissions · A: approve/deny leave, correct time entries (audited), run payroll, change pay rates, auto-close forgotten clock-outs.
- Actions: `approveLeave`, `correctTimeEntry` (writes `corrections[]` audit trail), `runPayroll` (hours×rate + overtime + commissions, reusing `src/lib/payroll.ts`), `autoCloseEntry`, `setPayRate`.
- Data: `shifts`, `timeEntries`, `leaveRequests`, `payRuns`, `payslips`. Clock-in mechanics (per spec): open entry = "currently working"; double clock-in blocked by transaction on the open entry; hours computed from server timestamps at close; midnight-crossing entries split per day for payroll; forgotten clock-outs flagged after policy threshold → owner auto-close/correct with audit; certification-expiry alerts (joint with staff module). Summary: currently working · hours this week · pending leave · forgotten clock-outs.

### Service lines

**21. Grooming — `grooming`** · specialty · 2490 · deps: clients, appointments · legacy `grooming`
- R: view groom calendar & menu · W: breed-based service menu + add-ons, assign groomer, before/after photos, groom notes · A: delete services, comp/discount a groom.
- Actions: `compGroom`, `deleteGroomService`.
- Data: `groomServices`, `groomVisits` (references appointments + staff). Summary: today's grooms · average ticket · photos pending.

**22. Boarding & Daycare — `boarding`** · specialty · 2990 · deps: clients · legacy `boarding`
- R: view occupancy calendar & stays · W: bookings, check-in/out, feeding/med schedules, daily photo updates · A: override capacity, cancel with fee waiver, configure kennels/runs.
- Actions: `overrideCapacity`, `waiveCancellationFee`, `configureKennels`.
- Data: `kennels`, `stays`, `careTasks`, `stayUpdates`. Reuses `src/lib/occupancy.ts`. Edge: occupancy conflicts, meds-due alerts. Summary: occupancy % · arrivals/departures today · meds due.

**23. Veterinary / Health Records — `veterinary`** · specialty · 3990 · deps: clients · legacy `patients`
- R: view charts (sensitive — typically granted narrowly) · W: SOAP notes, prescriptions, lab results, treatment plans, vaccinations (+ vaccination reminders) · A: amend/void a signed entry (amendment trail, never hard-edit), delete record, sync vaccination to the pet's Dog Life profile (owner-consent gated via `linkedDogId`).
- Actions: `voidChartEntry`, `amendSignedEntry`, `syncToDogLife`.
- Data: `chartEntries`, `prescriptions`, `labResults`, `treatmentPlans`, `vaccinations`. Summary: today's patients · vaccines due · open treatment plans.

**24. Training — `training`** · specialty · 1990 · deps: clients
- R: view plans & progress · W: session plans, class packages, progress notes, milestones · A: issue/revoke certificates, delete plans.
- Actions: `issueCertificate`, `revokeCertificate`.
- Data: `trainingPlans`, `trainingSessions`, `certificates`. Summary: active trainees · sessions this week · certificates issued.

**25. Dog Walking / Field Services — `walking`** · specialty · 2490 · deps: clients, appointments
- R: view walk schedule & live walks · W: schedule walks, start/stop walk with live GPS, check-in photos · A: cancel a live walk, correct a recorded route.
- Actions: `cancelLiveWalk`, `correctRoute`.
- Data: `walks` (GPS track — reuse personal-app walk/geo stack `src/lib/geo.ts` + Leaflet). Weather-aware slot hints via adapter (e.g. Open-Meteo) with graceful offline fallback. Owner watches live on map (consumer too, via tracking). Summary: walks today · live now (mini map) · distance this week.

**26. Breeding & Litters — `breeding`** · specialty · 2490 · deps: clients · legacy `breeding`
- R: view litters, pedigrees, waitlist · W: litters, puppy reservations/waitlist, health/DNA tests, stud service records · A: buyer contracts, take/refund deposits, reorder waitlist, delete.
- Actions: `generateBuyerContract` (→documents when unlocked), `refundDeposit`, `reorderWaitlist`.
- Data: `litters`, `reservations`, `healthTests`, `studServices`. Summary: active litters · reservations · upcoming due dates.

### Rescue & nonprofit

**27. Dog Rescue & Adoption — `rescue`** · specialty · 2990 · deps: — · legacy `adoptions`
- R: view rescue dogs, applications, fosters · W: intake records, adoption listings, foster placements, assessments, spay/neuter tracking · A: approve/deny applications (screening decision), adoption contracts, process rehome/returns, delete.
- Actions: `decideApplication`, `signAdoptionContract`, `processReturn`.
- Data: `rescueDogs`, `fosterPlacements`, `adoptionApplications`, `adoptionContracts`. Consumer: browse adoptables + apply (existing directory surface, rebuilt). Summary: dogs in care · pending applications · available fosters · adoptions this month.

**28. Donations & Fundraising — `donations`** · specialty · 2490 · deps: payments
- R: view donations, donors, campaigns · W: campaigns, sponsor-a-dog setups, donor CRM notes · A: refund donation, issue tax receipt, export donor data.
- Actions: `refundDonation`, `issueTaxReceipt`, `exportDonors`.
- Data: `donations` (one-off/recurring), `donors`, `fundraisingCampaigns`, `sponsorships`. Summary: raised this month · recurring donors · active campaigns.

**29. Events & Classes Booking — `events`** · customer · 1990 · deps: — · legacy `classes`
- R: view events & attendee lists · W: create adoption days/workshops/meetups/group classes, capacity, ticket types, RSVP manage · A: cancel event (with refunds), comp tickets, delete.
- Actions: `cancelEvent`, `compTicket`.
- Data: `events`, `tickets`, `rsvps`, `classEnrollments` (reuses `classSpotsLeft`). Consumer: RSVP + paid tickets via Get Something. Edge: capacity race (transaction). Summary: upcoming events · tickets sold · fill rate.

**30. Lost & Found / Microchip Registry — `lostfound`** · specialty · 990 · deps: —
- R: view reports & lookups · W: lost/found reports, microchip lookup (matches `Dog.chipId` in Dog Life), community alert drafts · A: broadcast community alert, resolve/close report.
- Actions: `broadcastAlert`, `resolveReport`.
- Data: `lostReports`, `communityAlerts`. Consumer: report lost dog, see area alerts. Summary: open reports · suggested matches · resolved this month.

### Governance & insight

**31. Documents & Compliance — `documents`** · operations · 2490 · deps: clients · legacy `waivers`
- R: view documents, waivers, incidents · W: templates (waivers/consent/contracts), send for e-signature, record incident reports, upload files · A: void signed document, publish/unpublish templates, delete.
- Actions: `voidSignedDoc`, `publishTemplate`.
- Data: `docTemplates`, `docSubmissions` (e-sign: typed-name + timestamp + hash), `incidents`, Storage files. Summary: pending signatures · open incidents · expiring documents.

**32. Reviews, Ratings & Tips — `reviews`** · customer · 1490 · deps: clients
- R: view reviews, survey results, tips · W: configure post-visit surveys, reply to reviews · A: flag/report abusive review, allocate tip payouts to staff.
- Actions: `flagReview`, `allocateTips`.
- Data: `reviews` (+ directory projection), `surveys`, `tips`. Consumer: post-order rate business + rate & tip the walker/groomer/driver. Summary: average rating · new reviews · tips this week.

**33. Support & Disputes — `support`** · operations · 1990 · deps: shop
- R: view tickets & disputes · W: respond, escalate, attach orders/evidence · A: resolve with refund/credit, close dispute, delete ticket.
- Actions: `resolveWithRefund` (→ payments/wallet), `closeDispute`.
- Data: `supportTickets`, `ticketEvents` (append-only). Consumer: open ticket/dispute from an order. Summary: open tickets · SLA breaches · resolved this week.

**34. Facilities & Maintenance — `facilities`** · operations · 1490 · deps: —
- R: view schedules & logs · W: cleaning/sanitation schedules, equipment & kennel maintenance logs · A: take an area/kennel out of service (reduces boarding capacity when unlocked), delete logs.
- Actions: `setAreaOutOfService`.
- Data: `maintenanceLogs`, `cleaningTasks`, `equipment`. Summary: tasks due today · open issues · areas out of service.

**35. Pet Insurance & Wellness Plans — `insurance`** · specialty · 1990 · deps: clients
- R: view policies & claims · W: policy records, wellness plan enrollment, claim assistance notes/status · A: delete records, export claim pack.
- Actions: `exportClaimPack`.
- Data: `insurancePolicies`, `wellnessEnrollments`, `claims`. Summary: active policies · claims in progress · renewals due.

**36. Analytics & Reports — `analytics`** · operations · 3990 · deps: — · legacy `reports`+`expenses`
- R: view dashboards & run reports · W: define custom reports, record expenses · A: accounting export (CSV), delete expenses.
- Actions: `exportAccounting`.
- Data: `expenses`, `reportDefs` + bounded aggregate reads over other modules' data (counters/`getCountFromServer`; reuses `src/lib/reports.ts`, `expenses.ts`). Summary: revenue MTD · top products/services · staff utilization · retention.

**37. Multi-Location / Branches — `branches`** · operations · 4990 · deps: —
- R: view branches & per-branch figures · W: create/edit branches, assign staff/pricing/stock per branch · A: close a branch, transfer stock between branches.
- Actions: `closeBranch`, `transferStock` (paired stockMovements in one transaction).
- Data: `locations`; cross-cutting: `stockLevels`/`shifts`/`appointments` gain `locationId` scoping once unlocked (nullable = default branch). Summary: branch list · revenue per branch · stock by branch.

---

## Part B2 — "Get Something" consumer flow (screen by screen, built in P3, enriched by later phases)

Lives in the **personal app tree** (`AppShell`, bottom-nav tab "Get Something", routes under `/get`). Replaces `pages/discover/` incrementally. Everything reads `businessDirectory` projections + the consumer's own docs; writes go through consumer-ownership rules (never staff perms). Marketplace model: order from any participating business; **one business per cart/order** (Wolt-style).

**Capability gating principle**: what a consumer can do with a business is driven by THAT business's unlocked modules + open flags, carried on its directory projection — products/cart need `shop` live; service booking needs `appointments` bookable; delivery option needs `deliveries`; promo field needs `promotions`; wallet payment needs `wallet`; tips/ratings need `reviews`; live map needs `tracking`. Surfaces degrade gracefully (hidden, not broken) when a business lacks a module.

1. **Home — `/get`**: dog selector chip row (from DogContext; single dog auto-selected; no dogs → "add your dog" empty-state CTA), search bar, category tiles (Food & Treats, Grooming, Walks & Training, Boarding & Daycare, Vet, Adoption, Events, Shops), horizontal rails: **Order again** (last N completed orders), **Near you** (geo-sorted via existing `src/lib/geo.ts`; distance-bounded query), **Deals** (businesses with live promotions). Business card = logo/cover, rating ★, distance, open/closed, delivery badge + fee, "suits <dog>" badge. All rails `limit()`-bounded.
2. **Browse/search — `/get/browse`**: full-text-ish prefix search over projections + filters (category, open now, delivers to me, rating ≥, distance, **suitable for selected dog** — size/age tags) and sort (distance/rating/price level). Empty state offers radius widening.
3. **Business page — `/get/b/:bid`**: header (cover, name, rating + review count, hours w/ open-now, delivery zones/fee/min), tabs **Products / Services / Reviews / About**. Items show price (member/promo price when applicable via shared `resolvePrice`), variant picker, and **dog-suitability badges** computed against the selected dog's profile — weight/size fit, age range, and a prominent **allergy warning** when a food product's ingredient tags intersect the dog's allergies (from Dog Life medical data, on-device check only). Products → quantity + Add to cart; services → slot picker fed by the projection's busy-slots (existing `refreshBusySlots` pattern) → books an appointment tied to the order.
4. **Cart — `/get/cart`**: persisted at `users/{uid}/carts/{bid}` (survives devices); adding from a different business prompts "start a new cart?". Line items (product variants + booked service slots) each tagged to a dog; fulfilment picker **pickup / delivery / in-store** (delivery: zone-resolved fee, address defaulting from dog's `homeAddress`); promo code entry (validated against the business's live promotions: window, caps, uniqueness); tip selector (percent presets/custom, when business has `reviews`); running totals (subtotal → promo discount → delivery fee → tip → total). Edge: item went out of stock / price changed since add → line flagged with accept/remove.
5. **Checkout — `/get/checkout`**: confirm dog(s), address/time slot, payment method — **wallet balance** (when business has `wallet` and balance covers it), **card via gateway adapter** (sandbox/mock driver until Payments phase — real prices, no real charge), or **pay at pickup/in-store** where the business allows. Place order = one transaction: stock reservation (existing `OrderStockError` path), order doc `{ ownerUid, dogIds, lines, fulfilment, totals, status: 'placed' }` + first `orderEvents` entry + cart cleared. Failure states surfaced per line (out-of-stock) or whole-order (payment declined).
6. **Order tracking — `/get/orders/:bid/:orderId`**: live status stepper — products: `placed → accepted → preparing → ready → out_for_delivery → delivered` (pickup skips the courier legs); services: `booked → checked_in → in_progress → ready_for_pickup → completed`; ETA from the business's estimate on each event; **Leaflet map** with courier position during `out_for_delivery` (tracking module); **chat** button opens the order-scoped messaging thread; **cancel** = free self-serve before `accepted`, afterwards becomes "request cancellation" (goes to support/disputes when unlocked, else a flagged message); receipt link once completed (invoicing). Status writes are staff-only in rules — the consumer can only create the order, cancel pre-accept, and write chat.
7. **Orders — `/get/orders`**: Active / Past tabs via one `collectionGroup('orders').where('ownerUid','==',uid)` query (single composite index + `match /{path=**}/orders` ownership rule). **Reorder** rebuilds a cart from a past order, re-validating stock/prices and showing a diff ("2 items changed price, 1 unavailable") before checkout.
8. **Rate & tip — post-completion**: one-time prompt per completed order (and a button on the order page): star rating + text for the business (feeds `reviews` + directory projection) and, when a staff member was assigned (walker/groomer/driver), rate + tip that person (tip → tips ledger, owner allocates payouts in the reviews module). Skippable, never blocks.
9. **Consumer wallet & receipts — `/get/wallet`**: balance, top-up (mock gateway), transaction history, gift balance; refunds-to-credit land here. Receipts listed per completed order.

Cross-cutting: in-app **notification center** + badge on the Get Something tab driven by order events and chat (messaging module; push/SMS/email via adapter stubs). All screens responsive 390/768/1440/1920 with skeletons + explicit empty/error/offline states. Firestore efficiency: consumer reads are projections + own-doc queries only; no unbounded scans; new indexes: `orders` collectionGroup (ownerUid, createdAt desc) and directory geo/rating composites as needed.

**Phasing**: P3 ships screens 1–8 end-to-end with pickup/pay-at-pickup + sandbox card (orders, tracking, chat fully working); promo/tips/wallet/receipt affordances appear automatically in P7 as `promotions`/`reviews`/`wallet`/`payments` modules land (business-side gating means no consumer-side rework — the UI slots are built gated from day one).

---

## Part C — Build order (user's mandated phases; a module is done only when it registers cleanly, respects unlock + all three levels rules-enforced, ships summaryView, is responsive at 390/768/1440/1920, handles empty/error/edge states, passes Playwright, and the user confirms — stop for confirmation at each phase boundary)

Repeatable migration pattern per legacy-backed module: create `src/modules/<id>/` → move its types out of `business.ts` → port hooks from `useBusiness.ts` (1705-line monolith drains until empty) into `data.ts` on TenantDb → manifest with abilities/actions from Part B → `gen:rules` → swap router/nav entries, delete legacy pages/slices → summaryView auto-appears on dashboard → `demoSeeder` registered (Seed Business button now covers it) → Playwright smoke.

- **P1 Foundation** (build now, in order): (1) `src/modules/{ids,types,permissions,legacy}.ts` + unit tests → (2) tenant layer + BusinessContext extension → (3) manifests: full `staff`/`roles` + stubs for all others (store complete from day one) → (4) rules helpers + generator + emulator tests (`test:rules`) → (5) `migrateTenantToV2` + seed v2 → (6) Roles module (swap route, delete `RolesPage`/`RoleEditor`/`CapabilityMatrix`) → (7) Staff module (delete `StaffPage`, port invite via `userLookup.ts`) → (8) router/nav integration (`moduleRoutes()`, `ModuleGate`, sidebar merge) → (9) Owner Dashboard → (10) Module Store + unlock/lock + `moduleEvents` → (11) Seed-business framework (`src/lib/demo/` generators, `src/modules/seed.ts` orchestrator, dashboard button + Remove-demo-data, staff/roles seeders) → (12) ESLint guards + Playwright `large` (1920×1080) project → (13) verify + push.
- **P2 Core commerce**: clients, inventory, shop, pos, invoicing.
- **P3 Consumer front**: consumer ("Get Something"), tracking, messaging.
- **P4 People & scheduling**: workforce, appointments.
- **P5 Service lines**: grooming, boarding, veterinary, training, walking, breeding, transport.
- **P6 Rescue & nonprofit**: rescue, donations, events, lostfound.
- **P7 Growth & governance**: payments, wallet, subscriptions, memberships, promotions, loyalty, deliveries, documents, reviews, support, facilities, insurance, analytics, branches. Then **cleanup**: drop legacy mirrors + rules OR-clauses after tenant sweep; delete drained `useBusiness.ts`, `PermissionGate.tsx`, capability catalog; `pages/discover/` fully replaced by consumer module surfaces.

## Coding standards (hard, every phase)
One component per file · in-file order constants→helpers→component (hooks first inside) · zero duplication (extract on 2nd occurrence; props/variants/composition) · Firestore access efficiency-first (fewest reads, bounded queries, batches, indexes; warn before any prettifying that costs performance) · no dead code · boundary validation · explicit empty/denied/locked/out-of-stock/cancelled states · responsive at 390/768/1440/1920.

## Verification (per module + per phase)
- Vitest: registry invariants (unique ids, acyclic existing deps, every manifest has summaryView + abilities), perm resolution (override/role/none, owner, locked denial, level expansion), legacy mapping exhaustiveness, gen-rules drift snapshot; existing suites stay green.
- Rules emulator (`@firebase/rules-unit-testing`, npm `test:rules`): owner / member-with-token / member-without / inactive / locked-module matrix per migrated collection + consumer-ownership rules.
- Playwright at all four viewports (Playwright plugin if available, else `npm run test:e2e`): P1 specs `owner-dashboard`, `module-store` (dep-blocked unlock message, closure unlock adds nav, lock blocked by dependent), `staff-roles` (role → invite → override → UI reflects perms), `seed-business` (seed → dashboards populate → remove → clean, and re-seed prompts instead of duplicating); each later module adds its core-flow spec. E2E fixtures seeded via the same `src/lib/demo/` generators (CLI script or the button itself).
- `npm run lint` + `npm run build` clean. Docs via Context7 MCP (fallback WebFetch); frontend through impeccable plugin (fallback ui-ux-pro-max). Commit per step on `claude/dog-pet-business-system-vym4o9`; push when each phase verifies.

## Critical files
`src/types/business.ts` · `src/lib/firestore.ts` · `src/hooks/useBusiness.ts` (`useBusinessRoles` L293, `useBusinessStaff` L329) · `src/contexts/BusinessContext.tsx` · `src/hooks/usePermissions.ts` · `src/components/business/PermissionGate.tsx` · `src/router/index.tsx` · `src/lib/nav.ts` · `firestore.rules` · `playwright.config.ts` · `scripts/seed-demo.ts`

## Risks
Rules regression on live tenants (legacy OR-clauses + emulator matrix + additive-only migration) · interrupted perm-resync batches (`permsSyncedAt` staleness banner + idempotent resync) · manifests bundling page code (lazy-thunk-only convention + lint/test guard) · self-escalation via new staff fields (rules self-edit guard + tests) · scope: 37 modules is months of work — phase gates with user confirmation keep it controlled.