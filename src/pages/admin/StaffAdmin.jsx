import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTickets } from '../../hooks/useTickets.jsx';
import {
  authMode,
  createStaff,
  setStaffActive,
  setStaffPassword,
} from '../../lib/authClient.js';
import { dayKeyOf, lagosDateStr, money, num } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import {
  Avatar,
  Badge,
  ConfirmDialog,
  Field,
  Modal,
  Spinner,
  inputCls,
} from '../../components/ui.jsx';
import { cx } from '../../lib/util.js';

export default function StaffAdmin() {
  const { user } = useAuth();
  const { tickets, profiles, reloadProfiles } = useTickets();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'staff' });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const [pwTarget, setPwTarget] = useState(null); // profile being reset
  const [pwValue, setPwValue] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  const [toggleTarget, setToggleTarget] = useState(null); // profile being (de)activated
  const [toggleBusy, setToggleBusy] = useState(false);

  useEffect(() => {
    document.title = 'Staff — NEWHEROES Toll Gate';
  }, []);
  useEffect(() => {
    reloadProfiles();
  }, [reloadProfiles]);

  // Today's collection per staff member (live from the cache).
  const todayStats = useMemo(() => {
    const todayKey = lagosDateStr();
    const map = new Map();
    for (const t of tickets) {
      if (dayKeyOf(t.issuedAt) !== todayKey) continue;
      const s = map.get(t.issuedBy) || { count: 0, revenue: 0 };
      s.count += 1;
      s.revenue += t.totalAmount;
      map.set(t.issuedBy, s);
    }
    return map;
  }, [tickets]);

  const submitCreate = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');
    try {
      await createStaff(form);
      setNotice(`${form.fullName.trim()} can now sign in with their email and password.`);
      setForm({ fullName: '', email: '', password: '', role: 'staff' });
      setShowForm(false);
      reloadProfiles();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    setPwError('');
    try {
      await setStaffPassword(pwTarget, pwValue);
      setNotice(`Password updated for ${pwTarget.fullName}.`);
      setPwTarget(null);
      setPwValue('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const confirmToggle = async () => {
    setToggleBusy(true);
    try {
      await setStaffActive(toggleTarget, !toggleTarget.isActive);
      setNotice(
        toggleTarget.isActive
          ? `${toggleTarget.fullName} has been deactivated and can no longer sign in.`
          : `${toggleTarget.fullName} has been reactivated.`
      );
      setToggleTarget(null);
      reloadProfiles();
    } catch (err) {
      setNotice(err.message);
      setToggleTarget(null);
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Staff</h1>
          <p className="text-xs font-semibold text-slate-400">
            Manage attendant accounts & access
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setFormError('');
          }}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700"
        >
          <Icon name="plus" className="h-4 w-4" /> Add staff
        </button>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Accounts */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <ul className="divide-y divide-slate-100">
          {profiles.length === 0 && (
            <li className="flex items-center justify-center py-12 text-sm font-semibold text-slate-400">
              <Spinner className="mr-2 h-4 w-4" /> Loading accounts…
            </li>
          )}
          {profiles.map((p) => {
            const stats = todayStats.get(p.id) || { count: 0, revenue: 0 };
            const isSelf = p.id === user.id;
            return (
              <li key={p.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={p.fullName} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold text-slate-700">
                        {p.fullName}
                      </span>
                      {p.role === 'admin' && <Badge tone="pink">Manager</Badge>}
                      {!p.isActive && <Badge tone="slate">Disabled</Badge>}
                      {isSelf && <Badge tone="sky">You</Badge>}
                    </div>
                    <div className="truncate text-xs font-medium text-slate-400">{p.email}</div>
                    {p.isActive && stats.count > 0 ? (
                      <div className="tabular mt-0.5 text-[11px] font-bold text-emerald-600">
                        Today: {num(stats.count)} tickets · {money(stats.revenue)}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPwTarget(p);
                        setPwValue('');
                        setPwError('');
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                      title="Reset password"
                      aria-label={`Reset password for ${p.fullName}`}
                    >
                      <Icon name="key" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => setToggleTarget(p)}
                      className={cx(
                        'flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-30',
                        p.isActive
                          ? 'bg-red-50 text-red-500 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      )}
                      title={p.isActive ? 'Deactivate' : 'Reactivate'}
                      aria-label={`${p.isActive ? 'Deactivate' : 'Reactivate'} ${p.fullName}`}
                    >
                      <Icon name={p.isActive ? 'logout' : 'checkCircle'} className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {authMode === 'supabase' && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          New accounts are created through the <b>manage-user</b> Edge Function (admin-only).
          If creation fails, make sure it's deployed — see <b>docs/SUPABASE_SETUP.md</b>.
        </p>
      )}

      {/* ------------------------- create staff modal ------------------------- */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add staff account">
        <form onSubmit={submitCreate} className="space-y-4">
          <Field label="Full name">
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Amina Bello"
              className={inputCls}
            />
          </Field>
          <Field label="Email (used to sign in)">
            <input
              type="email"
              required
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="amina@newheroes.ng"
              className={inputCls}
            />
          </Field>
          <Field label="Temporary password" hint="At least 6 characters — staff can change it later.">
            <input
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="e.g. toll2026"
              className={inputCls}
            />
          </Field>
          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'staff', label: 'Attendant', desc: 'Issues tickets, sees own sales' },
                { id: 'admin', label: 'Manager', desc: 'Full access & reports' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                  className={cx(
                    'rounded-xl border-2 p-3 text-left transition',
                    form.role === r.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-300'
                  )}
                >
                  <span className="block text-sm font-extrabold text-slate-700">{r.label}</span>
                  <span className="block text-[10px] font-semibold leading-tight text-slate-400">
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {formError ? (
            <div className="rounded-xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={formBusy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-extrabold uppercase tracking-widest text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 disabled:opacity-60"
          >
            {formBusy ? <Spinner className="h-5 w-5" /> : null}
            Create account
          </button>
        </form>
      </Modal>

      {/* ------------------------- reset password modal ----------------------- */}
      <Modal
        open={!!pwTarget}
        onClose={() => setPwTarget(null)}
        title={pwTarget ? `Reset password — ${pwTarget.fullName}` : ''}
      >
        <form onSubmit={submitPassword} className="space-y-4">
          <Field label="New password" hint="At least 6 characters. Share it with the staff member directly.">
            <input
              type="text"
              required
              minLength={6}
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              placeholder="New password"
              className={inputCls}
            />
          </Field>
          {pwError ? (
            <div className="rounded-xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
              {pwError}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={pwBusy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3.5 text-sm font-extrabold uppercase tracking-widest text-white transition hover:bg-slate-900 disabled:opacity-60"
          >
            {pwBusy ? <Spinner className="h-5 w-5" /> : null}
            Update password
          </button>
        </form>
      </Modal>

      {/* --------------------------- confirm toggle --------------------------- */}
      <ConfirmDialog
        open={!!toggleTarget}
        busy={toggleBusy}
        title={toggleTarget?.isActive ? 'Deactivate account?' : 'Reactivate account?'}
        message={
          toggleTarget?.isActive
            ? `${toggleTarget?.fullName} will immediately lose the ability to sign in or issue tickets. Their past records are kept.`
            : `${toggleTarget?.fullName} will be able to sign in and issue tickets again.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        tone={toggleTarget?.isActive ? 'red' : 'pink'}
        onConfirm={confirmToggle}
        onClose={() => setToggleTarget(null)}
      />
    </div>
  );
}
