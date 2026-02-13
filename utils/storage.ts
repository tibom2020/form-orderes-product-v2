
import type { Order } from '../types';

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
