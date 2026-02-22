

export const ADMIN_CODE = '20043741'; // Phan Viet Linh
export const ADMIN_NAME = 'Phan Viet Linh';

export const KPI_TARGETS: Record<string, { Total: number, MustWin: number, Other: number, AO: number, MSO: number, Active: number }> = {
    'Huynh Hoang Hon': { Total: 1899923672, MustWin: 1106990861, Other: 792932811, AO: 130, MSO: 85, Active: 130 },
    'Huynh Thi To Trinh': { Total: 1801327943, MustWin: 1091590887, Other: 709737056, AO: 130, MSO: 85, Active: 130 },
    'Huynh Van Thanh Huyen': { Total: 2900304923, MustWin: 1706063145, Other: 1194241777, AO: 130, MSO: 85, Active: 130 },
    'Le Huu Phuc': { Total: 1703792575, MustWin: 817304886, Other: 886487689, AO: 130, MSO: 85, Active: 130 },
    'Ly Minh Dat': { Total: 1976406056, MustWin: 1253100503, Other: 723305553, AO: 130, MSO: 85, Active: 130 },
    'Nguyen Thi Hong Cam': { Total: 1599754667, MustWin: 892556791, Other: 707197876, AO: 130, MSO: 85, Active: 130 },
    'Truong Hoang Du': { Total: 2023730916, MustWin: 883013722, Other: 1140717195, AO: 130, MSO: 85, Active: 130 },
};

export const REBATE_TIERS = [
    { level: 1, amount: 1500000, percent: 3.0 },
    { level: 2, amount: 3000000, percent: 3.5 },
    { level: 3, amount: 5000000, percent: 4.0 },
    { level: 4, amount: 10000000, percent: 4.5 },
    { level: 5, amount: 15000000, percent: 5.0 },
    { level: 6, amount: 25000000, percent: 5.5 },
];

export const calculatePercent = (actual: number, target: number) => {
    if (!target || target === 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / target) * 100, 100);
};

export const getRawPercent = (actual: number, target: number) => {
    if (!target || target === 0) return 0;
    return (actual / target) * 100;
};

export const formatDateVal = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '';

    let date: Date;

    if (typeof val === 'number') {
        date = new Date((val - 25569) * 86400 * 1000);
    } else {
        const str = String(val);
        if (str.includes('T')) {
            date = new Date(str);
        } else {
            return str;
        }
    }

    if (!isNaN(date.getTime())) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    return String(val);
};

export const formatCompact = (amount: number) => {
    if (!amount || amount === 0) return '0';
    if (amount >= 1000000000) {
        return (amount / 1000000000).toFixed(1).replace(/\.0$/, '') + ' Tỷ';
    }
    if (amount >= 1000000) {
        return Math.round(amount / 1000000) + ' Tr';
    }
    if (amount >= 1000) {
        return Math.round(amount / 1000) + ' k';
    }
    return new Intl.NumberFormat('vi-VN').format(amount);
};

export const getRebateLevel = (amount: number) => {
    for (let i = REBATE_TIERS.length - 1; i >= 0; i--) {
        if (amount >= REBATE_TIERS[i].amount) {
            return REBATE_TIERS[i];
        }
    }
    return null;
};
