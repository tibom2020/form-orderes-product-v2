
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PRODUCTS, EMPLOYEES, PROMO_UPDATE_DATE, GOOGLE_SCRIPT_URL, DUMMY_BOX_DISCOUNT, TELFAST_GROUP_IDS, OSTELIN_GROUP_IDS } from './constants';
import type { Product, CartItem, Employee, Order, Customer, Rebate, RebateBm, SalesRecord, PurchaseHistoryItem, MarketingRecord, ForecastItem, AdminNewsItem, RebateCustomerNoticePayload } from './types';
import ProductCard from './components/ProductCard';
import Cart from './components/Cart';
import Login from './components/Login';
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
import { ChartBarIcon, ClipboardDocumentListIcon, SunIcon, MoonIcon, SearchIcon, GlobeAmericasIcon, HomeIcon, CubeIcon, StarIcon, TrendingUpIcon, BanknotesIcon, TagIcon, ClockIcon } from './components/icons';
import CalciPlusTab from './components/CalciPlusTab';
import AiTuVanTab from './components/AiTuVanTab';
import PurchaseHistoryTab from './components/PurchaseHistoryTab';
import { postOrderToGoogleSheet, fetchDataFromSheet, submitAdminNews, submitRebateCustomerNotice, submitCustomerSalesNotice } from './services/googleSheetService';
import { getOrders, saveOrders } from './utils/storage';
import { calculateLineTotal, getDiscountPercent } from './utils/calculations';
import { generateCustomerSummary, buildCustomerSalesNoticePayload } from './utils/customerSummarizer';
import { getInitials } from './utils/formatters';
import { buildProductTargetsFromSheet } from './components/dashboard/DashboardUtils';


const ADMIN_CODE = '20043741'; // Phan Viet Linh

type ViewMode = 'order' | 'dashboard' | 'landing' | 'forecast' | 'rebate' | 'priceList' | 'aoTracking' | 'saleKhPs' | 'quarterSalesTracking' | 'calciPlus' | 'aiTuVan' | 'lixi' | 'purchaseHistory';

