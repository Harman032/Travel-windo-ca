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

module.exports = { RECEIVING_ACCOUNTS };
