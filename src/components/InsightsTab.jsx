import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, TrendingDown, Minus, Flame, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatMoney } from '../utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Should the "Budget Pulse" card count historical (imported) rows?
// false = same rule as the rest of the app: historical rows never touch live bucket math.
// Set to true if you want Budget Pulse to also work for past months.
const BUDGET_PULSE_INCLUDES_HISTORICAL = false;

// The 2018-2022 rows are whole-year lumps (notes like "2018 aggregates") parked on
// one date. They can't be split into months, so monthly insights skip them.
// They still count in Yearly Summary.
function isYearlyLump(t) {
  return typeof t.notes === 'string' && /aggregates?\s*$/i.test(t.notes.trim());
}

const amt = (t) => Number(t.amount_mvr) || 0;

function shiftMonth(monthString, delta) {
  const [y, m] = monthString.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthString) {
  const [y, m] = monthString.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function shortMonthLabel(monthString) {
  const [, m] = monthString.split('-').map(Number);
  return MONTH_NAMES[m - 1];
}

function StatRow({ label, current, previous, tone }) {
  const delta = current - previous;
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.005;

  const toneColor = tone === 'income' ? 'text-green-600' : tone === 'expense' ? 'text-red-600' : 'text-gray-800';

  let DeltaIcon = Minus;
  let deltaColor = 'text-gray-400';
  if (!isFlat) {
    if (tone === 'income') {
      DeltaIcon = isUp ? TrendingUp : TrendingDown;
      deltaColor = isUp ? 'text-green-600' : 'text-red-500';
    } else if (tone === 'expense') {
      DeltaIcon = isUp ? TrendingUp : TrendingDown;
      deltaColor = isUp ? 'text-red-500' : 'text-green-600';
    } else {
      DeltaIcon = isUp ? TrendingUp : TrendingDown;
      deltaColor = isUp ? 'text-green-600' : 'text-red-500';
    }
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600 font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold ${toneColor}`}>{formatMoney(current)}</span>
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${deltaColor} min-w-[72px] justify-end`}>
          <DeltaIcon size={12} />
          {isFlat ? (
            <span>—</span>
          ) : (
            <span>
              {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : formatMoney(delta)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, tone = 'default' }) {
  const borderTone =
    tone === 'warning' ? 'border-orange-400' :
    tone === 'success' ? 'border-green-500' :
    tone === 'info' ? 'border-blue-500' :
    'border-gray-200';

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${borderTone} p-4 mb-4`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-gray-500 flex-shrink-0" />}
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function InsightsTab({ selectedMonth }) {
  const { transactions, settings, calculateZakat } = useStore();

  // Everything that can be placed in a specific month: live + historical (monthly detail).
  const monthlyTx = useMemo(
    () => transactions.filter(t => t.deleted !== true && !isYearlyLump(t)),
    [transactions]
  );

  // What Budget Pulse is allowed to see.
  const budgetTx = useMemo(
    () => (BUDGET_PULSE_INCLUDES_HISTORICAL ? monthlyTx : monthlyTx.filter(t => !t.is_historical)),
    [monthlyTx]
  );

  const thisMonth = selectedMonth;
  const lastMonth = shiftMonth(selectedMonth, -1);
  const threeMonthsAgo = shiftMonth(selectedMonth, -2);

  const monthAgg = useMemo(() => {
    const build = (monthStr) => {
      const rows = monthlyTx.filter(t => t.date.startsWith(monthStr));
      const income = rows
        .filter(t => t.type === 'Income')
        .reduce((s, t) => s + amt(t), 0);
      const expense = rows
        .filter(t => t.type === 'Expense')
        .reduce((s, t) => s + amt(t), 0);
      return { income, expense, net: income - expense, count: rows.length };
    };
    return {
      this: build(thisMonth),
      last: build(lastMonth),
    };
  }, [monthlyTx, thisMonth, lastMonth]);

  const topSubs = useMemo(() => {
    const map = {};
    monthlyTx
      .filter(t => t.date.startsWith(thisMonth) && t.type === 'Expense')
      .forEach(t => {
        const key = `${t.category} › ${t.subcategory || '(none)'}`;
        if (!map[key]) map[key] = { key, category: t.category, subcategory: t.subcategory || '(none)', total: 0, count: 0 };
        map[key].total += amt(t);
        map[key].count += 1;
      });
    const arr = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
    const grand = arr.reduce((s, r) => s + r.total, 0);
    return { rows: arr, grand };
  }, [monthlyTx, thisMonth]);

  const trend = useMemo(() => {
    const months = [threeMonthsAgo, lastMonth, thisMonth];
    return months.map(m => {
      const rows = monthlyTx.filter(t => t.date.startsWith(m));
      const income = rows.filter(t => t.type === 'Income').reduce((s, t) => s + amt(t), 0);
      const expense = rows.filter(t => t.type === 'Expense').reduce((s, t) => s + amt(t), 0);
      return { month: m, income, expense };
    });
  }, [monthlyTx, threeMonthsAgo, lastMonth, thisMonth]);

  const trendMax = Math.max(
    1,
    ...trend.map(t => Math.max(t.income, t.expense))
  );

  const zakatYTD = useMemo(() => {
    const year = thisMonth.slice(0, 4);
    let totalDue = 0;
    let totalPaid = 0;
    let eligibleMonths = 0;
    for (let i = 1; i <= 12; i++) {
      const m = `${year}-${String(i).padStart(2, '0')}`;
      const z = calculateZakat(m);
      if (z.eligible) {
        eligibleMonths += 1;
        totalDue += z.baseZakat;
        totalPaid += z.zakatPaidThisMonth;
      }
    }
    return { totalDue, totalPaid, outstanding: Math.max(0, totalDue - totalPaid), eligibleMonths };
  }, [thisMonth, calculateZakat]);

  const bucketPulse = useMemo(() => {
    const rows = budgetTx.filter(t => t.date.startsWith(thisMonth));
    const income = rows.filter(t => t.type === 'Income').reduce((s, t) => s + amt(t), 0);

    const alloc = {
      Essential: income * ((settings.essential_pct || 0) / 100),
      Discretionary: income * ((settings.discretionary_pct || 0) / 100),
      Financial: income * ((settings.financial_pct || 0) / 100),
      Savings: income * ((settings.savings_pct || 0) / 100),
    };
    const spent = {
      Essential: rows.filter(t => t.type === 'Expense' && t.bucket === 'Essential').reduce((s, t) => s + amt(t), 0),
      Discretionary: rows.filter(t => t.type === 'Expense' && t.bucket === 'Discretionary').reduce((s, t) => s + amt(t), 0),
      Financial: rows.filter(t => t.type === 'Expense' && t.bucket === 'Financial/Obligatory').reduce((s, t) => s + amt(t), 0),
      Savings: 0,
    };
    const build = (name) => {
      const a = alloc[name];
      const sp = spent[name];
      const pct = a > 0 ? (sp / a) * 100 : 0;
      return { name, allocated: a, spent: sp, pct, over: sp > a && a > 0 };
    };
    return [build('Essential'), build('Discretionary'), build('Financial'), build('Savings')];
  }, [budgetTx, thisMonth, settings]);

  const sourceCounts = useMemo(() => {
    const rows = monthlyTx.filter(t => t.date.startsWith(thisMonth));
    const historical = rows.filter(t => t.is_historical).length;
    return { historical, live: rows.length - historical };
  }, [monthlyTx, thisMonth]);

  // Is the selected period one of the yearly-lump years (no monthly detail exists)?
  const onlyYearlyLumps = useMemo(
    () => transactions.some(
      t => t.deleted !== true && isYearlyLump(t) &&
        (t.date.startsWith(thisMonth.slice(0, 4)))
    ),
    [transactions, thisMonth]
  );

  const hasAnyData = monthAgg.this.count > 0 || monthAgg.last.count > 0;

  if (!hasAnyData) {
    return (
      <div className="text-center p-10 text-gray-400 bg-white rounded-xl shadow-sm text-sm">
        {onlyYearlyLumps
          ? `${thisMonth.slice(0, 4)} was recorded as yearly totals only, so there is no month-by-month detail to analyse. See the Yearly Summary instead.`
          : `No transaction data for ${monthLabel(thisMonth)} or ${monthLabel(lastMonth)}. Add transactions or switch months to see insights.`}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <SectionCard title={`Month vs Month`} icon={Calendar} tone="info">
        <div className="text-xs text-gray-400 mb-2">
          {monthLabel(lastMonth)} → {monthLabel(thisMonth)}
        </div>
        <StatRow
          label="Income"
          current={monthAgg.this.income}
          previous={monthAgg.last.income}
          tone="income"
        />
        <StatRow
          label="Expenses"
          current={monthAgg.this.expense}
          previous={monthAgg.last.expense}
          tone="expense"
        />
        <StatRow
          label="Net"
          current={monthAgg.this.net}
          previous={monthAgg.last.net}
          tone="net"
        />
        <div className="text-[11px] text-gray-400 mt-2">
          This month: {monthAgg.this.count} txn • Last month: {monthAgg.last.count} txn
        </div>
        {sourceCounts.historical > 0 && (
          <div className="text-[11px] text-gray-400 mt-0.5">
            This month includes {sourceCounts.historical} imported historical and {sourceCounts.live} live entries.
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Top Subcategories — ${monthLabel(thisMonth)}`} icon={Flame} tone="warning">
        {topSubs.rows.length === 0 ? (
          <div className="text-xs text-gray-400 py-2">No expenses logged this month.</div>
        ) : (
          <div className="space-y-2">
            {topSubs.rows.map((r, i) => {
              const pct = topSubs.grand > 0 ? (r.total / topSubs.grand) * 100 : 0;
              return (
                <div key={r.key} className="relative">
                  <div
                    className="absolute top-0 left-0 h-full bg-orange-50 rounded-md"
                    style={{ width: `${pct}%` }}
                  ></div>
                  <div className="relative flex justify-between items-center gap-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-700 truncate">
                          {r.subcategory}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {r.category} • {r.count} txn
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-gray-800">{formatMoney(r.total)}</div>
                      <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="3-Month Trend" icon={TrendingUp} tone="info">
        <div className="flex items-end justify-between gap-2 h-40 pt-2">
          {trend.map(t => {
            const incH = (t.income / trendMax) * 100;
            const expH = (t.expense / trendMax) * 100;
            const isCurrent = t.month === thisMonth;
            return (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="flex items-end gap-0.5 h-32 w-full justify-center">
                  <div
                    className={`w-1/2 max-w-[24px] rounded-t transition-all ${
                      isCurrent ? 'bg-green-500' : 'bg-green-300'
                    }`}
                    style={{ height: `${Math.max(2, incH)}%` }}
                    title={`Income ${formatMoney(t.income)}`}
                  ></div>
                  <div
                    className={`w-1/2 max-w-[24px] rounded-t transition-all ${
                      isCurrent ? 'bg-red-500' : 'bg-red-300'
                    }`}
                    style={{ height: `${Math.max(2, expH)}%` }}
                    title={`Expense ${formatMoney(t.expense)}`}
                  ></div>
                </div>
                <div className={`text-[11px] font-semibold ${isCurrent ? 'text-gray-800' : 'text-gray-500'}`}>
                  {shortMonthLabel(t.month)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-500"></span> Income
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500"></span> Expense
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={`Zakat YTD — ${thisMonth.slice(0, 4)}`}
        icon={CheckCircle}
        tone={zakatYTD.outstanding > 0 ? 'warning' : 'success'}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Due</div>
            <div className="text-sm font-bold text-gray-800 truncate">
              {formatMoney(zakatYTD.totalDue)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Paid</div>
            <div className="text-sm font-bold text-green-600 truncate">
              {formatMoney(zakatYTD.totalPaid)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Outstanding</div>
            <div className={`text-sm font-bold truncate ${
              zakatYTD.outstanding > 0 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {formatMoney(zakatYTD.outstanding)}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 mt-3 text-center">
          Eligible months this year: {zakatYTD.eligibleMonths} / 12
        </div>
      </SectionCard>

      <SectionCard title={`Budget Pulse — ${monthLabel(thisMonth)}`} icon={AlertTriangle}>
        <div className="space-y-3">
          {bucketPulse.map(b => {
            const pctCapped = Math.min(100, b.pct);
            const barColor = b.allocated === 0
              ? 'bg-gray-300'
              : b.over
                ? 'bg-red-500'
                : b.pct > 80
                  ? 'bg-orange-400'
                  : 'bg-green-500';
            return (
              <div key={b.name}>
                <div className="flex justify-between items-baseline mb-1 gap-2">
                  <span className="text-xs font-semibold text-gray-600 truncate">{b.name}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ${
                    b.over ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {formatMoney(b.spent)}
                    <span className="text-gray-400 font-normal"> / {formatMoney(b.allocated)}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${barColor}`}
                    style={{ width: `${pctCapped}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>{b.pct.toFixed(0)}% used</span>
                  {b.over && <span className="text-red-500 font-semibold">OVER BUDGET</span>}
                </div>
              </div>
            );
          })}
        </div>
        {bucketPulse.every(b => b.allocated === 0) && (
          <div className="text-[11px] text-gray-400 mt-3 text-center">
            {BUDGET_PULSE_INCLUDES_HISTORICAL
              ? 'No income logged this month — allocations show as RF 0.00.'
              : 'No live income logged this month — allocations show as RF 0.00. (Imported historical entries are not counted in budget math.)'}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

