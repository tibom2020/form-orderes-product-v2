import type { CartItem } from '../types';
import {
  STORE_TIER_CONFIGS,
  type StoreTierConfig,
  type StoreTierId,
} from '../components/StoreProgramRegistrationTab';
/** Mã CTKM / dòng ghi chú đơn Perfect Store tháng 5/2026 */
export const PS_ON_INVOICE_NOTE_MARKER = 'SPECIAL_PS0526';

/** Ghi chú đơn cũ — vẫn gỡ khi tắt CTKM / đổi KH */
const PS_ON_INVOICE_NOTE_MARKER_LEGACY = 'CK PS On Invoice 25%';

/** Giảm Net theo bảng CTKM (sau TNCN ~1.5%) — legacy reward */
const NET_BY_REWARD: Record<number, number> = {
  4_000_000: 3_940_000,
  3_000_000: 2_955_000,
  2_400_000: 2_364_000,
  1_600_000: 1_576_000,
  1_200_000: 1_182_000,
  300_000: 295_500,
};

/** Giảm Net / suất — tier multi-suất (gross × ~0.985) */
const NET_BY_DISCOUNT_PER_SUAT: Record<number, number> = {
  788_000: Math.round(788_000 * 0.985),
  985_000: Math.round(985_000 * 0.985),
  1_182_000: Math.round(1_182_000 * 0.985),
};

export interface PsMultiSuatRules {
  minPerSuat: number;
  discountPerSuat: number;
  maxSuatPerCustomer: number;
}

const MULTI_SUAT_BY_TIER: Partial<Record<StoreTierId, PsMultiSuatRules>> = {
  gold: { minPerSuat: 3_200_000, discountPerSuat: 788_000, maxSuatPerCustomer: 2 },
  platinum: { minPerSuat: 4_800_000, discountPerSuat: 1_182_000, maxSuatPerCustomer: 2 },
  flagship: { minPerSuat: 4_000_000, discountPerSuat: 985_000, maxSuatPerCustomer: 3 },
};

export function getPsMultiSuatRules(tierId: StoreTierId): PsMultiSuatRules | null {
  return MULTI_SUAT_BY_TIER[tierId] ?? null;
}

export function getPsSuatMaxForTier(tier: StoreTierConfig): number {
  const rules = getPsMultiSuatRules(tier.id);
  return rules?.maxSuatPerCustomer ?? 1;
}

export function getPsSuatRemaining(tier: StoreTierConfig, usedSuat: number): number {
  const max = getPsSuatMaxForTier(tier);
  return Math.max(0, max - Math.max(0, Math.floor(usedSuat)));
}

function normalizeFinalStoreTypeQ2Key(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*/g, '+');
}

export function findTierConfigByFinalStoreTypeQ2(cell: string): StoreTierConfig | null {
  const key = normalizeFinalStoreTypeQ2Key(cell);
  if (!key) return null;
  for (const t of STORE_TIER_CONFIGS) {
    if (normalizeFinalStoreTypeQ2Key(t.label) === key) return t;
  }
  return null;
}

export function getOnInvoiceMinOrder(tier: StoreTierConfig): number {
  const rules = getPsMultiSuatRules(tier.id);
  if (rules) return rules.minPerSuat;
  return tier.reward * 4;
}

export function getOnInvoiceDiscountGross(tier: StoreTierConfig): number {
  const rules = getPsMultiSuatRules(tier.id);
  if (rules) return rules.discountPerSuat;
  return tier.reward;
}

export function getOnInvoiceDiscountNet(tier: StoreTierConfig, discountGross?: number): number {
  const gross = discountGross ?? getOnInvoiceDiscountGross(tier);
  const rules = getPsMultiSuatRules(tier.id);
  if (rules) {
    return NET_BY_DISCOUNT_PER_SUAT[rules.discountPerSuat] ?? Math.round(gross * 0.985);
  }
  return NET_BY_REWARD[tier.reward] ?? Math.round(tier.reward * 0.985);
}

/** Gói PS 25% = NO (hoặc trống) → được hiện nút CK (tier legacy) */
export function isGoiPs25No(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) return true;
  if (t === 'no' || t === 'n' || t === '0' || t.includes('chưa')) return true;
  if (t === 'yes' || t === 'y' || t === '1' || t.includes('đã đặt') || t.includes('da dat')) return false;
  if (t.includes('đã') && !t.includes('chưa')) return false;
  return true;
}

export function isGoiPs25Yes(raw: string): boolean {
  return !isGoiPs25No(raw) && raw.trim() !== '';
}

/** Đơn giá khi CK PS 25% — chỉ basePrice, không CK tháng/combo */
export function getPsCartUnitPrice(item: { basePrice?: number; price: number }): number {
  return item.basePrice ?? item.price;
}

/** Ghi đè price = basePrice để gửi đơn / hiển thị không lẫn CK tháng */
export function cartItemForPsPricing(item: CartItem): CartItem {
  const unit = getPsCartUnitPrice(item);
  return { ...item, price: unit };
}

export function calcCartBaseSubtotal(items: CartItem[]): number {
  return items.reduce((s, item) => s + getPsCartUnitPrice(item) * item.quantity, 0);
}

