// ─── SummaryCard ──────────────────────────────────────────────────────────────
// Wraps a module's lazy summaryView with a header (icon, name, Open link) and a
// Suspense skeleton. Rendered once per unlocked + readable module on the Owner
// Dashboard.

import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import type { ModuleManifest } from '@/modules/types';

export function SummaryCard({ manifest }: { manifest: ModuleManifest }) {
  const Widget = manifest.summaryView?.component;
  if (!Widget) return null;
  const Icon = manifest.icon;
  const openTo = manifest.navItems?.[0]?.to;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="truncate text-sm font-semibold">{manifest.name}</CardTitle>
        </div>
        {openTo && (
          <Link to={openTo} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Open <ChevronRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <Widget />
        </Suspense>
      </CardContent>
    </Card>
  );
}
