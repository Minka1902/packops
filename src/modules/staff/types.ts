// ─── Staff module — v2 domain types ──────────────────────────────────────────
// businesses/{bid}/staff/{userId}. Extends the legacy BusinessStaff doc with the
// v2 permission fields. `perms` is the denormalized effective snapshot as tokens
// ('<moduleId>.<level>') that firestore.rules check in a single read — same
// 2-read budget as today's hasCap. `capabilities` stays as a legacy mirror until
// the P7 cleanup. See [[permissions]], [[legacy]], [[roles/types]].

import type { BusinessStaff } from '@/types';
import type { Grants } from '../permissions';

export interface StaffCertification {
  name: string;
  issuedAt?: number;
  expiresAt?: number;   // drives the "expiring soon" (≤30d) badge
  note?: string;
}

export interface StaffMember extends BusinessStaff {
  id: string;                    // == doc id == userId (added by the converter)
  overrides?: Grants;            // present key REPLACES role default; [] = revoke
  perms: string[];               // effective snapshot tokens rules check
  permsSyncedAt?: number;        // vs role.updatedAt → staleness banner
  certifications?: StaffCertification[];
}
