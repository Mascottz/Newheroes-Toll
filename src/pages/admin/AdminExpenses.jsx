import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  addExpense,
  deleteExpense,
  getExpenseSummary,
  listExpenses,
  subscribe as subscribeExpenses,
} from '../../lib/expenseClient.js';
import { EXPENSE_CATEGORIES } from '../../lib/constants.js';
import { fmtDayLabel, lagosDateStr, money, num } from '../../lib/format.js';
import { downloadCSV } from '../../lib/csv.js';
import Icon from '../../components/Icon.jsx';
import { ConfirmDialog, Field, Modal, Spinner, StatCard, inputCls } from '../../components/ui.jsx';
import { cx } from '../../lib/util.js';
import friendlyError from '../../lib/friendlyError.js';

export default function AdminExpenses() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('ok');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    description: '',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    incurredAt: lagosDateStr(),
  });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const [summaries, setSummaries] = useState({ today: null, month: null, year: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    document.title = 'Expenses — Newheroes Toll';
  }, []);

  useEffect(() => subscribeExpenses(() => setTick((t) => t + 1)), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listExpenses();
      setItems(list);
    } catch (e) {
      setItems([]);
      setNoticeTone('err');
      setNotice(friendlyError(e, 'We could not load the expenses. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  // Exact period summaries (server RPC when available, local otherwise).
  useEffect(() => {
    const today = lagosDateStr();
    const monthStart = `${today.slice(0, 7)}-01`;
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const tomorrow = lagosDateStr(1);
    Promise.all([
      getExpenseSummary(today, tomorrow),
      getExpenseSummary(monthStart, tomorrow),
      getExpenseSummary(yearStart, tomorrow),
    ])
      .then(([td, mo, yr]) => setSummaries({ today: td, month: mo, year: yr }))
      .catch(() => setSummaries({ today: null, month: null, year: null }));
  }, [tick]);

  const maxCat = Math.max(1, ...(summaries.month?.byCategory || []).map((c) => c.amount));

  const submit = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');
    try {
      const row = await addExpense({
        description: form.description,
        category: form.category,
        amount: Number(form.amount),
        incurredAt: form.incurredAt,
        user,
      });
      setNoticeTone('ok');
      setNotice(`Recorded “${row.description}” — ${money(row.amount)}`);
      setForm({ description: '', category: EXPENSE_CATEGORIES[0], amount: '', incurredAt: lagosDateStr() });
      setFormOpen(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDelBusy(true);
    try {
      await deleteExpense(delTarget.id);
      setNoticeTone('ok');
      setNotice(`Removed “${delTarget.description}”.`);
      setDelTarget(null);
    } catch (err) {
      setNoticeTone('err');
      setNotice(err.message);
      setDelTarget(null);
    } finally {
      setDelBusy(false);
    }
  };

  const todayTotal = summaries.today?.total || 0;
  const monthTotal = summaries.month?.total || 0;
  const yearTotal = summaries.year?.total || 0;

  const exportCsv = () => {
    if (!items?.length) return;
    downloadCSV(`newheroes-expenses-${lagosDateStr()}.csv`, [
      ['Date', 'Description', 'Category', 'Amount (NGN)', 'Recorded by'],
      ...items.map((e) => [e.incurredAt, e.description, e.category, e.amount, e.recordedByName || '']),
      [],
      ['', '', 'TOTAL (listed)', items.reduce((s, e) => s + e.amount, 0)],
    ]);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Expenses</h1>
          <p className="text-xs font-semibold text-slate-400">
            Operational costs recorded manually by management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!items?.length}
            className="flex items-center gap-1.5 self-start rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-200 disabled:opacity-40"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              setFormError('');
            }}
            className="flex items-center gap-1.5 self-start rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" /> Record expense
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={cx(
            'flex items-start justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1',
            noticeTone === 'ok'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-red-200'
          )}
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Icon name="wallet" className="h-5 w-5" />}
          tone="red"
          label="Today"
          value={money(todayTotal)}
          sub={`${num(summaries.today?.count || 0)} entries`}
        />
        <StatCard
          icon={<Icon name="calendar" className="h-5 w-5" />}
          tone="amber"
          label="This Month"
          value={money(monthTotal)}
          sub={`${num(summaries.month?.count || 0)} entries`}
        />
        <StatCard
          icon={<Icon name="chart" className="h-5 w-5" />}
          tone="pink"
          label="This Year"
          value={money(yearTotal)}
          sub={`${num(summaries.year?.count || 0)} entries`}
        />
      </div>

      {/* Category breakdown (this month) */}
      {summaries.month && summaries.month.byCategory.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-3 text-sm font-extrabold text-slate-700">
            By category <span className="font-bold text-slate-400">— this month</span>
          </div>
          <ul className="space-y-2.5">
            {summaries.month.byCategory.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-bold text-slate-600">{c.category}</span>
                  <span className="tabular font-extrabold text-slate-700">{money(c.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                    style={{ width: `${Math.max(3, (c.amount / maxCat) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expense ledger */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700">
          Expense ledger
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6 text-brand-400" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
            No expenses recorded yet — tap “Record expense” to add the first one.
          </div>
        ) : (
          <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
            {items.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-400">
                  <Icon name="wallet" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-bold text-slate-700">{e.description}</div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    {fmtDayLabel(e.incurredAt)} · {e.category}
                    {e.recordedByName ? ` · by ${e.recordedByName}` : ''}
                  </div>
                </div>
                <span className="tabular shrink-0 text-sm font-extrabold text-red-500">
                  −{money(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => setDelTarget(e)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  aria-label={`Delete ${e.description}`}
                  title="Delete"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Record expense modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Record expense">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Description">
            <input
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Fuel for gate generator"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₦)">
              <input
                required
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="Date">
              <input
                required
                type="date"
                max={lagosDateStr()}
                value={form.incurredAt}
                onChange={(e) => setForm((f) => ({ ...f, incurredAt: e.target.value }))}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputCls}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
            Save expense
          </button>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!delTarget}
        busy={delBusy}
        title="Delete expense?"
        message={
          delTarget
            ? `“${delTarget.description}” (${money(delTarget.amount)}) will be removed from the ledger. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="red"
        onConfirm={confirmDelete}
        onClose={() => setDelTarget(null)}
      />
    </div>
  );
}
