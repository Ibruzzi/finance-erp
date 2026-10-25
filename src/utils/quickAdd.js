// Quick-add suggestions that adapt to how you actually use the app.
//
// Every past expense "votes" for its category > subcategory. A vote counts less the
// older it is (it halves every 3 days). So the options follow where you are in your
// routine: a few days of using "Staff shop" pushes it to the front, a few days at home
// using Boalhadhadige items pushes those to the front, and what you stop using fades.

const HALF_LIFE_DAYS = 3;
const SKIP_SUBCATEGORIES = ['Loan Repayment']; // needs a loan picked, so no shortcut

export function getQuickAddSuggestions(transactions, now = new Date(), limit = 6) {
  const byKey = new Map();

  for (const t of transactions || []) {
    if (t.deleted === true || t.type !== 'Expense') continue;
    if (!t.category || !t.subcategory || SKIP_SUBCATEGORIES.includes(t.subcategory)) continue;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) continue;

    const ageDays = Math.max(0, (now - d) / 86400000);
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

    const key = t.category + '||' + t.subcategory;
    let e = byKey.get(key);
    if (!e) {
      e = { category: t.category, subcategory: t.subcategory, score: 0, lastTime: -1, amount_original: '', currency: 'MVR' };
      byKey.set(key, e);
    }
    e.score += weight;
    if (d.getTime() >= e.lastTime) { // remember the most recent amount for pre-filling
      e.lastTime = d.getTime();
      e.amount_original = t.amount_original ?? '';
      e.currency = t.currency || 'MVR';
    }
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
