'use strict';
// GET /api/diia/age/status?requestId=<uuid> -> { status: pending|done|expired|unknown, success, diiaStatus }
const d = require('../../../lib/diia');

module.exports = d.handler(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const requestId = url.searchParams.get('requestId');
  if (!d.isUuid(requestId)) return d.json(res, 400, { error: 'requestId must be UUID' });

  const r = await d.getRequest(requestId);
  if (!r) return d.json(res, 200, { status: 'unknown', success: null });
  if (r.status === 'done') return d.json(res, 200, { status: 'done', success: r.success });
  if (Date.now() - r.createdAt > d.CFG.deeplinkTtlMs + 30 * 1000) return d.json(res, 200, { status: 'expired', success: null });

  // Callback може не дійти (URL не зареєстрований у Дії). Статус Дії — друге джерело істини.
  const diia = await d.diiaStatus(requestId);
  const interpreted = d.interpretOfferStatus(diia.status, diia.success);
  if (interpreted.done) {
    r.status = 'done';
    r.success = interpreted.success;
    r.doneAt = Date.now();
    r.diiaStatus = diia.status;
    await d.saveRequest(requestId, r);
    console.log(`[status] ${requestId} diia=${diia.status} success=${r.success} region=${process.env.VERCEL_REGION || '-'}`);
    return d.json(res, 200, { status: 'done', success: r.success, diiaStatus: diia.status });
  }

  d.json(res, 200, { status: 'pending', success: null, diiaStatus: diia.status });
});
