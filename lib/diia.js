'use strict';
/**
 * Спільна логіка для Vercel-функцій (api/**): конфіг, клієнт API Дії, сховище, CORS, QR.
 * Node.js >= 18 (глобальний fetch). Залежності: `qrcode`, `@vercel/blob`.
 * Сховище (за пріоритетом): Upstash Redis → Vercel Blob → пам'ять процесу (лише для локалки).
 */
const crypto = require('crypto');
const QRCode = require('qrcode');

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const required = (k) => { const v = env(k); if (!v) throw new Error(`Відсутня змінна оточення ${k}`); return v; };

const CFG = {
  diiaHost: env('DIIA_HOST', 'https://api2s.diia.gov.ua').replace(/\/+$/, ''),
  get acquirerToken() { return required('DIIA_ACQUIRER_TOKEN'); },
  get authAcquirerToken() { return required('DIIA_AUTH_ACQUIRER_TOKEN'); },
  get branchId() { return required('DIIA_BRANCH_ID'); },
  get offerId() { return required('DIIA_OFFER_ID'); },
  minAge: Number(env('MIN_AGE', 18)),
  defaultReturnLink: env('RETURN_LINK', 'https://ccshop.com.ua/checkout/#18'),
  allowedOrigins: env('ALLOWED_ORIGINS', 'https://ccshop.com.ua').split(',').map((s) => s.trim()).filter(Boolean),
  callbackToken: env('CALLBACK_TOKEN', ''),
  requestTtlSec: Number(env('REQUEST_TTL_SEC', 15 * 60)),
  deeplinkTtlMs: 3 * 60 * 1000,
  sessionTokenTtlSec: Number(env('SESSION_TOKEN_TTL_SEC', 110 * 60)), // токен Дії живе 2 год
};

// ---------- сховище: Upstash Redis (REST) або пам'ять процесу ----------
const redisUrl = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
const redisToken = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
const PREFIX = env('REDIS_PREFIX', 'diia-age:');

const memory = new Map(); // fallback: лише для локальної розробки / одного теплого інстансу
let memoryWarned = false;

async function redis(cmd) {
  const res = await fetch(redisUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Redis: ${body.error || res.status}`);
  return body.result;
}

// ---------- Vercel Blob (рідне сховище Vercel, змінна BLOB_READ_WRITE_TOKEN) ----------
// Кожен ключ — окремий JSON-файл; TTL реалізовано полем exp (старі файли прибираються при запиті).
const blobToken = env('BLOB_READ_WRITE_TOKEN');
let blobSdk = null;
const blob = () => (blobSdk || (blobSdk = require('@vercel/blob')));
const BLOB_PREFIX = env('BLOB_PREFIX', 'diia-age/');
const blobPath = (key) => `${BLOB_PREFIX}${key.replace(/[^a-zA-Z0-9:_-]/g, '_').replace(/:/g, '/')}.json`;

async function readStream(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

const backends = {
  async blobGet(key) {
    const r = await blob().get(blobPath(key), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    const e = JSON.parse(await readStream(r.stream));
    if (e.exp && Date.now() > e.exp) return null;
    return e.value;
  },
  async blobSet(key, value, ttlSec) {
    await blob().put(blobPath(key), JSON.stringify({ value, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 }), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60,
    });
  },
};

const store = {
  kind: redisUrl && redisToken ? 'redis' : blobToken ? 'blob' : 'memory',
  async get(key) {
    if (this.kind === 'redis') { const v = await redis(['GET', PREFIX + key]); return v ? JSON.parse(v) : null; }
    if (this.kind === 'blob') return backends.blobGet(key);
    const e = memory.get(key);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { memory.delete(key); return null; }
    return e.value;
  },
  async set(key, value, ttlSec) {
    if (this.kind === 'redis') return redis(['SET', PREFIX + key, JSON.stringify(value), 'EX', String(ttlSec)]);
    if (this.kind === 'blob') return backends.blobSet(key, value, ttlSec);
    if (!memoryWarned) { memoryWarned = true; console.warn('[store] Немає ні Redis (KV_REST_API_URL/TOKEN), ні Blob (BLOB_READ_WRITE_TOKEN) — стан у пам\'яті процесу; на Vercel це НЕнадійно.'); }
    memory.set(key, { value, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
  },
};

// ---------- клієнт API Дії ----------
async function fetchSessionToken() {
  const res = await fetch(`${CFG.diiaHost}/api/v1/auth/acquirer/${encodeURIComponent(CFG.acquirerToken)}`, {
    headers: { Accept: 'application/json', Authorization: `Basic ${CFG.authAcquirerToken}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(`Diia auth failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  await store.set('session', { token: body.token, obtainedAt: Date.now() }, CFG.sessionTokenTtlSec);
  console.log('[diia] session token refreshed');
  return body.token;
}

async function getSessionToken(force = false) {
  if (!force) { const s = await store.get('session'); if (s && s.token) return s.token; }
  return fetchSessionToken();
}

async function diiaFetch(pathname, init = {}, retry = true) {
  const token = await getSessionToken();
  const res = await fetch(`${CFG.diiaHost}${pathname}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && retry) { await getSessionToken(true); return diiaFetch(pathname, init, false); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.message || `Diia HTTP ${res.status}`); e.status = res.status; e.body = body; throw e; }
  return body;
}

