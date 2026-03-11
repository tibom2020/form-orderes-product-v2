import React, { useState, useMemo } from 'react';
import type { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { getDiscountPercent } from '../utils/calculations';
import {
    PRODUCTS,
    DUMMY_BOX_LOCAL_PRODUCT_IDS,
    DUMMY_BOX_LOCAL_MIN_AMOUNT,
    DUMMY_BOX_DISCOUNT,
    TELFAST_GROUP_IDS
} from '../constants';
import { PlusIcon, MinusIcon } from './icons';

const CALC_PRODUCTS = DUMMY_BOX_LOCAL_PRODUCT_IDS.map(id => PRODUCTS.find(p => p.id === id)!).filter(Boolean);

/** VAT % cố định: CORBIERE CALCIUM PLUS (id 1) = 8%, còn lại = 5% */
const VAT_BY_PRODUCT_ID: Record<number, number> = {
    1: 0.08,   // CORBIERE CALCIUM PLUS - 8%
    6: 0.05,   // TELFAST HD - 5%
    7: 0.05,   // TELFAST BD - 5%
    26: 0.05,  // CALCIUM CORBIERE EXTRA 5ML - 5%
};
const getVatPercent = (p: Product): number => VAT_BY_PRODUCT_ID[p.id] ?? 0.05;

interface DummyBoxLocalCalculatorProps {
    onClose?: () => void;
    embedded?: boolean;
}

const DummyBoxLocalCalculator: React.FC<DummyBoxLocalCalculatorProps> = ({ onClose, embedded = false }) => {
    const [addedProductIds, setAddedProductIds] = useState<number[]>([]);
    const [dropdownValue, setDropdownValue] = useState('');
    const [quantities, setQuantities] = useState<Record<number, number>>(() =>
        Object.fromEntries(CALC_PRODUCTS.map(p => [p.id, 0]))
    );

    const visibleProducts = useMemo(() => {
        return addedProductIds.map(id => CALC_PRODUCTS.find(p => p.id === id)!).filter(Boolean);
    }, [addedProductIds]);

    const removeProduct = (id: number) => {
        setAddedProductIds(prev => prev.filter(x => x !== id));
        setQuantities(prev => ({ ...prev, [id]: 0 }));
    };

    const setQty = (id: number, qty: number) => {
        setQuantities(prev => ({ ...prev, [id]: Math.max(0, qty) }));
    };

    // Tổng Telfast group (basePrice * qty) cho compareValue của Telfast BD
    const telfastGroupTotal = useMemo(() => {
        return visibleProducts
            .filter(p => TELFAST_GROUP_IDS.includes(p.id as 7 | 8))
            .reduce((s, p) => s + (p.basePrice ?? p.price) * (quantities[p.id] ?? 0), 0);
    }, [quantities, visibleProducts]);

    const rows = useMemo(() => {
        return visibleProducts.map((p, idx) => {
            const qty = quantities[p.id] ?? 0;
            const basePrice = p.basePrice ?? p.price;
            const isTelfast = TELFAST_GROUP_IDS.includes(p.id as 7 | 8);
            const compareValue = isTelfast ? telfastGroupTotal : undefined;
            const ckPercent = getDiscountPercent(p.promotion, qty, compareValue);
            const giaSau = basePrice * (1 - ckPercent);
            const vatPercent = getVatPercent(p);
            return {
                ...p,
                stt: idx + 1,
                qty,
                basePrice,
                ckPercent: ckPercent * 100,
                giaSau,
                vatPercent  // 0.08 hoặc 0.05 (decimal) - dùng cho công thức (1 + vatPercent)
            };
        });
    }, [quantities, telfastGroupTotal, visibleProducts]);

    const tongDonSauCk = useMemo(() =>
        rows.reduce((s, r) => s + r.giaSau * r.qty, 0),
        [rows]
    );

    const eligible = tongDonSauCk >= DUMMY_BOX_LOCAL_MIN_AMOUNT;
    const percentGiam = eligible && tongDonSauCk > 0 ? (DUMMY_BOX_DISCOUNT / tongDonSauCk) * 100 : 0;

    const rowsWithFinal = useMemo(() => {
        return rows.map(r => {
            const giaHoaDon = r.qty === 0 ? 0 : r.giaSau * (1 - percentGiam / 100) * (1 + r.vatPercent);
            const tongDonItem = giaHoaDon * r.qty;
            return { ...r, giaHoaDon, tongDonItem };
        });
    }, [rows, percentGiam]);

    const tongDon = useMemo(() =>
        rowsWithFinal.reduce((s, r) => s + r.tongDonItem, 0),
        [rowsWithFinal]
    );

    const content = (
        <>
                <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-green-100 dark:bg-green-900/30 text-slate-600 dark:text-slate-300 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-2 py-2 w-10 text-center border-b">STT</th>
                                    <th className="px-2 py-2 min-w-[140px] border-b">Tên thuốc</th>
                                    <th className="px-2 py-2 w-24 text-center border-b">Mua</th>
                                    <th className="px-2 py-2 w-28 text-right border-b">Đơn giá gốc (-VAT)</th>
                                    <th className="px-2 py-2 w-20 text-center border-b">% CK tháng</th>
                                    <th className="px-2 py-2 w-28 text-right border-b">Giá sau (ck -VAT)</th>
                                    <th className="px-2 py-2 w-16 text-center border-b">% VAT</th>
                                    <th className="px-2 py-2 w-28 text-right border-b bg-yellow-100 dark:bg-yellow-900/30">Giá hóa đơn (CK+VAT)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {rowsWithFinal.map((r) => (
                                    <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                                        <td className="px-2 py-2 text-center">{r.stt}</td>
                                        <td className="px-2 py-2 font-medium">
                                            <div className="flex items-center gap-1">
                                                {r.name}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); removeProduct(r.id); }}
                                                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-xs"
                                                    title="Xóa sản phẩm"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setQty(r.id, r.qty - 1)}
                                                    className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    disabled={r.qty <= 0}
                                                >
                                                    <MinusIcon />
                                                </button>
                                                <span className="w-8 text-center font-bold text-red-600 dark:text-red-400">{r.qty}</span>
                                                <button
                                                    onClick={() => setQty(r.id, r.qty + 1)}
                                                    className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200"
                                                >
                                                    <PlusIcon />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(r.basePrice)}</td>
                                        <td className="px-2 py-2 text-center">
                                            {r.qty > 0 && r.ckPercent > 0 ? `${r.ckPercent.toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(r.giaSau)}</td>
                                        <td className="px-2 py-2 text-center">{(r.vatPercent * 100).toFixed(1)}%</td>
                                        <td className="px-2 py-2 text-right font-bold bg-yellow-50 dark:bg-yellow-900/20">{formatCurrency(r.giaHoaDon)}</td>
                                    </tr>
                                ))}
                                {(visibleProducts.length === 0 || CALC_PRODUCTS.some(p => !addedProductIds.includes(p.id))) && (
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <td colSpan={8} className="px-2 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Thêm sản phẩm:</span>
                                                <select
                                                    value={dropdownValue}
                                                    onChange={(e) => setDropdownValue(e.target.value)}
                                                    className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 min-w-[180px]"
                                                >
                                                    <option value="">-- Chọn sản phẩm --</option>
                                                    {CALC_PRODUCTS.filter(p => !addedProductIds.includes(p.id)).map(p => (
                                                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const id = dropdownValue ? Number(dropdownValue) : 0;
                                                        if (id && !addedProductIds.includes(id)) {
                                                            setAddedProductIds(prev => [...prev, id]);
                                                            setDropdownValue('');
                                                        }
                                                    }}
                                                    disabled={!dropdownValue}
                                                    className="px-2 py-1 text-xs font-bold rounded bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-colors"
                                                >
                                                    Thêm
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-600">
                            <span className="font-bold">Tổng đơn sau ck - VAT:</span>
                            <span className="font-black text-green-700 dark:text-green-300">{formatCurrency(tongDonSauCk)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="font-bold">Giảm:</span>
                            <span className="font-black">{eligible ? formatCurrency(DUMMY_BOX_DISCOUNT) : '0'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="font-bold">% giảm:</span>
                            <span className="font-black">{eligible ? `${percentGiam.toFixed(1)}%` : '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-600">
                            <span className="font-bold">Tổng đơn:</span>
                            <span className="font-black text-opella-green dark:text-opella-green text-lg">{formatCurrency(tongDon)}</span>
                        </div>
                        {!eligible && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                                ⚠️ Điều kiện: Tổng đơn sau CK ≥ 1.000.000 để được giảm 150.000
                            </p>
                        )}
                    </div>
        </>
    );

    if (embedded) return content;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-green-50 dark:bg-green-900/20 rounded-t-2xl">
                    <h2 className="text-lg font-black text-green-800 dark:text-green-300 uppercase">
                        Tính toán gói DummyBox - Local
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">✕</button>
                </div>
                <div className="overflow-auto p-4 flex-1">{content}</div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DummyBoxLocalCalculator;
