
import React from 'react';
import type { SalesRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatCompact } from './DashboardUtils';

interface KpiModalsProps {
    activeKpiModal: string | null;
    userSalesData: SalesRecord[];
    kpiViewMode: 'pass' | 'fail' | 'ao_2to3' | 'ao_under2';
    kpiGroupBy: 'customer' | 'group';
    onClose: () => void;
    onSetViewMode: (mode: 'pass' | 'fail' | 'ao_2to3' | 'ao_under2') => void;
    onSetGroupBy: (mode: 'customer' | 'group') => void;
    onCustomerSelectFromModal: (record: SalesRecord) => void;
}

const KpiModals: React.FC<KpiModalsProps> = ({
    activeKpiModal,
    userSalesData,
    kpiViewMode,
    kpiGroupBy,
    onClose,
    onSetViewMode,
    onSetGroupBy,
    onCustomerSelectFromModal
}) => {
    if (!activeKpiModal) return null;

    let title = '';
    let data: { code: string; name: string; district: string; value: number; originalRecord: SalesRecord }[] = [];

    // Base datasets
    const allKpiData = userSalesData.map(r => ({
        code: r.CustomerCode,
        name: r.CustomerName,
        district: r.District || '',
        value: (Number(r.MustWin) || 0) + (Number(r.Other) || 0),
        originalRecord: r
    }));

    const PRODUCT_GROUPS_ALL = [
        "BUSCOPAN (B.I)", "CAL CORBIERE", "ENTEROGERMINA", "Nospa Import", "Nospa Local",
        "PHARMATON", "TELFAST", "BISOLVON", "OSTELIN", "ACEMUC", "PHOSPHALUGEL (B.I)", "MAGNE B6"
    ];
    const MUST_WIN_GROUPS = ["CAL CORBIERE", "ENTEROGERMINA"];
    const OTHER_GROUPS = PRODUCT_GROUPS_ALL.filter(g => !MUST_WIN_GROUPS.includes(g));

    const getGroupedData = (groups: string[]) => {
        const aggregated = groups.map(groupName => {
            const total = userSalesData.reduce((sum, r) => sum + (Number((r as any)[groupName]) || 0), 0);
            return { name: groupName, value: total };
        }).filter(item => item.value > 0);
        return aggregated.sort((a, b) => b.value - a.value);
    };

    const isGroupViewPossible = ['Total', 'MustWin', 'Other'].includes(activeKpiModal);

    if (kpiGroupBy === 'group' && isGroupViewPossible) {
        switch (activeKpiModal) {
            case 'Total':
                title = 'KPI theo Nhóm Sản Phẩm (Total)';
                const groupedTotal = getGroupedData(PRODUCT_GROUPS_ALL);
                data = groupedTotal.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                break;
            case 'MustWin':
                title = 'KPI theo Nhóm Sản Phẩm (Must Win)';
                const groupedMW = getGroupedData(MUST_WIN_GROUPS);
                data = groupedMW.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                break;
            case 'Other':
                title = 'KPI theo Nhóm Sản Phẩm (Other)';
                const groupedOther = getGroupedData(OTHER_GROUPS);
                data = groupedOther.map(it => ({ code: 'GROUP', name: it.name, district: 'Sản phẩm', value: it.value, originalRecord: userSalesData[0] }));
                break;
        }
    } else {
        switch (activeKpiModal) {
            case 'Total':
                title = 'Danh sách Total Sales';
                data = allKpiData.filter(item => item.value > 0);
                break;
            case 'MustWin':
                title = 'Danh sách Must Win';
                data = userSalesData.map(r => ({
                    code: r.CustomerCode,
                    name: r.CustomerName,
                    district: r.District || '',
                    value: Number(r.MustWin) || 0,
                    originalRecord: r
                })).filter(item => item.value > 0);
                break;
            case 'Other':
                title = 'Danh sách Other';
                data = userSalesData.map(r => ({
                    code: r.CustomerCode,
                    name: r.CustomerName,
                    district: r.District || '',
                    value: Number(r.Other) || 0,
                    originalRecord: r
                })).filter(item => item.value > 0);
                break;
            case 'Active':
                title = kpiViewMode === 'pass' ? 'Danh sách Active (>0)' : 'Danh sách Chưa Active (=0)';
                data = allKpiData.filter(item => kpiViewMode === 'pass' ? item.value > 0 : item.value === 0);
                break;
            case 'AO':
                title = kpiViewMode === 'pass' ? 'Danh sách AO (>3 Tr)'
                    : kpiViewMode === 'ao_2to3' ? 'Danh sách Chưa đạt AO - Từ 2tr - dưới 3tr'
                    : kpiViewMode === 'ao_under2' ? 'Danh sách Chưa đạt AO - Dưới 2tr'
                    : 'Danh sách Chưa đạt AO - Từ 2tr - dưới 3tr';
                if (kpiViewMode === 'pass') {
                    data = allKpiData.filter(item => item.value > 3000000);
                } else if (kpiViewMode === 'ao_2to3') {
                    data = allKpiData.filter(item => item.value >= 2000000 && item.value < 3000000).sort((a, b) => b.value - a.value);
                } else if (kpiViewMode === 'ao_under2') {
                    data = allKpiData.filter(item => item.value < 2000000).sort((a, b) => b.value - a.value);
                } else {
                    // fail (legacy): default to ao_2to3
                    data = allKpiData.filter(item => item.value >= 2000000 && item.value < 3000000).sort((a, b) => b.value - a.value);
                }
                break;
            case 'MSO':
                title = kpiViewMode === 'pass' ? 'Danh sách MSO (>9 Tr)' : 'Danh sách Chưa đạt MSO (<=9 Tr)';
                data = allKpiData.filter(item => {
                    if (kpiViewMode === 'pass') return item.value > 9000000;
                    return item.value <= 9000000;
                });
                break;
        }
    }

    data.sort((a, b) => b.value - a.value);

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    const totalCount = data.length;
    const showToggle = ['Active', 'AO', 'MSO'].includes(activeKpiModal);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl p-0 flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-800 rounded-t-2xl">
                    <div>
                        <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {kpiViewMode === 'pass' ? 'Tổng cộng đạt: ' : 'Số lượng: '}
                            <span className="font-bold text-opella-green dark:text-opella-green">
                                {kpiViewMode === 'pass' ? formatCompact(totalValue) : `${totalCount} KH`}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">✕</button>
                        {showToggle && (
                            <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg border border-slate-300 dark:border-slate-600 flex-wrap gap-0.5">
                                <button
                                    onClick={() => onSetViewMode('pass')}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'pass' ? 'bg-white dark:bg-slate-600 text-opella-green dark:text-opella-green shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Đạt
                                </button>
                                {activeKpiModal === 'AO' ? (
                                    <>
                                        <button
                                            onClick={() => onSetViewMode('ao_2to3')}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'ao_2to3' ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            Từ 2tr-3tr
                                        </button>
                                        <button
                                            onClick={() => onSetViewMode('ao_under2')}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'ao_under2' ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            Dưới 2tr
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => onSetViewMode('fail')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiViewMode === 'fail' ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Chưa đạt
                                    </button>
                                )}
                            </div>
                        )}
                        {isGroupViewPossible && (
                            <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg border border-slate-300 dark:border-slate-600">
                                <button
                                    onClick={() => onSetGroupBy('customer')}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiGroupBy === 'customer' ? 'bg-white dark:bg-slate-600 text-opella-green dark:text-opella-green shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Khách hàng
                                </button>
                                <button
                                    onClick={() => onSetGroupBy('group')}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${kpiGroupBy === 'group' ? 'bg-white dark:bg-slate-600 text-opella-green dark:text-opella-green shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Sản phẩm
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2">Khách Hàng</th>
                                    <th className="px-3 py-2 text-right">Doanh Số</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {data.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${item.code !== 'GROUP' ? 'cursor-pointer group' : ''}`}
                                        onClick={() => item.code !== 'GROUP' && onCustomerSelectFromModal(item.originalRecord)}
                                    >
                                        <td className="px-3 py-2">
                                            <div className={`font-bold text-slate-700 dark:text-slate-200 ${item.code !== 'GROUP' ? 'group-hover:text-opella-green dark:group-hover:text-opella-green' : ''} transition-colors`}>
                                                {item.name}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                                {item.code !== 'GROUP' ? (
                                                    <>
                                                        <span>{item.code}</span>
                                                        <span>• {item.district}</span>
                                                        {item.originalRecord.FinalStoreType && (
                                                            <span className="text-red-600 dark:text-red-400">• {item.originalRecord.FinalStoreType}</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span>Nhóm sản phẩm</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white truncate">
                                            {formatCurrency(item.value)}
                                        </td>
                                    </tr>
                                ))}
                                {data.length === 0 && <tr><td colSpan={2} className="text-center py-4 text-slate-400 italic">Không có dữ liệu</td></tr>}
                            </tbody>
                        </table>
                </div>
                <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold shadow hover:bg-slate-900 transition-colors">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default KpiModals;
