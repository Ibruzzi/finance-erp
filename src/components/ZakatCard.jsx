import { useState } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { formatMoney } from '../utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ZakatCard({ zakat, selectedMonth, onMarkPaid }) {
  const monthName = MONTH_NAMES[parseInt(selectedMonth.slice(5, 7)) - 1];
  const year = selectedMonth.slice(0, 4);

  const defaultExpanded = (zakat.eligible && !zakat.fullyPaid) || zakat.noBalance;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const stateClasses = !zakat.eligible 
    ? 'bg-gradient-to-r from-gray-400 to-gray-500' 
    : zakat.fullyPaid 
      ? 'bg-gradient-to-r from-green-600 to-green-500' 
      : 'bg-gradient-to-r from-orange-500 to-orange-400';

  const headline = zakat.noBalance
    ? 'No balance entered'
    : !zakat.eligible 
    ? 'Ineligible' 
    : zakat.fullyPaid 
      ? `Paid ✓ (RF ${formatMoney(zakat.baseZakat)})` 
      : `RF ${formatMoney(zakat.zakatDue)}`;

  return (
    <div className={`rounded-xl shadow-md mb-6 text-white ${stateClasses}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center min-w-0">
            <AlertCircle size={18} className="mr-2 flex-shrink-0" />
            <span className="text-sm font-semibold truncate">
              Zakat {monthName} {year}
            </span>
          </div>
          <ChevronDown 
            size={18} 
            className={`flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
        
        <div className="text-2xl font-bold truncate">{headline}</div>
      </button>

      {zakat.eligible && zakat.zakatDue > 0 && (
        <div className="px-4 pb-3 -mt-1 flex justify-end">
          <button 
            onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1"
          >
            <Check size={12} /> Mark Paid
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="px-4 pb-4 text-xs opacity-90 space-y-0.5">
          {zakat.noBalance ? (
            <div>
              Enter your bank balance for {monthName} {year} in Settings → Zakat Inputs to see the zakat for this month.
            </div>
          ) : !zakat.eligible ? (
            <div>
              Bank before Zakat (RF {formatMoney(zakat.bankBalanceBeforeZakat)}) does not exceed Nisab (RF {formatMoney(zakat.nisab)}) or last year's {monthName} balance (RF {formatMoney(zakat.lastYearBalance)})
            </div>
          ) : (
            <>
              <div>Bank: RF {formatMoney(zakat.bankBalanceBeforeZakat)} − Debt: RF {formatMoney(zakat.debtPayable)} + Receivable: RF {formatMoney(zakat.debtReceivable)}</div>
              <div>Zakatable: RF {formatMoney(zakat.zakatableAmount)} × 2.5% = <strong>RF {formatMoney(zakat.baseZakat)}</strong></div>
              {zakat.zakatPaidThisMonth > 0 && (
                <div>Paid this month: − RF {formatMoney(zakat.zakatPaidThisMonth)} {zakat.fullyPaid ? '(fully paid ✓)' : `(remaining: RF ${formatMoney(zakat.zakatDue)})`}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
