import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function DatePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('days'); // 'days' | 'months' | 'years'
  
  // The currently selected date (for highlighting)
  const d = value ? new Date(value) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const [viewMonth, setViewMonth] = useState({
    year: validDate.getFullYear(),
    month: validDate.getMonth(),
  });

  const ref = useRef(null);
  useClickOutside(ref, () => setIsOpen(false));

  // Sync viewMonth when the value changes externally
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed)) {
        setViewMonth({ year: parsed.getFullYear(), month: parsed.getMonth() });
      }
    }
  }, [value]);

  // Reset the view to days when opening
  useEffect(() => {
    if (isOpen) setView('days');
  }, [isOpen]);

  const displayValue = value
    ? validDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Select date';

  // --- Calendar Grid Calculation ---
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const handleSelectDay = (day) => {
    const m = String(viewMonth.month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewMonth.year}-${m}-${dd}`);
    setIsOpen(false);
  };

  const goPrevMonth = () => {
    setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
  };

  const goNextMonth = () => {
    setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // --- Year Grid Calculation ---
  // Show a block of 12 years (e.g. 2015 - 2026)
  const yearBlockStart = Math.floor(viewMonth.year / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-left flex justify-between items-center hover:border-gray-300 transition-colors"
      >
        <span className={`text-sm truncate ${!value ? 'text-gray-400' : 'text-gray-700'}`}>
          {displayValue}
        </span>
        <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 p-3">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            {view === 'days' ? (
              <button type="button" onClick={goPrevMonth} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <div className="w-8" /> // Spacer
            )}

            <button
              type="button"
              onClick={() => setView(view === 'days' ? 'months' : 'years')}
              className="font-bold text-sm text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
            >
              {view === 'days' ? `${MONTH_NAMES_LONG[viewMonth.month]} ${viewMonth.year}` : 
               view === 'months' ? `${viewMonth.year}` : 
               `${yearBlockStart} - ${yearBlockStart + 11}`}
            </button>

            {view === 'days' ? (
              <button type="button" onClick={goNextMonth} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center">
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="w-8" /> // Spacer
            )}
          </div>

          {/* Views */}
          {view === 'days' && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-[10px] text-gray-400 text-center font-semibold">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                  if (day === null) return <div key={idx}></div>;
                  const m = String(viewMonth.month + 1).padStart(2, '0');
                  const dd = String(day).padStart(2, '0');
                  const dateStr = `${viewMonth.year}-${m}-${dd}`;
                  const isSelected = dateStr === (value || '');
                  const isToday = dateStr === todayStr;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`aspect-square text-xs rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-md'
                          : isToday
                            ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-100'
                            : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {MONTH_NAMES_SHORT.map((month, idx) => {
                const isSelected = viewMonth.month === idx;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setViewMonth(prev => ({ ...prev, month: idx }));
                      setView('days');
                    }}
                    className={`py-3 text-sm rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {years.map(year => {
                const isSelected = viewMonth.year === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewMonth(prev => ({ ...prev, year }));
                      setView('months'); // Jump to months after picking year
                    }}
                    className={`py-3 text-sm rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer (only on day view) */}
          {view === 'days' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { onChange(''); setIsOpen(false); }}
                className="flex-1 text-xs text-gray-500 py-2 hover:bg-gray-50 rounded-lg transition-colors font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => { onChange(todayStr); setIsOpen(false); }}
                className="flex-1 text-xs text-blue-600 py-2 hover:bg-blue-50 rounded-lg transition-colors font-bold"
              >
                Today
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
