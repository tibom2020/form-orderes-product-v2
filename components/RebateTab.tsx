
import React, { useState, useMemo } from 'react';
import type { Rebate, Customer, Employee } from '../types';
import { SearchIcon, BanknotesIcon, ExclamationCircleIcon, ClockIcon } from './icons';
import { formatCurrency, removeVietnameseTones } from '../utils/formatters';

export type GppNoticeRow = {
    code: string;
    name: string;
    rep: string;
    dateStr: string;
    programDetails: { program: string; remainAmount: number }[];
};

interface RebateTabProps {
    rebates: Rebate[];
    customers: Customer[];
    currentEmployee: Employee;
    onCustomerClick: (code: string) => void;
    isAdmin?: boolean;
    onPublishGppNotice?: (message: string) => Promise<void>;
}

// Helper to parse date from string (dd/mm/yyyy) or excel serial number
const parseDate = (val?: string | number): Date | null => {
    if (!val) return null;
    if (typeof val === 'number') {
        // Excel serial date (days since Dec 30, 1899)
        return new Date((val - 25569) * 86400 * 1000);
    }
    const str = String(val).trim();
    // Try dd/mm/yyyy
    const parts = str.split('/');
    if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
    }
    // Try standard date parse
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date;
    return null;
};

const formatDateDisplay = (val?: string | number): string => {
    const date = parseDate(val);
    if (!date) return 'N/A';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatDateForInput = (date: Date): string => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const RebateTab: React.FC<RebateTabProps> = ({ rebates, customers, currentEmployee, onCustomerClick, isAdmin, onPublishGppNotice }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState<'ALL' | 'LOCAL' | 'IMPORT' | 'DATE_SELECT' | 'PROMOTION_SELECT'>('ALL');
    const [sortOption, setSortOption] = useState<'NAME' | 'AMOUNT_DESC' | 'DATE_ASC'>('NAME');
    const [selectedDates, setSelectedDates] = useState<string[]>([]); // Array of YYYY-MM-DD
    const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);

    const ADMIN_CODE = '20043741';

    // 1. Merge Rebates with Customer Names and Parse Dates, Filter by Rep
    const mergedData = useMemo(() => {
        // Filter by Rep first
        let availableRebates = rebates;
        if (currentEmployee.code !== ADMIN_CODE) {
            availableRebates = rebates.filter(r => {
                // Nếu cột Rep trong Rebate rỗng, có thể không hiện hoặc hiện tất cả (tùy logic). 
                // Ở đây giả định so sánh chính xác tên.
                return r.Rep === currentEmployee.name;
            });
        }

        return availableRebates.map(r => {
            const customer = customers.find(c => String(c.code) === String(r.code));
            const expiryDate = parseDate(r.Endate || r.EndDate);
            return {
                ...r,
                customerName: customer ? customer.name : `Mã KH: ${r.code}`,
                amount: Number(r.RemainAmount) || 0,
                expiryDate,
                groupTag: (r.Group || 'UNKNOWN').toUpperCase(),
                dateStr: expiryDate ? formatDateForInput(expiryDate) : 'N/A'
            };
        });
    }, [rebates, customers, currentEmployee]);

    // 1b. Get all unique available dates from the merged data
    const availableDates = useMemo(() => {
        const dates = new Set<string>();
        mergedData.forEach(item => {
            if (item.dateStr !== 'N/A') dates.add(item.dateStr);
        });
        return Array.from(dates).sort();
    }, [mergedData]);

    // 1c. Get all unique promotion IDs from the merged data
    const availablePromotions = useMemo(() => {
        const promos = new Set<string>();
        mergedData.forEach(item => {
            if (item["PromotionID#program"]) promos.add(item["PromotionID#program"]);
        });
        return Array.from(promos).sort();
    }, [mergedData]);

    // 2. Filter & Sort
    const filteredAndSortedData = useMemo(() => {
        let matchingItems = mergedData;

        // 1. Identify which items match the filter criteria
        // Search
        if (searchTerm.trim()) {
            const term = removeVietnameseTones(searchTerm).toLowerCase();
            matchingItems = matchingItems.filter(item => {
                const name = removeVietnameseTones(item.customerName).toLowerCase();
                const code = String(item.code).toLowerCase();
                return name.includes(term) || code.includes(term);
            });
        }

        // Group/Attribute Filters
        if (filterGroup === 'LOCAL') {
            matchingItems = matchingItems.filter(item => item.groupTag.includes('LOCAL'));
        } else if (filterGroup === 'IMPORT') {
            matchingItems = matchingItems.filter(item => item.groupTag.includes('IMPORT'));
        } else if (filterGroup === 'DATE_SELECT' && selectedDates.length > 0) {
            matchingItems = matchingItems.filter(item => selectedDates.includes(item.dateStr));
        } else if (filterGroup === 'PROMOTION_SELECT' && selectedPromotions.length > 0) {
            matchingItems = matchingItems.filter(item => selectedPromotions.includes(item["PromotionID#program"]));
        }

        // 2. Identify the set of customer codes that have at least one matching item
        const matchingCustomerCodes = new Set(matchingItems.map(item => String(item.code)));

        // 3. From global data, pick ALL items belonging to those customers
        let finalSet = mergedData.filter(item => matchingCustomerCodes.has(String(item.code)));

        // 4. Sort
        finalSet.sort((a, b) => {
            if (sortOption === 'NAME') {
                return a.customerName.localeCompare(b.customerName);
            } else if (sortOption === 'AMOUNT_DESC') {
                return b.amount - a.amount;
            } else if (sortOption === 'DATE_ASC') {
                if (!a.expiryDate) return 1;
                if (!b.expiryDate) return -1;
                return a.expiryDate.getTime() - b.expiryDate.getTime();
            }
            return 0;
        });

        return finalSet;
    }, [mergedData, searchTerm, filterGroup, sortOption, selectedDates, selectedPromotions]);

    // 3. Group the filtered data by Customer Code
    const groupedData = useMemo(() => {
        const groups: { [key: string]: { code: string, name: string, items: any[], total: number } } = {};

        filteredAndSortedData.forEach(item => {
            const code = String(item.code);
            if (!groups[code]) {
                groups[code] = {
                    code,
                    name: item.customerName,
                    items: [],
                    total: 0
                };
            }
            groups[code].items.push(item);
            groups[code].total += item.amount;
        });

        // Convert back to array based on sort logic (sorting groups by name or total)
        const groupsArray = Object.values(groups);
        if (sortOption === 'NAME') {
            groupsArray.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortOption === 'AMOUNT_DESC') {
            groupsArray.sort((a, b) => b.total - a.total);
        } else if (sortOption === 'DATE_ASC') {
            // If grouping, sorting by date is tricky - we'll sort by the earliest date in each group
            groupsArray.sort((a, b) => {
                const minA = Math.min(...a.items.map(i => i.expiryDate?.getTime() || Infinity));
                const minB = Math.min(...b.items.map(i => i.expiryDate?.getTime() || Infinity));
                return minA - minB;
            });
        }

        return groupsArray;
    }, [filteredAndSortedData, sortOption]);

    const toggleDate = (date: string) => {
        setSelectedDates(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const togglePromotion = (promo: string) => {
        setSelectedPromotions(prev =>
            prev.includes(promo) ? prev.filter(p => p !== promo) : [...prev, promo]
        );
    };

    const isNearExpiry = (date?: Date | null) => {
        if (!date) return false;
        const today = new Date();
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 45; // Warning if <= 45 days left
    };

    // CẢNH BÁO GPP: KH có giấy phép GPP sắp hết hạn (15, 30, 45 ngày) + chi tiết phí & số tiền còn lại
    const gppWarningBuckets = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byCode = new Map<string, { name: string; rep: string; dateStr: string; programDetails: { program: string; remainAmount: number }[]; daysLeft: number }>();
        rebates
            .filter(r => r.DATEGPP != null && (currentEmployee.code === ADMIN_CODE || r.Rep === currentEmployee.name))
            .forEach(r => {
                const code = String(r.code);
                const dateGpp = parseDate(r.DATEGPP);
                if (!dateGpp) return;
                const d = new Date(dateGpp);
                d.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0 || diffDays > 45) return;
                const customer = customers.find(c => String(c.code) === code);
                const name = customer ? customer.name : `Mã: ${code}`;
                const rep = r.Rep || '—';
                const dateStr = formatDateDisplay(r.DATEGPP);
                const programDetails = rebates
                    .filter(x => String(x.code) === code && (currentEmployee.code === ADMIN_CODE || x.Rep === currentEmployee.name))
                    .map(x => ({ program: x["PromotionID#program"], remainAmount: Number(x.RemainAmount) || 0 }));
                if (!byCode.has(code) || byCode.get(code)!.daysLeft > diffDays) {
                    byCode.set(code, { name, rep, dateStr, programDetails, daysLeft: diffDays });
                }
            });
        const b15: GppNoticeRow[] = [];
        const b30: GppNoticeRow[] = [];
        const b45: GppNoticeRow[] = [];
        byCode.forEach((v, code) => {
            const item: GppNoticeRow = { code, name: v.name, rep: v.rep, dateStr: v.dateStr, programDetails: v.programDetails };
            if (v.daysLeft <= 15) b15.push(item);
            else if (v.daysLeft <= 30) b30.push(item);
            else b45.push(item);
        });
        return [
            { days: 15, list: b15 },
            { days: 30, list: b30 },
            { days: 45, list: b45 },
        ];
    }, [rebates, customers, currentEmployee]);

    const hasGppWarnings = gppWarningBuckets.some(b => b.list.length > 0);

    const [showExportGppModal, setShowExportGppModal] = useState(false);
    const [isPublishingGpp, setIsPublishingGpp] = useState(false);

    const buildGppNoticeText = useMemo(() => {
        const lines: string[] = ['📋 THÔNG BÁO: KH CÓ GPP SẮP HẾT HẠN', ''];
        let hasAny = false;
        gppWarningBuckets.forEach(bucket => {
            if (bucket.list.length === 0) return;
            hasAny = true;
            lines.push(`--- Trong ${bucket.days} ngày (${bucket.list.length} KH) ---`);
            bucket.list.forEach((row, idx) => {
                const phiStr = row.programDetails.map(p => `${p.program}: ${formatCurrency(p.remainAmount)}`).join('; ');
                lines.push(`${idx + 1}. Code: ${row.code} | Tên: ${row.name} | Ngày hết GPP: ${row.dateStr} | Rep: ${row.rep} | Phí: ${phiStr}`);
            });
            lines.push('');
        });
        if (!hasAny) lines.push('Không có KH nào có GPP sắp hết hạn trong 45 ngày tới.');
        return lines.join('\n').trim();
    }, [gppWarningBuckets]);

    const handleCopyGppNotice = async () => {
        try {
            await navigator.clipboard.writeText(buildGppNoticeText);
            alert('Đã sao chép nội dung thông báo vào clipboard.');
        } catch {
            alert('Không thể sao chép. Bạn có thể chọn và copy thủ công.');
        }
    };

    const handlePublishGpp = async () => {
        if (!onPublishGppNotice || !buildGppNoticeText.trim()) return;
        setIsPublishingGpp(true);
        try {
            await onPublishGppNotice(buildGppNoticeText);
            setShowExportGppModal(false);
            alert('Đã gửi thông báo lên Thông báo Admin.');
        } catch (e) {
            alert('Gửi thất bại. Vui lòng thử lại.');
        } finally {
            setIsPublishingGpp(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-xl space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2">
                        <BanknotesIcon />
                        <span>Phí Trả Thưởng ({groupedData.length} khách hàng)</span>
                    </h2>
                    {/* Show Rep Name badge */}
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                        {currentEmployee.code === ADMIN_CODE ? 'ALL REPS' : currentEmployee.name}
                    </span>
                </div>

                {/* Search */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm tên hiệu thuốc, mã code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50 dark:bg-slate-700 dark:text-white"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {[
                            { id: 'ALL', label: 'Tất cả' },
                            { id: 'LOCAL', label: 'LOCAL' },
                            { id: 'IMPORT', label: 'IMPORT' },
                            { id: 'DATE_SELECT', label: 'Ngày đến hạn' },
                            { id: 'PROMOTION_SELECT', label: 'Chương trình' }
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilterGroup(f.id as any)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${filterGroup === f.id
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Multi-Select appears only when filtering by date */}
                    {filterGroup === 'DATE_SELECT' && (
                        <div className="animate-fade-in flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <ClockIcon />
                                    <span>Chọn ngày đến hạn ({selectedDates.length})</span>
                                </div>
                                {selectedDates.length > 0 && (
                                    <button
                                        onClick={() => setSelectedDates([])}
                                        className="text-[10px] text-sky-600 font-bold hover:underline"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-1">
                                {availableDates.map(dateStr => {
                                    const isSelected = selectedDates.includes(dateStr);
                                    const parts = dateStr.split('-');
                                    const displayDate = `${parts[2]}/${parts[1]}`;
                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => toggleDate(dateStr)}
                                            className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-black transition-all border ${isSelected
                                                ? 'bg-sky-500 text-white border-sky-500'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                                                }`}
                                        >
                                            {displayDate}
                                        </button>
                                    );
                                })}
                                {availableDates.length === 0 && (
                                    <span className="text-[10px] italic text-slate-400 px-2 py-1">Không có ngày khả dụng</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Promotion Multi-Select */}
                    {filterGroup === 'PROMOTION_SELECT' && (
                        <div className="animate-fade-in flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <ExclamationCircleIcon />
                                    <span>Chọn chương trình ({selectedPromotions.length})</span>
                                </div>
                                {selectedPromotions.length > 0 && (
                                    <button
                                        onClick={() => setSelectedPromotions([])}
                                        className="text-[10px] text-sky-600 font-bold hover:underline"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-1">
                                {availablePromotions.map(promo => {
                                    const isSelected = selectedPromotions.includes(promo);
                                    return (
                                        <button
                                            key={promo}
                                            onClick={() => togglePromotion(promo)}
                                            className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-black transition-all border ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                                }`}
                                        >
                                            {promo}
                                        </button>
                                    );
                                })}
                                {availablePromotions.length === 0 && (
                                    <span className="text-[10px] italic text-slate-400 px-2 py-1">Không có chương trình khả dụng</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sorting */}
                <div className="flex items-center justify-between pt-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Sắp xếp theo:</label>
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none border-none cursor-pointer text-right"
                    >
                        <option value="NAME">Tên hiệu thuốc</option>
                        <option value="AMOUNT_DESC">Số tiền (Cao - Thấp)</option>
                        <option value="DATE_ASC">Ngày hết hạn (Sớm nhất)</option>
                    </select>
                </div>
            </div>

            {/* CẢNH BÁO: KH có GPP sắp hết hạn (15, 30, 45 ngày) — luôn hiển thị để user thấy mục này */}
            <div className="mx-4 mt-4 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase flex items-center gap-2">
                        <ExclamationCircleIcon />
                        CẢNH BÁO: KH có giấy phép GPP sắp hết hạn
                    </h3>
                    <button
                        type="button"
                        onClick={() => setShowExportGppModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700 border border-amber-300 dark:border-amber-700 transition-colors"
                    >
                        Xuất thông báo GPP
                    </button>
                </div>
                {hasGppWarnings ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {gppWarningBuckets.map((bucket) => (
                            <div key={bucket.days} className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 p-3">
                                <h4 className="text-xs font-black text-amber-700 dark:text-amber-300 mb-2">
                                    Trong {bucket.days} ngày ({bucket.list.length} KH)
                                </h4>
                                <ul className="space-y-2 max-h-48 overflow-y-auto">
                                    {bucket.list.map((row, idx) => (
                                        <li key={row.code} className="text-xs border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 flex gap-2">
                                            <span className="flex-shrink-0 font-bold text-slate-400 dark:text-slate-500 w-5">{idx + 1}.</span>
                                            <div className="min-w-0 flex-1">
                                            <div
                                                onClick={() => onCustomerClick(row.code)}
                                                className="cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 font-bold text-slate-800 dark:text-white"
                                            >
                                                {row.code} — {row.name}
                                            </div>
                                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">NV: {row.rep}</div>
                                            <div className="text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Hết GPP: {row.dateStr}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                Phí: {row.programDetails.map(p => `${p.program} (${formatCurrency(p.remainAmount)})`).join('; ')}
                                            </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Không có KH có GPP sắp hết hạn trong 45 ngày tới.
                    </p>
                )}
            </div>

            {/* Modal Xuất thông báo GPP */}
            {showExportGppModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowExportGppModal(false)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Xuất thông báo GPP sắp hết hạn</h3>
                            <button type="button" onClick={() => setShowExportGppModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">✕</button>
                        </div>
                        <div className="p-4 flex-1 overflow-hidden flex flex-col gap-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Nội dung theo từng KH: Code - Tên KH - Ngày hết GPP - Rep - Các phí và số tiền còn lại.</p>
                            <textarea
                                readOnly
                                value={buildGppNoticeText || 'Không có KH nào có GPP sắp hết hạn trong 45 ngày.'}
                                className="flex-1 min-h-[200px] w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl resize-none dark:text-slate-200"
                            />
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={handleCopyGppNotice} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">
                                    Sao chép
                                </button>
                                {isAdmin && onPublishGppNotice && (
                                    <button type="button" onClick={handlePublishGpp} disabled={isPublishingGpp || !buildGppNoticeText.trim()} className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
                                        {isPublishingGpp ? 'Đang gửi...' : 'Gửi lên Thông báo Admin'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* List with 2 columns on large screens */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                {groupedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <BanknotesIcon />
                        <span className="mt-2 text-sm italic">Không tìm thấy dữ liệu phí trả thưởng</span>
                        {filterGroup === 'DATE_SELECT' && selectedDates.length === 0 && (
                            <span className="text-xs text-sky-500 mt-1">Vui lòng chọn ngày để lọc</span>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {groupedData.map((group) => (
                            <div key={group.code} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all relative flex flex-col h-full">
                                {/* Header Section */}
                                <div className="p-4 border-b border-slate-50 dark:border-slate-700/50">
                                    <div className="flex justify-between items-start gap-2">
                                        <h3
                                            onClick={() => onCustomerClick(group.code)}
                                            className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors line-clamp-2 flex-1"
                                        >
                                            {group.name}
                                        </h3>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[12px] font-mono text-blue-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-600">
                                                🆔 {group.code}
                                            </span>
                                            <div className="text-[12px] font-black text-red-600 dark:text-red-400">
                                                Σ {formatCurrency(group.total)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="p-3 space-y-3 bg-slate-50/30 dark:bg-slate-900/20 flex-1">
                                    {group.items.map((item, idx) => (
                                        <div key={idx} className="relative bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm space-y-1.5">
                                            {/* Item Group Tag */}
                                            <div className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase shadow-sm border ${item.groupTag.includes('IMPORT')
                                                ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                                                : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800'
                                                }`}>
                                                {item.groupTag}
                                            </div>

                                            <div className="flex justify-between items-center pr-10">
                                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                                                    {formatCurrency(item.amount)}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-[9px] font-bold ${isNearExpiry(item.expiryDate) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {formatDateDisplay(item.Endate || item.EndDate)}
                                                    </span>
                                                    {isNearExpiry(item.expiryDate) && (
                                                        <span className="text-amber-500 transform scale-75"><ExclamationCircleIcon /></span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-[9px] text-slate-500 dark:text-slate-400 italic break-words leading-tight bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-50 dark:border-slate-800">
                                                🏷️ {item["PromotionID#program"]}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RebateTab;