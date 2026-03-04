
import React, { useState, useMemo, useEffect } from 'react';
import { PRODUCTS, EMPLOYEES, PROMO_UPDATE_DATE, GOOGLE_SCRIPT_URL, DUMMY_BOX_DISCOUNT } from './constants';
import type { Product, CartItem, Employee, Order, Customer, Rebate, SalesRecord, PurchaseHistoryItem, MarketingRecord, ForecastItem, AdminNewsItem, LiXiOnTopStats, LiXiResult, LiXiOnTopCustomerStats } from './types';
import ProductCard from './components/ProductCard';
import Cart from './components/Cart';
import Login from './components/Login';
import OrderHistory from './components/OrderHistory';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import ForecastTab from './components/ForecastTab';
import RebateTab from './components/RebateTab';
import PriceListTab from './components/PriceListTab';
import OrderSuccessModal from './components/OrderSuccessModal'; // Import Modal
import AdminNewsWidget from './components/AdminNewsWidget';
import LiXiStatsTab from './components/LiXiStatsTab';
import { ChartBarIcon, ClipboardDocumentListIcon, SunIcon, MoonIcon, SearchIcon, GlobeAmericasIcon, HomeIcon, CubeIcon, StarIcon, UserGroupIcon, TrendingUpIcon, BanknotesIcon, TagIcon } from './components/icons';
import { postOrderToGoogleSheet, fetchDataFromSheet } from './services/googleSheetService';
import { getOrders, saveOrders } from './utils/storage';
import { calculateLineTotal, getDiscountPercent } from './utils/calculations';
import { generateCustomerSummary } from './utils/customerSummarizer';


const TELFAST_GROUP_IDS = [7, 8];
const ADMIN_CODE = '20043741'; // Phan Viet Linh

type ViewMode = 'order' | 'dashboard' | 'landing' | 'forecast' | 'rebate' | 'priceList' | 'lixi' | 'lixiStats';

