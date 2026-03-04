
export interface Product {
  id: number;
  name: string;
  minOrder: string;
  minOrderQuantity: number;
  price: number;
  type: 'Local' | 'Import';
  originalPrice?: number;
  promotion?: string;
  basePrice?: number;
  note?: string;
  image?: string;
  nearExpiry?: string;
  requireApproval?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Employee {
  name: string;
  code: string;
}

export interface Customer {
  code: string;
  name: string;
  address?: string;
  rep?: string;
}

export interface Rebate {
  code: string;
  Group: 'LOCAL' | 'IMPORT';
  "PromotionID#program": string;
  EndDate?: string | number;
  Endate?: string | number;
  RemainAmount: number;
  Rep?: string; // Added Rep field
  DATEGPP?: string | number; // Ngày hết hạn giấy phép GPP (từ sheet REBATE)
}

export interface DashboardProps {
  salesData: SalesRecord[];
  currentEmployee: Employee;
  onCustomerSelect: (customerCode: string) => void;
  rebates: Rebate[];
  purchaseHistory: PurchaseHistoryItem[];
  initialCustomerCode?: string | null;
  forecastData: ForecastItem[];
  onUpdateForecast: (
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
  ) => void;
  onBack?: () => void;
}

export interface SalesRecord {
  CustomerCode: string;       // Code moi
  CodeBuyMed?: string;        // Code BuyMed (MỚI)
  CustomerName: string;       // Location Name
  StaffCode?: string;         // Mã nhân viên (giữ lại theo yêu cầu)

  // Thông tin địa điểm & Quản lý
  Address?: string;           // Adress
  District?: string;          // District
  Province?: string;          // Province
  Rep?: string;               // REP (Tên nhân viên)
  GPP?: string | number;      // GPP
  Status?: string;            // Status
  FinalStoreType?: string;    // Final Store type T1
  TargetMonthly?: number;     // TARGET THÁNG (MỚI)

  // Số liệu Import
  TargetImport: number;
  ActualImport: number;
  ActualImportGiga?: number;   // Doanh số Giga Import (MỚI)
  ActualImportBuyMed?: number; // Doanh số BuyMed Import (MỚI)
  UpdateTienThuongImport?: number; // UPDATE TIEN THUONG IMPORT
  TodoImport?: number;         // Todo Import (Mới)

  // Số liệu Local
  TargetLocal: number;
  ActualLocal: number;
  ActualLocalGiga?: number;    // Doanh số Giga Local (MỚI)
  ActualLocalBuyMed?: number;  // Doanh số BuyMed Local (MỚI)
  UpdateTienThuongLocal?: number;  // UPDATE TIEN THUONG LOCAL
  TodoLocal?: number;          // Todo Local (Mới)

  // Các điều kiện & Kết quả khác
  DieuKienTrungBay?: number | string; // DIEU KIEN TRUNG BAY
  DieuKienSale?: number;      // Dieu kien sale T1
  Sale?: number;              // Sale T1
  Todo?: number;              // Todo (Số tiền cần làm - Tổng hợp)
  Check?: string;             // Check (Kết quả: Rớt/Đạt...)

  // Mới thêm
  CoverQ1?: string;           // Cover Q1 (YES/NO)
  BuyMed?: string;            // Buy Med (YES/NO)
  CounterTop?: string;        // CounterTop status (e.g. RỚT)
  CDU?: string;               // CDU status (e.g. RỚT)

  // --- KPI MỚI (Lấy từ Sheet DOANH_SO) ---
  MustWin?: number;   // Doanh số Must Win
  Other?: number;     // Doanh số Other
  Active?: number;    // Số lượng Active
  AO?: number;        // Số lượng AO
  MSO?: number;       // Số lượng MSO

  // --- DỮ LIỆU LỊCH SỬ CHI TIẾT T1 (Tên biến chuẩn) ---
  ActualImportT1?: number; // MỚI: Thực đạt Import T1
  ActualLocalT1?: number;  // MỚI: Thực đạt Local T1

  SaleImportGigaT1?: number;
  SaleImportBuyMedT1?: number;
  SaleImportTotalT1?: number;

  SaleLocalGigaT1?: number;
  SaleLocalBuyMedT1?: number;
  SaleLocalTotalT1?: number;

  // --- DỮ LIỆU LỊCH SỬ RAW TỪ EXCEL (Khớp chính xác tiêu đề cột) ---
  "SALE IMPORT (GIGA T1)"?: number | string;
  "SALE IMPORT (BUYMED) T1"?: number | string;
  "SALE IMPORT T1"?: number | string;

