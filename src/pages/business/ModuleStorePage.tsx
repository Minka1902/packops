// ─── Module Store ─────────────────────────────────────────────────────────────
// Owner-only. Unlock/lock modules; unlocking with unmet dependencies offers a
// transitive-closure "unlock together" dialog. Locking is blocked while other
// unlocked modules depend on it. Every change writes a moduleEvents audit entry.

import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { listContainer, listItem } from '@/lib/motion';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  ALL_MANIFESTS, MODULE_REGISTRY, missingDependencies, unlockClosure, dependentModules,
} from '@/modules/registry';
import { MODULE_CATEGORIES, type ModuleManifest } from '@/modules/types';
import type { ModuleId } from '@/modules/ids';
import { unlockModules, lockModule } from '@/lib/store';
import { ModuleCard } from '@/components/store/ModuleCard';

export default function ModuleStorePage() {
  const { activeBusiness, unlockedModules, isOwner, tenant, myStaff } = useBusiness();
  const location = useLocation();
  const reduced = useReducedMotion();
  const [busyId, setBusyId] = useState<ModuleId | null>(null);
  const [closure, setClosure] = useState<{ manifest: ModuleManifest; ids: ModuleId[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set by business registration and by the owner-dashboard redirect.
  const firstRun = (location.state as { firstRun?: boolean } | null)?.firstRun === true;
  const container = useMemo(() => listContainer(reduced), [reduced]);
  const item = useMemo(() => listItem(reduced), [reduced]);

  const unlockedSet = useMemo(() => new Set(unlockedModules), [unlockedModules]);
  const groups = useMemo(
    () => MODULE_CATEGORIES.map((cat) => ({
      category: cat,
      manifests: ALL_MANIFESTS.filter((m) => m.category === cat.id),
    })).filter((g) => g.manifests.length),
    [],
  );

  if (!isOwner) return <Navigate to="/business" replace />;

  const currency = activeBusiness?.currency ?? 'USD';
  const actor = { userId: myStaff?.userId ?? '', name: myStaff?.displayName ?? 'Owner' };

  const runUnlock = async (target: ModuleId, ids: ModuleId[]) => {
    if (!tenant || !activeBusiness) return;
    setBusyId(target); setError(null);
    try {
      await unlockModules(tenant, activeBusiness, actor, ids);
      setClosure(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock the module.');
    } finally {
      setBusyId(null);
    }
  };

  const onUnlock = (m: ModuleManifest) => {
    const missing = missingDependencies(m.id, unlockedModules);
    if (missing.length > 0) setClosure({ manifest: m, ids: unlockClosure(m.id, unlockedModules) });
    else void runUnlock(m.id, [m.id]);
  };

  const onLock = async (m: ModuleManifest) => {
    if (!tenant || !activeBusiness) return;
    setBusyId(m.id); setError(null);
    try {
      await lockModule(tenant, activeBusiness, actor, m.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock the module.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">Module Store</h1>
        <p className="text-sm text-muted-foreground">
          Unlock the tools your business needs. Everything is currently free.
        </p>
      </header>

      {firstRun && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Pick the tools your business needs</p>
            <p className="text-sm text-muted-foreground">
              Nothing is permanent — unlock what you need now and change it any time.
            </p>
          </div>
          <Link to="/business" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Skip for now
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {groups.map(({ category, manifests }) => (
        <section key={category.id} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{category.label}</h2>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          >
            {manifests.map((m) => (
              <motion.div key={m.id} variants={item} className="h-full">
                <ModuleCard
                  manifest={m}
                  unlocked={unlockedSet.has(m.id) || !m.lockable}
                  unlockedSet={unlockedSet}
                  dependents={dependentModules(m.id, unlockedModules)}
                  currency={currency}
                  busy={busyId === m.id}
                  onUnlock={onUnlock}
                  onLock={onLock}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      ))}

      {closure && (
        <Dialog open onOpenChange={(o) => !o && setClosure(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlock {closure.manifest.name}</DialogTitle>
              <DialogDescription>
                {closure.manifest.name} needs other modules. Unlock them together:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1.5">
              {closure.ids.map((id) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  {(() => { const I = MODULE_REGISTRY[id].icon; return <I className="size-4 text-muted-foreground" />; })()}
                  <span className="flex-1">{MODULE_REGISTRY[id].name}</span>
                  {id === closure.manifest.id && <span className="text-xs text-muted-foreground">selected</span>}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClosure(null)} disabled={busyId !== null}>Cancel</Button>
              <Button onClick={() => runUnlock(closure.manifest.id, closure.ids)} disabled={busyId !== null}>
                {busyId !== null && <Loader2 className="size-4 animate-spin" />}
                Unlock {closure.ids.length} together
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
