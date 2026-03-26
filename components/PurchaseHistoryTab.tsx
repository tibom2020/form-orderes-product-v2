import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PurchaseHistoryItem, SalesRecord, Employee } from '../types';
import { formatCurrency, removeVietnameseTones } from '../utils/formatters';
import { SearchIcon, CubeIcon, ClockIcon, InfoIcon, CartIcon } from './icons';

type ChannelFilter = 'all' | 'gg' | 'bm';
type TypeFilter = 'all' | 'import' | 'local';

const getMonthKeyFromInvoiceDate = (d: string | number | undefined): string | null => {
    if (d == null || d === '') return null;
    let date: Date;
    if (typeof d === 'number') {
        date = new Date((d - 25569) * 86400 * 1000);
    } else {
        const str = String(d);
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            } else {
                date = new Date(str);
            }
        } else {
            date = new Date(str);
        }
    }
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
};

const formatMonthLabel = (key: string): string => {
    const [y, m] = key.split('-');
    return `${m}/${y}`;
};

const parseRowDateParts = (d: string | number | undefined): { dd: string; mm: string; yyyy: string } | null => {
    if (d == null || d === '') return null;
    let date: Date;
    if (typeof d === 'number') {
        date = new Date((d - 25569) * 86400 * 1000);
    } else {
        const str = String(d);
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            } else {
                date = new Date(str);
            }
        } else {
            date = new Date(str);
        }
    }
    if (isNaN(date.getTime())) return null;
    const dd = date.getDate().toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return { dd, mm, yyyy: String(date.getFullYear()) };
};

const isImportRow = (h: PurchaseHistoryItem) => (h.Group || h.Team || '').toLowerCase().includes('import');
const isLocalRow = (h: PurchaseHistoryItem) => (h.Group || h.Team || '').toLowerCase().includes('local');
const isBmRow = (h: PurchaseHistoryItem) => h.HistorySource === 'BM';

interface PurchaseHistoryTabProps {
    purchaseHistory: PurchaseHistoryItem[];
    salesRecords: SalesRecord[];
    currentEmployee: Employee;
    onCustomerSelect: (code: string) => void;
    onReloadData?: () => void;
}

