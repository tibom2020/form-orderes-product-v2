import React, { useState, useMemo } from 'react';
import type { SalesRecord, Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ADMIN_CODE } from '../constants';
import { SearchIcon, CartIcon, ChartBarIcon } from './icons';

type TypeFilter = 'gold' | 'silver' | 'bronze' | 'total';
type StatusFilter = 'dat' | 'rot';

interface SaleKhPsTabProps {
    salesRecords: SalesRecord[];
    currentEmployee: Employee;
    onCustomerSelect: (code: string) => void;
}

const GOLD_MIN = 40_000_000;
const SILVER_MIN = 20_000_000;
const BRONZE_MIN = 7_000_000;

const getSaleQ1 = (r: SalesRecord) => (Number(r.MustWin) || 0) + (Number(r.Other) || 0);

const getStoreType = (r: SalesRecord): 'gold' | 'silver' | 'bronze' | null => {
    const ft = (r.FinalStoreType || '').toLowerCase();
    if (ft.includes('gold')) return 'gold';
    if (ft.includes('silver')) return 'silver';
    if (ft.includes('bronze')) return 'bronze';
    return null;
};

const getMinForType = (type: 'gold' | 'silver' | 'bronze'): number => {
    if (type === 'gold') return GOLD_MIN;
    if (type === 'silver') return SILVER_MIN;
    return BRONZE_MIN;
};

const isDat = (r: SalesRecord): boolean => {
    const type = getStoreType(r);
    const saleQ1 = getSaleQ1(r);
    if (!type) return saleQ1 >= BRONZE_MIN; // default Bronze threshold
    return saleQ1 >= getMinForType(type);
};

const formatPhí = (val: unknown): string => {
    if (val == null || val === '') return '';
    const n = typeof val === 'number' ? val : Number(val);
    return isNaN(n) ? String(val) : formatCurrency(n);
};

