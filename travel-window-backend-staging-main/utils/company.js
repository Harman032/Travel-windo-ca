'use strict';

/**
 * Our own company block, as it appears at the head of a supplier statement.
 *
 * Nothing in the codebase held these details before — no model, no config, no environment file —
 * so they live here, in one place, rather than being typed into a template.
 *
 * The unit/street line is unresolved: the source PDF's text for it is garbled ("131§5") and the
 * client has to confirm it. Until then the statement prints the placeholder, which is visible and
 * therefore cannot be mistaken for a real address.
 */
const COMPANY = {
  name: 'TRAVEL WINDOW INC',
  // TODO: client to confirm. The PDF text for this line is corrupt.
  addressLine1: '[INPUT REQUIRED: unit / street]',
  addressLine2: 'Mississauga ON',
  phone: '+1 (905) 955-1200',
  email: 'INFO@TRAVELWINDOW.CA'
};

module.exports = { COMPANY };
