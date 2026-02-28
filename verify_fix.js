
const getDiscountPercent = (promotion, quantity, value) => {
    if (!promotion) return 0;
    // LOGIC ĐÃ SỬA
    const isValueBased = promotion.toLowerCase().includes('đơn >=') || /\d+\s*k/i.test(promotion);

    const tieredMatches = Array.from(promotion.matchAll(/(\d+(?:\.\d+)?)\s*(h|k)\s*(?:ck|chiết khấu|discount)?\s*(\d+(?:\.\d+)?)\s*%/gi));
    if (tieredMatches.length > 0) {
        const tiers = tieredMatches
            .map(m => {
                const thresholdRaw = parseFloat(m[1]);
                const unit = m[2].toLowerCase();
                const threshold = unit === 'k' ? thresholdRaw * 1000 : thresholdRaw;
                return { threshold, percent: parseFloat(m[3]) / 100, unit };
            })
            .sort((a, b) => b.threshold - a.threshold);
        const hasKUnit = tiers.some(t => t.unit === 'k');
        const isActuallyValueBased = isValueBased || hasKUnit;
        const compareValue = (isActuallyValueBased && value !== undefined) ? value : quantity;
        for (const tier of tiers) {
            if (compareValue >= tier.threshold) return tier.percent;
        }
        return 0;
    }
    return 0;
};

const tests = [
    { name: 'Pharmaton 1h (Qty based)', promo: 'Mua 2h ck 2.46%, 3h ck 4.92%', qty: 1, val: 205286, expected: 0 },
    { name: 'Pharmaton 2h (Qty based)', promo: 'Mua 2h ck 2.46%, 3h ck 4.92%', qty: 2, val: 410572, expected: 0.0246 },
    { name: 'Telfast (Value based)', promo: 'Mua đơn >= 500k ck 1.97%', qty: 1, val: 600000, expected: 0.0197 },
    { name: 'Telfast Below (Value based)', promo: 'Mua đơn >= 500k ck 1.97%', qty: 10, val: 400000, expected: 0 }
];

tests.forEach(t => {
    const result = getDiscountPercent(t.promo, t.qty, t.val);
    const pass = result === t.expected;
    console.log(`Test ${t.name}: ${pass ? 'PASS' : 'FAIL'} (Expected ${t.expected}, Got ${result})`);
});
