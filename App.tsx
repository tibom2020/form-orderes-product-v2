
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PRODUCTS, EMPLOYEES, PROMO_UPDATE_DATE, GOOGLE_SCRIPT_URL, DUMMY_BOX_DISCOUNT, TELFAST_GROUP_IDS, OSTELIN_GROUP_IDS, ACEMUC_GROUP_IDS, OSTELIN_60V_PRODUCT_ID, OSTELIN_60V_GOI_MIN_QTY, OSTELIN_60V_GOI_SHEET, CALCIPLUS_PROMO_PACK_SIZE, CALCIPLUS_PROMO_DISCOUNT_PERCENT, PACK_476_PRODUCT_IDS } from './constants';
import type { Product, CartItem, Employee, Order, Customer, Rebate, RebateBm, SalesRecord, PurchaseHistoryItem, MarketingRecord, ForecastItem, AdminNewsItem, RebateCustomerNoticePayload } from './types';
import ProductCard from './components/ProductCard';
import Cart from './components/Cart';
import Login, { PostLoginLoadingScreen } from './components/Login';
import OrderHistory from './components/OrderHistory';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import ForecastTab from './components/ForecastTab';
import RebateTab from './components/RebateTab';
import PriceListTab from './components/PriceListTab';
import AoTrackingTab from './components/AoTrackingTab';
import SaleKhPsTab from './components/SaleKhPsTab';
import QuarterSalesTrackingTab from './components/QuarterSalesTrackingTab';
import OrderSuccessModal from './components/OrderSuccessModal'; // Import Modal
import AdminNewsWidget from './components/AdminNewsWidget';
import { ChartBarIcon, ClipboardDocumentListIcon, SunIcon, MoonIcon, SearchIcon, GlobeAmericasIcon, HomeIcon, CubeIcon, StarIcon, TrendingUpIcon, BanknotesIcon, TagIcon, ClockIcon, IdentificationIcon, DeviceTabletIcon, ArrowsRotateIcon } from './components/icons';
import CalciPlusTab from './components/CalciPlusTab';
import Ostelin60VTab from './components/Ostelin60VTab';
import RepActiveAcemucOstelinTab from './components/RepActiveAcemucOstelinTab';
import GiaThamKhaoTab from './components/GiaThamKhaoTab';
import StoreProgramRegistrationTab, { STORE_PROGRAM_TAB_LABEL } from './components/StoreProgramRegistrationTab';
import AiTuVanTab from './components/AiTuVanTab';
import PurchaseHistoryTab from './components/PurchaseHistoryTab';
import { postOrderToGoogleSheet, fetchDataFromSheet, submitAdminNews, submitRebateCustomerNotice, submitCustomerSalesNotice } from './services/googleSheetService';
import { getOrders, saveOrders } from './utils/storage';
import { calculateLineTotal, getDiscountPercent } from './utils/calculations';
import { generateCustomerSummary, buildCustomerSalesNoticePayload } from './utils/customerSummarizer';
import { getInitials, formatCurrency } from './utils/formatters';
import { buildProductTargetsFromSheet } from './components/dashboard/DashboardUtils';
import { getDummyBoxAmountEligibility } from './utils/dummyBoxEligibility';
import { mergeDummyBoxMarketingByCode, buildDummyBoxListGate, normalizeCustomerCodeKey } from './utils/dummyBoxGate';
import { isOstelin60VDot2Order, noteHasOstelinTangCan } from './utils/ostelin60v';
import { normalizeDangKyTbq2Row } from './utils/displayTbq2Sheet';
import { buildPsCustomerMap, lookupPsCustomerGate } from './utils/psCustomerRegistry';
import {
  calcPsOrderTotals,
  mergePsOnInvoiceNote,
  stripPsOnInvoiceNoteLines,
  buildPsOnInvoiceNoteLine,
  cartItemForPsPricing,
} from './utils/psOnInvoicePromo';
import {
  computeCartGroupTotals,
  computeMaxPayableFees,
  computeAppliedRebates,
  MAX_PRODUCT_DISCOUNT_RATIO,
  MAX_PRODUCT_DISCOUNT_RATIO_STANDARD,
} from './utils/orderDiscountCaps';


const ADMIN_CODE = '20043741'; // Phan Viet Linh

