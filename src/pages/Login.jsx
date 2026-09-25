import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { inputCls, labelCls, Spinner } from '../components/ui.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { authMode, getDemoAccounts } from '../lib/authClient.js';
import { ORG } from '../lib/constants.js';
import { cx } from '../lib/util.js';
import { canInstall, isIOS, isStandalone, onInstallAvailability, promptInstall } from '../lib/installPrompt.js';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(canInstall());
  const demo = authMode === 'demo';

  useEffect(() => onInstallAvailability(setInstallable), []);
  useEffect(() => {
    document.title = 'Sign in — NEWHEROES Toll Gate';
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      // navigation happens via auth state
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (acc) => {
    setEmail(acc.email);
    setPassword('••••••••');
    setError('');
    setBusy(true);
    try {
      const pw =
        acc.email === 'manager@newheroes.ng' ? 'manager123' : 'staff123';
      await signIn(acc.email, pw);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-brand-100 via-brand-50 to-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center">
          <img
            src="/brand/logo.png"
            alt="NEWHEROES GROUP — giving quality SINCE 2006"
            className="h-24 w-24 rounded-3xl object-cover shadow-lg shadow-brand-200/60 ring-4 ring-white"
          />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800">
            Newheroes <span className="text-brand-600">Toll</span>
          </h1>
          <p className="mt-1 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            Dutse Market · Toll Gate Management
          </p>
          <p className="mt-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-300">
            by NEWHEROES GROUP
          </p>
        </div>

        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-xl shadow-brand-100/60">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@newheroes.ng"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className={labelCls}>Password</span>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cx(inputCls, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPw ? 'eyeOff' : 'eye'} className="h-5 w-5" />
                </button>
              </div>
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-rose-500 py-3.5 text-sm font-extrabold uppercase tracking-widest text-white shadow-lg shadow-brand-200 transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Spinner className="h-5 w-5" /> : null}
              Sign In
            </button>
          </form>

          {demo ? (
            <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                <Icon name="alert" className="h-3.5 w-3.5" />
                Demo mode — data stays on this device
              </div>
              <div className="grid gap-1.5">
                {getDemoAccounts().map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={busy}
                    onClick={() => quickLogin(acc)}
                    className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-amber-200 transition hover:ring-amber-400 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-700">
                        {acc.fullName}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{acc.email}</span>
                    </span>
                    <span
                      className={cx(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase',
                        acc.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-sky-100 text-sky-700',
                        !acc.isActive && 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {!acc.isActive ? 'Disabled' : acc.role === 'admin' ? 'Manager' : 'Staff'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-700/80">
                Passwords: <b>manager123</b> / <b>staff123</b>. Connect Supabase (see README) for
                production accounts.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          {installable ? (
            <button
              type="button"
              onClick={promptInstall}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-700 shadow ring-1 ring-brand-200"
            >
              <Icon name="download" className="h-4 w-4" /> Install app on this device
            </button>
          ) : isIOS() && !isStandalone() ? (
            <p className="text-center text-[11px] text-slate-400">
              To install: tap <b>Share</b> → <b>Add to Home Screen</b>
            </p>
          ) : null}
          <p className="text-[11px] italic text-brand-500">{ORG.tagline}</p>
        </div>
      </div>
    </div>
  );
}
