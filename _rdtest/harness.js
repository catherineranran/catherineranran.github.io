/* Test harness: runs the Reading tab with a mocked launch pad (no password, no vault). */
(async function () {
  var BASE = window.__RD_BASE;
  var files = await Promise.all(['launch/assets/launch.css', 'launch/assets/reading.js', 'launch/reading/index.html', (window.__RD_SAMPLE || '_rdtest/sample.html')].map(function (p) {
    return fetch(BASE + p, { cache: 'no-store' }).then(function (r) { return r.text(); });
  }));
  var css = files[0], js = files[1], page = files[2], sample = files[3];
  var main = new DOMParser().parseFromString(page, 'text/html').querySelector('main');
  document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading (test)</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap" rel="stylesheet">';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.body.className = '';
  document.body.removeAttribute('style');
  document.body.innerHTML =
    '<div id="bgLayer" style="background-image:url(https://images.unsplash.com/photo-1705873339772-605ce4d98e99?auto=format&fit=crop&w=2400&q=80)"></div>' +
    '<header class="top"><div class="top-date"><p class="eyebrow">Good evening, Ranran</p><h1>Saturday</h1><p class="top-sub"><span>24 October 2026</span><span class="dot">·</span><span>Week 43</span><span class="dot">·</span><span>19:20</span></p></div>' +
    '<nav class="tabs"><a class="tab" href="#">Today</a><a class="tab" href="#">Calendar</a><a class="tab" href="#">Tasks</a><a class="tab on" href="#">Reading</a><a class="tab" href="#">Vibecodings</a></nav>' +
    '<div class="top-tools"><a class="btn small site-link" href="#">To Personal Site</a><span class="sync">Saved</span></div></header>' +
    '<main>' + main.innerHTML + '</main>';
  var settings = { readingDoc: window.__RD_DOC || 'https://docs.google.com/document/d/FAKE_TEST_DOC_1234567890abcdef/edit' };
  var listeners = [];
  var store = { doc: { settings: settings }, on: function (fn) { listeners.push(fn); return function () {}; },
    setSettings: function (p) { Object.assign(settings, p); listeners.forEach(function (f) { f(store.doc, 'local'); }); } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.Launch = {
    Store: store, esc: esc,
    $: function (s, r) { return (r || document).querySelector(s); },
    el: function (tag, attrs, html) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (html != null) n.innerHTML = html; return n; },
    lsGet: function (k) { try { return JSON.parse(localStorage.getItem('rdtest.' + k)); } catch (e) { return null; } },
    lsSet: function (k, v) { localStorage.setItem('rdtest.' + k, JSON.stringify(v)); },
    boot: function (name, fn) { fn(store.doc); },
    listen: function (t, type, fn, opt) { t.addEventListener(type, fn, opt); },
    every: function (fn, ms) { return setInterval(fn, ms); },
    onStore: function (fn) { listeners.push(fn); },
    scoped: function () {}
  };
  var realFetch = window.__realFetch || window.fetch.bind(window);
  window.__realFetch = realFetch;
  window.fetch = function (url, opts) {
    if (String(url).indexOf('FAKE_TEST_DOC') !== -1) {
      if (String(url).indexOf('mobilebasic') !== -1) return new Promise(function (res) { setTimeout(function () { res(new Response(sample, { status: 200, headers: { 'Content-Type': 'text/html' } })); }, 400); });
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return realFetch(url, opts);
  };
  var s = document.createElement('script'); s.textContent = js; document.body.appendChild(s);
  return 'harness ready';
})();
