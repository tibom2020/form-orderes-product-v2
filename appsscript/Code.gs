/**
 * Google Apps Script - Smart Orders 2026
 * Refactored doPost — theo dõi gói Ostelin 60V (5h ck 21.97%) → sheet OSTELIN_60V_GOI
 */

var BOT_TOKEN = "";
var CHAT_ID = ""; 
var N8N_WEBHOOK_URL = "";
var GEMINI_API_KEY = "";
var GEMINI_MODEL = "gemini-2.5-flash";

var clean = function(text) { return text ? text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; };
var formatCurrency = function(amount) { return new Intl.NumberFormat('vi-VN').format(amount); };

/** GET ?sheet=TEN_SHEET — trả JSON mảng object (hàng 1 = header). Cần deploy Web App: Anyone. */
function doGet(e) {
  try {
    var sheetParam = e.parameter.sheet;
    if (!sheetParam) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, message: "Missing sheet parameter" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetParam);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    var values = sheet.getDataRange().getValues();
    if (!values.length) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = values[0].map(function (x) { return String(x).trim(); });
    var out = [];
    for (var r = 1; r < values.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = values[r][c];
      }
      out.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- ACTION: ĐĂNG KÝ CT TRƯNG BÀY Q2 (DANGKYTBQ2 + REP_BUDGET_TBQ2) ---
    if (data.action === "registerDisplayTBQ2") {
      return handleRegisterDisplayTBQ2(data, ss, output);
    }
    if (data.action === "approveDisplayTBQ2") {
      return handleApproveDisplayTBQ2(data, ss, output);
    }

    // --- ACTION: MARKETING (Upload Ảnh & Đăng Ký Gói) ---
    if (data.action === "uploadImage" || data.action === "registerPackage") {
      return handleMarketing(data, ss, output);
    }

    // --- ACTION: GỬI ĐƠN HÀNG ---
    if (data.items && Array.isArray(data.items) && !data.action) {
      return handleOrder(data, ss, output);
    }

    // --- ACTION: FORECAST T3 ---
    if (data.action === "submitForecast") {
      return handleForecast(data, ss, output);
    }

    // --- ACTION: ADMIN NEWS ---
    if (data.action === "adminNews") {
      return handleAdminNews(data, ss, output);
    }

    // --- ACTION: REBATE CUSTOMER NOTICE ---
    if (data.action === "rebateCustomerNotice") {
      return handleRebateNotice(data, ss, output);
    }

    // --- ACTION: CUSTOMER SALES NOTICE ---
    if (data.action === "customerSalesNotice") {
      sendCustomerSalesNotification(data);
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    // --- ACTION: AI CHAT ---
    if (data.action === "aiChat") {
      return handleAiChat(data, output);
    }

    // --- ACTION: GPP COMMENT ---
    if (data.action === "submitGppComment") {
      saveGppCommentToSheet(data);
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    return output.setContent(JSON.stringify({ status: "error", message: "Unknown action" }));

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ======================================================
// HANDLERS
// ======================================================

function handleMarketing(data, ss, output) {
  var sheetName = data.sheetName || "DummyBoxRecord";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy Sheet: " + sheetName }));
  }

  var customerCode = String(data.customerCode).trim();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var codeIndex = headers.indexOf("CustomerCode");
  if (codeIndex === -1) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy cột 'CustomerCode'" }));
  }

  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][codeIndex]).trim() === customerCode) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy Mã KH: " + customerCode }));
  }

  if (data.action === "uploadImage") {
    var targetColumn = data.targetColumn || "UpHinh";
    var colIndex = headers.indexOf(targetColumn);
    if (colIndex === -1) {
      return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy cột '" + targetColumn + "'" }));
    }
    var imageBase64 = data.image;
    var contentType = data.mimeType || "image/jpeg";
    var timestampStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
    var blob = Utilities.newBlob(Utilities.base64Decode(imageBase64), contentType, customerCode + "_" + targetColumn + "_" + timestampStr + ".jpg");
    var folder = DriveApp.getFolderById("1bVA1vS04yQzpAMd5iA7EBgEgY4IgMUod");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();
    sheet.getRange(rowIndex, colIndex + 1).setValue(fileUrl);
    var noteColName = (targetColumn === "UpHinh") ? "GhiChu1" : "GhiChu2";
    var noteColIndex = headers.indexOf(noteColName);
    if (noteColIndex !== -1 && data.note) {
      sheet.getRange(rowIndex, noteColIndex + 1).setValue(data.note);
    }
    sendDummyBoxNotification(data, fileUrl);
    return output.setContent(JSON.stringify({ status: "success", url: fileUrl }));
  }

  if (data.action === "registerPackage") {
    var colIndex = headers.indexOf(data.packageType);
    if (colIndex === -1) {
      return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy cột '" + data.packageType + "'" }));
    }
    sheet.getRange(rowIndex, colIndex + 1).setValue(data.value || "YES");
    return output.setContent(JSON.stringify({ status: "success" }));
  }

  return output.setContent(JSON.stringify({ status: "error", message: "Unknown marketing action" }));
}

