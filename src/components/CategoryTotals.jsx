import { formatMoney } from '../utils/format';

export function CategoryTotals({ totals, grandTotal }) {
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
            return (
              <div key={item.category} className="bg-white rounded-xl shadow-sm p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-blue-50 opacity-60" style={{ width: `${percentage}%` }}></div>
                <div className="relative flex justify-between items-center">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-700 truncate">{item.category}</div>
                    <div className="text-xs text-gray-400">{percentage.toFixed(1)}% of total</div>
                  </div>
                  <div className="font-bold text-gray-800 flex-shrink-0">RF {formatMoney(item.amount)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
