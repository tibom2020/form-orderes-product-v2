import type { CartItem } from '../types';
import {
  ACEMUC_GROUP_IDS,
  CHC2606_ONTOP_IMPORT_PRODUCT_IDS,
  CHC2606_ONTOP_LOCAL_PRODUCT_IDS,
  DUMMY_BOX_DISCOUNT,
  OSTELIN_GROUP_IDS,
  TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';
import type { CartGroupTotals } from './orderDiscountCaps';
import { getPsCartUnitPrice } from './psOnInvoicePromo';
import type { PsOrderTotals } from './psOnInvoicePromo';

/** Khớp DummyBoxLocalCalculator */
const DUMMY_BOX_LOCAL_CALC_IDS: readonly number[] = [1, 26, 28, 2, 3, 4, 6, 7, 8, 10];
/** Khớp DummyBoxImportCalculator */
const DUMMY_BOX_IMPORT_CALC_IDS: readonly number[] = [30, 12, 13, 14, 22, 23, 24, 25, 27, 31, 18, 19, 20];

/** VAT % theo sản phẩm — gộp Local + Import (DummyBox calculators) */
const VAT_BY_PRODUCT_ID: Record<number, number> = {
  1: 0.08,
  28: 0.05,
  2: 0.05,
  3: 0.05,
  4: 0.05,
  6: 0.05,
  7: 0.05,
  8: 0.05,
  10: 0.05,
  26: 0.05,
  30: 0.05,
  12: 0.05,
  13: 0.08,
  14: 0.05,
  22: 0.08,
  23: 0.08,
  24: 0.08,
  25: 0.08,
  18: 0.08,
  19: 0.08,
  20: 0.08,
  27: 0.08,
  31: 0.08,
};

export function getProductVatRate(productId: number, productType: CartItem['type']): number {
  if (VAT_BY_PRODUCT_ID[productId] != null) return VAT_BY_PRODUCT_ID[productId];
  return productType === 'Import' ? 0.08 : 0.05;
}

function getLineCompareValue(
  item: CartItem,
  groupTotals: CartGroupTotals
): number | undefined {
  if (TELFAST_GROUP_IDS.includes(item.id)) return groupTotals.telfastGroupTotal;
  if (OSTELIN_GROUP_IDS.includes(item.id)) return groupTotals.ostelinGroupBaseTotal;
  if (ACEMUC_GROUP_IDS.includes(item.id)) return groupTotals.acemucGroupBaseTotal;
  const unitBase = item.basePrice ?? item.price;
  return unitBase * item.quantity;
}

/** Thành tiền (-VAT) sau CK tháng/combo trên basePrice */
export function getCartLineExVatAfterDiscount(
  item: CartItem,
  groupTotals: CartGroupTotals
): number {
  const unitBase = item.basePrice ?? item.price;
  const compareValue = getLineCompareValue(item, groupTotals);
  const discount = getDiscountPercent(item.promotion, item.quantity, compareValue, item.id);
  return unitBase * item.quantity * (1 - discount);
}

export interface CartVatTotalsInput {
  items: CartItem[];
  groupTotals: CartGroupTotals;
  psTotals?: PsOrderTotals | null;
  applyDummyBoxLocal?: boolean;
  applyDummyBoxImport?: boolean;
  dummyBoxLocalDiscount?: number;
  dummyBoxImportDiscount?: number;
  dummyBoxLocalPoolExVat?: number;
  dummyBoxImportPoolExVat?: number;
  ontopLocalPercent?: number;
  ontopImportPercent?: number;
  /** Phí rebate Local/Import đã cắt trần — trừ trên giá trước khi nhân VAT */
  rebateAppliedLocal?: number;
  rebateAppliedImport?: number;
}

export interface CartVatTotalsResult {
  /** Tạm tính (-VAT): sau CK dòng, chưa CK PS / DummyBox */
  subtotalExVat: number;
  /** Tổng sau CK dòng + CK PS (phân bổ) + DummyBox (%) rồi cộng VAT từng SP */
  totalWithVatBeforeOrderDeductions: number;
}

/** % giảm DummyBox — đã kiểm tra pool & cờ tick */
export function getCartDummyBoxPercents(input: {
  applyDummyBoxLocal?: boolean;
  applyDummyBoxImport?: boolean;
  dummyBoxLocalDiscount?: number;
  dummyBoxImportDiscount?: number;
  dummyBoxLocalPoolExVat?: number;
  dummyBoxImportPoolExVat?: number;
}): { dummyLocalPercent: number; dummyImportPercent: number } {
  const {
    applyDummyBoxLocal = false,
    applyDummyBoxImport = false,
    dummyBoxLocalDiscount = DUMMY_BOX_DISCOUNT,
    dummyBoxImportDiscount = DUMMY_BOX_DISCOUNT,
    dummyBoxLocalPoolExVat = 0,
    dummyBoxImportPoolExVat = 0,
  } = input;

  const dummyLocalPercent =
    applyDummyBoxLocal && dummyBoxLocalPoolExVat > 0 && dummyBoxLocalDiscount > 0
      ? dummyBoxLocalDiscount / dummyBoxLocalPoolExVat
      : 0;
  const dummyImportPercent =
    applyDummyBoxImport && dummyBoxImportPoolExVat > 0 && dummyBoxImportDiscount > 0
      ? dummyBoxImportDiscount / dummyBoxImportPoolExVat
      : 0;

  return { dummyLocalPercent, dummyImportPercent };
}

/** Giá —VAT một dòng sau CK SP + CK PS (phân bổ) + DummyBox (%), chưa trừ phí rebate */
export function getCartLineExVatBeforeVat(
  item: CartItem,
  groupTotals: CartGroupTotals,
  opts: {
    psTotals?: PsOrderTotals | null;
    dummyLocalPercent: number;
    dummyImportPercent: number;
    ontopLocalPercent?: number;
    ontopImportPercent?: number;
  }
): number {
  const {
    psTotals,
    dummyLocalPercent,
    dummyImportPercent,
    ontopLocalPercent = 0,
    ontopImportPercent = 0,
  } = opts;
  const isPs = !!psTotals;
  const psRatio =
    isPs && psTotals!.eligible && psTotals!.baseSubtotal > 0
      ? psTotals!.discountGross / psTotals!.baseSubtotal
      : 0;

  let lineExVatRaw = isPs
    ? getPsCartUnitPrice(item) * item.quantity
    : getCartLineExVatAfterDiscount(item, groupTotals);

  let lineExVat = lineExVatRaw;
  if (isPs && psRatio > 0) {
    lineExVat *= 1 - psRatio;
  }
  if (DUMMY_BOX_LOCAL_CALC_IDS.includes(item.id) && dummyLocalPercent > 0) {
    lineExVat *= 1 - dummyLocalPercent;
  }
  if (DUMMY_BOX_IMPORT_CALC_IDS.includes(item.id) && dummyImportPercent > 0) {
    lineExVat *= 1 - dummyImportPercent;
  }
  if (CHC2606_ONTOP_LOCAL_PRODUCT_IDS.includes(item.id) && ontopLocalPercent > 0) {
    lineExVat *= 1 - ontopLocalPercent;
  }
  if (CHC2606_ONTOP_IMPORT_PRODUCT_IDS.includes(item.id) && ontopImportPercent > 0) {
    lineExVat *= 1 - ontopImportPercent;
  }

  return lineExVat;
}

/** Phân bổ phí rebate (trước thuế) theo tỷ lệ —VAT từng dòng Local / Import */
export function allocateRebateExVatPerItem(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  lineOpts: {
    psTotals?: PsOrderTotals | null;
    dummyLocalPercent: number;
    dummyImportPercent: number;
    ontopLocalPercent?: number;
    ontopImportPercent?: number;
  },
  rebateLocalApplied: number,
  rebateImportApplied: number
): number[] {
  const weights = items.map(item => getCartLineExVatBeforeVat(item, groupTotals, lineOpts));
  let localSum = 0;
  let importSum = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type === 'Local') localSum += weights[i];
    else importSum += weights[i];
  }

  const alloc = new Array(items.length).fill(0) as number[];
  if (rebateLocalApplied > 0 && localSum > 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === 'Local') {
        alloc[i] += (rebateLocalApplied * weights[i]) / localSum;
      }
    }
  }
  if (rebateImportApplied > 0 && importSum > 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === 'Import') {
        alloc[i] += (rebateImportApplied * weights[i]) / importSum;
      }
    }
  }
  return alloc;
}

