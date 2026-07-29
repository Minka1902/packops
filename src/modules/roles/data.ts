// ─── Roles module data layer ──────────────────────────────────────────────────
// Realtime reads + guarded mutations on the TenantDb. Editing a role fans its
// grants out to every staff member holding it (perms resync), respecting each
// member's overrides. Only query operators are imported from firebase/firestore
// — never path builders (those come from TenantDb), per the modules boundary.

import { getDocs, query, where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useTenantCollection } from '@/shared/lib/tenant/useTenantCollection';
import type { TenantDb } from '@/shared/lib/tenant/tenantDb';
import { computePermTokens, type Grants, type EffectivePerms } from '../permissions';
import { capabilitiesFromGrants, UNMAPPED_CAPABILITIES } from '../legacy';
import { assertPermission } from '../guards';
import type { Capability } from '@/shared/types';
import type { TenantRole } from './types';
import type { StaffMember } from '../staff/types';

const CHUNK = 450;

export class RoleConflictError extends Error {
  constructor() {
    super('This role was changed by someone else. Reopen it and try again.');
    this.name = 'RoleConflictError';
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export function useRoles(tenant: TenantDb | null) {
  return useTenantCollection<'roles'>(tenant, 'roles', [orderBy('createdAt', 'asc')] as QueryConstraint[]);
}

export function memberCountsByRole(staff: StaffMember[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of staff) counts[s.roleId] = (counts[s.roleId] ?? 0) + 1;
  return counts;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// Legacy capabilities mirror for a set of grants: mapped caps + any unmapped
// caps the role previously held (so retained legacy rule clauses keep working).
function mirrorCapabilities(grants: Grants, previous: Capability[] | undefined): Capability[] {
  const kept = (previous ?? []).filter((c) => UNMAPPED_CAPABILITIES.includes(c));
  return [...new Set([...capabilitiesFromGrants(grants), ...kept])];
}

export async function createRole(
  tenant: TenantDb, perms: EffectivePerms, name: string, grants: Grants,
): Promise<void> {
  assertPermission(perms, 'roles', 'write');
  const now = Date.now();
  const ref = tenant.doc('roles', `role_${now}`);
  await tenant.batch().set(ref, {
    id: ref.id, name, grants, capabilities: mirrorCapabilities(grants, []),
    createdAt: now, updatedAt: now,
  }).commit();
}

// Save with optimistic concurrency: abort if the role's updatedAt drifted since
// it was loaded (someone else edited it). Then resync members' perms.
export async function saveRole(
  tenant: TenantDb, perms: EffectivePerms, role: TenantRole, patch: { name: string; grants: Grants },
): Promise<void> {
  assertPermission(perms, 'roles', 'write');
  const ref = tenant.doc('roles', role.id);
  const now = Date.now();
  const capabilities = mirrorCapabilities(patch.grants, role.capabilities);
  await tenant.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RoleConflictError();
    const cur = snap.data();
    if (cur.isSystem) throw new Error('The owner role is read-only.');
    if (cur.updatedAt !== role.updatedAt) throw new RoleConflictError();
    tx.update(ref, { name: patch.name, grants: patch.grants, capabilities, updatedAt: now });
  });
  await resyncRolePerms(tenant, perms, role.id, patch.grants);
}

// Fan a role's grants out to every staff member holding it, honouring each
// member's overrides. Returns how many members were updated.
export async function resyncRolePerms(
  tenant: TenantDb, perms: EffectivePerms, roleId: string, grants: Grants,
): Promise<number> {
  assertPermission(perms, 'roles', 'write');
  const snap = await getDocs(query(tenant.col('staff'), where('roleId', '==', roleId)));
  const now = Date.now();
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = tenant.batch();
    for (const d of snap.docs.slice(i, i + CHUNK)) {
      batch.update(d.ref, { perms: computePermTokens(grants, d.data().overrides), permsSyncedAt: now });
    }
    await batch.commit();
  }
  return snap.docs.length;
}

export async function deleteRole(
  tenant: TenantDb, perms: EffectivePerms, roleId: string,
): Promise<void> {
  assertPermission(perms, 'roles', 'action');
  await tenant.batch().delete(tenant.doc('roles', roleId)).commit();
}

// Move every member of one role to another, recomputing their perms from the
// target role's grants (honouring overrides). Used before deleting a role.
export async function bulkReassignRole(
  tenant: TenantDb, perms: EffectivePerms, fromRoleId: string, target: TenantRole,
): Promise<number> {
  assertPermission(perms, 'roles', 'action');
  const snap = await getDocs(query(tenant.col('staff'), where('roleId', '==', fromRoleId)));
  const now = Date.now();
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = tenant.batch();
    for (const d of snap.docs.slice(i, i + CHUNK)) {
      batch.update(d.ref, {
        roleId: target.id,
        perms: computePermTokens(target.grants, d.data().overrides),
        permsSyncedAt: now,
      });
    }
    await batch.commit();
  }
  return snap.docs.length;
}
