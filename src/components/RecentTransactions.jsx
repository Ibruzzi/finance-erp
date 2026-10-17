import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Trash2, Pencil } from 'lucide-react';
import { formatMoney } from '../utils/format';

export function RecentTransactions({ transactions, onEdit, onDelete }) {
  const [showHistorical, setShowHistorical] = useState(false);

  const filtered = showHistorical
    ? transactions
    : transactions.filter(t => !t.is_historical);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-3 gap-2">
        <h2 className="text-lg font-bold text-gray-800">Recent Transactions</h2>
        <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
          <input
            type="checkbox"
            checked={showHistorical}
            onChange={(e) => setShowHistorical(e.target.checked)}
            className="accent-blue-600"
          />
          Show historical
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center p-6 text-gray-400 bg-white rounded-xl shadow-sm text-sm">
          No transactions yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div
              key={t.id}
              className={`bg-white p-3 rounded-xl shadow-sm flex justify-between items-center gap-2 ${
                t.is_historical ? 'opacity-70 border border-dashed border-gray-300' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.type === 'Income'
                    ? <ArrowUpCircle size={16} className="text-green-600 flex-shrink-0" />
                    : <ArrowDownCircle size={16} className="text-red-500 flex-shrink-0" />
                  }
                  <span className="font-semibold text-gray-700 text-sm truncate">
                    {t.subcategory || t.category}
                  </span>
                  {t.is_historical && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 bg-gray-200 text-gray-600">
                      HISTORICAL
                    </span>
                  )}
                  {t.type === 'Expense' && t.bucket && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      t.bucket === 'Essential' ? 'bg-green-100 text-green-700' :
                      t.bucket === 'Discretionary' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {t.bucket}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">
                  {t.category} • {new Date(t.date).toLocaleDateString()}
                  {t.notes && ` • ${t.notes}`}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className={`font-bold text-sm ${t.type === 'Income' ? 'text-green-600' : 'text-gray-800'}`}>
                  {t.type === 'Income' ? '+' : '-'} RF {formatMoney(t.amount_mvr)}
                </div>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onEdit(t)}
                  disabled={t.is_historical}
                  className={`p-2 rounded-lg ${t.is_historical ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                  title={t.is_historical ? 'Historical rows are read-only' : 'Edit'}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
