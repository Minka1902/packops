// ─── Staff module data layer ──────────────────────────────────────────────────
// Realtime reads + guarded mutations on the TenantDb. Invite ports the legacy
// userLookup flow. Only query operators / field-value helpers are imported from
// firebase/firestore (never path builders), per the modules boundary.

import { arrayUnion, arrayRemove, orderBy, type QueryConstraint } from 'firebase/firestore';
import { lookupUserByEmail } from '@/lib/userLookup';
import { useTenantCollection } from '@/lib/tenant/useTenantCollection';
import type { TenantDb } from '@/lib/tenant/tenantDb';
import { computePermTokens, type Grants, type EffectivePerms } from '../permissions';
import { capabilitiesFromGrants } from '../legacy';
import { assertPermission } from '../guards';
import type { Capability } from '@/types';
import type { TenantRole } from '../roles/types';
import type { StaffMember, StaffCertification } from './types';

export function useStaff(tenant: TenantDb | null) {
  return useTenantCollection(tenant, 'staff', [orderBy('joinedAt', 'asc')] as QueryConstraint[]);
}

// Legacy capabilities mirror for a staff member's role (transitional; the perms
// token snapshot is authoritative).
function roleCapabilities(role: TenantRole): Capability[] {
  return role.capabilities ?? capabilitiesFromGrants(role.grants);
}

export interface InviteResult {
  ok: boolean;
  reason?: string;
}

// Invite a registered PackOps user by email and assign them a role. Staff must
// be real app users; unknown addresses are rejected.
export async function inviteStaff(
  tenant: TenantDb, perms: EffectivePerms, invitedBy: string, email: string, role: TenantRole,
): Promise<InviteResult> {
  assertPermission(perms, 'staff', 'action');
  const u = await lookupUserByEmail(email);
  if (!u) return { ok: false, reason: 'No PackOps user with that email.' };
  const now = Date.now();
  const member: Omit<StaffMember, 'id'> = {
    userId: u.uid,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    roleId: role.id,
    capabilities: roleCapabilities(role),
    perms: computePermTokens(role.grants),
    permsSyncedAt: now,
    active: true,
    joinedAt: now,
    invitedBy,
  };
  await tenant.batch()
    .set(tenant.doc('staff', u.uid), { id: u.uid, ...member })
    .update(tenant.businessDoc(), { staffUserIds: arrayUnion(u.uid) })
    .commit();
  return { ok: true };
}

export async function assignRole(
  tenant: TenantDb, perms: EffectivePerms, member: StaffMember, role: TenantRole,
): Promise<void> {
  assertPermission(perms, 'staff', 'write');
  await tenant.batch().update(tenant.doc('staff', member.userId), {
    roleId: role.id,
    capabilities: roleCapabilities(role),
    perms: computePermTokens(role.grants, member.overrides),
    permsSyncedAt: Date.now(),
  }).commit();
}

// Set per-worker overrides (action-level). Recomputes perms against the role's
// grants + the new overrides.
export async function setOverrides(
  tenant: TenantDb, perms: EffectivePerms, member: StaffMember, role: TenantRole, overrides: Grants,
): Promise<void> {
  assertPermission(perms, 'staff', 'action');
  await tenant.batch().update(tenant.doc('staff', member.userId), {
    overrides,
    perms: computePermTokens(role.grants, overrides),
    permsSyncedAt: Date.now(),
  }).commit();
}

export async function setStaffActive(
  tenant: TenantDb, perms: EffectivePerms, member: StaffMember, active: boolean,
): Promise<void> {
  assertPermission(perms, 'staff', 'action');
  if (member.roleId === 'owner') throw new Error('The owner can’t be deactivated.');
  await tenant.batch().update(tenant.doc('staff', member.userId), { active }).commit();
}

export async function updateCertifications(
  tenant: TenantDb, perms: EffectivePerms, member: StaffMember, certifications: StaffCertification[],
): Promise<void> {
  assertPermission(perms, 'staff', 'write');
  await tenant.batch().update(tenant.doc('staff', member.userId), { certifications }).commit();
}

export async function removeStaff(
  tenant: TenantDb, perms: EffectivePerms, member: StaffMember,
): Promise<void> {
  assertPermission(perms, 'staff', 'action');
  if (member.roleId === 'owner') throw new Error('The owner can’t be removed.');
  await tenant.batch()
    .delete(tenant.doc('staff', member.userId))
    .update(tenant.businessDoc(), { staffUserIds: arrayRemove(member.userId) })
    .commit();
}
