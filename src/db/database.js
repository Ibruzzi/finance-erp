import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export const db = new Dexie('FinanceAppDB');

// Define database schema version and indexes
db.version(1).stores({
  settings: '++id, &uuid, key, syncStatus, updated_at, deleted',
  bucket_map: '++id, &uuid, bucket, category, syncStatus, updated_at, deleted',
  transactions: '++id, &uuid, date, category, amount, syncStatus, updated_at, deleted',
  loans: '++id, &uuid, name, amount, syncStatus, updated_at, deleted'
});

// Default fallback data for initial setup
const DEFAULT_BUCKET_MAP = [
  { bucket: 'Essential', category: 'Groceries' },
  { bucket: 'Essential', category: 'Utilities' },
  { bucket: 'Discretionary', category: 'Entertainment' },
  { bucket: 'Financial', category: 'Investments' },
  { bucket: 'Savings', category: 'Emergency Fund' }
];

const SEED_DATA = [
  { date: '2026-01-01', category: 'Groceries', amount: 150, description: 'Initial Grocery Stock' }
];

/**
 * Initializes default settings, bucket mappings, and seed data securely.
 * Uses bulkPut to ensure idempotent writes and prevent primary key / unique constraint duplication.
 */
export const initSettings = async () => {
  try {
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      const defaults = [
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
      ];
      
      const payload = defaults.map(d => ({
        ...d,
        uuid: uuidv4(),
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
        deleted: false
      }));
      
      await db.settings.bulkPut(payload);
    }

    const mapCount = await db.bucket_map.count();
    if (mapCount === 0) {
      const payload = DEFAULT_BUCKET_MAP.map(b => ({
        ...b,
        uuid: uuidv4(),
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
        deleted: false
      }));
      
      await db.bucket_map.bulkPut(payload);
    }

    const txCount = await db.transactions.count();
    if (txCount === 0 && SEED_DATA.length > 0) {
      const payload = SEED_DATA.map(t => ({
        ...t,
        uuid: uuidv4(),
        syncStatus: 'pending',
        updated_at: new Date().toISOString(),
        deleted: false
      }));
      
      await db.transactions.bulkPut(payload);
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};

/**
 * Utility helper to run a one-time deduplication across tables if duplicates exist.
 */
export async function pruneDuplicates(tableName) {
  const table = db[tableName];
  if (!table) return;
  
  const allRows = await table.toArray();
  const seenUuids = new Set();
  const duplicateIds = [];

  for (const row of allRows) {
    if (row.uuid) {
      if (seenUuids.has(row.uuid)) {
        duplicateIds.push(row.id);
      } else {
        seenUuids.add(row.uuid);
      }
    }
  }

  if (duplicateIds.length > 0) {
    console.warn(`Found ${duplicateIds.length} duplicates in ${tableName}. Pruning...`);
    await table.bulkDelete(duplicateIds);
  }
}
