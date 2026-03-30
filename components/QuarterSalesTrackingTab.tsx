import React, { useMemo, useState } from 'react';
import type { Employee, SalesRecord } from '../types';
import { ADMIN_CODE } from '../constants';
import { formatCurrency } from '../utils/formatters';
import { CartIcon, SearchIcon, ChartBarIcon } from './icons';

interface QuarterSalesTrackingTabProps {
    salesRecords: SalesRecord[];
    currentEmployee: Employee;
    onCustomerSelect: (code: string) => void;
}

type StatusFilter = 'all' | 'dat' | 'chuaDat';

const getSaleQ1 = (r: SalesRecord): number => (Number(r.MustWin) || 0) + (Number(r.Other) || 0);
const getQuarterTarget = (r: SalesRecord): number => Math.max(0, (Number(r.TargetMonthly) || 0) * 3);

const QuarterSalesTrackingTab: React.FC<QuarterSalesTrackingTabProps> = ({
    salesRecords,
    currentEmployee,
    onCustomerSelect,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showReport, setShowReport] = useState(false);

    const scopedRecords = useMemo(() => {
        return salesRecords.filter((r) => {
            const codeMatch = String(r.StaffCode || '').trim() === currentEmployee.code;
            const repMatch = String(r.Rep || '').toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
            if (currentEmployee.code === ADMIN_CODE) return true;
            return codeMatch || repMatch;
        });
    }, [salesRecords, currentEmployee]);

    const rows = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const mapped = scopedRecords.map((r) => {
            const saleQ1 = getSaleQ1(r);
            const targetQuarter = getQuarterTarget(r);
            const achievePct = targetQuarter > 0 ? (saleQ1 / targetQuarter) * 100 : 0;
            const isDat = achievePct >= 100;
            const todo = saleQ1 - targetQuarter;
            const expectedReach = (isDat ? saleQ1 : targetQuarter) * 0.00985;
            return {
                record: r,
                saleQ1,
                targetQuarter,
                achievePct,
                isDat,
                todo,
                expectedReach,
            };
        });

        return mapped
            .filter((x) => {
                if (statusFilter === 'dat' && !x.isDat) return false;
                if (statusFilter === 'chuaDat' && x.isDat) return false;
                if (!term) return true;
                return (
                    String(x.record.CustomerName || '').toLowerCase().includes(term) ||
                    String(x.record.CustomerCode || '').toLowerCase().includes(term) ||
                    String(x.record.CodeBuyMed || '').toLowerCase().includes(term) ||
                    String(x.record.District || '').toLowerCase().includes(term)
                );
            })
            .sort((a, b) => b.achievePct - a.achievePct);
    }, [scopedRecords, searchTerm, statusFilter]);

    const datCount = rows.filter((r) => r.isDat).length;
    const chuaDatCount = rows.length - datCount;

    const reportRows = useMemo(() => {
        const byRep = new Map<string, { total: number; dat: number; chuaDat: number }>();
        scopedRecords.forEach((r) => {
            const rep = String(r.Rep || 'Chưa phân công').trim() || 'Chưa phân công';
            const saleQ1 = getSaleQ1(r);
            const targetQuarter = getQuarterTarget(r);
            const achievePct = targetQuarter > 0 ? (saleQ1 / targetQuarter) * 100 : 0;
            const dat = achievePct >= 100;
            const cur = byRep.get(rep) || { total: 0, dat: 0, chuaDat: 0 };
            cur.total += 1;
            if (dat) cur.dat += 1;
            else cur.chuaDat += 1;
            byRep.set(rep, cur);
        });
        return Array.from(byRep.entries())
            .map(([rep, s]) => ({
                rep,
                ...s,
                rateDat: s.total > 0 ? (s.dat / s.total) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [scopedRecords]);

    const reportTotal = useMemo(
        () =>
            reportRows.reduce(
                (acc, r) => ({
                    total: acc.total + r.total,
                    dat: acc.dat + r.dat,
                    chuaDat: acc.chuaDat + r.chuaDat,
                }),
                { total: 0, dat: 0, chuaDat: 0 }
            ),
        [reportRows]
    );

    return (
        <div className="p-4 animate-fade-in">
            <div className="flex flex-col gap-4">
                <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
                        <ChartBarIcon />
                    </div>
                    Theo dõi doanh số quý 1 KH ({rows.length})
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Đạt</p>
                        <p className="text-lg font-black text-green-700 dark:text-green-300">{datCount}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Chưa đạt</p>
                        <p className="text-lg font-black text-red-700 dark:text-red-300">{chuaDatCount}</p>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Tổng KH</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-200">{rows.length}</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm tên KH, code, code BM, district..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-opella-green outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('dat')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter === 'dat' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                        >
                            Đạt
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('chuaDat')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border ${statusFilter === 'chuaDat' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                        >
                            Chưa đạt
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReport(true)}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-opella-green/40 bg-opella-beige/70 dark:bg-opella-green/20 text-opella-green hover:bg-opella-beige dark:hover:bg-opella-green/30"
                        >
                            Báo cáo Rep
                        </button>
                    </div>
                </div>

                <div className="mt-2 max-h-[62vh] overflow-auto border border-slate-200 dark:border-slate-600 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="px-3 py-2.5 min-w-[170px] sticky left-0 bg-slate-100 dark:bg-slate-700 z-30 border-b border-r border-slate-200 dark:border-slate-600">Tên</th>
                                <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">Code</th>
                                <th className="px-3 py-2.5 min-w-[90px] border-b border-slate-200 dark:border-slate-600">Code BM</th>
                                <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">District</th>
                                <th className="px-3 py-2.5 min-w-[120px] border-b border-slate-200 dark:border-slate-600">Sale Q1</th>
                                <th className="px-3 py-2.5 min-w-[120px] border-b border-slate-200 dark:border-slate-600">Target Quý</th>
                                <th className="px-3 py-2.5 min-w-[95px] border-b border-slate-200 dark:border-slate-600">% Achive</th>
                                <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">Tình trạng</th>
                                <th className="px-3 py-2.5 min-w-[120px] border-b border-slate-200 dark:border-slate-600">Todo</th>
                                <th className="px-3 py-2.5 min-w-[170px] border-b border-slate-200 dark:border-slate-600">Số tiền dự kiến đạt (100%)</th>
                                <th className="px-3 py-2.5 min-w-[90px] border-b border-slate-200 dark:border-slate-600">Lên đơn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {rows.map((row) => (
                                <tr
                                    key={`${row.record.CustomerCode}-${row.record.CodeBuyMed || ''}`}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                                    onClick={() => onCustomerSelect(String(row.record.CustomerCode || ''))}
                                >
                                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-white group-hover:text-opella-green dark:group-hover:text-opella-green sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">
                                        {row.record.CustomerName}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">{row.record.CustomerCode}</td>
                                    <td className="px-3 py-2 font-mono text-pink-600 dark:text-pink-400">{row.record.CodeBuyMed || ''}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.record.District || ''}</td>
                                    <td className="px-3 py-2 font-bold text-opella-green">{formatCurrency(row.saleQ1)}</td>
                                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{formatCurrency(row.targetQuarter)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`font-bold ${row.achievePct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {row.achievePct.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${row.isDat ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}`}>
                                            {row.isDat ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`font-black ${row.todo < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {formatCurrency(row.todo)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`font-bold ${row.achievePct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatCurrency(row.expectedReach)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCustomerSelect(String(row.record.CustomerCode || ''));
                                            }}
                                            className="px-2 py-1.5 bg-opella-green hover:bg-opella-green/90 text-white text-[10px] font-bold rounded transition-all flex items-center gap-1"
                                        >
                                            <CartIcon />
                                            Lên đơn
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                                        Không có dữ liệu phù hợp
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase">
                                Báo cáo KH Đạt / Chưa Đạt theo Rep
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowReport(false)}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase text-xs font-bold sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2">Rep</th>
                                        <th className="px-3 py-2 text-center">Tổng KH</th>
                                        <th className="px-3 py-2 text-center text-green-600 dark:text-green-400">Đạt</th>
                                        <th className="px-3 py-2 text-center text-red-600 dark:text-red-400">Chưa đạt</th>
                                        <th className="px-3 py-2 text-center">% Đạt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                    {reportRows.map((r) => (
                                        <tr key={r.rep} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                                            <td className="px-3 py-2 font-bold">{r.rep}</td>
                                            <td className="px-3 py-2 text-center font-bold">{r.total}</td>
                                            <td className="px-3 py-2 text-center text-green-600 dark:text-green-400 font-bold">{r.dat}</td>
                                            <td className="px-3 py-2 text-center text-red-600 dark:text-red-400 font-bold">{r.chuaDat}</td>
                                            <td className="px-3 py-2 text-center font-bold">{r.rateDat.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 dark:bg-slate-700/60 font-black">
                                        <td className="px-3 py-2">TỔNG</td>
                                        <td className="px-3 py-2 text-center">{reportTotal.total}</td>
                                        <td className="px-3 py-2 text-center text-green-600 dark:text-green-400">{reportTotal.dat}</td>
                                        <td className="px-3 py-2 text-center text-red-600 dark:text-red-400">{reportTotal.chuaDat}</td>
                                        <td className="px-3 py-2 text-center">
                                            {reportTotal.total > 0 ? ((reportTotal.dat / reportTotal.total) * 100).toFixed(1) : '0.0'}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-right">
                            <button
                                type="button"
                                onClick={() => setShowReport(false)}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200"
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

export default QuarterSalesTrackingTab;
