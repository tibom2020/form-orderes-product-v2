import type { CartItem, Rebate } from '../types';
import {
  ACEMUC_GROUP_IDS,
  OSTELIN_GROUP_IDS,
  REBATE_FEE_EXCLUDED_PRODUCT_IDS,
  TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';
import { isAllRebateMagnePhosphaAllowed } from './rebatePrograms';

/** Trần CK tổng trên basePrice từng dòng (đơn thường) */
export const MAX_PRODUCT_DISCOUNT_RATIO_STANDARD = 0.5;

/** CK PS 25% + trả phí: không vượt 49% / sản phẩm (basePrice × SL) */
export const MAX_PRODUCT_DISCOUNT_RATIO = 0.49;

export interface CartGroupTotals {
  telfastGroupTotal: number;
  ostelinGroupBaseTotal: number;
  acemucGroupBaseTotal: number;
}

export function computeCartGroupTotals(items: CartItem[]): CartGroupTotals {
  const telfastGroupTotal = items
    .filter(item => TELFAST_GROUP_IDS.includes(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const ostelinGroupBaseTotal = items
    .filter(item => OSTELIN_GROUP_IDS.includes(item.id))
    .reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);

  const acemucGroupBaseTotal = items
    .filter(item => ACEMUC_GROUP_IDS.includes(item.id))
    .reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);

  return { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal };
}

export interface LinePayableFeeCap {
  itemId: number;
  type: CartItem['type'];
  basePriceLine: number;
  monthlyDiscountPercent: number;
  monthlyDiscountAmount: number;
  psLineDiscount: number;
  maxPayableFeeLine: number;
}

export interface MaxPayableFeesResult {
  totalMaxPayableFeeLocal: number;
  totalMaxPayableFeeImport: number;
  lines: LinePayableFeeCap[];
}

export interface ComputeMaxPayableFeesOptions {
  /** Tổng giảm Gross CK PS On Invoice — phân bổ theo tỷ lệ basePrice từng dòng */
  psDiscountGross?: number;
  maxDiscountRatio?: number;
  /** CK PS: đơn không áp CK tháng — chỉ trừ CK PS khỏi trần (vd. 49%) */
  excludeMonthlyFromCap?: boolean;
  /** SP không cộng vào trần trả phí (mặc định Magne + Phospha) */
  excludeProductIdsFromCap?: readonly number[];
}

/**
 * Phí Local/Import tối đa còn được trả sau CK tháng và (nếu có) CK PS phân bổ theo basePrice dòng.
 */
export function computeMaxPayableFees(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  options?: ComputeMaxPayableFeesOptions
): MaxPayableFeesResult {
  const { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal } = groupTotals;
  const ratio = options?.maxDiscountRatio ?? MAX_PRODUCT_DISCOUNT_RATIO_STANDARD;
  const psDiscountGross = Math.max(0, options?.psDiscountGross ?? 0);
  const excludeFromCap = new Set(
    options?.excludeProductIdsFromCap ?? REBATE_FEE_EXCLUDED_PRODUCT_IDS
  );

  const baseSubtotal = items.reduce(
    (s, item) => s + (item.basePrice ?? item.price) * item.quantity,
    0
  );
  const psRatio = psDiscountGross > 0 && baseSubtotal > 0 ? psDiscountGross / baseSubtotal : 0;

  let totalMaxPayableFeeLocal = 0;
  let totalMaxPayableFeeImport = 0;
  const lines: LinePayableFeeCap[] = [];

  items.forEach(item => {
    const basePriceLine = (item.basePrice ?? item.price) * item.quantity;
    if (basePriceLine <= 0) return;

    const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
    const isOstelinGroup = OSTELIN_GROUP_IDS.includes(item.id);
    const isAcemucGroup = ACEMUC_GROUP_IDS.includes(item.id);

    const compareValue = isTelfastGroup
      ? telfastGroupTotal
      : isOstelinGroup
        ? ostelinGroupBaseTotal
        : isAcemucGroup
          ? acemucGroupBaseTotal
          : item.price * item.quantity;

    const monthlyDiscountPercent = getDiscountPercent(
      item.promotion,
      item.quantity,
      compareValue,
      item.id
    );
    const monthlyDiscountAmount = options?.excludeMonthlyFromCap
      ? 0
      : basePriceLine * monthlyDiscountPercent;
    const psLineDiscount = basePriceLine * psRatio;

    const maxTotalDiscountLine = basePriceLine * ratio;
    let maxPayableFeeLine = Math.max(
      0,
      maxTotalDiscountLine - monthlyDiscountAmount - psLineDiscount
    );
    if (excludeFromCap.has(item.id)) maxPayableFeeLine = 0;

    lines.push({
      itemId: item.id,
      type: item.type,
      basePriceLine,
      monthlyDiscountPercent,
      monthlyDiscountAmount,
      psLineDiscount,
      maxPayableFeeLine,
    });

    if (item.type === 'Local') totalMaxPayableFeeLocal += maxPayableFeeLine;
    else totalMaxPayableFeeImport += maxPayableFeeLine;
  });

  return { totalMaxPayableFeeLocal, totalMaxPayableFeeImport, lines };
}

/** Trần phí chuẩn (loại Magne/Phospha) + trần cho 3 mã ALL allowlist (full giỏ). */
export function computeDualMaxPayableFees(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  options?: ComputeMaxPayableFeesOptions
): { standard: MaxPayableFeesResult; allAllowlist: MaxPayableFeesResult } {
  return {
    standard: computeMaxPayableFees(items, groupTotals, options),
    allAllowlist: computeMaxPayableFees(items, groupTotals, {
      ...options,
      excludeProductIdsFromCap: [],
    }),
  };
}

export interface AppliedRebatesResult {
  rebateDiscount: number;
  /** Phần phí Local đã áp (cắt Max) — trừ trước VAT trong giỏ */
  rebateDiscountLocalApplied: number;
  /** Phần phí Import đã áp (cắt Max) — trừ trước VAT trong giỏ */
  rebateDiscountImportApplied: number;
  selectedLocalRebateTotal: number;
  selectedImportRebateTotal: number;
  /** Tổng phí Group ALL đã chọn (chưa cắt Max) */
  selectedAllRebateTotal: number;
  selectedAllStandardRebateTotal: number;
  selectedAllAllowlistRebateTotal: number;
  /** Phần ALL đã áp sau khi chia pro-rata rem Local/Import */
  allRebateApplied: number;
  /** Cap còn lại cho ALL thường (không Magne/Phospha) */
  totalMaxPayableFeeAll: number;
  /** Cap còn lại cho 3 mã ALL allowlist (có Magne/Phospha) */
  totalMaxPayableFeeAllAllowlist: number;
  totalMaxPayableFeeLocal: number;
  totalMaxPayableFeeImport: number;
}

function splitAllToLocalImport(
  allApplied: number,
  remLocal: number,
  remImport: number
): { toLocal: number; toImport: number } {
  const totalRem = remLocal + remImport;
  if (allApplied <= 0 || totalRem <= 0) return { toLocal: 0, toImport: 0 };
  const toLocal = (allApplied * remLocal) / totalRem;
  return { toLocal, toImport: allApplied - toLocal };
}

export function computeAppliedRebates(
  rebates: Rebate[],
  selectedRebateIds: string[],
  maxFeesStandard: Pick<MaxPayableFeesResult, 'totalMaxPayableFeeLocal' | 'totalMaxPayableFeeImport'>,
  maxFeesAllAllowlist?: Pick<MaxPayableFeesResult, 'totalMaxPayableFeeLocal' | 'totalMaxPayableFeeImport'>
): AppliedRebatesResult {
  const maxFeesFull = maxFeesAllAllowlist ?? maxFeesStandard;

  const localRebates = rebates.filter(r => r.Group === 'LOCAL');
  const importRebates = rebates.filter(r => r.Group === 'IMPORT');
  const allRebates = rebates.filter(r => r.Group === 'ALL');

  const selectedLocalRebateTotal = localRebates
    .filter(r => selectedRebateIds.includes(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

  const selectedImportRebateTotal = importRebates
    .filter(r => selectedRebateIds.includes(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

  const selectedAllRebates = allRebates.filter(r =>
    selectedRebateIds.includes(r['PromotionID#program'])
  );
  const selectedAllRebateTotal = selectedAllRebates.reduce(
    (sum, r) => sum + Number(r.RemainAmount),
    0
  );
  const selectedAllStandardRebateTotal = selectedAllRebates
    .filter(r => !isAllRebateMagnePhosphaAllowed(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);
  const selectedAllAllowlistRebateTotal = selectedAllRebates
    .filter(r => isAllRebateMagnePhosphaAllowed(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

  const actualLocalFromGroup = Math.min(
    selectedLocalRebateTotal,
    maxFeesStandard.totalMaxPayableFeeLocal
  );
  const actualImportFromGroup = Math.min(
    selectedImportRebateTotal,
    maxFeesStandard.totalMaxPayableFeeImport
  );

  const remLocalStandard = Math.max(
    0,
    maxFeesStandard.totalMaxPayableFeeLocal - actualLocalFromGroup
  );
  const remImportStandard = Math.max(
    0,
    maxFeesStandard.totalMaxPayableFeeImport - actualImportFromGroup
  );
  const totalMaxPayableFeeAll = remLocalStandard + remImportStandard;

  const remLocalAllow = Math.max(
    0,
    maxFeesFull.totalMaxPayableFeeLocal - actualLocalFromGroup
  );
  const remImportAllow = Math.max(
    0,
    maxFeesFull.totalMaxPayableFeeImport - actualImportFromGroup
  );
  const totalMaxPayableFeeAllAllowlist = remLocalAllow + remImportAllow;

  const allStandardApplied = Math.min(selectedAllStandardRebateTotal, totalMaxPayableFeeAll);
  const allAllowlistApplied = Math.min(
    selectedAllAllowlistRebateTotal,
    totalMaxPayableFeeAllAllowlist
  );
  const allRebateApplied = allStandardApplied + allAllowlistApplied;

  const splitStandard = splitAllToLocalImport(
    allStandardApplied,
    remLocalStandard,
    remImportStandard
  );
  const splitAllow = splitAllToLocalImport(
    allAllowlistApplied,
    remLocalAllow,
    remImportAllow
  );

  const actualLocal =
    actualLocalFromGroup + splitStandard.toLocal + splitAllow.toLocal;
  const actualImport =
    actualImportFromGroup + splitStandard.toImport + splitAllow.toImport;

  return {
    rebateDiscount: actualLocal + actualImport,
    rebateDiscountLocalApplied: actualLocal,
    rebateDiscountImportApplied: actualImport,
    selectedLocalRebateTotal,
    selectedImportRebateTotal,
    selectedAllRebateTotal,
    selectedAllStandardRebateTotal,
    selectedAllAllowlistRebateTotal,
    allRebateApplied,
    totalMaxPayableFeeAll,
    totalMaxPayableFeeAllAllowlist,
    totalMaxPayableFeeLocal: maxFeesStandard.totalMaxPayableFeeLocal,
    totalMaxPayableFeeImport: maxFeesStandard.totalMaxPayableFeeImport,
  };
}
