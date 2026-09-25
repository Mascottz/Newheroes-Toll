import { useId } from 'react';
import { ORG } from '../lib/constants.js';

const RED = '#C8102E';
const STAR =
  'M12 2l2.95 6.05 6.65.93-4.85 4.6 1.18 6.6L12 16.9l-5.93 3.28 1.18-6.6L2.4 8.98l6.65-.93L12 2z';

function Star({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(-12 -12)`}>
      <path d={STAR} fill={RED} />
    </g>
  );
}

/** The badge only: red circle, diamond lattice, five stars. */
export function LogoMark({ size = 48, className = '' }) {
  const pid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="NEWHEROES GROUP logo"
    >
      <defs>
        <pattern id={`d${pid}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#FDF2F8" />
          <path d="M6 0 12 6 6 12 0 6Z" fill="#FDE8F2" stroke="#F472B6" strokeWidth="1" />
        </pattern>
      </defs>
      <circle cx="60" cy="60" r="57" fill="#fff" stroke={RED} strokeWidth="5" />
      <circle cx="60" cy="60" r="48" fill={`url(#d${pid})`} stroke={RED} strokeWidth="2" />
      <circle cx="60" cy="60" r="33" fill="#fff" stroke={RED} strokeWidth="2" />
      <Star x={60} y={58} s={1.18} />
      <Star x={33} y={42} s={0.62} />
      <Star x={87} y={42} s={0.62} />
      <Star x={39} y={79} s={0.62} />
      <Star x={81} y={79} s={0.62} />
    </svg>
  );
}

/** Badge + "giving quality SINCE 2006" tagline (used on the receipt & login). */
export default function Logo({ size = 100, className = '' }) {
  const pid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      width={size}
      height={size * 1.32}
      viewBox="0 0 120 158"
      className={className}
      role="img"
      aria-label={`${ORG.name} — ${ORG.tagline}`}
    >
      <defs>
        <pattern id={`d${pid}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#FDF2F8" />
          <path d="M6 0 12 6 6 12 0 6Z" fill="#FDE8F2" stroke="#F472B6" strokeWidth="1" />
        </pattern>
      </defs>
      <circle cx="60" cy="60" r="57" fill="#fff" stroke={RED} strokeWidth="5" />
      <circle cx="60" cy="60" r="48" fill={`url(#d${pid})`} stroke={RED} strokeWidth="2" />
      <circle cx="60" cy="60" r="33" fill="#fff" stroke={RED} strokeWidth="2" />
      <Star x={60} y={58} s={1.18} />
      <Star x={33} y={42} s={0.62} />
      <Star x={87} y={42} s={0.62} />
      <Star x={39} y={79} s={0.62} />
      <Star x={81} y={79} s={0.62} />
      <text
        x="60"
        y="130"
        textAnchor="middle"
        fontSize="13"
        fontStyle="italic"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={RED}
      >
        giving quality
      </text>
      <text
        x="60"
        y="150"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        letterSpacing="2"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={RED}
      >
        SINCE 2006
      </text>
    </svg>
  );
}
