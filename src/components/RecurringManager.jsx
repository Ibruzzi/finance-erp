import { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CustomSelect } from './CustomSelect';
import { monthKeyOf } from '../utils/recurring';

const EMPTY = {
  name: '', type: 'Expense', category: 'Personal', subcategory: '',
  amount: '', currency: 'MVR', day: '1', notes: '', loanUuid: '',
};

// Settings -> Recurring tab: create, edit, pause and delete recurring items.
// Changes save immediately (they are suggestions only; nothing is added automatically).
export function RecurringManager({ rules, onChange, getCategories, getSubcategoriesFor, loans }) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isIncome = form.type === 'Income';
  const categories = isIncome ? ['Income'] : getCategories().filter((c) => c !== 'Income');
  const subcategories = getSubcategoriesFor(form.category);
  const isLoanRepayment = !isIncome && form.category === 'Personal' && form.subcategory === 'Loan Repayment';

  const loanOptions = (loans || []).map((l) => ({ id: l.uuid, label: `${l.name} (RF ${l.total_amount.toFixed(2)})` }));
  const loanLabel = loanOptions.find((l) => l.id === form.loanUuid)?.label || '';

  const reset = () => { setForm(EMPTY); setEditingId(null); setError(''); };

  const save = () => {
    const amount = parseFloat(form.amount);
    const day = parseInt(form.day, 10);
    if (!form.name.trim()) return setError('Give it a name (e.g. Rent).');
    if (!form.subcategory) return setError('Choose a subcategory.');
    if (!(amount > 0)) return setError('Enter an amount above 0.');
    if (!(day >= 1 && day <= 31)) return setError('Day of month must be 1 to 31.');
    if (isLoanRepayment && !form.loanUuid) return setError('Choose which loan this repays.');

    const now = new Date();
    const fields = {
      name: form.name.trim(), type: form.type, category: form.category, subcategory: form.subcategory,
      amount, currency: form.currency, day, notes: form.notes.trim(),
      loan_uuid: isLoanRepayment ? form.loanUuid : null,
    };

    if (editingId) {
      onChange(rules.map((r) => (r.id === editingId ? { ...r, ...fields } : r)));
    } else {
      onChange([
        ...rules,
        { id: uuidv4(), ...fields, active: true, startMonth: monthKeyOf(now.getFullYear(), now.getMonth()), handled: {} },
      ]);
    }
    reset();
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setError('');
    setForm({
      name: r.name, type: r.type, category: r.category, subcategory: r.subcategory,
      amount: String(r.amount), currency: r.currency, day: String(r.day),
      notes: r.notes || '', loanUuid: r.loan_uuid || '',
    });
  };

  const remove = (r) => {
    if (window.confirm(`Delete "${r.name}"? Transactions already added stay.`)) {
      onChange(rules.filter((x) => x.id !== r.id));
      if (editingId === r.id) reset();
    }
  };

  const toggleActive = (r) => onChange(rules.map((x) => (x.id === r.id ? { ...x, active: x.active === false } : x)));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Items that repeat every month. Nothing is added by itself: on the due day they appear on the
        Dashboard and you tap Add or Skip.
      </p>

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className={`p-3 rounded-lg border ${r.active === false ? 'bg-gray-50 opacity-60' : 'bg-white'} border-gray-200`}>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    {r.type === 'Income' ? 'Income' : `${r.category} > ${r.subcategory}`} · day {r.day} · {r.amount} {r.currency}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(r)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                <input type="checkbox" checked={r.active !== false} onChange={() => toggleActive(r)} className="accent-blue-600" />
                Active
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="text-sm font-bold">{editingId ? 'Edit recurring item' : 'New recurring item'}</div>

        <input
          type="text"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Name, e.g. Rent"
          className="w-full p-2.5 bg-white rounded-lg border border-gray-200 text-sm"
        />

        <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
          {['Expense', 'Income'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ type: t, category: t === 'Income' ? 'Income' : 'Personal', subcategory: '', loanUuid: '' })}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold ${form.type === t ? 'bg-white shadow' : 'text-gray-500'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
            <CustomSelect value={form.category} onChange={(c) => set({ category: c, subcategory: '', loanUuid: '' })} options={categories} required={true} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Subcategory</label>
            <CustomSelect value={form.subcategory} onChange={(s) => set({ subcategory: s, loanUuid: '' })} options={subcategories} placeholder="-- Select --" required={true} />
          </div>
        </div>

        {isLoanRepayment && (
          loanOptions.length === 0 ? (
            <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">Add a loan first (Loans button).</div>
          ) : (
            <CustomSelect
              value={loanLabel}
              onChange={(label) => set({ loanUuid: loanOptions.find((l) => l.label === label)?.id || '' })}
              options={loanOptions.map((l) => l.label)}
              placeholder="-- Which loan? --"
              required={true}
              searchable={false}
            />
          )
        )}

        <div className="flex gap-2 items-stretch">
          <input
            type="number" step="0.01" inputMode="decimal"
            value={form.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="Amount"
            className="flex-1 min-w-0 p-2.5 bg-white rounded-lg border border-gray-200 text-sm font-bold"
          />
          <div className="w-24 flex-shrink-0">
            <CustomSelect value={form.currency} onChange={(c) => set({ currency: c })} options={['MVR', 'USD']} searchable={false} required={true} buttonClassName="font-semibold text-center" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Day of month</label>
          <input
            type="number" min="1" max="31" inputMode="numeric"
            value={form.day}
            onChange={(e) => set({ day: e.target.value })}
            className="w-20 p-2 bg-white rounded-lg border border-gray-200 text-sm text-center"
          />
          <span className="text-[11px] text-gray-400">short months use their last day</span>
        </div>

        <input
          type="text"
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Notes (optional)"
          className="w-full p-2.5 bg-white rounded-lg border border-gray-200 text-sm"
        />

        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}

        <div className="flex gap-2">
          <button onClick={save} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700">
            {editingId ? 'Save changes' : 'Add recurring item'}
          </button>
          {editingId && (
            <button onClick={reset} className="px-4 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
