import React, { useMemo } from 'react';
import type { ProductQuotaRow } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
    PRODUCT_QUOTA_ENTEROGERMINA_ID,
    PRODUCT_QUOTA_NOSPA_ID,
    PRODUCT_QUOTA_ENTEROGERMINA_QUOTA,
    PRODUCT_QUOTA_NOSPA_QUOTA,
} from '../constants';
import { ChartBarIcon, CubeIcon } from './icons';

const ENTEROGERMINA_NAME = 'ENTEROGERMINA 2 billion/5ml B/20 bottle';
const NOSPA_NAME = 'NOSPA 80 V';

interface ProductQuotaTabProps {
    data: ProductQuotaRow[];
    isLoading?: boolean;
}

const ProductQuotaTab: React.FC<ProductQuotaTabProps> = ({ data, isLoading }) => {
    const { enterogerminaRows, nospaRows, totalEntero, totalNospa } = useMemo(() => {
        const byProduct = (productId: number) =>
            data
                .filter(r => Number(r.ProductId) === productId)
                .reduce((acc, r) => {
                    const name = (r.EmployeeName || '').trim() || 'Chưa xác định';
                    const existing = acc.find(x => x.employeeName === name);
                    const qty = Number(r.Quantity) || 0;
                    const amt = Number(r.TotalAmount) || 0;
                    if (existing) {
                        existing.quantity += qty;
                        existing.totalAmount += amt;
                    } else {
                        acc.push({ employeeName: name, quantity: qty, totalAmount: amt });
                    }
                    return acc;
                }, [] as { employeeName: string; quantity: number; totalAmount: number }[]);

        const entero = byProduct(PRODUCT_QUOTA_ENTEROGERMINA_ID);
        const nospa = byProduct(PRODUCT_QUOTA_NOSPA_ID);

        const totalEntero = entero.reduce((s, r) => s + r.quantity, 0);
        const totalNospa = nospa.reduce((s, r) => s + r.quantity, 0);

        return {
            enterogerminaRows: entero.sort((a, b) => b.quantity - a.quantity),
            nospaRows: nospa.sort((a, b) => b.quantity - a.quantity),
            totalEntero,
            totalNospa,
        };
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className="w-12 h-12 border-4 border-opella-green border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Đang tải dữ liệu Product Quota...</p>
            </div>
        );
    }

    const renderTable = (
        title: string,
        rows: { employeeName: string; quantity: number; totalAmount: number }[],
        emptyMsg: string
    ) => (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                <CubeIcon />
                <h3 className="font-black text-sm uppercase text-slate-700 dark:text-slate-200">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Nhân viên</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase text-center">Số lượng đã đặt</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase text-right">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic text-sm">
                                    {emptyMsg}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{row.employeeName}</td>
                                    <td className="px-4 py-3 text-center font-black text-slate-800 dark:text-white">{row.quantity}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(row.totalAmount)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <ChartBarIcon />
                    Product Quota
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bên trái: 2 bảng sản phẩm */}
                <div className="lg:col-span-2 space-y-6">
                    {renderTable(ENTEROGERMINA_NAME, enterogerminaRows, `Chưa có dữ liệu ${ENTEROGERMINA_NAME}`)}
                    {renderTable(NOSPA_NAME, nospaRows, `Chưa có dữ liệu ${NOSPA_NAME}`)}
                </div>

                {/* Bên phải: Ô theo dõi tổng vs Quota */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        <h3 className="font-black text-sm uppercase text-slate-700 dark:text-slate-200 mb-4 text-center">
                            Tổng vs Quota
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Enterogermina 2B/20</p>
                                <p className="text-2xl font-black text-green-700 dark:text-green-300">{totalEntero} / {PRODUCT_QUOTA_ENTEROGERMINA_QUOTA} box</p>
                                <div className="mt-2 h-2 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 dark:bg-green-600 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (totalEntero / PRODUCT_QUOTA_ENTEROGERMINA_QUOTA) * 100)}%` }}
                                    />
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">NOSPA 80 V</p>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalNospa} / {PRODUCT_QUOTA_NOSPA_QUOTA} box</p>
                                <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (totalNospa / PRODUCT_QUOTA_NOSPA_QUOTA) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ProductQuotaTab;
