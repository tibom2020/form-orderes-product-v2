/** Chuẩn hóa dòng sheet DANGKYTBQ2 (header có thể khác mẫu Excel) */

export interface DangKyTbq2RowView {
  customerCode: string;
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
  note: string;
  trangThai: string;
  pheDuyet: string;
  storeType: string;
  raw: Record<string, unknown>;
}

function pickCell(row: Record<string, unknown>, keys: string[]): string {
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
      'Q2STATS',
    ]),
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
