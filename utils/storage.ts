
import type { Order, AiChatMessage } from '../types';

const AI_TUVAN_KEY_PREFIX = 'aiTuVanChat_v1';
const AI_TUVAN_MAX_MESSAGES = 200;

const isAiChatMessage = (m: unknown): m is AiChatMessage => {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  return (
    (o.role === 'user' || o.role === 'assistant') &&
    typeof o.content === 'string' &&
    typeof o.timestamp === 'string'
  );
};

/** Một hội thoại chung / user — đọc từ localStorage */
export const getAiTuVanMessages = (employeeCode: string): AiChatMessage[] => {
  if (!employeeCode) return [];
  try {
    const raw = localStorage.getItem(`${AI_TUVAN_KEY_PREFIX}:${employeeCode}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out = parsed.filter(isAiChatMessage);
    return out;
  } catch (e) {
    console.error('Error reading AI Tu van chat from localStorage:', e);
    return [];
  }
};

export const saveAiTuVanMessages = (employeeCode: string, messages: AiChatMessage[]): void => {
  if (!employeeCode) return;
  try {
    const trimmed = messages.slice(-AI_TUVAN_MAX_MESSAGES);
    localStorage.setItem(`${AI_TUVAN_KEY_PREFIX}:${employeeCode}`, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Error saving AI Tu van chat to localStorage:', e);
  }
};

export const getOrders = (key: 'draftOrders' | 'sentOrders'): Order[] => {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const orders: Order[] = JSON.parse(data);
      // Sắp xếp theo ngày tạo mới nhất
      return orders.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (error) {
    console.error(`Error reading orders from localStorage (${key}):`, error);
  }
  return [];
};

export const saveOrders = (key: 'draftOrders' | 'sentOrders', orders: Order[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(orders));
  } catch (error) {
    console.error(`Error saving orders to localStorage (${key}):`, error);
  }
};

const HIDDEN_PRODUCT_IDS_KEY_PREFIX = 'hiddenProductIds_v1';

export const getHiddenProductIds = (employeeCode: string): number[] => {
  if (!employeeCode) return [];
  try {
    const raw = localStorage.getItem(`${HIDDEN_PRODUCT_IDS_KEY_PREFIX}:${employeeCode}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
  } catch (e) {
    console.error('Error reading hidden product ids:', e);
    return [];
  }
};

export const saveHiddenProductIds = (employeeCode: string, ids: number[]): void => {
  if (!employeeCode) return;
  try {
    localStorage.setItem(`${HIDDEN_PRODUCT_IDS_KEY_PREFIX}:${employeeCode}`, JSON.stringify(ids));
  } catch (e) {
    console.error('Error saving hidden product ids:', e);
  }
};
