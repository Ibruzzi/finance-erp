import { useState, useEffect, useRef } from 'react';
import { liveQuery } from 'dexie';
import { supabase } from '../lib/supabaseClient';
import { syncAll } from '../lib/sync';
import { db } from '../db/database';
import { useStore } from '../store/useStore';
import { Loader2, Mail, AlertCircle } from 'lucide-react';

// How long to wait after your last change before uploading it.
const PUSH_DELAY_MS = 3000;
// Coming back to the app after at least this long triggers a quiet refresh.
const RETURN_REFRESH_AFTER_MS = 15000;
// While the app is open and visible, check the cloud this often.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const PENDING_TABLES = ['transactions', 'settings', 'loans', 'bucket_map'];

export function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncError, setSyncError] = useState(null);

  // Remembers who is signed in, so we can tell "same person, tab came back
  // into view" apart from "someone actually just logged in".
  const userIdRef = useRef(null);

  // blocking = true  -> full-screen spinner (only used the first time the app opens)
  // blocking = false -> sync quietly in the background; the screen never flashes
  const triggerSync = async (blocking) => {
    setSyncError(null);
    if (blocking) setLoading(true);
    try {
      await syncAll();
      if (!blocking) {
        // Background sync finished: refresh the on-screen data without a loading screen.
        await useStore.getState().loadData();
      }
    } catch (e) {
      console.error('Sync failed:', e);
      // Being offline is normal for a phone. Only show the red bar for real errors,
      // or when the person asked for the sync themselves (blocking).
      if (blocking || navigator.onLine) {
        setSyncError(e.message || String(e));
      }
    } finally {
      if (blocking) setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        userIdRef.current = session.user.id;
        triggerSync(true);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth Event:', event);

      if (event === 'SIGNED_IN' && newSession) {
        // Coming back to the tab re-fires SIGNED_IN for the same user.
        // That is NOT a new login, so do nothing visible.
        if (userIdRef.current === newSession.user.id) {
          setSession(newSession);
          return;
        }

        // A genuinely new login (e.g. clicking the magic link).
        userIdRef.current = newSession.user.id;
        setSession(newSession);
        triggerSync(true);
      }

      if (event === 'SIGNED_OUT') {
        userIdRef.current = null;
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Automatic syncing (only while signed in) ----------
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) return;

    let pushTimer = null;
    let hiddenAt = null;

    const quietSync = () => {
      if (!navigator.onLine) return;
      triggerSync(false);
    };

    // 1. Upload shortly after you save/edit anything.
    //    liveQuery re-runs whenever the local database changes. We count rows
    //    still marked "pending" (not yet uploaded). If any exist, wait a few
    //    seconds (so several quick edits go up together) and then sync.
    const subscription = liveQuery(async () => {
      let total = 0;
      for (const t of PENDING_TABLES) {
        total += await db.table(t).where('syncStatus').equals('pending').count();
      }
      return total;
    }).subscribe({
      next: (pendingCount) => {
        clearTimeout(pushTimer);
        if (pendingCount > 0) {
          pushTimer = setTimeout(quietSync, PUSH_DELAY_MS);
        }
      },
      error: (err) => console.error('Pending watcher error:', err),
    });

    // 2. Refresh when you come back to the app after a while.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > RETURN_REFRESH_AFTER_MS) {
        hiddenAt = null;
        quietSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 3. Sync when the internet comes back.
    window.addEventListener('online', quietSync);

    // 4. Check the cloud every few minutes while the app is open and visible.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') quietSync();
    }, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(pushTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', quietSync);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-blue-600">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-500">
          {session ? 'Syncing your data from the cloud...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">Finance ERP</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Sign in to sync your data.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Email Address</label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Send Magic Link
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm text-center ${
                message.includes('Check')
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {syncError && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-sm p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="truncate">Sync failed: {syncError}. Showing local data.</span>
          </div>
          <button
            onClick={() => triggerSync(false)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </>
  );
}
