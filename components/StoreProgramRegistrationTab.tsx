import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Employee } from '../types';
import { formatCurrency, formatVndDong, formatSheetSaleQ1Display, parseSheetSalesAmount } from '../utils/formatters';
import {
  normalizeDangKyTbq2Row,
  isRegisteredRow,
  repMatchesEmployee,
  buildSaleT4ByCustomerCodeMap,
  lookupSaleT4Vnd,
  type DangKyTbq2RowView,
} from '../utils/displayTbq2Sheet';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { SHEET_DANGKYTBQ2, SHEET_REP_BUDGET_TBQ2, SHEET_DOANH_SO } from '../constants';

/** Tải DOANH_SO — lỗi sheet/mạng thì trả [] để không chặn tab */
async function fetchDoanhSoRowsSafe(scriptUrl: string): Promise<Record<string, unknown>[]> {
  try {
    return await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DOANH_SO);
  } catch {
    return [];
  }
}

/** Ảnh tiêu chí tham gia / phân hạng CT trưng bày */
export const DISPLAY_TBQ2_CRITERIA_IMAGE_URL = 'https://i.postimg.cc/Cxs6WRtg/tieu-chi.png';

/** Nhãn tab trên thanh điều hướng (App.tsx) */
export const STORE_PROGRAM_TAB_LABEL = 'PS 2026';

export const POSM = {
  FRAME_OTC: 'Frame OTC',
  FRAME_FS: 'Frame FS',
  TOPBOARD: 'Topboard',
  FRONT_COUNTER: 'Front Counter',
  COUNTERTOP: 'Countertop',
  COUNTERTOP_CDU: 'Countertop/CDU',
} as const;

export type PosmLabel = (typeof POSM)[keyof typeof POSM];

export type StoreTierId =
  | 'flagship_plus'
  | 'flagship'
  | 'platinum'
  | 'gold'
  | 'silver'
  | 'bronze';

export type ChoiceMode = 'none' | 'single' | 'exact2';

export interface StoreTierConfig {
  id: StoreTierId;
  label: string;
  minMonthlySales: number;
  minQuarterlySales: number;
  reward: number;
  mandatoryPosm: PosmLabel[];
  choicePool: PosmLabel[] | null;
  choiceMode: ChoiceMode;
  choiceRequired: number;
  /** Màu nền thẻ thống kê (theo ps.html) */
  statCardClass: string;
  /** Hình mẫu POSM theo tier (postimg) */
  samplePosmImageUrl: string;
}

export const STORE_TIER_CONFIGS: StoreTierConfig[] = [
  {
    id: 'flagship_plus',
    label: 'Flagship+',
    minMonthlySales: 15_000_000,
    minQuarterlySales: 45_000_000,
    reward: 4_000_000,
    mandatoryPosm: [POSM.FRAME_OTC, POSM.FRAME_FS, POSM.TOPBOARD, POSM.FRONT_COUNTER, POSM.COUNTERTOP],
    choicePool: null,
    choiceMode: 'none',
    choiceRequired: 0,
    statCardClass: 'bg-[#004225] border-white/10 text-white',
    samplePosmImageUrl: 'https://i.postimg.cc/YCzyJvPJ/Flaship.png',
  },
  {
    id: 'flagship',
    label: 'Flagship',
    minMonthlySales: 15_000_000,
    minQuarterlySales: 45_000_000,
    reward: 3_000_000,
    mandatoryPosm: [POSM.FRAME_OTC, POSM.FRAME_FS, POSM.FRONT_COUNTER, POSM.COUNTERTOP],
    choicePool: null,
    choiceMode: 'none',
    choiceRequired: 0,
    statCardClass: 'bg-[#0A1931] border-white/10 text-white',
    samplePosmImageUrl: 'https://i.postimg.cc/nhJPR4dH/Flaship.png',
  },
  {
    id: 'platinum',
    label: 'Platinum',
    minMonthlySales: 15_000_000,
    minQuarterlySales: 45_000_000,
    reward: 2_400_000,
    mandatoryPosm: [POSM.FRAME_OTC, POSM.FRAME_FS, POSM.FRONT_COUNTER, POSM.COUNTERTOP],
    choicePool: null,
    choiceMode: 'none',
    choiceRequired: 0,
    statCardClass: 'bg-[#C0C0C0] border-black/5 text-[#333]',
    samplePosmImageUrl: 'https://i.postimg.cc/Mpmrhn4w/platinum.png',
  },
  {
    id: 'gold',
    label: 'Gold',
    minMonthlySales: 15_000_000,
    minQuarterlySales: 45_000_000,
    reward: 1_600_000,
    mandatoryPosm: [POSM.FRONT_COUNTER, POSM.COUNTERTOP],
    choicePool: [POSM.FRAME_OTC, POSM.FRAME_FS, POSM.TOPBOARD],
    choiceMode: 'single',
    choiceRequired: 1,
    statCardClass: 'bg-[#FFD700] border-black/5 text-[#4B3800]',
    samplePosmImageUrl: 'https://i.postimg.cc/T3647Vk2/Gold.png',
  },
  {
    id: 'silver',
    label: 'Silver',
    minMonthlySales: 6_000_000,
    minQuarterlySales: 18_000_000,
    reward: 1_200_000,
    mandatoryPosm: [POSM.FRONT_COUNTER],
    choicePool: [POSM.TOPBOARD, POSM.COUNTERTOP_CDU],
    choiceMode: 'single',
    choiceRequired: 1,
    statCardClass: 'bg-[#E5E7EB] border-black/5 text-[#374151]',
    samplePosmImageUrl: 'https://i.postimg.cc/K8Dsd1VF/Silver.png',
  },
  {
    id: 'bronze',
    label: 'Bronze',
    minMonthlySales: 3_000_000,
    minQuarterlySales: 9_000_000,
    reward: 300_000,
    mandatoryPosm: [],
    choicePool: [POSM.TOPBOARD, POSM.FRONT_COUNTER, POSM.COUNTERTOP_CDU],
    choiceMode: 'single',
    choiceRequired: 1,
    statCardClass: 'bg-[#CD7F32]/20 border-[#CD7F32]/30 text-[#78350F]',
    samplePosmImageUrl: 'https://i.postimg.cc/qvT5bsmp/Bronze.png',
  },
];

/** Chuẩn hóa giá trị cột FinalStoreTypeQ2 để khớp với `STORE_TIER_CONFIGS[].label` */
function normalizeFinalStoreTypeQ2Key(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*/g, '+');
}

