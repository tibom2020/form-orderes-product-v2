import React, { useMemo, useState, useRef } from 'react';
import type { AcemucScheme1Record, Employee, Order } from '../types';
import {
  ACEMUC_GROUP_IDS,
  ACEMUC_SCHEME1_MIN_SALE,
  GOOGLE_SCRIPT_URL,
  SHEET_ACEMUC_SCHEME1,
} from '../constants';
import { submitMarketingData } from '../services/googleSheetService';
import { formatCurrency } from '../utils/formatters';
import { salesRecordMatchesEmployee } from '../utils/employeeScope';
import { CameraIcon, CloudArrowUpIcon, SearchIcon } from './icons';

interface AcemucScheme1TabProps {
  records: AcemucScheme1Record[];
  /** Đơn đã gửi (local) — cộng DS Acemuc = basePrice × SL */
  sentOrders?: Order[];
  currentEmployee: Employee;
  /** Admin: xem mọi Rep + dropdown lọc */
  isAdmin?: boolean;
  onUpdateRecord: (
    customerCode: string,
    updates: Partial<Pick<AcemucScheme1Record, 'UpHinh' | 'UpHinh2' | 'GhiChu1' | 'GhiChu2'>>
  ) => void;
  onReloadData?: () => Promise<void> | void;
}

function hasImageUrl(v: string | undefined): boolean {
  const s = String(v ?? '').trim();
  return !!s && s.toUpperCase() !== 'NO';
}

/** Cùng tháng dương lịch (GMT+7) với thời điểm hiện tại */
function isInCurrentMonthLocal(ms: number): boolean {
  if (!Number.isFinite(ms) || ms <= 0) return false;
  const d = new Date(ms);
  const now = new Date();
  // So khớp theo lịch VN: dùng offset +7 khi format
  const fmt = (x: Date) =>
    x.toLocaleString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' });
  return fmt(d) === fmt(now);
}

/** Σ (basePrice × SL) đơn Acemuc của KH trong tháng hiện tại (dedupe order id) */
function calcAcemucSaleFromOrders(orders: Order[], customerCode: string): number {
  const code = String(customerCode ?? '').trim();
  if (!code) return 0;
  const seen = new Set<string>();
  let sum = 0;
  for (const o of orders) {
    if (String(o.customerCode ?? '').trim() !== code) continue;
    if (!isInCurrentMonthLocal(Number(o.createdAt) || 0)) continue;
    const oid = String(o.id ?? '');
    if (oid) {
      if (seen.has(oid)) continue;
      seen.add(oid);
    }
    for (const item of o.items || []) {
      if (!ACEMUC_GROUP_IDS.includes(item.id)) continue;
      const unit = Number(item.basePrice) > 0 ? Number(item.basePrice) : Number(item.price) || 0;
      sum += Math.round(unit * (Number(item.quantity) || 0));
    }
  }
  return sum;
}

/**
 * DS Acemuc trong tháng: ưu tiên tổng đơn local (base × SL các ngày trong tháng);
 * sheet khi chưa có đơn local (Admin xem Rep khác).
 */
function resolveAcemucSale(record: AcemucScheme1Record, orders: Order[]): number {
  const fromOrders = calcAcemucSaleFromOrders(orders, String(record.CustomerCode));
  if (fromOrders > 0) return fromOrders;
  const fromSheet = Number(record.SaleAcemuc);
  return Number.isFinite(fromSheet) && fromSheet > 0 ? fromSheet : 0;
}

