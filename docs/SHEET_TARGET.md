# Sheet TARGET - Target nhân viên theo Product Groups

App fetch sheet **TARGET** khi load để hiển thị Target và % Đạt trong KPI theo Nhóm Sản Phẩm (Total / Must Win / Other).

## Cấu trúc sheet

| Cột | Mô tả |
|-----|-------|
| **Sub Brand Name** (hoặc SubBrandName, Nhóm sản phẩm, Product) | Tên nhóm sản phẩm |
| **Group** | Import hoặc Local (tùy chọn) |
| **Phan Viet Linh** | Target cho NV Phan Viet Linh |
| **Huynh Hoang Hon** | Target cho NV Huynh Hoang Hon |
| **Huynh Thi To Trinh** | ... |
| **Huynh Van Thanh Huyen** | ... |
| **Le Huu Phuc** | ... |
| **Ly Minh Dat** | ... |
| **Nguyen Thi Hong Cam** | ... |
| **Truong Hoang Du** | ... |

Mỗi cột tên nhân viên chứa số target (doanh số) cho nhóm sản phẩm đó.

## Tên nhóm sản phẩm (map với code)

- ENTEROGERMINA, CAL CORBIERE, TELFAST, PHARMATON, BISOLVON, OSTELIN, ACEMUC, PHOSPHALUGEL (B.I), MAGNE B6
- Nospa Local / NOSPA Local
- Nospa Import / NOSPA Import
- BUSCOPAN (B.I)

## Apps Script doGet

Đảm bảo `GET ?sheet=TARGET` trả về JSON. App hỗ trợ 2 format:

**Format 1 (object):** `[{ "Sub Brand Name": "ENTEROGERMINA", "Group": "Import", "Phan Viet Linh": 123, ... }, ...]`

**Format 2 (array):** `[["Sub Brand Name", "Group", "Phan Viet Linh", ...], ["ENTEROGERMINA", "Import", 123, ...], ...]` — hàng 1 = header, các hàng sau = data.

Tên cột NV phải khớp chính xác với tên trong hệ thống (trim, không dấu thừa).
