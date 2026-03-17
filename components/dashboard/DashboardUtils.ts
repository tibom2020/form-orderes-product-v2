

export const ADMIN_CODE = '20043741'; // Phan Viet Linh
export const ADMIN_NAME = 'Phan Viet Linh';

export const KPI_TARGETS: Record<string, { Total: number, MustWin: number, Other: number, AO: number, MSO: number, Active: number }> = {
    'Huynh Hoang Hon': { Total: 1899923672, MustWin: 1106990861, Other: 792932811, AO: 130, MSO: 85, Active: 130 },
    'Huynh Thi To Trinh': { Total: 1801327943, MustWin: 1091590887, Other: 709737056, AO: 130, MSO: 85, Active: 130 },
    'Huynh Van Thanh Huyen': { Total: 2900304923, MustWin: 1706063145, Other: 1194241777, AO: 130, MSO: 85, Active: 130 },
    'Le Huu Phuc': { Total: 1703792575, MustWin: 817304886, Other: 886487689, AO: 130, MSO: 85, Active: 130 },
    'Ly Minh Dat': { Total: 1976406056, MustWin: 1253100503, Other: 723305553, AO: 130, MSO: 85, Active: 130 },
    'Nguyen Thi Hong Cam': { Total: 1599754667, MustWin: 892556791, Other: 707197876, AO: 130, MSO: 85, Active: 130 },
    'Truong Hoang Du': { Total: 2023730916, MustWin: 883013722, Other: 1140717195, AO: 130, MSO: 85, Active: 130 },
};

/** Product groups for KPI (Total = MustWin + Other) */
export const PRODUCT_GROUPS_ALL = [
    'BUSCOPAN (B.I)', 'CAL CORBIERE', 'ENTEROGERMINA', 'Nospa Import', 'Nospa Local',
    'PHARMATON', 'TELFAST', 'BISOLVON', 'OSTELIN', 'ACEMUC', 'PHOSPHALUGEL (B.I)', 'MAGNE B6'
];
export const MUST_WIN_GROUPS = ['CAL CORBIERE', 'ENTEROGERMINA'];
export const OTHER_GROUPS = PRODUCT_GROUPS_ALL.filter(g => !MUST_WIN_GROUPS.includes(g));

/** Target theo sản phẩm theo nhân viên (fallback khi chưa có sheet TARGET) */
export const getProductTargetsByEmployee = (employeeName: string): Record<string, number> => {
    const kpi = KPI_TARGETS[employeeName];
    if (!kpi) return {};
    const result: Record<string, number> = {};
    const halfMustWin = Math.round(kpi.MustWin / 2);
    MUST_WIN_GROUPS.forEach((g, i) => { result[g] = i === 0 ? halfMustWin : kpi.MustWin - halfMustWin; });
    const otherPerProduct = OTHER_GROUPS.length > 0 ? Math.round(kpi.Other / OTHER_GROUPS.length) : 0;
    OTHER_GROUPS.forEach((g, i) => { result[g] = i < OTHER_GROUPS.length - 1 ? otherPerProduct : kpi.Other - otherPerProduct * (OTHER_GROUPS.length - 1); });
    return result;
};

/** Map tên sản phẩm từ sheet TARGET sang PRODUCT_GROUPS_ALL */
const PRODUCT_NAME_ALIASES: Record<string, string> = {
    'ENTEROGERMINA': 'ENTEROGERMINA',
    'CAL CORBIERE': 'CAL CORBIERE',
    'TELFAST': 'TELFAST',
    'PHARMATON': 'PHARMATON',
    'PHOSPHALUGEL (B.I)': 'PHOSPHALUGEL (B.I)',
    'ACEMUC': 'ACEMUC',
    'MAGNE B6': 'MAGNE B6',
    'BISOLVON': 'BISOLVON',
    'NOSPA Local': 'Nospa Local',
    'Nospa Local': 'Nospa Local',
    'NOSPA Import': 'Nospa Import',
    'Nospa Import': 'Nospa Import',
    'BUSCOPAN (B.I)': 'BUSCOPAN (B.I)',
    'OSTELIN': 'OSTELIN',
};

const normalizeProductName = (name: string): string | null => {
    const t = String(name || '').trim();
    if (!t) return null;
    if (PRODUCT_GROUPS_ALL.includes(t)) return t;
    const alias = PRODUCT_NAME_ALIASES[t] || Object.keys(PRODUCT_NAME_ALIASES).find(k => k.toLowerCase() === t.toLowerCase());
    return alias || (PRODUCT_GROUPS_ALL.find(p => p.toLowerCase() === t.toLowerCase()) || null);
};

/** Chuẩn hóa dữ liệu từ sheet: hỗ trợ cả array of objects và array of arrays */
const normalizeTargetRows = (raw: unknown[]): Record<string, unknown>[] => {
    if (raw.length === 0) return [];
    const first = raw[0];
    if (Array.isArray(first)) {
        const headers = (first as unknown[]).map(h => String(h ?? '').trim());
        return raw.slice(1).map((row: unknown) => {
            const arr = Array.isArray(row) ? row : [];
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => { if (h) obj[h] = arr[i]; });
            return obj;
        });
    }
    return raw as Record<string, unknown>[];
};

