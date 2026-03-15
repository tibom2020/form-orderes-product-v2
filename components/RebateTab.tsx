import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Rebate, Customer, Employee, RebateCustomerNoticePayload, RebateNoticeProgramItem } from '../types';
import { SearchIcon, BanknotesIcon, ExclamationCircleIcon, ClockIcon, ChartBarIcon } from './icons';
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
    onPublishCustomerNotice?: (payload: RebateCustomerNoticePayload) => Promise<void>;
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

type RebateMergedItem = Rebate & {
    customerName: string;
    amount: number;
    expiryDate: Date | null;
    groupTag: string;
    dateStr: string;
};

type RebateGroup = {
    code: string;
    name: string;
    items: RebateMergedItem[];
    total: number;
};

const RebateTab: React.FC<RebateTabProps> = ({ rebates, customers, currentEmployee, onCustomerClick, isAdmin, onPublishGppNotice, onPublishCustomerNotice }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState<'ALL' | 'LOCAL' | 'IMPORT' | 'DATE_SELECT' | 'PROMOTION_SELECT'>('ALL');
    const [sortOption, setSortOption] = useState<'NAME' | 'AMOUNT_DESC' | 'DATE_ASC'>('NAME');
    const [selectedDates, setSelectedDates] = useState<string[]>([]); // Array of YYYY-MM-DD
    const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
    // Lọc KH khi click vào ô số tiền trong bảng thống kê (Rep + ngày hết hạn)
    const [statsCellFilter, setStatsCellFilter] = useState<{ rep: string; dateStr: string } | null>(null);
    // Modal xuất thông báo trả thưởng - review trước khi xuất
    const [showExportNoticeModal, setShowExportNoticeModal] = useState(false);
    const [selectedGroupForExport, setSelectedGroupForExport] = useState<RebateGroup | null>(null);

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

        // Lọc theo ô đã chọn trong bảng thống kê (Rep + ngày hết hạn)
        if (statsCellFilter) {
            matchingItems = matchingItems.filter(item => {
                const rep = item.Rep?.trim() || 'Chưa phân công';
                return rep === statsCellFilter.rep && item.dateStr === statsCellFilter.dateStr;
            });
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
    }, [mergedData, searchTerm, filterGroup, sortOption, selectedDates, selectedPromotions, statsCellFilter]);

    // 3. Group the filtered data by Customer Code
    const groupedData = useMemo(() => {
        const groups: { [key: string]: RebateGroup } = {};

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
    const [showRepStatsModal, setShowRepStatsModal] = useState(false);
    const [repStatsGroupFilter, setRepStatsGroupFilter] = useState<'TOTAL' | 'LOCAL' | 'IMPORT'>('TOTAL');
    const [isPublishingGpp, setIsPublishingGpp] = useState(false);
    const [publishingCustomerCode, setPublishingCustomerCode] = useState<string | null>(null);

    // Pivot: Rep (rows) x Ngày hết hạn (columns) - tương tự ảnh đính kèm
    const repStatsPivot = useMemo(() => {
        const data = repStatsGroupFilter === 'TOTAL' ? mergedData
            : mergedData.filter(i => repStatsGroupFilter === 'LOCAL' ? i.groupTag.includes('LOCAL') : i.groupTag.includes('IMPORT'));
        const dateSet = new Set<string>();
        const repMap = new Map<string, Map<string, number>>(); // rep -> (dateStr -> sum)
        data.forEach(item => {
            const rep = item.Rep?.trim() || 'Chưa phân công';
            const dateStr = item.dateStr !== 'N/A' ? item.dateStr : '__NO_DATE__';
            if (dateStr !== '__NO_DATE__') dateSet.add(dateStr);
            if (!repMap.has(rep)) repMap.set(rep, new Map());
            const row = repMap.get(rep)!;
            row.set(dateStr, (row.get(dateStr) || 0) + item.amount);
        });
        const dateColumns = Array.from(dateSet).sort();
        const repRows = Array.from(repMap.entries()).map(([rep, rowMap]) => {
            let rowTotal = 0;
            const dateAmounts: Record<string, number> = {};
            dateColumns.forEach(d => {
                const v = rowMap.get(d) || 0;
                dateAmounts[d] = v;
                rowTotal += v;
            });
            const minTs = Math.min(...data.filter(i => (i.Rep?.trim() || 'Chưa phân công') === rep).map(i => i.expiryDate?.getTime() ?? Infinity));
            return { rep, dateAmounts, rowTotal, minExpiryTs: minTs === Infinity ? null : minTs };
        });
        repRows.sort((a, b) => (a.minExpiryTs ?? Infinity) - (b.minExpiryTs ?? Infinity));
        const grandTotalRow: Record<string, number> = {};
        let overallTotal = 0;
        dateColumns.forEach(d => {
            const colSum = repRows.reduce((s, r) => s + (r.dateAmounts[d] || 0), 0);
            grandTotalRow[d] = colSum;
            overallTotal += colSum;
        });
        return { dateColumns, repRows, grandTotalRow, overallTotal };
    }, [mergedData, repStatsGroupFilter]);

    const buildGppNoticeText = useMemo(() => {
        const lines: string[] = ['📋 THÔNG BÁO: KH CÓ GPP SẮP HẾT HẠN', ''];
        let hasAny = false;
        gppWarningBuckets.forEach(bucket => {
            if (bucket.list.length === 0) return;
            hasAny = true;
            lines.push(`--- Trong ${bucket.days} ngày (${bucket.list.length} KH) ---`);
            bucket.list.forEach((row, idx) => {
                lines.push(`${idx + 1}. Code: ${row.code} | Tên: ${row.name} | Ngày hết GPP: ${row.dateStr} | Rep: ${row.rep}`);
                row.programDetails.forEach(p => {
                    lines.push(`   - ${p.program}: ${formatCurrency(p.remainAmount)}`);
                });
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

    const buildCustomerNoticePayload = (group: RebateGroup): RebateCustomerNoticePayload => {
        const rep = group.items.find(item => item.Rep)?.Rep || currentEmployee.name;
        const gppRawDate = group.items.find(item => item.DATEGPP != null)?.DATEGPP;
        const gppExpiryDate = formatDateDisplay(gppRawDate);

        const toProgramItem = (item: RebateMergedItem): RebateNoticeProgramItem => ({
            program: item["PromotionID#program"] || 'N/A',
            remainAmount: Number(item.RemainAmount) || 0,
            dueDate: formatDateDisplay(item.Endate || item.EndDate),
        });

        const localPrograms = group.items
            .filter(item => item.groupTag.includes('LOCAL'))
            .map(toProgramItem);
        const importPrograms = group.items
            .filter(item => item.groupTag.includes('IMPORT'))
            .map(toProgramItem);

        const totalLocalAmount = localPrograms.reduce((sum, item) => sum + item.remainAmount, 0);
        const totalImportAmount = importPrograms.reduce((sum, item) => sum + item.remainAmount, 0);
        const totalAmount = totalLocalAmount + totalImportAmount;

        const dueDates = group.items
            .map(item => parseDate(item.Endate || item.EndDate))
            .filter((d): d is Date => !!d);
        const nearestDueDate = dueDates.length > 0
            ? formatDateDisplay(new Date(Math.min(...dueDates.map(d => d.getTime()))).toISOString())
            : 'N/A';

        const formatProgramList = (items: RebateNoticeProgramItem[]): string => {
            if (items.length === 0) return '- Không có';
            return items
                .map((it, idx) => `${idx + 1}. ${it.program} | ${formatCurrency(it.remainAmount)}`)
                .join('\n');
        };

        const message = [
            '📢 THÔNG BÁO PHÍ TRẢ THƯỞNG KHÁCH HÀNG',
            '--------------------------------',
            `🔢 Code: ${group.code}`,
            `🏠 Tên KH: ${group.name}`,
            `🧑‍💼 Tên nhân viên: ${rep}`,
            `📅 Ngày đến hạn gần nhất: ${nearestDueDate}`,
            `🧾 Ngày hết GPP: ${gppExpiryDate}`,
            '',
            `💚 LOCAL (Tổng: ${formatCurrency(totalLocalAmount)}):`,
            formatProgramList(localPrograms),
            '',
            `💙 IMPORT (Tổng: ${formatCurrency(totalImportAmount)}):`,
            formatProgramList(importPrograms),
            '',
            `💰 Tổng phí còn lại: ${formatCurrency(totalAmount)}`,
        ].join('\n');

        return {
            code: group.code,
            customerName: group.name,
            employeeName: rep,
            gppExpiryDate,
            nearestDueDate,
            localPrograms,
            importPrograms,
            totalLocalAmount,
            totalImportAmount,
            totalAmount,
            message,
        };
    };

    const renderRebateNoticeContent = (group: RebateGroup) => {
        const payload = buildCustomerNoticePayload(group);
        return (
            <div className="font-mono text-[11px] leading-relaxed space-y-1">
                <div className="font-black text-opella-green dark:text-opella-green text-sm">📢 THÔNG BÁO PHÍ TRẢ THƯỞNG KHÁCH HÀNG</div>
                <div className="text-slate-400 dark:text-slate-500">--------------------------------</div>
                <div><span className="text-slate-500 dark:text-slate-400">🔢 Code:</span> <span className="font-bold text-cyan-600 dark:text-cyan-400">{payload.code}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">🏠 Tên KH:</span> <span className="font-bold text-slate-800 dark:text-white">{payload.customerName}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">🧑‍💼 Tên nhân viên:</span> <span className="font-bold text-slate-800 dark:text-white">{payload.employeeName}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">📅 Ngày đến hạn gần nhất:</span> <span className="font-bold text-amber-600 dark:text-amber-400">{payload.nearestDueDate}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">🧾 Ngày hết GPP:</span> <span className="font-bold text-amber-600 dark:text-amber-400">{payload.gppExpiryDate}</span></div>
                <div className="h-2" />
                <div><span className="text-green-600 dark:text-green-400 font-bold">💚 LOCAL (Tổng: {formatCurrency(payload.totalLocalAmount)}):</span></div>
                {payload.localPrograms.length > 0 ? (
                    payload.localPrograms.map((it, idx) => (
                        <div key={idx} className="pl-3"><span className="text-slate-500 dark:text-slate-400">{idx + 1}. {it.program}</span> <span className="font-bold text-green-600 dark:text-green-400">| {formatCurrency(it.remainAmount)}</span></div>
                    ))
                ) : <div className="pl-3 text-slate-600 dark:text-slate-400">- Không có</div>}
                <div className="h-1.5" />
                <div><span className="text-blue-600 dark:text-blue-400 font-bold">💙 IMPORT (Tổng: {formatCurrency(payload.totalImportAmount)}):</span></div>
                {payload.importPrograms.length > 0 ? (
                    payload.importPrograms.map((it, idx) => (
                        <div key={idx} className="pl-3"><span className="text-slate-500 dark:text-slate-400">{idx + 1}. {it.program}</span> <span className="font-bold text-blue-600 dark:text-blue-400">| {formatCurrency(it.remainAmount)}</span></div>
                    ))
                ) : <div className="pl-3 text-slate-600 dark:text-slate-400">- Không có</div>}
                <div className="h-2" />
                <div><span className="text-slate-500 dark:text-slate-400">💰 Tổng phí còn lại:</span> <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(payload.totalAmount)}</span></div>
            </div>
        );
    };

    const handlePublishCustomerNotice = async (group: RebateGroup) => {
        const payload = buildCustomerNoticePayload(group);
        setPublishingCustomerCode(group.code);
        try {
            if (onPublishCustomerNotice) {
                await onPublishCustomerNotice(payload);
                alert('Đã gửi thông báo qua n8n/Telegram.');
            } else {
                await navigator.clipboard.writeText(payload.message);
                alert('Đã sao chép thông báo vào clipboard.');
            }
        } catch {
            alert('Gửi thông báo thất bại. Vui lòng thử lại.');
        } finally {
            setPublishingCustomerCode(null);
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
                    <div className="flex items-center gap-2 flex-wrap">
                        {statsCellFilter && (
                            <button
                                type="button"
                                onClick={() => setStatsCellFilter(null)}
                                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50"
                            >
                                ✕ Bỏ lọc: {statsCellFilter.rep} - {formatDateDisplay(statsCellFilter.dateStr)}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowRepStatsModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-opella-beige/50 dark:bg-opella-green/20 text-opella-green dark:text-opella-green hover:bg-opella-beige dark:hover:bg-opella-green/30 border border-opella-green/30 dark:border-opella-green/50 transition-colors"
                        >
                            <ChartBarIcon />
                            Thống kê theo Rep
                        </button>
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                            {currentEmployee.code === ADMIN_CODE ? 'ALL REPS' : currentEmployee.name}
                        </span>
                    </div>
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
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-opella-green outline-none bg-slate-50 dark:bg-slate-700 dark:text-white"
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
                                    ? 'bg-opella-green text-white border-opella-green'
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
                                        className="text-[10px] text-opella-green font-bold hover:underline"
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
                                                ? 'bg-opella-green text-white border-opella-green'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-opella-green/50'
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
                                        className="text-[10px] text-opella-green font-bold hover:underline"
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
                                                className="cursor-pointer hover:text-opella-green dark:hover:text-opella-green font-bold text-slate-800 dark:text-white"
                                            >
                                                {row.code} — {row.name}
                                            </div>
                                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">NV: {row.rep}</div>
                                            <div className="text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Hết GPP: {row.dateStr}</div>
                                            <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                                                {row.programDetails.map((p, i) => (
                                                    <div key={i}>{p.program}: {formatCurrency(p.remainAmount)}</div>
                                                ))}
                                                <div className="font-bold text-opella-green dark:text-opella-green pt-0.5 border-t border-slate-200 dark:border-slate-600 mt-0.5">
                                                    Tổng phí: {formatCurrency(row.programDetails.reduce((s, p) => s + p.remainAmount, 0))}
                                                </div>
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

            {/* Modal Thống kê theo Rep - Pivot Rep x Ngày hết hạn */}
            {showRepStatsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowRepStatsModal(false)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                <ChartBarIcon />
                                Thống kê phí còn lại theo Rep
                            </h3>
                            <div className="flex items-center gap-2">
                                <select
                                    value={repStatsGroupFilter}
                                    onChange={(e) => setRepStatsGroupFilter(e.target.value as 'TOTAL' | 'LOCAL' | 'IMPORT')}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-opella-green outline-none cursor-pointer"
                                >
                                    <option value="TOTAL">Tổng</option>
                                    <option value="LOCAL">Local</option>
                                    <option value="IMPORT">Import</option>
                                </select>
                                <button type="button" onClick={() => setShowRepStatsModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">✕</button>
                            </div>
                        </div>
                        <div className="p-4 overflow-auto flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Click vào ô số tiền để lọc danh sách KH có phí tương ứng</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse min-w-[400px]">
                                    <thead className="bg-slate-100 dark:bg-slate-700/70">
                                        <tr>
                                            <th className="px-2 py-2 font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-left sticky left-0 bg-slate-100 dark:bg-slate-700/70 z-10">Row Labels</th>
                                            {repStatsPivot.dateColumns.map(d => {
                                                const [y, m, day] = d.split('-');
                                                return (
                                                    <th key={d} className="px-2 py-2 font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-center whitespace-nowrap">
                                                        {day}/{m}/{y}
                                                    </th>
                                                );
                                            })}
                                            <th className="px-2 py-2 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-right bg-slate-200 dark:bg-slate-600">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {repStatsPivot.repRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-2 py-1.5 font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 sticky left-0 bg-white dark:bg-slate-800 z-[1]">
                                                    {row.rep}
                                                </td>
                                                {repStatsPivot.dateColumns.map(d => {
                                                    const val = row.dateAmounts[d] || 0;
                                                    return (
                                                        <td key={d} className="px-2 py-1.5 border border-slate-200 dark:border-slate-600 text-right">
                                                            {val > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setStatsCellFilter({ rep: row.rep, dateStr: d });
                                                                        setShowRepStatsModal(false);
                                                                    }}
                                                                    className="w-full text-right font-bold text-red-600 dark:text-red-400 hover:bg-opella-beige/50 dark:hover:bg-opella-green/20 hover:text-opella-green dark:hover:text-opella-green px-1 py-0.5 rounded cursor-pointer transition-colors"
                                                                >
                                                                    {formatCurrency(val)}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-2 py-1.5 font-black text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 text-right bg-slate-50 dark:bg-slate-700/50">
                                                    {formatCurrency(row.rowTotal)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-200 dark:bg-slate-600 font-black">
                                            <td className="px-2 py-2 font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 sticky left-0 bg-slate-200 dark:bg-slate-600 z-[1]">
                                                Grand Total
                                            </td>
                                            {repStatsPivot.dateColumns.map(d => (
                                                <td key={d} className="px-2 py-2 font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 text-right">
                                                    {formatCurrency(repStatsPivot.grandTotalRow[d] || 0)}
                                                </td>
                                            ))}
                                            <td className="px-2 py-2 font-black text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 text-right">
                                                {formatCurrency(repStatsPivot.overallTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            {repStatsPivot.repRows.length === 0 && (
                                <p className="text-center py-6 text-slate-400 italic text-sm">Không có dữ liệu</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                            <button type="button" onClick={() => setShowRepStatsModal(false)} className="flex-1 px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <button type="button" onClick={handlePublishGpp} disabled={isPublishingGpp || !buildGppNoticeText.trim()} className="px-4 py-2 rounded-lg text-xs font-bold bg-opella-green text-white hover:bg-opella-green/90 disabled:opacity-50">
                                        {isPublishingGpp ? 'Đang gửi...' : 'Gửi lên Thông báo Admin'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xuất thông báo trả thưởng - review trước khi xuất */}
            {showExportNoticeModal && selectedGroupForExport && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowExportNoticeModal(false); setSelectedGroupForExport(null); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-slate-800 dark:text-white uppercase text-sm">Thông báo phí trả thưởng</h3>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {renderRebateNoticeContent(selectedGroupForExport)}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-600 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => { setShowExportNoticeModal(false); setSelectedGroupForExport(null); }}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={publishingCustomerCode === selectedGroupForExport.code}
                                onClick={async () => {
                                    await handlePublishCustomerNotice(selectedGroupForExport);
                                    setShowExportNoticeModal(false);
                                    setSelectedGroupForExport(null);
                                }}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-opella-green hover:bg-opella-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {publishingCustomerCode === selectedGroupForExport.code ? 'Đang xuất...' : 'Xuất thông báo'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* List with 2 columns on large screens */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                {groupedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <BanknotesIcon />
                        <span className="mt-2 text-sm italic">Không tìm thấy dữ liệu phí trả thưởng</span>
                        {filterGroup === 'DATE_SELECT' && selectedDates.length === 0 && (
                            <span className="text-xs text-opella-green/80 mt-1">Vui lòng chọn ngày để lọc</span>
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
                                            className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight cursor-pointer hover:text-opella-green dark:hover:text-opella-green transition-colors line-clamp-2 flex-1"
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
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedGroupForExport(group);
                                                    setShowExportNoticeModal(true);
                                                }}
                                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-opella-green text-white hover:bg-opella-green/90"
                                            >
                                                Xuất thông báo
                                            </button>
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