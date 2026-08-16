import type { MarketingRecord } from '../types';
import {
  DUMMY_BOX_IMPORT_MIN_AMOUNT,
  DUMMY_BOX_LOCAL_MIN_AMOUNT,
  DUMMY_BOX_500_MIN_AMOUNT,
} from '../constants';

export type DummyBoxLockReason =
  | 'pending'
  | 'not_in_list'
  | 'not_eligible_local'
  | 'not_eligible_import'
  | 'registered_local'
  | 'registered_import'
  | 'mutex_150'
  | 'mutex_500'
  | null;

export interface DummyBoxListGate {
  /** Có dòng trên sheet DummyBoxRecord — được tick gói mới trên đơn (Bs alone không đủ) */
  inList: boolean;
  /** Đã đăng ký / đặt gói Local (sheet YES hoặc đơn đã gửi) */
  goiLocalRegistered: boolean;
  /** Đã đăng ký / đặt gói Import */
  goiImportRegistered: boolean;
  /** Sheet DummyBox chưa tải xong — tránh hiểu nhầm "Chưa trong DS" */
  pending?: boolean;
}

export interface DummyBoxToggleState {
  canToggle: boolean;
  lockReason: DummyBoxLockReason;
  /** Hậu tố nhãn, ví dụ " — Cần ≥1tr" (không gồm " · Đã đặt") */
  labelSuffix: string;
  title: string;
}

function isGoiYes(v: unknown): boolean {
  return String(v ?? '').trim().toUpperCase() === 'YES';
}

/** Chuẩn hóa mã KH để tra cứu map (trim, gộp khoảng trắng, số từ sheet). */
export function normalizeCustomerCodeKey(code: unknown): string {
  if (code == null || code === '') return '';
  if (typeof code === 'number' && Number.isFinite(code)) {
    return Number.isInteger(code) ? String(code) : String(code);
  }
  return String(code).trim().replace(/\s+/g, ' ');
}

/** Mã KH từ một dòng sheet DummyBox (fallback cột giống DANGKYTBQ2). */
export function resolveRowCustomerCode(row: Record<string, unknown> | MarketingRecord): string {
  const r = row as Record<string, unknown>;
  return normalizeCustomerCodeKey(
    r['CustomerCode'] ??
      r['Customer Code'] ??
      r['MaKH'] ??
      r['Mã KH'] ??
      r['Ma KH'] ??
      ''
  );
}

/** Gộp DummyBoxRecord + Bs: giữ YES nếu một trong hai sheet đã ghi YES */
export function mergeDummyBoxMarketingByCode(
  records: MarketingRecord[]
): Map<string, MarketingRecord> {
  const map = new Map<string, MarketingRecord>();
  for (const record of records) {
    if (!record) continue;
    const code = resolveRowCustomerCode(record as unknown as Record<string, unknown>);
    if (!code) continue;
    const prev = map.get(code);
    if (!prev) {
      map.set(code, { ...record, CustomerCode: code });
      continue;
    }
    map.set(code, {
      ...prev,
      ...record,
      CustomerCode: code,
      GoiLocal: isGoiYes(prev.GoiLocal) || isGoiYes(record.GoiLocal) ? 'YES' : record.GoiLocal ?? prev.GoiLocal,
      GoiImport: isGoiYes(prev.GoiImport) || isGoiYes(record.GoiImport) ? 'YES' : record.GoiImport ?? prev.GoiImport,
    });
  }
  return map;
}

