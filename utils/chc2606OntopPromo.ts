import type { CartItem } from '../types';
import {
  ACEMUC_GROUP_IDS,
  CHC2606_ONTOP_END_MS,
  CHC2606_ONTOP_IMPORT_PRODUCT_IDS,
  CHC2606_ONTOP_LOCAL_PRODUCT_IDS,
  CHC2606_ONTOP_NOTE_IMPORT,
  CHC2606_ONTOP_NOTE_LOCAL,
  CHC2606_ONTOP_PERCENT_BASE,
  CHC2606_ONTOP_PERCENT_HIGH,
  CHC2606_ONTOP_PERCENT_LOW,
  CHC2606_ONTOP_START_MS,
  CHC2606_ONTOP_THRESHOLD_BASE,
  CHC2606_ONTOP_THRESHOLD_HIGH,
  CHC2606_ONTOP_THRESHOLD_LOW,
  OSTELIN_GROUP_IDS,
  TELFAST_GROUP_IDS,
} from '../constants';
import { getDiscountPercent } from './calculations';
import type { CartGroupTotals } from './orderDiscountCaps';

export function isChc2606OntopPromoActive(nowMs: number = Date.now()): boolean {
  return nowMs >= CHC2606_ONTOP_START_MS && nowMs <= CHC2606_ONTOP_END_MS;
}

export function getChc2606OntopTierPercent(poolExVat: number): number {
  if (poolExVat >= CHC2606_ONTOP_THRESHOLD_HIGH) return CHC2606_ONTOP_PERCENT_HIGH;
  if (poolExVat >= CHC2606_ONTOP_THRESHOLD_LOW) return CHC2606_ONTOP_PERCENT_LOW;
  if (poolExVat >= CHC2606_ONTOP_THRESHOLD_BASE) return CHC2606_ONTOP_PERCENT_BASE;
  return 0;
}

function getOntopLineExVatAfterDiscount(item: CartItem, groupTotals: CartGroupTotals): number {
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
): { localPoolExVat: number; importPoolExVat: number } {
  let localPoolExVat = 0;
  let importPoolExVat = 0;

  for (const item of items) {
    const lineExVat = getOntopLineExVatAfterDiscount(item, groupTotals);
    if (CHC2606_ONTOP_LOCAL_PRODUCT_IDS.includes(item.id)) {
      localPoolExVat += lineExVat;
    }
    if (CHC2606_ONTOP_IMPORT_PRODUCT_IDS.includes(item.id)) {
      importPoolExVat += lineExVat;
    }
  }

  return { localPoolExVat, importPoolExVat };
}

export interface Chc2606OntopTotals {
  localPoolExVat: number;
  importPoolExVat: number;
  localPercent: number;
  importPercent: number;
  discountLocal: number;
  discountImport: number;
  discountTotal: number;
  eligible: boolean;
}

export function calcChc2606OntopTotals(
  items: CartItem[],
  groupTotals: CartGroupTotals,
  applyOntop: boolean
): Chc2606OntopTotals {
  const { localPoolExVat, importPoolExVat } = getChc2606OntopPoolTotals(items, groupTotals);
  const localPercent = getChc2606OntopTierPercent(localPoolExVat);
  const importPercent = getChc2606OntopTierPercent(importPoolExVat);
  const eligible = localPercent > 0 || importPercent > 0;

  const effectiveLocalPercent = applyOntop ? localPercent : 0;
  const effectiveImportPercent = applyOntop ? importPercent : 0;

  const discountLocal = localPoolExVat * effectiveLocalPercent;
  const discountImport = importPoolExVat * effectiveImportPercent;

  return {
    localPoolExVat,
    importPoolExVat,
    localPercent,
    importPercent,
    discountLocal,
    discountImport,
    discountTotal: discountLocal + discountImport,
    eligible,
  };
}

export function formatChc2606OntopPercent(percent: number): string {
  if (percent <= 0) return '0%';
  if (Math.abs(percent - CHC2606_ONTOP_PERCENT_HIGH) < 0.000001) return '3.94%';
  if (Math.abs(percent - CHC2606_ONTOP_PERCENT_LOW) < 0.000001) return '2.96%';
  if (Math.abs(percent - CHC2606_ONTOP_PERCENT_BASE) < 0.000001) return '2.46%';
  return `${(percent * 100).toFixed(2)}%`;
}

export function buildChc2606OntopNoteLine(kind: 'local' | 'import', percent: number): string {
  const label = kind === 'local' ? CHC2606_ONTOP_NOTE_LOCAL : CHC2606_ONTOP_NOTE_IMPORT;
  return `${label} ${formatChc2606OntopPercent(percent)}`;
}

export function stripChc2606OntopNoteLines(note: string): string {
  return note
    .split('\n')
    .filter(
      line =>
        !line.includes(CHC2606_ONTOP_NOTE_LOCAL) && !line.includes(CHC2606_ONTOP_NOTE_IMPORT)
    )
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
