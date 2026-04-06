import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET } from '../constants';
import { ChartBarIcon } from './icons';

export interface Ostelin60VGoiRow {
  Timestamp?: string | number;
  timestamp?: string | number;
  Rep?: string;
  employeeName?: string;
  CustomerCode?: string;
  CustomerName?: string;
  SL_hộp?: number;
  SL_hop?: number;
  SL_goi?: number;
  'SL gói 21.97%'?: number;
  Thanh_tien?: number;
  ThanhTien?: number;
  [key: string]: unknown;
}

interface CalciPlusTabProps {
  currentEmployee: Employee;
}

function formatSheetTimestamp(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') {
    const d = new Date(v > 1e12 ? v : v * 86400000);
    if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN');
  }
  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN');
  return s;
}

const CalciPlusTab: React.FC<CalciPlusTabProps> = ({ currentEmployee }) => {
  const [rawData, setRawData] = useState<Ostelin60VGoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDataFromSheet<Ostelin60VGoiRow>(GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET);
      setRawData(data || []);
    } catch (e) {
      setError('Không tải được dữ liệu gói Ostelin 60V.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    return rawData.map((row, idx) => {
      const rep = String(row.Rep ?? row.employeeName ?? '').trim() || '—';
      const code = String(row.CustomerCode ?? '').trim();
      const name = String(row.CustomerName ?? '').trim();
      const slHop = Number(row.SL_hộp ?? row.SL_hop ?? 0) || 0;
      const slGoi = Number(row.SL_goi ?? row['SL gói 21.97%'] ?? 0) || 0;
      const thanhTien = Number(row.Thanh_tien ?? row.ThanhTien ?? 0) || 0;
      const ts = row.Timestamp ?? row.timestamp;
      return {
        key: `${idx}-${rep}-${code}-${String(ts)}`,
        tsRaw: ts,
        rep,
        code,
        name,
        slHop,
        slGoi,
        thanhTien,
      };
    }).sort((a, b) => {
      const ta = a.tsRaw != null ? new Date(a.tsRaw as string | number).getTime() : 0;
      const tb = b.tsRaw != null ? new Date(b.tsRaw as string | number).getTime() : 0;
      return tb - ta;
    });
  }, [rawData]);

  const totals = useMemo(() => ({
    don: rows.length,
    thanhTien: rows.reduce((s, r) => s + r.thanhTien, 0),
    slGoi: rows.reduce((s, r) => s + r.slGoi, 0),
  }), [rows]);

  const byRep = useMemo(() => {
    const m = new Map<string, { slGoi: number; thanhTien: number; soDon: number }>();
    rows.forEach(r => {
      if (!m.has(r.rep)) m.set(r.rep, { slGoi: 0, thanhTien: 0, soDon: 0 });
      const cur = m.get(r.rep)!;
      cur.slGoi += r.slGoi;
      cur.thanhTien += r.thanhTien;
      cur.soDon += 1;
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({ rep, ...v }))
      .sort((a, b) => b.slGoi - a.slGoi || b.thanhTien - a.thanhTien);
  }, [rows]);

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
              <ChartBarIcon />
            </div>
            THEO DÕI GÓI OSTELIN 60V (5H — 21.97%)
          </h2>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Làm mới
            </button>
          </div>
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
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase tracking-wide">
                THỐNG KÊ THEO REP
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[480px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Số đơn</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng SL gói</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {byRep.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có dữ liệu để báo cáo
                      </td>
                    </tr>
                  ) : (
                    byRep.map((row, idx) => (
                      <tr key={row.rep} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">{row.rep}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.soDon}</td>
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

        {!loading && !error && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-opella-green/10 dark:bg-opella-green/20 border-b border-slate-200 dark:border-slate-600">
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Số dòng / đơn</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.don}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng SL gói</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.slGoi}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng thành tiền</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{formatCurrency(totals.thanhTien)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[720px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 whitespace-nowrap">Thời gian</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 min-w-[120px]">Tên KH</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">SL hộp</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">SL gói</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có dữ liệu gói Ostelin 60V
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{formatSheetTimestamp(row.tsRaw)}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">{row.rep}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200">{row.code || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{row.name || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slHop || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slGoi}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.thanhTien)}</td>
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
