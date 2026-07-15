import React, { useEffect, useMemo, useState } from 'react';
import type { Employee, EconsentRecord } from '../types';
import { ADMIN_CODE, GOOGLE_SCRIPT_URL, SHEET_ECONSENT_T7 } from '../constants';
import { fetchDataFromSheet, submitEconsentUpdate } from '../services/googleSheetService';
import { SearchIcon, CheckCircleIcon, ArrowsRotateIcon } from './icons';

type CoverFilter = 'YES' | 'NO';

interface EconsentTabProps {
  currentEmployee: Employee;
}

const COVER_HEADER = 'Cover Q3-2026';

function normalizeCover(value: unknown): CoverFilter | '' {
  const s = String(value ?? '')
    .trim()
    .toUpperCase();
  if (s === 'YES' || s === 'Y' || s === '1' || s === 'TRUE') return 'YES';
  if (s === 'NO' || s === 'N' || s === '0' || s === 'FALSE') return 'NO';
  return '';
}

function getPharmacistNames(record: EconsentRecord): string[] {
  const base = [
    record['Pharmacist Full Name (1)'],
    record['Pharmacist Full Name (2)'],
    record['Pharmacist Full Name (3)'],
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  const extra = String(record['Pharmacist Extra Names'] ?? '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);
  return [...base, ...extra];
}

function getUpdateCount(record: EconsentRecord): number {
  const n = Number(record['Number of Pharmacist (update)']);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isEconsentDone(record: EconsentRecord): boolean {
  const num = getUpdateCount(record);
  if (num <= 0) return false;
  return getPharmacistNames(record).length >= num;
}

function mrMatchesEmployee(record: EconsentRecord, employee: Employee): boolean {
  const mr = String(record.MR ?? '')
    .trim()
    .toLowerCase();
  const name = String(employee.name ?? '')
    .trim()
    .toLowerCase();
  return Boolean(mr && name && mr === name);
}

const EconsentTab: React.FC<EconsentTabProps> = ({ currentEmployee }) => {
  const [rows, setRows] = useState<EconsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverFilter, setCoverFilter] = useState<CoverFilter>('YES');
  const [districtFilter, setDistrictFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [numUpdate, setNumUpdate] = useState(1);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const isAdmin = currentEmployee?.code === ADMIN_CODE;

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDataFromSheet<EconsentRecord>(GOOGLE_SCRIPT_URL, SHEET_ECONSENT_T7);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLoadError('Không tải được sheet ECONSENT_T7. Kiểm tra tên sheet và deploy Web App.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const scopeRows = useMemo(() => {
    let data = rows.filter((r) => String(r.LocationID ?? '').trim());
    if (!isAdmin) {
      data = data.filter((r) => mrMatchesEmployee(r, currentEmployee));
    }
    return data;
  }, [rows, currentEmployee, isAdmin]);

  const coverScoped = useMemo(() => {
    return scopeRows.filter((r) => normalizeCover(r[COVER_HEADER]) === coverFilter);
  }, [scopeRows, coverFilter]);

  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    coverScoped.forEach((r) => {
      const d = String(r.District ?? '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [coverScoped]);

  useEffect(() => {
    if (districtFilter && !districtOptions.includes(districtFilter)) {
      setDistrictFilter('');
    }
  }, [districtOptions, districtFilter]);

  const repProgress = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    coverScoped.forEach((r) => {
      const rep = String(r.MR ?? '').trim() || 'Chưa xác định';
      const cur = map.get(rep) || { total: 0, done: 0 };
      cur.total += 1;
      if (isEconsentDone(r)) cur.done += 1;
      map.set(rep, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        done: v.done,
        todo: Math.max(v.total - v.done, 0),
        pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [coverScoped]);

  const progressTotals = useMemo(() => {
    return repProgress.reduce(
      (acc, r) => ({ total: acc.total + r.total, done: acc.done + r.done }),
      { total: 0, done: 0 }
    );
  }, [repProgress]);

  const myProgress = useMemo(() => {
    if (isAdmin) return progressTotals;
    const mine = repProgress.find(
      (r) => r.name.toLowerCase() === String(currentEmployee.name ?? '').trim().toLowerCase()
    );
    return mine
      ? { total: mine.total, done: mine.done }
      : { total: coverScoped.length, done: coverScoped.filter(isEconsentDone).length };
  }, [isAdmin, progressTotals, repProgress, currentEmployee, coverScoped]);

  const filteredList = useMemo(() => {
    let data = coverScoped;
    if (districtFilter) {
      data = data.filter((r) => String(r.District ?? '').trim() === districtFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      data = data.filter((r) => {
        return (
          String(r.Name ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.LocationID ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.Address ?? '')
            .toLowerCase()
            .includes(q)
        );
      });
    }
    return data.sort((a, b) => {
      const distA = String(a.District ?? '').trim();
      const distB = String(b.District ?? '').trim();
      const distCmp = distA.localeCompare(distB, 'vi');
      if (distCmp !== 0) return distCmp;
      const aDone = isEconsentDone(a) ? 1 : 0;
      const bDone = isEconsentDone(b) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return String(a.Name ?? '').localeCompare(String(b.Name ?? ''), 'vi');
    });
  }, [coverScoped, districtFilter, searchTerm]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => String(r.LocationID).trim() === selectedId) || null;
  }, [rows, selectedId]);

  const openEdit = (record: EconsentRecord) => {
    const id = String(record.LocationID).trim();
    setSelectedId(id);
    setSubmitMsg(null);
    const existing = getPharmacistNames(record);
    const num = getUpdateCount(record) || Math.max(existing.length, 1);
    const padded = [...existing];
    while (padded.length < Math.max(num, 3)) padded.push('');
    setNumUpdate(num);
    setNames(padded);
  };

  const syncNameSlots = (nextNum: number, currentNames: string[]) => {
    const minSlots = Math.max(nextNum, 3);
    const next = [...currentNames];
    while (next.length < minSlots) next.push('');
    setNames(next);
  };

  const handleNumChange = (value: number) => {
    const n = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    setNumUpdate(n);
    syncNameSlots(Math.max(n, 1), names);
  };

  const handleSubmit = async () => {
    if (!selected || !currentEmployee) return;
    const trimmed = names.map((n) => n.trim());
    const filled = trimmed.filter(Boolean);
    if (numUpdate <= 0) {
      alert('Vui lòng nhập Number of Pharmacist (update) > 0.');
      return;
    }
    if (filled.length < numUpdate) {
      alert(`Cần ít nhất ${numUpdate} tên dược sĩ.`);
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    const willBeDone = true;
    const prevDone = isEconsentDone(selected);
    const doneCount = myProgress.done + (prevDone ? 0 : willBeDone ? 1 : 0);
    const totalCount = myProgress.total;
    const res = await submitEconsentUpdate(GOOGLE_SCRIPT_URL, {
      locationId: String(selected.LocationID).trim(),
      customerName: String(selected.Name ?? ''),
      employeeName: currentEmployee.name,
      employeeCode: currentEmployee.code,
      numberOfPharmacistUpdate: numUpdate,
      pharmacistNames: filled,
      doneCount,
      totalCount,
    });
    setSubmitting(false);
    if (res.status !== 'success') {
      alert(res.message || 'Gửi thất bại. Kiểm tra deploy Apps Script.');
      return;
    }
    const extra = filled.length > 3 ? filled.slice(3).join('|') : '';
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.LocationID).trim() !== String(selected.LocationID).trim()) return r;
        return {
          ...r,
          'Number of Pharmacist (update)': numUpdate,
          'Pharmacist Full Name (1)': filled[0] || '',
          'Pharmacist Full Name (2)': filled[1] || '',
          'Pharmacist Full Name (3)': filled[2] || '',
          'Pharmacist Extra Names': extra,
          UpdatedBy: currentEmployee.name,
          UpdatedAt: new Date().toLocaleString('vi-VN'),
        };
      })
    );
    setSubmitMsg('Đã lưu và gửi thông báo.');
    setSelectedId(null);
  };

  const totalPct = progressTotals.total
    ? Math.round((progressTotals.done / progressTotals.total) * 100)
    : 0;

  const pctBarClass = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const pctTextClass = (pct: number) => {
    if (pct >= 80) return 'text-emerald-800 dark:text-emerald-200';
    if (pct >= 40) return 'text-amber-800 dark:text-amber-200';
    return 'text-rose-800 dark:text-rose-200';
  };

  return (
    <div className="bg-gradient-to-b from-cyan-50/80 to-white dark:from-cyan-950/30 dark:to-slate-800 rounded-xl shadow-lg border border-cyan-200/80 dark:border-cyan-800/50 min-h-[500px] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-cyan-200 dark:border-cyan-800/60 sticky top-0 bg-cyan-50/95 dark:bg-slate-800/95 backdrop-blur z-10 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-cyan-950 dark:text-cyan-50 uppercase tracking-wide">
              E-consent T7
            </h2>
            <p className="text-[11px] text-cyan-700/80 dark:text-cyan-300/80 mt-0.5">
              Hiển thị {filteredList.length} KH · Cover {coverFilter}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <ArrowsRotateIcon />
            {loading ? 'Đang tải...' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-cyan-900/70 dark:text-cyan-200/80">Cover Q3</span>
          <button
            type="button"
            onClick={() => setCoverFilter('YES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
              coverFilter === 'YES'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow'
                : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-200 dark:border-emerald-800'
            }`}
          >
            YES
          </button>
          <button
            type="button"
            onClick={() => setCoverFilter('NO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
              coverFilter === 'NO'
                ? 'bg-slate-700 text-white border-slate-800 shadow'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
            }`}
          >
            NO
          </button>
          <label className="ml-0 sm:ml-2 flex items-center gap-2 text-xs font-bold text-cyan-900/70 dark:text-cyan-200/80">
            District
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-700 dark:text-white text-xs font-medium min-w-[160px] shadow-sm"
            >
              <option value="">Tất cả</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-600/60">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Tìm Name / LocationID / Address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-sm border border-cyan-300 dark:border-cyan-700 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white dark:bg-slate-700 dark:text-white shadow-sm"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Xóa tìm kiếm"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-cyan-300/70 dark:border-cyan-700 overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
          <div className="px-3 py-2.5 bg-cyan-700 text-white dark:bg-cyan-800 flex flex-wrap gap-3 justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wide">Tiến độ Rep · Cover {coverFilter}</span>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="bg-white/15 px-2 py-0.5 rounded">
                {progressTotals.done}/{progressTotals.total}
              </span>
              <span className="bg-white/20 px-2 py-0.5 rounded">{totalPct}%</span>
            </div>
          </div>
          <div className="h-1.5 bg-cyan-100 dark:bg-cyan-950">
            <div
              className={`h-full transition-all ${pctBarClass(totalPct)}`}
              style={{ width: `${totalPct}%` }}
            />
          </div>
          <div className="overflow-x-auto max-h-44 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-[1]">
                <tr className="text-left text-[10px] uppercase tracking-wide">
                  <th className="px-3 py-2 font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-600">
                    Rep
                  </th>
                  <th className="px-3 py-2 font-bold text-right bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-b border-sky-200 dark:border-sky-800">
                    Tổng
                  </th>
                  <th className="px-3 py-2 font-bold text-right bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800">
                    Done
                  </th>
                  <th className="px-3 py-2 font-bold text-right bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800 min-w-[88px]">
                    %
                  </th>
                  <th className="px-3 py-2 font-bold text-right bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-b border-rose-200 dark:border-rose-800">
                    Còn
                  </th>
                </tr>
              </thead>
              <tbody>
                {repProgress.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-slate-400 italic text-center">
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  repProgress.map((r, idx) => (
                    <tr
                      key={r.name}
                      className={`border-b border-slate-100 dark:border-slate-700/70 ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-slate-800/40'
                          : 'bg-cyan-50/50 dark:bg-cyan-950/20'
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.name}</td>
                      <td className="px-3 py-2 text-right font-medium bg-sky-50/70 dark:bg-sky-950/30 text-sky-900 dark:text-sky-100">
                        {r.total}
                      </td>
                      <td className="px-3 py-2 text-right font-bold bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200">
                        {r.done}
                      </td>
                      <td className={`px-3 py-2 bg-amber-50/70 dark:bg-amber-950/25 ${pctTextClass(r.pct)}`}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold">{r.pct}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full ${pctBarClass(r.pct)}`}
                              style={{ width: `${r.pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200">
                        {r.todo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-cyan-700/70 dark:text-cyan-300/70 text-sm">Đang tải ECONSENT_T7...</div>
        ) : loadError ? (
          <div className="p-8 text-center text-rose-600 text-sm font-medium">{loadError}</div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic text-sm">Không có KH theo bộ lọc hiện tại</div>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead className="sticky top-0 z-[1]">
              <tr className="text-left text-[10px] uppercase tracking-wide">
                <th className="px-3 py-2.5 font-bold bg-slate-700 text-white w-10">#</th>
                <th className="px-3 py-2.5 font-bold bg-cyan-800 text-white">Khách hàng</th>
                <th className="px-3 py-2.5 font-bold bg-sky-700 text-white">LocationID</th>
                <th className="px-3 py-2.5 font-bold bg-indigo-700 text-white">District</th>
                <th className="px-3 py-2.5 font-bold bg-teal-700 text-white text-center">DS cũ</th>
                <th className="px-3 py-2.5 font-bold bg-emerald-700 text-white text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((record, idx) => {
                const done = isEconsentDone(record);
                const id = String(record.LocationID).trim();
                const zebra = idx % 2 === 0;
                return (
                  <tr
                    key={id}
                    onClick={() => openEdit(record)}
                    className={`cursor-pointer border-b border-slate-200/80 dark:border-slate-700 transition-colors ${
                      done
                        ? zebra
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          : 'bg-emerald-50/40 dark:bg-emerald-950/15 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : zebra
                          ? 'bg-white dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          : 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                    }`}
                  >
                    <td
                      className={`px-3 py-2.5 font-bold text-slate-500 dark:text-slate-400 border-l-4 ${
                        done ? 'border-l-emerald-500' : 'border-l-amber-400'
                      }`}
                    >
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <div className="font-bold text-sm text-slate-800 dark:text-white leading-snug">
                        {record.Name || '(Không tên)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {record.Address}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-sky-900 dark:text-sky-200 bg-sky-50/50 dark:bg-sky-950/20">
                      {id}
                    </td>
                    <td className="px-3 py-2.5 text-indigo-900 dark:text-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20 font-medium">
                      {String(record.District ?? '-')}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-teal-800 dark:text-teal-200 bg-teal-50/50 dark:bg-teal-950/20">
                      {String(record['Number of Pharmacists'] ?? '-')}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                          done
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-amber-400 text-amber-950 border-amber-500'
                        }`}
                      >
                        {done ? <CheckCircleIcon /> : null}
                        {done ? 'Đã cập nhật' : 'Chưa cập nhật'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl shadow-2xl max-h-[92vh] overflow-y-auto border border-cyan-200 dark:border-cyan-800">
            <div className="p-4 border-b border-cyan-200 dark:border-cyan-800 flex justify-between items-start gap-3 sticky top-0 bg-gradient-to-r from-cyan-700 to-teal-700 text-white sm:rounded-t-xl">
              <div>
                <h3 className="font-bold text-base">Cập nhật dược sĩ</h3>
                <p className="text-xs text-cyan-100 mt-1">{selected.Name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-cyan-100 hover:text-white text-sm font-bold px-2"
              >
                Đóng
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-1.5 text-xs rounded-xl p-3 border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40">
                <div className="flex gap-2">
                  <span className="font-bold text-cyan-800 dark:text-cyan-200 w-28 shrink-0">LocationID</span>
                  <span className="text-slate-700 dark:text-slate-200 font-mono">{selected.LocationID}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-cyan-800 dark:text-cyan-200 w-28 shrink-0">District</span>
                  <span className="text-slate-700 dark:text-slate-200">{String(selected.District ?? '-')}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-cyan-800 dark:text-cyan-200 w-28 shrink-0">Cover Q3</span>
                  <span
                    className={`font-bold px-1.5 rounded ${
                      normalizeCover(selected[COVER_HEADER]) === 'YES'
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {String(selected[COVER_HEADER] ?? '-')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-cyan-800 dark:text-cyan-200 w-28 shrink-0">Pharmacists</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {String(selected['Number of Pharmacists'] ?? '-')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-cyan-800 dark:text-cyan-200 w-28 shrink-0">E-consent 2025</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {String(selected['E-consent -2025'] ?? '-')}
                  </span>
                </div>
                <div className="pt-1 text-slate-600 dark:text-slate-300 border-t border-cyan-200/70 dark:border-cyan-800 mt-1">
                  {selected.Address}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200">
                  Number of Pharmacist (update)
                </span>
                <input
                  type="number"
                  min={0}
                  value={numUpdate}
                  onChange={(e) => handleNumChange(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200">
                    Pharmacist Full Name
                  </span>
                  <button
                    type="button"
                    onClick={() => setNames((prev) => [...prev, ''])}
                    className="text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:underline"
                  >
                    + Thêm dược sĩ
                  </button>
                </div>
                {names.map((name, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="shrink-0 w-7 h-9 flex items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={name}
                      placeholder={`Pharmacist Full Name (${idx + 1})`}
                      onChange={(e) => {
                        const next = [...names];
                        next[idx] = e.target.value;
                        setNames(next);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                    {names.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNames((prev) => prev.filter((_, i) => i !== idx))}
                        className="px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {submitMsg && (
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg">
                  {submitMsg}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="w-full py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-bold text-sm shadow"
              >
                {submitting ? 'Đang gửi...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EconsentTab;
