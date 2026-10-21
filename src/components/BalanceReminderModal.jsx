import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { monthLabel } from '../utils/balanceReminder';

// Asks for the month-end bank balance (needed for the zakat calculation).
// Shows one month at a time; `monthKey` is "YYYY-MM".
export function BalanceReminderModal({ monthKey, remaining, onSave, onLater, onSkip }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(value);
  const canSave = value !== '' && !Number.isNaN(parsed) && parsed >= 0 && !saving;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(monthKey, parsed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold">Bank balance reminder</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Enter your bank balance at the end of <strong>{monthLabel(monthKey)}</strong>. It is used for the zakat calculation.
          {remaining > 1 && (
            <span className="block text-xs text-gray-400 mt-1">
              {remaining - 1} more month{remaining - 1 === 1 ? '' : 's'} to fill in after this one.
            </span>
          )}
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Bank balance (MVR)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-lg font-bold"
              placeholder="0.00"
            />
          </div>

          <button
            type="submit"
            disabled={!canSave}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-40"
          >
            Save balance
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLater}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200"
            >
              Skip this month
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            "Remind me later" asks again next time you open the app. "Skip this month" stops asking for this month only.
          </p>
        </form>
      </div>
    </div>
  );
}
