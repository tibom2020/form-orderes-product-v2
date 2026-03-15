import React from 'react';
import type { SalesRecord } from '../types';
import { formatCurrency } from '../utils/formatters';
import { getCustomerSalesDisplayData } from '../utils/customerSummarizer';

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
            <div><span className="text-slate-500 dark:text-slate-400">🏆 Loại TB:</span> <span className="font-bold text-amber-600 dark:text-amber-400">{data.finalStoreType}</span></div>
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
            <div className="h-1.5" />

            <div className="font-bold text-slate-600 dark:text-slate-300">📑 ĐIỀU KIỆN TB:</div>
            <div className="pl-2 space-y-0.5">
                <div><span className="text-slate-500 dark:text-slate-400">+ Trạng thái:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{data.checkStatus || '-'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">+ Doanh số đã đặt:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(data.doanhSoDaDat)}</span></div>
                <div><span className="text-slate-500 dark:text-slate-400">+ Todo TB:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(data.todoTotal)}</span></div>
                {data.counterTopStr && <div><span className="text-slate-500 dark:text-slate-400">+ Counter Top:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{data.counterTopStr}</span></div>}
                {data.cduStr && <div><span className="text-slate-500 dark:text-slate-400">+ CDU:</span> <span className="font-bold text-slate-700 dark:text-slate-300">{data.cduStr}</span></div>}
            </div>
            <div className="h-2" />
            <div className="text-slate-500 dark:text-slate-400 italic text-[10px]">Vui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng.</div>
        </div>
    );
};