function findTierConfigByFinalStoreTypeQ2(cell: string): StoreTierConfig | null {
  const key = normalizeFinalStoreTypeQ2Key(cell);
  if (!key) return null;
  for (const t of STORE_TIER_CONFIGS) {
    if (normalizeFinalStoreTypeQ2Key(t.label) === key) return t;
  }
  return null;
}

/** Nền hàng bảng theo tier (cột FinalStoreTypeQ2) */
interface TierTableRowClasses {
  tr: string;
  sticky: string;
  stickyHover: string;
  cell: string;
  cellHover: string;
  posm: string;
  posmHover: string;
  ftq2: string;
  ftq2Hover: string;
  saleT4: string;
  saleT4Hover: string;
  saleTn: string;
  saleTnHover: string;
}

const TIER_TABLE_ROW: Record<StoreTierId, TierTableRowClasses> = {
  flagship_plus: {
    tr: 'bg-emerald-50/95 dark:bg-emerald-950/30',
    sticky: 'bg-emerald-100/98 dark:bg-emerald-950/55',
    stickyHover: 'group-hover/row:bg-emerald-200/95 dark:group-hover/row:bg-emerald-900/45',
    cell: 'bg-emerald-50/50 dark:bg-emerald-950/18',
    cellHover: 'group-hover/row:bg-emerald-100/65 dark:group-hover/row:bg-emerald-900/25',
    posm: 'bg-emerald-100/45 dark:bg-emerald-950/22',
    posmHover: 'group-hover/row:bg-emerald-200/55 dark:group-hover/row:bg-emerald-900/28',
    ftq2: 'bg-emerald-200/40 dark:bg-emerald-900/30',
    ftq2Hover: 'group-hover/row:bg-emerald-200/60 dark:group-hover/row:bg-emerald-800/35',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-50/75 dark:bg-orange-950/22',
    saleTnHover: 'group-hover/row:bg-orange-100/70 dark:group-hover/row:bg-orange-900/28',
  },
  flagship: {
    tr: 'bg-slate-100/90 dark:bg-slate-950/45',
    sticky: 'bg-slate-200/98 dark:bg-slate-900/65',
    stickyHover: 'group-hover/row:bg-slate-300/90 dark:group-hover/row:bg-slate-800/50',
    cell: 'bg-slate-100/55 dark:bg-slate-900/28',
    cellHover: 'group-hover/row:bg-slate-200/65 dark:group-hover/row:bg-slate-800/32',
    posm: 'bg-slate-200/50 dark:bg-slate-900/30',
    posmHover: 'group-hover/row:bg-slate-300/55 dark:group-hover/row:bg-slate-800/35',
    ftq2: 'bg-slate-200/45 dark:bg-slate-800/35',
    ftq2Hover: 'group-hover/row:bg-slate-300/55 dark:group-hover/row:bg-slate-700/40',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-50/75 dark:bg-orange-950/22',
    saleTnHover: 'group-hover/row:bg-orange-100/70 dark:group-hover/row:bg-orange-900/28',
  },
  platinum: {
    tr: 'bg-zinc-100/90 dark:bg-zinc-900/35',
    sticky: 'bg-zinc-200/95 dark:bg-zinc-900/55',
    stickyHover: 'group-hover/row:bg-zinc-300/85 dark:group-hover/row:bg-zinc-800/45',
    cell: 'bg-zinc-100/60 dark:bg-zinc-900/22',
    cellHover: 'group-hover/row:bg-zinc-200/70 dark:group-hover/row:bg-zinc-800/28',
    posm: 'bg-zinc-200/45 dark:bg-zinc-800/28',
    posmHover: 'group-hover/row:bg-zinc-300/50 dark:group-hover/row:bg-zinc-700/32',
    ftq2: 'bg-neutral-200/50 dark:bg-neutral-800/32',
    ftq2Hover: 'group-hover/row:bg-neutral-300/55 dark:group-hover/row:bg-neutral-700/38',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-50/75 dark:bg-orange-950/22',
    saleTnHover: 'group-hover/row:bg-orange-100/70 dark:group-hover/row:bg-orange-900/28',
  },
  gold: {
    tr: 'bg-amber-50/95 dark:bg-amber-950/22',
    sticky: 'bg-amber-100/98 dark:bg-amber-950/40',
    stickyHover: 'group-hover/row:bg-amber-200/90 dark:group-hover/row:bg-amber-900/32',
    cell: 'bg-amber-50/55 dark:bg-amber-950/18',
    cellHover: 'group-hover/row:bg-amber-100/65 dark:group-hover/row:bg-amber-900/25',
    posm: 'bg-amber-100/50 dark:bg-amber-950/25',
    posmHover: 'group-hover/row:bg-amber-200/55 dark:group-hover/row:bg-amber-900/30',
    ftq2: 'bg-amber-200/45 dark:bg-amber-900/28',
    ftq2Hover: 'group-hover/row:bg-amber-200/65 dark:group-hover/row:bg-amber-800/32',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-100/70 dark:bg-orange-950/28',
    saleTnHover: 'group-hover/row:bg-orange-200/65 dark:group-hover/row:bg-orange-900/32',
  },
  silver: {
    tr: 'bg-gray-100/92 dark:bg-gray-900/32',
    sticky: 'bg-gray-200/95 dark:bg-gray-900/50',
    stickyHover: 'group-hover/row:bg-gray-300/88 dark:group-hover/row:bg-gray-800/42',
    cell: 'bg-gray-100/58 dark:bg-gray-900/22',
    cellHover: 'group-hover/row:bg-gray-200/68 dark:group-hover/row:bg-gray-800/28',
    posm: 'bg-gray-200/48 dark:bg-gray-800/26',
    posmHover: 'group-hover/row:bg-gray-300/52 dark:group-hover/row:bg-gray-700/30',
    ftq2: 'bg-slate-200/50 dark:bg-slate-800/30',
    ftq2Hover: 'group-hover/row:bg-slate-300/55 dark:group-hover/row:bg-slate-700/35',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-50/75 dark:bg-orange-950/22',
    saleTnHover: 'group-hover/row:bg-orange-100/70 dark:group-hover/row:bg-orange-900/28',
  },
  bronze: {
    tr: 'bg-orange-50/90 dark:bg-orange-950/20',
    sticky: 'bg-orange-100/95 dark:bg-orange-950/38',
    stickyHover: 'group-hover/row:bg-orange-200/88 dark:group-hover/row:bg-orange-900/32',
    cell: 'bg-orange-50/52 dark:bg-orange-950/16',
    cellHover: 'group-hover/row:bg-orange-100/62 dark:group-hover/row:bg-orange-900/22',
    posm: 'bg-orange-100/48 dark:bg-orange-950/24',
    posmHover: 'group-hover/row:bg-orange-200/52 dark:group-hover/row:bg-orange-900/28',
    ftq2: 'bg-amber-200/45 dark:bg-amber-900/26',
    ftq2Hover: 'group-hover/row:bg-amber-300/50 dark:group-hover/row:bg-amber-800/30',
    saleT4: 'bg-red-50/85 dark:bg-red-950/28',
    saleT4Hover: 'group-hover/row:bg-red-100/80 dark:group-hover/row:bg-red-900/32',
    saleTn: 'bg-orange-100/72 dark:bg-orange-950/26',
    saleTnHover: 'group-hover/row:bg-orange-200/68 dark:group-hover/row:bg-orange-900/30',
  },
};

