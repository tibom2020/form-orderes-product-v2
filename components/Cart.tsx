
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CartItem, Rebate, Customer, SalesRecord } from '../types';

import { getDummyBoxToggleState, type DummyBoxListGate } from '../utils/dummyBoxGate';
export type { DummyBoxListGate };
import { PlusIcon, MinusIcon, TrashIcon, CartIcon, SaveIcon, SearchIcon, InfoIcon } from './icons';
import AnimatedSubmitOrderButton from './AnimatedSubmitOrderButton';
import { CustomerSalesNoticeContent } from './CustomerSalesNoticeContent';
import { formatCurrency } from '../utils/formatters';
import { getDiscountPercent } from '../utils/calculations';
import {
    allocateRebateExVatPerItem,
    computeCartFinalAmountWithVat,
    computeCartVatTotals,
    getCartDummyBoxPercents,
    getCartLineAmountWithVat,
} from '../utils/cartVatTotals';
import { calcPsOrderTotals, getPsCartUnitPrice, PS_ON_INVOICE_NOTE_MARKER, findTierConfigByFinalStoreTypeQ2 } from '../utils/psOnInvoicePromo';
import type { PsCustomerGate } from '../utils/psCustomerRegistry';
import { getDummyBoxEligibilityTotals } from '../utils/dummyBoxEligibility';
import {
    calcChc2606OntopTotals,
    formatChc2606OntopPercent,
    isChc2606OntopPromoActive,
} from '../utils/chc2606OntopPromo';
import {
    computeCartGroupTotals,
    computeMaxPayableFees,
    computeAppliedRebates,
    MAX_PRODUCT_DISCOUNT_RATIO,
    MAX_PRODUCT_DISCOUNT_RATIO_STANDARD,
} from '../utils/orderDiscountCaps';
import { isBmProduct, getBmTiers } from '../constants/bmProducts';
import {
    DUMMY_BOX_DISCOUNT,
    DUMMY_BOX_500_DISCOUNT,
    DUMMY_BOX_500_MIN_AMOUNT,
    DUMMY_BOX_500_SHEET,
    TELFAST_GROUP_IDS,
    OSTELIN_GROUP_IDS,
    ACEMUC_GROUP_IDS,
    OSTELIN_60V_GOI_MIN_QTY,
    OSTELIN_60V_PRODUCT_ID,
    CART_OSTELIN_TANG_CAN_VISIBLE,
} from '../constants';
import {
    OSTELIN_TANG_CAN_NOTE,
    noteHasOstelinTangCan,
    stripOstelinTangCanNoteLines,
} from '../utils/ostelin60v';
import {
    noteHasPharmatonViGoi,
    stripPharmatonViGoiNoteLines,
} from '../utils/pharmatonVi';

/** Bật đặt gói CK PS 25% (SPECIAL_PS0526) trên giỏ — đặt false để tạm ẩn */
const ENABLE_PS_25_ORDER_IN_CART = true;

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
    boxPrice: number;
    monthlyDiscountPercent: number;
    isGrouped: boolean;
    /** CK PS 25% — không hiện % CK tháng/combo trên dòng */
    hideLineDiscount?: boolean;
    /** Đơn giá hiển thị (basePrice khi CK PS) */
    unitPrice?: number;
    onUpdateQuantity: (id: number, q: number) => void;
    onRemoveItem: (id: number) => void;
}

