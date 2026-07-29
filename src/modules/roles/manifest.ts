// ─── Roles module manifest ────────────────────────────────────────────────────
// Core module: default-unlocked, not lockable, free. Routes and summaryView are
// attached in Step 6 (roles module build). `roles` uses a hand-written rules
// snippet (custom): members may READ roles (for the permission matrix), only
// roles-action may write, and the system 'owner' role is immutable.

import { lazy } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ModuleManifest } from '../types';

export const rolesManifest: ModuleManifest = {
  id: 'roles',
  name: 'Roles & Permissions',
  description: 'Role definitions and per-module read / write / action grants.',
  category: 'core',
  icon: ShieldCheck,
  priceCents: 0,
  isDefaultUnlocked: true,
  lockable: false,
  dependencies: [],
  permissions: ['read', 'write', 'action'],
  abilities: {
    read: 'View roles and their grants.',
    write: 'Create/edit roles, set per-module read/write/action defaults.',
    action: 'Delete role, bulk-reassign members, force permission resync.',
  },
  navItems: [
    { to: '/business/roles', label: 'Roles', icon: ShieldCheck, level: 'read' },
  ],
  routes: [
    { path: 'roles', lazy: () => import('./pages/RolesListPage').then((m) => ({ Component: m.default })) },
    { path: 'roles/new', lazy: () => import('./pages/RoleEditorPage').then((m) => ({ Component: m.default })) },
    { path: 'roles/:roleId', lazy: () => import('./pages/RoleEditorPage').then((m) => ({ Component: m.default })) },
  ],
  summaryView: { component: lazy(() => import('./RolesSummary')) },
  dataModels: [
    { collection: 'roles', module: 'roles', custom: true, legacyCaps: ['manage_roles'] },
  ],
};
