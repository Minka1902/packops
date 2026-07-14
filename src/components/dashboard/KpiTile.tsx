// ─── KpiTile ──────────────────────────────────────────────────────────────────
// Small stat tile shared across the Owner Dashboard and module summaryViews.

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function KpiTile({
  icon: Icon, label, value, tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: 'default' | 'warn';
}) {
  const warn = tone === 'warn';
  return (
    <div className="rounded-lg border p-2.5">
      <Icon className={cn('size-4', warn ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground')} />
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', warn && 'text-amber-600 dark:text-amber-500')}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
