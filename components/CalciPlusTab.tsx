import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';
import { fetchDataFromSheet } from '../services/googleSheetService';
import { CALCIPLUS_GOI_SHEET, CALCIPLUS_PROMO_PACK_SIZE, GOOGLE_SCRIPT_URL } from '../constants';
import { ChartBarIcon } from './icons';

interface OrderSheetRow {
  Timestamp?: string | number;
  Employee?: string;
  employeeName?: string;
  Rep?: string;
  CustomerCode?: string;
  CustomerName?: string;
  Product?: string;
  ProductName?: string;
  Quantity?: number | string;
  Qty?: number | string;
  SL_hop?: number | string;
  'SL_hộp'?: number | string;
  SL_goi?: number | string;
  'SL_gói'?: number | string;
  Price?: number | string;
  Total?: number | string;
  Thanh_tien?: number | string;
  ThanhTien?: number | string;
  // Trường hợp sheet đã lưu sẵn theo cột tách sản phẩm
  CalciQty?: number | string;
  EnteroQty?: number | string;
  CalciPack?: number | string;
  EnteroPack?: number | string;
  'SL hộp'?: number | string;
  'SL gói'?: number | string;
  'Số lượng'?: number | string;
  [key: string]: unknown;
}

const normalizeKey = (s: unknown): string => String(s ?? '').trim().toUpperCase();

/** Khớp tên SP với dữ liệu sheet / đơn hàng (tránh lệch chữ hoa thường hoặc gõ tay). */
const isCalciPlusProductName = (p: string): boolean => {
  const u = normalizeKey(p);
  return u.includes('CORBIERE CALCIUM PLUS') || (u.includes('CORBIERE') && u.includes('CALCIUM PLUS'));
};

