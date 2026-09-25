import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTickets } from '../../hooks/useTickets.jsx';
import useDebounced from '../../hooks/useDebounced.js';
import { getReport } from '../../lib/ticketClient.js';
import {
  dateStrToEnd,
  dateStrToStart,
  fmtDayLongLabel,
  fmtTime,
  lagosDateStr,
  money,
  num,
} from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import { EmptyState, Spinner } from '../../components/ui.jsx';
import PrintModal from '../../components/PrintModal.jsx';
import { downloadCSV } from '../../lib/csv.js';

/** Merge report byStaff rows with the profile list so every attendant appears. */
function staffRowsFor(rep, profiles) {
  const map = new Map();
  (profiles || []).forEach((p) =>
    map.set(p.id, { staff_id: p.id, staff_name: p.fullName, tickets: 0, revenue: 0 })
  );
  (rep?.byStaff || []).forEach((r) => {
    const ex = map.get(r.staff_id);
    if (ex) {
      ex.tickets += r.tickets;
      ex.revenue += r.revenue;
    } else {
      map.set(r.staff_id, r);
    }
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.tickets - a.tickets);
}

export default function AdminBalancing() {
  const { user } = useAuth();
  const { profiles, version } = useTickets();
  const debouncedVersion = useDebounced(version, 600);

  const [dateStr, setDateStr] = useState(() => lagosDateStr());
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayStr = lagosDateStr();

  useEffect(() => {
    document.title = 'Daily Balancing — Newheroes Toll';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReport({ from: dateStrToStart(dateStr), to: dateStrToEnd(dateStr), staffId: null, user })
      .then((r) => !cancelled && setRep(r))
      .catch(() => !cancelled && setRep(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [dateStr, debouncedVersion, user?.id]);

  const rows = useMemo(() => staffRowsFor(rep, profiles), [rep, profiles]);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const totalTickets = rows.reduce((s, r) => s + r.tickets, 0);

  const exportCsv = () => {
    downloadCSV(`newheroes-balancing-${dateStr}.csv`, [
      ['#', 'Staff', 'Tickets', 'Amount (NGN)'],
      ...rows.map((r, i) => [i + 1, r.staff_name, r.tickets, r.revenue]),
      [],
      ['', 'TOTAL', totalTickets, total],
    ]);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Daily Balancing</h1>
        <p className="text-xs font-semibold text-slate-400">
          Per-attendant collections for end-of-day cash reconciliation
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="date"
            value={dateStr}
            max={todayStr}
            onChange={(e) => e.target.value && setDateStr(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-bold text-slate-700 shadow-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={() => setDateStr(todayStr)}
          className={`rounded-xl px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-sm ring-1 transition ${
            dateStr === todayStr
              ? 'bg-brand-50 text-brand-600 ring-brand-200'
              : 'bg-white text-slate-500 ring-slate-200'
          }`}
        >
          Today
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-14 shadow-sm">
          <Spinner className="h-7 w-7 text-brand-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-extrabold text-slate-700">Collections</div>
              <div className="text-[11px] font-semibold text-slate-400">{fmtDayLongLabel(dateStr)}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={totalTickets === 0}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600 hover:bg-slate-200 disabled:opacity-40"
              >
                <Icon name="download" className="h-3.5 w-3.5" /> CSV
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                disabled={totalTickets === 0}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <Icon name="printer" className="h-3.5 w-3.5" /> Sheet
              </button>
            </div>
          </div>

          {totalTickets === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Icon name="banknote" className="h-10 w-10" />}
                title="No collections on this day"
                sub="Nothing to balance — pick another date."
              />
            </div>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2 font-extrabold">Staff</th>
                    <th className="px-2 py-2 text-right font-extrabold">Tickets</th>
                    <th className="px-4 py-2 text-right font-extrabold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.staff_id}>
                      <td className="px-4 py-2.5 font-bold text-slate-700">{r.staff_name}</td>
                      <td className="tabular px-2 py-2.5 text-right text-slate-600">{num(r.tickets)}</td>
                      <td className="tabular px-4 py-2.5 text-right font-extrabold text-slate-800">
                        {money(r.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-50/70 text-brand-800">
                    <td className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider">
                      Total expected
                    </td>
                    <td className="tabular px-2 py-3 text-right font-extrabold">{num(totalTickets)}</td>
                    <td className="tabular px-4 py-3 text-right text-base font-extrabold">{money(total)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-slate-400">
                Each attendant should remit the amount shown beside their name.
              </div>
            </>
          )}
        </div>
      )}

      {/* Printable balancing sheet */}
      {sheetOpen && (
        <PrintModal onClose={() => setSheetOpen(false)} widthClass="max-w-md">
          <div className="no-print flex items-center justify-between px-4 pb-1 pt-3">
            <span className="text-sm font-extrabold text-slate-700">Balancing sheet</span>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold uppercase text-slate-500"
            >
              Close
            </button>
          </div>
          <div className="bg-white p-6 text-slate-800">
            <div className="mb-4 border-b-2 border-slate-800 pb-3 text-center">
              <div className="text-lg font-extrabold tracking-widest">NEWHEROES GROUP</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">
                DUTSE MODERN MARKET — OLAJUMOKE ARCADE SHOPPING ARCADE DUTSE ABUJA
              </div>
              <div className="mt-2 text-sm font-extrabold">DAILY BALANCING SHEET</div>
              <div className="text-xs font-semibold text-slate-500">{fmtDayLongLabel(dateStr)}</div>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 font-extrabold">#</th>
                  <th className="py-1.5 font-extrabold">Staff</th>
                  <th className="py-1.5 text-right font-extrabold">Tickets</th>
                  <th className="py-1.5 text-right font-extrabold">Amount (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.staff_id}>
                    <td className="py-2 text-slate-400">{i + 1}</td>
                    <td className="py-2 font-bold">{r.staff_name}</td>
                    <td className="tabular py-2 text-right">{r.tickets}</td>
                    <td className="tabular py-2 text-right font-extrabold">
                      {r.revenue.toLocaleString('en-NG')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-extrabold">
                  <td colSpan="2" className="py-2 text-xs uppercase tracking-wider">
                    Total
                  </td>
                  <td className="tabular py-2 text-right">{totalTickets}</td>
                  <td className="tabular py-2 text-right">{total.toLocaleString('en-NG')}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-10 grid grid-cols-3 gap-4 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {['Collected by', 'Verified by', 'Manager'].map((s) => (
                <div key={s}>
                  <div className="mx-auto border-t border-slate-400 pt-1">{s}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center text-[10px] text-slate-400">
              Printed {fmtTime(new Date().toISOString())} · giving quality SINCE 2006
            </div>
          </div>
          <div className="no-print px-4 pb-4 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-xs font-extrabold uppercase tracking-widest text-white shadow-sm hover:bg-brand-700"
            >
              <Icon name="printer" className="h-4 w-4" /> Print sheet
            </button>
          </div>
        </PrintModal>
      )}
    </div>
  );
}
