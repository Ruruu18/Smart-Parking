import React from 'react';

export default function FiltersBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  start,
  end,
  onStartChange,
  onEndChange,
  rightSlot,
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Left: date range and optional search */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="min-w-[150px] bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 transition-colors"
          value={start}
          onChange={(e) => onStartChange?.(e.target.value)}
        />
        <input
          type="date"
          className="min-w-[150px] bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 transition-colors"
          value={end}
          onChange={(e) => onEndChange?.(e.target.value)}
        />
        {typeof searchValue !== 'undefined' && typeof onSearchChange === 'function' && (
          <input
            className="hidden sm:block w-[220px] bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 transition-colors"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        )}
      </div>

      {/* Right: injected slot */}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
      </div>
    </div>
  );
}
