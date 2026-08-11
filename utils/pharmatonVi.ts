import { parseSheetTimestampMs } from './ostelin60v';

/** Đơn gói PHARMATON VỈ từ ngày này ghi nhận Đợt 2 — khớp sheet cột Dot_2 */
export const PHARMATON_VI_DOT2_START_MS = new Date('2026-08-11T00:00:00+07:00').getTime();

export const PHARMATON_VI_GOI_NOTE = 'Gói PHARMATON VỈ';

export const PHARMATON_VI_GOI_NOTE_LEGACY = ['Gói PHARMATON VITALITY BLISTER (5h)'] as const;

export const PHARMATON_VI_GOI_ALL_NOTES: readonly string[] = [
  PHARMATON_VI_GOI_NOTE,
  ...PHARMATON_VI_GOI_NOTE_LEGACY,
];

export function isPharmatonViDot2Order(at = Date.now()): boolean {
  return at >= PHARMATON_VI_DOT2_START_MS;
}

/** Đợt 2: cột sheet Dot_2 hoặc suy từ timestamp ≥ ngày bắt đầu đợt 2 */
export function isPharmatonViRowDot2(row: Record<string, unknown>, tsRaw?: unknown): boolean {
  const raw = row['Dot_2'] ?? row['Đợt_2'] ?? row['Đợt 2'] ?? '';
  const label = String(raw).trim();
  if (label) {
    return /đợt\s*2|dot\s*2|^yes$/i.test(label);
  }
  const ms = parseSheetTimestampMs(tsRaw ?? row.Timestamp ?? row.timestamp);
  if (ms != null) return ms >= PHARMATON_VI_DOT2_START_MS;
  return false;
}

export function formatPharmatonDot2Label(isDot2: boolean): string {
  return isDot2 ? 'Đợt 2' : 'Đợt 1';
}

function pharmatonViSlGoi(row: Record<string, unknown>): number {
  return Number(row['SL_goi'] ?? row['SL gói'] ?? 0) || 0;
}

type PharmatonViGoiOrderRef = {
  customerCode?: string;
  pharmatonViPackages?: number;
  pharmatonViDot2?: boolean;
};

/** Mã KH đã ghi gói PMT Vỉ Đợt 2 — khóa tick lần 2 */
export function buildPharmatonViDot2PurchasedCodeSet(
  rows: Record<string, unknown>[],
  sentOrders: PharmatonViGoiOrderRef[]
): Set<string> {
  const purchased = new Set<string>();
  rows.forEach((row) => {
    const code = String(row['CustomerCode'] ?? '').trim();
    if (!code) return;
    if (pharmatonViSlGoi(row) <= 0) return;
    if (isPharmatonViRowDot2(row, row.Timestamp ?? row.timestamp)) purchased.add(code);
  });
  sentOrders.forEach((o) => {
    const code = String(o.customerCode ?? '').trim();
    if (!code) return;
    if ((o.pharmatonViPackages ?? 0) > 0 && o.pharmatonViDot2) purchased.add(code);
  });
  return purchased;
}

/**
 * Mã KH đã mua gói Đợt 1 (có SL_goi nhưng chưa Dot_2).
 * Dùng hiện ghi chú Cart — vẫn cho tick Đợt 2.
 */
export function buildPharmatonViDot1PurchasedCodeSet(
  rows: Record<string, unknown>[],
  sentOrders: PharmatonViGoiOrderRef[]
): Set<string> {
  const dot2 = buildPharmatonViDot2PurchasedCodeSet(rows, sentOrders);
  const purchased = new Set<string>();
  rows.forEach((row) => {
    const code = String(row['CustomerCode'] ?? '').trim();
    if (!code || dot2.has(code)) return;
    if (pharmatonViSlGoi(row) > 0) purchased.add(code);
  });
  sentOrders.forEach((o) => {
    const code = String(o.customerCode ?? '').trim();
    if (!code || dot2.has(code)) return;
    if ((o.pharmatonViPackages ?? 0) > 0 && !o.pharmatonViDot2) purchased.add(code);
  });
  return purchased;
}

export function noteHasPharmatonViGoi(note: string): boolean {
  const lines = note.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.some(l => PHARMATON_VI_GOI_ALL_NOTES.includes(l));
}

export function stripPharmatonViGoiNoteLines(lines: string[]): string[] {
  return lines.filter(l => !PHARMATON_VI_GOI_ALL_NOTES.includes(l));
}
