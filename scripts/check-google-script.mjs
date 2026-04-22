/**
 * Kiểm tra GET tới Web App (đọc GOOGLE_SCRIPT_URL từ constants.ts).
 * Chạy: npm run check:script
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const constants = readFileSync(join(root, 'constants.ts'), 'utf8');
const m = constants.match(/GOOGLE_SCRIPT_URL\s*=\s*'([^']+)'/);
if (!m) {
  console.error('Không tìm thấy GOOGLE_SCRIPT_URL trong constants.ts');
  process.exit(1);
}
const base = m[1].split('?')[0].split('#')[0];
const url = `${base}?sheet=DANH_MUC_KH&_t=${Date.now()}`;
const timeoutMs = 45_000;

console.log('Đang gọi (GET)…\n' + url + '\n');

const ac = new AbortController();
const t = setTimeout(() => ac.abort(), timeoutMs);
try {
  const res = await fetch(url, { signal: ac.signal });
  const text = await res.text();
  console.log('HTTP', res.status, res.statusText);
  console.log('— Body (500 ký tự đầu) —');
  console.log(text.slice(0, 500));
  const st = text.trimStart();
  if (st.toLowerCase().startsWith('<!doctype') || st.toLowerCase().startsWith('<html') || st.startsWith('<')) {
    const tm = /<\s*title[^>]*>([^<]+)/i.exec(text);
    console.error(
      '\n!!! Web App trả HTML thay vì JSON (lỗi triển khai / URL cũ / quyền).' +
        (tm ? ` Tiêu đề: "${tm[1].trim()}"` : '') +
        '\n   → Trên Google Apps Script: Triển khai → Tạo bản mới, chạy dưới tài khoản bạn, "Ai có thể truy cập" = bất kỳ ai, dán URL /exec mới vào constants.ts.'
    );
    process.exit(1);
  }
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    console.log('\n(Dữ liệu không parse được JSON — kiểm tra triển khai / URL.)');
    process.exit(1);
  }
  if (Array.isArray(json)) {
    console.log(`\nOK: mảng JSON, length = ${json.length}`);
  } else if (json && typeof json === 'object' && json.ok === false) {
    console.log('\nApps Script trả lỗi (doGet):', json);
    process.exit(1);
  } else {
    console.log('\nCảnh báo: không phải mảng — app có thể trống dữ liệu. Kiểm tra doGet.', json);
  }
} catch (e) {
  if (e && e.name === 'AbortError') {
    console.error('Hết thời gian sau ' + timeoutMs + 'ms — không nhận được phản hồi (giống treo ở app).');
  } else {
    console.error('Lỗi:', e);
  }
  process.exit(1);
} finally {
  clearTimeout(t);
}
