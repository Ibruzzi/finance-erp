import { useState } from 'react';
import { DatePicker } from './DatePicker';

export function LoanForm({ initialData, onCancel, onSave }) {
  const [name, setName] = useState(initialData?.name || '');
  const [totalAmount, setTotalAmount] = useState(initialData?.total_amount || '');
  const [startDate, setStartDate] = useState(
    initialData?.start_date || new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !totalAmount) return;
    onSave({
      name,
      total_amount: parseFloat(totalAmount),
      start_date: startDate,
      notes
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-bold text-gray-700">{initialData ? 'Edit Loan' : 'New Loan'}</h3>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Loan Name</label>
        <input 
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200"
          placeholder="e.g., Bank Loan - BML"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Total Amount (MVR)</label>
        <input 
          type="number"
          step="0.01"
          required
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-lg font-bold"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Date</label>
        <DatePicker value={startDate} onChange={setStartDate} />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Notes (Optional)</label>
        <input 
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200"
          placeholder="Anything to remember"
        />
      </div>

      <div className="flex gap-2">
        <button 
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
        >
          Cancel
        </button>
        <button 
          type="submit"
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          {initialData ? 'Save Changes' : 'Add Loan'}
        </button>
      </div>
    </form>
  );
}
