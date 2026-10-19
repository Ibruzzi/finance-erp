import { supabase } from './supabaseClient';
import { db } from '../db/database';

const LAST_SYNC_KEY = 'finance_erp_last_sync';
const PAGE_SIZE = 1000;
const PUSH_CHUNK = 500;

export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY);
export const setLastSync = (isoString) => localStorage.setItem(LAST_SYNC_KEY, isoString);

/**
 * Fetch every row from a Supabase table for the current user, paginated.
 * - Orders by updated_at (required for stable pagination — without it, rows
 *   can be silently skipped or duplicated between pages).
 * - Loops until a page returns fewer than PAGE_SIZE rows.
 * - If sinceISO is provided, only fetches rows updated after that timestamp.
 */
async function fetchAllRows(table, userId, sinceISO) {
  const allRows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (sinceISO) {
      query = query.gt('updated_at', sinceISO);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;
    allRows.push(...data);

    if (data.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

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
        updated_at: now,
      };
    });

    // Chunked upsert so we never send a request body that exceeds
    // PostgREST's limits. Each chunk is marked synced independently, so a
    // mid-flight failure doesn't force the whole batch to re-push.
    for (let i = 0; i < toPush.length; i += PUSH_CHUNK) {
      const chunk = toPush.slice(i, i + PUSH_CHUNK);
      const chunkPending = pending.slice(i, i + PUSH_CHUNK);

      try {
        if (table === 'settings') {
          const { error } = await supabase
            .from(table)
            .upsert(chunk, { onConflict: 'user_id,key' });
          if (error) throw error;
          const keys = chunkPending.map(p => p.key);
          await db.settings.where('key').anyOf(keys).modify({ syncStatus: 'synced' });
        } else {
          const { error } = await supabase.from(table).upsert(chunk);
          if (error) throw error;
          const uuids = chunkPending.map(p => p.uuid);
          await db.table(table).where('uuid').anyOf(uuids).modify({ syncStatus: 'synced' });
        }
      } catch (err) {
        console.error(`Error pushing ${table} chunk starting at ${i}:`, err.message);
        // Don't abort — other chunks can still succeed.
      }
    }
  }
}

export async function pullChanges(isFirstSync = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync() || '1970-01-01T00:00:00.000Z';
  const now = new Date().toISOString();
  const tables = ['transactions', 'settings', 'loans', 'bucket_map'];

  // PHASE 1: Fetch everything into memory first.
  // This ensures that if the network fails mid-way, we haven't already
  // wiped local data (critical for first sync on a fresh device).
  const fetched = {};
  for (const table of tables) {
    try {
      fetched[table] = await fetchAllRows(
        table,
        session.user.id,
        isFirstSync ? null : lastSync
      );
    } catch (err) {
      console.error(`Error fetching ${table}:`, err.message);
      // If ANY table fails on first sync, abort entirely — do not wipe local.
      if (isFirstSync) throw err;
      fetched[table] = [];
    }
  }

  // PHASE 2: Apply to Dexie.
  for (const table of tables) {
    const rows = fetched[table];
    if (!rows || rows.length === 0) continue;

    const toPut = rows.map(row => {
      // eslint-disable-next-line no-unused-vars
      const { user_id, id, ...rest } = row;
      return {
        ...rest,
        uuid: id,
        syncStatus: 'synced',
      };
    });

    if (table === 'settings') {
      await db.settings.bulkPut(toPut);
    } else {
      if (isFirstSync) await db.table(table).clear();
      await db.table(table).bulkPut(toPut);
    }
  }

  setLastSync(now);
}

export async function syncAll() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync();

  if (!lastSync) {
    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (!error && count === 0) {
      // Cloud is empty → push everything local up.
      await db.transactions.toCollection().modify({ syncStatus: 'pending' });
      await db.settings.toCollection().modify({ syncStatus: 'pending' });
      await db.loans.toCollection().modify({ syncStatus: 'pending' });
      await db.bucket_map.toCollection().modify({ syncStatus: 'pending' });
      await pushChanges();
      setLastSync(new Date().toISOString());
      return;
    }

    // Cloud has data → pull down and wipe local.
    await pullChanges(true);
    return;
  }

  await pushChanges();
  await pullChanges(false);
}