const NEUTRAL_TABLE_ROW: TierTableRowClasses = {
  tr: 'bg-white/70 dark:bg-slate-800/35',
  sticky: 'bg-sky-50/98 dark:bg-sky-950/92',
  stickyHover: 'group-hover/row:bg-sky-100/98 dark:group-hover/row:bg-sky-900/92',
  cell: 'bg-white/60 dark:bg-slate-800/40',
  cellHover: 'group-hover/row:bg-slate-50/90 dark:group-hover/row:bg-slate-800/55',
  posm: 'bg-amber-50/45 dark:bg-amber-950/20',
  posmHover: 'group-hover/row:bg-amber-100/55 dark:group-hover/row:bg-amber-900/25',
  ftq2: 'bg-violet-50/55 dark:bg-violet-950/28',
  ftq2Hover: 'group-hover/row:bg-violet-100/60 dark:group-hover/row:bg-violet-900/32',
  saleT4: 'bg-red-50/75 dark:bg-red-950/28',
  saleT4Hover: 'group-hover/row:bg-red-100/72 dark:group-hover/row:bg-red-900/32',
  saleTn: 'bg-orange-50/55 dark:bg-orange-950/22',
  saleTnHover: 'group-hover/row:bg-orange-100/58 dark:group-hover/row:bg-orange-900/28',
};

function tierTableRowClassesForRow(row: DangKyTbq2RowView): TierTableRowClasses {
  const cfg = findTierConfigByFinalStoreTypeQ2(row.finalStoreTypeQ2);
  return cfg ? TIER_TABLE_ROW[cfg.id] : NEUTRAL_TABLE_ROW;
}

const TB_CELL_BR = 'border-r border-slate-200/45 dark:border-slate-600/35';

