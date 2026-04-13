/**
 * Danh sách sản phẩm có GIÁ BM (từ file đính kèm)
 * Giá SL tối thiểu 1h lấy từ cột "Giá bán BM" trong file đính kèm
 */
import type { Product } from '../types';

export interface BmProductTier {
  minQty: number;
  price: number;
  ctkm: string;
}

/** Giá bán BM theo (productId, minQty) khi SL tối thiểu > 1 (từ file đính kèm). Key: "id-minQty" */
const BM_PRICE_BY_ID_MIN_QTY: Record<string, number> = {
  '1-20': 188190,
  '28-20': 198815,
  '2-98': 78883,
  '3-96': 83978,
  '4-96': 61077,
  '5-160': 96256,
  '10-66': 38582,
  '14-238': 55244,
  '21-24': 107558,
};

/** Giá bán BM theo SL tối thiểu 1 (từ file đính kèm - cột Giá bán BM). Cập nhật theo file khi có thay đổi. */
export const BM_PRICE_BY_ID: Record<number, number> = {
  1: 192420,
  28: 205400,
  26: 159453,
  2: 81300,
  3: 87202,
  4: 61529,
  5: 96863,
  6: 267390,
  7: 122791,
  8: 28850,
  9: 43524,
  10: 38635,
  12: 290600,
  13: 425926,
  14: 60858,
  15: 119800,
  16: 25753,
  29: 139646,
  27: 211680,
  18: 190080,
  20: 97000,
  21: 114817,
  22: 277778,
  23: 500000,
  24: 120370,
  25: 212963,
};

/** Product IDs có trong danh sách BM (khớp file đính kèm) */
export const BM_PRODUCT_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16,
  18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29
] as const;

/** Kiểm tra sản phẩm có trong danh sách BM */
export const isBmProduct = (productId: number): boolean =>
  BM_PRODUCT_IDS.includes(productId as (typeof BM_PRODUCT_IDS)[number]);

/**
 * Lấy các mức GIÁ BM theo SL tối thiểu cho sản phẩm
 * Giá SL tối thiểu 1: lấy từ BM_PRICE_BY_ID (file đính kèm)
 * Giá SL tối thiểu > 1: lấy từ BM_PRICE_BY_ID_MIN_QTY (file đính kèm)
 */
export function getBmTiers(product: Product): BmProductTier[] {
  const tiers = BM_TIERS_BY_ID[product.id];
  if (!tiers) return [];

  const priceMin1 = BM_PRICE_BY_ID[product.id] ?? product.price;

  return tiers.map(({ minQty }) => {
    let price: number;
    if (minQty === 1) {
      price = priceMin1;
    } else {
      const key = `${product.id}-${minQty}`;
      price = BM_PRICE_BY_ID_MIN_QTY[key] ?? priceMin1;
    }
    const ctkm = product.promotion || '—';
    return { minQty, price, ctkm };
  });
}

/** SL tối thiểu theo productId (từ file đính kèm) */
const BM_TIERS_BY_ID: Record<number, { minQty: number }[]> = {
  1: [{ minQty: 1 }, { minQty: 20 }],
  28: [{ minQty: 1 }, { minQty: 20 }],
  26: [{ minQty: 1 }],
  2: [{ minQty: 1 }, { minQty: 98 }],
  3: [{ minQty: 1 }, { minQty: 96 }],
  4: [{ minQty: 1 }, { minQty: 96 }],
  5: [{ minQty: 1 }, { minQty: 160 }],
  6: [{ minQty: 1 }],
  7: [{ minQty: 1 }],
  8: [{ minQty: 1 }],
  9: [{ minQty: 1 }],
  10: [{ minQty: 1 }, { minQty: 66 }],
  12: [{ minQty: 1 }],
  13: [{ minQty: 1 }],
  14: [{ minQty: 1 }, { minQty: 238 }],
  15: [{ minQty: 1 }],
  16: [{ minQty: 1 }],
  29: [{ minQty: 1 }],
  27: [{ minQty: 1 }],
  18: [{ minQty: 1 }],
  20: [{ minQty: 1 }],
  21: [{ minQty: 1 }, { minQty: 24 }],
  22: [{ minQty: 1 }],
  23: [{ minQty: 1 }],
  24: [{ minQty: 1 }],
  25: [{ minQty: 1 }],
};
