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

async function startReports(routerPath, bookings) {
  Booking.find = q => {
    const docs = bookings.filter(b => matches(b, q || {}));
    const chain = { populate: () => chain, sort: () => chain, skip: () => chain, limit: () => chain,
      then: (res, rej) => Promise.resolve(docs).then(res, rej) };
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

module.exports = { startReports };
