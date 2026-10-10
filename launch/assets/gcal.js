/* Google Calendar for the launch pad: sign-in, events API, a day/week view you can edit, and a mini month. */
(function () {
  'use strict';
  var L = window.Launch, $ = L.$, esc = L.esc, CFG = window.LAUNCH_CONFIG;
  var TOK = 'launch.gtoken.v1';
  var API = 'https://www.googleapis.com/calendar/v3';
  var SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
  var EVENT_COLORS = { 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e', 7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000' };
  var DAY = 86400000;
  // Google Calendar's 24 colours, in the order of its right-click menu. `id` = colorId the API can store on events.
  var PALETTE = [
    ['cherry', 'Cherry blossom', '#ad1457'], ['radicchio', 'Radicchio', '#d81b60'], ['flamingo', 'Flamingo', '#e67c73', '4'],
    ['tomato', 'Tomato', '#d50000', '11'], ['tangerine', 'Tangerine', '#f4511e', '6'], ['pumpkin', 'Pumpkin', '#ef6c00'],
    ['mango', 'Mango', '#f09300'], ['banana', 'Banana', '#f6bf26', '5'], ['citron', 'Citron', '#e4c441'],
    ['avocado', 'Avocado', '#c0ca33'], ['pistachio', 'Pistachio', '#7cb342'], ['basil', 'Basil', '#0b8043', '10'],
    ['sage', 'Sage', '#33b679', '2'], ['eucalyptus', 'Eucalyptus', '#009688'], ['peacock', 'Peacock', '#039be5', '7'],
    ['cobalt', 'Cobalt', '#4285f4'], ['lavender', 'Lavender', '#7986cb', '1'], ['blueberry', 'Blueberry', '#3f51b5', '9'],
    ['wisteria', 'Wisteria', '#b39ddb'], ['amethyst', 'Amethyst', '#9e69af'], ['grape', 'Grape', '#8e24aa', '3'],
    ['cocoa', 'Cocoa', '#795548'], ['graphite', 'Graphite', '#616161', '8'], ['birch', 'Birch', '#a79b8e']
  ].map(function (x) { return { k: x[0], name: x[1], hex: x[2], id: x[3] || '' }; });
  var apiColors = {};
  var BY_KEY = {}; PALETTE.forEach(function (p) { BY_KEY[p.k] = p; });
  var apiIds = {};   // extra colorIds Google's /colors reports, by palette key (in case Google adds more)
  function idFor(k) { var p = BY_KEY[k]; return p ? (p.id || apiIds[k] || '') : ''; }
  function keyForId(id) {
    for (var i = 0; i < PALETTE.length; i++) if (PALETTE[i].id === id) return PALETTE[i].k;
    for (var k in apiIds) if (apiIds[k] === id) return k;
    return '';
  }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function nearestId(hex) {
    var best = '1', bd = 1e9, a = rgb(hex);
    PALETTE.forEach(function (p) { if (!p.id) return; var b = rgb(p.hex), d = Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2); if (d < bd) { bd = d; best = p.id; } });
    return best;
  }
  function overrides() { var s = (L.Store.doc && L.Store.doc.settings) || {}; return s.eventColors || {}; }
  function setOverride(key, hexOrNull) {
    var o = Object.assign({}, overrides());
    if (hexOrNull) o[key] = hexOrNull; else delete o[key];
    L.Store.setSettings({ eventColors: o });
  }
  // Colour key of an event: launch-pad-only colour first, then Google's colorId, '' = calendar colour
  function eventKey(ev) {
    var o = overrides()[ev.calId + '|' + ev.id];
    if (o) { for (var i = 0; i < PALETTE.length; i++) if (PALETTE[i].hex === o) return PALETTE[i].k; }
    return ev.colorId ? keyForId(ev.colorId) : '';
  }
  // Save a colour: Google gets the exact colour when its API can store it, otherwise the closest one,
  // and the launch pad remembers the exact choice.
  function applyColor(ev, k) {
    var key = ev.calId + '|' + ev.id, p = BY_KEY[k], id = idFor(k);
    if (!p) { if (overrides()[key]) setOverride(key, null); return G.patchEvent(ev.calId, ev.id, { colorId: null }); }
    if (id) { if (overrides()[key]) setOverride(key, null); return G.patchEvent(ev.calId, ev.id, { colorId: id }); }
    setOverride(key, p.hex);
    return G.patchEvent(ev.calId, ev.id, { colorId: nearestId(p.hex) });
  }
  // The API still reports calendar colours in Google's old palette; the Calendar app shows these instead.
  var MODERN = {
    '#ac725e': '#795548', '#d06b64': '#e67c73', '#f83a22': '#d50000', '#fa573c': '#f4511e', '#ff7537': '#ef6c00',
    '#ffad46': '#f09300', '#42d692': '#009688', '#16a765': '#0b8043', '#7bd148': '#7cb342', '#b3dc6c': '#c0ca33',
    '#fbe983': '#e4c441', '#fad165': '#f6bf26', '#92e1c0': '#33b679', '#9fe1e7': '#039be5', '#9fc6e7': '#4285f4',
    '#4986e7': '#3f51b5', '#9a9cff': '#7986cb', '#b99aff': '#b39ddb', '#c2c2c2': '#616161', '#cabdbf': '#a79b8e',
    '#cca6ac': '#ad1457', '#f691b2': '#d81b60', '#cd74e6': '#8e24aa', '#a47ae2': '#9e69af'
  };
  function modern(c) { c = String(c || '').toLowerCase(); return MODERN[c] || c || '#7986cb'; }
  function textOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
    var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#202124' : '#fff';
  }

  /* ---------- dates ---------- */
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) { var x = startOfDay(d), wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parseDate(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function minutesOf(d) { return d.getHours() * 60 + d.getMinutes(); }

  /* ---------- Google sign-in (Google Identity Services, token model) ---------- */
  var gisReady = null, tokenClient = null, pending = null;
  function loadGis() {
    if (gisReady) return gisReady;
    gisReady = new Promise(function (res, rej) {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = function () { res(); }; s.onerror = rej;
      document.head.appendChild(s);
    }).then(function () {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId,
        scope: SCOPES,
        callback: function (r) {
          var p = pending; pending = null;
          if (r && r.access_token) {
            L.lsSet(TOK, { access: r.access_token, exp: Date.now() + (r.expires_in || 3599) * 1000, ok: true });
            G.emit('auth');
            if (p) p.res(r.access_token);
          } else if (p) p.rej(r);
        },
        error_callback: function (e) { var p = pending; pending = null; if (p) p.rej(e); }
      });
    });
    return gisReady;
  }

  var G = {
    listeners: [],
    on: function (fn) { var l = this.listeners; l.push(fn); return function () { var i = l.indexOf(fn); if (i !== -1) l.splice(i, 1); }; },
    emit: function (w) { this.listeners.forEach(function (fn) { fn(w); }); },
    configured: function () { return !!CFG.googleClientId; },
    token: function () { var t = L.lsGet(TOK); return t && t.access && t.exp > Date.now() + 30000 ? t.access : null; },
    wasConnected: function () { var t = L.lsGet(TOK); return !!(t && t.ok); },
    // Must run inside a click handler so the Google window isn't blocked.
    signIn: function (fresh) {
      if (!tokenClient) { loadGis(); return Promise.reject(new Error('Google is still loading, try again in a second.')); }
      return new Promise(function (res, rej) {
        pending = { res: res, rej: rej };
        tokenClient.requestAccessToken({ prompt: fresh ? 'consent' : '', login_hint: CFG.googleHint || '' });
      });
    },
    disconnect: function () {
      var t = L.lsGet(TOK);
      if (t && t.access && window.google) try { google.accounts.oauth2.revoke(t.access); } catch (e) { /* ignore */ }
      try { localStorage.removeItem(TOK); } catch (e) { /* ignore */ }
      G.emit('auth');
    },
    api: function (path, opts) {
      var tok = G.token();
      if (!tok) return Promise.reject(Object.assign(new Error('Google connection expired'), { needAuth: true }));
      opts = opts || {};
      return fetch(API + path, {
        method: opts.method || 'GET',
        headers: Object.assign({ Authorization: 'Bearer ' + tok }, opts.body ? { 'Content-Type': 'application/json' } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined
      }).then(function (r) {
        if (r.status === 401) {
          var t = L.lsGet(TOK); if (t) { t.exp = 0; L.lsSet(TOK, t); }
          G.emit('auth');
          throw Object.assign(new Error('Google connection expired'), { needAuth: true });
        }
        if (r.status === 204) return null;
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j.error && j.error.message) || ('Google error ' + r.status));
          return j;
        });
      });
    },

    calendars: null,
    loadCalendars: function () {
      if (G.calendars) return Promise.resolve(G.calendars);
      G.api('/colors').then(function (c) {
        Object.keys((c && c.event) || {}).forEach(function (id) {
          var hex = modern(c.event[id].background); apiColors[id] = hex;
          if (EVENT_COLORS[id]) return;
          var p = PALETTE.filter(function (x) { return x.hex === hex; })[0];
          if (p) apiIds[p.k] = id;
        });
      }).catch(function () {});
      return G.api('/users/me/calendarList?maxResults=250').then(function (j) {
        G.calendars = (j.items || []).map(function (c) {
          return { id: c.id, name: c.summaryOverride || c.summary, color: modern(c.backgroundColor), primary: !!c.primary,
            writable: c.accessRole === 'owner' || c.accessRole === 'writer', selected: c.selected !== false };
        }).sort(function (a, b) { return (b.primary - a.primary) || (b.writable - a.writable) || a.name.localeCompare(b.name); });
        return G.calendars;
      });
    },
    visibleCalendars: function () {
      var s = (L.Store.doc && L.Store.doc.settings) || {}, shown = s.gcalShown;
      return (G.calendars || []).filter(function (c) { return shown ? shown.indexOf(c.id) !== -1 : c.selected; });
    },
    setShown: function (ids) { L.Store.setSettings({ gcalShown: ids }); G.emit('calendars'); },

    normalize: function (e, cal) {
      var allDay = !!(e.start && e.start.date);
      var start = allDay ? parseDate(e.start.date) : new Date(e.start.dateTime);
      var end = allDay ? parseDate(e.end.date) : new Date(e.end.dateTime);
      return {
        id: e.id, calId: cal.id, title: e.summary || '(No title)', start: start, end: end, allDay: allDay,
        color: overrides()[cal.id + '|' + e.id] || (e.colorId ? (EVENT_COLORS[e.colorId] || apiColors[e.colorId] || cal.color) : cal.color), colorId: e.colorId || '', calColor: cal.color, location: e.location || '', description: e.description || '',
        link: e.htmlLink, recurring: !!e.recurringEventId, editable: cal.writable && !e.locked,
        raw: e
      };
    },
    listEvents: function (from, to) {
      return G.loadCalendars().then(function () {
        var cals = G.visibleCalendars();
        return Promise.all(cals.map(function (c) {
          var q = '?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=' + encodeURIComponent(from.toISOString()) + '&timeMax=' + encodeURIComponent(to.toISOString());
          return G.api('/calendars/' + encodeURIComponent(c.id) + '/events' + q).then(function (j) {
            return (j.items || []).filter(function (e) { return e.status !== 'cancelled' && e.start; }).map(function (e) { return G.normalize(e, c); });
          }).catch(function (err) { if (err.needAuth) throw err; return []; });
        }));
      }).then(function (lists) { return [].concat.apply([], lists); });
    },
    timeBody: function (start, end, allDay) {
      return allDay
        ? { start: { date: iso(start), dateTime: null }, end: { date: iso(end), dateTime: null } }
        : { start: { dateTime: start.toISOString(), date: null }, end: { dateTime: end.toISOString(), date: null } };
    },
    createEvent: function (calId, fields) {
      return G.api('/calendars/' + encodeURIComponent(calId) + '/events', { method: 'POST', body: fields });
    },
    patchEvent: function (calId, id, fields) {
      return G.api('/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(id), { method: 'PATCH', body: fields });
    },
    deleteEvent: function (calId, id) {
      return G.api('/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(id), { method: 'DELETE' });
    }
  };
  if (G.configured()) loadGis().catch(function () { /* offline */ });

  function defaultCal(cals) { return cals.filter(function (c) { return c.primary; })[0] || cals[0] || { color: '#7986cb' }; }
  function swatchHtml() {
    return PALETTE.map(function (p) { return '<button type="button" class="swatch" role="radio" data-c="' + p.k + '" title="' + p.name + '" aria-label="' + p.name + '" style="--c:' + p.hex + '"></button>'; }).join('');
  }
  var ICON_TRASH = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  var ICON_PEN = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';

  /* right-click menu, laid out like Google Calendar's */
  function colorMenu(ev, x, y, onDone) {
    document.querySelectorAll('.cv-menu').forEach(function (n) { n.remove(); });
    var m = document.createElement('div');
    m.className = 'menu cv-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = '<button type="button" class="cvm-del" data-a="del">' + ICON_TRASH + '<span>Delete</span></button><hr>' +
      '<div class="cvm-body"><button type="button" class="cvm-pen" data-a="edit" title="Edit event" aria-label="Edit event">' + ICON_PEN + '</button>' +
      '<div class="swatches grid24">' + swatchHtml() + '</div>' +
      '<button type="button" class="cvm-default" data-a="default"><i style="--c:' + esc(ev.calColor) + '"></i>Default</button></div>';
    document.body.appendChild(m);
    var cur = eventKey(ev);
    m.querySelectorAll('.swatch').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.c === cur)); });
    m.querySelector('.cvm-default').classList.toggle('on', !cur);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + window.scrollX + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + window.scrollY + 'px';
    function close() { m.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc1); }
    function outside(e) { if (!m.contains(e.target)) close(); }
    function esc1(e) { if (e.key === 'Escape') close(); }
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', esc1); }, 0);
    function recolour(k) {
      close();
      var p = BY_KEY[k];
      onDone({ color: p ? p.hex : ev.calColor });
      applyColor(ev, k).then(function () { onDone(); })
        .catch(function (x) { alert(x.needAuth ? 'Google connection expired. Reconnect and try again.' : 'Couldn’t change the colour: ' + x.message); onDone(); });
    }
    m.addEventListener('click', function (e) {
      var sw = e.target.closest('.swatch'), btn = e.target.closest('[data-a]'), a = btn && btn.dataset.a;
      if (sw) recolour(sw.dataset.c);
      else if (a === 'default') recolour('');
      else if (a === 'edit') { close(); openEventEditor(ev, function () { onDone(); }); }
      else if (a === 'del') {
        close();
        if (!confirm('Delete “' + ev.title + '”' + (ev.recurring ? ' (this occurrence)' : '') + '?')) return;
        G.deleteEvent(ev.calId, ev.id).then(function () { setOverride(ev.calId + '|' + ev.id, null); onDone(); }).catch(function (x) { alert('Couldn’t delete: ' + x.message); });
      }
    });
  }

  /* ---------- event editor ---------- */
  function openEventEditor(ev, onDone) {
    var isNew = !ev.id;
    var cals = (G.calendars || []).filter(function (c) { return c.writable; });
    var canEdit = isNew || ev.editable;
    var dlg = L.el('dialog', { class: 'modal', 'aria-label': isNew ? 'New event' : 'Edit event' });
    var endShown = ev.allDay ? addDays(ev.end, -1) : ev.end;
    dlg.innerHTML =
      '<form method="dialog" class="modal-body">' +
      '  <input class="title-input" name="title" placeholder="Add title" aria-label="Title"' + (canEdit ? '' : ' readonly') + '>' +
      '  <div class="modal-grid three">' +
      '    <label>Date <input type="date" name="date" required></label>' +
      '    <label>Start <input type="time" name="start" step="300"></label>' +
      '    <label>End <input type="time" name="end" step="300"></label>' +
      '  </div>' +
      '  <div class="modal-grid">' +
      '    <label class="inline-check"><input type="checkbox" name="allDay"> All day</label>' +
      '    <label class="enddate" hidden>Until <input type="date" name="endDate"></label>' +
      '  </div>' +
      (isNew ? '  <label>Calendar <select name="cal">' + cals.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>' : '') +
      '  <div><label style="margin-bottom:6px">Colour</label><div class="swatches grid24 in-dialog" role="radiogroup" aria-label="Event colour">' + swatchHtml() + '</div>' +
      '  <button type="button" class="cvm-default small" data-default><i style="--c:' + esc(isNew ? defaultCal(cals).color : ev.calColor) + '"></i>Default (calendar colour)</button></div>' +
      '  <label>Location <input name="location" placeholder="Add location"></label>' +
      '  <label>Description <textarea name="description" rows="3" placeholder="Add description"></textarea></label>' +
      (ev.recurring ? '  <p class="muted small-note">Repeating event: changes here apply to this one occurrence. To change the whole series, open it in Google Calendar.</p>' : '') +
      (!canEdit ? '  <p class="muted small-note">You can’t edit this event here (it’s on a calendar you only view).</p>' : '') +
      '  <p class="muted small-note err" role="status"></p>' +
      '  <div class="modal-actions">' +
      '    <span class="left">' + (!isNew && canEdit ? '<button type="button" class="btn small ghost danger" data-del>Delete</button>' : '') +
      (ev.link ? '<a class="btn small ghost" href="' + esc(ev.link) + '" target="_blank" rel="noopener">Open in Google ' + L.ICONS.ext + '</a>' : '') + '</span>' +
      '    <button value="cancel" class="btn" formnovalidate>Cancel</button>' + (canEdit ? '<button value="save" class="btn primary">Save</button>' : '') +
      '  </div>' +
      '</form>';
    document.body.appendChild(dlg);
    var f = $('form', dlg), err = $('.err', dlg);
    f.title.value = isNew ? '' : ev.title;
    f.date.value = iso(ev.start);
    f.start.value = hm(ev.start); f.end.value = hm(ev.end);
    f.allDay.checked = !!ev.allDay;
    f.endDate.value = iso(endShown);
    f.location.value = ev.location || ''; f.description.value = ev.description || '';
    if (isNew && f.cal) { var prim = cals.filter(function (c) { return c.primary; })[0]; if (prim) f.cal.value = prim.id; }
    var colorKey = isNew ? '' : eventKey(ev);
    function paintSwatches() {
      dlg.querySelectorAll('.swatch').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.c === colorKey)); });
      dlg.querySelector('[data-default]').classList.toggle('on', !colorKey);
    }
    paintSwatches();
    dlg.querySelector('.swatches').addEventListener('click', function (e) { var b = e.target.closest('.swatch'); if (!b || !canEdit) return; colorKey = b.dataset.c; paintSwatches(); });
    dlg.querySelector('[data-default]').addEventListener('click', function () { if (!canEdit) return; colorKey = ''; paintSwatches(); });
    if (isNew && f.cal) f.cal.addEventListener('change', function () {
      var c = cals.filter(function (x) { return x.id === f.cal.value; })[0];
      var d = dlg.querySelector('[data-default] i'); if (c && d) d.style.setProperty('--c', c.color);
    });
    function syncAllDay() {
      f.start.disabled = f.end.disabled = f.allDay.checked;
      $('.enddate', dlg).hidden = !f.allDay.checked;
    }
    syncAllDay();
    f.allDay.addEventListener('change', syncAllDay);
    if (!canEdit) Array.prototype.forEach.call(f.elements, function (n) { if (n.name) n.disabled = true; });
    f.addEventListener('submit', function (e) {
      if (e.submitter && e.submitter.value === 'save') {
        e.preventDefault();
        var d = parseDate(f.date.value), start, end;
        if (f.allDay.checked) {
          start = d;
          var ed = f.endDate.value ? parseDate(f.endDate.value) : d;
          if (ed < d) ed = d;
          end = addDays(ed, 1);
        } else {
          var s = (f.start.value || '09:00').split(':'), en = (f.end.value || '10:00').split(':');
          start = new Date(d); start.setHours(+s[0], +s[1], 0, 0);
          end = new Date(d); end.setHours(+en[0], +en[1], 0, 0);
          if (end <= start) end = new Date(start.getTime() + 3600000);
        }
        var body = Object.assign({ summary: f.title.value.trim() || '(No title)', location: f.location.value.trim(), description: f.description.value }, G.timeBody(start, end, f.allDay.checked));
        var pk = BY_KEY[colorKey], exactId = idFor(colorKey);
        body.colorId = pk ? (exactId || nearestId(pk.hex)) : null;
        var exactLocal = pk && !exactId ? pk.hex : null;
        err.textContent = 'Saving…';
        var calId = isNew ? f.cal.value : ev.calId;
        (isNew ? G.createEvent(calId, body) : G.patchEvent(ev.calId, ev.id, body)).then(function (saved) {
          var id = (saved && saved.id) || ev.id, key = calId + '|' + id;
          if (exactLocal) setOverride(key, exactLocal); else if (overrides()[key]) setOverride(key, null);
          dlg.close(); onDone && onDone();
        }).catch(function (x) { err.textContent = x.needAuth ? 'Google connection expired. Click “Reconnect” and try again.' : 'Couldn’t save: ' + x.message; });
      }
    });
    var del = $('[data-del]', dlg);
    if (del) del.addEventListener('click', function () {
      if (!confirm('Delete “' + ev.title + '”' + (ev.recurring ? ' (this occurrence)' : '') + '?')) return;
      err.textContent = 'Deleting…';
      G.deleteEvent(ev.calId, ev.id).then(function () { dlg.close(); onDone && onDone(); })
        .catch(function (x) { err.textContent = 'Couldn’t delete: ' + x.message; });
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.showModal();
    if (isNew) f.title.focus();
  }

  /* ---------- day / week view ---------- */
  function CalView(root, opts) {
    this.root = root;
    this.opts = Object.assign({ days: 7, compact: false, scrollTo: 7 }, opts);
    this.date = startOfDay(this.opts.date || new Date());
    this.events = [];
    this.req = 0;
    var self = this;
    root.addEventListener('pointerdown', function (e) { self.onDown(e); });
    root.addEventListener('contextmenu', function (e) {
      var n = e.target.closest('.cv-ev, .cv-chip'); if (!n) return;
      var ev = self.find(n.dataset.ev); if (!ev || !ev.editable) return;
      e.preventDefault();
      colorMenu(ev, e.clientX, e.clientY, function (c) {
        if (c && c.color) { ev.color = c.color; self.render(false); }
        else self.load();
      });
    });
    (L.every || setInterval)(function () { self.paintNow(); }, 60000);
  }
  CalView.prototype.range = function () {
    var from = this.opts.days === 7 ? startOfWeek(this.date) : startOfDay(this.date);
    return { from: from, to: addDays(from, this.opts.days) };
  };
  CalView.prototype.setDate = function (d) { this.date = startOfDay(d); this.render(true); this.load(); };
  CalView.prototype.setDays = function (n) { this.opts.days = n; this.render(true); this.load(); };
  CalView.prototype.hourPx = function () { var b = this.root.querySelector('.cv-body'); return b ? b.offsetHeight / 24 : 52; };
  CalView.prototype.load = function () {
    var self = this, r = this.range(), my = ++this.req;
    var ld = this.root.querySelector('.cv-loading'); if (ld) ld.hidden = false;
    return G.listEvents(addDays(r.from, -1), addDays(r.to, 1)).then(function (list) {
      if (my !== self.req) return;
      self.events = list;
      self.render(false);
    }).catch(function (e) {
      if (my !== self.req) return;
      var ld2 = self.root.querySelector('.cv-loading'); if (ld2) { ld2.hidden = false; ld2.textContent = e.needAuth ? 'Reconnect Google to refresh' : 'Couldn’t load events'; }
      if (self.opts.onError) self.opts.onError(e);
    });
  };
  CalView.prototype.render = function (keepScroll) {
    var self = this, r = this.range(), n = this.opts.days, today = new Date();
    var s = (L.Store.doc && L.Store.doc.settings) || {};
    var tz2 = !this.opts.compact && s.tz2 !== '' ? (s.tz2 == null ? 'Asia/Shanghai' : s.tz2) : '';
    var gutters = tz2 ? 'var(--gutter) var(--gutter)' : 'var(--gutter)';
    var scroller = this.root.querySelector('.cv-scroll'), prevScroll = scroller ? scroller.scrollTop : null;
    var days = []; for (var i = 0; i < n; i++) days.push(addDays(r.from, i));
    var h = '<div class="cv' + (this.opts.compact ? ' compact' : '') + '" style="--days:' + n + ';--gutters:' + gutters + '">';
    if (n > 1 || !this.opts.compact) {
      h += '<div class="cv-head">' + (tz2 ? '<div class="cv-tzlabels" style="grid-column:span 2"><span>' + esc(s.tz2label == null ? 'CN' : (s.tz2label || tz2.split('/').pop())) + '</span><span>' + esc(localTzLabel()) + '</span></div>' : '<div></div>') +
        days.map(function (d) {
          return '<div class="cv-dayhead' + (sameDay(d, today) ? ' today' : '') + '" data-day="' + iso(d) + '">' + d.toLocaleDateString('en-GB', { weekday: 'short' }) + '<b>' + d.getDate() + '</b></div>';
        }).join('') + '</div>';
    }
    // all-day row
    var allDay = this.events.filter(function (e) { return e.allDay; });
    h += '<div class="cv-allday"><div class="cv-gl" style="grid-column:span ' + (tz2 ? 2 : 1) + '">all-day</div>';
    // Multi-day events are one bar across the days they cover, stacked in lanes (like Google Calendar).
    var n0 = days[0], spans = allDay.map(function (e) {
      var sIdx = Math.round((startOfDay(e.start) - n0) / DAY), eIdx = Math.round((startOfDay(e.end) - n0) / DAY); // end is exclusive
      return { e: e, s: Math.max(0, sIdx), en: Math.min(n, eIdx), contL: sIdx < 0, contR: eIdx > n };
    }).filter(function (x) { return x.en > x.s; })
      .sort(function (a, b) { return a.s - b.s || (b.en - b.s) - (a.en - a.s); });
    var lanes = [];
    spans.forEach(function (x) {
      for (var l = 0; l < lanes.length; l++) if (lanes[l] <= x.s) { x.lane = l; lanes[l] = x.en; return; }
      x.lane = lanes.length; lanes.push(x.en);
    });
    var rows = Math.max(1, lanes.length);
    h += '<div class="cv-adgrid" style="grid-column:span ' + n + ';grid-template-rows:repeat(' + rows + ', 22px)">';
    days.forEach(function (d, i) { h += '<div class="cv-adcell" data-day="' + iso(d) + '" style="grid-column:' + (i + 1) + ';grid-row:1 / span ' + rows + '"></div>'; });
    spans.forEach(function (x) {
      var e = x.e;
      h += '<div class="cv-chip' + (x.contL ? ' cont-l' : '') + (x.contR ? ' cont-r' : '') + '" data-ev="' + esc(e.calId + '|' + e.id) + '" style="grid-column:' + (x.s + 1) + ' / ' + (x.en + 1) + ';grid-row:' + (x.lane + 1) + ';--c:' + esc(e.color) + ';--t:' + textOn(e.color) + '" title="' + esc(e.title) + '">' + esc(e.title) + '</div>';
    });
    h += '</div>';
    h += '</div>';
    // timed grid
    h += '<div class="cv-scroll"><span class="cv-loading" hidden>Loading…</span><div class="cv-body">';
    if (tz2) h += '<div class="cv-gutter second">' + hourLabels(days[0], tz2) + '</div>';
    h += '<div class="cv-gutter">' + hourLabels(days[0]) + '</div>';
    days.forEach(function (d) {
      var dayEvents = self.events.filter(function (e) { return !e.allDay && e.start < addDays(d, 1) && e.end > d; });
      h += '<div class="cv-col' + (sameDay(d, today) ? ' today' : '') + '" data-day="' + iso(d) + '">' + layoutDay(dayEvents, d, today) + '</div>';
    });
    h += '</div></div></div>';
    this.root.innerHTML = h;
    var sc = this.root.querySelector('.cv-scroll');
    if (keepScroll === false && prevScroll != null) sc.scrollTop = prevScroll;
    else {
      var px = this.hourPx(), target = days.some(function (d) { return sameDay(d, today); }) ? Math.max(0, today.getHours() - 2) : this.opts.scrollTo;
      sc.scrollTop = Math.max(0, target * px);
    }
    this.paintNow();
    if (this.opts.onRender) this.opts.onRender(r);
  };
  function localTzLabel() {
    try { var p = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(new Date()).filter(function (x) { return x.type === 'timeZoneName'; })[0]; return p ? p.value : 'Local'; } catch (e) { return 'Local'; }
  }
  function hourLabels(day, tz) {
    var out = '';
    for (var hr = 0; hr < 24; hr++) {
      var d = new Date(day); d.setHours(hr, 0, 0, 0);
      var label = tz ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : String(hr).padStart(2, '0') + ':00';
      out += '<span style="top:calc(' + hr + ' * var(--hour))">' + label + '</span>';
    }
    return out;
  }
  function layoutDay(list, day, now) {
    var dayStart = day.getTime(), dayEnd = dayStart + DAY;
    var items = list.map(function (e) {
      var s = Math.max(e.start.getTime(), dayStart), en = Math.min(e.end.getTime(), dayEnd);
      return { e: e, s: (s - dayStart) / 60000, en: Math.max((en - dayStart) / 60000, (s - dayStart) / 60000 + 15) };
    }).sort(function (a, b) { return a.s - b.s || b.en - a.en; });
    // group overlapping events into clusters, then into columns
    var clusters = [], cur = null;
    items.forEach(function (it) {
      if (!cur || it.s >= cur.end) { cur = { items: [], end: it.en }; clusters.push(cur); }
      cur.items.push(it); cur.end = Math.max(cur.end, it.en);
    });
    var html = '';
    clusters.forEach(function (c) {
      var cols = [];
      c.items.forEach(function (it) {
        for (var k = 0; k < cols.length; k++) if (cols[k] <= it.s) { it.col = k; cols[k] = it.en; return; }
        it.col = cols.length; cols.push(it.en);
      });
      c.items.forEach(function (it) {
        var w = 100 / cols.length, dur = it.en - it.s;
        var e = it.e, past = e.end < now;
        html += '<div class="cv-ev' + (e.editable ? '' : ' ro') + (dur >= 45 ? ' tall' : '') + (past ? ' past' : '') + '" data-ev="' + esc(e.calId + '|' + e.id) + '" style="--c:' + esc(e.color) + ';--t:' + textOn(e.color) +
          ';top:calc(' + (it.s / 60) + ' * var(--hour));height:calc(' + (dur / 60) + ' * var(--hour) - 2px);left:calc(' + (it.col * w) + '% + 2px);width:calc(' + w + '% - 4px)" title="' + esc(e.title + ' · ' + hm(e.start) + '–' + hm(e.end)) + '">' +
          '<b>' + esc(e.title) + '</b>' + (dur >= 30 ? '<small>' + hm(e.start) + ' – ' + hm(e.end) + '</small>' : '') +
          (e.editable ? '<span class="cv-resize"></span>' : '') + '</div>';
      });
    });
    return html;
  }
  CalView.prototype.paintNow = function () {
    this.root.querySelectorAll('.cv-now').forEach(function (n) { n.remove(); });
    var now = new Date(), col = this.root.querySelector('.cv-col[data-day="' + iso(now) + '"]');
    if (!col) return;
    var line = document.createElement('div'); line.className = 'cv-now';
    line.style.top = 'calc(' + (minutesOf(now) / 60) + ' * var(--hour))';
    col.appendChild(line);
  };
  CalView.prototype.find = function (key) { return this.events.filter(function (e) { return e.calId + '|' + e.id === key; })[0]; };
  CalView.prototype.colAt = function (x, y) {
    var cols = this.root.querySelectorAll('.cv-col');
    for (var i = 0; i < cols.length; i++) { var r = cols[i].getBoundingClientRect(); if (x >= r.left && x < r.right) return cols[i]; }
    return null;
  };
  CalView.prototype.minAt = function (col, y) {
    var r = col.getBoundingClientRect(), px = this.hourPx();
    var m = Math.round(((y - r.top) / px * 60) / 15) * 15;
    return Math.max(0, Math.min(24 * 60, m));
  };
  CalView.prototype.reload = function () { return this.load(); };
  CalView.prototype.onDown = function (e) {
    if (e.button !== 0) return;
    var self = this, t = e.target;
    var dayHead = t.closest('.cv-dayhead');
    if (dayHead) { if (this.opts.onDayClick) this.opts.onDayClick(parseDate(dayHead.dataset.day)); return; }
    var chip = t.closest('.cv-chip');
    if (chip) { var ce = this.find(chip.dataset.ev); if (ce) openEventEditor(ce, function () { self.load(); }); return; }
    var ad = t.closest('.cv-adcell');
    if (ad) { var d0 = parseDate(ad.dataset.day); self.create({ start: d0, end: addDays(d0, 1), allDay: true }); return; }
    var evEl = t.closest('.cv-ev');
    var col = t.closest('.cv-col');
    if (!col) return;
    e.preventDefault();
    var startX = e.clientX, startY = e.clientY, moved = false, px = this.hourPx();

    if (evEl) {
      var ev = this.find(evEl.dataset.ev); if (!ev) return;
      var resizing = !!t.closest('.cv-resize');
      if (!ev.editable) { openEventEditor(ev, function () { self.load(); }); return; }
      var origTop = evEl.offsetTop, origH = evEl.offsetHeight, origCol = col, dayShift = 0, deltaMin = 0;
      var onMove = function (m) {
        var dy = m.clientY - startY, dx = m.clientX - startX;
        if (!moved && Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
        moved = true; evEl.classList.add('dragging');
        deltaMin = Math.round((dy / px * 60) / 15) * 15;
        if (resizing) {
          evEl.style.height = Math.max(px / 4, origH + deltaMin / 60 * px) + 'px';
        } else {
          evEl.style.top = (origTop + deltaMin / 60 * px) + 'px';
          var c = self.colAt(m.clientX, m.clientY);
          if (c && c !== evEl.parentNode) { c.appendChild(evEl); evEl.style.left = '2px'; evEl.style.width = 'calc(100% - 4px)'; }
          dayShift = c ? Math.round((parseDate(c.dataset.day) - parseDate(origCol.dataset.day)) / DAY) : 0;
        }
      };
      var onUp = function () {
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        if (!moved) { openEventEditor(ev, function () { self.load(); }); return; }
        var start = new Date(ev.start), end = new Date(ev.end);
        if (resizing) { end = new Date(end.getTime() + deltaMin * 60000); if (end <= start) end = new Date(start.getTime() + 15 * 60000); }
        else {
          start = addDays(new Date(start.getTime() + deltaMin * 60000), dayShift);
          end = addDays(new Date(end.getTime() + deltaMin * 60000), dayShift);
        }
        if (start.getTime() === ev.start.getTime() && end.getTime() === ev.end.getTime()) { self.render(false); return; }
        ev.start = start; ev.end = end; self.render(false);
        G.patchEvent(ev.calId, ev.id, G.timeBody(start, end, false)).then(function () { self.load(); })
          .catch(function (x) { alert(x.needAuth ? 'Google connection expired. Reconnect and try again.' : 'Couldn’t move the event: ' + x.message); self.load(); });
      };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
      return;
    }

    // drag on empty space to pick a time range for a new event
    var m0 = this.minAt(col, startY), m1 = m0 + 60, ghost = null;
    var onMove2 = function (m) {
      if (!moved && Math.abs(m.clientY - startY) < 5) return;
      moved = true;
      var mm = self.minAt(col, m.clientY);
      var a = Math.min(m0, mm), b = Math.max(m0, mm); if (b - a < 15) b = a + 15;
      if (!ghost) { ghost = document.createElement('div'); ghost.className = 'cv-ghost'; col.appendChild(ghost); }
      ghost.style.top = (a / 60 * px) + 'px'; ghost.style.height = ((b - a) / 60 * px) + 'px';
      ghost.textContent = fmtMin(a) + ' – ' + fmtMin(b);
      ghost.dataset.a = a; ghost.dataset.b = b;
    };
    var onUp2 = function () {
      window.removeEventListener('pointermove', onMove2); window.removeEventListener('pointerup', onUp2);
      var a = m0, b = m1;
      if (ghost) { a = +ghost.dataset.a; b = +ghost.dataset.b; }
      var day = parseDate(col.dataset.day);
      var s = new Date(day); s.setMinutes(a); var en = new Date(day); en.setMinutes(b);
      self.create({ start: s, end: en, allDay: false }, ghost);
    };
    window.addEventListener('pointermove', onMove2); window.addEventListener('pointerup', onUp2);
  };
  function fmtMin(m) { return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  CalView.prototype.create = function (ev, ghost) {
    var self = this;
    if (!(G.calendars || []).some(function (c) { return c.writable; })) { if (ghost) ghost.remove(); return; }
    openEventEditor(ev, function () { self.load(); });
    var dlg = document.querySelector('dialog.modal[open]');
    if (dlg && ghost) dlg.addEventListener('close', function () { ghost.remove(); });
  };

  /* ---------- mini month ---------- */
  function MiniMonth(root, opts) {
    this.root = root; this.opts = opts || {};
    this.sel = startOfDay(this.opts.date || new Date());
    this.month = new Date(this.sel.getFullYear(), this.sel.getMonth(), 1);
    var self = this;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.nav) {
        if (b.dataset.nav === 'today') { self.select(new Date()); return; }
        self.month = new Date(self.month.getFullYear(), self.month.getMonth() + (+b.dataset.nav), 1); self.render(); return;
      }
      if (b.dataset.day) self.select(parseDate(b.dataset.day));
    });
    this.render();
  }
  MiniMonth.prototype.select = function (d) {
    this.sel = startOfDay(d); this.month = new Date(d.getFullYear(), d.getMonth(), 1); this.render();
    if (this.opts.onSelect) this.opts.onSelect(this.sel);
  };
  MiniMonth.prototype.setSelected = function (d) { this.sel = startOfDay(d); this.month = new Date(d.getFullYear(), d.getMonth(), 1); this.render(); };
  MiniMonth.prototype.render = function () {
    var m = this.month, first = startOfWeek(m), today = new Date(), self = this;
    var h = '<div class="mm"><div class="mm-head"><strong>' + m.toLocaleDateString('en-GB', { month: 'short' }) + ' <span>' + m.getFullYear() + '</span></strong>' +
      '<div class="mm-nav"><button type="button" data-nav="-1" aria-label="Previous month">‹</button><button type="button" data-nav="today">TODAY</button><button type="button" data-nav="1" aria-label="Next month">›</button></div></div>' +
      '<div class="mm-grid">' + ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = addDays(first, i);
      h += '<button type="button" data-day="' + iso(d) + '" class="' + (d.getMonth() !== m.getMonth() ? 'out ' : '') + (sameDay(d, today) ? 'today ' : '') + (sameDay(d, self.sel) ? 'sel' : '') + '">' + d.getDate() + '</button>';
    }
    this.root.innerHTML = h + '</div></div>';
  };

  /* ---------- connect / reconnect states around a view ---------- */
  // Shows "Connect Google Calendar" until connected, then the view; when the hourly
  // Google pass runs out, keeps the view and shows a one-click "Reconnect" bar.
  function mount(viewEl, bannerEl, opts) {
    var view = null;
    function connectScreen(msg) {
      viewEl.innerHTML = '<div class="gcal-state"><p>' + esc(msg) + '</p><button type="button" class="btn primary" data-connect>Connect Google Calendar</button><p class="muted small-note"></p></div>';
    }
    function banner(show) {
      bannerEl.innerHTML = show ? '<div class="gcal-banner"><span>Google connection paused (it renews hourly).</span><button type="button" class="btn small primary" data-reconnect>Reconnect</button></div>' : '';
    }
    function start() {
      if (!view) view = new CalView(viewEl, opts);
      view.render(true);
      return view.load();
    }
    function refresh() {
      if (!G.configured()) { viewEl.innerHTML = '<div class="gcal-state"><p>Google Calendar isn’t set up yet.</p></div>'; return; }
      if (G.token()) { banner(false); start(); }
      else if (G.wasConnected()) { banner(true); if (view) view.render(false); else start().catch(function () {}); }
      else connectScreen(opts.connectText || 'See and edit your Google Calendar right here.');
    }
    function doConnect(fresh, note) {
      G.signIn(fresh).then(function () { G.calendars = null; refresh(); if (opts.onConnect) opts.onConnect(); })
        .catch(function (e) { if (note) note.textContent = (e && (e.message || e.type || e.error)) ? 'Google sign-in didn’t finish (' + (e.message || e.type || e.error) + ').' : 'Google sign-in didn’t finish.'; });
    }
    viewEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-connect]')) doConnect(true, viewEl.querySelector('.gcal-state .small-note'));
    });
    bannerEl.addEventListener('click', function (e) { if (e.target.closest('[data-reconnect]')) doConnect(false); });
    opts.onError = function (e) { if (e && e.needAuth) banner(true); };
    L.scoped(G.on(function (w) { if (w === 'auth' && G.token() && view) { banner(false); view.load(); } }));
    refresh();
    return { get view() { return view; }, refresh: refresh };
  }

  window.GCal = { G: G, CalView: CalView, mount: mount, modernColor: modern, MiniMonth: MiniMonth, openEventEditor: openEventEditor, startOfWeek: startOfWeek, addDays: addDays, iso: iso, sameDay: sameDay };
})();