/** Danh sách tên NV để map cột sheet (từ KPI_TARGETS + Admin) */
const KNOWN_EMPLOYEES = [...Object.keys(KPI_TARGETS), 'Phan Viet Linh', 'Ngo Thi Thuy Quynh'];

const normalizeEmployeeColumn = (colKey: string): string | null => {
    const t = String(colKey || '').trim().replace(/\uFEFF/g, '');
    if (!t) return null;
    const lower = t.toLowerCase();
    const found = KNOWN_EMPLOYEES.find(e => e.toLowerCase() === lower || e.toLowerCase().replace(/\s+/g, ' ') === lower.replace(/\s+/g, ' '));
    return found || t;
};

/** Build productTargetsByEmployee từ sheet TARGET (Sub Brand Name + cột theo tên NV) */
export const buildProductTargetsFromSheet = (rawRows: unknown[]): Record<string, Record<string, number>> => {
    const rows = normalizeTargetRows(Array.isArray(rawRows) ? rawRows : []);
    const result: Record<string, Record<string, number>> = {};
    const productKeys = ['Sub Brand Name', 'SubBrandName', 'Nhóm sản phẩm', 'Product', 'product', 'A', '0'];
    const excludeKeys = new Set([...productKeys, 'Group', 'group', '']);
    const headerLikeValues = new Set(['Sub Brand Name', 'SubBrandName', 'Group', 'Nhóm sản phẩm', 'Product']);
    for (const row of rows) {
        const productNameRaw = productKeys.map(k => row[k]).find(v => v != null && String(v).trim());
        const rawStr = String(productNameRaw || Object.values(row)[0] || '').trim();
        if (headerLikeValues.has(rawStr)) continue;
        const productName = normalizeProductName(rawStr);
        if (!productName) continue;
        for (const [key, val] of Object.entries(row)) {
            const colNorm = normalizeEmployeeColumn(key);
            if (!colNorm || excludeKeys.has(key)) continue;
            const num = typeof val === 'number' && !isNaN(val) ? val : parseFloat(String(val || '').replace(/,/g, ''));
            if (isNaN(num) || num < 0) continue;
            const empName = colNorm;
            if (!result[empName]) result[empName] = {};
            result[empName][productName] = (result[empName][productName] || 0) + num;
        }
    }
    return result;
};

export const REBATE_TIERS = [
    { level: 1, amount: 1500000, percent: 3.0 },
    { level: 2, amount: 3000000, percent: 3.5 },
    { level: 3, amount: 5000000, percent: 4.0 },
    { level: 4, amount: 10000000, percent: 4.5 },
    { level: 5, amount: 15000000, percent: 5.0 },
    { level: 6, amount: 25000000, percent: 5.5 },
];

/** Mục tiêu % cần đạt: AO 102%, MSO 90% */
export const AO_TODO_PERCENT = 102;
export const MSO_TODO_PERCENT = 90;

/** Số lượng AO cần thêm để đạt 102% (làm tròn lên) */
export const calculateAoTodo = (actual: number, target: number) => {
    const targetAt102 = Math.ceil((target * AO_TODO_PERCENT) / 100);
    return Math.max(0, targetAt102 - actual);
};

/** Số lượng MSO cần thêm để đạt 90% (làm tròn lên) */
export const calculateMsoTodo = (actual: number, target: number) => {
    const targetAt90 = Math.ceil((target * MSO_TODO_PERCENT) / 100);
    return Math.max(0, targetAt90 - actual);
};

export const calculatePercent = (actual: number, target: number) => {
    if (!target || target === 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / target) * 100, 100);
};

export const getRawPercent = (actual: number, target: number) => {
    if (!target || target === 0) return 0;
    return (actual / target) * 100;
};

export const formatDateVal = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '';

    let date: Date;

    if (typeof val === 'number') {
        date = new Date((val - 25569) * 86400 * 1000);
    } else {
        const str = String(val);
        if (str.includes('T')) {
            date = new Date(str);
        } else {
            return str;
        }
    }

    if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    return String(val);
};

export const formatCompact = (amount: number) => {
    if (!amount || amount === 0) return '0';
    if (amount >= 1000000000) {
        return (amount / 1000000000).toFixed(1).replace(/\.0$/, '') + ' Tỷ';
    }
    if (amount >= 1000000) {
        return Math.round(amount / 1000000) + ' Tr';
    }
    if (amount >= 1000) {
        return Math.round(amount / 1000) + ' k';
    }
    return new Intl.NumberFormat('vi-VN').format(amount);
};

export const getRebateLevel = (amount: number) => {
    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
        if (amount >= REBATE_TIERS[i].amount) {
            return REBATE_TIERS[i];
        }
    }
    return null;
};
