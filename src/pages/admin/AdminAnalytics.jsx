import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTickets } from '../../hooks/useTickets.jsx';
import useDebounced from '../../hooks/useDebounced.js';
import { getReport } from '../../lib/ticketClient.js';
import { getExpenseSummary } from '../../lib/expenseClient.js';
import {
  compactNumber,
  dayKeyOf,
  fmtDayLabel,
  fmtDayLongLabel,
  fmtMonthLabel,
  fmtTime,
  fmtDate,
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
import { EmptyState, Spinner } from '../../components/ui.jsx';
import { cx, pct } from '../../lib/util.js';
import { buildReportModel } from '../../lib/exporters/reportModel.js';
import { generateReportPDF } from '../../lib/exporters/pdf.js';
import { generateReportDOCX } from '../../lib/exporters/docx.js';

const PERIOD_RANGES = {
  today: () => [lagosDayStart(0), lagosDayStart(1)],
  week: () => [lagosWeekStart(), lagosDayStart(1)],
  month: () => [lagosMonthStart(), lagosDayStart(1)],
  year: () => [lagosYearStart(), lagosDayStart(1)],
};

const MIX_PALETTE = ['#db2777', '#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#64748b'];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #fbcfe8',
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(219,39,119,0.14)',
};

const CARD = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70';

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70" />
      ))}
    </div>
  );
}

