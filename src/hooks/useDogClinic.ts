import { useEffect, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { businessDirectoryCol } from '@/lib/firestore';
import { useHumans } from '@/hooks/useHumans';
import type { BusinessDirectoryEntry } from '@/types';

/**
 * The veterinary clinics on a dog's care team.
 *
 * A business joins a dog's team as a synthetic `biz_<businessId>` row in the
 * dog's `humans` subcollection (see useHumans.addBusinessToTeam), which carries
 * only the name and type. The contactable detail — phone, address, opening
 * hours — lives in the openly-readable `businessDirectory` projection, so each
 * vet on the team is resolved through there.
 *
 * Usually one clinic; returns a list because nothing stops a dog having a
 * regular vet and a specialist.
 */
export function useDogClinics(dogId: string) {
  const { humans, loading: humansLoading } = useHumans(dogId);
  // Keyed by the id set it was fetched for, so a changed team is handled by
  // deriving staleness rather than clearing state inside the effect.
  const [fetched, setFetched] = useState<{ key: string; entries: BusinessDirectoryEntry[] } | null>(null);

  const vetIds = humans
    .filter(h => h.isBusiness && h.businessType === 'vet' && h.businessId)
    .map(h => h.businessId!);
  // Stable primitive so the effect doesn't re-run on every humans snapshot.
  const vetKey = vetIds.join(',');

  useEffect(() => {
    if (!vetKey) return;
    let cancelled = false;
    Promise.all(vetKey.split(',').map(id =>
      getDoc(doc(businessDirectoryCol(), id))
        .then(s => (s.exists() ? ({ id: s.id, ...s.data() } as BusinessDirectoryEntry) : null))
        .catch(() => null),
    )).then(list => {
      if (cancelled) return;
      setFetched({ key: vetKey, entries: list.filter((e): e is BusinessDirectoryEntry => e !== null) });
    });
    return () => { cancelled = true; };
  }, [vetKey]);

  const current = fetched && fetched.key === vetKey ? fetched.entries : null;

  return {
    clinics: vetKey ? (current ?? []) : [],
    loading: humansLoading || (!!vetKey && current === null),
    hasVetOnTeam: vetIds.length > 0,
  };
}
