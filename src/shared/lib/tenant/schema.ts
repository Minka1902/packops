// ─── Tenant schema ────────────────────────────────────────────────────────────
// Central map of tenant collection name → document type + Firestore converter.
// Grows one line per migrated module. Every tenant read/write goes through a
// converter so documents arrive typed and with their id attached, and the id is
// stripped on write. See [[tenantDb]].

import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { TenantRole } from '@/modules/roles/types';
import type { StaffMember } from '@/modules/staff/types';
import type { ModuleEvent } from '@/modules/types';

// One entry per tenant collection. Add a line when a module migrates.
export interface TenantSchema {
  roles: TenantRole;
  staff: StaffMember;
  moduleEvents: ModuleEvent;
}

export type TenantCollection = keyof TenantSchema;

// Attaches the doc id on read; strips it on write (Firestore stores the id in
// the path, never the body).
function idConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (model) => {
      const rest = { ...(model as Record<string, unknown>) };
      delete rest.id;
      return rest;
    },
    fromFirestore: (snap: QueryDocumentSnapshot) =>
      ({ id: snap.id, ...snap.data() }) as T,
  };
}

export const TENANT_CONVERTERS: {
  [K in TenantCollection]: FirestoreDataConverter<TenantSchema[K]>;
} = {
  roles: idConverter<TenantRole>(),
  staff: idConverter<StaffMember>(),
  moduleEvents: idConverter<ModuleEvent>(),
};
