import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Customer, SalesRecord, ForecastItem, Employee, AiChatMessage, AiCustomerContext } from '../types';
import { PaperAirplaneIcon, SearchIcon } from './icons';
import { submitAiChat } from '../services/googleSheetService';
import { GOOGLE_SCRIPT_URL } from '../constants';
import { getAiTuVanMessages, saveAiTuVanMessages } from '../utils/storage';

interface AiTuVanTabProps {
  customers: Customer[];
  salesRecords: SalesRecord[];
  forecastData: ForecastItem[];
  currentEmployee: Employee;
}

const normCode = (v: string | number | undefined | null) => String(v ?? '').trim();

/** Khớp mã từ danh mục KH với dòng DOANH_SO (CustomerCode hoặc CodeBuyMed có thể lệch nhau). */
const findSalesByCatalogCode = (catalogCode: string, records: SalesRecord[]): SalesRecord | null => {
  const c = normCode(catalogCode);
  if (!c) return null;
  return (
    records.find(
      (r) => normCode(r.CustomerCode) === c || normCode(r.CodeBuyMed) === c
    ) || null
  );
};

const findForecastByCatalogCode = (catalogCode: string, forecasts: ForecastItem[]): ForecastItem | null => {
  const c = normCode(catalogCode);
  if (!c) return null;
  return forecasts.find((f) => normCode(f.CustomerCode) === c) || null;
};

const buildSalesSummaryForAi = (r: SalesRecord): string => {
  const n = (x: unknown) => Number(x) || 0;
  const fmt = (x: unknown) => n(x).toLocaleString('vi-VN');
  const q = n(r.MustWin) + n(r.Other);
  const raw = r as unknown as Record<string, unknown>;
  const pickRaw = (label: string, key: string) => {
    const v = raw[key];
    if (v === null || v === undefined || v === '') return null;
    return `${label}: ${String(v)}`;
  };

  // Nhiều dòng + bảng sẵn để model không "bịa" và không cần markdown |
  const lines = [
    `Ma sheet DOANH_SO: CustomerCode=${r.CustomerCode}${r.CodeBuyMed ? `; CodeBuyMed=${r.CodeBuyMed}` : ''}`,
    `KPI thang hien tai: TargetImport ${fmt(r.TargetImport)}; ActualImport ${fmt(r.ActualImport)}; TargetLocal ${fmt(r.TargetLocal)}; ActualLocal ${fmt(r.ActualLocal)}`,
    `Tong DS quy (MustWin + Other): ${fmt(q)} VND`,
    `Kenh quy: GIGAMED ${fmt(r.GIGAMED)} VND; BM ${fmt(r.BM)} VND`,
    '',
    '=== BANG SO LIEU SAN CO (chep nguyen vao tra loi user, khong dung bang markdown) ===',
    `Quy 1 - Tong MustWin+Other: ${fmt(q)} VND (day la tong quy trong app; khong tach 3 thang neu sheet khong co cot thang 3 rieng)`,
    `Ky T1 (sheet - thuong la dot/thang 1 trong cap nhat sheet): Import thuc dat ${fmt(r.ActualImportT1)} VND; Local thuc dat ${fmt(r.ActualLocalT1)} VND`,
    `Ky T2 (sheet - thuong la dot/thang 2): Import thuc dat ${fmt(r.ActualImportT2)} VND; Local thuc dat ${fmt(r.ActualLocalT2)} VND`,
    'Luu y: App khong co cot "thang 3" rieng neu sheet khong map; neu can thang 3 hay bo sung cot tren DOANH_SO.',
    `Sale T1: ${fmt(r.Sale)} VND; Check dieu kien TB: ${r.Check || '-'}`,
    `FinalStoreType: ${r.FinalStoreType || '-'}`,
    pickRaw('SALE IMPORT T1 (sheet)', 'SALE IMPORT T1'),
    pickRaw('SALE IMPORT T2 (sheet)', 'SALE IMPORT T2'),
    pickRaw('SALE LOCAL T1 (sheet)', 'SALE LOCAL T1'),
    pickRaw('SALE LOCAL T2 (sheet)', 'SALE LOCAL T2'),
  ].filter((line) => line !== null) as string[];

  return lines.join('\n');
};

const buildWelcomeMessages = (): AiChatMessage[] => [
  {
    role: 'assistant',
    content: 'Xin chao! Toi co the tu van du lieu khach hang trong app. Ban hay chon khach hang va dat cau hoi.',
    timestamp: new Date().toISOString(),
  },
];

