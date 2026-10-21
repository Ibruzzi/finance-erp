import { db } from '../db/database';

/**
 * Saves a copy of ALL your data (transactions, settings, loans, bucket map)
 * into one .json file and downloads it to this device.
 * Returns how many rows of each kind were saved.
 */
export async function downloadBackup() {
  const [transactions, settings, loans, bucket_map] = await Promise.all([
    db.transactions.toArray(),
    db.settings.toArray(),
    db.loans.toArray(),
    db.bucket_map.toArray(),
  ]);

  const backup = {
    app: 'finance-erp',
    format_version: 1,
    exported_at: new Date().toISOString(),
    counts: {
      transactions: transactions.length,
      settings: settings.length,
      loans: loans.length,
      bucket_map: bucket_map.length,
    },
    tables: { transactions, settings, loans, bucket_map },
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `finance-erp-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return backup.counts;
}
