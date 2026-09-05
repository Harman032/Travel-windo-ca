const crypto = require('crypto');

// Assigns a short correlation ID to every request, used in server logs and
// returned to the client on 500s so QA/support can reference a specific failure.
const requestId = (req, res, next) => {
  req.id = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
