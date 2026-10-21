import { supabase } from './supabaseClient';
import { db, initSettings, stableUuid } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const LAST_SYNC_KEY = 'finance_erp_last_sync';
const EPOCH_KEY = 'finance_erp_sync_epoch';
const LAST_OK_KEY = 'finance_erp_last_ok_sync';
export const SYNC_EVENT = 'finance-sync-finished';
// Bump this string whenever you want every device to do a full clean re-download.
const SYNC_EPOCH = 'v7-dedupe-fix';

const PAGE_SIZE = 1000;
const PUSH_CHUNK = 500;
// Phones and laptops have slightly different clocks. We look back a few
// minutes on every pull so a row stamped by a "slow" clock is never missed.
// Re-reading a row is harmless now (it just overwrites itself).
const PULL_OVERLAP_MS = 5 * 60 * 1000;

const TABLES = ['transactions', 'settings', 'loans', 'bucket_map'];
const UUID_TABLES = ['transactions', 'loans', 'bucket_map'];

export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY);
export const setLastSync = (isoString) => localStorage.setItem(LAST_SYNC_KEY, isoString);
export const getLastOkSync = () => localStorage.getItem(LAST_OK_KEY);

// Tells the rest of the app (the "Synced 2 min ago" line) that a sync just finished.
function announceSync(ok, error) {
  if (ok) localStorage.setItem(LAST_OK_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { ok, error: error || null } }));
}

async function fetchAllRows(table, userId, sinceISO) {
  const allRows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      // order by id as a tie-breaker so paging is stable
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
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

/**
 * Local self-repair. Runs before every sync.
 *  1. Rows that somehow have no uuid get one (e.g. imported rows).
 *  2. If two local rows share the same uuid, keep the newest, delete the rest.
 * This quietly cleans up duplicates created by the old buggy pull.
 */
async function cleanupLocal() {
  for (const table of UUID_TABLES) {
    const rows = await db.table(table).toArray();
    const seen = new Map();
    const toDelete = [];
    const needUuid = [];

    for (const r of rows) {
      if (!r.uuid) {
        needUuid.push(r.id);
        continue;
      }
      const prev = seen.get(r.uuid);
      if (!prev) {
        seen.set(r.uuid, r);
        continue;
      }
      const prevTime = new Date(prev.updated_at || 0).getTime();
      const thisTime = new Date(r.updated_at || 0).getTime();
      // Keep whichever is newer. On a tie, keep the one we saw first.
      if (thisTime > prevTime) {
        toDelete.push(prev.id);
        seen.set(r.uuid, r);
      } else {
        toDelete.push(r.id);
      }
    }

    if (toDelete.length > 0) {
      console.warn(`[sync] Removing ${toDelete.length} duplicate local rows from ${table}`);
      await db.table(table).bulkDelete(toDelete);
    }

    if (needUuid.length > 0) {
      const nowISO = new Date().toISOString();
      await db.table(table).where('id').anyOf(needUuid).modify(row => {
        row.uuid = uuidv4();
        row.syncStatus = 'pending';
        row.updated_at = nowISO;
        if (row.deleted === undefined) row.deleted = false;
      });
    }
  }
}

/**
 * liveOnly = true uploads ONLY things you typed in yourself (live transactions
 * and loans). Used as a safety step before a device replaces its local data.
 */
export async function pushChanges({ liveOnly = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const now = new Date().toISOString();
  let allSuccessful = true;

  for (const table of TABLES) {
    let pending = await db.table(table).where('syncStatus').equals('pending').toArray();
    if (liveOnly) {
      if (table === 'transactions') pending = pending.filter(r => !r.is_historical);
      else if (table !== 'loans') continue;
    }
    if (pending.length === 0) continue;

    const toPush = pending.map(row => {
      // eslint-disable-next-line no-unused-vars
      const { id, syncStatus, uuid, ...rest } = row;
      // Settings saved by older code may have no uuid; derive a stable one from the key.
      const cloudId = uuid || (table === 'settings' ? stableUuid('setting|' + row.key) : uuidv4());
      return {
        id: cloudId,
        ...rest,
        user_id: session.user.id,
        updated_at: now,
      };
    });

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
          const ids = chunkPending.map(p => p.id);
          await db.table(table).where('id').anyOf(ids).modify({ syncStatus: 'synced' });
        }
      } catch (err) {
        console.error(`Error pushing ${table} chunk starting at ${i}:`, err.message);
        allSuccessful = false;
      }
    }
  }

  return allSuccessful;
}

