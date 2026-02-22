
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { SalesRecord, Rebate, PurchaseHistoryItem, ForecastItem, Employee } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
    ArrowLeftIcon, UserGroupIcon, IdentificationIcon, ClockIcon,
    CartIcon, TrophyIcon, SearchIcon, DocumentTextIcon, StarIcon, GiftIcon, CubeIcon, ClipboardDocumentListIcon, FaceSmileIcon
} from '../icons';
import {
    getRawPercent, formatDateVal, formatCompact, getRebateLevel
} from './DashboardUtils';
import { ProgressBar } from './ProgressBars';
import { LevelTodoTable } from './LevelTodoTable';
import ForecastForm from './ForecastForm';
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

const CustomerDetail: React.FC<CustomerDetailProps> = ({
    record, allRecords, rebates, purchaseHistory, onBack, onGoToOrder, onSwitchCustomer,
    currentEmployee, forecastData, onUpdateForecast
}) => {
    const [activeDetailModal, setActiveDetailModal] = useState<'Import' | 'Local' | 'T1' | 'Products' | null>(null);
    const [showQuickSearch, setShowQuickSearch] = useState(false);
    const [quickSearchTerm, setQuickSearchTerm] = useState('');
    const quickSearchInputRef = useRef<HTMLInputElement>(null);

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

    const uniqueOrderDates = new Set(allHistory.map(h => String(h.InvoiceDate))).size;

    const actualImport = Number(record.ActualImport) || 0;
    const targetImport = Number(record.TargetImport) || 0;
    const actualLocal = Number(record.ActualLocal) || 0;
    const targetLocal = Number(record.TargetLocal) || 0;
    const totalActual = actualImport + actualLocal;
    const totalTarget = targetImport + targetLocal;
    const progressPercent = getRawPercent(totalActual, totalTarget);
    const todoTotal = Number(record.Todo) || 0;

    // T1 Data
    const actualImportT1 = Number(record.ActualImportT1 || record["SALE IMPORT T1"] || record.SaleImportTotalT1) || 0;
    const actualLocalT1 = Number(record.ActualLocalT1 || record["SALE LOCAL T1"] || record.SaleLocalTotalT1) || 0;

    const importTierT1 = getRebateLevel(actualImportT1);
    const importBonusT1 = importTierT1 ? actualImportT1 * (importTierT1.percent / 100) : 0;
    const localTierT1 = getRebateLevel(actualLocalT1);
    const localBonusT1 = localTierT1 ? actualLocalT1 * (localTierT1.percent / 100) : 0;

    const isGold = (record.FinalStoreType ?? '').toLowerCase().includes('gold');
    const isSilver = (record.FinalStoreType ?? '').toLowerCase().includes('silver');
    const badgeColor = isGold ? 'bg-yellow-400 text-yellow-900' : isSilver ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-900';
    const badgeIcon = isGold ? '👑' : isSilver ? '🛡️' : '🥉';

    // CALCULATE CHANNEL SHARE (GIGAMED vs BM) - SPLIT BY IMPORT/LOCAL
    const totalGiga = Number(record.GIGAMED) || 0;
    const totalBm = Number(record.BM) || 0;

    // Import values
    const impGiga = Number(record.GIGAMEDImport || record.ActualImportGiga) || 0;
    const impBm = Number(record.BMImport || record.ActualImportBuyMed) || 0;
    const totalImpChannel = impGiga + impBm;

    const impGigaPct = totalImpChannel > 0 ? (impGiga / totalImpChannel) * 100 : 0;
    const impBmPct = totalImpChannel > 0 ? (impBm / totalImpChannel) * 100 : 0;

    // Local values = Total - Import
    const locGiga = Math.max(0, totalGiga - impGiga);
    const locBm = Math.max(0, totalBm - impBm);
    const totalLocChannel = locGiga + locBm;

    const locGigaPct = totalLocChannel > 0 ? (locGiga / totalLocChannel) * 100 : 0;
    const locBmPct = totalLocChannel > 0 ? (locBm / totalLocChannel) * 100 : 0;

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
                                className="w-full py-2 px-4 rounded-full border-2 border-sky-500 bg-white dark:bg-slate-700 dark:text-white dark:border-sky-400 outline-none text-sm font-bold shadow-sm"
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
                                            className="px-4 py-3 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
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
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    {record.CustomerName}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{record.CustomerCode}</p>
                            </div>
                            <button className="p-2 text-slate-400 hover:text-sky-500 dark:text-slate-500 dark:hover:text-sky-400 transition-colors">
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
                                <div className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CounterTop:</span>
                                    <span className="text-[9px] font-black text-indigo-800 dark:text-indigo-200">{record.CounterTop || 'N/A'}</span>
                                </div>
                                <div className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300">CDU:</span>
                                    <span className="text-[9px] font-black text-purple-800 dark:text-purple-200">{record.CDU || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="w-full mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-800 dark:text-white uppercase flex items-center gap-1 mb-2">
                                    <StarIcon />
                                    <span>Cập nhật trả thường ({customerRebates.length})</span>
                                </h3>
                                {customerRebates.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x custom-scrollbar">
                                        {customerRebates.map((rb, idx) => (
                                            <div key={idx} className="snap-center flex-shrink-0 w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                                <div className="flex items-start justify-between mb-1 pl-2">
                                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">Ưu đãi</span>
                                                    {rb.Group === 'IMPORT' ? <span className="text-[9px] text-blue-500 font-black">IMP</span> : <span className="text-[9px] text-green-500 font-black">LOC</span>}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 line-clamp-2 min-h-[2.4em] mb-1 pl-2" title={rb["PromotionID#program"]}>
                                                    {rb["PromotionID#program"]}
                                                </p>
                                                <div className="flex justify-between items-end border-t border-slate-100 dark:border-slate-700 pt-1 pl-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-slate-400">Còn lại</span>
                                                        <span className="text-xs font-black text-red-500">-{formatCompact(rb.RemainAmount)}</span>
                                                    </div>
                                                    <span className="text-[8px] text-slate-400 italic">Hạn: {formatDateVal(rb.EndDate || rb.Endate)}</span>
                                                </div>
                                            </div>
                                        ))}
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
                        <div onClick={() => setActiveDetailModal('T1')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-sky-300 dark:hover:border-sky-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-sky-500 transition-colors"><ClockIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400"><GiftIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">Doanh số tháng</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalActual)}</p>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Products')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-indigo-500 transition-colors"><CubeIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><CubeIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">SP Đã Mua ({uniqueProductStats.length})</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalHistoryValue)}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full relative group">
                            <div className="absolute top-2 right-2 text-slate-300"><ClipboardDocumentListIcon /></div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0"><ClipboardDocumentListIcon /></div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Kênh Bán Hàng</p>
                                    <p className="text-[10px] font-bold text-slate-800 dark:text-white">{uniqueOrderDates} đơn</p>
                                </div>
                            </div>

                            {/* IMPORT CHANNEL */}
                            <div className="mb-3">
                                <p className="text-[8px] font-black text-blue-500 uppercase mb-1 tracking-wider border-b border-blue-50 dark:border-blue-900/30 pb-0.5">Import</p>
                                <div className="space-y-1.5">
                                    <div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="font-bold text-cyan-600">GIGA</span>
                                            <span className="text-slate-500 font-medium">{impGigaPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCompact(impGiga)})</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1">
                                            <div className="bg-cyan-500 h-1 rounded-full" style={{ width: `${impGigaPct}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="font-bold text-pink-600">BM</span>
                                            <span className="text-slate-500 font-medium">{impBmPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCompact(impBm)})</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1">
                                            <div className="bg-pink-500 h-1 rounded-full" style={{ width: `${impBmPct}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* LOCAL CHANNEL */}
                            <div>
                                <p className="text-[8px] font-black text-green-600 uppercase mb-1 tracking-wider border-b border-green-50 dark:border-green-900/30 pb-0.5">Local</p>
                                <div className="space-y-1.5">
                                    <div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="font-bold text-cyan-600">GIGA</span>
                                            <span className="text-slate-500 font-medium">{locGigaPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCompact(locGiga)})</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1">
                                            <div className="bg-cyan-500 h-1 rounded-full" style={{ width: `${locGigaPct}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="font-bold text-pink-600">BM</span>
                                            <span className="text-slate-500 font-medium">{locBmPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCompact(locBm)})</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1">
                                            <div className="bg-pink-500 h-1 rounded-full" style={{ width: `${locBmPct}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400"><FaceSmileIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Điều kiện TB</p>
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
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center gap-2">
                                <ClockIcon /> Lịch sử mua hàng
                            </h4>
                            <div className="flex gap-2">
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">Import</span>
                                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-bold">Local</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar bg-white dark:bg-slate-800">
                                    {mergedHistory.length > 0 ? (
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
                                                {mergedHistory.map((item, i) => {
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
                                    <h3 className="text-lg font-black uppercase text-sky-600 dark:text-sky-400">Lịch sử Sale T1</h3>
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
                                    Tổng cộng: <span className="text-base text-indigo-700 dark:text-indigo-400 font-black">{formatCurrency(totalHistoryValue)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="mb-4 text-center">
                                    <h3 className={`text-lg font-black uppercase ${activeDetailModal === 'Import' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>Chi Tiết {activeDetailModal}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Doanh số hiện tại: <span className="text-slate-800 dark:text-white">{formatCurrency(activeDetailModal === 'Import' ? actualImport : actualLocal)}</span></p>
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
            {record.CoverQ1 === 'YES' && (
                <div className="mt-8 mx-4 p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <h3 className="text-lg font-black uppercase text-sky-600 dark:text-sky-400 mb-6 flex items-center gap-2">
                        <TrendingUpIcon />
                        <span>Dự Báo Sale T2</span>
                    </h3>

                    <ForecastForm
                        selectedCustomer={record}
                        forecastData={forecastData}
                        currentEmployee={currentEmployee}
                        onUpdateForecast={onUpdateForecast}
                    />
                </div>
            )}
        </div>
    );
};

export default CustomerDetail;
