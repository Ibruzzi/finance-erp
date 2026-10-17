import { formatMoney } from '../utils/format';

export function BucketBalances({ buckets }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Bucket Balances</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-green-500 min-w-0">
          <div className="text-xs text-gray-500 font-semibold">ESSENTIAL</div>
          <div className="text-lg font-bold text-gray-800 truncate">RF {formatMoney(buckets.Essential.remaining)}</div>
          <div className="text-xs text-gray-400 truncate">spent RF {formatMoney(buckets.Essential.spent)}</div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-blue-500 min-w-0">
          <div className="text-xs text-gray-500 font-semibold">DISCRETIONARY</div>
          <div className="text-lg font-bold text-gray-800 truncate">RF {formatMoney(buckets.Discretionary.remaining)}</div>
          <div className="text-xs text-gray-400 truncate">spent RF {formatMoney(buckets.Discretionary.spent)}</div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-purple-500 min-w-0">
          <div className="text-xs text-gray-500 font-semibold">FINANCIAL</div>
          <div className="text-lg font-bold text-gray-800 truncate">RF {formatMoney(buckets.Financial.remaining)}</div>
          <div className="text-xs text-gray-400 truncate">spent RF {formatMoney(buckets.Financial.spent)}</div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-l-4 border-yellow-500 min-w-0">
          <div className="text-xs text-gray-500 font-semibold">SAVINGS</div>
          <div className="text-lg font-bold text-gray-800 truncate">RF {formatMoney(buckets.Savings.remaining)}</div>
          <div className="text-xs text-gray-400">allocated</div>
        </div>
      </div>
    </div>
  );
}
