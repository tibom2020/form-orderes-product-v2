
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { SalesRecord, Rebate, PurchaseHistoryItem, ForecastItem, Employee } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
    ArrowLeftIcon, UserGroupIcon, IdentificationIcon, ClockIcon,
    CartIcon, TrophyIcon, SearchIcon, DocumentTextIcon, StarIcon, GiftIcon, CubeIcon, FaceSmileIcon
} from '../icons';
import {
    getRawPercent, formatDateVal, formatCompact, getRebateLevel
} from './DashboardUtils';
import { ProgressBar } from './ProgressBars';
import { LevelTodoTable } from './LevelTodoTable';
import ForecastForm from './ForecastForm';
import { isCoverQ1 } from '../../utils/forecastCalculations';
import { TrendingUpIcon } from '../icons';

interface CustomerDetailProps {
    record: SalesRecord;
    allRecords: SalesRecord[];
    rebates: Rebate[];
    purchaseHistory: PurchaseHistoryItem[];
    onBack: () => void;
    onGoToOrder: (code: string) => void;
    onSwitchCustomer: (record: SalesRecord) => void;
    currentEmployee: Employee;
    forecastData: ForecastItem[];
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
}

const getMonthKeyFromInvoiceDate = (d: string | number | undefined): string | null => {
    if (d == null || d === '') return null;
    let date: Date;
    if (typeof d === 'number') {
        date = new Date((d - 25569) * 86400 * 1000);
    } else {
        const str = String(d);
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            } else {
                date = new Date(str);
            }
        } else {
            date = new Date(str);
        }
    }
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
};

const formatMonthLabel = (key: string): string => {
    const [y, m] = key.split('-');
    return `${m}/${y}`;
};