export function buildDummyBoxListGate(
  customerCode: string,
  map: Map<string, MarketingRecord>,
  options?: {
    orderHadDummyBoxLocal?: boolean;
    orderHadDummyBoxImport?: boolean;
    pending?: boolean;
    /** Chỉ mã có trên DummyBoxRecord mới được tick gói (Bs-only không mở) */
    recordMap?: Map<string, MarketingRecord>;
  }
): DummyBoxListGate {
  const code = normalizeCustomerCodeKey(customerCode);
  if (!code) {
    return {
      inList: false,
      goiLocalRegistered: false,
      goiImportRegistered: false,
      pending: options?.pending,
    };
  }
  if (options?.pending) {
    return {
      inList: false,
      goiLocalRegistered: false,
      goiImportRegistered: false,
      pending: true,
    };
  }
  const rec = map.get(code);
  const inRecordList = options?.recordMap ? options.recordMap.has(code) : !!rec;
  /**
   * KH trong DS DummyBox: sheet GoiLocal/GoiImport là nguồn đúng (YES = đã đặt).
   * sentOrders localStorage chỉ khóa khi KH không còn trên DS (tránh lạm dụng CK).
   */
  const goiLocalRegistered = rec
    ? isGoiYes(rec.GoiLocal)
    : !!options?.orderHadDummyBoxLocal;
  const goiImportRegistered = rec
    ? isGoiYes(rec.GoiImport)
    : !!options?.orderHadDummyBoxImport;
  return {
    inList: inRecordList,
    goiLocalRegistered,
    goiImportRegistered,
    pending: false,
  };
}

function formatVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

export function getDummyBoxToggleState(
  gate: DummyBoxListGate | undefined,
  variant: 'local' | 'import',
  eligible: boolean,
  options?: {
    amountAfterDiscount?: number;
    minAmount?: number;
    sheetLabel?: string;
    needSuffix?: string;
    mutexBlocked?: boolean;
    mutexTitle?: string;
  }
): DummyBoxToggleState {
  const defaultMin = variant === 'local' ? DUMMY_BOX_LOCAL_MIN_AMOUNT : DUMMY_BOX_IMPORT_MIN_AMOUNT;
  const minAmount = options?.minAmount ?? defaultMin;
  const sheetLabel = options?.sheetLabel ?? 'DummyBoxRecord';
  const needSuffix = options?.needSuffix ?? ' — Cần ≥1tr';
  const variantLabel = variant === 'local' ? 'Local' : 'Import';
  const registered =
    variant === 'local' ? gate?.goiLocalRegistered === true : gate?.goiImportRegistered === true;

  if (options?.mutexBlocked) {
    return {
      canToggle: false,
      lockReason: minAmount === DUMMY_BOX_500_MIN_AMOUNT ? 'mutex_150' : 'mutex_500',
      labelSuffix: '',
      title: options.mutexTitle
        ?? (minAmount === DUMMY_BOX_500_MIN_AMOUNT
          ? 'Đã chọn DummyBox 1tr — không kết hợp gói 500k'
          : 'Đã chọn DummyBox 500k — không kết hợp gói 1tr'),
    };
  }

  if (registered) {
    return {
      canToggle: false,
      lockReason: variant === 'local' ? 'registered_local' : 'registered_import',
      labelSuffix: '',
      title: `KH đã đặt gói DummyBox ${variantLabel} — không chọn lại (kể cả khi không còn trên tab DummyBox)`,
    };
  }

  if (gate?.pending) {
    return {
      canToggle: false,
      lockReason: 'pending',
      labelSuffix: ' — Đang tải DS DummyBox…',
      title: `Đang tải danh sách DummyBox (${sheetLabel})…`,
    };
  }

  const inList = gate === undefined ? true : gate.inList;
  if (!inList) {
    return {
      canToggle: false,
      lockReason: 'not_in_list',
      labelSuffix: ' — Chưa trong DS',
      title: `Mã KH chưa có trong danh sách ${sheetLabel}`,
    };
  }

  if (!eligible) {
    const amount = options?.amountAfterDiscount;
    const progressHint =
      amount != null
        ? ` Tổng sau CK hiện tại: ${formatVnd(amount)} / ${formatVnd(minAmount)}.`
        : '';
    return {
      canToggle: false,
      lockReason: variant === 'local' ? 'not_eligible_local' : 'not_eligible_import',
      labelSuffix: needSuffix,
      title: `Chưa đủ điều kiện gói ${variantLabel}: tổng SP ${variantLabel} sau CK cần ≥ ${formatVnd(minAmount)}.${progressHint}`,
    };
  }

  return {
    canToggle: true,
    lockReason: null,
    labelSuffix: '',
    title: `Đủ điều kiện gói ${variantLabel}: tổng đơn sau CK ≥ ${formatVnd(minAmount)}`,
  };
}
