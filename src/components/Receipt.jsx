import { useState } from 'react';
import { ORG } from '../lib/constants.js';
import { moneyExact, fmtTimeSec, fmtDate } from '../lib/format.js';
import { useAuth } from '../hooks/useAuth.jsx';
import Icon from './Icon.jsx';
import PrintModal from './PrintModal.jsx';
import { Spinner } from './ui.jsx';

/* Pink zig-zag edge (deterministic SVG triangles). */
function ZigZag({ flip = false }) {
  const W = 24;
  const H = 9;
  let d = '';
  for (let x = 0; x < 408; x += W) {
    if (flip) d += `M${x} ${H} L${x + W / 2} 0 L${x + W} ${H} Z `;
    else d += `M${x} 0 L${x + W / 2} ${H} L${x + W} 0 Z `;
  }
  return (
    <svg viewBox="0 0 408 9" preserveAspectRatio="none" className="block h-2.5 w-full" aria-hidden="true">
      <path d={d} fill="#F9A8D4" />
    </svg>
  );
}

/* Decorative pseudo-barcode derived from the ticket number. */
function Barcode({ value }) {
  const bars = [];
  let seed = 7;
  for (const ch of String(value)) seed = (seed * 31 + ch.charCodeAt(0)) % 99991;
  for (let i = 0; i < 40; i++) {
    seed = (seed * 137 + 61) % 99991;
    bars.push(1 + (seed % 3));
  }
  return (
    <div className="flex h-9 items-stretch justify-center gap-[2px]" aria-hidden="true">
      {bars.map((w, i) =>
        i % 2 === 0 ? (
          <span key={i} className="inline-block" style={{ width: `${w}px`, background: '#C8102E' }} />
        ) : (
          <span key={i} className="inline-block" style={{ width: `${w}px` }} />
        )
      )}
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[13px] leading-6">
      <span className="shrink-0 font-bold">{label}</span>
      <span
        className="min-w-4 border-b border-dotted border-pink-300"
        style={{ flex: '1 1 auto', transform: 'translateY(-3px)' }}
      />
      <span className={strong ? 'shrink-0 text-[15px] font-extrabold' : 'shrink-0 font-semibold'}>{value}</span>
    </div>
  );
}

/**
 * The digital receipt — mimics the physical NEWHEROES toll tickets:
 * pink & white background, red text, the badge logo, and the exact wording.
 */
export function Receipt({ ticket }) {
  const staffName = ticket.issuedByName || 'NEWHEROES GROUP';
  return (
    <div className="receipt-paper relative mx-auto w-full max-w-sm overflow-hidden rounded-xl shadow-lg ring-1 ring-pink-200">
      <ZigZag />

      <div className="px-5 pb-5 pt-3 text-center">
        {/* Branding */}
        <div className="text-[15px] font-extrabold tracking-[0.18em]">NEWHEROES GROUP</div>
        <div className="mx-auto mt-1 w-fit">
          <LogoInline />
        </div>
        <div className="mt-1 text-[17px] font-extrabold leading-tight tracking-wide">{ORG.market}</div>
        <div className="mt-0.5 text-[11px] font-bold leading-snug tracking-wide">{ORG.address}</div>

        <div className="relative my-3 flex items-center justify-center">
          <div className="r-dashed w-full" />
          <span
            className="absolute -left-[26px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-pink-300"
            style={{ background: 'var(--notch-bg)' }}
          />
          <span
            className="absolute -right-[26px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-pink-300"
            style={{ background: 'var(--notch-bg)' }}
          />
        </div>

        {/* Ticket details */}
        <div className="space-y-0.5 text-left">
          <Row label="TICKET NO" value={ticket.ticketNo} strong />
          <Row label="VEHICLE" value={ticket.vehicleLabel.toUpperCase()} strong />
          <Row label="TIME IN" value={fmtTimeSec(ticket.issuedAt)} />
          <Row label="DATE" value={fmtDate(ticket.issuedAt)} />
          {ticket.nightParking ? (
            <Row label="NIGHT PARKING" value={`+ ${moneyExact(ticket.surcharge)}`} />
          ) : null}
        </div>

        {/* Total */}
        <div className="mt-3 rounded-lg border-2 border-[#C8102E]/60 bg-pink-50 py-2">
          <div className="text-[11px] font-bold tracking-[0.25em]">AMOUNT PAID</div>
          <div className="tabular text-[26px] font-extrabold leading-tight">
            {moneyExact(ticket.totalAmount)}
          </div>
        </div>

        {/* Barcode */}
        <div className="mt-3">
          <Barcode value={ticket.ticketNo} />
          <div className="mt-1 text-[11px] font-bold tracking-[0.3em]">{ticket.ticketNo}</div>
        </div>

        <div className="r-dashed my-3" />

        {/* Mandatory notices */}
        <div className="text-[12px] font-extrabold leading-relaxed">{ORG.nightNotice}</div>
        <div className="mt-1 text-[11px] font-semibold italic leading-relaxed">{ORG.riskNotice}</div>

        <div className="mt-2 text-left">
          <Row label="ISSUED BY" value={staffName.toUpperCase()} />
        </div>

        <div className="mt-3 text-[11px] font-bold italic tracking-wide opacity-80">{ORG.tagline}</div>
      </div>

      <ZigZag flip />
    </div>
  );
}

