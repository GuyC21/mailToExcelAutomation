/** Display helpers for finance-friendly Hebrew formatting. */

const DATETIME_FORMATTER = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Formats a numeric value in its specified currency code.
 * @param {number|null|undefined} value - Numeric monetary amount.
 * @param {string} [currency='ILS'] - ISO currency code (e.g. "ILS", "USD").
 * @returns {string} Formatted currency string or "—" when missing.
 */
export function formatMoney(value, currency = 'ILS') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const code = currency || 'ILS';
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: code }).format(Number(value));
  } catch {
    return `${Number(value).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
  }
}

/**
 * Formats an ISO date string ("2026-08-30") into Israeli DD/MM/YYYY format.
 * @param {string|null|undefined} iso - ISO date or datetime string.
 * @returns {string} Localized date string or "—" when missing.
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const [datePart, timePart] = String(iso).split('T');
  const [y, m, d] = datePart.split('-');
  if (!d) return iso;
  const time = timePart && !timePart.startsWith('00:00:00') ? ` ${timePart.slice(0, 5)}` : '';
  return `${d}/${m}/${y}${time}`;
}

/**
 * Safely formats an ISO timestamp into localized Hebrew date and time.
 * Guards against null or malformed dates so UI tables never crash with RangeError.
 * @param {string|Date|null|undefined} value - Timestamp to format.
 * @returns {string} Localized date/time string or "—" when missing/invalid.
 */
export function formatDateTime(value) {
  if (!value) return '—';
  try {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return DATETIME_FORMATTER.format(parsed);
  } catch {
    return '—';
  }
}

/**
 * Formats a byte count into a human-readable file size label.
 * @param {number|null|undefined} bytes - Size in bytes.
 * @returns {string} Human-readable size (e.g. "146 KB") or empty string.
 */
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Formats a plain numeric quantity without currency symbols.
 * @param {number|null|undefined} value - Numeric value to format.
 * @returns {string} Localized number or "—" when missing.
 */
export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('he-IL');
}
