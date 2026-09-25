// Demo-mode seed data. When no Supabase credentials are configured the app
// runs fully locally: demo staff accounts + ~6 days of realistic ticket
// history so the dashboards are immediately explorable.

import storage from './safeStorage.js';
import { USERS_KEY, TICKETS_CACHE_KEY, EXPENSES_KEY } from './keys.js';
import { DEFAULT_VEHICLES } from './constants.js';
import { lagosDateStr, lagosHourNow } from './format.js';
import { uuid } from './util.js';

export const DEMO_USERS = [
  {
    id: 'demo-admin',
    email: 'manager@newheroes.ng',
    password: 'manager123',
    fullName: 'Yusuf Ibrahim',
    role: 'admin',
    active: true,
    createdAt: '2026-01-05T08:00:00+01:00',
  },
  {
    id: 'demo-musa',
    email: 'musa@newheroes.ng',
    password: 'staff123',
    fullName: 'Musa Abdullahi',
    role: 'staff',
    active: true,
    createdAt: '2026-01-10T08:00:00+01:00',
  },
  {
    id: 'demo-hauwa',
    email: 'hauwa@newheroes.ng',
    password: 'staff123',
    fullName: 'Hauwa Suleiman',
    role: 'staff',
    active: true,
    createdAt: '2026-02-14T08:00:00+01:00',
  },
  {
    id: 'demo-chidi',
    email: 'chidi@newheroes.ng',
    password: 'staff123',
    fullName: 'Chidi Okafor',
    role: 'staff',
    active: false, // demonstrates the deactivated-account state
    createdAt: '2026-03-02T08:00:00+01:00',
  },
];

const WEIGHTED = [
  ['bike', 0.33],
  ['car', 0.34],
  ['bus', 0.12],
  ['dyna', 0.1],
  ['lorry', 0.06],
  ['truck', 0.05],
];

function pickVehicle() {
  const r = Math.random();
  let acc = 0;
  for (const [code, w] of WEIGHTED) {
    acc += w;
    if (r <= acc) return DEFAULT_VEHICLES.find((v) => v.code === code);
  }
  return DEFAULT_VEHICLES[0];
}

function buildSeedTickets() {
  const tickets = [];
  const staff = DEMO_USERS.filter((u) => u.role === 'staff' && u.id !== 'demo-chidi');
  const hourNow = lagosHourNow();

  for (let d = 5; d >= 0; d--) {
    const dayStr = lagosDateStr(-d);
    const dayPart = dayStr.slice(2).replace(/-/g, ''); // YYMMDD
    let counter = 0;

    for (const u of staff) {
      const perDay = d === 0 ? Math.max(3, Math.round((hourNow - 6) * 1.4)) : 14 + Math.floor(Math.random() * 14);
      for (let i = 0; i < perDay; i++) {
        const hour = 7 + Math.floor(Math.random() * 14); // 07:00 – 20:59
        if (d === 0 && hour > hourNow) continue; // no future tickets today
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);
        const iso = new Date(
          `${dayStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+01:00`
        ).toISOString();

        const v = pickVehicle();
        const night = hour >= 19 && Math.random() < 0.3;
        const surcharge = night ? 1000 : 0;
        counter += 1;

        tickets.push({
          id: 'demo-' + uuid(),
          clientId: uuid(),
          ticketNo: `NH-${dayPart}-${String(counter).padStart(4, '0')}`,
          vehicleCode: v.code,
          vehicleLabel: v.label,
          baseAmount: v.baseAmount,
          nightParking: night,
          surcharge,
          totalAmount: v.baseAmount + surcharge,
          issuedBy: u.id,
          issuedByName: u.fullName,
          issuedAt: iso,
          synced: true,
        });
      }
    }
  }

  return tickets.sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
}

/** Idempotent: seeds demo users + tickets once, on first launch. */
export function ensureDemoData() {
  if (!storage.getItem(USERS_KEY)) {
    storage.setItem(USERS_KEY, JSON.stringify(DEMO_USERS));
    storage.setItem(TICKETS_CACHE_KEY, JSON.stringify(buildSeedTickets()));
  }
}

/** Demo expenses (seeded once so existing demo devices also get them). */
export function ensureDemoExpenses() {
  if (storage.getItem(EXPENSES_KEY)) return;
  const d = (offset) => lagosDateStr(offset);
  const seed = [
    { description: 'Fuel for gate generator', category: 'Fuel & Transport', amount: 12000, incurredAt: d(-3) },
    { description: 'Printer paper rolls (receipts)', category: 'Supplies', amount: 8000, incurredAt: d(-5) },
    { description: 'Gate arm repair', category: 'Maintenance', amount: 15000, incurredAt: d(-8) },
    { description: 'Security overtime (2 weeks)', category: 'Salaries', amount: 30000, incurredAt: d(-12) },
    { description: 'Brooms & cleaning supplies', category: 'Supplies', amount: 4500, incurredAt: d(-15) },
    { description: 'Staff water dispensing', category: 'Utilities', amount: 3000, incurredAt: d(-20) },
    { description: 'Floodlight bulb replacement', category: 'Maintenance', amount: 6500, incurredAt: d(-25) },
    { description: 'Fuel for patrol pickup', category: 'Fuel & Transport', amount: 7000, incurredAt: d(0) },
  ].map((e, i) => ({
    id: 'demo-exp-' + i,
    description: e.description,
    category: e.category,
    amount: e.amount,
    incurredAt: e.incurredAt,
    recordedBy: 'demo-admin',
    recordedByName: 'Yusuf Ibrahim',
    createdAt: new Date().toISOString(),
  }));
  storage.setItem(EXPENSES_KEY, JSON.stringify(seed));
}
