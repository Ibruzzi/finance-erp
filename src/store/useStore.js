import { create } from 'zustand';
import { db, stableUuid } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

// Category entries the app's own logic depends on. They can be re-bucketed but not removed:
//  - the whole "Income" category (the Income tab of Add Transaction needs it)
//  - the whole "Personal" category (the default category)
//  - Personal > Zakat       (used by the zakat card and "Mark Paid")
//  - Personal > Loan Repayment (links repayments to loans)
export function isProtectedCategory(category) {
  return category === 'Income' || category === 'Personal';
}
export function isProtectedEntry(category, subcategory) {
  if (category === 'Personal' && (subcategory === 'Zakat' || subcategory === 'Loan Repayment')) return true;
  return false;
}

// The year your saved "Previous Year Monthly Balances" grid belongs to.
// (Entered in Oct 2026 as last year's month-end balances, so 2025.)
const PREV_BALANCES_YEAR = 2025;

export const useStore = create((set, get) => ({
  transactions: [],
  settings: {},
  loans: [],
  bucketMap: [],
  zakatLog: [],
  isLoading: true,

  loadData: async () => {
    // Note: isLoading starts as true, so the very first load shows the loading screen.
    // Later reloads (after a background sync) update quietly with no flash.
    // Filter out deleted rows, but allow rows where 'deleted' is undefined (legacy data)
    const transactions = await db.transactions.filter(t => t.deleted !== true).toArray();
    const settingsArray = await db.settings.filter(s => s.deleted !== true).toArray();
    const loans = await db.loans.filter(l => l.deleted !== true).toArray();
    const bucketMap = await db.bucket_map.filter(b => b.deleted !== true).toArray();
    const zakatLog = await db.zakat_log.toArray();

    const settings = settingsArray.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    set({ transactions, settings, loans, bucketMap, zakatLog, isLoading: false });
  },

  updateSetting: async (key, value) => {
    const { settings } = get();
    if (JSON.stringify(settings[key]) === JSON.stringify(value)) return;

    // Keep the row's existing uuid (or make a stable one) so it never loses its cloud id.
    const existingRow = await db.settings.get(key);
    await db.settings.put({
      key,
      value,
      uuid: existingRow?.uuid || stableUuid('setting|' + key),
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
      deleted: false,
    });
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },

  // ============ BUCKET MAP ============
  getBucketFromMap: (category, subcategory) => {
    const { bucketMap } = get();
    const row = bucketMap.find(
      r => r.category === category && r.subcategory === subcategory
    );
    return row ? row.bucket : 'Discretionary';
  },

  updateBucketFor: async (category, subcategory, newBucket) => {
    const { bucketMap } = get();
    const existing = bucketMap.find(
      r => r.category === category && r.subcategory === subcategory
    );

    if (existing) {
      await db.bucket_map.update(existing.id, {
        bucket: newBucket,
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
      });
      set((state) => ({
        bucketMap: state.bucketMap.map(r =>
          r.id === existing.id
            ? { ...r, bucket: newBucket, syncStatus: 'pending', updated_at: new Date().toISOString() }
            : r
        ),
      }));
    } else {
      const newRow = {
        category,
        subcategory,
        bucket: newBucket,
        uuid: uuidv4(),
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
        deleted: false,
      };
      const id = await db.bucket_map.add(newRow);
      set((state) => ({
        bucketMap: [...state.bucketMap, { ...newRow, id }],
      }));
    }
  },

  // ---- Add / remove categories and subcategories ----
  // Removing only hides an entry from the dropdowns for NEW transactions.
  // Old transactions keep their own category, subcategory and bucket as plain text,
  // so nothing about past data changes.
  addCategoryEntry: async (categoryInput, subcategoryInput, bucket) => {
    const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    let category = clean(categoryInput);
    const subcategory = clean(subcategoryInput);
    if (!category || !subcategory) {
      return { ok: false, message: 'Please enter both a category and a subcategory.' };
    }

    const allRows = await db.bucket_map.toArray();

    // If the category already exists in a different capitalisation, reuse that spelling.
    const sameCategory = allRows.find(
      r => r.category.toLowerCase() === category.toLowerCase()
    );
    if (sameCategory) category = sameCategory.category;

    const finalBucket = category === 'Income' ? 'Income' : (bucket || 'Discretionary');
    const now = new Date().toISOString();

    const match = allRows.find(
      r =>
        r.category === category &&
        r.subcategory.toLowerCase() === subcategory.toLowerCase()
    );

    if (match && match.deleted !== true) {
      return { ok: false, message: `"${match.subcategory}" already exists under ${category}.` };
    }

    if (match) {
      // It was removed earlier: bring the same row back instead of making a second one.
      await db.bucket_map.update(match.id, {
        subcategory,
        bucket: finalBucket,
        deleted: false,
        syncStatus: 'pending',
        updated_at: now,
      });
    } else {
      await db.bucket_map.add({
        category,
        subcategory,
        bucket: finalBucket,
        uuid: uuidv4(),
        syncStatus: 'pending',
        updated_at: now,
        deleted: false,
      });
    }

    const bucketMap = await db.bucket_map.filter(b => b.deleted !== true).toArray();
    set({ bucketMap });
    return { ok: true, message: `Added "${subcategory}" to ${category}.` };
  },

  removeCategoryEntry: async (category, subcategory) => {
    if (category === 'Income') {
      // Add Transaction needs at least one income subcategory to exist.
      const incomeLeft = get().bucketMap.filter(r => r.category === 'Income').length;
      if (incomeLeft <= 1) {
        return { ok: false, message: 'Keep at least one Income subcategory so you can still record income.' };
      }
    }
    if (isProtectedEntry(category, subcategory)) {
      return { ok: false, message: `"${subcategory}" is used by zakat/loan features and can't be removed.` };
    }
    const now = new Date().toISOString();
    const rows = await db.bucket_map
      .filter(r => r.category === category && r.subcategory === subcategory && r.deleted !== true)
      .toArray();
    for (const r of rows) {
      await db.bucket_map.update(r.id, { deleted: true, syncStatus: 'pending', updated_at: now });
    }
    const bucketMap = await db.bucket_map.filter(b => b.deleted !== true).toArray();
    set({ bucketMap });
    return { ok: true, message: `Removed "${subcategory}" from ${category}.` };
  },

  removeWholeCategory: async (category) => {
    if (isProtectedCategory(category)) {
      return { ok: false, message: `The "${category}" category is required by the app and can't be removed.` };
    }
    const rows = await db.bucket_map
      .filter(r => r.category === category && r.deleted !== true)
      .toArray();
    if (rows.some(r => isProtectedEntry(r.category, r.subcategory))) {
      return { ok: false, message: 'This category contains entries the app needs and can\'t be removed.' };
    }
    const now = new Date().toISOString();
    for (const r of rows) {
      await db.bucket_map.update(r.id, { deleted: true, syncStatus: 'pending', updated_at: now });
    }
    const bucketMap = await db.bucket_map.filter(b => b.deleted !== true).toArray();
    set({ bucketMap });
    return { ok: true, message: `Removed the "${category}" category (${rows.length} subcategories).` };
  },

  getSubcategoriesFor: (category) => {
    const { bucketMap } = get();
    return bucketMap
      .filter(r => r.category === category && r.deleted !== true)
      .map(r => r.subcategory);
  },

  getCategories: () => {
    const { bucketMap } = get();
    return [...new Set(bucketMap.filter(r => r.deleted !== true).map(r => r.category))];
  },

  // ============ LOANS ============
  addLoan: async (loanData) => {
    const uuid = uuidv4();
    const newLoan = {
      ...loanData,
      uuid,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
      deleted: false,
    };
    const id = await db.loans.add(newLoan);
    set((state) => ({
      loans: [...state.loans, { ...newLoan, id }],
    }));
    return uuid;
  },

  updateLoan: async (id, updates) => {
    const updateData = {
      ...updates,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
    };
    await db.loans.update(id, updateData);
    set((state) => ({
      loans: state.loans.map(l => (l.id === id ? { ...l, ...updateData } : l)),
    }));
  },

  deleteLoan: async (id) => {
    const target = get().loans.find(l => l.id === id);
    const targetUuid = target?.uuid;

    await db.loans.update(id, {
      deleted: true,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
    });

    const linked = get().transactions.filter(t => t.loan_uuid === targetUuid);
    for (const t of linked) {
      await db.transactions.update(t.id, {
        loan_uuid: null,
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
      });
    }

    set((state) => ({
      loans: state.loans.filter(l => l.id !== id),
      transactions: state.transactions.map(t =>
        t.loan_uuid === targetUuid ? { ...t, loan_uuid: null, syncStatus: 'pending' } : t
      ),
    }));
  },

  getLoanPaid: (loanIdentifier) => {
    const { transactions, loans } = get();
    const loan = loans.find(l => l.uuid === loanIdentifier || l.id === loanIdentifier);
    if (!loan) return 0;

    return transactions
      .filter(t =>
        t.loan_uuid === loan.uuid &&
        t.type === 'Expense' &&
        t.deleted !== true
      )
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);
  },

  getTotalDebtPayable: () => {
    const { loans } = get();
    let total = 0;
    for (const loan of loans) {
      if (loan.deleted === true) continue;
      const paid = get().getLoanPaid(loan.uuid);
      total += Math.max(0, (loan.total_amount || 0) - paid);
    }
    return total;
  },

  // ============ TRANSACTIONS ============
  addTransaction: async (transactionData) => {
    const { settings } = get();
    const currentRate = settings.current_usd_rate || 15.42;

    let amount_mvr = transactionData.amount_original;
    if (transactionData.currency === 'USD') {
      amount_mvr = transactionData.amount_original * currentRate;
    }

    const newTransaction = {
      ...transactionData,
      amount_mvr,
      exchange_rate_at_time: currentRate,
      is_historical: false,
      date: transactionData.date || new Date().toISOString(),
      uuid: uuidv4(),
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
      deleted: false,
    };

    const id = await db.transactions.add(newTransaction);

    set((state) => ({
      transactions: [...state.transactions, { ...newTransaction, id }],
    }));
  },

  updateTransaction: async (id, updates) => {
    const { settings } = get();
    const existing = get().transactions.find(t => t.id === id);
    if (!existing) return;

    const currentRate =
      updates.exchange_rate_at_time ||
      existing.exchange_rate_at_time ||
      settings.current_usd_rate ||
      15.42;

    let amount_mvr =
      updates.amount_original !== undefined
        ? updates.amount_original
        : existing.amount_original;
    if ((updates.currency || existing.currency) === 'USD') {
      amount_mvr = amount_mvr * currentRate;
    }

    const updated = {
      ...existing,
      ...updates,
      amount_mvr,
      exchange_rate_at_time: currentRate,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
    };

    await db.transactions.put(updated);

    set((state) => ({
      transactions: state.transactions.map(t => (t.id === id ? updated : t)),
    }));
  },

  deleteTransaction: async (id) => {
    await db.transactions.update(id, {
      deleted: true,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
    });
    set((state) => ({
      transactions: state.transactions.filter(t => t.id !== id),
    }));
  },

  // ============ CALCULATIONS ============
  getBucketBalances: (monthString) => {
    const { transactions, settings } = get();
    const monthTransactions = transactions.filter(
      t => t.date.startsWith(monthString) && !t.is_historical && t.deleted !== true
    );

    const totalIncome = monthTransactions
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);

    const ePct = Number(settings.essential_pct) || 40;
    const dPct = Number(settings.discretionary_pct) || 10;
    const fPct = Number(settings.financial_pct) || 15;
    const sPct = Number(settings.savings_pct) || 35;

    const essentialAllocated = totalIncome * (ePct / 100);
    const discretionaryAllocated = totalIncome * (dPct / 100);
    const financialAllocated = totalIncome * (fPct / 100);
    const savingsAllocated = totalIncome * (sPct / 100);

    const essentialSpent = monthTransactions
      .filter(t => t.type === 'Expense' && t.bucket === 'Essential')
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);
    const discretionarySpent = monthTransactions
      .filter(t => t.type === 'Expense' && t.bucket === 'Discretionary')
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);
    const financialSpent = monthTransactions
      .filter(t => t.type === 'Expense' && t.bucket === 'Financial/Obligatory')
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);

    return {
      Essential: { allocated: essentialAllocated, spent: essentialSpent, remaining: essentialAllocated - essentialSpent },
      Discretionary: { allocated: discretionaryAllocated, spent: discretionarySpent, remaining: discretionaryAllocated - discretionarySpent },
      Financial: { allocated: financialAllocated, spent: financialSpent, remaining: financialAllocated - financialSpent },
      Savings: { allocated: savingsAllocated, spent: 0, remaining: savingsAllocated },
    };
  },

  getCategoryTotals: (monthString, includeHistorical = false) => {
    const { transactions } = get();
    const monthExpenses = transactions.filter(
      t =>
        t.date.startsWith(monthString) &&
        t.type === 'Expense' &&
        t.deleted !== true &&
        (includeHistorical || !t.is_historical) &&
        Number.isFinite(t.amount_mvr)
    );

    const byCategory = {};

    monthExpenses.forEach(t => {
      const cat = t.category || '(Uncategorized)';
      const sub = t.subcategory || '(No subcategory)';

      if (!byCategory[cat]) {
        byCategory[cat] = { category: cat, amount: 0, subcategories: {} };
      }
      if (!byCategory[cat].subcategories[sub]) {
        byCategory[cat].subcategories[sub] = { subcategory: sub, amount: 0, count: 0 };
      }

      byCategory[cat].amount += t.amount_mvr;
      byCategory[cat].subcategories[sub].amount += t.amount_mvr;
      byCategory[cat].subcategories[sub].count += 1;
    });

    const totals = Object.values(byCategory)
      .map(c => ({
        category: c.category,
        amount: c.amount,
        subcategories: Object.values(c.subcategories).sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    const grandTotal = totals.reduce((sum, item) => sum + item.amount, 0);

    return { totals, grandTotal };
  },

  getMonthTransactions: (monthString, includeHistorical = false) => {
    const { transactions } = get();
    return transactions
      .filter(
        t =>
          t.date.startsWith(monthString) &&
          t.deleted !== true &&
          (includeHistorical || !t.is_historical)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // ============ ZAKAT LOGIC ============
  calculateZakat: (monthString) => {
    const { transactions, settings } = get();
    const [yearStr, monthKey] = monthString.split('-');
    const year = Number(yearStr);

    const zakatPaidThisMonth = transactions
      .filter(
        t =>
          t.type === 'Expense' &&
          t.category === 'Personal' &&
          t.subcategory === 'Zakat' &&
          t.date.startsWith(monthString) &&
          !t.is_historical &&
          t.deleted !== true
      )
      .reduce((sum, t) => sum + (t.amount_mvr || 0), 0);

    // Turns a stored value into a number, or null if nothing valid was entered.
    const readBalance = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    };

    // Bank balance for THIS month, typed in by hand (like cell B15 in the Excel sheet).
    const monthBalances = settings.month_balances || {};
    const enteredBalance = readBalance(monthBalances[monthString]);
    const noBalance = enteredBalance === null;
    const bankBalance = noBalance ? 0 : enteredBalance;

    const debtPayable = get().getTotalDebtPayable();
    const debtReceivable = parseFloat(settings.debt_receivable) || 0;
    const nisab = parseFloat(settings.nisab_threshold) || 10000;

    // Same month last year: prefer a balance entered for that exact year,
    // otherwise use the saved "previous year" grid (only valid for its own year).
    const prevYearBalances = settings.prev_year_balances || {};
    const lastYearEntered = readBalance(monthBalances[`${year - 1}-${monthKey}`]);
    const lastYearSaved =
      year - 1 === PREV_BALANCES_YEAR ? readBalance(prevYearBalances[monthKey]) : null;
    const lastYearBalance = lastYearEntered ?? lastYearSaved ?? 0;

    // Matches the Excel rule: eligible if balance > last year's, or balance > nisab.
    const eligible = !noBalance && (bankBalance > lastYearBalance || bankBalance > nisab);

    const zakatableAmount = bankBalance - debtPayable + debtReceivable;
    const baseZakat = eligible && zakatableAmount > 0 ? zakatableAmount * 0.025 : 0;

    const zakatDue = Math.max(0, baseZakat - zakatPaidThisMonth);
    const fullyPaid = baseZakat > 0 && zakatDue === 0;

    return {
      bankBalance,
      bankBalanceBeforeZakat: bankBalance,
      noBalance,
      debtPayable,
      debtReceivable,
      nisab,
      lastYearBalance,
      zakatableAmount,
      baseZakat,
      zakatPaidThisMonth,
      zakatDue,
      eligible,
      fullyPaid,
    };
  },

  // ============ RANGE + YEARLY ============
  getTransactionsInRange: (fromISO, toISO, opts = {}) => {
    const { includeHistorical = true, type = 'All', category = null } = opts;
    const { transactions } = get();

    let from = null;
    if (fromISO) {
      const d = new Date(fromISO);
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    }

    let to = null;
    if (toISO) {
      const d = new Date(toISO);
      d.setHours(23, 59, 59, 999);
      to = d.getTime();
    }

    return transactions
      .filter(t => {
        if (t.deleted === true) return false;
        if (!includeHistorical && t.is_historical) return false;
        if (type !== 'All' && t.type !== type) return false;
        if (category && t.category !== category) return false;

        const d = new Date(t.date).getTime();
        if (from !== null && d < from) return false;
        if (to !== null && d > to) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  aggregateRange: (rows) => {
    const buildGroup = (typeFilter) => {
      const map = {};

      rows.forEach(t => {
        if (t.type !== typeFilter) return;
        if (!Number.isFinite(t.amount_mvr)) return;

        const cat = t.category || '(Uncategorized)';
        const sub = t.subcategory || '(No subcategory)';

        if (!map[cat]) map[cat] = { category: cat, total: 0, subcategories: {} };
        if (!map[cat].subcategories[sub]) {
          map[cat].subcategories[sub] = { subcategory: sub, total: 0, count: 0 };
        }

        map[cat].total += t.amount_mvr;
        map[cat].subcategories[sub].total += t.amount_mvr;
        map[cat].subcategories[sub].count += 1;
      });

      const categories = Object.values(map)
        .map(c => ({
          category: c.category,
          total: c.total,
          subcategories: Object.values(c.subcategories).sort((a, b) => b.total - a.total),
        }))
        .sort((a, b) => b.total - a.total);

      const grandTotal = categories.reduce((sum, c) => sum + c.total, 0);
      return { categories, grandTotal };
    };

    return {
      expenses: buildGroup('Expense'),
      incomes: buildGroup('Income'),
    };
  },

  getYearlySummary: (type = 'Expense') => {
    const { transactions } = get();

    const txFiltered = transactions.filter(
      t => t.type === type && t.deleted !== true && Number.isFinite(t.amount_mvr)
    );

    const yearSet = new Set();
    txFiltered.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    });
    const years = Array.from(yearSet).sort((a, b) => a - b);

    const catMap = {};
    txFiltered.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (isNaN(y)) return;

      const cat = t.category || '(Uncategorized)';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, byYear: {} };
        years.forEach(yy => {
          catMap[cat].byYear[yy] = 0;
        });
      }
      catMap[cat].byYear[y] = (catMap[cat].byYear[y] || 0) + t.amount_mvr;
    });

    const rows = Object.values(catMap)
      .map(r => {
        const total = years.reduce((sum, y) => sum + (r.byYear[y] || 0), 0);
        const activeYears = years.filter(y => (r.byYear[y] || 0) > 0);
        const avg = activeYears.length > 0 ? total / activeYears.length : 0;
        return { ...r, total, avg };
      })
      .sort((a, b) => b.total - a.total);

    const grandTotalByYear = {};
    years.forEach(y => {
      grandTotalByYear[y] = rows.reduce((sum, r) => sum + (r.byYear[y] || 0), 0);
    });

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

    return { years, rows, grandTotalByYear, grandTotal };
  },

  getSubcategoryYearlySummary: (targetCategory, years, type = 'Expense') => {
    const { transactions } = get();

    const catTx = transactions.filter(
      t =>
        t.type === type &&
        t.category === targetCategory &&
        t.deleted !== true &&
        Number.isFinite(t.amount_mvr)
    );

    const subMap = {};
    catTx.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (isNaN(y)) return;

      const sub = t.subcategory || '(No subcategory)';
      if (!subMap[sub]) {
        subMap[sub] = { subcategory: sub, byYear: {} };
        years.forEach(yy => {
          subMap[sub].byYear[yy] = 0;
        });
      }
      subMap[sub].byYear[y] = (subMap[sub].byYear[y] || 0) + t.amount_mvr;
    });

    return Object.values(subMap)
      .map(r => {
        const total = years.reduce((sum, y) => sum + (r.byYear[y] || 0), 0);
        const activeYears = years.filter(y => (r.byYear[y] || 0) > 0);
        const avg = activeYears.length > 0 ? total / activeYears.length : 0;
        return { ...r, total, avg };
      })
      .sort((a, b) => b.total - a.total);
  },
}));
