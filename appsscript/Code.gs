/**
 * Google Apps Script - Smart Orders 2026
 * Refactored doPost — theo dõi gói Ostelin 60V (5h ck 21.67%) → sheet OSTELIN_60V_GOI
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
    if (data.action === "cancelDisplayTBQ2") {
      return handleCancelDisplayTBQ2(data, ss, output);
    }
    if (data.action === "updateGoiPs25TBQ2") {
      return handleUpdateGoiPs25TBQ2(data, ss, output);
    }

    // --- ACTION: MARKETING (Upload Ảnh, Ghi URL ảnh có sẵn & Đăng Ký Gói) ---
    if (data.action === "uploadImage" || data.action === "setImageUrl" || data.action === "registerPackage") {
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

  /** Ghi URL Drive có sẵn (không tạo file mới) — dùng đồng bộ DummyBoxRecord ↔ DummyBoxRecordBs */
  if (data.action === "setImageUrl") {
    var targetColSet = data.targetColumn || "UpHinh";
    var colIdxSet = headers.indexOf(targetColSet);
    if (colIdxSet === -1) {
      return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy cột '" + targetColSet + "'" }));
    }
    var urlSet = String(data.imageUrl || "").trim();
    if (!urlSet) {
      return output.setContent(JSON.stringify({ status: "error", message: "Thiếu imageUrl" }));
    }
    sheet.getRange(rowIndex, colIdxSet + 1).setValue(urlSet);
    var noteNameSet = (targetColSet === "UpHinh") ? "GhiChu1" : "GhiChu2";
    var noteIdxSet = headers.indexOf(noteNameSet);
    if (noteIdxSet !== -1 && data.note) {
      sheet.getRange(rowIndex, noteIdxSet + 1).setValue(data.note);
    }
    return output.setContent(JSON.stringify({ status: "success", url: urlSet }));
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

    // --- OSTELIN 60V: Ghi gói 5h ck 21.67% (1 gói/đơn đủ điều kiện); cột Dot_2 = Đợt 2 ---
    var ostelin60VPackages = Number(data.ostelin60VPackages) || 0;
    var ostelin60VAmount = Number(data.ostelin60VAmount) || 0;
    if (ostelin60VPackages > 0 && ostelin60VAmount >= 0) {
      var sheetOstelinGoi = ss.getSheetByName("OSTELIN_60V_GOI");
      if (!sheetOstelinGoi) {
        sheetOstelinGoi = ss.insertSheet("OSTELIN_60V_GOI");
        sheetOstelinGoi.appendRow(["Timestamp", "Rep", "CustomerCode", "CustomerName", "SL_hộp", "SL_goi", "Thanh_tien", "Dot_2"]);
        sheetOstelinGoi.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d9ead3");
      } else if (sheetOstelinGoi.getLastColumn() < 8) {
        sheetOstelinGoi.getRange(1, 8).setValue("Dot_2").setFontWeight("bold").setBackground("#d9ead3");
      }
      var dot2Label = (data.ostelin60VDot2 === true || String(data.ostelin60VDot2).toLowerCase() === "true") ? "Đợt 2" : "";
      sheetOstelinGoi.appendRow([
        new Date(),
        data.employeeName || "",
        data.customerCode || "",
        data.customerName || "",
        Number(data.ostelin60VQuantity) || 0,
        ostelin60VPackages,
        ostelin60VAmount,
        dot2Label
      ]);
    }

    // --- GÓI 4.76%: Theo dõi CALCIPLUS (id=1) + ENTEROGERMINA 2B/20 (id=30) ---
    // Chỉ ghi khi user bật checkbox gói 4.76% lúc gửi đơn.
    var isPack476 = String(data.isCalciPlusPack476 || "").toLowerCase() === "true" || data.isCalciPlusPack476 === true;
    if (isPack476) {
      var sheetCalciGoi = ss.getSheetByName("CALCIPLUS_GOI");
      if (!sheetCalciGoi) {
        sheetCalciGoi = ss.insertSheet("CALCIPLUS_GOI");
        sheetCalciGoi.appendRow(["Timestamp", "Rep", "CustomerCode", "CustomerName", "Product", "SL_hộp", "SL_goi", "Thanh_tien"]);
        sheetCalciGoi.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#d9ead3");
      }

      var packSize = 21;
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var pid = Number(it.id || 0);
        if (pid !== 1 && pid !== 30) continue; // 1: CalciPlus, 30: Entero 2B/20

        var qty = Number(it.quantity || 0);
        if (qty <= 0) continue;
        var slGoi476 = Math.floor(qty / packSize);
        if (slGoi476 <= 0) continue; // Không đủ bội số 21 hộp thì không ghi

        var slHopEligible = slGoi476 * packSize;
        var gia = Number(it.price || 0);
        var thanhTien = Math.round(slHopEligible * gia);

        sheetCalciGoi.appendRow([
          new Date(),
          data.employeeName || "",
          data.customerCode || "",
          data.customerName || "",
          it.name || "",
          slHopEligible,
          slGoi476,
          thanhTien
        ]);
      }
    }

    // --- PS 25% On Invoice: cộng suất đã dùng trên DANGKYTBQ2 ---
    var isPs25 = String(data.isPsOnInvoice25 || "").toLowerCase() === "true" || data.isPsOnInvoice25 === true;
    var psSuatApplied = Math.max(0, Math.floor(Number(data.psSuatApplied) || 0));
    if (isPs25 && psSuatApplied > 0) {
      var psMaxSuat = Math.max(1, Math.floor(Number(data.psSuatMax) || 1));
      incrementPsSuatOnDangKyTBQ2_(ss, String(data.customerCode || "").trim(), psSuatApplied, psMaxSuat);
    }

    sendTelegramNotification(data);
  }

  return output.setContent(JSON.stringify({ status: "success" }));
}

