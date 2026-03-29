import type { SalesRecord } from '../types';

/** Ngưỡng doanh số quý (MustWin + Other) theo loại trưng bày — đồng bộ với Sale KH PS. */
export const GOLD_MIN = 40_000_000;
export const SILVER_MIN = 20_000_000;
export const BRONZE_MIN = 7_000_000;

export const getSaleQ1 = (r: SalesRecord): number => (Number(r.MustWin) || 0) + (Number(r.Other) || 0);

export const getStoreType = (r: SalesRecord): 'gold' | 'silver' | 'bronze' | null => {
    const ft = (r.FinalStoreType || '').toLowerCase();
    if (ft.includes('gold')) return 'gold';
    if (ft.includes('silver')) return 'silver';
    if (ft.includes('bronze')) return 'bronze';
    return null;
};

export const getMinForType = (type: 'gold' | 'silver' | 'bronze'): number => {
    if (type === 'gold') return GOLD_MIN;
    if (type === 'silver') return SILVER_MIN;
    return BRONZE_MIN;
};

export const isDat = (r: SalesRecord): boolean => {
    const type = getStoreType(r);
    const saleQ1 = getSaleQ1(r);
    if (!type) return saleQ1 >= BRONZE_MIN;
    return saleQ1 >= getMinForType(type);
};

/** Khách có FinalStoreType hợp lệ (tab Sale KH PS loại dummy). */
export const isPsDisplayRecord = (r: SalesRecord): boolean => {
    const ft = (r.FinalStoreType || '').trim();
    if (!ft) return false;
    if (ft.toLowerCase().includes('dummy')) return false;
    return true;
};
