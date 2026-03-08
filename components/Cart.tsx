
import React, { useMemo, useState, useEffect } from 'react';
import type { CartItem, Rebate, Customer } from '../types';
import { PlusIcon, MinusIcon, TrashIcon, CartIcon, SaveIcon, SearchIcon, InfoIcon } from './icons';
import { formatCurrency } from '../utils/formatters';
import { getDiscountPercent, calculateLineTotal } from '../utils/calculations';
import {
    DUMMY_BOX_LOCAL_PRODUCT_IDS,
    DUMMY_BOX_LOCAL_REQUIRED_PRODUCT_ID,
    DUMMY_BOX_LOCAL_MIN_AMOUNT,
    DUMMY_BOX_IMPORT_PRODUCT_IDS,
    DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID,
    DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID,
    DUMMY_BOX_IMPORT_MIN_AMOUNT,
    DUMMY_BOX_DISCOUNT,
    TELFAST_GROUP_IDS,
} from '../constants';

const formatRebateDate = (r: any): string => {
    const dateValue = r.Endate || r.EndDate || r['End Date'] || r['Hạn dùng'] || r['Hạn'] || r.endDate;
    if (dateValue === undefined || dateValue === null || dateValue === '') return 'N/A';
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateValue)) return dateValue;
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) return date.toLocaleDateString('vi-VN');
    return String(dateValue);
};

interface CartItemRowProps {
    item: CartItem;
    lineTotal: number;
    maxPayableFeeLine: number;
    monthlyDiscountPercent: number;
    isGrouped: boolean;
    onUpdateQuantity: (id: number, q: number) => void;
    onRemoveItem: (id: number) => void;
}

// Component con để xử lý từng dòng sản phẩm, cho phép nhập liệu số lượng
const CartItemRow: React.FC<CartItemRowProps> = ({
    item,
    lineTotal,
    maxPayableFeeLine,
    monthlyDiscountPercent,
    isGrouped,
    onUpdateQuantity,
    onRemoveItem
}) => {
    const [inputValue, setInputValue] = useState(item.quantity.toString());

    // Sync state khi props thay đổi (ví dụ khi nhấn nút +/-)
    useEffect(() => {
        setInputValue(item.quantity.toString());
    }, [item.quantity]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Chỉ cho phép nhập số
        if (val === '' || /^[0-9]+$/.test(val)) {
            setInputValue(val);
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
                onUpdateQuantity(item.id, num);
            }
        }
    };

    const handleBlur = () => {
        const num = parseInt(inputValue, 10);
        if (isNaN(num) || num <= 0) {
            // Nếu giá trị không hợp lệ khi blur, reset về giá trị cũ
            setInputValue(item.quantity.toString());
        } else {
            if (num !== item.quantity) onUpdateQuantity(item.id, num);
        }
    };

    return (
        <tr className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
            <td className="px-3 py-2.5">
                <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight uppercase text-[11px]">{item.name}</p>
                {item.note && (
                    <p className="text-[9px] text-red-600 dark:text-red-400 font-bold italic mt-0.5 leading-tight">{item.note}</p>
                )}
                <p className="text-[9px] text-slate-400 mt-0.5">{formatCurrency(item.price)} (VAT)</p>
            </td>
            <td className="px-2 py-2.5">
                <div className="flex items-center justify-center bg-white dark:bg-slate-600 rounded-md overflow-hidden w-[100px] mx-auto border border-slate-200 dark:border-slate-500 shadow-sm">
                    <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-500 text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-500 transition-colors"
                    >
                        <MinusIcon />
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="w-full text-center font-black text-slate-700 dark:text-white text-[11px] outline-none bg-transparent h-full py-1 min-w-0"
                    />
                    <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-500 text-slate-500 dark:text-slate-300 border-l border-slate-200 dark:border-slate-500 transition-colors"
                    >
                        <PlusIcon />
                    </button>
                </div>
            </td>
            <td className="px-2 py-2.5 text-right">
                <p className="font-bold text-opella-green dark:text-sky-400 text-[11px]">{formatCurrency(lineTotal)}</p>
                {monthlyDiscountPercent > 0 && (
                    <p className="text-[9px] text-red-500 dark:text-red-400 font-bold italic">
                        CK -{(monthlyDiscountPercent * 100).toFixed(2)}%
                        {isGrouped && <span className="block text-[8px]">(Gộp nhóm)</span>}
                    </p>
                )}
            </td>
            <td className="px-2 py-2.5 text-right font-bold text-green-600 dark:text-green-400 text-[11px]">{formatCurrency(maxPayableFeeLine)}</td>
            <td className="px-3 py-2.5 text-right"><button onClick={() => onRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><TrashIcon /></button></td>
        </tr>
    );
};

