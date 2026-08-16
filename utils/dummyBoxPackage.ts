import { GOOGLE_SCRIPT_URL, DUMMY_BOX_500_SHEET } from '../constants';
import { submitMarketingData } from '../services/googleSheetService';
import type { MarketingRecord, Order } from '../types';
import { normalizeCustomerCodeKey } from './dummyBoxGate';

export type DummyBoxSheetName = 'DummyBoxRecord' | 'DummyBoxRecordBs' | 'DummyBoxRecord_1';
export type DummyBoxPackageType = 'GoiLocal' | 'GoiImport';
export type DummyBoxPackageValue = 'YES' | 'NO';

function isGoiYes(v: unknown): boolean {
  return String(v ?? '').trim().toUpperCase() === 'YES';
}

export async function registerDummyBoxPackage(
  customerCode: string,
  sheetName: DummyBoxSheetName,
  packageType: DummyBoxPackageType,
  value: DummyBoxPackageValue = 'YES'
): Promise<void> {
  await submitMarketingData(GOOGLE_SCRIPT_URL, {
    action: 'registerPackage',
    sheetName,
    customerCode,
    packageType,
    value,
  });
}

export interface AutoRegisterDummyBoxPackagesOptions {
  order: Pick<
    Order,
    'customerCode' | 'isDummyBoxLocal' | 'isDummyBoxImport' | 'isDummyBoxLocal500' | 'isDummyBoxImport500'
  >;
  marketingData: MarketingRecord[];
  marketingDataBs: MarketingRecord[];
  marketingData500?: MarketingRecord[];
  onUpdateMarketingRecord: (customerCode: string, updates: Partial<MarketingRecord>) => void;
  onUpdateMarketingRecordBs: (customerCode: string, updates: Partial<MarketingRecord>) => void;
  onUpdateMarketingRecord500?: (customerCode: string, updates: Partial<MarketingRecord>) => void;
}

/** Sau gửi đơn thành công: ghi GoiLocal/GoiImport = YES lên sheet DummyBox tương ứng. */
export async function autoRegisterDummyBoxPackagesFromOrder(
  options: AutoRegisterDummyBoxPackagesOptions
): Promise<void> {
  const {
    order,
    marketingData,
    marketingDataBs,
    marketingData500 = [],
    onUpdateMarketingRecord,
    onUpdateMarketingRecordBs,
    onUpdateMarketingRecord500,
  } = options;

  const code = normalizeCustomerCodeKey(order.customerCode);
  if (!code) return;

  const mainRec = marketingData.find(
    (r) => normalizeCustomerCodeKey(r.CustomerCode) === code
  );
  const bsRec = marketingDataBs.find(
    (r) => normalizeCustomerCodeKey(r.CustomerCode) === code
  );
  const rec500 = marketingData500.find(
    (r) => normalizeCustomerCodeKey(r.CustomerCode) === code
  );

  const tasks: Promise<void>[] = [];

  if (order.isDummyBoxLocal) {
    if (mainRec && !isGoiYes(mainRec.GoiLocal)) {
      onUpdateMarketingRecord(code, { GoiLocal: 'YES' });
      tasks.push(registerDummyBoxPackage(code, 'DummyBoxRecord', 'GoiLocal', 'YES'));
    }
    if (bsRec && !isGoiYes(bsRec.GoiLocal)) {
      onUpdateMarketingRecordBs(code, { GoiLocal: 'YES' });
      tasks.push(registerDummyBoxPackage(code, 'DummyBoxRecordBs', 'GoiLocal', 'YES'));
    }
  }

  if (order.isDummyBoxImport) {
    if (mainRec && !isGoiYes(mainRec.GoiImport)) {
      onUpdateMarketingRecord(code, { GoiImport: 'YES' });
      tasks.push(registerDummyBoxPackage(code, 'DummyBoxRecord', 'GoiImport', 'YES'));
    }
    if (bsRec && !isGoiYes(bsRec.GoiImport)) {
      onUpdateMarketingRecordBs(code, { GoiImport: 'YES' });
      tasks.push(registerDummyBoxPackage(code, 'DummyBoxRecordBs', 'GoiImport', 'YES'));
    }
  }

  if (order.isDummyBoxLocal500) {
    if (rec500 && !isGoiYes(rec500.GoiLocal)) {
      onUpdateMarketingRecord500?.(code, { GoiLocal: 'YES' });
      tasks.push(registerDummyBoxPackage(code, DUMMY_BOX_500_SHEET, 'GoiLocal', 'YES'));
    }
  }

  if (order.isDummyBoxImport500) {
    if (rec500 && !isGoiYes(rec500.GoiImport)) {
      onUpdateMarketingRecord500?.(code, { GoiImport: 'YES' });
      tasks.push(registerDummyBoxPackage(code, DUMMY_BOX_500_SHEET, 'GoiImport', 'YES'));
    }
  }

  if (tasks.length === 0) return;

  try {
    await Promise.all(tasks);
  } catch (e) {
    console.error('Lỗi khi tự động đăng ký gói DummyBox sau gửi đơn:', e);
  }
}
