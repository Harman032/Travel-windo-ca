'use strict';
// Drives the real reports router over HTTP against in-memory bookings: Booking.find
// is replaced by a tiny evaluator for the Mongo query forms the report routes build
// ($and/$or, equality, $gte/$lte, $ne, dotted paths through arrays).
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');

const idOf = v => String(v && typeof v === 'object' && v._id ? v._id : v);

function values(doc, path) {
  let vals = [doc];
  for (const p of path.split('.')) {
    vals = vals.flatMap(v => (v == null ? [] : Array.isArray(v) ? v.map(x => x && x[p]) : [v[p]]));
  }
  return vals.flatMap(v => (Array.isArray(v) ? v : [v]));
}

function condMatches(val, cond) {
  const isOp = cond && typeof cond === 'object' && !(cond instanceof Date) &&
    Object.keys(cond).some(k => k.startsWith('$'));
  if (!isOp) return idOf(val) === idOf(cond);
  if (cond.$gte && !(val != null && new Date(val) >= cond.$gte)) return false;
  if (cond.$lte && !(val != null && new Date(val) <= cond.$lte)) return false;
  if (cond.$ne !== undefined && idOf(val) === idOf(cond.$ne)) return false;
  return true;
}

function matches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$and') return v.every(c => matches(doc, c));
    if (k === '$or') return v.some(c => matches(doc, c));
    const vals = values(doc, k);
    if (v && typeof v === 'object' && v.$ne !== undefined) return vals.every(x => condMatches(x, v));
    return vals.some(x => condMatches(x, v));
  });
}

// select() is APPLIED, not ignored. A no-op select hides a whole class of bug: a route whose
// projection omits a field the downstream code reads gets `undefined` from Mongoose and quietly
// computes something wrong, while a test that ignores the projection passes. That is exactly how
// paymentFromCard and supplierCharges went missing from the statement route.
//
// Nested paths ('cancellation.supplierWillReturn') and exclusion syntax ('-password') are both
// handled. Neither is reachable from a reports route today, but getting either wrong makes the
// harness lie in the opposite direction: a naive top-level lookup drops a nested projection
// entirely, and exclusion syntax would collapse the document to { _id }. Both would read as a
// failing route rather than a failing double.
//
// Exported so tests/report-harness.test.js can check it. A test double that has logic of its own
// needs its own test; this one has already hidden a production defect once.
const dig = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const plant = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  let cur = o;
  for (const k of ks) cur = (cur[k] = cur[k] || {});
  cur[last] = v;
};
function project(doc, fields) {
  if (!fields) return doc;
  const names = String(fields).split(/\s+/).filter(Boolean);
  if (!names.length) return doc;

  // Mongo forbids mixing inclusion with exclusion (except _id), so the first name decides.
  if (names[0].startsWith('-')) {
    const out = { ...doc };
    for (const n of names) if (n.startsWith('-')) delete out[n.slice(1)];
    return out;
  }

  const out = {};
  for (const n of names) {
    const v = dig(doc, n);
    if (v !== undefined) plant(out, n, v);
  }
  if (!names.includes('-_id') && doc._id !== undefined) out._id = doc._id;
  return out;
}

async function startReports(routerPath, bookings) {
  const cmp = (x, y) => {
    const nx = x instanceof Date ? x.getTime() : x;
    const ny = y instanceof Date ? y.getTime() : y;
    if (typeof nx === 'number' && typeof ny === 'number') return nx - ny;
    return String(nx).localeCompare(String(ny));
  };
  // Honors sort/skip/limit like Mongo does, so truncation bugs show up in tests.
  //
  Booking.find = q => {
    const docs = bookings.filter(b => matches(b, q || {}));
    let sortSpec = null, skipN = 0, limitN = Infinity, projection = null;
    const chain = {
      populate: () => chain, lean: () => chain,
      select: f => { projection = f; return chain; },
      sort: s => { sortSpec = s; return chain; },
      skip: n => { skipN = n; return chain; },
      limit: n => { limitN = n; return chain; },
      then: (res, rej) => {
        // Sort FIRST, then project. Mongo sorts the stored document, so a route that sorts on a
        // field it does not project still gets the right order; projecting first sorts on
        // undefined and silently returns insertion order.
        const out = docs.slice();
        if (sortSpec) {
          out.sort((a, b) => {
            for (const [k, dir] of Object.entries(sortSpec)) {
              const c = cmp(a[k], b[k]);
              if (c) return c * dir;
            }
            return 0;
          });
        }
        return Promise.resolve(out.slice(skipN, skipN + limitN).map(d => project(d, projection)))
          .then(res, rej);
      }
    };
    return chain;
  };
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN', isActive: true, name: 'Admin' };
  User.findById = () => ({ select: () => Promise.resolve(admin) });
  const token = jwt.sign({ userId: String(admin._id), role: 'ADMIN' }, process.env.JWT_SECRET || 'your_jwt_secret_key_here');

  const app = express();
  app.use('/api/reports', require(routerPath));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/reports`;
  return {
    get: async (path, params = {}) => {
      const res = await fetch(`${base}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    close: () => server.close()
  };
}

module.exports = { startReports, project };
