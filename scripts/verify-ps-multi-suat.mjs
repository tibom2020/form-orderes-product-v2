/**
 * Kiểm tra logic PS 25% multi-suất (node scripts/verify-ps-multi-suat.mjs)
 */

const MULTI = {
  gold: { minPerSuat: 3_200_000, discountPerSuat: 788_000, max: 2 },
  platinum: { minPerSuat: 4_800_000, discountPerSuat: 1_182_000, max: 2 },
  flagship: { minPerSuat: 4_000_000, discountPerSuat: 985_000, max: 3 },
};

function calc(baseSubtotal, rules, used, suatToApply) {
  const remaining = Math.max(0, rules.max - used);
  const suatFromCart = baseSubtotal >= rules.minPerSuat ? Math.floor(baseSubtotal / rules.minPerSuat) : 0;
  const maxPick = Math.min(suatFromCart, remaining);
  let suatApplied = 0;
  if (maxPick >= 1) {
    if (suatToApply != null && suatToApply > 0) suatApplied = Math.min(suatToApply, maxPick);
    else if (suatToApply == null) suatApplied = maxPick;
  }
  const minOrder = suatApplied * rules.minPerSuat;
  const discount = suatApplied * rules.discountPerSuat;
  const eligible = remaining > 0 && suatApplied >= 1 && baseSubtotal >= minOrder;
  return { suatApplied, discount, eligible, remaining };
}

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    failed++;
  } else console.log('OK:', name);
}

const g = MULTI.gold;
let r = calc(6_400_000, g, 0, 2);
ok('Gold 6.4M x2 suất', r.suatApplied === 2 && r.discount === 1_576_000 && r.eligible);
r = calc(6_500_000, g, 0, 2);
ok('Gold 6.5M above min (không cần chia hết)', r.suatApplied === 2 && r.eligible);
r = calc(3_200_000, g, 1, 1);
ok('Gold 1 suất còn', r.suatApplied === 1 && r.remaining === 1 && r.eligible);
r = calc(3_200_000, g, 2, 1);
ok('Gold hết suất', r.remaining === 0 && !r.eligible);

const p = MULTI.platinum;
r = calc(9_600_000, p, 0, 2);
ok('Platinum 9.6M x2', r.suatApplied === 2 && r.discount === 2_364_000);

const f = MULTI.flagship;
r = calc(12_000_000, f, 0, 3);
ok('Flagship 12M x3', r.suatApplied === 3 && r.discount === 2_955_000);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll PS multi-suất checks passed.');
