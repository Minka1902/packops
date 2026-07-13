import { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from 'react';
import { query, where, onSnapshot, doc } from 'firebase/firestore';
import { businessesCol, bizStaffCol } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useSessionMode } from '@/contexts/SessionModeContext';
import { tenantDb, type TenantDb } from '@/lib/tenant/tenantDb';
import { migrateTenantToV2 } from '@/lib/tenant/migrate';
import { makeEffectivePerms, type EffectivePerms } from '@/modules/permissions';
import { resolveUnlockedModules, permsFromCapabilities } from '@/modules/legacy';
import type { ModuleId } from '@/modules/ids';
import type { StaffMember } from '@/modules/staff/types';
import type { Business } from '@/types';

const ACTIVE_BIZ_KEY = 'packops_active_business_id';

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  setActiveBusiness: (biz: Business) => void;
  /** The current user's staff record for the active business (owner included). */
  myStaff: StaffMember | null;
  isOwner: boolean;
  loading: boolean;
  /** The tenant data facade for the active business (null when none active). */
  tenant: TenantDb | null;
  /** Modules unlocked for the active business (core modules always included). */
  unlockedModules: ModuleId[];
  /** Module-scoped read/write/action gate mirroring firestore.rules. */
  perms: EffectivePerms;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

// A perms gate that denies everything — used before a business is active.
const DENY_ALL: EffectivePerms = makeEffectivePerms({
  isOwner: false, active: false, tokens: [], unlockedModules: [],
});

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { mode } = useSessionMode();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<Business | null>(null);
  const [myStaff, setMyStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Only open listeners while operating in business mode.
  useEffect(() => {
    if (!user || mode !== 'business') {
      setBusinesses([]);
      setActiveBusinessState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const storedId = localStorage.getItem(ACTIVE_BIZ_KEY);
    const unsub = onSnapshot(
      query(businessesCol(), where('staffUserIds', 'array-contains', user.uid)),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Business));
        setBusinesses(list);
        setActiveBusinessState(prev => {
          if (prev && list.find(b => b.id === prev.id)) return list.find(b => b.id === prev.id)!;
          return list.find(b => b.id === storedId) ?? list[0] ?? null;
        });
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [user, mode]);

  // Track the current user's staff doc (perms + capability mirror) for the
  // active business.
  useEffect(() => {
    if (!user || !activeBusiness) {
      setMyStaff(null);
      return;
    }
    const unsub = onSnapshot(
      doc(bizStaffCol(activeBusiness.id), user.uid),
      snap => setMyStaff(snap.exists() ? ({ id: snap.id, ...snap.data() } as StaffMember) : null),
      () => setMyStaff(null),
    );
    return () => unsub();
  }, [user, activeBusiness]);

  const setActiveBusiness = useCallback((biz: Business) => {
    setActiveBusinessState(biz);
    localStorage.setItem(ACTIVE_BIZ_KEY, biz.id);
  }, []);

  const isOwner = !!user && !!activeBusiness && activeBusiness.ownerUserId === user.uid;

  // Lazy, owner-triggered, once-per-business migration to the v2 module model.
  // Idempotent (the write flips unlockedModules from undefined, which re-latches
  // this guard); the onSnapshot listener above then re-delivers the migrated doc.
  const migratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOwner || !activeBusiness) return;
    if (activeBusiness.unlockedModules !== undefined) return;
    if (migratedRef.current === activeBusiness.id) return;
    migratedRef.current = activeBusiness.id;
    void migrateTenantToV2(activeBusiness).catch(() => { migratedRef.current = null; });
  }, [isOwner, activeBusiness]);

  const tenant = useMemo(
    () => (activeBusiness ? tenantDb(activeBusiness.id) : null),
    [activeBusiness],
  );

  const unlockedModules = useMemo(
    () => resolveUnlockedModules(activeBusiness),
    [activeBusiness],
  );

  // Prefer the denormalized v2 snapshot; fall back to capability-derived tokens
  // for staff docs that haven't been migrated yet (see migrateTenantToV2).
  const perms = useMemo<EffectivePerms>(() => {
    if (!activeBusiness) return DENY_ALL;
    const tokens = myStaff?.perms ?? permsFromCapabilities(myStaff?.capabilities ?? []);
    return makeEffectivePerms({
      isOwner,
      active: isOwner || (myStaff?.active ?? false),
      tokens,
      unlockedModules,
    });
  }, [activeBusiness, myStaff, isOwner, unlockedModules]);

  const value = useMemo(
    () => ({
      businesses, activeBusiness, setActiveBusiness, myStaff, isOwner, loading,
      tenant, unlockedModules, perms,
    }),
    [businesses, activeBusiness, setActiveBusiness, myStaff, isOwner, loading, tenant, unlockedModules, perms],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}

// Convenience accessor for module code: the tenant facade + perms gate together.
export function useTenant() {
  const { tenant, perms, unlockedModules, activeBusiness, myStaff, isOwner } = useBusiness();
  return { tenant, perms, unlockedModules, business: activeBusiness, myStaff, isOwner };
}
