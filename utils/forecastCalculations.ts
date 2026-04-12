/**
 * Shared logic for forecast calculations (ForecastForm + ForecastTab quick forecast)
 */
import type { SalesRecord } from '../types';

/** Kiểm tra KH Cover Q1 (hỗ trợ cả CoverQ1 và "Cover Q1" từ sheet) */
export const isCoverQ1 = (r: SalesRecord | Record<string, unknown>): boolean => {
    const row = r as Record<string, unknown>;
    return String(row.CoverQ1 || row['Cover Q1'] || '').toUpperCase() === 'YES';
};

export const FORECAST_LEVELS = [
    { id: '0DONG', label: '0 đồng', sub: '', max: 0, avg: 0 },
    { id: '700k', label: '700k', sub: '', max: 700000, avg: 700000 },
    { id: '1.5-3TR', label: '1.5 - 3Tr', sub: '(3%)', max: 3000000, avg: 2250000 },
    { id: '3-5TR', label: '3 - 5Tr', sub: '(3.5%)', max: 5000000, avg: 4000000 },
    { id: '5-10TR', label: '5 - 10Tr', sub: '(4%)', max: 10000000, avg: 7500000 },
    { id: '10-15TR', label: '10 - 15Tr', sub: '(4.5%)', max: 15000000, avg: 12500000 },
    { id: '15-25TR', label: '15 - 25Tr', sub: '(5%)', max: 25000000, avg: 20000000 },
    { id: '>25TR', label: '> 25Tr', sub: '(5.5%)', max: Infinity, avg: 25000000 },
];

export const REASONS = [
    "KH giảm mua hàng do đăng kí mức doanh thu thấp với Thuế",
    "Khách hàng hạn chế hóa đơn đầu vào hoặc đã thừa hóa đơn đầu vào, nhập hàng qua các kênh không cần xuất Hóa đơn",
    "Khách hàng chưa xử lý xong thuế truy thu những năm trước nên hạn chế nhập hàng",
    "KH lo ngại thuế, kiểm tra liên ngành",
    "KH tồn kho nhiều do mua Stockpile trong 2025 nên hạn chế nhập hàng thêm",
    "KH tồn kho nhiều do hàng ra chậm nên hạn chế nhập hàng",
    "Nhu cầu thị trường giảm nên giảm mua hàng",
    "KH mua hàng từ nguồn khác rẻ hơn do giá Opella/ giá Buymed cao hơn",
    "KH hết công nợ với Gigamed, không mua được hàng",
    "KH mới mở",
    "KH hết GPP. Chờ thẩm định mới",
    "KH đóng code/ block code/ đóng MST. Tạm đóng cửa",
    "Khác"
];

export const getLevelValue = (lvlId: string | null, specVal: number = 25000000): number => {
    if (!lvlId) return 0;
    if (lvlId === '>25TR') return specVal;
    return FORECAST_LEVELS.find(l => l.id === lvlId)?.avg ?? 0;
};

export const calcExpectedFromForecast = (
    record: SalesRecord,
    importLevel: string | null,
    localLevel: string | null,
    importSpecVal: number = 25000000,
    localSpecVal: number = 25000000
) => {
    const totalGiga = Number(record.GIGAMED) || 0;
    const totalBm = Number(record.BM) || 0;
    const impGiga = Number(record.GIGAMEDImport || record.ActualImportGiga) || 0;
    const impBm = Number(record.BMImport || record.ActualImportBuyMed) || 0;
    const totalImp = impGiga + impBm;

    const impGigaRatio = totalImp > 0 ? impGiga / totalImp : 0.5;
    const impBmRatio = totalImp > 0 ? impBm / totalImp : 0.5;

    const locGiga = Math.max(0, totalGiga - impGiga);
    const locBm = Math.max(0, totalBm - impBm);
    const totalLoc = locGiga + locBm;

    const locGigaRatio = totalLoc > 0 ? locGiga / totalLoc : 0.5;
    const locBmRatio = totalLoc > 0 ? locBm / totalLoc : 0.5;

    const impDS = getLevelValue(importLevel, importSpecVal);
    const locDS = getLevelValue(localLevel, localSpecVal);

    const expectedGigaT2 = (impDS * impGigaRatio) + (locDS * locGigaRatio);
    const expectedBMT2 = (impDS * impBmRatio) + (locDS * locBmRatio);
    const expectedTotalT2 = expectedGigaT2 + expectedBMT2;
    const targetMonthly = Number(record.TargetMonthly) || 0;
    const isTargetAchieved = expectedTotalT2 >= targetMonthly;

    return { expectedGigaT2, expectedBMT2, expectedTotalT2, targetMonthly, isTargetAchieved };
};
