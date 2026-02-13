
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { SalesRecord, Employee, Rebate, PurchaseHistoryItem } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ArrowLeftIcon, UserGroupIcon, IdentificationIcon, ClockIcon, PresentationChartLineIcon, CartIcon, FaceSmileIcon, FaceFrownIcon, RocketLaunchIcon, TrophyIcon, SearchIcon, DocumentTextIcon, StarIcon, GiftIcon, CubeIcon, ClipboardDocumentListIcon } from './icons';

interface DashboardProps {
    salesData: SalesRecord[];
    currentEmployee: Employee;
    onCustomerSelect: (code: string) => void;
    rebates: Rebate[];
    purchaseHistory: PurchaseHistoryItem[];
    initialCustomerCode?: string | null; // NEW PROP
    onBack?: () => void; // NEW PROP
}

const ADMIN_CODE = '20043741'; // Phan Viet Linh
const ADMIN_NAME = 'Phan Viet Linh';

// --- KPI TARGETS CONFIGURATION (FROM EXCEL IMAGE) ---
const KPI_TARGETS: Record<string, { Total: number, MustWin: number, Other: number, AO: number, MSO: number, Active: number }> = {
    'Huynh Hoang Hon': { Total: 1899923672, MustWin: 1106990861, Other: 792932811, AO: 130, MSO: 85, Active: 130 },
    'Huynh Thi To Trinh': { Total: 1801327943, MustWin: 1091590887, Other: 709737056, AO: 130, MSO: 85, Active: 130 },
    'Huynh Van Thanh Huyen': { Total: 2900304923, MustWin: 1706063145, Other: 1194241777, AO: 130, MSO: 85, Active: 130 },
    'Le Huu Phuc': { Total: 1703792575, MustWin: 817304886, Other: 886487689, AO: 130, MSO: 85, Active: 130 },
    'Ly Minh Dat': { Total: 1976406056, MustWin: 1253100503, Other: 723305553, AO: 130, MSO: 85, Active: 130 },
    'Nguyen Thi Hong Cam': { Total: 1599754667, MustWin: 892556791, Other: 707197876, AO: 130, MSO: 85, Active: 130 },
    'Truong Hoang Du': { Total: 2023730916, MustWin: 883013722, Other: 1140717195, AO: 130, MSO: 85, Active: 130 },
};

// --- Constants & Helper Functions ---

const REBATE_TIERS = [
    { level: 1, amount: 1500000, percent: 3.0 },
    { level: 2, amount: 3000000, percent: 3.5 },
    { level: 3, amount: 5000000, percent: 4.0 },
    { level: 4, amount: 10000000, percent: 4.5 },
    { level: 5, amount: 15000000, percent: 5.0 },
    { level: 6, amount: 25000000, percent: 5.5 },
];

const calculatePercent = (actual: number, target: number) => {
    if (!target || target === 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / target) * 100, 100);
};

const getRawPercent = (actual: number, target: number) => {
    if (!target || target === 0) return 0;
    return (actual / target) * 100;
};

const formatDateVal = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '';

    let date: Date;

    if (typeof val === 'number') {
        // Excel serial date (số ngày tính từ 30/12/1899)
        date = new Date((val - 25569) * 86400 * 1000);
    } else {
        const str = String(val);
        // Nếu là ISO string (chứa T), parse thành Date object để browser tự cộng giờ theo múi giờ local (VN)
        if (str.includes('T')) {
            date = new Date(str);
        } else {
            // Các dạng text "1/26/2026" giữ nguyên trả về để hiển thị như gốc
            return str;
        }
    }

    // Format lại thành dd/mm/yyyy nếu là ngày hợp lệ
    if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    return String(val);
};

// Hàm format số gọn (Mới thêm)
const formatCompact = (amount: number) => {
    if (!amount || amount === 0) return '0';
    if (amount >= 1000000000) {
        return (amount / 1000000000).toFixed(1).replace(/\.0$/, '') + ' Tỷ';
    }
    if (amount >= 1000000) {
        return Math.round(amount / 1000000) + ' Tr';
    }
    if (amount >= 1000) {
        return Math.round(amount / 1000) + ' k';
    }
    return new Intl.NumberFormat('vi-VN').format(amount);
};

const getRebateLevel = (amount: number) => {
    // Duyệt ngược từ level cao nhất xuống
    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
        if (amount >= REBATE_TIERS[i].amount) {
            return REBATE_TIERS[i];
        }
    }
    return null;
};

// --- Sub Components ---

const ProgressBar = ({ actual, target, colorClass }: { actual: number, target: number, colorClass: string, showLabel?: boolean }) => {
    const percent = calculatePercent(actual, target);
    const totalSegments = 24;
    const activeSegments = Math.round((percent / 100) * totalSegments);

    // Xác định màu viền và hiệu ứng glow dựa trên colorClass đầu vào
    let borderColorClass = 'border-slate-300 dark:border-slate-600';
    let shadowClass = '';

    if (colorClass.includes('blue')) {
        borderColorClass = 'border-blue-300 dark:border-blue-700';
        shadowClass = 'shadow-[0_0_6px_rgba(59,130,246,0.6)]';
    } else if (colorClass.includes('green') || colorClass.includes('emerald')) {
        borderColorClass = 'border-green-300 dark:border-green-700';
        shadowClass = 'shadow-[0_0_6px_rgba(34,197,94,0.6)]';
    } else if (colorClass.includes('sky') || colorClass.includes('cyan')) {
        borderColorClass = 'border-sky-300 dark:border-sky-700';
        shadowClass = 'shadow-[0_0_6px_rgba(14,165,233,0.6)]';
    } else if (colorClass.includes('red') || colorClass.includes('pink') || colorClass.includes('rose')) {
        borderColorClass = 'border-red-300 dark:border-red-700';
        shadowClass = 'shadow-[0_0_6px_rgba(244,63,94,0.6)]';
    }

    return (
        <div className="w-full">
            <div className={`w-full border ${borderColorClass} p-[3px] rounded-lg bg-white dark:bg-slate-800 shadow-sm flex gap-[2px] overflow-hidden`}>
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const isActive = i < activeSegments;
                    return (
                        <div
                            key={i}
                            className={`h-2.5 flex-1 rounded-[1px] transition-all duration-500 ${isActive
                                ? `${colorClass} ${shadowClass}`
                                : 'bg-slate-100 dark:bg-slate-700'
                                }`}
                        ></div>
                    );
                })}
            </div>
        </div>
    );
};

