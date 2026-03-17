# Google Apps Script - Smart Orders 2026

Refactor `doPost` với logic CalciPlus (gói 21h ck 4.76%).

## Cách sử dụng

1. Copy nội dung `Code.gs` vào project Apps Script hiện tại (thay thế hoặc merge với code cũ).
2. Đảm bảo `BOT_TOKEN`, `CHAT_ID`, `N8N_WEBHOOK_URL` được cấu hình đúng.
3. Tạo sheet **CALCIPLUS_GOI** (hoặc để script tự tạo khi có đơn đầu tiên có gói CalciPlus).
4. Đảm bảo `doGet` hỗ trợ `?sheet=CALCIPLUS_GOI` để tab Theo dõi gói CalciPlus fetch được dữ liệu.

## Thay đổi chính

- **Logic CalciPlus**: Khi đơn hàng có `calciPlusPackages > 0`, tự động append vào sheet CALCIPLUS_GOI.
- **Cấu trúc**: Tách `doPost` thành các handler riêng (`handleMarketing`, `handleOrder`, `handleForecast`, `handleAdminNews`, `handleRebateNotice`) cho dễ bảo trì.
- **Tự tạo sheet**: Nếu chưa có sheet CALCIPLUS_GOI, script sẽ tự tạo với header `Rep | SL_goi | Thanh_tien`.
- **Đã loại bỏ**: `handleLiXi` (vòng quay lì xì), `handleProductQuota` – không còn sử dụng.
