// ─── Staff module manifest ────────────────────────────────────────────────────
// Core module: default-unlocked, not lockable, free. Routes and summaryView are
// attached in Step 7 (staff module build). `staff` uses a hand-written rules
// snippet (custom) for the self-edit anti-escalation guard.

import { UserCog } from 'lucide-react';
import type { ModuleManifest } from '../types';

export const staffManifest: ModuleManifest = {
  id: 'staff',
  name: 'Staff Management',
  description: 'Team directory, contact & certification info, roles and access.',
  category: 'core',
  icon: UserCog,
  priceCents: 0,
  isDefaultUnlocked: true,
  lockable: false,
  dependencies: [],
  permissions: ['read', 'write', 'action'],
  abilities: {
    read: 'View staff directory, contact & certification info.',
    write: 'Invite staff, edit profiles/certifications, assign role.',
    action: 'Deactivate/reactivate, remove staff, set per-worker permission overrides.',
  },
  navItems: [
    { to: '/business/staff', label: 'Staff', icon: UserCog, level: 'read' },
  ],
  dataModels: [
    { collection: 'staff', module: 'staff', custom: true, legacyCaps: ['manage_staff'] },
  ],
};
