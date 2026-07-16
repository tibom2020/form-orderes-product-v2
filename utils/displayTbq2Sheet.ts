/** Chuẩn hóa dòng sheet DANGKYTBQ2 (header có thể khác mẫu Excel) */

export interface DangKyTbq2RowView {
  customerCode: string;
  /** Cột sheet Code BM / BuyMed */
  codeBm: string;
  customerName: string;
  /** Cột sheet FinalStoreTypeQ1 */
  finalStoreTypeQ1: string;
  /** Cột sheet Sale Q1 */
  saleQ1: string;
  district: string;
  sdt: string;
  rep: string;
  /** NV thao tác đăng ký Q2 (sheet) — dùng quyền hủy khi khác cột Rep */
  nvDangKy: string;
  /** Cột sheet FinalStoreTypeQ2 */
  finalStoreTypeQ2: string;
  /** POSM / cam kết trưng bày — giá trị ô sheet (0/1, tick, v.v.) */
  frameOtc: string;
  frameFs: string;
  topboard: string;
  frontCounter: string;
  countertop: string;
  /** Doanh số tháng 7 theo sheet DANGKYTBQ2 */
  saleT7: string;
  saleT5: string;
  saleT6: string;
  saleQ3: string;
  /** Cột sheet Gói PS 25% — YES/NO (gạt tay trên DANGKYTBQ2) */
  goiPs25: string;
  /** Số suất PS 25% đã dùng (cột sheet — cập nhật khi gửi đơn) */
  suatPsDaDung: number;
  note: string;
  trangThai: string;
  pheDuyet: string;
  storeType: string;
  raw: Record<string, unknown>;
}

/** Header cột Gói PS 25% trên DANGKYTBQ2 */
export const SUAT_PS_DA_DUNG_HEADER_ALIASES = [
  'Suất PS đã dùng',
  'Suat PS da dung',
  'SL suất PS',
  'SL suat PS',
  'SuatPSDaDung',
] as const;

export function parseSuatPsDaDung(raw: string): number {
  const n = Math.floor(Number(String(raw ?? '').replace(/[^\d.-]/g, '')) || 0);
  return Math.max(0, n);
}

export const GOI_PS25_HEADER_ALIASES = [
  'Gói PS 25%',
  'Goi PS 25%',
  'GOI PS 25%',
  'Gói PS25',
  'DaDatGoiPS',
  'On invoice PS',
] as const;

/** Ghi YES/NO vào object dòng sheet (sau khi Apps Script cập nhật) */
export function setGoiPs25CellInRow(
  row: Record<string, unknown>,
  value: 'YES' | 'NO'
): Record<string, unknown> {
  const next = { ...row };
  const rowKeys = Object.keys(next);
  let set = false;
  for (const alias of GOI_PS25_HEADER_ALIASES) {
    if (alias in next) {
      next[alias] = value;
      set = true;
    }
    const found = rowKeys.find(rk => rk.trim().toLowerCase() === alias.trim().toLowerCase());
    if (found) {
      next[found] = value;
      set = true;
    }
  }
  if (!set) next['Gói PS 25%'] = value;
  return next;
}

