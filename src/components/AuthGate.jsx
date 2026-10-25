
import { useState, useEffect, useRef } from 'react';
import { liveQuery } from 'dexie';
import { supabase } from '../lib/supabaseClient';
import { syncAll } from '../lib/sync';
import { db } from '../db/database';
import { useStore } from '../store/useStore';
import { Loader2, Mail, AlertCircle, KeyRound } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LoadingScreen } from './LoadingScreen';
import { isCloudSyncOn, HAS_AUTO_LOGIN, AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD } from '../lib/cloudMode';

// How long to wait after your last change before uploading it.
const PUSH_DELAY_MS = 3000;
// Coming back to the app after at least this long triggers a quiet refresh.
const RETURN_REFRESH_AFTER_MS = 15000;
// While the app is open and visible, check the cloud this often.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// In the installed Android app the email link must open the APP (not a browser).
// This address is registered with Android (AndroidManifest.xml) and must also be
// added to Supabase -> Authentication -> URL Configuration -> Redirect URLs.
const NATIVE_REDIRECT = 'financeerp://auth-callback';
const IS_NATIVE_APP = Capacitor.isNativePlatform();

const PENDING_TABLES = ['transactions', 'settings', 'loans', 'bucket_map'];

// With cloud sync OFF there is no login at all: the app just opens.
// With it ON, the sign-in + syncing flow below is used (automatic when auto-login
// details are configured, otherwise the login screen).
export function AuthGate({ children }) {
  if (!isCloudSyncOn()) return <>{children}</>;
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState(null);
  // True when auto-login could not reach the internet: the app then runs on the data
  // already on the phone and tries again when the connection comes back.
  const [offlineNoSession, setOfflineNoSession] = useState(false);

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

  // Sign in automatically with the email/password from .env.local (if configured).
  const autoLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: AUTO_LOGIN_EMAIL,
        password: AUTO_LOGIN_PASSWORD,
      });
      if (!error) {
        setOfflineNoSession(false);
        return; // SIGNED_IN fires below and starts the first sync
      }
      if (error.name === 'AuthRetryableFetchError' || !navigator.onLine) {
        setOfflineNoSession(true); // no internet: carry on with local data for now
      } else {
        setMessageOk(false);
        setMessage('Automatic sign-in failed: ' + error.message + '. You can sign in with an emailed link or code instead.');
      }
    } catch (err) {
      console.error('Auto-login failed:', err);
      setOfflineNoSession(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        userIdRef.current = session.user.id;
        triggerSync(true);
      } else if (HAS_AUTO_LOGIN) {
        autoLogin();
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

  // If we started offline without a session, try the automatic sign-in again as soon
  // as the connection is back or the app is brought back to the screen.
  useEffect(() => {
    if (!HAS_AUTO_LOGIN || !offlineNoSession || session) return;
    const retry = () => {
      if (navigator.onLine && document.visibilityState === 'visible') autoLogin();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineNoSession, session]);

  // ---------- Finish sign-in when the email link opens the app ----------
  // The link in the email sends you to financeerp://auth-callback#access_token=...
  // Android hands that address to this app, and we use it to sign in.
  const lastHandledUrl = useRef('');

  const handleAuthUrl = async (url) => {
    if (!url || !url.startsWith('financeerp://') || url === lastHandledUrl.current) return;
    lastHandledUrl.current = url;

    const [beforeHash, hashPart = ''] = url.split('#');
    const queryPart = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    new URLSearchParams(hashPart).forEach((v, k) => params.set(k, v));

    try {
      if (params.get('error_description') || params.get('error')) {
        setMessageOk(false);
        setMessage(
          (params.get('error_description') || params.get('error')).replace(/\+/g, ' ') +
          ' - request a new link and try again.'
        );
        return;
      }
      if (params.get('access_token') && params.get('refresh_token')) {
        const { error } = await supabase.auth.setSession({
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
        });
        if (error) throw error;
      } else if (params.get('code')) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.get('code'));
        if (error) throw error;
      }
      // On success Supabase fires SIGNED_IN and the code above takes over.
    } catch (err) {
      console.error('Deep link sign-in failed:', err);
      setMessageOk(false);
      setMessage('Could not sign in from the link: ' + (err.message || err) + '. Use the code from the email instead.');
    }
  };

  useEffect(() => {
    if (!IS_NATIVE_APP) return;
    let listener = null;
    let cancelled = false;

    CapacitorApp.addListener('appUrlOpen', (event) => handleAuthUrl(event.url)).then((l) => {
      if (cancelled) l.remove(); else listener = l;
    });
    // If the app was closed and the link launched it, pick up that address too.
    CapacitorApp.getLaunchUrl().then((res) => handleAuthUrl(res?.url)).catch(() => {});

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
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
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // App: the link opens the installed app. Website: it returns to the website.
        emailRedirectTo: IS_NATIVE_APP ? NATIVE_REDIRECT : window.location.origin,
      },
    });
    setBusy(false);
    if (error) {
      setMessageOk(false);
      setMessage(error.message);
    } else {
      setMessageOk(true);
      setCodeSent(true);
      setMessage('Check your email. Tap the link, or type the code from the email below.');
    }
  };

  // Sign in by typing the code from the email (works in any browser or app).
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setMessage('');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setMessageOk(false);
      setMessage(error.message);
    }
    // On success Supabase fires SIGNED_IN and the app continues by itself.
  };

  if (loading) {
    return (
      <LoadingScreen
        message={session ? 'Syncing your data from the cloud...' : 'Loading...'}
      />
    );
  }

  if (!session && !offlineNoSession) {
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
              {busy && !codeSent ? 'Sending...' : codeSent ? 'Send a new link / code' : 'Send login link'}
            </button>
          </form>

          {codeSent && (
            <form onSubmit={handleVerifyCode} className="space-y-3 mt-5 pt-5 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-500 block">Code from the email</label>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-9 p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 tracking-widest text-lg"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900 transition disabled:opacity-40"
              >
                {busy ? 'Checking...' : 'Sign in with code'}
              </button>
            </form>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm text-center ${
                messageOk
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