const PurchaseHistoryTab: React.FC<PurchaseHistoryTabProps> = ({
    purchaseHistory,
    salesRecords,
    currentEmployee,
    onCustomerSelect,
    onReloadData,
}) => {
    const [subView, setSubView] = useState<'customer' | 'product'>('customer');

    const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [productFilter, setProductFilter] = useState<string>('all');
    const [customerCodeQuery, setCustomerCodeQuery] = useState('');
    const [customerNameQuery, setCustomerNameQuery] = useState('');
    const [addressQuery, setAddressQuery] = useState('');

    const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
    const [nameSuggestHighlight, setNameSuggestHighlight] = useState(0);
    const nameSearchWrapRef = useRef<HTMLDivElement>(null);
    const nameSearchInputRef = useRef<HTMLInputElement>(null);

    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [productCustomerSearch, setProductCustomerSearch] = useState('');
    const [showExportNoticeModal, setShowExportNoticeModal] = useState(false);
    const [includeProductInExport, setIncludeProductInExport] = useState(true);
    const [isExportingHistory, setIsExportingHistory] = useState(false);

    const salesByCode = useMemo(() => {
        const m = new Map<string, SalesRecord>();
        salesRecords.forEach((r) => {
            const c = String(r.CustomerCode || '').trim();
            if (c) m.set(c, r);
            const bm = r.CodeBuyMed ? String(r.CodeBuyMed).trim() : '';
            if (bm) m.set(bm, r);
        });
        return m;
    }, [salesRecords]);

    const userScopedHistory = useMemo(() => {
        const ADMIN_CODE = '20043741';
        if (currentEmployee.code === ADMIN_CODE) return purchaseHistory;
        const empCode = String(currentEmployee.code || '').trim();
        const empName = removeVietnameseTones(String(currentEmployee.name || '')).toLowerCase().trim();

        return purchaseHistory.filter((h) => {
            const rec = salesByCode.get(String(h.CustomerID || '').trim());
            if (!rec) return false;
            const recStaffCode = String(rec.StaffCode || '').trim();
            const recRep = removeVietnameseTones(String(rec.Rep || '')).toLowerCase().trim();
            return recStaffCode === empCode || (empName && recRep === empName);
        });
    }, [purchaseHistory, currentEmployee, salesByCode]);

    const resolveCustomerName = (code: string, fallback?: string): string => {
        const rec = salesByCode.get(String(code).trim());
        if (rec?.CustomerName) return rec.CustomerName;
        if (fallback) return fallback;
        return `Mã ${code}`;
    };

    const resolveDistrict = (code: string): string => {
        const rec = salesByCode.get(String(code).trim());
        const d = rec?.District;
        const p = rec?.Province;
        if (d && p) return `${d}, ${p}`;
        if (d) return d;
        if (p) return p;
        return rec?.Address || '—';
    };

    const getAddressSearchText = (code: string): string => {
        const rec = salesByCode.get(String(code).trim());
        if (!rec) return '';
        return [rec.Address, rec.District, rec.Province].filter(Boolean).join(' ');
    };

    const resolveNavigateCustomerCode = (code: string): string => {
        const rec = salesByCode.get(String(code).trim());
        return rec?.CustomerCode ? String(rec.CustomerCode).trim() : String(code).trim();
    };

    const baseFiltered = useMemo(() => {
        return userScopedHistory.filter((h) => {
            if (channelFilter === 'gg' && h.HistorySource !== 'GG') return false;
            if (channelFilter === 'bm' && h.HistorySource !== 'BM') return false;
            if (typeFilter === 'import' && !isImportRow(h)) return false;
            if (typeFilter === 'local' && !isLocalRow(h)) return false;
            if (monthFilter !== 'all' && getMonthKeyFromInvoiceDate(h.InvoiceDate) !== monthFilter) return false;
            if (productFilter !== 'all' && (h.Product || '').trim() !== productFilter) return false;
            return true;
        });
    }, [userScopedHistory, channelFilter, typeFilter, monthFilter, productFilter]);

    /** Danh sách KH duy nhất trong lịch sử đã lọc — dùng cho autocomplete. */
    const customerSearchOptions = useMemo(() => {
        const idToFallback = new Map<string, string | undefined>();
        baseFiltered.forEach((h) => {
            const id = String(h.CustomerID || '').trim();
            if (!id) return;
            if (!idToFallback.has(id)) idToFallback.set(id, h.CustomerName);
        });
        const rows = [...idToFallback.keys()].map((historyId) => {
            const name = resolveCustomerName(historyId, idToFallback.get(historyId));
            const code = resolveNavigateCustomerCode(historyId);
            const addrLine = getAddressSearchText(historyId);
            const fallback = resolveDistrict(historyId);
            const address = addrLine || (fallback === '—' ? '' : fallback);
            return { historyId, name, code, address };
        });
        return rows.sort((a, b) =>
            removeVietnameseTones(a.name).localeCompare(removeVietnameseTones(b.name), 'vi')
        );
    }, [baseFiltered, salesByCode]);

    const filteredCustomerSearchOptions = useMemo(() => {
        const q = removeVietnameseTones(customerNameQuery).toLowerCase().trim();
        const list = !q
            ? customerSearchOptions
            : customerSearchOptions.filter((o) => {
                  const n = removeVietnameseTones(o.name).toLowerCase();
                  const c = String(o.code).toLowerCase();
                  const a = removeVietnameseTones(o.address).toLowerCase();
                  const hid = String(o.historyId).toLowerCase();
                  return n.includes(q) || c.includes(q) || a.includes(q) || hid.includes(q);
              });
        return list.slice(0, 50);
    }, [customerSearchOptions, customerNameQuery]);

    useEffect(() => {
        setNameSuggestHighlight(0);
    }, [filteredCustomerSearchOptions.length, customerNameQuery]);

    useEffect(() => {
        if (!nameSuggestOpen) return;
        const onDoc = (e: MouseEvent) => {
            const el = nameSearchWrapRef.current;
            if (el && !el.contains(e.target as Node)) setNameSuggestOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [nameSuggestOpen]);

    const applyCustomerPick = (o: { name: string; code: string; address: string }) => {
        setCustomerNameQuery(o.name);
        setCustomerCodeQuery(o.code);
        setAddressQuery(o.address);
        setNameSuggestOpen(false);
    };

    const uniqueMonths = useMemo(() => {
        const set = new Set<string>();
        baseFiltered.forEach((h) => {
            const k = getMonthKeyFromInvoiceDate(h.InvoiceDate);
            if (k) set.add(k);
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [baseFiltered]);

    const uniqueProducts = useMemo(() => {
        const set = new Set<string>();
        baseFiltered.forEach((h) => {
            const p = (h.Product || '').trim();
            if (p) set.add(p);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [baseFiltered]);

    useEffect(() => {
        if (subView === 'product' && selectedProduct && !uniqueProducts.includes(selectedProduct)) {
            setSelectedProduct(uniqueProducts[0] || '');
        }
    }, [subView, uniqueProducts, selectedProduct]);

    const customerViewRows = useMemo(() => {
        const codeQ = customerCodeQuery.trim().toLowerCase();
        const nameQ = removeVietnameseTones(customerNameQuery).toLowerCase().trim();
        const addrQ = removeVietnameseTones(addressQuery).toLowerCase().trim();

        return baseFiltered.filter((h) => {
            const id = String(h.CustomerID || '').trim();
            if (codeQ && !id.toLowerCase().includes(codeQ)) return false;

            const resolvedName = resolveCustomerName(id, h.CustomerName);
            if (nameQ && !removeVietnameseTones(resolvedName || '').toLowerCase().includes(nameQ)) return false;

            if (addrQ) {
                const addrText = removeVietnameseTones(
                    `${getAddressSearchText(id)} ${resolveDistrict(id)}`
                ).toLowerCase();
                if (!addrText.includes(addrQ)) return false;
            }
            return true;
        });
    }, [baseFiltered, customerCodeQuery, customerNameQuery, addressQuery, salesByCode]);

    const customerSummary = useMemo(() => {
        const totalQty = customerViewRows.reduce((s, h) => s + (Number(h.Qty) || 0), 0);
        const totalVal = customerViewRows.reduce((s, h) => s + (Number(h.Value) || 0), 0);
        return { count: customerViewRows.length, totalQty, totalVal };
    }, [customerViewRows]);

    const productAggregates = useMemo(() => {
        if (!selectedProduct) return { totalQty: 0, customerCount: 0, rows: [] as { code: string; name: string; district: string; qty: number; val: number; hasBm: boolean }[] };
        const map = new Map<string, { qty: number; val: number; name?: string; hasBm: boolean }>();
        baseFiltered
            .filter((h) => (h.Product || '').trim() === selectedProduct)
            .forEach((h) => {
                const code = String(h.CustomerID).trim();
                const cur = map.get(code) || { qty: 0, val: 0, name: h.CustomerName, hasBm: false };
                map.set(code, {
                    qty: cur.qty + (Number(h.Qty) || 0),
                    val: cur.val + (Number(h.Value) || 0),
                    name: cur.name || h.CustomerName,
                    hasBm: cur.hasBm || isBmRow(h),
                });
            });
        const rows = Array.from(map.entries())
            .map(([code, v]) => {
                const mappedName = salesByCode.get(code)?.CustomerName?.trim() || '';
                const historyName = String(v.name || '').trim();
                const displayName = mappedName || historyName;
                return {
                    code,
                    name: displayName,
                    district: resolveDistrict(code),
                    qty: v.qty,
                    val: v.val,
                    hasBm: v.hasBm,
                };
            })
            .filter((row) => !!row.name);
        const q = productCustomerSearch.trim();
        const filtered = q
            ? rows.filter((r) => {
                const t = removeVietnameseTones(q).toLowerCase();
                return (
                    removeVietnameseTones(r.name).toLowerCase().includes(t) ||
                    String(r.code).toLowerCase().includes(t)
                );
            })
            : rows;
        const totalQty = filtered.reduce((s, r) => s + r.qty, 0);
        return { totalQty, customerCount: filtered.length, rows: filtered.sort((a, b) => b.val - a.val) };
    }, [baseFiltered, selectedProduct, productCustomerSearch, salesByCode]);

    const buildCustomerExportMessage = (includeProducts: boolean): string => {
        const lines = [
            '📊 LỊCH SỬ MUA HÀNG (Tổng hợp)',
            '--------------------------------',
            `Kênh: ${channelFilter === 'all' ? 'Tất cả' : channelFilter === 'gg' ? 'GG' : 'BM'}`,
            `Loại: ${typeFilter === 'all' ? 'Tất cả' : typeFilter === 'import' ? 'IMPORT' : 'LOCAL'}`,
            `Tháng: ${monthFilter === 'all' ? 'Tất cả' : formatMonthLabel(monthFilter)}`,
            `Sản phẩm: ${productFilter === 'all' ? 'Tất cả' : productFilter}`,
            `Giao dịch: ${customerSummary.count} | SL: ${customerSummary.totalQty} | Giá trị: ${formatCurrency(customerSummary.totalVal)}`,
            '',
            ...customerViewRows.map((h, i) => {
                const parts = parseRowDateParts(h.InvoiceDate);
                const d = parts ? `${parts.dd}/${parts.mm}/${parts.yyyy}` : '—';
                const ch = h.HistorySource === 'BM' ? 'BM' : 'GG';
                const imp = isImportRow(h) ? 'IMP' : isLocalRow(h) ? 'LOC' : '';
                const productPart = includeProducts ? `${h.Product} | ` : '';
                return `${i + 1}. ${d} | ${productPart}${h.CustomerID} | ${ch}${imp ? ` ${imp}` : ''} | SL ${h.Qty} | ${formatCurrency(Number(h.Value) || 0)}`;
            }),
        ];
        return lines.join('\n');
    };

    const handleExportCustomerView = async () => {
        try {
            await navigator.clipboard.writeText(buildCustomerExportMessage(includeProductInExport));
            alert('Đã sao chép nội dung lịch sử.');
        } catch {
            alert('Không thể sao chép.');
        }
    };

    const renderCustomerExportContent = (includeProducts: boolean) => {
        return (
            <div className="font-mono text-[11px] leading-relaxed space-y-1">
                <div className="font-black text-opella-green dark:text-opella-green text-sm">📊 LỊCH SỬ MUA HÀNG (Tổng hợp)</div>
                <div className="text-slate-400 dark:text-slate-500">--------------------------------</div>
                <div><span className="text-slate-500 dark:text-slate-400">Kênh:</span> <span className="font-bold text-slate-800 dark:text-white">{channelFilter === 'all' ? 'Tất cả' : channelFilter === 'gg' ? 'GG' : 'BM'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Loại:</span> <span className="font-bold text-slate-800 dark:text-white">{typeFilter === 'all' ? 'Tất cả' : typeFilter === 'import' ? 'IMPORT' : 'LOCAL'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Tháng:</span> <span className="font-bold text-slate-800 dark:text-white">{monthFilter === 'all' ? 'Tất cả' : formatMonthLabel(monthFilter)}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Sản phẩm:</span> <span className="font-bold text-slate-800 dark:text-white">{productFilter === 'all' ? 'Tất cả' : productFilter}</span></div>
                <div className="h-2" />
                <div><span className="text-slate-500 dark:text-slate-400">Giao dịch:</span> <span className="font-bold text-slate-800 dark:text-white">{customerSummary.count}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Tổng SL:</span> <span className="font-bold text-slate-800 dark:text-white">{customerSummary.totalQty}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">Tổng giá trị:</span> <span className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(customerSummary.totalVal)}</span></div>
                <div className="h-2" />
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Chi tiết</div>
                {customerViewRows.length > 0 ? (
                    <div className="space-y-1 max-h-[260px] overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg p-2 bg-slate-50/80 dark:bg-slate-900/40">
                        {customerViewRows.map((h, i) => {
                            const parts = parseRowDateParts(h.InvoiceDate);
                            const d = parts ? `${parts.dd}/${parts.mm}/${parts.yyyy}` : '—';
                            const ch = h.HistorySource === 'BM' ? 'BM' : 'GG';
                            const imp = isImportRow(h) ? 'IMP' : isLocalRow(h) ? 'LOC' : '';
                            const bm = isBmRow(h);
                            return (
                                <div key={`${h.CustomerID}-${h.Product}-${i}`} className="text-[10px]">
                                    <span className="text-slate-500 dark:text-slate-400">{i + 1}. {d}</span>{' '}
                                    {includeProducts && <span className={`font-bold ${bm ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{h.Product}</span>}
                                    {includeProducts && <span className="text-slate-400"> | </span>}
                                    <span className={`font-bold ${bm ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{h.CustomerID}</span>
                                    <span className="text-slate-500"> | {ch}{imp ? ` ${imp}` : ''} | SL {h.Qty} | </span>
                                    <span className="font-bold text-opella-green">{formatCurrency(Number(h.Value) || 0)}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : <div className="text-slate-400 italic">Chưa có dữ liệu giao dịch.</div>}
            </div>
        );
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto px-1 sm:px-2 lg:px-4 pb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#f2f4f5] dark:bg-slate-800 text-[#003725] dark:text-opella-green">
                        <ClockIcon />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-lg sm:text-xl text-[#003725] dark:text-white tracking-tight">LỊCH SỬ MUA HÀNG</h1>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Dữ liệu từ HISTORY_GG & HISTORY_BM</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {onReloadData && (
                        <button
                            type="button"
                            onClick={() => onReloadData()}
                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Tải lại dữ liệu
                        </button>
                    )}
                </div>
            </div>

            <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mb-4">
                <button
                    type="button"
                    onClick={() => setSubView('customer')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wide rounded-lg transition-colors ${subView === 'customer' ? 'bg-[#0d4f38] text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Theo khách hàng
                </button>
                <button
                    type="button"
                    onClick={() => setSubView('product')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wide rounded-lg transition-colors ${subView === 'product' ? 'bg-[#0d4f38] text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Theo sản phẩm
                </button>
            </div>

            {subView === 'customer' && (
                <div className="space-y-4 animate-fade-in">
                    <header className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-opella-beige/95 dark:bg-[#1a3028]/95 backdrop-blur rounded-b-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h2 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wide">Bộ lọc</h2>
                            <button
                                type="button"
                                onClick={() => setShowExportNoticeModal(true)}
                                className="px-3 py-1.5 bg-[#0d4f38] text-white text-[10px] font-bold rounded-lg hover:opacity-90 uppercase tracking-tight"
                            >
                                Xuất thông báo
                            </button>
                        </div>
                        <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
                            <div className="flex items-center gap-2 flex-shrink-0 bg-[#f2f4f5] dark:bg-slate-800 p-1 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2 uppercase tracking-widest">Kênh</span>
                                {(['all', 'gg', 'bm'] as const).map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setChannelFilter(k)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${channelFilter === k ? 'bg-[#003725] text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        {k === 'all' ? 'All' : k === 'gg' ? 'GG' : 'BM'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 bg-[#f2f4f5] dark:bg-slate-800 p-1 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2 uppercase tracking-widest">Loại</span>
                                {(['all', 'import', 'local'] as const).map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setTypeFilter(k)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === k ? 'bg-[#003725] text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        {k === 'all' ? 'All' : k === 'import' ? 'IMPORT' : 'LOCAL'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative">
                                <select
                                    value={monthFilter}
                                    onChange={(e) => setMonthFilter(e.target.value)}
                                    className="w-full appearance-none bg-[#e1e3e4] dark:bg-slate-700 border-none rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-[#003725]/20"
                                >
                                    <option value="all">THÁNG: Tất cả</option>
                                    {uniqueMonths.map((m) => (
                                        <option key={m} value={m}>
                                            Tháng {formatMonthLabel(m)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={productFilter}
                                    onChange={(e) => setProductFilter(e.target.value)}
                                    className="w-full appearance-none bg-[#e1e3e4] dark:bg-slate-700 border-none rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-[#003725]/20"
                                >
                                    <option value="all">SẢN PHẨM: Tất cả</option>
                                    {uniqueProducts.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </header>

                    <section className="grid grid-cols-3 gap-2 px-1">
                        <div className="bg-[#f2f4f5] dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-2 rounded-xl shadow-sm flex flex-col items-center border border-slate-200/60 dark:border-slate-600">
                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-70 leading-tight mb-0.5 text-center">Tổng giao dịch</span>
                            <span className="font-extrabold text-sm text-[#0d4f38] dark:text-opella-green">{customerSummary.count}</span>
                        </div>
                        <div className="bg-[#f2f4f5] dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-2 rounded-xl shadow-sm flex flex-col items-center border border-slate-200/60 dark:border-slate-600">
                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-70 leading-tight mb-0.5 text-center">Tổng SL</span>
                            <span className="font-extrabold text-sm text-[#0d4f38] dark:text-opella-green">{customerSummary.totalQty}</span>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 px-2 py-2 rounded-xl shadow-sm flex flex-col items-center border border-rose-200/50 dark:border-rose-800/50">
                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-80 leading-tight mb-0.5 text-center">Tổng DS</span>
                            <span className="font-extrabold text-xs text-[#ba1a1a] dark:text-rose-300 text-center leading-tight">{formatCurrency(customerSummary.totalVal)}</span>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="px-1 mb-2 rounded-xl border border-slate-300/60 dark:border-slate-600 overflow-hidden shadow-sm bg-[#faf8f5] dark:bg-slate-800/60">
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#0d4f38] dark:bg-[#0a3d2c] text-white">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-white shrink-0">
                                        <CartIcon />
                                    </span>
                                    <span className="font-black text-xs sm:text-sm uppercase tracking-wide truncate">Chi tiết đơn hàng</span>
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 whitespace-nowrap">{customerViewRows.length} giao dịch</span>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="flex gap-2 items-end">
                                    <div className="w-[88px] sm:w-28 shrink-0">
                                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Mã KH</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={customerCodeQuery}
                                            onChange={(e) => setCustomerCodeQuery(e.target.value)}
                                            placeholder="Mã..."
                                            className="w-full px-2 py-2 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white placeholder:italic placeholder:text-slate-400 focus:ring-2 focus:ring-[#003725]/25 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        title="Gõ tên hoặc mã để lọc gợi ý. Chọn một dòng trong danh sách để điền mã Giga và địa chỉ từ DOANH_SO."
                                        className="shrink-0 h-[38px] w-10 flex items-center justify-center rounded-lg border border-slate-300/80 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors mb-0.5"
                                        aria-label="Gợi ý tìm kiếm"
                                    >
                                        <InfoIcon />
                                    </button>
                                    <div className="flex-1 min-w-0" ref={nameSearchWrapRef}>
                                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Tìm kiếm tên khách hàng</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400 z-[1]">
                                                <SearchIcon />
                                            </div>
                                            <input
                                                ref={nameSearchInputRef}
                                                type="text"
                                                autoComplete="off"
                                                value={customerNameQuery}
                                                onChange={(e) => {
                                                    setCustomerNameQuery(e.target.value);
                                                    setNameSuggestOpen(true);
                                                }}
                                                onFocus={() => {
                                                    if (customerSearchOptions.length) setNameSuggestOpen(true);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (!nameSuggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && filteredCustomerSearchOptions.length) {
                                                        setNameSuggestOpen(true);
                                                        return;
                                                    }
                                                    if (!nameSuggestOpen) return;
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setNameSuggestHighlight((i) =>
                                                            Math.min(i + 1, Math.max(0, filteredCustomerSearchOptions.length - 1))
                                                        );
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setNameSuggestHighlight((i) => Math.max(i - 1, 0));
                                                    } else if (e.key === 'Enter' && filteredCustomerSearchOptions[nameSuggestHighlight]) {
                                                        e.preventDefault();
                                                        applyCustomerPick(filteredCustomerSearchOptions[nameSuggestHighlight]);
                                                    } else if (e.key === 'Escape') {
                                                        setNameSuggestOpen(false);
                                                    }
                                                }}
                                                placeholder="Nhập tên KH..."
                                                className="block w-full pl-9 pr-16 py-2 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-white placeholder:italic placeholder:text-slate-400 focus:ring-2 focus:ring-[#003725]/25 outline-none"
                                            />
                                            <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none text-slate-400 text-[10px]">
                                                {nameSuggestOpen ? '▲' : '▼'}
                                            </div>
                                            {customerNameQuery ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomerNameQuery('');
                                                        setCustomerCodeQuery('');
                                                        setAddressQuery('');
                                                        setNameSuggestOpen(false);
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                                                    aria-label="Xóa tên"
                                                >
                                                    ✕
                                                </button>
                                            ) : null}
                                            {nameSuggestOpen && filteredCustomerSearchOptions.length > 0 ? (
                                                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg">
                                                    {filteredCustomerSearchOptions.map((o, idx) => (
                                                        <button
                                                            key={`${o.historyId}-${o.code}-${idx}`}
                                                            type="button"
                                                            onMouseDown={(ev) => {
                                                                ev.preventDefault();
                                                                applyCustomerPick(o);
                                                            }}
                                                            onMouseEnter={() => setNameSuggestHighlight(idx)}
                                                            className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors ${
                                                                idx === nameSuggestHighlight
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40'
                                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                                            }`}
                                                        >
                                                            <div className="font-black text-[11px] sm:text-xs text-slate-900 dark:text-white uppercase tracking-tight leading-snug">
                                                                {o.name}
                                                            </div>
                                                            <div className="flex justify-between gap-2 mt-1 text-[10px] leading-snug">
                                                                <span className="text-slate-600 dark:text-slate-300 font-mono shrink-0">{o.code}</span>
                                                                <span className="text-slate-500 dark:text-slate-400 italic text-right line-clamp-2 flex-1 min-w-0 break-words">
                                                                    {o.address || '—'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : nameSuggestOpen &&
                                              customerNameQuery.trim() &&
                                              filteredCustomerSearchOptions.length === 0 ? (
                                                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 text-[11px] text-slate-500 italic">
                                                    Không có khách khớp trong lịch sử đã lọc.
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Địa chỉ</label>
                                    <input
                                        type="text"
                                        value={addressQuery}
                                        onChange={(e) => setAddressQuery(e.target.value)}
                                        placeholder="Địa chỉ..."
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-white placeholder:italic placeholder:text-slate-400 focus:ring-2 focus:ring-[#003725]/25 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="border-t border-slate-200/80 dark:border-slate-600 px-3 py-2 bg-[#f5f2ed]/80 dark:bg-slate-900/40">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sản phẩm</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-[48px_1fr_36px_86px] md:grid-cols-[64px_1fr_70px_130px] gap-2 px-2 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <div>Ngày</div>
                            <div>Sản phẩm / KH</div>
                            <div className="text-center">SL</div>
                            <div className="text-right">Thành tiền</div>
                        </div>

                        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                            {userScopedHistory.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-8 italic">Chưa có dữ liệu lịch sử. Mở tab này lần đầu sẽ tải từ Google Sheet.</p>
                            )}
                            {customerViewRows.map((h, idx) => {
                                const parts = parseRowDateParts(h.InvoiceDate);
                                const imp = isImportRow(h);
                                const loc = isLocalRow(h);
                                const bm = isBmRow(h);
                                const borderClass = imp ? 'border-l-blue-500' : loc ? 'border-l-[#0d4f38]' : 'border-l-slate-300';
                                const badge = imp ? (
                                    <span className="px-1 py-0.5 rounded text-[8px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">IMP</span>
                                ) : loc ? (
                                    <span className="px-1 py-0.5 rounded text-[8px] font-black bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">LOC</span>
                                ) : (
                                    <span className="px-1 py-0.5 rounded text-[8px] font-black bg-slate-100 text-slate-600">—</span>
                                );
                                const chLabel = h.HistorySource === 'BM' ? 'BM' : 'GG';
                                return (
                                    <div
                                        key={`${h.CustomerID}-${h.Product}-${idx}-${h.InvoiceDate ?? ''}`}
                                        className={`bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 ${borderClass} grid grid-cols-[48px_1fr_36px_86px] md:grid-cols-[64px_1fr_70px_130px] items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all`}
                                    >
                                        <div className="flex flex-col items-center justify-center bg-[#f2f4f5] dark:bg-slate-700 rounded-lg py-1.5 flex-shrink-0">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-none">
                                                {parts ? `${parts.dd}/${parts.mm}` : '—'}
                                            </span>
                                            <span className="text-[8px] font-medium text-slate-500">{parts?.yyyy ?? ''}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                {badge}
                                                <h3 className={`font-semibold truncate text-xs ${bm ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{(h.Product || '').trim() || '—'}</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onCustomerSelect(resolveNavigateCustomerCode(String(h.CustomerID)))}
                                                className={`text-left w-full text-[10px] font-medium truncate hover:underline ${bm ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300' : 'text-slate-500 dark:text-slate-400 hover:text-opella-green'}`}
                                            >
                                                <span className="inline mr-1 opacity-70">👤</span>
                                                {resolveCustomerName(String(h.CustomerID), h.CustomerName)} ({chLabel})
                                            </button>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-xs font-bold text-slate-800 dark:text-white">{Number(h.Qty) || 0}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-[#003725] dark:text-opella-green tracking-tight text-xs">{formatCurrency(Number(h.Value) || 0)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {userScopedHistory.length > 0 && customerViewRows.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-6 italic">Không có giao dịch khớp bộ lọc / tìm kiếm.</p>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {subView === 'product' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
                        <div className="flex items-center gap-2 flex-shrink-0 bg-[#f2f4f5] dark:bg-slate-800 p-1 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2 uppercase tracking-widest">Kênh</span>
                            {(['all', 'gg', 'bm'] as const).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setChannelFilter(k)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${channelFilter === k ? 'bg-[#003725] text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                >
                                    {k === 'all' ? 'All' : k === 'gg' ? 'GG' : 'BM'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 bg-[#f2f4f5] dark:bg-slate-800 p-1 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2 uppercase tracking-widest">Loại</span>
                            {(['all', 'import', 'local'] as const).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setTypeFilter(k)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === k ? 'bg-[#003725] text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                >
                                    {k === 'all' ? 'All' : k === 'import' ? 'IMPORT' : 'LOCAL'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative col-span-2">
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="w-full appearance-none bg-[#e1e3e4] dark:bg-slate-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-[#003725]/20"
                            >
                                <option value="">Chọn sản phẩm…</option>
                                {uniqueProducts.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedProduct && (
                        <>
                            <section className="px-1">
                                <div className="bg-[#f2f4f5] dark:bg-slate-800 rounded-xl p-5 relative overflow-hidden border border-slate-200/60 dark:border-slate-600">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#0d4f38]/5 rounded-full -mr-8 -mt-8" />
                                    <div className="flex items-start justify-between relative z-10 gap-3">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] tracking-widest uppercase font-semibold mb-1 block">Thông tin sản phẩm</span>
                                            <h2 className="font-bold text-xl text-[#003725] dark:text-white leading-tight break-words">{selectedProduct}</h2>
                                        </div>
                                        <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-xl shadow flex items-center justify-center shrink-0 text-[#0d4f38]">
                                            <CubeIcon />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-white dark:bg-slate-900/40 p-3 rounded-lg shadow-sm">
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-0.5">Tổng số lượng</p>
                                            <p className="text-xl font-bold text-[#003725] dark:text-opella-green">
                                                {productAggregates.totalQty.toLocaleString('vi-VN')} <span className="text-xs font-medium text-slate-500">đơn vị</span>
                                            </p>
                                        </div>
                                        <div className="bg-rose-50/80 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200/40 dark:border-rose-800/40">
                                            <p className="text-[10px] text-rose-900/80 dark:text-rose-200/90 font-medium mb-0.5">Khách hàng</p>
                                            <p className="text-xl font-bold text-rose-800 dark:text-rose-200">
                                                {productAggregates.customerCount} <span className="text-xs font-medium">đối tác</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="px-1 mb-2">
                                <div className="flex items-center gap-2 bg-[#e1e3e4] dark:bg-slate-700 rounded-full px-4 py-2.5">
                                    <SearchIcon />
                                    <input
                                        type="search"
                                        value={productCustomerSearch}
                                        onChange={(e) => setProductCustomerSearch(e.target.value)}
                                        placeholder="Tìm tên hoặc mã khách hàng…"
                                        className="bg-transparent border-none focus:ring-0 text-sm p-0 w-full placeholder:text-slate-500 dark:text-slate-400 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="px-1 space-y-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-bold text-slate-800 dark:text-white">Danh sách đối tác</h3>
                                    <span className="text-[11px] font-medium text-slate-500 bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 rounded">Theo bộ lọc</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {productAggregates.rows.map((row) => (
                                        <button
                                            key={row.code}
                                            type="button"
                                            onClick={() => onCustomerSelect(resolveNavigateCustomerCode(row.code))}
                                            className="w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-600 active:scale-[0.99] transition-all hover:border-opella-green/40"
                                        >
                                            <div className="flex justify-between items-start mb-3 gap-2">
                                                <div className="min-w-0">
                                                    <h4 className={`font-semibold text-base truncate ${row.hasBm ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{row.name}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="bg-[#cfe8d9] dark:bg-slate-700 text-[#354b40] dark:text-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                            {row.code}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">📍 {row.district}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-between border-t border-slate-200 dark:border-slate-600 pt-3">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Số lượng mua</p>
                                                    <p className="font-bold text-slate-800 dark:text-white text-lg">
                                                        {row.qty.toLocaleString('vi-VN')} <span className="text-[10px] font-medium opacity-60">SL</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tổng thanh toán</p>
                                                    <p className="font-extrabold text-[#003725] dark:text-opella-green text-xl">{formatCurrency(row.val)}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {productAggregates.rows.length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-6 italic">Không có khách hàng cho sản phẩm này (sau lọc tìm kiếm).</p>
                                )}
                            </div>
                        </>
                    )}

                    {!selectedProduct && uniqueProducts.length > 0 && (
                        <p className="text-center text-sm text-slate-500 py-4">Chọn một sản phẩm để xem danh sách khách hàng mua.</p>
                    )}
                </div>
            )}
            {showExportNoticeModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowExportNoticeModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-slate-800 dark:text-white uppercase text-sm">Lịch sử mua hàng</h3>
                        </div>
                        <div className="px-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeProductInExport}
                                    onChange={(e) => setIncludeProductInExport(e.target.checked)}
                                    className="rounded border-slate-300 text-opella-green focus:ring-opella-green"
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">có sản phẩm</span>
                            </label>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {renderCustomerExportContent(includeProductInExport)}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-600 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowExportNoticeModal(false)}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={customerViewRows.length === 0 || isExportingHistory}
                                onClick={async () => {
                                    setIsExportingHistory(true);
                                    try {
                                        await handleExportCustomerView();
                                        setShowExportNoticeModal(false);
                                    } finally {
                                        setIsExportingHistory(false);
                                    }
                                }}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-opella-green hover:bg-opella-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isExportingHistory ? 'Đang xuất...' : 'Xuất thông báo'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PurchaseHistoryTab;
