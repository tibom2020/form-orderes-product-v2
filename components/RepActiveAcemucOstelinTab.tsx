import React, { useEffect, useMemo, useState } from 'react';
import { SalesRecord } from '../types';
import { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ACEMUC_ACTIVE_MIN_QTY, ACEMUC_Q2_TARGET_PER_REP, ADMIN_CODE } from '../constants';
import { salesRecordMatchesEmployee } from '../utils/employeeScope';
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

interface PharmatonRepRow {
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

function filterCustomers(customers: CustomerRow[], repFilter: string, search: string): CustomerRow[] {
  let result = customers;
  if (repFilter) {
    result = result.filter(c => c.rep === repFilter);
  }
  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter(c =>
      c.rep.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  }
  return result;
}

function repOptionsFrom(customers: CustomerRow[]): string[] {
  const s = new Set(customers.map(c => c.rep).filter(Boolean));
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
}

/** Đồng bộ chiều cao 3 bảng Rep — header cố định, hàng NV ngang nhau */
const REP_PANEL_TITLE_CLASS =
  'px-4 border-b shrink-0 min-h-[3.5rem] flex items-center';
const REP_TABLE_WRAP_CLASS = 'overflow-auto flex-1 min-h-0 max-h-[min(560px,58vh)]';
const REP_TH_CLASS =
  'px-3 py-2 border-b border-slate-200 dark:border-slate-600 align-bottom h-[4.25rem]';
const REP_TR_CLASS = 'h-11 align-middle';
const REP_THEAD_CLASS =
  'sticky top-0 z-20 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-sm';

function RepNameCell({
  rep,
  isTop,
  isMe,
  topTitle,
}: {
  rep: string;
  isTop?: boolean;
  isMe?: boolean;
  topTitle?: string;
}) {
  return (
    <td className={`${REP_TR_CLASS} px-3 font-bold text-slate-800 dark:text-white`}>
      <span className="inline-flex items-center gap-1.5 flex-wrap leading-tight">
        <span className="whitespace-nowrap">{rep}</span>
        {isTop && (
          <span
            className="inline-flex items-center shrink-0 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm"
            title={topTitle}
          >
            ★ TOP 1
          </span>
        )}
        {isMe && (
          <span className="inline-block shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white">
            BẠN
          </span>
        )}
      </span>
    </td>
  );
}

const RepActiveAcemucOstelinTab: React.FC<Props> = ({ salesRecords, currentEmployee }) => {
  const [acemucSearch, setAcemucSearch] = useState('');
  const [ostelinSearch, setOstelinSearch] = useState('');
  const [pharmatonSearch, setPharmatonSearch] = useState('');
  const [acemucRepFilter, setAcemucRepFilter] = useState('');
  const [pharmatonRepFilter, setPharmatonRepFilter] = useState('');
  const [ostelinRepFilter, setOstelinRepFilter] = useState('');

  const scopedRecords = useMemo(
    () => salesRecords.filter((r) => salesRecordMatchesEmployee(r, currentEmployee)),
    [salesRecords, currentEmployee]
  );

  /** Đồng bộ lọc Rep trên bảng KH với NV chọn ở header */
  useEffect(() => {
    if (currentEmployee.code === ADMIN_CODE) {
      setAcemucRepFilter('');
      setPharmatonRepFilter('');
      setOstelinRepFilter('');
    } else {
      setAcemucRepFilter(currentEmployee.name);
      setPharmatonRepFilter(currentEmployee.name);
      setOstelinRepFilter(currentEmployee.name);
    }
  }, [currentEmployee.code, currentEmployee.name]);

  const myRepKey = currentEmployee.name.trim().toLowerCase();

  /** Bảng theo Rep — toàn bộ NV (mọi user + admin xem hết) */
  const acemucByRep = useMemo<AcemucRepRow[]>(() => {
    const m = new Map<string, { active: number; sale: number }>();
    salesRecords.forEach(r => {
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
  }, [salesRecords]);

  const pharmatonByRep = useMemo<PharmatonRepRow[]>(() => {
    const m = new Map<string, { active: number; sale: number }>();
    salesRecords.forEach(r => {
      const rep = String(r.Rep ?? '').trim();
      if (!rep) return;
      const qty = num(asRec(r)['PMT_QTY']);
      const sale = num(asRec(r)['PHARMATON']);
      if (!m.has(rep)) m.set(rep, { active: 0, sale: 0 });
      const cur = m.get(rep)!;
      if (qty > 0) cur.active += 1;
      cur.sale += sale;
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({ rep, active: v.active, sale: v.sale }))
      .sort((a, b) => a.rep.localeCompare(b.rep, 'vi'));
  }, [salesRecords]);

  const ostelinByRep = useMemo<OstelinRepRow[]>(() => {
    const m = new Map<string, { active: number; sale: number }>();
    salesRecords.forEach(r => {
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
  }, [salesRecords]);

  const acemucTotals = useMemo(() => {
    const target = acemucByRep.reduce((s, r) => s + r.target, 0);
    const active = acemucByRep.reduce((s, r) => s + r.active, 0);
    const todo = acemucByRep.reduce((s, r) => s + r.todo, 0);
    const sale = acemucByRep.reduce((s, r) => s + r.sale, 0);
    const pct = target > 0 ? (active / target) * 100 : 0;
    return { target, active, todo, sale, pct };
  }, [acemucByRep]);

  const pharmatonTotals = useMemo(() => {
    return {
      active: pharmatonByRep.reduce((s, r) => s + r.active, 0),
      sale: pharmatonByRep.reduce((s, r) => s + r.sale, 0),
    };
  }, [pharmatonByRep]);

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

  const pharmatonTopRep = useMemo(() => {
    if (pharmatonByRep.length === 0) return null;
    return pharmatonByRep.reduce((best, r) => {
      if (!best) return r;
      if (r.active > best.active) return r;
      if (r.active === best.active && r.sale > best.sale) return r;
      return best;
    }, pharmatonByRep[0]);
  }, [pharmatonByRep]);

  const ostelinTopRep = useMemo(() => {
    if (ostelinByRep.length === 0) return null;
    return ostelinByRep.reduce((best, r) => {
      if (!best) return r;
      if (r.active > best.active) return r;
      if (r.active === best.active && r.sale > best.sale) return r;
      return best;
    }, ostelinByRep[0]);
  }, [ostelinByRep]);

  const acemucByRepMap = useMemo(() => new Map(acemucByRep.map(r => [r.rep, r])), [acemucByRep]);
  const pharmatonByRepMap = useMemo(() => new Map(pharmatonByRep.map(r => [r.rep, r])), [pharmatonByRep]);
  const ostelinByRepMap = useMemo(() => new Map(ostelinByRep.map(r => [r.rep, r])), [ostelinByRep]);

  /** Cùng thứ tự Rep trên cả 3 bảng để so sánh ngang */
  const alignedRepNames = useMemo(() => {
    const names = new Set<string>();
    acemucByRep.forEach(r => names.add(r.rep));
    pharmatonByRep.forEach(r => names.add(r.rep));
    ostelinByRep.forEach(r => names.add(r.rep));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [acemucByRep, pharmatonByRep, ostelinByRep]);

  const hasRepStats = alignedRepNames.length > 0;

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

  const pharmatonCustomers = useMemo<CustomerRow[]>(() => {
    return scopedRecords
      .map(r => ({
        rep: String(r.Rep ?? '').trim(),
        code: String(r.CustomerCode ?? '').trim(),
        name: String(r.CustomerName ?? '').trim(),
        qty: num(asRec(r)['PMT_QTY']),
        sale: num(asRec(r)['PHARMATON']),
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

  const acemucRepOptions = useMemo(() => repOptionsFrom(acemucCustomers), [acemucCustomers]);
  const pharmatonRepOptions = useMemo(() => repOptionsFrom(pharmatonCustomers), [pharmatonCustomers]);
  const ostelinRepOptions = useMemo(() => repOptionsFrom(ostelinCustomers), [ostelinCustomers]);

  const filteredAcemucCustomers = useMemo(
    () => filterCustomers(acemucCustomers, acemucRepFilter, acemucSearch),
    [acemucCustomers, acemucRepFilter, acemucSearch]
  );

  const filteredPharmatonCustomers = useMemo(
    () => filterCustomers(pharmatonCustomers, pharmatonRepFilter, pharmatonSearch),
    [pharmatonCustomers, pharmatonRepFilter, pharmatonSearch]
  );

  const filteredOstelinCustomers = useMemo(
    () => filterCustomers(ostelinCustomers, ostelinRepFilter, ostelinSearch),
    [ostelinCustomers, ostelinRepFilter, ostelinSearch]
  );

  const pctClass = (pct: number) => {
    if (pct >= 100) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40';
    if (pct >= 60) return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40';
    return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40';
  };

  const repSelectClass =
    'px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-44';

  return (
    <div className="p-4 animate-fade-in space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
          <ChartBarIcon />
        </div>
        <div>
          <h2 className="text-lg font-black text-opella-green uppercase">
            THEO DÕI REP ACTIVE — ACEMUC, PHARMATON & OSTELIN (Q2)
          </h2>
          {currentEmployee.code !== ADMIN_CODE && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-bold">
              Thống kê Rep: tất cả NV · Danh sách KH: {currentEmployee.name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        {/* ACEMUC by Rep */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50 flex flex-col min-h-[28rem] max-h-[min(680px,70vh)]">
          <div className={`${REP_PANEL_TITLE_CLASS} border-slate-200 dark:border-slate-600 bg-amber-50 dark:bg-amber-950/30 justify-between gap-2`}>
            <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-wide leading-tight">
              ACEMUC — Active Q2 (≥{ACEMUC_ACTIVE_MIN_QTY}h)
            </h3>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
              Target/Rep: {ACEMUC_Q2_TARGET_PER_REP}
            </span>
          </div>
          <div className={`${REP_TABLE_WRAP_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm border-collapse min-w-[640px]">
              <thead className={REP_THEAD_CLASS}>
                <tr>
                  <th className={`${REP_TH_CLASS} w-[11rem]`}>Rep</th>
                  <th className={`${REP_TH_CLASS} text-right bg-amber-100/70 dark:bg-amber-900/40`} title="Target Q2 - ACTIVE">Target</th>
                  <th className={`${REP_TH_CLASS} text-right bg-amber-100/70 dark:bg-amber-900/40`} title={`Achive Q2 (mua ≥${ACEMUC_ACTIVE_MIN_QTY}h bất kỳ)`}>Active KH</th>
                  <th className={`${REP_TH_CLASS} text-right`}>% Achive</th>
                  <th className={`${REP_TH_CLASS} text-right bg-amber-100/70 dark:bg-amber-900/40`}>Todo</th>
                  <th className={`${REP_TH_CLASS} text-right`} title="Sale Acemuc Q2">Sale Q2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {!hasRepStats ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td></tr>
                ) : alignedRepNames.map(rep => {
                  const r = acemucByRepMap.get(rep);
                  const target = r?.target ?? ACEMUC_Q2_TARGET_PER_REP;
                  const active = r?.active ?? 0;
                  const pct = r?.pct ?? (target > 0 ? (active / target) * 100 : 0);
                  const todo = r?.todo ?? Math.max(target - active, 0);
                  const sale = r?.sale ?? 0;
                  const isTop = acemucTopRep?.rep === rep && active > 0;
                  const isMe = rep.trim().toLowerCase() === myRepKey;
                  return (
                    <tr
                      key={rep}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${isTop ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''} ${isMe ? 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''} ${!r ? 'opacity-60' : ''}`}
                    >
                      <RepNameCell rep={rep} isTop={isTop} isMe={isMe} topTitle="Top 1 Active Acemuc" />
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums text-slate-700 dark:text-slate-200`}>{target}</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-rose-700 dark:text-rose-300`}>{active}</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold ${pctClass(pct)}`}>{pct.toFixed(2)}%</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-slate-700 dark:text-slate-200`}>{todo}</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-slate-800 dark:text-white`}>{formatCurrency(Math.round(sale))}</td>
                    </tr>
                  );
                })}
                {hasRepStats && (
                  <tr className={`${REP_TR_CLASS} bg-slate-100 dark:bg-slate-700 font-black sticky bottom-0 z-10`}>
                    <td className="px-3 uppercase">Grand Total</td>
                    <td className="px-3 text-right tabular-nums">{acemucTotals.target}</td>
                    <td className="px-3 text-right tabular-nums text-rose-700 dark:text-rose-300">{acemucTotals.active}</td>
                    <td className={`px-3 text-right tabular-nums ${pctClass(acemucTotals.pct)}`}>{acemucTotals.pct.toFixed(2)}%</td>
                    <td className="px-3 text-right tabular-nums">{acemucTotals.todo}</td>
                    <td className="px-3 text-right tabular-nums">{formatCurrency(Math.round(acemucTotals.sale))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PHARMATON by Rep */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50 flex flex-col min-h-[28rem] max-h-[min(680px,70vh)]">
          <div className={`${REP_PANEL_TITLE_CLASS} border-slate-200 dark:border-slate-600 bg-violet-50 dark:bg-violet-950/30`}>
            <h3 className="text-sm font-black text-violet-800 dark:text-violet-200 uppercase tracking-wide leading-tight">
              PHARMATON — Active Q2 (PMT_QTY &gt; 0)
            </h3>
          </div>
          <div className={`${REP_TABLE_WRAP_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm border-collapse min-w-[420px]">
              <thead className={REP_THEAD_CLASS}>
                <tr>
                  <th className={`${REP_TH_CLASS} w-[11rem]`}>Rep</th>
                  <th className={`${REP_TH_CLASS} text-right bg-violet-100/70 dark:bg-violet-900/40`}>Active PMT Q2</th>
                  <th className={`${REP_TH_CLASS} text-right`}>Sale Pharmaton</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {!hasRepStats ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td></tr>
                ) : alignedRepNames.map(rep => {
                  const r = pharmatonByRepMap.get(rep);
                  const active = r?.active ?? 0;
                  const sale = r?.sale ?? 0;
                  const isTop = pharmatonTopRep?.rep === rep && active > 0;
                  const isMe = rep.trim().toLowerCase() === myRepKey;
                  return (
                    <tr
                      key={rep}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${isTop ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''} ${isMe ? 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''} ${!r ? 'opacity-60' : ''}`}
                    >
                      <RepNameCell rep={rep} isTop={isTop} isMe={isMe} topTitle="Top 1 Active Pharmaton" />
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-rose-700 dark:text-rose-300`}>{active}</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-slate-800 dark:text-white`}>{formatCurrency(Math.round(sale))}</td>
                    </tr>
                  );
                })}
                {hasRepStats && (
                  <tr className={`${REP_TR_CLASS} bg-slate-100 dark:bg-slate-700 font-black sticky bottom-0 z-10`}>
                    <td className="px-3 uppercase">Grand Total</td>
                    <td className="px-3 text-right tabular-nums text-rose-700 dark:text-rose-300">{pharmatonTotals.active}</td>
                    <td className="px-3 text-right tabular-nums">{formatCurrency(Math.round(pharmatonTotals.sale))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* OSTELIN by Rep */}
        <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50 flex flex-col min-h-[28rem] max-h-[min(680px,70vh)]">
          <div className={`${REP_PANEL_TITLE_CLASS} border-slate-200 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-950/30`}>
            <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wide leading-tight">
              OSTELIN — Active Q2 (sale &gt; 0)
            </h3>
          </div>
          <div className={`${REP_TABLE_WRAP_CLASS} overflow-x-auto`}>
            <table className="w-full text-left text-sm border-collapse min-w-[420px]">
              <thead className={REP_THEAD_CLASS}>
                <tr>
                  <th className={`${REP_TH_CLASS} w-[11rem]`}>Rep</th>
                  <th className={`${REP_TH_CLASS} text-right bg-emerald-100/70 dark:bg-emerald-900/40`}>Active Ostelin Q2</th>
                  <th className={`${REP_TH_CLASS} text-right`}>Sale Ostelin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {!hasRepStats ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">Chưa có dữ liệu</td></tr>
                ) : alignedRepNames.map(rep => {
                  const r = ostelinByRepMap.get(rep);
                  const active = r?.active ?? 0;
                  const sale = r?.sale ?? 0;
                  const isTop = ostelinTopRep?.rep === rep && active > 0;
                  const isMe = rep.trim().toLowerCase() === myRepKey;
                  return (
                    <tr
                      key={rep}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${isTop ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''} ${isMe ? 'ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''} ${!r ? 'opacity-60' : ''}`}
                    >
                      <RepNameCell rep={rep} isTop={isTop} isMe={isMe} topTitle="Top 1 Active Ostelin" />
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-rose-700 dark:text-rose-300`}>{active}</td>
                      <td className={`${REP_TR_CLASS} px-3 text-right tabular-nums font-bold text-slate-800 dark:text-white`}>{formatCurrency(Math.round(sale))}</td>
                    </tr>
                  );
                })}
                {hasRepStats && (
                  <tr className={`${REP_TR_CLASS} bg-slate-100 dark:bg-slate-700 font-black sticky bottom-0 z-10`}>
                    <td className="px-3 uppercase">Grand Total</td>
                    <td className="px-3 text-right tabular-nums text-rose-700 dark:text-rose-300">{ostelinTotals.active}</td>
                    <td className="px-3 text-right tabular-nums">{formatCurrency(Math.round(ostelinTotals.sale))}</td>
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
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <select
              value={acemucRepFilter}
              onChange={e => setAcemucRepFilter(e.target.value)}
              className={repSelectClass}
              aria-label="Lọc theo Rep Acemuc"
            >
              <option value="">Tất cả Rep</option>
              {acemucRepOptions.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <input
              type="search"
              value={acemucSearch}
              onChange={e => setAcemucSearch(e.target.value)}
              placeholder="Tìm theo Mã KH / Tên KH..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-64"
            />
          </div>
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

      {/* Customer list — PHARMATON */}
      <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-violet-50 dark:bg-violet-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-black text-violet-800 dark:text-violet-200 uppercase tracking-wide">
            Danh sách KH có mua PHARMATON ({filteredPharmatonCustomers.length})
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <select
              value={pharmatonRepFilter}
              onChange={e => setPharmatonRepFilter(e.target.value)}
              className={repSelectClass}
              aria-label="Lọc theo Rep Pharmaton"
            >
              <option value="">Tất cả Rep</option>
              {pharmatonRepOptions.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <input
              type="search"
              value={pharmatonSearch}
              onChange={e => setPharmatonSearch(e.target.value)}
              placeholder="Tìm theo Mã KH / Tên KH..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-sm border-collapse min-w-[640px]">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Rep</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">Tên KH</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">PMT_QTY</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Active</th>
                <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-right">Sale Pharmaton</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredPharmatonCustomers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">Không có KH</td></tr>
              ) : filteredPharmatonCustomers.map((c, idx) => {
                const active = c.qty > 0;
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
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <select
              value={ostelinRepFilter}
              onChange={e => setOstelinRepFilter(e.target.value)}
              className={repSelectClass}
              aria-label="Lọc theo Rep Ostelin"
            >
              <option value="">Tất cả Rep</option>
              {ostelinRepOptions.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <input
              type="search"
              value={ostelinSearch}
              onChange={e => setOstelinSearch(e.target.value)}
              placeholder="Tìm theo Mã KH / Tên KH..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-64"
            />
          </div>
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
