/**
 * Google Apps Script - Smart Orders 2026
 * Refactored doPost với logic CalciPlus (gói 21h ck 4.76%)
 */

var BOT_TOKEN = "";
var CHAT_ID = ""; 
var N8N_WEBHOOK_URL = "";
var GEMINI_API_KEY = "";
var GEMINI_MODEL = "gemini-2.5-flash";

var clean = function(text) { return text ? text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; };
var formatCurrency = function(amount) { return new Intl.NumberFormat('vi-VN').format(amount); };


function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

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

    // --- CALCIPLUS: Ghi gói 21h ck 4.76% vào sheet THEO DÕI GÓI CALCIPLUS ---
    var calciPlusPackages = Number(data.calciPlusPackages) || 0;
    var calciPlusAmount = Number(data.calciPlusAmount) || 0;
    if (calciPlusPackages > 0 && calciPlusAmount >= 0) {
      var sheetCalci = ss.getSheetByName("CALCIPLUS_GOI");
      if (!sheetCalci) {
        sheetCalci = ss.insertSheet("CALCIPLUS_GOI");
        sheetCalci.appendRow(["Rep", "SL_goi", "Thanh_tien"]);
        sheetCalci.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#d9ead3");
      }
      sheetCalci.appendRow([data.employeeName || "", calciPlusPackages, calciPlusAmount]);
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
