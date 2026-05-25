/**
 * Kiểm tra 5 kịch bản khóa DummyBox (chạy: node scripts/verify-dummybox-gate.mjs)
 * Logic mirror utils/dummyBoxGate.ts — không import TS.
 */

const DUMMY_BOX_LOCAL_MIN_AMOUNT = 1_000_000;

function normalizeCustomerCodeKey(code) {
  if (code == null || code === '') return '';
  if (typeof code === 'number' && Number.isFinite(code)) {
    return Number.isInteger(code) ? String(code) : String(code);
  }
  return String(code).trim().replace(/\s+/g, ' ');
}

function resolveRowCustomerCode(row) {
  return normalizeCustomerCodeKey(
    row['CustomerCode'] ?? row['Customer Code'] ?? row['MaKH'] ?? row['Mã KH'] ?? row['Ma KH'] ?? ''
  );
}

function isGoiYes(v) {
  return String(v ?? '').trim().toUpperCase() === 'YES';
}

function mergeDummyBoxMarketingByCode(records) {
  const map = new Map();
  for (const record of records) {
    if (!record) continue;
    const code = resolveRowCustomerCode(record);
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

function buildDummyBoxListGate(customerCode, map, options = {}) {
  const code = normalizeCustomerCodeKey(customerCode);
  if (!code) {
    return { inList: false, goiLocalRegistered: false, goiImportRegistered: false, pending: options.pending };
  }
  if (options.pending) {
    return {
      inList: false,
      goiLocalRegistered: !!options.orderHadDummyBoxLocal,
      goiImportRegistered: !!options.orderHadDummyBoxImport,
      pending: true,
    };
  }
  const rec = map.get(code);
  return {
    inList: !!rec,
    goiLocalRegistered: isGoiYes(rec?.GoiLocal) || !!options.orderHadDummyBoxLocal,
    goiImportRegistered: isGoiYes(rec?.GoiImport) || !!options.orderHadDummyBoxImport,
    pending: false,
  };
}

function getDummyBoxToggleState(gate, variant, eligible, options = {}) {
  const registered =
    variant === 'local' ? gate?.goiLocalRegistered === true : gate?.goiImportRegistered === true;
  if (registered) {
    return { canToggle: false, lockReason: variant === 'local' ? 'registered_local' : 'registered_import' };
  }
  if (gate?.pending) {
    return { canToggle: false, lockReason: 'pending', labelSuffix: ' — Đang tải DS DummyBox…' };
  }
  const inList = gate === undefined ? true : gate.inList;
  if (!inList) {
    return { canToggle: false, lockReason: 'not_in_list', labelSuffix: ' — Chưa trong DS' };
  }
  if (!eligible) {
    return {
      canToggle: false,
      lockReason: variant === 'local' ? 'not_eligible_local' : 'not_eligible_import',
      labelSuffix: ' — Cần ≥1tr',
    };
  }
  return { canToggle: true, lockReason: null, labelSuffix: '' };
}

const map = mergeDummyBoxMarketingByCode([
  { CustomerCode: '12345' },
  { CustomerCode: 67890, GoiLocal: 'YES' },
  { 'Mã KH': ' 99 88 ' },
]);

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    failed++;
  } else {
    console.log('OK:', name);
  }
}

// 1. Tải chậm / pending
const pendingGate = buildDummyBoxListGate('12345', map, { pending: true });
const pendingToggle = getDummyBoxToggleState(pendingGate, 'local', true);
assert('1. pending lockReason', pendingToggle.lockReason === 'pending');
assert('1. pending label', pendingToggle.labelSuffix.includes('Đang tải'));

// 2. Không trong DS
const notInGate = buildDummyBoxListGate('00000', map, { pending: false });
assert('2. not in list', getDummyBoxToggleState(notInGate, 'local', true).lockReason === 'not_in_list');

// 3. Chưa đủ 1tr
const inListGate = buildDummyBoxListGate('12345', map, { pending: false });
assert(
  '3. not eligible',
  getDummyBoxToggleState(inListGate, 'local', false).lockReason === 'not_eligible_local'
);

// 4. Đủ điều kiện
assert('4. can toggle', getDummyBoxToggleState(inListGate, 'local', true).canToggle === true);

// 5. Đã đặt gói
const registeredGate = buildDummyBoxListGate('67890', map, { pending: false });
assert(
  '5. registered',
  getDummyBoxToggleState(registeredGate, 'local', true).lockReason === 'registered_local'
);

assert('normalize number key', normalizeCustomerCodeKey(12345) === '12345');
assert('Mã KH column merge', map.has('99 88'));
assert('min amount constant', DUMMY_BOX_LOCAL_MIN_AMOUNT === 1_000_000);

if (failed) {
  console.error(`\n${failed} scenario(s) failed`);
  process.exit(1);
}
console.log('\nAll 5 DummyBox gate scenarios passed.');
