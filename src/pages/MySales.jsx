import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTickets } from '../hooks/useTickets.jsx';
import {
  dayKeyOf,
  fmtDayLongLabel,
  fmtTime,
  lagosDateStr,
  lagosMonthStart,
  money,
  num,
} from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import VehicleIcon from '../components/VehicleIcon.jsx';
import { EmptyState, StatCard, SyncDot } from '../components/ui.jsx';
import { downloadCSV } from '../lib/csv.js';

export default function MySales() {
  const { user } = useAuth();
  const { tickets, pendingCount } = useTickets();
  const [dateStr, setDateStr] = useState(() => lagosDateStr());
  const todayStr = lagosDateStr();

  useEffect(() => {
    document.title = 'My Sales — NEWHEROES Toll Gate';
  }, []);

  const dayTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.issuedBy === user.id && dayKeyOf(t.issuedAt) === dateStr)
        .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)),
    [tickets, user.id, dateStr]
  );

  const monthTickets = useMemo(() => {
    const from = +lagosMonthStart();
    return tickets.filter((t) => t.issuedBy === user.id && Date.parse(t.issuedAt) >= from);
  }, [tickets, user.id]);

  const revenue = dayTickets.reduce((s, t) => s + t.totalAmount, 0);
  const monthRevenue = monthTickets.reduce((s, t) => s + t.totalAmount, 0);
  const unsynced = dayTickets.filter((t) => !t.synced).length;

  const shiftDay = (delta) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
    setDateStr(next);
  };

  const exportCsv = () => {
    const rows = [
      ['Ticket No', 'Vehicle', 'Night Parking', 'Base (NGN)', 'Surcharge (NGN)', 'Total (NGN)', 'Time In', 'Date', 'Sent'],
      ...dayTickets.map((t) => [
        t.ticketNo,
        t.vehicleLabel,
        t.nightParking ? 'Yes' : 'No',
        t.baseAmount,
        t.surcharge,
        t.totalAmount,
        fmtTime(t.issuedAt),
        dateStr,
        t.synced ? 'Yes' : 'Not yet',
      ]),
    ];
    downloadCSV(`my-sales-${dateStr}.csv`, rows);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-slate-800">My Sales</h1>
        <p className="text-xs font-semibold text-slate-400">Your personal daily records</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-brand-600"
          aria-label="Previous day"
        >
          <Icon name="chevronLeft" />
        </button>
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
          onClick={() => shiftDay(1)}
          disabled={dateStr >= todayStr}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-brand-600 disabled:opacity-30"
          aria-label="Next day"
        >
          <Icon name="chevronRight" />
        </button>
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Icon name="ticket" className="h-5 w-5" />}
          tone="pink"
          label="Tickets"
          value={num(dayTickets.length)}
          sub={unsynced ? `${unsynced} not sent yet` : fmtDayLongLabel(dateStr)}
        />
        <StatCard
          icon={<Icon name="banknote" className="h-5 w-5" />}
          tone="green"
          label="Revenue"
          value={money(revenue)}
          sub={`This month: ${money(monthRevenue)}`}
        />
      </div>

      {/* Ticket list */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-extrabold text-slate-700">Tickets</span>
          {dayTickets.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 hover:bg-slate-200"
            >
              <Icon name="download" className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>

        {dayTickets.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Icon name="receipt" className="h-10 w-10" />}
              title="No tickets on this day"
              sub="Tickets you issue will appear here with a full breakdown."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dayTickets.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <VehicleIcon code={t.vehicleCode} className="h-6 w-10" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-extrabold text-slate-700">{t.vehicleLabel}</span>
                    {t.nightParking && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-indigo-600">
                        <Icon name="moon" className="h-2.5 w-2.5" /> Night
                      </span>
                    )}
                  </div>
                  <div className="tabular mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <SyncDot synced={t.synced} />
                    {t.ticketNo} · {fmtTime(t.issuedAt)}
                  </div>
                </div>
                <span className="tabular shrink-0 text-base font-extrabold text-slate-800">
                  {money(t.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingCount > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-amber-600">
          <Icon name="clock" className="h-3.5 w-3.5" /> {pendingCount} ticket(s) will be sent
          automatically when you're back online
        </p>
      )}
    </div>
  );
}
