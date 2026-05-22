import { ADMIN_CODE } from '../constants';
import type { Employee } from '../types';

/** Khớp dòng sale / sheet với NV đang chọn trên header (admin = xem tất cả). */
export function salesRecordMatchesEmployee(
  record: { Rep?: string; StaffCode?: string },
  employee: Employee
): boolean {
  if (employee.code === ADMIN_CODE) return true;
  const codeMatch = String(record.StaffCode ?? '').trim() === employee.code;
  const repMatch =
    String(record.Rep ?? '').toLowerCase().trim() === employee.name.toLowerCase().trim();
  return codeMatch || repMatch;
}

export function repNameMatchesEmployee(rep: string, employee: Employee): boolean {
  if (employee.code === ADMIN_CODE) return true;
  return rep.trim().toLowerCase() === employee.name.trim().toLowerCase();
}