const AcemucScheme1Tab: React.FC<AcemucScheme1TabProps> = ({
  records,
  sentOrders = [],
  currentEmployee,
  isAdmin = false,
  onUpdateRecord,
  onReloadData,
}) => {
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const repOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const rep = String(r.Rep ?? '').trim();
      if (rep) set.add(rep);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => {
        const rep = String(r.Rep ?? '').trim();
        // Admin (mã ADMIN): lọc theo dropdown; SuperUser đổi NV ở header → chỉ KH của NV đó
        if (isAdmin) {
          if (repFilter && rep !== repFilter) return false;
        } else if (!salesRecordMatchesEmployee(r, currentEmployee)) {
          return false;
        }
        if (!q) return true;
        return (
          String(r.CustomerCode).toLowerCase().includes(q) ||
          String(r.CustomerName).toLowerCase().includes(q) ||
          (isAdmin && rep.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => String(a.CustomerName).localeCompare(String(b.CustomerName), 'vi'));
  }, [records, search, repFilter, isAdmin, currentEmployee]);

  const selected = useMemo(
    () => filtered.find((r) => String(r.CustomerCode).trim() === String(selectedCode ?? '').trim()) ?? null,
    [filtered, selectedCode]
  );

  const compressAndConvertBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1280;
          let { width, height } = img;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Cannot get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl.split(',')[1] || '');
        };
        img.onerror = reject;
        img.src = String(e.target?.result || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const openUpload = (code: string, slot: 1 | 2, source: 'camera' | 'gallery') => {
    setSelectedCode(code);
    setActiveSlot(slot);
    setSelectedImage(null);
    setUploadNote('');
    setUploadError(null);
    setTimeout(() => {
      if (source === 'camera') cameraInputRef.current?.click();
      else galleryInputRef.current?.click();
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedImage(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedImage || !selected || !activeSlot) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const base64 = await compressAndConvertBase64(selectedImage);
      const targetColumn = activeSlot === 1 ? 'UpHinh' : 'UpHinh2';
      const response = await submitMarketingData(GOOGLE_SCRIPT_URL, {
        action: 'uploadImage',
        sheetName: SHEET_ACEMUC_SCHEME1,
        customerCode: selected.CustomerCode,
        image: base64,
        mimeType: 'image/jpeg',
        targetColumn,
        note: uploadNote,
        employeeName: currentEmployee.name,
        customerName: selected.CustomerName,
      });
      if (response.status === 'success' && response.url) {
        const updates =
          activeSlot === 1
            ? { UpHinh: response.url, ...(uploadNote ? { GhiChu1: uploadNote } : {}) }
            : { UpHinh2: response.url, ...(uploadNote ? { GhiChu2: uploadNote } : {}) };
        onUpdateRecord(selected.CustomerCode, updates);
        setSelectedImage(null);
        setActiveSlot(null);
        setUploadNote('');
      } else {
        setUploadError(response.message || 'Upload thất bại');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload lỗi');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReload = async () => {
    if (!onReloadData) return;
    setIsReloading(true);
    try {
      await onReloadData();
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div className="pb-10 space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900 px-4 py-3 shadow-sm">
        <h2 className="text-base font-black uppercase text-amber-900 dark:text-amber-100 tracking-wide">
          Acemuc Scheme 1
        </h2>
        <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 mt-1 leading-snug">
          POSM: Poster (50×70) + Wobbler (22×22) · DS Acemuc ≥ {formatCurrency(ACEMUC_SCHEME1_MIN_SALE)}/tháng ·
          FOC 2 hộp CAP (tháng sau) · Sep–Oct
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <SearchIcon />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã / tên KH..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        {isAdmin && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2"
          >
            <option value="">Tất cả Rep</option>
            {repOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {onReloadData && (
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={isReloading}
            className="text-[10px] font-bold uppercase px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {isReloading ? 'Đang tải...' : 'Tải lại'}
          </button>
        )}
        <span className="text-[10px] font-bold text-slate-500">{filtered.length} KH</span>
      </div>

      {/* Chụp trực tiếp (mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Chọn từ thư viện ảnh */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {selectedImage && selected && activeSlot && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 p-3 space-y-2 shadow-md">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Up {activeSlot === 1 ? 'Poster' : 'Wobbler'} · {selected.CustomerName} ({selected.CustomerCode})
          </p>
          <p className="text-[10px] text-slate-500">{selectedImage.name}</p>
          <textarea
            value={uploadNote}
            onChange={(e) => setUploadNote(e.target.value)}
            rows={2}
            placeholder="Ghi chú (tuỳ chọn)"
            className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-2 outline-none"
          />
          {uploadError && <p className="text-[10px] font-bold text-red-600">{uploadError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={isUploading}
              className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase disabled:opacity-50"
            >
              {isUploading ? 'Đang gửi Drive...' : 'Xác nhận upload'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null);
                setActiveSlot(null);
                setUploadError(null);
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-bold"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center text-sm text-slate-400 italic py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Chưa có KH trên sheet — submit đơn có Acemuc để tự thêm.
          </div>
        ) : (
          filtered.map((r) => {
            const code = String(r.CustomerCode).trim();
            const sale = resolveAcemucSale(r, sentOrders);
            const dat = sale >= ACEMUC_SCHEME1_MIN_SALE;
            const posterOk = hasImageUrl(r.UpHinh);
            const wobblerOk = hasImageUrl(r.UpHinh2);
            return (
              <div
                key={code}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-3 shadow-sm space-y-2"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-500">{code}</p>
                    <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">
                      {r.CustomerName}
                    </p>
                    {r.Rep && (
                      <p className="text-[10px] text-slate-500 mt-0.5">Rep: {r.Rep}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full ${
                      dat
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                    }`}
                  >
                    {dat ? 'ĐẠT 1TR' : 'CHƯA ĐẠT'}
                  </span>
                </div>

                <div className="flex justify-between text-[10px] rounded-md bg-slate-50 dark:bg-slate-900/50 px-2 py-1.5 border border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-500">DS Acemuc tháng (base × SL)</span>
                  <span className="font-black tabular-nums text-slate-800 dark:text-slate-100">
                    {sale > 0 ? formatCurrency(Math.round(sale)) : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-2 space-y-1.5">
                    <p className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-200">
                      Poster
                    </p>
                    {posterOk ? (
                      <a
                        href={String(r.UpHinh)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[10px] font-bold text-sky-600 dark:text-sky-400 truncate hover:underline"
                      >
                        Đã có ảnh →
                      </a>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Chưa up</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => openUpload(code, 1, 'camera')}
                        className="inline-flex items-center justify-center gap-0.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase"
                        title="Chụp ảnh"
                      >
                        <CameraIcon /> Chụp
                      </button>
                      <button
                        type="button"
                        onClick={() => openUpload(code, 1, 'gallery')}
                        className="inline-flex items-center justify-center gap-0.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-[9px] font-black uppercase"
                        title="Chọn từ thư viện"
                      >
                        <CloudArrowUpIcon /> Thư viện
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-2 space-y-1.5">
                    <p className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-200">
                      Wobbler
                    </p>
                    {wobblerOk ? (
                      <a
                        href={String(r.UpHinh2)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[10px] font-bold text-sky-600 dark:text-sky-400 truncate hover:underline"
                      >
                        Đã có ảnh →
                      </a>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Chưa up</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => openUpload(code, 2, 'camera')}
                        className="inline-flex items-center justify-center gap-0.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase"
                        title="Chụp ảnh"
                      >
                        <CameraIcon /> Chụp
                      </button>
                      <button
                        type="button"
                        onClick={() => openUpload(code, 2, 'gallery')}
                        className="inline-flex items-center justify-center gap-0.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-[9px] font-black uppercase"
                        title="Chọn từ thư viện"
                      >
                        <CloudArrowUpIcon /> Thư viện
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AcemucScheme1Tab;
