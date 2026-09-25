import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTickets } from '../hooks/useTickets.jsx';
import { dayKeyOf, lagosDateStr, money, num } from '../lib/format.js';
import VehicleIcon from '../components/VehicleIcon.jsx';
import Icon from '../components/Icon.jsx';
import { ReceiptModal } from '../components/Receipt.jsx';
import { cx } from '../lib/util.js';

export default function IssueTicket() {
  const { user } = useAuth();
  const { pricing, tickets, issue, pendingCount, online } = useTickets();
  const [night, setNight] = useState(false);
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    document.title = 'Issue Ticket — NEWHEROES Toll Gate';
  }, []);

  const vehicles = pricing.vehicles || [];
  const selectedVehicle = vehicles.find((v) => v.code === selected) || null;
  const nightSurcharge = pricing.nightSurcharge || 0;
  const total = selectedVehicle
    ? selectedVehicle.baseAmount + (night ? nightSurcharge : 0)
    : 0;

  // Today's totals — attendants see their own, managers see all staff combined.
  const myToday = useMemo(() => {
    const todayKey = lagosDateStr();
    const mine = tickets.filter(
      (t) => dayKeyOf(t.issuedAt) === todayKey && (user.role === 'admin' || t.issuedBy === user.id)
    );
    return {
      count: mine.length,
      revenue: mine.reduce((s, t) => s + t.totalAmount, 0),
      staff: new Set(mine.map((t) => t.issuedBy)).size,
    };
  }, [tickets, user.id, user.role]);

  const handleIssue = () => {
    if (!selectedVehicle) return;
    const ticket = issue({
      vehicleCode: selectedVehicle.code,
      vehicleLabel: selectedVehicle.label,
      baseAmount: selectedVehicle.baseAmount,
      nightParking: night,
      user,
    });
    setReceipt(ticket);
    setSelected(null);
    setNight(false);
  };

  return (
    <div className="space-y-4">
      {/* Today strip */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-600 to-rose-500 px-4 py-3 text-white shadow-md shadow-brand-200">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Icon name="user" className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-extrabold">{user.fullName}</div>
            <div className="text-[11px] font-medium text-white/80">
              {user.role === 'admin'
                ? `All staff today: ${num(myToday.count)} ticket${myToday.count === 1 ? '' : 's'} · ${money(myToday.revenue)} · ${myToday.staff} staff`
                : `Today: ${num(myToday.count)} ticket${myToday.count === 1 ? '' : 's'} · ${money(myToday.revenue)}`}
            </div>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-950">
            <Icon name="clock" className="h-3 w-3" /> {pendingCount} not sent yet
          </span>
        )}
      </div>

      {/* Night parking toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={night}
        onClick={() => setNight((v) => !v)}
        className={cx(
          'flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left shadow-sm transition active:scale-[0.99]',
          night
            ? 'border-brand-600 bg-gradient-to-r from-brand-50 to-rose-50'
            : 'border-slate-200 bg-white'
        )}
      >
        <span className="flex items-center gap-3">
          <span
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-xl transition',
              night ? 'bg-indigo-900 text-amber-300' : 'bg-slate-100 text-slate-400'
            )}
          >
            <Icon name="moon" className="h-6 w-6" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold text-slate-800">Night Parking</span>
            <span className="block text-xs font-semibold text-slate-400">
              Adds +{money(nightSurcharge)} surcharge
            </span>
          </span>
        </span>
        <span
          className={cx(
            'relative h-7 w-12 shrink-0 rounded-full transition',
            night ? 'bg-brand-600' : 'bg-slate-300'
          )}
        >
          <span
            className={cx(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
              night ? 'left-[1.375rem]' : 'left-0.5'
            )}
          />
        </span>
      </button>

      {/* Vehicle grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {vehicles.map((v) => {
          const isSel = selected === v.code;
          const price = v.baseAmount + (night ? nightSurcharge : 0);
          return (
            <button
              key={v.code}
              type="button"
              onClick={() => setSelected(isSel ? null : v.code)}
              aria-pressed={isSel}
              className={cx(
                'relative flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-white px-3 py-4 shadow-sm transition active:scale-[0.97]',
                isSel
                  ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-100'
                  : 'border-slate-200 hover:border-brand-300'
              )}
            >
              {isSel && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              <VehicleIcon
                code={v.code}
                className={cx('h-11 w-[4.25rem]', isSel ? 'text-brand-600' : 'text-slate-600')}
              />
              <span
                className={cx(
                  'text-center text-[13px] font-extrabold leading-tight',
                  isSel ? 'text-brand-700' : 'text-slate-700'
                )}
              >
                {v.label}
              </span>
              <span className="tabular text-sm font-extrabold text-slate-800">{money(price)}</span>
              {night && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                  incl. +{money(nightSurcharge)} night
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sticky issue bar (sits above the bottom nav) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] z-30 px-4">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            disabled={!selectedVehicle}
            onClick={handleIssue}
            className={cx(
              'pointer-events-auto flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left shadow-xl transition active:scale-[0.99]',
              selectedVehicle
                ? 'bg-gradient-to-r from-brand-600 to-rose-500 text-white shadow-brand-300/60'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            )}
          >
            <span className="flex items-center gap-3">
              <Icon name="ticket" className="h-6 w-6" />
              <span className="leading-tight">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest opacity-80">
                  {selectedVehicle ? (night ? 'Night rate' : 'Standard rate') : 'Select a vehicle'}
                </span>
                <span className="block text-sm font-extrabold">
                  {selectedVehicle ? selectedVehicle.label : 'Tap a vehicle above'}
                </span>
              </span>
            </span>
            <span className="tabular text-xl font-extrabold">
              {selectedVehicle ? money(total) : '—'}
            </span>
          </button>
          {!online && (
            <p className="pointer-events-none mt-1.5 text-center text-[11px] font-semibold text-amber-600">
              Offline — tickets are saved on this device and will be sent automatically
              when you're back online
            </p>
          )}
        </div>
      </div>

      {receipt ? <ReceiptModal ticket={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}