/** Thành tiền dòng (có VAT): khớp logic `computeCartVatTotals` / Tổng cộng */
export function getCartLineAmountWithVat(
  item: CartItem,
  groupTotals: CartGroupTotals,
  opts: {
    psTotals?: PsOrderTotals | null;
    dummyLocalPercent: number;
    dummyImportPercent: number;
    ontopLocalPercent?: number;
    ontopImportPercent?: number;
    /** Phần phí rebate phân bổ cho dòng này (—VAT), trước khi nhân VAT */
    rebateAllocExVat?: number;
  }
): number {
  const { psTotals, dummyLocalPercent, dummyImportPercent, ontopLocalPercent = 0, ontopImportPercent = 0, rebateAllocExVat = 0 } = opts;

  let lineExVat = getCartLineExVatBeforeVat(item, groupTotals, {
    psTotals,
    dummyLocalPercent,
    dummyImportPercent,
    ontopLocalPercent,
    ontopImportPercent,
  });

  lineExVat = Math.max(0, lineExVat - rebateAllocExVat);

  const vatRate = getProductVatRate(item.id, item.type);
  return lineExVat * (1 + vatRate);
}

/**
 * Tổng có VAT: mỗi dòng = basePrice (sau CK) × (1 + VAT%), cộng dồn.
 * CK PS và DummyBox giảm theo tỷ lệ trên giá -VAT từng dòng trước khi nhân VAT.
 */