// Component thanh sale nhỏ (cho Giga/BuyMed) - Style Segmented
const MiniProgressBar = ({ label, actual, totalTarget, barColor }: { label: string, actual: number, totalTarget: number, barColor: string }) => {
    const percent = calculatePercent(actual, totalTarget);
    if (actual <= 0) return null;

    const totalSegments = 15;
    const activeSegments = Math.round((percent / 100) * totalSegments);

    return (
        <div className="mb-2">
            <div className="flex justify-between items-end text-[10px] mb-1 text-slate-500 dark:text-slate-400">
                <span>{label}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actual)}</span>
            </div>

            <div className="w-full border border-slate-200 dark:border-slate-700 p-[2px] rounded bg-white dark:bg-slate-800 flex gap-[1px]">
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const isActive = i < activeSegments;
                    return (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-[1px] ${isActive
                                ? `${barColor} opacity-90`
                                : 'bg-slate-100 dark:bg-slate-700'
                                }`}
                        ></div>
                    )
                })}
            </div>
        </div>
    );
};

// --- NEON STYLE COMPONENTS ---

const NeonCircularProgress = ({
    percent,
    label,
    value,
    color = "cyan",
    unit = "",
    onClick
}: {
    percent: number;
    label: string;
    value: string;
    color?: "cyan" | "pink" | "yellow" | "purple" | "green";
    unit?: string;
    onClick?: () => void;
}) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    let strokeColor = "stroke-cyan-400";
    let shadowColor = "drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]";
    let textColor = "text-cyan-400";

    if (color === "pink") {
        strokeColor = "stroke-pink-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]";
        textColor = "text-pink-500";
    } else if (color === "yellow") {
        strokeColor = "stroke-yellow-400";
        shadowColor = "drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]";
        textColor = "text-yellow-400";
    } else if (color === "purple") {
        strokeColor = "stroke-purple-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(168,85,247,0.8)]";
        textColor = "text-purple-500";
    } else if (color === "green") {
        strokeColor = "stroke-green-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]";
        textColor = "text-green-500";
    }

    return (
        <div
            className={`flex flex-col items-center group ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest group-hover:text-white transition-colors">{label}</h4>
            <div className="relative w-24 h-24 transform transition-transform group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90">
                    {/* Background Circle */}
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        className="stroke-slate-700 fill-none"
                        strokeWidth="4"
                    />
                    {/* Foreground Circle */}
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        className={`${strokeColor} fill-none ${shadowColor} transition-all duration-1000 ease-out`}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xl font-black ${textColor} drop-shadow-md`}>{Math.round(percent)}%</span>
                </div>
            </div>
            <div className="mt-1 text-center">
                <p className={`text-xs font-bold ${textColor}`}>{value} <span className="text-[9px] opacity-70">{unit}</span></p>
            </div>
        </div>
    );
};

const NeonLinearProgress = ({
    percent,
    label,
    value,
    target,
    color = "cyan",
    onClick
}: {
    percent: number;
    label: string;
    value: string;
    target: string;
    color?: "cyan" | "pink" | "yellow" | "purple";
    onClick?: () => void;
}) => {
    let barColor = "bg-cyan-400";
    let shadowColor = "shadow-[0_0_10px_rgba(34,211,238,0.6)]";
    let textColor = "text-cyan-400";
    let borderColor = "border-cyan-500/30";

    if (color === "pink") {
        barColor = "bg-pink-500";
        shadowColor = "shadow-[0_0_10px_rgba(236,72,153,0.6)]";
        textColor = "text-pink-500";
        borderColor = "border-pink-500/30";
    } else if (color === "yellow") {
        barColor = "bg-yellow-400";
        shadowColor = "shadow-[0_0_10px_rgba(250,204,21,0.6)]";
        textColor = "text-yellow-400";
        borderColor = "border-yellow-500/30";
    } else if (color === "purple") {
        barColor = "bg-purple-500";
        shadowColor = "shadow-[0_0_10px_rgba(168,85,247,0.6)]";
        textColor = "text-purple-500";
        borderColor = "border-purple-500/30";
    }

    return (
        <div
            className={`mb-4 group ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider group-hover:text-white transition-colors">{label}</span>
                <div className="flex gap-2 items-baseline">
                    <span className={`text-[10px] font-bold ${textColor}`}>{value} <span className="text-slate-500">/ {target}</span></span>
                    <span className={`text-xs font-black ${textColor}`}>{Math.round(percent)}%</span>
                </div>
            </div>
            <div className={`w-full h-3 bg-slate-800 rounded-sm border ${borderColor} p-[1px] relative overflow-hidden`}>
                <div
                    className={`h-full rounded-sm ${barColor} ${shadowColor} transition-all duration-1000 ease-out`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                ></div>
            </div>
        </div>
    );
};

