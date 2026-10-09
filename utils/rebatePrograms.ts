import { ALL_REBATE_MAGNE_PHOSPHA_ALLOWED_PROGRAMS } from '../constants';

/** Chuẩn hóa PromotionID#program từ sheet REBATE (trim, gộp khoảng trắng, upper-case). */
export function normalizeRebateProgramId(id: string): string {
  return String(id ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

const ALLOWLIST_NORMALIZED = new Set(
  ALL_REBATE_MAGNE_PHOSPHA_ALLOWED_PROGRAMS.map(normalizeRebateProgramId)
);

export function isAllRebateMagnePhosphaAllowed(programId: string): boolean {
  return ALLOWLIST_NORMALIZED.has(normalizeRebateProgramId(programId));
}
