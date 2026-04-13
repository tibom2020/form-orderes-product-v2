import { CALCIPLUS_PROMO_DISCOUNT_PERCENT, PACK_476_PRODUCT_IDS } from '../constants';

/** Lấy % CK lớn nhất từ chuỗi promotion (ví dụ 4.9 từ "Mua 5h ck 4.9%") - dùng cho Giá HĐ, Giá cuối tháng */
export const getMaxDiscountPercent = (promotion: string | undefined): number | null => {
    if (!promotion) return null;
    const matches = promotion.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
    let max = 0;
    for (const m of matches) {
        const p = parseFloat(m[1]);
        if (p > max) max = p;
    }
    return max > 0 ? max : null;
};

export const getDiscountPercent = (
    promotion: string | undefined,
    quantity: number,
    value?: number,
    _productId?: number
): number => {
    if (!promotion) return 0;

    // Kiểm tra xem đây là KM theo giá trị đơn hàng (k) hay số lượng (h)
    // Sửa lỗi: Cần regex chặt chẽ hơn để tránh khớp nhầm "ck" (chiết khấu)
    const isValueBased = promotion.toLowerCase().includes('đơn >=') || /\d+\s*k/i.test(promotion);

    // Tìm các cặp (mốc, phần trăm)
    // Regex hỗ trợ: 7h ck 5%, 500k ck 2%, hoặc đơn >= 200k ck 2.46%
    const tieredMatches = Array.from(promotion.matchAll(/(\d+(?:\.\d+)?)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi));

    if (tieredMatches.length > 0) {
        const tiers = tieredMatches
            .map(m => {
                const thresholdRaw = parseFloat(m[1]);
                const unit = m[2].toLowerCase();
                const threshold = unit === 'k' ? thresholdRaw * 1000 : thresholdRaw;
                return { threshold, percent: parseFloat(m[3]) / 100, unit };
            })
            .sort((a, b) => b.threshold - a.threshold);

        // Kiểm tra xem có mốc nào dùng đơn vị 'k' không
        const hasKUnit = tiers.some(t => t.unit === 'k');
        const isActuallyValueBased = isValueBased || hasKUnit;
        const compareValue = (isActuallyValueBased && value !== undefined) ? value : quantity;

        for (const tier of tiers) {
            if (compareValue >= tier.threshold) return tier.percent;
        }
        return 0;
    }

    // Trường hợp chỉ có 1 mức % cố định
    const match = promotion.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match && match[1]) {
        return parseFloat(match[1]) / 100;
    }
    return 0;
};

export const calculateLineTotal = (
    price: number,
    quantity: number,
    promotion?: string,
    groupValue?: number,
    productId?: number
): number => {
    const discount = getDiscountPercent(promotion, quantity, groupValue, productId);
    return price * quantity * (1 - discount);
};

/**
 * % CK cao nhất từ các mốc theo **hộp (h)** có ngưỡng &lt; packH mà `quantity` đạt.
 * (Dùng cho gói 21h: lấy “mức liền kề” dưới 21h.)
 */
function getBestDiscountPercentBelowHPack(
  promotion: string,
  quantity: number,
  _value: number | undefined,
  packH: number
): number {
  const tieredMatches = Array.from(
    promotion.matchAll(/(\d+(?:\.\d+)?)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi)
  );
  let best = 0;
  for (const m of tieredMatches) {
    const thresholdRaw = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit !== 'h') continue;
    if (thresholdRaw >= packH) continue;
    const percent = parseFloat(m[3]) / 100;
    if (quantity >= thresholdRaw && percent > best) best = percent;
  }
  return best;
}

/**
 * % “mức liền kề” (các mốc &lt; 21h đạt được) — chỉ cho SP gói 4.76% khi SL ≥ 21.
 */
export function getGigaPackAdjacentTierPercent(
  promotion: string | undefined,
  quantity: number,
  value: number | undefined,
  productId: number
): number {
  if (!promotion || !PACK_476_PRODUCT_IDS.includes(productId) || quantity < 21) return 0;
  return getBestDiscountPercentBelowHPack(promotion, quantity, value, 21);
}

/**
 * Tab Giá tham khảo · GIGA: SP `PACK_476` (id 1, 30), SL ≥ 21 →
 * CK = % mốc max (&lt;21h) + 4.76%. Khác SP hoặc SL &lt; 21 → `getDiscountPercent`.
 */
export function getGigaReferenceDiscountPercent(
  promotion: string | undefined,
  quantity: number,
  value: number | undefined,
  productId: number
): number {
  if (!promotion) return 0;
  const base = getDiscountPercent(promotion, quantity, value, productId);
  if (!PACK_476_PRODUCT_IDS.includes(productId) || quantity < 21) {
    return base;
  }
  const adjacent = getBestDiscountPercentBelowHPack(promotion, quantity, value, 21);
  const stacked = adjacent + CALCIPLUS_PROMO_DISCOUNT_PERCENT;
  return Math.min(0.95, stacked);
}

export function calculateGigaReferenceLineTotal(
  price: number,
  quantity: number,
  promotion: string | undefined,
  compareValue: number,
  productId: number
): number {
  const d = getGigaReferenceDiscountPercent(promotion, quantity, compareValue, productId);
  return price * quantity * (1 - d);
}
