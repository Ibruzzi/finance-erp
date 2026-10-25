import { Wallet, ChevronRight } from 'lucide-react';
import { formatMoney } from '../utils/format';

// Compact card (shares a row with the Zakat card). Tap anywhere to manage loans.
export function TotalDebtCard({ totalDebt, loans, onManage }) {
  if (loans.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onManage}
      className="w-full h-full bg-white p-3 rounded-xl shadow-sm border-l-4 border-red-500 text-left active:scale-[0.98] transition"
    >
      <div className="flex items-center justify-between gap-1 text-gray-500 mb-1">
        <div className="flex items-center min-w-0">
          <Wallet size={14} className="mr-1 flex-shrink-0" />
          <span className="text-xs font-semibold truncate">Debt remaining</span>
        </div>
        <ChevronRight size={16} className="flex-shrink-0" />
      </div>
      <div className="text-lg font-bold text-gray-800 truncate">RF {formatMoney(totalDebt)}</div>
      <div className="text-[11px] text-gray-400">
        across {loans.length} loan{loans.length !== 1 ? 's' : ''}
      </div>
    </button>
  );
}
