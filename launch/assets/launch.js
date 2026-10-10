/* Ranran's launch pad: lock screen, encryption, encrypted sync with Supabase, page shell. */
(function () {
  'use strict';

  var CFG = window.LAUNCH_CONFIG;
  var UNLOCK_KEY = 'launch.unlock.v1';
  var CACHE_KEY = 'launch.cache.v1';
  var ITER = 310000;
  var te = new TextEncoder(), td = new TextDecoder();

  /* ---------- small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^\/(?!\/)/.test(u)) return u;
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(u)) return 'mailto:' + u;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    return /^(https?:|mailto:)/i.test(u) ? u : '';
  }
  // Escapes text and turns URLs, e-mail addresses and [text](url) into links.
  function linkify(s) {
    var out = '', re = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|([\w.+-]+@[\w-]+\.[\w.-]*\w)/g, last = 0, m;
    s = String(s == null ? '' : s);
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      var text = m[1] || m[3] || m[4], href = safeUrl(m[2] || m[3] || m[4]);
      out += href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + '</a>' : esc(m[0]);
      last = re.lastIndex;
    }
    return out + esc(s.slice(last));
  }
  function uid() {
    var a = crypto.getRandomValues(new Uint8Array(8)), s = '';
    for (var i = 0; i < a.length; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[a[i] % 32];
    return s;
  }
  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- dates ---------- */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysUntil(iso) {
    if (!iso) return null;
    var p = iso.split('-').map(Number), t = new Date(), a = Date.UTC(p[0], p[1] - 1, p[2]);
    var b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((a - b) / 86400000);
  }
  function fmtDue(iso) {
    var p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function relDue(iso) {
    var n = daysUntil(iso);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    if (n < 0) return -n + ' days ago';
    if (n < 14) return 'in ' + n + ' days';
    if (n < 63) return 'in ' + Math.round(n / 7) + ' weeks';
    return 'in ' + Math.round(n / 30) + ' months';
  }
  function dueClass(iso, done) {
    if (!iso || done) return '';
    var n = daysUntil(iso);
    return n < 0 ? 'overdue' : n <= 3 ? 'soon' : n <= 10 ? 'near' : '';
  }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  /* ---------- crypto ---------- */
  function b64(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }

  function derive(password) {
    return crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      function bits(salt) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations: ITER }, base, 256);
      }
      return Promise.all([bits('ranranli.net/launch|token|v1'), bits('ranranli.net/launch|key|v1')]);
    }).then(function (r) { return { token: hex(r[0]), key: b64(r[1]) }; });
  }
  var keyCache = {};
  function aesKey(keyB64) {
    if (!keyCache[keyB64]) keyCache[keyB64] = crypto.subtle.importKey('raw', unb64(keyB64), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return keyCache[keyB64];
  }
  function encrypt(obj, keyB64) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return aesKey(keyB64).then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, te.encode(JSON.stringify(obj)));
    }).then(function (ct) { return 'v1.' + b64(iv) + '.' + b64(ct); });
  }
  function decrypt(blob, keyB64) {
    var parts = String(blob).split('.');
    return aesKey(keyB64).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parts[1]) }, k, unb64(parts[2]));
    }).then(function (pt) { return JSON.parse(td.decode(pt)); });
  }

  /* ---------- Supabase ---------- */
  function rpc(name, body, keepalive) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST',
      keepalive: !!keepalive,
      headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = t ? JSON.parse(t) : null;
        if (!r.ok) {
          var err = new Error((j && j.message) || ('Request failed (' + r.status + ')'));
          err.code = j && j.code; err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }
  function fetchVault(token) {
    return rpc('launch_get', { p_id: CFG.vaultId, p_token: token }).then(function (rows) { return rows && rows[0] ? rows[0] : null; });
  }

  /* ---------- the document: columns, cards, settings ---------- */
  // card: { id, col, title, link, due, next, note, prio 0-4, done, doneAt, order, at, del }
  function mergeDocs(a, b) {
    var out = { v: 1 };
    ['cards', 'vibes'].forEach(function (key) {
      var A = a[key] || {}, B = b[key] || {}, m = {};
      Object.keys(Object.assign({}, A, B)).forEach(function (id) {
        var x = A[id], y = B[id];
        m[id] = !x ? y : !y ? x : ((y.at || 0) > (x.at || 0) ? y : x);
      });
      out[key] = m;
    });
    var ca = (a.columnsAt || 0) >= (b.columnsAt || 0);
    out.columns = ca ? a.columns : b.columns; out.columnsAt = ca ? a.columnsAt : b.columnsAt;
    var sa = (a.settingsAt || 0) >= (b.settingsAt || 0);
    out.settings = sa ? a.settings : b.settings; out.settingsAt = sa ? a.settingsAt : b.settingsAt;
    return out;
  }

  var Store = {
    doc: null, rev: 0, dirty: false, saving: false, again: false, timer: null, listeners: [], status: 'saved',
    unlock: null,
    on: function (fn) { this.listeners.push(fn); },
    emit: function (why) { var self = this; this.listeners.forEach(function (fn) { fn(self.doc, why); }); },
    setStatus: function (s) {
      this.status = s;
      var n = $('#syncStatus');
      if (!n) return;
      var map = { saved: 'Saved', saving: 'Saving…', offline: 'Offline · kept on this device', error: 'Couldn’t save · retrying' };
      n.textContent = map[s] || s;
      n.className = 'sync ' + s;
    },
    cacheLocal: function () {
      var self = this;
      return encrypt(this.doc, this.unlock.key).then(function (blob) { lsSet(CACHE_KEY, { blob: blob, rev: self.rev, dirty: self.dirty }); });
    },
    change: function () {
      this.dirty = true;
      this.emit('local');
      this.cacheLocal();
      this.setStatus('saving');
      clearTimeout(this.timer);
      var self = this;
      this.timer = setTimeout(function () { self.save(); }, 700);
    },
    save: function () {
      var self = this;
      if (!this.dirty || !this.unlock) return Promise.resolve();
      if (this.saving) { this.again = true; return Promise.resolve(); }
      this.saving = true;
      this.setStatus('saving');
      var snapshot = this.doc;
      return encrypt(snapshot, this.unlock.key).then(function (blob) {
        return rpc('launch_put', { p_id: CFG.vaultId, p_token: self.unlock.token, p_blob: blob, p_rev: self.rev });
      }).then(function (res) {
        if (res > 0) {
          self.rev = res;
          if (self.doc === snapshot) self.dirty = false;
          return null;
        }
        // Someone saved from another device in between: merge and try again.
        return fetchVault(self.unlock.token).then(function (row) {
          if (!row) throw Object.assign(new Error('not allowed'), { code: '28000' });
          return decrypt(row.blob, self.unlock.key).then(function (remote) {
            self.doc = mergeDocs(self.doc, remote);
            self.rev = row.rev;
            self.emit('remote');
            self.again = true;
          });
        });
      }).then(function () {
        self.saving = false;
        self.cacheLocal();
        if (self.again) { self.again = false; self.dirty = true; return self.save(); }
        self.setStatus(self.dirty ? 'saving' : 'saved');
      }).catch(function (e) {
        self.saving = false;
        if (e && e.code === '28000') { Launch.lock('Your password changed. Please unlock again.'); return; }
        self.setStatus(navigator.onLine === false ? 'offline' : 'error');
        clearTimeout(self.timer);
        self.timer = setTimeout(function () { self.save(); }, 15000);
      });
    },
    refresh: function () {
      var self = this;
      if (!this.unlock || this.saving) return Promise.resolve();
      return fetchVault(this.unlock.token).then(function (row) {
        if (!row) { Launch.lock('Please unlock again.'); return; }
        if (row.rev === self.rev) return;
        return decrypt(row.blob, self.unlock.key).then(function (remote) {
          self.doc = self.dirty ? mergeDocs(self.doc, remote) : remote;
          self.rev = row.rev;
          self.emit('remote');
          self.cacheLocal();
          if (self.dirty) self.save();
        });
      }).catch(function () { self.setStatus('offline'); });
    },

    /* mutations */
    cardsIn: function (col) {
      var d = this.doc;
      return Object.keys(d.cards).map(function (k) { return d.cards[k]; })
        .filter(function (c) { return !c.del && c.col === col; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },
    allCards: function () {
      var d = this.doc;
      return Object.keys(d.cards).map(function (k) { return d.cards[k]; }).filter(function (c) { return !c.del; });
    },
    setCard: function (id, patch) {
      var c = this.doc.cards[id];
      if (!c) return;
      this.doc.cards[id] = Object.assign({}, c, patch, { at: Date.now() });
      this.change();
    },
    addCard: function (col, fields, atTop) {
      var list = this.cardsIn(col).filter(function (c) { return !c.done; });
      var order = list.length ? (atTop ? list[0].order - 1000 : list[list.length - 1].order + 1000) : 1000;
      var c = Object.assign({ id: uid(), col: col, title: '', link: '', due: '', next: '', note: '', prio: 0, done: false, doneAt: 0, order: order }, fields, { at: Date.now() });
      this.doc.cards[c.id] = c;
      this.change();
      return c;
    },
    deleteCard: function (id) { this.setCard(id, { del: true }); },
    reorder: function (col, ids) {
      var now = Date.now(), self = this;
      ids.forEach(function (id, i) {
        var c = self.doc.cards[id];
        if (c && (c.col !== col || c.order !== (i + 1) * 1000)) self.doc.cards[id] = Object.assign({}, c, { col: col, order: (i + 1) * 1000, at: now });
      });
      this.change();
    },
    vibeList: function () {
      var v = this.doc.vibes || {};
      return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return !x.del; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },
    setVibe: function (id, patch) {
      this.doc.vibes = this.doc.vibes || {};
      var cur = this.doc.vibes[id] || { id: id, order: -Date.now() };
      this.doc.vibes[id] = Object.assign({}, cur, patch, { at: Date.now() });
      this.change();
      return this.doc.vibes[id];
    },
    setColumns: function (cols) { this.doc.columns = cols; this.doc.columnsAt = Date.now(); this.change(); },
    setSettings: function (patch) { this.doc.settings = Object.assign({}, this.doc.settings, patch); this.doc.settingsAt = Date.now(); this.change(); }
  };

  /* ---------- unlock / lock ---------- */
  function getUnlock() {
    var u = lsGet(UNLOCK_KEY);
    if (!u || !u.token || !u.key || !(u.until > Date.now())) return null;
    return u;
  }

  var readyCallbacks = [], started = false, lockTimer = null;

  function start(u, preloaded) {
    Store.unlock = u;
    document.body.classList.remove('locked');
    var lockEl = $('#lockScreen');
    if (lockEl) lockEl.remove();
    var p;
    if (preloaded) {
      p = Promise.resolve(preloaded);
    } else {
      var cache = lsGet(CACHE_KEY);
      p = cache ? decrypt(cache.blob, u.key).then(function (doc) { return { doc: doc, rev: cache.rev, dirty: cache.dirty, cached: true }; })
        .catch(function () { return null; }) : Promise.resolve(null);
    }
    return p.then(function (first) {
      if (first) {
        Store.doc = first.doc; Store.rev = first.rev; Store.dirty = !!first.dirty;
        ready();
        if (first.cached) Store.refresh();
        return;
      }
      return fetchVault(u.token).then(function (row) {
        if (!row) { Launch.lock('Please unlock again.'); return; }
        return decrypt(row.blob, u.key).then(function (doc) { Store.doc = doc; Store.rev = row.rev; Store.dirty = false; Store.cacheLocal(); ready(); });
      });
    }).catch(function () {
      showFatal('Couldn’t load your launch pad. Check your connection and reload.');
    });
  }
  function ready() {
    if (started) { Store.emit('remote'); return; }
    started = true;
    if (Store.doc.settings && Store.doc.settings.background) applyBackground(Store.doc.settings.background, Store.doc.settings.backgroundUrl);
    Store.on(function (d, why) { if (why === 'remote' && d.settings && d.settings.background) applyBackground(d.settings.background, d.settings.backgroundUrl); });
    Store.setStatus(Store.dirty ? 'saving' : 'saved');
    readyCallbacks.forEach(function (fn) { fn(Store.doc); });
    if (Store.dirty) Store.save();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { checkExpiry(); Store.refresh(); }
      else if (Store.dirty) Store.save();
    });
    window.addEventListener('online', function () { Store.save(); Store.refresh(); });
    setInterval(function () { if (document.visibilityState === 'visible') Store.refresh(); }, 120000);
    window.addEventListener('beforeunload', function (e) {
      if (Store.dirty) { Store.save(); e.preventDefault(); e.returnValue = ''; }
    });
    clearInterval(lockTimer);
    lockTimer = setInterval(checkExpiry, 30000);
    paintUnlockInfo();
  }
  function checkExpiry() {
    if (Store.unlock && !getUnlock()) {
      if (Store.dirty) Store.save().then(function () { Launch.lock('Unlocked for 8 hours — time’s up. Enter your password to continue.'); });
      else Launch.lock('Unlocked for 8 hours — time’s up. Enter your password to continue.');
    }
  }
  function paintUnlockInfo() {
    var n = $('#unlockInfo'), u = lsGet(UNLOCK_KEY);
    if (!n || !u) return;
    var d = new Date(u.until);
    n.textContent = 'Unlocked until ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function showFatal(msg) {
    var main = $('main');
    if (main) main.innerHTML = '<div class="fatal">' + esc(msg) + '</div>';
  }

  function showLock(message) {
    document.body.classList.add('locked');
    if ($('#lockScreen')) return;
    var wrap = el('div', { id: 'lockScreen', class: 'lock' });
    wrap.innerHTML =
      '<form class="lock-card" autocomplete="off">' +
      '  <div class="lock-sun" aria-hidden="true"></div>' +
      '  <p class="lock-date">' + esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p>' +
      '  <h1>Good to see you, Ranran</h1>' +
      '  <p class="lock-sub">' + esc(message || 'Enter your password to open today’s launch pad.') + '</p>' +
      '  <label class="sr" for="lockPw">Password</label>' +
      '  <input id="lockPw" type="password" placeholder="Password" autocomplete="current-password" required autofocus>' +
      '  <button type="submit" class="btn primary">Unlock for 8 hours</button>' +
      '  <p class="lock-status" role="status" aria-live="polite"></p>' +
      '</form>';
    document.body.appendChild(wrap);
    var form = $('form', wrap), pw = $('#lockPw', wrap), status = $('.lock-status', wrap), btn = $('button', wrap);
    setTimeout(function () { pw.focus(); }, 50);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pw.value) return;
      btn.disabled = true; status.className = 'lock-status'; status.textContent = 'Checking…';
      var d;
      derive(pw.value).then(function (r) {
        d = r;
        return fetchVault(d.token);
      }).then(function (row) {
        if (!row) {
          btn.disabled = false; status.className = 'lock-status bad'; status.textContent = 'That’s not the password.';
          pw.select();
          return;
        }
        return decrypt(row.blob, d.key).then(function (doc) {
          var u = { token: d.token, key: d.key, until: Date.now() + (CFG.unlockHours || 8) * 3600000 };
          lsSet(UNLOCK_KEY, u);
          var cache = lsGet(CACHE_KEY);
          var pre = { doc: doc, rev: row.rev, dirty: false };
          // Changes made offline on this device before the lock are merged back in.
          var p = cache && cache.dirty ? decrypt(cache.blob, d.key).then(function (local) { pre.doc = mergeDocs(local, doc); pre.dirty = true; }).catch(function () {}) : Promise.resolve();
          return p.then(function () { return start(u, pre); });
        });
      }).catch(function () {
        btn.disabled = false; status.className = 'lock-status bad'; status.textContent = 'Couldn’t reach the server. Check your connection.';
      });
    });
  }

  /* ---------- page shell ---------- */
  function shell(active) {
    var top = el('header', { class: 'top' });
    top.innerHTML =
      '<div class="top-date">' +
      '  <p class="eyebrow" id="topGreeting"></p>' +
      '  <h1 id="topDay"></h1>' +
      '  <p class="top-sub"><span id="topDate"></span><span class="dot">·</span><span id="topWeek"></span><span class="dot">·</span><span id="topTime"></span></p>' +
      '</div>' +
      '<nav class="tabs" aria-label="Launch pad">' +
      '  <a href="/launch/" class="tab' + (active === 'home' ? ' on' : '') + '">Today</a>' +
      '  <a href="/launch/calendar/" class="tab' + (active === 'calendar' ? ' on' : '') + '">Calendar</a>' +
      '  <a href="/launch/task-list/" class="tab' + (active === 'tasks' ? ' on' : '') + '">Tasks</a>' +
      '  <a href="/launch/vibecodings/" class="tab' + (active === 'vibes' ? ' on' : '') + '">Vibecodings</a>' +
      '</nav>' +
      '<div class="top-tools">' +
      '  <span id="syncStatus" class="sync"></span>' +
      '  <span id="unlockInfo" class="unlock-info"></span>' +
      '  <button type="button" class="icon-btn" id="bgBtn" title="Change background" aria-label="Change background">' + ICONS.image + '</button>' +
      '  <button type="button" class="icon-btn" id="settingsBtn" title="Settings" aria-label="Settings">' + ICONS.gear + '</button>' +
      '  <button type="button" class="icon-btn" id="lockBtn" title="Lock now" aria-label="Lock now">' + ICONS.lock + '</button>' +
      '</div>';
    document.body.insertBefore(top, document.body.firstChild);
    function tick() {
      var d = new Date(), h = d.getHours();
      $('#topGreeting').textContent = h < 5 ? 'Late night, Ranran' : h < 12 ? 'Good morning, Ranran' : h < 18 ? 'Good afternoon, Ranran' : 'Good evening, Ranran';
      $('#topDay').textContent = d.toLocaleDateString('en-GB', { weekday: 'long' });
      $('#topDate').textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      $('#topWeek').textContent = 'Week ' + isoWeek(d);
      $('#topTime').textContent = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    tick(); setInterval(tick, 15000);
    $('#lockBtn').addEventListener('click', function () {
      var go = function () { Launch.lock(); };
      if (Store.dirty) Store.save().then(go); else go();
    });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#bgBtn').addEventListener('click', openBackgrounds);
  }

  function openSettings() {
    if (!Store.doc) return;
    var s = Store.doc.settings || {};
    var dlg = el('dialog', { class: 'modal' });
    dlg.innerHTML =
      '<form method="dialog" class="modal-body">' +
      '  <h2>Settings</h2>' +
      '  <label>Focus music link <small>Your Brain.fm player link.</small><input name="music" placeholder="https://my.brain.fm/…"></label>' +
      '  <label>Second time zone in the calendar <small>Shown next to your own, like in Google Calendar. Leave empty for none.</small><input name="tz2" placeholder="Asia/Shanghai"></label>' +
      '  <label>Short name for it <input name="tz2label" placeholder="CN"></label>' +
      '  <div class="modal-actions"><button type="button" class="btn ghost left-btn" data-bg>Change background…</button><button value="cancel" class="btn">Cancel</button><button value="save" class="btn primary">Save</button></div>' +
      '</form>';
    document.body.appendChild(dlg);
    var f = $('form', dlg);
    f.music.value = s.musicUrl || '';
    f.tz2.value = s.tz2 == null ? 'Asia/Shanghai' : s.tz2;
    f.tz2label.value = s.tz2label == null ? 'CN' : s.tz2label;
    $('[data-bg]', dlg).addEventListener('click', function () { dlg.close(); openBackgrounds(); });
    dlg.addEventListener('close', function () {
      if (dlg.returnValue === 'save') {
        var tz2 = f.tz2.value.trim();
        if (tz2) { try { new Intl.DateTimeFormat('en-GB', { timeZone: tz2 }); } catch (e) { tz2 = ''; } }
        Store.setSettings({ musicUrl: f.music.value.trim(), tz2: tz2, tz2label: f.tz2label.value.trim() });
      }
      dlg.remove();
    });
    dlg.showModal();
  }

  /* ---------- backgrounds ---------- */
  var U = 'https://images.unsplash.com/';
  var BACKGROUNDS = [
    { id: 'blue-sky', name: 'Blue sky', photo: 'photo-1602498456745-e9503b30470b' },
    { id: 'soft-clouds', name: 'Soft clouds', photo: 'photo-1514477917009-389c76a86b68' },
    { id: 'ocean-day', name: 'Ocean day', photo: 'photo-1501589345162-ecc3f6fc298b' },
    { id: 'alpine-meadow', name: 'Alpine meadow', photo: 'photo-1615117804087-6629d6f20e80' },
    { id: 'clear-sky', name: 'Clear sky', css: 'radial-gradient(70% 50% at 75% 15%, rgba(255,255,255,.75) 0%, transparent 70%), linear-gradient(180deg, #2f7fd0 0%, #5aa9e6 45%, #a9d6f5 80%, #e8f4fd 100%)' },
    { id: 'mirror-sky', name: 'Mirror sky', photo: 'photo-1746185896983-5e021159cb04' },
    { id: 'lilac-fjord', name: 'Lilac fjord', photo: 'photo-1749230322510-8257ea537970' },
    { id: 'above-clouds', name: 'Above the clouds', photo: 'photo-1508020268086-b96cf4f4bb2e' },
    { id: 'evening-sea', name: 'Evening sea', photo: 'photo-1708819250631-bb426d85c3a7' },
    { id: 'white-sands', name: 'White sands moon', photo: 'photo-1554147090-e1221a04a025' },
    { id: 'lavender-peaks', name: 'Lavender peaks', photo: 'photo-1517504734587-2890819debab' },
    { id: 'ranranli', name: 'ranranli.net', css: '#2D3748', particles: true }
  ];

  var BG_KEY = 'launch.bg.v1';
  function bgCss(b, w) {
    if (!b) b = BACKGROUNDS[0];
    if (b.css) return b.css;
    var url = b.url || (U + b.photo + '?auto=format&fit=crop&w=' + (w || 2400) + '&q=80');
    return 'url("' + url.replace(/"/g, '%22') + '")';
  }
  function findBg(id, custom) {
    if (id === 'custom' && custom) return { id: 'custom', url: custom };
    for (var i = 0; i < BACKGROUNDS.length; i++) if (BACKGROUNDS[i].id === id) return BACKGROUNDS[i];
    return BACKGROUNDS[0];
  }
  function applyBackground(id, custom) {
    var layer = document.getElementById('bgLayer');
    if (!layer) {
      layer = el('div', { id: 'bgLayer', 'aria-hidden': 'true' });
      document.body.insertBefore(layer, document.body.firstChild);
    }
    var b = findBg(id, custom);
    layer.style.backgroundImage = b.particles ? 'none' : bgCss(b);
    layer.style.backgroundColor = b.particles ? b.css : '';
    layer.classList.toggle('plain', !!b.particles);
    particles(!!b.particles);
    lsSet(BG_KEY, { id: b.id, custom: b.url || '' });
  }
  (function () { var c = lsGet(BG_KEY) || {}; applyBackground(c.id, c.custom); })();

  // The same drifting shapes as the main site (particles.js with the site's settings).
  var particlesLoad = null;
  function particles(on) {
    var host = document.getElementById('bgParticles');
    if (!on) { if (host) host.remove(); return; }
    if (host) return;
    host = el('div', { id: 'bgParticles', 'aria-hidden': 'true' });
    document.body.insertBefore(host, document.body.firstChild);
    particlesLoad = particlesLoad || new Promise(function (res, rej) {
      if (window.particlesJS) return res();
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js'; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
    particlesLoad.then(function () {
      if (!document.getElementById('bgParticles')) return;
      window.particlesJS('bgParticles', {
        particles: {
          number: { value: 80, density: { enable: true, value_area: 800 } },
          color: { value: ['#ffffff', '#30b659', '#111827'] },
          shape: { type: ['circle', 'triangle', 'square'], stroke: { width: 0 }, polygon: { nb_sides: 4 } },
          opacity: { value: 0.5, random: false },
          size: { value: 8, random: true },
          line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.4, width: 1 },
          move: { enable: true, speed: 0.8, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
        },
        interactivity: { detect_on: 'window', events: { onhover: { enable: false }, onclick: { enable: false }, resize: true } },
        retina_detect: true
      });
    }).catch(function () { /* offline: plain colour */ });
  }

  function openBackgrounds() {
    var s = (Store.doc && Store.doc.settings) || {}, cur = lsGet(BG_KEY) || {};
    var dlg = el('dialog', { class: 'modal wide' });
    dlg.innerHTML =
      '<form method="dialog" class="modal-body">' +
      '  <h2>Background</h2>' +
      '  <div class="bg-grid">' + BACKGROUNDS.map(function (b) {
        var look = b.particles ? 'background:radial-gradient(circle at 20% 30%, #30b659 0 5px, transparent 6px), radial-gradient(circle at 70% 60%, #fff 0 4px, transparent 5px), radial-gradient(circle at 45% 80%, #111827 0 6px, transparent 7px), radial-gradient(circle at 85% 20%, #fff 0 3px, transparent 4px), #2D3748' : 'background-image:' + bgCss(b, 480);
        return '<button type="button" class="bg-opt' + ((cur.id || BACKGROUNDS[0].id) === b.id ? ' on' : '') + '" data-id="' + b.id + '" style="' + esc(look) + '"><span>' + esc(b.name) + '</span></button>';
      }).join('') + '</div>' +
      '  <label>Or your own image link <input name="custom" placeholder="https://…jpg"></label>' +
      '  <p class="muted small-note">Photos from <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>, free to use.</p>' +
      '  <div class="modal-actions"><button value="close" class="btn primary">Done</button></div>' +
      '</form>';
    document.body.appendChild(dlg);
    var f = $('form', dlg);
    f.custom.value = cur.id === 'custom' ? cur.custom : '';
    function pick(id, custom) {
      applyBackground(id, custom);
      dlg.querySelectorAll('.bg-opt').forEach(function (n) { n.classList.toggle('on', n.dataset.id === id); });
      if (Store.doc) Store.setSettings({ background: id, backgroundUrl: custom || '' });
    }
    dlg.addEventListener('click', function (e) { var o = e.target.closest('.bg-opt'); if (o) pick(o.dataset.id); });
    f.custom.addEventListener('change', function () { var u = safeUrl(f.custom.value); if (u) pick('custom', u); });
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.showModal();
  }

  var ICONS = {
    gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
  };

  window.Launch = {
    Store: Store, $: $, el: el, esc: esc, linkify: linkify, safeUrl: safeUrl, uid: uid,
    todayISO: todayISO, daysUntil: daysUntil, fmtDue: fmtDue, relDue: relDue, dueClass: dueClass,
    lsGet: lsGet, lsSet: lsSet, ICONS: ICONS,
    applyBackground: applyBackground,
    PRIO: [
      { v: 0, name: 'None' },
      { v: 1, name: 'Low' },
      { v: 2, name: 'Medium' },
      { v: 3, name: 'High' },
      { v: 4, name: 'Urgent' }
    ],
    boot: function (active, onReady) {
      readyCallbacks.push(onReady);
      shell(active);
      var u = getUnlock();
      if (u) start(u); else { lsDel(UNLOCK_KEY); showLock(); }
    },
    lock: function (message) {
      lsDel(UNLOCK_KEY);
      // Keep only the encrypted copy on this device; it's useless without the password.
      Store.unlock = null;
      clearInterval(lockTimer);
      try { if (message) sessionStorage.setItem('launch.lockmsg', message); } catch (e) { /* ignore */ }
      Store.dirty = false;
      location.reload();
    }
  };

  // Show a message from the last lock (e.g. "8 hours are up") on the lock screen.
  var pendingMsg = null;
  try { pendingMsg = sessionStorage.getItem('launch.lockmsg'); sessionStorage.removeItem('launch.lockmsg'); } catch (e) { /* ignore */ }
  var origShowLock = showLock;
  showLock = function (m) { origShowLock(m || pendingMsg); };
})();
