# Báo cáo Kiểm tra App — Lỗi & Hiệu năng

> Ngày: 17/03/2026

## 1. LỖI (BUGS)

### 1.1. `handleUpdateQuantity` — Stale closure (App.tsx:328-331)

**Vấn đề:** Dùng `cart` trực tiếp trong callback thay vì functional update → có thể dùng state cũ khi click nhanh +/-.

```tsx
// HIỆN TẠI (SAI):
const handleUpdateQuantity = (productId: number, newQuantity: number) => {
  if (newQuantity <= 0) handleRemoveItem(productId);
  else setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
};
```

**Sửa:** Dùng functional update:

```tsx
const handleUpdateQuantity = (productId: number, newQuantity: number) => {
  if (newQuantity <= 0) handleRemoveItem(productId);
  else setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
};
```

---

### 1.2. `handleToggleRebate` — Gọi `setNote` trong callback của `setSelectedRebateIds` (App.tsx:298-316)

**Vấn đề:** Gọi `setNote` bên trong callback của `setSelectedRebateIds` dễ gây khó đọc và khó debug. Nên tách thành hai lệnh `setState` độc lập.

---

## 2. NGUYÊN NHÂN APP CHẠY CHẬM

### 2.1. Load 11 API cùng lúc khi đăng nhập (App.tsx:98-151)

`loadInitialData()` gọi 11 `fetchDataFromSheet` song song:

- DANH_MUC_KH, REBATE, DOANH_SO, HISTORY_GG, HISTORY_BM, DummyBoxRecord, ForecastRecord, LUCKY_WHEEL, ADMIN_NEWS, GPP_COMMENT, TARGET

**Hậu quả:**

- Google Apps Script có thể bị rate limit
- Mạng chậm → load lâu
- UI chờ tất cả xong mới ổn định

**Đã thực hiện (17/03/2026):**

- **Phase 1** (4 API): customers, rebates, sales, marketing (DummyBoxRecord) — load ngay khi app khởi động
- **Phase 2** (2 API): target, news — load song song sau Phase 1
- **Lazy**: purchaseHistory — chỉ load khi mở tab Dashboard
- **Lazy**: gppComments — chỉ load khi mở tab Rebate
- **Lazy**: forecast — chỉ load khi mở tab Landing / Dashboard / Forecast

---

### 2.2. App.tsx quá nhiều state (40+ biến)

Mỗi lần `setState` → toàn bộ App re-render → tất cả tab và component con re-render.

**Gợi ý:**

- Tách state theo tab (context hoặc reducer)
- Chỉ render tab đang active (đã làm đúng với `viewMode`)

---

### 2.3. ProductCard không dùng `React.memo`

Khoảng 30 ProductCard re-render mỗi khi cart, search, filter thay đổi.

**Gợi ý:** Bọc `ProductCard` bằng `React.memo`.

---

### 2.4. `handleAddToCart` không dùng `useCallback`

Mỗi lần App re-render tạo hàm mới → ProductCard nhận prop mới → re-render dù đã dùng `React.memo`.

**Gợi ý:** Bọc `handleAddToCart` bằng `useCallback`.

---

### 2.5. Cart: `totalSales` không memo

```tsx
const totalSales = items.reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
```

Tính lại mỗi lần Cart render.

**Gợi ý:** Dùng `useMemo` cho `totalSales`.

---

### 2.6. `handleCustomerCodeChange` — `allCustomers.find()` mỗi keystroke

Với nhiều khách hàng, mỗi lần gõ đều chạy `.find()` trên toàn bộ danh sách.

**Gợi ý:** Debounce hoặc dùng Map theo `code` để tra cứu O(1).

---

### 2.7. CustomerListItem không dùng `React.memo`

Dashboard có thể có hàng trăm khách hàng; mỗi lần filter/search thay đổi → tất cả item re-render.

**Gợi ý:** Bọc `CustomerListItem` bằng `React.memo`.

---

### 2.8. Không code splitting

Toàn bộ component (Dashboard, LandingPage, ForecastTab, RebateTab, …) load cùng lúc.

**Gợi ý:** Dùng `React.lazy` + `Suspense` cho từng tab.

---

### 2.9. Ảnh sản phẩm từ postimg.cc

30+ ảnh từ domain ngoài, có thể load chậm.

**Gợi ý:** Đã dùng `loading="lazy"`; có thể thêm placeholder hoặc CDN nếu cần.

---

## 3. ƯU TIÊN SỬA

| Ưu tiên | Hạng mục                         | Tác động |
|---------|----------------------------------|----------|
| 1       | Sửa `handleUpdateQuantity`       | Tránh lỗi giỏ hàng khi click nhanh |
| 2       | Chia nhỏ / lazy load API        | Giảm thời gian load ban đầu |
| 3       | `React.memo` cho ProductCard     | Giảm re-render khi tương tác đơn hàng |
| 4       | `useCallback` cho handlers      | Hỗ trợ memo hiệu quả |
| 5       | `React.memo` cho CustomerListItem| Giảm re-render Dashboard |
| 6       | Code splitting cho tab          | Giảm bundle và thời gian load ban đầu |

---

## 4. GHI CHÚ

- `React.StrictMode` trong dev khiến component render 2 lần → có thể thấy chậm hơn khi dev.
- Build production thường nhanh hơn dev.