const CustomerDetail: React.FC<CustomerDetailProps> = ({
    record, allRecords, rebates, purchaseHistory, onBack, onGoToOrder, onSwitchCustomer,
    currentEmployee, forecastData, onUpdateForecast
}) => {
    const [activeDetailModal, setActiveDetailModal] = useState<'Import' | 'Local' | 'T1' | 'Products' | 'ĐiềuKiệnTB' | null>(null);
    const [showQuickSearch, setShowQuickSearch] = useState(false);
    const [quickSearchTerm, setQuickSearchTerm] = useState('');
    const [historyChannelFilter, setHistoryChannelFilter] = useState<'all' | 'gg' | 'bm'>('all');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'import' | 'local'>('all');
    const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('all');
    const quickSearchInputRef = useRef<HTMLInputElement>(null);

    // Forecast stats: số KH dự báo / tổng KH cần dự báo (cho thông báo)
    const forecastStats = useMemo(() => {
        const coverQ1 = allRecords.filter(r => isCoverQ1(r));
        const total = coverQ1.length;
        const done = coverQ1.filter(r =>
            forecastData.some(f => String(f.CustomerCode) === String(r.CustomerCode) && (f.ImportLevel || f.LocalLevel))
        ).length;
        return { forecastedCount: done, totalCount: total };
    }, [allRecords, forecastData]);

    // Quick Search Logic
    const quickSearchResults = useMemo(() => {
        if (!quickSearchTerm) return [];
        const term = quickSearchTerm.toLowerCase();
        return allRecords.filter(r =>
            r.CustomerName.toLowerCase().includes(term) ||
            String(r.CustomerCode).toLowerCase().includes(term)
        ).slice(0, 8);
    }, [quickSearchTerm, allRecords]);

    useEffect(() => {
        if (showQuickSearch && quickSearchInputRef.current) {
            quickSearchInputRef.current.focus();
        }
    }, [showQuickSearch]);

    // History Processing
    const allHistory = useMemo(() => {
        const buyMedCode = record.CodeBuyMed ? String(record.CodeBuyMed).trim() : '';
        const mainCode = String(record.CustomerCode).trim();
        return (purchaseHistory || [])
            .filter(p => {
                const pId = String(p.CustomerID).trim();
                return pId === mainCode || (buyMedCode !== '' && pId === buyMedCode);
            })
            .sort((a, b) => {
                const getTs = (d: string | number | undefined) => {
                    if (!d) return 0;
                    if (typeof d === 'number') return d;
                    if (typeof d === 'string' && d.includes('/')) {
                        const parts = d.split('/');
                        if (parts.length === 3) {
                            return new Date(`${parts[1]}/${parts[0]}/${parts[2]}`).getTime();
                        }
                    }
                    return new Date(d).getTime();
                };
                return getTs(b.InvoiceDate) - getTs(a.InvoiceDate);
            });
    }, [purchaseHistory, record]);

    // Product Stats
    const uniqueProductStats = useMemo(() => {
        const map = new Map<string, { qty: number, val: number }>();
        allHistory.forEach(h => {
            const prodName = h.Product ? h.Product.trim() : 'Unknown';
            const current = map.get(prodName) || { qty: 0, val: 0 };
            map.set(prodName, {
                qty: current.qty + (Number(h.Qty) || 0),
                val: current.val + (Number(h.Value) || 0)
            });
        });

        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.val - a.val);
    }, [allHistory]);

    const totalHistoryValue = useMemo(() => allHistory.reduce((sum, h) => sum + (Number(h.Value) || 0), 0), [allHistory]);

    // Derived Variables
    const customerRebates = useMemo(() => rebates.filter(r => String(r.code) === String(record.CustomerCode)), [rebates, record]);

    const mergedHistory = useMemo(() => {
        const imp = allHistory.filter(h => (h.Group || h.Team || '').toLowerCase().includes('import'));
        const loc = allHistory.filter(h => (h.Group || h.Team || '').toLowerCase().includes('local'));
        return [...imp, ...loc];
    }, [allHistory]);

    const mainCode = String(record.CustomerCode).trim();
    const buyMedCode = record.CodeBuyMed ? String(record.CodeBuyMed).trim() : '';

    const uniqueMonths = useMemo(() => {
        const set = new Set<string>();
        mergedHistory.forEach(h => {
            const key = getMonthKeyFromInvoiceDate(h.InvoiceDate);
            if (key) set.add(key);
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [mergedHistory]);

    const filteredHistory = useMemo(() => {
        let list = mergedHistory;
        if (historyChannelFilter === 'gg') {
            list = list.filter(h => String(h.CustomerID).trim() === mainCode);
        } else if (historyChannelFilter === 'bm') {
            list = list.filter(h => buyMedCode !== '' && String(h.CustomerID).trim() === buyMedCode);
        }
        if (historyTypeFilter === 'import') {
            list = list.filter(h => (h.Group || h.Team || '').toLowerCase().includes('import'));
        } else if (historyTypeFilter === 'local') {
            list = list.filter(h => (h.Group || h.Team || '').toLowerCase().includes('local'));
        }
        if (historyMonthFilter !== 'all') {
            list = list.filter(h => getMonthKeyFromInvoiceDate(h.InvoiceDate) === historyMonthFilter);
        }
        return list;
    }, [mergedHistory, historyChannelFilter, historyTypeFilter, historyMonthFilter, mainCode, buyMedCode]);

    const filteredHistoryTotal = useMemo(
        () => filteredHistory.reduce((sum, h) => sum + (Number(h.Value) || 0), 0),
        [filteredHistory]
    );

    const actualImport = Number(record.ActualImport) || 0;
    const targetImport = Number(record.TargetImport) || 0;
    const actualLocal = Number(record.ActualLocal) || 0;
    const targetLocal = Number(record.TargetLocal) || 0;
    const totalActual = actualImport + actualLocal;
    const totalTarget = targetImport + targetLocal;
    const progressPercent = getRawPercent(totalActual, totalTarget);
    const todoTotal = Number(record.Todo) || 0;

    // T1 Data (từ DOANH_SO: ActualImportT1 + ActualLocalT1)
    const actualImportT1 = Number(record.ActualImportT1 || record["SALE IMPORT T1"] || record.SaleImportTotalT1) || 0;
    const actualLocalT1 = Number(record.ActualLocalT1 || record["SALE LOCAL T1"] || record.SaleLocalTotalT1) || 0;
    const totalSaleT1 = actualImportT1 + actualLocalT1;
    // T2 Data (từ DOANH_SO: ActualImportT2 + ActualLocalT2)
    const actualImportT2 = Number(record.ActualImportT2 || record["SALE IMPORT T2"] || record.ActualImport) || 0;
    const actualLocalT2 = Number(record.ActualLocalT2 || record["SALE LOCAL T2"] || record.ActualLocal) || 0;
    const totalSaleT2 = actualImportT2 + actualLocalT2;
    const importTierT1 = getRebateLevel(actualImportT1);
    const importBonusT1 = importTierT1 ? actualImportT1 * (importTierT1.percent / 100) : 0;
    const localTierT1 = getRebateLevel(actualLocalT1);
    const localBonusT1 = localTierT1 ? actualLocalT1 * (localTierT1.percent / 100) : 0;

    const isGold = (record.FinalStoreType ?? '').toLowerCase().includes('gold');
    const isSilver = (record.FinalStoreType ?? '').toLowerCase().includes('silver');
    const badgeColor = isGold ? 'bg-yellow-400 text-yellow-900' : isSilver ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-900';
    const badgeIcon = isGold ? '👑' : isSilver ? '🛡️' : '🥉';

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-full pb-10">
            {/* Top Navigation */}
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20">
                <button
                    onClick={onBack}
                    className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                >
                    <ArrowLeftIcon />
                </button>

                <div className="flex-1 relative">
                    {showQuickSearch ? (
                        <div className="relative animate-fade-in">
                            <input
                                ref={quickSearchInputRef}
                                type="text"
                                value={quickSearchTerm}
                                onChange={(e) => setQuickSearchTerm(e.target.value)}
                                placeholder="Tìm khách hàng khác..."
                                className="w-full py-2 px-4 rounded-full border-2 border-opella-green bg-white dark:bg-slate-700 dark:text-white dark:border-opella-green outline-none text-sm font-bold shadow-sm"
                                onBlur={() => setTimeout(() => setShowQuickSearch(false), 200)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onClick={() => { setShowQuickSearch(false); setQuickSearchTerm(''); }}>
                                ✕
                            </div>

                            {/* Dropdown Results */}
                            {quickSearchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                    {quickSearchResults.map(res => (
                                        <div
                                            key={res.CustomerCode}
                                            onMouseDown={() => {
                                                onSwitchCustomer(res);
                                                setShowQuickSearch(false);
                                                setQuickSearchTerm('');
                                            }}
                                            className="px-4 py-3 hover:bg-opella-beige/50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                        >
                                            <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{res.CustomerName}</p>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{res.CustomerCode}</span>
                                                {res.District && <span className="text-[10px] text-slate-400">{res.District}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setShowQuickSearch(true)}>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-opella-green dark:group-hover:text-opella-green transition-colors">
                                    {record.CustomerName}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{record.CustomerCode}</p>
                            </div>
                            <button className="p-2 text-slate-400 hover:text-opella-green dark:text-slate-500 dark:hover:text-opella-green transition-colors">
                                <SearchIcon />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onGoToOrder(record.CustomerCode)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors uppercase flex items-center gap-2 shrink-0"
                >
                    <CartIcon />
                    <span className="hidden sm:inline">Lên Đơn</span>
                </button>
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-full flex flex-col relative">
                        <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full blur-2xl -ml-10 -mb-10"></div>
                        </div>

                        <div className="px-4 pb-6 -mt-12 flex flex-col items-center relative z-10 flex-1">
                            <div className="w-24 h-24 bg-emerald-600 dark:bg-emerald-700 rounded-full border-4 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-white">
                                <div className="scale-150"><UserGroupIcon /></div>
                            </div>

                            <h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-white text-center leading-tight">{record.CustomerName}</h3>
                            <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm ${badgeColor}`}>
                                <span>{badgeIcon}</span> {record.FinalStoreType || 'Thành viên'}
                            </div>

                            {/* FORECAST STATUS */}
                            {forecastData.find(f => String(f.CustomerCode) === String(record.CustomerCode)) && (
                                <div className="mt-3 flex flex-wrap justify-center gap-1.5 px-2">
                                    {(() => {
                                        const f = forecastData.find(f => String(f.CustomerCode) === String(record.CustomerCode));
                                        return (
                                            <>
                                                {f?.ImportLevel && (
                                                    <div className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-700 flex flex-col items-center min-w-[60px]">
                                                        <span className="text-[8px] font-bold text-blue-400 uppercase leading-tight">Imp FC</span>
                                                        <span className="text-[10px] font-black text-blue-700 dark:text-blue-300">
                                                            {f.ImportLevel === '>25TR' && f.ImportValue
                                                                ? formatCompact(f.ImportValue)
                                                                : f.ImportLevel}
                                                        </span>
                                                    </div>
                                                )}
                                                {f?.LocalLevel && (
                                                    <div className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-900/40 border border-green-100 dark:border-green-700 flex flex-col items-center min-w-[60px]">
                                                        <span className="text-[8px] font-bold text-green-400 uppercase leading-tight">Loc FC</span>
                                                        <span className="text-[10px] font-black text-green-700 dark:text-green-300">
                                                            {f.LocalLevel === '>25TR' && f.LocalValue
                                                                ? formatCompact(f.LocalValue)
                                                                : f.LocalLevel}
                                                        </span>
                                                    </div>
                                                )}
                                                {f?.ReasonNotAchieved && (
                                                    <div className="w-full mt-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-100 dark:border-orange-800 flex items-start gap-1.5">
                                                            <span className="text-[10px] mt-0.5">⚠️</span>
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-bold text-orange-500 uppercase leading-tight">Giải trình 1: Lý do chính</span>
                                                                <span className="text-[9px] font-black text-slate-700 dark:text-white uppercase">{f.ReasonNotAchieved}</span>
                                                            </div>
                                                        </div>

                                                        {f.Reason2 && (
                                                            <div className="px-3 py-1.5 bg-orange-50/50 dark:bg-orange-900/10 rounded-md border border-orange-100/50 dark:border-orange-800/50 flex items-start gap-1.5 ml-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] font-bold text-orange-400 uppercase leading-tight">Giải trình 2: Chi tiết cụ thể</span>
                                                                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 italic">"{f.Reason2}"</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            <div className="w-full mt-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tiến độ KPI</span>
                                    <span className="text-xs font-black text-slate-800 dark:text-white">{progressPercent.toFixed(1)}%</span>
                                </div>
                                <ProgressBar
                                    actual={totalActual}
                                    target={totalTarget}
                                    colorClass="bg-emerald-500"
                                    showLabel={false}
                                />
                                {todoTotal > 0 ? (
                                    <p className="mt-3 text-[10px] text-center font-medium text-slate-600 dark:text-slate-300">
                                        Mua thêm <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCompact(todoTotal)}</span> để đạt mục tiêu tháng
                                    </p>
                                ) : (
                                    <p className="mt-3 text-[10px] text-center font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                                        <TrophyIcon /> Xuất sắc!
                                    </p>
                                )}
                            </div>

                            <div className="w-full mt-4 flex flex-wrap justify-center gap-2">
                                {record.BuyMed === 'YES' && (
                                    <div className="px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800 flex items-center gap-1 shadow-sm">
                                        <span className="text-xs">💊</span>
                                        <span className="text-[9px] font-black text-pink-700 dark:text-pink-400 uppercase tracking-wide">BuyMed</span>
                                    </div>
                                )}
                                <div className="px-2 py-1 rounded-lg bg-opella-beige/50 dark:bg-opella-green/20 border border-opella-green/30 dark:border-opella-green/50 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-opella-green dark:text-opella-green">CounterTop:</span>
                                    <span className="text-[9px] font-black text-opella-green dark:text-opella-green">{record.CounterTop || 'N/A'}</span>
                                </div>
                                <div className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300">CDU:</span>
                                    <span className="text-[9px] font-black text-purple-800 dark:text-purple-200">{record.CDU || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="w-full mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-800 dark:text-white uppercase flex items-center gap-1 mb-2">
                                    <StarIcon />
                                    <span>Cập nhật trả thưởng</span>
                                </h3>
                                {customerRebates.length > 0 ? (
                                    <div className="space-y-3 text-[10px]">
                                        {(() => {
                                            const importRebates = customerRebates.filter(r => r.Group === 'IMPORT');
                                            const localRebates = customerRebates.filter(r => r.Group === 'LOCAL');
                                            const totalImport = importRebates.reduce((s, r) => s + (r.RemainAmount || 0), 0);
                                            const totalLocal = localRebates.reduce((s, r) => s + (r.RemainAmount || 0), 0);
                                            return (
                                                <>
                                                    <div>
                                                        <p className="font-black text-blue-700 dark:text-blue-300 mb-1">Tổng phí Import: {formatCurrency(totalImport)}</p>
                                                        <ul className="space-y-0.5 pl-2 text-slate-700 dark:text-slate-300">
                                                            {importRebates.map((rb, idx) => (
                                                                <li key={idx}>{rb["PromotionID#program"]} - {formatCurrency(rb.RemainAmount)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-green-700 dark:text-green-300 mb-1">Tổng phí Local: {formatCurrency(totalLocal)}</p>
                                                        <ul className="space-y-0.5 pl-2 text-slate-700 dark:text-slate-300">
                                                            {localRebates.map((rb, idx) => (
                                                                <li key={idx}>{rb["PromotionID#program"]} - {formatCurrency(rb.RemainAmount)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-center py-2 text-slate-400 dark:text-slate-500 italic text-[10px] bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        Không có tin mới.
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-4 text-center w-full">
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                    <div className="scale-75"><IdentificationIcon /></div>
                                    <span className="text-[9px] font-bold uppercase">Thông tin</span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 px-2">{record.Address}, {record.District}</p>
                                {record.CodeBuyMed && (
                                    <p className="text-[9px] font-mono font-bold text-pink-500 mt-0.5">BM: {record.CodeBuyMed}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-opella-beige/50 dark:bg-opella-green/20 flex items-center justify-center text-opella-green dark:text-opella-green"><GiftIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Doanh số tháng hiện tại</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalActual)}</p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400">Imp: {formatCompact(actualImport)} | Loc: {formatCompact(actualLocal)}</p>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('T1')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-opella-green/50 dark:hover:border-opella-green transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-opella-green transition-colors"><ClockIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400"><ClockIcon /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">History Sale</p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400">(DOANH_SO)</p>
                                <div className="mt-1 space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Lịch sử Sale T1: <span className="font-black text-slate-800 dark:text-white">{formatCurrency(totalSaleT1)}</span></p>
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400">Imp: {formatCompact(actualImportT1)} | Loc: {formatCompact(actualLocalT1)}</p>
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1">Lịch sử Sale T2: <span className="font-black text-slate-800 dark:text-white">{formatCurrency(totalSaleT2)}</span></p>
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400">Imp: {formatCompact(actualImportT2)} | Loc: {formatCompact(actualLocalT2)}</p>
                                </div>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Products')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-opella-green/50 dark:hover:border-opella-green transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-indigo-500 transition-colors"><CubeIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-opella-beige/50 dark:bg-opella-green/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><CubeIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">SP Đã Mua ({uniqueProductStats.length})</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalHistoryValue)}</p>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('ĐiềuKiệnTB')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-pink-300 dark:hover:border-pink-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-pink-500 transition-colors"><FaceSmileIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0"><FaceSmileIcon /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">Điều kiện TB</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[80px]" title={record.Check}>{record.Check || 'N/A'}</p>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Import')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-blue-500 transition-colors"><DocumentTextIcon /></div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-blue-500 uppercase group-hover:underline">Import</p>
                                <span className="text-[9px] font-bold text-slate-400">{Math.round(getRawPercent(actualImport, targetImport))}%</span>
                            </div>
                            <ProgressBar actual={actualImport} target={targetImport} colorClass="bg-blue-500" showLabel={false} />
                            <div className="flex justify-between mt-1 text-[10px]">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actualImport)}</span>
                                <span className="text-slate-400">/ {formatCompact(targetImport)}</span>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Local')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center cursor-pointer hover:border-green-300 dark:hover:border-green-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-green-500 transition-colors"><DocumentTextIcon /></div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-green-500 uppercase group-hover:underline">Local</p>
                                <span className="text-[9px] font-bold text-slate-400">{Math.round(getRawPercent(actualLocal, targetLocal))}%</span>
                            </div>
                            <ProgressBar actual={actualLocal} target={targetLocal} colorClass="bg-green-500" showLabel={false} />
                            <div className="flex justify-between mt-1 text-[10px]">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actualLocal)}</span>
                                <span className="text-slate-400">/ {formatCompact(targetLocal)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center gap-2">
                                    <ClockIcon /> Lịch sử mua hàng
                                </h4>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mr-1">Kênh:</span>
                                        {(['all', 'gg', 'bm'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setHistoryChannelFilter(f)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                    historyChannelFilter === f
                                                        ? f === 'all' ? 'bg-slate-700 text-white dark:bg-slate-600' : f === 'gg' ? 'bg-cyan-600 text-white dark:bg-cyan-500' : 'bg-pink-600 text-white dark:bg-pink-500'
                                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {f === 'all' ? 'Tất cả' : f}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-slate-300 dark:text-slate-600">+</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mr-1">Loại:</span>
                                        {(['all', 'import', 'local'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setHistoryTypeFilter(f)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                    historyTypeFilter === f
                                                        ? f === 'all' ? 'bg-slate-700 text-white dark:bg-slate-600' : f === 'import' ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-green-600 text-white dark:bg-green-500'
                                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {f === 'all' ? 'Tất cả' : f.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-slate-300 dark:text-slate-600">+</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mr-1">Tháng:</span>
                                        <select
                                            value={historyMonthFilter}
                                            onChange={e => setHistoryMonthFilter(e.target.value)}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                        >
                                            <option value="all">Tất cả</option>
                                            {uniqueMonths.map(key => (
                                                <option key={key} value={key}>{formatMonthLabel(key)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar bg-white dark:bg-slate-800">
                                    {filteredHistory.length > 0 ? (
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-2 py-2">Loại</th>
                                                    <th className="px-2 py-2">Ngày</th>
                                                    <th className="px-2 py-2">Sản Phẩm</th>
                                                    <th className="px-2 py-2 text-center">SL</th>
                                                    <th className="px-2 py-2 text-right">Doanh Số</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                                <tr className="bg-slate-100 dark:bg-slate-700/50 font-black text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600">
                                                    <td colSpan={4} className="px-2 py-3 text-right">Tổng doanh số:</td>
                                                    <td className="px-2 py-3 text-right">{formatCurrency(filteredHistoryTotal)}</td>
                                                </tr>
                                                {filteredHistory.map((item, i) => {
                                                    const isImport = (item.Group || item.Team || '').toLowerCase().includes('import');
                                                    const isBuyMed = (record.CodeBuyMed && String(item.CustomerID).trim() === String(record.CodeBuyMed).trim()) || (item.Note && item.Note.toLowerCase().includes('buymed'));
                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                            <td className="px-2 py-2">
                                                                <span className={`px-1.5 py-0.5 rounded-md font-black uppercase text-[8px] ${isImport ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                                                                    {isImport ? 'IMP' : 'LOC'}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{formatDateVal(item.InvoiceDate)}</td>
                                                            <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-200">
                                                                <div className="flex flex-col">
                                                                    <span className="line-clamp-1" title={item.Product}>{item.Product}</span>
                                                                    {isBuyMed && (
                                                                        <span className="text-[9px] text-pink-500 dark:text-pink-400 font-bold">
                                                                            (BM)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 text-center font-bold text-slate-800 dark:text-white">{item.Qty}</td>
                                                            <td className="px-2 py-2 text-right font-bold text-slate-600 dark:text-slate-400">{formatCurrency(item.Value)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs italic">
                                            Chưa có dữ liệu giao dịch
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 border border-slate-200 dark:border-slate-700 relative flex flex-col max-h-[85vh]">
                        <button onClick={() => setActiveDetailModal(null)} className="absolute top-3 right-3 p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 transition-colors z-10">✕</button>

                        {activeDetailModal === 'T1' ? (
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="mb-4 text-center">
                                    <h3 className="text-lg font-black uppercase text-opella-green dark:text-opella-green">Lịch sử Sale T1</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chi tiết thưởng doanh số tháng trước</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200 dark:border-blue-800">
                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Import T1</span>
                                            <span className="text-base font-black text-blue-800 dark:text-blue-200">{formatCurrency(actualImportT1)}</span>
                                        </div>
                                        <div className="mt-1">
                                            <div className="flex justify-between items-center text-xs mb-1.5">
                                                <span className="text-slate-500 dark:text-slate-400">Mức thưởng:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{importTierT1 ? `Lv${importTierT1.level} (${importTierT1.percent}%)` : 'Chưa đạt'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-blue-100 dark:border-slate-600">
                                                <span className="font-bold text-blue-700 dark:text-blue-400 uppercase text-xs">Thưởng:</span>
                                                <span className="font-black text-red-500 dark:text-red-400 text-base">{formatCurrency(importBonusT1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-green-200 dark:border-green-800">
                                            <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Local T1</span>
                                            <span className="text-base font-black text-green-800 dark:text-green-200">{formatCurrency(actualLocalT1)}</span>
                                        </div>
                                        <div className="mt-1">
                                            <div className="flex justify-between items-center text-xs mb-1.5">
                                                <span className="text-slate-500 dark:text-slate-400">Mức thưởng:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{localTierT1 ? `Lv${localTierT1.level} (${localTierT1.percent}%)` : 'Chưa đạt'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-green-100 dark:border-slate-600">
                                                <span className="font-bold text-green-700 dark:text-green-400 uppercase text-xs">Thưởng:</span>
                                                <span className="font-black text-red-500 dark:text-red-400 text-base">{formatCurrency(localBonusT1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeDetailModal === 'Products' ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="mb-4 text-center flex-shrink-0">
                                    <h3 className="text-lg font-black uppercase text-indigo-600 dark:text-indigo-400">Thống Kê Sản Phẩm</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Xếp hạng theo tổng doanh số giảm dần</p>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                        <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10 shadow-sm text-slate-500 dark:text-slate-300 font-bold uppercase">
                                            <tr>
                                                <th className="px-2 py-2">Tên SP</th>
                                                <th className="px-2 py-2 text-center w-10">SL</th>
                                                <th className="px-2 py-2 text-right">Tổng DS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {uniqueProductStats.length > 0 ? (
                                                uniqueProductStats.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                        <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200 align-top">{item.name}</td>
                                                        <td className="px-2 py-1.5 text-center font-bold text-slate-800 dark:text-white align-top">{item.qty}</td>
                                                        <td className="px-2 py-1.5 text-right font-black text-indigo-600 dark:text-indigo-400 align-top">{formatCurrency(item.val)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={3} className="text-center py-4 text-slate-400 italic">Chưa có dữ liệu</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-2 text-right text-xs font-bold text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    Tổng cộng: <span className="text-base text-opella-green dark:text-opella-green font-black">{formatCurrency(totalHistoryValue)}</span>
                                </div>
                            </div>
                        ) : activeDetailModal === 'ĐiềuKiệnTB' ? (
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="mb-4 text-center">
                                    <h3 className="text-lg font-black uppercase text-pink-600 dark:text-pink-400">Điều kiện trưng bày</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Chi tiết điều kiện & kết quả</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">FinalStoreType</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">{record.FinalStoreType || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">DieuKienSale</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">{record.DieuKienSale != null ? formatCurrency(record.DieuKienSale) : 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sale</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">{record.Sale != null ? formatCurrency(record.Sale) : 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Todo</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">{record.Todo != null ? formatCurrency(record.Todo) : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="mb-4 text-center">
                                    <h3 className={`text-lg font-black uppercase ${activeDetailModal === 'Import' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>Chi Tiết {activeDetailModal}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Doanh số tháng hiện tại: <span className="text-slate-800 dark:text-white">{formatCurrency(activeDetailModal === 'Import' ? actualImport : actualLocal)}</span></p>
                                    {(() => {
                                        const currentActual = activeDetailModal === 'Import' ? actualImport : actualLocal;
                                        const currentTier = getRebateLevel(currentActual);
                                        const currentReward = currentTier ? currentActual * (currentTier.percent / 100) : 0;
                                        return (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                                                Tiền thưởng hiện tại: <span className="text-red-500 dark:text-red-400">{formatCurrency(currentReward)}</span>
                                                {currentTier && <span className="text-xs ml-1 text-slate-400 dark:text-slate-500 font-medium">({currentTier.percent}%)</span>}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <LevelTodoTable actual={activeDetailModal === 'Import' ? actualImport : actualLocal} />
                            </div>
                        )}
                        <div className="mt-5 text-center flex-shrink-0">
                            <button onClick={() => setActiveDetailModal(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors text-sm">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Forecast Section */}
            {isCoverQ1(record) && (
                <div className="mt-8 mx-4 p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <h3 className="text-lg font-black uppercase text-opella-green dark:text-opella-green mb-6 flex items-center gap-2">
                        <TrendingUpIcon />
                        <span>Dự Báo Sale T3</span>
                    </h3>

                    <ForecastForm
                        selectedCustomer={record}
                        forecastData={forecastData}
                        currentEmployee={currentEmployee}
                        forecastedCount={forecastStats.forecastedCount}
                        totalCount={forecastStats.totalCount}
                        onUpdateForecast={onUpdateForecast}
                    />
                </div>
            )}
        </div>
    );
};

export default CustomerDetail;
