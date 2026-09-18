import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { ADMIN_CODE, GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET, PHARMATON_VI_GOI_SHEET } from '../constants';
import { repNameMatchesEmployee } from '../utils/employeeScope';
import {
  formatOstelinDot2Label,
  isOstelin60VRowDot2,
  OSTELIN_60V_DOT2_START_MS,
} from '../utils/ostelin60v';
import {
  formatPharmatonDot2Label,
  isPharmatonViRowDot2,
  PHARMATON_VI_DOT2_START_MS,
} from '../utils/pharmatonVi';
import { ChartBarIcon } from './icons';

interface PharmatonViGoiRow {
  Timestamp?: string | number;
  timestamp?: string | number;
  Rep?: string;
  employeeName?: string;
  CustomerCode?: string;
  CustomerName?: string;
  SL_hop?: number | string;
  'SL_hộp'?: number | string;
  SL_goi?: number | string;
  'SL gói'?: number | string;
  Dot_2?: string;
  'Đợt_2'?: string;
  'Đợt 2'?: string;
  Thanh_tien?: number | string;
  ThanhTien?: number | string;
  [key: string]: unknown;
}

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

const ostelinDot2StartLabel = new Date(OSTELIN_60V_DOT2_START_MS).toLocaleDateString('vi-VN');
const pharmatonDot2StartLabel = new Date(PHARMATON_VI_DOT2_START_MS).toLocaleDateString('vi-VN');

export type GoiHangProgramTab = 'ostelin' | 'pharmaton';

interface Props {
  currentEmployee: Employee;
  programTab?: GoiHangProgramTab;
  onProgramTabChange?: (tab: GoiHangProgramTab) => void;
  /** Hiện switcher / nội dung Ostelin (mặc định true) */
  showOstelinProgram?: boolean;
  /** Hiện switcher / nội dung Pharmaton (mặc định true) */
  showPharmatonProgram?: boolean;
}

