# Sheet CALCIPLUS_GOI - Theo dõi gói CalciPlus ck 4.76%

## Mục đích

Lưu và hiển thị số lượng gói CORBIERE CALCIUM PLUS ck 4.76% (mỗi gói = 21 hộp) theo từng Rep khi submit đơn hàng.

## Cấu trúc Sheet

Tạo sheet tên **CALCIPLUS_GOI** với hàng tiêu đề (row 1):

| Rep | SL_goi | Thanh_tien |
|-----|--------|------------|
| Nguyen Van A | 2 | 8500000 |
| Tran Thi B | 1 | 4200000 |

- **Rep**: Tên nhân viên (employeeName từ payload)
- **SL_goi**: Số gói 21h được ck 4.76% (calciPlusPackages)
- **Thanh_tien**: Thành tiền gói ck 4.76% (calciPlusAmount)

## doGet - Đọc dữ liệu

Khi frontend gọi `GET ?sheet=CALCIPLUS_GOI`, trả về mảng object tương ứng (đã có sẵn nếu doGet hỗ trợ tham số `sheet` như TARGET).

## doPost - Ghi khi nhận đơn hàng

Trong xử lý POST đơn hàng, **sau khi ghi đơn vào sheet chính**, thêm logic:

```javascript
// Sau khi xử lý đơn hàng (ghi vào sheet đơn, v.v.)
var calciPlusPackages = payload.calciPlusPackages || 0;
var calciPlusAmount = payload.calciPlusAmount || 0;

if (calciPlusPackages > 0 && calciPlusAmount > 0) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('CALCIPLUS_GOI');
  if (sheet) {
    var rep = payload.employeeName || '';
    sheet.appendRow([rep, calciPlusPackages, calciPlusAmount]);
  }
}
```

**Lưu ý**: Chỉ ghi khi `calciPlusPackages > 0` (đơn có CORBIERE CALCIUM PLUS đủ 21, 42, 63... hộp).

## Frontend

Tab **THEO DÕI GÓI CALCIPLUS** (chỉ Admin):
- Fetch `?sheet=CALCIPLUS_GOI`
- Gộp theo Rep: tổng SL_goi, tổng Thanh_tien
- Sắp xếp theo Thành tiền giảm dần
- Hiển thị tổng SL gói và tổng Thành tiền phía trên