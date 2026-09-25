import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTickets } from '../../hooks/useTickets.jsx';
import useDebounced from '../../hooks/useDebounced.js';
import { getReport } from '../../lib/ticketClient.js';
import { getExpenseSummary } from '../../lib/expenseClient.js';
import {
  dayKeyOf,
  fmtDayLabel,
  fmtTime,
  lagosDateStr,
  lagosDayStart,
  lagosMonthStart,
  lagosWeekStart,
  lagosYearStart,
  money,
  num,
} from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import VehicleIcon from '../../components/VehicleIcon.jsx';
import { Avatar, EmptyState, Spinner, StatCard, SyncDot } from '../../components/ui.jsx';
import { downloadCSV } from '../../lib/csv.js';
import { buildReportModel } from '../../lib/exporters/reportModel.js';
import { generateReportPDF } from '../../lib/exporters/pdf.js';
import { generateReportDOCX } from '../../lib/exporters/docx.js';
import { cx, pct } from '../../lib/util.js';

const PERIODS = [
  { id: 'today', label: 'Today', range: () => [lagosDayStart(0), lagosDayStart(1)] },
  { id: 'week', label: 'Week', range: () => [lagosWeekStart(), lagosDayStart(1)] },
  { id: 'month', label: 'Month', range: () => [lagosMonthStart(), lagosDayStart(1)] },
  { id: 'year', label: 'Year', range: () => [lagosYearStart(), lagosDayStart(1)] },
];

