'use strict';

// Strict numeric string: optional leading '-', digits, optional decimal portion.
// Rejects things like "100XYZ" that parseFloat() would silently accept as 100.
const STRICT_NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Parses a financial input strictly. Blank string is treated as "not provided"
 * (matches existing `value || 0` / `value != null` fallback behavior elsewhere
 * in this codebase) and resolves to 0. Anything else that isn't a clean finite
 * number is rejected rather than silently coerced.
 */
function parseStrictNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return { ok: true, value: 0 };
    if (!STRICT_NUMBER_RE.test(trimmed)) return { ok: false };
    const n = Number(trimmed);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  return { ok: false };
}

/**
 * Validates a { fieldName: value } map of financial inputs. undefined/null
 * values are treated as "not provided" and skipped — callers already branch
 * on presence before applying their own defaults, so this only rejects values
 * that were actually sent and are malformed.
 * Returns the first invalid field name, or null if everything provided is valid.
 */
function validateFinancialFields(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (!parseStrictNumber(value).ok) return name;
  }
  return null;
}

module.exports = { parseStrictNumber, validateFinancialFields };