export async function pullChanges(isFirstSync = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const lastSync = getLastSync();
  const pullStartedAt = new Date().toISOString();

  let sinceISO = null;
  if (!isFirstSync && lastSync) {
    sinceISO = new Date(new Date(lastSync).getTime() - PULL_OVERLAP_MS).toISOString();
  }

  // Step 1: download everything first. If any download fails we stop BEFORE
  // touching the local database, so a network hiccup can never leave you half-wiped.
  const fetched = {};
  for (const table of TABLES) {
    fetched[table] = await fetchAllRows(table, session.user.id, sinceISO);
  }

  // Safety stop: never replace this device's data with a cloud answer that
  // looks wrong (empty, or far smaller than what this device already holds).
  if (isFirstSync) {
    const localSynced = await db.transactions.where('syncStatus').equals('synced').count();
    const cloudCount = fetched.transactions.length;
    if (cloudCount === 0 || (localSynced > 100 && cloudCount < localSynced * 0.5)) {
      throw new Error(
        `Safety stop: the cloud returned ${cloudCount} transactions but this device has ${localSynced}. ` +
        'Your local data was NOT replaced. Download a backup in Settings, then try again.'
      );
    }
  }

  // Step 2: write into the local database, one table at a time, all-or-nothing.
  for (const table of TABLES) {
    const rows = fetched[table];

    await db.transaction('rw', db.table(table), async () => {
      if (isFirstSync) {
        await db.table(table).clear();
      }
      if (!rows || rows.length === 0) return;

      // Look up what we already have locally, so we can UPDATE instead of INSERT.
      // (This lookup is the fix. The old code skipped it, so every pull inserted
      // a brand-new copy of rows that already existed.)
      const existing = await db.table(table).toArray();
      const localByKey = new Map();
      for (const r of existing) {
        localByKey.set(table === 'settings' ? r.key : r.uuid, r);
      }

      const toPut = [];
      for (const row of rows) {
        // eslint-disable-next-line no-unused-vars
        const { user_id, id: cloudId, ...rest } = row;
        const local = localByKey.get(table === 'settings' ? row.key : cloudId);

        // Don't overwrite an unsynced local edit that is newer than the cloud copy.
        if (local && local.syncStatus === 'pending') {
          const localTime = new Date(local.updated_at || 0).getTime();
          const cloudTime = new Date(row.updated_at || 0).getTime();
          if (localTime > cloudTime) continue;
        }

        const out = { ...rest, uuid: cloudId, syncStatus: 'synced' };
        // Reusing the local row's id is what makes put() replace it.
        if (local && table !== 'settings') out.id = local.id;
        toPut.push(out);
      }

      if (toPut.length > 0) {
        await db.table(table).bulkPut(toPut);
      }
    });
  }

  setLastSync(pullStartedAt);
}

// Returns true (all good), false (finished but some changes didn't upload), or null (not signed in).
async function runSync() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // One-time reset after this fix is deployed: forget the old sync marker
  // so this device does one clean full download.
  if (localStorage.getItem(EPOCH_KEY) !== SYNC_EPOCH) {
    localStorage.removeItem(LAST_SYNC_KEY);
  }

  await cleanupLocal();

  const lastSync = getLastSync();

  if (!lastSync) {
    // First sync on this device (or a forced clean re-download).
    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (error) throw error;

    if (count === 0) {
      // Cloud is empty: this device's data becomes the cloud's data.
      await initSettings();
      for (const t of TABLES) {
        await db.table(t).toCollection().modify({ syncStatus: 'pending' });
      }
      const ok = await pushChanges();
      if (!ok) throw new Error('Could not upload your data to the cloud.');
      setLastSync(new Date().toISOString());
    } else {
      // Cloud has data: wipe local and take the cloud's copy.
      // Safety first: upload anything you typed in that hasn't reached the cloud yet,
      // otherwise the wipe below would delete it. If this upload fails, stop.
      const savedLive = await pushChanges({ liveOnly: true });
      if (!savedLive) {
        throw new Error(
          'This device has entries that could not be uploaded, so it was not reset. Check your connection and try again.'
        );
      }
      await pullChanges(true);
      // Make sure historical seed rows exist (same ids on every device),
      // then upload anything new.
      await initSettings();
      await pushChanges();
    }

    localStorage.setItem(EPOCH_KEY, SYNC_EPOCH);
    return true;
  }

  // Normal sync: push first. If the push fails, do NOT pull.
  const pushOk = await pushChanges();
  if (pushOk) {
    await pullChanges(false);
  } else {
    console.warn('Push failed. Skipping pull so local edits are not overwritten.');
  }
  return pushOk;
}

let runningSync = null;

/**
 * Only ONE sync may run at a time. If sync is requested while another is
 * running (the app asks twice on startup, and again when you switch tabs),
 * the second request just waits for the first one.
 * navigator.locks extends this protection across browser tabs.
 */
export function syncAll() {
  if (runningSync) return runningSync;

  const task = () => runSync();
  const wrapped = (navigator.locks && navigator.locks.request)
    ? navigator.locks.request('finance-erp-sync', task)
    : task();

  runningSync = Promise.resolve(wrapped)
    .then((result) => {
      if (result === true) announceSync(true);
      else if (result === false) announceSync(false, 'Some changes could not be uploaded. Will retry.');
      return result;
    })
    .catch((err) => {
      announceSync(false, err.message || String(err));
      throw err;
    })
    .finally(() => { runningSync = null; });
  return runningSync;
}