/**
 * Cộng suất PS đã dùng trên DANGKYTBQ2; set Gói PS 25% = YES khi đủ suất tối đa.
 */
function incrementPsSuatOnDangKyTBQ2_(ss, customerCode, deltaSuat, maxSuat) {
  if (!customerCode || deltaSuat <= 0) return;
  var sheet = ss.getSheetByName("DANGKYTBQ2");
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var codeCol = colIndexTBQ2_(headers, ["CustomerCode", "MaKH", "Mã KH", "Code", "customerCode"]);
  if (codeCol < 0) return;
  var suatCol = colIndexTBQ2_(headers, [
    "Suất PS đã dùng",
    "Suat PS da dung",
    "SL suất PS",
    "SL suat PS",
    "SuatPSDaDung"
  ]);
  if (suatCol < 0) {
    suatCol = headers.length;
    sheet.getRange(1, suatCol + 1).setValue("Suất PS đã dùng");
    headers.push("Suất PS đã dùng");
  }
  var goiCol = colIndexTBQ2_(headers, [
    "Gói PS 25%",
    "Goi PS 25%",
    "GOI PS 25%",
    "Gói PS25",
    "DaDatGoiPS",
    "On invoice PS"
  ]);
  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][codeCol]).trim() === customerCode) {
      rowIndex = r + 1;
      break;
    }
  }
  if (rowIndex < 0) return;
  var cur = Math.max(0, Math.floor(Number(values[rowIndex - 1][suatCol]) || 0));
  var next = cur + deltaSuat;
  sheet.getRange(rowIndex, suatCol + 1).setValue(next);
  if (goiCol >= 0 && next >= maxSuat) {
    sheet.getRange(rowIndex, goiCol + 1).setValue("YES");
  }
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

