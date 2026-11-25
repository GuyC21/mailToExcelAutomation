/**
 * Shared form-state mapping utilities for document extraction schemas.
 *
 * Used by both `LabelForm` (ground-truth authoring) and `ReviewEditorForm`
 * (human-in-the-loop invoice review) so both screens serialize numeric/null
 * fields identically without NaN bugs.
 */

export const EMPTY_EXPECTED = {
  document_type: '',
  document_number: '',
  document_date: '',
  billing_period_start: '',
  billing_period_end: '',
  due_date: '',
  supplier_name: '',
  supplier_tax_id: '',
  customer_name: '',
  currency: 'ILS',
  payment_terms: '',
  line_items: [],
  subtotal: '',
  vat_rate: '',
  vat_amount: '',
  total_amount: '',
};

/**
 * Seeds controlled string form state from a stored extraction payload.
 * Missing/null values become empty strings so inputs stay controlled.
 * @param {object|null|undefined} expected - Stored extraction dictionary.
 * @returns {object} Controlled form state object.
 */
export function toFormState(expected) {
  if (!expected) return { ...EMPTY_EXPECTED, line_items: [] };
  const blank = (v) => (v === null || v === undefined ? '' : String(v));
  const state = { ...EMPTY_EXPECTED };
  Object.keys(EMPTY_EXPECTED).forEach((key) => {
    if (key !== 'line_items' && key in expected) {
      state[key] = blank(expected[key]);
    }
  });
  state.currency = expected.currency || 'ILS';
  state.line_items = (expected.line_items || []).map((line) => ({
    service_date: blank(line.service_date),
    description: blank(line.description),
    quantity: blank(line.quantity),
    unit_price: blank(line.unit_price),
    line_total: blank(line.line_total),
  }));
  return state;
}

/**
 * Converts controlled string form state back into the numeric/null JSON shape
 * expected by `schemas.extraction.DocumentExtraction`.
 * @param {object} fields - Controlled form state dictionary.
 * @param {string[]} [existingNotes=[]] - Existing extraction notes to preserve.
 * @returns {object} Normalized extraction payload safe for backend validation.
 */
export function toPayload(fields, existingNotes = []) {
  const num = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const str = (v) => (v === '' || v === undefined || v === null ? null : String(v));

  return {
    document_type: str(fields.document_type),
    document_number: str(fields.document_number),
    document_date: str(fields.document_date),
    billing_period_start: str(fields.billing_period_start),
    billing_period_end: str(fields.billing_period_end),
    due_date: str(fields.due_date),
    supplier_name: str(fields.supplier_name),
    supplier_tax_id: str(fields.supplier_tax_id),
    customer_name: str(fields.customer_name),
    currency: fields.currency || 'ILS',
    payment_terms: str(fields.payment_terms),
    subtotal: num(fields.subtotal),
    vat_rate: num(fields.vat_rate),
    vat_amount: num(fields.vat_amount),
    total_amount: num(fields.total_amount),
    line_items: (fields.line_items || []).map((line, idx) => ({
      line_number: idx + 1,
      service_date: str(line.service_date),
      description: line.description || '',
      quantity: num(line.quantity),
      unit_price: num(line.unit_price),
      line_total: num(line.line_total),
    })),
    extraction_notes: Array.isArray(existingNotes) ? existingNotes : [],
  };
}