function handleOrder(data, ss, output) {
  var sheetOrder = ss.getSheetByName("Orders");
  if (!sheetOrder) {
    sheetOrder = ss.insertSheet("Orders");
    sheetOrder.appendRow(["Timestamp", "Employee", "CustomerCode", "CustomerName", "Note", "Product", "Quantity", "Price", "Total"]);
  }

  var timestamp = new Date();
  var items = data.items;
  var rowsToAdd = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    rowsToAdd.push([
      timestamp,
      data.employeeName,
      data.customerCode,
      data.customerName,
      data.note,
      item.name,
      item.quantity,
      item.price,
      (item.price || 0) * (item.quantity || 0)
    ]);
  }

  if (rowsToAdd.length > 0) {
    var lastRow = sheetOrder.getLastRow();
    sheetOrder.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);

    if (data.isOnTopLiXi) {
      updateLiXiOntopStats(ss, data.employeeName, data.customerCode, data.customerName, data.totalSales || 0);
    }

    // --- OSTELIN 60V: Ghi gói 5h ck 21.97% (1 gói/đơn đủ điều kiện) + KH để đối soát 1 gói/KH ---
    var ostelin60VPackages = Number(data.ostelin60VPackages) || 0;
    var ostelin60VAmount = Number(data.ostelin60VAmount) || 0;
    if (ostelin60VPackages > 0 && ostelin60VAmount >= 0) {
      var sheetOstelinGoi = ss.getSheetByName("OSTELIN_60V_GOI");
      if (!sheetOstelinGoi) {
        sheetOstelinGoi = ss.insertSheet("OSTELIN_60V_GOI");
        sheetOstelinGoi.appendRow(["Timestamp", "Rep", "CustomerCode", "CustomerName", "SL_hộp", "SL_goi", "Thanh_tien"]);
        sheetOstelinGoi.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
      }
      sheetOstelinGoi.appendRow([
        new Date(),
        data.employeeName || "",
        data.customerCode || "",
        data.customerName || "",
        Number(data.ostelin60VQuantity) || 0,
        ostelin60VPackages,
        ostelin60VAmount
      ]);
    }

    sendTelegramNotification(data);
  }

  return output.setContent(JSON.stringify({ status: "success" }));
}

function handleForecast(data, ss, output) {
  var sheet = ss.getSheetByName("ForecastRecord");
  if (!sheet) {
    sheet = ss.insertSheet("ForecastRecord");
    sheet.appendRow(["Timestamp", "Employee", "CustomerCode", "ImportLevel", "LocalLevel", "ImportValue", "LocalValue", "ExpectedGigaT2", "ExpectedBMT2", "ExpectedTotalT2", "TargetMonthly", "ReasonNotAchieved", "Reason2"]);
  }
  sheet.appendRow([
    new Date(),
    data.employeeName,
    data.customerCode,
    data.importLevel,
    data.localLevel,
    data.importValue,
    data.localValue,
    data.expectedGigaT2,
    data.expectedBMT2,
    data.expectedTotalT2,
    data.targetMonthly,
    data.reasonNotAchieved,
    data.reason2
  ]);
  sendForecastNotification(data);
  return output.setContent(JSON.stringify({ status: "success" }));
}

function handleAdminNews(data, ss, output) {
  var sheetNews = ss.getSheetByName("ADMIN_NEWS");
  if (!sheetNews) {
    sheetNews = ss.insertSheet("ADMIN_NEWS");
    sheetNews.appendRow(["Timestamp", "Admin Name", "Message"]);
    sheetNews.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#cfe2f3");
  }
  sheetNews.appendRow([data.timestamp, data.adminName, data.message]);
  sendAdminNewsNotification(data);
  return output.setContent(JSON.stringify({ status: "success" }));
}

