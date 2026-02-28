
const getDiscountPercent = (promotion, quantity, value) => {
    if (!promotion) return 0;
    // Lỗi ở đây: .includes('k') sẽ khớp với "ck", "kiddi", ...
    const isValueBased = promotion.toLowerCase().includes('đơn >=') || promotion.toLowerCase().includes('k');
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

// GIẢ LẬP: Mua 1 hộp Pharmaton Essent (giá 205,286)
// LẼ RA PHẢI LÀ 0% (vì chưa đủ 2h), nhưng nếu lỗi thì nó sẽ so sánh 205,286 >= 3 -> 4.92%
const promo = 'Mua 2h ck 2.46%, 3h ck 4.92% (đến 31.03.2026)';
const qty = 1;
const val = 205286;

const result = getDiscountPercent(promo, qty, val);
console.log(`Test Pharmaton 1h: ${result === 0 ? 'PASS' : 'FAIL'} (Expected 0, Got ${result})`);
