// ─── Module React helpers ─────────────────────────────────────────────────────
// Permission-aware building blocks for module UI. These read the active
// business via useTenant() (from BusinessContext) — NOT @/features/business/hooks/useBusiness, so
// the modules ESLint boundary is respected.

import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useTenant } from '@/shared/contexts/BusinessContext';
import { buttonVariants } from '@/shared/ui/button';
import { isModuleUnlocked } from './permissions';
import { getManifest } from './registry';
import type { ModuleId, PermissionLevel } from './ids';

export function usePermission(moduleId: ModuleId) {
  const { perms } = useTenant();
  return {
    can: (level: PermissionLevel) => perms.has(moduleId, level),
    levels: () => perms.levels(moduleId),
    isOwner: perms.isOwner,
  };
}

export function Can({
  moduleId, level, fallback = null, children,
}: {
  moduleId: ModuleId;
  level: PermissionLevel;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { perms } = useTenant();
  return <>{perms.has(moduleId, level) ? children : fallback}</>;
}

function CenteredNotice({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

// Layout route: renders the module's screens only when it is unlocked and the
// viewer can read it; otherwise a locked / denied screen.
export function ModuleGate({ moduleId }: { moduleId: ModuleId }) {
  const { unlockedModules, perms } = useTenant();
  const manifest = getManifest(moduleId);

  if (!isModuleUnlocked(moduleId, unlockedModules)) {
    return (
      <CenteredNotice icon={<Lock className="size-5" />} title={`${manifest.name} is locked`}>
        <p className="max-w-sm text-sm text-muted-foreground">
          This module isn’t active for your business yet.
        </p>
        <Link to="/business/store" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          Open Module Store
        </Link>
      </CenteredNotice>
    );
  }
  if (!perms.has(moduleId, 'read')) {
    return (
      <CenteredNotice icon={<Lock className="size-5" />} title="No access">
        <p className="max-w-sm text-sm text-muted-foreground">
          You don’t have permission to view {manifest.name}. Ask an owner or manager for access.
        </p>
      </CenteredNotice>
    );
  }
  return <Outlet />;
}
