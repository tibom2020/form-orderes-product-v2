import type { CartItem } from '../types';
import type {
  RebateCustomerNoticePayload,
  CustomerSalesNoticePayload,
  RegisterDisplayTBQ2Payload,
  ApproveDisplayTBQ2Payload,
  CancelDisplayTBQ2Payload,
  UpdateGoiPs25TBQ2Payload,
} from '../types';
import type { AiChatRequestPayload, AiChatResponse } from '../types';

/**
 * Bỏ ?query và #hash khỏi URL Web App.
 * Tránh ?sheet= rỗng / tham số thừa khiến doGet báo "Missing sheet parameter".
 */
export function webAppScriptUrlBase(url: string): string {
  const u = url.trim();
  const q = u.indexOf('?');
  const h = u.indexOf('#');
  const cut = Math.min(q === -1 ? u.length : q, h === -1 ? u.length : h);
  return u.slice(0, cut);
}

interface OrderPayload {
  employeeName: string;
  employeeCode: string;
  customerCode: string;
  customerName: string;
  note: string;
  items: CartItem[];
  isOnTopLiXi: boolean;
  isDummyBox?: boolean;
  isDummyBoxLocal?: boolean;
  isDummyBoxImport?: boolean;
  appliedRebates: string[];
  customerSummary?: string;
  ostelin60VPackages?: number;
  ostelin60VAmount?: number;
  ostelin60VQuantity?: number;
  ostelin60VDot2?: boolean;
  pharmatonViPackages?: number;
  pharmatonViAmount?: number;
  pharmatonViQuantity?: number;
  isPsOnInvoice25?: boolean;
  isChc2606Ontop?: boolean;
  psSuatApplied?: number;
  psSuatMax?: number;
  psTierLabel?: string;
}

export const postOrderToGoogleSheet = async (
  url: string,
  payload: OrderPayload
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error posting to Google Sheet:', error);
    return { status: 'error', message: `Không thể gửi đơn hàng. Vui lòng kiểm tra kết nối mạng.` };
  }
};

export type FetchSheetOptions = {
  /**
   * Hủy request sau N ms. Tránh treo mãi khi Web App chậm / không phản hồi
   * (mặc định: không giới hạn).
   */
  timeoutMs?: number;
};

/**
 * Tải dữ liệu từ Google Sheet dựa trên tham số sheetName
 */
