
import React, { useState, useEffect } from 'react';
import type { SalesRecord, Employee, ForecastItem } from '../../types';
import { SaveIcon, CheckCircleIcon, TrendingUpIcon } from '../icons';
import { submitMarketingData } from '../../services/googleSheetService';
import { GOOGLE_SCRIPT_URL } from '../../constants';
import { formatCurrency, buildForecastNotificationMessage } from '../../utils/formatters';
import { FORECAST_LEVELS, REASONS } from '../../utils/forecastCalculations';

interface ForecastFormProps {
    selectedCustomer: SalesRecord;
    forecastData: ForecastItem[];
    currentEmployee: Employee;
    /** Số KH đã dự báo / tổng KH cần dự báo (để hiển thị trong thông báo) */
    forecastedCount?: number;
    totalCount?: number;
    onUpdateForecast: (
        customerCode: string,
        importLevel: string,
        localLevel: string,
        importValue?: number,
        localValue?: number,
        extraFields?: {
            expectedGigaT2: number;
            expectedBMT2: number;
            expectedTotalT2: number;
            targetMonthly: number;
            reasonNotAchieved?: string;
            reason2?: string;
        }
    ) => void;
    onSuccess?: () => void;
}

const REASON_DETAILS_PROMPTS: Record<string, string> = {
    "KH giảm mua hàng do đăng kí mức doanh thu thấp với Thuế": "Cung cấp mức Doanh Thu KH đăng kí với cơ quan Thuế",
    "Khách hàng hạn chế hóa đơn đầu vào hoặc đã thừa hóa đơn đầu vào, nhập hàng qua các kênh không cần xuất Hóa đơn": "(1) Kiểm tra lại mức KH mua trong 2025. (2) Giải thích lý do vì sao tới 2026 KH mới bị ảnh hưởng về vấn đề Hóa đơn mà không phải từ 2025.",
    "Khách hàng chưa xử lý xong thuế truy thu những năm trước nên hạn chế nhập hàng": "(1) Cung cấp ước tính khi nào KH sẽ quay về hoạt động bình thường. (2) Mức Doanh Thu KH sẽ đăng kí. (3) Kế hoạch sắp tới của KH đối với hoạt động kinh doanh thuốc.",
    "KH lo ngại thuế, kiểm tra liên ngành": "Mô tả cụ thể quan ngại của KH là gì",
    "KH tồn kho nhiều do mua Stockpile trong 2025 nên hạn chế nhập hàng thêm": "Cung cấp sản phẩm bị tồn kho nhiều và mức tồn kho (số ngày tồn kho)",
    "KH tồn kho nhiều do hàng ra chậm nên hạn chế nhập hàng": "Cung cấp sản phẩm bị chậm đầu ra và lý do chậm đầu ra được KH chia sẻ",
    "Nhu cầu thị trường giảm nên giảm mua hàng": "Nhu cầu thị trường của KH giảm từ khi nào mà ảnh hưởng nhiều vào đầu 2026?",
    "KH mua hàng từ nguồn khác rẻ hơn do giá Opella/ giá Buymed cao hơn": "Cung cấp thông tin sản phẩm KH không mua do giá chênh và mức chênh lệch giá",
    "KH hết công nợ với Gigamed, không mua được hàng": "Khách hàng có mua thêm các nguồn khác như Buymed hay chợ không? Hay không đủ Cash Flow để mua hàng ở tất cả các kênh?",
    "KH mới mở": "(1) Cung cấp thời điểm mở mới Tháng/Năm. (2) Chia sẻ mức mua hàng Opella tiềm năng của KH: Triệu/Tháng. (3) Dự đoán thời điểm KH sẽ mua hàng theo mức tiềm năng.",
    "KH hết GPP. Chờ thẩm định mới": "Cung cấp thời điểm dự kiến KH quay về hoạt động bình thường",
    "KH đóng code/ block code/ đóng MST. Tạm đóng cửa": "",
    "Khác": "Cung cấp mô tả về tình trạng KH"
};

const getSaleValue = (record: any, keys: string[]): number => {
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
            const val = Number(record[key]);
            if (!isNaN(val)) return val;
        }
    }
    return 0;
};

const formatCompact = (amount?: number) => {
    if (!amount) return '0';
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'Tr';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
    return amount.toString();
};

