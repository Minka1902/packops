// ─── useTenantCollection ──────────────────────────────────────────────────────
// Realtime, typed successor of useCollection in useBusiness.ts. Documents arrive
// already typed + id-bearing via the schema converter. Callers pass bounded
// constraints (where/orderBy/limit) — modules must never open unbounded
// subscriptions on large collections.

import { useEffect, useState } from 'react';
import { onSnapshot, query, type QueryConstraint } from 'firebase/firestore';
import type { TenantDb } from './tenantDb';
import type { TenantCollection, TenantSchema } from './schema';

export function useTenantCollection<K extends TenantCollection>(
  tenant: TenantDb | null,
  name: K,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
): { items: TenantSchema[K][]; loading: boolean } {
  const [items, setItems] = useState<TenantSchema[K][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) {
      setItems([]);
      setLoading(false);
      return;
    }
    const col = tenant.col(name);
    const q = constraints.length ? query(col, ...constraints) : col;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, name, ...deps]);

  return { items, loading };
}
