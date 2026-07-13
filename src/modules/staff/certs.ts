// ─── Certification status helpers (pure) ──────────────────────────────────────

import type { StaffCertification } from './types';
import type { StaffMember } from './types';

export const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CertStatus = 'none' | 'valid' | 'expiring' | 'expired';

export function certStatus(cert: StaffCertification, now = Date.now()): CertStatus {
  if (!cert.expiresAt) return 'none';
  if (cert.expiresAt < now) return 'expired';
  if (cert.expiresAt - now <= EXPIRING_WINDOW_MS) return 'expiring';
  return 'valid';
}

// How many of a member's certifications are expiring soon or already expired.
export function expiringCertCount(member: Pick<StaffMember, 'certifications'>, now = Date.now()): number {
  return (member.certifications ?? []).filter((c) => {
    const s = certStatus(c, now);
    return s === 'expiring' || s === 'expired';
  }).length;
}

export function activeHeadcount(staff: Pick<StaffMember, 'active'>[]): number {
  return staff.filter((s) => s.active).length;
}
