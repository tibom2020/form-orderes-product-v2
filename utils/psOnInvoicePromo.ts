import type { CartItem } from '../types';
import {
  STORE_TIER_CONFIGS,
  type StoreTierConfig,
} from '../components/StoreProgramRegistrationTab';
export const PS_ON_INVOICE_NOTE_MARKER = 'CK PS On Invoice 25%';

/** Giảm Net theo bảng CTKM (sau TNCN ~1.5%) */
const NET_BY_REWARD: Record<number, number> = {
  4_000_000: 3_940_000,
  3_000_000: 2_955_000,
  2_400_000: 2_364_000,
  1_600_000: 1_576_000,
  1_200_000: 1_182_000,
  300_000: 295_500,
};

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
  return tier.reward * 4;
}

export function getOnInvoiceDiscountGross(tier: StoreTierConfig): number {
  return tier.reward;
}

export function getOnInvoiceDiscountNet(tier: StoreTierConfig): number {
  return NET_BY_REWARD[tier.reward] ?? Math.round(tier.reward * 0.985);
}

/** Gói PS 25% = NO (hoặc trống) → được hiện nút CK */
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
  discountGross: number;
  discountNet: number;
  eligible: boolean;
  finalAmount: number;
  tierLabel: string;
}

export function calcPsOrderTotals(items: CartItem[], tier: StoreTierConfig): PsOrderTotals {
  const baseSubtotal = calcCartBaseSubtotal(items);
  const minOrder = getOnInvoiceMinOrder(tier);
  const discountGross = getOnInvoiceDiscountGross(tier);
  const discountNet = getOnInvoiceDiscountNet(tier);
  const eligible = baseSubtotal >= minOrder;
  const finalAmount = Math.max(0, baseSubtotal - discountGross);
  return {
    baseSubtotal,
    minOrder,
    discountGross,
    discountNet,
    eligible,
    finalAmount,
    tierLabel: tier.label,
  };
}

export function buildPsOnInvoiceNoteLine(): string {
  return PS_ON_INVOICE_NOTE_MARKER;
}

export function stripPsOnInvoiceNoteLines(note: string): string {
  return note
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.includes(PS_ON_INVOICE_NOTE_MARKER))
    .join('\n');
}

export function mergePsOnInvoiceNote(note: string, line: string): string {
  const base = stripPsOnInvoiceNoteLines(note);
  return base ? `${base}\n${line}` : line;
}
