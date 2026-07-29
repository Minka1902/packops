// ─── PresentRibbon ────────────────────────────────────────────────────────────
// Shows a module's real price with a "gift" ribbon indicating every module is
// currently free. The price stays visible on purpose.

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function PresentRibbon({ priceCents, currency }: { priceCents: number; currency: string }) {
  if (priceCents === 0) {
    return <span className="text-xs font-medium text-muted-foreground">Included</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        🎁 Currently free
      </span>
      <span className="text-xs text-muted-foreground">
        normally <span className="font-medium text-foreground">{formatCents(priceCents, currency)}</span>/mo
      </span>
    </div>
  );
}
