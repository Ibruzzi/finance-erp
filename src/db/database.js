import Dexie from 'dexie';

export const db = new Dexie('FinanceERP');

// ============================================================
// SCHEMA
// NOTE: The local browser DB was already at version 20 from an
// earlier session. Dexie can upgrade but never downgrade, so we
// declare 20 as the current version here. Do NOT change this
// number unless you genuinely need to add/remove a table.
// ============================================================
db.version(200).stores({
  transactions: '++id, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes',
  settings: 'key',
  loans: '++id, name, total_amount, start_date, notes',
  loan_payments: '++id, loan_id, date, amount, transaction_id',
  zakat_log: '++id, month, total_savings, zakat_due, zakat_paid',
  exchange_rates: '++id, date_set, rate',
  bucket_map: '++id, category, subcategory, bucket'
});

// ============================================================
// DEFAULT BUCKET MAP
// ============================================================
const DEFAULT_BUCKET_MAP = [
  // ---- Personal ----
  { category: 'Personal', subcategory: 'Book', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Wardrobe', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Cosmetics', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Donation', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Electronics', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Games', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Online Shopping', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Other', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'PC/Accessory', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Phone/Accessory', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Restaurant', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Shipping Fee', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Snacks', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Software', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Staff Shop', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Subscription', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Bills', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Medical', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Room rent', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Tickets', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Transportation', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Grocery', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Debt', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Pension', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Zakat', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Loan Repayment', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Hotel Bookings', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Room Cleaning', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Samu', bucket: 'Essential' },
  
  // ---- Boalhadhage ----
  { category: 'Boalhadhage', subcategory: 'Appliances', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Cements/Building', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Furniture', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'General', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Tiles', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'TV', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Toys', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Wardrobe Adt.', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Wardrobe Kids', bucket: 'Discretionary' },
  { category: 'Boalhadhage', subcategory: 'Ceiling / Roofing', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Doors', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Wiring', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Phone/Internet', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Water', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Electricity', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Food', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Cleaning Goods', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'School Supplies', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Baby care', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Waste mngmnt.', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Medical', bucket: 'Essential' },
  { category: 'Boalhadhage', subcategory: 'Maintenance', bucket: 'Essential' },
  
  // ---- Family ----
  { category: 'Family', subcategory: 'Aisu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Ahamadhu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Ali', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Bro', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Faattthu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Gifts', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Toys', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Tickets', bucket: 'Essential' },
  { category: 'Family', subcategory: 'Rent', bucket: 'Essential' },
  { category: 'Family', subcategory: 'Combined', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Mamma', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Bappa', bucket: 'Essential' },
  { category: 'Family', subcategory: 'Dhattha', bucket: 'Discretionary' },
  
  // ---- Income ----
  { category: 'Income', subcategory: 'Salary/Wages', bucket: 'Income' },
  { category: 'Income', subcategory: 'Service charge', bucket: 'Income' },
  { category: 'Income', subcategory: 'Refunds/Reimbursements', bucket: 'Income' },
  { category: 'Income', subcategory: 'Bonus', bucket: 'Income' },
  { category: 'Income', subcategory: 'Misc.', bucket: 'Income' },
  { category: 'Income', subcategory: 'Savings Fund', bucket: 'Income' },
];

// ============================================================
// SEED DEFAULT SETTINGS + BUCKET MAP
// ============================================================
export const initSettings = async () => {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.bulkPut([
      { key: 'essential_pct', value: 40 },
      { key: 'discretionary_pct', value: 10 },
      { key: 'financial_pct', value: 15 },
      { key: 'savings_pct', value: 35 },
      { key: 'nisab_threshold', value: 10000 },
      { key: 'zakat_rate', value: 2.5 },
      { key: 'current_usd_rate', value: 15.42 },
      { key: 'debt_receivable', value: 0 },
      { key: 'bank_balance_override', value: '' },
      { key: 'prev_year_balances', value: {} }
    ]);
  } else {
    const existing = await db.settings.toArray();
    const existingKeys = existing.map(s => s.key);
    const defaults = [
      { key: 'debt_receivable', value: 0 },
      { key: 'bank_balance_override', value: '' },
      { key: 'prev_year_balances', value: {} }
    ];
    for (const d of defaults) {
      if (!existingKeys.includes(d.key)) {
        await db.settings.put(d);
      }
    }
  }

  const mapCount = await db.bucket_map.count();
  if (mapCount === 0) {
    await db.bucket_map.bulkAdd(DEFAULT_BUCKET_MAP);
  }
};
