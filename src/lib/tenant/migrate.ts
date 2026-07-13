// ─── Lazy tenant migration to the v2 module model ─────────────────────────────
// Owner-triggered from BusinessContext the first time an un-migrated business
// (unlockedModules === undefined) becomes active. Additive and idempotent:
//   • roles gain a `grants` map derived from their capability mirror;
//   • staff gain a `perms` token snapshot derived from their capability mirror
//     (the owner's own doc is skipped — the owner short-circuits every check, so
//     its snapshot is never read, and the self-edit rule would reject it);
//   • the business gains `unlockedModules` (+ keeps the legacy `modules` mirror).
// Legacy `capabilities` mirrors and firestore.rules OR-clauses stay in place, so
// enforcement is unbroken throughout. Chunked to stay under the 500-write batch
// limit.

import { getDocs, doc, updateDoc, writeBatch, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { businessesCol, bizRolesCol, bizStaffCol } from '@/lib/firestore';
import {
  resolveUnlockedModules, grantsFromCapabilities, permsFromCapabilities, legacyModulesFromIds,
} from '@/modules/legacy';
import type { Business, BusinessRole, BusinessStaff } from '@/types';

const CHUNK = 450;

async function commitInChunks(
  docs: QueryDocumentSnapshot[],
  patch: (d: QueryDocumentSnapshot) => Record<string, unknown> | null,
): Promise<void> {
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    let touched = 0;
    for (const d of slice) {
      const data = patch(d);
      if (data) { batch.update(d.ref, data); touched++; }
    }
    if (touched) await batch.commit();
  }
}

/**
 * Migrate one business to v2. Returns true if it ran, false if already migrated.
 * Must be called by the owner (rules only permit the owner to write
 * unlockedModules and to update other staff docs).
 */
export async function migrateTenantToV2(business: Business): Promise<boolean> {
  if (business.unlockedModules !== undefined) return false;
  const bid = business.id;
  const now = Date.now();
  const unlocked = resolveUnlockedModules(business);

  const rolesSnap = await getDocs(bizRolesCol(bid));
  await commitInChunks(rolesSnap.docs, (d) => {
    const role = d.data() as BusinessRole;
    return { grants: grantsFromCapabilities(role.capabilities ?? []), updatedAt: now };
  });

  const staffSnap = await getDocs(bizStaffCol(bid));
  await commitInChunks(staffSnap.docs, (d) => {
    if (d.id === business.ownerUserId) return null; // owner short-circuits; skip
    const s = d.data() as BusinessStaff;
    return { perms: permsFromCapabilities(s.capabilities ?? []), permsSyncedAt: now };
  });

  await updateDoc(doc(businessesCol(), bid), {
    unlockedModules: unlocked,
    modules: business.modules ?? legacyModulesFromIds(unlocked),
    updatedAt: now,
  });
  return true;
}
