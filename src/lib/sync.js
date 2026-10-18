import { supabase } from './supabaseClient';
import { db } from '../db/database';

const LAST_SYNC_KEY = 'finance_erp_last_sync';

export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY);
export const setLastSync = (isoString) => localStorage.setItem(LAST_SYNC_KEY, isoString);

// Push pending local changes to Supabase
export async function pushChanges() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const tables = ['transactions', 'settings', 'loans', 'bucket_map'];
  const now = new Date().toISOString();

  for (const table of tables) {
    const pending = await db.table(table).where('syncStatus').equals('pending').toArray();
    if (pending.length === 0) continue;

    const toPush = pending.map(row => {
      // eslint-disable-next-line no-unused-vars
      const { id, syncStatus, ...rest } = row;
      return {
        ...rest,
        user_id: session.user.id,
        updated_at: now
      };
    });

    try {
      let error;
      if (table === 'settings') {
        const { error: err } = await supabase.from(table).upsert(toPush, { onConflict: 'user_id,key' });
        error = err;
      } else {
        const { error: err } = await supabase.from(table).insert(toPush);
        error = err;
      }

      if (error) throw error;

      if (table === 'settings') {
        const syncedKeys = pending.map(p => p.key);
        await db.settings.where('key').anyOf(syncedKeys).modify({ syncStatus: 'synced' });
      } else {
        const syncedIds = pending.map(p => p.id);
        await db.table(table).where('id').anyOf(syncedIds).modify({ syncStatus: 'synced' });
      }
    } catch (err) {
      console.error(`Error pushing ${table}:`, err.message);
    }
  }
}

// Pull remote changes to local
export async function pullChanges(isFirstSync = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync() || '1970-01-01T00:00:00.000Z';
  const now = new Date().toISOString();
  const tables = ['transactions', 'settings', 'loans', 'bucket_map'];

  for (const table of tables) {
    try {
      // If it's the first sync, we don't filter by date, we grab everything
      let query = supabase.from(table).select('*').eq('user_id', session.user.id);
      if (!isFirstSync) {
        query = query.gt('updated_at', lastSync);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const toPut = data.map(row => {
          // eslint-disable-next-line no-unused-vars
          const { user_id, ...rest } = row;
          return {
            ...rest,
            syncStatus: 'synced'
          };
        });

        if (table === 'settings') {
          await db.settings.bulkPut(toPut);
        } else {
          if (isFirstSync) {
            // On initial pull, WIPE the local table to avoid ID collisions
            await db.table(table).clear();
            await db.table(table).bulkAdd(toPut);
          } else {
            await db.table(table).bulkPut(toPut);
          }
        }
      }
    } catch (err) {
      console.error(`Error pulling ${table}:`, err.message);
    }
  }

  setLastSync(now);
}

// Full sync (push then pull)
export async function syncAll() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync();
  const isFirstSync = !lastSync;

  if (isFirstSync) {
    // Check if cloud has data
    const { count, error } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
    
    if (!error && count === 0) {
      // Cloud is empty. We are on the laptop. Push local data up!
      console.log("Cloud is empty. Pushing local data to Supabase...");
      await db.transactions.toCollection().modify({ syncStatus: 'pending' });
      await db.settings.toCollection().modify({ syncStatus: 'pending' });
      await db.loans.toCollection().modify({ syncStatus: 'pending' });
      await db.bucket_map.toCollection().modify({ syncStatus: 'pending' });
      
      await pushChanges();
      setLastSync(new Date().toISOString());
      return;
    } else {
      // Cloud has data. Wipe local and pull it down.
      console.log("Cloud has data. Pulling to local...");
      await pullChanges(true);
      return;
    }
  }

  // Normal sync
  await pushChanges();
  await pullChanges(false);
}
