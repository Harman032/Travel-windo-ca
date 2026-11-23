'use strict';

/**
 * The bank accounts an E-Transfer can be received into. Last four digits only -- a payments list
 * or a statement never needs the full number, and storing it would put account numbers on a
 * screen several roles can read.
 *
 * A CONSTANT, not an admin-editable Settings list. There is no Settings collection in this
 * codebase, so an editable list means a model, a route, an admin screen, a cache, and a decision
 * about what happens to rows pointing at a deleted account. Two accounts that change about once a
 * year do not earn that; adding a third is a one-line commit. Mirrored once in the frontend.
 *
 * It lives here rather than in models/Booking.js so that utils/payment-rows.js can validate
 * against it without a util importing a model -- nothing in utils/ does, and this is not the
 * place to start. models/Booking.js re-exports it as Booking.RECEIVING_ACCOUNTS, alongside
 * PAYMENT_MODES, so there is still exactly one definition.
 */
const RECEIVING_ACCOUNTS = ['RBC 6336', 'TD 0638'];

/**
 * The payment modes that arrive IN one of our bank accounts, and so can meaningfully be asked
 * which one. E-Transfer is the current mode; Cheque and Bank Transfer are the legacy values it
 * replaced, offered by no dropdown but still carried by ~500 stored rows.
 *
 * This is what makes the bank filter's "Not recorded" mean something. Without it the predicate
 * was just "has no receivingAccount", which is also true of every Cash, Credit Card, Machine
 * Charge, UPI, Kotak Bank, Kotak Bank UPI, Travobirds and SkyLight row -- none of which is a
 * bank deposit and none of which could ever have an account recorded against it. "Not recorded"
 * has to mean "should name an account and does not", or it reads as a data-quality backlog of
 * 2,858 rows when the real figure is the bank-deposit rows alone.
 *
 * So: RBC + TD + Not recorded = the BANK_DEPOSIT_MODES rows, not every payment row.
 */
const BANK_DEPOSIT_MODES = ['E-Transfer', 'Cheque', 'Bank Transfer'];

/**
 * The two bank-deposit modes E-Transfer replaced. Kept in PAYMENT_MODES because ~500 stored rows
 * carry them, offered by no dropdown, and -- see utils/payment-rows.js -- not accepted on a row
 * that cannot be an edit of a stored one.
 */
const LEGACY_DEPOSIT_MODES = BANK_DEPOSIT_MODES.filter(m => m !== 'E-Transfer');

module.exports = { RECEIVING_ACCOUNTS, BANK_DEPOSIT_MODES, LEGACY_DEPOSIT_MODES };
