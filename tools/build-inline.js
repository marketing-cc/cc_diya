#!/usr/bin/env node
'use strict';
/**
 * Генерує horoshop/diia-age-check.html — inline-варіант (<script defer>(function(){...})()</script>)
 * з public/diia-age-check.js. Використовувати, якщо в Horoshop хочеться вставити код, а не <script src>.
 *
 *   node tools/build-inline.js https://<проєкт>.vercel.app
 */
const fs = require('fs');
const path = require('path');

const apiBase = (process.argv[2] || process.env.API_BASE || 'https://ВАШ-ПРОЄКТ.vercel.app').replace(/\/+$/, '');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'diia-age-check.js'), 'utf8');

const html = `<!--
  Перевірка віку (18+) через Дію на сторінці оформлення замовлення.
  Horoshop → Налаштування → Сайт → Код HTML/JS → перед </body>.
  Активується ТІЛЬКИ на https://ccshop.com.ua/checkout/#18
  Бекенд: Vercel-функції (api/diia/age/*), адреса — у window.DIIA_AGE_CONFIG.apiBase нижче.

  Альтернатива одним рядком (той самий код, роздається з Vercel):
  <script defer src="${apiBase}/diia-age-check.js"></script>

  Згенеровано: node tools/build-inline.js ${apiBase}
-->
<script defer>
window.DIIA_AGE_CONFIG = { apiBase: '${apiBase}' };
${src.trim()}
</script>
`;

const out = path.join(__dirname, '..', 'horoshop', 'diia-age-check.html');
fs.writeFileSync(out, html);
console.log(`written ${path.relative(process.cwd(), out)} (apiBase=${apiBase})`);
