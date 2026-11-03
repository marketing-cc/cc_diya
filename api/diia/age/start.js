'use strict';
// POST /api/diia/age/start -> { requestId, deeplink, qr, expiresAt, minAge }
const d = require('../../../lib/diia');

module.exports = d.handler(['POST'], async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !d.isAllowedOrigin(origin)) return d.json(res, 403, { error: 'origin not allowed' });

  const body = await d.readJson(req).catch(() => ({}));
  const requestId = d.crypto.randomUUID();
  const returnLink = d.safeReturnLink(body.returnLink || d.CFG.defaultReturnLink);

  try {
    const { deeplink } = await d.createDeeplink(requestId, returnLink);
    await d.saveRequest(requestId, { createdAt: Date.now(), status: 'pending', success: null, deeplink, traceId: null, doneAt: null });
    const qr = await d.qrDataUrl(deeplink);
    console.log(`[start] ${requestId} -> ${deeplink}`);
    d.json(res, 200, { requestId, deeplink, qr, expiresAt: Date.now() + d.CFG.deeplinkTtlMs, minAge: d.CFG.minAge });
  } catch (e) {
    console.error('[start] diia error:', e.status, e.body || e.message);
    d.json(res, 502, { error: 'Дія недоступна або повернула помилку', details: e.body || e.message });
  }
});
