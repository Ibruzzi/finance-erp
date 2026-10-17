import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DatePicker } from './DatePicker';
import { CustomSelect } from './CustomSelect';
import { formatMoney } from '../utils/format';

const TYPE_OPTIONS = ['All', 'Expense', 'Income'];

function firstOfCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CategoryBlock({ title, tone, data }) {
  const [expanded, setExpanded] = useState({});
  const { categories, grandTotal } = data;

  if (categories.length === 0) {
    return (
      <div className="text-center p-6 text-gray-400 bg-white rounded-xl shadow-sm text-sm">
        No {title.toLowerCase()} in this range.
      </div>
    );
  }

  const toneText = tone === 'income' ? 'text-green-700' : 'text-gray-800';
  const toneBg = tone === 'income' ? 'bg-green-50' : 'bg-blue-50';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
        <span className={`text-base font-bold ${toneText}`}>
          RF {formatMoney(grandTotal)}
        </span>
      </div>

      {categories.map(c => {
        const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0;
        const isOpen = !!expanded[c.category];
        return (
          <div key={c.category} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(e => ({ ...e, [c.category]: !e[c.category] }))}
              className="w-full flex justify-between items-center gap-2 p-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                }
                <span className="font-semibold text-gray-700 truncate">{c.category}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${toneBg} ${toneText}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <span className={`font-bold flex-shrink-0 ${toneText}`}>
                RF {formatMoney(c.total)}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {c.subcategories.map(s => {
                  const subPct = c.total > 0 ? (s.total / c.total) * 100 : 0;
                  return (
                    <div key={s.subcategory} className="flex justify-between items-center px-4 py-2 bg-gray-50/40">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-700 truncate">{s.subcategory}</div>
                        <div className="text-[10px] text-gray-400">
                          {s.count} txn • {subPct.toFixed(1)}% of {c.category}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold flex-shrink-0 ${toneText}`}>
                        RF {formatMoney(s.total)}
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
  );
}

export function RangeReport({ allCategories }) {
  const { getTransactionsInRange, aggregateRange } = useStore();

  const [from, setFrom] = useState(firstOfCurrentMonth());
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState('All');
  const [category, setCategory] = useState('');
  const [includeHistorical, setIncludeHistorical] = useState(true);

  const rows = useMemo(() => {
    return getTransactionsInRange(from, to, {
      includeHistorical,
      type,
      category: category || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, type, category, includeHistorical]);

  const { expenses, incomes } = useMemo(() => aggregateRange(rows), [rows, aggregateRange]);

  const historicalCount = rows.filter(r => r.is_historical).length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Range Report</h2>

      <div className="bg-white rounded-xl shadow-sm p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">From</label>
            <DatePicker value={from} onChange={setFrom} />
          </div>
          <div className="min-w-0">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">To</label>
            <DatePicker value={to} onChange={setTo} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Type</label>
            <CustomSelect
              value={type}
              onChange={setType}
              options={TYPE_OPTIONS}
              searchable={false}
              required={true}
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Category (optional)</label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              options={['', ...allCategories]}
              placeholder="All categories"
              required={false}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
          <input
            type="checkbox"
            checked={includeHistorical}
            onChange={(e) => setIncludeHistorical(e.target.checked)}
            className="accent-blue-600"
          />
          Include historical data
          {historicalCount > 0 && (
            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-semibold">
              {historicalCount} historical row{historicalCount === 1 ? '' : 's'}
            </span>
          )}
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Expense</div>
            <div className="text-base font-bold text-gray-800">
              RF {formatMoney(expenses.grandTotal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Income</div>
            <div className="text-base font-bold text-green-600">
              RF {formatMoney(incomes.grandTotal)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Net</div>
            <div className={`text-base font-bold ${
              incomes.grandTotal - expenses.grandTotal >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              RF {formatMoney(incomes.grandTotal - expenses.grandTotal)}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 mt-2 text-center">
          {rows.length} transactions in range
        </div>
      </div>

      {(type === 'All' || type === 'Expense') && (
        <CategoryBlock title="Expenses" tone="expense" data={expenses} />
      )}

      {(type === 'All' || type === 'Income') && (
        <CategoryBlock title="Incomes" tone="income" data={incomes} />
      )}
    </div>
  );
}
