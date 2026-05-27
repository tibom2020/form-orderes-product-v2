import type { CartItem, Rebate } from '../types';
import {
  ACEMUC_GROUP_IDS,
  OSTELIN_GROUP_IDS,
  TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';

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

/**
 * Phí Local/Import tối đa còn được trả sau CK tháng và (nếu có) CK PS phân bổ theo basePrice dòng.
 */
export function computeMaxPayableFees(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  options?: {
    /** Tổng giảm Gross CK PS On Invoice — phân bổ theo tỷ lệ basePrice từng dòng */
    psDiscountGross?: number;
    maxDiscountRatio?: number;
    /** CK PS: đơn không áp CK tháng — chỉ trừ CK PS khỏi trần (vd. 49%) */
    excludeMonthlyFromCap?: boolean;
  }
): MaxPayableFeesResult {
  const { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal } = groupTotals;
  const ratio = options?.maxDiscountRatio ?? MAX_PRODUCT_DISCOUNT_RATIO_STANDARD;
  const psDiscountGross = Math.max(0, options?.psDiscountGross ?? 0);

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
    const maxPayableFeeLine = Math.max(
      0,
      maxTotalDiscountLine - monthlyDiscountAmount - psLineDiscount
    );

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

export interface AppliedRebatesResult {
  rebateDiscount: number;
  /** Phần phí Local đã áp (cắt Max) — trừ trước VAT trong giỏ */
  rebateDiscountLocalApplied: number;
  /** Phần phí Import đã áp (cắt Max) — trừ trước VAT trong giỏ */
  rebateDiscountImportApplied: number;
  selectedLocalRebateTotal: number;
  selectedImportRebateTotal: number;
  totalMaxPayableFeeLocal: number;
  totalMaxPayableFeeImport: number;
}

export function computeAppliedRebates(
  rebates: Rebate[],
  selectedRebateIds: string[],
  maxFees: Pick<MaxPayableFeesResult, 'totalMaxPayableFeeLocal' | 'totalMaxPayableFeeImport'>
): AppliedRebatesResult {
  const localRebates = rebates.filter(r => r.Group === 'LOCAL');
  const importRebates = rebates.filter(r => r.Group === 'IMPORT');

  const selectedLocalRebateTotal = localRebates
    .filter(r => selectedRebateIds.includes(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

  const selectedImportRebateTotal = importRebates
    .filter(r => selectedRebateIds.includes(r['PromotionID#program']))
    .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

  const actualLocal = Math.min(selectedLocalRebateTotal, maxFees.totalMaxPayableFeeLocal);
  const actualImport = Math.min(selectedImportRebateTotal, maxFees.totalMaxPayableFeeImport);

  return {
    rebateDiscount: actualLocal + actualImport,
    rebateDiscountLocalApplied: actualLocal,
    rebateDiscountImportApplied: actualImport,
    selectedLocalRebateTotal,
    selectedImportRebateTotal,
    totalMaxPayableFeeLocal: maxFees.totalMaxPayableFeeLocal,
    totalMaxPayableFeeImport: maxFees.totalMaxPayableFeeImport,
  };
}
