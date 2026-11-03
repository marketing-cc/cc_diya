#!/usr/bin/env node
'use strict';
/**
 * Локальний запуск без Vercel CLI: емулює роутинг Vercel для api/** і роздає public/.
 *   node tools/dev-server.js        (порт PORT або 3000; читає .env з кореня)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MIME = { '.js': 'application/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png' };

function resolveApi(pathname) {
  const rel = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!/^api(\/|$)/.test(rel) && rel !== 'health') return null; // /health — rewrite з vercel.json
  const inner = rel === 'health' ? 'health' : rel.replace(/^api\/?/, '');
  if (!inner) return null;
  const candidates = [path.join(root, 'api', inner + '.js'), path.join(root, 'api', inner, 'index.js')];
  return candidates.find((f) => f.startsWith(path.join(root, 'api')) && fs.existsSync(f));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const apiFile = resolveApi(url.pathname);
  if (apiFile) {
    delete require.cache[require.resolve(apiFile)]; // гаряче перезавантаження
    const handler = require(apiFile);
    // мінімальна емуляція Vercel Node runtime
    req.query = Object.fromEntries(url.searchParams);
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
    try { await handler(req, res); } catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); } }
    return;
  }
  const file = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (file.startsWith(path.join(root, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"not found"}');
}).listen(Number(process.env.PORT || 3000), () => console.log(`dev server http://localhost:${process.env.PORT || 3000}`));
