import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientFacingModuleStatuses, type Business } from '@/types';

interface Props {
  business: Business;
}

// "Live for customers" surface: which client-facing modules are live versus still
// need the owner to finish setup before clients can use them.
export default function ModuleSetupStatusCard({ business }: Props) {
  const statuses = clientFacingModuleStatuses(business).filter(s => s.enabled);
  if (statuses.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Live for customers</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Client-facing features only appear to customers once you've finished setting them up.
        </p>
        <div className="divide-y rounded-lg border">
          {statuses.map(s => (
            <div key={s.module} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">{s.label}</p>
              {s.live ? (
                <Badge variant="secondary">Live</Badge>
              ) : s.needsSetup ? (
                <Badge variant="outline" className="border-amber-500 text-amber-600">Needs setup</Badge>
              ) : (
                <Badge variant="outline">Off</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
