// ─── Roles module — v2 domain types ──────────────────────────────────────────
// businesses/{bid}/roles/{roleId}. Levels in `grants` are stored EXPANDED
// (write ⇒ [read,write], action ⇒ [read,write,action]) so rules never infer
// hierarchy. `capabilities` is a legacy mirror kept dual-written until the P7
// cleanup. See [[permissions]] and [[legacy]].

import type { Capability } from '@/shared/types';
import type { Grants } from '../permissions';

export interface TenantRole {
  id: string;
  name: string;
  isSystem?: boolean;          // 'owner' role — all grants, undeletable, read-only
  grants: Grants;
  capabilities?: Capability[]; // legacy mirror
  createdAt: number;
  updatedAt: number;
}
