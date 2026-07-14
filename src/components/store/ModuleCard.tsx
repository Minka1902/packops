// ─── ModuleCard ───────────────────────────────────────────────────────────────

import { Lock, Unlock, Loader2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MODULE_REGISTRY } from '@/modules/registry';
import type { ModuleManifest } from '@/modules/types';
import type { ModuleId } from '@/modules/ids';
import { PresentRibbon } from './PresentRibbon';
import { DependencyBadges } from './DependencyBadges';

export function ModuleCard({
  manifest, unlocked, unlockedSet, dependents, currency, busy, onUnlock, onLock,
}: {
  manifest: ModuleManifest;
  unlocked: boolean;
  unlockedSet: Set<ModuleId>;
  dependents: ModuleId[];
  currency: string;
  busy: boolean;
  onUnlock: (m: ModuleManifest) => void;
  onLock: (m: ModuleManifest) => void;
}) {
  const Icon = manifest.icon;
  const lockBlocked = dependents.length > 0;

  return (
    <Card className={unlocked ? 'border-primary/30' : undefined}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{manifest.name}</p>
              {!manifest.lockable && <Badge variant="secondary" className="mt-0.5">Core</Badge>}
            </div>
          </div>
          {unlocked && (
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" /> Active
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{manifest.description}</p>

        <DependencyBadges dependencies={manifest.dependencies} unlockedSet={unlockedSet} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <PresentRibbon priceCents={manifest.priceCents} currency={currency} />
          {manifest.lockable && (
            unlocked ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || lockBlocked}
                title={lockBlocked ? `Used by ${dependents.map((d) => MODULE_REGISTRY[d].name).join(', ')}` : undefined}
                onClick={() => onLock(manifest)}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Lock
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => onUnlock(manifest)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />} Unlock
              </Button>
            )
          )}
        </div>
        {manifest.lockable && unlocked && lockBlocked && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Locked in by {dependents.map((d) => MODULE_REGISTRY[d].name).join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
