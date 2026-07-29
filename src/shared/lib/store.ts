// ─── Module Store data ────────────────────────────────────────────────────────
// Owner-only unlock/lock. Writes the business doc's unlockedModules (+ legacy
// `modules` mirror) and an immutable moduleEvents audit entry, in one batch.
// Locking never deletes module data — it only removes the module from the
// unlock set. Rules ultimately enforce owner-only access.

import type { TenantDb } from '@/shared/lib/tenant/tenantDb';
import { legacyModulesFromIds } from '@/modules/legacy';
import type { ModuleId } from '@/modules/ids';
import type { Business, BusinessModule } from '@/shared/types';

interface Actor { userId: string; name: string }

function auditRef(tenant: TenantDb, id: ModuleId, seq: number) {
  return tenant.doc('moduleEvents', `evt_${Date.now()}_${seq}_${id}`);
}

// Unlock a set of modules (the caller passes the transitive closure, deps first).
export async function unlockModules(
  tenant: TenantDb, business: Business, actor: Actor, ids: ModuleId[],
): Promise<void> {
  const current = new Set<ModuleId>(business.unlockedModules ?? []);
  const toAdd = ids.filter((id) => !current.has(id));
  if (toAdd.length === 0) return;
  const now = Date.now();
  const nextUnlocked = [...current, ...toAdd];
  const nextModules = [...new Set<BusinessModule>([...(business.modules ?? []), ...legacyModulesFromIds(toAdd)])];

  const batch = tenant.batch();
  batch.update(tenant.businessDoc(), { unlockedModules: nextUnlocked, modules: nextModules, updatedAt: now });
  toAdd.forEach((id, i) => {
    const ref = auditRef(tenant, id, i);
    batch.set(ref, { id: ref.id, type: 'unlock', moduleId: id, byUserId: actor.userId, byName: actor.name, at: now });
  });
  await batch.commit();
}

// Lock a single module. Data is retained; only the unlock set changes.
export async function lockModule(
  tenant: TenantDb, business: Business, actor: Actor, id: ModuleId,
): Promise<void> {
  const now = Date.now();
  const nextUnlocked = (business.unlockedModules ?? []).filter((m) => m !== id);
  const removedLegacy = new Set(legacyModulesFromIds([id]));
  const nextModules = (business.modules ?? []).filter((m) => !removedLegacy.has(m));

  const ref = auditRef(tenant, id, 0);
  await tenant.batch()
    .update(tenant.businessDoc(), { unlockedModules: nextUnlocked, modules: nextModules, updatedAt: now })
    .set(ref, { id: ref.id, type: 'lock', moduleId: id, byUserId: actor.userId, byName: actor.name, at: now })
    .commit();
}
