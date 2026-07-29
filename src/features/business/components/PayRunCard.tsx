import { Check, DollarSign, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { PayRun } from '@/shared/types';

interface Props {
  run: PayRun;
  currency: string;
  isOwner: boolean;
  canManage: boolean;
  onApprove: () => void;
  onMarkPaid: () => void;
  onRecompute: () => void;
  onDelete: () => void;
}

const STATUS_VARIANT = {
  draft: 'outline',
  approved: 'secondary',
  paid: 'secondary',
} as const;

export default function PayRunCard({ run, currency, isOwner, canManage, onApprove, onMarkPaid, onRecompute, onDelete }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {run.periodStart} → {run.periodEnd}
          <Badge className="ml-2 align-middle" variant={STATUS_VARIANT[run.status]}>
            {run.status === 'draft' ? 'Draft' : run.status === 'approved' ? 'Approved' : 'Paid'}
          </Badge>
        </CardTitle>
        <span className="text-sm font-semibold tabular-nums">{run.total.toFixed(2)} {currency}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payable staff in this period.</p>
        ) : (
          <ul className="divide-y text-sm">
            {run.lines.map(l => (
              <li key={l.staffUserId} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate">
                  {l.staffName}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {l.payType === 'hourly' ? `${l.hours ?? 0}h × ${(l.rate ?? 0).toFixed(2)}` : 'salary'}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{l.amount.toFixed(2)} {currency}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {run.status === 'draft' && canManage && (
            <Button size="sm" variant="outline" className="gap-1" onClick={onRecompute}>
              <RefreshCw className="h-3.5 w-3.5" /> Recompute
            </Button>
          )}
          {/* Owner-only sign-off. */}
          {run.status === 'draft' && isOwner && (
            <Button size="sm" className="gap-1" onClick={onApprove}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {run.status === 'approved' && isOwner && (
            <Button size="sm" className="gap-1" onClick={onMarkPaid}>
              <DollarSign className="h-3.5 w-3.5" /> Mark paid
            </Button>
          )}
          {run.status === 'draft' && canManage && (
            <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          {run.status === 'paid' && run.paidAt && (
            <span className="self-center text-xs text-muted-foreground">
              Paid {new Date(run.paidAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
