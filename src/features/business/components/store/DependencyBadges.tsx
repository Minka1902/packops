// ─── DependencyBadges ─────────────────────────────────────────────────────────
// A module's direct dependencies, green when unlocked, amber when still missing.

import { Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { MODULE_REGISTRY } from '@/modules/registry';
import type { ModuleId } from '@/modules/ids';

export function DependencyBadges({
  dependencies, unlockedSet,
}: {
  dependencies: ModuleId[];
  unlockedSet: Set<ModuleId>;
}) {
  if (dependencies.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Needs</span>
      {dependencies.map((dep) => {
        const ok = unlockedSet.has(dep);
        return (
          <span
            key={dep}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
              ok
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 text-amber-600 dark:text-amber-500',
            )}
          >
            {ok ? <Check className="size-3" /> : <X className="size-3" />}
            {MODULE_REGISTRY[dep].name}
          </span>
        );
      })}
    </div>
  );
}
