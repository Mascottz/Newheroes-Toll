// CSV export helper (with BOM so Excel opens ₦/unicode correctly).

export function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadCSV(filename, rows) {
  const content = toCSV(rows);
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename, blob);
}

/** Generic blob download used by the PDF / Word exporters too. */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
