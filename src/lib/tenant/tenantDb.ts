// ─── TenantDb ─────────────────────────────────────────────────────────────────
// The ONLY door to a single tenant's data. Paths are assembled internally as
// businesses/{tenantId}/{collection}, so module code can never express a
// cross-tenant query (firestore.rules remain the real guarantee). Every ref is
// pre-bound to its converter from the schema, so reads/writes are typed.

import {
  collection, doc, writeBatch, runTransaction as fbRunTransaction,
  type CollectionReference, type DocumentReference, type Transaction, type WriteBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { businessesCol, businessDirectoryCol } from '@/lib/firestore';
import { TENANT_CONVERTERS, type TenantCollection, type TenantSchema } from './schema';

export interface TenantDb {
  readonly id: string;
  col<K extends TenantCollection>(name: K): CollectionReference<TenantSchema[K]>;
  doc<K extends TenantCollection>(name: K, id: string): DocumentReference<TenantSchema[K]>;
  batch(): WriteBatch;
  runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** The business doc itself (businesses/{id}) — e.g. to update staffUserIds. */
  businessDoc(): DocumentReference<DocumentData>;
  /** The public directory projection doc for this tenant (businessDirectory/{id}). */
  directoryDoc(): DocumentReference<DocumentData>;
}

export function tenantDb(tenantId: string): TenantDb {
  const seg = ['businesses', tenantId] as const;
  return {
    id: tenantId,
    col: <K extends TenantCollection>(name: K) =>
      collection(db, ...seg, name).withConverter(TENANT_CONVERTERS[name]),
    doc: <K extends TenantCollection>(name: K, id: string) =>
      doc(db, ...seg, name, id).withConverter(TENANT_CONVERTERS[name]),
    batch: () => writeBatch(db),
    runTransaction: (fn) => fbRunTransaction(db, fn),
    businessDoc: () => doc(businessesCol(), tenantId),
    directoryDoc: () => doc(businessDirectoryCol(), tenantId),
  };
}