function pickCell(row: Record<string, unknown>, keys: readonly string[]): string {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
    const found = rowKeys.find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (found != null && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

export function normalizeDangKyTbq2Row(row: Record<string, unknown>): DangKyTbq2RowView {
  return {
    customerCode: pickCell(row, ['CustomerCode', 'MaKH', 'Mã KH', 'Code', 'customerCode']),
    codeBm: pickCell(row, [
      'Code BM',
      'CodeBM',
      'Code BuyMed',
      'CodeBuyMed',
      'Code Buymed',
      'Mã BM',
    ]),
    customerName: pickCell(row, ['CustomerName', 'TenKH', 'Tên KH', 'Khách hàng', 'Ten CH']),
    finalStoreTypeQ1: pickCell(row, [
      'FinalStoreTypeQ1',
      'Final Store Type Q1',
      'FinalStoreType Q1',
      'Q1TB',
      'Q1_TB',
      'Q1 TB',
      'Q1Stats_TB',
    ]),
    saleQ1: pickCell(row, ['Sale Q1', 'SaleQ1', 'Q1Sale', 'Q1_Sale', 'Q1 Sale']),
    district: pickCell(row, ['District', 'Quan', 'Quận', 'Khu vực']),
    sdt: pickCell(row, ['SDT', 'Phone', 'Điện thoại', 'SoDT', 'SĐT']),
    rep: pickCell(row, ['Rep', 'REP', 'NV phụ trách']),
    nvDangKy: pickCell(row, ['NVDangKy', 'NV đăng ký', 'NV Dang ky']),
    finalStoreTypeQ2: pickCell(row, [
      'FinalStoreTypeQ2',
      'Final Store Type Q2',
      'FinalStoreType Q2',
      'Q2STATS',
      'Q2_STATS',
      'Q2 STATS',
      'Q2 Stats',
    ]),
    frameOtc: pickCell(row, ['Frame OTC', 'FrameOTC', 'FRAME OTC', 'Frame_Otc']),
    frameFs: pickCell(row, ['Frame FS', 'FrameFS', 'FRAME FS', 'Frame_Fs']),
    topboard: pickCell(row, ['Topboard', 'Top board', 'TOPBOARD']),
    frontCounter: pickCell(row, ['Front Counter', 'FrontCounter', 'FRONT COUNTER', 'Front counter']),
    countertop: pickCell(row, [
      'Countertop',
      'Counter top',
      'Countertop/CDU',
      'Countertop / CDU',
      'COUNTERTOP',
    ]),
    saleT7: pickCell(row, ['Sale T7', 'sale T7', 'SaleT7', 'T7 Sale', 'Sale T4', 'SaleT4', 'T4 Sale']),
    saleT5: pickCell(row, ['Sale T5', 'SaleT5', 'T5 Sale']),
    saleT6: pickCell(row, ['Sale T6', 'SaleT6', 'T6 Sale']),
    saleQ3: pickCell(row, [
      'Sale Q3',
      'SaleQ3',
      'Q3 Sale',
      'Q3Sale',
      'Q3_Sale',
      'Sale Q2',
      'SaleQ2',
      'Q2 Sale',
      'Q2Sale',
      'Q2_Sale',
    ]),
    goiPs25: pickCell(row, GOI_PS25_HEADER_ALIASES),
    suatPsDaDung: parseSuatPsDaDung(pickCell(row, SUAT_PS_DA_DUNG_HEADER_ALIASES)),
    note: pickCell(row, ['Note', 'Ghi chú', 'Ghi chu', 'Item', 'Mặt hàng', 'Nhóm SP', 'Ngành']),
    trangThai: pickCell(row, ['TrangThai', 'Trạng thái', 'Status']),
    pheDuyet: pickCell(row, ['PheDuyet', 'Phê duyệt', 'Phe duyet']),
    storeType: pickCell(row, ['StoreType', 'Store Type', 'LoaiCH', 'Tier']),
    raw: row,
  };
}

/** Hiển thị KH khi có ít nhất một trong hai: FinalStoreTypeQ1 hoặc FinalStoreTypeQ2 */
export function rowHasFinalStoreTypeQ1OrQ2(row: DangKyTbq2RowView): boolean {
  return row.finalStoreTypeQ1.trim() !== '' || row.finalStoreTypeQ2.trim() !== '';
}

export function isPheDuyetApproved(row: DangKyTbq2RowView): boolean {
  const p = row.pheDuyet.toLowerCase();
  return p.includes('đã duyệt') || p.includes('da duyet');
}

/**
 * Đồng bộ với Apps Script (register/cancel): ưu tiên cột Trạng thái;
 * nếu ô trống / lạ — coi là đã đăng ký khi vẫn còn tier Q2 hoặc StoreType (tránh UI «Chưa ĐK» khi sheet còn Q2).
 */
export function isRegisteredRow(row: DangKyTbq2RowView): boolean {
  const raw = row.trangThai.trim();
  if (raw) {
    const t = raw.normalize('NFC').toLowerCase();
    if (t.includes('chưa đăng ký') || t.includes('chua dang ky')) return false;
    if (t.includes('đã đăng ký') || t.includes('da dang ky')) return true;
  }
  const hasQ2OrTier = row.finalStoreTypeQ2.trim() !== '' || row.storeType.trim() !== '';
  return hasQ2OrTier;
}

/** Hiển thị ngắn: 1.0B, 600M */
export function formatShortVnd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (abs >= 1e6) return sign + Math.round(abs / 1e6) + 'M';
  if (abs >= 1e3) return sign + Math.round(abs / 1e3) + 'k';
  return sign + String(Math.round(abs));
}

export function repMatchesEmployee(repCell: string, employeeName: string): boolean {
  const a = repCell.trim().toLowerCase();
  const b = employeeName.trim().toLowerCase();
  if (!b) return false;
  if (!a) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Sheet DOANH_SO: MustWin + Other (VNĐ) — fallback khi ô Sale T7 trống. Map theo CustomerCode và CodeBuyMed (lower).
 */
export function buildSaleT4ByCustomerCodeMap(rows: Record<string, unknown>[]): Map<string, number> {
  const map = new Map<string, number>();
  const setVal = (codeRaw: string, v: number) => {
    const k = codeRaw.trim().toLowerCase();
    if (k) map.set(k, v);
  };
  for (const raw of rows) {
    const must = Number(pickCell(raw, ['MustWin', 'Must Win'])) || 0;
    const other = Number(pickCell(raw, ['Other'])) || 0;
    const saleT4 = must + other;
    const code = pickCell(raw, ['CustomerCode', 'MaKH', 'Mã KH', 'Code', 'customerCode']);
    const codeBm = pickCell(raw, ['CodeBuyMed', 'Code BuyMed', 'Code Buymed']);
    setVal(code, saleT4);
    if (codeBm.trim() && codeBm.trim().toLowerCase() !== code.trim().toLowerCase()) {
      setVal(codeBm, saleT4);
    }
  }
  return map;
}

/** Tra cứu doanh số fallback (VNĐ) theo mã KH trên DANGKYTBQ2 */
export function lookupSaleT4Vnd(map: Map<string, number>, customerCode: string): number | undefined {
  const k = customerCode.trim().toLowerCase();
  if (!k) return undefined;
  return map.get(k);
}
