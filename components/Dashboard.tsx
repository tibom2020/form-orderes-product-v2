
import React, { useState, useMemo, useEffect } from 'react';
import type { DashboardProps, SalesRecord } from '../types';
import {
    PresentationChartLineIcon, UserGroupIcon, SearchIcon, RocketLaunchIcon, DocumentTextIcon
} from './icons';

// Sub-components
import CustomerDetail from './dashboard/CustomerDetail';
import KpiModals from './dashboard/KpiModals';
import CustomerListItem from './dashboard/CustomerListItem';
import { NeonCircularProgress, NeonLinearProgress } from './dashboard/NeonStats';
import {
    ADMIN_CODE, ADMIN_NAME, KPI_TARGETS, REBATE_TIERS, calculatePercent, formatCompact
} from './dashboard/DashboardUtils';

const Dashboard: React.FC<DashboardProps> = ({
    salesData,
    currentEmployee,
    onCustomerSelect,
    rebates,
    purchaseHistory,
    initialCustomerCode,
    forecastData,
    onUpdateForecast,
    onBack
}) => {
    // ... rest of component
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFeeOnly, setShowFeeOnly] = useState(false);
    const [showCoverQ1, setShowCoverQ1] = useState(false);
    const [showBuyMed, setShowBuyMed] = useState(false);
    const [trungBayFilter, setTrungBayFilter] = useState<string>('');

    const [statMode, setStatMode] = useState<'Import' | 'Local'>('Import');
    const [activeLevelFilter, setActiveLevelFilter] = useState<{ rep: string; levelIndex: number; mode: 'Import' | 'Local' } | null>(null);

    // State for switching views
    const [selectedCustomer, setSelectedCustomer] = useState<SalesRecord | null>(null);

    // KPI Detail Modal State
    const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);
    const [kpiViewMode, setKpiViewMode] = useState<'pass' | 'fail'>('pass');
    const [kpiGroupBy, setKpiGroupBy] = useState<'customer' | 'group'>('customer');

    // 1. Authorization Logic & Data Filtering
    const userSalesData = useMemo(() => {
        if (currentEmployee.code === ADMIN_CODE) {
            return salesData;
        }
        return salesData.filter(record => {
            const matchCode = record.StaffCode && String(record.StaffCode).trim() === currentEmployee.code;
            const matchName = record.Rep && record.Rep.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
            return matchCode || matchName;
        });
    }, [salesData, currentEmployee]);

    // Handle external selection (e.g. from Rebate Tab)
    useEffect(() => {
        if (initialCustomerCode) {
            const targetCode = String(initialCustomerCode).trim().toLowerCase();
            const found = userSalesData.find(r =>
                String(r.CustomerCode).trim().toLowerCase() === targetCode
            );
            if (found) {
                setSelectedCustomer(found);
            } else {
                const foundInAll = salesData.find(r =>
                    String(r.CustomerCode).trim().toLowerCase() === targetCode
                );
                if (foundInAll) {
                    setSelectedCustomer(foundInAll);
                }
            }
        }
    }, [initialCustomerCode, userSalesData, salesData]);

    // 2. KPI Calculation Logic
    const kpiStats = useMemo(() => {
        let targets = KPI_TARGETS[currentEmployee.name];
        if (currentEmployee.code === ADMIN_CODE) {
            targets = Object.values(KPI_TARGETS).reduce((acc, curr) => ({
                Total: acc.Total + curr.Total,
                MustWin: acc.MustWin + curr.MustWin,
                Other: acc.Other + curr.Other,
                AO: acc.AO + curr.AO,
                MSO: acc.MSO + curr.MSO,
                Active: acc.Active + curr.Active
            }), { Total: 0, MustWin: 0, Other: 0, AO: 0, MSO: 0, Active: 0 });
        }
        const actual = userSalesData.reduce((acc, r) => {
            const mw = Number(r.MustWin) || 0;
            const other = Number(r.Other) || 0;
            const total = mw + other;
            acc.Total += total;
            acc.MustWin += mw;
            acc.Other += other;
            if (total > 0) acc.Active += 1;
            if (total > 3000000) acc.AO += 1;
            if (total > 9000000) acc.MSO += 1;
            return acc;
        }, { Total: 0, MustWin: 0, Other: 0, Active: 0, AO: 0, MSO: 0 });
        return { targets: targets || { Total: 0, MustWin: 0, Other: 0, Active: 0, AO: 0, MSO: 0 }, actual };
    }, [userSalesData, currentEmployee]);

    const showKPISection = kpiStats.targets.Total > 0;

    // 3. Search & Filter Logic
    const filteredData = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const result = userSalesData.filter(record => {
            const name = record.CustomerName ? String(record.CustomerName).toLowerCase() : '';
            const code = record.CustomerCode ? String(record.CustomerCode).toLowerCase() : '';
            const address = record.Address ? String(record.Address).toLowerCase() : '';
            const type = record.FinalStoreType ? String(record.FinalStoreType).toLowerCase() : '';
            const matchesSearch = name.includes(term) || code.includes(term) || address.includes(term) || type.includes(term);

            let matchesFilters = true;
            if (showFeeOnly) {
                const hasFee = (Number(record.UpdateTienThuongImport) || 0) > 0 || (Number(record.UpdateTienThuongLocal) || 0) > 0;
                if (!hasFee) matchesFilters = false;
            }
            if (showCoverQ1 && record.CoverQ1 !== 'YES') matchesFilters = false;
            if (showBuyMed && record.BuyMed !== 'YES') matchesFilters = false;

            if (trungBayFilter) {
                const fType = record.FinalStoreType ? String(record.FinalStoreType).toLowerCase() : '';
                const dk = record.DieuKienTrungBay ? String(record.DieuKienTrungBay).toLowerCase() : '';
                const keyword = trungBayFilter.toLowerCase();
                if (!fType.includes(keyword) && !dk.includes(keyword)) matchesFilters = false;
            }

            if (activeLevelFilter) {
                const recordRep = record.Rep || 'Chưa phân công';
                if (activeLevelFilter.rep !== 'ALL' && recordRep !== activeLevelFilter.rep) {
                    matchesFilters = false;
                }
                const actual = Number(activeLevelFilter.mode === 'Import' ? record.ActualImport : record.ActualLocal) || 0;
                let highestLevel = -1;
                for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
                    if (actual >= REBATE_TIERS[i].amount) { highestLevel = i; break; }
                }
                if (highestLevel !== activeLevelFilter.levelIndex) matchesFilters = false;
            }
            return matchesSearch && matchesFilters;
        });
        return result.sort((a, b) => {
            const totalA = (Number(a.MustWin) || 0) + (Number(a.Other) || 0);
            const totalB = (Number(b.MustWin) || 0) + (Number(b.Other) || 0);
            return totalB - totalA;
        });
    }, [userSalesData, searchTerm, showFeeOnly, showCoverQ1, showBuyMed, trungBayFilter, activeLevelFilter]);

    // 4. Rebate Level Stats Logic
    const levelStats = useMemo(() => {
        const createEmptyStat = () => ({ counts: new Array(REBATE_TIERS.length).fill(0), sales: new Array(REBATE_TIERS.length).fill(0), totalSales: 0 });
        const stats = { Import: { byRep: {} as Record<string, ReturnType<typeof createEmptyStat>>, total: createEmptyStat() }, Local: { byRep: {} as Record<string, ReturnType<typeof createEmptyStat>>, total: createEmptyStat() } };
        const processRecord = (mode: 'Import' | 'Local', record: SalesRecord) => {
            const rep = record.Rep || 'Chưa phân công';
            if (!stats[mode].byRep[rep]) stats[mode].byRep[rep] = createEmptyStat();
            const actual = Number(mode === 'Import' ? record.ActualImport : record.ActualLocal) || 0;
            stats[mode].byRep[rep].totalSales += actual;
            stats[mode].total.totalSales += actual;
            let foundLevelIndex = -1;
            for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
                if (actual >= REBATE_TIERS[i].amount) { foundLevelIndex = i; break; }
            }
            if (foundLevelIndex !== -1) {
                stats[mode].byRep[rep].counts[foundLevelIndex]++;
                stats[mode].byRep[rep].sales[foundLevelIndex] += actual;
                stats[mode].total.counts[foundLevelIndex]++;
                stats[mode].total.sales[foundLevelIndex] += actual;
            }
        };
        userSalesData.forEach(record => { processRecord('Import', record); processRecord('Local', record); });
        return stats;
    }, [userSalesData]);

    const handleLevelFilterClick = (rep: string, levelIndex: number) => {
        if (activeLevelFilter && activeLevelFilter.rep === rep && activeLevelFilter.levelIndex === levelIndex && activeLevelFilter.mode === statMode) {
            setActiveLevelFilter(null);
        } else {
            setActiveLevelFilter({ rep, levelIndex, mode: statMode });
        }
    };

    // --- RENDER ---
    if (selectedCustomer) {
        return (
            <CustomerDetail
                record={selectedCustomer}
                allRecords={userSalesData}
                rebates={rebates}
                purchaseHistory={purchaseHistory}
                onBack={() => {
                    if (initialCustomerCode && onBack) {
                        onBack();
                    } else {
                        setSelectedCustomer(null);
                    }
                }}
                onGoToOrder={onCustomerSelect}
                onSwitchCustomer={setSelectedCustomer}
                currentEmployee={currentEmployee}
                forecastData={forecastData}
                onUpdateForecast={onUpdateForecast}
            />
        );
    }

    return (
        <div className="pb-10 bg-slate-50 dark:bg-slate-900 min-h-full transition-colors duration-200">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <PresentationChartLineIcon />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase">Dashboard KPI</h2>
                </div>
                <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 font-bold shadow-sm">
                    NV: {currentEmployee.name}
                </span>
            </div>

            <KpiModals
                activeKpiModal={activeKpiModal}
                userSalesData={userSalesData}
                kpiViewMode={kpiViewMode}
                kpiGroupBy={kpiGroupBy}
                onClose={() => { setActiveKpiModal(null); setKpiViewMode('pass'); setKpiGroupBy('customer'); }}
                onSetViewMode={setKpiViewMode}
                onSetGroupBy={setKpiGroupBy}
                onCustomerSelectFromModal={(record) => { setSelectedCustomer(record); setActiveKpiModal(null); }}
            />

            {/* NEON KPI TRACKING SECTION */}
            {showKPISection && (
                <div className="mb-6 px-2">
                    <div className="bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                        <h3 className="text-sm font-black text-white uppercase mb-6 flex items-center gap-2 relative z-10">
                            <RocketLaunchIcon /> Theo dõi chỉ tiêu Q1
                        </h3>

                        <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                            <NeonCircularProgress
                                label="TOTAL SALES"
                                percent={calculatePercent(kpiStats.actual.Total, kpiStats.targets.Total)}
                                value={formatCompact(kpiStats.actual.Total)}
                                unit={`/ ${formatCompact(kpiStats.targets.Total)}`}
                                color="cyan"
                                onClick={() => setActiveKpiModal('Total')}
                            />
                            <NeonCircularProgress
                                label="MUST WIN"
                                percent={calculatePercent(kpiStats.actual.MustWin, kpiStats.targets.MustWin)}
                                value={formatCompact(kpiStats.actual.MustWin)}
                                unit={`/ ${formatCompact(kpiStats.targets.MustWin)}`}
                                color="pink"
                                onClick={() => setActiveKpiModal('MustWin')}
                            />
                            <NeonCircularProgress
                                label="OTHER"
                                percent={calculatePercent(kpiStats.actual.Other, kpiStats.targets.Other)}
                                value={formatCompact(kpiStats.actual.Other)}
                                unit={`/ ${formatCompact(kpiStats.targets.Other)}`}
                                color="yellow"
                                onClick={() => setActiveKpiModal('Other')}
                            />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <NeonLinearProgress
                                label="ACTIVE (>0)"
                                percent={calculatePercent(kpiStats.actual.Active, kpiStats.targets.Active)}
                                value={kpiStats.actual.Active.toString()}
                                target={kpiStats.targets.Active.toString()}
                                color="cyan"
                                onClick={() => setActiveKpiModal('Active')}
                            />
                            <NeonLinearProgress
                                label="AO (ACTIVE OUTLET >3TR)"
                                percent={calculatePercent(kpiStats.actual.AO, kpiStats.targets.AO)}
                                value={kpiStats.actual.AO.toString()}
                                target={kpiStats.targets.AO.toString()}
                                color="pink"
                                onClick={() => setActiveKpiModal('AO')}
                            />
                            <NeonLinearProgress
                                label="MSO (MUST STOCK >9TR)"
                                percent={calculatePercent(kpiStats.actual.MSO, kpiStats.targets.MSO)}
                                value={kpiStats.actual.MSO.toString()}
                                target={kpiStats.targets.MSO.toString()}
                                color="yellow"
                                onClick={() => setActiveKpiModal('MSO')}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Level Rebate Statistics Table */}
            <div className="mb-6 px-2">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center gap-2">
                            <DocumentTextIcon />
                            <span>Thống kê KH đạt Level Rebate</span>
                        </h3>
                        <div className="flex bg-slate-200 dark:bg-slate-700 rounded p-0.5">
                            <button
                                onClick={() => { setStatMode('Import'); setActiveLevelFilter(null); }}
                                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${statMode === 'Import' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                Import
                            </button>
                            <button
                                onClick={() => { setStatMode('Local'); setActiveLevelFilter(null); }}
                                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${statMode === 'Local' ? 'bg-white dark:bg-slate-600 text-green-600 dark:text-green-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                Local
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead className={statMode === 'Import' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'}>
                                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                    <th className="px-2 py-2 w-[20%]">Rep</th>
                                    {REBATE_TIERS.map((tier) => (
                                        <th key={tier.level} className="px-1 py-2 text-center min-w-[50px]">
                                            Lv{tier.level}<br />
                                            <span className="text-[9px] opacity-70">-{tier.percent}%</span>
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-right font-black">Tổng DS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {Object.keys(levelStats[statMode].byRep).map((rep) => (
                                    <React.Fragment key={rep}>
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800">
                                            <td className="px-2 py-1.5 border-r border-slate-100 dark:border-slate-700 font-bold">{rep}</td>
                                            {levelStats[statMode].byRep[rep].counts.map((count, idx) => {
                                                const isSelected = activeLevelFilter && activeLevelFilter.rep === rep && activeLevelFilter.levelIndex === idx && activeLevelFilter.mode === statMode;
                                                return (
                                                    <td
                                                        key={idx}
                                                        onClick={() => count > 0 && handleLevelFilterClick(rep, idx)}
                                                        className={`px-1 py-1.5 text-center font-bold transition-all ${count > 0 ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 text-sky-600 dark:text-sky-400' : 'text-slate-300 dark:text-slate-600'} ${isSelected ? 'bg-yellow-100 dark:bg-yellow-900 ring-2 ring-inset ring-yellow-400' : ''}`}
                                                    >
                                                        {count > 0 ? count : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-2 py-1.5 text-right font-black text-[11px] text-slate-800 dark:text-white">
                                                {formatCompact(levelStats[statMode].byRep[rep].totalSales)}
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-red-500 dark:text-red-400 border-b border-slate-200 dark:border-slate-700">
                                            <td className="px-2 py-1 border-r border-slate-100 dark:border-slate-700 text-[12px] italic text-right pr-2">Sale</td>
                                            {levelStats[statMode].byRep[rep].sales.map((sales, idx) => (
                                                <td key={idx} className="px-1 py-1 text-center text-[12px]">
                                                    {sales > 0 ? formatCompact(sales) : ''}
                                                </td>
                                            ))}
                                            <td></td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                                {Object.keys(levelStats[statMode].byRep).length === 0 && (
                                    <tr><td colSpan={8} className="text-center py-4 text-slate-400 italic">Không có dữ liệu</td></tr>
                                )}

                                {Object.keys(levelStats[statMode].byRep).length > 0 && (
                                    <React.Fragment>
                                        <tr className="bg-slate-100 dark:bg-slate-700 border-t-2 border-slate-300 dark:border-slate-500 font-bold text-slate-800 dark:text-white">
                                            <td className="px-2 py-2 border-r border-slate-300 dark:border-slate-600 font-black uppercase text-sky-700 dark:text-sky-400">{ADMIN_NAME} (TỔNG)</td>
                                            {levelStats[statMode].total.counts.map((count, idx) => {
                                                const isSelected = activeLevelFilter && activeLevelFilter.rep === 'ALL' && activeLevelFilter.levelIndex === idx && activeLevelFilter.mode === statMode;
                                                return (
                                                    <td
                                                        key={idx}
                                                        onClick={() => count > 0 && handleLevelFilterClick('ALL', idx)}
                                                        className={`px-1 py-2 text-center font-black transition-all ${count > 0 ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 text-sky-700 dark:text-sky-400' : ''} ${isSelected ? 'bg-yellow-100 dark:bg-yellow-900 ring-2 ring-inset ring-yellow-400' : ''}`}
                                                    >
                                                        {count > 0 ? count : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-2 py-2 text-right font-black text-sky-700 dark:text-sky-400">
                                                {formatCompact(levelStats[statMode].total.totalSales)}
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-slate-700 text-red-600 dark:text-red-400 font-bold border-b-2 border-slate-300 dark:border-slate-500">
                                            <td className="px-2 py-1 border-r border-slate-300 dark:border-slate-600 text-[12px] italic text-right pr-2">Tổng DS (đạt Lv)</td>
                                            {levelStats[statMode].total.sales.map((sales, idx) => (
                                                <td key={idx} className="px-1 py-1 text-center text-[12px]">
                                                    {sales > 0 ? formatCompact(sales) : ''}
                                                </td>
                                            ))}
                                            <td></td>
                                        </tr>
                                    </React.Fragment>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Customer List Section */}
            <div className="bg-white dark:bg-slate-800 rounded-t-xl border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 rounded-t-xl">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase flex items-center gap-2">
                            <UserGroupIcon />
                            <span>Danh Sách KH ({filteredData.length})</span>
                        </h3>
                        {activeLevelFilter && (
                            <button
                                onClick={() => setActiveLevelFilter(null)}
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200 flex items-center gap-1 font-bold"
                            >
                                <span>✕ Bỏ lọc: {activeLevelFilter.rep === 'ALL' ? 'Tất cả' : activeLevelFilter.rep} - Lv{REBATE_TIERS[activeLevelFilter.levelIndex].level}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tìm tên, mã, địa chỉ..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(inputValue)}
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white dark:bg-slate-700 dark:text-white shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => setSearchTerm(inputValue)}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                            >
                                <SearchIcon />
                                <span>Tìm Kiếm</span>
                            </button>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
                            <button
                                onClick={() => setShowFeeOnly(!showFeeOnly)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors flex-shrink-0 flex items-center gap-1 ${showFeeOnly
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700'
                                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                <span>💰</span>
                                <span>Có phí thưởng</span>
                            </button>

                            <button
                                onClick={() => setShowCoverQ1(!showCoverQ1)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors flex-shrink-0 flex items-center gap-1 ${showCoverQ1
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                <span>🛡️</span>
                                <span>Cover Q1</span>
                            </button>

                            <button
                                onClick={() => setShowBuyMed(!showBuyMed)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors flex-shrink-0 flex items-center gap-1 ${showBuyMed
                                    ? 'bg-pink-500 text-white border-pink-500'
                                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                <span>💊</span>
                                <span>Buy Med</span>
                            </button>

                            <div className="relative flex-shrink-0">
                                <select
                                    value={trungBayFilter}
                                    onChange={(e) => setTrungBayFilter(e.target.value)}
                                    className={`appearance-none py-1.5 pl-3 pr-8 rounded border text-[10px] font-bold outline-none transition-colors cursor-pointer ${trungBayFilter !== ''
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <option value="">🏷️ KH TRƯNG BÀY</option>
                                    <option value="Gold">👑 Gold</option>
                                    <option value="Silver">🛡️ Silver</option>
                                    <option value="Bronze">🥉 Bronze</option>
                                    <option value="Dummy">📦 DummyBox</option>
                                </select>
                                <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] ${trungBayFilter !== '' ? 'text-white' : 'text-slate-400'}`}>
                                    ▼
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredData.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs italic">
                            Không tìm thấy dữ liệu phù hợp.
                        </div>
                    ) : (
                        filteredData.map((record, idx) => (
                            <CustomerListItem
                                key={`${record.CustomerCode}-${idx}`}
                                record={record}
                                onViewDetail={setSelectedCustomer}
                                onGoToOrder={onCustomerSelect}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;