function KpiCard({ icon, tone, label, value, sub, to }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-600',
    pink: 'bg-brand-100 text-brand-600',
    sky: 'bg-sky-100 text-sky-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-500',
    violet: 'bg-violet-100 text-violet-600',
  };
  const body = (
    <div className="h-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-400">
          {label}
        </span>
      </div>
      <div className="tabular mt-2 truncate text-xl font-extrabold leading-tight text-slate-800">
        {value}
      </div>
      {sub ? <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{sub}</div> : null}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const { tickets, profiles, version, online, pendingCount } = useTickets();
  const debouncedVersion = useDebounced(version, 600);

  const [kpi, setKpi] = useState({ loading: true });
  const [trendMode, setTrendMode] = useState('month'); // 'month' | 'year'
  const [trend, setTrend] = useState({ loading: true, rep: null });
  const [mixPeriod, setMixPeriod] = useState('month');
  const [mix, setMix] = useState({ loading: true, rep: null });
  const [exporting, setExporting] = useState(null);
  const [exportNote, setExportNote] = useState('');

  useEffect(() => {
    document.title = 'Car Park Analytics — Newheroes Toll';
  }, []);

  /* ------------------------------- data ------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const yearStart = `${lagosDateStr().slice(0, 4)}-01-01`;
        const [today, year, expToday, expYear] = await Promise.all([
          getReport({ from: lagosDayStart(0), to: lagosDayStart(1), user }),
          getReport({ from: lagosYearStart(), to: lagosDayStart(1), user }),
          getExpenseSummary(lagosDateStr(), lagosDateStr(1)),
          getExpenseSummary(yearStart, lagosDateStr(1)),
        ]);
        if (!cancelled) setKpi({ loading: false, today, year, expToday, expYear, updatedAt: new Date() });
      } catch {
        if (!cancelled) setKpi((k) => ({ ...k, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedVersion, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setTrend((t) => ({ ...t, loading: true }));
    const [from, to] = trendMode === 'month'
      ? [lagosMonthStart(), lagosDayStart(1)]
      : [lagosYearStart(), lagosDayStart(1)];
    getReport({ from, to, user })
      .then((rep) => !cancelled && setTrend({ loading: false, rep }))
      .catch(() => !cancelled && setTrend({ loading: false, rep: null }));
    return () => {
      cancelled = true;
    };
  }, [trendMode, debouncedVersion, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setMix((m) => ({ ...m, loading: true }));
    const [from, to] = PERIOD_RANGES[mixPeriod]();
    getReport({ from, to, user })
      .then((rep) => !cancelled && setMix({ loading: false, rep }))
      .catch(() => !cancelled && setMix({ loading: false, rep: null }));
    return () => {
      cancelled = true;
    };
  }, [mixPeriod, debouncedVersion, user?.id]);

  /* ----------------------------- derived ------------------------------ */

  const todayKey = lagosDateStr();
  const activeStaff = useMemo(
    () => profiles.filter((p) => p.isActive && p.role === 'staff'),
    [profiles]
  );
  const onShift = useMemo(
    () =>
      new Set(tickets.filter((t) => dayKeyOf(t.issuedAt) === todayKey).map((t) => t.issuedBy))
        .size,
    [tickets, todayKey]
  );
  const nameOf = (id) => profiles.find((p) => p.id === id)?.fullName;

  const feed = useMemo(() => tickets.slice(0, 15), [tickets]);

  const trendData = useMemo(() => {
    const rep = trend.rep;
    if (!rep) return [];
    if (trendMode === 'month') {
      return (rep.byDay || []).map((d) => ({
        label: String(Number(d.day.slice(8))),
        name: fmtDayLabel(d.day),
        value: d.revenue,
        tickets: d.tickets,
      }));
    }
    return (rep.byMonth || []).map((m) => ({
      label: fmtMonthLabel(m.month),
      name: fmtMonthLabel(m.month, true),
      value: m.revenue,
      tickets: m.tickets,
    }));
  }, [trend, trendMode]);

  const mixData = useMemo(
    () =>
      (mix.rep?.byVehicle || []).map((v) => ({
        code: v.code,
        name: v.label,
        value: v.tickets,
        revenue: v.revenue,
      })),
    [mix]
  );
  const mixTotal = mixData.reduce((s, d) => s + d.value, 0);

  const todayRevenue = kpi.today?.totalRevenue || 0;
  const todayVehicles = kpi.today?.totalTickets || 0;
  const expTodayTotal = kpi.expToday?.total || 0;

  /* ------------------------------ export ------------------------------ */

  const exportSnapshot = async (kind) => {
    if (kpi.loading) return;
    setExporting(kind);
    setExportNote('');
    try {
      const model = buildReportModel({
        title: 'Car Park Analytics — Daily Snapshot',
        periodLabel: `Today · ${fmtDayLongLabel(todayKey)}`,
        rep: kpi.today,
        expenseSummary: kpi.expToday,
        extraKpis: [
          ['Year Revenue (to date)', money(kpi.year?.totalRevenue || 0)],
          ['Expenses Today', money(expTodayTotal)],
          ['Net Today (revenue − expenses)', money(todayRevenue - expTodayTotal)],
          ['Active Staff', `${activeStaff.length} registered · ${onShift} on shift`],
        ],
        transactions: feed.map((t) => ({
          time: `${fmtDate(t.issuedAt)} ${fmtTime(t.issuedAt)}`,
          vehicleLabel: t.vehicleLabel,
          totalAmount: t.totalAmount,
          staffName: nameOf(t.issuedBy) || t.issuedByName || 'Unknown',
          nightParking: t.nightParking,
        })),
        generatedBy: user.fullName,
      });
      if (kind === 'pdf') await generateReportPDF(model);
      else await generateReportDOCX(model);
      setExportNote(`${kind === 'pdf' ? 'PDF' : 'Word'} report downloaded`);
    } catch (e) {
      setExportNote(`Export failed: ${e?.message || 'unknown error'}`);
    } finally {
      setExporting(null);
      setTimeout(() => setExportNote(''), 4000);
    }
  };

  /* ------------------------------- render ------------------------------ */

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
            Car Park Analytics
          </h1>
          <p className="mt-0.5 max-w-xl text-xs font-semibold leading-relaxed text-slate-400">
            NEWHEROES GROUP - Dutse Modern Market Car Park Monitoring System
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-200">
            <LiveDot /> Live
          </span>
          {online && pendingCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 ring-1 ring-amber-200">
              {pendingCount} syncing
            </span>
          )}
          <button
            type="button"
            onClick={() => exportSnapshot('pdf')}
            disabled={exporting || kpi.loading}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Spinner className="h-4 w-4" /> : <Icon name="fileText" className="h-4 w-4" />}
            PDF
          </button>
          <button
            type="button"
            onClick={() => exportSnapshot('word')}
            disabled={exporting || kpi.loading}
            className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {exporting === 'word' ? <Spinner className="h-4 w-4" /> : <Icon name="fileText" className="h-4 w-4" />}
            Word
          </button>
        </div>
      </div>

      {exportNote && (
        <div className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white">
          {exportNote}
        </div>
      )}

      {/* KPI cards */}
      {kpi.loading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<Icon name="banknote" className="h-5 w-5" />}
            tone="green"
            label="Today's Revenue"
            value={money(todayRevenue)}
            sub={`${num(todayVehicles)} vehicles · avg ${money(todayVehicles ? Math.round(todayRevenue / todayVehicles) : 0)}`}
          />
          <KpiCard
            icon={<Icon name="chart" className="h-5 w-5" />}
            tone="pink"
            label="Total Year Revenue"
            value={money(kpi.year?.totalRevenue || 0)}
            sub={`${num(kpi.year?.totalTickets || 0)} vehicles since Jan 1`}
          />
          <KpiCard
            icon={<Icon name="users" className="h-5 w-5" />}
            tone="sky"
            label="Current Active Staff"
            value={num(activeStaff.length)}
            sub={`${onShift} on shift today`}
          />
          <KpiCard
            icon={<Icon name="ticket" className="h-5 w-5" />}
            tone="amber"
            label="Total Vehicles Today"
            value={num(todayVehicles)}
            sub={kpi.today?.byVehicle?.[0] ? `Top: ${kpi.today.byVehicle[0].label}` : 'No entries yet'}
          />
          <KpiCard
            icon={<Icon name="wallet" className="h-5 w-5" />}
            tone="red"
            label="Expenses (Today)"
            value={money(expTodayTotal)}
            sub={`Year to date: ${money(kpi.expYear?.total || 0)}`}
            to="/admin/expenses"
          />
          <KpiCard
            icon={<Icon name="trendingUp" className="h-5 w-5" />}
            tone="violet"
            label="Net (Today)"
            value={money(todayRevenue - expTodayTotal)}
            sub="Revenue − expenses"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Revenue trend */}
        <div className={cx(CARD, 'lg:col-span-3')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-700">Monthly Revenue Trend</div>
              <div className="text-[11px] font-medium text-slate-400">
                {trendMode === 'month' ? 'Daily revenue — current month' : 'Revenue by month — current year'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {[
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTrendMode(m.id)}
                  className={cx(
                    'rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition',
                    trendMode === m.id ? 'bg-white text-brand-600 shadow' : 'text-slate-500'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {trend.loading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Spinner className="h-6 w-6 text-brand-400" />
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center">
              <EmptyState
                icon={<Icon name="chart" className="h-9 w-9" />}
                title="No revenue recorded yet"
                sub="The chart appears as soon as tickets are issued."
              />
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#db2777" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={compactNumber}
                    width={42}
                  />
                  <Tooltip
                    cursor={{ fill: '#fdf2f8' }}
                    formatter={(value) => [money(value), 'Revenue']}
                    labelFormatter={(_, pts) => pts?.[0]?.payload?.name ?? ''}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="value" fill="url(#trendGrad)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Vehicle mix */}
        <div className={cx(CARD, 'lg:col-span-2')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-700">Ticket Distribution</div>
              <div className="text-[11px] font-medium text-slate-400">Vehicle types processed</div>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {['today', 'week', 'month', 'year'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMixPeriod(p)}
                  className={cx(
                    'rounded-lg px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide transition',
                    mixPeriod === p ? 'bg-white text-brand-600 shadow' : 'text-slate-500'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {mix.loading ? (
            <div className="flex h-[230px] items-center justify-center">
              <Spinner className="h-6 w-6 text-brand-400" />
            </div>
          ) : mixData.length === 0 ? (
            <div className="flex h-[230px] items-center justify-center">
              <EmptyState
                icon={<Icon name="ticket" className="h-9 w-9" />}
                title="No tickets in this period"
              />
            </div>
          ) : (
            <>
              <div className="relative h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="90%"
                      paddingAngle={2}
                      stroke="none"
                      cornerRadius={5}
                    >
                      {mixData.map((d, i) => (
                        <Cell key={d.code} fill={MIX_PALETTE[i % MIX_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, item) => [
                        `${num(value)} vehicles · ${money(item?.payload?.revenue ?? 0)}`,
                        name,
                      ]}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="tabular text-2xl font-extrabold text-slate-800">{num(mixTotal)}</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    vehicles
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {mixData.map((d, i) => (
                  <li key={d.code} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: MIX_PALETTE[i % MIX_PALETTE.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{d.name}</span>
                    <span className="tabular shrink-0 font-semibold text-slate-400">
                      {num(d.value)} · {pct(d.value, mixTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-sm font-extrabold text-slate-700">Recent Activity</span>
            <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
              · live transactions
            </span>
          </div>
          {kpi.updatedAt && (
            <span className="text-[11px] font-semibold text-slate-400">
              Updated {fmtTime(kpi.updatedAt.toISOString())}
            </span>
          )}
        </div>
        {feed.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Icon name="receipt" className="h-10 w-10" />}
              title="No transactions yet"
              sub="Entries appear here in real time as staff issue tickets."
            />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5 font-extrabold">Time</th>
                  <th className="px-2 py-2.5 font-extrabold">Vehicle</th>
                  <th className="px-2 py-2.5 text-right font-extrabold">Amount</th>
                  <th className="hidden px-2 py-2.5 font-extrabold sm:table-cell">Staff</th>
                  <th className="px-4 py-2.5 text-center font-extrabold">Night</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feed.map((t) => (
                  <tr key={t.id} className="transition hover:bg-brand-50/40">
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-xs font-bold text-slate-500">
                      {fmtTime(t.issuedAt)}
                      <span className="ml-1.5 hidden font-semibold text-slate-300 md:inline">
                        {fmtDate(t.issuedAt).slice(0, 6)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="hidden h-7 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 md:flex">
                          <VehicleIcon code={t.vehicleCode} className="h-4 w-8" />
                        </span>
                        <span className="text-xs font-extrabold text-slate-700">{t.vehicleLabel}</span>
                      </span>
                    </td>
                    <td className="tabular whitespace-nowrap px-2 py-2.5 text-right text-sm font-extrabold text-slate-800">
                      {money(t.totalAmount)}
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-2.5 text-xs font-bold text-slate-500 sm:table-cell">
                      {nameOf(t.issuedBy) || t.issuedByName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {t.nightParking ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-indigo-600">
                          <Icon name="moon" className="h-2.5 w-2.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-slate-300">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!online && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-amber-600">
          <Icon name="wifiOff" className="h-3.5 w-3.5" /> Offline — showing data cached on this
          device; everything syncs when you reconnect.
        </p>
      )}
    </div>
  );
}