function handleRebateNotice(data, ss, output) {
  var sheetNotice = ss.getSheetByName("REBATE_NOTICES");
  if (!sheetNotice) {
    sheetNotice = ss.insertSheet("REBATE_NOTICES");
    sheetNotice.appendRow(["Timestamp", "Code", "CustomerName", "EmployeeName", "NearestDueDate", "GppExpiryDate", "TotalLocalAmount", "TotalImportAmount", "TotalAmount", "Message"]);
    sheetNotice.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#fde9d9");
  }
  sheetNotice.appendRow([
    new Date(),
    data.code || "",
    data.customerName || "",
    data.employeeName || "",
    data.nearestDueDate || "",
    data.gppExpiryDate || "",
    Number(data.totalLocalAmount || 0),
    Number(data.totalImportAmount || 0),
    Number(data.totalAmount || 0),
    data.message || ""
  ]);
  sendRebateCustomerNoticeNotification(data);
  return output.setContent(JSON.stringify({ status: "success" }));
}

function handleAiChat(data, output) {
  try {
    if (!GEMINI_API_KEY) {
      return output.setContent(JSON.stringify({
        status: "error",
        message: "Chua cau hinh GEMINI_API_KEY trong Apps Script."
      }));
    }

    var userMessage = String(data.message || "").trim();
    if (!userMessage) {
      return output.setContent(JSON.stringify({
        status: "error",
        message: "Noi dung cau hoi khong duoc de trong."
      }));
    }

    var customerContext = data.customerContext || null;
    var contextText = "Khong co khach hang cu the.";
    if (customerContext) {
      contextText =
        "Ma KH: " + clean(customerContext.customerCode || "") + "\n" +
        "Ten KH: " + clean(customerContext.customerName || "") + "\n" +
        "Dia chi: " + clean(customerContext.address || "-") + "\n" +
        "Sales summary: " + clean(customerContext.salesSummary || "-") + "\n" +
        "Forecast summary: " + clean(customerContext.forecastSummary || "-");
    }

    var systemInstruction =
      "Ban la tro ly ban hang cho app Smart Orders. " +
      "Chi dua tren du lieu ngu canh duoc cung cap. " +
      "Neu trong ngu canh co doan 'BANG SO LIEU SAN CO' thi phai chep nguyen cac dong so lieu do vao cau tra loi (khong duoc bo trong). " +
      "KHONG dung bang Markdown (khong dung hang ngan cach bang dau |). Dung moi dong mot thong tin, hoac dau '; ' de tach cot. " +
      "Neu Sales summary ghi ro la khong tim thay dong DOANH_SO thi giai thich: app chua co ban ghi doanh so cho ma do (doi chieu sheet), khong noi la loi he thong. " +
      "Neu user hoi thang 1,2,3 va quy 1: dung dung khai niem T1/T2 trong ngu canh (theo sheet); neu khong du 3 thang rieng thi noi ro app chi co du lieu den muc nao. " +
      "Dau '-' nghia la truong trong sheet chua co. Luon dung day du ten khach trong ngu canh, khong rut ngan ten. " +
      "Neu thieu du lieu thi noi ro can bo sung gi. " +
      "Tra loi tieng Viet, day du so lieu, de hieu.";

    var prompt =
      systemInstruction + "\n\n" +
      "Thong tin ngu canh:\n" + contextText + "\n\n" +
      "Nhan vien: " + clean(data.employeeName || "") + "\n" +
      "Cau hoi user: " + userMessage;

    var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY;

    var payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096
      }
    };

    var response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    if (statusCode < 200 || statusCode >= 300) {
      return output.setContent(JSON.stringify({
        status: "error",
        message: "Gemini API loi (" + statusCode + ").",
        details: responseText
      }));
    }

    var parsed = JSON.parse(responseText);
    var cand = parsed && parsed.candidates && parsed.candidates[0];
    var parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
    var answer = "";
    for (var pi = 0; pi < parts.length; pi++) {
      if (parts[pi] && parts[pi].text) {
        answer += parts[pi].text;
      }
    }
    if (!answer || !answer.trim()) {
      answer = "Toi chua the phan hoi ro rang, ban thu dat cau hoi cu the hon.";
    }
    var fr = cand && cand.finishReason ? String(cand.finishReason) : "";
    if (fr === "MAX_TOKENS") {
      answer += "\n\n(Luu y: phan hoi co the bi gioi han do do dai — hay hoi ngan hon hoac tach cau hoi.)";
    }

    return output.setContent(JSON.stringify({
      status: "success",
      answer: answer
    }));
  } catch (err) {
    return output.setContent(JSON.stringify({
      status: "error",
      message: "Khong the xu ly AI chat.",
      details: err.toString()
    }));
  }
}

