import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Customer, Employee } from '../types';
import { formatCurrency, formatVndDong } from '../utils/formatters';
import {
  normalizeDangKyTbq2Row,
  isRegisteredRow,
  formatShortVnd,
  repMatchesEmployee,
  isPheDuyetApproved,
} from '../utils/displayTbq2Sheet';
import { fetchDataFromSheet, submitDisplayTBQ2Registration, submitDisplayTBQ2Approval } from '../services/googleSheetService';
import { SHEET_DANGKYTBQ2, SHEET_REP_BUDGET_TBQ2 } from '../constants';

/** Ảnh tiêu chí tham gia / phân hạng CT trưng bày */
export const DISPLAY_TBQ2_CRITERIA_IMAGE_URL = 'https://i.postimg.cc/Cxs6WRtg/tieu-chi.png';

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

function tierById(id: StoreTierId | null): StoreTierConfig | null {
  if (!id) return null;
  return STORE_TIER_CONFIGS.find(t => t.id === id) ?? null;
}

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

/** Trong state `finalStoreTypeQ1Filter`: chỉ hiện KH có cột FinalStoreTypeQ1 khác rỗng */
const Q1_FILTER_NON_EMPTY = '__Q1_NON_EMPTY__';

function validatePosm(
  tier: StoreTierConfig,
  choiceSingle: PosmLabel | null,
  choiceMulti: Set<PosmLabel>
): { ok: boolean; message: string | null } {
  if (tier.choiceMode === 'none') return { ok: true, message: null };
  if (tier.choiceMode === 'single') {
    if (!tier.choicePool?.length) return { ok: false, message: 'Thiếu cấu hình POSM lựa chọn.' };
    if (!choiceSingle || !tier.choicePool.includes(choiceSingle)) {
      return { ok: false, message: `Chọn đúng 1 trong: ${tier.choicePool.join(', ')}.` };
    }
    return { ok: true, message: null };
  }
  if (tier.choiceMode === 'exact2') {
    if (!tier.choicePool?.length) return { ok: false, message: 'Thiếu cấu hình POSM lựa chọn.' };
    const picked = [...choiceMulti].filter(p => tier.choicePool!.includes(p));
    if (picked.length !== tier.choiceRequired) {
      return {
        ok: false,
        message: `Chọn đúng ${tier.choiceRequired} mục: ${tier.choicePool.join(', ')} (đã chọn ${picked.length}).`,
      };
    }
    return { ok: true, message: null };
  }
  return { ok: true, message: null };
}

function getSelectedPosmLabels(
  tierCfg: StoreTierConfig,
  choiceSingle: PosmLabel | null,
  choiceMulti: Set<PosmLabel>
): PosmLabel[] {
  const list: PosmLabel[] = [...tierCfg.mandatoryPosm];
  if (tierCfg.choiceMode === 'single' && choiceSingle) list.push(choiceSingle);
  if (tierCfg.choiceMode === 'exact2')
    list.push(...[...choiceMulti].filter(p => tierCfg.choicePool?.includes(p)));
  return list;
}

