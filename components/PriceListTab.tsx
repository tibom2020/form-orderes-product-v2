import React, { useState, useMemo } from 'react';
import type { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { SearchIcon, DocumentTextIcon, TagIcon, HomeIcon, GlobeAmericasIcon } from './icons';
import { PROMO_UPDATE_DATE } from '../constants';
import { REBATE_TIERS } from './dashboard/DashboardUtils';

/** Lấy % CK lớn nhất từ chuỗi promotion để hiển thị (ví dụ "4.9" từ "Mua 5h ck 4.9%") */
function getMaxDiscountPercent(promotion: string | undefined): number | null {
    if (!promotion) return null;
    const matches = promotion.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
    let max = 0;
    for (const m of matches) {
        const p = parseFloat(m[1]);
        if (p > max) max = p;
    }
    return max > 0 ? max : null;
}

interface PriceListTabProps {
    products: Product[];
}

const PriceListTab: React.FC<PriceListTabProps> = ({ products }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Local' | 'Import'>('All');
    const [selectedLevelIndex, setSelectedLevelIndex] = useState(4);

    const filteredProducts = useMemo(() => {
        let list = products;
        if (typeFilter !== 'All') list = list.filter(p => p.type === typeFilter);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter(p =>
                p.name.toLowerCase().includes(term) ||
                String(p.id).includes(term)
            );
        }
        return list;
    }, [products, typeFilter, searchTerm]);

    return (
        <div className="pb-10 bg-slate-50 dark:bg-slate-900 min-h-full">
            <div className="mb-4 px-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                    <TagIcon />
                    Bảng báo giá và các CTKM, CVM
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cập nhật CTKM: <span className="font-semibold text-sky-600 dark:text-sky-400">{PROMO_UPDATE_DATE}</span>
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[180px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm tên sản phẩm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                    </div>
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
                        {(['All', 'Local', 'Import'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${typeFilter === f ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                {f === 'All' && <DocumentTextIcon />}
                                {f === 'Local' && <HomeIcon />}
                                {f === 'Import' && <GlobeAmericasIcon />}
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Level CK:</span>
                        <div className="flex flex-wrap gap-1">
                            {REBATE_TIERS.map((tier, idx) => (
                                <button
                                    key={tier.level}
                                    onClick={() => setSelectedLevelIndex(idx)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${selectedLevelIndex === idx ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                                >
                                    Lv{tier.level} -{tier.percent}%
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {filteredProducts.length} sản phẩm
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-2.5 w-10 text-center font-bold border-b border-slate-200 dark:border-slate-600">STT</th>
                                <th className="px-3 py-2.5 font-bold border-b border-slate-200 dark:border-slate-600 min-w-[200px]">Tên thuốc</th>
                                <th className="px-2 py-2.5 w-20 text-center font-bold border-b border-slate-200 dark:border-slate-600">Mua tối thiểu</th>
                                <th className="px-2 py-2.5 w-28 text-right font-bold border-b border-slate-200 dark:border-slate-600">Đơn giá gốc (VAT)</th>
                                <th className="px-2 py-2.5 w-24 text-center font-bold border-b border-slate-200 dark:border-slate-600">% CK tháng</th>
                                <th className="px-2 py-2.5 w-28 text-right font-bold border-b border-slate-200 dark:border-slate-600">Giá HĐ (CK+VAT)</th>
                                <th className="px-2 py-2.5 w-24 text-center font-bold border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">Level (Lv{REBATE_TIERS[selectedLevelIndex].level} -{REBATE_TIERS[selectedLevelIndex].percent}%)</th>
                                <th className="px-2 py-2.5 w-28 text-right font-bold border-b border-slate-200 dark:border-slate-600">Giá cuối tháng (CK+VAT)</th>
                                <th className="px-2 py-2.5 w-24 text-center font-bold border-b border-slate-200 dark:border-slate-600">Group</th>
                                <th className="px-3 py-2.5 min-w-[120px] font-bold border-b border-slate-200 dark:border-slate-600">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredProducts.map((p, idx) => {
                                const maxCk = getMaxDiscountPercent(p.promotion);
                                const noteParts: string[] = [];
                                if (p.requireApproval) noteParts.push('ĐƠN DUYỆT');
                                if (p.nearExpiry) noteParts.push(p.nearExpiry);
                                if (p.note) noteParts.push(p.note);
                                const noteStr = noteParts.join(' • ') || '-';
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200">
                                        <td className="px-2 py-2 text-center text-slate-500 dark:text-slate-400 font-medium">{idx + 1}</td>
                                        <td className="px-3 py-2 font-medium uppercase leading-tight">{p.name}</td>
                                        <td className="px-2 py-2 text-center">{p.minOrder}</td>
                                        <td className="px-2 py-2 text-right font-medium">
                                            {formatCurrency(p.basePrice ?? p.price)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            {maxCk != null ? (
                                                <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                                    {maxCk.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold text-sky-600 dark:text-sky-400">
                                            {formatCurrency(p.price)}
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                                            {REBATE_TIERS[selectedLevelIndex].percent}%
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(Math.round(p.price * (1 - REBATE_TIERS[selectedLevelIndex].percent / 100)))}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${p.type === 'Import' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                                                {p.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            {(p.requireApproval || p.nearExpiry) ? (
                                                <span className="font-bold text-red-600 dark:text-red-400">{noteStr}</span>
                                            ) : (
                                                <span className="text-slate-500 dark:text-slate-400">{noteStr}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredProducts.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm italic">
                        Không có sản phẩm nào phù hợp.
                    </div>
                )}

                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400">
                    <p><strong>Chú thích:</strong> Giá HĐ = giá trên hóa đơn sau CK tháng (VAT). Chọn Level (Lv1–Lv6) để xem % chiết khấu theo nhóm doanh số. <strong>Giá cuối tháng (CK+VAT)</strong> = Giá HĐ đã trừ thêm % chiết khấu level đã chọn.</p>
                </div>
            </div>
        </div>
    );
};

export default PriceListTab;
