# Thông báo Forecast qua Telegram & n8n

Khi user/admin xác nhận Forecast trong `ForecastForm`, AppScript cần gửi thông báo qua Telegram và n8n.

## 1. Thêm hàm gửi thông báo trong AppScript

Thêm hàm sau vào project Google Apps Script (cùng nơi có `sendTelegramNotification`, `sendAdminNewsNotification`):

```javascript
/**
 * Gửi thông báo khi xác nhận Forecast (Telegram + n8n)
 * @param {Object} data - Payload từ submitForecast
 */
function sendForecastNotification(data) {
  var BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  var CHAT_ID = PropertiesService.getScriptProperties().getProperty('CHAT_ID');
  var N8N_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('N8N_WEBHOOK_URL');

  var customerCode = data.customerCode || '';
  var customerName = data.customerName || '';
  var employeeName = data.employeeName || '';
  var importLevel = data.importLevel || '-';
  var localLevel = data.localLevel || '-';
  var expectedTotalT2 = data.expectedTotalT2 || 0;
  var targetMonthly = data.targetMonthly || 0;
  var reasonNotAchieved = data.reasonNotAchieved || '';

  var msg = '📊 *DỰ BÁO FORECAST T3*\\n' +
    '👤 Khách: ' + customerCode + ' - ' + customerName + '\\n' +
    '🧑‍💼 NV: ' + employeeName + '\\n' +
    '📦 Import: ' + importLevel + ' | Local: ' + localLevel + '\\n' +
    '💰 Expected Total T2: ' + expectedTotalT2 + '\\n' +
    '🎯 Target Tháng: ' + targetMonthly + '\\n' +
    (reasonNotAchieved ? '📝 Lý do: ' + reasonNotAchieved : '');

  // Telegram
  if (BOT_TOKEN && CHAT_ID) {
    try {
      sendTelegramNotification(BOT_TOKEN, CHAT_ID, msg);
    } catch (e) {
      Logger.log('Telegram forecast notification error: ' + e);
    }
  }

  // n8n webhook
  if (N8N_WEBHOOK_URL) {
    try {
      var payload = {
        source: 'forecast',
        event: 'forecast_submitted',
        customerCode: customerCode,
        customerName: customerName,
        employeeName: employeeName,
        importLevel: importLevel,
        localLevel: localLevel,
        expectedTotalT2: expectedTotalT2,
        targetMonthly: targetMonthly,
        reasonNotAchieved: reasonNotAchieved,
        timestamp: new Date().toISOString()
      };
      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      UrlFetchApp.fetch(N8N_WEBHOOK_URL, options);
    } catch (e) {
      Logger.log('n8n forecast notification error: ' + e);
    }
  }
}
```

## 2. Gọi trong doPost

Trong `doPost(e)`, sau khi xử lý `action === 'submitForecast'` và append vào sheet ForecastRecord, thêm:

```javascript
if (action === 'submitForecast') {
  // ... (code hiện tại: append ForecastRecord vào sheet) ...

  // Gửi thông báo Telegram + n8n
  try {
    sendForecastNotification(data);
  } catch (err) {
    Logger.log('Forecast notification error: ' + err);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Payload từ ForecastForm

ForecastForm đã gửi đầy đủ các trường cần thiết:

- `customerCode`, `customerName`, `employeeName`
- `importLevel`, `localLevel`, `importValue`, `localValue`
- `expectedGigaT2`, `expectedBMT2`, `expectedTotalT2`
- `targetMonthly`, `reasonNotAchieved`, `reason2`

## 4. Biến môi trường AppScript

Đảm bảo đã cấu hình trong Script Properties:

- `BOT_TOKEN` – Telegram bot token
- `CHAT_ID` – Telegram chat ID nhận thông báo
- `N8N_WEBHOOK_URL` – URL webhook n8n (nếu dùng)