/** SDT VN: chỉ số, 9–12 chữ số sau khi bỏ ký tự thừa */
function isValidVnPhoneInput(s: string): boolean {
  const d = s.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 12;
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

function parseRepBudgetFromRows(rows: Record<string, unknown>[], employeeName: string) {
  for (const raw of rows) {
    const rep = pickBudgetCell(raw, ['Rep', 'REP']);
    if (!repMatchesEmployee(rep, employeeName)) continue;
    const budget = Number(pickBudgetCell(raw, ['Budget', 'Ngân sách'])) || 0;
    const used = Number(pickBudgetCell(raw, ['Đã Sử dụng', 'DaSuDung', 'Da su dung'])) || 0;
    const leftRaw = pickBudgetCell(raw, ['Còn lại', 'ConLai', 'Con lai']);
    const left = leftRaw !== '' ? Number(leftRaw) : budget - used;
    return { rep, budget, used, left: Number.isFinite(left) ? left : budget - used };
  }
  return { rep: employeeName, budget: 0, used: 0, left: 0 };
}

/** Cộng dồn mọi dòng có Rep trên REP_BUDGET_TBQ2 — dùng cho admin xem tổng toàn công ty */
function sumAllRepBudgetRows(rows: Record<string, unknown>[]) {
  let budget = 0;
  let used = 0;
  let leftSum = 0;
  let rowCount = 0;
  for (const raw of rows) {
    const rep = pickBudgetCell(raw, ['Rep', 'REP']);
    if (!rep.trim()) continue;
    rowCount += 1;
    const b = Number(pickBudgetCell(raw, ['Budget', 'Ngân sách'])) || 0;
    const u = Number(pickBudgetCell(raw, ['Đã Sử dụng', 'DaSuDung', 'Da su dung'])) || 0;
    const leftRaw = pickBudgetCell(raw, ['Còn lại', 'ConLai', 'Con lai']);
    const l = leftRaw !== '' ? Number(leftRaw) : b - u;
    budget += b;
    used += u;
    leftSum += Number.isFinite(l) ? l : b - u;
  }
  return { budget, used, left: leftSum, rowCount };
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerCode, setSelectedCustomerCode] = useState('');
  const [storeTierId, setStoreTierId] = useState<StoreTierId | ''>('');
  const [choiceSingle, setChoiceSingle] = useState<PosmLabel | null>(null);
  const [choiceMulti, setChoiceMulti] = useState<Set<PosmLabel>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [imagePreviewModal, setImagePreviewModal] = useState<{
    title: string;
    url: string;
    alt: string;
  } | null>(null);
  /** Bấm thẻ tier: lọc KH đã đăng ký theo giá trị cột FinalStoreTypeQ2 */
  const [tierRegisteredFilter, setTierRegisteredFilter] = useState<StoreTierId | null>(null);
  /** Lọc theo FinalStoreTypeQ1: null = tất cả; Q1_FILTER_NON_EMPTY = có dữ liệu cột; hoặc chuỗi khớp chính xác */
  const [finalStoreTypeQ1Filter, setFinalStoreTypeQ1Filter] = useState<string | null>(null);
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  /** KH chọn qua ô tìm trên sheet (cùng nguồn DANGKYTBQ2, có thể trùng dropdown) */
  const [supplementaryPick, setSupplementaryPick] = useState<Customer | null>(null);
  /** 1: KH → 2: Tier & POSM → 3: Xác nhận / Hủy → 4: SDT & Submit */
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [confirmSdt, setConfirmSdt] = useState('');

  const tier = useMemo(() => tierById(storeTierId || null), [storeTierId]);

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

  const repBudget = useMemo(
    () => parseRepBudgetFromRows(budgetRows, currentEmployee.name),
    [budgetRows, currentEmployee.name]
  );

  const adminBudgetAggregate = useMemo(
    () => (isAdmin ? sumAllRepBudgetRows(budgetRows) : null),
    [isAdmin, budgetRows]
  );

  const budgetCard = useMemo(() => {
    if (isAdmin && adminBudgetAggregate) {
      return {
        budget: adminBudgetAggregate.budget,
        used: adminBudgetAggregate.used,
        left: adminBudgetAggregate.left,
        title: 'NGÂN SÁCH (TẤT CẢ NV)',
        caption: `${adminBudgetAggregate.rowCount} dòng trên sheet ngân sách`,
      };
    }
    return {
      budget: repBudget.budget,
      used: repBudget.used,
      left: repBudget.left,
      title: 'NGÂN SÁCH (REP)',
      caption: null as string | null,
    };
  }, [isAdmin, adminBudgetAggregate, repBudget]);

  const statsByTier = useMemo(() => {
    const m: Record<string, { count: number; used: number }> = {};
    STORE_TIER_CONFIGS.forEach(t => {
      m[t.label] = { count: 0, used: 0 };
    });
    myRows.forEach(r => {
      if (!isRegisteredRow(r)) return;
      const cfg = findTierConfigByFinalStoreTypeQ2(r.finalStoreTypeQ2);
      if (!cfg) return;
      m[cfg.label].count += 1;
      m[cfg.label].used += cfg.reward;
    });
    return m;
  }, [myRows]);

  const distinctFinalStoreTypeQ1Values = useMemo(() => {
    const s = new Set<string>();
    for (const r of myRows) {
      const v = r.finalStoreTypeQ1.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [myRows]);

  const filteredTableRows = useMemo(() => {
    let rows = myRows;
    if (tierRegisteredFilter) {
      rows = rows.filter(r => {
        if (!isRegisteredRow(r)) return false;
        const cfg = findTierConfigByFinalStoreTypeQ2(r.finalStoreTypeQ2);
        return cfg?.id === tierRegisteredFilter;
      });
    }
    if (finalStoreTypeQ1Filter !== null) {
      if (finalStoreTypeQ1Filter === Q1_FILTER_NON_EMPTY) {
        rows = rows.filter(r => r.finalStoreTypeQ1.trim() !== '');
      } else {
        rows = rows.filter(r => r.finalStoreTypeQ1.trim() === finalStoreTypeQ1Filter);
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerCode.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q) ||
        r.sdt.includes(q) ||
        r.finalStoreTypeQ1.toLowerCase().includes(q) ||
        r.saleQ1.toLowerCase().includes(q) ||
        r.finalStoreTypeQ2.toLowerCase().includes(q) ||
        r.rep.toLowerCase().includes(q)
    );
  }, [myRows, searchQuery, tierRegisteredFilter, finalStoreTypeQ1Filter]);

  const assignableCustomers = useMemo(
    () => myRows.filter(r => r.customerCode && !isRegisteredRow(r)),
    [myRows]
  );

  /** Tìm KH chưa đăng ký Q2 trực tiếp trong dữ liệu sheet DANGKYTBQ2 (đã fetch) */
  const masterSearchMatches = useMemo(() => {
    const q = masterSearchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set<string>();
    const out: Customer[] = [];
    for (const r of normalizedRows) {
      const code = r.customerCode.trim();
      if (!code || seen.has(code)) continue;
      if (isRegisteredRow(r)) continue;
      if (!isAdmin && !repMatchesEmployee(r.rep, currentEmployee.name)) continue;
      const name = r.customerName.toLowerCase();
      const district = r.district.toLowerCase();
      const sdt = r.sdt.replace(/\D/g, '');
      const qDigits = q.replace(/\D/g, '');
      const matchText =
        code.toLowerCase().includes(q) ||
        name.includes(q) ||
        district.includes(q) ||
        r.finalStoreTypeQ1.toLowerCase().includes(q) ||
        r.saleQ1.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && sdt.includes(qDigits));
      if (!matchText) continue;
      seen.add(code);
      out.push({
        code,
        name: r.customerName || code,
        address: r.district.trim() || undefined,
        rep: r.rep.trim() || undefined,
      });
      if (out.length >= 20) break;
    }
    return out;
  }, [normalizedRows, masterSearchQuery, isAdmin, currentEmployee.name]);

  const selectedRow = useMemo(
    () => myRows.find(r => r.customerCode === selectedCustomerCode) ?? null,
    [myRows, selectedCustomerCode]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [dk, bud] = await Promise.all([
          fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2),
          fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_REP_BUDGET_TBQ2),
        ]);
        if (cancelled) return;
        setSheetRows(dk);
        setBudgetRows(bud);
        if (dk.length === 0) {
          setLoadError(
            `Không có dữ liệu sheet ${SHEET_DANGKYTBQ2}. Tạo sheet, import mẫu DANGKYTBQ2.xlsx và deploy Apps Script có doGet.`
          );
        }
      } catch {
        if (!cancelled) setLoadError('Không tải được dữ liệu. Kiểm tra sheet và URL Script.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptUrl]);

  useEffect(() => {
    setChoiceSingle(null);
    setChoiceMulti(new Set());
    setSubmitAttempted(false);
    setSubmitMessage(null);
  }, [storeTierId]);

  useEffect(() => {
    if (!selectedCustomerCode) return;
    const inAssignable = assignableCustomers.some(c => c.customerCode === selectedCustomerCode);
    const inSupplementary = supplementaryPick?.code === selectedCustomerCode;
    if (!inAssignable && !inSupplementary) setSelectedCustomerCode('');
  }, [assignableCustomers, selectedCustomerCode, supplementaryPick]);

  useEffect(() => {
    if (!imagePreviewModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagePreviewModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePreviewModal]);

  const posmValidation = useMemo(() => {
    if (!tier) return { ok: false, message: null as string | null };
    return validatePosm(tier, choiceSingle, choiceMulti);
  }, [tier, choiceSingle, choiceMulti]);

  const customerOk =
    selectedCustomerCode !== '' &&
    ((!!selectedRow && !isRegisteredRow(selectedRow) && !supplementaryPick) ||
      (!!supplementaryPick && supplementaryPick.code === selectedCustomerCode));
  const tierOk = storeTierId !== '';
  const posmOk = tier ? posmValidation.ok : false;
  const sdtOk = isValidVnPhoneInput(confirmSdt);
  const canSubmitFinal =
    wizardStep === 4 && customerOk && tierOk && posmOk && sdtOk && !submitBusy;

  const displayRegCode =
    supplementaryPick?.code?.trim() || selectedRow?.customerCode || selectedCustomerCode;
  const displayRegName =
    (supplementaryPick?.name || selectedRow?.customerName || '').trim() || '—';

  useEffect(() => {
    setWizardStep(1);
    setConfirmSdt('');
    setStoreTierId('');
    setChoiceSingle(null);
    setChoiceMulti(new Set());
    setSubmitAttempted(false);
  }, [selectedCustomerCode]);

  useEffect(() => {
    if (wizardStep !== 4) return;
    setConfirmSdt(prev => {
      if (prev.replace(/\D/g, '').length >= 9) return prev;
      const fromRow = selectedRow?.sdt?.trim();
      return fromRow || prev;
    });
  }, [wizardStep, selectedRow]);

  const handleWizardCancel = useCallback(() => {
    setWizardStep(1);
    setStoreTierId('');
    setChoiceSingle(null);
    setChoiceMulti(new Set());
    setConfirmSdt('');
    setSubmitAttempted(false);
    setSubmitMessage(null);
  }, []);

  const buildPosmFlagsJson = useCallback(() => {
    if (!tier) return '{}';
    const labels = getSelectedPosmLabels(tier, choiceSingle, choiceMulti);
    return JSON.stringify(Object.fromEntries(labels.map(l => [l, 1])));
  }, [tier, choiceSingle, choiceMulti]);

  const selectedPosmLabelsForRecap = useMemo(
    () => (tier ? getSelectedPosmLabels(tier, choiceSingle, choiceMulti) : []),
    [tier, choiceSingle, choiceMulti]
  );

  const toggleBronze = useCallback(
    (label: PosmLabel) => {
      if (!tier || tier.choiceMode !== 'exact2' || !tier.choicePool) return;
      setChoiceMulti(prev => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else if (next.size < tier.choiceRequired) next.add(label);
        return next;
      });
    },
    [tier]
  );

  const budgetPct =
    budgetCard.budget > 0 ? Math.min(100, Math.round((budgetCard.used / budgetCard.budget) * 100)) : 0;

  const tableColSpan = isAdmin ? 11 : 10;

  const handleApproveRow = async (e: React.MouseEvent, customerCode: string) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setApprovingCode(customerCode);
    let res = await submitDisplayTBQ2Approval(scriptUrl, {
      employeeCode: currentEmployee.code,
      employeeName: currentEmployee.name,
      customerCode,
    });
    if (res.status !== 'success' && /missing sheet parameter/i.test(res.message || '')) {
      const dk = await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2);
      const row = dk
        .map(r => normalizeDangKyTbq2Row(r))
        .find(r => r.customerCode.trim() === customerCode.trim());
      if (row && isPheDuyetApproved(row)) res = { status: 'success' };
    }
    setApprovingCode(null);
    if (res.status === 'success') {
      const dk = await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2);
      setSheetRows(dk);
    } else {
      window.alert(res.message || 'Phê duyệt thất bại.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitMessage(null);
    if (wizardStep !== 4 || !canSubmitFinal || !tier) return;
    let regCode: string;
    let regName: string;
    let regAddress: string | undefined;
    if (supplementaryPick && supplementaryPick.code === selectedCustomerCode) {
      regCode = supplementaryPick.code.trim();
      regName = (supplementaryPick.name || '').trim();
      regAddress = (supplementaryPick.address || '').trim() || undefined;
    } else if (selectedRow) {
      regCode = selectedRow.customerCode;
      regName = selectedRow.customerName;
      regAddress = undefined;
    } else {
      return;
    }
    const posmPayload = {
      mandatory: tier.mandatoryPosm,
      choiceSingle: tier.choiceMode === 'single' ? choiceSingle : undefined,
      choiceMulti: tier.choiceMode === 'exact2' ? [...choiceMulti] : undefined,
    };
    setSubmitBusy(true);
    let res = await submitDisplayTBQ2Registration(scriptUrl, {
      customerCode: regCode,
      customerName: regName,
      customerAddress: regAddress,
      employeeName: currentEmployee.name,
      employeeCode: currentEmployee.code,
      storeTierId: tier.id,
      storeTypeLabel: tier.label,
      rewardVnd: tier.reward,
      posmSummary: JSON.stringify(posmPayload),
      sdt: confirmSdt.replace(/\D/g, ''),
      posmFlagsJson: buildPosmFlagsJson(),
    });
    /** POST đôi khi theo redirect → trình duyệt đọc phản hồi GET doGet (thiếu ?sheet=) dù server đã ghi sheet */
    if (res.status !== 'success' && /missing sheet parameter/i.test(res.message || '')) {
      const dk = await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2);
      const row = dk
        .map(r => normalizeDangKyTbq2Row(r))
        .find(r => r.customerCode.trim() === regCode.trim());
      if (row && isRegisteredRow(row)) res = { status: 'success' };
    }
    setSubmitBusy(false);
    if (res.status === 'success') {
      setSubmitMessage({ type: 'ok', text: 'Đã gửi đăng ký thành công.' });
      const dk = await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_DANGKYTBQ2);
      const bud = await fetchDataFromSheet<Record<string, unknown>>(scriptUrl, SHEET_REP_BUDGET_TBQ2);
      setSheetRows(dk);
      setBudgetRows(bud);
      setSelectedCustomerCode('');
      setStoreTierId('');
      setChoiceSingle(null);
      setChoiceMulti(new Set());
      setSupplementaryPick(null);
      setMasterSearchQuery('');
      setWizardStep(1);
      setConfirmSdt('');
      setSubmitAttempted(false);
    } else {
      setSubmitMessage({ type: 'err', text: res.message || 'Gửi thất bại.' });
    }
  };

  const posmErrorShow = submitAttempted && tier && !posmOk && posmValidation.message;
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
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#003629] dark:text-[#8abda9] tracking-tighter leading-none mb-1">
                Đăng ký
              </h2>
              <p className="text-[#404945] dark:text-slate-400 text-sm font-medium">Chương trình trưng bày Q2/2026</p>
            </section>

            <section className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 min-w-0">
              <p className="text-[10px] text-[#404945] dark:text-slate-500 mb-2 md:hidden">
                Vuốt ngang để xem ngân sách và các tier.
              </p>
              <div className="tbq2-scroll-x flex flex-nowrap gap-3 sm:gap-4 pb-2 -mb-1 items-stretch w-full min-w-0">
              <div className="flex-shrink-0 w-[min(100%,18rem)] max-w-[20rem] p-3 sm:p-4 rounded-xl bg-[#003629] text-white relative overflow-hidden border border-white/10 shadow-lg">
                <div className="relative z-10 min-w-0">
                  <div className="mb-2 min-w-0">
                    <p className="text-[9px] font-bold tracking-widest opacity-80 leading-tight">{budgetCard.title}</p>
                    {budgetCard.caption && (
                      <p className="text-[8px] font-semibold opacity-70 mt-0.5 tabular-nums">{budgetCard.caption}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 mb-3 min-w-0">
                    <span className="font-extrabold text-[11px] sm:text-xs tabular-nums tracking-tight leading-snug break-words min-w-0 flex-1">
                      {formatVndDong(budgetCard.budget)}
                    </span>
                    <span className="text-[9px] font-semibold bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10 shrink-0">
                      VNĐ
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-col gap-0.5 text-[9px] sm:text-[10px] leading-tight sm:flex-row sm:justify-between sm:gap-1">
                      <span className="opacity-75 font-medium tabular-nums">Đã dùng: {formatVndDong(budgetCard.used)}</span>
                      <span className="opacity-75 font-medium tabular-nums">Còn lại: {formatVndDong(budgetCard.left)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#9ed1bd] transition-all" style={{ width: `${budgetPct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
              </div>

              <div className="flex gap-3">
                {STORE_TIER_CONFIGS.map(t => {
                  const s = statsByTier[t.label] || { count: 0, used: 0 };
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
                        <span className="text-[10px] opacity-70 font-medium">Sử dụng: {formatShortVnd(s.used)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              <p className="text-[10px] text-[#404945] dark:text-slate-500 mt-2">
                Bấm thẻ tier để lọc KH đã đăng ký theo cột FinalStoreTypeQ2; bấm lại thẻ đang chọn để bỏ lọc.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 min-w-0 rounded-xl border border-[#c0c9c3]/25 dark:border-slate-600 bg-white/60 dark:bg-slate-800/50 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#003629] dark:text-[#8abda9] shrink-0">
                  Lọc FinalStoreTypeQ1
                </span>
                <select
                  value={finalStoreTypeQ1Filter ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFinalStoreTypeQ1Filter(v === '' ? null : v);
                  }}
                  className="min-w-0 flex-1 sm:max-w-md h-10 px-3 rounded-lg border border-[#c0c9c3]/40 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-semibold text-[#191c1c] dark:text-slate-100 focus:ring-2 focus:ring-[#003629]/20 outline-none"
                >
                  <option value="">— Tất cả —</option>
                  <option value={Q1_FILTER_NON_EMPTY}>Có dữ liệu Q1 (cột không trống)</option>
                  {distinctFinalStoreTypeQ1Values.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-4 min-w-0">
              <div className="flex justify-between items-center gap-2 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-[#003629] dark:text-[#8abda9] truncate">
                  Danh sách khách hàng
                </h3>
              </div>
              {(tierRegisteredFilter || finalStoreTypeQ1Filter !== null) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {tierRegisteredFilter && (
                    <>
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
                    </>
                  )}
                  {finalStoreTypeQ1Filter !== null && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100/90 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100 font-bold max-w-[min(100%,20rem)] min-w-0">
                        <span className="truncate">
                          Q1:{' '}
                          {finalStoreTypeQ1Filter === Q1_FILTER_NON_EMPTY
                            ? 'Có dữ liệu cột'
                            : finalStoreTypeQ1Filter}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFinalStoreTypeQ1Filter(null)}
                        className="text-[11px] font-bold underline text-slate-600 dark:text-slate-400"
                      >
                        Xóa lọc Q1
                      </button>
                    </>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[#404945] dark:text-slate-500 -mt-2 md:hidden">
                Vuốt ngang / dọc trong bảng khi màn hình nhỏ.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#003629] dark:text-[#8abda9] uppercase tracking-wider ml-1">
                  Tìm kiếm &amp; chọn khách hàng
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
                  <table className="tbq2-sticky-table w-full text-left text-xs min-w-[880px] sm:min-w-[960px]">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-[#2d3b36] dark:text-slate-200 border-b border-[#c0c9c3]/40 dark:border-slate-600">
                        <th className="py-3 px-3 bg-sky-100 dark:bg-sky-950/90 border-r border-sky-200/60 dark:border-sky-800/50">
                          Khách hàng
                        </th>
                        <th className="py-3 px-3 bg-blue-100/90 dark:bg-blue-950/45 border-r border-blue-200/50 dark:border-blue-900/40">
                          FinalStoreTypeQ1
                        </th>
                        <th className="py-3 px-3 bg-blue-100/90 dark:bg-blue-950/45 border-r border-blue-200/50 dark:border-blue-900/40">
                          Sale Q1
                        </th>
                        <th className="py-3 px-3 bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40">
                          District
                        </th>
                        <th className="py-3 px-3 bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40">
                          SDT
                        </th>
                        <th className="py-3 px-3 bg-emerald-100/85 dark:bg-emerald-950/40 border-r border-emerald-200/50 dark:border-emerald-900/40">
                          Rep
                        </th>
                        <th className="py-3 px-3 bg-violet-100/88 dark:bg-violet-950/42 border-r border-violet-200/50 dark:border-violet-900/40">
                          FinalStoreTypeQ2
                        </th>
                        <th className="py-3 px-3 bg-violet-100/88 dark:bg-violet-950/42 border-r border-violet-200/50 dark:border-violet-900/40">
                          Item
                        </th>
                        <th className="py-3 px-3 bg-amber-100/80 dark:bg-amber-950/35 border-r border-amber-200/50 dark:border-amber-900/40">
                          Trạng thái
                        </th>
                        <th className="py-3 px-3 text-right bg-amber-100/80 dark:bg-amber-950/35 border-r border-amber-200/50 dark:border-amber-900/40">
                          Phê duyệt
                        </th>
                        {isAdmin && (
                          <th className="py-3 px-3 text-center whitespace-nowrap bg-rose-100/85 dark:bg-rose-950/40 border-rose-200/50 dark:border-rose-900/40">
                            Duyệt
                          </th>
                        )}
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
                          const rowSelected =
                            selectedCustomerCode === row.customerCode && !isRegisteredRow(row);
                          return (
                          <tr
                            key={row.customerCode || `row-${idx}`}
                            onClick={() => {
                              if (!isRegisteredRow(row)) {
                                setSupplementaryPick(null);
                                setSelectedCustomerCode(row.customerCode);
                              }
                            }}
                            className={`group/row transition-colors ${
                              rowSelected
                                ? 'ring-2 ring-inset ring-[#003629]/35 dark:ring-[#8abda9]/45 z-[1] relative'
                                : ''
                            } ${!isRegisteredRow(row) ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-3 px-3 border-r border-sky-200/40 dark:border-sky-800/30 bg-sky-100 group-hover/row:bg-sky-200/95 dark:bg-sky-950 dark:group-hover/row:bg-sky-900/95">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-[#003629] dark:text-[#8abda9]">{row.customerName || '—'}</span>
                                <span className="text-[10px] text-[#404945] dark:text-slate-400">{row.customerCode || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[10px] max-w-[7rem] break-words border-r border-blue-200/35 dark:border-blue-900/30 bg-blue-50/75 group-hover/row:bg-blue-100/85 dark:bg-blue-950/22 dark:group-hover/row:bg-blue-950/38">
                              {row.finalStoreTypeQ1 || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] max-w-[6rem] break-words border-r border-blue-200/35 dark:border-blue-900/30 bg-blue-50/75 group-hover/row:bg-blue-100/85 dark:bg-blue-950/22 dark:group-hover/row:bg-blue-950/38">
                              {row.saleQ1 || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] border-r border-emerald-200/35 dark:border-emerald-900/30 bg-emerald-50/70 group-hover/row:bg-emerald-100/80 dark:bg-emerald-950/20 dark:group-hover/row:bg-emerald-950/35">
                              {row.district || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] border-r border-emerald-200/35 dark:border-emerald-900/30 bg-emerald-50/70 group-hover/row:bg-emerald-100/80 dark:bg-emerald-950/20 dark:group-hover/row:bg-emerald-950/35">
                              {row.sdt || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] border-r border-emerald-200/35 dark:border-emerald-900/30 bg-emerald-50/70 group-hover/row:bg-emerald-100/80 dark:bg-emerald-950/20 dark:group-hover/row:bg-emerald-950/35">
                              {row.rep || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] max-w-[7rem] break-words border-r border-violet-200/35 dark:border-violet-900/30 bg-violet-50/72 group-hover/row:bg-violet-100/82 dark:bg-violet-950/22 dark:group-hover/row:bg-violet-950/36">
                              {row.finalStoreTypeQ2 || '—'}
                            </td>
                            <td className="py-3 px-3 text-[10px] border-r border-violet-200/35 dark:border-violet-900/30 bg-violet-50/72 group-hover/row:bg-violet-100/82 dark:bg-violet-950/22 dark:group-hover/row:bg-violet-950/36">
                              {row.item || '—'}
                            </td>
                            <td className="py-3 px-3 border-r border-amber-200/40 dark:border-amber-900/30 bg-amber-50/65 group-hover/row:bg-amber-100/78 dark:bg-amber-950/18 dark:group-hover/row:bg-amber-950/32">
                              {isRegisteredRow(row) ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-[#8abda9]/20 text-[#1b4d3e] dark:text-[#8abda9] text-[10px] font-bold">
                                  Đã Đăng ký
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 text-[10px] font-bold">
                                  Chưa Đăng ký
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-[10px] border-r border-amber-200/40 dark:border-amber-900/30 bg-amber-50/65 group-hover/row:bg-amber-100/78 dark:bg-amber-950/18 dark:group-hover/row:bg-amber-950/32">
                              {isRegisteredRow(row) && !isPheDuyetApproved(row) ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-950 dark:bg-amber-800/50 dark:text-amber-50 font-bold">
                                  {row.pheDuyet?.trim() || 'Chờ duyệt'}
                                </span>
                              ) : isPheDuyetApproved(row) ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-green-200/90 text-green-950 dark:bg-green-900/45 dark:text-green-100 font-bold">
                                  {row.pheDuyet || 'Đã duyệt'}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-extrabold">{row.pheDuyet || '—'}</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-2 text-center bg-rose-50/70 group-hover/row:bg-rose-100/80 dark:bg-rose-950/22 dark:group-hover/row:bg-rose-950/36">
                                {isRegisteredRow(row) && !isPheDuyetApproved(row) ? (
                                  <button
                                    type="button"
                                    onClick={e => handleApproveRow(e, row.customerCode)}
                                    disabled={approvingCode === row.customerCode}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028] disabled:opacity-50"
                                  >
                                    {approvingCode === row.customerCode ? '…' : 'Duyệt'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] text-[#404945] dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-sky-200 dark:bg-sky-800 align-middle mr-1" /> KH
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-blue-200 dark:bg-blue-900 align-middle mr-1" /> Q1
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-emerald-200 dark:bg-emerald-900 align-middle mr-1" /> Khu vực / Rep
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-violet-200 dark:bg-violet-900 align-middle mr-1" /> Q2 &amp; Item
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-amber-200 dark:bg-amber-900 align-middle mr-1" /> Trạng thái / Phê duyệt
                </span>
                {isAdmin && (
                  <span>
                    <span className="inline-block w-2 h-2 rounded-sm bg-rose-200 dark:bg-rose-900 align-middle mr-1" /> Duyệt
                  </span>
                )}
              </p>
            </section>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="font-bold text-lg text-[#003629] dark:text-[#8abda9]">Biểu mẫu đăng ký</h3>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#404945] dark:text-slate-400">
                  {[1, 2, 3, 4].map(s => (
                    <span
                      key={s}
                      className={`px-2 py-1 rounded-lg ${
                        wizardStep === s
                          ? 'bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028]'
                          : wizardStep > s
                            ? 'bg-[#003629]/15 text-[#003629] dark:bg-[#8abda9]/20 dark:text-[#8abda9]'
                            : 'bg-[#c0c9c3]/25 dark:bg-slate-700'
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                  <span className="ml-1 hidden sm:inline">KH → Tier/POSM → Xác nhận → SDT</span>
                </div>
              </div>

              {wizardStep === 1 ? (
                <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-6 rounded-2xl space-y-5 border border-[#c0c9c3]/20 min-w-0">
                  <div className="flex items-center gap-3 mb-2 min-w-0">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-[#003629] text-white flex items-center justify-center font-bold text-xs">01</span>
                    <h4 className="font-bold text-xs sm:text-sm tracking-tight uppercase truncate">Thông tin khách hàng</h4>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#404945] dark:text-slate-400 ml-1">
                      Chọn cửa hàng (danh sách sheet) hoặc tìm KH bổ sung bên dưới
                    </label>
                    <select
                      value={selectedCustomerCode}
                      onChange={e => {
                        setSupplementaryPick(null);
                        setSelectedCustomerCode(e.target.value);
                      }}
                      className={`w-full h-12 px-4 bg-white dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-[#003629]/20 outline-none border-[#c0c9c3]/30 dark:text-white ${
                        submitAttempted && !customerOk ? 'ring-2 ring-red-300' : ''
                      }`}
                    >
                      <option value="">— Chọn khách hàng —</option>
                      {supplementaryPick && (
                        <option value={supplementaryPick.code}>
                          {supplementaryPick.name} ({supplementaryPick.code}) — từ sheet
                        </option>
                      )}
                      {assignableCustomers.map(c => (
                        <option key={c.customerCode} value={c.customerCode}>
                          {c.customerName} ({c.customerCode})
                        </option>
                      ))}
                    </select>
                    {submitAttempted && !customerOk && (
                      <p className="text-xs text-red-600 font-semibold">Chọn một khách hàng chưa đăng ký.</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#c0c9c3]/30 dark:border-slate-600 space-y-2">
                    <label className="text-xs font-semibold text-[#404945] dark:text-slate-400 ml-1">
                      Tìm KH trên sheet {SHEET_DANGKYTBQ2} (chưa đăng ký Q2)
                    </label>
                    <input
                      type="search"
                      autoComplete="off"
                      placeholder="Gõ mã, tên hoặc địa chỉ…"
                      value={masterSearchQuery}
                      onChange={e => setMasterSearchQuery(e.target.value)}
                      className="w-full h-11 pl-3 pr-3 bg-white dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-[#003629]/20 outline-none border-[#c0c9c3]/30 dark:text-white"
                    />
                    {masterSearchQuery.trim().length > 0 && masterSearchMatches.length === 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        Không có dòng phù hợp trên sheet (hoặc KH đã đăng ký / không thuộc Rep của bạn).
                      </p>
                    )}
                    {masterSearchMatches.length > 0 && (
                      <ul className="rounded-xl border border-[#c0c9c3]/30 dark:border-slate-600 bg-white dark:bg-slate-900 max-h-56 overflow-y-auto divide-y divide-[#c0c9c3]/15 dark:divide-slate-700">
                        {masterSearchMatches.map(c => (
                          <li key={c.code}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2.5 hover:bg-[#edeeed] dark:hover:bg-slate-800 transition-colors"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setSupplementaryPick(c);
                                setSelectedCustomerCode(String(c.code).trim());
                                setMasterSearchQuery('');
                              }}
                            >
                              <div className="font-bold text-sm text-[#003629] dark:text-[#8abda9] tabular-nums">
                                {c.code}
                              </div>
                              <div className="text-xs font-semibold text-[#191c1c] dark:text-slate-100">{c.name || '—'}</div>
                              {c.address ? (
                                <div className="text-[10px] text-[#404945] dark:text-slate-400 mt-0.5 line-clamp-2">
                                  {c.address}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic mt-0.5">Chưa có địa chỉ</div>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {supplementaryPick && (
                      <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#baeed9]/25 dark:bg-opella-green/15 border border-[#003629]/20 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-[#003629] dark:text-[#8abda9]">Đang chọn từ sheet:</span>{' '}
                          <span className="font-mono font-semibold">{supplementaryPick.code}</span> — {supplementaryPick.name}
                          {supplementaryPick.address ? (
                            <span className="block text-[10px] text-[#404945] dark:text-slate-400 mt-1">{supplementaryPick.address}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSupplementaryPick(null);
                            setSelectedCustomerCode('');
                          }}
                          className="shrink-0 text-[11px] font-bold underline text-red-700 dark:text-red-400"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                    {!loading && normalizedRows.length === 0 && (
                      <p className="text-[10px] text-amber-800 dark:text-amber-200/90">
                        Chưa có dữ liệu sheet {SHEET_DANGKYTBQ2}. Kiểm tra tên sheet và tải lại trang.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-[#c0c9c3]/20 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#404945] dark:text-slate-400">Khách hàng đã chọn</p>
                    <p className="font-bold text-sm text-[#003629] dark:text-[#8abda9] mt-1">{displayRegName}</p>
                    <p className="text-xs font-mono font-semibold text-[#191c1c] dark:text-slate-200">{displayRegCode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl border border-[#003629]/30 text-[#003629] dark:text-[#8abda9] dark:border-[#8abda9]/40 hover:bg-white/60 dark:hover:bg-slate-900/80"
                  >
                    Sửa KH
                  </button>
                </div>
              )}

              {wizardStep === 2 && (
                <>
                  <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-6 rounded-2xl space-y-5 border border-[#c0c9c3]/20 min-w-0">
                    <div className="flex items-center gap-3 mb-2 min-w-0">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-[#003629] text-white flex items-center justify-center font-bold text-xs">02</span>
                      <h4 className="font-bold text-xs sm:text-sm tracking-tight uppercase truncate">Tier &amp; chương trình</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[#404945] dark:text-slate-400 ml-1">Loại cửa hàng (Tier)</label>
                        <select
                          value={storeTierId}
                          onChange={e => setStoreTierId(e.target.value as StoreTierId | '')}
                          className={`w-full h-12 px-4 bg-white dark:bg-slate-900 border rounded-xl text-sm font-bold text-[#003629] dark:text-[#8abda9] focus:ring-2 focus:ring-[#003629]/20 outline-none border-[#c0c9c3]/30 ${
                            submitAttempted && !tierOk ? 'ring-2 ring-red-300' : ''
                          }`}
                        >
                          <option value="">— Chọn tier —</option>
                          {STORE_TIER_CONFIGS.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {tier && (
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#c0c9c3]/20 space-y-3">
                          <p className="text-[10px] font-bold text-[#404945] dark:text-slate-400 uppercase tracking-widest">Thông tin phân hạng</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-[#404945] dark:text-slate-400">Doanh số tối thiểu / tháng</p>
                              <p className="font-bold text-sm text-[#003629] dark:text-[#8abda9]">{formatCurrency(tier.minMonthlySales)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#404945] dark:text-slate-400">Doanh số quý đánh giá</p>
                              <p className="font-bold text-sm text-[#003629] dark:text-[#8abda9]">{formatCurrency(tier.minQuarterlySales)}</p>
                            </div>
                            <div className="sm:col-span-2 pt-2 border-t border-[#c0c9c3]/20">
                              <p className="text-[10px] text-[#404945] dark:text-slate-400">Incentive (Thưởng)</p>
                              <p className="font-extrabold text-base text-[#003629] dark:text-[#8abda9]">{formatCurrency(tier.reward)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {tier && (
                    <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-6 rounded-2xl space-y-5 border border-[#c0c9c3]/20 min-w-0">
                      <div className="flex items-center gap-3 mb-2 min-w-0">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-[#003629] text-white flex items-center justify-center font-bold text-xs">03</span>
                        <h4 className="font-bold text-xs sm:text-sm tracking-tight uppercase truncate">Cam kết POSM</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {tier.mandatoryPosm.map(label => (
                          <label
                            key={label}
                            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-[#c0c9c3]/20 cursor-default opacity-95"
                          >
                            <input type="checkbox" checked readOnly disabled className="w-5 h-5 rounded border-[#707974] text-[#003629]" />
                            <span className="text-sm font-semibold">
                              {label} <span className="text-[10px] font-normal">(bắt buộc)</span>
                            </span>
                          </label>
                        ))}
                        {tier.choiceMode === 'single' &&
                          tier.choicePool?.map(label => (
                            <label
                              key={label}
                              className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-[#c0c9c3]/20 cursor-pointer active:scale-[0.99] transition-transform"
                            >
                              <input
                                type="radio"
                                name="posm-choice"
                                checked={choiceSingle === label}
                                onChange={() => setChoiceSingle(label)}
                                className="w-5 h-5 border-[#707974] text-[#003629]"
                              />
                              <span className="text-sm font-semibold">{label}</span>
                            </label>
                          ))}
                        {tier.choiceMode === 'exact2' &&
                          tier.choicePool?.map(label => {
                            const checked = choiceMulti.has(label);
                            const atCap = choiceMulti.size >= tier.choiceRequired && !checked;
                            return (
                              <label
                                key={label}
                                className={`flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-[#c0c9c3]/20 transition-transform ${
                                  atCap ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={atCap}
                                  onChange={() => toggleBronze(label)}
                                  className="w-5 h-5 rounded border-[#707974] text-[#003629]"
                                />
                                <span className="text-sm font-semibold">{label}</span>
                              </label>
                            );
                          })}
                      </div>
                      {(posmErrorShow || (tier.choiceMode !== 'none' && !posmOk)) && posmValidation.message && (
                        <p
                          className={`text-xs font-semibold ${
                            posmErrorShow ? 'text-red-600' : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {posmValidation.message}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {(wizardStep === 3 || wizardStep === 4) && tier && (
                <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-6 rounded-2xl space-y-4 border border-[#c0c9c3]/20 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-[#003629] text-white flex items-center justify-center font-bold text-xs">
                      {wizardStep}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm tracking-tight uppercase truncate">
                      {wizardStep === 3 ? 'Xác nhận trước khi nhập SDT' : 'Kiểm tra &amp; số điện thoại'}
                    </h4>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#c0c9c3]/20 p-4 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold text-[#404945] dark:text-slate-400 uppercase">Tier</p>
                      <p className="font-bold text-[#003629] dark:text-[#8abda9]">{tier.label}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#404945] dark:text-slate-400 uppercase">Hạng mục POSM</p>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-[#191c1c] dark:text-slate-200">
                        {selectedPosmLabelsForRecap.map(l => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {wizardStep === 3 && (
                    <p className="text-[11px] text-[#404945] dark:text-slate-500">
                      Nhấn <span className="font-bold">Hủy</span> để quay lại bước 1 và xóa tier/POSM đã chọn. <span className="font-bold">Tiếp tục</span> để nhập SDT và gửi.
                    </p>
                  )}
                </div>
              )}

              {wizardStep === 4 && (
                <div className="bg-[#edeeed] dark:bg-slate-800/80 p-4 sm:p-6 rounded-2xl space-y-3 border border-[#c0c9c3]/20 min-w-0">
                  <label className="text-xs font-semibold text-[#404945] dark:text-slate-400 ml-1">Số điện thoại xác nhận</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="VD: 09xxxxxxxx"
                    value={confirmSdt}
                    onChange={e => setConfirmSdt(e.target.value)}
                    className={`w-full h-12 px-4 bg-white dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-[#003629]/20 outline-none border-[#c0c9c3]/30 dark:text-white ${
                      submitAttempted && !sdtOk ? 'ring-2 ring-red-300' : ''
                    }`}
                  />
                  {submitAttempted && !sdtOk && (
                    <p className="text-xs text-red-600 font-semibold">Nhập SDT hợp lệ (9–12 chữ số).</p>
                  )}
                </div>
              )}

              {submitMessage && (
                <div
                  className={`rounded-xl p-3 text-sm font-semibold ${
                    submitMessage.type === 'ok'
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                      : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                  }`}
                >
                  {submitMessage.text}
                </div>
              )}

              <div className="pt-2 pb-8 space-y-3">
                {wizardStep === 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!customerOk}
                      onClick={() => {
                        if (!customerOk) {
                          setSubmitAttempted(true);
                          return;
                        }
                        setSubmitAttempted(false);
                        setWizardStep(2);
                      }}
                      className="min-w-[10rem] h-12 px-6 rounded-xl bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028] font-bold text-sm shadow-md disabled:opacity-45"
                    >
                      Tiếp theo
                    </button>
                  </div>
                )}
                {wizardStep === 2 && (
                  <div className="flex flex-wrap gap-2 justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setSubmitAttempted(false);
                      }}
                      className="h-12 px-5 rounded-xl border border-[#c0c9c3]/50 dark:border-slate-600 font-bold text-sm"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!tierOk || !posmOk) {
                          setSubmitAttempted(true);
                          return;
                        }
                        setSubmitAttempted(false);
                        setWizardStep(3);
                      }}
                      className="min-w-[10rem] h-12 px-6 rounded-xl bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028] font-bold text-sm shadow-md"
                    >
                      Tiếp theo
                    </button>
                  </div>
                )}
                {wizardStep === 3 && (
                  <div className="flex flex-wrap gap-2 justify-between">
                    <button
                      type="button"
                      onClick={handleWizardCancel}
                      className="h-12 px-5 rounded-xl border-2 border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 font-bold text-sm"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep(4)}
                      className="min-w-[10rem] h-12 px-6 rounded-xl bg-[#003629] text-white dark:bg-[#8abda9] dark:text-[#1a3028] font-bold text-sm shadow-md"
                    >
                      Tiếp tục
                    </button>
                  </div>
                )}
                {wizardStep === 4 && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(3);
                        setSubmitAttempted(false);
                      }}
                      className="h-12 px-5 rounded-xl border border-[#c0c9c3]/50 dark:border-slate-600 font-bold text-sm order-2 sm:order-1"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmitFinal}
                      className="order-1 sm:order-2 min-w-[12rem] h-14 rounded-xl bg-gradient-to-r from-[#003629] to-[#1b4d3e] text-white font-bold text-base shadow-[0_12px_32px_rgba(0,54,41,0.2)] active:scale-[0.99] transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {submitBusy ? 'Đang gửi…' : 'GỬI ĐĂNG KÝ'}
                    </button>
                  </div>
                )}
                {wizardStep === 4 && !canSubmitFinal && !submitBusy && (
                  <p className="text-[10px] text-center text-[#404945] dark:text-slate-400">
                    Kiểm tra SDT (9–12 số) rồi gửi. Dữ liệu tier/POSM đã khóa ở bước trước.
                  </p>
                )}
              </div>
            </form>
          </>
        )}
      </main>

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
