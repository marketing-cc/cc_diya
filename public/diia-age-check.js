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
    buttonText: 'Підтврдження віку (+18)',
    pollIntervalMs: 2000,
    timeoutMs: 3 * 60 * 1000, // діплінк Дії живе 3 хвилини
    storageKey: 'ccshop_diia_age18',
    submitSelector: '.checkout-footer__row .j-submit'
  };
  if (window.DIIA_AGE_CONFIG) for (var k in window.DIIA_AGE_CONFIG) CONFIG[k] = window.DIIA_AGE_CONFIG[k];
  if (!CONFIG.apiBase) { console.error('[diia-age] не задано apiBase (window.DIIA_AGE_CONFIG.apiBase)'); return; }

  // Логотип Дія — вектор (брендбук Дії: растр заборонено). Не змінювати пропорції, радіус, шрифт і заливку.
  // Основна версія — для світлого фону; контурна — для темного (чорні кнопки).
  var LOGO_FILLED = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" role=\"img\" aria-label=\"Дія\"><path fill=\"#000\" fill-rule=\"evenodd\" d=\"M389 1023.4C259.2 1020.9 191.3 1009.9 137.7 983C91 959.4 55.4 921.4 34.5 872.6C15.2 827.2 5.9 772.9 1.8 680.5C0 641.6 0 382.4 1.8 343.5C7.5 215.4 24.3 151.1 65.6 99.3C107.4 46.9 165.7 19.6 260 8.1C307.8 2.2 343.2 1 477 0.3C695 -0.8 763.7 3.1 829.5 20C885.1 34.3 927.2 60.2 958.4 99.3C999.7 151.2 1016.6 215.9 1022.2 344C1023.9 383.5 1023.9 640.5 1022.2 680C1016 821.2 995.2 889.7 942.5 942.5C890.3 994.6 821.5 1015.9 684.5 1022.1C662.6 1023.1 426.5 1024.1 389 1023.4ZM387.7 679.4C387.3 679 387 665.9 387 650.3L387 622L309.5 622L232 622L232 650.5L232 679L211 679L190 679L190 631L190 583L199.8 583L209.6 583L212.7 577.8C220.7 564.5 227.5 544.3 231.7 521.5L234.3 507.5L234.7 434.8L235.2 362L317.1 362L399 362L399 472.5L399 583L414 583L429 583L428.8 631.2L428.5 679.5L408.4 679.8C397.4 679.9 388.1 679.7 387.7 679.4ZM508.4 626C491.9 622.5 479.2 607.4 478.2 590C477.8 583 478.3 580.4 483.9 559.9C494.8 520 500.1 500.6 502 493.5C510.2 463.2 513 453.3 513.5 451.8C514.2 450.1 512.4 450 485.1 450C469.1 450 456 449.7 456 449.2C456.1 448.8 459.1 440.2 462.9 430L469.6 411.5L519.3 411.2C546.6 411.1 569 411.2 569 411.5C569 411.7 567.7 416.6 566.1 422.2C564.4 427.9 558.3 449.4 552.5 470C546.6 490.6 537.1 524.1 531.4 544.5C525.6 564.9 520.5 582.8 520 584.4C519.3 586.5 519.3 587.1 520.3 586.7C520.9 586.5 537.2 575.3 556.5 562C575.8 548.6 592.1 537.7 592.9 537.6C593.6 537.6 595.7 539.5 597.4 542C607.9 556.8 615.1 568.1 614.6 568.8C614.1 569.6 597.3 581.1 553.3 610.7C544.2 616.9 534.2 622.9 531.3 624C525.1 626.3 514.3 627.3 508.4 626ZM631 621.2C631 620.8 639.5 607.5 649.9 591.5C681.4 543.3 684.2 538.9 683.6 538.3C683.4 538 679.8 536.3 675.8 534.6C666.1 530.4 660.7 526.5 653.3 518.7C625 488.4 635.3 436.6 673.4 418.2C687.9 411.1 689 411 750.9 411L806 411L806 516.5L806 622L784.5 622L763 622L763 583L763 544L745.2 544L727.5 544.1L711.4 571.3C702.5 586.3 692.2 603.8 688.4 610.2L681.5 621.9L656.2 622C642.4 622 631 621.7 631 621.2ZM356.5 492L356.5 401.5L316.2 401.2L276 401L276 448.2C276 498.1 275.2 511.2 271 531.5C267.6 548.1 262.3 564.7 256.9 575.4C255.3 578.7 254 581.7 254 582.2C254 582.6 277.1 582.9 305.2 582.8L356.5 582.5L356.5 492ZM763 478L763 448L733.2 448C705.5 448 703.2 448.2 699 450.1C688.9 454.7 683 463.9 682.2 476.1C681.6 486.2 683.7 492.4 689.8 499.1C697.5 507.4 700 507.9 734.2 508L763 508L763 478ZM544.8 383C517 378.3 512.4 344.2 537.9 332.7C541.2 331.2 544.7 330.6 550 330.6C556.6 330.5 558.4 330.9 564.3 333.8C584.7 343.8 585 369.2 565 379.9C562.3 381.4 549.9 384.5 549.6 383.9C549.5 383.8 547.4 383.4 544.8 383Z\"/></svg>";
  var LOGO_OUTLINE = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" role=\"img\" aria-label=\"Дія\"><defs><clipPath id=\"diia-clip\"><path d=\"M389 1023.4C259.2 1020.9 191.3 1009.9 137.7 983C91 959.4 55.4 921.4 34.5 872.6C15.2 827.2 5.9 772.9 1.8 680.5C0 641.6 0 382.4 1.8 343.5C7.5 215.4 24.3 151.1 65.6 99.3C107.4 46.9 165.7 19.6 260 8.1C307.8 2.2 343.2 1 477 0.3C695 -0.8 763.7 3.1 829.5 20C885.1 34.3 927.2 60.2 958.4 99.3C999.7 151.2 1016.6 215.9 1022.2 344C1023.9 383.5 1023.9 640.5 1022.2 680C1016 821.2 995.2 889.7 942.5 942.5C890.3 994.6 821.5 1015.9 684.5 1022.1C662.6 1023.1 426.5 1024.1 389 1023.4Z\"/></clipPath></defs><path fill=\"none\" stroke=\"#fff\" stroke-width=\"56\" clip-path=\"url(#diia-clip)\" d=\"M389 1023.4C259.2 1020.9 191.3 1009.9 137.7 983C91 959.4 55.4 921.4 34.5 872.6C15.2 827.2 5.9 772.9 1.8 680.5C0 641.6 0 382.4 1.8 343.5C7.5 215.4 24.3 151.1 65.6 99.3C107.4 46.9 165.7 19.6 260 8.1C307.8 2.2 343.2 1 477 0.3C695 -0.8 763.7 3.1 829.5 20C885.1 34.3 927.2 60.2 958.4 99.3C999.7 151.2 1016.6 215.9 1022.2 344C1023.9 383.5 1023.9 640.5 1022.2 680C1016 821.2 995.2 889.7 942.5 942.5C890.3 994.6 821.5 1015.9 684.5 1022.1C662.6 1023.1 426.5 1024.1 389 1023.4Z\"/><path fill=\"#fff\" d=\"M387.7 679.4C387.3 679 387 665.9 387 650.3L387 622L309.5 622L232 622L232 650.5L232 679L211 679L190 679L190 631L190 583L199.8 583L209.6 583L212.7 577.8C220.7 564.5 227.5 544.3 231.7 521.5L234.3 507.5L234.7 434.8L235.2 362L317.1 362L399 362L399 472.5L399 583L414 583L429 583L428.8 631.2L428.5 679.5L408.4 679.8C397.4 679.9 388.1 679.7 387.7 679.4ZM508.4 626C491.9 622.5 479.2 607.4 478.2 590C477.8 583 478.3 580.4 483.9 559.9C494.8 520 500.1 500.6 502 493.5C510.2 463.2 513 453.3 513.5 451.8C514.2 450.1 512.4 450 485.1 450C469.1 450 456 449.7 456 449.2C456.1 448.8 459.1 440.2 462.9 430L469.6 411.5L519.3 411.2C546.6 411.1 569 411.2 569 411.5C569 411.7 567.7 416.6 566.1 422.2C564.4 427.9 558.3 449.4 552.5 470C546.6 490.6 537.1 524.1 531.4 544.5C525.6 564.9 520.5 582.8 520 584.4C519.3 586.5 519.3 587.1 520.3 586.7C520.9 586.5 537.2 575.3 556.5 562C575.8 548.6 592.1 537.7 592.9 537.6C593.6 537.6 595.7 539.5 597.4 542C607.9 556.8 615.1 568.1 614.6 568.8C614.1 569.6 597.3 581.1 553.3 610.7C544.2 616.9 534.2 622.9 531.3 624C525.1 626.3 514.3 627.3 508.4 626ZM631 621.2C631 620.8 639.5 607.5 649.9 591.5C681.4 543.3 684.2 538.9 683.6 538.3C683.4 538 679.8 536.3 675.8 534.6C666.1 530.4 660.7 526.5 653.3 518.7C625 488.4 635.3 436.6 673.4 418.2C687.9 411.1 689 411 750.9 411L806 411L806 516.5L806 622L784.5 622L763 622L763 583L763 544L745.2 544L727.5 544.1L711.4 571.3C702.5 586.3 692.2 603.8 688.4 610.2L681.5 621.9L656.2 622C642.4 622 631 621.7 631 621.2ZM356.5 492L356.5 401.5L316.2 401.2L276 401L276 448.2C276 498.1 275.2 511.2 271 531.5C267.6 548.1 262.3 564.7 256.9 575.4C255.3 578.7 254 581.7 254 582.2C254 582.6 277.1 582.9 305.2 582.8L356.5 582.5L356.5 492ZM763 478L763 448L733.2 448C705.5 448 703.2 448.2 699 450.1C688.9 454.7 683 463.9 682.2 476.1C681.6 486.2 683.7 492.4 689.8 499.1C697.5 507.4 700 507.9 734.2 508L763 508L763 478ZM544.8 383C517 378.3 512.4 344.2 537.9 332.7C541.2 331.2 544.7 330.6 550 330.6C556.6 330.5 558.4 330.9 564.3 333.8C584.7 343.8 585 369.2 565 379.9C562.3 381.4 549.9 384.5 549.6 383.9C549.5 383.8 547.4 383.4 544.8 383Z\"/></svg>";

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
    // класи Horoshop лишаємо для розкладки (ширина/відступи), вигляд задає .diia-age-btn (брендбук Дії, стор. 13)
    btn.className = ('diia-age-btn ' + orig.className.replace(/\b(j-submit|__disabled|__special)\b/g, '')).replace(/\s+/g, ' ').trim();
    btn.setAttribute('data-diia-overlay', '1');
    btn.setAttribute('aria-label', CONFIG.buttonText);
    btn.innerHTML = LOGO_OUTLINE; // чорна кнопка → контурна версія лого
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
      '.diia-age-logo{display:block;width:40px;height:40px;margin:0 auto 12px}.diia-age-logo svg{display:block;width:40px;height:40px}' +
      '.diia-age-box p{margin:8px 0;font-size:14px;line-height:1.4;color:#444}' +
      '.diia-age-qr{margin:16px auto;width:220px;height:220px;display:flex;align-items:center;justify-content:center}' +
      '.diia-age-qr canvas,.diia-age-qr img{width:220px!important;height:220px!important}' +
      '.diia-age-status{min-height:20px;font-weight:600;color:#222}' +
      '.diia-age-status.__error{color:#c0392b}.diia-age-status.__ok{color:#1e8449}' +
      '.diia-age-actions{display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap}' +
      '.diia-age-actions a,.diia-age-actions button{cursor:pointer;border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600;text-decoration:none}' +
      '.diia-age-open{display:inline-flex;background:#000;color:#fff;align-items:center;gap:8px;border-radius:999px!important;padding:8px 20px 8px 12px!important}' +
      '.diia-age-open svg{display:block;width:32px;height:32px;flex:none}' +
      '.diia-age-cancel{background:#eee;color:#222}' +
      // Кнопка за брендбуком Дії: чорна плашка, лого ≥24px (тут 32px), відступ лого від верху/низу ≥8px, від тексту = 1/4 висоти лого (8px)
      '.diia-age-btn,.diia-age-btn:hover,.diia-age-btn:focus,.diia-age-btn:active{display:inline-flex!important;align-items:center;justify-content:center;gap:8px;' +
        'box-sizing:border-box;min-height:48px;padding:8px 24px 8px 16px!important;background:#000!important;color:#fff!important;border:0!important;border-radius:999px!important;' +
        'font-weight:600;line-height:1.2;text-align:center;text-decoration:none;cursor:pointer;opacity:1!important;box-shadow:none!important}' +
      '.diia-age-btn:hover{background:#1f1f1f!important}' +
      '.diia-age-btn:disabled{opacity:.6!important;cursor:progress}' +
      '.diia-age-btn svg{display:block;width:32px;height:32px;flex:none}' +
      '.diia-age-btn .btn-content{color:#fff!important}' +
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
        '<span class="diia-age-logo">' + LOGO_FILLED + '</span>' +
        '<h3>Підтвердження віку 18+</h3>' +
        '<p class="diia-age-hint"></p>' +
        '<div class="diia-age-qr"></div>' +
        '<div class="diia-age-status"></div>' +
        '<div class="diia-age-timer"></div>' +
        '<div class="diia-age-actions">' +
          '<a class="diia-age-open" href="#" target="_blank" rel="noopener" style="display:none">' + LOGO_OUTLINE + '<span>Відкрити Дію</span></a>' +
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
        if (ui) { ui.qr.style.display = 'none'; ui.cancel.textContent = 'Закрити'; }
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
