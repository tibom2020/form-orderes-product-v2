import React, { useState, useMemo } from 'react';
import type { SalesRecord, Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ADMIN_CODE } from '../constants';
import { SearchIcon } from './icons';
import { CartIcon } from './icons';

type AoFilter = 'dat' | '2to3' | '1to2' | 'under1';

interface AoTrackingTabProps {
    salesRecords: SalesRecord[];
    currentEmployee: Employee;
    onCustomerSelect: (code: string) => void;
}

const AO_DAT_MIN = 3_000_000;   // Đạt: > 3tr
const AO_2TO3_MIN = 2_000_000; // 2-3tr: 2M - 3M
const AO_2TO3_MAX = 3_000_000;
const AO_1TO2_MIN = 1_000_000; // 1-2tr: 1M - 2M
const AO_1TO2_MAX = 2_000_000;

const getSaleQ1 = (r: SalesRecord) => (Number(r.MustWin) || 0) + (Number(r.Other) || 0);

const getAoFilter = (saleQ1: number): AoFilter => {
    if (saleQ1 > AO_DAT_MIN) return 'dat';
    if (saleQ1 >= AO_2TO3_MIN && saleQ1 <= AO_2TO3_MAX) return '2to3';
    if (saleQ1 >= AO_1TO2_MIN && saleQ1 < AO_1TO2_MAX) return '1to2';
    return 'under1';
};

const formatPhí = (val: unknown): string => {
    if (val == null || val === '') return '';
    const n = typeof val === 'number' ? val : Number(val);
    return isNaN(n) ? String(val) : formatCurrency(n);
};

const AoTrackingTab: React.FC<AoTrackingTabProps> = ({ salesRecords, currentEmployee, onCustomerSelect }) => {
    const showRep = currentEmployee.code === ADMIN_CODE;
    const [searchTerm, setSearchTerm] = useState('');
    const [aoFilter, setAoFilter] = useState<AoFilter>('dat');

    const myRecords = useMemo(() => {
        return salesRecords.filter(r => {
            const codeMatch = r.StaffCode && String(r.StaffCode).trim() === currentEmployee.code;
            const repMatch = r.Rep && r.Rep.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
            if (currentEmployee.code === ADMIN_CODE) return true;
            return codeMatch || repMatch;
        });
    }, [salesRecords, currentEmployee]);

    const filteredList = useMemo(() => {
        let list = [...myRecords];
        const saleQ1Filter = (r: SalesRecord) => {
            const q1 = getSaleQ1(r);
            const f = getAoFilter(q1);
            return f === aoFilter;
        };
        list = list.filter(saleQ1Filter);

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter(r =>
                (r.CustomerName || '').toLowerCase().includes(term) ||
                String(r.CustomerCode || '').includes(term) ||
                (r.District || '').toLowerCase().includes(term) ||
                (r.Rep || '').toLowerCase().includes(term)
            );
        }

        return list.sort((a, b) => getSaleQ1(b) - getSaleQ1(a));
    }, [myRecords, aoFilter, searchTerm]);

    return (
        <div className="p-4 animate-fade-in">
            <div className="flex flex-col gap-4">
                <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
                        <SearchIcon />
                    </div>
                    Theo dõi AO ({filteredList.length})
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

                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'dat' as AoFilter, label: 'Đạt' },
                            { key: '2to3' as AoFilter, label: '2-3tr' },
                            { key: '1to2' as AoFilter, label: '1-2tr' },
                            { key: 'under1' as AoFilter, label: 'Dưới 1tr' },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setAoFilter(key)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                    aoFilter === key
                                        ? 'bg-opella-green text-white border-opella-green dark:bg-opella-green dark:text-white dark:border-opella-green'
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-600 rounded-xl">
                    {filteredList.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic text-sm">
                            Không có khách hàng phù hợp
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2.5 min-w-[140px] sticky left-0 bg-slate-100 dark:bg-slate-700 z-30 border-b border-r border-slate-200 dark:border-slate-600">Tên</th>
                                    <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">Code</th>
                                    <th className="px-3 py-2.5 min-w-[100px] border-b border-slate-200 dark:border-slate-600">District</th>
                                    <th className="px-3 py-2.5 min-w-[110px] border-b border-slate-200 dark:border-slate-600">Sale Q1</th>
                                    <th className="px-3 py-2.5 min-w-[90px] border-b border-slate-200 dark:border-slate-600">FinalStoreType</th>
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
                                    return (
                                        <tr key={r.CustomerCode} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-white group-hover:text-opella-green dark:group-hover:text-opella-green sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-700 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">
                                                {r.CustomerName}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{r.CustomerCode}</td>
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

export default AoTrackingTab;
