import React, { useState, useEffect } from 'react';
import { initSettings, pruneDuplicates } from '../db/database';

// Module-level lock to prevent concurrent sync executions across remounts / strict mode
let isSyncInProgress = false;

export function AuthGate({ children, syncAll, isAuthenticated }) {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      try {
        // 1. Initialize local database and default values safely
        await initSettings();

        // 2. Run a clean-up pass to wipe out any accidental multi-tab duplicates
        await pruneDuplicates('transactions');
        await pruneDuplicates('loans');

        // 3. Trigger initial remote sync if authenticated
        if (isAuthenticated) {
          await triggerSync();
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) {
          setSyncError(err.message || String(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const triggerSync = async () => {
    if (isSyncInProgress) {
      console.log('Sync already in progress. Skipping concurrent trigger.');
      return;
    }

    isSyncInProgress = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      console.log('Starting remote synchronization...');
      if (typeof syncAll === 'function') {
        await syncAll();
      }
      console.log('Remote synchronization complete.');
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncError(e.message || String(e));
    } finally {
      setIsSyncing(false);
      isSyncInProgress = false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your secure vault...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {syncError && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 m-4 text-amber-700 rounded-r shadow-sm">
          <div className="flex justify-between items-center">
            <span><strong>Sync Warning:</strong> {syncError}</span>
            <button 
              onClick={triggerSync}
              disabled={isSyncing}
              className="text-xs bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded font-semibold transition"
            >
              {isSyncing ? 'Retrying...' : 'Retry Sync'}
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
