import { Zap } from 'lucide-react';

// A compact row of one-tap shortcuts (the bolt icon at the start is the label).
// The options change by themselves based on what you have been using lately
// (see utils/quickAdd.js). Tapping one opens the add form already filled in
// (category, subcategory, last amount) so you only confirm.
export function QuickAddBar({ suggestions, onPick }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
      <Zap size={14} className="flex-shrink-0 text-amber-500" aria-label="Quick add" />
      {suggestions.map((s) => (
        <button
          key={s.category + '||' + s.subcategory}
          onClick={() => onPick(s)}
          className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-left shadow-sm active:scale-95 transition"
        >
          <div className="text-[13px] font-semibold text-gray-800 leading-tight max-w-[110px] truncate">{s.subcategory}</div>
          <div className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">
            {s.category}
            {s.amount_original !== '' && ` · ${s.currency === 'USD' ? '$' : ''}${s.amount_original}`}
          </div>
        </button>
      ))}
    </div>
  );
}
