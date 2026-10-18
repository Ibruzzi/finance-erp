import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncAll } from '../lib/sync';
import { Loader2, Mail } from 'lucide-react';

export function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // If we have a session, trigger sync
        triggerSync();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes (like clicking the magic link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      if (event === 'SIGNED_IN') {
        setSession(session);
        // Force a reload to ensure the session is fully picked up by the browser
        if (!window.location.hash.includes('access_token')) {
          triggerSync();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      console.log("Starting Sync...");
      await syncAll();
      console.log("Sync Complete!");
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
      setLoading(false); // Only show the app after sync finishes!
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin, // Uses the current URL (localhost or vercel)
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
          {isSyncing ? "Syncing your data from the cloud..." : "Loading..."}
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
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('Check') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
