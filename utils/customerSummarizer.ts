
import type { SalesRecord, ForecastItem } from '../types';
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
