
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
 
    summary += `📑 TRẠNG THÁI:\n`;
    summary += `+ Điều kiện TB: ${record.Check || 'N/A'}\n`;
    summary += `+ Counter Top: ${record.CounterTop || 'N/A'}\n`;
    summary += `+ CDU: ${record.CDU || 'N/A'}\n`;
// Dự báo T3
    summary += `\n📈 FORECAST T3:\n`;
    if (forecast) {
        summary += `+ Import: ${forecast.ImportLevel || 'N/A'}\n`;
        summary += `+ Local: ${forecast.LocalLevel || 'N/A'}\n`;
    } else {
        summary += `- Chưa có dự báo T3.\n`;
    }
    summary += `\nNote : Doanh số chưa bao gồm đơn đã đặt\n`;
    return summary;
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
    if (!record) return null;

    const actualImport = Number(record.ActualImport) || 0;
    const targetImport = Number(record.TargetImport) || 0;
    const actualLocal = Number(record.ActualLocal) || 0;
    const targetLocal = Number(record.TargetLocal) || 0;

    const importPct = targetImport > 0 ? (actualImport / targetImport) * 100 : 0;
    const localPct = targetLocal > 0 ? (actualLocal / targetLocal) * 100 : 0;

    const importTier = getRebateLevel(actualImport);
    const localTier = getRebateLevel(actualLocal);

    const expectedBonusImport = importTier ? actualImport * (importTier.percent / 100) : 0;
    const expectedBonusLocal = localTier ? actualLocal * (localTier.percent / 100) : 0;

    const todoTotal = Number(record.Todo) || 0;

    const doanhSoDaDat = Number(record.Sale) || 0; // Cột Sale ở sheet DOANH_SO

    const codeGiga = String(record.CustomerCode || '').trim();
    const codeBM = record.CodeBuyMed ? String(record.CodeBuyMed).trim() : '';

    const counterTopStr = record.CounterTop ? String(record.CounterTop).trim() : '';
    const cduStr = record.CDU ? String(record.CDU).trim() : '';

    let message = `📊 THÔNG TIN DOANH SỐ KHÁCH HÀNG\n`;
    message += `--------------------------------\n`;
    message += `📍 KH: ${record.CustomerName}\n`;
    message += `🔢 Code Giga: ${codeGiga || ''}\n`;
    message += `🔢 Code BM: ${codeBM || ''}\n`;
    message += `🏆 Loại TB: ${record.FinalStoreType || 'Thành viên'}\n`;
    message += `🧑‍💼 NV: ${employeeName}\n`;
    message += `\n📊 KPI THÁNG HIỆN TẠI:\n`;
    message += `🔹 Import: ${formatCurrency(actualImport)} (${importPct.toFixed(1)}% / ${formatCurrency(targetImport)})\n`;
    message += `   ➔ ${importTier ? `Mức: ${importTier.level} (CK: ${importTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusImport)}\n`;
    message += `🔹 Local: ${formatCurrency(actualLocal)} (${localPct.toFixed(1)}% / ${formatCurrency(targetLocal)})\n`;
    message += `   ➔ ${localTier ? `Mức: ${localTier.level} (CK: ${localTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: ${formatCurrency(expectedBonusLocal)}\n`;

    const totalQuarterDS = (Number(record.MustWin) || 0) + (Number(record.Other) || 0);
    message += `\n💰 TOTAL DS QUÝ: ${formatCurrency(totalQuarterDS)}\n`;
    

    message += `\n📑 ĐIỀU KIỆN TB:\n`;
    message += `+ Trạng thái: ${record.Check || ''}\n`;
    message += `+ Doanh số đã đặt: ${formatCurrency(doanhSoDaDat)}\n`;
    message += `+ Todo TB: ${formatCurrency(todoTotal)}\n`;
    if (counterTopStr) message += `+ Counter Top: ${counterTopStr}\n`;
    if (cduStr) message += `+ CDU: ${cduStr}\n`;

    message += `\nVui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng.\n`;

    return {
        code: codeGiga,
        codeGiga,
        codeBM,
        customerName: record.CustomerName,
        employeeName,
        message,
    };
};