/** Gói CK PS 25% — không kết hợp trả phí rebate trên đơn */
function stripRebatePaymentFromNote(note: string): string {
  return note
    .split('\n')
    .filter((line) => !/^TRẢ PHÍ\s/i.test(line.trim()))
    .join('\n')
    .replace(/\s*Trả tối đa phí Local\s*/gi, ' ')
    .replace(/\s*Trả tối đa phí Import\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Tạm ẩn tab — đặt `true` để hiện lại: Báo giá & CTKM, Theo dõi AO, Sale KH PS, DS Quý 1 KH, Gói 4.76% */
const SHOW_PRICE_LIST_TAB = false;
const SHOW_AO_TRACKING_TAB = false;
const SHOW_SALE_KH_PS_TAB = false;
const SHOW_QUARTER_SALES_TRACKING_TAB = false;
const SHOW_CALCI_PLUS_TAB = false;
const SHOW_OSTELIN_60V_TAB = true;

/** Tải DANH_MUC_KH khi đăng nhập — hủy sau N ms để không kẹt màn “đang tải” vô hạn. */
const POST_LOGIN_CATALOG_TIMEOUT_MS = 20_000;

type ViewMode = 'order' | 'dashboard' | 'storeRegistration' | 'landing' | 'landingBsT3' | 'forecast' | 'rebate' | 'priceList' | 'aoTracking' | 'saleKhPs' | 'quarterSalesTracking' | 'ostelin60v' | 'calciPlus' | 'giaThamKhao' | 'aiTuVan' | 'lixi' | 'purchaseHistory' | 'repActiveAcemucOstelin';

const App: React.FC = () => {
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(null);
  /** Sau đăng nhập: tải DANH_MUC_KH (màn loading); phần còn lại tải nền */
  const [postLoginHydrating, setPostLoginHydrating] = useState(false);
  const [isSuperUser, setIsSuperUser] = useState(false);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allRebates, setAllRebates] = useState<Rebate[]>([]);
  const [allRebatesBm, setAllRebatesBm] = useState<RebateBm[]>([]);
  const [allSalesRecords, setAllSalesRecords] = useState<SalesRecord[]>([]);
  const [allPurchaseHistory, setAllPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [marketingData, setMarketingData] = useState<MarketingRecord[]>([]);
  const [marketingDataBs, setMarketingDataBs] = useState<MarketingRecord[]>([]);
  /** True sau khi loadCriticalData hoàn tất phần DummyBox (kể cả mảng rỗng) */
  const [dummyBoxSheetsReady, setDummyBoxSheetsReady] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]); // State mới cho Forecast
  const [viewMode, setViewMode] = useState<ViewMode>('order');
  const [showDummyBoxReminderOnMount, setShowDummyBoxReminderOnMount] = useState(false);
  const [showSaleKhPsReportOnMount, setShowSaleKhPsReportOnMount] = useState(false);
  const hasShownLoginReminder = useRef(false);
  /** Tab PS 2026: mount một lần, ẩn khi đổi tab — giữ dữ liệu sheet đã tải */
  const [storePsTabMounted, setStorePsTabMounted] = useState(false);

  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<'All' | 'Local' | 'Import'>('All');
  const [isLoading, setIsLoading] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOnTopLiXi, setIsOnTopLiXi] = useState(false);
  const [isDummyBoxLocal, setIsDummyBoxLocal] = useState(false);
  const [isDummyBoxImport, setIsDummyBoxImport] = useState(false);
  const [isCalciPlusPack476, setIsCalciPlusPack476] = useState(false);
  const [isPsOnInvoice25, setIsPsOnInvoice25] = useState(false);
  const [psCustomerByCode, setPsCustomerByCode] = useState(
    () => new Map<string, import('./utils/psCustomerRegistry').PsCustomerGate>()
  );

  const [selectedRebateIds, setSelectedRebateIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Order[]>([]);
  const [sentOrders, setSentOrders] = useState<Order[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<AdminNewsItem[]>([]);
  const [gppComments, setGppComments] = useState<Record<string, string>>({});
  const [productTargetsByEmployee, setProductTargetsByEmployee] = useState<Record<string, Record<string, number>>>({});
  /** Sheet OSTELIN_60V_GOI — khóa tick gói Ostelin nếu KH đã có SL gói > 0 */
  const [ostelin60VGoiRows, setOstelin60VGoiRows] = useState<Record<string, unknown>[]>([]);

  // State mới để điều khiển hiển thị Modal Thành Công
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);

  // State để điều hướng từ Rebate sang Dashboard Detail
  const [dashboardCustomerCode, setDashboardCustomerCode] = useState<string | null>(null);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  /** Admin: mô phỏng viewport iPad 10 (Safari ~820×1180 CSS px) trên desktop */
  const [adminIpadPreviewOn, setAdminIpadPreviewOn] = useState(false);
  const [adminIpadLandscape, setAdminIpadLandscape] = useState(false);

  useEffect(() => {
    if (!adminIpadPreviewOn) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      if (!mq.matches) {
        setAdminIpadPreviewOn(false);
        setAdminIpadLandscape(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [adminIpadPreviewOn]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  /** Zoom UI (CSS zoom) — toàn app, lưu localStorage. Phạm vi 0.7–1.5 */
  const UI_ZOOM_MIN = 0.7;
  const UI_ZOOM_MAX = 1.5;
  const UI_ZOOM_STEP = 0.1;
  const [uiZoom, setUiZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const v = parseFloat(localStorage.getItem('ui-zoom') ?? '1');
    return Number.isFinite(v) && v >= UI_ZOOM_MIN && v <= UI_ZOOM_MAX ? v : 1;
  });
  useEffect(() => {
    localStorage.setItem('ui-zoom', String(uiZoom));
  }, [uiZoom]);
  const clampZoom = (v: number) => Math.max(UI_ZOOM_MIN, Math.min(UI_ZOOM_MAX, Math.round(v * 10) / 10));
  const zoomIn = () => setUiZoom(z => clampZoom(z + UI_ZOOM_STEP));
  const zoomOut = () => setUiZoom(z => clampZoom(z - UI_ZOOM_STEP));
  const zoomReset = () => setUiZoom(1);

  useEffect(() => {
    setDrafts(getOrders('draftOrders'));
    setSentOrders(getOrders('sentOrders'));
  }, []);

  // Refs để lazy load chỉ 1 lần
  const hasLoadedPurchaseHistory = useRef(false);
  const hasLoadedGppComments = useRef(false);
  const hasLoadedForecast = useRef(false);

  /** Phase 1: Dữ liệu cốt lõi cho Order/Rebate/Landing. `skipDangMucKh`: đã tải DANH_MUC_KH ở bước trước (post-login). */
  const loadCriticalData = async (options?: { skipDangMucKh?: boolean }) => {
    setDummyBoxSheetsReady(false);
    try {
      let rebates: Rebate[];
      let sales: SalesRecord[];
      let marketing: MarketingRecord[];
      if (options?.skipDangMucKh) {
        [rebates, sales, marketing] = await Promise.all([
          fetchDataFromSheet<Rebate>(GOOGLE_SCRIPT_URL, "REBATE"),
          fetchDataFromSheet<SalesRecord>(GOOGLE_SCRIPT_URL, "DOANH_SO"),
          fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecord"),
        ]);
      } else {
        const [customers, r, s, m] = await Promise.all([
          fetchDataFromSheet<Customer>(GOOGLE_SCRIPT_URL, "DANH_MUC_KH"),
          fetchDataFromSheet<Rebate>(GOOGLE_SCRIPT_URL, "REBATE"),
          fetchDataFromSheet<SalesRecord>(GOOGLE_SCRIPT_URL, "DOANH_SO"),
          fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecord"),
        ]);
        setAllCustomers(customers);
        rebates = r;
        sales = s;
        marketing = m;
      }
      setAllRebates(rebates);
      try {
        const bm = await fetchDataFromSheet<RebateBm>(GOOGLE_SCRIPT_URL, "REBATE_BM");
        setAllRebatesBm(bm || []);
      } catch (e) {
        console.warn("REBATE_BM sheet load failed (optional sheet)", e);
        setAllRebatesBm([]);
      }
      // Ghép thêm dữ liệu đăng ký TB Q2 từ sheet DANGKYTBQ2 vào từng SalesRecord theo mã KH.
      // Nếu sheet thiếu/không có dữ liệu thì vẫn giữ nguyên sales như cũ.
      let salesWithTbQ2 = sales;
      try {
        const dangKyRows = await fetchDataFromSheet<Record<string, unknown>>(GOOGLE_SCRIPT_URL, "DANGKYTBQ2");
        const byCode = new Map<string, string>();
        (dangKyRows || []).forEach((row) => {
          const code = String(
            row['CustomerCode'] ??
            row['Customer Code'] ??
            row['MaKH'] ??
            row['Mã KH'] ??
            ''
          ).trim();
          if (!code) return;
          const finalStoreTypeQ2 = String(
            row['FinalStoreTypeQ2'] ??
            row['Final Store Type Q2'] ??
            row['FinalStoreType Q2'] ??
            ''
          ).trim();
          byCode.set(code, finalStoreTypeQ2);
        });
        salesWithTbQ2 = (sales || []).map((s) => ({
          ...s,
          FinalStoreTypeQ2: byCode.get(String(s.CustomerCode || '').trim()) || '',
        }));
        const normalizedDk = (dangKyRows || []).map(r =>
          normalizeDangKyTbq2Row(r as Record<string, unknown>)
        );
        setPsCustomerByCode(buildPsCustomerMap(normalizedDk));
      } catch (e) {
        console.warn("DANGKYTBQ2 sheet load failed (optional sheet)", e);
        setPsCustomerByCode(new Map());
      }
      setAllSalesRecords(salesWithTbQ2);
      setMarketingData(marketing);
      try {
        const marketingBs = await fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecordBs");
        setMarketingDataBs(marketingBs || []);
      } catch (e) {
        console.warn("DummyBoxRecordBs sheet load failed (optional sheet)", e);
        setMarketingDataBs([]);
      }
      try {
        const ostelinGoi = await fetchDataFromSheet<Record<string, unknown>>(GOOGLE_SCRIPT_URL, OSTELIN_60V_GOI_SHEET);
        setOstelin60VGoiRows(ostelinGoi || []);
      } catch (e) {
        console.warn("OSTELIN_60V_GOI sheet load failed (optional sheet)", e);
        setOstelin60VGoiRows([]);
      }
    } catch (e) {
      console.error("Critical data load failed", e);
    } finally {
      setDummyBoxSheetsReady(true);
    }
  };

  /** Phase 2: Dữ liệu cho Dashboard/News (2 API) — load sau Phase 1 */
  const loadSecondaryData = async () => {
    try {
      const [news, targetRows] = await Promise.all([
        fetchDataFromSheet<AdminNewsItem>(GOOGLE_SCRIPT_URL, 'ADMIN_NEWS'),
        fetchDataFromSheet<Record<string, unknown>>(GOOGLE_SCRIPT_URL, 'TARGET'),
      ]);
      setNewsItems(news || []);
      const targets = buildProductTargetsFromSheet(targetRows || []);
      setProductTargetsByEmployee(targets);
    } catch (e) {
      console.error("Secondary data load failed", e);
    }
  };

  /** Lazy: Forecast — chỉ load khi mở tab Landing / Dashboard / Forecast */
  const loadForecastData = async () => {
    if (hasLoadedForecast.current) return;
    hasLoadedForecast.current = true;
    try {
      const forecasts = await fetchDataFromSheet<ForecastItem>(GOOGLE_SCRIPT_URL, "ForecastRecord");
      setForecastData(forecasts);
    } catch (e) {
      console.error("Forecast load failed", e);
      hasLoadedForecast.current = false;
    }
  };

  /** Lazy: Lịch sử mua hàng — chỉ load khi mở Dashboard */
  const loadPurchaseHistory = async () => {
    if (hasLoadedPurchaseHistory.current) return;
    hasLoadedPurchaseHistory.current = true;
    try {
      const [historyGG, historyBM] = await Promise.all([
        fetchDataFromSheet<PurchaseHistoryItem>(GOOGLE_SCRIPT_URL, "HISTORY_GG"),
        fetchDataFromSheet<PurchaseHistoryItem>(GOOGLE_SCRIPT_URL, "HISTORY_BM"),
      ]);
      setAllPurchaseHistory([
        ...(historyGG || []).map((h) => ({ ...h, HistorySource: 'GG' as const })),
        ...(historyBM || []).map((h) => ({ ...h, HistorySource: 'BM' as const })),
      ]);
    } catch (e) {
      console.error("Purchase history load failed", e);
      hasLoadedPurchaseHistory.current = false;
    }
  };

  /** Lazy: GPP Comment — chỉ load khi mở tab Rebate */
  const loadGppComments = async () => {
    if (hasLoadedGppComments.current) return;
    hasLoadedGppComments.current = true;
    try {
      const gppCommentRows = await fetchDataFromSheet<Record<string, unknown>>(GOOGLE_SCRIPT_URL, 'GPP_COMMENT');
      const GPP_VALUES = ['no_change', 'change_code', 'subtract_before_block', 'abandon_old_code'];
      const GPP_LABELS: Record<string, string> = {
        '1. KH không đổi pháp nhân - code giữ nguyên': 'no_change',
        '2. KH có đổi pháp nhân : thay đổi code': 'change_code',
        '2.1. KH sẽ trừ hết phí trước thời điểm block code': 'subtract_before_block',
        '2.2. KH bỏ phí ở code cũ còn lại': 'abandon_old_code',
      };
      const commentMap: Record<string, string> = {};
      (gppCommentRows || []).forEach((row: Record<string, unknown>) => {
        const code = String(row['Code KH'] ?? row['customerCode'] ?? row['code'] ?? '').trim();
        let val = String(row['commentValue'] ?? '').trim();
        if (!val) {
          const label = String(row['Comment'] ?? '').trim();
          val = GPP_LABELS[label] || (GPP_VALUES.includes(label) ? label : '');
        }
        if (code && val) commentMap[code] = val;
      });
      setGppComments(commentMap);
    } catch (e) {
      console.error("GPP comments load failed", e);
      hasLoadedGppComments.current = false;
    }
  };

  /** Sau đăng nhập: chỉ chặn UI để tải DANH_MUC_KH; rebate/doanh số/… tải nền (không kẹt màn hình). */
  useEffect(() => {
    if (!loggedInEmployee || !postLoginHydrating) return;
    let cancelled = false;
    const run = async () => {
      try {
        const customers = await fetchDataFromSheet<Customer>(GOOGLE_SCRIPT_URL, "DANH_MUC_KH", {
          timeoutMs: POST_LOGIN_CATALOG_TIMEOUT_MS,
        });
        if (!cancelled) setAllCustomers(customers);
      } catch (e) {
        console.error("Danh mục KH (post-login) load failed", e);
      } finally {
        if (!cancelled) {
          setPostLoginHydrating(false);
          void (async () => {
            try {
              await loadCriticalData({ skipDangMucKh: true });
              await loadSecondaryData();
            } catch (e) {
              console.error("Background sheet sync after login failed", e);
            }
          })();
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loggedInEmployee, postLoginHydrating]);

  /** Lazy load khi mở Dashboard hoặc tab Lịch sử mua hàng */
  useEffect(() => {
    if (viewMode === 'dashboard' || viewMode === 'purchaseHistory') loadPurchaseHistory();
  }, [viewMode]);

  /** Lazy load khi mở Rebate */
  useEffect(() => {
    if (viewMode === 'rebate') loadGppComments();
  }, [viewMode]);

  /** Lazy load Forecast khi mở Landing / Dashboard / Forecast */
  useEffect(() => {
    if (viewMode === 'landing' || viewMode === 'landingBsT3' || viewMode === 'dashboard' || viewMode === 'forecast') loadForecastData();
  }, [viewMode]);

  /** Reload toàn bộ dữ liệu (dùng cho nút Tải lại ở Forecast/Landing) */
  const handleReloadAllData = async () => {
    hasLoadedPurchaseHistory.current = false;
    hasLoadedGppComments.current = false;
    hasLoadedForecast.current = false;
    await loadCriticalData();
    await loadSecondaryData();
    if (viewMode === 'dashboard' || viewMode === 'purchaseHistory') await loadPurchaseHistory();
    if (viewMode === 'rebate') await loadGppComments();
    if (['landing', 'dashboard', 'forecast'].includes(viewMode)) await loadForecastData();
  };

  // Khi đăng nhập: nếu tab Sale KH PS bật — sang PS + báo cáo; nếu tạm ẩn — ở Đặt hàng
  useEffect(() => {
    if (loggedInEmployee && !hasShownLoginReminder.current) {
      hasShownLoginReminder.current = true;
      setShowDummyBoxReminderOnMount(false);
      if (SHOW_SALE_KH_PS_TAB) {
        setViewMode('saleKhPs');
        setShowSaleKhPsReportOnMount(true);
      } else {
        setViewMode('order');
        setShowSaleKhPsReportOnMount(false);
      }
    }
  }, [loggedInEmployee]);

  /** Tránh kẹt view khi tab tạm ẩn */
  useEffect(() => {
    if (!SHOW_PRICE_LIST_TAB && viewMode === 'priceList') setViewMode('order');
    if (!SHOW_AO_TRACKING_TAB && viewMode === 'aoTracking') setViewMode('order');
    if (!SHOW_SALE_KH_PS_TAB && viewMode === 'saleKhPs') setViewMode('order');
    if (!SHOW_QUARTER_SALES_TRACKING_TAB && viewMode === 'quarterSalesTracking') setViewMode('order');
    if (!SHOW_CALCI_PLUS_TAB && viewMode === 'calciPlus') setViewMode('order');
    if (!SHOW_OSTELIN_60V_TAB && viewMode === 'ostelin60v') setViewMode('order');
  }, [viewMode]);

  /** Tab AI Tư vấn chỉ dành cho Admin; tránh kẹt view khi đổi nhân viên trong dropdown */
  useEffect(() => {
    if (viewMode === 'aiTuVan' && loggedInEmployee?.code !== ADMIN_CODE) {
      setViewMode('order');
    }
  }, [viewMode, loggedInEmployee]);

  const handleLoginSuccess = (employee: Employee) => {
    setLoggedInEmployee(employee);
    setPostLoginHydrating(true);
    if (employee.code === ADMIN_CODE) {
      setIsSuperUser(true);
    }
  };

  const resetOrderState = () => {
    setCustomerCode('');
    setCustomerName('');
    setCustomerAddress('');
    setCart([]);
    setNote('');
    setIsOnTopLiXi(false);
    setIsDummyBoxLocal(false);
    setIsDummyBoxImport(false);
    setIsCalciPlusPack476(false);
    setIsPsOnInvoice25(false);
    setSelectedRebateIds([]);
    setActiveDraftId(null);
  }

  const handleLogout = () => {
    setDummyBoxSheetsReady(false);
    setLoggedInEmployee(null);
    setPostLoginHydrating(false);
    setIsSuperUser(false);
    resetOrderState();
    setStorePsTabMounted(false);
    setViewMode('order');
  };

  const openStoreRegistrationTab = () => {
    setStorePsTabMounted(true);
    setViewMode('storeRegistration');
  };

  const toggleNoteLine = (lineText: string, checked: boolean) => {
    setNote(prevNote => {
      const lines = prevNote
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      const hasLine = lines.includes(lineText);

      if (checked) {
        return hasLine ? prevNote : [...lines, lineText].join('\n');
      }

      return lines.filter(line => line !== lineText).join('\n');
    });
  };

  const handleDummyBoxLocalToggle = (checked: boolean) => {
    setIsDummyBoxLocal(checked);
    toggleNoteLine('DummyBox Local -150k', checked);
  };
  const handleDummyBoxImportToggle = (checked: boolean) => {
    setIsDummyBoxImport(checked);
    toggleNoteLine('DummyBox Import -150k', checked);
  };
  const psGate = useMemo(
    () => lookupPsCustomerGate(psCustomerByCode, customerCode),
    [psCustomerByCode, customerCode]
  );

  useEffect(() => {
    if (!isPsOnInvoice25) return;
    if (!psGate?.canShowCk25) {
      setIsPsOnInvoice25(false);
      setNote(prev => stripPsOnInvoiceNoteLines(prev));
    }
  }, [psGate?.canShowCk25, customerCode, isPsOnInvoice25]);

  useEffect(() => {
    if (!isPsOnInvoice25 || !psGate?.tierConfig) return;
    setNote(prev =>
      mergePsOnInvoiceNote(prev, buildPsOnInvoiceNoteLine(psGate.tierConfig.label))
    );
  }, [cart, isPsOnInvoice25, psGate?.tierConfig]);

  useEffect(() => {
    if (!isPsOnInvoice25) return;
    setSelectedRebateIds((prev) => (prev.length === 0 ? prev : []));
    setNote((prev) => {
      const stripped = stripRebatePaymentFromNote(prev);
      return stripped === prev ? prev : stripped;
    });
  }, [isPsOnInvoice25]);

  const handlePsOnInvoice25Toggle = (checked: boolean) => {
    if (!psGate?.tierConfig) return;
    setIsPsOnInvoice25(checked);
    if (checked) {
      setCart(prev => prev.map(cartItemForPsPricing));
      setSelectedRebateIds([]);
      setNote(prev =>
        mergePsOnInvoiceNote(
          stripRebatePaymentFromNote(prev),
          buildPsOnInvoiceNoteLine(psGate.tierConfig.label)
        )
      );
      setIsOnTopLiXi(false);
      setIsCalciPlusPack476(false);
    } else {
      setCart(prev =>
        prev.map(item => {
          const catalog = PRODUCTS.find(p => p.id === item.id);
          return catalog ? { ...item, price: catalog.price, basePrice: catalog.basePrice } : item;
        })
      );
      setNote(prev => stripPsOnInvoiceNoteLines(prev));
    }
  };

  const handleCalciPlusPack476Toggle = (checked: boolean) => {
    setIsCalciPlusPack476(checked);
    setNote(prevNote => {
      const legacy = 'CORBIERE CALCIUM PLUS gói 21h -4.76%';
      const next = prevNote
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== legacy);
      const lineText = 'Gói 4.76%';
      const hasLine = next.includes(lineText);
      if (checked) return hasLine ? next.join('\n') : [...next, lineText].join('\n');
      return next.filter(line => line !== lineText).join('\n');
    });
  };

  const handleSwitchEmployee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    const selectedEmp = EMPLOYEES.find(emp => emp.code === selectedCode);
    if (selectedEmp) {
      setLoggedInEmployee(selectedEmp);
    }
  };

  const handleCustomerCodeChange = (code: string | number) => {
    const codeStr = String(code ?? '');
    setCustomerCode(codeStr);
    const cleanCode = codeStr.trim();
    const foundCustomer = allCustomers.find(c => String(c.code) === cleanCode);
    if (foundCustomer) {
      setCustomerName(foundCustomer.name);
      setCustomerAddress(foundCustomer.address || '');
    } else {
      setCustomerName('');
      setCustomerAddress('');
    }
    setSelectedRebateIds([]);
  };

  const handleCustomerSelectFromDashboard = (code: string) => {
    handleCustomerCodeChange(code);
    setViewMode('order');
    setDashboardCustomerCode(null); // Clear search term when moving to order
  };

  const handleQuickViewCustomer = (code: string) => {
    if (!code) return;
    setDashboardCustomerCode(code);
    setViewMode('dashboard');
  };

  const handlePublishGppNotice = async (message: string) => {
    const timestamp = new Date().toLocaleString('vi-VN');
    const result = await submitAdminNews(GOOGLE_SCRIPT_URL, {
      adminName: loggedInEmployee!.name,
      message,
      timestamp
    });
    if (result.status === 'success') {
      setNewsItems(prev => [...prev, { timestamp, adminName: loggedInEmployee!.name, message, type: 'alert' }]);
    } else {
      throw new Error(result.message);
    }
  };

  const handlePublishCustomerNotice = async (payload: RebateCustomerNoticePayload) => {
    const result = await submitRebateCustomerNotice(GOOGLE_SCRIPT_URL, payload);
    if (result.status !== 'success') {
      throw new Error(result.message || 'Gửi thông báo thất bại.');
    }
  };

  const handleExportSales = async (record: SalesRecord) => {
    const employeeName = loggedInEmployee?.name || record.Rep || '';
    const payload = buildCustomerSalesNoticePayload(record, employeeName);
    if (!payload) throw new Error('Không có dữ liệu khách hàng.');
    const result = await submitCustomerSalesNotice(GOOGLE_SCRIPT_URL, payload);
    if (result.status !== 'success') {
      throw new Error(result.message || 'Gửi thông tin doanh số thất bại.');
    }
  };

  const handleRebateCustomerClick = (code: string | number) => {
    setDashboardCustomerCode(String(code));
    setViewMode('dashboard');
  };

  const currentCustomerRebates = useMemo(() => {
    const codeStr = String(customerCode ?? '').trim();
    return allRebates.filter(r => String(r.code) === codeStr);
  }, [allRebates, customerCode]);

  const mergedDummyBoxMarketingByCode = useMemo(
    () => mergeDummyBoxMarketingByCode([...marketingData, ...marketingDataBs]),
    [marketingData, marketingDataBs]
  );

  const dummyBoxListGate = useMemo(() => {
    const code = normalizeCustomerCodeKey(customerCode);
    const orderHadLocal = sentOrders.some(
      o => normalizeCustomerCodeKey(o.customerCode) === code && !!o.isDummyBoxLocal
    );
    const orderHadImport = sentOrders.some(
      o => normalizeCustomerCodeKey(o.customerCode) === code && !!o.isDummyBoxImport
    );
    return buildDummyBoxListGate(code, mergedDummyBoxMarketingByCode, {
      orderHadDummyBoxLocal: orderHadLocal,
      orderHadDummyBoxImport: orderHadImport,
      pending: !dummyBoxSheetsReady,
    });
  }, [customerCode, mergedDummyBoxMarketingByCode, sentOrders, dummyBoxSheetsReady]);

  /** KH đã có gói Ostelin 60V (Đợt 1) — không tick tặng máy đo HA / ghi sheet Đợt 2; vẫn CK 5h 21.67% */
  const ostelin60VGoiPurchasedCodeSet = useMemo(() => {
    const purchased = new Set<string>();
    ostelin60VGoiRows.forEach((row) => {
      const code = String(row['CustomerCode'] ?? '').trim();
      if (!code) return;
      const slGoi =
        Number(row['SL_goi'] ?? row['SL gói 21.67%'] ?? row['SL gói 21.97%'] ?? 0) || 0;
      if (slGoi > 0) purchased.add(code);
    });
    sentOrders.forEach((o) => {
      const code = String(o.customerCode ?? '').trim();
      if (!code) return;
      if ((o.ostelin60VPackages ?? 0) > 0) purchased.add(code);
    });
    return purchased;
  }, [ostelin60VGoiRows, sentOrders]);

  const ostelin60VTangCanLocked = useMemo(() => {
    const code = String(customerCode ?? '').trim();
    if (!code) return false;
    return ostelin60VGoiPurchasedCodeSet.has(code);
  }, [customerCode, ostelin60VGoiPurchasedCodeSet]);

  const handleToggleRebate = (rebateId: string) => {
    if (isPsOnInvoice25) return;
    const rebate = allRebates.find(r => r["PromotionID#program"] === rebateId);
    if (!rebate) return;

    const rebateStr = `TRẢ PHÍ ${rebate["PromotionID#program"]}`;

    setSelectedRebateIds(prev => {
      const isSelecting = !prev.includes(rebateId);
      if (isSelecting) {
        setNote(prevNote => {
          const lines = prevNote.split('\n').map(l => l.trim()).filter(l => l !== '');
          if (!lines.includes(rebateStr)) return [...lines, rebateStr].join('\n');
          return prevNote;
        });
        return [...prev, rebateId];
      } else {
        setNote(prevNote => prevNote.split('\n').filter(line => line.trim() !== rebateStr.trim()).join('\n'));
        return prev.filter(id => id !== rebateId);
      }
    });
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    const line = isPsOnInvoice25 ? cartItemForPsPricing({ ...product, quantity: 0 }) : product;
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? isPsOnInvoice25
              ? cartItemForPsPricing({ ...item, quantity: item.quantity + quantity })
              : { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { ...line, quantity }];
    });
  };

  const handleRemoveItem = (productId: number) => setCart(prevCart => prevCart.filter(item => item.id !== productId));
  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) handleRemoveItem(productId);
    else setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };
  const handleClearCart = () => { resetOrderState(); };


  const createOrderObject = (): Omit<Order, 'id' | 'createdAt' | 'status'> => {
    const totalSales = cart.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);

    const groupTotals = computeCartGroupTotals(cart);
    const { telfastGroupTotal, ostelinGroupBaseTotal, acemucGroupBaseTotal } = groupTotals;

    const psTotalsForOrder =
      isPsOnInvoice25 && psGate?.tierConfig
        ? calcPsOrderTotals(cart, psGate.tierConfig)
        : null;

    const maxPayableFees = computeMaxPayableFees(cart, groupTotals, {
      psDiscountGross: psTotalsForOrder?.discountGross ?? 0,
      maxDiscountRatio: psTotalsForOrder
        ? MAX_PRODUCT_DISCOUNT_RATIO
        : MAX_PRODUCT_DISCOUNT_RATIO_STANDARD,
      excludeMonthlyFromCap: !!psTotalsForOrder,
    });

    const { rebateDiscount: totalRebateDiscount } = computeAppliedRebates(
      currentCustomerRebates,
      selectedRebateIds,
      maxPayableFees
    );

    const { eligibleDummyBoxLocal, eligibleDummyBoxImport } = getDummyBoxAmountEligibility(cart);
    const effectiveDummyBoxLocal =
      !dummyBoxListGate.pending &&
      dummyBoxListGate.inList &&
      eligibleDummyBoxLocal &&
      !dummyBoxListGate.goiLocalRegistered &&
      isDummyBoxLocal;
    const effectiveDummyBoxImport =
      !dummyBoxListGate.pending &&
      dummyBoxListGate.inList &&
      eligibleDummyBoxImport &&
      !dummyBoxListGate.goiImportRegistered &&
      isDummyBoxImport;
    const dummyBoxDiscount =
      (effectiveDummyBoxLocal ? DUMMY_BOX_DISCOUNT : 0) +
      (effectiveDummyBoxImport ? DUMMY_BOX_DISCOUNT : 0);

    if (psTotalsForOrder) {
      return {
        customerCode,
        customerName,
        customerAddress,
        note,
        items: cart,
        isOnTopLiXi: false,
        isDummyBox: effectiveDummyBoxLocal || effectiveDummyBoxImport,
        isDummyBoxLocal: effectiveDummyBoxLocal,
        isDummyBoxImport: effectiveDummyBoxImport,
        isCalciPlusPack476: false,
        isPsOnInvoice25: true,
        appliedRebates: selectedRebateIds,
        totalAmount: psTotalsForOrder.baseSubtotal,
        finalAmount: Math.max(0, psTotalsForOrder.finalAmount - totalRebateDiscount - dummyBoxDiscount),
        totalSales,
      };
    }

    const totalAmount = cart.reduce((sum, item) => {
      const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
      const isOstelinGroup = OSTELIN_GROUP_IDS.includes(item.id);
      const isAcemucGroup = ACEMUC_GROUP_IDS.includes(item.id);
      let compareValue = isTelfastGroup ? telfastGroupTotal
        : isOstelinGroup ? ostelinGroupBaseTotal
        : isAcemucGroup ? acemucGroupBaseTotal
        : item.price * item.quantity;

      return sum + calculateLineTotal(
        item.price,
        item.quantity,
        item.promotion,
        compareValue,
        item.id
      );
    }, 0);

    const onTopLiXiDiscount = isOnTopLiXi ? 250000 : 0;
    const calciPlusPack476Discount = isCalciPlusPack476
      ? cart
          .filter((i) => PACK_476_PRODUCT_IDS.includes(i.id))
          .reduce((sum, item) => {
            const eligibleQty = Math.floor(item.quantity / CALCIPLUS_PROMO_PACK_SIZE) * CALCIPLUS_PROMO_PACK_SIZE;
            if (eligibleQty <= 0) return sum;
            const regularDiscountPercent = getDiscountPercent(item.promotion, item.quantity, item.price * item.quantity, item.id);
            return sum + eligibleQty * item.price * (1 - regularDiscountPercent) * CALCIPLUS_PROMO_DISCOUNT_PERCENT;
          }, 0)
      : 0;

    const finalNote = note;

    const finalAmount = Math.max(0, totalAmount - onTopLiXiDiscount - totalRebateDiscount - dummyBoxDiscount - calciPlusPack476Discount);

    const ostelin60vItem = cart.find(i => i.id === OSTELIN_60V_PRODUCT_ID);
    let ostelin60VPackages = 0;
    let ostelin60VAmount = 0;
    let ostelin60VQuantity: number | undefined;
    let ostelin60VDot2: boolean | undefined;
    const canRecordOstelinTangCanGoi =
      !ostelin60VTangCanLocked &&
      noteHasOstelinTangCan(note) &&
      !!ostelin60vItem &&
      ostelin60vItem.quantity >= OSTELIN_60V_GOI_MIN_QTY;
    if (canRecordOstelinTangCanGoi && ostelin60vItem) {
      ostelin60VPackages = 1;
      ostelin60VQuantity = ostelin60vItem.quantity;
      ostelin60VDot2 = isOstelin60VDot2Order();
      ostelin60VAmount = Math.round(
        calculateLineTotal(
          ostelin60vItem.price,
          ostelin60vItem.quantity,
          ostelin60vItem.promotion,
          ostelinGroupBaseTotal,
          ostelin60vItem.id
        )
      );
    }

    return {
      customerCode, customerName, customerAddress, note: finalNote, items: cart, isOnTopLiXi,
      isDummyBox: effectiveDummyBoxLocal || effectiveDummyBoxImport,
      isDummyBoxLocal: effectiveDummyBoxLocal,
      isDummyBoxImport: effectiveDummyBoxImport,
      isCalciPlusPack476,
      isPsOnInvoice25: false,
      appliedRebates: selectedRebateIds,
      totalAmount, finalAmount, totalSales,
      ostelin60VPackages: ostelin60VPackages > 0 ? ostelin60VPackages : undefined,
      ostelin60VAmount: ostelin60VPackages > 0 ? ostelin60VAmount : undefined,
      ostelin60VQuantity: ostelin60VQuantity,
      ostelin60VDot2: ostelin60VDot2 || undefined,
    };
  };

  const handleSaveDraft = () => {
    if (cart.length === 0) return;
    const orderData = createOrderObject();
    const newDraft: Order = { ...orderData, id: activeDraftId || Date.now().toString(), createdAt: Date.now(), status: 'draft' };
    const updatedDrafts = activeDraftId ? drafts.map(d => d.id === activeDraftId ? newDraft : d) : [newDraft, ...drafts];
    setDrafts(updatedDrafts);
    saveOrders('draftOrders', updatedDrafts);
    setSuccessMessage('Đã lưu nháp!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleSubmitOrder = async () => {
    if (!customerCode || cart.length === 0 || isLoading) return;
    if (isPsOnInvoice25 && psGate?.tierConfig) {
      const psTotals = calcPsOrderTotals(cart, psGate.tierConfig);
      if (!psTotals.eligible) {
        alert(
          `Đơn chưa đạt mức tối thiểu ${psGate.tierLabel}: cần ${formatCurrency(psTotals.minOrder)} (chưa VAT, basePrice). Hiện tại: ${formatCurrency(psTotals.baseSubtotal)}.`
        );
        return;
      }
    }
    setIsLoading(true);
    const orderObj = createOrderObject();

    // Tạo tóm tắt thông tin khách hàng
    const currentSalesRecord = allSalesRecords.find(r => String(r.CustomerCode).trim() === String(customerCode).trim());

    const currentForecast = forecastData.find(f => String(f.CustomerCode).trim() === String(customerCode).trim());


    const customerSummary = generateCustomerSummary(
      currentSalesRecord,
      currentForecast
    );

    const result = await postOrderToGoogleSheet(GOOGLE_SCRIPT_URL, {
      employeeName: loggedInEmployee!.name,
      employeeCode: loggedInEmployee!.code,
      ...orderObj,
      appliedRebates: selectedRebateIds,
      customerSummary: customerSummary // Gửi kèm tóm tắt KPI
    });
    setIsLoading(false);


    if (result.status === 'success') {
      const newSent: Order = { ...orderObj, id: Date.now().toString(), createdAt: Date.now(), status: 'sent' };
      setSentOrders([newSent, ...sentOrders]);
      saveOrders('sentOrders', [newSent, ...sentOrders]);

      if (activeDraftId) {
        const newDrafts = drafts.filter(d => d.id !== activeDraftId);
        setDrafts(newDrafts);
        saveOrders('draftOrders', newDrafts);
      }

      setSubmittedOrder(newSent);
      setSuccessMessage('Đã gửi đơn thành công!');
      setTimeout(() => setSuccessMessage(null), 3200);
    } else {
      alert("Có lỗi xảy ra khi gửi đơn!");
    }
  };

  const handleCloseSuccessModal = () => {
    setSubmittedOrder(null);
    resetOrderState();
  };

  const handleLoadDraft = (id: string) => {
    const d = drafts.find(x => x.id === id);
    if (!d) return;
    setCustomerCode(d.customerCode);
    setCustomerName(d.customerName);
    setCustomerAddress(d.customerAddress);
    const psDraft = !!d.isPsOnInvoice25;
    setCart(psDraft ? d.items.map(cartItemForPsPricing) : d.items);
    setIsOnTopLiXi(d.isOnTopLiXi);
    setIsDummyBoxLocal(!!d.isDummyBoxLocal);
    setIsDummyBoxImport(!!d.isDummyBoxImport);
    setIsCalciPlusPack476(!!d.isCalciPlusPack476);
    setIsPsOnInvoice25(psDraft);
    if (d.isDummyBoxLocal === undefined && d.isDummyBoxImport === undefined && d.isDummyBox) {
      setIsDummyBoxLocal(true);
    }
    setNote(psDraft ? stripRebatePaymentFromNote(d.note) : d.note);
    setSelectedRebateIds(psDraft ? [] : d.appliedRebates || []);
    setActiveDraftId(d.id);
  };

  const handleDeleteDrafts = (ids: string[]) => {
    const updatedDrafts = drafts.filter(d => !ids.includes(d.id));
    setDrafts(updatedDrafts);
    saveOrders('draftOrders', updatedDrafts);
  };

  const handleDeleteSentOrders = (ids: string[]) => {
    const updatedSent = sentOrders.filter(s => !ids.includes(s.id));
    setSentOrders(updatedSent);
    saveOrders('sentOrders', updatedSent);
  };

  const filteredProducts = useMemo(() =>
    PRODUCTS
      .filter(p => productTypeFilter === 'All' || p.type === productTypeFilter)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, productTypeFilter]
  );

  const handleMarketingDataReload = async () => {
    try {
      const marketing = await fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecord");
      setMarketingData(marketing);
    } catch (e) {
      console.error("Reload marketing failed", e);
    }
  };

  const handleMarketingDataBsReload = async () => {
    try {
      const marketing = await fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecordBs");
      setMarketingDataBs(marketing);
    } catch (e) {
      console.error("Reload marketing Bs failed", e);
    }
  };

  const handleUpdateMarketingRecord = (customerCode: string, updates: Partial<MarketingRecord>) => {
    setMarketingData(prevData => prevData.map(record =>
      String(record.CustomerCode).trim() === String(customerCode).trim()
        ? { ...record, ...updates }
        : record
    ));
  };

  const handleUpdateMarketingRecordBs = (customerCode: string, updates: Partial<MarketingRecord>) => {
    setMarketingDataBs(prevData => prevData.map(record =>
      String(record.CustomerCode).trim() === String(customerCode).trim()
        ? { ...record, ...updates }
        : record
    ));
  };

  // Hàm cập nhật Forecast cục bộ ngay lập tức
  const handleUpdateForecast = (
    customerCode: string,
    importLevel: string,
    localLevel: string,
    importValue?: number,
    localValue?: number,
    extraFields?: {
      expectedGigaT2: number;
      expectedBMT2: number;
      expectedTotalT2: number;
      targetMonthly: number;
      reasonNotAchieved?: string;
      reason2?: string;
    }
  ) => {
    setForecastData(prev => {
      // Kiểm tra xem đã có record của KH này chưa
      const exists = prev.find(f => String(f.CustomerCode) === String(customerCode));
      if (exists) {
        return prev.map(f => String(f.CustomerCode) === String(customerCode)
          ? {
            ...f,
            ImportLevel: importLevel,
            LocalLevel: localLevel,
            ImportValue: importValue,
            LocalValue: localValue,
            ExpectedGigaT2: extraFields?.expectedGigaT2,
            ExpectedBMT2: extraFields?.expectedBMT2,
            ExpectedTotalT2: extraFields?.expectedTotalT2,
            TargetMonthly: extraFields?.targetMonthly,
            ReasonNotAchieved: extraFields?.reasonNotAchieved,
            Reason2: extraFields?.reason2
          }
          : f
        );
      } else {
        return [...prev, {
          CustomerCode: customerCode,
          ImportLevel: importLevel,
          LocalLevel: localLevel,
          ImportValue: importValue,
          LocalValue: localValue,
          ExpectedGigaT2: extraFields?.expectedGigaT2,
          ExpectedBMT2: extraFields?.expectedBMT2,
          ExpectedTotalT2: extraFields?.expectedTotalT2,
          TargetMonthly: extraFields?.targetMonthly,
          ReasonNotAchieved: extraFields?.reasonNotAchieved,
          Reason2: extraFields?.reason2,
          Timestamp: new Date().toISOString(),
          Employee: loggedInEmployee?.name
        }];
      }
    });
  };

  /* 
  const handleSubmitLiXi = async (result: LiXiResult) => {
    // ...
  };
  */

  if (!loggedInEmployee) return <Login employees={EMPLOYEES} onLoginSuccess={handleLoginSuccess} />;
  if (postLoginHydrating) return <PostLoginLoadingScreen />;

  const isAdminUser = loggedInEmployee.code === ADMIN_CODE;

  return (
    <div
      className={`min-h-screen font-sans text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200 ${
        adminIpadPreviewOn ? 'bg-slate-600 dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'
      }`}
      style={uiZoom !== 1 ? ({ zoom: uiZoom } as React.CSSProperties) : undefined}
    >
      {/* Hiển thị Modal khi có submittedOrder */}
      {submittedOrder && (
        <OrderSuccessModal
          order={submittedOrder}
          employeeName={loggedInEmployee.name}
          onClose={handleCloseSuccessModal}
        />
      )}

      {isAdminUser && adminIpadPreviewOn && (
        <div
          className="hidden lg:flex fixed top-3 right-4 z-[200] flex-col items-end gap-2"
          role="toolbar"
          aria-label="Chế độ xem iPad (admin)"
        >
          <button
            type="button"
            onClick={() => setAdminIpadLandscape(v => !v)}
            className="flex items-center gap-2 rounded-xl bg-slate-900/92 text-white px-3 py-2 text-xs font-bold shadow-lg border border-white/15 hover:bg-slate-800"
            title="Đổi dọc / ngang"
          >
            <ArrowsRotateIcon />
            <span>{adminIpadLandscape ? 'Dọc' : 'Ngang'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminIpadPreviewOn(false);
              setAdminIpadLandscape(false);
            }}
            className="rounded-xl bg-white/95 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs font-bold shadow-lg border border-slate-200 dark:border-slate-600 hover:bg-white"
          >
            Thoát khung iPad
          </button>
        </div>
      )}

      <div
        className={
          adminIpadPreviewOn
            ? 'flex-1 flex flex-col min-h-0 items-center justify-start py-3 px-2 overflow-auto'
            : 'contents'
        }
      >
        <div
          className={
            adminIpadPreviewOn
              ? `flex flex-col shrink-0 overflow-hidden rounded-[2.25rem] border-[12px] border-slate-950 dark:border-slate-800 shadow-2xl ring-1 ring-black/25 dark:ring-white/10 ${
                  adminIpadLandscape
                    ? 'w-[min(1180px,96vw)] h-[min(820px,88dvh)]'
                    : 'w-[min(820px,96vw)] h-[min(1180px,88dvh)]'
                }`
              : 'contents'
          }
        >
          <div
            className={
              adminIpadPreviewOn
                ? 'flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50 dark:bg-slate-900'
                : 'contents'
            }
          >
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
        <div className="container mx-auto px-4 py-1.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="https://i.postimg.cc/D0p4bsQD/logo.webp" alt="Smart Orders" className="h-12 sm:h-14 w-auto object-contain flex-shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-base sm:text-xl font-black text-opella-green dark:text-opella-green uppercase leading-none whitespace-nowrap">Smart Orders</h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 sm:mt-1 uppercase tracking-tight italic hidden sm:block">Ngày cập nhật CTKM: {PROMO_UPDATE_DATE}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-4">
            {isSuperUser ? (
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700 p-0.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-opella-green dark:bg-opella-green flex items-center justify-center text-white font-black text-xs sm:text-sm shrink-0 shadow-sm">
                  {getInitials(loggedInEmployee.name)}
                </div>
                <select
                  value={loggedInEmployee.code}
                  onChange={handleSwitchEmployee}
                  className="bg-transparent border-none outline-none text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[90px] sm:max-w-xs cursor-pointer"
                >
                  {EMPLOYEES.map(emp => (
                    <option key={emp.code} value={emp.code} className="text-slate-800">
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 hidden md:inline">{loggedInEmployee.name}</span>
            )}

            {isAdminUser && !adminIpadPreviewOn && (
              <button
                type="button"
                onClick={() => setAdminIpadPreviewOn(true)}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 text-[10px] sm:text-xs font-bold shadow-sm border border-indigo-500/80"
                title="Giới hạn khung app theo kích thước iPad 10 (820×1180 CSS px)"
              >
                <DeviceTabletIcon />
                <span className="whitespace-nowrap">View iPad 10</span>
              </button>
            )}

            <div
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/60 overflow-hidden text-slate-700 dark:text-slate-200"
              role="group"
              aria-label="Phóng to / thu nhỏ giao diện"
            >
              <button
                type="button"
                onClick={zoomOut}
                disabled={uiZoom <= UI_ZOOM_MIN + 0.001}
                className="px-2 py-1 text-sm font-black hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Thu nhỏ giao diện"
              >−</button>
              <button
                type="button"
                onClick={zoomReset}
                className="px-2 py-1 text-[11px] font-bold tabular-nums border-l border-r border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 min-w-[3rem]"
                title="Đặt lại 100%"
              >
                {Math.round(uiZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={uiZoom >= UI_ZOOM_MAX - 0.001}
                className="px-2 py-1 text-sm font-black hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Phóng to giao diện"
              >+</button>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              title={darkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={handleLogout} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 sm:px-3 sm:py-1 rounded text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center">
              <span className="hidden sm:inline">Thoát</span>
              <span className="sm:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <div className="flex border-t border-slate-100 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setViewMode('order');
              setDashboardCustomerCode(null);
            }}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'order' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ClipboardDocumentListIcon />
            <span className="hidden sm:inline">Đặt Hàng</span>
            <span className="sm:hidden">Đơn</span>
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'dashboard' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ChartBarIcon />
            <span className="hidden sm:inline">Báo Cáo</span>
            <span className="sm:hidden">BC</span>
          </button>
          <button
            onClick={openStoreRegistrationTab}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'storeRegistration' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <IdentificationIcon />
            <span className="whitespace-nowrap">{STORE_PROGRAM_TAB_LABEL}</span>
          </button>
          <button
            onClick={() => setViewMode('purchaseHistory')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'purchaseHistory' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ClockIcon />
            <span className="hidden sm:inline">Lịch sử MH</span>
            <span className="sm:hidden">LS</span>
          </button>
          <button
            onClick={() => setViewMode('rebate')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'rebate' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <BanknotesIcon />
            <span className="hidden sm:inline">Trả Thưởng</span>
            <span className="sm:hidden">Phí</span>
          </button>
          <button
            onClick={() => setViewMode('landing')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'landing' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <StarIcon />
            <span className="hidden sm:inline">Dummybox</span>
            <span className="sm:hidden">Dummy</span>
          </button>
          <button
            onClick={() => setViewMode('landingBsT3')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${
              viewMode === 'landingBsT3'
                ? 'text-violet-900 border-violet-600 bg-violet-100 dark:bg-violet-950/55 dark:text-violet-50 dark:border-violet-400'
                : 'text-violet-800/90 border-transparent bg-violet-50/70 dark:bg-violet-950/30 dark:text-violet-200/90 hover:bg-violet-100/90 dark:hover:bg-violet-900/45'
            }`}
          >
            <StarIcon />
            <span className="hidden sm:inline">DummyBox - Bs T3+T4</span>
            <span className="sm:hidden">T3+T4</span>
          </button>
          {SHOW_AO_TRACKING_TAB && (
            <button
              onClick={() => setViewMode('aoTracking')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'aoTracking' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <TrendingUpIcon />
              <span className="hidden sm:inline">Theo dõi AO</span>
              <span className="sm:hidden">AO</span>
            </button>
          )}
          {SHOW_SALE_KH_PS_TAB && (
            <button
              onClick={() => setViewMode('saleKhPs')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'saleKhPs' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <StarIcon />
              <span className="hidden sm:inline">Sale KH PS</span>
              <span className="sm:hidden">PS</span>
            </button>
          )}
          {SHOW_QUARTER_SALES_TRACKING_TAB && (
            <button
              onClick={() => setViewMode('quarterSalesTracking')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'quarterSalesTracking' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <ChartBarIcon />
              <span className="hidden sm:inline">DS Quý 1 KH</span>
              <span className="sm:hidden">Q1</span>
            </button>
          )}
          <button
            onClick={() => setViewMode('repActiveAcemucOstelin')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${
              viewMode === 'repActiveAcemucOstelin'
                ? 'text-amber-900 border-amber-600 bg-amber-100 dark:bg-amber-950/55 dark:text-amber-50 dark:border-amber-400'
                : 'text-amber-800/90 border-transparent bg-amber-50/70 dark:bg-amber-950/30 dark:text-amber-200/90 hover:bg-amber-100/90 dark:hover:bg-amber-900/45'
            }`}
          >
            <ChartBarIcon />
            <span className="hidden sm:inline">Active Acemuc / Ostelin</span>
            <span className="sm:hidden">Active</span>
          </button>
          {SHOW_OSTELIN_60V_TAB && (
            <button
              onClick={() => setViewMode('ostelin60v')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${
                viewMode === 'ostelin60v'
                  ? 'text-teal-900 border-teal-600 bg-teal-100 dark:bg-teal-950/55 dark:text-teal-50 dark:border-teal-400'
                  : 'text-teal-800/90 border-transparent bg-teal-50/70 dark:bg-teal-950/30 dark:text-teal-200/90 hover:bg-teal-100/90 dark:hover:bg-teal-900/45'
              }`}
            >
              <CubeIcon />
              <span className="hidden sm:inline">Gói Ostelin 60V</span>
              <span className="sm:hidden">Ostelin</span>
            </button>
          )}
          {SHOW_CALCI_PLUS_TAB && (
            <button
              onClick={() => setViewMode('calciPlus')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${
                viewMode === 'calciPlus'
                  ? 'text-teal-900 border-teal-600 bg-teal-100 dark:bg-teal-950/55 dark:text-teal-50 dark:border-teal-400'
                  : 'text-teal-800/90 border-transparent bg-teal-50/70 dark:bg-teal-950/30 dark:text-teal-200/90 hover:bg-teal-100/90 dark:hover:bg-teal-900/45'
              }`}
            >
              <CubeIcon />
              <span className="hidden sm:inline">Gói 4.76%</span>
              <span className="sm:hidden">4.76%</span>
            </button>
          )}
          <button
            onClick={() => setViewMode('giaThamKhao')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${
              viewMode === 'giaThamKhao'
                ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <TagIcon />
            <span className="hidden sm:inline">Giá tham khảo</span>
            <span className="sm:hidden">Giá TK</span>
          </button>
          {SHOW_PRICE_LIST_TAB && (
            <button
              onClick={() => setViewMode('priceList')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'priceList' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <TagIcon />
              <span className="hidden sm:inline">Báo giá & CTKM</span>
              <span className="sm:hidden">Báo giá</span>
            </button>
          )}
          <button
            onClick={() => setViewMode('forecast')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'forecast' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <TrendingUpIcon />
            <span className="hidden sm:inline">Forecast T3</span>
            <span className="sm:hidden">FC T3</span>
          </button>
          {loggedInEmployee?.code === ADMIN_CODE && (
            <button
              onClick={() => setViewMode('aiTuVan')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'aiTuVan' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <StarIcon />
              <span className="hidden sm:inline">AI Tu van</span>
              <span className="sm:hidden">AI</span>
            </button>
          )}

          {/* Tạm thời ẩn Tab Lì xì theo yêu cầu
          {LIXI_ELIGIBLE_CODES.includes(loggedInEmployee.code) && (
            <button
              onClick={() => setViewMode('lixi')}
              className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'lixi' ? 'text-red-600 border-red-600 bg-red-50 dark:bg-slate-800 dark:text-red-400 dark:border-red-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <GiftIcon />
              <span className="hidden sm:inline">Lì Xì</span>
              <span className="sm:hidden">Lì Xì</span>
            </button>
          )} 
          */}
        </div>

        {viewMode === 'order' && (
          <div className="bg-opella-green py-1.5 sm:py-3 border-t border-opella-green/80 shadow-inner">
            <div className="container mx-auto px-4 flex gap-2 sm:gap-3 items-center">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-white/70">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-white/50 outline-none shadow-sm transition-all text-[13px] sm:text-sm"
                />
              </div>

              <div className="flex bg-white/20 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                {(['All', 'Local', 'Import'] as const).map(f => (
                  <button key={f} onClick={() => setProductTypeFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${productTypeFilter === f ? 'bg-white text-opella-green shadow-sm' : 'text-white/90 hover:text-white'}`}>
                    {f === 'All' && <CubeIcon />}
                    {f === 'Local' && <HomeIcon />}
                    {f === 'Import' && <GlobeAmericasIcon />}
                    <span className="hidden sm:inline">{f}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main
        className={`flex-1 min-w-0 ${viewMode === 'storeRegistration' ? 'w-full max-w-none p-0' : 'container mx-auto p-4'} ${['order', 'dashboard', 'storeRegistration', 'purchaseHistory', 'rebate', 'landing', 'forecast', 'priceList', 'aoTracking', 'saleKhPs', 'quarterSalesTracking', 'ostelin60v', 'calciPlus', 'giaThamKhao', 'aiTuVan', 'repActiveAcemucOstelin'].includes(viewMode) ? 'bg-opella-beige dark:bg-[#1a3028]' : ''}`}
      >
        {viewMode === 'order' && (
          <>
            <div className="flex flex-col-reverse lg:flex-row gap-6 mt-2">
              <div className="lg:w-2/3 space-y-4 lg:order-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onAddToCart={handleAddToCart}
                      hideMonthlyPromo={isPsOnInvoice25}
                    />
                  ))}
                </div>
              </div>
              <div className="lg:w-1/3 lg:order-2">
                <div className="lg:sticky lg:top-[180px] transition-all">
                  <Cart
                    items={cart} employeeName={loggedInEmployee.name} customerCode={customerCode}
                    onCustomerCodeChange={handleCustomerCodeChange} customerName={customerName}
                    onCustomerNameChange={setCustomerName} customerAddress={customerAddress} onCustomerAddressChange={setCustomerAddress}
                    note={note} onNoteChange={setNote}
                    onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart} onSaveDraft={handleSaveDraft}
                    onSubmitOrder={handleSubmitOrder} isLoading={isLoading}
                    successMessage={successMessage}
                    isOnTopLiXi={isOnTopLiXi}
                    isDummyBoxLocal={isDummyBoxLocal} onIsDummyBoxLocalChange={handleDummyBoxLocalToggle}
                    isDummyBoxImport={isDummyBoxImport} onIsDummyBoxImportChange={handleDummyBoxImportToggle}
                    isCalciPlusPack476={isCalciPlusPack476} onIsCalciPlusPack476Change={handleCalciPlusPack476Toggle}
                    activeDraftId={activeDraftId}
                    rebates={currentCustomerRebates}
                    selectedRebateIds={selectedRebateIds}
                    onToggleRebate={handleToggleRebate}
                    customers={allCustomers}
                    currentSalesRecord={allSalesRecords.find(r => String(r.CustomerCode).trim() === String(customerCode).trim()) ?? null}
                    onExportSales={handleExportSales}
                    onViewCustomerDetail={handleQuickViewCustomer}
                    dummyBoxListGate={dummyBoxListGate}
                    ostelin60VTangCanLocked={ostelin60VTangCanLocked}
                    psGate={psGate}
                    isPsOnInvoice25={isPsOnInvoice25}
                    onIsPsOnInvoice25Change={handlePsOnInvoice25Toggle}
                  />
                </div>
              </div>
            </div>
            <div className="mt-12">
              <OrderHistory
                drafts={drafts}
                sent={sentOrders}
                onLoad={handleLoadDraft}
                onDeleteDrafts={handleDeleteDrafts}
                onDeleteSentOrders={handleDeleteSentOrders}
              />
            </div>
          </>
        )}

        {viewMode === 'dashboard' && (
          <Dashboard
            salesData={allSalesRecords}
            currentEmployee={loggedInEmployee}
            productTargetsByEmployee={productTargetsByEmployee}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            rebates={allRebates}
            purchaseHistory={allPurchaseHistory}
            initialCustomerCode={dashboardCustomerCode} // Pass selected customer from Rebate tab
            forecastData={forecastData}
            onUpdateForecast={handleUpdateForecast}
            onBack={() => {
              setViewMode('order');
              setDashboardCustomerCode(null);
            }}
            onExportSales={handleExportSales}
          />
        )}

        {storePsTabMounted && loggedInEmployee && (
          <div
            className={viewMode === 'storeRegistration' ? 'block w-full' : 'hidden'}
            aria-hidden={viewMode !== 'storeRegistration'}
          >
            <StoreProgramRegistrationTab
              currentEmployee={loggedInEmployee}
              scriptUrl={GOOGLE_SCRIPT_URL}
              isAdmin={loggedInEmployee.code === ADMIN_CODE}
              rebates={allRebates}
              onStartOrder={handleCustomerSelectFromDashboard}
            />
          </div>
        )}

        {viewMode === 'purchaseHistory' && (
          <PurchaseHistoryTab
            purchaseHistory={allPurchaseHistory}
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleQuickViewCustomer}
            onReloadData={handleReloadAllData}
          />
        )}

        {viewMode === 'rebate' && (
          <RebateTab
            rebates={allRebates}
            rebatesBm={allRebatesBm}
            salesRecords={allSalesRecords}
            customers={allCustomers}
            currentEmployee={loggedInEmployee}
            onCustomerClick={handleRebateCustomerClick}
            isAdmin={loggedInEmployee?.code === ADMIN_CODE}
            onPublishGppNotice={handlePublishGppNotice}
            onPublishCustomerNotice={handlePublishCustomerNotice}
            gppComments={gppComments}
          />
        )}

        {viewMode === 'landing' && (
          <LandingPage
            currentEmployee={loggedInEmployee!}
            marketingData={marketingData}
            salesRecords={allSalesRecords}
            forecastData={forecastData}
            rebates={allRebates}
            onReloadData={handleMarketingDataReload}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            onUpdateRecord={handleUpdateMarketingRecord}
            showReportOnMount={showDummyBoxReminderOnMount}
            onReminderShown={() => setShowDummyBoxReminderOnMount(false)}
            mirrorPeerSheetName="DummyBoxRecordBs"
            mirrorPeerHasCustomer={(code) =>
              marketingDataBs.some((r) => String(r.CustomerCode ?? '').trim() === String(code).trim())
            }
            onPeerMirrorRecordUpdate={handleUpdateMarketingRecordBs}
          />
        )}

        {viewMode === 'landingBsT3' && (
          <LandingPage
            currentEmployee={loggedInEmployee!}
            marketingData={marketingDataBs}
            salesRecords={allSalesRecords}
            forecastData={forecastData}
            rebates={allRebates}
            onReloadData={handleMarketingDataBsReload}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            onUpdateRecord={handleUpdateMarketingRecordBs}
            sheetName="DummyBoxRecordBs"
            enableReportTools={false}
            mirrorPeerSheetName="DummyBoxRecord"
            mirrorPeerHasCustomer={(code) =>
              marketingData.some((r) => String(r.CustomerCode ?? '').trim() === String(code).trim())
            }
            onPeerMirrorRecordUpdate={handleUpdateMarketingRecord}
          />
        )}

        {viewMode === 'forecast' && (
          <ForecastTab
            salesData={allSalesRecords}
            forecastData={forecastData}
            currentEmployee={loggedInEmployee}
            onUpdateForecast={handleUpdateForecast}
            onCustomerClick={handleQuickViewCustomer}
            onReloadData={handleReloadAllData}
          />
        )}

        {SHOW_PRICE_LIST_TAB && viewMode === 'priceList' && (
          <PriceListTab products={PRODUCTS} />
        )}

        {SHOW_AO_TRACKING_TAB && viewMode === 'aoTracking' && (
          <AoTrackingTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
          />
        )}

        {SHOW_SALE_KH_PS_TAB && viewMode === 'saleKhPs' && (
          <SaleKhPsTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            showReportOnMount={showSaleKhPsReportOnMount}
            onReportShown={() => setShowSaleKhPsReportOnMount(false)}
          />
        )}

        {SHOW_QUARTER_SALES_TRACKING_TAB && viewMode === 'quarterSalesTracking' && (
          <QuarterSalesTrackingTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
          />
        )}

        {SHOW_OSTELIN_60V_TAB && viewMode === 'ostelin60v' && (
          <Ostelin60VTab currentEmployee={loggedInEmployee!} />
        )}
        {viewMode === 'repActiveAcemucOstelin' && (
          <RepActiveAcemucOstelinTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
          />
        )}
        {SHOW_CALCI_PLUS_TAB && viewMode === 'calciPlus' && (
          <CalciPlusTab />
        )}
        {viewMode === 'giaThamKhao' && (
          <GiaThamKhaoTab products={PRODUCTS} />
        )}

        {viewMode === 'aiTuVan' && loggedInEmployee?.code === ADMIN_CODE && (
          <AiTuVanTab
            key={loggedInEmployee.code}
            customers={allCustomers}
            salesRecords={allSalesRecords}
            forecastData={forecastData}
            currentEmployee={loggedInEmployee!}
          />
        )}

        {/* Tạm thời ẩn LuckyWheelTab
        {viewMode === 'lixi' && (
          <LuckyWheelTab
            currentEmployee={loggedInEmployee}
            allLiXiResults={allLiXiResults}
            onSubmitResult={handleSubmitLiXi}
            isLoading={isLoading}
          />
        )}
        */}
      </main>
      <AdminNewsWidget
        currentEmployee={loggedInEmployee!}
        isAdmin={loggedInEmployee?.code === ADMIN_CODE}
        newsItems={newsItems}
        onNewMessage={(newItem) => setNewsItems(prev => [...prev, newItem])}
      />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;