import React, { useState, useMemo } from 'react';
import type { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { getDiscountPercent } from '../utils/calculations';
import {
    PRODUCTS,
    DUMMY_BOX_IMPORT_PRODUCT_IDS,
    DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID,
    DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID,
    DUMMY_BOX_IMPORT_MIN_AMOUNT,
    DUMMY_BOX_DISCOUNT,
} from '../constants';
import { PlusIcon, MinusIcon } from './icons';

// Thứ tự hiển thị: Enterogermina 2B/20, GUT RESTORE 4B, Pharmaton Vitality, Essent, Kiddi, Fizzi, Energy
const IMPORT_ORDER: number[] = [30, 12, 27, 18, 19, 20, 17];
const ALL_IMPORT_PRODUCTS = IMPORT_ORDER
    .filter(id => DUMMY_BOX_IMPORT_PRODUCT_IDS.includes(id as any))
    .map(id => PRODUCTS.find(p => p.id === id)!)
    .filter(Boolean);
const REQUIRED_PRODUCT = PRODUCTS.find(p => p.id === DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID)!;
const OPTIONAL_PRODUCTS = ALL_IMPORT_PRODUCTS.filter(p => p.id !== DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID);

/** VAT %: Enterogermina 2B/20 (30), GUT RESTORE 4B (12) = 5%; còn lại = 8% */
const VAT_BY_PRODUCT_ID: Record<number, number> = {
    30: 0.05,  // ENTEROGERMINA 2 billion/5ml B/20 bottle - 5%
    12: 0.05,  // ENTEROGERMINA GUT RESTORE (4B) - 5%
    17: 0.08,  // PHARMATON ENERGY - 8%
    18: 0.08,  // PHARMATON ESSENT - 8%
    19: 0.08,  // PHARMATON KIDDI - 8%
    20: 0.08,  // PHARMATON ENERGY FIZZI - 8%
    27: 0.08,  // PHARMATON VITALITY - 8%
};
const getVatPercent = (p: Product): number => VAT_BY_PRODUCT_ID[p.id] ?? 0.08;

interface DummyBoxImportCalculatorProps {
    onClose?: () => void;
}

const DummyBoxImportCalculator: React.FC<DummyBoxImportCalculatorProps> = () => {
    const [addedOptionalIds, setAddedOptionalIds] = useState<number[]>([]);
    const [dropdownValue, setDropdownValue] = useState('');
    const [quantities, setQuantities] = useState<Record<number, number>>(() => {
        const base = Object.fromEntries(ALL_IMPORT_PRODUCTS.map(p => [p.id, 0]));
        base[DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID] = 1;
        return base;
    });

    const visibleProducts = useMemo(() => {
        const added = addedOptionalIds.map(id => OPTIONAL_PRODUCTS.find(p => p.id === id)!).filter(Boolean);
        return [REQUIRED_PRODUCT, ...added];
    }, [addedOptionalIds]);

    const removeProduct = (id: number) => {
        setAddedOptionalIds(prev => prev.filter(x => x !== id));
        setQuantities(prev => ({ ...prev, [id]: 0 }));
    };

    const setQty = (id: number, qty: number) => {
        setQuantities(prev => ({ ...prev, [id]: Math.max(0, qty) }));
    };

    const rows = useMemo(() => {
        return visibleProducts.map((p, idx) => {
            const qty = quantities[p.id] ?? 0;
            // Pharmaton Energy: dùng originalPrice, ko áp CK 29.5%
            const isPharmatonEnergy = p.id === DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID;
            const basePrice = isPharmatonEnergy
                ? (p.originalPrice ?? p.price)
                : (p.basePrice ?? p.price);
            const ckPercent = isPharmatonEnergy ? 0 : getDiscountPercent(p.promotion, qty, undefined);
            const giaSau = basePrice * (1 - ckPercent);
            const vatPercent = getVatPercent(p);
            return {
                ...p,
                stt: idx + 1,
                qty,
                basePrice,
                ckPercent: ckPercent * 100,
                giaSau,
                vatPercent,
            };
        });
    }, [quantities, visibleProducts]);

    const tongDonSauCk = useMemo(() =>
        rows.reduce((s, r) => s + r.giaSau * r.qty, 0),
        [rows]
    );

    const hasRequired = (quantities[DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID] ?? 0) >= 1;
    const eligible = tongDonSauCk >= DUMMY_BOX_IMPORT_MIN_AMOUNT && hasRequired;
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

    return (
        <div className="overflow-auto flex-1">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-blue-100 dark:bg-blue-900/30 text-slate-600 dark:text-slate-300 font-bold uppercase text-xs">
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
                                        {r.id !== DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeProduct(r.id); }}
                                                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-xs"
                                                title="Xóa sản phẩm"
                                            >
                                                ✕
                                            </button>
                                        )}
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
                                    {r.qty > 0 && r.ckPercent > 0 ? `${r.ckPercent.toFixed(2)}%` : r.id === DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID ? '0% (ko CK)' : '-'}
                                </td>
                                <td className="px-2 py-2 text-right">{formatCurrency(r.giaSau)}</td>
                                <td className="px-2 py-2 text-center">{(r.vatPercent * 100).toFixed(1)}%</td>
                                <td className="px-2 py-2 text-right font-bold bg-yellow-50 dark:bg-yellow-900/20">{formatCurrency(r.giaHoaDon)}</td>
                            </tr>
                        ))}
                        {OPTIONAL_PRODUCTS.some(p => !addedOptionalIds.includes(p.id)) && (
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
                                            {OPTIONAL_PRODUCTS.filter(p => !addedOptionalIds.includes(p.id)).map(p => (
                                                <option key={p.id} value={String(p.id)}>{p.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const id = dropdownValue ? Number(dropdownValue) : 0;
                                                if (id && !addedOptionalIds.includes(id)) {
                                                    setAddedOptionalIds(prev => [...prev, id]);
                                                    setDropdownValue('');
                                                }
                                            }}
                                            disabled={!dropdownValue}
                                            className="px-2 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-colors"
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
                    <span className="font-black text-blue-700 dark:text-blue-300">{formatCurrency(tongDonSauCk)}</span>
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
                        ⚠️ Điều kiện: Tổng đơn sau CK ≥ 1.000.000 và có ít nhất 1h PHARMATON VITALITY để được giảm 150.000
                    </p>
                )}
            </div>
        </div>
    );
};

export default DummyBoxImportCalculator;
