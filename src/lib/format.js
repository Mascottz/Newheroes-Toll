// Currency & date formatting, plus Lagos-timezone (UTC+1, no DST) helpers.
// All "day" boundaries in the app (today, weekly report, etc.) are computed
// in Africa/Lagos local time.

export const TZ = 'Africa/Lagos';
const HOUR_MS = 3600000;

export function money(n) {
  return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
}

/** With trailing .00, matching the printed physical tickets. */
export function moneyExact(n) {
  return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG') + '.00';
}

export function num(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-NG');
}

const timeFmt = new Intl.DateTimeFormat('en-NG', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const timeFmtSec = new Intl.DateTimeFormat('en-NG', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-NG', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (iso) => timeFmt.format(new Date(iso));
export const fmtTimeSec = (iso) => timeFmtSec.format(new Date(iso));
export const fmtDate = (iso) => dateFmt.format(new Date(iso));

/** Current wall-clock shifted so UTC getters read Lagos local values. */
const shifted = (d = new Date()) => new Date(d.getTime() + HOUR_MS);

const pad2 = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for today (or ± offsetDays) in Lagos. */
export function lagosDateStr(offsetDays = 0) {
  const s = shifted();
  s.setUTCDate(s.getUTCDate() + offsetDays);
  return s.toISOString().slice(0, 10);
}

/** Current hour of day (0–23) in Lagos. */
export function lagosHourNow() {
  return shifted().getUTCHours();
}

/** 'YYYY-MM-DD' Lagos day key for any ISO timestamp. */
export function dayKeyOf(iso) {
  return shifted(new Date(iso)).toISOString().slice(0, 10);
}

/** <input type="date"> value → Date at Lagos midnight of that day (UTC instant). */
export function dateStrToStart(v) {
  return new Date(`${v}T00:00:00+01:00`);
}

/** Lagos end-of-day (exclusive) for a 'YYYY-MM-DD' string. */
export function dateStrToEnd(v) {
  return new Date(dateStrToStart(v).getTime() + 86400000);
}

export function lagosDayStart(offsetDays = 0) {
  return dateStrToStart(lagosDateStr(offsetDays));
}

/** Monday 00:00 Lagos of the current week. */
export function lagosWeekStart() {
  const s = shifted();
  const back = (s.getUTCDay() + 6) % 7; // 0 = Monday already
  return lagosDayStart(-back);
}

export function lagosMonthStart() {
  const s = shifted();
  return dateStrToStart(`${s.getUTCFullYear()}-${pad2(s.getUTCMonth() + 1)}-01`);
}

export function lagosYearStart() {
  const s = shifted();
  return dateStrToStart(`${s.getUTCFullYear()}-01-01`);
}

/** '2026-09-25' → '25 Sep' */
export function fmtDayLabel(dayKey) {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** '2026-09-25' → 'Friday, 25 September 2026' */
export function fmtDayLongLabel(dayKey) {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09' → 'Sep' (or 'Sep 2026' when withYear). Deterministic across environments. */
export function fmtMonthLabel(monthKey, withYear = false) {
  const [y, m] = String(monthKey).split('-');
  const label = MONTHS_SHORT[Number(m) - 1] ?? monthKey;
  return withYear ? `${label} ${y}` : label;
}

/** Compact axis label: 1500 → '1.5k', 1250000 → '1.3M' */
export function compactNumber(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
