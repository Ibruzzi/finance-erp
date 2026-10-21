// Month-end "enter your bank balance" reminder (used for the zakat calculation).
//
// A month becomes "due" once its LAST DAY has arrived. If the app isn't opened that
// day, the month stays due and the reminder simply appears the next time the app is
// opened. A month stops being due when a balance has been entered for it, or when
// you press "Skip this month".

// How many past months to look back. Older gaps are not nagged about; they can still
// be filled in from Settings -> Zakat Inputs.
export const REMINDER_LOOKBACK_MONTHS = 3;

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM" key for a year and a 0-based month index (handles month going below 0).
function monthKey(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Months (oldest first, as "YYYY-MM") that still need a bank balance.
//   now       - a Date (uses the device's local calendar day, not UTC)
//   balances  - the saved month_balances object
//   skipped   - array of "YYYY-MM" the user chose to skip
export function getDueReminderMonths(now, balances = {}, skipped = []) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const lastDayOfThisMonth = new Date(y, m + 1, 0).getDate();

  const candidates = [];
  for (let back = REMINDER_LOOKBACK_MONTHS; back >= 1; back--) {
    candidates.push(monthKey(y, m - back)); // earlier months: their last day has passed
  }
  if (now.getDate() === lastDayOfThisMonth) {
    candidates.push(monthKey(y, m)); // this month, but only on its last day
  }

  const hasBalance = (key) => {
    const v = balances ? balances[key] : undefined;
    return v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
  };

  return candidates.filter(key => !hasBalance(key) && !(skipped || []).includes(key));
}

export function monthLabel(key) {
  const [y, mo] = key.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
