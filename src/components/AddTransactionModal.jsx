
import { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { autoLoanUuidFor, findDadLoan, isBappaExpense, BAPPA_LOAN_THRESHOLD } from '../store/useStore';

export function AddTransactionModal({
  onClose,
  onSave,
  settings,
  initialData,
  prefill, // quick-add shortcut: starting values for a NEW transaction
  getBucketFromMap,
  getSubcategoriesFor,
  getCategories,
  loans,
}) {
  const [type, setType] = useState(initialData?.type || prefill?.type || 'Expense');
  const [category, setCategory] = useState(initialData?.category || prefill?.category || 'Personal');
  const [subcategory, setSubcategory] = useState(initialData?.subcategory || prefill?.subcategory || '');
  const [amount, setAmount] = useState(initialData?.amount_original || prefill?.amount_original || '');
  const [currency, setCurrency] = useState(initialData?.currency || prefill?.currency || 'MVR');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loanUuid, setLoanUuid] = useState(initialData?.loan_uuid || '');

  const isIncome = type === 'Income';
  const allCategories = getCategories();
  let availableCategories = isIncome
    ? ['Income']
    : allCategories.filter(c => c !== 'Income');

  let availableSubcategories = getSubcategoriesFor(category);

  // Editing an OLD transaction whose category or subcategory has since been removed:
  // keep showing its own values so the form isn't blank and nothing gets changed by accident.
  if (initialData && initialData.type === type) {
    if (initialData.category && !availableCategories.includes(initialData.category)) {
      availableCategories = [...availableCategories, initialData.category];
    }
    if (
      initialData.category === category &&
      initialData.subcategory &&
      !availableSubcategories.includes(initialData.subcategory)
    ) {
      availableSubcategories = [...availableSubcategories, initialData.subcategory];
    }
  }

  // If the category/subcategory is unchanged from what was saved, keep the bucket that
  // was saved with the transaction (removed categories would otherwise fall back to
  // "Discretionary" and silently change old data).
  const isUnchangedEntry =
    !!initialData &&
    initialData.type === type &&
    initialData.category === category &&
    initialData.subcategory === subcategory &&
    !!initialData.bucket;

  const derivedBucket = isIncome
    ? 'Income'
    : isUnchangedEntry
    ? initialData.bucket
    : getBucketFromMap(category, subcategory);
  const isLoanRepayment =
    !isIncome && category === 'Personal' && subcategory === 'Loan Repayment';

  // Family > Bappa above the threshold is deducted from the "Dad" loan automatically.
  const amountMvrPreview =
    (parseFloat(amount) || 0) *
    (currency === 'USD' ? (initialData?.exchange_rate_at_time || settings.current_usd_rate || 15.42) : 1);
  const bappaCandidate = isBappaExpense({ type, category, subcategory });
  const bappaOverThreshold = bappaCandidate && amountMvrPreview > BAPPA_LOAN_THRESHOLD;
  const dadLoan = findDadLoan(loans);
  const willDeductFromDad = !!autoLoanUuidFor({ type, category, subcategory }, amountMvrPreview, loans);

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'Income') setCategory('Income');
    else setCategory('Personal');
    setSubcategory('');
    setLoanUuid('');
  };

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setSubcategory('');
    setLoanUuid('');
  };

  const handleSubcategoryChange = (newSub) => {
    setSubcategory(newSub);
    if (!(category === 'Personal' && newSub === 'Loan Repayment')) {
      setLoanUuid('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !subcategory) return;
    if (isLoanRepayment && !loanUuid) {
      alert('Please select which loan this repayment is for.');
      return;
    }

    onSave({
      type,
      category,
      subcategory,
      amount_original: parseFloat(amount),
      currency,
      bucket: derivedBucket,
      notes,
      loan_uuid: isLoanRepayment ? loanUuid : null,
      exchange_rate_at_time: initialData?.exchange_rate_at_time,
    });
  };

  const loanDisplay = loans.map(l => ({
    id: l.uuid,
    label: `${l.name} (RF ${l.total_amount.toFixed(2)})`,
  }));
  const selectedLoanLabel =
    loanDisplay.find(l => String(l.id) === String(loanUuid))?.label || '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{initialData ? 'Edit' : 'Add'} Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeChange('Expense')}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                type === 'Expense' ? 'bg-white text-red-600 shadow' : 'text-gray-500'
              }`}
            >
              <ArrowDownCircle size={14} className="inline mr-1" /> Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('Income')}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                type === 'Income' ? 'bg-white text-green-600 shadow' : 'text-gray-500'
              }`}
            >
              <ArrowUpCircle size={14} className="inline mr-1" /> Income
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount</label>
            <div className="flex gap-2 items-stretch">
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 min-w-0 p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-lg font-bold"
                placeholder="0.00"
              />
              <div className="w-24 flex-shrink-0">
                <CustomSelect
                  value={currency}
                  onChange={setCurrency}
                  options={['MVR', 'USD']}
                  searchable={false}
                  required={true}
                  buttonClassName="font-semibold text-center"
                />
              </div>
            </div>
            {currency === 'USD' && (
              <div className="text-xs text-blue-600 mt-1">
                ≈ RF{' '}
                {(
                  parseFloat(amount || 0) * (settings.current_usd_rate || 15.42)
                ).toFixed(2)}{' '}
                @ {settings.current_usd_rate} MVR/USD
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
            <CustomSelect
              value={category}
              onChange={handleCategoryChange}
              options={availableCategories}
              required={true}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Subcategory</label>
            <CustomSelect
              value={subcategory}
              onChange={handleSubcategoryChange}
              options={availableSubcategories}
              placeholder="-- Select --"
              required={true}
            />
          </div>

          {isLoanRepayment && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Which loan?</label>
              {loans.length === 0 ? (
                <div className="text-xs text-red-500 bg-red-50 p-3 rounded-lg">
                  No loans yet. Add one via the Loans button in the header first.
                </div>
              ) : (
                <CustomSelect
                  value={selectedLoanLabel}
                  onChange={(label) => {
                    const found = loanDisplay.find(l => l.label === label);
                    setLoanUuid(found ? found.id : '');
                  }}
                  options={loanDisplay.map(l => l.label)}
                  placeholder="-- Select loan --"
                  required={true}
                  searchable={false}
                />
              )}
            </div>
          )}

          {type === 'Expense' && subcategory && !isLoanRepayment && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-sm font-semibold ${
                derivedBucket === 'Essential'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : derivedBucket === 'Discretionary'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              <span className="text-xs uppercase opacity-70">Auto Bucket:</span>
              <span>{derivedBucket}</span>
            </div>
          )}

          {bappaOverThreshold && (
            willDeductFromDad ? (
              <div className="p-3 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
                This will also be deducted from the loan <strong>{dadLoan?.name}</strong> (no separate repayment is recorded).
              </div>
            ) : (
              <div className="p-3 rounded-lg text-xs bg-amber-50 text-amber-700 border border-amber-200">
                No loan named "Dad" was found, so this will be saved as a normal expense. Add a loan called Dad (Loans button) to have amounts above RF {BAPPA_LOAN_THRESHOLD} deducted from it.
              </div>
            )
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200"
              placeholder="e.g., Lunch with team"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition"
          >
            {initialData ? 'Update Transaction' : 'Save Transaction'}
          </button>
        </form>
      </div>
    </div>
  );
}