const AiTuVanTab: React.FC<AiTuVanTabProps> = ({ customers, salesRecords, forecastData, currentEmployee }) => {
  const [selectedCustomerCode, setSelectedCustomerCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    const saved = getAiTuVanMessages(currentEmployee.code);
    return saved.length > 0 ? saved : buildWelcomeMessages();
  });

  useEffect(() => {
    saveAiTuVanMessages(currentEmployee.code, messages);
  }, [messages, currentEmployee.code]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.code).trim() === String(selectedCustomerCode).trim()) || null,
    [customers, selectedCustomerCode]
  );

  const selectedSales = useMemo(
    () => findSalesByCatalogCode(selectedCustomerCode, salesRecords),
    [salesRecords, selectedCustomerCode]
  );

  const selectedForecast = useMemo(
    () => findForecastByCatalogCode(selectedCustomerCode, forecastData),
    [forecastData, selectedCustomerCode]
  );

  const suggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return customers
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(term) ||
          String(c.code || '')
            .toLowerCase()
            .includes(term)
      )
      .slice(0, 80);
  }, [customers, searchTerm]);

  const inputDisplayValue =
    selectedCustomerCode && selectedCustomer && !searchTerm
      ? `${selectedCustomer.code} - ${selectedCustomer.name}`
      : searchTerm;

  const pickCustomer = (c: (typeof customers)[0]) => {
    setSelectedCustomerCode(String(c.code).trim());
    setSearchTerm('');
    setSuggestionsOpen(false);
  };

  const clearCustomerFilter = () => {
    setSelectedCustomerCode('');
    setSearchTerm('');
    setSuggestionsOpen(false);
  };

  const buildCustomerContext = (): AiCustomerContext | null => {
    if (!selectedCustomerCode || !selectedCustomer) return null;

    const salesSummary = selectedSales
      ? buildSalesSummaryForAi(selectedSales)
      : `Khong tim thay dong DOANH_SO trong app cho ma da chon "${normCode(selectedCustomerCode)}" (da doi chieu ca CustomerCode lan CodeBuyMed). Can kiem tra ma tren sheet DOANH_SO trung voi danh muc KH.`;

    const forecastSummary = selectedForecast
      ? `ImportLevel: ${selectedForecast.ImportLevel || '-'}, LocalLevel: ${selectedForecast.LocalLevel || '-'}, ExpectedTotalT2: ${Number(selectedForecast.ExpectedTotalT2 || 0).toLocaleString('vi-VN')}, TargetMonthly: ${Number(selectedForecast.TargetMonthly || 0).toLocaleString('vi-VN')}`
      : 'Chua co dong ForecastRecord cho ma nay.';

    return {
      customerCode: selectedCustomer.code,
      customerName: selectedCustomer.name,
      address: selectedCustomer.address,
      salesSummary,
      forecastSummary,
    };
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError(null);
    const userMessage: AiChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    const result = await submitAiChat(GOOGLE_SCRIPT_URL, {
      message: trimmed,
      employeeName: currentEmployee.name,
      customerContext: buildCustomerContext(),
    });

    if (result.status === 'success' && result.answer) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer || 'AI khong tra ve noi dung.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      setError(result.message || 'AI khong the phan hoi luc nay.');
    }

    setIsSending(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">AI Tu van</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gõ tên hoặc mã KH, chọn một dòng trong danh sách — AI dùng ngữ cảnh doanh số cho KH đó.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Tìm &amp; chọn khách hàng
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-[1]">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  value={inputDisplayValue}
                  onChange={(e) => {
                    setSelectedCustomerCode('');
                    setSearchTerm(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    if (blurTimerRef.current) {
                      clearTimeout(blurTimerRef.current);
                      blurTimerRef.current = null;
                    }
                    setSuggestionsOpen(true);
                  }}
                  onBlur={() => {
                    blurTimerRef.current = setTimeout(() => setSuggestionsOpen(false), 180);
                  }}
                  placeholder="Gõ tên nhà thuốc hoặc mã..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
                {suggestionsOpen &&
                  searchTerm.trim().length > 0 &&
                  !selectedCustomerCode &&
                  suggestions.length > 0 && (
                    <ul
                      role="listbox"
                      className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg"
                    >
                      {suggestions.map((c) => (
                        <li key={String(c.code)}>
                          <button
                            type="button"
                            role="option"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-opella-beige/60 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickCustomer(c)}
                          >
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{c.code}</span>
                            <span className="text-slate-800 dark:text-slate-100"> — {c.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                {suggestionsOpen &&
                  searchTerm.trim().length > 0 &&
                  !selectedCustomerCode &&
                  suggestions.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 shadow-lg">
                      Không tìm thấy khách hàng phù hợp
                    </div>
                  )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearCustomerFilter}
              disabled={!searchTerm.trim() && !selectedCustomerCode}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Xóa lọc
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {selectedCustomerCode && selectedCustomer
              ? `Đã chọn: ${selectedCustomer.code} — ${selectedCustomer.name}`
              : searchTerm.trim()
                ? `Gợi ý: ${suggestions.length} khách hàng (tối đa 80 dòng) · Tổng ${customers.length} trong danh mục`
                : `Tổng ${customers.length} khách hàng — gõ để tìm`}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 h-[60vh] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-opella-green text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="text-xs text-slate-500 dark:text-slate-400">AI dang soan cau tra loi...</div>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhap cau hoi de AI tu van..."
            className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm h-20"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="h-10 px-4 rounded-lg bg-opella-green text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <PaperAirplaneIcon />
            Gui
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiTuVanTab;
