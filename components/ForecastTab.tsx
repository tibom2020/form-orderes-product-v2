
import React, { useState, useMemo } from 'react';
import type { SalesRecord, Employee, ForecastItem } from '../types';
import { SearchIcon, TrendingUpIcon, CheckCircleIcon } from './icons';

interface ForecastTabProps {
    salesData: SalesRecord[];
    forecastData: ForecastItem[]; // Dữ liệu từ sheet ForecastRecord
    currentEmployee: Employee;
    onUpdateForecast: (customerCode: string, importLevel: string, localLevel: string) => void;
    onCustomerClick: (code: string) => void;
}

const ADMIN_CODE = '20043741';

const ForecastTab: React.FC<ForecastTabProps> = ({ salesData, forecastData, currentEmployee, onCustomerClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showStats, setShowStats] = useState(false);

    // Filter & Sort Logic
    const filteredData = useMemo(() => {
        // 1. Chỉ lấy khách hàng Cover Q1 = YES
        let data = salesData.filter(r => r.CoverQ1 === 'YES');

        if (currentEmployee.code !== ADMIN_CODE) {
            data = data.filter(record => {
                const matchCode = record.StaffCode && String(record.StaffCode).trim() === currentEmployee.code;
                const matchName = record.Rep && record.Rep.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
                return matchCode || matchName;
            });
        }

        // 2. Lọc theo search term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(r =>
                r.CustomerName.toLowerCase().includes(lowerTerm) ||
                String(r.CustomerCode).includes(lowerTerm) ||
                (r.Address && r.Address.toLowerCase().includes(lowerTerm))
            );
        }

        // 3. Sắp xếp theo doanh số giảm dần (ActualImport + ActualLocal)
        return data.sort((a, b) => {
            const valA = (Number(a.ActualImport) || 0) + (Number(a.ActualLocal) || 0);
            const valB = (Number(b.ActualImport) || 0) + (Number(b.ActualLocal) || 0);
            return valB - valA;
        });
    }, [salesData, currentEmployee, searchTerm]);

    // Statistics Calculation
    const statsData = useMemo(() => {
        const statsMap = new Map<string, { total: number, done: number }>();

        // Chỉ tính cho KH Cover Q1 = YES
        salesData.filter(r => r.CoverQ1 === 'YES').forEach(record => {
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

    const handleSelectCustomer = (record: SalesRecord) => {
        onCustomerClick(record.CustomerCode);
    };

    const formatCompact = (amount?: number) => {
        if (!amount) return '0';
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'Tr';
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
        return amount.toString();
    };

    const getSalesT1 = (record: SalesRecord) => {
        const imp = Number(record.ActualImportT1) || Number(record["SALE IMPORT T1"]) || Number(record.SaleImportTotalT1) || 0;
        const loc = Number(record.ActualLocalT1) || Number(record["SALE LOCAL T1"]) || Number(record.SaleLocalTotalT1) || 0;
        return imp + loc;
    };

    const getSalesT2 = (record: SalesRecord) => {
        const imp = Number(record.ActualImportT2) || Number(record["SALE IMPORT T2"]) || 0;
        const loc = Number(record.ActualLocalT2) || Number(record["SALE LOCAL T2"]) || 0;
        return imp + loc;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                        <TrendingUpIcon />
                        <span>Dự Báo Sale T3 ({filteredData.length})</span>
                    </h2>
                    <button
                        onClick={() => setShowStats(true)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-2"
                    >
                        📊 Thống kê
                    </button>
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
                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50 dark:bg-slate-700 dark:text-white"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {filteredData.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-sm">Không tìm thấy dữ liệu (Chỉ hiện KH Cover Q1)</div>
                ) : (
                    filteredData.map((record, idx) => {
                        // Check trong forecastData xem có record của KH này chưa
                        const forecast = forecastData.find(f => String(f.CustomerCode) === String(record.CustomerCode));
                        const hasForecast = forecast && (forecast.ImportLevel || forecast.LocalLevel);

                        return (
                            <div
                                key={`${record.CustomerCode}-${idx}`}
                                onClick={() => handleSelectCustomer(record)}
                                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors flex justify-between items-center group"
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-bold text-sm text-slate-800 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                                            {record.CustomerName}
                                        </p>
                                        {record.FinalStoreType && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${record.FinalStoreType.includes('Gold') ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {record.FinalStoreType}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{record.CustomerCode}</p>
                                        <span className="text-[10px] text-slate-400">•</span>
                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">DS T1: {formatCompact(getSalesT1(record))}</p>
                                        <span className="text-[10px] text-slate-400">|</span>
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">DS T2: {formatCompact(getSalesT2(record))}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {hasForecast ? (
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800 flex items-center gap-1">
                                            <CheckCircleIcon /> Đã dự báo
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">Chưa chọn</span>
                                    )}
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
                            <h3 className="text-xl font-black uppercase text-indigo-600 dark:text-indigo-400">Thống kê Forecast T3</h3>
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
                                                        <span className="font-black text-indigo-600 dark:text-indigo-400">{percent.toFixed(0)}%</span>
                                                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-600 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }}></div>
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
