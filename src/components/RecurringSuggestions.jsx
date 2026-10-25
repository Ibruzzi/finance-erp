import { useState } from 'react';
import { Check, X, Repeat } from 'lucide-react';

// Dashboard card: recurring items that are due. Nothing is added until you approve.
// You can change the amount before approving (e.g. a bill that varies).
export function RecurringSuggestions({ items, onApprove, onReject }) {
  const [amounts, setAmounts] = useState({}); // edited amounts, by item key
  const [busyKey, setBusyKey] = useState(null);

  if (!items || items.length === 0) return null;

  const keyOf = (it) => it.rule.id + '|' + it.monthKey;

  const run = async (it, fn) => {
    const k = keyOf(it);
    if (busyKey) return;
    setBusyKey(k);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
      <div className="flex items-center gap-1.5 text-sm font-bold text-amber-800 mb-2">
        <Repeat size={14} /> Recurring - needs your OK
      </div>
      <div className="space-y-2">
        {items.map((it) => {
          const k = keyOf(it);
          const r = it.rule;
          const value = amounts[k] ?? r.amount;
          const amountNum = parseFloat(value);
          return (
            <div key={k} className="bg-white rounded-lg p-2.5 border border-amber-100">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{r.name}</div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {r.category} &gt; {r.subcategory} · due{' '}
                    {it.dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="w-24 p-1.5 text-right text-sm font-bold bg-gray-50 border border-gray-200 rounded-lg"
                  />
                  <span className="text-[11px] text-gray-400">{r.currency}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  disabled={!!busyKey || !(amountNum > 0)}
                  onClick={() => run(it, () => onApprove(it, amountNum))}
                  className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  <Check size={16} /> Add
                </button>
                <button
                  disabled={!!busyKey}
                  onClick={() => run(it, () => onReject(it))}
                  className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  <X size={16} /> Skip this time
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
