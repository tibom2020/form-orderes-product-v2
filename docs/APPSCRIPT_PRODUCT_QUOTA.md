# Hướng dẫn tích hợp Product Quota với Google Apps Script

## Tổng quan

Tab **Product Quota** theo dõi số lượng đặt hàng 2 sản phẩm theo Rep:
- **ENTEROGERMINA 2 billion/5ml B/20 bottle** (ProductId: 30) – Quota: 4000 box
- **NOSPA 80 V** (ProductId: 16) – Quota: 400 box

## Sheet ProductQuota

Tạo sheet tên `ProductQuota` với các cột:

| EmployeeName | ProductId | ProductName | Quantity | TotalAmount |
|--------------|-----------|-------------|----------|-------------|
| Nguyen Van A | 30        | ENTEROGERMINA 2 billion/5ml B/20 bottle | 10 | 1692400 |
| Nguyen Van A | 16        | NOSPA 80 V  | 5        | 135205      |

## Xử lý trong doPost

Thêm block này **trước** dòng `return output.setContent(JSON.stringify({ status: "error", message: "Unknown action" }));`:

```javascript
    // ======================================================
    // ACTION 7: PRODUCT QUOTA (Theo dõi SL đặt hàng theo Rep)
    // ======================================================
    if (data.action === "updateProductQuota") {
      var sheetQuota = ss.getSheetByName("ProductQuota");
      if (!sheetQuota) {
        sheetQuota = ss.insertSheet("ProductQuota");
        sheetQuota.appendRow(["EmployeeName", "ProductId", "ProductName", "Quantity", "TotalAmount"]);
        sheetQuota.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e2efda");
      }

      var employeeName = data.employeeName || "";
      var items = data.items || [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.id === 30 || item.id === 16) {
          var totalAmount = (item.quantity || 0) * (item.price || 0);
          sheetQuota.appendRow([employeeName, item.id, item.name || "", item.quantity || 0, totalAmount]);
        }
      }
      return output.setContent(JSON.stringify({ status: "success" }));
    }
```

## Xử lý GET (fetch dữ liệu)

Khi `sheet=ProductQuota`, trả về mảng object với keys: `EmployeeName`, `ProductId`, `ProductName`, `Quantity`, `TotalAmount` (tương ứng header row).