const isEntero2B20ProductName = (p: string): boolean => {
  const u = normalizeKey(p);
  return (
    u.includes('ENTEROGERMINA 2 BILLION/5ML B/20 BOTTLE') ||
    (u.includes('ENTEROGERMINA') && u.includes('B/20'))
  );
};
const toNum = (...vals: unknown[]): number => {
  for (const v of vals) {
    const n = Number(v ?? 0);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return 0;
};

const CalciPlusTab: React.FC = () => {
  const [rawData, setRawData] = useState<OrderSheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDataFromSheet<OrderSheetRow>(GOOGLE_SCRIPT_URL, CALCIPLUS_GOI_SHEET);
      setRawData(data || []);
    } catch (e) {
      setError(`Không tải được dữ liệu sheet ${CALCIPLUS_GOI_SHEET}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    return rawData.map((row, idx) => {
      const repNormalized = String(row.Rep ?? row.Employee ?? row.employeeName ?? '').trim() || '—';
      const customerCode = String(row.CustomerCode ?? '').trim();
      const customerName = String(row.CustomerName ?? '').trim();
      const product = String(row.Product ?? row.ProductName ?? '').trim();
      const qty = toNum(
        row.Quantity,
        row.Qty,
        row.SL_hop,
        row['SL_hộp'],
        row['SL hộp'],
        row['Số lượng']
      );
      const slGoi = toNum(row.SL_goi, row['SL_gói'], row['SL gói']);
      const total = toNum(row.Total, row.Thanh_tien, row.ThanhTien);
      const calciQtyCol = toNum(row.CalciQty, row['SL_hop_calci'], row['SL_hộp_calci'], row['SL hop calci']);
      const enteroQtyCol = toNum(row.EnteroQty, row['SL_hop_entero'], row['SL_hộp_entero'], row['SL hop entero']);
      const calciPackCol = toNum(row.CalciPack, row['SL_goi_calci'], row['SL gói calci'], row['SL_goi_calcip']);
      const enteroPackCol = toNum(row.EnteroPack, row['SL_goi_entero'], row['SL gói entero'], row['SL_goi_entero2b20']);
      return {
        key: `${idx}-${repNormalized}-${product}`,
        rep: repNormalized,
        customerCode,
        customerName,
        product,
        qty,
        slGoi,
        total,
        calciQtyCol,
        enteroQtyCol,
        calciPackCol,
        enteroPackCol,
      };
    });
  }, [rawData]);

  const byRep = useMemo(() => {
    const m = new Map<string, {
      calciQty: number;
      calciPacks: number;
      enteroQty: number;
      enteroPacks: number;
      totalAmount: number;
    }>();
    rows.forEach(r => {
      if (!m.has(r.rep)) {
        m.set(r.rep, { calciQty: 0, calciPacks: 0, enteroQty: 0, enteroPacks: 0, totalAmount: 0 });
      }
      const cur = m.get(r.rep)!;

      // Nếu sheet ghi trực tiếp theo cột tổng hợp riêng từng SP thì ưu tiên dùng luôn
      if (r.calciQtyCol > 0 || r.enteroQtyCol > 0 || r.calciPackCol > 0 || r.enteroPackCol > 0) {
        cur.calciQty += r.calciQtyCol;
        cur.enteroQty += r.enteroQtyCol;
        cur.calciPacks += r.calciPackCol;
        cur.enteroPacks += r.enteroPackCol;
        cur.totalAmount += r.total;
        return;
      }

      const p = r.product;
      if (isCalciPlusProductName(p)) {
        cur.calciQty += r.qty;
        if (r.slGoi > 0) cur.calciPacks += r.slGoi;
      } else if (isEntero2B20ProductName(p)) {
        cur.enteroQty += r.qty;
        if (r.slGoi > 0) cur.enteroPacks += r.slGoi;
      } else {
        return;
      }
      cur.totalAmount += r.total;
    });
    m.forEach((cur) => {
      if (cur.calciPacks <= 0 && cur.calciQty > 0) {
        cur.calciPacks = Math.floor(cur.calciQty / CALCIPLUS_PROMO_PACK_SIZE);
      }
      if (cur.enteroPacks <= 0 && cur.enteroQty > 0) {
        cur.enteroPacks = Math.floor(cur.enteroQty / CALCIPLUS_PROMO_PACK_SIZE);
      }
    });
    return Array.from(m.entries())
      .map(([rep, v]) => ({ rep, ...v }))
      .filter(
        (r) =>
          r.calciQty > 0 ||
          r.enteroQty > 0 ||
          r.calciPacks > 0 ||
          r.enteroPacks > 0 ||
          r.totalAmount > 0
      )
      .sort((a, b) => {
        const aPacks = a.calciPacks + a.enteroPacks;
        const bPacks = b.calciPacks + b.enteroPacks;
        return bPacks - aPacks || b.totalAmount - a.totalAmount;
      });
  }, [rows]);

  const byCustomer = useMemo(() => {
    const m = new Map<string, {
      rep: string;
      customerCode: string;
      customerName: string;
      calciQty: number;
      calciPacks: number;
      enteroQty: number;
      enteroPacks: number;
      totalAmount: number;
    }>();

    rows.forEach((r) => {
      const code = r.customerCode;
      const name = r.customerName;
      const customerKey = `${r.rep}__${code || 'N/A'}__${name || 'N/A'}`;
      if (!m.has(customerKey)) {
        m.set(customerKey, {
          rep: r.rep,
          customerCode: code,
          customerName: name,
          calciQty: 0,
          calciPacks: 0,
          enteroQty: 0,
          enteroPacks: 0,
          totalAmount: 0,
        });
      }
      const cur = m.get(customerKey)!;

      // Trường hợp sheet đã tách sẵn cột theo sản phẩm
      if (r.calciQtyCol > 0 || r.enteroQtyCol > 0 || r.calciPackCol > 0 || r.enteroPackCol > 0) {
        cur.calciQty += r.calciQtyCol;
        cur.enteroQty += r.enteroQtyCol;
        cur.calciPacks += r.calciPackCol;
        cur.enteroPacks += r.enteroPackCol;
        cur.totalAmount += r.total;
        return;
      }

      const p = r.product;
      if (isCalciPlusProductName(p)) {
        cur.calciQty += r.qty;
        if (r.slGoi > 0) cur.calciPacks += r.slGoi;
      } else if (isEntero2B20ProductName(p)) {
        cur.enteroQty += r.qty;
        if (r.slGoi > 0) cur.enteroPacks += r.slGoi;
      } else {
        return;
      }
      cur.totalAmount += r.total;
    });

    const out = Array.from(m.values())
      .filter(
        (r) =>
          r.calciQty > 0 ||
          r.enteroQty > 0 ||
          r.calciPacks > 0 ||
          r.enteroPacks > 0 ||
          r.totalAmount > 0
      )
      .map((r) => ({
        ...r,
        calciPacks: r.calciPacks > 0 ? r.calciPacks : (r.calciQty > 0 ? Math.floor(r.calciQty / CALCIPLUS_PROMO_PACK_SIZE) : 0),
        enteroPacks: r.enteroPacks > 0 ? r.enteroPacks : (r.enteroQty > 0 ? Math.floor(r.enteroQty / CALCIPLUS_PROMO_PACK_SIZE) : 0),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount || (b.calciPacks + b.enteroPacks) - (a.calciPacks + a.enteroPacks));
    return out;
  }, [rows]);

  const totals = useMemo(() => ({
    reps: byRep.length,
    calciPacks: byRep.reduce((s, r) => s + r.calciPacks, 0),
    enteroPacks: byRep.reduce((s, r) => s + r.enteroPacks, 0),
    totalAmount: byRep.reduce((s, r) => s + r.totalAmount, 0),
  }), [byRep]);

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-black text-opella-green dark:text-opella-green uppercase flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-opella-green/20 flex items-center justify-center">
              <ChartBarIcon />
            </div>
            THỐNG KÊ GÓI 4.76% THEO REP
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

        {!loading && !error && rawData.length > 0 && byRep.length === 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-900 dark:text-amber-100 text-sm">
            Đã tải {rawData.length} dòng từ sheet nhưng chưa gộp được theo CalciPlus / Entero 2B/20. Kiểm tra cột{' '}
            <span className="font-bold">Product</span> (đúng tên như trên đơn) và các cột{' '}
            <span className="font-bold">SL_hộp</span> / <span className="font-bold">SL_gói</span> (hoặc tên cột tương đương).
          </div>
        )}

        {!loading && !error && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase tracking-wide">
                THỐNG KÊ THEO REP (TẤT CẢ THÀNH VIÊN)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[720px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">CALCIPLUS (SL gói 4.76%)</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">ENTERO 2B/20 (SL gói 4.76%)</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng doanh số 2 SP</th>
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
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.calciPacks}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.enteroPacks}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.totalAmount)}</td>
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
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Số Rep có phát sinh</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.reps}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">CalciPlus (SL gói 4.76%)</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.calciPacks}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Entero 2B/20 (SL gói 4.76%)</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{totals.enteroPacks}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng doanh số 2 sản phẩm</p>
                <p className="text-xl font-black text-opella-green dark:text-opella-green">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
              <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase tracking-wide">
                CHI TIẾT KHÁCH HÀNG (CALCIPLUS VS ENTERO 2B/20)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 w-12">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Rep</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Mã KH</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">Tên KH</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Calci (SL gói)</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Entero (SL gói)</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 text-right">Tổng doanh số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {byCustomer.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có dữ liệu chi tiết theo khách hàng
                      </td>
                    </tr>
                  ) : (
                    byCustomer.map((row, idx) => (
                      <tr key={`${row.rep}-${row.customerCode}-${row.customerName}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">{row.rep}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-200">{row.customerCode || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{row.customerName || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.calciPacks}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{row.enteroPacks}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-opella-green dark:text-opella-green">{formatCurrency(row.totalAmount)}</td>
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
