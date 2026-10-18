import Dexie from 'dexie';
import { SEED_DATA } from './seedData';
import { v4 as uuidv4 } from 'uuid'; // We need this package

export const db = new Dexie('FinanceERP');

// Note: We are bumping to version 202 to add the 'uuid' index
db.version(202).stores({
  transactions: '++id, uuid, date, category, subcategory, amount_original, currency, exchange_rate_at_time, amount_mvr, type, is_historical, notes, syncStatus, updated_at, deleted',
  settings: 'key, uuid, syncStatus, updated_at, deleted',
  loans: '++id, uuid, name, total_amount, start_date, notes, syncStatus, updated_at, deleted',
  loan_payments: '++id, loan_id, date, amount, transaction_id',
  zakat_log: '++id, month, total_savings, zakat_due, zakat_paid',
  exchange_rates: '++id, date_set, rate',
  bucket_map: '++id, uuid, category, subcategory, bucket, syncStatus, updated_at, deleted'
}).upgrade(async tx => {
  // Add UUIDs to all existing local rows
  const addUuids = async (tableName) => {
    await tx.table(tableName).toCollection().modify(item => {
      if (!item.uuid) item.uuid = uuidv4();
      item.syncStatus = 'pending'; // Force a re-sync with the new UUIDs
    });
  };
  await addUuids('transactions');
  await addUuids('loans');
  await addUuids('bucket_map');
  
  // For settings, we generate UUIDs too
  await tx.table('settings').toCollection().modify(item => {
    if (!item.uuid) item.uuid = uuidv4();
    item.syncStatus = 'pending';
  });
});

const DEFAULT_BUCKET_MAP = [
  // ... KEEP YOUR EXISTING DEFAULT_BUCKET_MAP HERE ...
];

export const initSettings = async () => {
  const count = await db.settings.count();
  if (count === 0) {
    const defaults = [
      { key: 'essential_pct', value: 40 }, { key: 'discretionary_pct', value: 10 },
      { key: 'financial_pct', value: 15 }, { key: 'savings_pct', value: 35 },
      { key: 'nisab_threshold', value: 10000 }, { key: 'zakat_rate', value: 2.5 },
      { key: 'current_usd_rate', value: 15.42 }, { key: 'debt_receivable', value: 0 },
      { key: 'bank_balance_override', value: '' }, { key: 'prev_year_balances', value: {} }
    ];
    await db.settings.bulkPut(defaults.map(d => ({ 
      ...d, uuid: uuidv4(), syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false 
    })));
  }

  const mapCount = await db.bucket_map.count();
  if (mapCount === 0) {
    await db.bucket_map.bulkAdd(DEFAULT_BUCKET_MAP.map(b => ({ 
      ...b, uuid: uuidv4(), syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false 
    })));
  }

  const txCount = await db.transactions.count();
  if (txCount === 0 && SEED_DATA.length > 0) {
    await db.transactions.bulkAdd(SEED_DATA.map(t => ({ 
      ...t, uuid: uuidv4(), syncStatus: 'pending', updated_at: new Date().toISOString(), deleted: false 
    })));
  }
};
