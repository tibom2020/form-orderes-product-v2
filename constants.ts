
import type { Product, Employee, Customer } from './types';

// NGÀY CẬP NHẬT CTKM - Bạn có thể sửa ngày này thủ công tại đây
export const PROMO_UPDATE_DATE = '06/04/2026';

// Đường dẫn Google Apps Script (Cập nhật mới nhất)
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxD5n_kNXKaJhIpfVHW014ZZ4AE8PEz-29d3i6ym-fhNIf2T10Gntq7F13N4CHmb9DTnA/exec';
export const ADMIN_CODE = '20043741';

/** Sheet danh sách KH đăng ký CT trưng bày Q2 — import từ mẫu DANGKYTBQ2.xlsx */
export const SHEET_DANGKYTBQ2 = 'DANGKYTBQ2';
/** Sheet quản lý ngân sách Rep: Rep | Budget | Đã Sử dụng | Còn lại */
export const SHEET_REP_BUDGET_TBQ2 = 'REP_BUDGET_TBQ2';

export const EMPLOYEES: Employee[] = [
  { name: 'Huynh Thi To Trinh', code: '20045852' },
  { name: 'Ly Minh Dat', code: '20044677' },
  { name: 'Nguyen Thi Hong Cam', code: '20044676' },
  { name: 'Huynh Van Thanh Huyen', code: '20043742' },
  { name: 'Le Huu Phuc', code: '20043750' },
  { name: 'Truong Hoang Du', code: '20042514' },
  { name: 'Ngo Thi Thuy Quynh', code: '20043683' },
  { name: 'Huynh Hoang Hon', code: '20046380' },
  { name: 'Phan Viet Linh', code: '20043741' },
];

// Danh sách khách hàng sẽ được fetch từ Google Sheets khi App khởi động
export const CUSTOMERS: Customer[] = [];

