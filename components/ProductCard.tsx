import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../types';
import { PlusIcon, CubeIcon } from './icons';
import { formatCurrency } from '../utils/formatters';
import { getMaxDiscountPercent } from '../utils/calculations';
import { REBATE_TIERS } from './dashboard/DashboardUtils';
import { isBmProduct, getBmTiers } from '../constants/bmProducts';

interface ProductCardProps {
    product: Product;
    onAddToCart: (product: Product, quantity: number) => void;
    /** CK PS On Invoice 25% — ẩn % CK tháng, dùng basePrice */
    hideMonthlyPromo?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, hideMonthlyPromo = false }) => {
    const [quantity, setQuantity] = useState<number | string>(product.minOrderQuantity);
    const [error, setError] = useState('');
    const [showBmModal, setShowBmModal] = useState(false);

    const bmTiers = useMemo(() => getBmTiers(product), [product]);
    const showBmButton = isBmProduct(product.id);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setError('');
        if (value === '' || /^[0-9\b]+$/.test(value)) {
            setQuantity(value);
        }
    };

    const handleAddToCart = () => {
        const numQuantity = Number(quantity);
        if (isNaN(numQuantity) || numQuantity <= 0) {
            setError('Số lượng không hợp lệ.');
            return;
        }
        if (numQuantity < product.minOrderQuantity) {
            setError(`Tối thiểu ${product.minOrderQuantity} sản phẩm.`);
            return;
        }
        setError('');
        onAddToCart(product, numQuantity);
        setQuantity(product.minOrderQuantity);
    };

    // Tính toán bảng tra cứu mức chiết khấu
    const tieredPromos = useMemo(() => {
        if (!product.promotion) return [];

        // Regex hỗ trợ cả 'h' (hộp) và 'k' (nghìn đồng/giá trị đơn)
        const tieredMatches = Array.from(product.promotion.matchAll(/(\d+)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi));

        if (tieredMatches.length > 0) {
            return tieredMatches.map(m => {
                const thresholdRaw = parseInt(m[1]);
                const unit = m[2].toLowerCase();
                const threshold = unit === 'k' ? thresholdRaw * 1000 : thresholdRaw;
                const percent = m[3];

                // Tính toán giá sau giảm cho mỗi mức để hiển thị trực quan cho nhân viên
                const discountedPricePerUnit = (product.basePrice ?? product.price) * (1 - parseFloat(percent) / 100);

                return {
                    thresholdRaw,
                    unit,
                    threshold,
                    percent,
                    discountedPricePerUnit
                };
            }).sort((a, b) => a.threshold - b.threshold);
        }

        // Fallback cho KM đơn lẻ
        const singleMatch = product.promotion.match(/(\d+(?:\.\d+)?)\s*%/);
        if (singleMatch && singleMatch[1]) {
            return [{
                thresholdRaw: 1,
                unit: 'h',
                threshold: 1,
                percent: singleMatch[1],
                discountedPricePerUnit: (product.basePrice ?? product.price) * (1 - parseFloat(singleMatch[1]) / 100)
            }];
        }

        return [];
    }, [product.promotion, product.price]);

    // (đã gỡ) Rule 21h ck thêm 4.76%

    // Giá cuối tháng ở mức 5% (Lv5) - đã bao gồm CK + VAT
    const LEVEL_5_INDEX = 4;
    const giaCuoiThang = useMemo(() => {
        const maxCk = getMaxDiscountPercent(product.promotion);
        const giaHD = Math.round((product.basePrice ?? product.price) * (1 - (maxCk ?? 0) / 100));
        return Math.round(giaHD * (1 - REBATE_TIERS[LEVEL_5_INDEX].percent / 100));
    }, [product.price, product.basePrice, product.promotion]);

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 group relative">
            {/* Product Image Section */}
            <div className="relative w-full h-32 flex items-center justify-center bg-white rounded-md overflow-hidden mb-3 p-1 border border-slate-100 dark:border-slate-700">
                {product.nearExpiry && (
                    <span className="absolute top-0 left-0 z-10 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-br-lg shadow-sm uppercase leading-tight">
                        ⏳ Cận Date {product.nearExpiry}
                    </span>
                )}
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center text-slate-300 dark:text-slate-500">
                        <CubeIcon />
                    </div>
                )}
            </div>

            {/* Badges */}
            {product.requireApproval && (
                <div className="flex flex-wrap gap-1 mb-2">
                    <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Đơn Duyệt</span>
                </div>
            )}

            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase flex-shrink-0 ${product.type === 'Import' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                            {product.type}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${product.type === 'Import' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                                Giá cuối Tháng: {formatCurrency(giaCuoiThang)}
                            </span>
                            {product.originalPrice && (
                                <span className="text-[10px] text-slate-400 line-through">
                                    {formatCurrency(product.originalPrice)}
                                </span>
                            )}
                        </div>
                    </div>

                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-2 leading-tight uppercase min-h-[2.5em] mb-1" title={product.name}>{product.name}</h3>

                    {product.note && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold italic mb-2">{product.note}</p>
                    )}

                    <p className="text-base font-bold text-opella-green dark:text-opella-green mb-2">
                        {formatCurrency(product.basePrice ?? product.price)}
                        <span className="text-[9px] font-normal text-slate-500 dark:text-slate-400 ml-1 uppercase">
                            {hideMonthlyPromo ? '(basePrice · ko CK tháng)' : '(VAT)'}
                        </span>
                    </p>

                    {product.promotion && !hideMonthlyPromo && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 p-2 rounded mb-3">
                            <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase leading-tight mb-1.5">{product.promotion}</p>

                            {tieredPromos.length > 0 && (
                                <div className="grid grid-cols-1 gap-1 pt-1 border-t border-red-100 dark:border-red-900/50">
                                    {tieredPromos.map((tier, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                                                {tier.unit === 'h' ? `${tier.thresholdRaw}h` : `>=${tier.thresholdRaw}k`} (-{tier.percent}%):
                                            </span>
                                            <span className="text-red-600 dark:text-red-400 font-bold">
                                                {formatCurrency(tier.discountedPricePerUnit)}
                                            </span>
                                        </div>
                                    ))}
                                    {/* Gỡ rule 21h ck thêm 4.76% theo CTKM mới */}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-auto">
                    {error && <p className="text-red-500 text-[10px] mb-1.5 font-medium text-center">{error}</p>}
                    <div className="flex items-center gap-2">
                        <div className="relative w-16">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={quantity}
                                onChange={handleQuantityChange}
                                className="w-full text-center border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg py-2 text-sm font-bold focus:ring-2 focus:ring-opella-green focus:border-opella-green outline-none"
                                placeholder="SL"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                                Min:{product.minOrder}
                            </span>
                        </div>
                        {showBmButton && (
                            <button
                                type="button"
                                onClick={() => setShowBmModal(true)}
                                className="px-2 py-2 border border-sky-500 text-sky-600 dark:text-sky-400 dark:border-sky-400 font-bold text-[10px] rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all uppercase"
                            >
                                GIÁ BM
                            </button>
                        )}
                        <button
                            onClick={handleAddToCart}
                            className="flex-1 flex items-center justify-center bg-opella-green text-white font-bold py-2 px-3 rounded-lg hover:bg-opella-green/90 active:scale-95 transition-all duration-200 text-xs uppercase shadow-sm"
                        >
                            <PlusIcon />
                            <span className="ml-1">Thêm</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal GIÁ BM */}
            {showBmModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowBmModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-md w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-600">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">GIÁ BM — {product.name}</h3>
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
                            <button
                                type="button"
                                onClick={() => setShowBmModal(false)}
                                className="w-full py-2 rounded-lg font-bold text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProductCard;
