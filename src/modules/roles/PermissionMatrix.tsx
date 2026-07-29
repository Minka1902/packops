// ─── PermissionMatrix ─────────────────────────────────────────────────────────
// Shared editor for module → read/write/action grants. Used by the role editor
// (mode 'role') and the staff overrides panel (mode 'override', which adds
// Inherit and Revoke states on top of the role default). Locked modules are
// greyed and read-only. Levels auto-expand (choosing Write implies Read).
// Responsive: a labelled row per module that reflows to stacked on narrow
// screens; grouped by category.

import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { ALL_MANIFESTS } from '../registry';
import { MODULE_CATEGORIES } from '../types';
import { isModuleUnlocked, levelsFor, strongestLevel, type Grants } from '../permissions';
import type { ModuleId, PermissionLevel } from '../ids';

type Choice = 'none' | 'inherit' | 'revoke' | PermissionLevel;

interface Props {
  value: Grants;
  onChange: (next: Grants) => void;
  unlockedModules: ModuleId[];
  mode?: 'role' | 'override';
  /** Override mode: the role defaults, shown as the "inherited" hint. */
  roleGrants?: Grants;
  disabled?: boolean;
}

const LEVEL_LABEL: Record<PermissionLevel, string> = { read: 'Read', write: 'Write', action: 'Action' };

function currentChoice(value: Grants, mode: 'role' | 'override', id: ModuleId): Choice {
  const present = Object.prototype.hasOwnProperty.call(value, id);
  if (mode === 'override' && !present) return 'inherit';
  const levels = value[id] ?? [];
  if (levels.length === 0) return mode === 'override' ? 'revoke' : 'none';
  return strongestLevel(levels) as PermissionLevel;
}

export default function PermissionMatrix({
  value, onChange, unlockedModules, mode = 'role', roleGrants, disabled,
}: Props) {
  const groups = useMemo(
    () => MODULE_CATEGORIES.map((cat) => ({
      category: cat,
      manifests: ALL_MANIFESTS.filter((m) => m.category === cat.id),
    })).filter((g) => g.manifests.length),
    [],
  );

  const choices: { key: Choice; label: string }[] = mode === 'override'
    ? [{ key: 'inherit', label: 'Inherit' }, { key: 'read', label: 'R' }, { key: 'write', label: 'W' }, { key: 'action', label: 'A' }, { key: 'revoke', label: 'None' }]
    : [{ key: 'none', label: '—' }, { key: 'read', label: 'R' }, { key: 'write', label: 'W' }, { key: 'action', label: 'A' }];

  const setChoice = (id: ModuleId, choice: Choice) => {
    if (disabled) return;
    const next: Grants = { ...value };
    if (choice === 'inherit') delete next[id];
    else if (choice === 'none') delete next[id];
    else if (choice === 'revoke') next[id] = [];
    else next[id] = levelsFor(choice);
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {groups.map(({ category, manifests }) => (
        <section key={category.id} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{category.label}</p>
          <div className="divide-y rounded-xl border">
            {manifests.map((m) => {
              const locked = !isModuleUnlocked(m.id, unlockedModules);
              const choice = currentChoice(value, mode, m.id);
              const inherited = mode === 'override' ? strongestLevel(roleGrants?.[m.id] ?? []) : null;
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                    locked && 'opacity-50',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      {locked
                        ? <p className="text-xs text-muted-foreground">Inactive while locked</p>
                        : mode === 'override' && inherited
                          ? <p className="text-xs text-muted-foreground">Role default: {LEVEL_LABEL[inherited]}</p>
                          : null}
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 self-start overflow-hidden rounded-lg border sm:self-auto" role="group" aria-label={`${m.name} permission`}>
                    {choices.map((c) => {
                      const active = choice === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={disabled || locked}
                          aria-pressed={active}
                          title={typeof c.key === 'string' && (c.key in LEVEL_LABEL) ? m.abilities?.[c.key as PermissionLevel] : undefined}
                          onClick={() => setChoice(m.id, c.key)}
                          className={cn(
                            'min-w-9 border-l px-2.5 py-1 text-xs font-medium first:border-l-0 transition-colors',
                            'disabled:cursor-not-allowed',
                            active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
