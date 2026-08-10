import React from 'react';
import type { SalesRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
    getCustomerSalesDisplayData,
    monthlyTargetLineLabel,
} from '../utils/customerSummarizer';

interface CustomerSalesNoticeContentProps {
    record: SalesRecord;
    employeeName: string;
}

/** Hiển thị nội dung thông tin doanh số KH với màu sắc để dễ quan sát */
export const CustomerSalesNoticeContent: React.FC<CustomerSalesNoticeContentProps> = ({ record, employeeName }) => {
    const data = getCustomerSalesDisplayData(record, employeeName);
    if (!data) return <span className="text-slate-400 italic">Không có dữ liệu.</span>;

    return (
        <div className="font-mono text-[11px] leading-relaxed space-y-1">
            <div className="font-black text-opella-green dark:text-opella-green text-sm">📊 THÔNG TIN DOANH SỐ KHÁCH HÀNG</div>
            <div className="text-slate-400 dark:text-slate-500">--------------------------------</div>
            <div><span className="text-slate-500 dark:text-slate-400">📍 KH:</span> <span className="font-bold text-slate-800 dark:text-white">{data.customerName}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">🔢 Code Giga:</span> <span className="font-bold text-cyan-600 dark:text-cyan-400">{data.codeGiga}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">🔢 Code BM:</span> <span className="font-bold text-cyan-600 dark:text-cyan-400">{data.codeBM}</span></div>
            {data.showTrungBayTbSections && (
                <>
                    <div><span className="text-slate-500 dark:text-slate-400">🏆 Loại TB:</span> <span className="font-bold text-amber-600 dark:text-amber-400">{data.finalStoreType}</span></div>
                    <div><span className="text-slate-500 dark:text-slate-400">📝 ĐĂNG KÝ TB Q2:</span> <span className="font-bold text-red-600 dark:text-red-400">{data.finalStoreTypeQ2}</span></div>
                </>
            )}
            <div><span className="text-slate-500 dark:text-slate-400">🧑‍💼 NV:</span> <span className="font-bold text-slate-800 dark:text-white">{data.employeeName}</span></div>
            <div className="h-2" />

            <div className="font-bold text-slate-600 dark:text-slate-300">📊 KPI THÁNG HIỆN TẠI:</div>
            <div className="pl-2 space-y-0.5">
                <div>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">🔹 Import:</span>{' '}
                    <span className="font-bold text-blue-700 dark:text-blue-300">{formatCurrency(data.actualImport)}</span>
                    <span className="text-slate-500 dark:text-slate-400"> ({data.importPct.toFixed(1)}% / {formatCurrency(data.targetImport)})</span>
                </div>
                <div className="pl-2 text-slate-600 dark:text-slate-400">
                    ➔ {data.importTier ? `Mức: ${data.importTier.level} (CK: ${data.importTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(data.expectedBonusImport)}</span>
                </div>
            </div>
            <div className="pl-2 space-y-0.5">
                <div>
                    <span className="text-green-600 dark:text-green-400 font-bold">🔹 Local:</span>{' '}
                    <span className="font-bold text-green-700 dark:text-green-300">{formatCurrency(data.actualLocal)}</span>
                    <span className="text-slate-500 dark:text-slate-400"> ({data.localPct.toFixed(1)}% / {formatCurrency(data.targetLocal)})</span>
                </div>
                <div className="pl-2 text-slate-600 dark:text-slate-400">
                    ➔ {data.localTier ? `Mức: ${data.localTier.level} (CK: ${data.localTier.percent}%)` : 'Mức: 0 (Chưa đạt thưởng)'} | Thưởng dự kiến: <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(data.expectedBonusLocal)}</span>
                </div>
            </div>
            <div className="h-1.5" />

            <div><span className="text-slate-500 dark:text-slate-400">💰 TOTAL DS QUÝ:</span> <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalQuarterDS)}</span></div>
            <div>
                <span className="text-slate-500 dark:text-slate-400">DOANH SỐ GIGA:</span>{' '}
                <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(data.doanhSoGiga)}</span>
            </div>
            <div>
                <span className="text-slate-500 dark:text-slate-400">DOANH SỐ BM:</span>{' '}
                <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(data.doanhSoBM)}</span>
            </div>
            <div className="h-1.5" />

            {data.showTrungBayTbSections && (
                <>
                    <div className="font-bold text-slate-600 dark:text-slate-300">📑 DOANH SỐ TRƯNG BÀY THÁNG:</div>
                    <div className="pl-2 space-y-0.5">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ Trạng thái:</span>{' '}
                            <span className={`font-bold ${data.isCheckPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {data.isCheckPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                            </span>
                        </div>
                        {data.monthlyTargetVnd > 0 && (
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">{monthlyTargetLineLabel(data.monthlyTbMode)}:</span>{' '}
                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(data.monthlyTargetVnd)}</span>
                            </div>
                        )}
                        <div><span className="text-slate-500 dark:text-slate-400">+ Doanh số đã đặt:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(data.doanhSoDaDat)}</span></div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ Todo TB:</span>{' '}
                            <span className={`font-bold ${data.isCheckPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {data.signedTodoTotal > 0 ? '+' : ''}{formatCurrency(data.signedTodoTotal)}
                            </span>
                        </div>
                    </div>
                    <div className="h-1.5" />

                    <div className="font-bold text-slate-600 dark:text-slate-300">🎯 DOANH SỐ TRƯNG BÀY Q2:</div>
                    <div className="pl-2 space-y-0.5">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ Trạng thái:</span>{' '}
                            <span className={`font-bold ${data.quarterStatusLabel === 'THAM GIA TB QUÝ' ? 'text-amber-600 dark:text-amber-400' : (data.isQuarterPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}`}>
                                {data.quarterStatusLabel}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ Mục tiêu quý:</span>{' '}
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {data.quarterTarget > 0 ? formatCurrency(data.quarterTarget) : 'THAM GIA TB QUÝ'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ Doanh số đã đặt:</span>{' '}
                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(data.totalQuarterDS)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">+ TODO:</span>{' '}
                            <span className={`font-bold ${data.isQuarterPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {data.quarterTodo > 0 ? '+' : ''}{formatCurrency(data.quarterTodo)}
                            </span>
                        </div>
                    </div>
                </>
            )}
            <div className="h-2" />
            <div className="text-slate-500 dark:text-slate-400 italic text-[10px]">Vui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng.</div>
        </div>
    );
};
export default CustomerSalesNoticeContent;
