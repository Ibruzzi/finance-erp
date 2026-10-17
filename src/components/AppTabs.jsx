export function AppTabs({ active, onChange, tabs }) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-[64px] z-20 sm:top-[68px]">
      <div className="max-w-4xl mx-auto flex overflow-x-auto">
        {tabs.map(tab => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                isActive
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
