import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncAll } from '../lib/sync';
import { Loader2, Mail, AlertCircle } from 'lucide-react';

export function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        triggerSync();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth Event:', event);
      if (event === 'SIGNED_IN') {
        setSession(session);
        if (!window.location.hash.includes('access_token')) {
          triggerSync();
        }
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      console.log('Starting Sync...');
      await syncAll();
      console.log('Sync Complete!');
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncError(e.message || String(e));
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

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

  if (loading || isSyncing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-blue-600">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-500">
          {isSyncing ? 'Syncing your data from the cloud...' : 'Loading...'}
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
            onClick={triggerSync}
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
