'use strict';

/**
 * Our own company block, as it appears at the head of a supplier statement.
 *
 * Nothing in the codebase held these details before — no model, no config, no environment file —
 * so they live here, in one place, rather than being typed into a template.
 *
 * The address comes from two wholesaler invoices addressed to Travel Window, not from the source
 * statement PDF, whose text for the unit/street line is garbled ("131§5") and is what the
 * placeholder stood in for. Two independent documents agreeing is why it is printed rather than
 * left as a placeholder; the client has still to confirm it, and this is the one line to change if
 * they come back with something else.
 */
const COMPANY = {
  name: 'TRAVEL WINDOW INC',
  addressLine1: 'Unit 131, 1065 Canadian Place',
  addressLine2: 'Mississauga ON L4W 0C2',
  phone: '+1 (905) 955-1200',
  email: 'INFO@TRAVELWINDOW.CA'
};

module.exports = { COMPANY };