/** Đăng ký CT trưng bày Q2 (DANGKYTBQ2) — Telegram + N8N giống luồng đơn hàng */
function sendDisplayTBQ2RegistrationNotification(payload) {
  try {
    var now = new Date();
    var timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
    var dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    var posmLines = "";
    try {
      var fo = payload.posmFlagsJson ? JSON.parse(payload.posmFlagsJson) : {};
      if (fo && typeof fo === "object") {
        Object.keys(fo).forEach(function (k) {
          var v = fo[k];
          if (v === 1 || v === "1" || v === true) posmLines += "▪️ " + clean(k) + "\n";
        });
      }
    } catch (pe) { Logger.log("TBQ2 notif posm parse: " + pe); }
    if (!posmLines && payload.posmSummary) {
      posmLines = "<code>" + clean(String(payload.posmSummary).replace(/</g, "")) + "</code>\n";
    }
    if (!posmLines) posmLines = "—\n";
    var message =
      "🏪 <b>THÔNG BÁO ĐĂNG KÝ THÀNH CÔNG PS 2026</b>\n" +
      "--------------------------------\n" +
      "⏰ <b>Thời gian:</b> " + timeStr + " | " + dateStr + "\n" +
      "🔢 <b>Code KH:</b> " + clean(payload.customerCode) + "\n" +
      "🏠 <b>Tên KH:</b> " + clean(payload.customerName) + "\n" +
      "📱 <b>SDT:</b> " + clean(payload.sdt || "") + "\n" +
      "👥 <b>Rep (sheet):</b> " + clean(payload.sheetRep || "") + "\n" +
      "--------------------------------\n" +
      "📌 <b>FinalStoreTypeQ2:</b> " + clean(payload.storeTypeLabel) + "\n" +
      "🧾 <b>Hạng mục / POSM:</b>\n" + posmLines +
      "--------------------------------\n" +
      "💰 <b>Tiền thưởng dự kiến:</b> " + formatCurrency(Number(payload.rewardVnd || 0)) + " VNĐ\n" +
      "--------------------------------\n" +
      "✅ Đã ghi DANGKYTBQ2 + trừ ngân sách REP_BUDGET_TBQ2.";
    if (BOT_TOKEN && CHAT_ID) {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
        muteHttpExceptions: true
      });
    }
    if (N8N_WEBHOOK_URL) {
      var posmList = [];
      try {
        var fo2 = payload.posmFlagsJson ? JSON.parse(payload.posmFlagsJson) : {};
        if (fo2 && typeof fo2 === "object") {
          Object.keys(fo2).forEach(function (k) {
            var v = fo2[k];
            if (v === 1 || v === "1" || v === true) posmList.push(k);
          });
        }
      } catch (e2) {}
      UrlFetchApp.fetch(N8N_WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          event_type: "display_tbq2_registration",
          data: {
            customer_code: payload.customerCode,
            customer_name: payload.customerName,
            sdt: payload.sdt || "",
            rep_sheet: payload.sheetRep || "",
            employee_name: payload.employeeName,
            employee_code: payload.employeeCode || "",
            final_store_type_q2: payload.storeTypeLabel,
            store_tier_id: payload.storeTierId || "",
            reward_vnd: Number(payload.rewardVnd) || 0,
            posm_summary: payload.posmSummary || "",
            posm_items: posmList,
            timestamp_iso: now.toISOString()
          },
          full_message: message
        }),
        muteHttpExceptions: true
      });
    }
  } catch (e) {
    Logger.log("Lỗi sendDisplayTBQ2RegistrationNotification: " + e.toString());
  }
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

/** Khớp tên Rep / NV đăng ký (giống logic app) */
function repNameMatchesTBQ2_(repCell, employeeName) {
  var a = String(repCell || "").trim().toLowerCase();
  var b = String(employeeName || "").trim().toLowerCase();
  if (!b) return false;
  if (!a) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

function tbq2RewardVndFromTierId_(tierId) {
  var m = {
    flagship_plus: 4000000,
    flagship: 3000000,
    platinum: 2400000,
    gold: 1600000,
    silver: 1200000,
    bronze: 300000
  };
  return Number(m[String(tierId || "").trim()]) || 0;
}

function tbq2RewardVndFromStoreLabel_(label) {
  var key = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\+\s*/g, "+");
  var m = {
    "flagship+": 4000000,
    flagship: 3000000,
    platinum: 2400000,
    gold: 1600000,
    silver: 1200000,
    bronze: 300000
  };
  return Number(m[key]) || 0;
}

