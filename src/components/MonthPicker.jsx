import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthPicker({ selectedMonth, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(parseInt(selectedMonth.slice(0, 4)));
  const ref = useRef(null);
  useClickOutside(ref, () => setIsOpen(false));

  useEffect(() => {
    setPickerYear(parseInt(selectedMonth.slice(0, 4)));
  }, [selectedMonth]);

  return (
    <div ref={ref} className="relative w-full">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-sm bg-gray-100 p-2 rounded-lg border-none outline-none text-left flex justify-between items-center"
      >
        <span>
          {MONTH_NAMES[parseInt(selectedMonth.slice(5, 7)) - 1]} {selectedMonth.slice(0, 4)}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="flex justify-between items-center mb-3">
            <button 
              type="button" 
              onClick={() => setPickerYear(y => y - 1)} 
              className="p-1 text-gray-500 hover:bg-gray-100 rounded w-8 h-8 flex items-center justify-center"
            >
              ←
            </button>
            <span className="font-bold text-sm">{pickerYear}</span>
            <button 
              type="button" 
              onClick={() => setPickerYear(y => y + 1)} 
              className="p-1 text-gray-500 hover:bg-gray-100 rounded w-8 h-8 flex items-center justify-center"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((m, i) => {
              const monthVal = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
              const isSelected = selectedMonth === monthVal;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onChange(monthVal); setIsOpen(false); }}
                  className={`p-2 text-sm rounded ${
                    isSelected 
                      ? 'bg-blue-500 text-white' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
