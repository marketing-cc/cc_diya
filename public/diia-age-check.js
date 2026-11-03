/*!
 * Перевірка віку 18+ через Дію на сторінці оформлення замовлення (Horoshop).
 * Активується ТІЛЬКИ на /checkout/#18. Бекенд — Vercel-функції з цього ж проєкту (api/diia/age/*).
 *
 * Підключення:  <script defer src="https://<проєкт>.vercel.app/diia-age-check.js"></script>
 * apiBase визначається з адреси скрипта; перевизначити можна через window.DIIA_AGE_CONFIG = { apiBase: '...' }.
 */
(function () {
  'use strict';

  var scriptOrigin = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) scriptOrigin = new URL(cs.src, location.href).origin;
  } catch (e) {}

  var CONFIG = {
    apiBase: scriptOrigin, // адреса Vercel-проєкту з api/diia/age/* (без слеша в кінці)
    hash: '#18',
    pathRe: /^\/checkout\/?$/,
    buttonText: 'Оформити з підтврдженням віку (+18)',
    pollIntervalMs: 2000,
    timeoutMs: 3 * 60 * 1000, // діплінк Дії живе 3 хвилини
    storageKey: 'ccshop_diia_age18',
    submitSelector: '.checkout-footer__row .j-submit'
  };
  if (window.DIIA_AGE_CONFIG) for (var k in window.DIIA_AGE_CONFIG) CONFIG[k] = window.DIIA_AGE_CONFIG[k];
  if (!CONFIG.apiBase) { console.error('[diia-age] не задано apiBase (window.DIIA_AGE_CONFIG.apiBase)'); return; }

  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var active = false;
  var pollTimer = null;
  var countdownTimer = null;
  var observer = null;
  var ui = null;

  // ---------- state (переживає перезавантаження після повернення з Дії) ----------
  function readState() {
    try { return JSON.parse(sessionStorage.getItem(CONFIG.storageKey) || 'null'); } catch (e) { return null; }
  }
  function writeState(s) {
    try { s ? sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(s)) : sessionStorage.removeItem(CONFIG.storageKey); } catch (e) {}
  }
  function isVerified() { var s = readState(); return !!(s && s.verified); }

  // ---------- робота з кнопкою ----------
  function findOriginals() {
    return Array.prototype.slice.call(document.querySelectorAll(CONFIG.submitSelector))
      .filter(function (b) { return !b.hasAttribute('data-diia-overlay'); });
  }

  function makeOverlayButton(orig) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = orig.className.replace(/\bj-submit\b/, '').replace(/\s+/g, ' ').trim(); // ті ж стилі, без хендлерів Horoshop
    btn.setAttribute('data-diia-overlay', '1');
    var span = document.createElement('span');
    span.className = 'btn-content';
    span.textContent = CONFIG.buttonText;
    btn.appendChild(span);
    btn.addEventListener('click', onVerifyClick);
    return btn;
  }

  function applyOverlay() {
    if (!active || isVerified()) return;
    findOriginals().forEach(function (orig) {
      if (orig.getAttribute('data-diia-orig')) return;
      orig.setAttribute('data-diia-orig', '1');
      orig.setAttribute('data-diia-display', orig.style.display || '');
      orig.style.display = 'none';
      orig.parentNode.insertBefore(makeOverlayButton(orig), orig.nextSibling);
    });
  }

  function removeOverlay() {
    Array.prototype.slice.call(document.querySelectorAll('[data-diia-overlay]')).forEach(function (b) { b.parentNode && b.parentNode.removeChild(b); });
    Array.prototype.slice.call(document.querySelectorAll('[data-diia-orig]')).forEach(function (o) {
      o.style.display = o.getAttribute('data-diia-display') || '';
      o.removeAttribute('data-diia-orig');
      o.removeAttribute('data-diia-display');
    });
  }

  function markVerifiedBadge() {
    var row = document.querySelector('.checkout-footer__row');
    if (!row || row.querySelector('.diia-age-badge')) return;
    var badge = document.createElement('div');
    badge.className = 'diia-age-badge';
    badge.textContent = 'Вік підтверджено через Дію';
    row.appendChild(badge);
  }

  // ---------- модальне вікно ----------
  function injectStyles() {
    if (document.getElementById('diia-age-styles')) return;
    var css = '' +
      '.diia-age-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.diia-age-box{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:24px;text-align:center;font-family:inherit;color:#111;box-shadow:0 10px 40px rgba(0,0,0,.3)}' +
      '.diia-age-box h3{margin:0 0 8px;font-size:20px}' +
      '.diia-age-box p{margin:8px 0;font-size:14px;line-height:1.4;color:#444}' +
      '.diia-age-qr{margin:16px auto;width:220px;height:220px;display:flex;align-items:center;justify-content:center}' +
      '.diia-age-qr canvas,.diia-age-qr img{width:220px!important;height:220px!important}' +
      '.diia-age-status{min-height:20px;font-weight:600;color:#222}' +
      '.diia-age-status.__error{color:#c0392b}.diia-age-status.__ok{color:#1e8449}' +
      '.diia-age-actions{display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap}' +
      '.diia-age-actions a,.diia-age-actions button{cursor:pointer;border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600;text-decoration:none}' +
      '.diia-age-open{background:#000;color:#fff}.diia-age-cancel{background:#eee;color:#222}' +
      '.diia-age-timer{font-size:12px;color:#888;margin-top:8px}' +
      '.diia-age-badge{margin-top:8px;font-size:13px;color:#1e8449;font-weight:600}';
    var st = document.createElement('style');
    st.id = 'diia-age-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function openModal() {
    injectStyles();
    closeModal();
    var modal = document.createElement('div');
    modal.className = 'diia-age-modal';
    modal.innerHTML =
      '<div class="diia-age-box" role="dialog" aria-modal="true">' +
        '<h3>Підтвердження віку 18+</h3>' +
        '<p class="diia-age-hint"></p>' +
        '<div class="diia-age-qr"></div>' +
        '<div class="diia-age-status"></div>' +
        '<div class="diia-age-timer"></div>' +
        '<div class="diia-age-actions">' +
          '<a class="diia-age-open" href="#" target="_blank" rel="noopener" style="display:none">Відкрити Дію</a>' +
          '<button type="button" class="diia-age-cancel">Скасувати</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.diia-age-cancel').addEventListener('click', function () { cancelFlow('Перевірку скасовано'); });
    ui = {
      modal: modal,
      hint: modal.querySelector('.diia-age-hint'),
      qr: modal.querySelector('.diia-age-qr'),
      status: modal.querySelector('.diia-age-status'),
      timer: modal.querySelector('.diia-age-timer'),
      open: modal.querySelector('.diia-age-open'),
      cancel: modal.querySelector('.diia-age-cancel')
    };
  }

  function closeModal() {
    if (ui && ui.modal && ui.modal.parentNode) ui.modal.parentNode.removeChild(ui.modal);
    ui = null;
  }

  function setStatus(text, cls) {
    if (!ui) return;
    ui.status.textContent = text || '';
    ui.status.className = 'diia-age-status' + (cls ? ' ' + cls : '');
  }

  function startCountdown(expiresAt) {
    stopCountdown();
    function tick() {
      if (!ui) return;
      var left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      ui.timer.textContent = left > 0 ? 'Посилання дійсне ще ' + Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2) : '';
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
  function stopCountdown() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }

  function renderDeeplink(deeplink, qrDataUrl, autoOpen) {
    if (!ui) return;
    ui.open.href = deeplink;
    if (isMobile) {
      ui.hint.textContent = 'Натисніть кнопку нижче, підтвердьте запит у застосунку Дія та поверніться на сайт.';
      ui.open.style.display = '';
      ui.open.removeAttribute('target');
      ui.qr.style.display = 'none';
      // пробуємо відкрити Дію одразу; кнопка лишається як запасний варіант
      if (autoOpen) setTimeout(function () { window.location.href = deeplink; }, 300);
    } else {
      ui.hint.textContent = 'Відскануйте QR-код камерою телефону або застосунком Дія і підтвердьте запит.';
      ui.qr.innerHTML = '';
      if (qrDataUrl) {
        var img = document.createElement('img');
        img.alt = 'QR-код для Дії';
        img.src = qrDataUrl;
        ui.qr.appendChild(img);
      } else {
        var a = document.createElement('a');
        a.href = deeplink; a.target = '_blank'; a.rel = 'noopener'; a.textContent = deeplink;
        ui.qr.appendChild(a);
      }
    }
  }

  // ---------- API ----------
  function api(method, path, body) {
    return fetch(CONFIG.apiBase + path, {
      method: method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (!r.ok) { var e = new Error(json.error || json.message || ('HTTP ' + r.status)); e.payload = json; throw e; }
        return json;
      });
    });
  }

  // ---------- flow ----------
  function onVerifyClick(ev) {
    ev.preventDefault();
    var btn = ev.currentTarget;
    btn.disabled = true;
    openModal();
    setStatus('Створюємо запит у Дію…');
    api('POST', '/api/diia/age/start', { returnLink: location.origin + location.pathname + CONFIG.hash })
      .then(function (res) {
        var expiresAt = Date.now() + CONFIG.timeoutMs;
        writeState({ requestId: res.requestId, deeplink: res.deeplink, qr: res.qr || null, expiresAt: expiresAt, verified: false });
        renderDeeplink(res.deeplink, res.qr, true);
        setStatus('Очікуємо підтвердження у Дії…');
        startCountdown(expiresAt);
        startPolling(res.requestId, expiresAt);
      })
      .catch(function (err) {
        setStatus('Не вдалося звернутися до Дії: ' + err.message, '__error');
        if (ui) ui.cancel.textContent = 'Закрити';
      })
      .then(function () { btn.disabled = false; });
  }

  function resumePending() {
    var s = readState();
    if (!s || s.verified || !s.requestId) return false;
    if (Date.now() > s.expiresAt) { writeState(null); return false; }
    openModal();
    renderDeeplink(s.deeplink, s.qr, false);
    if (isMobile) ui.hint.textContent = 'Завершіть підтвердження у застосунку Дія або натисніть кнопку нижче.';
    setStatus('Очікуємо підтвердження у Дії…');
    startCountdown(s.expiresAt);
    startPolling(s.requestId, s.expiresAt);
    return true;
  }

  function startPolling(requestId, expiresAt) {
    stopPolling();
    function poll() {
      if (Date.now() > expiresAt) {
        return failFlow('Час на підтвердження вийшов. Спробуйте ще раз.');
      }
      api('GET', '/api/diia/age/status?requestId=' + encodeURIComponent(requestId))
        .then(function (res) {
          if (res.status === 'done') {
            return res.success ? succeedFlow() : failFlow('Дія не підтвердила вік 18+. Оформлення неможливе.');
          }
          if (res.status === 'expired' || res.status === 'unknown') {
            return failFlow('Запит застарів. Спробуйте ще раз.');
          }
          if (res.diiaStatus === 'processing') setStatus('Дія обробляє запит…');
          pollTimer = setTimeout(poll, CONFIG.pollIntervalMs);
        })
        .catch(function () { pollTimer = setTimeout(poll, CONFIG.pollIntervalMs * 2); });
    }
    poll();
  }
  function stopPolling() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }

  function succeedFlow() {
    stopPolling(); stopCountdown();
    var s = readState() || {};
    s.verified = true; s.verifiedAt = Date.now();
    writeState(s);
    setStatus('Вік підтверджено. Можете оформити замовлення.', '__ok');
    if (ui) { ui.hint.textContent = ''; ui.timer.textContent = ''; ui.qr.style.display = 'none'; ui.open.style.display = 'none'; ui.cancel.textContent = 'Продовжити'; }
    removeOverlay();
    markVerifiedBadge();
    setTimeout(closeModal, 1500);
  }

  function failFlow(msg) {
    stopPolling(); stopCountdown();
    writeState(null);
    setStatus(msg, '__error');
    if (ui) { ui.hint.textContent = ''; ui.timer.textContent = ''; ui.qr.style.display = 'none'; ui.open.style.display = 'none'; ui.cancel.textContent = 'Закрити'; }
  }

  function cancelFlow() {
    stopPolling(); stopCountdown();
    if (!isVerified()) writeState(null);
    closeModal();
  }

  // ---------- bootstrap ----------
  function activate() {
    if (active) return;
    active = true;
    injectStyles();
    if (isVerified()) { markVerifiedBadge(); }
    else {
      applyOverlay();
      resumePending();
    }
    // Horoshop перемальовує чекаут при зміні доставки/оплати — повторно накриваємо кнопку
    observer = new MutationObserver(function () {
      if (isVerified()) { removeOverlay(); markVerifiedBadge(); }
      else applyOverlay();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function shouldActivate() {
    return CONFIG.pathRe.test(location.pathname) && location.hash === CONFIG.hash;
  }

  function init() {
    if (shouldActivate()) activate();
    window.addEventListener('hashchange', function () { if (shouldActivate()) activate(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
