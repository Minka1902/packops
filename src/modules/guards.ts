// ─── Module mutation guards ───────────────────────────────────────────────────
// Called at the top of every module mutation (in each module's data.ts) so a
// denied write fails fast client-side with a typed error, mirroring the
// firestore.rules that ultimately enforce it. Pure — no Firestore, no React.

import { isModuleUnlocked, type EffectivePerms } from './permissions';
import type { ModuleId, PermissionLevel } from './ids';

export class ModuleLockedError extends Error {
  constructor(public readonly moduleId: ModuleId) {
    super(`Module '${moduleId}' is locked — unlock it in the Module Store.`);
    this.name = 'ModuleLockedError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(public readonly moduleId: ModuleId, public readonly level: PermissionLevel) {
    super(`You don't have '${moduleId}.${level}' permission.`);
    this.name = 'PermissionDeniedError';
  }
}

export function assertModule(unlockedModules: readonly ModuleId[], moduleId: ModuleId): void {
  if (!isModuleUnlocked(moduleId, unlockedModules)) throw new ModuleLockedError(moduleId);
}

export function assertPermission(perms: EffectivePerms, moduleId: ModuleId, level: PermissionLevel): void {
  if (!perms.has(moduleId, level)) throw new PermissionDeniedError(moduleId, level);
}
