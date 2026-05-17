import React, { useMemo, useState } from 'react';
import { SalesRecord } from '../types';
import { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ACEMUC_ACTIVE_MIN_QTY, ACEMUC_Q2_TARGET_PER_REP } from '../constants';
import { ChartBarIcon } from './icons';

interface Props {
  salesRecords: SalesRecord[];
  currentEmployee: Employee;
  isAdmin?: boolean;
}

interface AcemucRepRow {
  rep: string;
  target: number;
  active: number;
  pct: number;
  todo: number;
  sale: number;
}

interface OstelinRepRow {
  rep: string;
  active: number;
  sale: number;
}

interface CustomerRow {
  rep: string;
  code: string;
  name: string;
  qty: number;
  sale: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asRec(r: SalesRecord): Record<string, unknown> {
  return r as unknown as Record<string, unknown>;
}

const RepActiveAcemucOstelinTab: React.FC<Props> = ({ salesRecords, currentEmployee }) => {
  const [acemucSearch, setAcemucSearch] = useState('');
  const [ostelinSearch, setOstelinSearch] = useState('');

  /** Hiển thị toàn bộ nhân viên cho mọi user. */
  const scopedRecords = salesRecords;
  const myRepKey = currentEmployee.name.trim().toLowerCase();

  const acemucByRep = useMemo<AcemucRepRow[]>(() => {
    const m = new Map<string, { active: number; sale: number }>();
    scopedRecords.forEach(r => {
      const rep = String(r.Rep ?? '').trim();
      if (!rep) return;
      const qty = num(asRec(r)['ACEMUC_QTY']);
      const sale = num(asRec(r)['ACEMUC']);
      if (!m.has(rep)) m.set(rep, { active: 0, sale: 0 });
      const cur = m.get(rep)!;
      if (qty >= ACEMUC_ACTIVE_MIN_QTY) cur.active += 1;
      cur.sale += sale;
    });
    return Array.from(m.entries())
      .map(([rep, v]) => {
        const target = ACEMUC_Q2_TARGET_PER_REP;
        const pct = target > 0 ? (v.active / target) * 100 : 0;
        const todo = Math.max(target - v.active, 0);
        return { rep, target, active: v.active, pct, todo, sale: v.sale };
      })
      .sort((a, b) => a.rep.localeCompare(b.rep, 'vi'));
  }, [scopedRecords]);

  const ostelinByRep = useMemo<OstelinRepRow[]>(() => {
    const m = new Map<string, { active: number; sale: number }>();
    scopedRecords.forEach(r => {
      const rep = String(r.Rep ?? '').trim();
      if (!rep) return;
      const sale = num(asRec(r)['OSTELIN']);
      if (!m.has(rep)) m.set(rep, { active: 0, sale: 0 });
      const cur = m.get(rep)!;
      if (sale > 0) cur.active += 1;
      cur.sale += sale;
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({ rep, active: v.active, sale: v.sale }))
      .sort((a, b) => a.rep.localeCompare(b.rep, 'vi'));
  }, [scopedRecords]);

  const acemucTotals = useMemo(() => {
    const target = acemucByRep.reduce((s, r) => s + r.target, 0);
    const active = acemucByRep.reduce((s, r) => s + r.active, 0);
    const todo = acemucByRep.reduce((s, r) => s + r.todo, 0);
    const sale = acemucByRep.reduce((s, r) => s + r.sale, 0);
    const pct = target > 0 ? (active / target) * 100 : 0;
    return { target, active, todo, sale, pct };
  }, [acemucByRep]);

  const ostelinTotals = useMemo(() => {
    return {
      active: ostelinByRep.reduce((s, r) => s + r.active, 0),
      sale: ostelinByRep.reduce((s, r) => s + r.sale, 0),
    };
  }, [ostelinByRep]);

  /** Top 1 Active mỗi bảng — tie-break theo Sale rồi tên */
  const acemucTopRep = useMemo(() => {
    if (acemucByRep.length === 0) return null;
    return acemucByRep.reduce((best, r) => {
      if (!best) return r;
      if (r.active > best.active) return r;
      if (r.active === best.active && r.sale > best.sale) return r;
      return best;
    }, acemucByRep[0]);
  }, [acemucByRep]);

  const ostelinTopRep = useMemo(() => {
    if (ostelinByRep.length === 0) return null;
    return ostelinByRep.reduce((best, r) => {
      if (!best) return r;
      if (r.active > best.active) return r;
      if (r.active === best.active && r.sale > best.sale) return r;
      return best;
    }, ostelinByRep[0]);
  }, [ostelinByRep]);

  const acemucCustomers = useMemo<CustomerRow[]>(() => {
    return scopedRecords
      .map(r => ({
        rep: String(r.Rep ?? '').trim(),
        code: String(r.CustomerCode ?? '').trim(),
        name: String(r.CustomerName ?? '').trim(),
        qty: num(asRec(r)['ACEMUC_QTY']),
        sale: num(asRec(r)['ACEMUC']),
      }))
      .filter(c => c.qty > 0 || c.sale > 0)
      .sort((a, b) => b.qty - a.qty || b.sale - a.sale);
  }, [scopedRecords]);

  const ostelinCustomers = useMemo<CustomerRow[]>(() => {
    return scopedRecords
      .map(r => ({
        rep: String(r.Rep ?? '').trim(),
        code: String(r.CustomerCode ?? '').trim(),
        name: String(r.CustomerName ?? '').trim(),
        qty: 0,
        sale: num(asRec(r)['OSTELIN']),
      }))
      .filter(c => c.sale > 0)
      .sort((a, b) => b.sale - a.sale);
  }, [scopedRecords]);

  const filteredAcemucCustomers = useMemo(() => {
    const q = acemucSearch.trim().toLowerCase();
    if (!q) return acemucCustomers;
    return acemucCustomers.filter(c =>
      c.rep.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  }, [acemucCustomers, acemucSearch]);

  const filteredOstelinCustomers = useMemo(() => {
    const q = ostelinSearch.trim().toLowerCase();
    if (!q) return ostelinCustomers;
    return ostelinCustomers.filter(c =>
      c.rep.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  }, [ostelinCustomers, ostelinSearch]);

  const pctClass = (pct: number) => {
    if (pct >= 100) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40';
    if (pct >= 60) return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40';
    return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40';
  };

  return (
    <div className="p-4 animate-fade-in space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
          <ChartBarIcon />
        </div>
        <h2 className="text-lg font-black text-opella-green uppercase">
          THEO DÕI REP ACTIVE — ACEMUC & OSTELIN (Q2)
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ACEMUC by Rep */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between">
            <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-wide">
              ACEMUC — Active Q2 (mua ≥ {ACEMUC_ACTIVE_MIN_QTY} hộp bất kỳ)
            </h3>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
              Target/Rep: {ACEMUC_Q2_TARGET_PER_REP}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[640px]">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs">
                <tr>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Rep</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right bg-amber-100/70 dark:bg-amber-900/40">Target Q2 - ACTIVE</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right bg-amber-100/70 dark:bg-amber-900/40">Achive Q2<br/>(mua ≥{ACEMUC_ACTIVE_MIN_QTY}h bất kỳ)</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">% Achive</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right bg-amber-100/70 dark:bg-amber-900/40">Todo 100%</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Achive Q2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {acemucByRep.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td></tr>
                ) : acemucByRep.map(r => {
                  const isTop = acemucTopRep?.rep === r.rep && r.active > 0;
                  const isMe = r.rep.trim().toLowerCase() === myRepKey;
                  return (
                  <tr
                    key={r.rep}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                      isTop ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''
                    } ${isMe ? 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''}`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {r.rep}
                        {isTop && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm"
                            title="Top 1 Active Acemuc"
                          >
                            ★ TOP 1
                          </span>
                        )}
                        {isMe && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white">BẠN</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.target}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-300">{r.active}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${pctClass(r.pct)}`}>{r.pct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700 dark:text-slate-200">{r.todo}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-white">{formatCurrency(Math.round(r.sale))}</td>
                  </tr>
                  );
                })}
                {acemucByRep.length > 0 && (
                  <tr className="bg-slate-100 dark:bg-slate-700 font-black">
                    <td className="px-3 py-2 uppercase">Grand Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{acemucTotals.target}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-300">{acemucTotals.active}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pctClass(acemucTotals.pct)}`}>{acemucTotals.pct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{acemucTotals.todo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Math.round(acemucTotals.sale))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* OSTELIN by Rep */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-950/30">
            <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
              OSTELIN — Active Q2 (sale &gt; 0)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[420px]">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs">
                <tr>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Rep</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right bg-emerald-100/70 dark:bg-emerald-900/40">Active Ostelin Q2</th>
                  <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Sale Ostelin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {ostelinByRep.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td></tr>
                ) : ostelinByRep.map(r => {
                  const isTop = ostelinTopRep?.rep === r.rep && r.active > 0;
                  const isMe = r.rep.trim().toLowerCase() === myRepKey;
                  return (
                  <tr
                    key={r.rep}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                      isTop ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''
                    } ${isMe ? 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''}`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {r.rep}
                        {isTop && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm"
                            title="Top 1 Active Ostelin"
                          >
                            ★ TOP 1
                          </span>
                        )}
                        {isMe && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white">BẠN</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-300">{r.active}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-white">{formatCurrency(Math.round(r.sale))}</td>
                  </tr>
                  );
                })}
                {ostelinByRep.length > 0 && (
                  <tr className="bg-slate-100 dark:bg-slate-700 font-black">
                    <td className="px-3 py-2 uppercase">Grand Total</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-300">{ostelinTotals.active}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Math.round(ostelinTotals.sale))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer list — ACEMUC */}
      <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-amber-50 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-wide">
            Danh sách KH có mua ACEMUC ({filteredAcemucCustomers.length})
          </h3>
          <input
            type="search"
            value={acemucSearch}
            onChange={e => setAcemucSearch(e.target.value)}
            placeholder="Tìm theo Rep / Mã KH / Tên KH..."
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-64"
          />
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-sm border-collapse min-w-[640px]">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Rep</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Tên KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">SL hộp</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Active</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Sale Acemuc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredAcemucCustomers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">Không có KH</td></tr>
              ) : filteredAcemucCustomers.map((c, idx) => {
                const active = c.qty >= ACEMUC_ACTIVE_MIN_QTY;
                return (
                  <tr key={`${c.code}-${idx}`} className={active ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : undefined}>
                    <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-white whitespace-nowrap">{c.rep || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{c.code || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{c.name || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700 dark:text-slate-200">{c.qty}</td>
                    <td className="px-3 py-2 text-right">
                      {active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">ACTIVE</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-white">{formatCurrency(Math.round(c.sale))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer list — OSTELIN */}
      <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
            Danh sách KH có mua OSTELIN ({filteredOstelinCustomers.length})
          </h3>
          <input
            type="search"
            value={ostelinSearch}
            onChange={e => setOstelinSearch(e.target.value)}
            placeholder="Tìm theo Rep / Mã KH / Tên KH..."
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-64"
          />
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-sm border-collapse min-w-[560px]">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Rep</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Tên KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Sale Ostelin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredOstelinCustomers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">Không có KH</td></tr>
              ) : filteredOstelinCustomers.map((c, idx) => (
                <tr key={`${c.code}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-white whitespace-nowrap">{c.rep || '—'}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{c.code || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{c.name || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-white">{formatCurrency(Math.round(c.sale))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RepActiveAcemucOstelinTab;
