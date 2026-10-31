/* ==========================================================================
   MOMENTUM - Utilities (DOM, dates, formatting, misc)
   ========================================================================== */

const U = (() => {

  // ---- DOM helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (k.startsWith('data-') || k.startsWith('aria-') || ['role', 'id', 'name', 'type', 'value', 'placeholder', 'checked', 'min', 'max', 'step', 'for'].includes(k)) {
        n.setAttribute(k, attrs[k]);
      } else {
        n[k] = attrs[k];
      }
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    });
    return n;
  }

  function h(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstChild;
  }

  function on(root, selector, event, handler) {
    root.addEventListener(event, (e) => {
      const target = e.target.closest(selector);
      if (target && root.contains(target)) handler.call(target, e, target);
    });
  }

  // ---- Dates ----
  const DAY = 86400000;

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function iso(d) {
    const x = d instanceof Date ? d : new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fromISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday=0
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  function daysBetween(a, b) {
    const d1 = a instanceof Date ? a : fromISO(a);
    const d2 = b instanceof Date ? b : fromISO(b);
    return Math.round((d2 - d1) / DAY);
  }

  function sameDay(a, b) {
    return iso(a) === iso(b);
  }

  function fmtDate(d, opts = {}) {
    const date = d instanceof Date ? d : fromISO(d);
    const defaults = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('fr-FR', { ...defaults, ...opts });
  }

  function fmtDateLong(d) {
    const date = d instanceof Date ? d : fromISO(d);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fmtRelative(d) {
    const date = d instanceof Date ? d : fromISO(d);
    const diff = daysBetween(today(), date);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    if (diff === -1) return 'Hier';
    if (diff > 1 && diff < 7) return `Dans ${diff} jours`;
    if (diff < -1 && diff > -7) return `Il y a ${-diff} jours`;
    return fmtDate(date);
  }

  function fmtTime(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function fmtDuration(min) {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  }

  // ---- Numbers ----
  function fmtMoney(n, currency = '€') {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const str = abs.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${str} ${currency}`;
  }

  function fmtNum(n, d = 0) {
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function sum(arr) { return arr.reduce((a, b) => a + (Number(b) || 0), 0); }
  function avg(arr) { return arr.length ? sum(arr) / arr.length : 0; }

  // ---- Misc ----
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach(item => {
      const k = keyFn(item);
      (out[k] = out[k] || []).push(item);
    });
    return out;
  }

  function sortBy(arr, keyFn, desc = false) {
    return [...arr].sort((a, b) => {
      const ka = keyFn(a), kb = keyFn(b);
      if (ka < kb) return desc ? 1 : -1;
      if (ka > kb) return desc ? -1 : 1;
      return 0;
    });
  }

  function range(n) { return Array.from({ length: n }, (_, i) => i); }

  // ---- Toast ----
  let toastTimer;
  function toast(msg, type = '') {
    const t = $('#toast');
    if (!t) return;
    t.className = 'toast show' + (type ? ' ' + type : '');
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 2500);
  }

  // ---- Modal ----
  function modal({ title = '', body = '', onClose = null }) {
    const root = $('#modal-root');
    $('#modal-title').textContent = title;
    const bodyEl = $('#modal-body');
    bodyEl.innerHTML = '';
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);
    root.classList.remove('hidden');

    const close = () => {
      root.classList.add('hidden');
      if (onClose) onClose();
    };
    $('#modal-close').onclick = close;
    $('.modal-backdrop').onclick = close;
    return { close, body: bodyEl };
  }

  function confirm(msg, { danger = false, confirmText = 'Confirmer', cancelText = 'Annuler' } = {}) {
    return new Promise(resolve => {
      const body = el('div', {}, [
        el('p', { class: 'text-muted mt-4', style: { marginBottom: '20px', lineHeight: '1.6' }, text: msg }),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn', text: cancelText, onclick: () => { m.close(); resolve(false); } }),
          el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: confirmText, onclick: () => { m.close(); resolve(true); } })
        ])
      ]);
      const m = modal({ title: 'Confirmation', body, onClose: () => resolve(false) });
    });
  }

  // ---- CSS var ----
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  return {
    $, $$, el, h, on,
    DAY, today, iso, fromISO, addDays, startOfWeek, startOfMonth, endOfMonth, daysBetween, sameDay,
    fmtDate, fmtDateLong, fmtRelative, fmtTime, fmtDuration,
    fmtMoney, fmtNum, clamp, sum, avg,
    uid, debounce, escapeHtml, groupBy, sortBy, range,
    toast, modal, confirm, cssVar
  };
})();
