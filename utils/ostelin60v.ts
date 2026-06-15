/** Đơn gói Ostelin 60V (5h) từ ngày này ghi nhận Đợt 2 — khớp sheet cột Dot_2 */
export const OSTELIN_60V_DOT2_START_MS = new Date('2026-05-20T00:00:00+07:00').getTime();

export const OSTELIN_TANG_CAN_NOTE = 'Gói Ostelin tặng máy đo HA';
/** Ghi chú cũ (nháp / đơn trước đổi tên) */
export const OSTELIN_TANG_CAN_NOTE_LEGACY = [
  'Gói Ostelin tặng cân',
  'Gói Ostelin 60V (5h)',
] as const;

export const OSTELIN_TANG_CAN_ALL_NOTES: readonly string[] = [
  OSTELIN_TANG_CAN_NOTE,
  ...OSTELIN_TANG_CAN_NOTE_LEGACY,
];

export function isOstelin60VDot2Order(at = Date.now()): boolean {
  return at >= OSTELIN_60V_DOT2_START_MS;
}

export function parseSheetTimestampMs(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(v > 1e12 ? v : v * 86400000);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Đợt 2: cột sheet Dot_2 hoặc suy từ timestamp ≥ ngày bắt đầu đợt 2 */
export function isOstelin60VRowDot2(row: Record<string, unknown>, tsRaw?: unknown): boolean {
  const raw = row['Dot_2'] ?? row['Đợt_2'] ?? row['Đợt 2'] ?? '';
  const label = String(raw).trim();
  if (label) {
    return /đợt\s*2|dot\s*2|^yes$/i.test(label);
  }
  const ms = parseSheetTimestampMs(tsRaw ?? row.Timestamp ?? row.timestamp);
  if (ms != null) return ms >= OSTELIN_60V_DOT2_START_MS;
  return false;
}

export function formatOstelinDot2Label(isDot2: boolean): string {
  return isDot2 ? 'Đợt 2' : 'Đợt 1';
}

export function noteHasOstelinTangCan(note: string): boolean {
  const lines = note.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.some(l => OSTELIN_TANG_CAN_ALL_NOTES.includes(l));
}

export function stripOstelinTangCanNoteLines(lines: string[]): string[] {
  return lines.filter(l => !OSTELIN_TANG_CAN_ALL_NOTES.includes(l));
}

type OstelinGoiOrderRef = {
  customerCode?: string;
  ostelin60VPackages?: number;
  ostelin60VDot2?: boolean;
};

/** Mã KH đã ghi gói Ostelin Đợt 2 (sheet Dot_2 hoặc đơn đã gửi) — khóa tick tặng máy đo HA lần 2 */
export function buildOstelin60VDot2PurchasedCodeSet(
  rows: Record<string, unknown>[],
  sentOrders: OstelinGoiOrderRef[]
): Set<string> {
  const purchased = new Set<string>();
  rows.forEach((row) => {
    const code = String(row['CustomerCode'] ?? '').trim();
    if (!code) return;
    const slGoi =
      Number(row['SL_goi'] ?? row['SL gói 21.67%'] ?? row['SL gói 21.97%'] ?? 0) || 0;
    if (slGoi <= 0) return;
    if (isOstelin60VRowDot2(row, row.Timestamp ?? row.timestamp)) purchased.add(code);
  });
  sentOrders.forEach((o) => {
    const code = String(o.customerCode ?? '').trim();
    if (!code) return;
    if ((o.ostelin60VPackages ?? 0) > 0 && o.ostelin60VDot2) purchased.add(code);
  });
  return purchased;
}
