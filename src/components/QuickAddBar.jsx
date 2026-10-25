import { Zap } from 'lucide-react';

// A row of one-tap shortcuts. The options change by themselves based on what you
// have been using lately (see utils/quickAdd.js). Tapping one opens the add form
// already filled in (category, subcategory, last amount) so you only confirm.
export function QuickAddBar({ suggestions, onPick }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1.5">
        <Zap size={12} /> Quick add
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {suggestions.map((s) => (
          <button
            key={s.category + '||' + s.subcategory}
            onClick={() => onPick(s)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2 text-left shadow-sm active:scale-95 transition"
          >
            <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">{s.subcategory}</div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">
              {s.category}
              {s.amount_original !== '' && ` · ${s.currency === 'USD' ? '$' : 'RF '}${s.amount_original}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
