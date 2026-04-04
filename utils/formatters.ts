/** Escape cho Telegram HTML (tránh < > & làm hỏng parse_mode) */
const escapeHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Build message thông báo forecast (dùng khi gửi tới AppScript - AppScript ưu tiên data.message) */
export const buildForecastNotificationMessage = (params: {
    customerCode: string;
    customerName: string;
    employeeName: string;
    importLevel: string;
    localLevel: string;
    expectedTotalT2: number;
    targetMonthly: number;
    reasonNotAchieved?: string;
    forecastedCount: number;
    totalCount: number;
    timeStr?: string;
}) => {
    const { customerCode, customerName, employeeName, importLevel, localLevel, expectedTotalT2, targetMonthly, reasonNotAchieved, forecastedCount, totalCount } = params;
    const timeStr = params.timeStr ?? new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const progressStr = totalCount > 0 ? `${forecastedCount}/${totalCount}` : '-';
    return (
        '📊 <b>THÔNG BÁO DỰ BÁO DOANH SỐ T3</b>\n' +
        '--------------------------------\n' +
        `⏰ <b>Thời gian:</b> ${escapeHtml(timeStr)}\n` +
        `🔢 <b>Code:</b> ${escapeHtml(customerCode)}\n` +
        `🏠 <b>Tên KH:</b> ${escapeHtml(customerName)}\n` +
        `🧑‍💼 <b>Nhân viên:</b> ${escapeHtml(employeeName)}\n` +
        '--------------------------------\n' +
        `📦 <b>Mức Import:</b> ${escapeHtml(importLevel || '-')}\n` +
        `📦 <b>Mức Local:</b> ${escapeHtml(localLevel || '-')}\n` +
        `💰 <b>Expected Total T3:</b> ${formatCurrency(expectedTotalT2)}\n` +
        `🎯 <b>Target tháng:</b> ${formatCurrency(targetMonthly)}\n` +
        (reasonNotAchieved ? `📝 <b>Lý do không đạt Target:</b> ${escapeHtml(reasonNotAchieved)}\n` : '') +
        '--------------------------------\n' +
        `📈 <b>Tiến độ:</b> ${progressStr} KH dự báo`
    );
};

export const formatCurrency = (value: number) => {
    if (isNaN(value)) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(0);
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

/** Số đầy đủ kiểu VN: 5.000.000đ (dấu chấm phân tách hàng nghìn, hỗ trợ âm) */
export const formatVndDong = (value: number): string => {
    if (!Number.isFinite(value)) return '—';
    const n = Math.round(value);
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(abs)}đ`;
};

/** Lấy 2 chữ cái viết hoa từ tên (VD: "Ly Minh Dat" → "MD", "Le Huu Phuc" → "HP") */
export const getInitials = (name: string | undefined | null): string => {
    try {
        const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return '??';
        if (words.length === 1) return (words[0]?.slice(0, 2) || '??').toUpperCase();
        const last = words[words.length - 1]?.[0] ?? '';
        const second = words[words.length - 2]?.[0] ?? '';
        return (second + last).toUpperCase() || '??';
    } catch {
        return '??';
    }
};

export const removeVietnameseTones = (str: string): string => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Some system encode vietnamese combining accent as individual utf-8 characters
    // \u0300, \u0301, \u0303, \u0309, \u0323
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
    // Remove extra spaces
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
};