function posmLabelHeaderCandidatesTBQ2_(label) {
  var s = String(label).trim();
  if (!s) return [];
  var noSlash = s.replace(/\//g, " ");
  var out = [
    s,
    noSlash,
    s.replace(/\//g, ""),
    "POSM " + s,
    "POSM_" + s.replace(/[^a-zA-Z0-9À-ỹ]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
  ];
  // Một số mẫu Excel dùng "Counter Top" thay vì "Countertop"
  var low = s.toLowerCase().replace(/\s+/g, " ");
  if (low === "countertop" || low.indexOf("countertop") === 0) {
    out.push("Counter Top");
    out.push("POSM Counter Top");
  }
  return out;
}

var TBQ2_POSM_KNOWN_LABELS = ["Frame OTC", "Frame FS", "Topboard", "Front Counter", "Countertop", "Countertop/CDU"];

/** Bronze/Silver chọn "Countertop/CDU" nhưng sheet chỉ có một cột "Countertop" — cần fallback khi ghi 1 */
function tbq2IsCountertopCduLabel_(label) {
  var L = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!L) return false;
  if (L === "countertop/cdu") return true;
  if (L.replace(/\s/g, "").indexOf("countertop") >= 0 && L.indexOf("cdu") >= 0) return true;
  return false;
}

function clearTbq2PosmFlagCells_(sheet, headers, rowIndex) {
  for (var li = 0; li < TBQ2_POSM_KNOWN_LABELS.length; li++) {
    var cands = posmLabelHeaderCandidatesTBQ2_(TBQ2_POSM_KNOWN_LABELS[li]);
    for (var pi = 0; pi < cands.length; pi++) {
      var ci = colIndexTBQ2_(headers, [cands[pi]]);
      if (ci >= 0) {
        sheet.getRange(rowIndex, ci + 1).clearContent();
        break;
      }
    }
  }
}

/** Hủy đăng ký Q2 (chỉ khi chưa phê duyệt): hoàn Budget cho đúng Rep / NV đăng ký */
function handleCancelDisplayTBQ2(data, ss, output) {
  var customerCode = String(data.customerCode || "").trim();
  var employeeName = String(data.employeeName || "").trim();
  var employeeCode = String(data.employeeCode || "").trim();
  if (!customerCode || !employeeName) {
    return output.setContent(JSON.stringify({ status: "error", message: "Thiếu mã KH hoặc tên NV." }));
  }
  var isAdminCancel = employeeCode === TBQ2_ADMIN_EMPLOYEE_CODE;

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
  var repCol = colIndexTBQ2_(headers, ["Rep", "REP", "NV phụ trách"]);
  var ttCol = colIndexTBQ2_(headers, ["TrangThai", "Trạng thái", "Status"]);
  var pdCol = colIndexTBQ2_(headers, ["PheDuyet", "Phê duyệt", "Phe duyet"]);
  var nvCol = colIndexTBQ2_(headers, ["NVDangKy", "NV đăng ký"]);
  var tierIdCol = colIndexTBQ2_(headers, ["StoreTierId", "storeTierId"]);
  var fq2Col = colIndexTBQ2_(headers, [
    "FinalStoreTypeQ2",
    "Final Store Type Q2",
    "FinalStoreType Q2",
    "Q2STATS",
    "Q2_STATS",
    "Q2 STATS"
  ]);

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

  var rowData = values[rowIndex - 1];
  var st = ttCol >= 0 ? String(rowData[ttCol] || "") : "";
  var stLo = st.toLowerCase();
  var isDaDangKy =
    st.indexOf("Đã Đăng ký") >= 0 || stLo.indexOf("da dang ky") >= 0 || stLo.indexOf("đã đăng ký") >= 0;
  var fq2Cell = fq2Col >= 0 ? String(rowData[fq2Col] || "").trim() : "";
  var tierCell = tierIdCol >= 0 ? String(rowData[tierIdCol] || "").trim() : "";
  if (!isDaDangKy && !fq2Cell && !tierCell) {
    return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng chưa ở trạng thái đã đăng ký." }));
  }

  var pdStr = pdCol >= 0 ? String(rowData[pdCol] || "").toLowerCase() : "";
  if (pdStr.indexOf("đã duyệt") >= 0 || pdStr.indexOf("da duyet") >= 0) {
    return output.setContent(
      JSON.stringify({
        status: "error",
        message: "Đã phê duyệt — không hủy qua app. Liên hệ admin để xử lý trên sheet nếu cần."
      })
    );
  }

  var rowRep = repCol >= 0 ? String(rowData[repCol] || "").trim() : "";
  var nvDangKy = nvCol >= 0 ? String(rowData[nvCol] || "").trim() : "";
  if (!isAdminCancel) {
    var okRep = repNameMatchesTBQ2_(rowRep, employeeName);
    var okNv = repNameMatchesTBQ2_(nvDangKy, employeeName);
    if (!okRep && !okNv) {
      return output.setContent(JSON.stringify({ status: "error", message: "Bạn không có quyền hủy đăng ký dòng này." }));
    }
  }

  var stId = tierIdCol >= 0 ? String(rowData[tierIdCol] || "").trim() : "";
  var reward = tbq2RewardVndFromTierId_(stId);
  if (!reward && fq2Col >= 0) {
    reward = tbq2RewardVndFromStoreLabel_(String(rowData[fq2Col] || ""));
  }
  if (!reward) {
    return output.setContent(
      JSON.stringify({
        status: "error",
        message: "Không xác định được tiền thưởng để hoàn ngân sách (thiếu StoreTierId / FinalStoreTypeQ2 hợp lệ)."
      })
    );
  }

  function setCell(colNames, value) {
    var ci = colIndexTBQ2_(headers, colNames);
    if (ci >= 0) sheet.getRange(rowIndex, ci + 1).setValue(value);
  }

  var repForBudget = nvDangKy || rowRep || employeeName;

  var bud = ensureRepBudgetSheetTBQ2_(ss);
  var lastCol = Math.max(4, bud.getLastColumn());
  var bh = bud.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
  var repBC = colIndexTBQ2_(bh, ["Rep", "REP"]);
  var budgetC = colIndexTBQ2_(bh, ["Budget", "Ngân sách"]);
  var usedC = colIndexTBQ2_(bh, ["Đã Sử dụng", "Da su dung", "DaSuDung"]);
  var leftC = colIndexTBQ2_(bh, ["Còn lại", "Con lai", "ConLai"]);
  if (repBC < 0 || budgetC < 0 || usedC < 0 || leftC < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "REP_BUDGET_TBQ2 thiếu cột bắt buộc." }));
  }

  var bvals = bud.getDataRange().getValues();
  var bRow = -1;
  for (var br = 1; br < bvals.length; br++) {
    if (String(bvals[br][repBC] || "").trim().toLowerCase() === repForBudget.toLowerCase()) {
      bRow = br + 1;
      break;
    }
  }
  if (bRow < 0) {
    for (var br2 = 1; br2 < bvals.length; br2++) {
      if (repNameMatchesTBQ2_(String(bvals[br2][repBC] || ""), repForBudget)) {
        bRow = br2 + 1;
        break;
      }
    }
  }
  if (bRow < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "Không tìm thấy dòng ngân sách Rep để hoàn tiền: " + repForBudget }));
  }

  var budget = Number(bud.getRange(bRow, budgetC + 1).getValue()) || 0;
  var used = Number(bud.getRange(bRow, usedC + 1).getValue()) || 0;
  used = Math.max(0, used - reward);
  bud.getRange(bRow, usedC + 1).setValue(used);
  bud.getRange(bRow, leftC + 1).setValue(budget - used);

  setCell(["StoreType", "Store Type", "LoaiCH", "Tier"], "");
  setCell(["FinalStoreTypeQ2", "Final Store Type Q2", "FinalStoreType Q2"], "");
  setCell(["StoreTierId", "storeTierId"], "");
  setCell(["POSM_CamKet", "POSM", "POSM Cam ket"], "");
  setCell(["TrangThai", "Trạng thái", "Status"], "Chưa đăng ký");
  setCell(["PheDuyet", "Phê duyệt", "Phe duyet"], "");
  setCell(["NgayDangKy", "Ngày đăng ký"], "");
  setCell(["NVDangKy", "NV đăng ký"], "");
  setCell(["MaNVDangKy", "EmployeeCode", "Mã NV"], "");
  setCell(["Item", "Mặt hàng", "Nhóm SP", "Ngành"], "");
  setCell(["Note", "Ghi chú", "Ghi chu"], "");

  clearTbq2PosmFlagCells_(sheet, headers, rowIndex);

  return output.setContent(JSON.stringify({ status: "success", message: "Đã hủy đăng ký và hoàn " + reward + " VNĐ vào ngân sách Rep." }));
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
  var note = String(data.note || "").trim();
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
  var fq2DupCol = colIndexTBQ2_(headers, [
    "FinalStoreTypeQ2",
    "Final Store Type Q2",
    "FinalStoreType Q2",
    "Q2STATS",
    "Q2_STATS",
    "Q2 STATS"
  ]);
  var tierDupCol = colIndexTBQ2_(headers, ["StoreTierId", "storeTierId"]);

  if (ttCol >= 0) {
    var st = String(rowData[ttCol] || "");
    var stLo = st.toLowerCase();
    if (st.indexOf("Đã Đăng ký") >= 0 || stLo.indexOf("da dang ky") >= 0 || stLo.indexOf("đã đăng ký") >= 0) {
      return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng đã được đăng ký." }));
    }
  } else {
    var fq2Left = fq2DupCol >= 0 ? String(rowData[fq2DupCol] || "").trim() : "";
    var tidLeft = tierDupCol >= 0 ? String(rowData[tierDupCol] || "").trim() : "";
    if (fq2Left || tidLeft) {
      return output.setContent(
        JSON.stringify({
          status: "error",
          message: "Sheet thiếu cột Trạng thái nhưng dòng vẫn có Q2/Tier — không đăng ký lại được. Thêm cột Trạng thái hoặc xóa Q2 trên sheet."
        })
      );
    }
  }

  function setCell(colNames, value) {
    var ci = colIndexTBQ2_(headers, colNames);
    if (ci >= 0) sheet.getRange(rowIndex, ci + 1).setValue(value);
  }

  function setPosmOneFromLabel_(label) {
    var cands = posmLabelHeaderCandidatesTBQ2_(label).slice();
    if (tbq2IsCountertopCduLabel_(label)) {
      var fb = posmLabelHeaderCandidatesTBQ2_("Countertop");
      for (var fi = 0; fi < fb.length; fi++) {
        if (cands.indexOf(fb[fi]) < 0) cands.push(fb[fi]);
      }
    }
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
  setCell(["Note", "Ghi chú", "Ghi chu"], note);

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
  setCell(["TrangThai", "Trạng thái", "Status"], "Đã đăng ký");
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

  var sheetRepForNotif = repCol >= 0 ? String(rowData[repCol] || "").trim() : "";
  sendDisplayTBQ2RegistrationNotification({
    customerCode: customerCode,
    customerName: customerName,
    employeeName: employeeName,
    employeeCode: employeeCode,
    sdt: sdtSubmit,
    sheetRep: sheetRepForNotif || employeeName,
    storeTypeLabel: storeTypeLabel,
    storeTierId: storeTierId,
    rewardVnd: rewardVnd,
    posmSummary: posmSummary,
    posmFlagsJson: posmFlagsJson
  });

  return output.setContent(JSON.stringify({ status: "success" }));
}

