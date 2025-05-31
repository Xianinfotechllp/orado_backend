const AccessLog = require("../models/accessLogModel");

async function logAccess({ userId, action, description, req, metadata = {} }) {
  const log = new AccessLog({
    userId,
    action,
    description,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata,
  });

  await log.save();
}

module.exports = logAccess;
