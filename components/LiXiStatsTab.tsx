import React, { useMemo } from 'react';
import { LiXiOnTopStats, LiXiOnTopCustomerStats, Employee } from '../types';
import { BanknotesIcon, UserGroupIcon, ClipboardDocumentListIcon, TrendingUpIcon, StarIcon } from './icons';

interface LiXiStatsTabProps {
    stats: LiXiOnTopStats[];
    customerStats: LiXiOnTopCustomerStats[];
    isLoading?: boolean;
    currentEmployee: Employee;
    isAdmin: boolean;
}

const LiXiStatsTab: React.FC<LiXiStatsTabProps> = ({ stats, customerStats, isLoading, currentEmployee, isAdmin }) => {
    // 1. Phân quyền dữ liệu Nhân viên
    const filteredStats = useMemo(() => {
        if (isAdmin) return stats;
        return stats.filter(s => s.employeeName === currentEmployee.name);
    }, [stats, isAdmin, currentEmployee]);

    // 2. Phân quyền dữ liệu Khách hàng
    const filteredCustomerStats = useMemo(() => {
        if (isAdmin) return customerStats;
        return customerStats.filter(c => c.employeeName === currentEmployee.name);
    }, [customerStats, isAdmin, currentEmployee]);

    const totals = useMemo(() => {
        return filteredStats.reduce((acc, curr) => ({
            orderCount: acc.orderCount + curr.orderCount,
            totalSales: acc.totalSales + curr.totalSales
        }), { orderCount: 0, totalSales: 0 });
    }, [filteredStats]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Đang tải dữ liệu thống kê...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header & Tổng quan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Thống kê Ontop Lì xì 250k</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            {isAdmin ? 'Chế độ Admin: Xem toàn bộ hệ thống.' : `Chào ${currentEmployee.name}, đây là số liệu của riêng bạn.`}
                        </p>
                    </div>
                </div>

                {/* Thẻ Tổng số đơn */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400">
                        <ClipboardDocumentListIcon />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tổng số đơn Ontop</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{totals.orderCount}</p>
                    </div>
                </div>

                {/* Thẻ Tổng doanh số */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <BanknotesIcon />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tổng doanh số Ontop</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.totalSales)}</p>
                    </div>
                </div>

                {/* Thẻ Hiệu quả */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <TrendingUpIcon />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TB Doanh số / Đơn</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">
                            {totals.orderCount > 0 ? formatCurrency(Math.round(totals.totalSales / totals.orderCount)) : '0 ₫'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bảng chi tiết theo nhân viên */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50">
                        <UserGroupIcon />
                        <h3 className="font-black text-sm uppercase text-slate-700 dark:text-slate-200">
                            {isAdmin ? 'Tổng hợp theo nhân viên' : 'Thống kê cá nhân'}
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/30">
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Nhân viên</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Số đơn</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Doanh số</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {filteredStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic text-sm">Chưa có dữ liệu.</td>
                                    </tr>
                                ) : (
                                    [...filteredStats].sort((a, b) => b.totalSales - a.totalSales).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white font-black text-[10px]">
                                                        {row.employeeName.split(' ').pop()?.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.employeeName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300">
                                                    {row.orderCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm font-black text-slate-800 dark:text-white">
                                                {formatCurrency(row.totalSales)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bảng chi tiết theo khách hàng */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <StarIcon />
                        <h3 className="font-black text-sm uppercase text-slate-700 dark:text-slate-200">Chi tiết khách hàng Ontop Lì xì</h3>
                    </div>

                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 dark:bg-slate-900">
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">Khách hàng</th>
                                    {isAdmin && <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">Nhân viên</th>}
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right bg-slate-50 dark:bg-slate-900">Tổng mua</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {filteredCustomerStats.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 3 : 2} className="px-6 py-10 text-center text-slate-400 italic text-sm">Chưa có dữ liệu.</td>
                                    </tr>
                                ) : (
                                    [...filteredCustomerStats].sort((a, b) => b.totalSales - a.totalSales).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.customerName}</span>
                                                    <span className="text-[10px] font-black text-slate-400">{row.customerCode}</span>
                                                </div>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    {row.employeeName}
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(row.totalSales)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 rounded-xl">
                <p className="text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed font-medium">
                    <strong>Lưu ý:</strong> Dữ liệu trên đây chỉ bao gồm các đơn hàng đã được chọn <strong>"Ontop Lì xì 250k"</strong> khi gửi. Doanh số được tính là <code>Tổng doanh số</code> (vị trí trước giảm trừ) của đơn hàng đó.
                </p>
            </div>
        </div>
    );
};

export default LiXiStatsTab;