const Ostelin60VTab: React.FC<Props> = ({
  currentEmployee,
  programTab: programTabProp,
  onProgramTabChange,
  showOstelinProgram = true,
  showPharmatonProgram = true,
}) => {
  const [programTabInternal, setProgramTabInternal] = useState<GoiHangProgramTab>(
    showOstelinProgram ? 'ostelin' : 'pharmaton'
  );
  const programTab = programTabProp ?? programTabInternal;
  const setProgramTab = (tab: GoiHangProgramTab) => {
    if (tab === 'ostelin' && !showOstelinProgram) return;
    if (tab === 'pharmaton' && !showPharmatonProgram) return;
    if (onProgramTabChange) onProgramTabChange(tab);
    else setProgramTabInternal(tab);
  };

  const [rawData, setRawData] = useState<Ostelin60VGoiRow[]>([]);
  const [pharmatonRawData, setPharmatonRawData] = useState<PharmatonViGoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dot2Filter, setDot2Filter] = useState<'all' | 'dot2' | 'dot1'>('all');
  const [pharmatonDot2Filter, setPharmatonDot2Filter] = useState<'all' | 'dot2' | 'dot1'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ostelinData, pharmatonData] = await Promise.all([
        fetchDataFromSheet<Ostelin60VGoiRow>(GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET),
        fetchDataFromSheet<PharmatonViGoiRow>(GOOGLE_SCRIPT_URL, PHARMATON_VI_GOI_SHEET),
      ]);
      setRawData(ostelinData || []);
      setPharmatonRawData(pharmatonData || []);
    } catch {
      setError(`Không tải được dữ liệu sheet ${OSTELIN_60V_GOI_SHEET} / ${PHARMATON_VI_GOI_SHEET}.`);
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

  /** THỐNG KÊ THEO REP — Ostelin (mọi NV + admin xem hết) */
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

  const allPharmatonRows = useMemo(() => {
    return pharmatonRawData
      .map((row, idx) => {
        const rep = String(row.Rep ?? row.employeeName ?? '').trim() || '—';
        const code = String(row.CustomerCode ?? '').trim();
        const name = String(row.CustomerName ?? '').trim();
        const slHop = Number(row['SL_hộp'] ?? row.SL_hop ?? 0) || 0;
        const slGoi = Number(row.SL_goi ?? row['SL gói'] ?? 0) || 0;
        const thanhTien = Number(row.Thanh_tien ?? row.ThanhTien ?? 0) || 0;
        const ts = row.Timestamp ?? row.timestamp;
        const isDot2 = isPharmatonViRowDot2(row as Record<string, unknown>, ts);
        return {
          key: `pmt-${idx}-${rep}-${code}-${String(ts)}`,
          tsRaw: ts,
          rep,
          code,
          name,
          slHop,
          slGoi,
          thanhTien,
          isDot2,
          dot2Label: formatPharmatonDot2Label(isDot2),
        };
      })
      .sort((a, b) => {
        const ta = a.tsRaw != null ? new Date(a.tsRaw as string | number).getTime() : 0;
        const tb = b.tsRaw != null ? new Date(b.tsRaw as string | number).getTime() : 0;
        return tb - ta;
      });
  }, [pharmatonRawData]);

  /** KH đã có dòng Đợt 1 — không tính các dòng Đợt 2 của cùng mã KH */
  const pharmatonDot1Codes = useMemo(() => {
    const s = new Set<string>();
    allPharmatonRows.forEach((r) => {
      if (!r.isDot2 && r.code) s.add(r.code);
    });
    return s;
  }, [allPharmatonRows]);

  const pharmatonRowsCounted = useMemo(
    () => allPharmatonRows.filter((r) => !(r.isDot2 && pharmatonDot1Codes.has(r.code))),
    [allPharmatonRows, pharmatonDot1Codes]
  );

  const pharmatonRowsByDotFilter = useMemo(() => {
    if (pharmatonDot2Filter === 'dot2') return pharmatonRowsCounted.filter(r => r.isDot2);
    if (pharmatonDot2Filter === 'dot1') return pharmatonRowsCounted.filter(r => !r.isDot2);
    return pharmatonRowsCounted;
  }, [pharmatonRowsCounted, pharmatonDot2Filter]);

  const filteredPharmatonRows = useMemo(
    () => pharmatonRowsByDotFilter.filter(r => repNameMatchesEmployee(r.rep, currentEmployee)),
    [pharmatonRowsByDotFilter, currentEmployee]
  );

  /** THỐNG KÊ THEO REP — PMT Vỉ (toàn bộ Rep, theo bộ lọc đợt) */
  const pharmatonByRep = useMemo(() => {
    const m = new Map<string, { soDon: number; slGoi: number; thanhTien: number; soDonDot2: number }>();
    pharmatonRowsByDotFilter.forEach((r) => {
      if (!m.has(r.rep)) m.set(r.rep, { soDon: 0, slGoi: 0, thanhTien: 0, soDonDot2: 0 });
      const cur = m.get(r.rep)!;
      cur.soDon += 1;
      cur.slGoi += r.slGoi;
      cur.thanhTien += r.thanhTien;
      if (r.isDot2) cur.soDonDot2 += 1;
    });
    const khByRep = new Map<string, Set<string>>();
    pharmatonRowsByDotFilter.forEach((r) => {
      if (!r.code) return;
      if (!khByRep.has(r.rep)) khByRep.set(r.rep, new Set());
      khByRep.get(r.rep)!.add(r.code);
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({
        rep,
        ...v,
        soKh: khByRep.get(rep)?.size ?? 0,
      }))
      .sort((a, b) => b.soKh - a.soKh || b.soDon - a.soDon || b.thanhTien - a.thanhTien);
  }, [pharmatonRowsByDotFilter]);

  const pharmatonTotals = useMemo(
    () => ({
      don: filteredPharmatonRows.length,
      soKh: new Set(filteredPharmatonRows.map(r => r.code).filter(Boolean)).size,
      slGoi: filteredPharmatonRows.reduce((s, r) => s + r.slGoi, 0),
      thanhTien: filteredPharmatonRows.reduce((s, r) => s + r.thanhTien, 0),
      donDot2: filteredPharmatonRows.filter(r => r.isDot2).length,
    }),
    [filteredPharmatonRows]
  );

  const totals = useMemo(
    () => ({
      don: filteredRows.length,
      slGoi: filteredRows.reduce((s, r) => s + r.slGoi, 0),
      thanhTien: filteredRows.reduce((s, r) => s + r.thanhTien, 0),
      donDot2: filteredRows.filter(r => r.isDot2).length,
    }),
    [filteredRows]
  );

  const isOstelinTab = programTab === 'ostelin';

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isOstelinTab ? 'bg-opella-green/20' : 'bg-violet-500/20'
                }`}
              >
                <ChartBarIcon />
              </div>
              <span className={isOstelinTab ? 'text-opella-green dark:text-opella-green' : 'text-violet-800 dark:text-violet-200'}>
                {isOstelinTab
                  ? 'THEO DÕI GÓI OSTELIN 60V (5H - 21.67%)'
                  : 'THEO DÕI PHARMATON VỈ'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isOstelinTab ? (
                <>
                  Đợt 2 từ {ostelinDot2StartLabel} — sheet <span className="font-mono">{OSTELIN_60V_GOI_SHEET}</span>
                  , cột <span className="font-mono">Dot_2</span>
                </>
              ) : (
                <>
                  Đợt 2 từ {pharmatonDot2StartLabel}: mua ≥ 1 hộp tự ghi nhận (KH đã mua Đợt 1 không tính Đợt 2) — sheet{' '}
                  <span className="font-mono">{PHARMATON_VI_GOI_SHEET}</span>, cột{' '}
                  <span className="font-mono">Dot_2</span>
                </>
              )}
              {currentEmployee.code !== ADMIN_CODE && (
                <span
                  className={`ml-2 font-bold ${
                    isOstelinTab ? 'text-teal-700 dark:text-teal-300' : 'text-violet-700 dark:text-violet-300'
                  }`}
                >
                  · Chi tiết KH: {currentEmployee.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOstelinTab && (
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
            )}
            {!isOstelinTab && (
              <select
                value={pharmatonDot2Filter}
                onChange={e => setPharmatonDot2Filter(e.target.value as 'all' | 'dot2' | 'dot1')}
                className="text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                aria-label="Lọc đợt Pharmaton"
              >
                <option value="all">Tất cả đợt</option>
                <option value="dot2">Chỉ Đợt 2</option>
                <option value="dot1">Chỉ Đợt 1</option>
              </select>
            )}
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

        {showOstelinProgram && showPharmatonProgram && (
        <div
          className="flex rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800/80"
          role="tablist"
          aria-label="Chọn chương trình gói"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isOstelinTab}
            onClick={() => setProgramTab('ostelin')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black uppercase tracking-wide transition-colors ${
              isOstelinTab
                ? 'bg-opella-green text-white dark:bg-opella-green'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80'
            }`}
          >
            Gói Ostelin 60V
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isOstelinTab}
            onClick={() => setProgramTab('pharmaton')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black uppercase tracking-wide transition-colors border-l border-slate-200 dark:border-slate-600 ${
              !isOstelinTab
                ? 'bg-violet-600 text-white dark:bg-violet-600'
                : 'text-slate-600 dark:text-slate-300 hover:bg-violet-50/80 dark:hover:bg-violet-950/30'
            }`}
          >
            Gói PHARMATON VỈ
          </button>
        </div>
        )}

        {loading && <div className="text-center py-8 text-slate-500 dark:text-slate-400">Đang tải...</div>}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && isOstelinTab && (
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

        {!loading && !error && isOstelinTab && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase tracking-wide">
                CHI TIẾT ĐƠN GÓI OSTELIN
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

        {!loading && !error && !isOstelinTab && (
          <div className="border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
              <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40">
                <h3 className="text-sm font-black text-violet-800 dark:text-violet-200 uppercase tracking-wide">
                  THỐNG KÊ THEO REP
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[560px]">
                  <thead className="bg-violet-100/80 dark:bg-violet-900/40 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 w-12">STT</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800">Rep</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Số KH</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Số đơn</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Đơn Đợt 2</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Tổng SL gói</th>
                      <th className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Tổng thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {pharmatonByRep.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu gói PMT Vỉ</td>
                      </tr>
                    ) : pharmatonByRep.map((row, idx) => (
                      <tr
                        key={row.rep}
                        className={idx === 0 ? 'bg-violet-50/80 dark:bg-violet-950/30' : undefined}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-white">{row.rep}</span>
                            {idx === 0 && row.soKh > 0 && (
                              <span
                                className="inline-flex items-center shrink-0 rounded-full border border-violet-400/80 bg-gradient-to-r from-violet-400 to-violet-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-950 shadow-sm"
                                title="Nhiều KH mua gói PMT Vỉ nhất"
                              >
                                Top 1 KH
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-violet-800 dark:text-violet-200">{row.soKh}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.soDon}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-violet-700 dark:text-violet-300">{row.soDonDot2}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.slGoi}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-violet-700 dark:text-violet-300">{formatCurrency(row.thanhTien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {!loading && !error && !isOstelinTab && (
            <div className="border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40">
                <h3 className="text-sm font-black text-violet-800 dark:text-violet-200 uppercase tracking-wide">
                  CHI TIẾT KH MUA GÓI PHARMATON VỈ
                  {currentEmployee.code !== ADMIN_CODE && (
                    <span className="ml-2 text-[11px] font-bold text-violet-600 dark:text-violet-300 normal-case">
                      — Rep {currentEmployee.name}
                    </span>
                  )}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 bg-violet-50/60 dark:bg-violet-950/25">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Số KH</p>
                  <p className="text-xl font-black text-violet-800 dark:text-violet-200">{pharmatonTotals.soKh}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Số đơn / dòng</p>
                  <p className="text-xl font-black text-violet-800 dark:text-violet-200">{pharmatonTotals.don}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Đơn Đợt 2</p>
                  <p className="text-xl font-black text-violet-700 dark:text-violet-300">{pharmatonTotals.donDot2}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng SL gói</p>
                  <p className="text-xl font-black text-violet-800 dark:text-violet-200">{pharmatonTotals.slGoi}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng thành tiền</p>
                  <p className="text-xl font-black text-violet-700 dark:text-violet-300">{formatCurrency(pharmatonTotals.thanhTien)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                  <thead className="bg-violet-100/80 dark:bg-violet-900/40 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800 w-12">STT</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800">Thời gian</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800">Đợt</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800">Rep</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800">Mã KH</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800">Tên KH</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800 text-right">SL hộp</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800 text-right">SL gói</th>
                      <th className="px-3 py-3 border-b border-violet-200 dark:border-violet-800 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredPharmatonRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">Chưa có KH mua gói PMT Vỉ</td>
                      </tr>
                    ) : filteredPharmatonRows.map((row, idx) => (
                      <tr key={row.key} className={row.isDot2 ? 'bg-violet-50/50 dark:bg-violet-950/20' : undefined}>
                        <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{formatSheetTimestamp(row.tsRaw)}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              row.isDot2
                                ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100'
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
                        <td className="px-3 py-2.5 text-right font-bold text-violet-700 dark:text-violet-300">{formatCurrency(row.thanhTien)}</td>
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
