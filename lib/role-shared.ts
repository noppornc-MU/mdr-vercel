// Role constants/helpers that are safe for client AND server code (no next/headers).
// Server code: use getRole() from '@/lib/role'. Client code: import from '@/lib/role-shared'.

export type Role = 'ICN' | 'DOCTOR' | 'EXECUTIVE';

export const ROLES: Role[] = ['ICN', 'DOCTOR', 'EXECUTIVE'];
export const ROLE_COOKIE = 'demo_role';
export const DEFAULT_ROLE: Role = 'ICN';

export const ROLE_LABELS: Record<Role, string> = {
  ICN: 'ICN (พยาบาลควบคุมการติดเชื้อ)',
  DOCTOR: 'แพทย์/เภสัชกร',
  EXECUTIVE: 'ผู้บริหาร',
};

export function parseRole(value: string | null | undefined): Role {
  return value === 'ICN' || value === 'DOCTOR' || value === 'EXECUTIVE' ? value : DEFAULT_ROLE;
}

/** Only ICN can approve / delete isolates. */
export const canApprove = (role: Role): boolean => role === 'ICN';
export const canDelete = (role: Role): boolean => role === 'ICN';
/** EXECUTIVE never receives HN (stripped at the API layer). */
export const canSeeHn = (role: Role): boolean => role !== 'EXECUTIVE';
/** AI Consult from an isolate is for DOCTOR / ICN. */
export const canConsult = (role: Role): boolean => role === 'ICN' || role === 'DOCTOR';
/** Data entry (upload / key in) is for ICN. */
export const canEnter = (role: Role): boolean => role === 'ICN';
