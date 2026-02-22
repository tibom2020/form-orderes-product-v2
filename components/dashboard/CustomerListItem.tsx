
import React from 'react';
import type { SalesRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { FaceFrownIcon, FaceSmileIcon } from '../icons';
import { formatDateVal } from './DashboardUtils';
import { ProgressBar, MiniProgressBar } from './ProgressBars';

interface CustomerListItemProps {
    record: SalesRecord;
    onViewDetail: (record: SalesRecord) => void;
    onGoToOrder: (code: string) => void;
}

const CustomerListItem: React.FC<CustomerListItemProps> = ({
    record,
    onViewDetail,
    onGoToOrder
}) => {
    const checkStatus = record.Check || '';
    const isFail = checkStatus.toLowerCase().includes('rớt') || checkStatus.toLowerCase() === 'fail';
    const isPass = checkStatus.toLowerCase().includes('đạt') || checkStatus.toLowerCase() === 'pass';
    const todoImport = Number(record.TodoImport) || 0;
    const todoLocal = Number(record.TodoLocal) || 0;
    const todoTotal = Number(record.Todo) || 0;

    return (
        <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 mr-2">
                    <div className="flex items-center gap-2">
                        <span
                            onClick={() => onViewDetail(record)}
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
                        onClick={() => onGoToOrder(String(record.CustomerCode || ''))}
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
    );
};

export default CustomerListItem;