const SaleKhPsTab: React.FC<SaleKhPsTabProps> = ({ salesRecords, currentEmployee, onCustomerSelect }) => {
    const showRep = currentEmployee.code === ADMIN_CODE;
    const [searchTerm, setSearchTerm] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('total');
    const [statusFilter, setStatusFilter] = useState<StatusFilter | 'all'>('all');

    const psRecords = useMemo(() => {
        return salesRecords.filter(r => {
            const ft = (r.FinalStoreType || '').trim();
            if (!ft) return false;
            if (ft.toLowerCase().includes('dummy')) return false;
            const codeMatch = r.StaffCode && String(r.StaffCode).trim() === currentEmployee.code;
            const repMatch = r.Rep && r.Rep.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
            if (currentEmployee.code === ADMIN_CODE) return true;
            return codeMatch || repMatch;
        });
    }, [salesRecords, currentEmployee]);

    const filteredList = useMemo(() => {
        let list = [...psRecords];

        if (typeFilter !== 'total') {
            list = list.filter(r => getStoreType(r) === typeFilter);
        }

        if (statusFilter !== 'all') {
            list = list.filter(r => (statusFilter === 'dat' ? isDat(r) : !isDat(r)));
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter(r =>
                (r.CustomerName || '').toLowerCase().includes(term) ||
                String(r.CustomerCode || '').includes(term) ||
                (r.District || '').toLowerCase().includes(term) ||
                (r.Rep || '').toLowerCase().includes(term)
            );
        }

        return list.sort((a, b) => {
            const aDat = isDat(a);
            const bDat = isDat(b);
            if (!aDat && bDat) return -1;
            if (aDat && !bDat) return 1;
            return getSaleQ1(b) - getSaleQ1(a);
        });
    }, [psRecords, typeFilter, statusFilter, searchTerm]);

    type TypeStats = { total: number; dat: number; rot: number };
    type RepStats = Record<string, TypeStats>;

    const reportByType = useMemo(() => {
        const byType: Record<'gold' | 'silver' | 'bronze', RepStats> = {
            gold: {},
            silver: {},
            bronze: {}
        };
        psRecords.forEach(r => {
            const type = getStoreType(r);
            if (!type) return;
            const repName = r.Rep ? r.Rep.trim() : 'Chưa phân công';
            if (!byType[type][repName]) byType[type][repName] = { total: 0, dat: 0, rot: 0 };
            byType[type][repName].total += 1;
            if (isDat(r)) byType[type][repName].dat += 1;
            else byType[type][repName].rot += 1;
        });
        return byType;
    }, [psRecords]);

    const reportTotalsByType = useMemo(() => {
        const totals: Record<'gold' | 'silver' | 'bronze', TypeStats> = {
            gold: { total: 0, dat: 0, rot: 0 },
            silver: { total: 0, dat: 0, rot: 0 },
            bronze: { total: 0, dat: 0, rot: 0 }
        };
        (['gold', 'silver', 'bronze'] as const).forEach(type => {
            Object.values(reportByType[type]).forEach(s => {
                totals[type].total += s.total;
                totals[type].dat += s.dat;
                totals[type].rot += s.rot;
            });
        });
        return totals;
    }, [reportByType]);

    const reportTotalStats = useMemo(() => {
        return (['gold', 'silver', 'bronze'] as const).reduce(
            (acc, type) => ({
                total: acc.total + reportTotalsByType[type].total,
                dat: acc.dat + reportTotalsByType[type].dat,
                rot: acc.rot + reportTotalsByType[type].rot
            }),
            { total: 0, dat: 0, rot: 0 }
        );
    }, [reportTotalsByType]);

    const reportDataByType = useMemo(() => {
        return (['gold', 'silver', 'bronze'] as const).map(type => ({
            type,
            rows: Object.entries(reportByType[type])
                .map(([rep, data]) => ({ rep, ...data }))
                .sort((a, b) => b.total - a.total)
        }));
    }, [reportByType]);

    const currentDate = new Date().toLocaleDateString('vi-VN');

    const renderReportModal = () => {
        if (!showReport) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
                <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 my-auto shrink-0">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                <ChartBarIcon />
                                <span>Báo Cáo Sale KH PS</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                                Ngày hệ thống: <span className="text-opella-green dark:text-opella-green">{currentDate}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setShowReport(false)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(['gold', 'silver', 'bronze'] as const).map(type => {
                                const t = reportTotalsByType[type];
                                const label = type === 'gold' ? 'Gold' : type === 'silver' ? 'Silver' : 'Bronze';
                                const color = type === 'gold' ? 'amber' : type === 'silver' ? 'slate' : 'orange';
                                return (
                                    <div key={type} className={`p-3 rounded-xl border ${color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' : color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' : 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'}`}>
                                        <p className={`text-[10px] font-bold uppercase ${color === 'amber' ? 'text-amber-600 dark:text-amber-400' : color === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
                                        <p className="text-lg font-black text-slate-700 dark:text-slate-200">{t.total}</p>
                                        <p className="text-[10px] font-bold">
                                            <span className="text-green-600 dark:text-green-400">{t.dat} Đạt</span>
                                            <span className="text-slate-400 mx-1">|</span>
                                            <span className="text-red-600 dark:text-red-400">{t.rot} Rớt</span>
                                        </p>
                                    </div>
                                );
                            })}
                            <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng</p>
                                <p className="text-lg font-black text-slate-700 dark:text-slate-200">{reportTotalStats.total}</p>
                                <p className="text-[10px] font-bold">
                                    <span className="text-green-600 dark:text-green-400">{reportTotalStats.dat} Đạt</span>
                                    <span className="text-slate-400 mx-1">|</span>
                                    <span className="text-red-600 dark:text-red-400">{reportTotalStats.rot} Rớt</span>
                                </p>
                            </div>
                        </div>

                        {reportDataByType.map(({ type, rows }) => {
                            const label = type === 'gold' ? 'Gold' : type === 'silver' ? 'Silver' : 'Bronze';
                            const borderColor = type === 'gold' ? 'border-amber-200 dark:border-amber-800' : type === 'silver' ? 'border-slate-200 dark:border-slate-600' : 'border-orange-200 dark:border-orange-800';
                            return (
                                <div key={type} className={`rounded-xl border ${borderColor} overflow-hidden`}>
                                    <div className={`px-4 py-2 font-black text-xs uppercase ${type === 'gold' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : type === 'silver' ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'}`}>
                                        {label}
                                    </div>
                                    <div className="overflow-auto max-h-32">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2">Rep Phụ Trách</th>
                                                    <th className="px-4 py-2 text-center">Tổng KH</th>
                                                    <th className="px-4 py-2 text-center text-green-600 dark:text-green-400">Đạt</th>
                                                    <th className="px-4 py-2 text-center text-red-600 dark:text-red-400">Rớt</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                                {rows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                        <td className="px-4 py-2 font-bold">{row.rep}</td>
                                                        <td className="px-4 py-2 text-center font-bold bg-slate-50 dark:bg-slate-800/50">{row.total}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.dat > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-400'}`}>
                                                                {row.dat}{row.total > 0 && <span className="font-normal text-[10px] opacity-70"> ({Math.round(row.dat / row.total * 100)}%)</span>}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.rot > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'text-slate-400'}`}>
                                                                {row.rot}{row.total > 0 && <span className="font-normal text-[10px] opacity-70"> ({Math.round(row.rot / row.total * 100)}%)</span>}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {rows.length === 0 && (
                                                    <tr><td colSpan={4} className="text-center py-4 text-slate-400 italic text-xs">Chưa có dữ liệu</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl text-right shrink-0">
                        <button
                            onClick={() => setShowReport(false)}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 animate-fade-in">
            <div className="flex flex-col gap-4">
                <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
                        <SearchIcon />
                    </div>
                    Theo dõi Sale KH PS ({filteredList.length})
                </h2>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm tên KH, mã KH, quận..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-opella-green outline-none transition-all"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as TypeFilter)}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <option value="total">Total</option>
                            <option value="gold">Gold</option>
                            <option value="silver">Silver</option>
                            <option value="bronze">Bronze</option>
                        </select>
                        <button
                            onClick={() => setStatusFilter(prev => prev === 'dat' ? 'all' : 'dat')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                statusFilter === 'dat'
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                            }`}
                        >
                            Đạt
                        </button>
                        <button
                            onClick={() => setStatusFilter(prev => prev === 'rot' ? 'all' : 'rot')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                statusFilter === 'rot'
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                            }`}
                        >
                            Rớt
                        </button>
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-opella-beige/50 hover:bg-opella-beige dark:bg-opella-green/20 dark:hover:bg-opella-green/30 text-opella-green dark:text-opella-green rounded-lg text-xs font-bold transition-all border border-opella-green/30 dark:border-opella-green/50"
                        >
                            <ChartBarIcon />
                            <span>Báo Cáo</span>
                        </button>
                    </div>
                </div>

                {renderReportModal()}

                <div className="mt-4 max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-600 rounded-xl">
                    {filteredList.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic text-sm">
                            Không có khách hàng phù hợp
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2.5 min-w-[140px] sticky left-0 bg-slate-100 dark:bg-slate-700 z-30 border-b border-r border-slate-200 dark:border-slate-600">Tên</th>
                                    <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">Code</th>
                                    <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">Code BM</th>
                                    <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">District</th>
                                    <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">Sale Q1</th>
                                    <th className="px-3 py-2.5 min-w-[90px] border-b border-slate-200 dark:border-slate-600">FinalStoreType</th>
                                    <th className="px-3 py-2.5 min-w-[90px] border-b border-slate-200 dark:border-slate-600">Tình Trạng Q1</th>
                                    <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">Phí Import</th>
                                    <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">Phí Local</th>
                                    {showRep && <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">Rep</th>}
                                    <th className="px-3 py-2.5 w-24 border-b border-slate-200 dark:border-slate-600">Lên đơn</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredList.map(r => {
                                    const saleQ1 = getSaleQ1(r);
                                    const tongPhiImport = r.UpdateTienThuongImport;
                                    const tongPhiLocal = r.UpdateTienThuongLocal;
                                    const dat = isDat(r);
                                    return (
                                        <tr key={r.CustomerCode} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-white group-hover:text-opella-green dark:group-hover:text-opella-green sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">
                                                {r.CustomerName}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{r.CustomerCode}</td>
                                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{r.CodeBuyMed || ''}</td>
                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.District || ''}</td>
                                            <td className="px-3 py-2">
                                                <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(saleQ1)}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {r.FinalStoreType ? (
                                                    <span className="text-sky-600 dark:text-sky-400 font-bold">{r.FinalStoreType}</span>
                                                ) : ''}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${dat ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                                                    {dat ? 'Đạt' : 'Rớt'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {tongPhiImport != null ? (
                                                    <span className="text-amber-600 dark:text-amber-400 font-bold">{formatPhí(tongPhiImport)}</span>
                                                ) : ''}
                                            </td>
                                            <td className="px-3 py-2">
                                                {tongPhiLocal != null ? (
                                                    <span className="text-opella-green dark:text-opella-green font-bold">{formatPhí(tongPhiLocal)}</span>
                                                ) : ''}
                                            </td>
                                            {showRep && <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.Rep || ''}</td>}
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => onCustomerSelect(r.CustomerCode)}
                                                    className="px-2 py-1.5 bg-opella-green hover:bg-opella-green/90 text-white text-[10px] font-bold rounded transition-all flex items-center gap-1"
                                                >
                                                    <CartIcon />
                                                    Lên đơn
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SaleKhPsTab;
