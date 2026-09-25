// Tiny misc helpers.

/** RFC4122-ish UUID with a fallback for older browsers. */
export function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Join class names, skipping falsy values: cx('a', cond && 'b') */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Percentage of `total` (0 when total is 0), rounded to 1dp. */
export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}
