import Dexie from 'dexie';
import { SEED_DATA } from './seedData';

export const db = new Dexie('FinanceERP');

db.version(200).stores({
  transactions: '++id, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes',
  settings: 'key',
  loans: '++id, name, total_amount, start_date, notes',
  loan_payments: '++id, loan_id, date, amount, transaction_id',
  zakat_log: '++id, month, total_savings, zakat_due, zakat_paid',
  exchange_rates: '++id, date_set, rate',
  bucket_map: '++id, category, subcategory, bucket'
});

// Bump version to add sync fields
db.version(201).stores({
  transactions: '++id, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes, syncStatus, updated_at, deleted',
  settings: 'key, syncStatus, updated_at, deleted',
  loans: '++id, name, total_amount, start_date, notes, syncStatus, updated_at, deleted',
  loan_payments: '++id, loan_id, date, amount, transaction_id',
  zakat_log: '++id, month, total_savings, zakat_due, zakat_paid',
  exchange_rates: '++id, date_set, rate',
  bucket_map: '++id, category, subcategory, bucket, syncStatus, updated_at, deleted'
}).upgrade(tx => {
  // Upgrade existing data to be marked as 'pending' so it gets pushed on first sync
  return Promise.all([
    tx.table('transactions').toCollection().modify(item => {
      item.syncStatus = item.syncStatus || 'pending';
      item.updated_at = item.updated_at || new Date().toISOString();
      item.deleted = item.deleted || false;
    }),
    tx.table('loans').toCollection().modify(item => {
      item.syncStatus = item.syncStatus || 'pending';
      item.updated_at = item.updated_at || new Date().toISOString();
      item.deleted = item.deleted || false;
    }),
    tx.table('bucket_map').toCollection().modify(item => {
      item.syncStatus = item.syncStatus || 'pending';
      item.updated_at = item.updated_at || new Date().toISOString();
      item.deleted = item.deleted || false;
    }),
    tx.table('settings').toCollection().modify(item => {
      item.syncStatus = item.syncStatus || 'pending';
      item.updated_at = item.updated_at || new Date().toISOString();
      item.deleted = item.deleted || false;
    })
  ]);
});

const DEFAULT_BUCKET_MAP = [
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
  { category: 'Boalhadhadige', subcategory: 'Appliances', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Cements/Building', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Furniture', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'General', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Tiles', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'TV', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Toys', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Wardrobe Adt.', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Wardrobe Kids', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Ceiling / Roofing', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Doors', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Wiring', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Phone/Internet', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Water', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Electricity', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Food', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Cleaning Goods', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'School Supplies', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Baby care', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Waste mngmnt.', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Medical', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Maintenance', bucket: 'Essential' },
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
  { category: 'Income', subcategory: 'Salary/Wages', bucket: 'Income' },
  { category: 'Income', subcategory: 'Service charge', bucket: 'Income' },
  { category: 'Income', subcategory: 'Refunds/Reimbursements', bucket: 'Income' },
  { category: 'Income', subcategory: 'Bonus', bucket: 'Income' },
  { category: 'Income', subcategory: 'Misc.', bucket: 'Income' },
  { category: 'Income', subcategory: 'Savings Fund', bucket: 'Income' },
];

export const initSettings = async () => {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.bulkPut([
      { key: 'essential_pct', value: 40, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'discretionary_pct', value: 10, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'financial_pct', value: 15, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'savings_pct', value: 35, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'nisab_threshold', value: 10000, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'zakat_rate', value: 2.5, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'current_usd_rate', value: 15.42, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'debt_receivable', value: 0, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'bank_balance_override', value: '', syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false },
      { key: 'prev_year_balances', value: {}, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false }
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
        await db.settings.put({ ...d, syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false });
      }
    }
  }

  const mapCount = await db.bucket_map.count();
  if (mapCount === 0) {
    const mapped = DEFAULT_BUCKET_MAP.map(b => ({
      ...b,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
      deleted: false
    }));
    await db.bucket_map.bulkAdd(mapped);
  }

  const txCount = await db.transactions.count();
  if (txCount === 0 && SEED_DATA.length > 0) {
    console.log(`Empty database detected. Seeding ${SEED_DATA.length} historical rows...`);
    const seeded = SEED_DATA.map(t => ({
      ...t,
      syncStatus: 'pending',
      updated_at: new Date().toISOString(),
      deleted: false
    }));
    await db.transactions.bulkAdd(seeded);
  }
};
