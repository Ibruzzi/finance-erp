import { Loader2 } from 'lucide-react';

// Full-screen loading view in the app icon's colours (deep navy fading to green, gold accents).
// Used while the app starts up and while it syncs on first open.
export function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(180deg, #021237 0%, #0a4a5e 55%, #0a8a5c 100%)' }}
    >
      <img
        src="/icons/icon-192.png"
        alt=""
        width={96}
        height={96}
        className="rounded-3xl shadow-2xl mb-6"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <Loader2 size={30} className="animate-spin mb-3" style={{ color: '#e8b830' }} />
      <p className="text-sm font-semibold text-white/80">{message}</p>
    </div>
  );
}