export interface PsOrderTotals {
  baseSubtotal: number;
  minOrder: number;
  minPerSuat: number;
  discountGross: number;
  discountNet: number;
  discountPerSuat: number;
  eligible: boolean;
  /** Tổng chưa đúng bội số min/suất (multi-suất) */
  needsExactMultiple: boolean;
  finalAmount: number;
  tierLabel: string;
  suatApplied: number;
  suatFromCart: number;
  suatMax: number;
  suatUsed: number;
  suatRemaining: number;
  isMultiSuat: boolean;
}

export interface CalcPsOrderTotalsOptions {
  suatToApply?: number;
  usedSuatFromSheet?: number;
}

export function calcPsOrderTotals(
  items: CartItem[],
  tier: StoreTierConfig,
  options?: CalcPsOrderTotalsOptions
): PsOrderTotals {
  const baseSubtotal = calcCartBaseSubtotal(items);
  const rules = getPsMultiSuatRules(tier.id);
  const usedSuat = Math.max(0, Math.floor(options?.usedSuatFromSheet ?? 0));
  const suatMax = getPsSuatMaxForTier(tier);
  const suatRemaining = getPsSuatRemaining(tier, usedSuat);

  if (!rules) {
    const minOrder = tier.reward * 4;
    const discountGross = tier.reward;
    const discountNet = getOnInvoiceDiscountNet(tier, discountGross);
    const eligible = baseSubtotal >= minOrder && suatRemaining > 0;
    const suatApplied = eligible ? 1 : 0;
    return {
      baseSubtotal,
      minOrder,
      minPerSuat: minOrder,
      discountGross: suatApplied ? discountGross : 0,
      discountNet: suatApplied ? discountNet : 0,
      discountPerSuat: discountGross,
      eligible,
      needsExactMultiple: false,
      finalAmount: Math.max(0, baseSubtotal - (suatApplied ? discountGross : 0)),
      tierLabel: tier.label,
      suatApplied,
      suatFromCart: eligible ? 1 : 0,
      suatMax,
      suatUsed: usedSuat,
      suatRemaining,
      isMultiSuat: false,
    };
  }

  const { minPerSuat, discountPerSuat } = rules;
  const suatFromCart =
    baseSubtotal >= minPerSuat ? Math.floor(baseSubtotal / minPerSuat) : 0;
  const maxSuatThisOrder = Math.min(suatFromCart, suatRemaining);
  let suatApplied = 0;
  if (maxSuatThisOrder >= 1) {
    if (options?.suatToApply != null && options.suatToApply > 0) {
      suatApplied = Math.min(Math.floor(options.suatToApply), maxSuatThisOrder);
    } else if (options?.suatToApply == null) {
      suatApplied = maxSuatThisOrder;
    }
  }

  const minOrder = suatApplied * minPerSuat;
  const discountGross = suatApplied * discountPerSuat;
  const discountNet =
    suatApplied > 0
      ? (NET_BY_DISCOUNT_PER_SUAT[discountPerSuat] ?? Math.round(discountPerSuat * 0.985)) *
        suatApplied
      : 0;
  const eligible =
    suatRemaining > 0 && suatApplied >= 1 && baseSubtotal >= minOrder;

  return {
    baseSubtotal,
    minOrder,
    minPerSuat,
    discountGross: eligible ? discountGross : 0,
    discountNet: eligible ? discountNet : 0,
    discountPerSuat,
    eligible,
    needsExactMultiple: false,
    finalAmount: Math.max(0, baseSubtotal - (eligible ? discountGross : 0)),
    tierLabel: tier.label,
    suatApplied: eligible ? suatApplied : 0,
    suatFromCart,
    suatMax,
    suatUsed: usedSuat,
    suatRemaining,
    isMultiSuat: true,
  };
}

/** Ghi chú đơn: SPECIAL_PS0526 - {tier} {suất đơn}/{suất tối đa} — vd. Platinum 1/2 */
export function buildPsOnInvoiceNoteLine(
  tierLabel?: string,
  suatApplied?: number,
  suatMax?: number
): string {
  const label = String(tierLabel ?? '').trim();
  if (!label) return PS_ON_INVOICE_NOTE_MARKER;
  const n = Math.floor(suatApplied ?? 0);
  const max = Math.max(1, Math.floor(suatMax ?? 1));
  if (n >= 1) {
    return `${PS_ON_INVOICE_NOTE_MARKER} - ${label} ${n}/${max}`;
  }
  return `${PS_ON_INVOICE_NOTE_MARKER} - ${label}`;
}

export function stripPsOnInvoiceNoteLines(note: string): string {
  return note
    .split('\n')
    .map(l => l.trim())
    .filter(
      l =>
        l &&
        !l.includes(PS_ON_INVOICE_NOTE_MARKER) &&
        !l.includes(PS_ON_INVOICE_NOTE_MARKER_LEGACY)
    )
    .join('\n');
}

export function mergePsOnInvoiceNote(note: string, line: string): string {
  const base = stripPsOnInvoiceNoteLines(note);
  return base ? `${base}\n${line}` : line;
}
