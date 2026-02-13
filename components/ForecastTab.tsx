
import React, { useState, useMemo, useEffect } from 'react';
import type { SalesRecord, Employee, ForecastItem } from '../types';
import { SearchIcon, TrendingUpIcon, ArrowLeftIcon, SaveIcon, CheckCircleIcon } from './icons';
import { submitMarketingData } from '../services/googleSheetService';
import { GOOGLE_SCRIPT_URL } from '../constants';

interface ForecastTabProps {
    salesData: SalesRecord[];
    forecastData: ForecastItem[]; // Dữ liệu từ sheet ForecastRecord
    currentEmployee: Employee;
    onUpdateForecast: (customerCode: string, importLevel: string, localLevel: string) => void;
}

const FORECAST_LEVELS = [
    { id: '700k', label: '700k', sub: '' },
    { id: '1.5-3TR', label: '1.5 - 3Tr', sub: '(3%)' },
    { id: '3-5TR', label: '3 - 5Tr', sub: '(3.5%)' },
    { id: '5-10TR', label: '5 - 10Tr', sub: '(4%)' },
    { id: '10-15TR', label: '10 - 15Tr', sub: '(4.5%)' },
    { id: '15-25TR', label: '15 - 25Tr', sub: '(5%)' },
    { id: '>25TR', label: '> 25Tr', sub: '(5.5%)' },
];

const ADMIN_CODE = '20043741';

// Helper để lấy giá trị số từ record, thử nhiều key khác nhau
const getSaleValue = (record: any, keys: string[]): number => {
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
            const val = Number(record[key]);
            if (!isNaN(val)) return val;
        }
    }
    return 0;
};

