'use strict';
// GET /health -> стан конфігурації (без секретів)
const d = require('../lib/diia');

module.exports = d.handler(['GET'], async (req, res) => {
  let branch = null, offer = null;
  try { branch = d.CFG.branchId.slice(0, 8) + '…'; offer = d.CFG.offerId.slice(0, 8) + '…'; } catch {}
  d.json(res, 200, {
    ok: true,
    diiaHost: d.CFG.diiaHost,
    storage: d.store.kind,
    branch, offer,
    minAge: d.CFG.minAge,
    allowedOrigins: d.CFG.allowedOrigins,
    region: process.env.VERCEL_REGION || null,
  });
});
