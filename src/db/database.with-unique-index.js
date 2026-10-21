import Dexie from 'dexie';
import { SEED_DATA } from './seedData';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

export const db = new Dexie('FinanceERP');

db.version(202).stores({
  transactions: '++id, uuid, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes, syncStatus, updated_at, deleted',
  settings: 'key, uuid, syncStatus, updated_at, deleted',
  loans: '++id, uuid, name, total_amount, start_date, notes, syncStatus, updated_at, deleted',
  loan_payments: '++id, loan_id, date, amount, transaction_id',
  zakat_log: '++id, month, total_savings, zakat_due, zakat_paid',
  exchange_rates: '++id, date_set, rate',
  bucket_map: '++id, uuid, category, subcategory, bucket, syncStatus, updated_at, deleted'
}).upgrade(async tx => {
  const addUuids = async (tableName) => {
    await tx.table(tableName).toCollection().modify(item => {
      if (!item.uuid) item.uuid = uuidv4();
      item.syncStatus = 'pending';
    });
  };
  await addUuids('transactions');
  await addUuids('loans');
  await addUuids('bucket_map');
  
  await tx.table('settings').toCollection().modify(item => {
    if (!item.uuid) item.uuid = uuidv4();
    item.syncStatus = 'pending';
  });
});

// ---------------------------------------------------------------------------
// OPTIONAL HARDENING (versions 203 + 204): make duplicate uuids impossible.
//
// Version 203 first removes any rows that share a uuid (keeping the newest).
// Version 204 then adds the "unique" rule. They are two separate steps on purpose:
// the browser refuses to add a unique rule while duplicates still exist, so the
// clean-up has to happen first.
// ---------------------------------------------------------------------------
db.version(203).stores({}).upgrade(async tx => {
  for (const tableName of ['transactions', 'loans', 'bucket_map']) {
    const rows = await tx.table(tableName).toArray();
    const keep = new Map();
    const remove = [];

    for (const row of rows) {
      if (!row.uuid) continue; // rows without a uuid are ignored by a unique index
      const prev = keep.get(row.uuid);
      if (!prev) {
        keep.set(row.uuid, row);
        continue;
      }
      const prevTime = new Date(prev.updated_at || 0).getTime();
      const thisTime = new Date(row.updated_at || 0).getTime();
      if (thisTime > prevTime) {
        remove.push(prev.id);
        keep.set(row.uuid, row);
      } else {
        remove.push(row.id);
      }
    }

    if (remove.length > 0) {
      await tx.table(tableName).bulkDelete(remove);
    }
  }
});

db.version(204).stores({
  transactions: '++id, &uuid, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes, syncStatus, updated_at, deleted',
  loans: '++id, &uuid, name, total_amount, start_date, notes, syncStatus, updated_at, deleted',
  bucket_map: '++id, &uuid, category, subcategory, bucket, syncStatus, updated_at, deleted'
});

const DEFAULT_BUCKET_MAP = [
  // Personal
  { category: 'Personal', subcategory: 'Bills', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Medical', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Tickets', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Transportation', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Grocery', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Samu', bucket: 'Essential' },
  { category: 'Personal', subcategory: 'Book', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Wardrobe', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Clothing', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Cosmetics', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Donation', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Electronics', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Games', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Online Shopping', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Other', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'PC / Accessory', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Phone / Accessory', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Restaurant', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Room Rent', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Snacks', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Software', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Staff Shop', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Subscription', bucket: 'Discretionary' },
  { category: 'Personal', subcategory: 'Debt', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Pension', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Zakat', bucket: 'Financial/Obligatory' },
  { category: 'Personal', subcategory: 'Loan Repayment', bucket: 'Financial/Obligatory' },
  // Family
  { category: 'Family', subcategory: 'Mamma', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Bappa', bucket: 'Essential' },
  { category: 'Family', subcategory: 'Dhattha', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Aisu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Ahammadhu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Ali', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Bro', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Faatthu', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Combined', bucket: 'Discretionary' },
  { category: 'Family', subcategory: 'Rent', bucket: 'Essential' },
  { category: 'Family', subcategory: 'Tickets', bucket: 'Essential' },
  // Boalhadhadige
  { category: 'Boalhadhadige', subcategory: 'General', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Water', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Electricity', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Food', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Bills', bucket: 'Essential' },
  { category: 'Boalhadhadige', subcategory: 'Furniture', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Wiring', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Doors', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Tiles', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Cements/Building', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Appliances', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Maintenance', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Phone/Internet', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Waste mngmnt.', bucket: 'Discretionary' },
  { category: 'Boalhadhadige', subcategory: 'Cleaning Goods', bucket: 'Discretionary' },
  // Income
  { category: 'Income', subcategory: 'Salary/Wages', bucket: 'Income' },
  { category: 'Income', subcategory: 'Service charge', bucket: 'Income' },
  { category: 'Income', subcategory: 'Bonus', bucket: 'Income' },
  { category: 'Income', subcategory: 'Misc.', bucket: 'Income' },
  { category: 'Income', subcategory: 'Ramadan Bonus', bucket: 'Income' },
  { category: 'Income', subcategory: 'Yearly Bonus', bucket: 'Income' }
];

// A fixed "namespace" so the same input always produces the same UUID.
// This is what lets two devices seed the SAME rows with the SAME ids,
// so the cloud sees them as one row instead of two.
const SEED_NAMESPACE = '6f1c2b4e-8a3d-4c5e-9b7a-1d2e3f4a5b6c';

export const stableUuid = (label) => uuidv5(label, SEED_NAMESPACE);

let initPromise = null;

export const initSettings = () => {
  // If this is called twice at the same moment, both callers share one run.
  if (!initPromise) {
    initPromise = runInit().finally(() => { initPromise = null; });
  }
  return initPromise;
};

async function runInit() {
  const nowISO = new Date().toISOString();

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    const defaults = [
      { key: 'essential_pct', value: 40 }, { key: 'discretionary_pct', value: 10 },
      { key: 'financial_pct', value: 15 }, { key: 'savings_pct', value: 35 },
      { key: 'nisab_threshold', value: 10000 }, { key: 'zakat_rate', value: 2.5 },
      { key: 'current_usd_rate', value: 15.42 }, { key: 'debt_receivable', value: 0 },
      { key: 'bank_balance_override', value: '' }, { key: 'prev_year_balances', value: {} }
    ];
    await db.settings.bulkPut(defaults.map(d => ({
      ...d,
      uuid: stableUuid('setting|' + d.key),
      syncStatus: 'pending',
      updated_at: nowISO,
      deleted: false
    })));
  }

  const mapCount = await db.bucket_map.count();
  if (mapCount === 0) {
    await db.bucket_map.bulkAdd(DEFAULT_BUCKET_MAP.map(b => ({
      ...b,
      uuid: stableUuid('bucket|' + b.category + '|' + b.subcategory),
      syncStatus: 'pending',
      updated_at: nowISO,
      deleted: false
    })));
  }

  // Seed the historical rows only if this device has none at all.
  // (Old code checked "is the transactions table empty?", which is wrong now
  // that live transactions can arrive from the cloud before seeding runs.)
  const historicalCount = await db.transactions
    .filter(t => t.is_historical === true)
    .count();

  if (historicalCount === 0 && SEED_DATA.length > 0) {
    await db.transactions.bulkAdd(SEED_DATA.map((t, index) => ({
      ...t,
      uuid: stableUuid('seed-tx|' + index),
      syncStatus: 'pending',
      updated_at: nowISO,
      deleted: false
    })));
  }
}
