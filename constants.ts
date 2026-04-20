
import type { Product, Employee, Customer } from './types';

// NGÀY CẬP NHẬT CTKM - Bạn có thể sửa ngày này thủ công tại đây
export const PROMO_UPDATE_DATE = '20/04/2026';

// Đường dẫn Google Apps Script (Cập nhật mới nhất)
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxD5n_kNXKaJhIpfVHW014ZZ4AE8PEz-29d3i6ym-fhNIf2T10Gntq7F13N4CHmb9DTnA/exec';
export const ADMIN_CODE = '20043741';

/** Sheet danh sách KH đăng ký CT trưng bày Q2 — import từ mẫu DANGKYTBQ2.xlsx */
export const SHEET_DANGKYTBQ2 = 'DANGKYTBQ2';
/** Sheet quản lý ngân sách Rep: Rep | Budget | Đã Sử dụng | Còn lại */
export const SHEET_REP_BUDGET_TBQ2 = 'REP_BUDGET_TBQ2';
/** Doanh số KH: MustWin, Other — dùng Sale T4 = MustWin + Other ở tab DK PS */
export const SHEET_DOANH_SO = 'DOANH_SO';

export const EMPLOYEES: Employee[] = [
  { name: 'Huynh Thi To Trinh', code: '20045852' },
  { name: 'Ly Minh Dat', code: '20044677' },
  { name: 'Nguyen Thi Hong Cam', code: '20044676' },
  { name: 'Huynh Van Thanh Huyen', code: '20043742' },
  { name: 'Le Huu Phuc', code: '20043750' },
  { name: 'Truong Hoang Du', code: '20042514' },
  { name: 'Ngo Thi Thuy Quynh', code: '20043683' },
  { name: 'Huynh Hoang Hon', code: '20046380' },
  { name: 'Phan Viet Linh', code: '20043741' },
];

// Danh sách khách hàng sẽ được fetch từ Google Sheets khi App khởi động
export const CUSTOMERS: Customer[] = [];