async function createDeeplink(requestId, returnLink) {
  return diiaFetch(`/api/v2/acquirers/branch/${encodeURIComponent(CFG.branchId)}/offer-request/dynamic`, {
    method: 'POST',
    body: JSON.stringify({ offerId: CFG.offerId, requestId, returnLink, processCustomization: { minAge: CFG.minAge } }),
  });
}

async function diiaStatus(requestId) {
  try {
    const r = await diiaFetch(`/api/v1/acquirers/offer-request/status?requestId=${encodeURIComponent(requestId)}`);
    return r.status || null;
  } catch { return null; }
}

// ---------- запити ----------
const reqKey = (id) => `req:${id}`;
const getRequest = (id) => store.get(reqKey(id));
const saveRequest = (id, data) => store.set(reqKey(id), data, CFG.requestTtlSec);

// ---------- HTTP-хелпери (Vercel Node runtime: req/res як у Node http + res.status/json) ----------
const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function isAllowedOrigin(origin) {
  return !!origin && (CFG.allowedOrigins.includes('*') || CFG.allowedOrigins.includes(origin));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

function json(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** Тіло запиту: Vercel парсить JSON сам, але Дія може надіслати Content-Type з помилкою ("aplication/json"). */
async function readJson(req, limit = 64 * 1024) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return text.trim() ? JSON.parse(text) : {};
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { reject(new Error('payload too large')); req.destroy(); } });
    req.on('end', () => { if (!data.trim()) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}

function safeReturnLink(candidate) {
  try {
    const u = new URL(candidate);
    if (isAllowedOrigin(u.origin)) return u.toString();
  } catch {}
  return CFG.defaultReturnLink;
}

/** Обгортка хендлера: CORS, preflight, метод, помилки. */
function handler(methods, fn) {
  return async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (!methods.includes(req.method)) return json(res, 405, { error: 'method not allowed' });
    try { await fn(req, res); }
    catch (e) { console.error('[handler]', e); json(res, 500, { error: 'internal error', details: e.message }); }
  };
}

const qrDataUrl = (text) => QRCode.toDataURL(text, { margin: 1, width: 440, errorCorrectionLevel: 'M' }).catch(() => null);

module.exports = {
  CFG, store, crypto, isUuid, isAllowedOrigin, json, readJson, safeReturnLink, handler, qrDataUrl,
  getSessionToken, diiaFetch, createDeeplink, diiaStatus, getRequest, saveRequest,
};
