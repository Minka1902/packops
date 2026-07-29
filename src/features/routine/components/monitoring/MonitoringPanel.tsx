import WalkStatsChart from './WalkStatsChart';
import FeedingLogChart from './FeedingLogChart';
import TrainingProgressChart from './TrainingProgressChart';
import type { RoutineLog } from '@/shared/types';
import type { TrainingSession } from '@/shared/types';

interface Props {
  logs: RoutineLog[];
  sessions: TrainingSession[];
  dogName: string;
}

export default function MonitoringPanel({ logs, sessions, dogName }: Props) {
  return (
    <aside className="space-y-5">
      <div>
        <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Insights
        </h2>
        <p className="text-xs text-muted-foreground capitalize">{dogName}</p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-4">
        <WalkStatsChart logs={logs} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-4">
        <FeedingLogChart logs={logs} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-4">
        <TrainingProgressChart sessions={sessions} />
      </div>
    </aside>
  );
}
