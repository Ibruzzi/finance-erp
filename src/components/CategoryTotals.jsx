import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatMoney } from '../utils/format';

export function CategoryTotals({ totals, grandTotal }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (category) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="text-lg font-bold text-gray-800">Category Totals</h2>
        <span className="text-sm font-semibold text-gray-500">Total: RF {formatMoney(grandTotal)}</span>
      </div>

      {totals.length === 0 ? (
        <div className="text-center p-8 text-gray-400 bg-white rounded-xl shadow-sm text-sm">
          No expenses logged for this month yet.
        </div>
      ) : (
        <div className="space-y-2">
          {totals.map((item) => {
            const percentage = grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0;
            const isOpen = !!expanded[item.category];
            const subs = item.subcategories || [];

            return (
              <div key={item.category} className="bg-white rounded-xl shadow-sm overflow-hidden relative">
                {/* Background share bar */}
                <div
                  className="absolute top-0 left-0 h-full bg-blue-50 opacity-60 pointer-events-none"
                  style={{ width: `${percentage}%` }}
                ></div>

                {/* Category row (clickable) */}
                <button
                  type="button"
                  onClick={() => toggle(item.category)}
                  className="relative w-full text-left p-3 flex justify-between items-center gap-2 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen
                      ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                      : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-700 truncate">{item.category}</div>
                      <div className="text-xs text-gray-400">
                        {percentage.toFixed(1)}% of total
                        {subs.length > 0 && ` • ${subs.length} subcategor${subs.length === 1 ? 'y' : 'ies'}`}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-gray-800 flex-shrink-0">
                    RF {formatMoney(item.amount)}
                  </div>
                </button>

                {/* Subcategory breakdown */}
                {isOpen && subs.length > 0 && (
                  <div className="relative border-t border-gray-100 bg-gray-50/40">
                    {subs.map(sub => {
                      const subPct = item.amount > 0 ? (sub.amount / item.amount) * 100 : 0;
                      return (
                        <div
                          key={sub.subcategory}
                          className="flex justify-between items-center px-4 py-2 border-b border-gray-100 last:border-0"
                        >
                          <div className="min-w-0 pl-6">
                            <div className="text-sm text-gray-700 truncate">{sub.subcategory}</div>
                            <div className="text-[10px] text-gray-400">
                              {sub.count} txn • {subPct.toFixed(1)}% of {item.category}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-600 flex-shrink-0">
                            RF {formatMoney(sub.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
