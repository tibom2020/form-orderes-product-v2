
import React, { useMemo } from 'react';
import type { Order } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CheckCircleIcon } from './icons';
import { buildOrderInvoiceLines } from '../utils/orderInvoicePrices';

interface OrderSuccessModalProps {
    order: Order;
    employeeName: string;
    onClose: () => void;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ order, employeeName, onClose }) => {
    const invoiceRows = useMemo(() => buildOrderInvoiceLines(order), [order]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all scale-100">

                {/* Header decoration */}
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg mb-3 animate-bounce-slow text-green-500">
                            <div className="scale-150"><CheckCircleIcon /></div>
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider text-shadow-sm">Gửi Đơn Thành Công!</h2>
                        <p className="text-blue-100 text-xs font-medium mt-1">Đơn hàng đã được lưu vào hệ thống</p>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5">
                    {/* Customer Info */}
                    <div className="text-center mb-5 border-b border-slate-100 dark:border-slate-700 pb-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide">Khách hàng</p>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight mt-1">{order.customerName}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">{order.customerCode}</p>
                    </div>

                    {/* Items Summary — giá trên hóa đơn (CK+VAT) */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 tracking-wide">
                            Giá trên hóa đơn (CK + VAT)
                        </p>
                        <ul className="space-y-2">
                            {invoiceRows.map(({ id, name, quantity, unitInvoice, lineTotal }, index) => (
                                <li key={`${id}-${index}`} className="flex justify-between text-xs text-slate-700 dark:text-slate-300 gap-2">
                                    <span className="font-medium line-clamp-1 flex-1 min-w-0">• {name}</span>
                                    <span className="whitespace-nowrap font-bold text-right shrink-0">
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                            {quantity} × {formatCurrency(unitInvoice)}
                                        </span>
                                        <span className="block text-opella-green dark:text-sky-400">
                                            {formatCurrency(lineTotal)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                            TỔNG CỘNG
                            <span className="block text-[9px] font-bold text-slate-400 uppercase">(VAT · hóa đơn)</span>
                        </span>
                        <span className="text-2xl font-black text-sky-600 dark:text-sky-400 leading-none">
                            {formatCurrency(order.finalAmount)}
                        </span>
                    </div>

                    {/* Motivational Message */}
                    <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800 rounded-xl p-3 text-center mb-6">
                        <p className="text-pink-600 dark:text-pink-300 font-bold text-sm flex items-center justify-center gap-2">
                            <span>💕</span>
                            <span>Cảm ơn {employeeName} đã lên đơn nhé!</span>
                            <span>💕</span>
                        </p>
                    </div>

                    {/* Footer Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-sky-200 dark:shadow-none transition-all active:scale-95"
                    >
                        Tiếp tục tạo đơn mới
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderSuccessModal;