const App: React.FC = () => {
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allRebates, setAllRebates] = useState<Rebate[]>([]);
  const [allSalesRecords, setAllSalesRecords] = useState<SalesRecord[]>([]);
  const [allPurchaseHistory, setAllPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [marketingData, setMarketingData] = useState<MarketingRecord[]>([]);
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]); // State mới cho Forecast
  const [liXiStatsData, setLiXiStatsData] = useState<LiXiOnTopStats[]>([]);
  const [liXiCustomerStatsData, setLiXiCustomerStatsData] = useState<LiXiOnTopCustomerStats[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('order');

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

  const loadInitialData = async () => {

    try {
      const [customers, rebates, sales, history, marketing, forecasts, , news, lixiStats, lixiCustomerStats] = await Promise.all([
        fetchDataFromSheet<Customer>(GOOGLE_SCRIPT_URL, "DANH_MUC_KH"),
        fetchDataFromSheet<Rebate>(GOOGLE_SCRIPT_URL, "REBATE"),
        fetchDataFromSheet<SalesRecord>(GOOGLE_SCRIPT_URL, "DOANH_SO"),
        fetchDataFromSheet<PurchaseHistoryItem>(GOOGLE_SCRIPT_URL, "HISTORY"),
        fetchDataFromSheet<MarketingRecord>(GOOGLE_SCRIPT_URL, "DummyBoxRecord"),
        fetchDataFromSheet<ForecastItem>(GOOGLE_SCRIPT_URL, "ForecastRecord"),
        fetchDataFromSheet<LiXiResult>(GOOGLE_SCRIPT_URL, "LUCKY_WHEEL"),
        fetchDataFromSheet<AdminNewsItem>(GOOGLE_SCRIPT_URL, 'ADMIN_NEWS'),
        fetchDataFromSheet<LiXiOnTopStats>(GOOGLE_SCRIPT_URL, 'LIXI_ONTOP_STATS'),
        fetchDataFromSheet<LiXiOnTopCustomerStats>(GOOGLE_SCRIPT_URL, 'LIXI_ONTOP_CUSTOMER_STATS')
      ]);
      setAllCustomers(customers);
      setAllRebates(rebates);
      setAllSalesRecords(sales);
      setAllPurchaseHistory(history);
      setMarketingData(marketing);
      setForecastData(forecasts);
      // setAllLiXiResults(lixiResults); // Tạm ẩn
      setNewsItems(news || []);
      setLiXiStatsData(lixiStats || []);
      setLiXiCustomerStatsData(lixiCustomerStats || []);
    } catch (e) {
      console.error("Data load failed", e);
    }

  };

  useEffect(() => {
    loadInitialData();
  }, []);

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

  const handleDummyBoxLocalToggle = (checked: boolean) => {
    setIsDummyBoxLocal(checked);
  };
  const handleDummyBoxImportToggle = (checked: boolean) => {
    setIsDummyBoxImport(checked);
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

    let totalMaxPayableFeeLocal = 0;
    let totalMaxPayableFeeImport = 0;

    cart.forEach(item => {
      const basePriceLine = (item.basePrice ?? 0) * item.quantity;
      if (basePriceLine > 0) {
        const maxTotalDiscountLine = basePriceLine * 0.5;

        const isTelfastGroup = TELFAST_GROUP_IDS.includes(item.id);
        let compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;

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
      let compareValue = isTelfastGroup ? telfastGroupTotal : item.price * item.quantity;

      return sum + calculateLineTotal(
        item.price,
        item.quantity,
        item.promotion,
        compareValue
      );
    }, 0);

    const totalSales = cart.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
    const onTopLiXiDiscount = isOnTopLiXi ? 250000 : 0;
    const dummyBoxDiscount = (isDummyBoxLocal ? DUMMY_BOX_DISCOUNT : 0) + (isDummyBoxImport ? DUMMY_BOX_DISCOUNT : 0);

    const finalAmount = Math.max(0, totalAmount - onTopLiXiDiscount - totalRebateDiscount - dummyBoxDiscount);

    return {
      customerCode, customerName, customerAddress, note, items: cart, isOnTopLiXi,
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
          <div className="flex flex-col">
            <h1 className="text-base sm:text-xl font-black text-sky-600 dark:text-sky-400 uppercase leading-none whitespace-nowrap">Hệ Thống Đặt Hàng</h1>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 sm:mt-1 uppercase tracking-tight italic hidden sm:block">Ngày cập nhật CTKM: {PROMO_UPDATE_DATE}</p>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-4">
            {isSuperUser ? (
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 p-0.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="p-1 bg-sky-100 dark:bg-sky-900/50 rounded text-sky-600 dark:text-sky-400">
                  <UserGroupIcon />
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
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'order' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ClipboardDocumentListIcon />
            <span className="hidden sm:inline">Đặt Hàng</span>
            <span className="sm:hidden">Đơn</span>
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'dashboard' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <ChartBarIcon />
            <span className="hidden sm:inline">Báo Cáo</span>
            <span className="sm:hidden">BC</span>
          </button>
          <button
            onClick={() => setViewMode('rebate')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'rebate' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <BanknotesIcon />
            <span className="hidden sm:inline">Trả Thưởng</span>
            <span className="sm:hidden">Phí</span>
          </button>
          <button
            onClick={() => setViewMode('landing')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'landing' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <StarIcon />
            <span className="hidden sm:inline">Dummybox</span>
            <span className="sm:hidden">Dummy</span>
          </button>
          <button
            onClick={() => setViewMode('forecast')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'forecast' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <TrendingUpIcon />
            <span className="hidden sm:inline">Forecast T2</span>
            <span className="sm:hidden">FC T2</span>
          </button>
          <button
            onClick={() => setViewMode('priceList')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'priceList' ? 'text-sky-600 border-sky-600 bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <TagIcon />
            <span className="hidden sm:inline">Báo giá & CTKM</span>
            <span className="sm:hidden">Báo giá</span>
          </button>

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

          <button
            onClick={() => setViewMode('lixiStats')}
            className={`flex-1 min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 text-[10px] sm:text-sm font-bold flex items-center justify-center space-x-1 sm:space-x-2 transition-colors border-b-2 ${viewMode === 'lixiStats' ? 'text-emerald-600 border-emerald-600 bg-emerald-50 dark:bg-slate-800 dark:text-emerald-400 dark:border-emerald-400' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <StarIcon />
            <span className="hidden sm:inline">Thống kê đơn Lì xì</span>
            <span className="sm:hidden">TK Lì xì</span>
          </button>
        </div>

        {viewMode === 'order' && (
          <div className="bg-slate-50 dark:bg-slate-900 py-1.5 sm:py-3 border-t border-slate-200 dark:border-slate-700 shadow-inner">
            <div className="container mx-auto px-4 flex gap-2 sm:gap-3 items-center">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none shadow-sm transition-all text-[13px] sm:text-sm"
                />
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                {(['All', 'Local', 'Import'] as const).map(f => (
                  <button key={f} onClick={() => setProductTypeFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${productTypeFilter === f ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
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

      <main className="container mx-auto p-4 flex-1">
        {viewMode === 'order' && (
          <>
            <div className="flex flex-col lg:flex-row gap-6 mt-2">
              <div className="lg:w-2/3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />)}
                </div>
              </div>
              <div className="lg:w-1/3">
                <div className="sticky top-[180px] transition-all">
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
                    // Add: Truyền danh sách khách hàng vào Cart
                    customers={allCustomers}
                    onQuickView={handleQuickViewCustomer}
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
          />
        )}

        {viewMode === 'rebate' && (
          <RebateTab
            rebates={allRebates}
            customers={allCustomers}
            currentEmployee={loggedInEmployee}
            onCustomerClick={handleRebateCustomerClick}
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
          />
        )}

        {viewMode === 'forecast' && (
          <ForecastTab
            salesData={allSalesRecords}
            forecastData={forecastData}
            currentEmployee={loggedInEmployee}
            onUpdateForecast={handleUpdateForecast}
            onCustomerClick={handleQuickViewCustomer}
          />
        )}

        {viewMode === 'priceList' && (
          <PriceListTab products={PRODUCTS} />
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
        {viewMode === 'lixiStats' && (
          <LiXiStatsTab
            stats={liXiStatsData}
            customerStats={liXiCustomerStatsData}
            isLoading={isLoading}
            currentEmployee={loggedInEmployee!}
            isAdmin={isSuperUser}
          />
        )}
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