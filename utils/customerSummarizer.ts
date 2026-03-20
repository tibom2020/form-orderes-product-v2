
import type { SalesRecord, ForecastItem, CustomerSalesNoticePayload } from '../types';
import { formatCurrency } from './formatters';

const REBATE_TIERS = [
    { level: 1, amount: 1500000, percent: 3.0 },
    { level: 2, amount: 3000000, percent: 3.5 },
    { level: 3, amount: 5000000, percent: 4.0 },
    { level: 4, amount: 10000000, percent: 4.5 },
    { level: 5, amount: 15000000, percent: 5.0 },
    { level: 6, amount: 25000000, percent: 5.5 },
];

const getRebateLevel = (amount: number) => {
    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
        if (amount >= REBATE_TIERS[i].amount) {
            return REBATE_TIERS[i];
        }
    }
    return null;
};

export const generateCustomerSummary = (
    record: SalesRecord | undefined,
    forecast: ForecastItem | undefined
): string => {
    if (!record) return 'Không có dữ liệu khách hàng.';

    const actualImport = Number(record.ActualImport) || 0;
    const targetImport = Number(record.TargetImport) || 0;
    const actualLocal = Number(record.ActualLocal) || 0;
    const targetLocal = Number(record.TargetLocal) || 0;

    const importPct = targetImport > 0 ? (actualImport / targetImport) * 100 : 0;
    const localPct = targetLocal > 0 ? (actualLocal / targetLocal) * 100 : 0;

    const importTier = getRebateLevel(actualImport);
    const localTier = getRebateLevel(actualLocal);




    // Header Info
    let summary = `📍 KH: ${record.CustomerName}\n`;
    summary += `🏆 Loại TB: ${record.FinalStoreType || 'Thành viên'}\n`;

    // KPI Tháng hiện tại
    summary += `📊 KPI THÁNG HIỆN TẠI:\n`;
    summary += `🔹 Import: ${formatCurrency(actualImport)} (${importPct.toFixed(1)}% / ${formatCurrency(targetImport)})\n`;
    summary += `   ➔ ${importTier ? `Mức: ${importTier.level} (CK: ${importTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'}\n`;

    summary += `🔹 Local: ${formatCurrency(actualLocal)} (${localPct.toFixed(1)}% / ${formatCurrency(targetLocal)})\n`;
    summary += `   ➔ ${localTier ? `Mức: ${localTier.level} (CK: ${localTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'}\n\n`;
    // Doanh số Quý (Tính từ tổng MW + Other)
    const totalQuarterDS = (Number(record.MustWin) || 0) + (Number(record.Other) || 0);
    summary += `💰 TOTAL DS QUÝ: ${formatCurrency(totalQuarterDS)}\n\n`;
 
    const hasCheck = record.Check != null && String(record.Check).trim() !== '';
    const hasCounterTop = record.CounterTop != null && String(record.CounterTop).trim() !== '';
    const hasCDU = record.CDU != null && String(record.CDU).trim() !== '';
    if (hasCheck || hasCounterTop || hasCDU) {
        summary += `📑 TRẠNG THÁI:\n`;
        if (hasCheck) summary += `+ Điều kiện TB: ${record.Check}\n`;
        if (hasCounterTop) summary += `+ Counter Top: ${record.CounterTop}\n`;
        if (hasCDU) summary += `+ CDU: ${record.CDU}\n`;
    }
// Dự báo T3 - chỉ hiện khi có dữ liệu
    const hasImportLevel = forecast && forecast.ImportLevel != null && String(forecast.ImportLevel).trim() !== '';
    const hasLocalLevel = forecast && forecast.LocalLevel != null && String(forecast.LocalLevel).trim() !== '';
    if (hasImportLevel || hasLocalLevel) {
        summary += `\n📈 FORECAST T3:\n`;
        if (hasImportLevel) summary += `+ Import: ${forecast!.ImportLevel}\n`;
        if (hasLocalLevel) summary += `+ Local: ${forecast!.LocalLevel}\n`;
    }
    summary += `\nNote : Doanh số chưa bao gồm đơn đã đặt\n`;
    return summary;
};

/** Helper: lấy số an toàn từ record (sheet có thể dùng tên cột khác, giá trị có thể là chuỗi định dạng VN) */
const safeNum = (r: Record<string, unknown>, ...keys: string[]): number => {
    for (const k of keys) {
        const v = r[k];
        if (v === null || v === undefined) continue;
        if (typeof v === 'number' && !isNaN(v)) return v;
        const s = String(v).replace(/\./g, '').replace(/,/g, '');
        const n = Number(s);
        if (!isNaN(n)) return n;
    }
    return 0;
};

/** Helper: lấy chuỗi an toàn */
const safeStr = (r: Record<string, unknown>, ...keys: string[]): string => {
    for (const k of keys) {
        const v = r[k];
        if (v !== null && v !== undefined) return String(v).trim();
    }
    return '';
};

const isPassStatus = (status: string): boolean => {
    const s = (status || '').toLowerCase().trim();
    return s.includes('đạt') || s.includes('dat') || s.includes('pass') || s === 'yes' || s === 'ok';
};

const getQuarterTargetByStoreType = (storeType: string): number => {
    const s = (storeType || '').toLowerCase();
    if (s.includes('gold')) return 40_000_000;
    if (s.includes('silver')) return 20_000_000;
    return 0;
};

/**
 * Tạo payload xuất thông tin Doanh số KH (gửi n8n/Telegram).
 * - Code giga = CustomerCode, Code BM = CodeBuyMed
 * - Số tiền thưởng dự kiến = doanh số x % level chiết khấu
 * - Điều kiện TB: bổ sung doanh số đã đặt và todo để đạt
 * - Counter top, CDU: để trống nếu không có (không dùng N/A)
 * - Bỏ Forecast T3 và Note
 * - Thêm: Vui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng
 */
export const buildCustomerSalesNoticePayload = (
    record: SalesRecord | undefined,
    employeeName: string
): CustomerSalesNoticePayload | null => {
    if (!record || typeof record !== 'object') return null;

    const r = record as unknown as Record<string, unknown>;

    const actualImport = safeNum(r, 'ActualImport', 'Actual Import');
    const targetImport = safeNum(r, 'TargetImport', 'Target Import');
    const actualLocal = safeNum(r, 'ActualLocal', 'Actual Local');
    const targetLocal = safeNum(r, 'TargetLocal', 'Target Local');

    const importPct = targetImport > 0 ? (actualImport / targetImport) * 100 : 0;
    const localPct = targetLocal > 0 ? (actualLocal / targetLocal) * 100 : 0;

    const importTier = getRebateLevel(actualImport);
    const localTier = getRebateLevel(actualLocal);

    const expectedBonusImport = importTier ? actualImport * (importTier.percent / 100) : 0;
    const expectedBonusLocal = localTier ? actualLocal * (localTier.percent / 100) : 0;

    const todoTotal = safeNum(r, 'Todo', 'Todo TB');
    const doanhSoDaDat = safeNum(r, 'Sale', 'Sale T1');

    const codeGiga = safeStr(r, 'CustomerCode', 'Customer Code', 'Code');
    const codeBM = safeStr(r, 'CodeBuyMed', 'Code BM', 'BM');
    const customerName = safeStr(r, 'CustomerName', 'Customer Name', 'Location Name');
    const finalStoreType = safeStr(r, 'FinalStoreType', 'Final Store Type');
    const checkStatus = safeStr(r, 'Check');
    const passed = isPassStatus(checkStatus);
    const signedTodo = passed ? Math.abs(todoTotal) : -Math.abs(todoTotal);
    const counterTopStr = safeStr(r, 'CounterTop', 'Counter Top');
    const cduStr = safeStr(r, 'CDU');

    const mustWin = safeNum(r, 'MustWin', 'Must Win');
    const other = safeNum(r, 'Other');
    const totalQuarterDS = mustWin + other;
    const quarterTarget = getQuarterTargetByStoreType(finalStoreType);
    const quarterTodo = quarterTarget > 0 ? (totalQuarterDS - quarterTarget) : totalQuarterDS;
    const isQuarterPassed = quarterTodo >= 0;
    const quarterStatusLabel = quarterTarget > 0
        ? (isQuarterPassed ? 'ĐẠT' : 'CHƯA ĐẠT')
        : 'THAM GIA TB QUÝ';

    let message = `📊 THÔNG TIN DOANH SỐ KHÁCH HÀNG\n`;
    message += `--------------------------------\n`;
    message += `📍 KH: ${customerName || 'N/A'}\n`;
    message += `🔢 Code Giga: ${codeGiga || ''}\n`;
    message += `🔢 Code BM: ${codeBM || ''}\n`;
    message += `🏆 Loại TB: ${finalStoreType || 'Thành viên'}\n`;
    message += `🧑‍💼 NV: ${employeeName || ''}\n`;
    message += `\n📊 KPI THÁNG HIỆN TẠI:\n`;
    message += `🔹 Import: ${formatCurrency(actualImport)} (${importPct.toFixed(1)}% / ${formatCurrency(targetImport)})\n`;
    message += `   ➔ ${importTier ? `Mức: ${importTier.level} (CK: ${importTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusImport)}\n`;
    message += `🔹 Local: ${formatCurrency(actualLocal)} (${localPct.toFixed(1)}% / ${formatCurrency(targetLocal)})\n`;
    message += `   ➔ ${localTier ? `Mức: ${localTier.level} (CK: ${localTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusLocal)}\n`;

    message += `\n💰 TOTAL DS QUÝ: ${formatCurrency(totalQuarterDS)}\n`;
    message += `\n🎯 THAM GIA TB QUÝ 2.2026:\n`;
    message += `+ TRẠNG THÁI: ${quarterStatusLabel}\n`;
    message += `+ MỤC TIÊU QUÝ: ${quarterTarget > 0 ? formatCurrency(quarterTarget) : 'THAM GIA TB QUÝ'}\n`;
    message += `+ TODO: ${quarterTodo > 0 ? '+' : ''}${formatCurrency(quarterTodo)}\n`;

    message += `\n📑 ĐIỀU KIỆN TB:\n`;
    message += `+ Trạng thái: ${checkStatus}\n`;
    message += `+ Doanh số đã đặt: ${formatCurrency(doanhSoDaDat)}\n`;
    message += `+ Todo TB: ${signedTodo > 0 ? '+' : ''}${formatCurrency(signedTodo)}\n`;
    if (counterTopStr) message += `+ Counter Top: ${counterTopStr}\n`;
    if (cduStr) message += `+ CDU: ${cduStr}\n`;

    message += `\nVui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng.\n`;

    return {
        code: codeGiga,
        codeGiga,
        codeBM,
        customerName: customerName || 'N/A',
        employeeName: employeeName || '',
        message,
    };
};

/** Dữ liệu để hiển thị nội dung thông tin doanh số KH (dùng cho UI có màu) */
export interface CustomerSalesDisplayData {
    codeGiga: string;
    codeBM: string;
    customerName: string;
    employeeName: string;
    finalStoreType: string;
    actualImport: number;
    targetImport: number;
    importPct: number;
    importTier: { level: number; percent: number } | null;
    expectedBonusImport: number;
    actualLocal: number;
    targetLocal: number;
    localPct: number;
    localTier: { level: number; percent: number } | null;
    expectedBonusLocal: number;
    totalQuarterDS: number;
    quarterTarget: number;
    quarterTodo: number;
    isQuarterPassed: boolean;
    quarterStatusLabel: string;
    checkStatus: string;
    doanhSoDaDat: number;
    todoTotal: number;
    signedTodoTotal: number;
    isCheckPassed: boolean;
    counterTopStr: string;
    cduStr: string;
}

export const getCustomerSalesDisplayData = (
    record: SalesRecord | undefined,
    employeeName: string
): CustomerSalesDisplayData | null => {
    if (!record || typeof record !== 'object') return null;
    const r = record as unknown as Record<string, unknown>;
    const actualImport = safeNum(r, 'ActualImport', 'Actual Import');
    const targetImport = safeNum(r, 'TargetImport', 'Target Import');
    const actualLocal = safeNum(r, 'ActualLocal', 'Actual Local');
    const targetLocal = safeNum(r, 'TargetLocal', 'Target Local');
    const importPct = targetImport > 0 ? (actualImport / targetImport) * 100 : 0;
    const localPct = targetLocal > 0 ? (actualLocal / targetLocal) * 100 : 0;
    const importTier = getRebateLevel(actualImport);
    const localTier = getRebateLevel(actualLocal);
    const expectedBonusImport = importTier ? actualImport * (importTier.percent / 100) : 0;
    const expectedBonusLocal = localTier ? actualLocal * (localTier.percent / 100) : 0;
    const todoTotal = safeNum(r, 'Todo', 'Todo TB');
    const checkStatus = safeStr(r, 'Check');
    const isCheckPassed = isPassStatus(checkStatus);
    const signedTodoTotal = isCheckPassed ? Math.abs(todoTotal) : -Math.abs(todoTotal);
    const doanhSoDaDat = safeNum(r, 'Sale', 'Sale T1');
    const mustWin = safeNum(r, 'MustWin', 'Must Win');
    const other = safeNum(r, 'Other');
    const finalStoreType = safeStr(r, 'FinalStoreType', 'Final Store Type') || 'Thành viên';
    const totalQuarterDS = mustWin + other;
    const quarterTarget = getQuarterTargetByStoreType(finalStoreType);
    const quarterTodo = quarterTarget > 0 ? (totalQuarterDS - quarterTarget) : totalQuarterDS;
    const isQuarterPassed = quarterTodo >= 0;
    const quarterStatusLabel = quarterTarget > 0
        ? (isQuarterPassed ? 'ĐẠT' : 'CHƯA ĐẠT')
        : 'THAM GIA TB QUÝ';
    return {
        codeGiga: safeStr(r, 'CustomerCode', 'Customer Code', 'Code'),
        codeBM: safeStr(r, 'CodeBuyMed', 'Code BM', 'BM'),
        customerName: safeStr(r, 'CustomerName', 'Customer Name', 'Location Name') || 'N/A',
        employeeName: employeeName || '',
        finalStoreType,
        actualImport,
        targetImport,
        importPct,
        importTier,
        expectedBonusImport,
        actualLocal,
        targetLocal,
        localPct,
        localTier,
        expectedBonusLocal,
        totalQuarterDS,
        quarterTarget,
        quarterTodo,
        isQuarterPassed,
        quarterStatusLabel,
        checkStatus,
        doanhSoDaDat,
        todoTotal,
        signedTodoTotal,
        isCheckPassed,
        counterTopStr: safeStr(r, 'CounterTop', 'Counter Top'),
        cduStr: safeStr(r, 'CDU'),
    };
};