/** Merge server byStaff rows with the profile list so everyone appears. */
function staffRowsFor(rep, profiles) {
  const map = new Map();
  (profiles || []).forEach((p) =>
    map.set(p.id, { staff_id: p.id, staff_name: p.fullName, tickets: 0, revenue: 0, role: p.role })
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

export default function AdminReports() {
  const { user } = useAuth();
  const { tickets, profiles, pendingCount, version, online } = useTickets();
  const debouncedVersion = useDebounced(version, 600);

  const [tab, setTab] = useState('summary');
  const [period, setPeriod] = useState('today');
  const [staffId, setStaffId] = useState('all');
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exportNote, setExportNote] = useState('');

  useEffect(() => {
    document.title = 'Detailed Reports — Newheroes Toll';
  }, []);

  const periodRange = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period) || PERIODS[0];
    return p.range();
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.id === period)?.label;
  const staffLabel = staffId === 'all' ? 'All staff' : profiles.find((p) => p.id === staffId)?.fullName || 'Staff';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReport({
      from: periodRange[0],
      to: periodRange[1],
      staffId: staffId === 'all' ? null : staffId,
      user,
    })
      .then((r) => !cancelled && setRep(r))
      .catch(() => !cancelled && setRep(null))
      .finally(() => !cancelled && setLoading(false));

    const fromStr = dayKeyOf(periodRange[0].toISOString());
    const toStr = dayKeyOf(periodRange[1].toISOString());
    getExpenseSummary(fromStr, toStr)
      .then((s) => !cancelled && setExpenses(s))
      .catch(() => !cancelled && setExpenses(null));

    return () => {
      cancelled = true;
    };
  }, [period, staffId, debouncedVersion, user?.id, periodRange]);

  const totalRevenue = rep?.totalRevenue || 0;
  const totalTickets = rep?.totalTickets || 0;
  const avgTicket = totalTickets ? Math.round(totalRevenue / totalTickets) : 0;
  const staffRows = staffRowsFor(rep, profiles);
  const maxVehicleRevenue = Math.max(1, ...(rep?.byVehicle || []).map((v) => v.revenue));
  const maxDayRevenue = Math.max(1, ...(rep?.byDay || []).map((d) => d.revenue));

  const nameOf = (id) => profiles.find((p) => p.id === id)?.fullName;

  const doExport = async (kind) => {
    if (!rep) return;
    setExporting(kind);
    setExportNote('');
    try {
      const model = buildReportModel({
        title: 'Revenue Report',
        subtitle: 'Car Park Analytics — NEWHEROES GROUP - Dutse Modern Market Car Park Monitoring System',
        periodLabel: `${periodLabel} · ${staffLabel}`,
        rep,
        staffRows,
        expenseSummary: expenses,
        transactions: tickets
          .filter((t) => {
            const ts = Date.parse(t.issuedAt);
            return (
              ts >= +periodRange[0] &&
              ts < +periodRange[1] &&
              (staffId === 'all' || t.issuedBy === staffId)
            );
          })
          .slice(0, 25)
          .map((t) => ({
            time: `${dayKeyOf(t.issuedAt)} ${fmtTime(t.issuedAt)}`,
            vehicleLabel: t.vehicleLabel,
            totalAmount: t.totalAmount,
            staffName: nameOf(t.issuedBy) || t.issuedByName || 'Unknown',
            nightParking: t.nightParking,
          })),
        generatedBy: user.fullName,
      });
      if (kind === 'pdf') await generateReportPDF(model);
      else if (kind === 'word') await generateReportDOCX(model);
      setExportNote(`${kind === 'pdf' ? 'PDF' : 'Word'} report downloaded`);
    } catch (e) {
      setExportNote(`Export failed: ${e?.message || 'unknown error'}`);
    } finally {
      setExporting(null);
      setTimeout(() => setExportNote(''), 4000);
    }
  };

  const exportCsv = () => {
    if (!rep) return;
    const rows = [
      ['Vehicle', 'Tickets', 'Revenue (NGN)'],
      ...rep.byVehicle.map((v) => [v.label, v.tickets, v.revenue]),
      [],
      ['TOTAL', rep.totalTickets, rep.totalRevenue],
      [],
      ['Staff', 'Tickets', 'Revenue (NGN)'],
      ...staffRows.map((s) => [s.staff_name, s.tickets, s.revenue]),
      [],
      ['Expense Category', 'Entries', 'Amount (NGN)'],
      ...(expenses?.byCategory || []).map((c) => [c.category, c.count, c.amount]),
    ];
    downloadCSV(`newheroes-report-${period}-${lagosDateStr()}.csv`, rows);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Detailed Reports</h1>
          <p className="text-xs font-semibold text-slate-400">
            Filter by period & staff, then export as PDF, Word or CSV
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => doExport('pdf')}
            disabled={exporting || loading || !rep || !totalTickets}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Spinner className="h-4 w-4" /> : <Icon name="fileText" className="h-4 w-4" />} PDF
          </button>
          <button
            type="button"
            onClick={() => doExport('word')}
            disabled={exporting || loading || !rep || !totalTickets}
            className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {exporting === 'word' ? <Spinner className="h-4 w-4" /> : <Icon name="fileText" className="h-4 w-4" />} Word
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || !rep}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {exportNote && (
        <div className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white">{exportNote}</div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {pendingCount} ticket(s) issued offline are still syncing — figures update automatically.
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 sm:max-w-xs">
        {[
          { id: 'summary', label: 'Summary', icon: 'chart' },
          { id: 'ledger', label: 'Ticket Ledger', icon: 'receipt' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold uppercase tracking-wide transition',
              tab === t.id ? 'bg-white text-brand-600 shadow' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon name={t.icon} className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ============================== SUMMARY ============================== */}
      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grow grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={cx(
                    'rounded-lg py-2 text-[11px] font-extrabold uppercase tracking-wide transition',
                    period === p.id ? 'bg-white text-brand-600 shadow' : 'text-slate-500'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 shadow-sm outline-none focus:border-brand-400"
              aria-label="Filter by staff"
            >
              <option value="all">All staff</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl bg-white py-14 shadow-sm">
              <Spinner className="h-7 w-7 text-brand-500" />
            </div>
          ) : !rep || totalTickets === 0 ? (
            <EmptyState
              icon={<Icon name="chart" className="h-10 w-10" />}
              title={`No tickets recorded for this ${periodLabel.toLowerCase()}`}
              sub="Issue tickets from the Operations area, or adjust the filters above."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  icon={<Icon name="banknote" className="h-5 w-5" />}
                  tone="green"
                  label="Total Revenue"
                  value={money(totalRevenue)}
                  sub={`${num(totalTickets)} vehicles entered`}
                />
                <StatCard
                  icon={<Icon name="ticket" className="h-5 w-5" />}
                  tone="pink"
                  label="Avg / Vehicle"
                  value={money(avgTicket)}
                  sub={`Top: ${rep.byVehicle[0]?.label || '—'}`}
                />
                {rep.nightTickets > 0 && (
                  <StatCard
                    icon={<Icon name="moon" className="h-5 w-5" />}
                    tone="sky"
                    label="Night Parking"
                    value={num(rep.nightTickets)}
                    sub={`${money(rep.nightRevenue)} surcharged`}
                  />
                )}
                {expenses && expenses.total > 0 && (
                  <StatCard
                    icon={<Icon name="wallet" className="h-5 w-5" />}
                    tone="red"
                    label="Expenses"
                    value={money(expenses.total)}
                    sub={`Net: ${money(totalRevenue - expenses.total)}`}
                  />
                )}
              </div>

              {/* Revenue by day */}
              {rep.byDay && rep.byDay.length > 1 && (
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                  <div className="mb-3 text-sm font-extrabold text-slate-700">Revenue by day</div>
                  <div className="no-scrollbar flex h-28 items-end gap-1 overflow-x-auto">
                    {rep.byDay.map((d) => (
                      <div
                        key={d.day}
                        className="flex min-w-[8px] flex-1 flex-col items-center gap-1"
                        title={`${fmtDayLabel(d.day)} — ${money(d.revenue)} (${num(d.tickets)} tickets)`}
                      >
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-brand-600 to-rose-400"
                          style={{ height: `${Math.max(4, (d.revenue / maxDayRevenue) * 82)}px` }}
                        />
                        <span className="h-3 text-[9px] font-bold leading-none text-slate-400">
                          {Number(d.day.slice(8))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle breakdown */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700">
                  Vehicle breakdown
                </div>
                <ul className="divide-y divide-slate-100">
                  {rep.byVehicle.map((v) => (
                    <li key={v.code} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                          <VehicleIcon code={v.code} className="h-5 w-9" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-bold text-slate-700">{v.label}</span>
                            <span className="tabular shrink-0 text-sm font-extrabold text-slate-800">
                              {money(v.revenue)}
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-rose-400"
                              style={{ width: `${Math.max(3, (v.revenue / maxVehicleRevenue) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">
                            {num(v.tickets)} entries · {pct(v.revenue, totalRevenue)}% of revenue
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Staff performance */}
              {staffId === 'all' && (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                  <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700">
                    Staff performance
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {staffRows
                      .filter((s) => s.tickets > 0)
                      .map((s, i) => (
                        <li key={s.staff_id} className="flex items-center gap-3 px-4 py-3">
                          <span className="tabular w-5 text-center text-xs font-extrabold text-slate-300">
                            {i + 1}
                          </span>
                          <Avatar name={s.staff_name} className="h-9 w-9 text-xs" />
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="truncate text-sm font-bold text-slate-700">{s.staff_name}</div>
                            <div className="text-[11px] font-semibold text-slate-400">
                              {num(s.tickets)} tickets · {pct(s.revenue, totalRevenue)}% share
                            </div>
                          </div>
                          <span className="tabular shrink-0 text-sm font-extrabold text-slate-800">
                            {money(s.revenue)}
                          </span>
                        </li>
                      ))}
                    {staffRows.every((s) => s.tickets === 0) && (
                      <li className="px-4 py-6 text-center text-xs font-semibold text-slate-400">
                        No staff activity in this period
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Expenses detail */}
              {expenses && expenses.total > 0 && (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                  <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700">
                    Expenses ({periodLabel.toLowerCase()})
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(expenses.byCategory || []).map((c) => (
                      <li key={c.category} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="font-bold text-slate-600">{c.category}</span>
                        <span className="tabular font-extrabold text-red-500">{money(c.amount)}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between bg-red-50/50 px-4 py-2.5 text-sm">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-red-600">Total</span>
                      <span className="tabular font-extrabold text-red-600">{money(expenses.total)}</span>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================ TICKET LEDGER ========================== */}
      {tab === 'ledger' && (
        <Ledger
          tickets={tickets}
          profiles={profiles}
          range={periodRange}
          staffId={staffId}
          online={online}
        />
      )}
    </div>
  );
}

function Ledger({ tickets, profiles, range, staffId, online }) {
  const [limit, setLimit] = useState(60);
  const [q, setQ] = useState('');
  const [vFilter, setVFilter] = useState('all');
  const nameOf = (id) => profiles.find((p) => p.id === id)?.fullName;

  const vehicles = useMemo(() => {
    const set = new Map();
    for (const t of tickets) set.set(t.vehicleCode, t.vehicleLabel);
    return [...set.entries()].map(([code, label]) => ({ code, label }));
  }, [tickets]);

  const filtered = useMemo(() => {
    const [from, to] = range;
    const fromMs = +from;
    const toMs = +to;
    const query = q.trim().toUpperCase();
    return tickets
      .filter((t) => {
        const ts = Date.parse(t.issuedAt);
        if (ts < fromMs || ts >= toMs) return false;
        if (staffId !== 'all' && t.issuedBy !== staffId) return false;
        if (vFilter !== 'all' && t.vehicleCode !== vFilter) return false;
        if (query && !String(t.ticketNo).includes(query)) return false;
        return true;
      })
      .slice(0, limit);
  }, [tickets, range, staffId, q, vFilter, limit]);

  const exportCsv = () => {
    const rows = [
      ['Ticket No', 'Vehicle', 'Night', 'Total (NGN)', 'Staff', 'Date', 'Time In', 'Synced'],
      ...filtered.map((t) => [
        t.ticketNo,
        t.vehicleLabel,
        t.nightParking ? 'Yes' : 'No',
        t.totalAmount,
        nameOf(t.issuedBy) || t.issuedByName || '',
        dayKeyOf(t.issuedAt),
        fmtTime(t.issuedAt),
        t.synced ? 'Yes' : 'Pending',
      ]),
    ];
    downloadCSV(`newheroes-ticket-ledger-${lagosDateStr()}.csv`, rows);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[10rem] flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticket no…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <select
          value={vFilter}
          onChange={(e) => setVFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 shadow-sm outline-none focus:border-brand-400"
          aria-label="Filter by vehicle"
        >
          <option value="all">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.code} value={v.code}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600 hover:bg-slate-200 disabled:opacity-40"
        >
          <Icon name="download" className="h-4 w-4" /> CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-extrabold text-slate-700">
            Tickets <span className="font-bold text-slate-400">({filtered.length} shown)</span>
          </span>
          {!online && <span className="text-[10px] font-bold uppercase text-amber-600">device cache</span>}
        </div>
        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Icon name="receipt" className="h-10 w-10" />}
              title="No tickets match"
              sub="Try clearing the search or vehicle filter."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                  <VehicleIcon code={t.vehicleCode} className="h-5 w-9" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-700">{t.vehicleLabel}</span>
                    {t.nightParking && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-indigo-600">
                        <Icon name="moon" className="h-2.5 w-2.5" /> Night
                      </span>
                    )}
                  </div>
                  <div className="tabular mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <SyncDot synced={t.synced} />
                    {t.ticketNo} · {nameOf(t.issuedBy) || t.issuedByName || 'Unknown'} ·{' '}
                    {fmtTime(t.issuedAt)} {dayKeyOf(t.issuedAt).slice(5)}
                  </div>
                </div>
                <span className="tabular shrink-0 text-sm font-extrabold text-slate-800">
                  {money(t.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {filtered.length >= limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 60)}
            className="w-full border-t border-slate-100 py-3 text-xs font-extrabold uppercase tracking-wide text-brand-600 hover:bg-brand-50"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
