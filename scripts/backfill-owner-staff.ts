/**
 * Backfill owner staff docs.
 *
 * Repairs businesses created by an interrupted `createBusiness` (or under
 * restrictive rules) where the business doc exists but the owner's
 * `staff/{uid}` subdoc was never written. Without that subdoc, `isBizMember`
 * fails and the owner is locked out of their own business (the top-level read
 * rule gates on membership, not ownership).
 *
 * SETUP (same as seed-demo.ts):
 *   1. scripts/service-account.json  (Console → Project Settings → Service Accounts)
 *   2. MINKA_UID env var = your Firebase Auth UID
 *   3. Run: MINKA_UID=<uid> npx ts-node --project scripts/tsconfig.json scripts/backfill-owner-staff.ts
 *
 * Idempotent — safe to re-run. Only writes what is missing.
 */

import * as admin from 'firebase-admin';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as path from 'path';

const UID = process.env.MINKA_UID || '';
if (!UID || UID === 'YOUR_MINKA_UID_HERE') {
  console.error('✗ MINKA_UID is required. Run: MINKA_UID=<your-auth-uid> npm run backfill');
  process.exit(1);
}

// Mirror of ALL_CAPABILITIES in src/types/business.ts (kept in sync with seed-demo.ts).
const ALL_CAPS = [
  'manage_staff', 'manage_roles', 'manage_business', 'view_business',
  'view_customers', 'manage_customers',
  'view_appointments', 'manage_appointments', 'manage_own_appointments',
  'view_invoices', 'manage_invoices', 'record_payments',
  'view_inventory', 'manage_inventory', 'view_shipments', 'manage_shipments',
  'view_orders', 'manage_orders', 'view_boarding', 'manage_boarding',
  'view_services', 'manage_services', 'view_shifts', 'manage_shifts',
  'view_purchasing', 'manage_purchasing', 'view_reports',
  'view_messages', 'manage_messages', 'view_report_cards', 'manage_report_cards',
  'view_packages', 'manage_packages', 'view_adoptions', 'manage_adoptions',
  'view_patients', 'manage_patients', 'view_classes', 'manage_classes',
  'view_breeding', 'manage_breeding',
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require(path.join(__dirname, 'service-account.json')) as admin.ServiceAccount;
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db: Firestore = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
  const now = Date.now();

  // Resolve display fields from Auth (best-effort).
  let displayName = 'Owner';
  let email: string | undefined;
  let photoURL: string | undefined;
  try {
    const u = await getAuth().getUser(UID);
    displayName = u.displayName ?? u.email?.split('@')[0] ?? 'Owner';
    email = u.email ?? undefined;
    photoURL = u.photoURL ?? undefined;
  } catch {
    console.warn(`! Could not load Auth user ${UID} — using placeholder display fields.`);
  }

  // Businesses this user owns OR is listed as staff for, deduped.
  const [owned, listed] = await Promise.all([
    db.collection('businesses').where('ownerUserId', '==', UID).get(),
    db.collection('businesses').where('staffUserIds', 'array-contains', UID).get(),
  ]);
  const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  [...owned.docs, ...listed.docs].forEach(d => byId.set(d.id, d));

  if (byId.size === 0) {
    console.log(`No businesses found for uid ${UID} (neither ownerUserId nor staffUserIds match).`);
    console.log('If you expected some, the business was created under a different account/uid.');
    return;
  }

  console.log(`Found ${byId.size} business(es) for uid ${UID}. Checking owner staff docs…\n`);

  let repaired = 0, alreadyOk = 0;
  for (const [bid, bizSnap] of byId) {
    const biz = bizSnap.data();
    const name = biz.name ?? '(unnamed)';
    const isOwner = biz.ownerUserId === UID;

    const staffRef = db.doc(`businesses/${bid}/staff/${UID}`);
    const staffSnap = await staffRef.get();

    const updates: string[] = [];

    // 1. staffUserIds membership.
    if (!Array.isArray(biz.staffUserIds) || !biz.staffUserIds.includes(UID)) {
      await bizSnap.ref.update({ staffUserIds: FieldValue.arrayUnion(UID), updatedAt: now });
      updates.push('staffUserIds');
    }

    // 2. Owner role doc (only when this user owns the business).
    if (isOwner) {
      const roleRef = db.doc(`businesses/${bid}/roles/owner`);
      if (!(await roleRef.get()).exists) {
        await roleRef.set({ name: 'Owner', capabilities: ALL_CAPS, isSystem: true, createdAt: now, updatedAt: now });
        updates.push('roles/owner');
      }
    }

    // 3. The staff subdoc itself.
    if (!staffSnap.exists) {
      await staffRef.set({
        userId: UID,
        displayName,
        ...(email ? { email } : {}),
        ...(photoURL ? { photoURL } : {}),
        roleId: isOwner ? 'owner' : (biz.staffFallbackRoleId ?? 'owner'),
        capabilities: ALL_CAPS,
        active: true,
        joinedAt: now,
        invitedBy: UID,
      });
      updates.push('staff/{uid}');
    } else if (staffSnap.data()?.active !== true) {
      // Doc exists but inactive would still fail capability checks.
      await staffRef.update({ active: true, updatedAt: now });
      updates.push('staff.active=true');
    }

    if (updates.length) {
      repaired++;
      console.log(`  ✓ ${name} (${bid}) — wrote: ${updates.join(', ')}`);
    } else {
      alreadyOk++;
      console.log(`  · ${name} (${bid}) — already OK`);
    }
  }

  console.log(`\nDone. Repaired ${repaired}, already OK ${alreadyOk}.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('✗ Backfill failed:', err);
  process.exit(1);
});
