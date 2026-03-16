import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { DocumentTextIcon, TagIcon, HomeIcon, GlobeAmericasIcon } from './icons';
import { PROMO_UPDATE_DATE } from '../constants';
import { REBATE_TIERS, formatCompact } from './dashboard/DashboardUtils';
import { getBmTiers, BM_PRODUCT_IDS } from '../constants/bmProducts';

/** Format doanh số level: hiển thị 1.5 Tr cho 1.500.000 thay vì làm tròn 2 Tr */
function formatTierAmount(amount: number): string {
    if (amount >= 1000000 && amount < 10000000 && amount % 1000000 !== 0) {
        return (amount / 1000000).toFixed(1).replace(/\.0$/, '') + ' Tr';
    }
    return formatCompact(amount);
}

/** Lấy Mua tối thiểu lớn nhất từ CTKM Giga. VD: "Mua 5h ck 4.9%, 10h ck 5.9%" → 10 */
function getGigaMinOrderMax(product: { promotion?: string; minOrder: string }): number {
    if (!product.promotion) return parseInt(product.minOrder) || 1;
    const matches = product.promotion.matchAll(/(\d+)\s*h\s*(?:ck|chiết khấu|discount)?/gi);
    let max = 1;
    for (const m of matches) max = Math.max(max, parseInt(m[1]));
    return max;
}

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
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [typeFilter, setTypeFilter] = useState<'All' | 'Local' | 'Import'>('All');
    const [selectedLevelIndex, setSelectedLevelIndex] = useState(4);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /** Danh sách sản phẩm cho dropdown (đã lọc theo typeFilter, sắp xếp theo tên) */
    const productOptions = useMemo(() => {
        let list = products;
        if (typeFilter !== 'All') list = list.filter(p => p.type === typeFilter);
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [products, typeFilter]);

    const toggleProduct = (id: number) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const filteredProducts = useMemo(() => {
        let list = products;
        if (typeFilter !== 'All') list = list.filter(p => p.type === typeFilter);
        if (selectedProductIds.length > 0) {
            list = list.filter(p => selectedProductIds.includes(p.id));
        }
        return list;
    }, [products, typeFilter, selectedProductIds]);

    /** Dữ liệu bảng giá BM: áp dụng cùng selectedProductIds và typeFilter như bảng Giga */
    const bmPriceRows = useMemo(() => {
        let list = products.filter(p => BM_PRODUCT_IDS.includes(p.id as (typeof BM_PRODUCT_IDS)[number]));
        if (typeFilter !== 'All') list = list.filter(p => p.type === typeFilter);
        if (selectedProductIds.length > 0) {
            list = list.filter(p => selectedProductIds.includes(p.id));
        }
        const rows: { name: string; minQty: number; price: number; basePrice: number; type: 'Local' | 'Import' }[] = [];
        list.forEach(p => {
            const tiers = getBmTiers(p);
            const basePrice = p.basePrice ?? p.price;
            tiers.forEach(t => rows.push({
                name: p.name,
                minQty: t.minQty,
                price: t.price,
                basePrice,
                type: p.type,
            }));
        });
        const typeOrder = (t: 'Local' | 'Import') => t === 'Local' ? 0 : 1;
        return rows.sort((a, b) =>
            typeOrder(a.type) - typeOrder(b.type) || a.name.localeCompare(b.name) || a.minQty - b.minQty
        );
    }, [products, typeFilter, selectedProductIds]);

    return (
        <div className="pb-10 bg-slate-50 dark:bg-slate-900 min-h-full">
            <div className="mb-4 px-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                    <TagIcon />
                    BẢNG GIÁ GIGA
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cập nhật CTKM: <span className="font-semibold text-opella-green dark:text-opella-green">{PROMO_UPDATE_DATE}</span>
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[320px] relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="w-full px-3 py-2 text-sm text-left border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-opella-green outline-none cursor-pointer flex items-center justify-between"
                        >
                            <span className="truncate">
                                {selectedProductIds.length === 0
                                    ? 'Tất cả sản phẩm'
                                    : `${selectedProductIds.length} sản phẩm đã chọn`}
                            </span>
                            <span className={`ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                        {dropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedProductIds([])}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                                >
                                    Tất cả sản phẩm
                                </button>
                                <div className="border-t border-slate-200 dark:border-slate-600 my-1" />
                                {productOptions.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProductIds.includes(p.id)}
                                            onChange={() => toggleProduct(p.id)}
                                            className="rounded border-slate-300 text-opella-green focus:ring-opella-green"
                                        />
                                        <span className="truncate">{p.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
                        {(['All', 'Local', 'Import'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${typeFilter === f ? 'bg-white dark:bg-slate-600 text-opella-green dark:text-opella-green shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
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
                                    title={`Doanh số ≥ ${formatTierAmount(tier.amount)}`}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${selectedLevelIndex === idx ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                                >
                                    <span>Lv{tier.level} -{tier.percent}%</span>
                                    <span className="opacity-90 font-normal ml-0.5">(≥{formatTierAmount(tier.amount)})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {filteredProducts.length} sản phẩm
                    </span>
                </div>

                <div className="overflow-auto max-h-[calc(100vh-12rem)] md:max-h-none md:overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[700px]">
                        <colgroup>
                            <col className="w-8 md:w-10" />
                            <col className="min-w-[100px] md:min-w-[200px]" />
                            <col className="w-20" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="min-w-[120px]" />
                        </colgroup>
                        <thead className="bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                            <tr>
                                <th className="px-1.5 md:px-2 py-2 md:py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600 sticky left-0 z-20 bg-slate-100 dark:bg-slate-700/70 text-[10px] md:text-sm">STT</th>
                                <th className="px-2 md:px-3 py-2 md:py-2.5 font-bold border-b border-slate-200 dark:border-slate-600 min-w-[100px] md:min-w-[200px] max-w-[130px] md:max-w-none sticky left-8 md:left-10 z-20 bg-slate-100 dark:bg-slate-700/70 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.2)] text-[10px] md:text-sm">Tên thuốc</th>
                                <th className="px-2 py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600">Mua tối thiểu</th>
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
                                const giaHD = Math.round(p.price * (1 - (maxCk ?? 0) / 100));
                                const giaCuoiThang = Math.round(giaHD * (1 - REBATE_TIERS[selectedLevelIndex].percent / 100));
                                const noteParts: string[] = [];
                                if (p.requireApproval) noteParts.push('ĐƠN DUYỆT');
                                if (p.nearExpiry) noteParts.push(p.nearExpiry);
                                if (p.note) noteParts.push(p.note);
                                const noteStr = noteParts.join(' • ') || '-';
                                return (
                                    <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200">
                                        <td className="px-1.5 md:px-2 py-1.5 md:py-2 text-center text-slate-500 dark:text-slate-400 font-medium text-[10px] md:text-sm sticky left-0 z-[9] bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 border-r border-slate-100 dark:border-slate-700 w-8 md:w-10">{idx + 1}</td>
                                        <td className="px-2 md:px-3 py-1.5 md:py-2 font-medium uppercase leading-tight text-[10px] md:text-sm sticky left-8 md:left-10 z-[9] bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 min-w-[100px] md:min-w-[200px] max-w-[130px] md:max-w-none shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.2)] border-r border-slate-100 dark:border-slate-700 break-words">{p.name}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className="font-bold text-red-600 dark:text-red-400">{getGigaMinOrderMax(p)}</span>
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium">
                                            {formatCurrency(p.price)}
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
                                        <td className="px-2 py-2 text-right font-bold text-opella-green dark:text-opella-green">
                                            {formatCurrency(giaHD)}
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                                            {REBATE_TIERS[selectedLevelIndex].percent}%
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(giaCuoiThang)}
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
                    <p><strong>Chú thích:</strong> <strong>Đơn giá gốc (VAT)</strong> = price. <strong>Giá HĐ (CK+VAT)</strong> = price × (1 − CK Tháng). Chọn Level (Lv1–Lv6) để xem % chiết khấu theo nhóm doanh số. <strong>Giá cuối tháng (CK+VAT)</strong> = Giá HĐ đã trừ thêm % chiết khấu level đã chọn.</p>
                </div>
            </div>

            {/* Bảng giá BM riêng biệt - cột thẳng hàng với bảng giá trên */}
            <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                        <TagIcon />
                        Bảng giá BM
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Bảng giá cập nhật theo trang thuocsi.vn (16.3.2026)
                    </p>
                </div>
                <div className="overflow-auto max-h-[calc(100vh-12rem)] md:max-h-none md:overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[700px]">
                        <colgroup>
                            <col className="w-8 md:w-10" />
                            <col className="min-w-[100px] md:min-w-[200px]" />
                            <col className="w-20" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="w-28" />
                            <col className="w-24" />
                            <col className="min-w-[120px]" />
                        </colgroup>
                        <thead className="bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                            <tr>
                                <th className="px-1.5 md:px-2 py-2 md:py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600 text-[10px] md:text-sm sticky left-0 z-20 bg-slate-100 dark:bg-slate-700/70">STT</th>
                                <th className="px-2 md:px-3 py-2 md:py-2.5 font-bold border-b border-slate-200 dark:border-slate-600 text-[10px] md:text-sm sticky left-8 md:left-10 z-20 bg-slate-100 dark:bg-slate-700/70 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.2)]">Tên thuốc</th>
                                <th className="px-2 py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600">Mua tối thiểu</th>
                                <th className="px-2 py-2.5 text-right font-bold border-b border-slate-200 dark:border-slate-600 invisible">—</th>
                                <th className="px-2 py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600 invisible">—</th>
                                <th className="px-2 py-2.5 text-right font-bold border-b border-slate-200 dark:border-slate-600">Giá BM (VAT)</th>
                                <th className="px-2 py-2.5 text-center font-bold border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">Level (Lv{REBATE_TIERS[selectedLevelIndex].level} -{REBATE_TIERS[selectedLevelIndex].percent}%)</th>
                                <th className="px-2 py-2.5 text-right font-bold border-b border-slate-200 dark:border-slate-600">Giá cuối tháng</th>
                                <th className="px-2 py-2.5 text-center font-bold border-b border-slate-200 dark:border-slate-600">Group</th>
                                <th className="px-3 py-2.5 font-bold border-b border-slate-200 dark:border-slate-600 invisible">—</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {bmPriceRows.map((row, idx) => {
                                const levelPercent = REBATE_TIERS[selectedLevelIndex].percent;
                                const discountAmount = row.basePrice * (levelPercent / 100);
                                const giaCuoiThang = Math.round(row.price - discountAmount);
                                return (
                                    <tr key={`${row.name}-${row.minQty}`} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200">
                                        <td className="px-1.5 md:px-2 py-1.5 md:py-2 text-center text-slate-500 dark:text-slate-400 font-medium text-[10px] md:text-sm sticky left-0 z-[9] bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 border-r border-slate-100 dark:border-slate-700">{idx + 1}</td>
                                        <td className="px-2 md:px-3 py-1.5 md:py-2 font-medium uppercase leading-tight text-[10px] md:text-sm sticky left-8 md:left-10 z-[9] bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.2)] border-r border-slate-100 dark:border-slate-700 break-words">{row.name}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className="font-bold text-red-600 dark:text-red-400">{row.minQty}</span>
                                        </td>
                                        <td className="px-2 py-2"></td>
                                        <td className="px-2 py-2"></td>
                                        <td className="px-2 py-2 text-right font-bold text-opella-green dark:text-opella-green">
                                            {formatCurrency(row.price)}
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                                            {REBATE_TIERS[selectedLevelIndex].percent}%
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(Math.max(0, giaCuoiThang))}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${row.type === 'Import' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2"></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {bmPriceRows.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm italic">Không có dữ liệu giá BM.</div>
                )}
            </div>
        </div>
    );
};

export default PriceListTab;