// ======================================================
// LIXI ONTOP STATS
// ======================================================

function updateLiXiOntopStats(ss, employeeName, customerCode, customerName, totalSales) {
  var sheetEmp = ss.getSheetByName("LIXI_ONTOP_STATS");
  if (!sheetEmp) {
    sheetEmp = ss.insertSheet("LIXI_ONTOP_STATS");
    sheetEmp.appendRow(["employeeName", "orderCount", "totalSales"]);
    sheetEmp.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#d9ead3");
  }
  updateSheetStats(sheetEmp, employeeName, totalSales, true);

  var sheetCust = ss.getSheetByName("LIXI_ONTOP_CUSTOMER_STATS");
  if (!sheetCust) {
    sheetCust = ss.insertSheet("LIXI_ONTOP_CUSTOMER_STATS");
    sheetCust.appendRow(["customerCode", "customerName", "totalSales", "employeeName"]);
    sheetCust.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#cfe2f3");
  }
  updateSheetStats(sheetCust, customerCode, totalSales, false, customerName, employeeName);
}

function updateSheetStats(sheet, key, totalSales, isEmployee, extraName, empName) {
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(key)) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex !== -1) {
    if (isEmployee) {
      sheet.getRange(rowIndex, 2).setValue(Number(values[rowIndex - 1][1]) + 1);
      sheet.getRange(rowIndex, 3).setValue(Number(values[rowIndex - 1][2]) + totalSales);
    } else {
      sheet.getRange(rowIndex, 3).setValue(Number(values[rowIndex - 1][2]) + totalSales);
      if (empName) sheet.getRange(rowIndex, 4).setValue(empName);
    }
  } else {
    if (isEmployee) {
      sheet.appendRow([key, 1, totalSales]);
    } else {
      sheet.appendRow([key, extraName, totalSales, empName]);
    }
  }
}

// ======================================================
// NOTIFICATIONS
// ======================================================

