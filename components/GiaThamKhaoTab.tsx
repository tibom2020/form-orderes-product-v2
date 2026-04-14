import React, { useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  PRODUCTS,
  PROMO_UPDATE_DATE,
  OSTELIN_GROUP_IDS,
  TELFAST_GROUP_IDS,
  PACK_476_PRODUCT_IDS,
  BM_CVM_BASE_PRICE_VND,
  BM_CVM_NOT_SOLD_IDS,
  BM_CVM_CTKM_BY_PRODUCT_ID,
  BM_NON_CVM_BASE_PRICE_VND,
  BM_NON_CVM_NOT_SOLD_IDS,
  BM_NO_CVM_CTKM_BY_PRODUCT_ID,
  BM_NO_CVM_COMBO_CTKM_BY_PRODUCT_ID,
  comboEntryLineValueVnd,
  comboReferencePerBoxVndFromEntry,
  computeBmCtkmDiscountVnd,
  computeBmCtkmDiscountVndCombo,
  computeBmCtkmEffectivePercent,
  computeBmCtkmEffectivePercentCombo,
  getBmCtkmWinningEntryIndices,
  getBmCtkmWinningEntryIndicesCombo,
} from '../constants';
import { formatCurrency } from '../utils/formatters';
import {
  calculateGigaReferenceLineTotal,
  getGigaPackAdjacentTierPercent,
  getGigaReferenceDiscountPercent,
} from '../utils/calculations';
import { REBATE_TIERS, formatCompact } from './dashboard/DashboardUtils';
import { TagIcon, MinusIcon, PlusIcon } from './icons';

/** Mặc định chọn Lv5 cho khối CVM (GIGA & BM CVM) — index theo REBATE_TIERS */
const DEFAULT_CVM_LV5_INDEX = REBATE_TIERS.findIndex((t) => t.level === 5);

interface GiaThamKhaoTabProps {
  products?: Product[];
}

/** Parse mốc CTKM (h/k) giống ProductCard — để hiện tích xanh khi đủ SL */
function parsePromotionTiers(product: Product) {
  if (!product.promotion)
    return [] as Array<{
      threshold: number;
      unit: string;
      percent: string;
      thresholdRaw: number;
    }>;
  const tieredMatches = Array.from(
    product.promotion.matchAll(/(\d+)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi)
  );
  if (tieredMatches.length === 0) {
    const single = product.promotion.match(/(\d+(?:\.\d+)?)\s*%/);
    if (single?.[1]) {
      return [
        {
          thresholdRaw: 1,
          unit: 'h',
          threshold: 1,
          percent: single[1],
        },
      ];
    }
    return [];
  }
  return tieredMatches
    .map((m) => {
      const thresholdRaw = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const threshold = unit === 'k' ? thresholdRaw * 1000 : thresholdRaw;
      return { thresholdRaw, unit, threshold, percent: m[3] };
    })
    .sort((a, b) => a.threshold - b.threshold);
}

function tierReached(qty: number, lineValue: number, tier: { threshold: number; unit: string }): boolean {
  const compare = tier.unit === 'k' ? lineValue : qty;
  return compare >= tier.threshold;
}

/** Mốc gói 21h CK ~4.76% — SP PACK_476 (id 1, 30), hiển thị cộng % mốc &lt;21h */
function isPack476Goi21Tier(
  productId: number,
  tier: { thresholdRaw: number; unit: string; percent: string }
): boolean {
  if (!PACK_476_PRODUCT_IDS.includes(productId) || tier.unit !== 'h') return false;
  const p = parseFloat(tier.percent);
  return tier.thresholdRaw === 21 && p >= 4.7 && p <= 4.8;
}

type GiaThamKhaoGroupKey =
  | 'acemuc'
  | 'telfast'
  | 'corbiere'
  | 'entero'
  | 'bisolvon'
  | 'buscopan_nospa'
  | 'pharmaton'
  | 'phosphalugel'
  | 'ostelin'
  | 'magne'
  | 'other';

const GIA_THAM_KHAO_GROUP_ORDER: ReadonlyArray<{
  key: GiaThamKhaoGroupKey;
  label: string;
  selectClass: string;
}> = [
  { key: 'acemuc', label: 'ACEMUC', selectClass: 'border-emerald-400/70 focus:ring-emerald-500/45 bg-emerald-50/40 dark:bg-emerald-950/25' },
  { key: 'telfast', label: 'TELFAST', selectClass: 'border-sky-400/70 focus:ring-sky-500/45 bg-sky-50/40 dark:bg-sky-950/25' },
  { key: 'corbiere', label: 'CORBIERE / CALCI', selectClass: 'border-teal-400/70 focus:ring-teal-500/45 bg-teal-50/35 dark:bg-teal-950/25' },
  { key: 'entero', label: 'ENTEROGERMINA', selectClass: 'border-cyan-400/70 focus:ring-cyan-500/45 bg-cyan-50/35 dark:bg-cyan-950/25' },
  { key: 'bisolvon', label: 'BISOLVON', selectClass: 'border-indigo-400/70 focus:ring-indigo-500/45 bg-indigo-50/35 dark:bg-indigo-950/25' },
  { key: 'buscopan_nospa', label: 'BUSCOPAN / NO-SPA', selectClass: 'border-orange-400/70 focus:ring-orange-500/45 bg-orange-50/35 dark:bg-orange-950/20' },
  { key: 'pharmaton', label: 'PHARMATON', selectClass: 'border-violet-400/70 focus:ring-violet-500/45 bg-violet-50/35 dark:bg-violet-950/25' },
  { key: 'phosphalugel', label: 'PHOSPHALUGEL', selectClass: 'border-amber-400/70 focus:ring-amber-500/45 bg-amber-50/35 dark:bg-amber-950/20' },
  { key: 'ostelin', label: 'OSTELIN', selectClass: 'border-lime-400/70 focus:ring-lime-500/45 bg-lime-50/40 dark:bg-lime-950/20' },
  { key: 'magne', label: 'MAGNE-B6', selectClass: 'border-fuchsia-400/70 focus:ring-fuchsia-500/45 bg-fuchsia-50/30 dark:bg-fuchsia-950/20' },
  { key: 'other', label: 'KHÁC', selectClass: 'border-slate-300/80 focus:ring-slate-400/40 bg-white dark:bg-slate-800' },
];