const ForecastTab: React.FC<ForecastTabProps> = ({ salesData, forecastData, currentEmployee, onUpdateForecast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<SalesRecord | null>(null);
    const [importLevel, setImportLevel] = useState<string | null>(null);
    const [localLevel, setLocalLevel] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter Logic
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
        
        if (!searchTerm) return data;
        const lowerTerm = searchTerm.toLowerCase();
        return data.filter(r => 
            r.CustomerName.toLowerCase().includes(lowerTerm) || 
            String(r.CustomerCode).includes(lowerTerm) ||
            (r.Address && r.Address.toLowerCase().includes(lowerTerm))
        );
    }, [salesData, currentEmployee, searchTerm]);

    // Initialize state when customer selected based on forecastData
    useEffect(() => {
        if (selectedCustomer) {
            const forecast = forecastData.find(f => String(f.CustomerCode) === String(selectedCustomer.CustomerCode));
            if (forecast) {
                setImportLevel(forecast.ImportLevel || null);
                setLocalLevel(forecast.LocalLevel || null);
            } else {
                setImportLevel(null);
                setLocalLevel(null);
            }
        }
    }, [selectedCustomer, forecastData]);

    const handleSelectCustomer = (record: SalesRecord) => {
        setSelectedCustomer(record);
    };

    const handleBack = () => {
        setSelectedCustomer(null);
        setImportLevel(null);
        setLocalLevel(null);
    };

    const handleSubmit = async () => {
        if (!selectedCustomer) return;
        if (!importLevel && !localLevel) {
            alert("Vui lòng chọn ít nhất một mức dự báo.");
            return;
        }

        setIsSubmitting(true);
        try {
            await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'submitForecast',
                customerCode: selectedCustomer.CustomerCode,
                employeeName: currentEmployee.name,
                importLevel: importLevel || '',
                localLevel: localLevel || ''
            });
            
            // Cập nhật state cục bộ để UI phản hồi ngay
            onUpdateForecast(selectedCustomer.CustomerCode, importLevel || '', localLevel || '');
            
            alert("Đã lưu dự báo thành công!");
            handleBack();
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCompact = (amount?: number) => {
        if (!amount) return '0';
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'Tr';
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
        return amount.toString();
    };

    // Render List View
    if (!selectedCustomer) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 min-h-[500px] flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-xl">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2 mb-4">
                        <TrendingUpIcon />
                        <span>Dự Báo Sale T2 ({filteredData.length})</span>
                    </h2>
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
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                                                    record.FinalStoreType.includes('Gold') ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    {record.FinalStoreType}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{record.CustomerCode}</p>
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
            </div>
        );
    }

    // Render Detail View
    const HistoryCard = ({ title, giga, buymed, total, colorClass, titleClass, totalClass }: any) => (
        <div className={`p-3 rounded-lg border ${colorClass} mb-4`}>
            <h4 className={`text-xs font-bold uppercase mb-2 ${titleClass}`}>{title}</h4>
            <div className="flex justify-between items-center text-xs">
                <div className="flex gap-3">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase">Giga</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(giga)}</span>
                    </div>
                    <div className="w-px bg-slate-200 dark:bg-slate-600 h-8"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase">BuyMed</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatCompact(buymed)}</span>
                    </div>
                </div>
                <div className={`flex flex-col items-end ${totalClass}`}>
                     <span className="text-[9px] opacity-70 uppercase">Tổng T1</span>
                     <span className="text-lg font-black">{formatCompact(total)}</span>
                </div>
            </div>
        </div>
    );

    // Lấy dữ liệu an toàn - Ưu tiên các cột ActualImport... (số liệu thực tế) nếu có
    const importGiga = getSaleValue(selectedCustomer, ["ActualImportGiga", "SALE IMPORT (GIGA T1)", "SaleImportGigaT1"]);
    const importBuyMed = getSaleValue(selectedCustomer, ["ActualImportBuyMed", "SALE IMPORT (BUYMED) T1", "SaleImportBuyMedT1"]);
    const importTotal = getSaleValue(selectedCustomer, ["ActualImport", "SALE IMPORT T1", "SaleImportTotalT1"]);

    const localGiga = getSaleValue(selectedCustomer, ["ActualLocalGiga", "SALE LOCAL (GIGA) T1", "SaleLocalGigaT1"]);
    const localBuyMed = getSaleValue(selectedCustomer, ["ActualLocalBuyMed", "SALE LOCAL (BUYMED) T1", "SaleLocalBuyMedT1"]);
    const localTotal = getSaleValue(selectedCustomer, ["ActualLocal", "SALE LOCAL T1", "SaleLocalTotalT1"]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col min-h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 sticky top-0 bg-white dark:bg-slate-800 z-20 rounded-t-xl">
                <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                    <ArrowLeftIcon />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-slate-800 dark:text-white truncate">{selectedCustomer.CustomerName}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 font-mono">{selectedCustomer.CustomerCode}</p>
                        {selectedCustomer.FinalStoreType && (
                             <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                                 selectedCustomer.FinalStoreType.includes('Gold') ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                 'bg-slate-100 text-slate-600 border-slate-200'
                             }`}>
                                 {selectedCustomer.FinalStoreType}
                             </span>
                        )}
                        {selectedCustomer.BuyMed === 'YES' && (
                            <span className="text-[9px] font-bold bg-pink-100 text-pink-700 px-1.5 rounded border border-pink-200">BuyMed</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-6">
                
                {/* IMPORT SECTION */}
                <div className="animate-fade-in">
                    <HistoryCard 
                        title="Lịch sử Sale Import T1" 
                        giga={importGiga}
                        buymed={importBuyMed}
                        total={importTotal}
                        colorClass="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800"
                        titleClass="text-blue-700 dark:text-blue-400"
                        totalClass="text-blue-600 dark:text-blue-400"
                    />
                    
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                        <span>🎯 Chọn Dự Kiến Import T2</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {FORECAST_LEVELS.map((lvl) => (
                            <button
                                key={lvl.id}
                                onClick={() => setImportLevel(importLevel === lvl.id ? null : lvl.id)}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                    importLevel === lvl.id 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md transform scale-105' 
                                    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-blue-200 dark:hover:border-blue-800'
                                }`}
                            >
                                <div className="font-bold text-sm">{lvl.label}</div>
                                {lvl.sub && <div className="text-[10px] font-medium opacity-80">{lvl.sub}</div>}
                                {importLevel === lvl.id && <div className="mt-1 text-blue-500"><CheckCircleIcon /></div>}
                            </button>
                        ))}
                    </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-700" />

                {/* LOCAL SECTION */}
                <div className="animate-fade-in delay-100">
                    <HistoryCard 
                        title="Lịch sử Sale Local T1" 
                        giga={localGiga}
                        buymed={localBuyMed}
                        total={localTotal}
                        colorClass="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800"
                        titleClass="text-green-700 dark:text-green-400"
                        totalClass="text-green-600 dark:text-green-400"
                    />

                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                        <span>🎯 Chọn Dự Kiến Local T2</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {FORECAST_LEVELS.map((lvl) => (
                            <button
                                key={lvl.id}
                                onClick={() => setLocalLevel(localLevel === lvl.id ? null : lvl.id)}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                    localLevel === lvl.id 
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-md transform scale-105' 
                                    : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-green-200 dark:hover:border-green-800'
                                }`}
                            >
                                <div className="font-bold text-sm">{lvl.label}</div>
                                {lvl.sub && <div className="text-[10px] font-medium opacity-80">{lvl.sub}</div>}
                                {localLevel === lvl.id && <div className="mt-1 text-green-500"><CheckCircleIcon /></div>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-xl flex justify-between items-center">
                <div className="text-xs text-slate-500 italic">
                    * Vui lòng cân nhắc kỹ dựa trên lịch sử T1
                </div>
                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!importLevel && !localLevel)}
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black uppercase tracking-wider rounded-lg shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                    {isSubmitting ? 'Đang lưu...' : (
                        <>
                            <SaveIcon /> Xác nhận
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ForecastTab;
