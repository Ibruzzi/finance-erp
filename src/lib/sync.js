import { supabase } from './supabaseClient';
import { db } from '../db/database';

const LAST_SYNC_KEY = 'finance_erp_last_sync';
export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY);
export const setLastSync = (isoString) => localStorage.setItem(LAST_SYNC_KEY, isoString);

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
      const { id, syncStatus, uuid, ...rest } = row;
      return {
        id: uuid, 
        ...rest,
        user_id: session.user.id,
        updated_at: now
      };
    });

    try {
      if (table === 'settings') {
        const { error } = await supabase.from(table).upsert(toPush, { onConflict: 'user_id,key' });
        if (error) throw error;
        const syncedKeys = pending.map(p => p.key);
        await db.settings.where('key').anyOf(syncedKeys).modify({ syncStatus: 'synced' });
      } else {
        const { error } = await supabase.from(table).upsert(toPush);
        if (error) throw error;
        const syncedUuids = pending.map(p => p.uuid);
        await db.table(table).where('uuid').anyOf(syncedUuids).modify({ syncStatus: 'synced' });
      }
    } catch (err) {
      console.error(`Error pushing ${table}:`, err.message);
    }
  }
}

export async function pullChanges(isFirstSync = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync() || '1970-01-01T00:00:00.000Z';
  const now = new Date().toISOString();
  const tables = ['transactions', 'settings', 'loans', 'bucket_map'];

  for (const table of tables) {
    try {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', session.user.id)
        .range(0, 5000); // <--- FORCES SUPABASE TO RETURN UP TO 5,000 ROWS

      if (!isFirstSync) {
        query = query.gt('updated_at', lastSync);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const toPut = data.map(row => {
          // eslint-disable-next-line no-unused-vars
          const { user_id, id, ...rest } = row;
          return {
            ...rest,
            uuid: id, 
            syncStatus: 'synced'
          };
        });

        if (table === 'settings') {
          await db.settings.bulkPut(toPut);
        } else {
          if (isFirstSync) await db.table(table).clear();
          await db.table(table).bulkPut(toPut); 
        }
      }
    } catch (err) {
      console.error(`Error pulling ${table}:`, err.message);
    }
  }
  setLastSync(now);
}

export async function syncAll() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync();
  
  if (!lastSync) {
    const { count, error } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
    
    if (!error && count === 0) {
      // Cloud empty, push local up
      await db.transactions.toCollection().modify({ syncStatus: 'pending' });
      await db.settings.toCollection().modify({ syncStatus: 'pending' });
      await db.loans.toCollection().modify({ syncStatus: 'pending' });
      await db.bucket_map.toCollection().modify({ syncStatus: 'pending' });
      await pushChanges();
      setLastSync(new Date().toISOString());
      return;
    } else {
      // Cloud has data, pull down and WIPE local
      await pullChanges(true);
      return;
    }
  }

  await pushChanges();
  await pullChanges(false);
}
