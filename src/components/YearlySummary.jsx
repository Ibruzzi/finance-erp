import React, { useMemo, useState, Fragment } from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { exportMasterSheet } from '../utils/exportExcel';

// Sub-component to render each table (Expenses or Incomes)
function SummaryTable({ title, tone, data, type }) {
  const { getSubcategoryYearlySummary } = useStore();
  const { years, rows, grandTotalByYear, grandTotal } = data;
  const [expanded, setExpanded] = useState({});

  if (years.length === 0) return null;

  const toggleExpand = (category) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const isIncome = tone === 'income';
  const headerBg = isIncome ? 'bg-green-50' : 'bg-gray-50';
  const textColor = isIncome ? 'text-green-700' : 'text-gray-900';
  const borderCol = isIncome ? 'border-green-200' : 'border-gray-200';

  return (
    <div className="mb-8">
      <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${isIncome ? 'text-green-700' : 'text-gray-700'}`}>
        {title}
      </h3>
      
      <div className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${isIncome ? 'border-green-500' : 'border-blue-500'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={headerBg}>
              <tr>
                <th className="sticky left-0 bg-inherit text-left px-3 py-2 font-semibold text-gray-700 z-10 min-w-[140px]">
                  Category
                </th>
                {years.map(y => (
                  <th key={y} className="px-3 py-2 font-semibold text-gray-700 text-right whitespace-nowrap">
                    {y}
                  </th>
                ))}
                <th className={`px-3 py-2 font-semibold text-right whitespace-nowrap ${textColor} bg-black/5`}>
                  Avg
                </th>
                <th className={`px-3 py-2 font-semibold text-right whitespace-nowrap ${textColor} bg-black/5`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isOpen = !!expanded[r.category];
                const subcategories = isOpen ? getSubcategoryYearlySummary(r.category, years, type) : [];

                return (
                  <Fragment key={r.category}>
                    {/* --- Main Category Row --- */}
                    <tr 
                      onClick={() => toggleExpand(r.category)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-gray-700 z-10 truncate max-w-[160px]">
                        <div className="flex items-center gap-1">
                          {isOpen 
                            ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> 
                            : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                          }
                          <span className="truncate">{r.category}</span>
                        </div>
                      </td>
                      {years.map(y => (
                        <td key={y} className={`px-3 py-2 text-right whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-gray-700'}`}>
                          {r.byYear[y] > 0 ? r.byYear[y].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap bg-black/5">
                        {r.avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold whitespace-nowrap bg-black/5 ${isIncome ? 'text-green-700' : 'text-gray-900'}`}>
                        {r.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* --- Subcategory Rows --- */}
                    {isOpen && subcategories.map(sub => (
                      <tr key={`${r.category}-${sub.subcategory}`} className="bg-gray-50/40 border-t border-gray-50">
                        <td className="sticky left-0 bg-gray-50/90 px-3 py-1.5 text-xs text-gray-500 z-10 truncate max-w-[160px] pl-8">
                          {sub.subcategory || '(No subcategory)'}
                        </td>
                        {years.map(y => (
                          <td key={y} className="px-3 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">
                            {sub.byYear[y] > 0 ? sub.byYear[y].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right text-xs text-gray-400 whitespace-nowrap bg-black/5">
                          {sub.avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-semibold text-xs whitespace-nowrap bg-black/5 ${isIncome ? 'text-green-600/70' : 'text-gray-600'}`}>
                          {sub.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}

              {/* --- Grand Total Row --- */}
              <tr className={`border-t-2 ${borderCol} bg-gray-50 font-bold`}>
                <td className="sticky left-0 bg-gray-50 px-3 py-2 text-gray-900 z-10">
                  All {title}
                </td>
                {years.map(y => (
                  <td key={y} className={`px-3 py-2 text-right whitespace-nowrap ${isIncome ? 'text-green-700' : 'text-gray-900'}`}>
                    {grandTotalByYear[y] > 0 ? grandTotalByYear[y].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap bg-black/5">
                  —
                </td>
                <td className={`px-3 py-2 text-right whitespace-nowrap bg-black/5 ${isIncome ? 'text-green-700' : 'text-gray-900'}`}>
                  {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function YearlySummary() {
  const { getYearlySummary } = useStore();
  
  const expenseData = useMemo(() => getYearlySummary('Expense'), [getYearlySummary]);
  const incomeData = useMemo(() => getYearlySummary('Income'), [getYearlySummary]);

  const hasExpenses = expenseData.years.length > 0;
  const hasIncome = incomeData.years.length > 0;

  if (!hasExpenses && !hasIncome) {
    return (
      <div className="text-center p-10 text-gray-400 bg-white rounded-xl shadow-sm text-sm">
        No data yet. Add or import transactions to see the yearly summary.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-lg font-bold text-gray-800">Yearly Summary</h2>
        <button
          onClick={() => exportMasterSheet(expenseData, incomeData)}
          className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-1 flex-shrink-0"
        >
          <Download size={14} /> Export
        </button>
      </div>

      <p className="text-xs text-gray-500 -mt-2">
        Includes historical & live transactions. Tap a category to see subcategory breakdown.
      </p>

      {hasExpenses && (
        <SummaryTable 
          title="Expenses" 
          tone="expense" 
          data={expenseData} 
          type="Expense" 
        />
      )}

      {hasIncome && (
        <SummaryTable 
          title="Incomes" 
          tone="income" 
          data={incomeData} 
          type="Income" 
        />
      )}

      <p className="text-[11px] text-gray-400 text-center pb-4">
        Tip: swipe tables horizontally on mobile. The first column stays pinned.
      </p>
    </div>
  );
}
