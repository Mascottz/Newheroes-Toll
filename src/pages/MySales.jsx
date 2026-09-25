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

/**
 * Sales for a chosen day.
 *  • Attendants see only their own sales ("My Sales").
 *  • Managers see every ticket issued by all enrolled staff ("All Sales"),
 *    with an optional filter for a single staff member.
 */
export default function MySales() {
  const { user } = useAuth();
  const { tickets, pendingCount, profiles } = useTickets();
  const [dateStr, setDateStr] = useState(() => lagosDateStr());
  const [staffId, setStaffId] = useState('all'); // admin only
  const todayStr = lagosDateStr();
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    document.title = `${isAdmin ? 'All Sales' : 'My Sales'} — NEWHEROES Toll Gate`;
  }, [isAdmin]);

  const nameOf = (id) => profiles.find((p) => p.id === id)?.fullName || null;

  const ownedBy = (t) => {
    if (!isAdmin) return t.issuedBy === user.id;
    if (staffId === 'all') return true;
    return t.issuedBy === staffId;
  };

  const dayTickets = useMemo(
    () =>
      tickets
        .filter((t) => dayKeyOf(t.issuedAt) === dateStr && ownedBy(t))
        .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, user.id, dateStr, staffId, isAdmin]
  );

  const monthTickets = useMemo(() => {
    const from = +lagosMonthStart();
    return tickets.filter((t) => Date.parse(t.issuedAt) >= from && ownedBy(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, user.id, staffId, isAdmin]);

  const revenue = dayTickets.reduce((s, t) => s + t.totalAmount, 0);
  const monthRevenue = monthTickets.reduce((s, t) => s + t.totalAmount, 0);
  const unsynced = dayTickets.filter((t) => !t.synced).length;
  const staffToday = useMemo(
    () => new Set(dayTickets.map((t) => t.issuedBy)).size,
    [dayTickets]
  );

  const shiftDay = (delta) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
    setDateStr(next);
  };

  const exportCsv = () => {
    const header = isAdmin
      ? ['Ticket No', 'Vehicle', 'Staff', 'Night Parking', 'Base (NGN)', 'Surcharge (NGN)', 'Total (NGN)', 'Time In', 'Date', 'Sent']
      : ['Ticket No', 'Vehicle', 'Night Parking', 'Base (NGN)', 'Surcharge (NGN)', 'Total (NGN)', 'Time In', 'Date', 'Sent'];
    const rows = [
      header,
      ...dayTickets.map((t) => [
        t.ticketNo,
        t.vehicleLabel,
        ...(isAdmin ? [t.issuedByName || nameOf(t.issuedBy) || '—'] : []),
        t.nightParking ? 'Yes' : 'No',
        t.baseAmount,
        t.surcharge,
        t.totalAmount,
        fmtTime(t.issuedAt),
        dateStr,
        t.synced ? 'Yes' : 'Not yet',
      ]),
    ];
    downloadCSV(`${isAdmin ? 'all-sales' : 'my-sales'}-${dateStr}.csv`, rows);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-slate-800">{isAdmin ? 'All Sales' : 'My Sales'}</h1>
        <p className="text-xs font-semibold text-slate-400">
          {isAdmin ? 'Every ticket issued by all your staff' : 'Your personal daily records'}
        </p>
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

      {/* Staff filter (managers only) */}
      {isAdmin && (
        <div className="relative">
          <Icon name="users" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm font-bold text-slate-700 shadow-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            aria-label="Filter by staff"
          >
            <option value="all">All staff</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {!p.isActive ? ' (disabled)' : ''}
              </option>
            ))}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Icon name="ticket" className="h-5 w-5" />}
          tone="pink"
          label={isAdmin && staffId === 'all' ? 'All Tickets' : 'Tickets'}
          value={num(dayTickets.length)}
          sub={
            isAdmin && staffId === 'all'
              ? `${staffToday} staff member${staffToday === 1 ? '' : 's'} sold today`
              : unsynced
                ? `${unsynced} not sent yet`
                : fmtDayLongLabel(dateStr)
          }
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
              sub={
                isAdmin
                  ? 'Tickets issued by your staff will appear here with a full breakdown.'
                  : 'Tickets you issue will appear here with a full breakdown.'
              }
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
                    {isAdmin && (
                      <span className="truncate">· {t.issuedByName || nameOf(t.issuedBy) || 'Unknown staff'}</span>
                    )}
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