// Component con để xử lý từng dòng sản phẩm, cho phép nhập liệu số lượng
const CartItemRow: React.FC<CartItemRowProps> = ({
    item,
    lineTotal,
    boxPrice,
    monthlyDiscountPercent,
    isGrouped,
    hideLineDiscount = false,
    unitPrice,
    onUpdateQuantity,
    onRemoveItem
}) => {
    const displayUnitPrice = unitPrice ?? item.price;
    const [inputValue, setInputValue] = useState(item.quantity.toString());
    const [showBmModal, setShowBmModal] = useState(false);
    const bmTiers = useMemo(() => getBmTiers(item), [item]);
    const showBmButton = isBmProduct(item.id);

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
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-slate-400">
                        {formatCurrency(displayUnitPrice)} (VAT)
                        {hideLineDiscount && (
                            <span className="block text-[8px] text-violet-600 dark:text-violet-300 font-bold">basePrice</span>
                        )}
                    </p>
                    {showBmButton && (
                        <button
                            type="button"
                            onClick={() => setShowBmModal(true)}
                            className="text-[9px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                            GIÁ BM
                        </button>
                    )}
                </div>
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
                {!hideLineDiscount && monthlyDiscountPercent > 0 && (
                    <p className="text-[9px] text-red-500 dark:text-red-400 font-bold italic">
                        {`CK -${(monthlyDiscountPercent * 100).toFixed(2)}%`}
                        {isGrouped && <span className="block text-[8px]">(Gộp nhóm)</span>}
                    </p>
                )}
            </td>
            <td className="px-2 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200 text-[11px]">{formatCurrency(boxPrice)}</td>
            <td className="px-3 py-2.5 text-right"><button onClick={() => onRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><TrashIcon /></button></td>
            {showBmModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowBmModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-md w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">GIÁ BM — {item.name}</h3>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {bmTiers.length === 0 ? (
                                <p className="text-slate-400 italic text-sm">Không có dữ liệu giá BM.</p>
                            ) : (
                                <div className="space-y-3">
                                    {bmTiers.map((tier, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">SL tối thiểu: {tier.minQty}</span>
                                                <span className="text-sm font-black text-opella-green dark:text-sky-400">{formatCurrency(tier.price)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-600">
                            <button type="button" onClick={() => setShowBmModal(false)} className="w-full py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 transition-colors">Đóng</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
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
    isDummyBoxLocal?: boolean;
    onIsDummyBoxLocalChange?: (isChecked: boolean) => void;
    isDummyBoxImport?: boolean;
    onIsDummyBoxImportChange?: (isChecked: boolean) => void;
    isDummyBoxLocal500?: boolean;
    onIsDummyBoxLocal500Change?: (isChecked: boolean) => void;
    isDummyBoxImport500?: boolean;
    onIsDummyBoxImport500Change?: (isChecked: boolean) => void;
    isCalciPlusPack476?: boolean;
    onIsCalciPlusPack476Change?: (isChecked: boolean) => void;
    isChc2606Ontop?: boolean;
    onIsChc2606OntopChange?: (isChecked: boolean) => void;
    activeDraftId: string | null;
    rebates: Rebate[];
    selectedRebateIds: string[];
    onToggleRebate: (id: string) => void;
    customers?: Customer[];
    currentSalesRecord?: SalesRecord | null;
    onExportSales?: (record: SalesRecord) => Promise<void>;
    onViewCustomerDetail?: (code: string) => void;
    /** Tra DummyBoxRecord (Bs-only không mở tick); GoiLocal/GoiImport gộp cả 2 sheet */
    dummyBoxListGate?: DummyBoxListGate;
    /** Tra DummyBoxRecord_1 — gói DummyBox 500k / -75k */
    dummyBox500ListGate?: DummyBoxListGate;
    /** Sheet OSTELIN_60V_GOI: KH đã gói Đợt 2 — khóa tick tặng máy đo HA */
    ostelin60VTangCanLocked?: boolean;
    /** KH đã mua gói PMT Vỉ Đợt 1 — hiện cảnh báo dưới Loại PS */
    pharmatonViGoiDot1Purchased?: boolean;
    /** Perfect Store — CK On Invoice 25% */
    psGate?: PsCustomerGate | null;
    isPsOnInvoice25?: boolean;
    onIsPsOnInvoice25Change?: (checked: boolean) => void;
    psSuatSelected?: number;
    onPsSuatSelectedChange?: (suat: number) => void;
}

const Cart: React.FC<CartProps> = (props) => {
    const {
        items, employeeName, customerCode, onCustomerCodeChange, customerName,
        onCustomerNameChange, customerAddress, onCustomerAddressChange,
        note, onNoteChange, onUpdateQuantity, onRemoveItem,
        onClearCart, onSaveDraft, onSubmitOrder, isLoading, successMessage,
        isOnTopLiXi, isDummyBoxLocal, onIsDummyBoxLocalChange, isDummyBoxImport, onIsDummyBoxImportChange,
        isDummyBoxLocal500, onIsDummyBoxLocal500Change, isDummyBoxImport500, onIsDummyBoxImport500Change,
        isCalciPlusPack476, onIsCalciPlusPack476Change,
        isChc2606Ontop, onIsChc2606OntopChange,
        activeDraftId, rebates, selectedRebateIds, onToggleRebate,
        customers = [],
        currentSalesRecord,
        onExportSales,
        onViewCustomerDetail,
        dummyBoxListGate,
        dummyBox500ListGate,
        ostelin60VTangCanLocked = false,
        pharmatonViGoiDot1Purchased = false,
        psGate = null,
        isPsOnInvoice25 = false,
        onIsPsOnInvoice25Change,
        psSuatSelected = 0,
        onPsSuatSelectedChange,
    } = props;

    const psTierLabel =
        psGate?.tierLabel ||
        (currentSalesRecord?.FinalStoreTypeQ2?.trim() || '') ||
        '—';

    /** Sale T8 / target trưng bày / ĐẠT — hiển thị ở khối Loại PS */
    const psDisplayMetrics = useMemo(() => {
        /** Chỉ cột Sale T8 trên DANGKYTBQ2 — không fallback DOANH_SO (tránh lẫn T7) */
        const saleT8 = psGate?.saleT8Vnd ?? 0;
        const tier =
            psGate?.tierConfig ||
            findTierConfigByFinalStoreTypeQ2(currentSalesRecord?.FinalStoreTypeQ2 || '');
        const target = psGate?.targetTrungBay || tier?.minMonthlySales || 0;
        if (target <= 0) {
            return { saleT8, target: 0, todo: null as number | null, status: null as 'dat' | 'chua' | null };
        }
        const todo = target - saleT8;
        return {
            saleT8,
            target,
            todo,
            status: (saleT8 >= target ? 'dat' : 'chua') as 'dat' | 'chua',
        };
    }, [psGate, currentSalesRecord]);
    const psTotals = useMemo(() => {
        if (!isPsOnInvoice25 || !psGate?.tierConfig) return null;
        return calcPsOrderTotals(items, psGate.tierConfig, {
            usedSuatFromSheet: psGate.suatPsDaDung,
            suatToApply: psSuatSelected > 0 ? psSuatSelected : undefined,
        });
    }, [isPsOnInvoice25, psGate, items, psSuatSelected]);

    const psSuatPickMax = psTotals
        ? Math.min(psTotals.suatFromCart, psTotals.suatRemaining)
        : 0;

    const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // --- Search Logic ---
    const [showSuggestions, setShowSuggestions] = useState(false);

    /** Gói CK PS 25% — không chọn trả phí rebate / preset trả tối đa phí */
    const rebatePaymentLocked = isPsOnInvoice25;

    // Helper: append/remove note preset text
    const toggleNotePreset = (preset: string) => {
        if (rebatePaymentLocked) return;
        if (note.includes(preset)) {
            onNoteChange(note.replace(new RegExp(`\\s*${preset}\\s*`, 'g'), ' ').trim());
        } else {
            onNoteChange(note ? `${note} ${preset}` : preset);
        }
    };

    const noteLinesTrimmed = useMemo(
        () => note.split('\n').map(l => l.trim()).filter(Boolean),
        [note]
    );
    const hasOstelinTangCanNote = noteHasOstelinTangCan(note);
    const hasPharmatonViGoiNote = noteHasPharmatonViGoi(note);

    const ostelin60vInCart = useMemo(
        () => items.find(i => i.id === OSTELIN_60V_PRODUCT_ID),
        [items]
    );
    const ostelin60vEligible =
        (ostelin60vInCart?.quantity ?? 0) >= OSTELIN_60V_GOI_MIN_QTY;

    const toggleOstelinTangCanNote = () => {
        if (ostelin60VTangCanLocked) return;
        if (hasOstelinTangCanNote) {
            onNoteChange(stripOstelinTangCanNoteLines(noteLinesTrimmed).join('\n'));
        } else {
            onNoteChange(note.trim() ? `${note.trim()}\n${OSTELIN_TANG_CAN_NOTE}` : OSTELIN_TANG_CAN_NOTE);
        }
    };

    useEffect(() => {
        if (!ostelin60VTangCanLocked) return;
        if (!hasOstelinTangCanNote) return;
        onNoteChange(stripOstelinTangCanNoteLines(noteLinesTrimmed).join('\n'));
    }, [ostelin60VTangCanLocked, hasOstelinTangCanNote, noteLinesTrimmed, onNoteChange]);

    useEffect(() => {
        if (ostelin60VTangCanLocked || !hasOstelinTangCanNote) return;
        if (ostelin60vEligible) return;
        onNoteChange(stripOstelinTangCanNoteLines(noteLinesTrimmed).join('\n'));
    }, [ostelin60VTangCanLocked, hasOstelinTangCanNote, ostelin60vEligible, noteLinesTrimmed, onNoteChange]);

    useEffect(() => {
        if (CART_OSTELIN_TANG_CAN_VISIBLE || !hasOstelinTangCanNote) return;
        onNoteChange(stripOstelinTangCanNoteLines(noteLinesTrimmed).join('\n'));
    }, [hasOstelinTangCanNote, noteLinesTrimmed, onNoteChange]);

    /** Đợt 2 không dùng tick — gỡ dòng ghi chú gói PMT cũ nếu còn sót */
    useEffect(() => {
        if (!hasPharmatonViGoiNote) return;
        onNoteChange(stripPharmatonViGoiNoteLines(noteLinesTrimmed).join('\n'));
    }, [hasPharmatonViGoiNote, noteLinesTrimmed, onNoteChange]);

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

    const { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal } = useMemo(
        () => computeCartGroupTotals(items),
        [items]
    );

    const cartGroupTotals = useMemo(
        () => ({ telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal }),
        [telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal]
    );

    // Tạm tính (-VAT): basePrice sau CK dòng; PS = tổng basePrice
    const totalAmount = useMemo(() => {
        const { subtotalExVat } = computeCartVatTotals({
            items,
            groupTotals: cartGroupTotals,
            psTotals: psTotals ?? undefined,
        });
        return subtotalExVat;
    }, [items, cartGroupTotals, psTotals]);

    const totalSales = items.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
    const onTopLiXiDiscount = isPsOnInvoice25 ? 0 : isOnTopLiXi ? 250000 : 0;

    const dummyBoxEligibility = useMemo(() => getDummyBoxEligibilityTotals(items), [items]);
    const {
        eligibleDummyBoxLocal,
        eligibleDummyBoxImport,
        eligibleDummyBoxLocal500,
        eligibleDummyBoxImport500,
        localTotalAfterDiscount,
        importTotalAfterDiscount,
    } = dummyBoxEligibility;

    const program150Checked = !!isDummyBoxLocal || !!isDummyBoxImport;
    const program500Checked = !!isDummyBoxLocal500 || !!isDummyBoxImport500;

    const dummyBoxLocalToggle = useMemo(
        () =>
            getDummyBoxToggleState(dummyBoxListGate, 'local', eligibleDummyBoxLocal, {
                amountAfterDiscount: localTotalAfterDiscount,
                mutexBlocked: program500Checked,
                mutexTitle: 'Đã chọn DummyBox 500k — không kết hợp gói 1tr',
            }),
        [dummyBoxListGate, eligibleDummyBoxLocal, localTotalAfterDiscount, program500Checked]
    );
    const dummyBoxImportToggle = useMemo(
        () =>
            getDummyBoxToggleState(dummyBoxListGate, 'import', eligibleDummyBoxImport, {
                amountAfterDiscount: importTotalAfterDiscount,
                mutexBlocked: program500Checked,
                mutexTitle: 'Đã chọn DummyBox 500k — không kết hợp gói 1tr',
            }),
        [dummyBoxListGate, eligibleDummyBoxImport, importTotalAfterDiscount, program500Checked]
    );
    const dummyBoxLocal500Toggle = useMemo(
        () =>
            getDummyBoxToggleState(dummyBox500ListGate, 'local', eligibleDummyBoxLocal500, {
                amountAfterDiscount: localTotalAfterDiscount,
                minAmount: DUMMY_BOX_500_MIN_AMOUNT,
                sheetLabel: DUMMY_BOX_500_SHEET,
                needSuffix: ' — Cần ≥500k',
                mutexBlocked: program150Checked,
                mutexTitle: 'Đã chọn DummyBox 1tr — không kết hợp gói 500k',
            }),
        [dummyBox500ListGate, eligibleDummyBoxLocal500, localTotalAfterDiscount, program150Checked]
    );
    const dummyBoxImport500Toggle = useMemo(
        () =>
            getDummyBoxToggleState(dummyBox500ListGate, 'import', eligibleDummyBoxImport500, {
                amountAfterDiscount: importTotalAfterDiscount,
                minAmount: DUMMY_BOX_500_MIN_AMOUNT,
                sheetLabel: DUMMY_BOX_500_SHEET,
                needSuffix: ' — Cần ≥500k',
                mutexBlocked: program150Checked,
                mutexTitle: 'Đã chọn DummyBox 1tr — không kết hợp gói 500k',
            }),
        [dummyBox500ListGate, eligibleDummyBoxImport500, importTotalAfterDiscount, program150Checked]
    );

    const canToggleDummyBoxLocal = dummyBoxLocalToggle.canToggle;
    const canToggleDummyBoxImport = dummyBoxImportToggle.canToggle;
    const canToggleDummyBoxLocal500 = dummyBoxLocal500Toggle.canToggle;
    const canToggleDummyBoxImport500 = dummyBoxImport500Toggle.canToggle;
    const dummyBoxLocalLockedRegistered = dummyBoxListGate?.goiLocalRegistered === true;
    const dummyBoxImportLockedRegistered = dummyBoxListGate?.goiImportRegistered === true;
    const dummyBoxLocal500LockedRegistered = dummyBox500ListGate?.goiLocalRegistered === true;
    const dummyBoxImport500LockedRegistered = dummyBox500ListGate?.goiImportRegistered === true;

    const applyDummyBoxLocal150 = canToggleDummyBoxLocal && !!isDummyBoxLocal;
    const applyDummyBoxImport150 = canToggleDummyBoxImport && !!isDummyBoxImport;
    const applyDummyBoxLocal500 = canToggleDummyBoxLocal500 && !!isDummyBoxLocal500;
    const applyDummyBoxImport500 = canToggleDummyBoxImport500 && !!isDummyBoxImport500;
    const applyDummyBoxLocal = applyDummyBoxLocal150 || applyDummyBoxLocal500;
    const applyDummyBoxImport = applyDummyBoxImport150 || applyDummyBoxImport500;
    const dummyBoxLocalDiscount = applyDummyBoxLocal150
        ? DUMMY_BOX_DISCOUNT
        : applyDummyBoxLocal500
          ? DUMMY_BOX_500_DISCOUNT
          : 0;
    const dummyBoxImportDiscount = applyDummyBoxImport150
        ? DUMMY_BOX_DISCOUNT
        : applyDummyBoxImport500
          ? DUMMY_BOX_500_DISCOUNT
          : 0;

    useEffect(() => {
        if (dummyBoxListGate === undefined) return;
        if (dummyBoxListGate.pending) return;
        const inList = dummyBoxListGate.inList;
        if (!inList && !dummyBoxLocalLockedRegistered && isDummyBoxLocal && onIsDummyBoxLocalChange) {
            onIsDummyBoxLocalChange(false);
        }
        if (!inList && !dummyBoxImportLockedRegistered && isDummyBoxImport && onIsDummyBoxImportChange) {
            onIsDummyBoxImportChange(false);
        }
        if (dummyBoxLocalLockedRegistered && isDummyBoxLocal && onIsDummyBoxLocalChange) onIsDummyBoxLocalChange(false);
        if (dummyBoxImportLockedRegistered && isDummyBoxImport && onIsDummyBoxImportChange) onIsDummyBoxImportChange(false);
    }, [
        dummyBoxListGate,
        dummyBoxLocalLockedRegistered,
        dummyBoxImportLockedRegistered,
        isDummyBoxLocal,
        isDummyBoxImport,
        onIsDummyBoxLocalChange,
        onIsDummyBoxImportChange,
    ]);

    useEffect(() => {
        if (dummyBox500ListGate === undefined) return;
        if (dummyBox500ListGate.pending) return;
        const inList = dummyBox500ListGate.inList;
        if (!inList && !dummyBoxLocal500LockedRegistered && isDummyBoxLocal500 && onIsDummyBoxLocal500Change) {
            onIsDummyBoxLocal500Change(false);
        }
        if (!inList && !dummyBoxImport500LockedRegistered && isDummyBoxImport500 && onIsDummyBoxImport500Change) {
            onIsDummyBoxImport500Change(false);
        }
        if (dummyBoxLocal500LockedRegistered && isDummyBoxLocal500 && onIsDummyBoxLocal500Change) {
            onIsDummyBoxLocal500Change(false);
        }
        if (dummyBoxImport500LockedRegistered && isDummyBoxImport500 && onIsDummyBoxImport500Change) {
            onIsDummyBoxImport500Change(false);
        }
    }, [
        dummyBox500ListGate,
        dummyBoxLocal500LockedRegistered,
        dummyBoxImport500LockedRegistered,
        isDummyBoxLocal500,
        isDummyBoxImport500,
        onIsDummyBoxLocal500Change,
        onIsDummyBoxImport500Change,
    ]);

    useEffect(() => {
        if (!program150Checked || !program500Checked) return;
        if (isDummyBoxLocal500 && onIsDummyBoxLocal500Change) onIsDummyBoxLocal500Change(false);
        if (isDummyBoxImport500 && onIsDummyBoxImport500Change) onIsDummyBoxImport500Change(false);
    }, [
        program150Checked,
        program500Checked,
        isDummyBoxLocal500,
        isDummyBoxImport500,
        onIsDummyBoxLocal500Change,
        onIsDummyBoxImport500Change,
    ]);

    // CTKM gói 4.76% đã kết thúc: luôn tắt cờ để tránh đơn nháp cũ còn áp dụng.
    useEffect(() => {
        if (!onIsCalciPlusPack476Change || !isCalciPlusPack476) return;
        onIsCalciPlusPack476Change(false);
    }, [isCalciPlusPack476, onIsCalciPlusPack476Change]);

    const ontopPromoActive = isChc2606OntopPromoActive();
    const ontopPreview = useMemo(
        () => calcChc2606OntopTotals(items, cartGroupTotals, false),
        [items, cartGroupTotals]
    );
    const canToggleChc2606Ontop =
        ontopPromoActive && !isPsOnInvoice25 && ontopPreview.eligible;
    const effectiveChc2606Ontop = canToggleChc2606Ontop && !!isChc2606Ontop;
    const ontopLocalPercent = effectiveChc2606Ontop ? ontopPreview.localPercent : 0;
    const ontopImportPercent = effectiveChc2606Ontop ? ontopPreview.importPercent : 0;
    const ontopAppliedTotals = useMemo(
        () => calcChc2606OntopTotals(items, cartGroupTotals, effectiveChc2606Ontop),
        [items, cartGroupTotals, effectiveChc2606Ontop]
    );

    useEffect(() => {
        if (!onIsChc2606OntopChange || !isChc2606Ontop) return;
        if (!canToggleChc2606Ontop) onIsChc2606OntopChange(false);
    }, [canToggleChc2606Ontop, isChc2606Ontop, onIsChc2606OntopChange]);

    const calciPlusPack476Discount = 0;

    const { dummyLocalPercent, dummyImportPercent } = useMemo(
        () =>
            getCartDummyBoxPercents({
                applyDummyBoxLocal,
                applyDummyBoxImport,
                dummyBoxLocalDiscount,
                dummyBoxImportDiscount,
                dummyBoxLocalPoolExVat: localTotalAfterDiscount,
                dummyBoxImportPoolExVat: importTotalAfterDiscount,
            }),
        [
            applyDummyBoxLocal,
            applyDummyBoxImport,
            dummyBoxLocalDiscount,
            dummyBoxImportDiscount,
            localTotalAfterDiscount,
            importTotalAfterDiscount,
        ]
    );

    const psDiscountGross = psTotals?.discountGross ?? 0;

    const localRebates = rebates.filter(r => r.Group === 'LOCAL');
    const importRebates = rebates.filter(r => r.Group === 'IMPORT');
    const allGroupRebates = rebates.filter(r => r.Group === 'ALL');

    const maxPayableFees = useMemo(
        () =>
            computeMaxPayableFees(items, { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal }, {
                psDiscountGross: isPsOnInvoice25 ? psDiscountGross : 0,
                maxDiscountRatio: isPsOnInvoice25
                    ? MAX_PRODUCT_DISCOUNT_RATIO
                    : MAX_PRODUCT_DISCOUNT_RATIO_STANDARD,
                excludeMonthlyFromCap: isPsOnInvoice25,
            }),
        [items, telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal, isPsOnInvoice25, psDiscountGross]
    );

    const feeCapByItemId = useMemo(() => {
        const m = new Map<number, (typeof maxPayableFees.lines)[0]>();
        maxPayableFees.lines.forEach(l => m.set(l.itemId, l));
        return m;
    }, [maxPayableFees.lines]);

    const { totalMaxPayableFeeLocal, totalMaxPayableFeeImport } = maxPayableFees;

    const {
        rebateDiscount,
        rebateDiscountLocalApplied,
        rebateDiscountImportApplied,
        selectedLocalRebateTotal,
        selectedImportRebateTotal,
        selectedAllRebateTotal,
        totalMaxPayableFeeAll,
    } = useMemo(
        () => computeAppliedRebates(rebates, selectedRebateIds, maxPayableFees),
        [rebates, selectedRebateIds, maxPayableFees]
    );

    const rebateAllocByItemId = useMemo(() => {
        const lineOpts = {
            psTotals: psTotals ?? undefined,
            dummyLocalPercent,
            dummyImportPercent,
            ontopLocalPercent,
            ontopImportPercent,
        };
        const alloc = allocateRebateExVatPerItem(
            items,
            cartGroupTotals,
            lineOpts,
            rebateDiscountLocalApplied,
            rebateDiscountImportApplied
        );
        const m = new Map<number, number>();
        items.forEach((item, i) => m.set(item.id, alloc[i]));
        return m;
    }, [
        items,
        cartGroupTotals,
        psTotals,
        dummyLocalPercent,
        dummyImportPercent,
        ontopLocalPercent,
        ontopImportPercent,
        rebateDiscountLocalApplied,
        rebateDiscountImportApplied,
    ]);

    // --- Submit Validation ---
    const localProductCount = items.filter(i => i.type === 'Local').length;
    const importProductCount = items.filter(i => i.type === 'Import').length;

    const localOver = selectedLocalRebateTotal > totalMaxPayableFeeLocal && totalMaxPayableFeeLocal > 0;
    const importOver = selectedImportRebateTotal > totalMaxPayableFeeImport && totalMaxPayableFeeImport > 0;
    const allOver = selectedAllRebateTotal > totalMaxPayableFeeAll && totalMaxPayableFeeAll > 0;
    const hasLocalMaxNote = note.includes('Trả tối đa phí Local');
    const hasImportMaxNote = note.includes('Trả tối đa phí Import');
    const hasAllMaxNote = note.includes('Trả tối đa phí ALL');

    const feeOverNeedsNote =
        !rebatePaymentLocked &&
        ((localOver && !hasLocalMaxNote) || (importOver && !hasImportMaxNote) || (allOver && !hasAllMaxNote));
    const rebateWithoutProducts =
        !rebatePaymentLocked &&
        ((selectedLocalRebateTotal > 0 && localProductCount < 1) ||
            (selectedImportRebateTotal > 0 && importProductCount < 1) ||
            (selectedAllRebateTotal > 0 && localProductCount + importProductCount < 1));
    const psSubmitBlocked =
        isPsOnInvoice25 &&
        psTotals != null &&
        (psTotals.suatRemaining < 1 || !psTotals.eligible);
    const isSubmitBlocked = feeOverNeedsNote || rebateWithoutProducts || psSubmitBlocked;

    const showSubmitSuccessUi = useMemo(
        () => /gửi đơn thành công/i.test(successMessage ?? ''),
        [successMessage]
    );

    const handleSubmitWithValidation = () => {
        if (isSubmitBlocked) return;
        onSubmitOrder();
    };

    const finalAmount = useMemo(
        () =>
            computeCartFinalAmountWithVat({
                items,
                groupTotals: cartGroupTotals,
                psTotals: psTotals ?? undefined,
                applyDummyBoxLocal,
                applyDummyBoxImport,
                dummyBoxLocalDiscount,
                dummyBoxImportDiscount,
                dummyBoxLocalPoolExVat: localTotalAfterDiscount,
                dummyBoxImportPoolExVat: importTotalAfterDiscount,
                ontopLocalPercent,
                ontopImportPercent,
                rebateAppliedLocal: rebateDiscountLocalApplied,
                rebateAppliedImport: rebateDiscountImportApplied,
                onTopLiXiDiscount,
                calciPlusPack476Discount,
            }),
        [
            items,
            cartGroupTotals,
            psTotals,
            applyDummyBoxLocal,
            applyDummyBoxImport,
            dummyBoxLocalDiscount,
            dummyBoxImportDiscount,
            localTotalAfterDiscount,
            importTotalAfterDiscount,
            ontopLocalPercent,
            ontopImportPercent,
            rebateDiscountLocalApplied,
            rebateDiscountImportApplied,
            onTopLiXiDiscount,
            calciPlusPack476Discount,
        ]
    );

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
                                    onClick={() => setShowCustomerDetailModal(true)}
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

                    {customerCode.trim() && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/90 px-2.5 py-2 space-y-2 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Loại PS
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black bg-[#003629]/10 text-[#003629] dark:bg-[#8abda9]/20 dark:text-[#8abda9] border border-[#003629]/15 dark:border-[#8abda9]/30">
                                    {psTierLabel}
                                </span>
                            </div>
                            <div
                                className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 border ${
                                    pharmatonViGoiDot1Purchased
                                        ? 'bg-red-50 dark:bg-red-950/45 border-red-300 dark:border-red-700'
                                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                                }`}
                                title={
                                    pharmatonViGoiDot1Purchased
                                        ? 'KH đã mua gói PHARMATON VỈ Đợt 1 — không ghi nhận Đợt 2'
                                        : 'KH chưa có dòng gói PMT Vỉ Đợt 1 trên sheet'
                                }
                            >
                                <span
                                    className={`font-bold text-[10px] ${
                                        pharmatonViGoiDot1Purchased
                                            ? 'text-red-800 dark:text-red-200'
                                            : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    PMT Vỉ Đợt 1
                                </span>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                                        pharmatonViGoiDot1Purchased
                                            ? 'bg-red-600 text-white dark:bg-red-500'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {pharmatonViGoiDot1Purchased ? 'ĐÃ MUA' : 'CHƯA MUA'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 px-2 py-1.5">
                                    <span className="font-bold text-red-800/80 dark:text-red-200/90">Sale T8 đã đặt</span>
                                    <span className="font-black tabular-nums text-red-700 dark:text-red-200">
                                        {psDisplayMetrics.saleT8 > 0
                                            ? formatCurrency(Math.round(psDisplayMetrics.saleT8))
                                            : '—'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 px-2 py-1.5">
                                    <span className="font-bold text-sky-800/80 dark:text-sky-200/90">Target trưng bày</span>
                                    <span className="font-black tabular-nums text-sky-800 dark:text-sky-100">
                                        {psDisplayMetrics.target > 0
                                            ? formatCurrency(psDisplayMetrics.target)
                                            : '—'}
                                    </span>
                                </div>
                                <div
                                    className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 border ${
                                        psDisplayMetrics.todo == null
                                            ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                                            : psDisplayMetrics.todo > 0
                                              ? 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/50'
                                              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50'
                                    }`}
                                >
                                    <span
                                        className={`font-bold ${
                                            psDisplayMetrics.todo == null
                                                ? 'text-slate-600 dark:text-slate-300'
                                                : psDisplayMetrics.todo > 0
                                                  ? 'text-red-800/80 dark:text-red-200/90'
                                                  : 'text-emerald-800/80 dark:text-emerald-200/90'
                                        }`}
                                    >
                                        Todo
                                    </span>
                                    <span
                                        className={`font-black tabular-nums ${
                                            psDisplayMetrics.todo == null
                                                ? 'text-slate-400'
                                                : psDisplayMetrics.todo > 0
                                                  ? 'text-red-700 dark:text-red-200'
                                                  : 'text-emerald-700 dark:text-emerald-200'
                                        }`}
                                    >
                                        {psDisplayMetrics.todo != null
                                            ? formatCurrency(Math.round(psDisplayMetrics.todo))
                                            : '—'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                                    <span className="font-bold text-slate-600 dark:text-slate-300">Tình trạng</span>
                                    {psDisplayMetrics.status == null ? (
                                        <span className="font-bold text-slate-400">—</span>
                                    ) : (
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                                                psDisplayMetrics.status === 'dat'
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                                            }`}
                                        >
                                            {psDisplayMetrics.status === 'dat' ? 'ĐẠT' : 'CHƯA ĐẠT'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {ENABLE_PS_25_ORDER_IN_CART && psGate?.canShowCk25 && onIsPsOnInvoice25Change && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPsOnInvoice25}
                                        onChange={e => onIsPsOnInvoice25Change(e.target.checked)}
                                        className="h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-[11px] font-black text-red-600 dark:text-red-400">
                                        {PS_ON_INVOICE_NOTE_MARKER}
                                    </span>
                                </label>
                            )}
                            {ENABLE_PS_25_ORDER_IN_CART && isPsOnInvoice25 && psTotals && (
                                <div className="space-y-1 rounded-md bg-violet-50/90 dark:bg-violet-950/35 border border-violet-100 dark:border-violet-900/40 px-2 py-1.5">
                                    <p className="text-[10px] font-bold text-violet-900 dark:text-violet-100">
                                        Suất còn {psTotals.suatRemaining}/{psTotals.suatMax}
                                        {psTotals.isMultiSuat
                                            ? ` · Đơn này: ${psTotals.suatApplied || psSuatSelected || 0} suất`
                                            : ''}
                                    </p>
                                    {psTotals.isMultiSuat && onPsSuatSelectedChange && psSuatPickMax >= 1 && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Số suất:</span>
                                            <select
                                                value={Math.max(1, Math.min(psSuatSelected || 1, psSuatPickMax))}
                                                onChange={e => onPsSuatSelectedChange(Number(e.target.value))}
                                                className="text-[10px] font-bold border border-violet-300 dark:border-violet-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800"
                                            >
                                                {Array.from({ length: psSuatPickMax }, (_, i) => i + 1).map(n => (
                                                    <option key={n} value={n}>
                                                        {n} suất ({formatCurrency(n * psTotals.minPerSuat)})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <p className={`text-[10px] font-bold ${psTotals.eligible ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                        Cần ≥ {formatCurrency(psTotals.minOrder)} (basePrice) · Hiện {formatCurrency(psTotals.baseSubtotal)}
                                        {psTotals.eligible
                                            ? ` · Giảm ${formatCurrency(psTotals.discountGross)}`
                                            : ' · Chưa đủ điều kiện'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {rebates.length > 0 && (
                        <div className={`mt-2 space-y-2 ${rebatePaymentLocked ? 'opacity-60' : ''}`}>
                            {rebatePaymentLocked && (
                                <p className="text-[10px] font-bold text-violet-800 dark:text-violet-200 px-2 py-1 rounded border border-violet-200 dark:border-violet-700 bg-violet-50/90 dark:bg-violet-950/40">
                                    {PS_ON_INVOICE_NOTE_MARKER}: không chọn trả phí rebate trên đơn này.
                                </p>
                            )}
                            {localRebates.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-wide rounded border border-green-100 dark:border-green-800/50">
                                        TỔNG PHÍ CẦN TRẢ LOCAL: {formatCurrency(rebatePaymentLocked ? 0 : selectedLocalRebateTotal)}
                                    </p>
                                    {localRebates.map(r => (
                                        <label key={r["PromotionID#program"]} title={rebatePaymentLocked ? 'Đã khóa — đơn CK PS 25%' : undefined} className={`flex items-start p-2.5 rounded-lg border transition-all ${rebatePaymentLocked ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' : `cursor-pointer ${selectedRebateIds.includes(r["PromotionID#program"]) ? 'bg-opella-beige/50 dark:bg-opella-green/20 border-opella-green/50 dark:border-opella-green shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}`}>
                                            <input type="checkbox" checked={!rebatePaymentLocked && selectedRebateIds.includes(r["PromotionID#program"])} disabled={rebatePaymentLocked} onChange={() => onToggleRebate(r["PromotionID#program"])} className="mt-1 h-4 w-4 rounded text-opella-green focus:ring-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" />
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
                                        TỔNG PHÍ CẦN TRẢ IMPORT: {formatCurrency(rebatePaymentLocked ? 0 : selectedImportRebateTotal)}
                                    </p>
                                    {importRebates.map(r => (
                                        <label key={r["PromotionID#program"]} title={rebatePaymentLocked ? 'Đã khóa — đơn CK PS 25%' : undefined} className={`flex items-start p-2.5 rounded-lg border transition-all ${rebatePaymentLocked ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' : `cursor-pointer ${selectedRebateIds.includes(r["PromotionID#program"]) ? 'bg-opella-beige/50 dark:bg-opella-green/20 border-opella-green/50 dark:border-opella-green shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}`}>
                                            <input type="checkbox" checked={!rebatePaymentLocked && selectedRebateIds.includes(r["PromotionID#program"])} disabled={rebatePaymentLocked} onChange={() => onToggleRebate(r["PromotionID#program"])} className="mt-1 h-4 w-4 rounded text-opella-green focus:ring-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" />
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

                            {allGroupRebates.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="px-2 py-1 bg-violet-50 dark:bg-violet-900/20 text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-wide rounded border border-violet-100 dark:border-violet-800/50">
                                        TỔNG PHÍ CẦN TRẢ ALL (Local + Import): {formatCurrency(rebatePaymentLocked ? 0 : selectedAllRebateTotal)}
                                    </p>
                                    {allGroupRebates.map(r => (
                                        <label key={r["PromotionID#program"]} title={rebatePaymentLocked ? 'Đã khóa — đơn CK PS 25%' : undefined} className={`flex items-start p-2.5 rounded-lg border transition-all ${rebatePaymentLocked ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' : `cursor-pointer ${selectedRebateIds.includes(r["PromotionID#program"]) ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}`}>
                                            <input type="checkbox" checked={!rebatePaymentLocked && selectedRebateIds.includes(r["PromotionID#program"])} disabled={rebatePaymentLocked} onChange={() => onToggleRebate(r["PromotionID#program"])} className="mt-1 h-4 w-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" />
                                            <div className="ml-2.5 flex-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{r["PromotionID#program"]}</span>
                                                    <span className="text-xs font-black text-red-600 dark:text-red-400 ml-2">-{formatCurrency(r.RemainAmount)}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Group ALL · Hạn: <span className="font-semibold">{formatRebateDate(r)}</span>
                                                </div>
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
                                <th className="px-2 py-2 text-right w-[20%]">Giá hộp</th>
                                <th className="px-3 py-2 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {items.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm italic">Chưa có sản phẩm nào</td></tr>
                            ) : (
                                items.map(item => {
                                    const lineCap = feeCapByItemId.get(item.id);
                                    const lineTotalWithVat = getCartLineAmountWithVat(item, cartGroupTotals, {
                                        psTotals: psTotals ?? undefined,
                                        dummyLocalPercent,
                                        dummyImportPercent,
                                        ontopLocalPercent,
                                        ontopImportPercent,
                                        rebateAllocExVat: rebateAllocByItemId.get(item.id) ?? 0,
                                    });

                                    const boxPrice = item.quantity > 0 ? lineTotalWithVat / item.quantity : 0;

                                    if (isPsOnInvoice25) {
                                        const unitPs = getPsCartUnitPrice(item);
                                        return (
                                            <CartItemRow
                                                key={item.id}
                                                item={item}
                                                lineTotal={lineTotalWithVat}
                                                boxPrice={boxPrice}
                                                monthlyDiscountPercent={0}
                                                hideLineDiscount
                                                unitPrice={unitPs}
                                                isGrouped={false}
                                                onUpdateQuantity={onUpdateQuantity}
                                                onRemoveItem={onRemoveItem}
                                            />
                                        );
                                    }

                                    const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
                                    const isOstelinGroup = OSTELIN_GROUP_IDS.includes(item.id);
                                    const isAcemucGroup = ACEMUC_GROUP_IDS.includes(item.id);

                                    const compareValue = isTelfastGroup ? telfastGroupTotal
                                        : isOstelinGroup ? ostelinGroupBaseTotal
                                        : isAcemucGroup ? acemucGroupBaseTotal
                                        : item.price * item.quantity;

                                    const monthlyDiscountPercent = lineCap?.monthlyDiscountPercent ?? getDiscountPercent(
                                        item.promotion,
                                        item.quantity,
                                        compareValue
                                    );

                                    return (
                                        <CartItemRow
                                            key={item.id}
                                            item={item}
                                            lineTotal={lineTotalWithVat}
                                            boxPrice={boxPrice}
                                            monthlyDiscountPercent={monthlyDiscountPercent}
                                            isGrouped={isTelfastGroup || isOstelinGroup || isAcemucGroup}
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
                            <span className="text-[8px] text-slate-400 uppercase font-normal">(ko VAT)</span>
                        </div>
                        <div className="flex items-baseline space-x-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Doanh số:</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalSales)}</span>
                            <span className="text-[8px] text-slate-400 uppercase font-normal">(ko VAT)</span>
                        </div>
                    </div>

                    {/* DS Nhóm đặc biệt - Thu nhỏ tối đa */}
                    {(telfastGroupTotal > 0 || ostelinGroupBaseTotal > 0 || acemucGroupBaseTotal > 0) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1 italic">
                            {telfastGroupTotal > 0 && (
                                <div className="flex items-center space-x-1">
                                    <span className="text-[8px] font-medium text-slate-400 uppercase">DS Telfast:</span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formatCurrency(telfastGroupTotal)}</span>
                                </div>
                            )}
                            {ostelinGroupBaseTotal > 0 && (
                                <div className="flex items-center space-x-1">
                                    <span className="text-[8px] font-medium text-slate-400 uppercase">DS Ostelin (base):</span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formatCurrency(ostelinGroupBaseTotal)}</span>
                                </div>
                            )}
                            {acemucGroupBaseTotal > 0 && (
                                <div className="flex items-center space-x-1">
                                    <span className="text-[8px] font-medium text-slate-400 uppercase">DS ACEMUC (base):</span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formatCurrency(acemucGroupBaseTotal)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toggles - DummyBox: luôn hiện; tick chỉ khi KH trong sheet & đủ điều kiện */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 py-0.5">
                        {onIsDummyBoxLocalChange && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-local" checked={!!isDummyBoxLocal && canToggleDummyBoxLocal} onChange={(e) => onIsDummyBoxLocalChange(e.target.checked)} disabled={!canToggleDummyBoxLocal} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-local" className={`text-[11px] font-bold ${canToggleDummyBoxLocal ? 'cursor-pointer text-slate-600 dark:text-slate-300' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`} title={dummyBoxLocalToggle.title}>
                                    DummyBox Local (-150k){dummyBoxLocalLockedRegistered ? ' · Đã đặt' : dummyBoxLocalToggle.labelSuffix}
                                </label>
                            </div>
                        )}
                        {onIsDummyBoxImportChange && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-import" checked={!!isDummyBoxImport && canToggleDummyBoxImport} onChange={(e) => onIsDummyBoxImportChange(e.target.checked)} disabled={!canToggleDummyBoxImport} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-import" className={`text-[11px] font-bold ${canToggleDummyBoxImport ? 'cursor-pointer text-slate-600 dark:text-slate-300' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`} title={dummyBoxImportToggle.title}>
                                    DummyBox Import (-150k){dummyBoxImportLockedRegistered ? ' · Đã đặt' : dummyBoxImportToggle.labelSuffix}
                                </label>
                            </div>
                        )}
                        {onIsDummyBoxLocal500Change && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-local-500" checked={!!isDummyBoxLocal500 && canToggleDummyBoxLocal500} onChange={(e) => onIsDummyBoxLocal500Change(e.target.checked)} disabled={!canToggleDummyBoxLocal500} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-local-500" className={`text-[11px] font-bold ${canToggleDummyBoxLocal500 ? 'cursor-pointer text-slate-600 dark:text-slate-300' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`} title={dummyBoxLocal500Toggle.title}>
                                    DummyBox Local (-75k){dummyBoxLocal500LockedRegistered ? ' · Đã đặt' : dummyBoxLocal500Toggle.labelSuffix}
                                </label>
                            </div>
                        )}
                        {onIsDummyBoxImport500Change && (
                            <div className="flex items-center space-x-1.5">
                                <input type="checkbox" id="dummy-box-import-500" checked={!!isDummyBoxImport500 && canToggleDummyBoxImport500} onChange={(e) => onIsDummyBoxImport500Change(e.target.checked)} disabled={!canToggleDummyBoxImport500} className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="dummy-box-import-500" className={`text-[11px] font-bold ${canToggleDummyBoxImport500 ? 'cursor-pointer text-slate-600 dark:text-slate-300' : 'cursor-not-allowed text-slate-400 dark:text-slate-500'}`} title={dummyBoxImport500Toggle.title}>
                                    DummyBox Import (-75k){dummyBoxImport500LockedRegistered ? ' · Đã đặt' : dummyBoxImport500Toggle.labelSuffix}
                                </label>
                            </div>
                        )}
                        {ontopPromoActive && !isPsOnInvoice25 && onIsChc2606OntopChange && (
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center space-x-1.5">
                                    <input
                                        type="checkbox"
                                        id="chc2606-ontop"
                                        checked={!!isChc2606Ontop && canToggleChc2606Ontop}
                                        onChange={e => onIsChc2606OntopChange(e.target.checked)}
                                        disabled={!canToggleChc2606Ontop}
                                        className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <label
                                        htmlFor="chc2606-ontop"
                                        className={`text-[11px] font-bold ${
                                            canToggleChc2606Ontop
                                                ? 'cursor-pointer text-slate-600 dark:text-slate-300'
                                                : 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                                        }`}
                                        title="CHC2606-ONTOP: tổng basePrice pool Local/Import ≥10M +2.46%; ≥25M +2.96%; ≥50M +3.94% (CK áp sau CK tháng)"
                                    >
                                        Gói ONTOP
                                        {effectiveChc2606Ontop && ontopAppliedTotals.discountTotal > 0
                                            ? ` (-${formatCurrency(ontopAppliedTotals.discountTotal)})`
                                            : ''}
                                    </label>
                                </div>
                                <p className="ml-5 mr-0.5 rounded-md border border-red-300/80 dark:border-red-700/60 bg-red-50 dark:bg-red-950/45 px-2 py-1 text-[9px] font-bold leading-snug text-red-800 dark:text-red-200">
                                    Local (base): {formatCurrency(ontopPreview.localPoolBase)}
                                    {ontopPreview.localPercent > 0
                                        ? ` · ${formatChc2606OntopPercent(ontopPreview.localPercent)}`
                                        : ' · chưa đủ 10M'}
                                    {' · '}
                                    Import (base): {formatCurrency(ontopPreview.importPoolBase)}
                                    {ontopPreview.importPercent > 0
                                        ? ` · ${formatChc2606OntopPercent(ontopPreview.importPercent)}`
                                        : ' · chưa đủ 10M'}
                                </p>
                            </div>
                        )}
                        {CART_OSTELIN_TANG_CAN_VISIBLE && (
                        <div className="flex items-center space-x-1.5">
                            <input
                                type="checkbox"
                                id="ostelin-60v-goi"
                                checked={hasOstelinTangCanNote}
                                onChange={toggleOstelinTangCanNote}
                                disabled={ostelin60VTangCanLocked || !ostelin60vEligible}
                                className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                    ostelin60VTangCanLocked
                                        ? 'KH đã mua gói Ostelin Đợt 2 (tặng máy đo HA) — không chọn lại'
                                        : !ostelin60vEligible
                                            ? `Cần ≥ ${OSTELIN_60V_GOI_MIN_QTY} hộp Ostelin 60V trong giỏ`
                                            : undefined
                                }
                            />
                            <label
                                htmlFor="ostelin-60v-goi"
                                className={`text-[11px] font-bold ${
                                    ostelin60VTangCanLocked || !ostelin60vEligible
                                        ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                                        : 'cursor-pointer text-slate-600 dark:text-slate-300'
                                }`}
                                title={
                                    ostelin60VTangCanLocked
                                        ? 'KH đã mua gói Ostelin Đợt 2 (tặng máy đo HA) — không chọn lại'
                                        : !ostelin60vEligible
                                            ? `Cần ≥ ${OSTELIN_60V_GOI_MIN_QTY} hộp Ostelin 60V (id ${OSTELIN_60V_PRODUCT_ID})`
                                            : 'Mua 5h ck 21.67% + tặng máy đo HA — ghi sheet khi tick và gửi đơn (KH Đợt 1 được tick Đợt 2)'
                                }
                            >
                                Ostelin tặng máy đo HA{ostelin60VTangCanLocked ? ' · Đã gói Đợt 2' : ''}
                            </label>
                        </div>
                        )}
                    </div>

                    {/* Deductions - Chỉ hiện khi có số */}
                    {(isPsOnInvoice25 && psDiscountGross > 0) || (isOnTopLiXi || applyDummyBoxLocal150 || applyDummyBoxImport150 || applyDummyBoxLocal500 || applyDummyBoxImport500 || effectiveChc2606Ontop || calciPlusPack476Discount > 0 || rebateDiscount > 0) && (
                        <div className="space-y-0.5 py-0.5 border-t border-slate-50 dark:border-slate-700 mt-0.5">
                            {isPsOnInvoice25 && psDiscountGross > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-600 dark:text-red-400 italic">
                                    <span>
                                        - {PS_ON_INVOICE_NOTE_MARKER} ({psGate?.tierLabel}
                                        {(psTotals?.suatApplied ?? 0) >= 1
                                            ? ` ${psTotals!.suatApplied}/${psTotals!.suatMax}`
                                            : ''}
                                        ):
                                    </span>
                                    <span>-{formatCurrency(psDiscountGross)}</span>
                                </div>
                            )}
                            {isOnTopLiXi && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ Ontop lì xì:</span>
                                    <span>-{formatCurrency(250000)}</span>
                                </div>
                            )}
                            {applyDummyBoxLocal150 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Local:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_DISCOUNT)}</span>
                                </div>
                            )}
                            {applyDummyBoxImport150 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Import:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_DISCOUNT)}</span>
                                </div>
                            )}
                            {applyDummyBoxLocal500 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Local 500k:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_500_DISCOUNT)}</span>
                                </div>
                            )}
                            {applyDummyBoxImport500 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ DummyBox Import 500k:</span>
                                    <span>-{formatCurrency(DUMMY_BOX_500_DISCOUNT)}</span>
                                </div>
                            )}
                            {effectiveChc2606Ontop && ontopAppliedTotals.discountLocal > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- CK ONTOP Local ({formatChc2606OntopPercent(ontopPreview.localPercent)}):</span>
                                    <span>-{formatCurrency(ontopAppliedTotals.discountLocal)}</span>
                                </div>
                            )}
                            {effectiveChc2606Ontop && ontopAppliedTotals.discountImport > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- CK ONTOP Import ({formatChc2606OntopPercent(ontopPreview.importPercent)}):</span>
                                    <span>-{formatCurrency(ontopAppliedTotals.discountImport)}</span>
                                </div>
                            )}
                            {calciPlusPack476Discount > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-500 dark:text-red-400 italic">
                                    <span>- Trừ gói 4.76%:</span>
                                    <span>-{formatCurrency(calciPlusPack476Discount)}</span>
                                </div>
                            )}
                            {rebateDiscount > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-red-600 dark:text-red-400 italic">
                                    <span>- Khấu trừ Rebate (Max, trước VAT):</span>
                                    <span>-{formatCurrency(rebateDiscount)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {psSubmitBlocked && (
                        <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 py-1">
                            {psTotals && psTotals.suatRemaining < 1
                                ? `Đã hết suất PS — không thể gửi đơn với ${PS_ON_INVOICE_NOTE_MARKER}.`
                                : `Chưa đạt điều kiện PS (tổng ≥ mức tối thiểu theo số suất) — không thể gửi đơn với ${PS_ON_INVOICE_NOTE_MARKER}.`}
                        </p>
                    )}

                    {ENABLE_PS_25_ORDER_IN_CART && isPsOnInvoice25 && (
                        <p className="text-[9px] text-violet-700 dark:text-violet-300 font-bold py-0.5">
                            {PS_ON_INVOICE_NOTE_MARKER}: CK tối đa 49% theo basePrice — không trả phí rebate trên đơn này.
                        </p>
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
                                    checked={!rebatePaymentLocked && note.includes('Trả tối đa phí Local')}
                                    disabled={rebatePaymentLocked}
                                    onChange={() => toggleNotePreset('Trả tối đa phí Local')}
                                    className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <label htmlFor="note-local-max" className={`text-[11px] font-bold text-slate-600 dark:text-slate-300 ${rebatePaymentLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>Trả tối đa phí Local</label>
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
                                    checked={!rebatePaymentLocked && note.includes('Trả tối đa phí Import')}
                                    disabled={rebatePaymentLocked}
                                    onChange={() => toggleNotePreset('Trả tối đa phí Import')}
                                    className="h-3.5 w-3.5 rounded text-opella-green border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-opella-green disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <label htmlFor="note-import-max" className={`text-[11px] font-bold text-slate-600 dark:text-slate-300 ${rebatePaymentLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>Trả tối đa phí Import</label>
                            </div>
                        </div>
                        {/* ALL */}
                        {allGroupRebates.length > 0 && (
                            <div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-baseline space-x-1.5">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Phí ALL Max (còn lại):</span>
                                        <span className={`text-[10px] font-black ${selectedAllRebateTotal > totalMaxPayableFeeAll && totalMaxPayableFeeAll > 0 ? 'text-red-500 dark:text-red-400' : 'text-violet-600 dark:text-violet-400'}`}>{formatCurrency(totalMaxPayableFeeAll)}</span>
                                    </div>
                                    {selectedAllRebateTotal > 0 && (
                                        <div className="flex items-baseline space-x-1.5">
                                            <span className={`text-[9px] font-bold uppercase ${selectedAllRebateTotal > totalMaxPayableFeeAll && totalMaxPayableFeeAll > 0 ? 'text-red-500' : 'text-amber-500'}`}>Tổng Phí Cần Trả:</span>
                                            <span className={`text-[10px] font-black ${selectedAllRebateTotal > totalMaxPayableFeeAll && totalMaxPayableFeeAll > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>-{formatCurrency(selectedAllRebateTotal)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                    <input
                                        type="checkbox"
                                        id="note-all-max"
                                        checked={!rebatePaymentLocked && note.includes('Trả tối đa phí ALL')}
                                        disabled={rebatePaymentLocked}
                                        onChange={() => toggleNotePreset('Trả tối đa phí ALL')}
                                        className="h-3.5 w-3.5 rounded text-violet-600 border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <label htmlFor="note-all-max" className={`text-[11px] font-bold text-slate-600 dark:text-slate-300 ${rebatePaymentLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>Trả tối đa phí ALL</label>
                                </div>
                            </div>
                        )}
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
                                    {allOver && !hasAllMaxNote && (
                                        <p>• Phí ALL cần trả <span className="font-bold">{formatCurrency(selectedAllRebateTotal)}</span> vượt Max còn lại <span className="font-bold">{formatCurrency(totalMaxPayableFeeAll)}</span>. Chọn &quot;Trả tối đa phí ALL&quot; để xác nhận.</p>
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
                                    {selectedAllRebateTotal > 0 && localProductCount + importProductCount < 1 && (
                                        <p>• Chọn trả phí ALL nhưng đơn chưa có sản phẩm. Cần ít nhất 1 sản phẩm Local hoặc Import.</p>
                                    )}
                                </>
                            )}
                            <p className="mt-1 text-[9px] opacity-90">Chỉnh sửa theo hướng dẫn trên để gửi đơn.</p>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={onSaveDraft} disabled={items.length === 0} className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 rounded-lg font-bold text-[10px] transition-all uppercase border border-slate-200 dark:border-slate-600"><SaveIcon /><span className="ml-1">Lưu nháp</span></button>
                        <AnimatedSubmitOrderButton
                            disabled={items.length === 0 || isSubmitBlocked}
                            isLoading={isLoading}
                            showSubmitSuccess={showSubmitSuccessUi}
                            onClick={handleSubmitWithValidation}
                        />
                    </div>
                </div>
                {successMessage && <div className="mt-1 text-center text-[9px] font-bold text-green-600 dark:text-green-400 animate-bounce">{successMessage}</div>}
            </div>

            {/* Modal thông tin doanh số KH - dùng Portal để tránh bị overflow parent */}
            {showCustomerDetailModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCustomerDetailModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-slate-800 dark:text-white uppercase text-sm">Thông tin doanh số khách hàng</h3>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {currentSalesRecord
                                ? <CustomerSalesNoticeContent record={currentSalesRecord} employeeName={employeeName ?? ''} />
                                : <span className="text-slate-400 italic">Không tìm thấy thông tin khách hàng. Vui lòng kiểm tra mã KH.</span>}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-600 flex gap-2 justify-end">
                            {onViewCustomerDetail && customerCode && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCustomerDetailModal(false);
                                        onViewCustomerDetail(customerCode);
                                    }}
                                    className="px-4 py-2 rounded-lg font-bold text-sm bg-opella-green hover:bg-opella-green/90 text-white transition-colors flex items-center gap-1.5"
                                >
                                    <InfoIcon />
                                    Xem chi tiết KH
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowCustomerDetailModal(false)}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={!currentSalesRecord || !onExportSales || isExporting}
                                onClick={async () => {
                                    if (!currentSalesRecord || !onExportSales) return;
                                    setIsExporting(true);
                                    try {
                                        await onExportSales(currentSalesRecord);
                                        alert('Đã gửi thông tin doanh số qua n8n/Telegram.');
                                        setShowCustomerDetailModal(false);
                                    } catch {
                                        alert('Gửi thất bại. Vui lòng thử lại.');
                                    } finally {
                                        setIsExporting(false);
                                    }
                                }}
                                className="px-4 py-2 rounded-lg font-bold text-sm bg-opella-green hover:bg-opella-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isExporting ? 'Đang gửi...' : 'Xuất thông báo'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Cart;
