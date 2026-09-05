'use strict';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// Resolves page/limit query params to safe positive integers so malformed
// values (?page=foo, ?limit=-5, ?limit=999999999) never reach MongoDB as NaN
// or an unbounded limit. Defaults match the existing behavior of this API.
function resolvePagination(page, limit) {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  const validPage = (isNaN(parsedPage) || parsedPage < 1) ? 1 : parsedPage;
  const limitNum = (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT)
    ? DEFAULT_LIMIT
    : parsedLimit;

  const skipNum = (validPage - 1) * limitNum;

  return { page: validPage, limit: limitNum, skip: skipNum };
}

module.exports = { resolvePagination, MAX_LIMIT, DEFAULT_LIMIT };
