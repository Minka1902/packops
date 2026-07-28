// ─── Owner Dashboard ──────────────────────────────────────────────────────────
// The business home (/business). Aggregates every unlocked module's summaryView
// the viewer can read, above an alerts strip. Responsive grid 1/2/3/4 columns.

import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, LayoutGrid, Store } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useBusiness } from '@/contexts/BusinessContext';
import { ALL_MANIFESTS } from '@/modules/registry';
import { isModuleUnlocked } from '@/modules/permissions';
import { isCoreModule } from '@/modules/ids';
import { AlertsStrip } from '@/components/dashboard/AlertsStrip';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { clientFacingModuleStatuses } from '@/types';

export default function OwnerDashboardPage() {
  const { activeBusiness, unlockedModules, perms, isOwner, loading, loadError } = useBusiness();

  const cards = ALL_MANIFESTS.filter(
    (m) => m.summaryView && isModuleUnlocked(m.id, unlockedModules) && perms.has(m.id, 'read'),
  );

  // Carried over from the dashboard this page replaced: client-facing modules
  // can be enabled but not yet configured, in which case customers still can't
  // see them. Surfacing that here is the only warning an owner gets.
  const needsSetup = clientFacingModuleStatuses(activeBusiness).filter((s) => s.needsSetup);

  // A business whose unlock set is nothing but the core modules has never been
  // through the store. Send the owner there once — the moment anything is
  // unlocked this stops firing, so a configured business always lands here.
  // Guarded on `loading`/`activeBusiness` so it can't race the context's first
  // snapshot and bounce an owner who does have modules.
  const unconfigured = unlockedModules.every(isCoreModule);
  if (!loading && activeBusiness && isOwner && unconfigured) {
    return <Navigate to="/business/store" replace state={{ firstRun: true }} />;
  }

  // A failed listener leaves activeBusiness null, which would otherwise render
  // as "no modules yet" and read like empty data rather than a broken load.
  if (loadError) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <p className="font-medium">{loadError}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your businesses could not be loaded, so nothing on this screen is up to date.
          Check your connection and reload; if it persists the Firestore rules may need redeploying.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{activeBusiness?.name ?? 'Dashboard'}</h1>
          <p className="text-sm text-muted-foreground">Your business at a glance</p>
        </div>
        {isOwner && (
          <Link to="/business/store" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Store className="size-4" /> Module Store
          </Link>
        )}
      </header>

      {isOwner && needsSetup.length > 0 && (
        <Link
          to="/business/settings"
          className="flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-50 p-4 text-sm transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <span>
            <span className="font-medium">Finish setup to go live.</span>{' '}
            {needsSetup.map((s) => s.label).join(', ')} {needsSetup.length === 1 ? 'is' : 'are'} enabled
            but not yet available to customers. Configure in Settings.
          </span>
        </Link>
      )}

      <AlertsStrip />

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LayoutGrid className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {isOwner ? 'Unlock modules to see their summaries here.' : 'No modules you can view yet.'}
          </p>
          {isOwner && (
            <Link to="/business/store" className={buttonVariants({ size: 'sm' })}>Open Module Store</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((m) => <SummaryCard key={m.id} manifest={m} />)}
        </div>
      )}
    </div>
  );
}
