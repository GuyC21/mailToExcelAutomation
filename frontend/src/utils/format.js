/** Display helpers for finance-friendly Hebrew formatting. */

/**
 * @param {number|null|undefined} value
 * @param {string} [currency='ILS']
 * @returns {string} e.g. "‏8,000.00 ₪" or "—" when missing.
 */
export function formatMoney(value, currency = 'ILS') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: currency || 'ILS' }).format(value);
  } catch {
    return Number(value).toLocaleString('he-IL', { minimumFractionDigits: 2 });
  }
}

/** @returns {string} ISO "2026-08-30" -> "30/08/2026"; missing -> "—". */
export function formatDate(iso) {
  if (!iso) return '—';
  const [datePart, timePart] = String(iso).split('T');
  const [y, m, d] = datePart.split('-');
  if (!d) return iso;
  const time = timePart && !timePart.startsWith('00:00:00') ? ` ${timePart.slice(0, 5)}` : '';
  return `${d}/${m}/${y}${time}`;
}

/** @returns {string} Human file size, e.g. "146 KB". */
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** @returns {string} Number without currency ("1,200"), or "—". */
export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('he-IL');
}
