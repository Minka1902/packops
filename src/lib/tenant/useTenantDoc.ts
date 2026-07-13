// ─── useTenantDoc ─────────────────────────────────────────────────────────────
// Realtime single-document subscription, typed via the schema converter.

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { TenantDb } from './tenantDb';
import type { TenantCollection, TenantSchema } from './schema';

export function useTenantDoc<K extends TenantCollection>(
  tenant: TenantDb | null,
  name: K,
  id: string | null | undefined,
): { item: TenantSchema[K] | null; loading: boolean } {
  const [item, setItem] = useState<TenantSchema[K] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !id) {
      setItem(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      tenant.doc(name, id),
      (snap) => {
        setItem(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [tenant?.id, name, id]);

  return { item, loading };
}
