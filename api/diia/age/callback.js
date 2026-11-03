'use strict';
// POST /api/diia/age/callback <- Дія: { requestId, status: "done", success: true|false }
// Заголовок X-Document-Request-Trace-Id (у будь-якому регістрі — Node нормалізує до нижнього).
// Повну URL цього ендпоінта треба передати команді Дії як "точку інтеграції партнера".
const d = require('../../../lib/diia');

module.exports = d.handler(['POST'], async (req, res) => {
  if (d.CFG.callbackToken) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${d.CFG.callbackToken}`) return d.json(res, 401, { error: 'unauthorized' });
  }

  let body;
  try { body = await d.readJson(req); } catch (e) { return d.json(res, 400, { error: e.message }); }
  const traceId = req.headers['x-document-request-trace-id'] || null;
  const requestId = body.requestId;
  console.log(`[callback] trace=${traceId} body=${JSON.stringify(body)}`);
  if (!d.isUuid(requestId)) return d.json(res, 400, { error: 'requestId must be UUID' });

  const r = (await d.getRequest(requestId)) || { createdAt: Date.now(), deeplink: null };
  r.status = 'done';
  r.success = body.success === true;
  r.traceId = traceId;
  r.doneAt = Date.now();
  await d.saveRequest(requestId, r);
  d.json(res, 200, { success: true });
});
