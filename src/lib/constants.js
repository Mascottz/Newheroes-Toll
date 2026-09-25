// Organisation-wide constants: branding, receipt wording and default pricing.
// Pricing here is a FALLBACK used offline / in demo mode; the authoritative
// prices live in the Supabase `vehicle_types` and `settings` tables.

export const ORG = {
  name: 'NEWHEROES GROUP',
  tagline: 'giving quality SINCE 2006',
  taglinePre: 'giving quality',
  taglinePost: 'SINCE 2006',
  market: 'DUTSE MODERN MARKET',
  address: 'OLAJUMOKE ARCADE SHOPPING ARCADE DUTSE ABUJA',
  nightNotice: 'NIGHT PARKING ATTRACT N1000.00 NAIRA',
  riskNotice: "Vehicles are parked at Owner's Risk",
  tz: 'Africa/Lagos',
};

export const DEFAULT_VEHICLES = [
  { code: 'bike', label: 'Bike / Okada', baseAmount: 200 },
  { code: 'car', label: 'Car', baseAmount: 300 },
  { code: 'bus', label: 'Bus', baseAmount: 500 },
  { code: 'dyna', label: 'Dyna / J5', baseAmount: 1000 },
  { code: 'lorry', label: 'Lorry', baseAmount: 3000 },
  { code: 'truck', label: 'Truck / Trailer', baseAmount: 5000 },
];

export const DEFAULT_NIGHT_SURCHARGE = 1000;

/** Categories managers can book expenses against (manual entry only). */
export const EXPENSE_CATEGORIES = [
  'Fuel & Transport',
  'Maintenance',
  'Supplies',
  'Salaries',
  'Utilities',
  'Security',
  'Other',
];