interface CartProps {
    items: CartItem[];
    employeeName: string;
    customerCode: string;
    onCustomerCodeChange: (code: string) => void;
    customerName: string;
    onCustomerNameChange: (name: string) => void;
    customerAddress: string;
    onCustomerAddressChange: (address: string) => void;
    note: string;
    onNoteChange: (note: string) => void;
    onUpdateQuantity: (productId: number, newQuantity: number) => void;
    onRemoveItem: (productId: number) => void;
    onClearCart: () => void;
    onSaveDraft: () => void;
    onSubmitOrder: () => void;
    isLoading: boolean;
    successMessage: string | null;
    isOnTopLiXi: boolean;
    onIsOnTopLiXiChange: (isChecked: boolean) => void;
    isDummyBoxLocal?: boolean;
    onIsDummyBoxLocalChange?: (isChecked: boolean) => void;
    isDummyBoxImport?: boolean;
    onIsDummyBoxImportChange?: (isChecked: boolean) => void;
    activeDraftId: string | null;
    rebates: Rebate[];
    selectedRebateIds: string[];
    onToggleRebate: (id: string) => void;
    // New Prop
    customers?: Customer[];
    onQuickView?: (code: string) => void;
}

const Cart: React.FC<CartProps> = (props) => {
    const {
        items, customerCode, onCustomerCodeChange, customerName,
        onCustomerNameChange, customerAddress, onCustomerAddressChange,
        note, onNoteChange, onUpdateQuantity, onRemoveItem,
        onClearCart, onSaveDraft, onSubmitOrder, isLoading, successMessage,
        isOnTopLiXi, onIsOnTopLiXiChange, isDummyBoxLocal, onIsDummyBoxLocalChange, isDummyBoxImport, onIsDummyBoxImportChange,
        activeDraftId, rebates, selectedRebateIds, onToggleRebate,
        customers = [], // Default empty array
        onQuickView
    } = props;

    // --- Search Logic ---
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Helper: append/remove note preset text
    const toggleNotePreset = (preset: string) => {
        if (note.includes(preset)) {
            onNoteChange(note.replace(new RegExp(`\\s*${preset}\\s*`, 'g'), ' ').trim());
        } else {
            onNoteChange(note ? `${note} ${preset}` : preset);
        }
    };

    const filteredCustomers = useMemo(() => {
        if (!customerName || customerName.trim() === '') return [];
        const lower = customerName.toLowerCase();
        // Tìm kiếm theo tên hoặc mã KH
        return customers.filter(c =>
            c.name.toLowerCase().includes(lower) ||
            String(c.code).toLowerCase().includes(lower)
        ).slice(0, 10); // Chỉ lấy 10 kết quả đầu tiên để tối ưu
    }, [customerName, customers]);

    const handleCustomerSelect = (customer: Customer) => {
        // Khi chọn, cập nhật mã KH -> App sẽ tự động điền Tên & Địa chỉ
        onCustomerCodeChange(customer.code);
        setShowSuggestions(false);
    };
    // --------------------

    // 1. Tính tổng doanh số (chưa VAT) của nhóm Telfast đặc biệt
    const telfastGroupTotal = useMemo(() => {
        return items
            .filter(item => TELFAST_GROUP_IDS.includes(item.id))
            .reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, [items]);

    // 2. Tính Tạm tính tổng (đã trừ chiết khấu bậc/nhóm của từng dòng)
    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => {
            const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);

            let compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;

            const lineTotal = calculateLineTotal(
                item.price,
                item.quantity,
                item.promotion,
                compareValue
            );
            return sum + lineTotal;
        }, 0);
    }, [items, telfastGroupTotal]);

    const totalSales = items.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
    const onTopLiXiDiscount = isOnTopLiXi ? 250000 : 0;

    // CTKM OPELLA 3/2026: điều kiện = doanh số sau chiết khấu = tổng (basePrice × số lượng × (1 - % CK tương ứng))
    const eligibleDummyBoxLocal = useMemo(() => {
        const localIds: number[] = [...DUMMY_BOX_LOCAL_PRODUCT_IDS];
        const sum = items
            .filter(item => localIds.includes(item.id))
            .reduce((s, item) => {
                const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
                const compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;
                const discountPercent = getDiscountPercent(item.promotion, item.quantity, compareValue);
                const lineAfterDiscount = (item.basePrice ?? 0) * item.quantity * (1 - discountPercent);
                return s + lineAfterDiscount;
            }, 0);
        const hasRequired = items.some(item => item.id === DUMMY_BOX_LOCAL_REQUIRED_PRODUCT_ID && item.quantity > 0);
        return sum >= DUMMY_BOX_LOCAL_MIN_AMOUNT && hasRequired;
    }, [items, telfastGroupTotal]);
    const eligibleDummyBoxImport = useMemo(() => {
        const importIds: number[] = [...DUMMY_BOX_IMPORT_PRODUCT_IDS];
        const sum = items
            .filter(item => importIds.includes(item.id))
            .reduce((s, item) => {
                // Pharmaton Energy: ko áp CK 29.5% → dùng giá gốc (originalPrice) cho dòng này
                if (item.id === DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID) {
                    return s + (item.originalPrice ?? item.price ?? item.basePrice ?? 0) * item.quantity;
                }
                const compareValue = item.price * item.quantity;
                const discountPercent = getDiscountPercent(item.promotion, item.quantity, compareValue);
                const lineAfterDiscount = (item.basePrice ?? 0) * item.quantity * (1 - discountPercent);
                return s + lineAfterDiscount;
            }, 0);
        const hasRequired = items.some(item => item.id === DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID && item.quantity > 0);
        return sum >= DUMMY_BOX_IMPORT_MIN_AMOUNT && hasRequired;
    }, [items]);

    const dummyBoxDiscount = (isDummyBoxLocal ? DUMMY_BOX_DISCOUNT : 0) + (isDummyBoxImport ? DUMMY_BOX_DISCOUNT : 0);

    const localRebates = rebates.filter(r => r.Group === 'LOCAL');
    const importRebates = rebates.filter(r => r.Group === 'IMPORT');

    const { totalMaxPayableFeeLocal, totalMaxPayableFeeImport } = useMemo(() => {
        let localFee = 0;
        let importFee = 0;
        items.forEach(item => {
            const basePriceLine = (item.basePrice ?? 0) * item.quantity;
            if (basePriceLine > 0) {
                const maxTotalDiscountLine = basePriceLine * 0.5;

                const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);

                let compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;

                const monthlyDiscountPercent = getDiscountPercent(
                    item.promotion,
                    item.quantity,
                    compareValue
                );
                const monthlyDiscountAmount = basePriceLine * monthlyDiscountPercent;
                const maxPayableFeeLine = maxTotalDiscountLine - monthlyDiscountAmount;

                // Đảm bảo không âm
                const finalFee = Math.max(0, maxPayableFeeLine);

                if (item.type === 'Local') localFee += finalFee;
                else importFee += finalFee;
            }
        });
        return { totalMaxPayableFeeLocal: localFee, totalMaxPayableFeeImport: importFee };
    }, [items, telfastGroupTotal]);

    const { rebateDiscount, selectedLocalRebateTotal, selectedImportRebateTotal } = useMemo(() => {
        const selectedLocalRebateAmount = localRebates
            .filter(r => selectedRebateIds.includes(r["PromotionID#program"]))
            .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

        const selectedImportRebateAmount = importRebates
            .filter(r => selectedRebateIds.includes(r["PromotionID#program"]))
            .reduce((sum, r) => sum + Number(r.RemainAmount), 0);

        const actualLocalRebate = Math.min(selectedLocalRebateAmount, totalMaxPayableFeeLocal);
        const actualImportRebate = Math.min(selectedImportRebateAmount, totalMaxPayableFeeImport);

        return {
            rebateDiscount: actualLocalRebate + actualImportRebate,
            selectedLocalRebateTotal: selectedLocalRebateAmount,
            selectedImportRebateTotal: selectedImportRebateAmount,
        };
    }, [localRebates, importRebates, selectedRebateIds, totalMaxPayableFeeLocal, totalMaxPayableFeeImport]);

    // --- Submit Validation ---
    const localProductCount = items.filter(i => i.type === 'Local').length;
    const importProductCount = items.filter(i => i.type === 'Import').length;

    const localOver = selectedLocalRebateTotal > totalMaxPayableFeeLocal && totalMaxPayableFeeLocal > 0;
    const importOver = selectedImportRebateTotal > totalMaxPayableFeeImport && totalMaxPayableFeeImport > 0;
    const hasLocalMaxNote = note.includes('Trả tối đa phí Local');
    const hasImportMaxNote = note.includes('Trả tối đa phí Import');

    const feeOverNeedsNote = (localOver && !hasLocalMaxNote) || (importOver && !hasImportMaxNote);
    const rebateWithoutProducts = (selectedLocalRebateTotal > 0 && localProductCount < 1) || (selectedImportRebateTotal > 0 && importProductCount < 1);
    const isSubmitBlocked = feeOverNeedsNote || rebateWithoutProducts;

    const handleSubmitWithValidation = () => {
        if (isSubmitBlocked) return;
        onSubmitOrder();
    };

    const finalAmount = Math.max(0, totalAmount - onTopLiXiDiscount - rebateDiscount - dummyBoxDiscount);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col overflow-hidden h-[calc(100vh-190px)] transition-colors duration-200">
            <div className="p-3 border-b border-opella-green/20 flex justify-between items-center bg-opella-green sticky top-0 z-10">
                <h2 className="text-base font-bold text-white flex items-center">
                    <CartIcon />
                    <span className="ml-2 uppercase tracking-tight">Chi tiết đơn hàng</span>
                    {activeDraftId && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded-full uppercase font-bold">Bản nháp</span>}
                </h2>
                {items.length > 0 && (
                    <button onClick={onClearCart} title="Xóa giỏ hàng" className="text-white/90 hover:bg-white/20 p-1.5 rounded-md transition-colors"><TrashIcon /></button>
                )}
            </div>

            <div className="overflow-y-auto flex-1 no-scrollbar">
                <div className="p-3 space-y-2.5 bg-opella-beige/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Mã KH</label>
                            <div className="flex items-center gap-1 mt-0.5">
                                <input
                                    type="text"
                                    value={customerCode}
                                    onChange={(e) => onCustomerCodeChange(e.target.value)}
                                    className="flex-1 min-w-0 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-sm outline-none focus:ring-1 focus:ring-opella-green bg-white dark:bg-slate-800 dark:text-white font-mono font-bold"
                                    placeholder="Mã..."
                                />
                                <button
                                    onClick={() => onQuickView?.(customerCode)}
                                    disabled={!customerCode}
                                    type="button"
                                    title="Xem chi tiết khách hàng"
                                    className="flex-shrink-0 p-1.5 bg-opella-green hover:bg-opella-green/90 text-white rounded shadow-sm transition-all active:scale-95 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    <InfoIcon />
                                </button>
                            </div>
                        </div>
                        <div className="col-span-2 relative">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tìm kiếm tên khách hàng</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => {
                                        onCustomerNameChange(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    // Delayed blur để kịp bắt sự kiện click vào suggestion
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="w-full mt-0.5 border border-slate-300 dark:border-slate-600 rounded p-1.5 pl-7 text-sm outline-none focus:ring-1 focus:ring-opella-green bg-white dark:bg-slate-800 dark:text-white"
                                    placeholder="Nhập tên KH..."
                                    autoComplete="off"
                                />
                                <div className="absolute top-2 left-2 text-slate-400 pointer-events-none">
                                    <SearchIcon />
                                </div>
                            </div>

                            {/* Dropdown gợi ý */}
                            {showSuggestions && filteredCustomers.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto animate-fade-in divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredCustomers.map(c => (
                                        <li
                                            key={c.code}
                                            onMouseDown={() => handleCustomerSelect(c)} // Dùng onMouseDown để chạy trước onBlur của input
                                            className="px-3 py-2 hover:bg-opella-beige dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                        >
                                            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{c.name}</div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{c.code}</span>
                                                {c.address && <span className="text-[9px] text-slate-400 italic truncate ml-2 max-w-[60%]">{c.address}</span>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Địa chỉ</label>
                        <textarea value={customerAddress} onChange={(e) => onCustomerAddressChange(e.target.value)} className="w-full mt-0.5 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-[11px] outline-none italic text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 resize-none" rows={1} placeholder="Địa chỉ..."></textarea>
                    </div>

                    {rebates.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {localRebates.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-wide rounded border border-green-100 dark:border-green-800/50">
                                        TỔNG PHÍ CẦN TRẢ LOCAL: {formatCurrency(selectedLocalRebateTotal)}
                                    </p>
                                    {localRebates.map(r => (
                                        <label key={r["PromotionID#program"]} className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${selectedRebateIds.includes(r["PromotionID#program"]) ? 'bg-opella-beige/50 dark:bg-opella-green/20 border-opella-green/50 dark:border-opella-green shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <input type="checkbox" checked={selectedRebateIds.includes(r["PromotionID#program"])} onChange={() => onToggleRebate(r["PromotionID#program"])} className="mt-1 h-4 w-4 rounded text-opella-green focus:ring-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
                                            <div className="ml-2.5 flex-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{r["PromotionID#program"]}</span>
                                                    <span className="text-xs font-black text-red-600 dark:text-red-400 ml-2">-{formatCurrency(r.RemainAmount)}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hạn: <span className="font-semibold">{formatRebateDate(r)}</span></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {importRebates.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wide rounded border border-blue-100 dark:border-blue-800/50">
                                        TỔNG PHÍ CẦN TRẢ IMPORT: {formatCurrency(selectedImportRebateTotal)}
                                    </p>
                                    {importRebates.map(r => (
                                        <label key={r["PromotionID#program"]} className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${selectedRebateIds.includes(r["PromotionID#program"]) ? 'bg-opella-beige/50 dark:bg-opella-green/20 border-opella-green/50 dark:border-opella-green shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <input type="checkbox" checked={selectedRebateIds.includes(r["PromotionID#program"])} onChange={() => onToggleRebate(r["PromotionID#program"])} className="mt-1 h-4 w-4 rounded text-opella-green focus:ring-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
                                            <div className="ml-2.5 flex-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{r["PromotionID#program"]}</span>
                                                    <span className="text-xs font-black text-red-600 dark:text-red-400 ml-2">-{formatCurrency(r.RemainAmount)}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hạn: <span className="font-semibold">{formatRebateDate(r)}</span></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase">
                                <th className="px-3 py-2 w-[35%]">Sản phẩm</th>
                                <th className="px-2 py-2 text-center w-[15%]">SL</th>
                                <th className="px-2 py-2 text-right w-[20%]">Thành tiền</th>
                                <th className="px-2 py-2 text-right text-green-700 dark:text-green-400 w-[20%]">Phí Trả Max</th>
                                <th className="px-3 py-2 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {items.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm italic">Chưa có sản phẩm nào</td></tr>
                            ) : (
                                items.map(item => {
                                    const basePriceLine = (item.basePrice ?? 0) * item.quantity;
                                    const maxTotalDiscountLine = basePriceLine * 0.5;

                                    const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);

                                    let compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;

                                    const monthlyDiscountPercent = getDiscountPercent(
                                        item.promotion,
                                        item.quantity,
                                        compareValue
                                    );
                                    const monthlyDiscountAmount = basePriceLine * monthlyDiscountPercent;
                                    const maxPayableFeeLine = Math.max(0, maxTotalDiscountLine - monthlyDiscountAmount);

                                    const lineTotal = calculateLineTotal(
                                        item.price,
                                        item.quantity,
                                        item.promotion,
                                        compareValue
                                    );

                                    return (
                                        <CartItemRow
                                            key={item.id}
                                            item={item}
                                            lineTotal={lineTotal}
                                            maxPayableFeeLine={maxPayableFeeLine}
                                            monthlyDiscountPercent={monthlyDiscountPercent}
                                            isGrouped={isTelfastGroup}
                                            onUpdateQuantity={onUpdateQuantity}
                                            onRemoveItem={onRemoveItem}
                                        />
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
                <div className="space-y-0.5 mb-2.5">
                    {/* Tạm tính & Doanh số - Gộp dòng */}
                    <div className="flex justify-between items-baseline mb-1 pb-1 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-baseline space-x-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Tạm tính:</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="flex items-baseline space-x-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Doanh số:</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalSales)}</span>
                            <span className="text-[8px] text-slate-400 uppercase font-normal">(ko VAT)</span>
                        </div>
                    </div>

                    {/* DS Nhóm đặc biệt - Thu nhỏ tối đa */}
                    {telfastGroupTotal > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1 italic">
                            <div className="flex items-center space-x-1">
                                <span className="text-[8px] font-medium text-slate-400 uppercase">DS Telfast:</span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formatCurrency(telfastGroupTotal)}</span>
                            </div>
                        </div>
                    )}

                    {/* Toggles - CTKM OPELLA 3/2026: DummyBox Local / Import (chỉ bật khi đủ điều kiện) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 py-0.5">
                        {onIsDummyBoxLocalChange && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-local" checked={!!isDummyBoxLocal} onChange={(e) => onIsDummyBoxLocalChange(e.target.checked)} disabled={!eligibleDummyBoxLocal} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-local" className={`text-[11px] font-bold cursor-pointer ${eligibleDummyBoxLocal ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`} title={eligibleDummyBoxLocal ? 'Đơn ≥1M (sau CK) nhóm Corbiere Calcium Plus, Telfast HD/BD, Corbiere Extra 5ml + ít nhất 01 Corbiere Calcium Plus 10ML' : 'Chưa đủ điều kiện: đơn ≥1M nhóm Corbiere/Telfast/Corbiere Extra 5ml + ít nhất 01 Corbiere Calcium Plus 10ML'}>DummyBox Local (-150k)</label>
                            </div>
                        )}
                        {onIsDummyBoxImportChange && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-import" checked={!!isDummyBoxImport} onChange={(e) => onIsDummyBoxImportChange(e.target.checked)} disabled={!eligibleDummyBoxImport} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-import" className={`text-[11px] font-bold cursor-pointer ${eligibleDummyBoxImport ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`} title={eligibleDummyBoxImport ? 'Đơn ≥1M (sau CK) nhóm Pharmaton (Energy ko CK 29.5%), Essent, Vitality, Fizzi + Enterogermina (GUT 2B, 4B, 2B/20) + ít nhất 01 Pharmaton Vitality' : 'Chưa đủ điều kiện: đơn ≥1M nhóm trên + ít nhất 01 Pharmaton Vitality'}>DummyBox Import (-150k)</label>
                            </div>
                        )}
                    </div>

                    {/* Deductions - Chỉ hiện khi có số */}
                    {(isOnTopLiXi || isDummyBoxLocal || isDummyBoxImport || rebateDiscount > 0) && (
                        <div className="space-y-0.5 py-0.5 border-t border-slate-50 dark:border-slate-700 mt-0.5">
                            {isOnTopLiXi && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ Ontop lì xì:</span>
                                    <span>-{formatCurrency(250000)}</span>
                                </div>
                            )}
                            {isDummyBoxLocal && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Local:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_DISCOUNT)}</span>
                                </div>
                            )}
                            {isDummyBoxImport && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Import:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_DISCOUNT)}</span>
                                </div>
                            )}
                            {rebateDiscount > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-600 dark:text-red-400 italic">
                                    <span>- Khấu trừ Rebate (Max):</span>
                                    <span>-{formatCurrency(rebateDiscount)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phí Max + Tổng Phí Cần Trả - 2 dòng (Local & Import) */}
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-700 space-y-1">
                        {/* LOCAL */}
                        <div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-baseline space-x-1.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Phí Local Max:</span>
                                    <span className={`text-[10px] font-black ${selectedLocalRebateTotal > totalMaxPayableFeeLocal && totalMaxPayableFeeLocal > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(totalMaxPayableFeeLocal)}</span>
                                </div>
                                {selectedLocalRebateTotal > 0 && (
                                    <div className="flex items-baseline space-x-1.5">
                                        <span className={`text-[9px] font-bold uppercase ${selectedLocalRebateTotal > totalMaxPayableFeeLocal && totalMaxPayableFeeLocal > 0 ? 'text-red-500' : 'text-amber-500'}`}>Tổng Phí Cần Trả:</span>
                                        <span className={`text-[10px] font-black ${selectedLocalRebateTotal > totalMaxPayableFeeLocal && totalMaxPayableFeeLocal > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>-{formatCurrency(selectedLocalRebateTotal)}</span>
                                    </div>
                                )}
                            </div>
                            {/* Checkbox preset note LOCAL */}
                            <div className="flex items-center space-x-1.5 mt-0.5">
                                <input
                                    type="checkbox"
                                    id="note-local-max"
                                    checked={note.includes('Trả tối đa phí Local')}
                                    onChange={() => toggleNotePreset('Trả tối đa phí Local')}
                                    className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green"
                                />
                                <label htmlFor="note-local-max" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">Trả tối đa phí Local</label>
                            </div>
                        </div>
                        {/* IMPORT */}
                        <div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-baseline space-x-1.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Phí Import Max:</span>
                                    <span className={`text-[10px] font-black ${selectedImportRebateTotal > totalMaxPayableFeeImport && totalMaxPayableFeeImport > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(totalMaxPayableFeeImport)}</span>
                                </div>
                                {selectedImportRebateTotal > 0 && (
                                    <div className="flex items-baseline space-x-1.5">
                                        <span className={`text-[9px] font-bold uppercase ${selectedImportRebateTotal > totalMaxPayableFeeImport && totalMaxPayableFeeImport > 0 ? 'text-red-500' : 'text-amber-500'}`}>Tổng Phí Cần Trả:</span>
                                        <span className={`text-[10px] font-black ${selectedImportRebateTotal > totalMaxPayableFeeImport && totalMaxPayableFeeImport > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>-{formatCurrency(selectedImportRebateTotal)}</span>
                                    </div>
                                )}
                            </div>
                            {/* Checkbox preset note IMPORT */}
                            <div className="flex items-center space-x-1.5 mt-0.5">
                                <input
                                    type="checkbox"
                                    id="note-import-max"
                                    checked={note.includes('Trả tối đa phí Import')}
                                    onChange={() => toggleNotePreset('Trả tối đa phí Import')}
                                    className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green"
                                />
                                <label htmlFor="note-import-max" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">Trả tối đa phí Import</label>
                            </div>
                        </div>
                    </div>

                    {/* Tổng cộng - Nhấn mạnh */}
                    <div className="flex justify-between items-end pt-1.5 border-t-2 border-double border-slate-200 dark:border-slate-600">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Tổng cộng:</span>
                        <div className="text-right flex items-baseline leading-none">
                            <span className="text-xl font-black text-opella-green dark:text-sky-400">{formatCurrency(finalAmount)}</span>
                            <span className="text-[8px] font-bold text-slate-400 ml-1 uppercase">(VAT)</span>
                        </div>
                    </div>
                </div>

                {/* Ghi chú & Nút action - Tối ưu hàng ngang nếu có thể */}
                <div className="space-y-2">
                    <textarea
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Ghi chú đơn hàng..."
                        className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] outline-none focus:ring-1 focus:ring-opella-green min-h-[36px] bg-slate-50 dark:bg-slate-700 dark:text-white resize-none leading-normal"
                        rows={1}
                    ></textarea>

                    {/* Warning vượt phí MAX & thiếu sản phẩm - Khóa gửi đơn */}
                    {isSubmitBlocked && (
                        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-2 text-[10px] text-red-700 dark:text-red-300">
                            <p className="font-black uppercase mb-1">▲ Cần kiểm tra lại đơn!</p>
                            {feeOverNeedsNote && (
                                <>
                                    {localOver && !hasLocalMaxNote && (
                                        <p>• Phí Local cần trả <span className="font-bold">{formatCurrency(selectedLocalRebateTotal)}</span> vượt Max <span className="font-bold">{formatCurrency(totalMaxPayableFeeLocal)}</span>. Chọn &quot;Trả tối đa phí Local&quot; để xác nhận.</p>
                                    )}
                                    {importOver && !hasImportMaxNote && (
                                        <p>• Phí Import cần trả <span className="font-bold">{formatCurrency(selectedImportRebateTotal)}</span> vượt Max <span className="font-bold">{formatCurrency(totalMaxPayableFeeImport)}</span>. Chọn &quot;Trả tối đa phí Import&quot; để xác nhận.</p>
                                    )}
                                </>
                            )}
                            {rebateWithoutProducts && (
                                <>
                                    {selectedLocalRebateTotal > 0 && localProductCount < 1 && (
                                        <p>• Chọn trả phí Local nhưng đơn không có sản phẩm Local. Cần ít nhất 1 sản phẩm Local.</p>
                                    )}
                                    {selectedImportRebateTotal > 0 && importProductCount < 1 && (
                                        <p>• Chọn trả phí Import nhưng đơn không có sản phẩm Import. Cần ít nhất 1 sản phẩm Import.</p>
                                    )}
                                </>
                            )}
                            <p className="mt-1 text-[9px] opacity-90">Chỉnh sửa theo hướng dẫn trên để gửi đơn.</p>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={onSaveDraft} disabled={items.length === 0} className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-lg font-bold text-[10px] transition-all uppercase border border-slate-200 dark:border-slate-600"><SaveIcon /><span className="ml-1">Lưu nháp</span></button>
                        <button onClick={handleSubmitWithValidation} disabled={items.length === 0 || isLoading || isSubmitBlocked} className="flex-[2] flex items-center justify-center bg-opella-green hover:bg-opella-green/90 text-white py-2 rounded-lg font-black text-[11px] transition-all uppercase shadow-md active:transform active:scale-95 disabled:bg-slate-300 dark:disabled:bg-slate-600">
                            {isLoading ? 'Đang gửi...' : 'Gửi đơn ngay'}
                        </button>
                    </div>
                </div>
                {successMessage && <div className="mt-1 text-center text-[9px] font-bold text-green-600 dark:text-green-400 animate-bounce">{successMessage}</div>}
            </div>
        </div>
    );
};

export default Cart;