function sendAdminNewsNotification(data) {
  try {
    var message = "📢 <b>THÔNG BÁO QUAN TRỌNG TỪ ADMIN</b> 📢\n" +
      "--------------------------------\n" +
      "⏰ <b>Thời gian:</b> " + clean(data.timestamp) + "\n" +
      "👤 <b>Admin:</b> " + clean(data.adminName) + "\n" +
      "--------------------------------\n" +
      "📝 <b>Nội dung:</b>\n" +
      "<i>" + clean(data.message) + "</i>\n" +
      "--------------------------------\n" +
      "🚀 Vui lòng kiểm tra ứng dụng để biết thêm chi tiết!";
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "admin_news_update", data: data, full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendAdminNewsNotification: " + e.toString()); }
}

function sendTelegramNotification(data) {
  try {
    var items = data.items;
    var totalAmount = 0;
    var itemsText = "";
    var now = new Date();
    var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
    var dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemTotal = (item.price || 0) * (item.quantity || 0);
      totalAmount += itemTotal;
      itemsText += "▪️ <b>" + clean(item.name) + "</b>\n" +
        "   SL: " + item.quantity + " x " + formatCurrency(item.price) + " = " + formatCurrency(itemTotal) + "\n";
    }
    var message = "📦 <b>ĐƠN HÀNG MỚI (App 2026)</b>\n" +
      "--------------------------------\n" +
      "⏰ <b>Thời gian:</b> " + timeStr + " | " + dateStr + "\n" +
      "👤 <b>Khách hàng:</b> " + clean(data.customerName) + "\n" +
      "🔢 <b>Mã KH:</b> " + clean(data.customerCode) + "\n" +
      "🧑💼 <b>NV:</b> " + clean(data.employeeName) + "\n";
    if (data.note) { message += "📝 <b>Ghi chú:</b> " + clean(data.note) + "\n"; }
    message += "--------------------------------\n" + itemsText + "--------------------------------\n" +
      "💰 <b>TỔNG CỘNG: " + formatCurrency(totalAmount) + " VNĐ</b>\n";
    if (data.customerSummary) {
      message += "--------------------------------\n" + data.customerSummary + "\n";
    }
    message += "--------------------------------\n" + "💕 Cảm ơn <b>" + clean(data.employeeName) + "</b> đã lên đơn nhé! 💕";
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "new_order", data: data, total_amount: totalAmount, full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendTelegramNotification: " + e.toString()); }
}

function sendDummyBoxNotification(data, fileUrl) {
  try {
    var now = new Date();
    var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm");
    var dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    var imgSlot = (data.targetColumn === "UpHinh") ? "Hình 1" : "Hình 2";
    var message = "📸 <b>CHECK-IN DUMMYBOX THÀNH CÔNG</b>\n" +
      "--------------------------------\n" +
      "⏰ <b>Thời gian:</b> " + timeStr + " " + dateStr + "\n" +
      "🧑💼 <b>NV:</b> " + clean(data.employeeName) + "\n" +
      "🏠 <b>KH:</b> " + clean(data.customerName) + "\n" +
      "🔢 <b>Mã:</b> " + clean(data.customerCode) + "\n" +
      "🖼 <b>Loại:</b> " + imgSlot + "\n";
    if (data.note) { message += "📝 <b>Ghi chú:</b> " + clean(data.note) + "\n"; }
    if (data.customerSummary) { message += "--------------------------------\n" + data.customerSummary + "\n"; }
    message += "🔗 <a href='" + fileUrl + "'>XEM ẢNH TRƯNG BÀY</a>\n" +
      "--------------------------------\n\n" + "💪 <i>Tiếp tục phát huy nhé! 🚀</i>";
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "dummybox_checkin", data: data, image_url: fileUrl, full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendDummyBoxNotification: " + e.toString()); }
}

function sendRebateCustomerNoticeNotification(data) {
  try {
    var message = data.message;
    if (!message) {
      message = "📢 <b>THÔNG BÁO PHÍ TRẢ THƯỞNG KHÁCH HÀNG</b>\n" +
        "--------------------------------\n" +
        "⏰ <b>Thời gian:</b> " + clean(Utilities.formatDate(new Date(), "GMT+7", "HH:mm:ss dd/MM/yyyy")) + "\n" +
        "🔢 <b>Code:</b> " + clean(data.code) + "\n" +
        "🏠 <b>Tên KH:</b> " + clean(data.customerName) + "\n" +
        "🧑‍💼 <b>Nhân viên:</b> " + clean(data.employeeName) + "\n" +
        "📅 <b>Ngày đến hạn gần nhất:</b> " + clean(data.nearestDueDate) + "\n" +
        "🧾 <b>Ngày hết GPP:</b> " + clean(data.gppExpiryDate) + "\n" +
        "--------------------------------\n" +
        "💚 <b>Tổng Local:</b> " + formatCurrency(Number(data.totalLocalAmount || 0)) + "\n" +
        "💙 <b>Tổng Import:</b> " + formatCurrency(Number(data.totalImportAmount || 0)) + "\n" +
        "💰 <b>Tổng phí còn lại:</b> " + formatCurrency(Number(data.totalAmount || 0));
    }
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "rebate_customer_notice", data: data, full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendRebateCustomerNoticeNotification: " + e.toString()); }
}

function sendForecastNotification(data) {
  try {
    var forecastedCount = data.forecastedCount != null ? data.forecastedCount : 0;
    var totalCount = data.totalCount != null ? data.totalCount : 0;
    var progressStr = totalCount > 0 ? (forecastedCount + "/" + totalCount) : "-";
    var message = data.message;
    if (!message) {
      message = "📊 <b>THÔNG BÁO DỰ BÁO DOANH SỐ T3</b>\n" +
        "--------------------------------\n" +
        "⏰ <b>Thời gian:</b> " + clean(Utilities.formatDate(new Date(), "GMT+7", "HH:mm:ss dd/MM/yyyy")) + "\n" +
        "🔢 <b>Code:</b> " + clean(data.customerCode) + "\n" +
        "🏠 <b>Tên KH:</b> " + clean(data.customerName || "") + "\n" +
        "🧑‍💼 <b>Nhân viên:</b> " + clean(data.employeeName || "") + "\n" +
        "--------------------------------\n" +
        "📦 <b>Mức Import:</b> " + clean(data.importLevel || "-") + "\n" +
        "📦 <b>Mức Local:</b> " + clean(data.localLevel || "-") + "\n" +
        "💰 <b>Expected Total T3:</b> " + formatCurrency(Number(data.expectedTotalT2 || 0)) + "\n" +
        "🎯 <b>Target tháng:</b> " + formatCurrency(Number(data.targetMonthly || 0)) + "\n" +
        (data.reasonNotAchieved ? "📝 <b>Lý do không đạt Target:</b> " + clean(data.reasonNotAchieved) + "\n" : "") +
        "--------------------------------\n" +
        "📈 <b>Tiến độ:</b> " + progressStr + " KH dự báo";
    }
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "forecast_submit", data: Object.assign({}, data, { forecastedCount: forecastedCount, totalCount: totalCount, progress: progressStr }), full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendForecastNotification: " + e.toString()); }
}

function sendCustomerSalesNotification(data) {
  try {
    var message = data.message;
    if (!message) {
      message = "📊 <b>THÔNG TIN DOANH SỐ KHÁCH HÀNG</b>\n" +
        "--------------------------------\n" +
        "🔢 <b>Code Giga:</b> " + clean(data.codeGiga || "") + "\n" +
        "🔢 <b>Code BM:</b> " + clean(data.codeBM || "") + "\n" +
        "🏠 <b>Tên KH:</b> " + clean(data.customerName || "") + "\n" +
        "🧑‍💼 <b>Nhân viên:</b> " + clean(data.employeeName || "");
    }
    UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ event_type: "customer_sales_notice", data: data, full_message: message }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Lỗi sendCustomerSalesNotification: " + e.toString()); }
}

function saveGppCommentToSheet(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("GPP_COMMENT") || ss.insertSheet("GPP_COMMENT");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Thời gian", "NV gửi", "Mã NV", "Code KH", "Tên KH", "Rep", "Tổng phí", "Ngày hết GPP", "Comment"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    }
    sheet.appendRow([
      new Date(),
      data.employeeName || "",
      data.employeeCode || "",
      data.customerCode || "",
      data.customerName || "",
      data.rep || "",
      data.totalAmount || 0,
      data.gppExpiryDate || "",
      data.comment || ""
    ]);
  } catch (e) { Logger.log("Lỗi saveGppCommentToSheet: " + e.toString()); }
}

// ======================================================
// CT TRƯNG BÀY Q2 — DANGKYTBQ2 & REP_BUDGET_TBQ2
// ======================================================

/** Trùng mã NV admin trong app (constants.ADMIN_CODE) */
var TBQ2_ADMIN_EMPLOYEE_CODE = "20043741";

function colIndexTBQ2_(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var j = headers.indexOf(names[i]);
    if (j !== -1) return j;
  }
  return -1;
}

function ensureRepBudgetSheetTBQ2_(ss) {
  var name = "REP_BUDGET_TBQ2";
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(["Rep", "Budget", "Đã Sử dụng", "Còn lại"]);
    sh.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");
  }
  return sh;
}

function handleRegisterDisplayTBQ2(data, ss, output) {
  var customerCode = String(data.customerCode || "").trim();
  var customerName = String(data.customerName || "").trim();
  var employeeName = String(data.employeeName || "").trim();
  var employeeCode = String(data.employeeCode || "").trim();
  var storeTypeLabel = String(data.storeTypeLabel || "").trim();
  var storeTierId = String(data.storeTierId || "").trim();
  var rewardVnd = Number(data.rewardVnd) || 0;
  var posmSummary = String(data.posmSummary || "").trim();
  var customerAddress = String(data.customerAddress || "").trim();
  var sdtSubmit = String(data.sdt || "").trim();
  var posmFlagsJson = String(data.posmFlagsJson || "").trim();
  var isAdminRegister = String(employeeCode || "").trim() === TBQ2_ADMIN_EMPLOYEE_CODE;

  if (!customerCode || !storeTypeLabel || !employeeName) {
    return output.setContent(JSON.stringify({ status: "error", message: "Thiếu mã KH, Storetype hoặc tên NV." }));
  }

  var sheet = ss.getSheetByName("DANGKYTBQ2");
  if (!sheet) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy sheet DANGKYTBQ2. Tạo sheet và import mẫu Excel." }));
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return output.setContent(JSON.stringify({ status: "error", message: "Sheet DANGKYTBQ2 chưa có dữ liệu." }));
  }

  var headers = values[0].map(function (h) { return String(h).trim(); });
  var codeCol = colIndexTBQ2_(headers, ["CustomerCode", "MaKH", "Mã KH", "Code", "customerCode"]);
  var repCol = colIndexTBQ2_(headers, ["Rep", "REP", "NV phụ trách"]);
  var nameCol = colIndexTBQ2_(headers, ["CustomerName", "TenKH", "Tên KH", "Khách hàng"]);

  if (codeCol < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "DANGKYTBQ2 thiếu cột mã KH (CustomerCode / MaKH)." }));
  }

  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][codeCol]).trim() === customerCode) {
      rowIndex = r + 1;
      break;
    }
  }
  if (rowIndex < 0) {
    var newRow = [];
    for (var zi = 0; zi < headers.length; zi++) newRow.push("");
    newRow[codeCol] = customerCode;
    if (nameCol >= 0) newRow[nameCol] = customerName;
    if (repCol >= 0) newRow[repCol] = employeeName;
    var addrColNew = colIndexTBQ2_(headers, ["Address", "DiaChi", "Địa chỉ", "Dia chi", "DC", "DiaChiKH"]);
    if (addrColNew >= 0 && customerAddress) newRow[addrColNew] = customerAddress;
    sheet.appendRow(newRow);
    rowIndex = sheet.getLastRow();
    values = sheet.getDataRange().getValues();
  }

  var rowData = values[rowIndex - 1];
  if (repCol >= 0 && !isAdminRegister) {
    var rowRep = String(rowData[repCol] || "").trim();
    if (rowRep && employeeName && rowRep.toLowerCase() !== employeeName.toLowerCase()) {
      return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng không thuộc Rep của bạn." }));
    }
  }

  var ttCol = colIndexTBQ2_(headers, ["TrangThai", "Trạng thái", "Status"]);
  if (ttCol >= 0) {
    var st = String(rowData[ttCol] || "");
    if (st.indexOf("Đã Đăng ký") >= 0 || st.toLowerCase().indexOf("da dang ky") >= 0) {
      return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng đã được đăng ký." }));
    }
  }

  function setCell(colNames, value) {
    var ci = colIndexTBQ2_(headers, colNames);
    if (ci >= 0) sheet.getRange(rowIndex, ci + 1).setValue(value);
  }

  function posmLabelHeaderCandidates_(label) {
    var s = String(label).trim();
    if (!s) return [];
    var noSlash = s.replace(/\//g, " ");
    return [
      s,
      noSlash,
      s.replace(/\//g, ""),
      "POSM " + s,
      "POSM_" + s.replace(/[^a-zA-Z0-9À-ỹ]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
    ];
  }

  function setPosmOneFromLabel_(label) {
    var cands = posmLabelHeaderCandidates_(label);
    for (var pi = 0; pi < cands.length; pi++) {
      var ci = colIndexTBQ2_(headers, [cands[pi]]);
      if (ci >= 0) {
        sheet.getRange(rowIndex, ci + 1).setValue(1);
        return;
      }
    }
  }

  setCell(["StoreType", "Store Type", "LoaiCH", "Tier"], storeTypeLabel);
  setCell(["FinalStoreTypeQ2", "Final Store Type Q2", "FinalStoreType Q2"], storeTypeLabel);
  setCell(["StoreTierId", "storeTierId"], storeTierId);
  setCell(["POSM_CamKet", "POSM", "POSM Cam ket"], posmSummary);

  try {
    var flagsObj = posmFlagsJson ? JSON.parse(posmFlagsJson) : {};
    if (flagsObj && typeof flagsObj === "object") {
      Object.keys(flagsObj).forEach(function (k) {
        var v = flagsObj[k];
        if (v === 1 || v === "1" || v === true) setPosmOneFromLabel_(k);
      });
    }
  } catch (pe) {
    Logger.log("posmFlagsJson parse: " + pe);
  }

  if (sdtSubmit) {
    setCell(["SDT", "Phone", "Điện thoại", "SoDT", "SĐT", "DienThoai"], sdtSubmit);
  }
  setCell(["TrangThai", "Trạng thái", "Status"], "Đã Đăng ký");
  setCell(["PheDuyet", "Phê duyệt", "Phe duyet"], "Chờ duyệt");
  setCell(["NgayDangKy", "Ngày đăng ký"], new Date());
  setCell(["NVDangKy", "NV đăng ký"], employeeName);
  setCell(["MaNVDangKy", "EmployeeCode", "Mã NV"], employeeCode);
  if (customerName && nameCol >= 0) {
    var curName = String(sheet.getRange(rowIndex, nameCol + 1).getValue() || "").trim();
    if (!curName) sheet.getRange(rowIndex, nameCol + 1).setValue(customerName);
  }

  var bud = ensureRepBudgetSheetTBQ2_(ss);
  var lastCol = Math.max(4, bud.getLastColumn());
  var bh = bud.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
  var repBC = colIndexTBQ2_(bh, ["Rep", "REP"]);
  var budgetC = colIndexTBQ2_(bh, ["Budget", "Ngân sách"]);
  var usedC = colIndexTBQ2_(bh, ["Đã Sử dụng", "Da su dung", "DaSuDung"]);
  var leftC = colIndexTBQ2_(bh, ["Còn lại", "Con lai", "ConLai"]);
  if (repBC < 0 || budgetC < 0 || usedC < 0 || leftC < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "REP_BUDGET_TBQ2 cần cột: Rep, Budget, Đã Sử dụng, Còn lại" }));
  }

  var bvals = bud.getDataRange().getValues();
  var bRow = -1;
  for (var br = 1; br < bvals.length; br++) {
    if (String(bvals[br][repBC] || "").trim().toLowerCase() === employeeName.toLowerCase()) {
      bRow = br + 1;
      break;
    }
  }

  if (bRow < 0) {
    bud.appendRow([employeeName, 0, rewardVnd, -rewardVnd]);
  } else {
    var budget = Number(bud.getRange(bRow, budgetC + 1).getValue()) || 0;
    var used = Number(bud.getRange(bRow, usedC + 1).getValue()) || 0;
    used += rewardVnd;
    bud.getRange(bRow, usedC + 1).setValue(used);
    bud.getRange(bRow, leftC + 1).setValue(budget - used);
  }

  return output.setContent(JSON.stringify({ status: "success" }));
}

