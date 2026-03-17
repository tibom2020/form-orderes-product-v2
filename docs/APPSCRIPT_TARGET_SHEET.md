# Sheet TARGET - Hướng dẫn Apps Script

Nếu doGet chưa hỗ trợ sheet TARGET, thêm logic đọc sheet theo tham số `sheet`:

```javascript
// Trong doGet(e):
var sheetName = e.parameter.sheet || 'Sheet1';
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName(sheetName);
if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

var data = sheet.getDataRange().getValues();
if (data.length < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

var headers = data[0];
var result = [];
for (var i = 1; i < data.length; i++) {
  var row = {};
  for (var j = 0; j < headers.length; j++) {
    row[headers[j]] = data[i][j];
  }
  result.push(row);
}
return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
```

Khi gọi `GET ?sheet=TARGET`, sẽ trả về mảng object với keys = hàng 1 (Sub Brand Name, Group, Phan Viet Linh, ...).