/** Tiêu đề cột gọn trong bảng thống kê theo Rep */
const TIER_TABLE_SHORT: Record<StoreTierId, string> = {
  flagship_plus: 'F+',
  flagship: 'Flagship',
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

interface RepTierStatRow {
  repLabel: string;
  byTier: Record<StoreTierId, number>;
  total: number;
}

function buildRepTierRegistrationRows(rows: DangKyTbq2RowView[]): RepTierStatRow[] {
  const acc = new Map<string, Record<StoreTierId, number>>();
  const emptyTier = (): Record<StoreTierId, number> => {
    const o = {} as Record<StoreTierId, number>;
    STORE_TIER_CONFIGS.forEach(t => {
      o[t.id] = 0;
    });
    return o;
  };

  for (const r of rows) {
    if (!isRegisteredRow(r)) continue;
    const cfg = findTierConfigByFinalStoreTypeQ2(r.finalStoreTypeQ2);
    if (!cfg) continue;
    const repLabel = r.rep.trim() || '— (Chưa gán Rep)';
    if (!acc.has(repLabel)) acc.set(repLabel, emptyTier());
    acc.get(repLabel)![cfg.id] += 1;
  }

  return [...acc.entries()]
    .map(([repLabel, byTier]) => ({
      repLabel,
      byTier,
      total: STORE_TIER_CONFIGS.reduce((s, t) => s + byTier[t.id], 0),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total || a.repLabel.localeCompare(b.repLabel, 'vi'));
}

function sumSaleQ2VndFromRows(rows: DangKyTbq2RowView[]): number {
  let sum = 0;
  for (const r of rows) {
    const n = parseSheetSalesAmount(r.saleQ2);
    if (n != null && Number.isFinite(n)) sum += n;
  }
  return sum;
}

/** Sale T4: ưu tiên cột sheet DANGKYTBQ2; nếu trống → DOANH_SO (MustWin+Other) theo CustomerCode hoặc Code BM */
function displaySaleT4Cell(row: DangKyTbq2RowView, doanhSoMap: Map<string, number>): string {
  if (row.saleT4.trim()) return formatSheetSaleQ1Display(row.saleT4);
  let v = lookupSaleT4Vnd(doanhSoMap, row.customerCode);
  if (v == null && row.codeBm.trim()) v = lookupSaleT4Vnd(doanhSoMap, row.codeBm);
  if (v != null && Number.isFinite(v)) return formatCurrency(Math.round(v));
  return '—';
}

function pickBudgetCell(row: Record<string, unknown>, keys: string[]): string {
  const rk = Object.keys(row);
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
    const f = rk.find(x => x.trim().toLowerCase() === k.trim().toLowerCase());
    if (f != null && row[f] != null && String(row[f]).trim() !== '') return String(row[f]).trim();
  }
  return '';
}

/** Chuỗi % ngân sách đã sử dụng theo từng Rep — biểu đồ cột (admin) */
interface RepBudgetUsedPctPoint {
  rep: string;
  budget: number;
  used: number;
  left: number;
  usedPct: number;
}

function buildRepBudgetUsedPctSeries(rows: Record<string, unknown>[]): RepBudgetUsedPctPoint[] {
  const map = new Map<string, { budget: number; used: number; left: number }>();
  for (const raw of rows) {
    const rep = pickBudgetCell(raw, ['Rep', 'REP']);
    if (!rep.trim()) continue;
    const b = Number(pickBudgetCell(raw, ['Budget', 'Ngân sách'])) || 0;
    const u = Number(pickBudgetCell(raw, ['Đã Sử dụng', 'DaSuDung', 'Da su dung'])) || 0;
    const leftRaw = pickBudgetCell(raw, ['Còn lại', 'ConLai', 'Con lai']);
    const l = leftRaw !== '' ? Number(leftRaw) : b - u;
    const left = Number.isFinite(l) ? l : b - u;
    const cur = map.get(rep) ?? { budget: 0, used: 0, left: 0 };
    cur.budget += b;
    cur.used += u;
    cur.left += left;
    map.set(rep, cur);
  }
  return [...map.entries()]
    .map(([rep, v]) => {
      const usedPct =
        v.budget > 0
          ? Math.min(100, Math.max(0, Math.round((v.used / v.budget) * 1000) / 10))
          : 0;
      return { rep, ...v, usedPct };
    })
    .sort((a, b) => a.rep.localeCompare(b.rep, 'vi'));
}

interface StoreProgramRegistrationTabProps {
  currentEmployee: Employee;
  scriptUrl: string;
  /** Admin xem toàn bộ KH + phê duyệt */
  isAdmin?: boolean;
}

const StoreProgramRegistrationTab: React.FC<StoreProgramRegistrationTabProps> = ({
  currentEmployee,
  scriptUrl,
  isAdmin = false,
}) => {
  const [sheetRows, setSheetRows] = useState<Record<string, unknown>[]>([]);
  const [budgetRows, setBudgetRows] = useState<Record<string, unknown>[]>([]);
  const [doanhSoRows, setDoanhSoRows] = useState<Record<string, unknown>[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Tải lại sheet khi đã có dữ liệu — không ẩn cả trang */
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [imagePreviewModal, setImagePreviewModal] = useState<{
    title: string;
    url: string;
    alt: string;
  } | null>(null);
  const [repBudgetChartOpen, setRepBudgetChartOpen] = useState(false);
  const [repTierStatsOpen, setRepTierStatsOpen] = useState(false);
  /** Bấm thẻ tier: lọc KH đã đăng ký theo giá trị cột FinalStoreTypeQ2 */
  const [tierRegisteredFilter, setTierRegisteredFilter] = useState<StoreTierId | null>(null);

  const normalizedRows = useMemo(
    () => sheetRows.map(r => normalizeDangKyTbq2Row(r as Record<string, unknown>)),
    [sheetRows]
  );

  /** Mọi dòng trên DANGKYTBQ2 có mã KH (không bắt buộc Q1/Q2) — đồng bộ danh sách với sheet */
  const myRows = useMemo(() => {
    let rows = normalizedRows.filter(r => r.customerCode.trim() !== '');
    if (!isAdmin) rows = rows.filter(r => repMatchesEmployee(r.rep, currentEmployee.name));
    return rows;
  }, [normalizedRows, isAdmin, currentEmployee.name]);

  const repBudgetUsedPctSeries = useMemo(
    () => (isAdmin ? buildRepBudgetUsedPctSeries(budgetRows) : []),
    [isAdmin, budgetRows]
  );

  const saleT4ByCustomerCode = useMemo(() => buildSaleT4ByCustomerCodeMap(doanhSoRows), [doanhSoRows]);

  const saleQ2SummaryCard = useMemo(() => {
    const total = sumSaleQ2VndFromRows(myRows);
    if (isAdmin) {
      return {
        total,
        title: 'TỔNG SALE Q2 (TẤT CẢ NV)',
        caption: 'Cộng cột Sale Q2 · DANGKYTBQ2',
      };
    }
    return {
      total,
      title: 'TỔNG SALE Q2 (REP)',
      caption: 'Cộng cột Sale Q2 · phạm vi Rep bạn',
    };
  }, [myRows, isAdmin]);

  const statsByTier = useMemo(() => {
    const m: Record<string, { count: number; saleQ2Sum: number }> = {};
    STORE_TIER_CONFIGS.forEach(t => {
      m[t.label] = { count: 0, saleQ2Sum: 0 };
    });
    myRows.forEach(r => {
      if (!isRegisteredRow(r)) return;
      const cfg = findTierConfigByFinalStoreTypeQ2(r.finalStoreTypeQ2);
      if (!cfg) return;
      m[cfg.label].count += 1;
      const n = parseSheetSalesAmount(r.saleQ2);
      if (n != null && Number.isFinite(n)) m[cfg.label].saleQ2Sum += n;
    });
    return m;
  }, [myRows]);

  /** Thống kê đăng ký theo Rep × Tier (cùng phạm vi dữ liệu với bảng: myRows) */
  const repTierRegistrationRows = useMemo(() => buildRepTierRegistrationRows(myRows), [myRows]);

  const repTierColumnTotals = useMemo(() => {
    const byTier = {} as Record<StoreTierId, number>;
    STORE_TIER_CONFIGS.forEach(t => {
      byTier[t.id] = 0;
    });
    let grand = 0;
    for (const row of repTierRegistrationRows) {
      grand += row.total;
      for (const t of STORE_TIER_CONFIGS) {
        byTier[t.id] += row.byTier[t.id];
      }
    }
    return { byTier, grand };
  }, [repTierRegistrationRows]);

  const filteredTableRows = useMemo(() => {
    let rows = myRows;
    if (tierRegisteredFilter) {
      rows = rows.filter(r => {
        if (!isRegisteredRow(r)) return false;
        const cfg = findTierConfigByFinalStoreTypeQ2(r.finalStoreTypeQ2);
        return cfg?.id === tierRegisteredFilter;
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const saleT4DoanhSo = lookupSaleT4Vnd(saleT4ByCustomerCode, r.customerCode);
      const saleT4DoanhSoBm =
        r.codeBm.trim() ? lookupSaleT4Vnd(saleT4ByCustomerCode, r.codeBm) : undefined;
      const saleT4Fallback = saleT4DoanhSo ?? saleT4DoanhSoBm;
      const saleT4Search =
        (saleT4Fallback != null && Number.isFinite(saleT4Fallback)
          ? `${saleT4Fallback} ${formatCurrency(Math.round(saleT4Fallback))} `.toLowerCase()
          : '') + r.saleT4.toLowerCase();
      const hay = (s: string) => s.toLowerCase().includes(q);
      return (
        hay(r.customerName) ||
        hay(r.customerCode) ||
        hay(r.codeBm) ||
        hay(r.district) ||
        r.sdt.includes(q) ||
        hay(r.finalStoreTypeQ1) ||
        hay(r.saleQ1) ||
        hay(r.finalStoreTypeQ2) ||
        hay(r.note) ||
        hay(r.rep) ||
        hay(r.frameOtc) ||
        hay(r.frameFs) ||
        hay(r.topboard) ||
        hay(r.frontCounter) ||
        hay(r.countertop) ||
        hay(r.saleT4) ||
        hay(r.saleT5) ||
        hay(r.saleT6) ||
        hay(r.saleQ2) ||
        saleT4Search.includes(q)
      );
    });
  }, [myRows, searchQuery, tierRegisteredFilter, saleT4ByCustomerCode]);

  /** Một Rep duy nhất trong kết quả lọc → cột Rep thừa, ẩn đi */
  const hideRepColumn = useMemo(() => {
    if (filteredTableRows.length === 0) return false;
    const reps = new Set(filteredTableRows.map(r => r.rep.trim()));
    return reps.size <= 1;
  }, [filteredTableRows]);

  const loadTbq2Data = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setLoadError(null);
      try {
        const [dk, bud] = await Promise.all([
          fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2),
          fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_REP_BUDGET_TBQ2),
        ]);
        const ds = await fetchDoanhSoRowsSafe(scriptUrl);
        setSheetRows(dk);
        setBudgetRows(bud);
        setDoanhSoRows(ds);
        if (dk.length === 0) {
          setLoadError(
            `Không có dữ liệu sheet ${SHEET_DANGKYTBQ2}. Tạo sheet, import mẫu DANGKYTBQ2.xlsx và deploy Apps Script có doGet.`
          );
        } else {
          setLoadError(null);
        }
      } catch {
        setLoadError('Không tải được dữ liệu. Kiểm tra sheet và URL Script.');
      } finally {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    },
    [scriptUrl]
  );

  useEffect(() => {
    void loadTbq2Data('initial');
  }, [loadTbq2Data]);

  useEffect(() => {
    if (!imagePreviewModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagePreviewModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePreviewModal]);

  useEffect(() => {
    if (!repBudgetChartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRepBudgetChartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [repBudgetChartOpen]);

  useEffect(() => {
    if (!repTierStatsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRepTierStatsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [repTierStatsOpen]);

  /** CustomerCode … Sale Q2 (không hiển thị Q1 / trạng thái / thao tác sheet); có thể ẩn Rep */
  const tableColSpan = hideRepColumn ? 15 : 16;

  const tierBtnMuted = (t: StoreTierConfig) =>
    t.statCardClass.includes('text-white')
      ? 'bg-white/10 hover:bg-white/20 text-inherit'
      : 'bg-black/5 hover:bg-black/10 text-inherit';

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#f9f9f8] dark:bg-[#1a1f1e] text-[#191c1c] dark:text-slate-100 pb-32 font-sans antialiased">
      <header className="sticky top-0 z-30 flex items-center gap-2 px-4 sm:px-6 lg:px-8 h-14 w-full min-w-0 bg-[#f9f9f8]/95 dark:bg-stone-900/95 backdrop-blur border-b border-[#c0c9c3]/20">
        <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-[#003629] dark:text-[#8abda9] truncate min-w-0 flex-1">
          CT Trưng Bày 2026{isAdmin ? ' · Admin' : ''}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadTbq2Data('refresh')}
            disabled={loading || refreshing}
            className="px-2.5 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-800 text-[#003629] dark:text-[#8abda9] border border-[#c0c9c3]/50 dark:border-slate-600 hover:bg-[#edeeed] dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all"
            title="Tải lại DANGKYTBQ2 & ngân sách Rep"
          >
            {refreshing ? 'Đang tải…' : 'Làm mới'}
          </button>
          <button
            type="button"
            onClick={() => setRepTierStatsOpen(true)}
            disabled={loading}
            className="px-2.5 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold bg-emerald-700/90 text-white dark:bg-emerald-600/90 border border-emerald-800/30 dark:border-emerald-400/30 hover:bg-emerald-800 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all"
            title="Số lượng đăng ký theo từng Tier, chia theo Rep (dữ liệu đang xem)"
          >
            Bảng theo Rep
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setRepBudgetChartOpen(true)}
              className="px-2.5 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold bg-violet-600/90 text-white dark:bg-violet-500/90 dark:text-white border border-violet-700/30 dark:border-violet-400/30 hover:bg-violet-700 dark:hover:bg-violet-500 active:scale-[0.98] transition-all"
              title="Biểu đồ % ngân sách đã sử dụng theo từng Rep (chỉ admin)"
            >
              Biểu đồ NS
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setImagePreviewModal({
                title: 'Tiêu chí chương trình',
                url: DISPLAY_TBQ2_CRITERIA_IMAGE_URL,
                alt: 'Tiêu chí chương trình trưng bày Q2/2026',
              })
            }
            className="px-2.5 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold bg-[#003629]/10 text-[#003629] dark:bg-[#8abda9]/15 dark:text-[#8abda9] border border-[#003629]/20 dark:border-[#8abda9]/30 hover:bg-[#003629]/15 dark:hover:bg-[#8abda9]/25 active:scale-[0.98] transition-all"
          >
            Tiêu chí
          </button>
          <div
            className="w-8 h-8 rounded-full bg-[#e1e3e2] dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-[#003629] dark:text-[#8abda9] border border-black/5"
            title={currentEmployee.name}
          >
            {currentEmployee.name
              .split(/\s+/)
              .slice(-2)
              .map(w => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
        </div>
      </header>

      <main className="w-full min-w-0 max-w-full pt-4 px-4 sm:px-6 lg:px-8 xl:px-10 space-y-8">
        {loading && <p className="text-sm text-center text-slate-500 py-8">Đang tải dữ liệu sheet…</p>}
        {loadError && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-100">
            {loadError}
          </div>
        )}

        {!loading && (
          <>
            <section>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#003629] dark:text-[#8abda9] tracking-tighter leading-none">
                Chương trình trưng bày Q2/2026
              </h2>
            </section>

            <section className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 min-w-0">
              <p className="text-[10px] text-[#404945] dark:text-slate-500 mb-2 md:hidden">
                Vuốt ngang để xem tổng Sale Q2 và các tier.
              </p>
              <div className="tbq2-scroll-x flex flex-nowrap gap-3 sm:gap-4 pb-2 -mb-1 items-stretch w-full min-w-0">
              <div className="flex-shrink-0 w-[min(100%,18rem)] max-w-[20rem] p-3 sm:p-4 rounded-xl bg-[#003629] text-white relative overflow-hidden border border-white/10 shadow-lg">
                <div className="relative z-10 min-w-0">
                  <div className="mb-2 min-w-0">
                    <p className="text-[9px] font-bold tracking-widest opacity-80 leading-tight">
                      {saleQ2SummaryCard.title}
                    </p>
                    <p className="text-[8px] font-semibold opacity-70 mt-0.5 tabular-nums leading-tight">
                      {saleQ2SummaryCard.caption}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 min-w-0">
                    <span className="font-extrabold text-[11px] sm:text-xs tabular-nums tracking-tight leading-snug break-words min-w-0 flex-1">
                      {formatVndDong(saleQ2SummaryCard.total)}
                    </span>
                    <span className="text-[9px] font-semibold bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10 shrink-0">
                      VNĐ
                    </span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
              </div>

              <div className="flex gap-3">
                {STORE_TIER_CONFIGS.map(t => {
                  const s = statsByTier[t.label] || { count: 0, saleQ2Sum: 0 };
                  const selected = tierRegisteredFilter === t.id;
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTierRegisteredFilter(prev => (prev === t.id ? null : t.id))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setTierRegisteredFilter(prev => (prev === t.id ? null : t.id));
                        }
                      }}
                      className={`flex-shrink-0 w-[8.75rem] sm:w-36 p-3 sm:p-4 rounded-xl border flex flex-col justify-between relative outline-none transition-shadow ${t.statCardClass} cursor-pointer hover:opacity-95 ${
                        selected
                          ? 'ring-2 ring-[#003629] dark:ring-[#8abda9] ring-offset-2 ring-offset-[#f9f9f8] dark:ring-offset-[#1a1f1e]'
                          : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-tight opacity-80 leading-tight">{t.label}</span>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setImagePreviewModal({
                              title: `Mẫu POSM — ${t.label}`,
                              url: t.samplePosmImageUrl,
                              alt: `Mẫu trưng bày ${t.label}`,
                            });
                          }}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${tierBtnMuted(t)}`}
                        >
                          Mẫu
                        </button>
                      </div>
                      <div className="mt-2">
                        <span className="font-extrabold text-2xl block">{String(s.count).padStart(2, '0')}</span>
                        <span className="text-[10px] opacity-70 font-medium tabular-nums leading-tight">
                          Tổng Sale Q2: {formatVndDong(s.saleQ2Sum)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              <p className="text-[10px] text-[#404945] dark:text-slate-500 mt-2">
                Bấm thẻ tier để lọc KH đã đăng ký theo cột FinalStoreTypeQ2; bấm lại thẻ đang chọn để bỏ lọc.
              </p>
            </section>

            <section className="space-y-4 min-w-0">
              {tierRegisteredFilter && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#003629]/10 text-[#003629] dark:bg-[#8abda9]/15 dark:text-[#8abda9] font-bold">
                    Q2 đăng ký: {STORE_TIER_CONFIGS.find(x => x.id === tierRegisteredFilter)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTierRegisteredFilter(null)}
                    className="text-[11px] font-bold underline text-slate-600 dark:text-slate-400"
                  >
                    Xóa lọc Q2
                  </button>
                </div>
              )}
              <p className="text-[10px] text-[#404945] dark:text-slate-500 -mt-2 md:hidden">
                Vuốt ngang / dọc trong bảng khi màn hình nhỏ.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#003629] dark:text-[#8abda9] uppercase tracking-wider ml-1">
                  Tìm kiếm khách hàng
                </label>
                <div className="relative">
                  <input
                    className="w-full h-12 pl-4 pr-4 bg-white dark:bg-slate-800 border rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-[#003629]/20 dark:focus:ring-[#8abda9]/30 outline-none border-[#c0c9c3]/30 font-medium dark:text-white"
                    placeholder="Nhập tên hoặc mã khách hàng..."
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-[#c0c9c3]/20 min-w-0">
                <div className="tbq2-scroll-xy max-h-[min(52vh,22rem)] sm:max-h-[280px] md:max-h-[320px]">
                  <table className="tbq2-sticky-table w-full text-left text-xs min-w-[1700px] sm:min-w-[1800px]">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-[#2d3b36] dark:text-slate-200 border-b border-[#c0c9c3]/40 dark:border-slate-600">
                        <th className="sticky left-0 z-[2] py-3 px-2 min-w-[7rem] bg-sky-100/95 dark:bg-sky-950/95 backdrop-blur border-r border-sky-200/60 dark:border-sky-800/50 shadow-[2px_0_0_rgba(0,0,0,0.03)] dark:shadow-[2px_0_0_rgba(0,0,0,0.2)]">
                          CustomerCode
                        </th>
                        <th className="sticky left-[7rem] z-[2] py-3 px-2 min-w-[5.5rem] bg-sky-100/95 dark:bg-sky-950/95 backdrop-blur border-r border-sky-200/60 dark:border-sky-800/50 shadow-[2px_0_0_rgba(0,0,0,0.03)]">
                          Code BM
                        </th>
                        <th className="sticky left-[12.5rem] z-[2] py-3 px-2 min-w-[12rem] max-w-[min(18rem,32vw)] bg-sky-100/95 dark:bg-sky-950/95 backdrop-blur border-r border-sky-200/60 dark:border-sky-800/50 shadow-[2px_0_0_rgba(0,0,0,0.03)] dark:shadow-[2px_0_0_rgba(0,0,0,0.2)]">
                          CustomerName
                        </th>
                        <th className="py-3 px-2 min-w-[6rem] bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40">
                          District
                        </th>
                        <th className="py-3 px-2 min-w-[6.5rem] bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40 whitespace-nowrap">
                          SDT
                        </th>
                        {!hideRepColumn && (
                          <th className="py-3 px-2 min-w-[6rem] bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40">
                            Rep
                          </th>
                        )}
                        <th className="py-3 px-2 min-w-[5.5rem] bg-violet-100/88 dark:bg-violet-950/42 border-r border-violet-200/50 dark:border-violet-900/40 leading-tight">
                          FinalStoreTypeQ2
                        </th>
                        <th className="py-3 px-1.5 text-center min-w-[4.25rem] bg-amber-50/90 dark:bg-amber-950/30 border-r border-amber-200/50 dark:border-amber-900/35">
                          Frame OTC
                        </th>
                        <th className="py-3 px-1.5 text-center min-w-[4.25rem] bg-amber-50/90 dark:bg-amber-950/30 border-r border-amber-200/50 dark:border-amber-900/35">
                          Frame FS
                        </th>
                        <th className="py-3 px-1.5 text-center min-w-[4.25rem] bg-amber-50/90 dark:bg-amber-950/30 border-r border-amber-200/50 dark:border-amber-900/35">
                          Topboard
                        </th>
                        <th className="py-3 px-1.5 text-center min-w-[4.5rem] bg-amber-50/90 dark:bg-amber-950/30 border-r border-amber-200/50 dark:border-amber-900/35 leading-tight">
                          Front Counter
                        </th>
                        <th className="py-3 px-1.5 text-center min-w-[4.5rem] bg-amber-50/90 dark:bg-amber-950/30 border-r border-amber-200/50 dark:border-amber-900/35 leading-tight">
                          Countertop
                        </th>
                        <th
                          className="py-3 px-2 text-right tabular-nums min-w-[6rem] bg-red-100/90 dark:bg-red-950/45 border-r border-red-200/60 dark:border-red-900/45 text-red-950 dark:text-red-100"
                          title="Ưu tiên cột Sale T4 trên DANGKYTBQ2; ô trống thì MustWin+Other (DOANH_SO)"
                        >
                          Sale T4
                        </th>
                        <th className="py-3 px-2 text-right tabular-nums min-w-[5.5rem] bg-orange-50/90 dark:bg-orange-950/35 border-r border-orange-200/50 dark:border-orange-900/35">
                          Sale T5
                        </th>
                        <th className="py-3 px-2 text-right tabular-nums min-w-[5.5rem] bg-orange-50/90 dark:bg-orange-950/35 border-r border-orange-200/50 dark:border-orange-900/35">
                          Sale T6
                        </th>
                        <th className="py-3 px-2 text-right tabular-nums min-w-[5.5rem] bg-orange-50/90 dark:bg-orange-950/35 border-r border-orange-200/50 dark:border-orange-900/35">
                          Sale Q2
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c0c9c3]/20 dark:divide-slate-600/40">
                      {filteredTableRows.length === 0 ? (
                        <tr>
                          <td colSpan={tableColSpan} className="py-8 text-center text-slate-400 italic bg-slate-50/80 dark:bg-slate-800/60">
                            {myRows.length === 0
                              ? isAdmin
                                ? 'Không có dữ liệu khách hàng.'
                                : 'Không có dữ liệu khách hàng hoặc chưa khớp Rep.'
                              : 'Không có dòng nào khớp tìm kiếm / lọc tier.'}
                          </td>
                        </tr>
                      ) : (
                        filteredTableRows.map((row, idx) => {
                          const posm = (v: string) => (v.trim() ? v : '—');
                          const tc = tierTableRowClassesForRow(row);
                          const base = `py-2.5 px-2 text-[10px] ${TB_CELL_BR}`;
                          return (
                            <tr
                              key={row.customerCode || `row-${idx}`}
                              className={`group/row transition-colors ${tc.tr}`}
                            >
                              <td
                                className={`sticky left-0 z-[1] ${base} font-mono font-semibold text-[10px] ${tc.sticky} ${tc.stickyHover} backdrop-blur shadow-[2px_0_0_rgba(0,0,0,0.03)] min-w-[7rem] max-w-[7rem] truncate whitespace-nowrap`}
                                title={row.customerCode || undefined}
                              >
                                {row.customerCode || '—'}
                              </td>
                              <td
                                className={`sticky left-[7rem] z-[1] ${base} font-mono text-[10px] ${tc.sticky} ${tc.stickyHover} backdrop-blur min-w-[5.5rem] max-w-[5.5rem] truncate whitespace-nowrap`}
                                title={row.codeBm || undefined}
                              >
                                {row.codeBm || '—'}
                              </td>
                              <td
                                className={`sticky left-[12.5rem] z-[1] ${base} ${tc.sticky} ${tc.stickyHover} backdrop-blur min-w-[12rem] max-w-[min(18rem,32vw)]`}
                              >
                                <span className="font-bold text-[13px] sm:text-sm leading-snug text-[#003629] dark:text-[#8abda9] break-words block">
                                  {row.customerName || '—'}
                                </span>
                              </td>
                              <td className={`${base} ${tc.cell} ${tc.cellHover} break-words`}>{row.district || '—'}</td>
                              <td className={`${base} ${tc.cell} ${tc.cellHover} tabular-nums whitespace-nowrap`}>
                                {row.sdt || '—'}
                              </td>
                              {!hideRepColumn && (
                                <td className={`${base} ${tc.cell} ${tc.cellHover} break-words`}>{row.rep || '—'}</td>
                              )}
                              <td
                                className={`${base} text-[9px] leading-tight ${tc.ftq2} ${tc.ftq2Hover} break-words`}
                              >
                                {row.finalStoreTypeQ2 || '—'}
                              </td>
                              <td className={`${base} text-center text-[9px] ${tc.posm} ${tc.posmHover}`}>
                                {posm(row.frameOtc)}
                              </td>
                              <td className={`${base} text-center text-[9px] ${tc.posm} ${tc.posmHover}`}>
                                {posm(row.frameFs)}
                              </td>
                              <td className={`${base} text-center text-[9px] ${tc.posm} ${tc.posmHover}`}>
                                {posm(row.topboard)}
                              </td>
                              <td className={`${base} text-center text-[9px] ${tc.posm} ${tc.posmHover}`}>
                                {posm(row.frontCounter)}
                              </td>
                              <td className={`${base} text-center text-[9px] ${tc.posm} ${tc.posmHover}`}>
                                {posm(row.countertop)}
                              </td>
                              <td
                                className={`${base} text-right font-semibold tabular-nums ${tc.saleT4} ${tc.saleT4Hover} text-red-900 dark:text-red-100`}
                                title={
                                  row.saleT4.trim()
                                    ? 'Từ sheet DANGKYTBQ2'
                                    : 'Bổ sung từ DOANH_SO (MustWin+Other) khi ô sheet trống'
                                }
                              >
                                {displaySaleT4Cell(row, saleT4ByCustomerCode)}
                              </td>
                              <td
                                className={`${base} text-right tabular-nums ${tc.saleTn} ${tc.saleTnHover}`}
                              >
                                {formatSheetSaleQ1Display(row.saleT5)}
                              </td>
                              <td
                                className={`${base} text-right tabular-nums ${tc.saleTn} ${tc.saleTnHover}`}
                              >
                                {formatSheetSaleQ1Display(row.saleT6)}
                              </td>
                              <td
                                className={`${base} text-right tabular-nums ${tc.saleTn} ${tc.saleTnHover}`}
                              >
                                {formatSheetSaleQ1Display(row.saleQ2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </>
        )}
      </main>

      {repTierStatsOpen && (
        <div
          className="fixed inset-0 z-[102] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Thống kê đăng ký Tier theo Rep"
          onClick={() => setRepTierStatsOpen(false)}
        >
          <div
            className="relative w-full max-w-[min(100%,72rem)] max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-emerald-200/60 dark:border-emerald-900/50 bg-[#f9f9f8] dark:bg-slate-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#c0c9c3]/25 dark:border-slate-600 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#003629] dark:text-[#8abda9]">
                  Thống kê đăng ký theo Rep — số lượng theo Tier
                </p>
                <p className="text-[10px] text-[#404945] dark:text-slate-500 mt-1">
                  Chỉ tính KH đã đăng ký và có Tier (FinalStoreTypeQ2 khớp bảng).{' '}
                  {isAdmin ? 'Toàn bộ Rep.' : 'Phạm vi Rep của bạn.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRepTierStatsOpen(false)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028]"
              >
                Đóng
              </button>
            </div>
            <div className="overflow-x-auto tbq2-scroll-xy flex-1 p-4 sm:p-5">
              {repTierRegistrationRows.length === 0 ? (
                <p className="text-sm text-center text-slate-500 py-10">
                  Chưa có đăng ký Tier nào trong phạm vi dữ liệu hiện tại.
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-left border-collapse text-[11px] sm:text-xs">
                  <thead>
                    <tr className="border-b border-[#c0c9c3]/40 dark:border-slate-600">
                      <th className="sticky left-0 z-[1] bg-[#f9f9f8] dark:bg-slate-900 py-2 pr-3 font-black text-[#003629] dark:text-[#8abda9] whitespace-nowrap">
                        Rep
                      </th>
                      {STORE_TIER_CONFIGS.map(t => (
                        <th
                          key={t.id}
                          className="py-2 px-1.5 sm:px-2 text-center font-bold text-[#404945] dark:text-slate-400 whitespace-nowrap"
                          title={t.label}
                        >
                          {TIER_TABLE_SHORT[t.id]}
                        </th>
                      ))}
                      <th className="py-2 pl-2 text-center font-black text-[#003629] dark:text-[#8abda9] whitespace-nowrap">
                        Tổng
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {repTierRegistrationRows.map(row => (
                      <tr
                        key={row.repLabel}
                        className="border-b border-[#c0c9c3]/20 dark:border-slate-700/80 hover:bg-[#edeeed]/80 dark:hover:bg-slate-800/60"
                      >
                        <td className="sticky left-0 z-[1] bg-[#f9f9f8]/95 dark:bg-slate-900/95 backdrop-blur py-2 pr-3 font-semibold text-[#191c1c] dark:text-slate-100 max-w-[12rem]">
                          <span className="line-clamp-2 break-words">{row.repLabel}</span>
                        </td>
                        {STORE_TIER_CONFIGS.map(t => (
                          <td key={t.id} className="py-2 px-1.5 sm:px-2 text-center tabular-nums text-[#191c1c] dark:text-slate-200">
                            {row.byTier[t.id] > 0 ? row.byTier[t.id] : '—'}
                          </td>
                        ))}
                        <td className="py-2 pl-2 text-center font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#003629]/25 dark:border-[#8abda9]/30 bg-[#003629]/[0.06] dark:bg-slate-800/80">
                      <td className="sticky left-0 z-[1] py-2.5 pr-3 font-black text-[#003629] dark:text-[#8abda9]">
                        Tổng cộng
                      </td>
                      {STORE_TIER_CONFIGS.map(t => (
                        <td
                          key={t.id}
                          className="py-2.5 px-1.5 sm:px-2 text-center font-bold tabular-nums text-[#003629] dark:text-[#8abda9]"
                        >
                          {repTierColumnTotals.byTier[t.id] > 0 ? repTierColumnTotals.byTier[t.id] : '—'}
                        </td>
                      ))}
                      <td className="py-2.5 pl-2 text-center font-black tabular-nums text-emerald-800 dark:text-emerald-300">
                        {repTierColumnTotals.grand}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdmin && repBudgetChartOpen && (
        <div
          className="fixed inset-0 z-[102] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Biểu đồ ngân sách đã sử dụng theo Rep"
          onClick={() => setRepBudgetChartOpen(false)}
        >
          <div
            className="relative w-full max-w-[min(100%,56rem)] max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-violet-200/50 dark:border-violet-900/50 bg-[#f9f9f8] dark:bg-slate-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#c0c9c3]/25 dark:border-slate-600 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#003629] dark:text-[#8abda9]">% Ngân sách đã sử dụng theo Rep</p>
              </div>
              <button
                type="button"
                onClick={() => setRepBudgetChartOpen(false)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028]"
              >
                Đóng
              </button>
            </div>
            <div className="overflow-x-auto tbq2-scroll-xy flex-1 p-4 sm:p-5">
              {repBudgetUsedPctSeries.length === 0 ? (
                <p className="text-sm text-center text-slate-500 py-10">Chưa có dòng Rep nào trên sheet ngân sách.</p>
              ) : (
                <div className="flex flex-col gap-4 min-w-0">
                  <div className="flex flex-nowrap items-end gap-2 sm:gap-3 pb-2 border-b border-[#c0c9c3]/30 dark:border-slate-600 overflow-x-auto">
                    {repBudgetUsedPctSeries.map(p => (
                      <div
                        key={p.rep}
                        className="flex flex-col items-center gap-1 shrink-0 w-[3.25rem] sm:w-16"
                        title={`${p.rep}: đã dùng ${formatVndDong(p.used)} / ${formatVndDong(p.budget)} (${p.usedPct}%)`}
                      >
                        <span className="text-[9px] sm:text-[10px] font-bold tabular-nums text-[#003629] dark:text-[#8abda9]">
                          {p.usedPct}%
                        </span>
                        <div className="h-40 w-full flex flex-col justify-end rounded-t-md bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                          <div
                            className="w-full min-h-0 rounded-t-md bg-gradient-to-t from-[#1b4d3e] to-[#9ed1bd] dark:from-[#003629] dark:to-[#8abda9]"
                            style={{ height: `${p.usedPct}%` }}
                          />
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-semibold text-center text-[#404945] dark:text-slate-400 leading-tight line-clamp-3 w-full break-words">
                          {p.rep}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#404945] dark:text-slate-500">
                    Di chuyển ngang nếu nhiều Rep. Budget = 0 hiển thị 0% đã dùng.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {imagePreviewModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={imagePreviewModal.title}
          onClick={() => setImagePreviewModal(null)}
        >
          <div
            className="relative max-w-[min(100%,48rem)] w-full max-h-[90vh] flex flex-col rounded-2xl bg-[#f9f9f8] dark:bg-slate-900 shadow-2xl border border-[#c0c9c3]/30 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#c0c9c3]/25 dark:border-slate-600 shrink-0">
              <p className="text-sm font-bold text-[#003629] dark:text-[#8abda9] truncate min-w-0">
                {imagePreviewModal.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={imagePreviewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#003629] dark:text-[#8abda9] underline"
                >
                  Mở ảnh
                </a>
                <button
                  type="button"
                  onClick={() => setImagePreviewModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028]"
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="overflow-auto tbq2-scroll-xy p-3 sm:p-4 flex justify-center bg-[#edeeed]/50 dark:bg-slate-800/50">
              <img
                src={imagePreviewModal.url}
                alt={imagePreviewModal.alt}
                className="max-w-full max-h-[min(75vh,720px)] w-auto h-auto object-contain rounded-lg"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProgramRegistrationTab;