/* Small inline version of the badge for the receipt header. */
function LogoInline() {
  return (
    <svg width="54" height="54" viewBox="0 0 120 120" aria-hidden="true" className="mx-auto">
      <defs>
        <pattern id="rcpt-d" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#FDF2F8" />
          <path d="M6 0 12 6 6 12 0 6Z" fill="#FDE8F2" stroke="#F472B6" strokeWidth="1" />
        </pattern>
      </defs>
      <circle cx="60" cy="60" r="57" fill="#fff" stroke="#C8102E" strokeWidth="5" />
      <circle cx="60" cy="60" r="48" fill="url(#rcpt-d)" stroke="#C8102E" strokeWidth="2" />
      <circle cx="60" cy="60" r="33" fill="#fff" stroke="#C8102E" strokeWidth="2" />
      <g fill="#C8102E">
        {[
          [60, 58, 1.18],
          [33, 42, 0.62],
          [87, 42, 0.62],
          [39, 79, 0.62],
          [81, 79, 0.62],
        ].map(([x, y, s], i) => (
          <path
            key={i}
            transform={`translate(${x} ${y}) scale(${s}) translate(-12 -12)`}
            d="M12 2l2.95 6.05 6.65.93-4.85 4.6 1.18 6.6L12 16.9l-5.93 3.28 1.18-6.6L2.4 8.98l6.65-.93L12 2z"
          />
        ))}
      </g>
    </svg>
  );
}

/** Receipt shown in a printable modal with Print / Share / Done actions. */
export function ReceiptModal({ ticket, onClose }) {
  const { user } = useAuth();
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);

  const staffName = ticket.issuedByName || user?.fullName || 'NEWHEROES GROUP';
  const shareText = [
    'NEWHEROES GROUP — DUTSE MODERN MARKET',
    `Ticket ${ticket.ticketNo}`,
    `Vehicle: ${ticket.vehicleLabel}${ticket.nightParking ? ' (Night Parking)' : ''}`,
    `Amount paid: ${moneyExact(ticket.totalAmount)}`,
    `Time in: ${fmtTimeSec(ticket.issuedAt)}, ${fmtDate(ticket.issuedAt)}`,
    `Issued by: ${staffName}`,
    ORG.riskNotice,
  ].join('\n');

  const doShare = async () => {
    setSharing(true);
    setShareNote('');
    try {
      if (navigator.share) {
        await navigator.share({ title: `Toll receipt ${ticket.ticketNo}`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareNote('Receipt details copied to clipboard');
      }
    } catch {
      setShareNote('Sharing is not available here — use Print instead');
    } finally {
      setSharing(false);
    }
  };

  return (
    <PrintModal onClose={onClose} widthClass="max-w-md">
      <div className="no-print flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <span className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600">
          <Icon name="checkCircle" className="h-5 w-5" /> Ticket issued
        </span>
        {ticket.synced ? (
          <span className="text-[11px] font-bold text-emerald-600">Saved online ✓</span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
            <Icon name="clock" className="h-3.5 w-3.5" /> Saves when online
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <Receipt ticket={ticket} />
      </div>

      {shareNote ? (
        <div className="no-print px-5 pb-1 text-center text-xs font-semibold text-slate-500">{shareNote}</div>
      ) : null}

      <div className="no-print grid grid-cols-3 gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-3 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-700"
        >
          <Icon name="printer" className="h-4 w-4" /> Print
        </button>
        <button
          type="button"
          onClick={doShare}
          disabled={sharing}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 py-3 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {sharing ? <Spinner className="h-4 w-4" /> : <Icon name="share" className="h-4 w-4" />} Share
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600 transition hover:bg-slate-200"
        >
          <Icon name="plus" className="h-4 w-4" /> Next
        </button>
      </div>
    </PrintModal>
  );
}