const App: React.FC = () => {
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allRebates, setAllRebates] = useState<Rebate[]>([]);
  const [allRebatesBm, setAllRebatesBm] = useState<RebateBm[]>([]);
  const [allSalesRecords, setAllSalesRecords] = useState<SalesRecord[]>([]);
  const [allPurchaseHistory, setAllPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [marketingData, setMarketingData] = useState<MarketingRecord[]>([]);
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]); // State mới cho Forecast
  const [viewMode, setViewMode] = useState<ViewMode>('order');
  const [showDummyBoxReminderOnMount, setShowDummyBoxReminderOnMount] = useState(false);
  const [showSaleKhPsReportOnMount, setShowSaleKhPsReportOnMount] = useState(false);
  const hasShownLoginReminder = useRef(false);

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

  const [selectedRebateIds, setSelectedRebateIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Order[]>([]);
  const [sentOrders, setSentOrders] = useState<Order[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<AdminNewsItem[]>([]);
  const [gppComments, setGppComments] = useState<Record<string, string>>({});
  const [productTargetsByEmployee, setProductTargetsByEmployee] = useState<Record<string, Record<string, number>>>({});

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

  useEffect(() => {
    setDrafts(getOrders('draftOrders'));
    setSentOrders(getOrders('sentOrders'));
  }, []);

  // Refs để lazy load chỉ 1 lần
  const hasLoadedPurchaseHistory = useRef(false);
  const hasLoadedGppComments = useRef(false);
  const hasLoadedForecast = useRef(false);

  /** Phase 1: Dữ liệu cốt lõi cho Order/Rebate/Landing (4 API) */
  const loadCriticalData = async () => {
    try {
      const [customers, rebates, sales, marketing] = await Promise.all([
        fetchDataFromSheet<Customer>(GOOGLE_SCRIPT_URL, "DANH_MUC_KH"),
        fetchDataFromSheet<Rebate>(GOOGLE_SCRIPT_URL, "REBATE"),
        fetchDataFromSheet<SalesRecord>(GOOGLE_SCRIPT_URL, "DOANH_SO"),
        fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecord"),
      ]);
      setAllCustomers(customers);
      setAllRebates(rebates);
      try {
        const bm = await fetchDataFromSheet<RebateBm>(GOOGLE_SCRIPT_URL, "REBATE_BM");
        setAllRebatesBm(bm || []);
      } catch (e) {
        console.warn("REBATE_BM sheet load failed (optional sheet)", e);
        setAllRebatesBm([]);
      }
      setAllSalesRecords(sales);
      setMarketingData(marketing);
    } catch (e) {
      console.error("Critical data load failed", e);
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

  /** Khởi tạo: Phase 1 trước, Phase 2 chạy song song ngay sau */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadCriticalData();
      if (cancelled) return;
      loadSecondaryData(); // Không await — load nền
    };
    run();
    return () => { cancelled = true; };
  }, []);

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
    if (viewMode === 'landing' || viewMode === 'dashboard' || viewMode === 'forecast') loadForecastData();
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

  // Khi đăng nhập: chuyển thẳng sang tab Sale KH PS (không tự mở báo cáo DummyBox)
  useEffect(() => {
    if (loggedInEmployee && !hasShownLoginReminder.current) {
      hasShownLoginReminder.current = true;
      setViewMode('saleKhPs');
      setShowDummyBoxReminderOnMount(false);
      setShowSaleKhPsReportOnMount(true);
    }
  }, [loggedInEmployee]);

  /** Tab AI Tư vấn chỉ dành cho Admin; tránh kẹt view khi đổi nhân viên trong dropdown */
  useEffect(() => {
    if (viewMode === 'aiTuVan' && loggedInEmployee?.code !== ADMIN_CODE) {
      setViewMode('order');
    }
  }, [viewMode, loggedInEmployee]);

  const handleLoginSuccess = (employee: Employee) => {
    setLoggedInEmployee(employee);
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
    setSelectedRebateIds([]);
    setActiveDraftId(null);
  }

  const handleLogout = () => {
    setLoggedInEmployee(null);
    setIsSuperUser(false);
    resetOrderState();
    setViewMode('order');
  };

  const handleOnTopLiXiToggle = (checked: boolean) => {
    setIsOnTopLiXi(checked);
    const discountNote = "Ontop lì xì 250k";
    if (checked) {
      setNote(prevNote => prevNote.includes(discountNote) ? prevNote : (prevNote ? `${prevNote}\n${discountNote}` : discountNote));
    } else {
      setNote(prevNote => prevNote.split('\n').filter(line => line.trim() !== discountNote.trim()).join('\n'));
    }
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

  const handleToggleRebate = (rebateId: string) => {
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
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      return [...prevCart, { ...product, quantity }];
    });
  };

  const handleRemoveItem = (productId: number) => setCart(prevCart => prevCart.filter(item => item.id !== productId));
  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) handleRemoveItem(productId);
    else setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };
  const handleClearCart = () => { resetOrderState(); };


  const createOrderObject = (): Omit<Order, 'id' | 'createdAt' | 'status'> => {
    const telfastGroupTotal = cart
      .filter(item => TELFAST_GROUP_IDS.includes(item.id))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    const ostelinGroupBaseTotal = cart
      .filter(item => OSTELIN_GROUP_IDS.includes(item.id))
      .reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);

    let totalMaxPayableFeeLocal = 0;
    let totalMaxPayableFeeImport = 0;

    cart.forEach(item => {
      const basePriceLine = (item.basePrice ?? 0) * item.quantity;
      if (basePriceLine > 0) {
        const maxTotalDiscountLine = basePriceLine * 0.5;

        const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
        const isOstelinGroup = OSTELIN_GROUP_IDS.includes(item.id);
        let compareValue = isTelfastGroup ? telfastGroupTotal
          : isOstelinGroup ? ostelinGroupBaseTotal
          : item.price * item.quantity;

        const monthlyDiscountPercent = getDiscountPercent(
          item.promotion,
          item.quantity,
          compareValue
        );
        const monthlyDiscountAmount = basePriceLine * monthlyDiscountPercent;
        const maxPayableFeeLine = Math.max(0, maxTotalDiscountLine - monthlyDiscountAmount);

        if (item.type === 'Local') totalMaxPayableFeeLocal += maxPayableFeeLine;
        else totalMaxPayableFeeImport += maxPayableFeeLine;
      }
    });

    const localRebates = currentCustomerRebates.filter(r => r.Group === 'LOCAL' && selectedRebateIds.includes(r["PromotionID#program"]));
    const importRebates = currentCustomerRebates.filter(r => r.Group === 'IMPORT' && selectedRebateIds.includes(r["PromotionID#program"]));

    const availableLocalRebate = localRebates.reduce((sum, r) => sum + Number(r.RemainAmount), 0);
    const availableImportRebate = importRebates.reduce((sum, r) => sum + Number(r.RemainAmount), 0);

    const usedLocalRebate = Math.min(availableLocalRebate, totalMaxPayableFeeLocal);
    const usedImportRebate = Math.min(availableImportRebate, totalMaxPayableFeeImport);
    const totalRebateDiscount = usedLocalRebate + usedImportRebate;

    const totalAmount = cart.reduce((sum, item) => {
      const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
      const isOstelinGroup = OSTELIN_GROUP_IDS.includes(item.id);
      let compareValue = isTelfastGroup ? telfastGroupTotal
        : isOstelinGroup ? ostelinGroupBaseTotal
        : item.price * item.quantity;

      return sum + calculateLineTotal(
        item.price,
        item.quantity,
        item.promotion,
        compareValue,
        item.id
      );
    }, 0);

    const totalSales = cart.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
    const onTopLiXiDiscount = isOnTopLiXi ? 250000 : 0;
    const dummyBoxDiscount = (isDummyBoxLocal ? DUMMY_BOX_DISCOUNT : 0) + (isDummyBoxImport ? DUMMY_BOX_DISCOUNT : 0);

    const finalNote = note;

    const finalAmount = Math.max(0, totalAmount - onTopLiXiDiscount - totalRebateDiscount - dummyBoxDiscount);

    return {
      customerCode, customerName, customerAddress, note: finalNote, items: cart, isOnTopLiXi,
      isDummyBox: isDummyBoxLocal || isDummyBoxImport,
      isDummyBoxLocal, isDummyBoxImport,
      appliedRebates: selectedRebateIds,
      totalAmount, finalAmount, totalSales
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
    if (!customerCode || cart.length === 0) return;
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
    setCart(d.items);
    setNote(d.note);
    setIsOnTopLiXi(d.isOnTopLiXi);
    setIsDummyBoxLocal(!!d.isDummyBoxLocal);
    setIsDummyBoxImport(!!d.isDummyBoxImport);
    if (d.isDummyBoxLocal === undefined && d.isDummyBoxImport === undefined && d.isDummyBox) {
      setIsDummyBoxLocal(true);
    }
    setSelectedRebateIds(d.appliedRebates || []);
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

  const handleUpdateMarketingRecord = (customerCode: string, updates: Partial<MarketingRecord>) => {
    setMarketingData(prevData => prevData.map(record =>
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Hiển thị Modal khi có submittedOrder */}
      {submittedOrder && (
        <OrderSuccessModal
          order={submittedOrder}
          employeeName={loggedInEmployee.name}
          onClose={handleCloseSuccessModal}
        />
      )}

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
            onClick={() => setViewMode('aoTracking')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'aoTracking' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <TrendingUpIcon />
            <span className="hidden sm:inline">Theo dõi AO</span>
            <span className="sm:hidden">AO</span>
          </button>
          <button
            onClick={() => setViewMode('saleKhPs')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'saleKhPs' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <StarIcon />
            <span className="hidden sm:inline">Sale KH PS</span>
            <span className="sm:hidden">PS</span>
          </button>
          <button
            onClick={() => setViewMode('quarterSalesTracking')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'quarterSalesTracking' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ChartBarIcon />
            <span className="hidden sm:inline">DS Quý 1 KH</span>
            <span className="sm:hidden">Q1</span>
          </button>
          <button
            onClick={() => setViewMode('calciPlus')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'calciPlus' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <CubeIcon />
            <span className="hidden sm:inline">Gói CalciPlus</span>
            <span className="sm:hidden">CalciPlus</span>
          </button>
          <button
            onClick={() => setViewMode('priceList')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'priceList' ? 'text-opella-green border-opella-green bg-opella-beige dark:bg-opella-green/20 dark:text-white dark:border-opella-green' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <TagIcon />
            <span className="hidden sm:inline">Báo giá & CTKM</span>
            <span className="sm:hidden">Báo giá</span>
          </button>
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

      <main className={`container mx-auto p-4 flex-1 ${['order', 'dashboard', 'purchaseHistory', 'rebate', 'landing', 'forecast', 'priceList', 'aoTracking', 'saleKhPs', 'quarterSalesTracking', 'calciPlus', 'aiTuVan'].includes(viewMode) ? 'bg-opella-beige dark:bg-[#1a3028]' : ''}`}>
        {viewMode === 'order' && (
          <>
            <div className="flex flex-col-reverse lg:flex-row gap-6 mt-2">
              <div className="lg:w-2/3 space-y-4 lg:order-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />)}
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
                    isOnTopLiXi={isOnTopLiXi} onIsOnTopLiXiChange={handleOnTopLiXiToggle}
                    isDummyBoxLocal={isDummyBoxLocal} onIsDummyBoxLocalChange={handleDummyBoxLocalToggle}
                    isDummyBoxImport={isDummyBoxImport} onIsDummyBoxImportChange={handleDummyBoxImportToggle}
                    activeDraftId={activeDraftId}
                    rebates={currentCustomerRebates}
                    selectedRebateIds={selectedRebateIds}
                    onToggleRebate={handleToggleRebate}
                    customers={allCustomers}
                    currentSalesRecord={allSalesRecords.find(r => String(r.CustomerCode).trim() === String(customerCode).trim()) ?? null}
                    onExportSales={handleExportSales}
                    onViewCustomerDetail={handleQuickViewCustomer}
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
            onReloadData={handleMarketingDataReload}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            onUpdateRecord={handleUpdateMarketingRecord}
            showReportOnMount={showDummyBoxReminderOnMount}
            onReminderShown={() => setShowDummyBoxReminderOnMount(false)}
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

        {viewMode === 'priceList' && (
          <PriceListTab products={PRODUCTS} />
        )}

        {viewMode === 'aoTracking' && (
          <AoTrackingTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
          />
        )}

        {viewMode === 'saleKhPs' && (
          <SaleKhPsTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
            showReportOnMount={showSaleKhPsReportOnMount}
            onReportShown={() => setShowSaleKhPsReportOnMount(false)}
          />
        )}

        {viewMode === 'quarterSalesTracking' && (
          <QuarterSalesTrackingTab
            salesRecords={allSalesRecords}
            currentEmployee={loggedInEmployee!}
            onCustomerSelect={handleCustomerSelectFromDashboard}
          />
        )}

        {viewMode === 'calciPlus' && (
          <CalciPlusTab currentEmployee={loggedInEmployee!} />
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
  );
};

export default App;