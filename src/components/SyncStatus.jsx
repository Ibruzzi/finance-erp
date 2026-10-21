import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import { getLastOkSync, SYNC_EVENT } from '../lib/sync';

const TABLES = ['transactions', 'settings', 'loans', 'bucket_map'];

function timeAgo(iso) {
  if (!iso) return 'not yet';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * A small status line: "Synced 2 min ago" or "3 changes waiting to upload".
 * It only displays information; it never starts a sync itself.
 */
export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [lastOk, setLastOk] = useState(getLastOkSync());
  const [lastError, setLastError] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [, setTick] = useState(0);

  useEffect(() => {
    const sub = liveQuery(async () => {
      let total = 0;
      for (const t of TABLES) {
        total += await db.table(t).where('syncStatus').equals('pending').count();
      }
      return total;
    }).subscribe({ next: setPending, error: () => {} });

    const onSync = (e) => {
      setLastOk(getLastOkSync());
      setLastError(e.detail && !e.detail.ok ? e.detail.error : null);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Refresh the "x min ago" wording every 30 seconds.
    const timer = setInterval(() => setTick(n => n + 1), 30000);

    return () => {
      sub.unsubscribe();
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
  }, []);

  let text;
  let color = 'text-gray-400';

  if (!online) {
    text = pending > 0
      ? `Offline • ${pending} change${pending === 1 ? '' : 's'} saved on this device, will upload when you're back online`
      : 'Offline • changes will upload when you reconnect';
    color = 'text-orange-500';
  } else if (lastError) {
    text = `Last sync had a problem: ${lastError}`;
    color = 'text-red-500';
  } else if (pending > 0) {
    text = `${pending} change${pending === 1 ? '' : 's'} waiting to upload • last synced ${timeAgo(lastOk)}`;
    color = 'text-orange-500';
  } else {
    text = `Synced ${timeAgo(lastOk)}`;
    color = 'text-green-600';
  }

  return <div className={`text-[11px] truncate ${color}`}>{text}</div>;
}
