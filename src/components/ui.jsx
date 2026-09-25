import { cx } from '../lib/util.js';

/* ---------------------------------- basic --------------------------------- */

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TONES = {
  pink: 'bg-brand-50 text-brand-700 ring-brand-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function Badge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({ icon, tone = 'pink', label, value, sub }) {
  const iconTones = {
    pink: 'bg-brand-100 text-brand-600',
    sky: 'bg-sky-100 text-sky-600',
    amber: 'bg-amber-100 text-amber-600',
    green: 'bg-emerald-100 text-emerald-600',
    slate: 'bg-slate-100 text-slate-500',
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2.5">
        <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', iconTones[tone])}>
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
      </div>
      <div className="tabular mt-2 text-2xl font-extrabold leading-tight text-slate-800">{value}</div>
      {sub ? <div className="mt-0.5 text-xs font-medium text-slate-400">{sub}</div> : null}
    </div>
  );
}

export function SectionTitle({ icon, right, children }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-500">
        {icon}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
      <span className="text-slate-300">{icon}</span>
      <div className="text-sm font-bold text-slate-500">{title}</div>
      {sub ? <div className="max-w-xs text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

/* --------------------------------- inputs --------------------------------- */

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-800 placeholder-slate-300 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50';

export const labelCls = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500';

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

/* --------------------------------- modal ---------------------------------- */

export function Modal({ open, onClose, title, children, widthClass = 'max-w-md' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={cx(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl',
          widthClass
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'red',
  busy = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title}>
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={cx(
            'flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-60',
            tone === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-700'
          )}
        >
          {busy ? <Spinner className="h-4 w-4" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ misc bits --------------------------------- */

export function SyncDot({ synced }) {
  return (
    <span
      title={synced ? 'Saved online' : 'Waiting for internet'}
      className={cx('inline-block h-2 w-2 shrink-0 rounded-full', synced ? 'bg-emerald-500' : 'bg-amber-400')}
    />
  );
}

export function Avatar({ name = '?', className = 'h-9 w-9 text-sm' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-extrabold text-white',
        className
      )}
    >
      {initials || '?'}
    </span>
  );
}
