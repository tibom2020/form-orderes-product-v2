import type { MarketingRecord } from '../types';

export interface DummyBoxListGate {
  /** Có dòng trên sheet DummyBoxRecord / Bs — được tick gói mới trên đơn */
  inList: boolean;
  /** Đã đăng ký / đặt gói Local (sheet YES hoặc đơn đã gửi) */
  goiLocalRegistered: boolean;
  /** Đã đăng ký / đặt gói Import */
  goiImportRegistered: boolean;
}

function isGoiYes(v: unknown): boolean {
  return String(v ?? '').trim().toUpperCase() === 'YES';
}

/** Gộp DummyBoxRecord + Bs: giữ YES nếu một trong hai sheet đã ghi YES */
export function mergeDummyBoxMarketingByCode(
  records: MarketingRecord[]
): Map<string, MarketingRecord> {
  const map = new Map<string, MarketingRecord>();
  for (const record of records) {
    if (!record) continue;
    const code = String(record.CustomerCode ?? '').trim();
    if (!code) continue;
    const prev = map.get(code);
    if (!prev) {
      map.set(code, record);
      continue;
    }
    map.set(code, {
      ...prev,
      ...record,
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
  }
): DummyBoxListGate {
  const code = String(customerCode ?? '').trim();
  if (!code) {
    return { inList: false, goiLocalRegistered: false, goiImportRegistered: false };
  }
  const rec = map.get(code);
  const goiLocalRegistered =
    isGoiYes(rec?.GoiLocal) || !!options?.orderHadDummyBoxLocal;
  const goiImportRegistered =
    isGoiYes(rec?.GoiImport) || !!options?.orderHadDummyBoxImport;
  return {
    inList: !!rec,
    goiLocalRegistered,
    goiImportRegistered,
  };
}
