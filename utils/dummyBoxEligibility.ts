import type { CartItem } from '../types';
import {
    DUMMY_BOX_IMPORT_MIN_AMOUNT,
    DUMMY_BOX_LOCAL_MIN_AMOUNT,
    TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';

/** Khớp `Cart.tsx` — DummyBoxLocalCalculator */
const DUMMY_BOX_LOCAL_CALC_IDS: readonly number[] = [1, 26, 28, 2, 3, 4, 6, 7, 8, 10];
/** Khớp `Cart.tsx` — DummyBoxImportCalculator */
const DUMMY_BOX_IMPORT_CALC_IDS: readonly number[] = [30, 12, 13, 14, 22, 23, 24, 25, 27, 18, 19, 20];

/** Khớp logic `Cart.tsx` — dùng chung cho đơn hàng & chi tiết giỏ */
export function getDummyBoxAmountEligibility(items: CartItem[]): { eligibleDummyBoxLocal: boolean; eligibleDummyBoxImport: boolean } {
    const telfastLocalConditionTotal = items
        .filter((item) => TELFAST_GROUP_IDS.includes(item.id))
        .reduce((sum, item) => sum + (item.basePrice ?? item.price) * item.quantity, 0);

    const sumAfterDiscountLocal = items
        .filter((item) => DUMMY_BOX_LOCAL_CALC_IDS.includes(item.id))
        .reduce((sum, item) => {
            const isTelfast = TELFAST_GROUP_IDS.includes(item.id);
            const compareValue = isTelfast ? telfastLocalConditionTotal : undefined;
            const discountPercent = getDiscountPercent(item.promotion, item.quantity, compareValue);
            const lineAfterDiscount = (item.basePrice ?? item.price) * item.quantity * (1 - discountPercent);
            return sum + lineAfterDiscount;
        }, 0);
    const eligibleDummyBoxLocal = sumAfterDiscountLocal >= DUMMY_BOX_LOCAL_MIN_AMOUNT;

    const sumAfterDiscountImport = items
        .filter((item) => DUMMY_BOX_IMPORT_CALC_IDS.includes(item.id))
        .reduce((sum, item) => {
            const discountPercent = getDiscountPercent(item.promotion, item.quantity, undefined);
            const lineAfterDiscount = (item.basePrice ?? item.price) * item.quantity * (1 - discountPercent);
            return sum + lineAfterDiscount;
        }, 0);
    const eligibleDummyBoxImport = sumAfterDiscountImport >= DUMMY_BOX_IMPORT_MIN_AMOUNT;

    return { eligibleDummyBoxLocal, eligibleDummyBoxImport };
}
