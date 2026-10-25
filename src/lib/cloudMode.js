// Cloud sync / login switch.
//
// AUTO-LOGIN: if the file .env.local (in the project folder, never uploaded to GitHub)
// contains VITE_AUTO_LOGIN_EMAIL and VITE_AUTO_LOGIN_PASSWORD, the app signs in by
// itself and syncs, with no login screen. Those two values are baked into the app when
// you build it, so anyone who gets your APK file could extract them.
//
// The Settings switch can still turn cloud sync on or off on a device:
//   - nothing chosen yet -> ON if auto-login is configured, otherwise OFF
//   - OFF: no login, data stays on this device only
//   - ON : sign in (automatically, or with the login screen) and sync with Supabase
// The choice is stored on THIS device only, and changing it reloads the app.

const KEY = 'finance_erp_cloud_sync';

export const AUTO_LOGIN_EMAIL = (import.meta.env.VITE_AUTO_LOGIN_EMAIL || '').trim();
export const AUTO_LOGIN_PASSWORD = import.meta.env.VITE_AUTO_LOGIN_PASSWORD || '';
export const HAS_AUTO_LOGIN = !!(AUTO_LOGIN_EMAIL && AUTO_LOGIN_PASSWORD);

export function isCloudSyncOn() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
    return HAS_AUTO_LOGIN; // no choice made yet
  } catch {
    return HAS_AUTO_LOGIN;
  }
}

export function setCloudSync(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch (err) {
    console.error('Could not save cloud sync choice:', err);
  }
  window.location.reload();
}
