
export const getDiscountPercent = (promotion: string | undefined, quantity: number, value?: number): number => {
    if (!promotion) return 0;
    
    // Kiểm tra xem đây là KM theo giá trị đơn hàng (k) hay số lượng (h)
    const isValueBased = promotion.toLowerCase().includes('đơn >=') || promotion.toLowerCase().includes('k');
    
    // Tìm các cặp (mốc, phần trăm)
    // Regex hỗ trợ: 7h ck 5%, 500k ck 2%
    const tieredMatches = Array.from(promotion.matchAll(/(\d+)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi));
    
    if (tieredMatches.length > 0) {
        const tiers = tieredMatches
            .map(m => {
                const thresholdRaw = parseInt(m[1]);
                const unit = m[2].toLowerCase();
                const threshold = unit === 'k' ? thresholdRaw * 1000 : thresholdRaw;
                return { threshold, percent: parseFloat(m[3]) / 100, unit };
            })
            .sort((a, b) => b.threshold - a.threshold);
            
        const compareValue = (isValueBased && value !== undefined) ? value : quantity;

        for (const tier of tiers) {
            if (compareValue >= tier.threshold) return tier.percent;
        }
        return 0;
    }

    // Trường hợp chỉ có 1 mức % cố định
    const match = promotion.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match && match[1]) {
        return parseFloat(match[1]) / 100;
    }
    return 0;
};

export const calculateLineTotal = (price: number, quantity: number, promotion?: string, groupValue?: number): number => {
    const discount = getDiscountPercent(promotion, quantity, groupValue);
    return price * quantity * (1 - discount);
};