// Bảng Todo List Level
const LevelTodoTable = ({ actual }: { actual: number }) => {
    return (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bảng tính Todo Level</p>
            <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                        <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="py-1 pr-2">Level</th>
                            <th className="py-1 px-2 text-right">Mốc DS</th>
                            <th className="py-1 pl-2 text-right">Cần làm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REBATE_TIERS.map((tier) => {
                            const todo = tier.amount - actual;
                            const isReached = todo <= 0;
                            return (
                                <tr key={tier.level} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="py-1.5 pr-2 font-bold text-slate-600 dark:text-slate-300">
                                        Lv{tier.level} <span className="font-normal text-[9px] text-slate-400">({tier.percent}%)</span>
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-400">
                                        {formatCompact(tier.amount)}
                                    </td>
                                    <td className="py-1.5 pl-2 text-right font-bold">
                                        {isReached ? (
                                            <span className="text-green-500 dark:text-green-400">✓ Đạt</span>
                                        ) : (
                                            <span className="text-red-500 dark:text-red-400">{formatCompact(todo)}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- CUSTOMER DETAIL COMPONENT ---
interface CustomerDetailProps {
    record: SalesRecord;
    allRecords: SalesRecord[];
    rebates: Rebate[];
    purchaseHistory: PurchaseHistoryItem[];
    onBack: () => void;
    onGoToOrder: (code: string) => void;
    onSwitchCustomer: (record: SalesRecord) => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({
    record, allRecords, rebates, purchaseHistory, onBack, onGoToOrder, onSwitchCustomer
}) => {
    // ... [Content remains the same for CustomerDetail, only Dashboard is the main target]
    // To save output space, assuming the rest of CustomerDetail is identical to previous version.
    // I will include full file content as requested.
    const [activeDetailModal, setActiveDetailModal] = useState<'Import' | 'Local' | 'T1' | 'Products' | null>(null);
    const [showQuickSearch, setShowQuickSearch] = useState(false);
    const [quickSearchTerm, setQuickSearchTerm] = useState('');
    const quickSearchInputRef = useRef<HTMLInputElement>(null);

    // Quick Search Logic
    const quickSearchResults = useMemo(() => {
        if (!quickSearchTerm) return [];
        const term = quickSearchTerm.toLowerCase();
        return allRecords.filter(r =>
            r.CustomerName.toLowerCase().includes(term) ||
            String(r.CustomerCode).toLowerCase().includes(term)
        ).slice(0, 8);
    }, [quickSearchTerm, allRecords]);

    useEffect(() => {
        if (showQuickSearch && quickSearchInputRef.current) {
            quickSearchInputRef.current.focus();
        }
    }, [showQuickSearch]);

    // History Processing
    const allHistory = useMemo(() => {
        const buyMedCode = record.CodeBuyMed ? String(record.CodeBuyMed).trim() : '';
        const mainCode = String(record.CustomerCode).trim();
        return (purchaseHistory || [])
            .filter(p => {
                const pId = String(p.CustomerID).trim();
                return pId === mainCode || (buyMedCode !== '' && pId === buyMedCode);
            })
            .sort((a, b) => {
                const getTs = (d: string | number | undefined) => {
                    if (!d) return 0;
                    if (typeof d === 'number') return d;
                    if (typeof d === 'string' && d.includes('/')) {
                        const parts = d.split('/');
                        if (parts.length === 3) {
                            return new Date(`${parts[1]}/${parts[0]}/${parts[2]}`).getTime();
                        }
                    }
                    return new Date(d).getTime();
                };
                return getTs(b.InvoiceDate) - getTs(a.InvoiceDate);
            });
    }, [purchaseHistory, record]);

    // Product Stats
    const uniqueProductStats = useMemo(() => {
        const map = new Map<string, { qty: number, val: number }>();
        allHistory.forEach(h => {
            const prodName = h.Product ? h.Product.trim() : 'Unknown';
            const current = map.get(prodName) || { qty: 0, val: 0 };
            map.set(prodName, {
                qty: current.qty + (Number(h.Qty) || 0),
                val: current.val + (Number(h.Value) || 0)
            });
        });

        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.val - a.val);
    }, [allHistory]);

    const totalHistoryValue = useMemo(() => allHistory.reduce((sum, h) => sum + (Number(h.Value) || 0), 0), [allHistory]);

    // Derived Variables
    const customerRebates = useMemo(() => rebates.filter(r => String(r.code) === String(record.CustomerCode)), [rebates, record]);

    // Process merged history: Import items first (sorted by date), then Local items (sorted by date)
    const mergedHistory = useMemo(() => {
        const imp = allHistory.filter(h => (h.Group || h.Team || '').toLowerCase().includes('import'));
        const loc = allHistory.filter(h => (h.Group || h.Team || '').toLowerCase().includes('local'));
        return [...imp, ...loc];
    }, [allHistory]);

    const uniqueOrderDates = new Set(allHistory.map(h => String(h.InvoiceDate))).size;

    const actualImport = Number(record.ActualImport) || 0;
    const targetImport = Number(record.TargetImport) || 0;
    const actualLocal = Number(record.ActualLocal) || 0;
    const targetLocal = Number(record.TargetLocal) || 0;
    const totalActual = actualImport + actualLocal;
    const totalTarget = targetImport + targetLocal;
    const progressPercent = getRawPercent(totalActual, totalTarget);
    const todoTotal = Number(record.Todo) || 0;

    // T1 Data
    const actualImportT1 = Number(record.ActualImportT1 || record["SALE IMPORT T1"] || record.SaleImportTotalT1) || 0;
    const actualLocalT1 = Number(record.ActualLocalT1 || record["SALE LOCAL T1"] || record.SaleLocalTotalT1) || 0;

    const importTierT1 = getRebateLevel(actualImportT1);
    const importBonusT1 = importTierT1 ? actualImportT1 * (importTierT1.percent / 100) : 0;
    const localTierT1 = getRebateLevel(actualLocalT1);
    const localBonusT1 = localTierT1 ? actualLocalT1 * (localTierT1.percent / 100) : 0;

    const isGold = record.FinalStoreType?.toLowerCase().includes('gold');
    const isSilver = record.FinalStoreType?.toLowerCase().includes('silver');
    const badgeColor = isGold ? 'bg-yellow-400 text-yellow-900' : isSilver ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-900';
    const badgeIcon = isGold ? '👑' : isSilver ? '🛡️' : '🥉';

    // CALCULATE CHANNEL SHARE (GIGAMED vs BM)
    const gigaVal = Number(record.GIGAMED) || 0;
    const bmVal = Number(record.BM) || 0;
    const totalChannelVal = gigaVal + bmVal;

    const finalGigaVal = totalChannelVal > 0 ? gigaVal : ((Number(record.ActualImportGiga) || 0) + (Number(record.ActualLocalGiga) || 0));
    const finalBmVal = totalChannelVal > 0 ? bmVal : ((Number(record.ActualImportBuyMed) || 0) + (Number(record.ActualLocalBuyMed) || 0));
    const finalTotalChannel = finalGigaVal + finalBmVal;

    const gigaPct = finalTotalChannel > 0 ? (finalGigaVal / finalTotalChannel) * 100 : 0;
    const bmPct = finalTotalChannel > 0 ? (finalBmVal / finalTotalChannel) * 100 : 0;

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-full pb-10">
            {/* Top Navigation */}
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20">
                <button
                    onClick={onBack}
                    className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                >
                    <ArrowLeftIcon />
                </button>

                <div className="flex-1 relative">
                    {showQuickSearch ? (
                        <div className="relative animate-fade-in">
                            <input
                                ref={quickSearchInputRef}
                                type="text"
                                value={quickSearchTerm}
                                onChange={(e) => setQuickSearchTerm(e.target.value)}
                                placeholder="Tìm khách hàng khác..."
                                className="w-full py-2 px-4 rounded-full border-2 border-sky-500 bg-white dark:bg-slate-700 dark:text-white dark:border-sky-400 outline-none text-sm font-bold shadow-sm"
                                onBlur={() => setTimeout(() => setShowQuickSearch(false), 200)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onClick={() => { setShowQuickSearch(false); setQuickSearchTerm(''); }}>
                                ✕
                            </div>

                            {/* Dropdown Results */}
                            {quickSearchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                    {quickSearchResults.map(res => (
                                        <div
                                            key={res.CustomerCode}
                                            onMouseDown={() => {
                                                onSwitchCustomer(res);
                                                setShowQuickSearch(false);
                                                setQuickSearchTerm('');
                                            }}
                                            className="px-4 py-3 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                        >
                                            <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{res.CustomerName}</p>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{res.CustomerCode}</span>
                                                {res.District && <span className="text-[10px] text-slate-400">{res.District}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setShowQuickSearch(true)}>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    {record.CustomerName}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{record.CustomerCode}</p>
                            </div>
                            <button className="p-2 text-slate-400 hover:text-sky-500 dark:text-slate-500 dark:hover:text-sky-400 transition-colors">
                                <SearchIcon />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onGoToOrder(record.CustomerCode)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors uppercase flex items-center gap-2 shrink-0"
                >
                    <CartIcon />
                    <span className="hidden sm:inline">Lên Đơn</span>
                </button>
            </div>

            {/* Changed from lg:grid-cols-3 to lg:grid-cols-4 for better space usage (1:3 ratio) */}
            <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {/* [Existing Profile Card, Stats, Charts logic...] */}
                {/* 1. PROFILE CARD */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-full flex flex-col relative">
                        <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full blur-2xl -ml-10 -mb-10"></div>
                        </div>

                        <div className="px-4 pb-6 -mt-12 flex flex-col items-center relative z-10 flex-1">
                            <div className="w-24 h-24 bg-emerald-600 dark:bg-emerald-700 rounded-full border-4 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-white">
                                <div className="scale-150"><UserGroupIcon /></div>
                            </div>

                            <h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-white text-center leading-tight">{record.CustomerName}</h3>
                            <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm ${badgeColor}`}>
                                <span>{badgeIcon}</span> {record.FinalStoreType || 'Thành viên'}
                            </div>

                            <div className="w-full mt-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tiến độ KPI</span>
                                    <span className="text-xs font-black text-slate-800 dark:text-white">{progressPercent.toFixed(1)}%</span>
                                </div>
                                <ProgressBar
                                    actual={totalActual}
                                    target={totalTarget}
                                    colorClass="bg-emerald-500"
                                    showLabel={false}
                                />
                                {todoTotal > 0 ? (
                                    <p className="mt-3 text-[10px] text-center font-medium text-slate-600 dark:text-slate-300">
                                        Mua thêm <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCompact(todoTotal)}</span> để đạt mục tiêu tháng
                                    </p>
                                ) : (
                                    <p className="mt-3 text-[10px] text-center font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                                        <TrophyIcon /> Xuất sắc!
                                    </p>
                                )}
                            </div>

                            {/* ... [Rest of Profile] ... */}
                            <div className="w-full mt-4 flex flex-wrap justify-center gap-2">
                                {record.BuyMed === 'YES' && (
                                    <div className="px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800 flex items-center gap-1 shadow-sm">
                                        <span className="text-xs">💊</span>
                                        <span className="text-[9px] font-black text-pink-700 dark:text-pink-400 uppercase tracking-wide">BuyMed</span>
                                    </div>
                                )}
                                <div className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CounterTop:</span>
                                    <span className="text-[9px] font-black text-indigo-800 dark:text-indigo-200">{record.CounterTop || 'N/A'}</span>
                                </div>
                                <div className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300">CDU:</span>
                                    <span className="text-[9px] font-black text-purple-800 dark:text-purple-200">{record.CDU || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="w-full mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-800 dark:text-white uppercase flex items-center gap-1 mb-2">
                                    <StarIcon />
                                    <span>Cập nhật trả thường ({customerRebates.length})</span>
                                </h3>
                                {customerRebates.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x custom-scrollbar">
                                        {customerRebates.map((rb, idx) => (
                                            <div key={idx} className="snap-center flex-shrink-0 w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                                <div className="flex items-start justify-between mb-1 pl-2">
                                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">Ưu đãi</span>
                                                    {rb.Group === 'IMPORT' ? <span className="text-[9px] text-blue-500 font-black">IMP</span> : <span className="text-[9px] text-green-500 font-black">LOC</span>}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 line-clamp-2 min-h-[2.4em] mb-1 pl-2" title={rb["PromotionID#program"]}>
                                                    {rb["PromotionID#program"]}
                                                </p>
                                                <div className="flex justify-between items-end border-t border-slate-100 dark:border-slate-700 pt-1 pl-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-slate-400">Còn lại</span>
                                                        <span className="text-xs font-black text-red-500">-{formatCompact(rb.RemainAmount)}</span>
                                                    </div>
                                                    <span className="text-[8px] text-slate-400 italic">Hạn: {formatDateVal(rb.EndDate || rb.Endate)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-2 text-slate-400 dark:text-slate-500 italic text-[10px] bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        Không có tin mới.
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-4 text-center w-full">
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                    <div className="scale-75"><IdentificationIcon /></div>
                                    <span className="text-[9px] font-bold uppercase">Thông tin</span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 px-2">{record.Address}, {record.District}</p>
                                {record.CodeBuyMed && (
                                    <p className="text-[9px] font-mono font-bold text-pink-500 mt-0.5">BM: {record.CodeBuyMed}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. UPDATES & STATS [REMAINING CONTENT IS IDENTICAL] */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    {/* ... (Existing code for Grid of Stats, Charts, etc.) */}
                    {/* I'll omit re-pasting the exact same JSX to save space unless necessary, but effectively it's the same block */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Stat Cards */}
                        <div onClick={() => setActiveDetailModal('T1')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-sky-300 dark:hover:border-sky-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-sky-500 transition-colors"><ClockIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400"><GiftIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">Doanh số tháng</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalActual)}</p>
                            </div>
                        </div>
                        {/* ... other cards */}
                        <div onClick={() => setActiveDetailModal('Products')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-indigo-500 transition-colors"><CubeIcon /></div>
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><CubeIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:underline">SP Đã Mua ({uniqueProductStats.length})</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(totalHistoryValue)}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full relative group">
                            <div className="absolute top-2 right-2 text-slate-300"><ClipboardDocumentListIcon /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0"><ClipboardDocumentListIcon /></div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Kênh Bán Hàng</p>
                                    <p className="text-[10px] font-bold text-slate-800 dark:text-white">{uniqueOrderDates} đơn</p>
                                </div>
                            </div>
                            <div className="mb-1.5">
                                <div className="flex justify-between text-[9px] mb-0.5">
                                    <span className="font-bold text-cyan-600 dark:text-cyan-400">GIGAMED</span>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">{gigaPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCurrency(finalGigaVal)})</span></span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${gigaPct}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] mb-0.5">
                                    <span className="font-bold text-pink-600 dark:text-pink-400">BUYMED</span>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">{bmPct.toFixed(0)}% <span className="text-[8px] opacity-70">({formatCurrency(finalBmVal)})</span></span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${bmPct}%` }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400"><FaceSmileIcon /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Điều kiện TB</p>
                                <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[80px]" title={record.Check}>{record.Check || 'N/A'}</p>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Import')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-blue-500 transition-colors"><DocumentTextIcon /></div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-blue-500 uppercase group-hover:underline">Import</p>
                                <span className="text-[9px] font-bold text-slate-400">{Math.round(getRawPercent(actualImport, targetImport))}%</span>
                            </div>
                            <ProgressBar actual={actualImport} target={targetImport} colorClass="bg-blue-500" showLabel={false} />
                            <div className="flex justify-between mt-1 text-[10px]">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actualImport)}</span>
                                <span className="text-slate-400">/ {formatCompact(targetImport)}</span>
                            </div>
                        </div>
                        <div onClick={() => setActiveDetailModal('Local')} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center cursor-pointer hover:border-green-300 dark:hover:border-green-600 transition-colors group relative">
                            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-green-500 transition-colors"><DocumentTextIcon /></div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-green-500 uppercase group-hover:underline">Local</p>
                                <span className="text-[9px] font-bold text-slate-400">{Math.round(getRawPercent(actualLocal, targetLocal))}%</span>
                            </div>
                            <ProgressBar actual={actualLocal} target={targetLocal} colorClass="bg-green-500" showLabel={false} />
                            <div className="flex justify-between mt-1 text-[10px]">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actualLocal)}</span>
                                <span className="text-slate-400">/ {formatCompact(targetLocal)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center gap-2">
                                <ClockIcon /> Lịch sử mua hàng
                            </h4>
                            <div className="flex gap-2">
                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">Import</span>
                                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-bold">Local</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar bg-white dark:bg-slate-800">
                                    {mergedHistory.length > 0 ? (
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-500 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-2 py-2">Loại</th>
                                                    <th className="px-2 py-2">Ngày</th>
                                                    <th className="px-2 py-2">Sản Phẩm</th>
                                                    <th className="px-2 py-2 text-center">SL</th>
                                                    <th className="px-2 py-2 text-right">Doanh Số</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                                {mergedHistory.map((item, i) => {
                                                    const isImport = (item.Group || item.Team || '').toLowerCase().includes('import');
                                                    const isBuyMed = (record.CodeBuyMed && String(item.CustomerID).trim() === String(record.CodeBuyMed).trim()) || (item.Note && item.Note.toLowerCase().includes('buymed'));
                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                            <td className="px-2 py-2">
                                                                <span className={`px-1.5 py-0.5 rounded-md font-black uppercase text-[8px] ${isImport ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                                                                    {isImport ? 'IMP' : 'LOC'}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{formatDateVal(item.InvoiceDate)}</td>
                                                            <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-200">
                                                                <div className="flex flex-col">
                                                                    <span className="line-clamp-1" title={item.Product}>{item.Product}</span>
                                                                    {isBuyMed && (
                                                                        <span className="text-[9px] text-pink-500 dark:text-pink-400 font-bold">
                                                                            (BM)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 text-center font-bold text-slate-800 dark:text-white">{item.Qty}</td>
                                                            <td className="px-2 py-2 text-right font-bold text-slate-600 dark:text-slate-400">{formatCurrency(item.Value)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs italic">
                                            Chưa có dữ liệu giao dịch
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals [SAME AS BEFORE] */}
            {activeDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 border border-slate-200 dark:border-slate-700 relative flex flex-col max-h-[85vh]">
                        <button onClick={() => setActiveDetailModal(null)} className="absolute top-3 right-3 p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 transition-colors z-10">✕</button>

                        {activeDetailModal === 'T1' ? (
                            <div className="overflow-y-auto custom-scrollbar">
                                {/* ... [T1 Content] ... */}
                                <div className="mb-4 text-center">
                                    <h3 className="text-lg font-black uppercase text-sky-600 dark:text-sky-400">Lịch sử Sale T1</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chi tiết thưởng doanh số tháng trước</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200 dark:border-blue-800">
                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Import T1</span>
                                            <span className="text-base font-black text-blue-800 dark:text-blue-200">{formatCurrency(actualImportT1)}</span>
                                        </div>
                                        <div className="mt-1">
                                            <div className="flex justify-between items-center text-xs mb-1.5">
                                                <span className="text-slate-500 dark:text-slate-400">Mức thưởng:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{importTierT1 ? `Lv${importTierT1.level} (${importTierT1.percent}%)` : 'Chưa đạt'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-blue-100 dark:border-slate-600">
                                                <span className="font-bold text-blue-700 dark:text-blue-400 uppercase text-xs">Thưởng:</span>
                                                <span className="font-black text-red-500 dark:text-red-400 text-base">{formatCurrency(importBonusT1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-green-200 dark:border-green-800">
                                            <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Local T1</span>
                                            <span className="text-base font-black text-green-800 dark:text-green-200">{formatCurrency(actualLocalT1)}</span>
                                        </div>
                                        <div className="mt-1">
                                            <div className="flex justify-between items-center text-xs mb-1.5">
                                                <span className="text-slate-500 dark:text-slate-400">Mức thưởng:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{localTierT1 ? `Lv${localTierT1.level} (${localTierT1.percent}%)` : 'Chưa đạt'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm bg-white dark:bg-slate-800 p-2 rounded border border-green-100 dark:border-slate-600">
                                                <span className="font-bold text-green-700 dark:text-green-400 uppercase text-xs">Thưởng:</span>
                                                <span className="font-black text-red-500 dark:text-red-400 text-base">{formatCurrency(localBonusT1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeDetailModal === 'Products' ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* ... [Products Content] ... */}
                                <div className="mb-4 text-center flex-shrink-0">
                                    <h3 className="text-lg font-black uppercase text-indigo-600 dark:text-indigo-400">Thống Kê Sản Phẩm</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Xếp hạng theo tổng doanh số giảm dần</p>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                        <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10 shadow-sm text-slate-500 dark:text-slate-300 font-bold uppercase">
                                            <tr>
                                                <th className="px-2 py-2">Tên SP</th>
                                                <th className="px-2 py-2 text-center w-10">SL</th>
                                                <th className="px-2 py-2 text-right">Tổng DS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {uniqueProductStats.length > 0 ? (
                                                uniqueProductStats.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                        <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200 align-top">{item.name}</td>
                                                        <td className="px-2 py-1.5 text-center font-bold text-slate-800 dark:text-white align-top">{item.qty}</td>
                                                        <td className="px-2 py-1.5 text-right font-black text-indigo-600 dark:text-indigo-400 align-top">{formatCurrency(item.val)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={3} className="text-center py-4 text-slate-400 italic">Chưa có dữ liệu</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-2 text-right text-xs font-bold text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    Tổng cộng: <span className="text-base text-indigo-700 dark:text-indigo-400 font-black">{formatCurrency(totalHistoryValue)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="mb-4 text-center">
                                    <h3 className={`text-lg font-black uppercase ${activeDetailModal === 'Import' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>Chi Tiết {activeDetailModal}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Doanh số hiện tại: <span className="text-slate-800 dark:text-white">{formatCurrency(activeDetailModal === 'Import' ? actualImport : actualLocal)}</span></p>
                                    {(() => {
                                        const currentActual = activeDetailModal === 'Import' ? actualImport : actualLocal;
                                        const currentTier = getRebateLevel(currentActual);
                                        const currentReward = currentTier ? currentActual * (currentTier.percent / 100) : 0;
                                        return (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                                                Tiền thưởng hiện tại: <span className="text-red-500 dark:text-red-400">{formatCurrency(currentReward)}</span>
                                                {currentTier && <span className="text-xs ml-1 text-slate-400 dark:text-slate-500 font-medium">({currentTier.percent}%)</span>}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <LevelTodoTable actual={activeDetailModal === 'Import' ? actualImport : actualLocal} />
                            </div>
                        )}
                        <div className="mt-5 text-center flex-shrink-0">
                            <button onClick={() => setActiveDetailModal(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors text-sm">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard: React.FC<DashboardProps> = ({ salesData, currentEmployee, onCustomerSelect, rebates, purchaseHistory, initialCustomerCode, onBack }) => {
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

    // NEW: State for KPI Detail Modal
    const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);
    const [kpiViewMode, setKpiViewMode] = useState<'pass' | 'fail'>('pass');
    const [kpiGroupBy, setKpiGroupBy] = useState<'customer' | 'group'>('customer');

    // 1. Logic Phân Quyền & Lọc Dữ Liệu
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
            // Use more robust comparison (Trim, String, Case-insensitive)
            const targetCode = String(initialCustomerCode).trim().toLowerCase();
            const found = userSalesData.find(r =>
                String(r.CustomerCode).trim().toLowerCase() === targetCode
            );
            if (found) {
                setSelectedCustomer(found);
            } else {
                // If not found in userSalesData (filtered), try searching in the original salesData
                const foundInAll = salesData.find(r =>
                    String(r.CustomerCode).trim().toLowerCase() === targetCode
                );
                if (foundInAll) {
                    setSelectedCustomer(foundInAll);
                }
            }
        }
    }, [initialCustomerCode, userSalesData, salesData]);

    // --- NEW: KPI Calculation Logic ---
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

    // 2. Logic Tìm Kiếm & Lọc
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
                if (activeLevelFilter.mode === 'Import') {
                    const actual = Number(record.ActualImport) || 0;
                    let highestLevel = -1;
                    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
                        if (actual >= REBATE_TIERS[i].amount) { highestLevel = i; break; }
                    }
                    if (highestLevel !== activeLevelFilter.levelIndex) matchesFilters = false;
                } else {
                    const actual = Number(record.ActualLocal) || 0;
                    let highestLevel = -1;
                    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
                        if (actual >= REBATE_TIERS[i].amount) { highestLevel = i; break; }
                    }
                    if (highestLevel !== activeLevelFilter.levelIndex) matchesFilters = false;
                }
            }
            return matchesSearch && matchesFilters;
        });
        return result.sort((a, b) => {
            const totalA = (Number(a.MustWin) || 0) + (Number(a.Other) || 0);
            const totalB = (Number(b.MustWin) || 0) + (Number(b.Other) || 0);
            return totalB - totalA;
        });
    }, [userSalesData, searchTerm, showFeeOnly, showCoverQ1, showBuyMed, trungBayFilter, activeLevelFilter]);

    // 4. Logic Thống kê Level Rebate theo Rep
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

    const renderKpiDetailModal = () => {
        if (!activeKpiModal) return null;
        let title = '';
        let data: { code: string; name: string; district: string; value: number; originalRecord: SalesRecord }[] = [];

        // Base datasets
        const allKpiData = userSalesData.map(r => ({
            code: r.CustomerCode,
            name: r.CustomerName,
            district: r.District || '',
            value: (Number(r.MustWin) || 0) + (Number(r.Other) || 0),
            originalRecord: r
        }));

        const PRODUCT_GROUPS_ALL = [
            "BUSCOPAN (B.I)", "CAL CORBIERE", "ENTEROGERMINA", "Nospa Import", "Nospa Local",
            "PHARMATON", "TELFAST", "BISOLVON", "OSTELIN", "ACEMUC", "PHOSPHALUGEL (B.I)", "MAGNE B6"
        ];
        const MUST_WIN_GROUPS = ["CAL CORBIERE", "ENTEROGERMINA"];
        const OTHER_GROUPS = PRODUCT_GROUPS_ALL.filter(g => !MUST_WIN_GROUPS.includes(g));

        const getGroupedData = (groups: string[]) => {
            const aggregated = groups.map(groupName => {
                const total = userSalesData.reduce((sum, r) => sum + (Number((r as any)[groupName]) || 0), 0);
                return { name: groupName, value: total };
            }).filter(item => item.value > 0);
            return aggregated.sort((a, b) => b.value - a.value);
        };

        const isGroupViewPossible = ['Total', 'MustWin', 'Other'].includes(activeKpiModal);

        if (kpiGroupBy === 'group' && isGroupViewPossible) {
            switch (activeKpiModal) {
                case 'Total':
                    title = 'KPI theo Nhóm Sản Phẩm (Total)';
                    const groupedTotal = getGroupedData(PRODUCT_GROUPS_ALL);
                    data = groupedTotal.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                    break;
                case 'MustWin':
                    title = 'KPI theo Nhóm Sản Phẩm (Must Win)';
                    const groupedMW = getGroupedData(MUST_WIN_GROUPS);
                    data = groupedMW.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                    break;
                case 'Other':
                    title = 'KPI theo Nhóm Sản Phẩm (Other)';
                    const groupedOther = getGroupedData(OTHER_GROUPS);
                    data = groupedOther.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                    break;
            }
        } else {
            switch (activeKpiModal) {
                case 'Total':
                    title = 'Danh sách Total Sales';
                    data = allKpiData.filter(item => item.value > 0);
                    break;
                case 'MustWin':
                    title = 'Danh sách Must Win';
                    data = userSalesData.map(r => ({
                        code: r.CustomerCode,
                        name: r.CustomerName,
                        district: r.District || '',
                        value: Number(r.MustWin) || 0,
                        originalRecord: r
                    })).filter(item => item.value > 0);
                    break;
                case 'Other':
                    title = 'Danh sách Other';
                    data = userSalesData.map(r => ({
                        code: r.CustomerCode,
                        name: r.CustomerName,
                        district: r.District || '',
                        value: Number(r.Other) || 0,
                        originalRecord: r
                    })).filter(item => item.value > 0);
                    break;
                case 'Active':
                    title = kpiViewMode === 'pass' ? 'Danh sách Active (>0)' : 'Danh sách Chưa Active (=0)';
                    data = allKpiData.filter(item => kpiViewMode === 'pass' ? item.value > 0 : item.value === 0);
                    break;
                case 'AO':
                    title = kpiViewMode === 'pass' ? 'Danh sách AO (>3 Tr)' : 'Danh sách Chưa đạt AO (<=3 Tr)';
                    data = allKpiData.filter(item => {
                        if (kpiViewMode === 'pass') return item.value > 3000000;
                        return item.value <= 3000000;
                    });
                    break;
                case 'MSO':
                    title = kpiViewMode === 'pass' ? 'Danh sách MSO (>9 Tr)' : 'Danh sách Chưa đạt MSO (<=9 Tr)';
                    data = allKpiData.filter(item => {
                        if (kpiViewMode === 'pass') return item.value > 9000000;
                        return item.value <= 9000000;
                    });
                    break;
            }
        }

        // Always sort by value DESC
        data.sort((a, b) => b.value - a.value);

        const totalValue = data.reduce((sum, item) => sum + item.value, 0);
        const handleRowClick = (record: SalesRecord) => { setSelectedCustomer(record); setActiveKpiModal(null); };

        const showToggle = ['Active', 'AO', 'MSO'].includes(activeKpiModal);

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-800 rounded-t-2xl">
                        <div>
                            <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white">{title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {kpiViewMode === 'pass' ? 'Tổng cộng đạt: ' : 'Số lượng: '}
                                <span className="font-bold text-sky-600 dark:text-sky-400">
                                    {kpiViewMode === 'pass' ? formatCompact(totalValue) : `${data.length} KH`}
                                </span>
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button onClick={() => { setActiveKpiModal(null); setKpiViewMode('pass'); setKpiGroupBy('customer'); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">✕</button>
                            {showToggle && (
                                <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg border border-slate-300 dark:border-slate-600">
                                    <button
                                        onClick={() => setKpiViewMode('pass')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'pass' ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Đạt
                                    </button>
                                    <button
                                        onClick={() => setKpiViewMode('fail')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'fail' ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Chưa đạt
                                    </button>
                                </div>
                            )}
                            {isGroupViewPossible && (
                                <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg border border-slate-300 dark:border-slate-600">
                                    <button
                                        onClick={() => setKpiGroupBy('customer')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiGroupBy === 'customer' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Khách hàng
                                    </button>
                                    <button
                                        onClick={() => setKpiGroupBy('group')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiGroupBy === 'group' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Sản phẩm
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold sticky top-0 z-10 shadow-sm"><tr><th className="px-3 py-2">Khách Hàng</th><th className="px-3 py-2 text-right">Doanh Số</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {data.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${item.code !== 'GROUP' ? 'cursor-pointer group' : ''}`}
                                        onClick={() => item.code !== 'GROUP' && handleRowClick(item.originalRecord)}
                                    >
                                        <td className="px-3 py-2">
                                            <div className={`font-bold text-slate-700 dark:text-slate-200 ${item.code !== 'GROUP' ? 'group-hover:text-sky-600 dark:group-hover:text-sky-400' : ''} transition-colors`}>
                                                {item.name}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                                {item.code !== 'GROUP' ? (
                                                    <><span>{item.code}</span><span>• {item.district}</span></>
                                                ) : (
                                                    <span>Nhóm sản phẩm</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white truncate">
                                            {formatCurrency(item.value)}
                                        </td>
                                    </tr>
                                ))}
                                {data.length === 0 && <tr><td colSpan={2} className="text-center py-4 text-slate-400 italic">Không có dữ liệu</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center"><button onClick={() => setActiveKpiModal(null)} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold shadow hover:bg-slate-900 transition-colors">Đóng</button></div>
                </div>
            </div>
        );
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
            />
        );
    }

    // Otherwise show the list view
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

            {renderKpiDetailModal()}

            {/* --- NEW KPI TRACKING SECTION (NEON STYLE) --- */}
            {showKPISection && (
                <div className="mb-6 px-2">
                    <div className="bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-700 relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                        <h3 className="text-sm font-black text-white uppercase mb-6 flex items-center gap-2 relative z-10">
                            <RocketLaunchIcon /> Theo dõi chỉ tiêu Q1
                        </h3>

                        {/* Circular Progress Row */}
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

                        {/* Linear Progress Row */}
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

            {/* Level Rebate Statistics Table (NEW) */}
            <div className="mb-6 px-2">
                {/* ... [Level Table - Identical to previous] ... */}
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

                                {/* Hàng Tổng Kết Admin */}
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

            {/* Customer List */}
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
                        {/* Search Bar Updated Design */}
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
                        filteredData.map((record, idx) => {
                            const checkStatus = record.Check || '';
                            const isFail = checkStatus.toLowerCase().includes('rớt') || checkStatus.toLowerCase() === 'fail';
                            const isPass = checkStatus.toLowerCase().includes('đạt') || checkStatus.toLowerCase() === 'pass';
                            const todoImport = Number(record.TodoImport) || 0;
                            const todoLocal = Number(record.TodoLocal) || 0;
                            const todoTotal = Number(record.Todo) || 0;

                            return (
                                <div key={`${record.CustomerCode}-${idx}`} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    {/* ... [Customer List Item] ... */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 mr-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    onClick={() => setSelectedCustomer(record)}
                                                    className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer hover:text-sky-600 dark:hover:text-sky-400"
                                                >
                                                    {record.CustomerName}
                                                </span>
                                                {record.FinalStoreType && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${record.FinalStoreType.includes('Gold') ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' :
                                                        record.FinalStoreType.includes('Silver') ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' :
                                                            'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 border-amber-100 dark:border-amber-800'
                                                        }`}>
                                                        {record.FinalStoreType}
                                                    </span>
                                                )}
                                            </div>
                                            <p
                                                onClick={() => onCustomerSelect(String(record.CustomerCode || ''))}
                                                className="text-lg text-sky-600 dark:text-sky-400 font-mono font-black cursor-pointer hover:underline hover:text-sky-800 dark:hover:text-sky-300 transition-colors w-max mt-0.5"
                                                title="Click để tạo đơn hàng cho khách này"
                                            >
                                                {record.CustomerCode}
                                            </p>

                                            {record.CodeBuyMed && (
                                                <p className="text-[10px] text-pink-600 dark:text-pink-400 font-mono font-bold mt-0.5">
                                                    BM: {record.CodeBuyMed}
                                                </p>
                                            )}

                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic leading-tight">
                                                {record.Address}{record.District ? `, ${record.District}` : ''}{record.Province ? `, ${record.Province}` : ''}
                                            </p>

                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                {record.CoverQ1 === 'YES' && <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded shadow-sm">Cover Q1: YES</span>}
                                                {record.BuyMed === 'YES' && <span className="text-[9px] font-bold bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300 border border-pink-200 dark:border-pink-800 px-2 py-1 rounded shadow-sm">BuyMed: YES</span>}
                                                {record.CounterTop && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${String(record.CounterTop).toLowerCase().includes('rớt') ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'}`}>CounterTop: {record.CounterTop}</span>}
                                                {record.CDU && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${String(record.CDU).toLowerCase().includes('rớt') ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'}`}>CDU: {record.CDU}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            {checkStatus && (
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase mb-1 flex items-center gap-1 ${isFail ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : isPass ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                    {checkStatus}
                                                    {isFail && <span className="transform scale-75"><FaceFrownIcon /></span>}
                                                    {isPass && <span className="transform scale-75"><FaceSmileIcon /></span>}
                                                </span>
                                            )}
                                            {record.GPP && <span className="text-[9px] text-slate-400 dark:text-slate-500">GPP: {formatDateVal(record.GPP)}</span>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 my-3 bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5"><span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase">Import</span>{(record.UpdateTienThuongImport || 0) > 0 && (<span className="text-[8px] bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-1 rounded font-bold">+ {formatCurrency(record.UpdateTienThuongImport || 0)}</span>)}</div>
                                            <MiniProgressBar label="Giga" actual={Number(record.ActualImportGiga) || 0} totalTarget={Number(record.TargetImport) || 0} barColor="bg-cyan-500" />
                                            <MiniProgressBar label="BuyMed" actual={Number(record.ActualImportBuyMed) || 0} totalTarget={Number(record.TargetImport) || 0} barColor="bg-pink-500" />
                                            <ProgressBar actual={Number(record.ActualImport) || 0} target={Number(record.TargetImport) || 0} colorClass="bg-blue-500" />
                                            {todoImport !== 0 && (<div className={`mt-1 flex justify-between text-[13px] font-bold px-1.5 py-0.5 rounded ${todoImport > 0 ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}><span>Todo:</span><span>{formatCurrency(todoImport)}</span></div>)}
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5"><span className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase">Local</span>{(record.UpdateTienThuongLocal || 0) > 0 && (<span className="text-[8px] bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-1 rounded font-bold">+ {formatCurrency(record.UpdateTienThuongLocal || 0)}</span>)}</div>
                                            <MiniProgressBar label="Giga" actual={Number(record.ActualLocalGiga) || 0} totalTarget={Number(record.TargetLocal) || 0} barColor="bg-cyan-500" />
                                            <MiniProgressBar label="BuyMed" actual={Number(record.ActualLocalBuyMed) || 0} totalTarget={Number(record.TargetLocal) || 0} barColor="bg-pink-500" />
                                            <ProgressBar actual={Number(record.ActualLocal) || 0} target={Number(record.TargetLocal) || 0} colorClass="bg-green-500" />
                                            {todoLocal !== 0 && (<div className={`mt-1 flex justify-between text-[13px] font-bold px-1.5 py-0.5 rounded ${todoLocal > 0 ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'}`}><span>Todo:</span><span>{formatCurrency(todoLocal)}</span></div>)}
                                        </div>
                                    </div>

                                    {(todoTotal !== 0 || Number(record.Sale) > 0) && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[13px]">
                                            {todoTotal !== 0 && (<div className={`flex-1 px-2 py-1 rounded font-bold border flex justify-between ${todoTotal > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900'}`}><span>TRUNGBAY TODO:</span><span>{formatCurrency(todoTotal)}</span></div>)}
                                            {Number(record.Sale) > 0 && (<div className="flex-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-600 flex justify-between"><span>Sale T1:</span><span>{formatCurrency(record.Sale || 0)}</span></div>)}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;