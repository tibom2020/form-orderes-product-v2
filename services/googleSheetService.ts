
import type { CartItem } from '../types';

interface OrderPayload {
  employeeName: string;
  employeeCode: string;
  customerCode: string;
  customerName: string;
  note: string;
  items: CartItem[];
  isOnTopLiXi: boolean;
  appliedRebates: string[];
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

/**
 * Tải dữ liệu từ Google Sheet dựa trên tham số sheetName
 */
export const fetchDataFromSheet = async <T>(url: string, sheetName: string): Promise<T[]> => {
  try {
    // Thêm timestamp (_t) để tránh browser cache kết quả cũ
    const separator = url.includes('?') ? '&' : '?';
    const timestamp = new Date().getTime();
    const fetchUrl = `${url}${separator}sheet=${sheetName}&_t=${timestamp}`;

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data as T[];
  } catch (error) {
    console.error(`Error fetching from ${sheetName}:`, error);
    return [];
  }
};

export const submitMarketingData = async (
  url: string,
  payload: any
): Promise<{ status: string; message?: string; url?: string }> => {
  // Với hành động upload ảnh, ta cần phản hồi JSON (URL ảnh) nên dùng mode 'cors'
  // Với các hành động khác (registerPackage), dùng 'no-cors' để tránh lỗi chặn request, đảm bảo lệnh đi được
  const isUpload = payload.action === 'uploadImage';
  const mode = isUpload ? 'cors' : 'no-cors';

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

