import { X, Building2, Crown } from 'lucide-react';
import RoleBadge from './RoleBadge';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { BUSINESS_TYPES, type DogHuman } from '@/shared/types';

interface Props {
  human: DogHuman;
  canRevoke?: boolean;
  onRevoke?: (userId: string) => void;
  /** The dog's main human. Gets an Owner badge and can never be removed. */
  isOwner?: boolean;
  /** Appends "(you)" so the signed-in user can find themselves in the list. */
  isSelf?: boolean;
}

const BIZ_TYPE_LABELS = Object.fromEntries(BUSINESS_TYPES.map(t => [t.type, t.label]));

export default function HumanCard({ human, canRevoke, onRevoke, isOwner, isSelf }: Props) {
  const subtitle = human.isBusiness
    ? (human.businessType ? `${BIZ_TYPE_LABELS[human.businessType] ?? 'Business'} · Business` : 'Business')
    : human.email;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 group',
        isOwner && 'border-primary/30 bg-primary/[0.03]',
      )}
    >
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
        {human.isBusiness
          ? <Building2 className="h-4 w-4" />
          : isOwner
            ? <Crown className="h-4 w-4" />
            : human.displayName.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate capitalize">
          {human.displayName}
          {isSelf && <span className="ml-1.5 font-normal normal-case text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      {isOwner
        ? <Badge className="gap-1 shrink-0"><Crown className="h-3 w-3" /> Owner</Badge>
        : <RoleBadge role={human.role} />}
      {/* The owner can never be revoked — removing them would orphan the dog. */}
      {!isOwner && canRevoke && onRevoke && (
        <button
          onClick={() => onRevoke(human.userId)}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${human.displayName}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
