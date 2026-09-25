// Simple, bold vehicle silhouettes (64×42 viewBox) drawn with fill="currentColor"
// so they inherit text colour, with white cut-outs for windows/hubs.

export default function VehicleIcon({ code, className = 'h-10 w-16' }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg viewBox="0 0 64 42" className={className} aria-hidden="true">
      {code === 'bike' && (
        <g {...stroke}>
          <circle cx="14" cy="30" r="8" />
          <circle cx="50" cy="30" r="8" />
          <path d="M14 30 26 15h13l11 15" />
          <path d="M26 15 34 30" />
          <path d="M39 15V9M39 9h6" />
          <path d="M22 15h-5" />
        </g>
      )}

      {code === 'car' && (
        <g fill="currentColor">
          <path d="M8 30v-4q0-3 3-3l5-8q1.4-2.4 4-2.4h10.5q2.6 0 4.2 2.2L40 23h12q4 0 4 4v3H8Z" />
          <path d="M20 16.5h8.8l3.4 5H17.6l2.4-5Z" fill="#fff" />
          <circle cx="20" cy="31" r="5" />
          <circle cx="44" cy="31" r="5" />
          <circle cx="20" cy="31" r="1.8" fill="#fff" />
          <circle cx="44" cy="31" r="1.8" fill="#fff" />
        </g>
      )}

      {code === 'bus' && (
        <g fill="currentColor">
          <rect x="7" y="9" width="50" height="23" rx="3.5" />
          <rect x="11.5" y="13" width="9" height="8" rx="1" fill="#fff" />
          <rect x="23.5" y="13" width="9" height="8" rx="1" fill="#fff" />
          <rect x="35.5" y="13" width="9" height="8" rx="1" fill="#fff" />
          <rect x="47.5" y="13" width="6" height="16" rx="1" fill="#fff" opacity="0.85" />
          <circle cx="19" cy="32.5" r="4.6" />
          <circle cx="45" cy="32.5" r="4.6" />
          <circle cx="19" cy="32.5" r="1.7" fill="#fff" />
          <circle cx="45" cy="32.5" r="1.7" fill="#fff" />
        </g>
      )}

      {code === 'dyna' && (
        <g fill="currentColor">
          <path d="M7 27V16.5q0-2.5 2.6-2.5h8.2q1.9 0 3 1.6l4.2 6.4V27Z" />
          <path d="M12 16.5h5.5l2.8 4.5H12Z" fill="#fff" />
          <path d="M28 19.5h28q1.6 0 1.6 1.6V27H28Z" />
          <rect x="28" y="29" width="29.6" height="2" rx="1" />
          <circle cx="14" cy="31" r="4.6" />
          <circle cx="38" cy="31" r="4.6" />
          <circle cx="52" cy="31" r="4.6" />
          <circle cx="14" cy="31" r="1.7" fill="#fff" />
          <circle cx="38" cy="31" r="1.7" fill="#fff" />
          <circle cx="52" cy="31" r="1.7" fill="#fff" />
        </g>
      )}

      {code === 'lorry' && (
        <g fill="currentColor">
          <path d="M5 27V15.5q0-2.5 2.6-2.5h7.6q1.9 0 3 1.6l3.8 5.4V27Z" />
          <path d="M9.8 16.3h5l2.6 4.2H9.8Z" fill="#fff" />
          <rect x="24" y="9" width="34" height="18" rx="1.5" />
          <circle cx="13" cy="31" r="4.6" />
          <circle cx="33" cy="31" r="4.6" />
          <circle cx="49" cy="31" r="4.6" />
          <circle cx="13" cy="31" r="1.7" fill="#fff" />
          <circle cx="33" cy="31" r="1.7" fill="#fff" />
          <circle cx="49" cy="31" r="1.7" fill="#fff" />
        </g>
      )}

      {code === 'truck' && (
        <g fill="currentColor">
          <path d="M4 27V15.5q0-2.5 2.6-2.5h6.8q1.9 0 3 1.6l3.6 5.4V27Z" />
          <path d="M8.6 16.3H13l2.4 4.2H8.6Z" fill="#fff" />
          <rect x="22" y="7" width="38" height="20" rx="1.2" />
          <circle cx="11" cy="31" r="4.4" />
          <circle cx="30" cy="31" r="4.4" />
          <circle cx="39" cy="31" r="4.4" />
          <circle cx="54" cy="31" r="4.4" />
          <circle cx="11" cy="31" r="1.6" fill="#fff" />
          <circle cx="30" cy="31" r="1.6" fill="#fff" />
          <circle cx="39" cy="31" r="1.6" fill="#fff" />
          <circle cx="54" cy="31" r="1.6" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
