// Shared, renderer-agnostic report model. Both the PDF and Word exporters
// consume this structure so the two documents always match.
//
// {
//   filename, title, subtitle, periodLabel, generatedBy, generatedAt,
//   kpis:  [[label, value], ...]                                  // 2-col table
//   sections: [{ title, head: [..], rows: [[..]], aligns: ['l'|'r'|'c'] }],
//   footer: [line1, line2]
// }

import { money, num } from '../format.js';
import { pct } from '../util.js';
import { ORG } from '../constants.js';

const alignsFor = (n) => {
  // default: first column left, the rest right-aligned (numeric tables)
  const a = ['l'];
  for (let i = 1; i < n; i++) a.push('r');
  return a;
};

function section(title, head, rows, aligns) {
  return { title, head, rows, aligns: aligns || alignsFor(head.length) };
}

export function buildReportModel({
  title,
  subtitle = 'Car Park Analytics — NEWHEROES GROUP',
  periodLabel,
  rep,
  staffRows = [],
  expenseSummary = null,
  transactions = [],
  extraKpis = [],
  generatedBy = 'NEWHEROES GROUP',
}) {
  const sections = [];

  const kpis = [
    ['Total Revenue', money(rep?.totalRevenue || 0)],
    ['Total Vehicles', num(rep?.totalTickets || 0)],
    ['Average per Vehicle', money(rep?.totalTickets ? Math.round(rep.totalRevenue / rep.totalTickets) : 0)],
    ['Night Parking Tickets', num(rep?.nightTickets || 0)],
    ...extraKpis,
  ];

  if (rep?.byVehicle?.length) {
    sections.push(
      section(
        'Vehicle Breakdown',
        ['Vehicle', 'Tickets', 'Revenue (₦)', 'Share'],
        rep.byVehicle.map((v) => [
          v.label,
          num(v.tickets),
          num(v.revenue),
          `${pct(v.revenue, rep.totalRevenue)}%`,
        ])
      )
    );
  }

  if (staffRows?.length) {
    sections.push(
      section(
        'Staff Performance',
        ['Staff', 'Tickets', 'Revenue (₦)'],
        staffRows
          .filter((s) => s.tickets > 0)
          .map((s) => [s.staff_name, num(s.tickets), num(s.revenue)])
      )
    );
  }

  if (expenseSummary && expenseSummary.total > 0) {
    sections.push(
      section(
        'Expenses',
        ['Category', 'Entries', 'Amount (₦)'],
        [
          ...(expenseSummary.byCategory || []).map((c) => [c.category, num(c.count), num(c.amount)]),
          ['TOTAL', num(expenseSummary.count), num(expenseSummary.total)],
        ]
      )
    );
  }

  if (transactions?.length) {
    sections.push(
      section(
        'Recent Transactions',
        ['Time', 'Vehicle', 'Amount (₦)', 'Staff', 'Night'],
        transactions.map((t) => [
          t.time,
          t.vehicleLabel,
          num(t.totalAmount),
          t.staffName,
          t.nightParking ? 'Yes' : 'No',
        ]),
        ['l', 'l', 'r', 'l', 'c']
      )
    );
  }

  return {
    filename: `newheroes-report-${periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    subtitle,
    periodLabel,
    generatedBy,
    generatedAt: new Date(),
    kpis,
    sections,
    footer: [ORG.tagline, ORG.riskNotice],
  };
}
