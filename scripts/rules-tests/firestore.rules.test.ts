/**
 * Firestore rules emulator matrix for the v2 module/permission model.
 *
 *   npm run test:rules
 *
 * Requires (not installable offline in this workspace):
 *   npm i -D @firebase/rules-unit-testing
 * and a Java runtime for the Firestore emulator (firebase emulators:exec wraps
 * this). The file is excluded from the default `npm test` run (see
 * vite.config.ts) and picked up only by vitest.rules.config.ts.
 *
 * Matrix: owner / member-with-token / member-without / inactive, across the
 * generated staff + roles + moduleEvents rules and one retained legacy
 * OR-clause collection (customers via hasCap).
 */

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const BID = 'biz1';
const OWNER = 'owner_uid';
const MANAGER = 'manager_uid';   // full staff/roles perms
const WORKER = 'worker_uid';     // staff.read only
const INACTIVE = 'inactive_uid'; // has perms but active:false
const OUTSIDER = 'outsider_uid'; // not a member

let testEnv: RulesTestEnvironment;

const authed = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'packops-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'businesses', BID), {
      name: 'B', ownerUserId: OWNER,
      staffUserIds: [OWNER, MANAGER, WORKER, INACTIVE],
      unlockedModules: ['clients'], createdAt: 1, updatedAt: 1,
    });
    const staff = (uid: string, perms: string[], active = true, roleId = 'r', caps: string[] = []) =>
      setDoc(doc(db, 'businesses', BID, 'staff', uid), {
        userId: uid, displayName: uid, email: `${uid}@x.io`, roleId, active,
        perms, capabilities: caps, joinedAt: 1, invitedBy: OWNER,
      });
    await staff(OWNER, [], true, 'owner');
    await staff(MANAGER, ['staff.read', 'staff.write', 'staff.action', 'roles.read', 'roles.write', 'roles.action']);
    await staff(WORKER, ['staff.read']);
    await staff(INACTIVE, ['staff.action', 'roles.action'], false);
    await setDoc(doc(db, 'businesses', BID, 'roles', 'owner'), { name: 'Owner', isSystem: true, grants: {}, createdAt: 1, updatedAt: 1 });
    await setDoc(doc(db, 'businesses', BID, 'roles', 'r'), { name: 'Manager', grants: {}, createdAt: 1, updatedAt: 1 });
    await setDoc(doc(db, 'businesses', BID, 'customers', 'c1'), { name: 'Client', createdAt: 1, updatedAt: 1, createdBy: OWNER });
  });
});

describe('staff collection', () => {
  it('members read; outsiders cannot', async () => {
    await assertSucceeds(getDoc(doc(authed(WORKER), 'businesses', BID, 'staff', MANAGER)));
    await assertFails(getDoc(doc(authed(OUTSIDER), 'businesses', BID, 'staff', MANAGER)));
  });

  it('staff.action creates; staff.read alone cannot', async () => {
    const newStaff = { userId: 'n', displayName: 'n', email: 'n@x.io', roleId: 'r', active: true, perms: [], capabilities: [], joinedAt: 1, invitedBy: MANAGER };
    await assertSucceeds(setDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', 'n'), newStaff));
    await assertFails(setDoc(doc(authed(WORKER), 'businesses', BID, 'staff', 'n2'), { ...newStaff }));
  });

  it('a user cannot escalate their own perms/role', async () => {
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', MANAGER), { perms: ['staff.action', 'roles.action', 'clients.action'] }));
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', MANAGER), { roleId: 'owner' }));
  });

  it('a user cannot self-deactivate; the owner row cannot be deactivated', async () => {
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', MANAGER), { active: false }));
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', OWNER), { active: false }));
    await assertFails(deleteDoc(doc(authed(MANAGER), 'businesses', BID, 'staff', OWNER)));
  });

  it('inactive members are denied even with tokens', async () => {
    await assertFails(setDoc(doc(authed(INACTIVE), 'businesses', BID, 'staff', 'z'), { userId: 'z', roleId: 'r', active: true, perms: [], capabilities: [], displayName: 'z', email: 'z@x.io', joinedAt: 1, invitedBy: INACTIVE }));
  });
});

describe('roles collection', () => {
  it('members read; roles.write creates; the system owner role is immutable', async () => {
    await assertSucceeds(getDoc(doc(authed(WORKER), 'businesses', BID, 'roles', 'r')));
    await assertSucceeds(setDoc(doc(authed(MANAGER), 'businesses', BID, 'roles', 'r3'), { name: 'New', grants: {}, createdAt: 1, updatedAt: 1 }));
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID, 'roles', 'owner'), { name: 'Hacked' }));
    await assertFails(deleteDoc(doc(authed(MANAGER), 'businesses', BID, 'roles', 'owner')));
  });

  it('a worker without roles perms cannot write', async () => {
    await assertFails(setDoc(doc(authed(WORKER), 'businesses', BID, 'roles', 'r4'), { name: 'X', grants: {}, createdAt: 1, updatedAt: 1 }));
  });
});

describe('moduleEvents audit log', () => {
  it('owner creates; members read; nobody mutates', async () => {
    const ev = { type: 'unlock', moduleId: 'shop', byUserId: OWNER, byName: 'Owner', at: 1 };
    await assertSucceeds(setDoc(doc(authed(OWNER), 'businesses', BID, 'moduleEvents', 'e1'), ev));
    await assertFails(setDoc(doc(authed(MANAGER), 'businesses', BID, 'moduleEvents', 'e2'), ev));
    await assertSucceeds(getDoc(doc(authed(WORKER), 'businesses', BID, 'moduleEvents', 'e1')));
    await assertFails(updateDoc(doc(authed(OWNER), 'businesses', BID, 'moduleEvents', 'e1'), { at: 2 }));
    await assertFails(deleteDoc(doc(authed(OWNER), 'businesses', BID, 'moduleEvents', 'e1')));
  });
});

describe('business unlockedModules guard', () => {
  it('only the owner may change the module set', async () => {
    await assertSucceeds(updateDoc(doc(authed(OWNER), 'businesses', BID), { unlockedModules: ['clients', 'shop'], updatedAt: 2 }));
    // A manager (manage_business via legacy caps) still cannot touch it — here
    // MANAGER lacks manage_business, so any business update is denied.
    await assertFails(updateDoc(doc(authed(MANAGER), 'businesses', BID), { unlockedModules: ['clients', 'shop'], updatedAt: 2 }));
  });
});

describe('legacy OR-clause (customers via hasCap)', () => {
  it('a member with legacy manage_customers can write; without cannot', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'businesses', BID, 'staff', WORKER), {
        userId: WORKER, displayName: 'w', email: 'w@x.io', roleId: 'r2', active: true,
        perms: ['staff.read'], capabilities: ['manage_customers'], joinedAt: 1, invitedBy: OWNER,
      });
    });
    await assertSucceeds(updateDoc(doc(authed(WORKER), 'businesses', BID, 'customers', 'c1'), { name: 'Renamed', updatedAt: 2 }));
    await assertFails(updateDoc(doc(authed(OUTSIDER), 'businesses', BID, 'customers', 'c1'), { name: 'Nope', updatedAt: 2 }));
  });
});
