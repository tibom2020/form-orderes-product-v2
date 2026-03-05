# Thông báo Forecast qua Telegram & n8n

Khi user/admin xác nhận Forecast trong `ForecastForm` hoặc **Xuất báo cáo** trong `ForecastTab`, AppScript gửi thông báo qua Telegram và n8n.

## 1. Hàm sendForecastNotification (AppScript)

Cập nhật hàm `sendForecastNotification` để thêm **tiến độ KH dự báo** (forecastedCount/totalCount) vào cuối thông báo:

```javascript
function sendForecastNotification(data) {
  try {
    var now = new Date();
    var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss dd/MM/yyyy");

    // Tiến độ: số KH dự báo / tổng KH cần dự báo
    var forecastedCount = data.forecastedCount != null ? data.forecastedCount : 0;
    var totalCount = data.totalCount != null ? data.totalCount : 0;
    var progressStr = totalCount > 0 ? (forecastedCount + "/" + totalCount) : "-";

    // Ưu tiên message đã format từ frontend (nếu sau này bạn muốn custom)
    var message = data.message;

    // Fallback nếu thiếu message -> tự build giống style rebate
    if (!message) {
      message =
        "📊 <b>THÔNG BÁO DỰ BÁO DOANH SỐ T3</b>\n" +
        "--------------------------------\n" +
        "⏰ <b>Thời gian:</b> " + clean(timeStr) + "\n" +
        "🔢 <b>Code:</b> " + clean(data.customerCode) + "\n" +
        "🏠 <b>Tên KH:</b> " + clean(data.customerName || "") + "\n" +
        "🧑‍💼 <b>Nhân viên:</b> " + clean(data.employeeName || "") + "\n" +
        "--------------------------------\n" +
        "📦 <b>Mức Import:</b> " + clean(data.importLevel || "-") + "\n" +
        "📦 <b>Mức Local:</b> " + clean(data.localLevel || "-") + "\n" +
        "💰 <b>Expected Total T3:</b> " + formatCurrency(Number(data.expectedTotalT2 || 0)) + "\n" +
        "🎯 <b>Target tháng:</b> " + formatCurrency(Number(data.targetMonthly || 0)) + "\n" +
        (data.reasonNotAchieved
          ? "📝 <b>Lý do không đạt Target:</b> " + clean(data.reasonNotAchieved) + "\n"
          : "") +
        "--------------------------------\n" +
        "📈 <b>Tiến độ:</b> " + progressStr + " KH dự báo";
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

    // 2) n8n (tương tự rebate, đổi event_type)
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        event_type: "forecast_submit",
        data: Object.assign({}, data, { forecastedCount: forecastedCount, totalCount: totalCount, progress: progressStr }),
        full_message: message
      }),
      muteHttpExceptions: true
    });

  } catch (e) {
    Logger.log("Lỗi sendForecastNotification: " + e.toString());
  }
}
```

**Lưu ý:** Cần có sẵn các hàm `clean()` và `formatCurrency()` trong project (dùng chung với rebate).

## 2. Gọi trong doPost

### 2a. submitForecast (lưu dự báo)

- Nếu `data.skipNotification === true` (từ ForecastTab quick forecast): **chỉ lưu** vào sheet, **không** gửi thông báo.
- Nếu không có `skipNotification` hoặc `false` (từ ForecastForm chi tiết): lưu **và** gửi thông báo ngay.
- **Quan trọng:** Phải truyền **toàn bộ object `data`** (đã parse từ `e.postData.contents`) vào `sendForecastNotification(data)` để nhận được `message` và `forecastedCount`/`totalCount` từ frontend.

```javascript
// Trong doPost, parse body:
var data = JSON.parse(e.postData.contents);
var action = data.action;

if (action === 'submitForecast') {
  // ... (code hiện tại: append ForecastRecord vào sheet) ...

  // Gửi thông báo CHỈ KHI không skip - truyền NGUYÊN data (có message, forecastedCount, totalCount)
  if (!data.skipNotification) {
    try {
      sendForecastNotification(data);
    } catch (err) {
      Logger.log('Forecast notification error: ' + err);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2b. triggerForecastNotification (chỉ gửi thông báo)

Khi user bấm **Xuất báo cáo** trong ForecastTab, app gọi action này để gửi thông báo lần lượt cho từng KH trong list chờ. Frontend gửi payload có `message` (đã format sẵn với tiến độ).

```javascript
if (action === 'triggerForecastNotification') {
  try {
    sendForecastNotification(data);  // data (đã parse từ doPost) có message, forecastedCount, totalCount
  } catch (err) {
    Logger.log('Trigger forecast notification error: ' + err);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Payload từ ForecastForm / ForecastTab

**Frontend đã gửi sẵn `message`** (đã format đầy đủ bao gồm tiến độ). AppScript ưu tiên dùng `data.message` khi có.

Các trường gửi kèm:

- `customerCode`, `customerName`, `employeeName`
- `importLevel`, `localLevel`, `importValue`, `localValue`
- `expectedGigaT2`, `expectedBMT2`, `expectedTotalT2`
- `targetMonthly`, `reasonNotAchieved`, `reason2`
- **`forecastedCount`**, **`totalCount`** – Số KH đã dự báo / tổng KH cần dự báo
- **`message`** – Message đã format sẵn (HTML, có tiến độ X/Y KH dự báo)

## 4. Biến môi trường AppScript

Đảm bảo đã cấu hình trong Script Properties:

- `BOT_TOKEN` – Telegram bot token
- `CHAT_ID` – Telegram chat ID nhận thông báo
- `N8N_WEBHOOK_URL` – URL webhook n8n (nếu dùng)