function giaThamKhaoGroupKey(p: Product): GiaThamKhaoGroupKey {
  const n = p.name.toUpperCase();
  if (n.includes('ACEMUC')) return 'acemuc';
  if (n.includes('TELFAST')) return 'telfast';
  if (n.includes('CORBIERE') || n.includes('CALCIUM') || /^CALCI\b/i.test(p.name.trim())) return 'corbiere';
  if (n.includes('ENTEROGERMINA')) return 'entero';
  if (n.includes('BISOLVON')) return 'bisolvon';
  if (n.includes('BUSCOPAN') || n.includes('NO-SPA') || n.includes('NOSPA')) return 'buscopan_nospa';
  if (n.includes('PHARMATON')) return 'pharmaton';
  if (n.includes('PHOSPHALUGEL')) return 'phosphalugel';
  if (n.includes('OSTELIN')) return 'ostelin';
  if (n.includes('MAGNE')) return 'magne';
  return 'other';
}

const KHI_MUA_IN_DESC = /(\s+khi mua\s+)/i;

/** Ghi chú điều kiện "Giảm tối đa …" (trước "khi mua") — hiển thị màu đỏ */
function BmCvmCtkmDescriptionText({ description }: { description: string }) {
  const parts = description.split(KHI_MUA_IN_DESC);
  if (parts.length === 3 && /^Giảm tối đa/i.test(parts[0].trim())) {
    return (
      <>
        <span className="font-semibold text-red-600 dark:text-red-400">{parts[0]}</span>
        <span className="text-slate-600 dark:text-slate-300">
          {parts[1]}
          {parts[2]}
        </span>
      </>
    );
  }
  return <span className="text-slate-600 dark:text-slate-300">{description}</span>;
}

