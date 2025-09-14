import React from 'react';

export default function ResultsToolbar({
  count = 0,
  loading = false,
  extraActions,
  onExportPdf,
  onExportExcel,
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-900/40 border border-gray-800 rounded px-2 py-2">
      {/* Left: filters + count */}
      <div className="flex items-center gap-2">
        {extraActions}
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-800/70 border border-gray-700 text-gray-300">
          <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-400'}`} />
          {loading ? 'Loading…' : `${count} records`}
        </span>
      </div>

      {/* Center: search */}
      {typeof searchValue !== 'undefined' && typeof onSearchChange === 'function' && (
        <div className="relative flex-1 min-w-[140px] max-w-[420px] mx-1">
          <input
            className="w-full bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded pl-8 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 transition-colors"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
      )}

      {/* Right: export actions */}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onExportPdf}
          disabled={loading}
          className={`px-3 py-2 text-sm rounded border inline-flex items-center gap-2 transition-colors ${
            loading
              ? 'border-orange-700/40 text-orange-300/70 cursor-not-allowed'
              : 'border-orange-400/60 text-orange-300 hover:bg-orange-500/10'
          }`}
          title="Export PDF"
        >
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span>Export PDF</span>
        </button>
        <button
          onClick={onExportExcel}
          disabled={loading}
          className={`px-3 py-2 text-sm rounded border inline-flex items-center gap-2 transition-colors ${
            loading
              ? 'border-green-700/40 text-green-300/70 cursor-not-allowed'
              : 'border-green-400/60 text-green-300 hover:bg-green-500/10'
          }`}
          title="Export Excel"
        >
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span>Export Excel</span>
        </button>
      </div>
    </div>
  );
}
