
import React, { useState, useMemo } from 'react';
import type { SalesRecord, Employee, ForecastItem } from '../types';
import { SearchIcon, TrendingUpIcon, CheckCircleIcon } from './icons';
import { submitMarketingData } from '../services/googleSheetService';
import { buildForecastNotificationMessage } from '../utils/formatters';
import { GOOGLE_SCRIPT_URL } from '../constants';
import { FORECAST_LEVELS, REASONS, calcExpectedFromForecast, isCoverQ1 } from '../utils/forecastCalculations';

interface ForecastTabProps {
    salesData: SalesRecord[];
    forecastData: ForecastItem[];
    currentEmployee: Employee;
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
    onCustomerClick: (code: string) => void;
    onReloadData?: () => void;
}

const ADMIN_CODE = '20043741';

const getSaleValue = (record: SalesRecord, keys: (keyof SalesRecord)[]): number => {
    for (const key of keys) {
        const val = record[key];
        if (val !== undefined && val !== null && val !== '') {
            const n = Number(val);
            if (!isNaN(n)) return n;
        }
    }
    return 0;
};

const ForecastTab: React.FC<ForecastTabProps> = ({
    salesData,
    forecastData,
    currentEmployee,
    onUpdateForecast,
    onCustomerClick,
    onReloadData
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showStats, setShowStats] = useState(false);
    const [quickDraft, setQuickDraft] = useState<Record<string, { importLevel: string; localLevel: string; reasonNotAchieved: string; reason2: string }>>({});
    const [pendingNotifications, setPendingNotifications] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Filter & Sort Logic
    const filteredData = useMemo(() => {
        let data = salesData.filter(r => isCoverQ1(r));
        if (currentEmployee?.code !== ADMIN_CODE) {
            data = data.filter(record => {
                const matchCode = record.StaffCode && String(record.StaffCode).trim() === currentEmployee?.code;
                const matchName = record.Rep && record.Rep.toLowerCase().trim() === currentEmployee?.name?.toLowerCase().trim();
                return matchCode || matchName;
            });
        }
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(r =>
                r.CustomerName?.toLowerCase().includes(lowerTerm) ||
                String(r.CustomerCode).includes(lowerTerm) ||
                (r.Address && r.Address.toLowerCase().includes(lowerTerm))
            );
        }
        return data.sort((a, b) => {
            const valA = (Number(a.ActualImport) || 0) + (Number(a.ActualLocal) || 0);
            const valB = (Number(b.ActualImport) || 0) + (Number(b.ActualLocal) || 0);
            return valB - valA;
        });
    }, [salesData, currentEmployee, searchTerm]);

    const statsData = useMemo(() => {
        const statsMap = new Map<string, { total: number; done: number }>();
        salesData.filter(r => isCoverQ1(r)).forEach(record => {
            const repName = record.Rep || 'Chưa xác định';
            const current = statsMap.get(repName) || { total: 0, done: 0 };
            const hasForecast = forecastData.some(f => String(f.CustomerCode) === String(record.CustomerCode) && (f.ImportLevel || f.LocalLevel));
            statsMap.set(repName, {
                total: current.total + 1,
                done: current.done + (hasForecast ? 1 : 0)
            });
        });
        return Array.from(statsMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [salesData, forecastData]);

    const totalStats = useMemo(() => {
        return statsData.reduce((acc, curr) => ({
            total: acc.total + curr.total,
            done: acc.done + curr.done
        }), { total: 0, done: 0 });
    }, [statsData]);

    // Số KH dự báo / tổng KH cần dự báo của user hiện tại (cho thông báo)
    const userForecastStats = useMemo(() => {
        let data = salesData.filter(r => isCoverQ1(r));
        if (currentEmployee?.code !== ADMIN_CODE) {
            data = data.filter(record => {
                const matchCode = record.StaffCode && String(record.StaffCode).trim() === currentEmployee?.code;
                const matchName = record.Rep && record.Rep.toLowerCase().trim() === currentEmployee?.name?.toLowerCase().trim();
                return matchCode || matchName;
            });
        }
        const total = data.length;
        const done = data.filter(r =>
            forecastData.some(f => String(f.CustomerCode) === String(r.CustomerCode) && (f.ImportLevel || f.LocalLevel))
        ).length;
        return { forecastedCount: done, totalCount: total };
    }, [salesData, forecastData, currentEmployee]);

    // Fallback cho admin: dùng totalStats khi userForecastStats trả về 0 (tránh tiến độ "-")
    const forecastStatsForNotification = useMemo(() => {
        const u = userForecastStats;
        if (u.totalCount > 0) return u;
        return { forecastedCount: totalStats.done, totalCount: totalStats.total };
    }, [userForecastStats, totalStats]);

    const formatCompact = (amount?: number) => {
        if (!amount) return '0';
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'Tr';
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
        return amount.toString();
    };

    const getImportT1 = (r: SalesRecord) => getSaleValue(r, ['ActualImportT1', 'SALE IMPORT T1', 'SaleImportTotalT1']);
    const getImportT2 = (r: SalesRecord) => getSaleValue(r, ['ActualImportT2', 'SALE IMPORT T2']);
    const getLocalT1 = (r: SalesRecord) => getSaleValue(r, ['ActualLocalT1', 'SALE LOCAL T1', 'SaleLocalTotalT1']);
    const getLocalT2 = (r: SalesRecord) => getSaleValue(r, ['ActualLocalT2', 'SALE LOCAL T2']);

    const handleQuickConfirm = async (record: SalesRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        const draft = quickDraft[record.CustomerCode] || { importLevel: '', localLevel: '', reasonNotAchieved: '', reason2: '' };
        if (!draft.importLevel && !draft.localLevel) {
            alert('Vui lòng chọn ít nhất một mức dự báo Import hoặc Local.');
            return;
        }
        setIsSubmitting(record.CustomerCode);
        const { expectedGigaT2, expectedBMT2, expectedTotalT2, targetMonthly, isTargetAchieved } = calcExpectedFromForecast(
            record, draft.importLevel || null, draft.localLevel || null
        );
        const reasonNotAchieved = isTargetAchieved ? 'Đạt Target' : (draft.reasonNotAchieved || 'Khác');
        const reason2 = isTargetAchieved ? '' : (draft.reason2 || '');
        if (targetMonthly > 0 && !isTargetAchieved && !draft.reasonNotAchieved) {
            setIsSubmitting(null);
            alert('Vui lòng chọn lý do giải trình khi không đạt Target Tháng.');
            return;
        }
        try {
            await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'submitForecast',
                customerCode: record.CustomerCode,
                customerName: record.CustomerName || '',
                employeeName: currentEmployee?.name || '',
                importLevel: draft.importLevel || '',
                localLevel: draft.localLevel || '',
                importValue: draft.importLevel === '>25TR' ? 25000000 : 0,
                localValue: draft.localLevel === '>25TR' ? 25000000 : 0,
                expectedGigaT2,
                expectedBMT2,
                expectedTotalT2,
                targetMonthly,
                reasonNotAchieved,
                reason2,
                skipNotification: true
            });
            onUpdateForecast(
                record.CustomerCode,
                draft.importLevel || '',
                draft.localLevel || '',
                draft.importLevel === '>25TR' ? 25000000 : undefined,
                draft.localLevel === '>25TR' ? 25000000 : undefined,
                { expectedGigaT2, expectedBMT2, expectedTotalT2, targetMonthly, reasonNotAchieved, reason2 }
            );
            setQuickDraft(prev => {
                const next = { ...prev };
                delete next[record.CustomerCode];
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('Lỗi khi lưu dự báo. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(null);
        }
    };

    const getDraft = (code: string) => quickDraft[code] || { importLevel: '', localLevel: '', reasonNotAchieved: '', reason2: '' };

    const handleExportReport = async () => {
        if (pendingNotifications.length === 0) {
            alert('Không có KH nào trong list chờ thông báo.');
            return;
        }
        const toSend = [...pendingNotifications];
        setIsExporting(true);
        for (const customerCode of toSend) {
            const record = salesData.find(r => String(r.CustomerCode) === String(customerCode));
            const forecast = forecastData.find(f => String(f.CustomerCode) === String(customerCode));
            if (!record || !forecast) continue;
            const { expectedTotalT2, targetMonthly, isTargetAchieved } = calcExpectedFromForecast(
                record, forecast.ImportLevel || null, forecast.LocalLevel || null,
                forecast.ImportValue || 25000000, forecast.LocalValue || 25000000
            );
            try {
                const message = buildForecastNotificationMessage({
                    customerCode: record.CustomerCode,
                    customerName: record.CustomerName || '',
                    employeeName: forecast.Employee || currentEmployee?.name || '',
                    importLevel: forecast.ImportLevel || '-',
                    localLevel: forecast.LocalLevel || '-',
                    expectedTotalT2,
                    targetMonthly,
                    reasonNotAchieved: forecast.ReasonNotAchieved || (isTargetAchieved ? 'Đạt Target' : 'Khác'),
                    forecastedCount: forecastStatsForNotification.forecastedCount,
                    totalCount: forecastStatsForNotification.totalCount
                });
                await submitMarketingData(GOOGLE_SCRIPT_URL, {
                    action: 'triggerForecastNotification',
                    customerCode: record.CustomerCode,
                    customerName: record.CustomerName || '',
                    employeeName: forecast.Employee || currentEmployee?.name || '',
                    importLevel: forecast.ImportLevel || '-',
                    localLevel: forecast.LocalLevel || '-',
                    expectedTotalT2,
                    targetMonthly,
                    reasonNotAchieved: forecast.ReasonNotAchieved || (isTargetAchieved ? 'Đạt Target' : 'Khác'),
                    forecastedCount: forecastStatsForNotification.forecastedCount,
                    totalCount: forecastStatsForNotification.totalCount,
                    message
                });
                await new Promise(r => setTimeout(r, 400));
            } catch (e) {
                console.error('Notification error for', customerCode, e);
            }
        }
        setPendingNotifications([]);
        setIsExporting(false);
        alert(`Đã gửi thông báo cho ${toSend.length} khách hàng.`);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-xl">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                        <TrendingUpIcon />
                        <span>Dự Báo Sale T3 ({filteredData.length})</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        {pendingNotifications.length > 0 && (
                            <button
                                onClick={handleExportReport}
                                disabled={isExporting}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition-colors"
                            >
                                {isExporting ? 'Đang gửi...' : `📤 Xuất báo cáo (${pendingNotifications.length})`}
                            </button>
                        )}
                        <button
                            onClick={() => setShowStats(true)}
                            className="px-3 py-1.5 bg-opella-green hover:bg-opella-green/90 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-2"
                        >
                            📊 Thống kê
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm khách hàng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-opella-green outline-none bg-slate-50 dark:bg-slate-700 dark:text-white"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {filteredData.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-sm">Không tìm thấy dữ liệu (Chỉ hiện KH Cover Q1)</div>
                ) : (
                    filteredData.map((record, idx) => {
                        const forecast = forecastData.find(f => String(f.CustomerCode) === String(record.CustomerCode));
                        const hasForecast = forecast && (forecast.ImportLevel || forecast.LocalLevel);
                        const draft = getDraft(record.CustomerCode);
                        const isPending = pendingNotifications.includes(record.CustomerCode);
                        const targetMonthly = Number(record.TargetMonthly) || 0;
                        const isThisSubmitting = isSubmitting === record.CustomerCode;
                        // Doanh số T3 dự kiến: từ forecast đã lưu hoặc từ draft đang chọn
                        const importLvl = hasForecast ? (forecast?.ImportLevel || null) : (draft.importLevel || null);
                        const localLvl = hasForecast ? (forecast?.LocalLevel || null) : (draft.localLevel || null);
                        const importVal = forecast?.ImportValue ?? 25000000;
                        const localVal = forecast?.LocalValue ?? 25000000;
                        const { expectedTotalT2: expectedT3 } = calcExpectedFromForecast(record, importLvl, localLvl, importVal, localVal);

                        return (
                            <div
                                key={`${record.CustomerCode}-${idx}`}
                                onClick={() => onCustomerClick(record.CustomerCode)}
                                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            >
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">
                                                    {record.CustomerName}
                                                </p>
                                                {record.FinalStoreType && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${
                                                        record.FinalStoreType.includes('Gold') ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                        {record.FinalStoreType}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">{record.CustomerCode}</p>
                                            {/* DS Import & Local theo tháng + Target tháng */}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] mb-1">
                                                <span className="font-bold text-blue-600 dark:text-blue-400">Imp T1: {formatCompact(getImportT1(record))}</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">Imp T2: {formatCompact(getImportT2(record))}</span>
                                                <span className="text-slate-400">|</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">Loc T1: {formatCompact(getLocalT1(record))}</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">Loc T2: {formatCompact(getLocalT2(record))}</span>
                                                <span className="text-slate-400">|</span>
                                                <span className="font-bold text-amber-600 dark:text-amber-400">Target: {formatCompact(targetMonthly)}</span>
                                                {(importLvl || localLvl) && (
                                                    <>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="font-bold text-opella-green dark:text-opella-green">DS T3 dự kiến: {formatCompact(expectedT3)}</span>
                                                    </>
                                                )}
                                            </div>
                                            {/* 2 ô lý do: hiển thị khi đã có forecast */}
                                            {hasForecast && (forecast?.ReasonNotAchieved || forecast?.Reason2) && (
                                                <div className="text-[9px] text-slate-600 dark:text-slate-400 space-y-0.5">
                                                    {forecast.ReasonNotAchieved && (
                                                        <p className="truncate" title={forecast.ReasonNotAchieved}>📝 {forecast.ReasonNotAchieved}</p>
                                                    )}
                                                    {forecast.Reason2 && (
                                                        <p className="truncate italic" title={forecast.Reason2}>→ {forecast.Reason2}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {hasForecast ? (
                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800 flex items-center gap-1">
                                                    <CheckCircleIcon /> Đã dự báo
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">Chưa chọn</span>
                                            )}
                                            {isPending && (
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Chờ TB</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick forecast: 2 dropdowns + 2 ô lý do + Xác nhận */}
                                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select
                                                value={draft.importLevel}
                                                onChange={e => setQuickDraft(prev => ({
                                                    ...prev,
                                                    [record.CustomerCode]: { ...getDraft(record.CustomerCode), importLevel: e.target.value }
                                                }))}
                                                className="text-[10px] px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white min-w-[100px]"
                                            >
                                                <option value="">-- Import --</option>
                                                {FORECAST_LEVELS.map(l => (
                                                    <option key={l.id} value={l.id}>{l.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={draft.localLevel}
                                                onChange={e => setQuickDraft(prev => ({
                                                    ...prev,
                                                    [record.CustomerCode]: { ...getDraft(record.CustomerCode), localLevel: e.target.value }
                                                }))}
                                                className="text-[10px] px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white min-w-[100px]"
                                            >
                                                <option value="">-- Local --</option>
                                                {FORECAST_LEVELS.map(l => (
                                                    <option key={l.id} value={l.id}>{l.label}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={e => handleQuickConfirm(record, e)}
                                                disabled={isThisSubmitting || (!draft.importLevel && !draft.localLevel)}
                                                className="px-3 py-1 text-[10px] font-bold bg-opella-green hover:bg-opella-green/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                            >
                                                {isThisSubmitting ? '...' : 'Xác nhận'}
                                            </button>
                                        </div>
                                        {/* 2 ô lý do cần giải trình (khi có target) */}
                                        {targetMonthly > 0 && (draft.importLevel || draft.localLevel) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-800">
                                                <div>
                                                    <label className="text-[9px] font-bold text-orange-700 dark:text-orange-400 uppercase block mb-0.5">Lý do chính</label>
                                                    <select
                                                        value={draft.reasonNotAchieved}
                                                        onChange={e => setQuickDraft(prev => ({
                                                            ...prev,
                                                            [record.CustomerCode]: { ...getDraft(record.CustomerCode), reasonNotAchieved: e.target.value }
                                                        }))}
                                                        className="w-full text-[10px] px-2 py-1 rounded border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 dark:text-white"
                                                    >
                                                        <option value="">-- Chọn lý do --</option>
                                                        {REASONS.map((r, i) => (
                                                            <option key={i} value={r}>{r.length > 45 ? r.slice(0, 45) + '...' : r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-orange-700 dark:text-orange-400 uppercase block mb-0.5">Chi tiết cụ thể</label>
                                                    <input
                                                        type="text"
                                                        value={draft.reason2}
                                                        onChange={e => setQuickDraft(prev => ({
                                                            ...prev,
                                                            [record.CustomerCode]: { ...getDraft(record.CustomerCode), reason2: e.target.value }
                                                        }))}
                                                        placeholder="Nhập chi tiết..."
                                                        className="w-full text-[10px] px-2 py-1 rounded border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Statistics Modal */}
            {showStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 relative flex flex-col max-h-[90vh]">
                        <button
                            onClick={() => setShowStats(false)}
                            className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                        <div className="mb-6">
                            <h3 className="text-xl font-black uppercase text-opella-green dark:text-opella-green">Thống kê Forecast T3</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng hợp tiến độ theo nhân viên (Chỉ tính KH Cover Q1)</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] font-bold text-blue-500 uppercase">Tổng KH Cover Q1</p>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalStats.total}</p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Đã Forecast</p>
                                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{totalStats.done}</p>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800">
                                <p className="text-[10px] font-bold text-orange-500 uppercase">Còn lại</p>
                                <p className="text-2xl font-black text-orange-700 dark:text-orange-300">{totalStats.total - totalStats.done}</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10 shadow-sm text-slate-500 dark:text-slate-300 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="px-4 py-3">Nhân viên (REP)</th>
                                        <th className="px-4 py-3 text-center">Tổng KH</th>
                                        <th className="px-4 py-3 text-center">Đã Forecast</th>
                                        <th className="px-4 py-3 text-center">Còn lại</th>
                                        <th className="px-4 py-3 text-right">Tỷ lệ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {statsData.map((s, idx) => {
                                        const remaining = s.total - s.done;
                                        const percent = s.total > 0 ? (s.done / s.total * 100) : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-500">{s.total}</td>
                                                <td className="px-4 py-3 text-center font-black text-emerald-600 dark:text-emerald-400">{s.done}</td>
                                                <td className="px-4 py-3 text-center font-black text-orange-500">{remaining}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-opella-green dark:text-opella-green">{percent.toFixed(0)}%</span>
                                                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-600 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-opella-green" style={{ width: `${percent}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setShowStats(false)}
                                className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForecastTab;
