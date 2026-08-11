import type { CartItem, Order } from '../types';
import { computeCartGroupTotals } from './orderDiscountCaps';
import { getDummyBoxEligibilityTotals } from './dummyBoxEligibility';
import { calcChc2606OntopTotals } from './chc2606OntopPromo';
import {
  allocateRebateExVatPerItem,
  getCartDummyBoxPercents,
  getCartLineAmountWithVat,
} from './cartVatTotals';
import {
  calcPsOrderTotals,
  findTierConfigByFinalStoreTypeQ2,
} from './psOnInvoicePromo';

export type OrderInvoiceLine = {
  id: number;
  name: string;
  quantity: number;
  /** Đơn giá hộp trên hóa đơn (CK + VAT) */
  unitInvoice: number;
  /** Thành tiền dòng trên hóa đơn */
  lineTotal: number;
};

type OrderInvoiceSource = Pick<
  Order,
  | 'items'
  | 'isDummyBoxLocal'
  | 'isDummyBoxImport'
  | 'isChc2606Ontop'
  | 'isPsOnInvoice25'
  | 'psTierLabel'
  | 'psSuatApplied'
>;

/** Thành tiền / đơn giá hộp trên hóa đơn (CK + VAT) — khớp cột Giá hộp trên Cart */
export function buildOrderInvoiceLines(order: OrderInvoiceSource): OrderInvoiceLine[] {
  const items = order.items;
  const groupTotals = computeCartGroupTotals(items);
  const { localTotalAfterDiscount, importTotalAfterDiscount } = getDummyBoxEligibilityTotals(items);
  const { dummyLocalPercent, dummyImportPercent } = getCartDummyBoxPercents({
    applyDummyBoxLocal: !!order.isDummyBoxLocal,
    applyDummyBoxImport: !!order.isDummyBoxImport,
    dummyBoxLocalPoolExVat: localTotalAfterDiscount,
    dummyBoxImportPoolExVat: importTotalAfterDiscount,
  });

  let ontopLocalPercent = 0;
  let ontopImportPercent = 0;
  if (order.isChc2606Ontop) {
    const ontop = calcChc2606OntopTotals(items, groupTotals, false);
    ontopLocalPercent = ontop.localPercent;
    ontopImportPercent = ontop.importPercent;
  }

  let psTotals = null as ReturnType<typeof calcPsOrderTotals> | null;
  if (order.isPsOnInvoice25 && order.psTierLabel) {
    const tier = findTierConfigByFinalStoreTypeQ2(order.psTierLabel);
    if (tier) {
      psTotals = calcPsOrderTotals(items, tier, {
        suatToApply: order.psSuatApplied,
      });
    }
  }

  const lineOpts = {
    psTotals,
    dummyLocalPercent,
    dummyImportPercent,
    ontopLocalPercent,
    ontopImportPercent,
  };

  // Không có số tiền rebate trong Order — không phân bổ phí
  const rebateAlloc = allocateRebateExVatPerItem(items, groupTotals, lineOpts, 0, 0);

  return items.map((item: CartItem, index: number) => {
    const lineTotal = getCartLineAmountWithVat(item, groupTotals, {
      ...lineOpts,
      rebateAllocExVat: rebateAlloc[index] ?? 0,
    });
    const unitInvoice = item.quantity > 0 ? lineTotal / item.quantity : 0;
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitInvoice: Math.round(unitInvoice),
      lineTotal: Math.round(lineTotal),
    };
  });
}
