# Thông báo Doanh số KH qua Telegram & n8n

Khi user bấm **XUẤT DOANH SỐ** trên ô thông tin KH trong Dashboard (CustomerListItem), AppScript gửi thông tin doanh số qua Telegram và n8n (tương tự xuất Rebate).

## 1. Xử lý trong doPost

Thêm block sau vào doPost:

```javascript
if (data.action === "customerSalesNotice") {
  sendCustomerSalesNotification(data);
  return output.setContent(JSON.stringify({ status: "success" }));
}
```

## 2. Hàm sendCustomerSalesNotification (AppScript)

```javascript
function sendCustomerSalesNotification(data) {
  try {
    var message = data.message;

    // Fallback nếu thiếu message
    if (!message) {
      message =
        "📊 <b>THÔNG TIN DOANH SỐ KHÁCH HÀNG</b>\n" +
        "--------------------------------\n" +
        "🔢 <b>Code Giga:</b> " + clean(data.codeGiga || "") + "\n" +
        "🔢 <b>Code BM:</b> " + clean(data.codeBM || "") + "\n" +
        "🏠 <b>Tên KH:</b> " + clean(data.customerName || "") + "\n" +
        "🧑‍💼 <b>Nhân viên:</b> " + clean(data.employeeName || "");
    }

    // 1) Telegram
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML"
      }),
      muteHttpExceptions: true
    });

    // 2) n8n (giữ pipeline hiện tại)
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        event_type: "customer_sales_notice",
        data: data,
        full_message: message
      }),
      muteHttpExceptions: true
    });

  } catch (e) {
    Logger.log("Lỗi sendCustomerSalesNotification: " + e.toString());
  }
}
```

**Lưu ý:** Cần có sẵn hàm `clean()` trong project (dùng chung với rebate).

## 3. Payload từ Frontend

Frontend gửi payload với `action: 'customerSalesNotice'` và các trường:

| Trường | Mô tả |
|--------|-------|
| `code` | Mã KH (CustomerCode / Code Giga) |
| `codeGiga` | Code Giga |
| `codeBM` | Code BM (CodeBuyMed) |
| `customerName` | Tên khách hàng |
| `employeeName` | Tên nhân viên |
| `message` | Nội dung đã format (KPI tháng, tiền thưởng dự kiến, điều kiện TB, todo, v.v.) |

**Nội dung message** (đã format sẵn từ frontend) gồm:
- Thông tin KH, Code Giga, Code BM, Loại TB
- KPI tháng (Import, Local, % đạt, mức chiết khấu)
- Total DS Quý
- Tiền thưởng dự kiến (doanh số × % level chiết khấu)
- Điều kiện TB: trạng thái, doanh số đã đặt, Todo Import/Local/TB
- Counter Top, CDU (chỉ có khi có dữ liệu)
- "Vui lòng liên hệ TDV để biết thêm chi tiết về doanh số tháng"

## 4. Biến môi trường

Dùng chung với rebate/forecast:
- `BOT_TOKEN` – Telegram bot token
- `CHAT_ID` – Telegram chat ID
- `N8N_WEBHOOK_URL` – URL webhook n8n
