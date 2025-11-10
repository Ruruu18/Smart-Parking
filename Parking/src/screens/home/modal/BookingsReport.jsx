import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import FiltersBar from '../reporting/FiltersBar';
import ResultsToolbar from '../reporting/ResultsToolbar';

export default function BookingsReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [plateQuery, setPlateQuery] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [advOpen, setAdvOpen] = useState(false);
  const [status, setStatus] = useState('all');
  const [section, setSection] = useState('');
  const [space, setSpace] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');

  // Safely parse details which might be JSON or plain text
  const parseDetails = (details) => {
    if (!details || typeof details !== 'string') return {};
    const s = details.trim();
    if (!s.startsWith('{') || !s.endsWith('}')) return {};
    try { return JSON.parse(s); } catch { return {}; }
  };

  // Helper: download CSV
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
  
  // Export filtered rows as Excel
  const handleExportExcel = async () => {
    try {
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const rows = filtered.map((r) => {
        const d = parseDetails(r.details);
        return {
          Time: new Date(r.created_at).toISOString(),
          User: d.user_name || '',
          Vehicle: `${d.vehicle_make || d.vehicle_type || ''} ${d.vehicle_model || ''}`.trim(),
          Plate: d.vehicle_plate_number || d.plate || '',
          Space: d.space_number || '',
          Section: d.space_section || d.section || '',
          Status: d.status || '',
          Total: Number(d.total_amount || 0),
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      triggerDownload(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `bookings_${Date.now()}.xlsx`);
    } catch (e) {
      alert('Excel export requires the "xlsx" package. Please install it: npm i xlsx');
      console.error(e);
    }
  };

  // Export filtered rows as PDF (basic table)
  const handleExportPdf = async () => {
    try {
      const pdfMod = await import('jspdf');
      const jsPDF = pdfMod.jsPDF || pdfMod.default?.jsPDF;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(12);
      doc.text('Bookings Report', 14, 16);
      const headers = ['Time','User','Vehicle','Plate','Space','Section','Status','Total'];
      let x = 14, y = 26;
      const colW = [45, 35, 45, 25, 20, 25, 25, 20];
      // header
      headers.forEach((h, i) => doc.text(String(h), x + colW.slice(0, i).reduce((a,b)=>a+b,0), y));
      y += 6;
      filtered.slice(0, 500).forEach((r) => {
        const d = parseDetails(r.details);
        const row = [
          new Date(r.created_at).toLocaleString(),
          d.user_name || '',
          `${d.vehicle_make || d.vehicle_type || ''} ${d.vehicle_model || ''}`.trim(),
          d.vehicle_plate_number || d.plate || '',
          d.space_number || '',
          d.space_section || d.section || '',
          d.status || '',
          String(Number(d.total_amount || 0).toFixed(2)),
        ];
        row.forEach((cell, i) => {
          doc.text(String(cell), x + colW.slice(0, i).reduce((a,b)=>a+b,0), y);
        });
        y += 6;
        if (y > 190) { doc.addPage(); y = 20; }
      });
      const blob = doc.output('blob');
      triggerDownload(blob, `bookings_${Date.now()}.pdf`);
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
          .from('user_activities')
          .select('id, type, action, details, created_at, session_id, space_id, user_id')
          .eq('type', 'booking')
          .order('created_at', { ascending: false })
          .limit(500);

        if (start) query = query.gte('created_at', new Date(start).toISOString());
        if (end) query = query.lte('created_at', new Date(end).toISOString());

        const { data, error } = await query;
        if (error) throw error;

        const list = data || [];
        // Debug: high-level stats
        try {
          const missingUser = list.filter(r => !r.user_id).length;
          const missingSession = list.filter(r => !r.session_id).length;
          console.debug('[BookingsReport] totals', {
            total: list.length,
            missingUser,
            missingSession,
          });
        } catch {}

        // Rows without structured JSON
        const needsHydrate = list.filter((r) => Object.keys(parseDetails(r.details)).length === 0);
        // Rows with structured JSON but missing key fields (user, vehicle type, plate, space)
        const needsPatch = list.filter((r) => {
          const d = parseDetails(r.details);
          if (Object.keys(d).length === 0) return false; // handled by needsHydrate
          const missingUser = !d.user_name;
          const missingVehicleType = !(d.vehicle_make || d.vehicle_type);
          const missingPlate = !(d.vehicle_plate_number || d.plate);
          const missingSpace = !(d.space_number && (d.space_section || d.section));
          return missingUser || missingVehicleType || missingPlate || missingSpace;
        });

        if (needsHydrate.length > 0 || needsPatch.length > 0) {
          const base = [...needsHydrate, ...needsPatch];
          const sessionIds = Array.from(new Set(base.map(r => r.session_id).filter(Boolean)));
          let sessions = [];
          if (sessionIds.length > 0) {
            const { data: srows, error: serr } = await supabase
              .from('parking_sessions')
              .select('id, status, total_amount, vehicle_id, space_id, start_time, end_time, created_at, days_booked, daily_rate_snapshot')
              .in('id', sessionIds);
            if (serr) throw serr;
            sessions = srows || [];
          }

          const sessionById = new Map(sessions.map(s => [s.id, s]));
          const vehicleIds = Array.from(new Set(sessions.map(s => s.vehicle_id).filter(Boolean)));
          const spaceIds = Array.from(new Set([
            ...sessions.map(s => s.space_id).filter(Boolean),
            ...base.map(r => r.space_id).filter(Boolean),
          ]));
          const userIds = Array.from(new Set(list.map(r => r.user_id).filter(Boolean)));

          let vehicles = [];
          if (vehicleIds.length > 0) {
            const { data: vrows, error: verr } = await supabase
              .from('vehicles')
              .select('id, vehicle_plate_number, vehicle_model, vehicle_type')
              .in('id', vehicleIds);
            if (verr) throw verr;
            vehicles = vrows || [];
          }
          // RPC fallback for vehicles missing due to RLS
          if (vehicleIds.length > 0) {
            const haveVehicle = new Set((vehicles || []).map(v => v.id));
            const missingVehicleIds = vehicleIds.filter(id => !haveVehicle.has(id));
            if (missingVehicleIds.length > 0) {
              const rpcVehicles = await Promise.all(missingVehicleIds.map(async (vid) => {
                try {
                  const { data, error } = await supabase.rpc('get_vehicle_for_admin', { vehicle_id: vid });
                  if (!error && Array.isArray(data) && data.length > 0) {
                    const row = data[0];
                    return {
                      id: row.id,
                      vehicle_type: row.vehicle_type,
                      vehicle_model: row.vehicle_model,
                      vehicle_plate_number: row.vehicle_plate_number,
                    };
                  }
                } catch {}
                return null;
              }));
              vehicles = [...vehicles, ...rpcVehicles.filter(Boolean)];
            }
          }
          const vehicleById = new Map((vehicles || []).map(v => [v.id, v]));
          // Debug: hydration fetch counts
          try {
            console.debug('[BookingsReport] fetched', {
              sessions: sessions.length,
              vehicles: vehicles.length,
              spaces: spaces.length,
              profiles: profiles.length,
            });
          } catch {}

          let spaces = [];
          if (spaceIds.length > 0) {
            const { data: sprows, error: sperr } = await supabase
              .from('parking_spaces')
              .select('id, space_number, section, daily_rate')
              .in('id', spaceIds);
            if (sperr) throw sperr;
            spaces = sprows || [];
          }
          const spaceById = new Map(spaces.map(s => [s.id, s]));

          let profiles = [];
          if (userIds.length > 0) {
            // Primary: direct select from profiles
            try {
              const res = await supabase
                .from('profiles')
                .select('id, name')
                .in('id', userIds);
              profiles = res.data || [];
            } catch {}
            // RPC fallback for missing profiles (bypass RLS)
            const haveProfile = new Set((profiles || []).map(p => p.id));
            const missingUserIds = userIds.filter(id => !haveProfile.has(id));
            if (missingUserIds.length > 0) {
              const rpcResults = await Promise.all(missingUserIds.map(async (uid) => {
                try {
                  const { data, error } = await supabase.rpc('get_profile_for_admin', { user_id: uid });
                  if (!error && Array.isArray(data) && data.length > 0) {
                    return { id: data[0].id, name: data[0].name };
                  }
                } catch {}
                return null;
              }));
              profiles = [...profiles, ...rpcResults.filter(Boolean)];
            }
          }
          const profileById = new Map((profiles || []).map(p => [p.id, p]));

          const enriched = list.map((r) => {
            const d = parseDetails(r.details);
            const session = r.session_id ? sessionById.get(r.session_id) : undefined;
            const space = (session?.space_id && spaceById.get(session.space_id)) || (r.space_id && spaceById.get(r.space_id));
            const vehicle = session?.vehicle_id ? vehicleById.get(session.vehicle_id) : undefined;
            const profile = r.user_id ? profileById.get(r.user_id) : undefined;

            // prefer snapshot rate from session, fallback to space.daily_rate
            const pricePerDay = Number(
              d.daily_rate_snapshot ?? session?.daily_rate_snapshot ?? space?.daily_rate ?? space?.price_per_day ?? space?.rate ?? space?.price ?? NaN
            );
            // prefer days_booked from session, else derive from timestamps
            let days = session?.days_booked ?? d.days_booked ?? '';
            if (session?.start_time && session?.end_time) {
              try {
                const startTs = new Date(session.start_time).getTime();
                const endTs = new Date(session.end_time).getTime();
                if (!isNaN(startTs) && !isNaN(endTs) && endTs > startTs) {
                  const oneDay = 24 * 60 * 60 * 1000;
                  // Fixed: Use Math.floor to calculate actual calendar days (Nov 9 to Nov 16 = 7 days, not 8)
                  const calc = Math.floor((endTs - startTs) / oneDay);
                  if (!days) days = calc;
                }
              } catch {}
            }
            // derive amount if not present
            const providedTotal = d.total_amount ?? session?.total_amount;
            const derivedTotal = (!providedTotal || providedTotal === '') && !isNaN(pricePerDay) && days
              ? Number(pricePerDay) * Number(days)
              : providedTotal;

            const patch = {
              user_name: d.user_name || profile?.name || '',
              vehicle_make: d.vehicle_make || d.vehicle_type || vehicle?.vehicle_type || '',
              vehicle_model: d.vehicle_model || vehicle?.vehicle_model || '',
              plate: d.plate || vehicle?.vehicle_plate_number || '',
              vehicle_plate_number: d.vehicle_plate_number || vehicle?.vehicle_plate_number || '',
              space_number: d.space_number || space?.space_number || '',
              space_section: d.space_section || d.section || space?.section || '',
              status: d.status || session?.status || '',
              daily_rate_snapshot: d.daily_rate_snapshot ?? session?.daily_rate_snapshot ?? (!isNaN(pricePerDay) ? pricePerDay : ''),
              price_per_day: d.price_per_day ?? (!isNaN(pricePerDay) ? pricePerDay : ''),
              days_booked: d.days_booked ?? session?.days_booked ?? '',
              days: d.booking_days ?? d.days ?? d.day_count ?? days ?? '',
              total_amount: derivedTotal ?? '',
            };

            // If d had content, merge, else use patch only
            const nextDetails = Object.keys(d).length > 0 ? { ...d, ...patch } : patch;
            const out = { ...r, details: JSON.stringify(nextDetails) };
            // Debug: spot-check missing fields after merge
            try {
              const dd = nextDetails;
              if (!dd.user_name || !dd.vehicle_plate_number || !dd.vehicle_make) {
                console.debug('[BookingsReport] incomplete after merge', {
                  id: r.id,
                  hasUserId: !!r.user_id,
                  hasSessionId: !!r.session_id,
                  sessionVehicleId: session?.vehicle_id,
                  userName: dd.user_name,
                  vehicleType: dd.vehicle_make,
                  plate: dd.vehicle_plate_number || dd.plate,
                });
              }
            } catch {}
            return out;
          });

          setRows(enriched);
        } else {
          setRows(list);
        }
      } catch (e) {
        console.error('Bookings fetch error:', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [start, end]);

  const filtered = useMemo(() => {
    let list = rows;
    const q = plateQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const plate = (d.vehicle_plate_number || d.plate || '').toLowerCase();
        return plate.includes(q) || (r.details || '').toLowerCase().includes(q);
      });
    }
    // Advanced filters
    const st = status.toLowerCase();
    if (st !== 'all') {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const s = (d.status || r.action || '').toLowerCase();
        if (st === 'booked') return s.includes('book');
        if (st === 'checked_in') return s.includes('checked in') || s.includes('check-in') || s === 'check in';
        if (st === 'checked_out') return s.includes('checked out') || s.includes('check-out') || s === 'check out';
        return s === st;
      });
    }
    const sec = section.trim().toLowerCase();
    if (sec) {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const val = (d.space_section || d.section || '').toLowerCase();
        return val.includes(sec);
      });
    }
    const sp = space.trim().toLowerCase();
    if (sp) {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const val = (d.space_number || '').toString().toLowerCase();
        return val.includes(sp);
      });
    }
    const min = parseFloat(minTotal);
    if (!isNaN(min)) {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const amt = Number(d.total_amount || 0);
        return amt >= min;
      });
    }
    const max = parseFloat(maxTotal);
    if (!isNaN(max)) {
      list = list.filter((r) => {
        const d = parseDetails(r.details);
        const amt = Number(d.total_amount || 0);
        return amt <= max;
      });
    }
    return list;
  }, [rows, plateQuery, status, section, space, minTotal, maxTotal]);

  // TEMP: Debug logging to see available fields from DB to map price/days/amount correctly
  useEffect(() => {
    try {
      const sample = filtered.slice(0, 3).map((r) => ({ id: r.id, created_at: r.created_at, raw: r.details, details: parseDetails(r.details) }));
      if (sample.length) {
        // eslint-disable-next-line no-console
        console.log('[BookingsReport] Sample parsed details JSON:', JSON.stringify(sample, null, 2));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[BookingsReport] Debug logging failed:', e);
    }
  }, [filtered]);

  // Totals for summary cards
  const stats = useMemo(() => {
    const total = filtered.length;
    let revenue = 0;
    let totalDays = 0;
    const plates = new Set();
    const booked = { booked: 0, refund: 0, other: 0 };
    filtered.forEach((r) => {
      const d = parseDetails(r.details);
      const st = (d.status || (r.action || '')).toLowerCase();

      // Only count revenue from paid bookings (completed or checked_in)
      // Exclude "booked" status since they haven't paid yet
      const isPaid = st.includes('completed') || st.includes('checked in') || st.includes('check in') || st.includes('checked_in');
      const isBooked = st.includes('book') && !isPaid;

      if (isPaid) {
        const amt = Number((d.total_amount ?? d.space_rent ?? 0) || 0);
        revenue += isNaN(amt) ? 0 : amt;
        // Try to infer booking days if present; fallback to 1 per record
        const days = Number(d.days ?? d.booking_days ?? d.day_count ?? 1);
        totalDays += isNaN(days) ? 1 : Math.max(0, days);
      }

      const plate = d.vehicle_plate_number || d.plate;
      if (plate) plates.add(plate);

      if (st.includes('refund')) booked.refund += 1;
      else if (isBooked) booked.booked += 1;
      else booked.other += 1;
    });
    return { total, revenue, totalDays, uniquePlates: plates.size, booked };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Summary cards above filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded px-4 py-3 text-sm border bg-blue-900/30 border-blue-700/40 text-blue-100">
          <div className="text-blue-300/80">Total Bookings</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded px-4 py-3 text-sm border bg-emerald-900/30 border-emerald-700/40 text-emerald-100">
          <div className="text-emerald-300/80">Total Rent</div>
          <div className="text-2xl font-semibold">₱{Number(stats.revenue).toFixed(2)}</div>
        </div>
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
            searchPlaceholder="Search by plate (e.g., ABC-123)"
            searchValue={plateQuery}
            onSearchChange={setPlateQuery}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <select
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Status: All</option>
              <option value="booked">Booked</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
            </select>
            <input
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Section (e.g., A, B)"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
            <input
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Space #"
              value={space}
              onChange={(e) => setSpace(e.target.value)}
            />
            <input
              type="number"
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Min Total"
              value={minTotal}
              onChange={(e) => setMinTotal(e.target.value)}
            />
            <input
              type="number"
              className="bg-gray-900/60 border border-gray-700 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 outline-none rounded px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400"
              placeholder="Max Total"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
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
              <th className="text-left p-2">Vehicle</th>
              <th className="text-left p-2">Plate</th>
              <th className="text-left p-2">Space</th>
              <th className="text-right p-2">Price</th>
              <th className="text-right p-2">Days</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const d = parseDetails(r.details);
              const hasStructured = Object.keys(d).length > 0;
              const vehicle = [d.vehicle_make || d.vehicle_type, d.vehicle_model].filter(Boolean).join(' ') || (hasStructured ? '—' : '—');
              const space = d.space_number
                ? `${d.space_number} ${d.space_section ? `( ${d.space_section} )` : ''}`
                : (hasStructured ? '—' : (r.details || '—'));
              return (
                <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/60">
                  <td className="p-2 text-gray-300">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 text-gray-200">{d.user_name || '—'}</td>
                  <td className="p-2 text-gray-200">{vehicle}</td>
                  <td className="p-2 text-gray-200">{d.vehicle_plate_number || d.plate || '—'}</td>
                  <td className="p-2 text-gray-200">{space}</td>
                  <td className="p-2 text-right text-gray-100">{
                    (() => {
                      const price = Number(
                        d.daily_rate_snapshot ?? d.space_rent_per_day ?? d.space_price ?? d.price_per_day ?? d.daily_rate ?? d.rate ?? d.space_rent ?? d.price ?? 0
                      );
                      return price ? `₱${price.toFixed(2)}` : '—';
                    })()
                  }</td>
                  <td className="p-2 text-right text-gray-100">{
                    (() => {
                      const daysRaw = d.days_booked ?? d.booking_days ?? d.days ?? d.day_count;
                      const days = daysRaw !== undefined && daysRaw !== null && daysRaw !== '' ? Number(daysRaw) : NaN;
                      return isNaN(days) ? '—' : days;
                    })()
                  }</td>
                  <td className="p-2">
                    {(() => {
                      const raw = (d.status || r.action || '—');
                      const s = raw.toLowerCase();
                      const norm = s.replace(/[_-]/g, ' ');
                      const isBooked = norm.includes('book');
                      const isCheckedIn = norm.includes('checked in') || norm.includes('check in');
                      const isCheckedOut = norm.includes('checked out') || norm.includes('check out');
                      const cls = isBooked
                        ? 'bg-blue-700/40 text-blue-300'
                        : isCheckedIn
                        ? 'bg-green-700/50 text-green-200'
                        : isCheckedOut
                        ? 'bg-red-700/40 text-red-300'
                        : 'bg-gray-700/40 text-gray-200';
                      return <span className={`px-2 py-1 rounded ${cls}`}>{raw}</span>;
                    })()}
                  </td>
                  <td className="p-2 text-right text-gray-100">₱{Number(d.total_amount ?? d.space_rent ?? 0).toFixed(2)}</td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-400" colSpan="9">No records.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}