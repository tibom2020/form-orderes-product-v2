import type { CartItem } from '../types';
import {
  ACEMUC_GROUP_IDS,
  CHC2606_ONTOP_SUSPENDED,
  CHC2606_ONTOP_END_MS,
  CHC2606_ONTOP_IMPORT_PRODUCT_IDS,
  CHC2606_ONTOP_LOCAL_PRODUCT_IDS,
  CHC2606_ONTOP_NOTE_IMPORT,
  CHC2606_ONTOP_NOTE_IMPORT_LEGACY,
  CHC2606_ONTOP_NOTE_LOCAL,
  CHC2606_ONTOP_NOTE_LOCAL_LEGACY,
  CHC2606_ONTOP_PERCENT_BASE,
  CHC2606_ONTOP_START_MS,
  CHC2606_ONTOP_THRESHOLD,
  OSTELIN_GROUP_IDS,
  TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';
import type { CartGroupTotals } from './orderDiscountCaps';

export function isChc2606OntopPromoActive(nowMs: number = Date.now()): boolean {
  if (CHC2606_ONTOP_SUSPENDED) return false;
  return nowMs >= CHC2606_ONTOP_START_MS && nowMs <= CHC2606_ONTOP_END_MS;
}

/** ≥ 3tr basePrice trong pool → 2.46%; dưới ngưỡng = 0 */
export function getChc2606OntopTierPercent(poolBaseExVat: number): number {
  if (poolBaseExVat >= CHC2606_ONTOP_THRESHOLD) return CHC2606_ONTOP_PERCENT_BASE;
  return 0;
}

function getOntopLineBaseExVat(item: CartItem): number {
  return (item.basePrice ?? item.price) * item.quantity;
}

function getOntopLineExVatAfterMonthly(item: CartItem, groupTotals: CartGroupTotals): number {
  const unitBase = item.basePrice ?? item.price;
  const isTelfast = TELFAST_GROUP_IDS.includes(item.id);
  const isOstelin = OSTELIN_GROUP_IDS.includes(item.id);
  const isAcemuc = ACEMUC_GROUP_IDS.includes(item.id);
  const compareValue = isTelfast
    ? groupTotals.telfastGroupTotal
    : isOstelin
      ? groupTotals.ostelinGroupBaseTotal
      : isAcemuc
        ? groupTotals.acemucGroupBaseTotal
        : undefined;
  const discountPercent = getDiscountPercent(item.promotion, item.quantity, compareValue, item.id);
  return unitBase * item.quantity * (1 - discountPercent);
}

export function getChc2606OntopPoolTotals(
  items: CartItem[],
  groupTotals: CartGroupTotals
): {
  localPoolBase: number;
  importPoolBase: number;
  localPoolExVat: number;
  importPoolExVat: number;
} {
  let localPoolBase = 0;
  let importPoolBase = 0;
  let localPoolExVat = 0;
  let importPoolExVat = 0;

  for (const item of items) {
    const lineBase = getOntopLineBaseExVat(item);
    const lineAfterMonthly = getOntopLineExVatAfterMonthly(item, groupTotals);
    if (CHC2606_ONTOP_LOCAL_PRODUCT_IDS.includes(item.id)) {
      localPoolBase += lineBase;
      localPoolExVat += lineAfterMonthly;
    }
    if (CHC2606_ONTOP_IMPORT_PRODUCT_IDS.includes(item.id)) {
      importPoolBase += lineBase;
      importPoolExVat += lineAfterMonthly;
    }
  }

  return { localPoolBase, importPoolBase, localPoolExVat, importPoolExVat };
}

export interface Chc2606OntopTotals {
  /** Tổng basePrice pool — xét ngưỡng 3tr */
  localPoolBase: number;
  importPoolBase: number;
  /** Tổng sau CK tháng — dùng tính tiền giảm ONTOP */
  localPoolExVat: number;
  importPoolExVat: number;
  localPercent: number;
  importPercent: number;
  discountLocal: number;
  discountImport: number;
  discountTotal: number;
  eligibleLocal: boolean;
  eligibleImport: boolean;
  /** true nếu ít nhất một nhóm đạt ngưỡng */
  eligible: boolean;
}

export function calcChc2606OntopTotals(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  apply: boolean | { applyLocal?: boolean; applyImport?: boolean }
): Chc2606OntopTotals {
  const { localPoolBase, importPoolBase, localPoolExVat, importPoolExVat } =
    getChc2606OntopPoolTotals(items, groupTotals);
  const localPercent = getChc2606OntopTierPercent(localPoolBase);
  const importPercent = getChc2606OntopTierPercent(importPoolBase);
  const eligibleLocal = localPercent > 0;
  const eligibleImport = importPercent > 0;
  const eligible = eligibleLocal || eligibleImport;

  const applyLocal =
    typeof apply === 'boolean' ? apply : !!apply.applyLocal;
  const applyImport =
    typeof apply === 'boolean' ? apply : !!apply.applyImport;

  const effectiveLocalPercent = applyLocal ? localPercent : 0;
  const effectiveImportPercent = applyImport ? importPercent : 0;

  const discountLocal = localPoolExVat * effectiveLocalPercent;
  const discountImport = importPoolExVat * effectiveImportPercent;

  return {
    localPoolBase,
    importPoolBase,
    localPoolExVat,
    importPoolExVat,
    localPercent,
    importPercent,
    discountLocal,
    discountImport,
    discountTotal: discountLocal + discountImport,
    eligibleLocal,
    eligibleImport,
    eligible,
  };
}

export function formatChc2606OntopPercent(percent: number): string {
  if (percent <= 0) return '0%';
  if (Math.abs(percent - CHC2606_ONTOP_PERCENT_BASE) < 0.000001) return '2.46%';
  return `${(percent * 100).toFixed(2)}%`;
}

export function buildChc2606OntopNoteLine(kind: 'local' | 'import', percent: number): string {
  const label = kind === 'local' ? CHC2606_ONTOP_NOTE_LOCAL : CHC2606_ONTOP_NOTE_IMPORT;
  return `${label} ${formatChc2606OntopPercent(percent)}`;
}

function isOntopNoteLine(line: string): boolean {
  return (
    line.includes(CHC2606_ONTOP_NOTE_LOCAL) ||
    line.includes(CHC2606_ONTOP_NOTE_IMPORT) ||
    line.includes(CHC2606_ONTOP_NOTE_LOCAL_LEGACY) ||
    line.includes(CHC2606_ONTOP_NOTE_IMPORT_LEGACY)
  );
}

export function stripChc2606OntopNoteLines(note: string): string {
  return note
    .split('\n')
    .filter(line => !isOntopNoteLine(line))
    .join('\n');
}

export function mergeChc2606OntopNoteLines(
  note: string,
  localPercent: number,
  importPercent: number
): string {
  const lines = stripChc2606OntopNoteLines(note)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (localPercent > 0) lines.push(buildChc2606OntopNoteLine('local', localPercent));
  if (importPercent > 0) lines.push(buildChc2606OntopNoteLine('import', importPercent));
  return lines.join('\n');
}
