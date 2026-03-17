import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { GOOGLE_SCRIPT_URL, ADMIN_CODE } from '../constants';
import { ChartBarIcon } from './icons';

export interface CalciPlusRawRow {
  Rep?: string;
  employeeName?: string;
  SL_goi?: number;
  'SL gói 4.76%'?: number;
  Thanh_tien?: number;
  ThanhTien?: number;
  [key: string]: unknown;
}

interface CalciPlusTabProps {
  currentEmployee: Employee;
}

const CalciPlusTab: React.FC<CalciPlusTabProps> = ({ currentEmployee }) => {
  const [rawData, setRawData] = useState<CalciPlusRawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentEmployee.code === ADMIN_CODE;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDataFromSheet<CalciPlusRawRow>(GOOGLE_SCRIPT_URL, 'CALCIPLUS_GOI');
      setRawData(data || []);
    } catch (e) {
      setError('Không tải được dữ liệu gói CalciPlus.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const aggregated = useMemo(() => {
    const byRep = new Map<string, { slGoi: number; thanhTien: number }>();
    rawData.forEach(row => {
      const rep = String(row.Rep ?? row.employeeName ?? '').trim() || 'Chưa xác định';
      const slGoi = Number(row.SL_goi ?? row['SL gói 4.76%'] ?? 0) || 0;
      const thanhTien = Number(row.Thanh_tien ?? row.ThanhTien ?? 0) || 0;
      if (!byRep.has(rep)) byRep.set(rep, { slGoi: 0, thanhTien: 0 });
      const cur = byRep.get(rep)!;
      cur.slGoi += slGoi;
      cur.thanhTien += thanhTien;
    });
    return Array.from(byRep.entries())
      .map(([rep, data]) => ({ rep, ...data }))
      .sort((a, b) => b.thanhTien - a.thanhTien);
  }, [rawData]);

  const totals = useMemo(() => ({
    slGoi: aggregated.reduce((s, r) => s + r.slGoi, 0),
    thanhTien: aggregated.reduce((s, r) => s + r.thanhTien, 0),
  }), [aggregated]);

  if (!isAdmin) {
    return (
      <div className="p-4 text-center text-slate-500 dark:text-slate-400">
        Chỉ Admin mới xem được tab Theo dõi gói CalciPlus.
      </div>
    );
  }

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
              <ChartBarIcon />
            </div>
            THEO DÕI GÓI CALCIPLUS
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Làm mới
          </button>
        </div>

        {loading && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">Đang tải...</div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            {/* Admin tổng phía trên */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-opella-green/10 dark:bg-opella-green/20 border-b border-slate-200 dark:border-slate-600">
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng SL gói 4.76%</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.slGoi}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng Thành tiền</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{formatCurrency(totals.thanhTien)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[400px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 w-16">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">SL gói 4.76%</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {aggregated.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có dữ liệu gói CalciPlus
                      </td>
                    </tr>
                  ) : (
                    aggregated.map((row, idx) => (
                      <tr key={row.rep} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">{row.rep}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slGoi}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.thanhTien)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalciPlusTab;