  "SALE LOCAL (GIGA) T1"?: number | string;
  "SALE LOCAL (BUYMED) T1"?: number | string;
  "SALE LOCAL T1"?: number | string;

  // --- DỮ LIỆU TỶ TRỌNG KÊNH ---
  GIGAMED?: number | string;
  BM?: number | string;
  GIGAMEDImport?: number | string;
  BMImport?: number | string;

  // --- 12 NHÓM SẢN PHẨM KHÁC (KPI CHI TIẾT) ---
  "BUSCOPAN (B.I)"?: number;
  "CAL CORBIERE"?: number;
  "ENTEROGERMINA"?: number;
  "Nospa Import"?: number;
  "Nospa Local"?: number;
  "PHARMATON"?: number;
  "TELFAST"?: number;
  "BISOLVON"?: number;
  "OSTELIN"?: number;
  "ACEMUC"?: number;
  "PHOSPHALUGEL (B.I)"?: number;
  "MAGNE B6"?: number;
}

// Interface cho Sheet ForecastRecord
export interface ForecastItem {
  Timestamp?: string;
  Employee?: string;
  CustomerCode: string;
  ImportLevel?: string;
  LocalLevel?: string;
  ImportValue?: number;
  LocalValue?: number;
  ExpectedGigaT2?: number;
  ExpectedBMT2?: number;
  ExpectedTotalT2?: number;
  TargetMonthly?: number;
  ReasonNotAchieved?: string;
  Reason2?: string;
}

// Interface cho Sheet DON HANG DUYET 2026
export interface MarketingRecord {
  CustomerCode: string;
  CustomerName: string;
  Address?: string;
  District?: string;
  Province?: string;
  Rep?: string;
  StaffCode?: string;

  UpHinh?: string;      // Trạng thái chụp ảnh 1: YES/NO hoặc Link
  UpHinh2?: string;     // Trạng thái chụp ảnh 2: YES/NO hoặc Link (MỚI)
  GoiLocal?: string;    // Đăng ký gói Local: YES/NO
  GoiImport?: string;   // Đăng ký gói Import: YES/NO
}

export interface Order {
  id: string;
  customerCode: string;
  customerName: string;
  customerAddress: string;
  note: string;
  items: CartItem[];
  isOnTopLiXi: boolean;
  isDummyBox?: boolean; // Legacy: đơn DummyBox (cũ)
  isDummyBoxLocal?: boolean;  // CTKM OPELLA: DummyBox Local -150k (đủ điều kiện mới chọn)
  isDummyBoxImport?: boolean; // CTKM OPELLA: DummyBox Import -150k (đủ điều kiện mới chọn)
  appliedRebates?: string[];
  createdAt: number;
  status: 'draft' | 'sent';
  totalAmount: number;
  finalAmount: number;
  totalSales: number;
}

// Interface cho lịch sử mua hàng từ Sheet HISTORY (khớp với hình ảnh)
export interface PurchaseHistoryItem {
  CustomerID: string;       // Mã KH
  CustomerName?: string;    // Tên KH (đã sửa thành tùy chọn vì file Excel không có)
  Product: string;          // Tên sản phẩm
  Qty: number;              // Số lượng
  Value: number;            // Giá trị
  Year?: number;
  Month?: number;
  InvoiceDate?: string | number; // Ngày hóa đơn (tùy chọn để tránh lỗi nếu trống)
  InvoiceNumber?: string;   // Số hóa đơn
  Team?: string;            // Cũ
  Group?: string;           // Mới: Khớp với file Excel của bạn (LOCAL/IMPORT)
  Note?: string;            // Ghi chú (ví dụ: BuyMed)
}

// Interface cho tin tức Admin
export interface AdminNewsItem {
  timestamp: string;
  adminName: string;
  message: string;
  type?: 'update' | 'news' | 'alert';
}

export interface LiXiOnTopStats {
  employeeName: string;
  orderCount: number;
  totalSales: number;
}

export interface LiXiOnTopCustomerStats {
  customerCode: string;
  customerName: string;
  totalSales: number;
  employeeName: string;
}

// Interface cho kết quả Lì xì
export interface LiXiResult {
  Timestamp?: string;
  EmployeeCode: string;
  EmployeeName: string;
  PrizeName: string;
  PrizeValue: number;
}