import { Wallet } from 'lucide-react';
import { formatMoney } from '../utils/format';

export function TotalDebtCard({ totalDebt, loans, onManage }) {
  if (loans.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border-l-4 border-red-500">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center text-gray-500 mb-1">
            <Wallet size={14} className="mr-1" />
            <span className="text-xs font-semibold uppercase">Total Debt Remaining</span>
          </div>
          <div className="text-xl font-bold text-gray-800 truncate">RF {formatMoney(totalDebt)}</div>
          <div className="text-xs text-gray-400">across {loans.length} loan{loans.length !== 1 ? 's' : ''}</div>
        </div>
        <button 
          onClick={onManage}
          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-semibold text-gray-700 flex-shrink-0"
        >
          Manage
        </button>
      </div>
    </div>
  );
}