function handleApproveDisplayTBQ2(data, ss, output) {
  var empCode = String(data.employeeCode || "").trim();
  if (empCode !== TBQ2_ADMIN_EMPLOYEE_CODE) {
    return output.setContent(JSON.stringify({ status: "error", message: "Chỉ tài khoản admin được phê duyệt." }));
  }
  var customerCode = String(data.customerCode || "").trim();
  if (!customerCode) {
    return output.setContent(JSON.stringify({ status: "error", message: "Thiếu mã khách hàng." }));
  }
  var sheet = ss.getSheetByName("DANGKYTBQ2");
  if (!sheet) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy sheet DANGKYTBQ2." }));
  }
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return output.setContent(JSON.stringify({ status: "error", message: "Sheet DANGKYTBQ2 chưa có dữ liệu." }));
  }
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var codeCol = colIndexTBQ2_(headers, ["CustomerCode", "MaKH", "Mã KH", "Code", "customerCode"]);
  if (codeCol < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "Thiếu cột mã KH." }));
  }
  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][codeCol]).trim() === customerCode) {
      rowIndex = r + 1;
      break;
    }
  }
  if (rowIndex < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy mã KH." }));
  }
  function setCellAppr(colNames, value) {
    var ci = colIndexTBQ2_(headers, colNames);
    if (ci >= 0) sheet.getRange(rowIndex, ci + 1).setValue(value);
  }
  var ttCol = colIndexTBQ2_(headers, ["TrangThai", "Trạng thái", "Status"]);
  if (ttCol >= 0) {
    var st = String(sheet.getRange(rowIndex, ttCol + 1).getValue() || "");
    if (st.indexOf("Đã Đăng ký") < 0 && st.toLowerCase().indexOf("da dang ky") < 0) {
      return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng chưa ở trạng thái đã đăng ký." }));
    }
  }
  setCellAppr(["PheDuyet", "Phê duyệt", "Phe duyet"], "Đã duyệt");
  setCellAppr(["NgayPheDuyet", "Ngày phê duyệt"], new Date());
  var adminName = String(data.employeeName || "").trim();
  if (adminName) setCellAppr(["NVPheDuyet", "NV phê duyệt"], adminName);
  return output.setContent(JSON.stringify({ status: "success" }));
}
