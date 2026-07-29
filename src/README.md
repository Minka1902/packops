# Source layout

```
src/
  features/<domain>/     a slice of the product: its pages, its components,
                         its hooks, together
  shared/                anything more than one feature needs
  modules/               the business CRM module system (registry, manifests,
                         permissions) — self-contained, see below
  router/                route table
  tests/                 global vitest setup
```

## features/

One folder per product area, each holding `pages/`, `components/` and `hooks/`
as needed. A feature owns everything only it uses; the moment a second feature
needs something, it moves to `shared/`.

```
auth  dashboard  dog  routine  training  walk  medical
team  devices  qr  discover  messages  settings  business
```

Features do import from each other, and that is expected: the dashboard
composes widgets from dog, medical, routine and training; the routine timeline
opens the walk and medical screens. There is deliberately no lint rule
forbidding it, because a rule the codebase can't satisfy teaches people to
disable rules. What matters is direction — reach for a sibling's *component or
page*, not its internals, and if two features start sharing a hook, that hook
belongs in `shared/hooks`.

## shared/

```
shared/
  ui/          design-system primitives (button, card, dialog, …)
  layout/      app shells, sidebars, nav
  components/  cross-feature widgets that aren't primitives
  contexts/    Auth, Dog, Business, SessionMode providers
  hooks/       useAuth, useMfa, usePermissions, useAlerts, useLongPress, useNavConfig
  lib/         framework-free helpers, Firestore accessors, domain maths
  types/       shared domain types
```

`useAuth` and `useMfa` live here rather than under `features/auth` because
almost every feature needs the signed-in user; auth is infrastructure, not a
product area.

## modules/

The business CRM's module system: identity (`ids.ts`), manifests, the registry,
permission math, and the legacy bridge. It is intentionally isolated — an ESLint
rule stops `src/modules/**` from reaching tenant data through
`@/shared/lib/firestore` or `@/features/business/hooks/useBusiness`; modules go
through `TenantDb` / `useTenant()` instead, which is what keeps
`firestore.rules` generation honest.

## Imports

Use the `@/` alias (`@/features/medical/hooks/useMedical`), not deep relative
paths. Relative imports are fine within a directory — a `__tests__` folder
importing `../Component`, for instance.
