import type { DangKyTbq2RowView } from './displayTbq2Sheet';
import { isRegisteredRow } from './displayTbq2Sheet';
import {
  findTierConfigByFinalStoreTypeQ2,
  getPsMultiSuatRules,
  getPsSuatMaxForTier,
  getPsSuatRemaining,
} from './psOnInvoicePromo';
import type { StoreTierConfig } from '../components/StoreProgramRegistrationTab';

export interface PsCustomerGate {
  customerCode: string;
  tierLabel: string;
  tierConfig: StoreTierConfig;
  goiPs25Raw: string;
  inPsList: boolean;
  canShowCk25: boolean;
  suatPsDaDung: number;
  suatMax: number;
  suatRemaining: number;
  isMultiSuat: boolean;
}

function registerGate(
  map: Map<string, PsCustomerGate>,
  code: string,
  row: DangKyTbq2RowView,
  tier: StoreTierConfig
): void {
  const k = code.trim().toLowerCase();
  if (!k) return;
  const goiPs25Raw = row.goiPs25;
  const inPsList = true;
  const multi = getPsMultiSuatRules(tier.id) != null;
  const suatMax = getPsSuatMaxForTier(tier);
  const suatPsDaDung = row.suatPsDaDung;
  const suatRemaining = getPsSuatRemaining(tier, suatPsDaDung);
  /** Còn suất PS → được tick SPECIAL_PS0526 (không chặn riêng theo cột Gói PS 25% = YES) */
  const canShowCk25 = inPsList && suatRemaining > 0;

  map.set(k, {
    customerCode: code.trim(),
    tierLabel: tier.label,
    tierConfig: tier,
    goiPs25Raw,
    inPsList,
    canShowCk25,
    suatPsDaDung,
    suatMax,
    suatRemaining,
    isMultiSuat: multi,
  });
}

export function buildPsCustomerMap(rows: DangKyTbq2RowView[]): Map<string, PsCustomerGate> {
  const map = new Map<string, PsCustomerGate>();
  for (const row of rows) {
    if (!isRegisteredRow(row)) continue;
    const tier = findTierConfigByFinalStoreTypeQ2(row.finalStoreTypeQ2);
    if (!tier) continue;
    const code = row.customerCode.trim();
    if (code) registerGate(map, code, row, tier);
    const bm = row.codeBm.trim();
    if (bm && bm.toLowerCase() !== code.toLowerCase()) {
      registerGate(map, bm, row, tier);
    }
  }
  return map;
}

export function lookupPsCustomerGate(
  map: Map<string, PsCustomerGate>,
  customerCode: string
): PsCustomerGate | null {
  const k = customerCode.trim().toLowerCase();
  if (!k) return null;
  return map.get(k) ?? null;
}
