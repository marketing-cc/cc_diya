#!/usr/bin/env node
'use strict';
/**
 * Утиліта для налаштування Дії (відділення + офер для перевірки віку).
 *
 *   node tools/diia-setup.js branches            — список відділень
 *   node tools/diia-setup.js offers <branchId>   — список оферів відділення
 *   node tools/diia-setup.js create              — створити відділення + офер (age-range) і вивести ID для .env
 *   node tools/diia-setup.js delete <branchId>   — видалити відділення
 *
 * Читає DIIA_HOST, DIIA_ACQUIRER_TOKEN, DIIA_AUTH_ACQUIRER_TOKEN з оточення або ../.env
 */
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const HOST = (process.env.DIIA_HOST || 'https://api2s.diia.gov.ua').replace(/\/+$/, '');
const ACQ = process.env.DIIA_ACQUIRER_TOKEN;
const AUTH = process.env.DIIA_AUTH_ACQUIRER_TOKEN;
if (!ACQ || !AUTH) { console.error('Потрібні DIIA_ACQUIRER_TOKEN і DIIA_AUTH_ACQUIRER_TOKEN'); process.exit(1); }

const BRANCH = {
  name: process.env.BRANCH_NAME || 'CC Shop — перевірка віку (checkout)',
  email: process.env.BRANCH_EMAIL || 'info@ccshop.com.ua',
  region: 'Київська обл.', district: 'м. Київ', location: 'м. Київ', street: 'вул. Хрещатик', house: '1',
  deliveryTypes: ['api'],
  offerRequestType: 'dynamic',
  scopes: { documentIdentification: ['age-range'] },
};
const OFFER = {
  name: 'Підтвердження віку 18+ (ccshop.com.ua)',
  returnLink: process.env.RETURN_LINK || 'https://ccshop.com.ua/checkout/#18',
  scopes: { documentIdentification: ['age-range'] },
};

async function token() {
  const r = await fetch(`${HOST}/api/v1/auth/acquirer/${encodeURIComponent(ACQ)}`, { headers: { Accept: 'application/json', Authorization: `Basic ${AUTH}` } });
  const b = await r.json();
  if (!r.ok || !b.token) throw new Error(`auth: ${r.status} ${JSON.stringify(b)}`);
  return b.token;
}

async function call(t, method, p, body) {
  const r = await fetch(`${HOST}${p}`, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let b; try { b = JSON.parse(text); } catch { b = text; }
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${JSON.stringify(b)}`);
  return b;
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  const t = await token();
  switch (cmd) {
    case 'branches':
      console.log(JSON.stringify(await call(t, 'GET', '/api/v2/acquirers/branches?skip=0&limit=100'), null, 2)); break;
    case 'offers':
      if (!arg) throw new Error('offers <branchId>');
      console.log(JSON.stringify(await call(t, 'GET', `/api/v1/acquirers/branch/${arg}/offers?skip=0&limit=100`), null, 2)); break;
    case 'create': {
      const { _id: branchId } = await call(t, 'POST', '/api/v2/acquirers/branch', BRANCH);
      const { _id: offerId } = await call(t, 'POST', `/api/v1/acquirers/branch/${branchId}/offer`, OFFER);
      console.log(`DIIA_BRANCH_ID=${branchId}\nDIIA_OFFER_ID=${offerId}`); break;
    }
    case 'delete':
      if (!arg) throw new Error('delete <branchId>');
      await call(t, 'DELETE', `/api/v2/acquirers/branch/${arg}`); console.log('deleted'); break;
    default:
      console.log('Команди: branches | offers <branchId> | create | delete <branchId>');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