/** Admin cập nhật cột Gói PS 25% (YES/NO) trên DANGKYTBQ2 */
function handleUpdateGoiPs25TBQ2(data, ss, output) {
  var empCode = String(data.employeeCode || "").trim();
  if (empCode !== TBQ2_ADMIN_EMPLOYEE_CODE) {
    return output.setContent(JSON.stringify({ status: "error", message: "Chỉ admin được cập nhật Gói PS 25%." }));
  }
  var customerCode = String(data.customerCode || "").trim();
  if (!customerCode) {
    return output.setContent(JSON.stringify({ status: "error", message: "Thiếu mã khách hàng." }));
  }
  var goiPs25 = String(data.goiPs25 || "").trim().toUpperCase();
  if (goiPs25 !== "YES" && goiPs25 !== "NO") {
    return output.setContent(JSON.stringify({ status: "error", message: "Giá trị phải là YES hoặc NO." }));
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
  var goiCol = colIndexTBQ2_(headers, [
    "Gói PS 25%",
    "Goi PS 25%",
    "GOI PS 25%",
    "Gói PS25",
    "DaDatGoiPS",
    "On invoice PS"
  ]);
  if (goiCol < 0) {
    return output.setContent(JSON.stringify({ status: "error", message: "Sheet thiếu cột Gói PS 25%. Thêm cột trên DANGKYTBQ2." }));
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

  sheet.getRange(rowIndex, goiCol + 1).setValue(goiPs25);
  return output.setContent(JSON.stringify({ status: "success", goiPs25: goiPs25 }));
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
    var stLoAp = st.toLowerCase();
    if (st.indexOf("Đã Đăng ký") < 0 && stLoAp.indexOf("da dang ky") < 0 && stLoAp.indexOf("đã đăng ký") < 0) {
      return output.setContent(JSON.stringify({ status: "error", message: "Khách hàng chưa ở trạng thái đã đăng ký." }));
    }
  }
  setCellAppr(["PheDuyet", "Phê duyệt", "Phe duyet"], "Đã duyệt");
  setCellAppr(["NgayPheDuyet", "Ngày phê duyệt"], new Date());
  var adminName = String(data.employeeName || "").trim();
  if (adminName) setCellAppr(["NVPheDuyet", "NV phê duyệt"], adminName);
  return output.setContent(JSON.stringify({ status: "success" }));
}
