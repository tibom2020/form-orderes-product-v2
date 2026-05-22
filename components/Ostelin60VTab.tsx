import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { ADMIN_CODE, GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET } from '../constants';
import { repNameMatchesEmployee } from '../utils/employeeScope';
import {
  formatOstelinDot2Label,
  isOstelin60VRowDot2,
  OSTELIN_60V_DOT2_START_MS,
} from '../utils/ostelin60v';
import { ChartBarIcon } from './icons';

interface Ostelin60VGoiRow {
  Timestamp?: string | number;
  timestamp?: string | number;
  Rep?: string;
  employeeName?: string;
  CustomerCode?: string;
  CustomerName?: string;
  SL_hop?: number | string;
  'SL_hộp'?: number | string;
  SL_goi?: number | string;
  'SL gói 21.97%'?: number | string;
  'SL gói 21.67%'?: number | string;
  Dot_2?: string;
  'Đợt_2'?: string;
  'Đợt 2'?: string;
  Thanh_tien?: number | string;
  ThanhTien?: number | string;
  [key: string]: unknown;
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

const dot2StartLabel = new Date(OSTELIN_60V_DOT2_START_MS).toLocaleDateString('vi-VN');

interface Props {
  currentEmployee: Employee;
}

const Ostelin60VTab: React.FC<Props> = ({ currentEmployee }) => {
  const [rawData, setRawData] = useState<Ostelin60VGoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dot2Filter, setDot2Filter] = useState<'all' | 'dot2' | 'dot1'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDataFromSheet<Ostelin60VGoiRow>(GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET);
      setRawData(data || []);
    } catch {
      setError(`Không tải được dữ liệu sheet ${OSTELIN_60V_GOI_SHEET}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allRows = useMemo(() => {
    return rawData
      .map((row, idx) => {
        const rep = String(row.Rep ?? row.employeeName ?? '').trim() || '—';
        const code = String(row.CustomerCode ?? '').trim();
        const name = String(row.CustomerName ?? '').trim();
        const slHop = Number(row['SL_hộp'] ?? row.SL_hop ?? 0) || 0;
        const slGoi = Number(row.SL_goi ?? row['SL gói 21.67%'] ?? row['SL gói 21.97%'] ?? 0) || 0;
        const thanhTien = Number(row.Thanh_tien ?? row.ThanhTien ?? 0) || 0;
        const ts = row.Timestamp ?? row.timestamp;
        const isDot2 = isOstelin60VRowDot2(row as Record<string, unknown>, ts);
        return {
          key: `${idx}-${rep}-${code}-${String(ts)}`,
          tsRaw: ts,
          rep,
          code,
          name,
          slHop,
          slGoi,
          thanhTien,
          isDot2,
          dot2Label: formatOstelinDot2Label(isDot2),
        };
      })
      .sort((a, b) => {
        const ta = a.tsRaw != null ? new Date(a.tsRaw as string | number).getTime() : 0;
        const tb = b.tsRaw != null ? new Date(b.tsRaw as string | number).getTime() : 0;
        return tb - ta;
      });
  }, [rawData]);

  const rowsByDotFilter = useMemo(() => {
    if (dot2Filter === 'dot2') return allRows.filter(r => r.isDot2);
    if (dot2Filter === 'dot1') return allRows.filter(r => !r.isDot2);
    return allRows;
  }, [allRows, dot2Filter]);

  /** Bảng chi tiết đơn — lọc theo Rep chọn ở header */
  const filteredRows = useMemo(
    () => rowsByDotFilter.filter(r => repNameMatchesEmployee(r.rep, currentEmployee)),
    [rowsByDotFilter, currentEmployee]
  );

  /** THỐNG KÊ THEO REP — toàn bộ Rep (mọi NV + admin xem hết) */
  const byRep = useMemo(() => {
    const m = new Map<string, { soDon: number; slGoi: number; thanhTien: number; soDonDot2: number }>();
    rowsByDotFilter.forEach((r) => {
      if (!m.has(r.rep)) m.set(r.rep, { soDon: 0, slGoi: 0, thanhTien: 0, soDonDot2: 0 });
      const cur = m.get(r.rep)!;
      cur.soDon += 1;
      cur.slGoi += r.slGoi;
      cur.thanhTien += r.thanhTien;
      if (r.isDot2) cur.soDonDot2 += 1;
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({ rep, ...v }))
      .sort((a, b) => b.soDon - a.soDon || b.slGoi - a.slGoi || b.thanhTien - a.thanhTien);
  }, [rowsByDotFilter]);

  const totals = useMemo(
    () => ({
      don: filteredRows.length,
      slGoi: filteredRows.reduce((s, r) => s + r.slGoi, 0),
      thanhTien: filteredRows.reduce((s, r) => s + r.thanhTien, 0),
      donDot2: filteredRows.filter(r => r.isDot2).length,
    }),
    [filteredRows]
  );

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
                <ChartBarIcon />
              </div>
              THEO DÕI GÓI OSTELIN 60V (5H - 21.67%)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Đợt 2 từ {dot2StartLabel} — cột sheet <span className="font-mono">Dot_2</span>
              {currentEmployee.code !== ADMIN_CODE && (
                <span className="ml-2 font-bold text-teal-700 dark:text-teal-300">
                  · Chi tiết đơn: {currentEmployee.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dot2Filter}
              onChange={e => setDot2Filter(e.target.value as 'all' | 'dot2' | 'dot1')}
              className="text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
              aria-label="Lọc đợt Ostelin"
            >
              <option value="all">Tất cả đợt</option>
              <option value="dot2">Chỉ Đợt 2</option>
              <option value="dot1">Chỉ Đợt 1</option>
            </select>
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

        {loading && <div className="text-center py-8 text-slate-500 dark:text-slate-400">Đang tải...</div>}
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
              <table className="w-full text-left text-sm border-collapse min-w-[560px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Số đơn</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Đơn Đợt 2</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng SL gói</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {byRep.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td>
                    </tr>
                  ) : byRep.map((row, idx) => (
                    <tr
                      key={row.rep}
                      className={idx === 0 ? 'bg-amber-50/80 dark:bg-amber-950/30' : undefined}
                    >
                      <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-white">{row.rep}</span>
                          {idx === 0 && (
                            <span
                              className="inline-flex items-center shrink-0 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm dark:from-amber-500 dark:to-amber-600 dark:text-amber-950"
                              title="Nhiều đơn gói Ostelin 60V nhất (theo số đơn, sau đó SL gói)"
                            >
                              Top 1 đơn hàng
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.soDon}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-700 dark:text-teal-300">{row.soDonDot2}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slGoi}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.thanhTien)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase tracking-wide">
                CHI TIẾT ĐƠN GÓI
                {currentEmployee.code !== ADMIN_CODE && (
                  <span className="ml-2 text-[11px] font-bold text-teal-700 dark:text-teal-300 normal-case">
                    — Rep {currentEmployee.name}
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-opella-green/10 dark:bg-opella-green/20">
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Số dòng / đơn</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.don}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Đơn Đợt 2</p>
                <p className="text-xl font-black text-teal-700 dark:text-teal-300">{totals.donDot2}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng SL gói</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.slGoi}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng thành tiền</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{formatCurrency(totals.thanhTien)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Thời gian</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Đợt</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600">Tên KH</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">SL hộp</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">SL gói</th>
                    <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu gói Ostelin 60V</td>
                    </tr>
                  ) : filteredRows.map((row, idx) => (
                    <tr key={row.key} className={row.isDot2 ? 'bg-teal-50/50 dark:bg-teal-950/20' : undefined}>
                      <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{formatSheetTimestamp(row.tsRaw)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            row.isDot2
                              ? 'bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.dot2Label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">{row.rep}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200">{row.code || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{row.name || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slHop || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slGoi}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.thanhTien)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ostelin60VTab;
