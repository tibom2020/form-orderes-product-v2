
import type { SalesRecord, CustomerSalesNoticePayload } from '../types';
import { formatCurrency, removeVietnameseTones } from './formatters';

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

export const generateCustomerSummary = (record: SalesRecord | undefined): string => {
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
    const rSummary = record as unknown as Record<string, unknown>;
    const totalQuarterDS = (Number(record.MustWin) || 0) + (Number(record.Other) || 0);
    const dsGigaQuarter = safeNum(rSummary, 'GIGAMED');
    const dsBmQuarter = safeNum(rSummary, 'BM');
    summary += `💰 TOTAL DS QUÝ: ${formatCurrency(totalQuarterDS)}\n`;
    summary += `🟢 DOANH SỐ GIGA: ${formatCurrency(dsGigaQuarter)}\n`;
    summary += `🔴 DOANH SỐ BM: ${formatCurrency(dsBmQuarter)}\n\n`;
 
    const hasCheck = record.Check != null && String(record.Check).trim() !== '';
    if (hasCheck) {
        summary += `📑 TRẠNG THÁI:\n`;
        summary += `+ Điều kiện TB: ${record.Check}\n`;
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

/** RỚT / rớt → hiển thị CHƯA ĐẠT (Counter Top / CDU) */
export const formatCounterCduStatusDisplay = (raw: string): string => {
    const t = (raw || '').trim();
    if (!t) return '';
    const ascii = removeVietnameseTones(t).toLowerCase().replace(/\s+/g, ' ');
    if (ascii === 'rot') return 'CHƯA ĐẠT';
    return t;
};

export type CounterCduTone = 'pass' | 'fail' | 'neutral';

/** Màu chữ theo tình trạng (sau format RỚT → CHƯA ĐẠT) */
export const getCounterCduTone = (displayText: string): CounterCduTone => {
    const s = (displayText || '').trim();
    if (!s) return 'neutral';
    const u = removeVietnameseTones(s).toLowerCase();
    if (u.includes('chua') && u.includes('dat')) return 'fail';
    if (u === 'rot') return 'fail';
    if (u.includes('dat') && !u.includes('chua')) return 'pass';
    return 'neutral';
};

export const counterCduToneClassName = (tone: CounterCduTone): string => {
    if (tone === 'fail') return 'text-red-600 dark:text-red-400';
    if (tone === 'pass') return 'text-emerald-600 dark:text-emerald-400';
    return 'text-amber-700 dark:text-amber-300';
};

/** Class cho giá trị Counter Top / CDU (trống = xám nhạt; CHƯA ĐẠT đỏ; ĐẠT xanh; còn lại vàng đậm) */
export const getCounterCduValueClassName = (raw: string): string => {
    const display = formatCounterCduStatusDisplay(raw);
    if (!display.trim()) return 'text-slate-400 dark:text-slate-500 font-normal';
    return `font-bold ${counterCduToneClassName(getCounterCduTone(display))}`;
};

const isPassStatus = (status: string): boolean => {
    const s = (status || '').toLowerCase().trim();
    return s.includes('đạt') || s.includes('dat') || s.includes('pass') || s === 'yes' || s === 'ok';
};

/** Chuẩn hóa nhãn tier Q2 (giống hướng xử lý trong StoreProgramRegistrationTab) */
const normalizeTierLabelForMatch = (s: string): string =>
    s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\+\s*/g, '+');

/**
 * Mục tiêu doanh số trưng bày tháng theo Loại TB (cột FinalStoreType), không dùng ĐK TB Q2.
 * Bronze 500k — Silver 1,5tr — Gold / Platinum / Flagship 3tr.
 */
const getMonthlyTargetByLoaiTb = (finalStoreTypeRaw: string): number | null => {
    const n = normalizeTierLabelForMatch(finalStoreTypeRaw);
    if (!n) return null;
    if (n.includes('bronze')) return 3_000_000;
    if (n.includes('silver')) return 6_000_000;
    if (n.includes('gold')) return 15_000_000;
    if (n.includes('platinum')) return 15_000_000;
    if (n.includes('flagship+') || n.includes('flaship+')) return 15_000_000;
    if (n.includes('flagship') || n.includes('flaship')) return 15_000_000;
    return null;
};

/**
 * Mục tiêu doanh số quý khi KH đã đăng ký TB Q2 (cột FinalStoreTypeQ2).
 * Platinum, Flagship+/Flagship (và Flaship), Gold: ≥ 45tr — Silver: ≥ 18tr — Bronze: ≥ 9tr
 */
const getQ2QuarterlyTargetVnd = (finalStoreTypeQ2Raw: string): number | null => {
    const n = normalizeTierLabelForMatch(finalStoreTypeQ2Raw);
    if (!n) return null;
    if (n.includes('bronze')) return 9_000_000;
    if (n.includes('silver')) return 18_000_000;
    if (n.includes('gold')) return 45_000_000;
    if (n.includes('platinum')) return 45_000_000;
    if (n.includes('flagship+') || n.includes('flaship+')) return 45_000_000;
    if (n.includes('flagship') || n.includes('flaship')) return 45_000_000;
    return null;
};

/** Mục tiêu quý theo Loại TB (sheet DOANH_SO) khi không áp dụng tier ĐK Q2 */
const getQuarterTargetByStoreType = (storeType: string): number => {
    const s = (storeType || '').toLowerCase();
    if (s.includes('flagship') || s.includes('flaship')) return 45_000_000;
    if (s.includes('platinum')) return 45_000_000;
    if (s.includes('gold')) return 45_000_000;
    if (s.includes('silver')) return 18_000_000;
    if (s.includes('bronze')) return 9_000_000;
    return 0;
};

/** Mục tiêu quý: có ĐK Q2 → theo tier Q2 (không nhận diện được → Loại TB cũ); không Q2 → Loại TB cũ */
const resolveQuarterTargetVnd = (finalStoreTypeQ2: string, finalStoreType: string): number => {
    const q2 = (finalStoreTypeQ2 || '').trim();
    const legacy = getQuarterTargetByStoreType(finalStoreType);
    if (q2) {
        const q2Q = getQ2QuarterlyTargetVnd(q2);
        if (q2Q != null) return q2Q;
        return legacy;
    }
    return legacy;
};

export type MonthlyTbTargetMode = 'loai_tb_tier' | 'target_monthly' | 'sheet_fallback';

/** Nhãn dòng mục tiêu tháng (Telegram / UI) */
export const monthlyTargetLineLabel = (mode: MonthlyTbTargetMode): string => {
    if (mode === 'loai_tb_tier') return '+ Mục tiêu tháng (theo Loại TB)';
    if (mode === 'target_monthly') return '+ Mục tiêu tháng (cột TargetMonthly)';
    return '+ Mục tiêu tháng';
};

const resolveMonthlyTbTargetVnd = (
    finalStoreType: string,
    targetMonthlyFromSheet: number
): { target: number; mode: MonthlyTbTargetMode } => {
    const loaiTb = (finalStoreType || '').trim();
    if (loaiTb) {
        const tierTarget = getMonthlyTargetByLoaiTb(loaiTb);
        if (tierTarget != null) return { target: tierTarget, mode: 'loai_tb_tier' };
    }
    if (targetMonthlyFromSheet > 0) {
        return { target: targetMonthlyFromSheet, mode: 'target_monthly' };
    }
    return { target: 0, mode: 'sheet_fallback' };
};

/** Điều kiện TB tháng: mục tiêu theo Loại TB (Gold/Silver/Bronze) hoặc TargetMonthly sheet; không có thì theo cột Check + Todo. */
const computeMonthlyTbFields = (r: Record<string, unknown>, doanhSoDaDat: number) => {
    const checkStatus = safeStr(r, 'Check');
    const todoTotal = safeNum(r, 'Todo', 'Todo TB');
    const finalStoreType = safeStr(r, 'FinalStoreType', 'Final Store Type');
    const targetMonthlyFromSheet = safeNum(r, 'TargetMonthly', 'TARGET THÁNG', 'Target Monthly');
    const { target, mode } = resolveMonthlyTbTargetVnd(finalStoreType, targetMonthlyFromSheet);

    if (target > 0) {
        const passed = doanhSoDaDat >= target;
        return {
            monthlyTargetVnd: target,
            monthlyTbMode: mode,
            isCheckPassed: passed,
            signedTodoTotal: doanhSoDaDat - target,
            checkStatusForPayload: passed ? 'ĐẠT' : 'CHƯA ĐẠT',
        };
    }
    const passed = isPassStatus(checkStatus);
    return {
        monthlyTargetVnd: 0,
        monthlyTbMode: 'sheet_fallback' as const,
        isCheckPassed: passed,
        signedTodoTotal: passed ? Math.abs(todoTotal) : -Math.abs(todoTotal),
        checkStatusForPayload: checkStatus,
    };
};

/**
 * Tạo payload xuất thông tin Doanh số KH (gửi n8n/Telegram).
 * - Code giga = CustomerCode, Code BM = CodeBuyMed
 * - Số tiền thưởng dự kiến = doanh số x % level chiết khấu
 * - Điều kiện TB tháng: mục tiêu theo Loại TB (Gold/Silver/Bronze), không theo ĐK TB Q2
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

    const doanhSoDaDat = safeNum(r, 'Sale', 'Sale T1');

    const codeGiga = safeStr(r, 'CustomerCode', 'Customer Code', 'Code');
    const codeBM = safeStr(r, 'CodeBuyMed', 'Code BM', 'BM');
    const customerName = safeStr(r, 'CustomerName', 'Customer Name', 'Location Name');
    const finalStoreTypeRaw = safeStr(r, 'FinalStoreType', 'Final Store Type');
    const finalStoreTypeQ2 = safeStr(r, 'FinalStoreTypeQ2', 'Final Store Type Q2', 'FinalStoreType Q2');
    const showTrungBayTbSections = !!(finalStoreTypeRaw || finalStoreTypeQ2);
    const {
        monthlyTargetVnd,
        monthlyTbMode,
        signedTodoTotal: signedTodo,
        checkStatusForPayload,
    } = computeMonthlyTbFields(r, doanhSoDaDat);

    const mustWin = safeNum(r, 'MustWin', 'Must Win');
    const other = safeNum(r, 'Other');
    const totalQuarterDS = mustWin + other;
    const dsGigaQuarter = safeNum(r, 'GIGAMED');
    const dsBmQuarter = safeNum(r, 'BM');
    const quarterTarget = resolveQuarterTargetVnd(finalStoreTypeQ2, finalStoreTypeRaw);
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
    if (showTrungBayTbSections) {
        message += `🏆 Loại TB: ${finalStoreTypeRaw || 'Thành viên'}\n`;
        message += `📝 ĐĂNG KÝ TB Q2: ${finalStoreTypeQ2}\n`;
    }
    message += `🧑‍💼 NV: ${employeeName || ''}\n`;
    message += `\n📊 KPI THÁNG HIỆN TẠI:\n`;
    message += `🔹 Import: ${formatCurrency(actualImport)} (${importPct.toFixed(1)}% / ${formatCurrency(targetImport)})\n`;
    message += `   ➔ ${importTier ? `Mức: ${importTier.level} (CK: ${importTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusImport)}\n`;
    message += `🔹 Local: ${formatCurrency(actualLocal)} (${localPct.toFixed(1)}% / ${formatCurrency(targetLocal)})\n`;
    message += `   ➔ ${localTier ? `Mức: ${localTier.level} (CK: ${localTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusLocal)}\n`;

    message += `\n💰 TOTAL DS QUÝ: ${formatCurrency(totalQuarterDS)}\n`;
    message += `🟢 DOANH SỐ GIGA: ${formatCurrency(dsGigaQuarter)}\n`;
    message += `🔴 DOANH SỐ BM: ${formatCurrency(dsBmQuarter)}\n`;
    if (showTrungBayTbSections) {
        message += `\n📑 DOANH SỐ TRƯNG BÀY THÁNG:\n`;
        message += `+ Trạng thái: ${checkStatusForPayload}\n`;
        if (monthlyTargetVnd > 0) {
            message += `${monthlyTargetLineLabel(monthlyTbMode)}: ${formatCurrency(monthlyTargetVnd)}\n`;
        }
        message += `+ Doanh số đã đặt: ${formatCurrency(doanhSoDaDat)}\n`;
        message += `+ Todo TB: ${signedTodo > 0 ? '+' : ''}${formatCurrency(signedTodo)}\n`;

        message += `\n🎯 DOANH SỐ TRƯNG BÀY Q2:\n`;
        message += `+ TRẠNG THÁI: ${quarterStatusLabel}\n`;
        message += `+ MỤC TIÊU QUÝ: ${quarterTarget > 0 ? formatCurrency(quarterTarget) : 'THAM GIA TB QUÝ'}\n`;
        message += `+ TODO: ${quarterTodo > 0 ? '+' : ''}${formatCurrency(quarterTodo)}\n`;
    }

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
    finalStoreTypeQ2: string;
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
    /** Doanh số kênh Giga (cột GIGAMED sheet Doanh_So) */
    doanhSoGiga: number;
    /** Doanh số kênh BM (cột BM sheet Doanh_So) */
    doanhSoBM: number;
    quarterTarget: number;
    quarterTodo: number;
    isQuarterPassed: boolean;
    quarterStatusLabel: string;
    checkStatus: string;
    /** Mục tiêu tháng: theo Loại TB (tier) hoặc cột TargetMonthly; 0 = theo sheet Check/Todo */
    monthlyTargetVnd: number;
    monthlyTbMode: MonthlyTbTargetMode;
    doanhSoDaDat: number;
    todoTotal: number;
    signedTodoTotal: number;
    isCheckPassed: boolean;
    /** false khi không có Loại TB và không có ĐK TB Q2 — ẩn block trưng bày tháng & quý */
    showTrungBayTbSections: boolean;
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
    const doanhSoDaDat = safeNum(r, 'Sale', 'Sale T1');
    const {
        monthlyTargetVnd,
        monthlyTbMode,
        isCheckPassed,
        signedTodoTotal,
    } = computeMonthlyTbFields(r, doanhSoDaDat);
    const mustWin = safeNum(r, 'MustWin', 'Must Win');
    const other = safeNum(r, 'Other');
    const finalStoreTypeRaw = safeStr(r, 'FinalStoreType', 'Final Store Type');
    const finalStoreTypeQ2 = safeStr(r, 'FinalStoreTypeQ2', 'Final Store Type Q2', 'FinalStoreType Q2');
    const showTrungBayTbSections = !!(finalStoreTypeRaw || finalStoreTypeQ2);
    const finalStoreType = showTrungBayTbSections ? (finalStoreTypeRaw || 'Thành viên') : '';
    const totalQuarterDS = mustWin + other;
    const doanhSoGiga = safeNum(r, 'GIGAMED');
    const doanhSoBM = safeNum(r, 'BM');
    const quarterTarget = resolveQuarterTargetVnd(finalStoreTypeQ2, finalStoreTypeRaw);
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
        finalStoreTypeQ2: showTrungBayTbSections ? finalStoreTypeQ2 : '',
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
        doanhSoGiga,
        doanhSoBM,
        quarterTarget,
        quarterTodo,
        isQuarterPassed,
        quarterStatusLabel,
        checkStatus,
        monthlyTargetVnd,
        monthlyTbMode,
        doanhSoDaDat,
        todoTotal,
        signedTodoTotal,
        isCheckPassed,
        showTrungBayTbSections,
    };
};