const ForecastForm: React.FC<ForecastFormProps> = ({
    selectedCustomer,
    forecastData,
    currentEmployee,
    forecastedCount = 0,
    totalCount = 0,
    onUpdateForecast,
    onSuccess
}) => {
    const [importLevel, setImportLevel] = useState<string | null>(null);
    const [importSpecificValue, setImportSpecificValue] = useState<number>(25000000);
    const [localLevel, setLocalLevel] = useState<string | null>(null);
    const [localSpecificValue, setLocalSpecificValue] = useState<number>(25000000);
    const [reasonNotAchieved, setReasonNotAchieved] = useState<string>("");
    const [reason2, setReason2] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const forecast = forecastData.find(f => String(f.CustomerCode) === String(selectedCustomer.CustomerCode));
        if (forecast) {
            setImportLevel(forecast.ImportLevel || null);
            setLocalLevel(forecast.LocalLevel || null);
            setImportSpecificValue(forecast.ImportValue || 25000000);
            setLocalSpecificValue(forecast.LocalValue || 25000000);
            setReasonNotAchieved(forecast.ReasonNotAchieved || "");
            setReason2(forecast.Reason2 || "");
        } else {
            setImportLevel(null);
            setLocalLevel(null);
            setImportSpecificValue(25000000);
            setLocalSpecificValue(25000000);
            setReasonNotAchieved("");
            setReason2("");
        }
    }, [selectedCustomer, forecastData]);

    // PRE-CALCULATE RATIOS
    const totalGiga = Number(selectedCustomer.GIGAMED) || 0;
    const totalBm = Number(selectedCustomer.BM) || 0;
    const impGiga = Number(selectedCustomer.GIGAMEDImport || selectedCustomer.ActualImportGiga) || 0;
    const impBm = Number(selectedCustomer.BMImport || selectedCustomer.ActualImportBuyMed) || 0;
    const totalImp = impGiga + impBm;

    const impGigaRatio = totalImp > 0 ? impGiga / totalImp : 0.5;
    const impBmRatio = totalImp > 0 ? impBm / totalImp : 0.5;

    const locGiga = Math.max(0, totalGiga - impGiga);
    const locBm = Math.max(0, totalBm - impBm);
    const totalLoc = locGiga + locBm;

    const locGigaRatio = totalLoc > 0 ? locGiga / totalLoc : 0.5;
    const locBmRatio = totalLoc > 0 ? locBm / totalLoc : 0.5;

    // CALCULATE EXPECTED VALUES
    const getLevelValue = (lvlId: string | null, specVal: number) => {
        if (!lvlId) return 0;
        if (lvlId === '>25TR') return specVal;
        return FORECAST_LEVELS.find(l => l.id === lvlId)?.avg || 0;
    };

    const impDS = getLevelValue(importLevel, importSpecificValue);
    const locDS = getLevelValue(localLevel, localSpecificValue);
    const actualImportT2 = Number(selectedCustomer.ActualImportT2 || selectedCustomer["SALE IMPORT T2"]) || 0;
    const actualLocalT2 = Number(selectedCustomer.ActualLocalT2 || selectedCustomer["SALE LOCAL T2"]) || 0;

    const expectedGigaT2 = (impDS * impGigaRatio) + (locDS * locGigaRatio);
    const expectedBMT2 = (impDS * impBmRatio) + (locDS * locBmRatio);
    const expectedTotalT2 = expectedGigaT2 + expectedBMT2;
    const targetMonthly = Number(selectedCustomer.TargetMonthly) || 0;
    const isTargetAchieved = expectedTotalT2 >= targetMonthly;

    const handleSubmit = async () => {
        if (!importLevel && !localLevel) {
            alert("Vui lòng chọn ít nhất một mức dự báo.");
            return;
        }

        if (targetMonthly > 0 && !isTargetAchieved && !reasonNotAchieved) {
            alert("Vui lòng chọn lý do giải trình khi không đạt Target Tháng.");
            return;
        }

        setIsSubmitting(true);
        try {
            const existingForecast = forecastData.find(f => String(f.CustomerCode) === String(selectedCustomer.CustomerCode) && (f.ImportLevel || f.LocalLevel));
            const newForecastedCount = existingForecast ? forecastedCount : forecastedCount + 1;

            const message = buildForecastNotificationMessage({
                customerCode: selectedCustomer.CustomerCode,
                customerName: selectedCustomer.CustomerName || '',
                employeeName: currentEmployee.name,
                importLevel: importLevel || '',
                localLevel: localLevel || '',
                expectedTotalT2,
                targetMonthly,
                reasonNotAchieved: !isTargetAchieved ? reasonNotAchieved : "Đạt Target",
                forecastedCount: newForecastedCount,
                totalCount
            });

            await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'submitForecast',
                customerCode: selectedCustomer.CustomerCode,
                customerName: selectedCustomer.CustomerName || '',
                employeeName: currentEmployee.name,
                importLevel: importLevel || '',
                localLevel: localLevel || '',
                importValue: importLevel === '>25TR' ? importSpecificValue : 0,
                localValue: localLevel === '>25TR' ? localSpecificValue : 0,
                expectedGigaT2,
                expectedBMT2,
                expectedTotalT2,
                targetMonthly,
                reasonNotAchieved: !isTargetAchieved ? reasonNotAchieved : "Đạt Target",
                reason2: !isTargetAchieved ? reason2 : "",
                forecastedCount: newForecastedCount,
                totalCount,
                message
            });

            onUpdateForecast(
                selectedCustomer.CustomerCode,
                importLevel || '',
                localLevel || '',
                importLevel === '>25TR' ? importSpecificValue : undefined,
                localLevel === '>25TR' ? localSpecificValue : undefined,
                {
                    expectedGigaT2,
                    expectedBMT2,
                    expectedTotalT2,
                    targetMonthly,
                    reasonNotAchieved: !isTargetAchieved ? reasonNotAchieved : undefined,
                    reason2: !isTargetAchieved ? reason2 : undefined
                }
            );
            alert("Đã lưu dự báo thành công!");
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const HistoryCard = ({ title, t1Giga, t1BuyMed, t1Total, t2Giga, t2BuyMed, t2Total, colorClass, titleClass, totalClass }: any) => (
        <div className={`p-3 rounded-lg border ${colorClass} mb-4`}>
            <h4 className={`text-xs font-bold uppercase mb-2 ${titleClass}`}>{title}</h4>
            <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                    <div className="flex gap-3">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 uppercase">Giga T1</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(t1Giga)}</span>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-600 h-8"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 uppercase">BuyMed T1</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(t1BuyMed)}</span>
                        </div>
                    </div>
                    <div className={`flex flex-col items-end ${totalClass}`}>
                        <span className="text-[9px] opacity-70 uppercase">Tổng T1</span>
                        <span className="text-base font-black">{formatCompact(t1Total)}</span>
                    </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                    <div className="flex gap-3">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 uppercase">Giga T2</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(t2Giga)}</span>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-600 h-8"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 uppercase">BuyMed T2</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(t2BuyMed)}</span>
                        </div>
                    </div>
                    <div className={`flex flex-col items-end ${totalClass}`}>
                        <span className="text-[9px] opacity-70 uppercase">Tổng T2</span>
                        <span className="text-base font-black">{formatCompact(t2Total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // T1: Chỉ dùng key T1
    const importGigaT1 = getSaleValue(selectedCustomer, ["SALE IMPORT (GIGA T1)", "SaleImportGigaT1"]);
    const importBuyMedT1 = getSaleValue(selectedCustomer, ["SALE IMPORT (BUYMED) T1", "SaleImportBuyMedT1"]);
    const importTotalT1 = getSaleValue(selectedCustomer, ["ActualImportT1", "SALE IMPORT T1", "SaleImportTotalT1"]);

    // T2: Chỉ dùng key T2 (không fallback sang ActualImport/ActualLocal vì đó là tổng tích lũy)
    const importGigaT2 = getSaleValue(selectedCustomer, ["SALE IMPORT (GIGA T2)"]);
    const importBuyMedT2 = getSaleValue(selectedCustomer, ["SALE IMPORT (BUYMED) T2"]);
    const importTotalT2 = getSaleValue(selectedCustomer, ["ActualImportT2", "SALE IMPORT T2"]);

    const localGigaT1 = getSaleValue(selectedCustomer, ["SALE LOCAL (GIGA) T1", "SaleLocalGigaT1"]);
    const localBuyMedT1 = getSaleValue(selectedCustomer, ["SALE LOCAL (BUYMED) T1", "SaleLocalBuyMedT1"]);
    const localTotalT1 = getSaleValue(selectedCustomer, ["ActualLocalT1", "SALE LOCAL T1", "SaleLocalTotalT1"]);

    const localGigaT2 = getSaleValue(selectedCustomer, ["SALE LOCAL (GIGA) T2"]);
    const localBuyMedT2 = getSaleValue(selectedCustomer, ["SALE LOCAL (BUYMED) T2"]);
    const localTotalT2 = getSaleValue(selectedCustomer, ["ActualLocalT2", "SALE LOCAL T2"]);

    return (
        <div className="space-y-6">
            <div className="animate-fade-in">
                <HistoryCard
                    title="Lịch sử Sale Import T1 & T2"
                    t1Giga={importGigaT1}
                    t1BuyMed={importBuyMedT1}
                    t1Total={importTotalT1}
                    t2Giga={importGigaT2}
                    t2BuyMed={importBuyMedT2}
                    t2Total={importTotalT2}
                    colorClass="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800"
                    titleClass="text-blue-700 dark:text-blue-400"
                    totalClass="text-blue-600 dark:text-blue-400"
                />

                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                    <span>🎯 Chọn Dự Kiến Import T3</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {FORECAST_LEVELS.map((lvl) => {
                        const isWarning = importLevel === lvl.id && lvl.max < actualImportT2;
                        return (
                            <button
                                key={lvl.id}
                                onClick={() => setImportLevel(importLevel === lvl.id ? null : lvl.id)}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${importLevel === lvl.id
                                    ? isWarning
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-md'
                                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md transform scale-105'
                                    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-blue-200 dark:hover:border-blue-800'
                                    }`}
                            >
                                <div className="font-bold text-sm">{lvl.label}</div>
                                {lvl.sub && <div className="text-[10px] font-medium opacity-80">{lvl.sub}</div>}
                                {importLevel === lvl.id && (
                                    <div className={`mt-1 ${isWarning ? 'text-red-500' : 'text-blue-500'}`}>
                                        <CheckCircleIcon />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                {importLevel === '>25TR' && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Doanh số Import chi tiết</span>
                            <span className="text-sm font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-blue-100 dark:border-blue-900">
                                {formatCurrency(importSpecificValue)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="25000000"
                            max="100000000"
                            step="1000000"
                            value={importSpecificValue}
                            onChange={(e) => setImportSpecificValue(Number(e.target.value))}
                            className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-blue-400 font-bold px-1">
                            <span>25Tr</span>
                            <span>100Tr</span>
                        </div>
                    </div>
                )}
                {importLevel && importLevel !== '>25TR' && FORECAST_LEVELS.find(l => l.id === importLevel)!.max < actualImportT2 && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-bold rounded border border-red-100 dark:border-red-800 flex items-center gap-2 animate-pulse">
                        ⚠️ Mức dự báo thấp hơn doanh số thực tế T2 ({formatCompact(actualImportT2)})
                    </div>
                )}
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            <div className="animate-fade-in delay-100">
                <HistoryCard
                    title="Lịch sử Sale Local T1 & T2"
                    t1Giga={localGigaT1}
                    t1BuyMed={localBuyMedT1}
                    t1Total={localTotalT1}
                    t2Giga={localGigaT2}
                    t2BuyMed={localBuyMedT2}
                    t2Total={localTotalT2}
                    colorClass="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800"
                    titleClass="text-green-700 dark:text-green-400"
                    totalClass="text-green-600 dark:text-green-400"
                />

                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                    <span>🎯 Chọn Dự Kiến Local T3</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {FORECAST_LEVELS.map((lvl) => {
                        const isWarning = localLevel === lvl.id && lvl.max < actualLocalT2;
                        return (
                            <button
                                key={lvl.id}
                                onClick={() => setLocalLevel(localLevel === lvl.id ? null : lvl.id)}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${localLevel === lvl.id
                                    ? isWarning
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-md'
                                        : 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-md transform scale-105'
                                    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-green-200 dark:hover:border-green-800'
                                    }`}
                            >
                                <div className="font-bold text-sm">{lvl.label}</div>
                                {lvl.sub && <div className="text-[10px] font-medium opacity-80">{lvl.sub}</div>}
                                {localLevel === lvl.id && (
                                    <div className={`mt-1 ${isWarning ? 'text-red-500' : 'text-green-500'}`}>
                                        <CheckCircleIcon />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                {localLevel === '>25TR' && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Doanh số Local chi tiết</span>
                            <span className="text-sm font-black text-green-700 dark:text-green-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-green-100 dark:border-green-900">
                                {formatCurrency(localSpecificValue)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="25000000"
                            max="100000000"
                            step="1000000"
                            value={localSpecificValue}
                            onChange={(e) => setLocalSpecificValue(Number(e.target.value))}
                            className="w-full h-2 bg-green-200 dark:bg-green-800 rounded-lg appearance-none cursor-pointer accent-green-600 focus:outline-none"
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-green-400 font-bold px-1">
                            <span>25Tr</span>
                            <span>100Tr</span>
                        </div>
                    </div>
                )}
                {localLevel && localLevel !== '>25TR' && FORECAST_LEVELS.find(l => l.id === localLevel)!.max < actualLocalT2 && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-bold rounded border border-red-100 dark:border-red-800 flex items-center gap-2 animate-pulse">
                        ⚠️ Mức dự báo thấp hơn doanh số thực tế T2 ({formatCompact(actualLocalT2)})
                    </div>
                )}
            </div>

            {/* EXPECTED SUMMARY SECTION */}
            {(importLevel || localLevel) && (
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUpIcon />
                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Tổng kết dự kiến T3</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-cyan-600 uppercase">Dự kiến Giga</span>
                            <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(expectedGigaT2)}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-pink-600 uppercase">Dự kiến BM</span>
                            <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(expectedBMT2)}</p>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Tổng dự kiến T3</span>
                            <span className="text-base font-black text-sky-600 dark:text-sky-400">{formatCurrency(expectedTotalT2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Target Tháng 3</span>
                            <span className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(targetMonthly)}</span>
                        </div>

                        {targetMonthly > 0 && (
                            <div className={`p-4 rounded-xl border flex flex-col gap-4 ${isTargetAchieved ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'}`}>
                                <div className="flex items-center gap-1.5 font-bold text-xs uppercase">
                                    {isTargetAchieved ? <CheckCircleIcon /> : <span>⚠️</span>}
                                    {isTargetAchieved ? 'KH mức mua tốt. Kì vọng sẽ đạt Target Tháng' : 'Dự kiến thấp hơn Target Tháng'}
                                </div>

                                {!isTargetAchieved && (
                                    <div className="space-y-4 pt-2 border-t border-orange-200/50 dark:border-orange-800/50">
                                        {/* Bước 1: Lý do chính */}
                                        <div>
                                            <label className="text-[10px] font-black uppercase block mb-1.5 text-orange-800 dark:text-orange-300">Giải trình 1: Lý do chính</label>
                                            <select
                                                value={reasonNotAchieved}
                                                onChange={(e) => setReasonNotAchieved(e.target.value)}
                                                className="w-full p-2.5 text-xs rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
                                            >
                                                <option value="">-- Chọn lý do chính --</option>
                                                {REASONS.map((r, i) => (
                                                    <option key={i} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Bước 2: Chi tiết dựa trên lý do chính */}
                                        {reasonNotAchieved && REASON_DETAILS_PROMPTS[reasonNotAchieved] && (
                                            <div className="animate-in slide-in-from-top-2 duration-300">
                                                <label className="text-[10px] font-black uppercase block mb-1.5 text-orange-800 dark:text-orange-300">Giải trình 2: Chi tiết cụ thể</label>
                                                <div className="mb-2 p-2 bg-white/50 dark:bg-black/20 rounded border border-orange-200/50 dark:border-orange-800/50 text-[10px] font-medium italic text-slate-600 dark:text-slate-400">
                                                    Yêu cầu: {REASON_DETAILS_PROMPTS[reasonNotAchieved]}
                                                </div>
                                                <textarea
                                                    value={reason2}
                                                    onChange={(e) => setReason2(e.target.value)}
                                                    placeholder="Nhập thông tin chi tiết tại đây..."
                                                    className="w-full p-2.5 text-xs rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 shadow-sm min-h-[80px]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="pt-4 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 italic">
                    * Vui lòng cân nhắc kỹ dựa trên lịch sử T1 & T2
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!importLevel && !localLevel)}
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase tracking-wider rounded-lg shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                    {isSubmitting ? 'Đan lưu...' : (
                        <>
                            <SaveIcon /> Xác nhận
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ForecastForm;
