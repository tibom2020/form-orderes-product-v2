# Lưu Comment GPP (đổi pháp nhân / code) vào Google Sheet

Khi user chọn comment và bấm **Submit** trong phần CẢNH BÁO GPP (KH sắp hết hạn / đã hết hạn), AppScript lưu dữ liệu vào Google Sheet.

## 1. Xử lý trong doPost

Thêm block sau vào doPost:

```javascript
if (data.action === "submitGppComment") {
  saveGppCommentToSheet(data);
  return output.setContent(JSON.stringify({ status: "success" }));
}
```

## 2. Hàm saveGppCommentToSheet (AppScript)

```javascript
function saveGppCommentToSheet(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("GPP_COMMENT") || ss.insertSheet("GPP_COMMENT");
    
    // Thêm header nếu sheet trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Thời gian", "NV gửi", "Mã NV", "Code KH", "Tên KH", "Rep", "Tổng phí", "Ngày hết GPP", "Comment", "commentValue"]);
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold");
    }
    
    var row = [
      new Date(),
      data.employeeName || "",
      data.employeeCode || "",
      data.customerCode || "",
      data.customerName || "",
      data.rep || "",
      data.totalAmount || 0,
      data.gppExpiryDate || "",
      data.comment || "",
      data.commentValue || ""
    ];
    sheet.appendRow(row);
  } catch (e) {
    Logger.log("Lỗi saveGppCommentToSheet: " + e.toString());
  }
}
```

## 3. Payload từ Frontend

| Trường | Mô tả |
|--------|-------|
| `action` | `"submitGppComment"` |
| `customerCode` | Mã KH |
| `customerName` | Tên KH |
| `rep` | Tên Rep |
| `totalAmount` | Tổng phí còn lại |
| `gppExpiryDate` | Ngày hết GPP |
| `comment` | Nội dung đã chọn (label đầy đủ) |
| `commentValue` | Giá trị option (no_change, change_code, ...) — dùng để load lại khi refresh |
| `employeeName` | Tên NV gửi |
| `employeeCode` | Mã NV gửi |

## 4. Fetch dữ liệu khi load App (doGet)

App gọi `GET ?sheet=GPP_COMMENT` để load comment đã lưu. Đảm bảo doGet hỗ trợ trả về sheet GPP_COMMENT (tương tự các sheet khác như REBATE, DANH_MUC_KH). Khi trả về, mỗi row cần có cột **Code KH** và **commentValue** (hoặc **Comment** để map ngược).

## 5. Các lựa chọn Comment

1. KH không đổi pháp nhân - code giữ nguyên  
2. KH có đổi pháp nhân : thay đổi code  
2.1. KH sẽ trừ hết phí trước thời điểm block code  
2.2. KH bỏ phí ở code cũ còn lại  