const GiaThamKhaoTab: React.FC<GiaThamKhaoTabProps> = ({ products = PRODUCTS }) => {
  const sorted = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [products]
  );

  const productsByGiaGroup = useMemo(() => {
    const m = new Map<GiaThamKhaoGroupKey, Product[]>();
    for (const { key } of GIA_THAM_KHAO_GROUP_ORDER) m.set(key, []);
    for (const p of sorted) {
      m.get(giaThamKhaoGroupKey(p))!.push(p);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return m;
  }, [sorted]);

  const [productId, setProductId] = useState<number>(() => sorted[0]?.id ?? 0);
  const [qtyStr, setQtyStr] = useState<string>('1');
  const [selectedCvmIndex, setSelectedCvmIndex] = useState<number | null>(() =>
    DEFAULT_CVM_LV5_INDEX >= 0 ? DEFAULT_CVM_LV5_INDEX : null
  );

  const product = useMemo(
    () => sorted.find((p) => p.id === productId) ?? sorted[0] ?? null,
    [sorted, productId]
  );

  const selectGroupClass = useMemo(() => {
    if (!product) return GIA_THAM_KHAO_GROUP_ORDER.find((g) => g.key === 'other')!.selectClass;
    const k = giaThamKhaoGroupKey(product);
    return GIA_THAM_KHAO_GROUP_ORDER.find((g) => g.key === k)?.selectClass ?? '';
  }, [product]);

  const qty = Math.max(0, parseInt(qtyStr, 10) || 0);

  const gigaCalc = useMemo(() => {
    if (!product || qty <= 0) {
      return {
        lineTotal: 0,
        discountPercent: 0,
        compareValue: 0,
        tiers: [] as ReturnType<typeof parsePromotionTiers>,
        packAdjacentPct: 0,
      };
    }
    const isTelfast = TELFAST_GROUP_IDS.includes(product.id);
    const isOstelin = OSTELIN_GROUP_IDS.includes(product.id);
    const linePriceTotal = product.price * qty;
    const telfastGroupTotal = isTelfast ? linePriceTotal : 0;
    const ostelinGroupBaseTotal = isOstelin ? (product.basePrice ?? 0) * qty : 0;
    const compareValue = isTelfast
      ? telfastGroupTotal
      : isOstelin
        ? ostelinGroupBaseTotal
        : linePriceTotal;
    const discountPercent = getGigaReferenceDiscountPercent(product.promotion, qty, compareValue, product.id);
    const lineTotal = calculateGigaReferenceLineTotal(product.price, qty, product.promotion, compareValue, product.id);
    const packAdjacentPct = getGigaPackAdjacentTierPercent(product.promotion, qty, compareValue, product.id);
    const tiers = parsePromotionTiers(product);
    return { lineTotal, discountPercent, compareValue, tiers, packAdjacentPct };
  }, [product, qty]);

  const lineTotalSauGiga = gigaCalc.lineTotal;

  const giaCuoiThangMoiHop = useMemo(() => {
    if (!product || qty <= 0) {
      return 0;
    }
    const ckThang = gigaCalc.discountPercent;
    const ckCvm = selectedCvmIndex !== null ? REBATE_TIERS[selectedCvmIndex].percent / 100 : 0;
    const factor = Math.max(0, Math.min(1, 1 - ckThang - ckCvm));
    return Math.round(product.price * factor);
  }, [product, qty, gigaCalc.discountPercent, selectedCvmIndex]);

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    []
  );

  const handleQty = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^[0-9]+$/.test(v)) setQtyStr(v);
  };

  const bumpQty = (delta: number) => {
    const n = parseInt(qtyStr, 10);
    const base = Number.isNaN(n) || qtyStr === '' ? 0 : n;
    const next = Math.max(0, base + delta);
    setQtyStr(String(next));
  };

  const bmCvmBaseVnd = product ? BM_CVM_BASE_PRICE_VND[product.id] : undefined;
  const bmCvmNotSold =
    product != null &&
    (BM_CVM_NOT_SOLD_IDS.includes(product.id) || (bmCvmBaseVnd !== undefined && bmCvmBaseVnd <= 0));

  const bmCvmCtkmEntries = product ? BM_CVM_CTKM_BY_PRODUCT_ID[product.id] : undefined;

  const lineValueBmVnd =
    product && qty > 0 && bmCvmBaseVnd != null && bmCvmBaseVnd > 0 && !bmCvmNotSold
      ? bmCvmBaseVnd * qty
      : 0;

  const bmCtkmDiscountVnd = useMemo(
    () => computeBmCtkmDiscountVnd(lineValueBmVnd, bmCvmCtkmEntries, qty),
    [lineValueBmVnd, bmCvmCtkmEntries, qty]
  );

  const bmCtkmEffectivePercent = useMemo(
    () => computeBmCtkmEffectivePercent(lineValueBmVnd, bmCvmCtkmEntries, qty),
    [lineValueBmVnd, bmCvmCtkmEntries, qty]
  );

  const giaCuoiBmCvmMoiHop = useMemo(() => {
    if (!product || qty <= 0 || bmCvmNotSold || bmCvmBaseVnd == null || bmCvmBaseVnd <= 0) {
      return 0;
    }
    const ckCvm = selectedCvmIndex !== null ? REBATE_TIERS[selectedCvmIndex].percent / 100 : 0;
    const afterCtkm = Math.max(0, lineValueBmVnd - bmCtkmDiscountVnd);
    const afterCvm = afterCtkm * (1 - ckCvm);
    return Math.round(afterCvm / qty);
  }, [product, qty, bmCvmNotSold, bmCvmBaseVnd, lineValueBmVnd, bmCtkmDiscountVnd, selectedCvmIndex]);

  const bmTongSauCkCtkmVnd = useMemo(() => {
    if (lineValueBmVnd <= 0) return 0;
    return Math.round(lineValueBmVnd - bmCtkmDiscountVnd);
  }, [lineValueBmVnd, bmCtkmDiscountVnd]);

  const bmSauCkCtkmMoiHopVnd = useMemo(() => {
    if (qty <= 0 || bmTongSauCkCtkmVnd <= 0) return 0;
    return Math.round(bmTongSauCkCtkmVnd / qty);
  }, [bmTongSauCkCtkmVnd, qty]);

  const bmNonCvmBaseVnd = product ? BM_NON_CVM_BASE_PRICE_VND[product.id] : undefined;
  const bmNonCvmNotSold =
    product != null &&
    (BM_NON_CVM_NOT_SOLD_IDS.includes(product.id) ||
      (bmNonCvmBaseVnd !== undefined && bmNonCvmBaseVnd <= 0));
  const lineValueBmNonVnd =
    product && qty > 0 && bmNonCvmBaseVnd != null && bmNonCvmBaseVnd > 0 && !bmNonCvmNotSold
      ? bmNonCvmBaseVnd * qty
      : 0;

  const bmNoCvmCtkmEntries = product ? BM_NO_CVM_CTKM_BY_PRODUCT_ID[product.id] : undefined;
  const bmNoCtkmDiscountVnd = useMemo(
    () => computeBmCtkmDiscountVnd(lineValueBmNonVnd, bmNoCvmCtkmEntries, qty, true),
    [lineValueBmNonVnd, bmNoCvmCtkmEntries, qty]
  );
  const bmNoCtkmEffectivePercent = useMemo(
    () => computeBmCtkmEffectivePercent(lineValueBmNonVnd, bmNoCvmCtkmEntries, qty, true),
    [lineValueBmNonVnd, bmNoCvmCtkmEntries, qty]
  );
  const bmNoTongSauCkCtkmVnd = useMemo(() => {
    if (lineValueBmNonVnd <= 0) return 0;
    return Math.round(lineValueBmNonVnd - bmNoCtkmDiscountVnd);
  }, [lineValueBmNonVnd, bmNoCtkmDiscountVnd]);
  const bmNoSauCkCtkmMoiHopVnd = useMemo(() => {
    if (qty <= 0 || bmNoTongSauCkCtkmVnd <= 0) return 0;
    return Math.round(bmNoTongSauCkCtkmVnd / qty);
  }, [bmNoTongSauCkCtkmVnd, qty]);

  const bmNoComboCtkmEntries = product ? BM_NO_CVM_COMBO_CTKM_BY_PRODUCT_ID[product.id] : undefined;
  const bmNoComboCtkmDiscountVnd = useMemo(
    () => computeBmCtkmDiscountVndCombo(lineValueBmNonVnd, bmNoComboCtkmEntries, qty, true),
    [lineValueBmNonVnd, bmNoComboCtkmEntries, qty]
  );
  const bmNoComboCtkmEffectivePercent = useMemo(
    () => computeBmCtkmEffectivePercentCombo(lineValueBmNonVnd, bmNoComboCtkmEntries, qty, true),
    [lineValueBmNonVnd, bmNoComboCtkmEntries, qty]
  );
  const bmNoComboTongSauCkCtkmVnd = useMemo(() => {
    if (qty <= 0) return 0;
    const disc = computeBmCtkmDiscountVndCombo(lineValueBmNonVnd, bmNoComboCtkmEntries, qty, true);
    if (disc <= 0) return lineValueBmNonVnd > 0 ? lineValueBmNonVnd : 0;
    const idxs = getBmCtkmWinningEntryIndicesCombo(lineValueBmNonVnd, bmNoComboCtkmEntries, qty, true);
    if (!bmNoComboCtkmEntries?.length || idxs.length === 0) {
      return Math.max(0, Math.round(lineValueBmNonVnd - disc));
    }
    const lineWin = comboEntryLineValueVnd(bmNoComboCtkmEntries[idxs[0]], qty, lineValueBmNonVnd);
    return Math.max(0, Math.round(lineWin - disc));
  }, [qty, lineValueBmNonVnd, bmNoComboCtkmEntries]);
  const bmNoComboSauCkCtkmMoiHopVnd = useMemo(() => {
    if (qty <= 0 || bmNoComboTongSauCkCtkmVnd <= 0) return 0;
    return Math.round(bmNoComboTongSauCkCtkmVnd / qty);
  }, [bmNoComboTongSauCkCtkmVnd, qty]);

  const bmCvmCtkmWinningIndices = useMemo(
    () => new Set(getBmCtkmWinningEntryIndices(lineValueBmVnd, bmCvmCtkmEntries, qty, false)),
    [lineValueBmVnd, bmCvmCtkmEntries, qty]
  );
  const bmNoCtkmWinningIndices = useMemo(
    () => new Set(getBmCtkmWinningEntryIndices(lineValueBmNonVnd, bmNoCvmCtkmEntries, qty, true)),
    [lineValueBmNonVnd, bmNoCvmCtkmEntries, qty]
  );
  const bmNoComboCtkmWinningIndices = useMemo(
    () => new Set(getBmCtkmWinningEntryIndicesCombo(lineValueBmNonVnd, bmNoComboCtkmEntries, qty, true)),
    [lineValueBmNonVnd, bmNoComboCtkmEntries, qty]
  );

  const bmNoComboDerivedPerBoxSummary = useMemo(() => {
    if (!bmNoComboCtkmEntries?.length) return null;
    const vals = bmNoComboCtkmEntries
      .map((e) => comboReferencePerBoxVndFromEntry(e))
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max, single: min === max };
  }, [bmNoComboCtkmEntries]);

  return (
    <div className="p-4 animate-fade-in max-w-[min(100%,112rem)] mx-auto">
      <div className="rounded-2xl border border-opella-green/25 dark:border-opella-green/40 bg-gradient-to-br from-white via-opella-beige/40 to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-[#142920] shadow-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-opella-green/15 dark:border-opella-green/30 bg-opella-green text-white">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <TagIcon />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">Giá tham khảo</h2>
                <p className="text-[11px] sm:text-xs text-white/85 font-medium">
                  Cập nhật CTKM: <span className="font-bold">{PROMO_UPDATE_DATE}</span>
                  <span className="mx-2 opacity-60">·</span>
                  {todayStr}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                Tên sản phẩm
              </label>
              <select
                value={product?.id ?? ''}
                onChange={(e) => {
                  setProductId(Number(e.target.value));
                  setQtyStr('1');
                }}
                className={`w-full rounded-xl border-2 text-slate-900 dark:text-white text-sm font-semibold px-3 py-2.5 outline-none focus:ring-2 transition-colors ${selectGroupClass}`}
              >
                {GIA_THAM_KHAO_GROUP_ORDER.map(({ key, label }) => {
                  const items = productsByGiaGroup.get(key);
                  if (!items?.length) return null;
                  return (
                    <optgroup key={key} label={label}>
                      {items.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.id}] {p.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div className="w-full lg:w-52 shrink-0">
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                Số lượng
              </label>
              <div className="flex items-stretch rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-opella-green/50 focus-within:border-opella-green/40">
                <button
                  type="button"
                  onClick={() => bumpQty(-1)}
                  className="shrink-0 px-3 py-2.5 border-r border-slate-200 dark:border-slate-600 bg-opella-beige/40 dark:bg-slate-700/80 text-opella-green dark:text-emerald-300 hover:bg-opella-beige dark:hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={(parseInt(qtyStr, 10) || 0) <= 0}
                  aria-label="Giảm số lượng"
                >
                  <MinusIcon />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={qtyStr}
                  onChange={handleQty}
                  className="min-w-0 flex-1 bg-transparent text-slate-900 dark:text-white text-sm font-black px-2 py-2.5 outline-none text-center"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => bumpQty(1)}
                  className="shrink-0 px-3 py-2.5 border-l border-slate-200 dark:border-slate-600 bg-opella-beige/40 dark:bg-slate-700/80 text-opella-green dark:text-emerald-300 hover:bg-opella-beige dark:hover:bg-slate-600 transition-colors"
                  aria-label="Tăng số lượng"
                >
                  <PlusIcon />
                </button>
              </div>
              {product && qty > 0 && qty < product.minOrderQuantity && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
                  Tối thiểu đặt hàng: {product.minOrderQuantity}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 lg:items-stretch gap-4">
            {/* —— GIGA —— */}
            <div className="rounded-2xl border-2 border-opella-green/35 dark:border-opella-green/50 bg-white/90 dark:bg-slate-800/90 shadow-md flex flex-col min-h-[420px] lg:h-full">
              <div className="px-4 py-3 border-b border-opella-green/20 bg-opella-green/10 dark:bg-opella-green/20 shrink-0">
                <h3 className="text-center text-sm font-black uppercase tracking-widest text-opella-green dark:text-emerald-300">
                  GIGA
                </h3>
              </div>
              <div className="p-4 flex flex-col flex-1 gap-4 text-sm min-h-0">
                {!product ? (
                  <p className="text-slate-400 italic text-center">Chọn sản phẩm</p>
                ) : (
                  <>
                    <section className="shrink-0">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Giá VAT</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(product.price)}</p>
                    </section>

                    {PACK_476_PRODUCT_IDS.includes(product.id) && (
                      <p className="text-[10px] leading-snug text-emerald-950 dark:text-emerald-100/95 rounded-lg border border-emerald-300/60 bg-emerald-50/90 dark:bg-emerald-950/35 px-2.5 py-2">
                        <span className="font-black text-emerald-900 dark:text-emerald-200">Gói 4,76% (SP id 1 &amp; 30):</span>{' '}
                        từ <span className="font-bold tabular-nums">21</span> hộp, % CK cột GIGA = % cao nhất tại mốc &lt;21h (đã đạt){' '}
                        + 4,76%. Quy tắc lưu trong{' '}
                        <code className="rounded bg-emerald-100/90 dark:bg-emerald-900/50 px-1 text-[9px] font-mono">
                          utils/calculations.ts
                        </code>{' '}
                        → <code className="rounded bg-emerald-100/90 dark:bg-emerald-900/50 px-1 text-[9px] font-mono">getGigaReferenceDiscountPercent</code>.
                      </p>
                    )}

                    <div className="flex-1 flex flex-col min-h-0 gap-3">
                      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                          Các CTKM khuyến mãi
                        </p>
                        {!product.promotion ? (
                          <p className="text-slate-400 italic text-xs">Không có CTKM theo sản phẩm</p>
                        ) : gigaCalc.tiers.length === 0 ? (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{product.promotion}</p>
                        ) : (
                          <ul className="space-y-2">
                            {gigaCalc.tiers.map((tier, i) => {
                              const ok = tierReached(qty, gigaCalc.compareValue, tier);
                              return (
                                <li
                                  key={i}
                                  className={`flex items-start gap-2 rounded-lg px-2.5 py-2 border text-xs ${
                                    ok
                                      ? 'border-emerald-400/70 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-600'
                                      : 'border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/50'
                                  }`}
                                >
                                  <span
                                    className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                                      ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'
                                    }`}
                                    aria-hidden
                                  >
                                    {ok ? '✓' : '·'}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-100 leading-tight">
                                    {tier.unit === 'k' ? (
                                      <>
                                        Đơn ≥ {formatCompact(tier.threshold)} → CK {tier.percent}%
                                      </>
                                    ) : (
                                      <>
                                        Mua ≥ {tier.thresholdRaw}h → CK {tier.percent}%
                                        {isPack476Goi21Tier(product.id, tier) && qty >= 21 && (
                                          <span className="font-bold text-opella-green dark:text-emerald-300">
                                            {' '}
                                            — GIGA: +{(gigaCalc.packAdjacentPct * 100).toFixed(2)}% (mốc &lt;21h) + 4,76% (gói)
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {product.promotion && gigaCalc.discountPercent > 0 && (
                          <p className="mt-2 text-[11px] font-bold text-opella-green dark:text-emerald-400">
                            Đang áp CK: −{(gigaCalc.discountPercent * 100).toFixed(2)}%
                          </p>
                        )}
                      </div>
                      {qty > 0 && (
                        <div className="shrink-0 space-y-2">
                          <div className="rounded-lg border border-emerald-300/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 dark:from-emerald-950/45 dark:to-teal-950/35 dark:border-emerald-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-emerald-950 dark:text-emerald-50">
                              <span className="font-black text-emerald-800 dark:text-emerald-200">Giá HD+ VAT</span>
                              <span className="text-emerald-900/85 dark:text-emerald-100/90"> = </span>
                              <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(Math.round(lineTotalSauGiga / qty))}
                              </span>
                              <span className="text-emerald-900/80 dark:text-emerald-200/90">/hộp.</span>
                            </p>
                          </div>
                          <div className="rounded-lg border border-violet-300/70 bg-gradient-to-r from-violet-50/95 to-indigo-50/80 dark:from-violet-950/45 dark:to-indigo-950/35 dark:border-violet-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-violet-950 dark:text-violet-50">
                              <span className="font-bold text-violet-800 dark:text-violet-200">Tổng đơn:</span>
                              <span className="text-violet-900/90 dark:text-violet-100/90">
                                {' '}
                                Giá HD+ VAT × {qty} ={' '}
                              </span>
                              <span className="font-black tabular-nums text-violet-700 dark:text-violet-300">
                                {formatCurrency(lineTotalSauGiga)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <section className="shrink-0 rounded-xl border border-violet-200/80 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/25 px-3 py-2.5">
                      <p className="text-[11px] font-black uppercase tracking-wide text-violet-900 dark:text-violet-200 mb-2">
                        MỨC CVM :
                      </p>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                        {REBATE_TIERS.map((t, i) => {
                          const on = selectedCvmIndex === i;
                          return (
                            <li key={t.level}>
                              <button
                                type="button"
                                onClick={() => setSelectedCvmIndex(on ? null : i)}
                                className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] border transition-colors ${
                                  on
                                    ? 'border-opella-green bg-emerald-50/90 dark:bg-emerald-950/50 dark:border-emerald-500/70'
                                    : 'border-slate-200/80 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 hover:border-opella-green/40'
                                }`}
                              >
                                <span
                                  className={`${on ? 'text-opella-green dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                  Lv{t.level} ≥ {formatCompact(t.amount)} (−{t.percent}%)
                                </span>
                                <span
                                  className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center text-[12px] font-black ${
                                    on
                                      ? 'border-opella-green bg-opella-green text-white'
                                      : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-transparent'
                                  }`}
                                  aria-hidden
                                >
                                  ✓
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {selectedCvmIndex !== null && (
                        <p className="mt-2 text-[11px] font-bold text-violet-800 dark:text-violet-200">
                          Đã chọn: Lv{REBATE_TIERS[selectedCvmIndex].level} (−{REBATE_TIERS[selectedCvmIndex].percent}%)
                        </p>
                      )}
                    </section>

                    <section className="shrink-0 pt-2 border-t border-slate-200 dark:border-slate-600">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá cuối THÁNG
                      </p>
                      <p className="text-xl font-black text-opella-green dark:text-emerald-300">
                        {qty <= 0 ? '—' : formatCurrency(giaCuoiThangMoiHop)}
                      </p>
                      {product && qty > 0 && qty < product.minOrderQuantity && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1">Chưa đạt SL tối thiểu đặt hàng</p>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>

            {/* —— BM CVM —— */}
            <div className="rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-800/80 bg-white/90 dark:bg-slate-800/90 shadow-md flex flex-col min-h-[420px] lg:h-full">
              <div className="px-4 py-3 border-b border-indigo-200/60 dark:border-indigo-900/60 bg-indigo-50/80 dark:bg-indigo-950/40 shrink-0">
                <h3 className="text-center text-sm font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-200">
                  BM CVM
                </h3>
              </div>
              <div className="p-4 flex flex-col flex-1 gap-4 text-sm min-h-0">
                {!product ? (
                  <p className="text-slate-400 italic text-center">Chọn sản phẩm</p>
                ) : (
                  <>
                    <section className="shrink-0">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Giá gốc BM CVM</p>
                      {bmCvmNotSold ? (
                        <p className="text-lg font-black text-amber-700 dark:text-amber-400">Không bán</p>
                      ) : bmCvmBaseVnd != null && bmCvmBaseVnd > 0 ? (
                        <p className="text-lg font-black text-indigo-900 dark:text-indigo-200">{formatCurrency(bmCvmBaseVnd)}</p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Chưa có giá BM CVM cho SP này</p>
                      )}
                    </section>
                    <div className="flex-1 flex flex-col min-h-0 gap-3">
                      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                          Các CTKM khuyến mãi (BM CVM)
                        </p>
                        {bmCvmNotSold ? (
                          <p className="text-slate-400 italic text-xs">—</p>
                        ) : !bmCvmCtkmEntries?.length ? (
                          <p className="text-slate-400 italic text-xs">Không có CTKM BM CVM trong bảng cho SP này</p>
                        ) : (
                          <>
                            <ul className="space-y-2">
                              {bmCvmCtkmEntries.map((row, i) => {
                                const on = bmCvmCtkmWinningIndices.has(i);
                                return (
                                  <li
                                    key={i}
                                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 border text-xs leading-snug ${
                                      on
                                        ? 'border-emerald-400/70 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-600'
                                        : 'border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20'
                                    }`}
                                  >
                                    <span
                                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                                        on ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'
                                      }`}
                                      aria-hidden
                                    >
                                      {on ? '✓' : '·'}
                                    </span>
                                    <div className="min-w-0 text-slate-800 dark:text-slate-100">
                                      <span className="font-black text-indigo-800 dark:text-indigo-200">{row.label}</span>
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {' '}
                                        — <BmCvmCtkmDescriptionText description={row.description} />
                                      </span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            {bmCtkmDiscountVnd > 0 && (
                              <p className="mt-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                Ước tính CK CTKM −{formatCurrency(bmCtkmDiscountVnd)} (≈
                                −{(bmCtkmEffectivePercent * 100).toFixed(2)}%).
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {!bmCvmNotSold && lineValueBmVnd > 0 && (
                        <div className="shrink-0 space-y-2">
                          <div className="rounded-lg border border-emerald-300/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 dark:from-emerald-950/45 dark:to-teal-950/35 dark:border-emerald-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-emerald-950 dark:text-emerald-50">
                              <span className="font-black text-emerald-800 dark:text-emerald-200">Giá HD+ VAT</span>
                              <span className="text-emerald-900/85 dark:text-emerald-100/90"> = </span>
                              <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(bmSauCkCtkmMoiHopVnd)}
                              </span>
                              <span className="text-emerald-900/80 dark:text-emerald-200/90">/hộp.</span>
                            </p>
                          </div>
                          <div className="rounded-lg border border-violet-300/70 bg-gradient-to-r from-violet-50/95 to-indigo-50/80 dark:from-violet-950/45 dark:to-indigo-950/35 dark:border-violet-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-violet-950 dark:text-violet-50">
                              <span className="font-bold text-violet-800 dark:text-violet-200">Tổng đơn:</span>
                              <span className="text-violet-900/90 dark:text-violet-100/90">
                                {' '}
                                Giá HD+ VAT × {qty} ={' '}
                              </span>
                              <span className="font-black tabular-nums text-violet-700 dark:text-violet-300">
                                {formatCurrency(bmTongSauCkCtkmVnd)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <section className="shrink-0 rounded-xl border border-indigo-200/80 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/25 px-3 py-2.5">
                      <p className="text-[11px] font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-200 mb-2">
                        MỨC CVM :
                      </p>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                        {REBATE_TIERS.map((t, i) => {
                          const on = selectedCvmIndex === i;
                          return (
                            <li key={t.level}>
                              <button
                                type="button"
                                onClick={() => setSelectedCvmIndex(on ? null : i)}
                                className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] border transition-colors ${
                                  on
                                    ? 'border-indigo-500 bg-indigo-100/90 dark:bg-indigo-950/50 dark:border-indigo-400/70'
                                    : 'border-slate-200/80 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 hover:border-indigo-400/40'
                                }`}
                              >
                                <span
                                  className={`${on ? 'text-indigo-900 dark:text-indigo-200 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                  Lv{t.level} ≥ {formatCompact(t.amount)} (−{t.percent}%)
                                </span>
                                <span
                                  className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center text-[12px] font-black ${
                                    on
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-transparent'
                                  }`}
                                  aria-hidden
                                >
                                  ✓
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {selectedCvmIndex !== null && (
                        <p className="mt-2 text-[11px] font-bold text-indigo-800 dark:text-indigo-200">
                          Đã chọn: Lv{REBATE_TIERS[selectedCvmIndex].level} (−{REBATE_TIERS[selectedCvmIndex].percent}%)
                        </p>
                      )}
                    </section>

                    <section className="shrink-0 pt-2 border-t border-slate-200 dark:border-slate-600">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá cuối BM CVM
                      </p>
                      {bmCvmNotSold || !bmCvmBaseVnd ? (
                        <p className="text-slate-400 italic text-sm">—</p>
                      ) : qty <= 0 ? (
                        <p className="text-xl font-black text-slate-400">—</p>
                      ) : (
                        <>
                          <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                            {formatCurrency(giaCuoiBmCvmMoiHop)}
                          </p>
                          {product && qty > 0 && qty < product.minOrderQuantity && (
                            <p className="text-[10px] text-amber-600 font-bold mt-1">
                              Chưa đạt SL tối thiểu đặt hàng
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>

            {/* —— BM NO CVM —— */}
            <div className="rounded-2xl border-2 border-amber-300/80 dark:border-amber-800/80 bg-white/90 dark:bg-slate-800/90 shadow-md flex flex-col min-h-[420px] lg:h-full">
              <div className="px-4 py-3 border-b border-amber-200/70 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/40 shrink-0">
                <h3 className="text-center text-sm font-black uppercase tracking-widest text-amber-900 dark:text-amber-200">
                  BM NO CVM
                </h3>
              </div>
              <div className="p-4 flex flex-col flex-1 gap-4 text-sm min-h-0">
                {!product ? (
                  <p className="text-slate-400 italic text-center">Chọn sản phẩm</p>
                ) : (
                  <>
                    <section className="shrink-0">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá gốc BM NO CVM
                      </p>
                      {bmNonCvmNotSold ? (
                        <p className="text-lg font-black text-amber-700 dark:text-amber-400">Không có giá</p>
                      ) : bmNonCvmBaseVnd != null && bmNonCvmBaseVnd > 0 ? (
                        <p className="text-lg font-black text-amber-900 dark:text-amber-200">
                          {formatCurrency(bmNonCvmBaseVnd)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Chưa có giá BM NO CVM cho SP này</p>
                      )}
                    </section>

                    <div className="flex-1 flex flex-col min-h-0 gap-3">
                      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                          Các CTKM khuyến mãi (BM NO CVM)
                        </p>
                        {bmNonCvmNotSold ? (
                          <p className="text-slate-400 italic text-xs">—</p>
                        ) : !bmNoCvmCtkmEntries?.length ? (
                          <p className="text-slate-400 italic text-xs">Không có CTKM BM NO CVM trong bảng cho SP này</p>
                        ) : (
                          <>
                            <ul className="space-y-2">
                              {bmNoCvmCtkmEntries.map((row, i) => {
                                const on = bmNoCtkmWinningIndices.has(i);
                                return (
                                  <li
                                    key={i}
                                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 border text-xs leading-snug ${
                                      on
                                        ? 'border-emerald-400/70 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-600'
                                        : 'border-amber-200/90 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/25'
                                    }`}
                                  >
                                    <span
                                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                                        on ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'
                                      }`}
                                      aria-hidden
                                    >
                                      {on ? '✓' : '·'}
                                    </span>
                                    <div className="min-w-0 text-slate-800 dark:text-slate-100">
                                      <span className="font-black text-amber-900 dark:text-amber-200">{row.label}</span>
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {' '}
                                        — <BmCvmCtkmDescriptionText description={row.description} />
                                      </span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            {bmNoCtkmDiscountVnd > 0 && (
                              <p className="mt-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                Ước tính CK CTKM −{formatCurrency(bmNoCtkmDiscountVnd)} (≈
                                −{(bmNoCtkmEffectivePercent * 100).toFixed(2)}%).
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {!bmNonCvmNotSold && lineValueBmNonVnd > 0 && (
                        <div className="shrink-0 space-y-2">
                          <div className="rounded-lg border border-emerald-300/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 dark:from-emerald-950/45 dark:to-teal-950/35 dark:border-emerald-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-emerald-950 dark:text-emerald-50">
                              <span className="font-black text-emerald-800 dark:text-emerald-200">Giá HD+ VAT</span>
                              <span className="text-emerald-900/85 dark:text-emerald-100/90"> = </span>
                              <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(bmNoSauCkCtkmMoiHopVnd)}
                              </span>
                              <span className="text-emerald-900/80 dark:text-emerald-200/90">/hộp.</span>
                            </p>
                          </div>
                          <div className="rounded-lg border border-violet-300/70 bg-gradient-to-r from-violet-50/95 to-indigo-50/80 dark:from-violet-950/45 dark:to-indigo-950/35 dark:border-violet-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-violet-950 dark:text-violet-50">
                              <span className="font-bold text-violet-800 dark:text-violet-200">Tổng đơn:</span>
                              <span className="text-violet-900/90 dark:text-violet-100/90">
                                {' '}
                                Giá HD+ VAT × {qty} ={' '}
                              </span>
                              <span className="font-black tabular-nums text-violet-700 dark:text-violet-300">
                                {formatCurrency(bmNoTongSauCkCtkmVnd)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <section className="shrink-0 pt-2 border-t border-slate-200 dark:border-slate-600">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá cuối BM NO CVM
                      </p>
                      {bmNonCvmNotSold || !bmNonCvmBaseVnd ? (
                        <p className="text-slate-400 italic text-sm">—</p>
                      ) : qty <= 0 ? (
                        <p className="text-xl font-black text-slate-400">—</p>
                      ) : (
                        <>
                          <p className="text-xl font-black text-amber-800 dark:text-amber-300">
                            {formatCurrency(bmNoSauCkCtkmMoiHopVnd)}
                          </p>
                          {product && qty > 0 && qty < product.minOrderQuantity && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                              Chưa đạt SL tối thiểu đặt hàng
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>

            {/* —— BM NO CVM (COMBO) —— */}
            <div className="rounded-2xl border-2 border-teal-300/85 dark:border-teal-700/80 bg-white/90 dark:bg-slate-800/90 shadow-md flex flex-col min-h-[420px] lg:h-full">
              <div className="px-4 py-3 border-b border-teal-200/70 dark:border-teal-900/50 bg-teal-50/90 dark:bg-teal-950/40 shrink-0">
                <h3 className="text-center text-sm font-black uppercase tracking-widest text-teal-900 dark:text-teal-200">
                  BM NO CVM (COMBO)
                </h3>
              </div>
              <div className="p-4 flex flex-col flex-1 gap-4 text-sm min-h-0">
                {!product ? (
                  <p className="text-slate-400 italic text-center">Chọn sản phẩm</p>
                ) : (
                  <>
                    <section className="shrink-0">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá gốc BM NO CVM (COMBO)
                      </p>
                      {bmNonCvmNotSold ? (
                        <p className="text-lg font-black text-amber-700 dark:text-amber-400">Không có giá</p>
                      ) : bmNoComboDerivedPerBoxSummary ? (
                        <>
                          <p className="text-lg font-black text-teal-900 dark:text-teal-100 tabular-nums">
                            {bmNoComboDerivedPerBoxSummary.single
                              ? formatCurrency(bmNoComboDerivedPerBoxSummary.min)
                              : `${formatCurrency(bmNoComboDerivedPerBoxSummary.min)} – ${formatCurrency(bmNoComboDerivedPerBoxSummary.max)}`}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Đơn giá /hộp = <span className="font-semibold text-teal-800 dark:text-teal-400/95">GIÁ GỐC</span> (cột
                            bảng) ÷ <span className="font-semibold">số hộp sau «Combo»</span> (vd. Combo 20 → chia 20). Chi tiết
                            từng mức ở các dòng CTKM bên dưới.
                          </p>
                        </>
                      ) : bmNonCvmBaseVnd != null && bmNonCvmBaseVnd > 0 ? (
                        <>
                          <p className="text-lg font-black text-teal-900 dark:text-teal-100">
                            {formatCurrency(bmNonCvmBaseVnd)}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            /hộp (BM NO CVM). SP không có dòng combo trong bảng.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Chưa có giá cho SP này</p>
                      )}
                    </section>

                    <div className="flex-1 flex flex-col min-h-0 gap-3">
                      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                          Các CTKM khuyến mãi (BM NO CVM — COMBO)
                        </p>
                        {bmNonCvmNotSold ? (
                          <p className="text-slate-400 italic text-xs">—</p>
                        ) : !bmNoComboCtkmEntries?.length ? (
                          <p className="text-slate-400 italic text-xs">Không có CTKM combo trong bảng cho SP này</p>
                        ) : (
                          <>
                            <ul className="space-y-2">
                              {bmNoComboCtkmEntries.map((row, i) => {
                                const on = bmNoComboCtkmWinningIndices.has(i);
                                const comboPerBoxVnd = comboReferencePerBoxVndFromEntry(row);
                                return (
                                  <li
                                    key={i}
                                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 border text-xs leading-snug ${
                                      on
                                        ? 'border-emerald-400/70 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-600'
                                        : 'border-teal-200/90 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25'
                                    }`}
                                  >
                                    <span
                                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                                        on ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'
                                      }`}
                                      aria-hidden
                                    >
                                      {on ? '✓' : '·'}
                                    </span>
                                    <div className="min-w-0 text-slate-800 dark:text-slate-100">
                                      <span className="font-black text-teal-900 dark:text-teal-200">{row.label}</span>
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {' '}
                                        — <BmCvmCtkmDescriptionText description={row.description} />
                                      </span>
                                      {row.referenceLineBaseVnd != null && row.referenceLineBaseVnd > 0 && (
                                        <div className="mt-1 space-y-0.5 text-[10px] text-teal-800/95 dark:text-teal-300/95 tabular-nums">
                                          <p>
                                            <span className="font-semibold">GIÁ GỐC (dòng):</span>{' '}
                                            {formatCurrency(row.referenceLineBaseVnd)}
                                          </p>
                                          {comboPerBoxVnd != null && row.referenceLineBaseVnd != null && (
                                            <p>
                                              <span className="font-semibold">Giá gốc /hộp:</span>{' '}
                                              {formatCurrency(comboPerBoxVnd)}{' '}
                                              <span className="text-slate-500 dark:text-slate-400 font-normal">
                                                (= {formatCurrency(row.referenceLineBaseVnd)} ÷ {row.comboPackCount} hộp)
                                              </span>
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            {bmNoComboCtkmDiscountVnd > 0 && (
                              <p className="mt-2 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                                Ước tính CK CTKM −{formatCurrency(bmNoComboCtkmDiscountVnd)} (≈
                                −{(bmNoComboCtkmEffectivePercent * 100).toFixed(2)}%).
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {!bmNonCvmNotSold && lineValueBmNonVnd > 0 && (
                        <div className="shrink-0 space-y-2">
                          <div className="rounded-lg border border-emerald-300/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 dark:from-emerald-950/45 dark:to-teal-950/35 dark:border-emerald-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-emerald-950 dark:text-emerald-50">
                              <span className="font-black text-emerald-800 dark:text-emerald-200">Giá HD+ VAT</span>
                              <span className="text-emerald-900/85 dark:text-emerald-100/90"> = </span>
                              <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                                {formatCurrency(bmNoComboSauCkCtkmMoiHopVnd)}
                              </span>
                              <span className="text-emerald-900/80 dark:text-emerald-200/90">/hộp.</span>
                            </p>
                          </div>
                          <div className="rounded-lg border border-violet-300/70 bg-gradient-to-r from-violet-50/95 to-indigo-50/80 dark:from-violet-950/45 dark:to-indigo-950/35 dark:border-violet-700/45 px-3 py-2.5 shadow-sm">
                            <p className="text-[11px] leading-snug text-violet-950 dark:text-violet-50">
                              <span className="font-bold text-violet-800 dark:text-violet-200">Tổng đơn:</span>
                              <span className="text-violet-900/90 dark:text-violet-100/90">
                                {' '}
                                Giá HD+ VAT × {qty} ={' '}
                              </span>
                              <span className="font-black tabular-nums text-violet-700 dark:text-violet-300">
                                {formatCurrency(bmNoComboTongSauCkCtkmVnd)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <section className="shrink-0 pt-2 border-t border-slate-200 dark:border-slate-600">
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Giá cuối BM NO CVM (COMBO)
                      </p>
                      {bmNonCvmNotSold || !bmNonCvmBaseVnd ? (
                        <p className="text-slate-400 italic text-sm">—</p>
                      ) : qty <= 0 ? (
                        <p className="text-xl font-black text-slate-400">—</p>
                      ) : (
                        <>
                          <p className="text-xl font-black text-teal-800 dark:text-teal-300">
                            {formatCurrency(bmNoComboSauCkCtkmMoiHopVnd)}
                          </p>
                          {product && qty > 0 && qty < product.minOrderQuantity && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                              Chưa đạt SL tối thiểu đặt hàng
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiaThamKhaoTab;