export const PRODUCTS: Product[] = [
  { id: 1, name: 'CORBIERE CALCIUM PLUS', minOrder: '1', minOrderQuantity: 1, price: 223435, type: 'Local', basePrice: 206884, promotion: 'Mua 3h ck 4.9%, 5h ck 5.95%, gói 21h ck 4.76% (đến 25.04.2026)', image: 'https://i.postimg.cc/JnN6Jvyg/corbiere-calcium-plus-5-3lrp-gh.webp' },
  { id: 28, name: 'CALCIUM CORBIERE EXTRA 3SUPx10 10ML VN', minOrder: '1', minOrderQuantity: 1, price: 206884, type: 'Local', basePrice: 197032, requireApproval: true, image: 'https://i.postimg.cc/43ZXpknR/calci-10-(1).webp' },
  { id: 26, name: 'CALCIUM CORBIERE EXTRA 3SUPx10 5ML VN', minOrder: '1', minOrderQuantity: 1, price: 167425, type: 'Local', basePrice: 159453, image: 'https://i.postimg.cc/43JTm62S/calci-5.webp' },
  { id: 2, name: 'ACEMUC 200 CAP_BL3X10_VN', minOrder: '1', minOrderQuantity: 1, price: 82911, type: 'Local', basePrice: 78963, image: 'https://i.postimg.cc/Zq4tQ8rX/199562697843785922.webp' },
  { id: 3, name: 'ACEMUC 200mg SAC 1g_SC30_VN', minOrder: '1', minOrderQuantity: 1, price: 91562, type: 'Local', basePrice: 87202, image: 'https://i.postimg.cc/TwV7mFyF/acemuc-200.webp' },
  { id: 4, name: 'ACEMUC Kids 100mg_0,5g_SC30 VN', minOrder: '1', minOrderQuantity: 1, price: 64605, type: 'Local', basePrice: 61529, image: 'https://i.postimg.cc/FKN56yjM/Acemuc-Kids-2.webp' },
  { id: 5, name: 'MAGNE-B6 Tab B/50 (bao film)', minOrder: '1', minOrderQuantity: 1, price: 101706, type: 'Local', basePrice: 96863, image: 'https://i.postimg.cc/0NnR1znv/magie-B6.webp' },
  { id: 6, name: 'TELFAST HD 180MG', minOrder: '1', minOrderQuantity: 1, price: 280760, type: 'Local', basePrice: 267390, promotion: 'Mua 2h ck 4.43%, 3h ck 4.93% (đến 29.04.2026)', image: 'https://i.postimg.cc/50tc4fKF/telfast-180.webp' },
  { id: 7, name: 'TELFAST BD 60MG', minOrder: '1', minOrderQuantity: 1, price: 128931, type: 'Local', basePrice: 122791, promotion: 'Mua đơn >= 300k ck 2.46%, 560k ck 2.96% (đến 29.04.2026)', image: 'https://i.postimg.cc/B6vWSJ7L/telfast-60.webp' },
  { id: 8, name: 'TELFAST 30MG', minOrder: '1', minOrderQuantity: 1, price: 30293, type: 'Local', basePrice: 28850, promotion: 'Mua đơn >= 300k ck 2.46%, 560k ck 2.96% (đến 29.04.2026)', image: 'https://i.postimg.cc/pTdNWPc9/telfast-30.webp' },
  { id: 9, name: 'NO-SPA 40mg', minOrder: '1', minOrderQuantity: 1, price: 45700, type: 'Local', basePrice: 43524, requireApproval: true, image: 'https://i.postimg.cc/QMmGZFm3/nospa-40.webp' },
  { id: 10, name: 'BISOLVON KIDS 60ML BOTx1 VN', minOrder: '1', minOrderQuantity: 1, price: 40567, type: 'Local', basePrice: 38635, promotion: 'ck 1.5% (đến 29.04.2026)', nearExpiry: 'HSD: 3/2027', requireApproval: true, image: 'https://i.postimg.cc/SKkFP6Ww/bi-siro.webp' },
  { id: 11, name: 'ENTEROGERMINA GUT DEFEND (NEW)', minOrder: '1', minOrderQuantity: 1, price: 188321, type: 'Import', basePrice: 174371, promotion: 'Mua 4h ck 3.94%, 6h ck 5.91% (đến 31.03.2026)', image: 'https://i.postimg.cc/bvgcfZT5/entero-2b.webp' },
  { id: 30, name: 'ENTEROGERMINA 2 billion/5ml B/20 bottle', minOrder: '1', minOrderQuantity: 1, price: 182779, type: 'Import', basePrice: 174075, promotion: 'Mua 3h ck 2.96%, gói 21h ck 4.76% (đến 25.04.2026)', requireApproval: true, image: 'https://i.postimg.cc/SK2rsG43/images.webp' },
  { id: 12, name: 'ENTEROGERMINA GUT RESTORE ( 4B)', minOrder: '1', minOrderQuantity: 1, price: 305130, type: 'Import', basePrice: 290600, promotion: 'Mua 3h ck 4.93% (đến 29.04.2026)', nearExpiry: 'HSD: 11/2026', requireApproval: true, image: 'https://i.postimg.cc/pdRbSffx/entero-4b.webp' },
  { id: 13, name: 'ENTEROGERMINA BABY COMFORT', minOrder: '1', minOrderQuantity: 1, price: 460000, type: 'Import', basePrice: 425926, promotion: 'Mua 1h ck 15.8% (đến 29.04.2026)', image: 'https://i.postimg.cc/xd5DVXR4/entero-bb.webp' },
  { id: 14, name: 'BISOLVON 8MG TAB', minOrder: '1', minOrderQuantity: 1, price: 63901, type: 'Import', basePrice: 60858, promotion: 'ck 4.93% (đến 29.04.2026)', nearExpiry: 'HSD: 03/2027', image: 'https://i.postimg.cc/xdnDZvvr/bi-vien.webp' },
  { id: 15, name: 'BUSCOPAN VIÊN', minOrder: '1', minOrderQuantity: 1, price: 125790, type: 'Import', basePrice: 119800, image: 'https://i.postimg.cc/LsDKFJTw/buscopan-v.webp' },
  { id: 16, name: 'NOSPA 80 V', minOrder: '1', minOrderQuantity: 1, price: 27041, type: 'Import', basePrice: 25753, requireApproval: true, image: 'https://i.postimg.cc/rpjX2Djq/nospa-80-jfif.webp' },
  { id: 29, name: 'NO-SPA 40MG/2ML INJ AM25 VN', minOrder: '1', minOrderQuantity: 1, price: 146628, type: 'Import', basePrice: 139646, requireApproval: true, image: 'https://i.postimg.cc/L5hKr7Zq/no-spa-40mg-2ml-h-25-ong-1-638836122898829134.webp' },
  { id: 17, name: 'PHARMATON ENERGY', minOrder: '1', minOrderQuantity: 1, price: 228614, type: 'Import', originalPrice: 228614, promotion: 'Mua 1h ck 14.8%, 3h ck 29.6% (đến 31.03.2026)', basePrice: 211680, nearExpiry: 'HSD: 9/2026 & 10/2026', requireApproval: true, image: 'https://i.postimg.cc/LsDKFJDP/pmt-ene.webp' },
  { id: 27, name: 'PHARMATON VITALITY', minOrder: '1', minOrderQuantity: 1, price: 228614, type: 'Import', originalPrice: 228614, promotion: 'Mua 1h ck 6.4%, 3h ck 12.5% (đến 29.04.2026)', basePrice: 211680, image: 'https://i.postimg.cc/rmp6VqZs/pmt-vita.webp' },
  { id: 18, name: 'PHARMATON ESSENT', minOrder: '1', minOrderQuantity: 1, price: 205286, type: 'Import', basePrice: 190080, promotion: 'Mua 4h ck 19.7%, 8h ck 24.6% (đến 29.04.2026)', nearExpiry: 'HSD: 01/2027', requireApproval: true, image: 'https://i.postimg.cc/zBfmzq2G/pmt-essen.webp' },
  { id: 19, name: 'PHARMATON KIDDI', minOrder: '1', minOrderQuantity: 1, price: 167400, type: 'Import', promotion: 'Mua 2h ck 3.9%, 4h ck 7.9% (đến 29.04.2026)', basePrice: 155000, image: 'https://i.postimg.cc/Qt7zxVkC/pmt-kiddi.webp' },
  { id: 20, name: 'PHARMATON ENERGY FIZZI SỦI', minOrder: '1', minOrderQuantity: 1, price: 104760, type: 'Import', basePrice: 97000, promotion: 'Mua 3h ck 12.3% (đến 29.04.2026)', image: 'https://i.postimg.cc/43PkRYP9/pmt-fizzi.webp' },
  { id: 21, name: 'PHOSPHALUGEL 2.47G/20G GEL SC26 M36 VN', minOrder: '1', minOrderQuantity: 1, price: 120558, type: 'Import', basePrice: 114817, image: 'https://i.postimg.cc/N0DqvKDy/phospha.webp' },
  { id: 22, name: 'OSTELIN VIT D & CALCI CHAI 130V', minOrder: '1', minOrderQuantity: 1, price: 300000, type: 'Import', basePrice: 277778, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/zf7ZYy7f/ostelin-60-1.webp' },
  { id: 23, name: 'OSTELIN VIT D & CALCI CHAI 275V', minOrder: '1', minOrderQuantity: 1, price: 540000, type: 'Import', basePrice: 500000, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/KYfSh1fj/ostelin-275.webp' },
  { id: 24, name: 'OSTELIN VIT D & CALCI CHAI 30V', minOrder: '1', minOrderQuantity: 1, price: 130000, type: 'Import', basePrice: 120370, promotion: 'ck 5.91% (đến 29.04.2026)', image: 'https://i.postimg.cc/R0d5xWdC/ostelin-30.webp' },
  { id: 25, name: 'OSTELIN VIT D & CALCI CHAI 60V', minOrder: '1', minOrderQuantity: 1, price: 230000, type: 'Import', basePrice: 212963, promotion: 'Mua 2h ck 15.76%, 4h ck 17.73%, 5h ck 21.67% (đến 29.04.2026)', image: 'https://i.postimg.cc/TP0MvK0w/ostelin-60.webp' }
];

// Nhóm Telfast: KM theo doanh số đơn hàng (dùng cho getDiscountPercent)
// readonly number[] (không as const) để .includes(cartItem.id: number) hợp lệ với TypeScript
export const TELFAST_GROUP_IDS: readonly number[] = [7, 8];

// CTKM OPELLA 3/2026: DummyBox Local — đơn từ 1.000.000 (sau CK) nhóm SP bên + ít nhất 01 CORBIERE CALCIUM PLUS 3SUPX10 10ML → giảm 150k
export const DUMMY_BOX_LOCAL_PRODUCT_IDS = [1, 6, 7, 26] as const; // Corbiere Calcium Plus, Telfast HD/BD, Calcium Corbiere Extra 5ml
export const DUMMY_BOX_LOCAL_REQUIRED_PRODUCT_ID = 1; // CORBIERE CALCIUM PLUS 3SUPX10 10ML
export const DUMMY_BOX_LOCAL_MIN_AMOUNT = 1_000_000;

// CTKM OPELLA 3/2026: DummyBox Import — đơn từ 1.000.000 (sau CK) nhóm bên + ít nhất 01 PHARMATON VITALITY → giảm 150k
// Pharmaton Energy (id 17): tính giá gốc, ko tính chiết khấu 29.5%
export const DUMMY_BOX_IMPORT_PRODUCT_IDS = [17, 18, 20, 27, 12, 30] as const; // Pharmaton Energy, Essent, Fizzi, Vitality + Enterogermina (GUT 4B, 2B/20)
export const DUMMY_BOX_IMPORT_PHARMATON_ENERGY_ID = 17; // Khi tính tổng điều kiện: dùng originalPrice (ko áp CK 29.5%)
export const DUMMY_BOX_IMPORT_REQUIRED_PRODUCT_ID = 27; // PHARMATON VITALITY 40MG TAB BT30 M24 VN
export const DUMMY_BOX_IMPORT_MIN_AMOUNT = 1_000_000;

export const DUMMY_BOX_DISCOUNT = 150_000;

// CTKM CORBIERE CALCIUM PLUS: cứ mỗi 21 hộp được giảm trực tiếp 4.76%
export const CALCIPLUS_PROMO_PACK_SIZE = 21;
export const CALCIPLUS_PROMO_DISCOUNT_PERCENT = 0.0476;
/** CTKM gói 4.76% dùng chung cho CORBIERE CALCIUM PLUS + ENTEROGERMINA 2B/20 */
export const PACK_476_PRODUCT_IDS: readonly number[] = [1, 30];

// Nhóm OSTELIN: KM theo tổng basePrice nhóm (dùng cho getDiscountPercent)
export const OSTELIN_GROUP_IDS: readonly number[] = [22, 23, 24, 25];

/** Theo dõi gói Ostelin 60V (5h ck 21.97%) — khớp sheet Google & Apps Script */
export const OSTELIN_60V_PRODUCT_ID = 25;
/** Tối thiểu 5 hộp để áp CK 21.97% & ghi theo dõi (1 gói/đơn đủ điều kiện) */
export const OSTELIN_60V_GOI_MIN_QTY = 5;
export const OSTELIN_60V_GOI_SHEET = 'OSTELIN_60V_GOI';

export const CALCIPLUS_PRODUCT_ID = 1;

