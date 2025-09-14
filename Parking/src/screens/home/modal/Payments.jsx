import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import FiltersBar from '../reporting/FiltersBar';
import ResultsToolbar from '../reporting/ResultsToolbar';

const STATUS = ['all', 'completed', 'pending', 'failed'];
const METHODS = ['all', 'gcash', 'card', 'cash'];

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [query, setQuery] = useState('');
  const [advOpen, setAdvOpen] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Helper: trigger download
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    try {
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const rows = filtered.map((r) => ({
        Time: new Date(r.created_at).toISOString(),
        User: r.user_name || '',
        Method: (r.payment_method || '').toLowerCase(),
        Status: r.status || '',
        Amount: Number(r.amount || 0),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payments');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      triggerDownload(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `payments_${Date.now()}.xlsx`);
    } catch (e) {
      alert('Excel export requires the "xlsx" package. Please install it: npm i xlsx');
      console.error(e);
    }
  };

  const handleExportPdf = async () => {
    try {
      const pdfMod = await import('jspdf');
      const jsPDF = pdfMod.jsPDF || pdfMod.default?.jsPDF;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(12);
      doc.text('Payments Report', 14, 16);
      const headers = ['Time','User','Method','Status','Amount'];
      let x = 14, y = 26;
      const colW = [55, 40, 30, 30, 25];
      headers.forEach((h, i) => doc.text(String(h), x + colW.slice(0, i).reduce((a,b)=>a+b,0), y));
      y += 6;
      filtered.slice(0, 500).forEach((r) => {
        const row = [
          new Date(r.created_at).toLocaleString(),
          r.user_name || '',
          (r.payment_method || '').toLowerCase(),
          r.status || '',
          String(Number(r.amount || 0).toFixed(2)),
        ];
        row.forEach((cell, i) => doc.text(String(cell), x + colW.slice(0, i).reduce((a,b)=>a+b,0), y));
        y += 6;
        if (y > 190) { doc.addPage(); y = 20; }
      });
      const blob = doc.output('blob');
      triggerDownload(blob, `payments_${Date.now()}.pdf`);
    } catch (e) {
      alert('PDF export requires the "jspdf" package. Please install it: npm i jspdf');
      console.error(e);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('payments')
          .select('id, amount, payment_method, status, created_at, session_id')
          .order('created_at', { ascending: false })
          .limit(500);

        if (start) query = query.gte('created_at', new Date(start).toISOString());
        if (end) query = query.lte('created_at', new Date(end).toISOString());

        const { data, error } = await query;
        if (error) throw error;

        const pays = data || [];
        // Hydrate user_name using session_id -> user_activities (booking) -> profiles
        const sessionIds = Array.from(new Set(pays.map(p => p.session_id).filter(Boolean)));
        let userActs = [];
        if (sessionIds.length > 0) {
          const { data: acts, error: aerr } = await supabase
            .from('user_activities')
            .select('session_id, user_id')
            .eq('type', 'booking')
            .in('session_id', sessionIds);
          if (!aerr && acts) userActs = acts;
        }
        const sessionToUser = new Map(userActs.map(a => [a.session_id, a.user_id]));
        const userIds = Array.from(new Set(userActs.map(a => a.user_id).filter(Boolean)));
        let profiles = [];
        if (userIds.length > 0) {
          try {
            const res = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', userIds);
            profiles = res.data || [];
          } catch {}
          const have = new Set((profiles || []).map(p => p.id));
          const missing = userIds.filter(id => !have.has(id));
          if (missing.length > 0) {
            const rpc = await Promise.all(missing.map(async (uid) => {
              try {
                const { data, error } = await supabase.rpc('get_profile_for_admin', { user_id: uid });
                if (!error && Array.isArray(data) && data.length > 0) {
                  return { id: data[0].id, name: data[0].name };
                }
              } catch {}
              return null;
            }));
            profiles = [...profiles, ...rpc.filter(Boolean)];
          }
        }
        const profileById = new Map((profiles || []).map(p => [p.id, p]));

        const hydrated = pays.map(p => ({
          ...p,
          user_name: (() => {
            const uid = p.session_id ? sessionToUser.get(p.session_id) : null;
            return uid ? (profileById.get(uid)?.name || '') : '';
          })(),
        }));

        setRows(hydrated);
      } catch (e) {
        console.error('Payments fetch error:', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [start, end]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== 'all') list = list.filter((r) => r.status === status);
    if (method !== 'all') list = list.filter((r) => (r.payment_method || '').toLowerCase() === method);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.payment_method || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q)
      );
    }
    const min = parseFloat(minAmount);
    if (!isNaN(min)) {
      list = list.filter((r) => (parseFloat(r.amount ?? 0) || 0) >= min);
    }
    const max = parseFloat(maxAmount);
    if (!isNaN(max)) {
      list = list.filter((r) => (parseFloat(r.amount ?? 0) || 0) <= max);
    }
    return list;
  }, [rows, status, method, query, minAmount, maxAmount]);

  const totals = useMemo(() => {
    const grand = filtered.reduce((a, r) => a + (parseFloat(r.amount ?? 0) || 0), 0);
    const byMethod = filtered.reduce((acc, r) => {
      const m = (r.payment_method || 'unknown').toLowerCase();
      acc[m] = (acc[m] || 0) + (parseFloat(r.amount ?? 0) || 0);
      return acc;
    }, {});
    return { grand, byMethod };
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Totals above filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-gray-900/60 border border-gray-800 rounded px-4 py-3 text-sm text-gray-100">
          <div className="text-gray-400">Grand Total</div>
          <div className="text-2xl font-semibold">₱{totals.grand.toFixed(2)}</div>
        </div>
        {Object.entries(totals.byMethod).map(([m, amt]) => (
          <div key={m} className="bg-gray-900/60 border border-gray-800 rounded px-4 py-3 text-sm text-gray-100">
            <div className="text-gray-400 capitalize">{m}</div>
            <div className="text-xl font-semibold">₱{amt.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <FiltersBar
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        rightSlot={
          <ResultsToolbar
            count={filtered.length}
            loading={loading}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
            searchPlaceholder="Search user, method or status"
            searchValue={query}
            onSearchChange={setQuery}
            extraActions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdvOpen(v => !v)}
                  className="px-3 py-2 text-sm rounded border border-gray-700 text-gray-300 hover:bg-gray-800/60"
                >
                  {advOpen ? 'Hide Advanced' : 'Advanced Filters'}
                </button>
              </div>
            }
          />
        }
      />

      {/* Advanced filters panel */}
      {advOpen && (
        <div className="border border-gray-800 rounded p-3 bg-gray-900/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <select
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS.map((s) => <option key={s} value={s}>{`Status: ${s}`}</option>)}
            </select>
            <select
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => <option key={m} value={m}>{`Method: ${m}`}</option>)}
            </select>
            <input
              type="number"
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Min Amount"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
            <input
              type="number"
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Max Amount"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="overflow-auto border border-gray-800 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800 text-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Method</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/60">
                <td className="p-2 text-gray-300">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2 text-gray-200">{r.user_name || '—'}</td>
                <td className="p-2 text-gray-200 capitalize">{(r.payment_method || '—').toLowerCase()}</td>
                <td className="p-2">
                  {(() => {
                    const s = (r.status || '').toLowerCase();
                    const cls = s === 'completed'
                      ? 'bg-green-700/40 text-green-300'
                      : s === 'failed'
                      ? 'bg-red-700/40 text-red-300'
                      : 'bg-yellow-700/40 text-yellow-300';
                    return <span className={`px-2 py-1 rounded ${cls}`}>{r.status}</span>;
                  })()}
                </td>
                <td className="p-2 text-right text-gray-100">₱{Number(r.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-400" colSpan="5">No records.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}