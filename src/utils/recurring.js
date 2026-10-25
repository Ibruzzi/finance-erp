// Recurring transactions (rent, subscriptions, salary...).
// Nothing is added automatically: when a rule's day arrives it shows up as a
// SUGGESTION on the Dashboard and you approve or reject it.
//
// A rule looks like:
//   { id, name, type: 'Expense'|'Income', category, subcategory, amount, currency,
//     day (1-31; short months use their last day), notes, loan_uuid, active,
//     startMonth: 'YYYY-MM', handled: { 'YYYY-MM': 'approved' | 'rejected' } }

// How many past months can still be suggested (if you did not open the app for a while).
export const RECURRING_LOOKBACK_MONTHS = 2;

export function monthKeyOf(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The due date inside a month, as local noon (safe from time-zone day shifts).
export function dueDateFor(monthKey, day) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(day) || 1), lastDay);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Suggestions that are due now and not yet approved/rejected, oldest first.
export function getDueRecurring(rules, now = new Date()) {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const items = [];
  for (const rule of rules || []) {
    if (!rule || rule.active === false) continue;
    for (let back = RECURRING_LOOKBACK_MONTHS; back >= 0; back--) {
      const monthKey = monthKeyOf(now.getFullYear(), now.getMonth() - back);
      if (rule.startMonth && monthKey < rule.startMonth) continue;
      if (rule.handled && rule.handled[monthKey]) continue;
      const dueDate = dueDateFor(monthKey, rule.day);
      if (dueDate <= endOfToday) items.push({ rule, monthKey, dueDate });
    }
  }
  return items.sort((a, b) => a.dueDate - b.dueDate);
}