export const fetchDataFromSheet = async <T>(
  url: string,
  sheetName: string,
  options?: FetchSheetOptions
): Promise<T[]> => {
  const { timeoutMs } = options || {};
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs != null && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    const base = webAppScriptUrlBase(url);
    const timestamp = new Date().getTime();
    const enc = encodeURIComponent(sheetName);
    const fetchUrl = `${base}?sheet=${enc}&_t=${timestamp}`;

    const response = await fetch(fetchUrl, { signal: controller.signal });
    if (!response.ok) {
      const snippet = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} — ${response.statusText}. ${snippet.slice(0, 200)}`);
    }
    const rawText = await response.text();
    const start = rawText.trimStart();
    if (
      start.toLowerCase().startsWith('<!doctype') ||
      start.toLowerCase().startsWith('<html') ||
      start.startsWith('<')
    ) {
      const titleMatch = /<\s*title[^>]*>([^<]+)/i.exec(rawText);
      const errHint =
        titleMatch
          ? `Trang lỗi (title: "${titleMatch[1].trim()}")`
          : 'Trang HTML từ Google (không phải doGet trả JSON)';
      console.error(
        `[${sheetName}] ${errHint}. Trên Apps Script: Triển khai → bản mới, truy cập = bất kỳ ai, cập nhật GOOGLE_SCRIPT_URL trong constants.ts.`
      );
      return [];
    }
    let data: unknown;
    try {
      data = rawText ? JSON.parse(rawText) : [];
    } catch {
      console.error(
        `[${sheetName}] Phản hồi không phải JSON. Kiểm tra URL Web App (triển khai mới) và mở thử bằng trình duyệt. Đoạn đầu:`,
        rawText.slice(0, 200)
      );
      return [];
    }
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      if (o.ok === false) {
        console.error(
          `[${sheetName}] Apps Script (doGet) lỗi:`,
          o.message ?? o.error ?? o
        );
        return [];
      }
      console.warn(
        `[${sheetName}] Kỳ vọng mảng JSON từ doGet, nhận object. Có thể thiếu tham số ?sheet= hoặc tên sheet sai:`,
        o
      );
    }
    return [];
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort) {
      console.error(`[${sheetName}] Hết thời gian chờ sau ${timeoutMs}ms (timeout).`);
    } else {
      const label = 'Failed to fetch' === (error as Error)?.message
        ? 'Không tới được script.google.com (mạng, tường lửa, hoặc URL Web App sai).'
        : `Error fetching from ${sheetName}`;
      console.error(label, error);
    }
    return [];
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
};

/** Đăng ký CT trưng bày Q2 — cần Web App trả JSON (CORS). */
export const submitDisplayTBQ2Registration = async (
  url: string,
  payload: Omit<RegisterDisplayTBQ2Payload, 'action'>
): Promise<{ status: string; message?: string }> => {
  try {
    const body: RegisterDisplayTBQ2Payload = { action: 'registerDisplayTBQ2', ...payload };
    const base = webAppScriptUrlBase(url);
    const response = await fetch(base, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { status?: string; ok?: boolean; message?: string };
      if (parsed.status === 'success') return { status: 'success' };
      if (parsed.ok === true) return { status: 'success' };
      return {
        status: 'error',
        message: String(parsed.message || '') || 'Gửi thất bại.',
      };
    } catch {
      return { status: 'error', message: text?.slice(0, 200) || 'Phản hồi không hợp lệ' };
    }
  } catch (error) {
    console.error('submitDisplayTBQ2Registration:', error);
    return { status: 'error', message: String(error) };
  }
};

export const submitDisplayTBQ2Approval = async (
  url: string,
  payload: Omit<ApproveDisplayTBQ2Payload, 'action'>
): Promise<{ status: string; message?: string }> => {
  try {
    const body: ApproveDisplayTBQ2Payload = { action: 'approveDisplayTBQ2', ...payload };
    const base = webAppScriptUrlBase(url);
    const response = await fetch(base, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { status?: string; ok?: boolean; message?: string };
      if (parsed.status === 'success') return { status: 'success' };
      if (parsed.ok === true) return { status: 'success' };
      return {
        status: 'error',
        message: String(parsed.message || '') || 'Phê duyệt thất bại.',
      };
    } catch {
      return { status: 'error', message: text?.slice(0, 200) || 'Phản hồi không hợp lệ' };
    }
  } catch (error) {
    console.error('submitDisplayTBQ2Approval:', error);
    return { status: 'error', message: String(error) };
  }
};

/** Admin cập nhật cột Gói PS 25% (YES/NO) trên DANGKYTBQ2 */
export const submitUpdateGoiPs25TBQ2 = async (
  url: string,
  payload: Omit<UpdateGoiPs25TBQ2Payload, 'action'>
): Promise<{ status: string; message?: string; goiPs25?: string }> => {
  try {
    const body: UpdateGoiPs25TBQ2Payload = { action: 'updateGoiPs25TBQ2', ...payload };
    const base = webAppScriptUrlBase(url);
    const response = await fetch(base, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as {
        status?: string;
        ok?: boolean;
        message?: string;
        goiPs25?: string;
      };
      if (parsed.status === 'success') {
        return { status: 'success', goiPs25: parsed.goiPs25 };
      }
      if (parsed.ok === true) return { status: 'success', goiPs25: parsed.goiPs25 };
      return {
        status: 'error',
        message: String(parsed.message || '') || 'Cập nhật thất bại.',
      };
    } catch {
      return { status: 'error', message: text?.slice(0, 200) || 'Phản hồi không hợp lệ' };
    }
  } catch (error) {
    console.error('submitUpdateGoiPs25TBQ2:', error);
    return { status: 'error', message: String(error) };
  }
};

export const submitCancelDisplayTBQ2Registration = async (
  url: string,
  payload: Omit<CancelDisplayTBQ2Payload, 'action'>
): Promise<{ status: string; message?: string }> => {
  try {
    const body: CancelDisplayTBQ2Payload = { action: 'cancelDisplayTBQ2', ...payload };
    const base = webAppScriptUrlBase(url);
    const response = await fetch(base, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { status?: string; ok?: boolean; message?: string };
      if (parsed.status === 'success') return { status: 'success', message: parsed.message };
      if (parsed.ok === true) return { status: 'success', message: parsed.message };
      return {
        status: 'error',
        message: String(parsed.message || '') || 'Hủy đăng ký thất bại.',
      };
    } catch {
      return { status: 'error', message: text?.slice(0, 200) || 'Phản hồi không hợp lệ' };
    }
  } catch (error) {
    console.error('submitCancelDisplayTBQ2Registration:', error);
    return { status: 'error', message: String(error) };
  }
};

export const submitMarketingData = async (
  url: string,
  payload: any
): Promise<{ status: string; message?: string; url?: string }> => {
  // uploadImage / setImageUrl: cần JSON (URL) → cors. registerPackage: no-cors.
  const needsJsonResponse = payload.action === 'uploadImage' || payload.action === 'setImageUrl';
  const mode = needsJsonResponse ? 'cors' : 'no-cors';

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: mode as RequestMode,
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // Chỉ dùng text/plain để tránh preflight
      body: JSON.stringify(payload),
    });

    // Với mode no-cors, response là opaque (không đọc được), ta mặc định là thành công
    if (mode === 'no-cors') {
      return { status: 'success' };
    }

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON response. Raw text:", text);
      return { status: 'error', message: `Invalid JSON response: ${text.substring(0, 100)}` };
    }
  } catch (error) {
    console.error('Error submitting marketing data:', error);
    // CRITICAL: Với mode no-cors (đăng ký gói), ta ưu tiên UI cập nhật xanh luôn (Optimistic),
    // nên trả về success kể cả khi catch được lỗi mạng/CORS.
    if (mode === 'no-cors') {
      return { status: 'success' };
    }
    return { status: 'error', message: 'Lỗi kết nối hoặc Script chưa được cập nhật bản mới.' };
  }
};

export const submitLiXiResult = async (
  url: string,
  payload: any
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Dùng no-cors tương tự như gửi đơn hàng
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'submitLiXi',
        ...payload
      }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting LiXi result:', error);
    return { status: 'error', message: 'Không thể lưu kết quả lì xì.' };
  }
};

export const submitAdminNews = async (
  url: string,
  payload: { adminName: string; message: string; timestamp: string }
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'adminNews',
        ...payload
      }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting Admin News:', error);
    return { status: 'error', message: 'Không thể gửi thông báo Admin.' };
  }
};

/** Gửi cập nhật Product Quota khi đơn hàng có SP Enterogermina 2B/20 hoặc NOSPA 80 V */
export const submitProductQuota = async (
  url: string,
  payload: { employeeName: string; employeeCode: string; items: { id: number; name: string; quantity: number; price: number }[] }
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateProductQuota', ...payload }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting Product Quota:', error);
    return { status: 'error', message: 'Không thể cập nhật Product Quota.' };
  }
};

export const submitRebateCustomerNotice = async (
  url: string,
  payload: RebateCustomerNoticePayload
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'rebateCustomerNotice',
        ...payload,
      }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting rebate customer notice:', error);
    return { status: 'error', message: 'Không thể gửi thông báo khách hàng qua webhook.' };
  }
};

/** Gửi comment GPP (đổi pháp nhân / code) vào Google Sheet */
export const submitGppComment = async (
  url: string,
  payload: {
    customerCode: string;
    customerName: string;
    rep: string;
    totalAmount: number;
    gppExpiryDate: string;
    comment: string;
    commentValue: string; // Để load lại đúng option khi refresh
    employeeName: string;
    employeeCode: string;
  }
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'submitGppComment', ...payload }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting GPP comment:', error);
    return { status: 'error', message: 'Không thể lưu comment vào Google Sheet.' };
  }
};

/** Gửi thông tin Doanh số KH qua n8n/Telegram (tương tự Rebate) */
export const submitCustomerSalesNotice = async (
  url: string,
  payload: CustomerSalesNoticePayload
): Promise<{ status: string; message?: string }> => {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'customerSalesNotice',
        ...payload,
      }),
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Error submitting customer sales notice:', error);
    return { status: 'error', message: 'Không thể gửi thông tin doanh số qua webhook.' };
  }
};

export const submitAiChat = async (
  url: string,
  payload: AiChatRequestPayload
): Promise<AiChatResponse> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'aiChat',
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }

    const data = await response.json() as AiChatResponse;
    if (data.status !== 'success') {
      return {
        status: 'error',
        message: data.message || 'AI không thể phản hồi lúc này.',
      };
    }

    return data;
  } catch (error) {
    console.error('Error submitting AI chat:', error);
    return {
      status: 'error',
      message: 'Không thể kết nối AI. Vui lòng thử lại sau.',
    };
  }
};