export function computeCartVatTotals(input: CartVatTotalsInput): CartVatTotalsResult {
  const {
    items,
    groupTotals,
    psTotals,
    applyDummyBoxLocal = false,
    applyDummyBoxImport = false,
    dummyBoxLocalDiscount = DUMMY_BOX_DISCOUNT,
    dummyBoxImportDiscount = DUMMY_BOX_DISCOUNT,
    dummyBoxLocalPoolExVat = 0,
    dummyBoxImportPoolExVat = 0,
    ontopLocalPercent = 0,
    ontopImportPercent = 0,
    rebateAppliedLocal = 0,
    rebateAppliedImport = 0,
  } = input;

  const { dummyLocalPercent, dummyImportPercent } = getCartDummyBoxPercents({
    applyDummyBoxLocal,
    applyDummyBoxImport,
    dummyBoxLocalDiscount,
    dummyBoxImportDiscount,
    dummyBoxLocalPoolExVat,
    dummyBoxImportPoolExVat,
  });

  const lineOpts = {
    psTotals,
    dummyLocalPercent,
    dummyImportPercent,
    ontopLocalPercent,
    ontopImportPercent,
  };

  const rebateAlloc = allocateRebateExVatPerItem(
    items,
    groupTotals,
    lineOpts,
    rebateAppliedLocal,
    rebateAppliedImport
  );

  let totalWithVat = 0;

  for (let i = 0; i < items.length; i++) {
    totalWithVat += getCartLineAmountWithVat(items[i], groupTotals, {
      psTotals,
      dummyLocalPercent,
      dummyImportPercent,
      ontopLocalPercent,
      ontopImportPercent,
      rebateAllocExVat: rebateAlloc[i],
    });
  }

  const subtotalExVat = psTotals
    ? psTotals.baseSubtotal
    : items.reduce((sum, item) => sum + getCartLineExVatAfterDiscount(item, groupTotals), 0);

  return {
    subtotalExVat,
    totalWithVatBeforeOrderDeductions: totalWithVat,
  };
}

export interface CartFinalAmountInput extends CartVatTotalsInput {
  onTopLiXiDiscount?: number;
  calciPlusPack476Discount?: number;
}

/** Tổng cộng (VAT) hiển thị / gửi đơn — phí rebate đã trừ trước thuế trong `computeCartVatTotals` */
export function computeCartFinalAmountWithVat(input: CartFinalAmountInput): number {
  const { totalWithVatBeforeOrderDeductions } = computeCartVatTotals(input);
  const orderDeductions =
    (input.onTopLiXiDiscount ?? 0) + (input.calciPlusPack476Discount ?? 0);

  return Math.round(Math.max(0, totalWithVatBeforeOrderDeductions - orderDeductions));
}