export const PRODUCTS: Product[] = [
  { id: 1, name: 'CORBIERE CALCIUM PLUS', minOrder: '1', minOrderQuantity: 1, price: 223435, type: 'Local', basePrice: 206884, promotion: 'Mua 3h ck 4.9%, 5h ck 5.95%, gói 21h ck 4.76% (đến 25.04.2026)', image: 'https://i.postimg.cc/JnN6Jvyg/corbiere-calcium-plus-5-3lrp-gh.webp' },
  { id: 28, name: 'CALCIUM CORBIERE EXTRA 3SUPx10 10ML VN', minOrder: '1', minOrderQuantity: 1, price: 206884, type: 'Local', basePrice: 197032, requireApproval: true, image: 'https://i.postimg.cc/43ZXpknR/calci-10-(1).webp' },
  { id: 26, name: 'CALCIUM CORBIERE EXTRA 3SUPx10 5ML VN', minOrder: '1', minOrderQuantity: 1, price: 167425, type: 'Local', basePrice: 159453, image: 'https://i.postimg.cc/43JTm62S/calci-5.webp' },
  { id: 2, name: 'ACEMUC 200 CAP_BL3X10_VN', minOrder: '1', minOrderQuantity: 1, price: 82911, type: 'Local', basePrice: 78963, image: 'https://i.postimg.cc/Zq4tQ8rX/199562697843785922.webp' },
  { id: 3, name: 'ACEMUC 200mg SAC 1g_SC30_VN', minOrder: '1', minOrderQuantity: 1, price: 91562, type: 'Local', basePrice: 87202, image: 'https://i.postimg.cc/TwV7mFyF/acemuc-200.webp' },
  { id: 4, name: 'ACEMUC Kids 100mg_0,5g_SC30 VN', minOrder: '1', minOrderQuantity: 1, price: 64605, type: 'Local', basePrice: 61529, image: 'https://i.postimg.cc/FKN56yjM/Acemuc-Kids-2.webp' },
  { id: 5, name: 'MAGNE-B6 Tab B/50 (bao film)', minOrder: '1', minOrderQuantity: 1, price: 101706, type: 'Local', basePrice: 96863, image: 'https://i.postimg.cc/0NnR1znv/magie-B6.webp' },
  { id: 6, name: 'TELFAST HD 180MG', minOrder: '1', minOrderQuantity: 1, price: 280760, type: 'Local', basePrice: 267390, promotion: 'Mua 2h ck 4.43%, 3h ck 4.93% (đến 29.04.2026)', image: 'https://i.postimg.cc/50tc4fKF/telfast-180.webp' },
  { id: 7, name: 'TELFAST BD 60MG', minOrder: '1', minOrderQuantity: 1, price: 128931, type: 'Local', basePrice: 122791, promotion: 'Mua đơn >= 300k ck 2.46%, 560k ck 2.96% (đến 29.04.2026)', image: 'https://i.postimg.cc/B6vWSJ7L/telfast-60.webp' },
  { id: 8, name: 'TELFAST 30MG', minOrder: '1', minOrderQuantity: 1, price: 30293, type: 'Local', basePrice: 28850, promotion: 'Mua đơn >= 300k ck 2.46%, 560k ck 2.96% (đến 29.04.2026)', image: 'https://i.postimg.cc/pTdNWPc9/telfast-30.webp' },
  { id: 9, name: 'NO-SPA 40mg', minOrder: '1', minOrderQuantity: 1, price: 45700, type: 'Local', basePrice: 43524, requireApproval: true, image: 'https://i.postimg.cc/QMmGZFm3/nospa-40.webp' },
  { id: 10, name: 'BISOLVON KIDS 60ML BOTx1 VN', minOrder: '1', minOrderQuantity: 1, price: 40567, type: 'Local', basePrice: 38635, promotion: 'Mua 1h ck 9.85% (đến 29.04.2026)', nearExpiry: 'HSD: 3/2027', requireApproval: true, image: 'https://i.postimg.cc/SKkFP6Ww/bi-siro.webp' },
  { id: 30, name: 'ENTEROGERMINA 2 billion/5ml B/20 bottle', minOrder: '1', minOrderQuantity: 1, price: 182779, type: 'Import', basePrice: 174075, promotion: 'Mua 3h ck 2.96%, gói 21h ck 4.76% (đến 25.04.2026)', requireApproval: true, image: 'https://i.postimg.cc/htwjVtX6/ENTERO-2B-(1).webp' },
  { id: 12, name: 'ENTEROGERMINA GUT RESTORE ( 4B)', minOrder: '1', minOrderQuantity: 1, price: 305130, type: 'Import', basePrice: 290600, promotion: 'Mua 3h ck 4.93% (đến 29.04.2026)', nearExpiry: 'HSD: 11/2026', requireApproval: true, image: 'https://i.postimg.cc/pdRbSffx/entero-4b.webp' },
  { id: 13, name: 'ENTEROGERMINA BABY COMFORT', minOrder: '1', minOrderQuantity: 1, price: 460000, type: 'Import', basePrice: 425926, promotion: 'Mua 1h ck 15.8% (đến 29.04.2026)', image: 'https://i.postimg.cc/xd5DVXR4/entero-bb.webp' },
  { id: 14, name: 'BISOLVON 8MG TAB', minOrder: '1', minOrderQuantity: 1, price: 63901, type: 'Import', basePrice: 60858, promotion: 'ck 4.93% (đến 29.04.2026)', nearExpiry: 'HSD: 03/2027', image: 'https://i.postimg.cc/xdnDZvvr/bi-vien.webp' },
  { id: 15, name: 'BUSCOPAN VIÊN', minOrder: '1', minOrderQuantity: 1, price: 125790, type: 'Import', basePrice: 119800, image: 'https://i.postimg.cc/LsDKFJTw/buscopan-v.webp' },
  { id: 16, name: 'NOSPA 80 V', minOrder: '1', minOrderQuantity: 1, price: 27041, type: 'Import', basePrice: 25753, requireApproval: true, image: 'https://i.postimg.cc/rpjX2Djq/nospa-80-jfif.webp' },
  { id: 29, name: 'NO-SPA 40MG/2ML INJ AM25 VN', minOrder: '1', minOrderQuantity: 1, price: 146628, type: 'Import', basePrice: 139646, requireApproval: true, image: 'https://i.postimg.cc/L5hKr7Zq/no-spa-40mg-2ml-h-25-ong-1-638836122898829134.webp' },
  { id: 17, name: 'PHARMATON ENERGY', minOrder: '1', minOrderQuantity: 1, price: 228614, type: 'Import', originalPrice: 228614, promotion: 'Mua 1h ck 14.8%, 3h ck 29.6% (đến 31.03.2026)', basePrice: 211680, nearExpiry: 'HSD: 9/2026 & 10/2026', requireApproval: true, image: 'https://i.postimg.cc/LsDKFJDP/pmt-ene.webp' },
  { id: 27, name: 'PHARMATON VITALITY', minOrder: '1', minOrderQuantity: 1, price: 228614, type: 'Import', originalPrice: 228614, promotion: 'Mua 1h ck 6.4%, 3h ck 12.5% (đến 29.04.2026)', basePrice: 211680, image: 'https://i.postimg.cc/rmp6VqZs/pmt-vita.webp' },
  { id: 18, name: 'PHARMATON ESSENT', minOrder: '1', minOrderQuantity: 1, price: 205286, type: 'Import', basePrice: 190080, promotion: 'Mua 4h ck 19.7%, 8h ck 24.6% (đến 29.04.2026)', nearExpiry: 'HSD: 01/2027', requireApproval: true, image: 'https://i.postimg.cc/zBfmzq2G/pmt-essen.webp' },
  { id: 19, name: 'PHARMATON KIDDI', minOrder: '1', minOrderQuantity: 1, price: 167400, type: 'Import', promotion: 'Mua 2h ck 3.9%, 4h ck 7.9% (đến 29.04.2026)', basePrice: 155000, image: 'https://i.postimg.cc/Qt7zxVkC/pmt-kiddi.webp' },
  { id: 20, name: 'PHARMATON ENERGY FIZZI SỦI', minOrder: '1', minOrderQuantity: 1, price: 104760, type: 'Import', basePrice: 97000, promotion: 'Mua 3h ck 12.3% (đến 29.04.2026)', image: 'https://i.postimg.cc/43PkRYP9/pmt-fizzi.webp' },
  { id: 21, name: 'PHOSPHALUGEL 2.47G/20G GEL SC26 M36 VN', minOrder: '1', minOrderQuantity: 1, price: 120558, type: 'Import', basePrice: 114817, image: 'https://i.postimg.cc/N0DqvKDy/phospha.webp' },
  { id: 22, name: 'OSTELIN VIT D & CALCI CHAI 130V', minOrder: '1', minOrderQuantity: 1, price: 300000, type: 'Import', basePrice: 277778, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/zf7ZYy7f/ostelin-60-1.webp' },
  { id: 23, name: 'OSTELIN VIT D & CALCI CHAI 275V', minOrder: '1', minOrderQuantity: 1, price: 540000, type: 'Import', basePrice: 500000, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/KYfSh1fj/ostelin-275.webp' },
  { id: 24, name: 'OSTELIN VIT D & CALCI CHAI 30V', minOrder: '1', minOrderQuantity: 1, price: 130000, type: 'Import', basePrice: 120370, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/R0d5xWdC/ostelin-30.webp' },
  { id: 25, name: 'OSTELIN VIT D & CALCI CHAI 60V', minOrder: '1', minOrderQuantity: 1, price: 230000, type: 'Import', basePrice: 212963, promotion: 'Mua 2h ck 15.76%, 4h ck 17.73%, 5h ck 21.67% (đến 29.04.2026)', image: 'https://i.postimg.cc/TP0MvK0w/ostelin-60.webp' }
];

/**
 * Giá gốc BM CVM (VNĐ / hộp) — dùng tab Giá tham khảo & đối chiếu BuyMed.
 * Id 17 (PHARMATON ENERGY), 19 (PHARMATON KIDDI): 0 = không bán.
 */
export const BM_CVM_BASE_PRICE_VND: Readonly<Record<number, number>> = {
  1: 211500,
  2: 82600,
  3: 90900,
  4: 63100,
  5: 97900,
  6: 268000,
  7: 128700,
  8: 29900,
  9: 45800,
  10: 39900,
  12: 289100,
  13: 385400,
  14: 60400,
  15: 131200,
  16: 27600,
  17: 0,
  18: 175700,
  19: 0,
  20: 100000,
  21: 117500,
  22: 246200,
  23: 492000,
  24: 111200,
  25: 193800,
  26: 166200,
  27: 209500,
  28: 201500,
  29: 145800,
  30: 176200,
};

/** SP không bán kênh BM CVM (giá gốc = 0) */
export const BM_CVM_NOT_SOLD_IDS: readonly number[] = [17, 19];

/**
 * Giá gốc BM NO CVM (VNĐ / hộp) — kênh không áp mức CVM.
 * Id 17 (PHARMATON ENERGY), 19 (PHARMATON KIDDI): không có giá trong bảng → 0.
 */
export const BM_NON_CVM_BASE_PRICE_VND: Readonly<Record<number, number>> = {
  1: 223200,
  2: 83800,
  3: 90600,
  4: 62400,
  5: 99400,
  6: 258500,
  7: 133700,
  8: 29800,
  9: 44700,
  10: 39400,
  12: 299500,
  13: 402400,
  14: 60500,
  15: 129600,
  16: 28400,
  17: 0,
  18: 157300,
  19: 0,
  20: 106000,
  21: 118800,
  22: 247600,
  23: 541000,
  24: 110100,
  25: 234100,
  26: 149900,
  27: 211500,
  28: 201200,
  29: 145600,
  30: 185400,
};

/** SP không có giá kênh BM NO CVM (giống ô trống trên bảng) */
export const BM_NON_CVM_NOT_SOLD_IDS: readonly number[] = [17, 19];

/** Một dòng CTKM kênh BM CVM (% giảm + mô tả theo chương trình BuyMed) */
export type BmCvmCtkmEntry = {
  /** Nhãn hiển thị, ví dụ "GIẢM 2.4%" */
  label: string;
  /** Phần trăm chiết khấu dạng số thập phân (2.4% → 0.024) */
  discountPercent: number;
  description: string;
  /**
   * Trần tiền giảm (VNĐ) trên cả dòng hàng (giá gốc BM × SL) cho dòng CTKM này.
   * Ví dụ "giảm tối đa 30K" → 30_000. Bỏ qua nếu không giới hạn theo tiền.
   */
  maxDiscountVnd?: number;
  /**
   * Chỉ áp dòng CTKM này khi số lượng hộp đặt đúng bằng giá trị (vd. 100 hộp cho mức 2.4%).
   * Bỏ qua nếu không set.
   */
  requiresExactQty?: number;
  /**
   * Chỉ áp khi SL ≥ giá trị (vd. mua từ 2 hộp).
   * BM NO CVM: khi tính với `minQtyMustBeMultipleOf`, SL phải là **bội số** của giá trị này (combo).
   */
  requiresMinQty?: number;
  /**
   * Tổng giá gốc dòng tham chiếu (VNĐ) theo bảng BM NO CVM (COMBO) — chỉ hiển thị, không thay đổi công thức CK.
   */
  referenceLineBaseVnd?: number;
  /**
   * Số hộp ngay sau chữ “Combo” trong CTKM (vd. Combo 20 → 20). Dùng để hiển thị giá gốc/hộp = `referenceLineBaseVnd / comboPackCount`.
   */
  comboPackCount?: number;
};

/** Giá gốc /hộp từ bảng combo: GIÁ GỐC ÷ số hộp sau “Combo”. */
export function comboReferencePerBoxVndFromEntry(e: BmCvmCtkmEntry): number | undefined {
  if (
    e.referenceLineBaseVnd == null ||
    e.comboPackCount == null ||
    e.comboPackCount <= 0
  ) {
    return undefined;
  }
  return Math.round(e.referenceLineBaseVnd / e.comboPackCount);
}

/**
 * Giá trị dòng (VNĐ) để tính CK CTKM cột BM NO CVM (COMBO): đơn giá theo bảng combo × SL.
 * Không có `referenceLineBaseVnd` / `comboPackCount` → dùng `fallbackLineValueVnd` (BM NO CVM × SL).
 */
export function comboEntryLineValueVnd(
  e: BmCvmCtkmEntry,
  qty: number,
  fallbackLineValueVnd: number
): number {
  if (
    e.referenceLineBaseVnd != null &&
    e.comboPackCount != null &&
    e.comboPackCount > 0
  ) {
    return Math.round((e.referenceLineBaseVnd / e.comboPackCount) * qty);
  }
  return fallbackLineValueVnd;
}

/**
 * Dòng CTKM có đủ điều kiện SL để tham gia so mức CK (khớp logic `computeBmCtkmDiscountVnd`).
 */
export function bmCtkmEntryEligible(
  qty: number,
  e: BmCvmCtkmEntry,
  minQtyMustBeMultipleOf?: boolean
): boolean {
  if (e.requiresExactQty != null && qty !== e.requiresExactQty) return false;
  if (e.requiresMinQty != null) {
    const m = e.requiresMinQty;
    if (m <= 0) return false;
    if (minQtyMustBeMultipleOf) {
      if (qty < m || qty % m !== 0) return false;
    } else if (qty < m) {
      return false;
    }
  }
  return true;
}

/**
 * Tiền CK CTKM BM (VNĐ) trên dòng: mỗi dòng = min(maxDiscountVnd, lineValue × %);
 * Bỏ qua dòng có requiresExactQty / requiresMinQty không khớp qty; SP nhiều dòng → lấy mức CK tiền cao nhất trong các dòng áp dụng được.
 *
 * @param minQtyMustBeMultipleOf — BM NO CVM combo: khi `true`, mỗi dòng có `requiresMinQty` chỉ áp khi SL là **bội số** của ngưỡng (vd. min 20 → 20, 40, 60…). BM CVM để `false`/bỏ qua.
 */
export function computeBmCtkmDiscountVnd(
  lineValueVnd: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number {
  if (!entries?.length || lineValueVnd <= 0) return 0;
  let best = 0;
  for (const e of entries) {
    if (!bmCtkmEntryEligible(qty, e, minQtyMustBeMultipleOf)) continue;
    const raw = lineValueVnd * e.discountPercent;
    const cap = e.maxDiscountVnd;
    const applied = cap != null ? Math.min(cap, raw) : raw;
    if (applied > best) best = applied;
  }
  return Math.round(best);
}

/**
 * Chỉ số các dòng CTKM đang được áp (tiền CK = mức tối đa trong các dòng đủ điều kiện). Dùng hiển thị tích xanh trên UI.
 */
export function getBmCtkmWinningEntryIndices(
  lineValueVnd: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number[] {
  if (!entries?.length || lineValueVnd <= 0 || qty <= 0) return [];
  const rounded: number[] = [];
  let best = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!bmCtkmEntryEligible(qty, e, minQtyMustBeMultipleOf)) {
      rounded.push(-1);
      continue;
    }
    const raw = lineValueVnd * e.discountPercent;
    const cap = e.maxDiscountVnd;
    const applied = cap != null ? Math.min(cap, raw) : raw;
    const r = Math.round(applied);
    rounded.push(r);
    if (r > best) best = r;
  }
  if (best <= 0) return [];
  return rounded.map((r, i) => (r === best ? i : -1)).filter((i) => i >= 0);
}

export function computeBmCtkmEffectivePercent(
  lineValueVnd: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number {
  if (lineValueVnd <= 0) return 0;
  return computeBmCtkmDiscountVnd(lineValueVnd, entries, qty, minQtyMustBeMultipleOf) / lineValueVnd;
}

/** CK CTKM cho cột BM NO CVM (COMBO) — mỗi dòng dùng `comboEntryLineValueVnd`, không dùng chung BM×SL. */
export function computeBmCtkmDiscountVndCombo(
  lineValueFallback: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number {
  if (!entries?.length || qty <= 0) return 0;
  let best = 0;
  for (const e of entries) {
    if (!bmCtkmEntryEligible(qty, e, minQtyMustBeMultipleOf)) continue;
    const lineV = comboEntryLineValueVnd(e, qty, lineValueFallback);
    if (lineV <= 0) continue;
    const raw = lineV * e.discountPercent;
    const cap = e.maxDiscountVnd;
    const applied = cap != null ? Math.min(cap, raw) : raw;
    if (applied > best) best = applied;
  }
  return Math.round(best);
}

export function getBmCtkmWinningEntryIndicesCombo(
  lineValueFallback: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number[] {
  if (!entries?.length || qty <= 0) return [];
  const rounded: number[] = [];
  let best = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!bmCtkmEntryEligible(qty, e, minQtyMustBeMultipleOf)) {
      rounded.push(-1);
      continue;
    }
    const lineV = comboEntryLineValueVnd(e, qty, lineValueFallback);
    if (lineV <= 0) {
      rounded.push(-1);
      continue;
    }
    const raw = lineV * e.discountPercent;
    const cap = e.maxDiscountVnd;
    const applied = cap != null ? Math.min(cap, raw) : raw;
    const r = Math.round(applied);
    rounded.push(r);
    if (r > best) best = r;
  }
  if (best <= 0) return [];
  return rounded.map((r, i) => (r === best ? i : -1)).filter((i) => i >= 0);
}

export function computeBmCtkmEffectivePercentCombo(
  lineValueFallback: number,
  entries: readonly BmCvmCtkmEntry[] | undefined,
  qty: number,
  minQtyMustBeMultipleOf?: boolean
): number {
  const disc = computeBmCtkmDiscountVndCombo(lineValueFallback, entries, qty, minQtyMustBeMultipleOf);
  if (disc <= 0) return 0;
  const idxs = getBmCtkmWinningEntryIndicesCombo(lineValueFallback, entries, qty, minQtyMustBeMultipleOf);
  if (!idxs.length || !entries) return 0;
  const lineV = comboEntryLineValueVnd(entries[idxs[0]], qty, lineValueFallback);
  if (lineV <= 0) return 0;
  return disc / lineV;
}

/**
 * CTKM BM CVM theo từng SP (có SP có nhiều dòng — ví dụ Calci Extra 10ml).
 * Giá trị tiền CK tôn trọng maxDiscountVnd (vd. tối đa 30K).
 */
export const BM_CVM_CTKM_BY_PRODUCT_ID: Readonly<Record<number, readonly BmCvmCtkmEntry[]>> = {
  28: [
    {
      label: 'GIẢM 2.4%',
      discountPercent: 0.024,
      maxDiscountVnd: 1_000_000,
      requiresMinQty: 100,
      description:
        'Giảm tối đa 1TR khi mua 100 Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
    {
      label: 'GIẢM 0.98%',
      discountPercent: 0.0098,
      maxDiscountVnd: 50_000,
      description:
        'Giảm tối đa 50K khi mua Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
  ],
  4: [
    {
      label: 'GIẢM 1.7%',
      discountPercent: 0.017,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc Kids Acetylcystein 100mg Sanofi (hộp/30gói/0.5gram)',
    },
  ],
  3: [
    {
      label: 'GIẢM 7.3%',
      discountPercent: 0.073,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc acetylcystein 200mg sanofi (Hộp/30gói/1gram)',
    },
  ],
  2: [
    {
      label: 'GIẢM 5.4%',
      discountPercent: 0.054,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc acetylcystein 200mg sanofi (hộp/30viên nang)',
    },
  ],
  14: [
    {
      label: 'GIẢM 4.5%',
      discountPercent: 0.045,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon bromhexin 8mg sanofi (hộp/30 viên nén)',
    },
  ],
  10: [
    {
      label: 'GIẢM 3.2%',
      discountPercent: 0.032,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon kids bromhexin 4mg/5ml sanofi (chai/60ml)',
    },
  ],
  15: [
    {
      label: 'GIẢM 6.1%',
      discountPercent: 0.061,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Buscopan hyoscine 10mg sanofi (hộp/100 viên nén)',
    },
  ],
  26: [
    {
      label: 'GIẢM 13.8%',
      discountPercent: 0.138,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Calcium corbiere kids extra sanofi (hộp/30ống/5ml)',
    },
  ],
  12: [
    {
      label: 'GIẢM 4.1%',
      discountPercent: 0.041,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Enterogermina Gut Restore 4 billion/5ml Opella (Hộp/20ống/5ml)',
    },
  ],
  8: [
    {
      label: 'GIẢM 10.4%',
      discountPercent: 0.104,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast kids fexofenadin 30mg sanofi (hộp/10 viên nén)',
    },
  ],
  5: [
    {
      label: 'GIẢM 0.1%',
      discountPercent: 0.001,
      maxDiscountVnd: 30_000,
      description: 'Giảm tối đa 30K khi mua Magne B6 Corbiere Sanofi (h/50v)',
    },
  ],
  21: [
    {
      label: 'GIẢM 4.6%',
      discountPercent: 0.046,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Phosphalugel sanofi (hộp/26gói/20gram)',
    },
  ],
  29: [
    {
      label: 'GIẢM 1.1%',
      discountPercent: 0.011,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua No-spa drotaverin 40mg/2ml sanofi (hộp/25ống/2ml)',
    },
  ],
  9: [
    {
      label: 'GIẢM 1.9%',
      discountPercent: 0.019,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua No-spa drotaverin 40mg sanofi (hộp/50 viên nén)',
    },
  ],
  7: [
    {
      label: 'GIẢM 11.4%',
      discountPercent: 0.114,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast bd fexofenadin 60mg sanofi (hộp/30 viên nén)',
    },
  ],
  1: [
    {
      label: 'GIẢM 9.4%',
      discountPercent: 0.094,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bổ Sung Canxi Hỗ Trợ Loãng Xương Corbiere Calcium Plus Sanofi (H/30o/10ml)',
    },
  ],
  6: [
    {
      label: 'GIẢM 8.2%',
      discountPercent: 0.082,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast hd fexofenadin 180mg sanofi (hộp/30 viên)',
    },
  ],
};

/** CTKM kênh BM NO CVM (cùng cấu trúc bản ghi với BM CVM). Combo: requiresMinQty = SL hộp tối thiểu theo chương trình */
export const BM_NO_CVM_CTKM_BY_PRODUCT_ID: Readonly<Record<number, readonly BmCvmCtkmEntry[]>> = {
  1: [
    {
      label: 'GIẢM 14.12%',
      discountPercent: 0.1412,
      maxDiscountVnd: 320_000,
      description:
        'Giảm tối đa 320K khi mua Bổ Sung Canxi Hỗ Trợ Loãng Xương Corbiere Calcium Plus Sanofi (H/30o/10ml)',
    },
    {
      label: 'GIẢM 9.4%',
      discountPercent: 0.094,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bổ Sung Canxi Hỗ Trợ Loãng Xương Corbiere Calcium Plus Sanofi (H/30o/10ml)',
    },
  ],
  2: [
    {
      label: 'GIẢM 4.87%',
      discountPercent: 0.0487,
      maxDiscountVnd: 70_000,
      description:
        'Giảm tối đa 70K khi mua Acemuc acetylcystein 200mg sanofi (hộp/30viên nang)',
    },
    {
      label: 'GIẢM 5.4%',
      discountPercent: 0.054,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc acetylcystein 200mg sanofi (hộp/30viên nang)',
    },
  ],
  3: [
    {
      label: 'GIẢM 7.03%',
      discountPercent: 0.0703,
      maxDiscountVnd: 70_000,
      description:
        'Giảm tối đa 70K khi mua Acemuc acetylcystein 200mg sanofi (Hộp/30gói/1gram)',
    },
    {
      label: 'GIẢM 21.94%',
      discountPercent: 0.2194,
      maxDiscountVnd: 40_000,
      description:
        'Giảm tối đa 40K khi mua Acemuc acetylcystein 200mg sanofi (Hộp/30gói/1gram)',
    },
    {
      label: 'GIẢM 7.3%',
      discountPercent: 0.073,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc acetylcystein 200mg sanofi (Hộp/30gói/1gram)',
    },
  ],
  4: [
    {
      label: 'GIẢM 0.73%',
      discountPercent: 0.0073,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc Kids Acetylcystein 100mg Sanofi (hộp/30gói/0.5gram)',
    },
    {
      label: 'GIẢM 1.7%',
      discountPercent: 0.017,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Acemuc Kids Acetylcystein 100mg Sanofi (hộp/30gói/0.5gram)',
    },
  ],
  5: [
    {
      label: 'GIẢM 1.69%',
      discountPercent: 0.0169,
      maxDiscountVnd: 30_000,
      description: 'Giảm tối đa 30K khi mua Magne B6 Corbiere Sanofi (h/50v)',
    },
    {
      label: 'GIẢM 0.1%',
      discountPercent: 0.001,
      maxDiscountVnd: 30_000,
      description: 'Giảm tối đa 30K khi mua Magne B6 Corbiere Sanofi (h/50v)',
    },
    {
      label: 'GIẢM 8.73%',
      discountPercent: 0.0873,
      maxDiscountVnd: 18_000,
      requiresMinQty: 1,
      description:
        'Mừng bạn trở lại_Giảm tối đa 18K khi mua từ 1 sản phẩm Magne B6 Corbiere Sanofi (h/50v)',
    },
  ],
  6: [
    {
      label: 'GIẢM 8.5%',
      discountPercent: 0.085,
      maxDiscountVnd: 50_000,
      requiresMinQty: 1,
      description:
        'Giảm tối đa 50K khi mua từ 1 sản phẩm Telfast hd fexofenadin 180mg sanofi (hộp/30 viên)',
    },
    {
      label: 'GIẢM 8.2%',
      discountPercent: 0.082,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast hd fexofenadin 180mg sanofi (hộp/30 viên)',
    },
  ],
  7: [
    {
      label: 'GIẢM 0.61%',
      discountPercent: 0.0061,
      maxDiscountVnd: 50_000,
      requiresMinQty: 1,
      description:
        'Giảm tối đa 50K khi mua từ 1 sản phẩm Telfast bd fexofenadin 60mg sanofi (hộp/30 viên nén)',
    },
    {
      label: 'GIẢM 11.4%',
      discountPercent: 0.114,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast bd fexofenadin 60mg sanofi (hộp/30 viên nén)',
    },
  ],
  8: [
    {
      label: 'GIẢM 10.4%',
      discountPercent: 0.104,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Telfast kids fexofenadin 30mg sanofi (hộp/10 viên nén)',
    },
  ],
  9: [
    {
      label: 'GIẢM 11.8%',
      discountPercent: 0.118,
      maxDiscountVnd: 50_000,
      requiresMinQty: 1,
      description:
        'Giảm tối đa 50K khi mua từ 1 sản phẩm No-spa drotaverin 40mg sanofi (hộp/50 viên nén)',
    },
    {
      label: 'GIẢM 1.9%',
      discountPercent: 0.019,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua No-spa drotaverin 40mg sanofi (hộp/50 viên nén)',
    },
  ],
  10: [
    {
      label: 'GIẢM 2.04%',
      discountPercent: 0.0204,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon kids bromhexin 4mg/5ml sanofi (chai/60ml)',
    },
    {
      label: 'GIẢM 3.2%',
      discountPercent: 0.032,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon kids bromhexin 4mg/5ml sanofi (chai/60ml)',
    },
  ],
  12: [
    {
      label: 'GIẢM 4.1%',
      discountPercent: 0.041,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Enterogermina Gut Restore 4 billion/5ml Opella (Hộp/20ống/5ml)',
    },
  ],
  14: [
    {
      label: 'GIẢM 4.75%',
      discountPercent: 0.0475,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon bromhexin 8mg sanofi (hộp/30 viên nén)',
    },
    {
      label: 'GIẢM 4.5%',
      discountPercent: 0.045,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Bisolvon bromhexin 8mg sanofi (hộp/30 viên nén)',
    },
  ],
  15: [
    {
      label: 'GIẢM 7.6%',
      discountPercent: 0.076,
      maxDiscountVnd: 50_000,
      requiresMinQty: 1,
      description:
        'Giảm tối đa 50K khi mua từ 1 sản phẩm Buscopan hyoscine 10mg sanofi (hộp/100 viên nén)',
    },
    {
      label: 'GIẢM 6.1%',
      discountPercent: 0.061,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Buscopan hyoscine 10mg sanofi (hộp/100 viên nén)',
    },
  ],
  16: [
    {
      label: 'GIẢM 7.1%',
      discountPercent: 0.071,
      maxDiscountVnd: 50_000,
      requiresMinQty: 2,
      description:
        'Giảm tối đa 50K khi mua từ 2 sản phẩm No-spa forte drotaverin 80mg sanofi (hộp/20 viên nén)',
    },
  ],
  21: [
    {
      label: 'GIẢM 4.97%',
      discountPercent: 0.0497,
      maxDiscountVnd: 60_000,
      description:
        'Giảm tối đa 60K khi mua Phosphalugel sanofi (hộp/26gói/20gram)',
    },
    {
      label: 'GIẢM 4.6%',
      discountPercent: 0.046,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Phosphalugel sanofi (hộp/26gói/20gram)',
    },
    {
      label: 'GIẢM 15%',
      discountPercent: 0.15,
      maxDiscountVnd: 60_000,
      description:
        'Mừng bạn trở lại - Giảm tối đa 60K khi mua Phosphalugel sanofi (hộp/26gói/20gram)',
    },
    {
      label: 'GIẢM 11.7%',
      discountPercent: 0.117,
      maxDiscountVnd: 28_000,
      requiresMinQty: 1,
      description:
        'Mừng bạn trở lại_Giảm tối đa 28K khi mua từ 1 sản phẩm Phosphalugel sanofi (hộp/26gói/20gram)',
    },
  ],
  26: [
    {
      label: 'GIẢM 4.53%',
      discountPercent: 0.0453,
      maxDiscountVnd: 70_000,
      description:
        'Giảm tối đa 70K khi mua Calcium corbiere kids extra sanofi (hộp/30ống/5ml)',
    },
    {
      label: 'GIẢM 13.8%',
      discountPercent: 0.138,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua Calcium corbiere kids extra sanofi (hộp/30ống/5ml)',
    },
  ],
  28: [
    {
      label: 'GIẢM 2.4%',
      discountPercent: 0.024,
      maxDiscountVnd: 1_000_000,
      requiresExactQty: 100,
      description:
        'Giảm tối đa 1TR khi mua 100 Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
    {
      label: 'GIẢM 4.72%',
      discountPercent: 0.0472,
      maxDiscountVnd: 60_000,
      requiresMinQty: 1,
      description:
        'Giảm tối đa 60K khi mua từ 1 sản phẩm Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
    {
      label: 'GIẢM 0.98%',
      discountPercent: 0.0098,
      maxDiscountVnd: 50_000,
      description:
        'Giảm tối đa 50K khi mua Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
  ],
  29: [
    {
      label: 'GIẢM 1.1%',
      discountPercent: 0.011,
      maxDiscountVnd: 30_000,
      description:
        'Giảm tối đa 30K khi mua No-spa drotaverin 40mg/2ml sanofi (hộp/25ống/2ml)',
    },
  ],
  30: [
    {
      label: 'GIẢM 12.94%',
      discountPercent: 0.1294,
      maxDiscountVnd: 280_000,
      description:
        'Giảm tối đa 280K khi mua Enterogermina gut defense 2 billion/5ml Opella (H/20o/5ml)',
    },
  ],
};

/**
 * CTKM kênh BM NO CVM (COMBO).
 * `referenceLineBaseVnd`: cột GIÁ GỐC (tổng dòng). `comboPackCount`: số hộp sau “Combo” → giá gốc/hộp = GIÁ GỐC ÷ comboPackCount.
 */
export const BM_NO_CVM_COMBO_CTKM_BY_PRODUCT_ID: Readonly<Record<number, readonly BmCvmCtkmEntry[]>> = {
  30: [
    {
      label: 'GIẢM 14.6%',
      discountPercent: 0.146,
      maxDiscountVnd: 11_000_000,
      requiresMinQty: 360,
      referenceLineBaseVnd: 6_514_200,
      comboPackCount: 36,
      description:
        'Giảm tối đa 11TR khi mua 10 Combo 36 Enterogermina gut defense 2 billion/5ml Opella (H/20o/5ml)',
    },
  ],
  14: [
    {
      label: 'GIẢM 7.35%',
      discountPercent: 0.0735,
      maxDiscountVnd: 5_240_000,
      requiresMinQty: 238,
      referenceLineBaseVnd: 14_249_100,
      comboPackCount: 238,
      description:
        'Giảm tối đa 5240K khi mua Combo 238 Bisolvon bromhexin 8mg sanofi (hộp/30 viên nén)',
    },
  ],
  1: [
    {
      label: 'GIẢM 11.4%',
      discountPercent: 0.114,
      maxDiscountVnd: 5_130_000,
      requiresMinQty: 200,
      referenceLineBaseVnd: 4_157_100,
      comboPackCount: 20,
      description:
        'Giảm tối đa 5130K khi mua 10 Combo 20 Bổ Sung Canxi Hỗ Trợ Loãng Xương Corbiere Calcium Plus Sanofi (H/30o/10ml)',
    },
    {
      label: 'GIẢM 10.12%',
      discountPercent: 0.1012,
      maxDiscountVnd: 2_170_000,
      requiresMinQty: 20,
      referenceLineBaseVnd: 4_157_100,
      comboPackCount: 20,
      description:
        'Giảm tối đa 2170K khi mua Combo 20 Bổ Sung Canxi Hỗ Trợ Loãng Xương Corbiere Calcium Plus Sanofi (H/30o/10ml)',
    },
  ],
  28: [
    {
      label: 'GIẢM 1.64%',
      discountPercent: 0.0164,
      maxDiscountVnd: 3_240_000,
      requiresMinQty: 200,
      referenceLineBaseVnd: 4_024_000,
      comboPackCount: 20,
      description:
        'Giảm tối đa 3240K khi mua 10 Combo 20 Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
    {
      label: 'GIẢM 0.62%',
      discountPercent: 0.0062,
      maxDiscountVnd: 570_000,
      requiresMinQty: 20,
      referenceLineBaseVnd: 4_024_000,
      comboPackCount: 20,
      description:
        'Giảm tối đa 570K khi mua Combo 20 Calcium corbiere extra sanofi (hộp/30ống/10ml)',
    },
  ],
  3: [
    {
      label: 'GIẢM 6.78%',
      discountPercent: 0.0678,
      maxDiscountVnd: 2_890_000,
      requiresMinQty: 96,
      referenceLineBaseVnd: 8_515_600,
      comboPackCount: 96,
      description:
        'Giảm tối đa 2890K khi mua Combo 96 Acemuc acetylcysteine 200mg sanofi (Hộp/30gói/1gram)',
    },
  ],
  2: [
    {
      label: 'GIẢM 4.52%',
      discountPercent: 0.0452,
      maxDiscountVnd: 1_810_000,
      requiresMinQty: 98,
      referenceLineBaseVnd: 7_966_000,
      comboPackCount: 98,
      description:
        'Giảm tối đa 1810K khi mua Combo 98 Acemuc acetylcysteine 200mg sanofi (hộp/30viên nang)',
    },
  ],
  26: [
    {
      label: 'GIẢM 4.8%',
      discountPercent: 0.048,
      maxDiscountVnd: 1_720_000,
      requiresMinQty: 200,
      referenceLineBaseVnd: 2_982_200,
      comboPackCount: 20,
      description:
        'Giảm tối đa 1720K khi mua 10 Combo 20 Calcium corbiere kids extra sanofi (hộp/30ống/5ml)',
    },
    {
      label: 'GIẢM 5.05%',
      discountPercent: 0.0505,
      maxDiscountVnd: 700_000,
      requiresMinQty: 20,
      referenceLineBaseVnd: 2_982_200,
      comboPackCount: 20,
      description:
        'Giảm tối đa 700K khi mua Combo 20 Calcium corbiere kids extra sanofi (hộp/30ống/5ml)',
    },
  ],
  5: [
    {
      label: 'GIẢM 1.72%',
      discountPercent: 0.0172,
      maxDiscountVnd: 1_380_000,
      requiresMinQty: 160,
      referenceLineBaseVnd: 15_909_700,
      comboPackCount: 160,
      description:
        'Giảm tối đa 1380K khi mua Combo 160 Magne B6 Corbiere Sanofi (hộp/50 viên nén)',
    },
  ],
  4: [
    {
      label: 'GIẢM 2.45%',
      discountPercent: 0.0245,
      maxDiscountVnd: 730_000,
      requiresMinQty: 96,
      referenceLineBaseVnd: 5_899_600,
      comboPackCount: 96,
      description:
        'Giảm tối đa 730K khi mua Combo 96 Acemuc Kids Acetylcystein 100mg Sanofi (hộp/30gói/0.5gram)',
    },
  ],
  21: [
    {
      label: 'GIẢM 4.95%',
      discountPercent: 0.0495,
      maxDiscountVnd: 710_000,
      requiresMinQty: 24,
      referenceLineBaseVnd: 2_850_600,
      comboPackCount: 24,
      description:
        'Giảm tối đa 710K khi mua Combo 24 Phosphalugel sanofi (hộp/26gói/20gram)',
    },
  ],
  10: [
    {
      label: 'GIẢM 4.48%',
      discountPercent: 0.0448,
      maxDiscountVnd: 590_000,
      requiresMinQty: 66,
      referenceLineBaseVnd: 2_611_700,
      comboPackCount: 66,
      description:
        'Giảm tối đa 590K khi mua Combo 66 Bisolvon kids bromhexin 4mg/5ml sanofi (chai/60ml)',
    },
  ],
};

// Nhóm Telfast: KM theo doanh số đơn hàng (dùng cho getDiscountPercent)
// readonly number[] (không as const) để .includes(cartItem.id: number) hợp lệ với TypeScript
export const TELFAST_GROUP_IDS: readonly number[] = [7, 8];

// CTKM OPELLA 3/2026: DummyBox Local — đơn từ 1.000.000 (sau CK) nhóm SP bên + ít nhất 01 CORBIERE CALCIUM PLUS 3SUPX10 10ML → giảm 150k
export const DUMMY_BOX_LOCAL_PRODUCT_IDS = [1, 6, 7, 26] as const; // Corbiere Calcium Plus, Telfast HD/BD, Calcium Corbiere Extra 5ml
export const DUMMY_BOX_LOCAL_REQUIRED_PRODUCT_ID = 1; // CORBIERE CALCIUM PLUS 3SUPX10 10ML
export const DUMMY_BOX_LOCAL_MIN_AMOUNT = 1_000_000;

// CTKM OPELLA 3/2026: DummyBox Import — đơn từ 1.000.000 (sau CK) nhóm bên + ít nhất 01 PHARMATON VITALITY → giảm 150k
// Pharmaton Energy (id 17): tính giá gốc, ko tính chiết khấu 29.5%
export const DUMMY_BOX_IMPORT_PRODUCT_IDS = [17, 18, 20, 27, 12, 30] as const; // Pharmaton Energy, Essent, Fizzi, Vitality + Enterogermina (GUT 4B, 2B/20)
export const DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID = 17; // Khi tính tổng điều kiện: dùng originalPrice (ko áp CK 29.5%)
export const DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID = 27; // PHARMATON VITALITY 40MG TAB BT30 M24 VN
export const DUMMY_BOX_IMPORT_MIN_AMOUNT = 1_000_000;

export const DUMMY_BOX_DISCOUNT = 150_000;

// CTKM CORBIERE CALCIUM PLUS: cứ mỗi 21 hộp được giảm trực tiếp 4.76%
export const CALCIPLUS_PROMO_PACK_SIZE = 21;
export const CALCIPLUS_PROMO_DISCOUNT_PERCENT = 0.0476;
/** CTKM gói 4.76% dùng chung cho CORBIERE CALCIUM PLUS + ENTEROGERMINA 2B/20 */
export const PACK_476_PRODUCT_IDS: readonly number[] = [1, 30];

/**
 * Tab Giá tham khảo · cột GIGA: với SP trong PACK_476 (id 1, 30), khi SL ≥ 21 hộp,
 * % CK tham chiếu = (% CK cao nhất tại các mốc &lt; 21h mà SL đạt) + CALCIPLUS_PROMO_DISCOUNT_PERCENT (4,76%).
 * Logic cố định trong `getGigaReferenceDiscountPercent` (utils/calculations.ts).
 */

// Nhóm OSTELIN: KM theo tổng basePrice nhóm (dùng cho getDiscountPercent)
export const OSTELIN_GROUP_IDS: readonly number[] = [22, 23, 24, 25];

/** Theo dõi gói Ostelin 60V (5h ck 21.67%) — khớp sheet Google & Apps Script */
export const OSTELIN_60V_PRODUCT_ID = 25;
/** Tối thiểu 5 hộp để áp CK 21.67% & ghi theo dõi (1 gói/đơn đủ điều kiện) */
export const OSTELIN_60V_GOI_MIN_QTY = 5;
export const OSTELIN_60V_GOI_SHEET = 'OSTELIN_60V_GOI';
/** Theo dõi gói 4.76% (CalciPlus + Enterogermina 2B/20) */
export const CALCIPLUS_GOI_SHEET = 'CALCIPLUS_GOI';

export const CALCIPLUS_PRODUCT_ID = 1;

