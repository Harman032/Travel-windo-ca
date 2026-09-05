'use strict';

const MAX_SEARCH_LENGTH = 100;

// Escapes regex metacharacters so user-provided search text is matched literally,
// preventing both incorrect matches from special characters and catastrophic
// regex patterns built from attacker-controlled input.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Caps length and escapes a raw search term for use in a $regex filter.
// Returns null if the input is missing/empty after trimming, or exceeds the
// length limit — callers treat null as "invalid, reject or skip this filter".
function safeSearchTerm(value, maxLength = MAX_SEARCH_LENGTH) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return escapeRegex(trimmed);
}

module.exports = { escapeRegex, safeSearchTerm, MAX_SEARCH_LENGTH };
