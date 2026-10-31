/* Positions: the job openings Ranran is considering, read live from her Google Sheet.

   The sheet's link is kept in the encrypted settings (settings.positionsSheet), never in this
   public code. The sheet has to be shared "Anyone with the link" (Viewer is enough) so the page
   can read it without a Google sign-in. It is read as CSV, so the page shows what the sheet
   shows. Row 1 holds the column names and every other non-empty row is one position. Columns
   the page knows (Position, Department/Faculty, University, PI, Type of position, Fit,
   Scope, Application deadline, Application material, Link, and Status if one is added) get
   their own place in a row; every column, known or not, appears in the row's details.
   A link to this tab can carry a sheet in its fragment, /launch/positions/#sheet=<id>(&gid=<n>):
   the fragment never reaches the server, and it only fills in the setup form. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;

  var STATE_KEY = 'launch.positions.v1';   // view and open rows on this device; no sheet content
  var REFRESH = 180000;                     // read the sheet again every 3 minutes while the tab is open
  var cache = { key: null, model: null, at: 0 };   // kept while the launch pad is open, never stored

  function state() { return L.lsGet(STATE_KEY) || {}; }
  function saveState(patch) { L.lsSet(STATE_KEY, Object.assign(state(), patch)); }

  var ICON = {
    refresh: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
  };

  /* ---------- the sheet ---------- */
  function sheetOf(s) {
    s = String(s || '').trim();
    var m = s.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]{20,})/) || s.match(/^([\w-]{30,})$/);
    if (!m) return null;
    var g = s.match(/[#?&]gid=(\d+)/);
    return { id: m[1], gid: g ? g[1] : '0' };
  }
  function editUrl(sh) { return 'https://docs.google.com/spreadsheets/d/' + sh.id + '/edit#gid=' + sh.gid; }
  function rowUrl(sh, n) { return editUrl(sh) + '&range=A' + n; }
  var SOURCES = [
    function (sh) { return 'https://docs.google.com/spreadsheets/d/' + sh.id + '/export?format=csv&gid=' + sh.gid; },
    function (sh) { return 'https://docs.google.com/spreadsheets/d/' + sh.id + '/gviz/tq?tqx=out:csv&gid=' + sh.gid; }
  ];
  function fetchCsv(url) {
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var type = r.headers.get('content-type') || '';
      return r.text().then(function (t) {
        if (/html/i.test(type) || /^\s*</.test(t)) throw new Error('not shared');   // Google's sign-in page
        return t;
      });
    });
  }
  var pending = null;
  function readSheet(sh) {
    var key = sh.id + '#' + sh.gid;
    if (pending && pending.key === key) return pending.p;
    var p = fetchCsv(SOURCES[0](sh)).catch(function (first) {
      return fetchCsv(SOURCES[1](sh)).catch(function () { throw first; });
    }).then(function (csv) { return build(parseCsv(csv), csv); });
    pending = { key: key, p: p };
    var done = function () { if (pending && pending.p === p) pending = null; };
    p.then(done, done);
    return p;
  }

  // RFC 4180: quoted cells may hold commas, doubled quotes and line breaks.
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, c;
    text = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ---------- rows → positions ---------- */
  // Which known field a column is, from its name in row 1 (each field takes the first column that fits).
  var FIELDS = [
    ['position', /^(position|title|role|job)\b/i],
    ['link', /\b(link|url|posting|apply)\b/i],
    ['dept', /department|faculty|school|program|institute|centre|center/i],
    ['uni', /universit|institution|employer|organi[sz]ation/i],
    ['pi', /^pi\b|principal investigator|supervisor|mentor|host/i],
    ['type', /\btype\b|contract/i],
    ['fit', /\bfit\b/i],
    ['scope', /scope|topic|focus/i],
    ['deadline', /deadline|due|closing/i],
    ['material', /material|documents?\b|requirements?\b/i],
    ['status', /status|stage|progress/i]
  ];
  function letter(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }

  function build(rows, csv) {
    var head = (rows[0] || []).map(function (h) { return String(h || '').replace(/\s+/g, ' ').trim(); });
    var at = {};
    var cols = head.map(function (h, i) {
      var key = null;
      FIELDS.some(function (f) {
        if (f[0] in at || !f[1].test(h)) return false;
        key = f[0]; at[key] = i; return true;
      });
      return { i: i, label: h || 'Column ' + letter(i), key: key };
    });
    var items = [];
    rows.slice(1).forEach(function (r, n) {
      var v = cols.map(function (c) { return String(r[c.i] == null ? '' : r[c.i]).trim(); });
      if (!v.some(Boolean)) return;
      var get = function (k) { return k in at ? v[at[k]] : ''; };
      var dl = get('deadline'), due = parseDate(dl), link = (get('link').match(/https?:\/\/[^\s<>"]+/) || [])[0] || '';
      items.push({
        row: n + 2, v: v,
        title: get('position') || v.filter(Boolean)[0],
        uni: get('uni'), dept: get('dept'), pi: get('pi'), type: get('type'), fit: get('fit'), status: get('status'),
        deadline: dl, due: due, rolling: !due && /rolling|until filled|open/i.test(dl),
        link: L.safeUrl(link)
      });
    });
    return { cols: cols, at: at, items: items, sig: hash(csv) };
  }

  /* ---------- dates in the deadline column ---------- */
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  function iso(y, m, d) {
    var t = new Date(y, m, d);
    if (t.getFullYear() !== y || t.getMonth() !== m || t.getDate() !== d) return null;
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  var MONTHS = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?';
  var DATE_FORMS = [
    [/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/, function (m) { return iso(+m[1], m[2] - 1, +m[3]); }],
    [new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MONTHS + ',?\\s+(\\d{4})\\b', 'i'), function (m) { return iso(+m[3], MON[m[2].toLowerCase()], +m[1]); }],
    [new RegExp('\\b' + MONTHS + '\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b', 'i'), function (m) { return iso(+m[3], MON[m[1].toLowerCase()], +m[2]); }],
    [/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/, function (m) { return iso(+m[3], m[2] - 1, +m[1]); }],
    [/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/, function (m) { return iso(+m[3], m[1] - 1, +m[2]); }]   // the sheet's US format: month/day/year
  ];
  // The first date written in the cell ("Mon 7 Dec 2026, 11:59 pm EST …" → 2026-12-07).
  function parseDate(s) {
    var best = null;
    DATE_FORMS.forEach(function (f) {
      var m = String(s || '').match(f[0]);
      if (!m || (best && best.at <= m.index)) return;
      var d = f[1](m);
      if (d) best = { at: m.index, d: d };
    });
    return best ? best.d : null;
  }
  function dateOf(isoDate) { var p = isoDate.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  /* ---------- small text helpers ---------- */
  // The first sentence of a cell's first line ("Kurt Gray, lab director. A C-SPAM …" → "Kurt Gray, lab director.").
  function firstSentence(s, max) {
    var line = String(s || '').split('\n')[0].trim().replace(/\b(e\.g|i\.e|etc|vs|cf|approx|Dr|Prof|No)\./gi, '$1․');
    var m = line.match(/^.*?[.!?](?=\s|$)/);
    var out = (m ? m[0] : line).replace(/․/g, '.');
    max = max || 110;
    return out.length > max ? out.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '') + '…' : out;
  }
  function tone(fit) {
    var lead = String(fit || '').trim();
    if (/^(strong|excellent|very good|great|good)\b/i.test(lead)) return 'good';
    if (/^(partial|moderate|some|mixed|stretch|ok|okay|fair)\b/i.test(lead)) return 'mid';
    if (/^(weak|poor|low|no|not)\b/i.test(lead)) return 'low';
    return '';
  }
  function cellHtml(s) { return L.linkify(s); }   // escaped, with links; line breaks kept by CSS
  function rowKey(it) { return hash((it.title || '') + '|' + (it.uni || '')); }

  /* ---------- the tab ---------- */
  L.boot('positions', function () {
    var paper = $('#psPaper'), sheetWrap = $('#psSheet'), status = $('#psStatus'), openLink = $('#psOpen');
    var refreshBtn = $('#psRefresh'), stats = $('#psStats'), allBtn = $('#psAll');
    var segs = Array.prototype.slice.call(document.querySelectorAll('#psMode button'));
    if (!paper) return;
    refreshBtn.innerHTML = ICON.refresh;

    var mode = state().mode === 'sheet' ? 'sheet' : 'preview';
    var sheetLink = null, sheet = null, loading = false;

    function linkFromSettings() { return ((S.doc && S.doc.settings) || {}).positionsSheet || ''; }
    function setStatus(text, bad) { status.textContent = text || ''; status.classList.toggle('bad', !!bad); }
    function stamp(t) { return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
    function isPhone() { return window.matchMedia('(max-width: 900px)').matches; }
    function openRows() { return state().open || {}; }

    /* the summary over the list */
    function renderStats() {
      var m = cache.model;
      if (!m) { stats.innerHTML = ''; return; }
      var up = m.items.filter(function (it) { return it.due && L.daysUntil(it.due) >= 0; })
        .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
      var next = up[0], soon = up.filter(function (it) { return L.daysUntil(it.due) <= 30; }).length;
      stats.innerHTML =
        '<div class="ps-stat"><span>Positions</span><b>' + m.items.length + '</b><small>in your sheet</small></div>' +
        '<div class="ps-stat ' + (next ? L.dueClass(next.due) : '') + '"><span>Next deadline</span><b>' + (next ? esc(L.fmtDue(next.due)) : '–') + '</b>' +
        '<small title="' + (next ? esc(next.title) : '') + '">' + (next ? esc(L.relDue(next.due) + ' · ' + (next.uni ? next.uni.split(',')[0] : next.title)) : 'none coming up') + '</small></div>' +
        '<div class="ps-stat"><span>Next 30 days</span><b>' + soon + '</b><small>' + (soon === 1 ? 'deadline' : 'deadlines') + '</small></div>';
    }

    /* one position */
    function whenBox(it) {
      if (it.due) {
        var d = dateOf(it.due), n = L.daysUntil(it.due);
        return '<div class="ps-when" title="' + esc(it.deadline) + '"><b>' + d.getDate() + '</b><small>' + esc(d.toLocaleDateString('en-GB', { month: 'short' })) +
          (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '') + '</small><em>' + esc(n < 0 ? 'passed' : L.relDue(it.due)) + '</em></div>';
      }
      return '<div class="ps-when none"><b>' + (it.rolling ? '∞' : '?') + '</b><small>' + (it.rolling ? 'Rolling' : 'No date') + '</small></div>';
    }
    function row(it, m) {
      var key = rowKey(it), open = !!openRows()[key], cls = it.due ? (L.daysUntil(it.due) < 0 ? 'past' : L.dueClass(it.due)) : '';
      var where = [it.uni, it.dept].filter(Boolean).join(' · ');
      var facts = [];
      if (it.fit) facts.push('<span class="ps-chip fit ' + tone(it.fit) + '" title="Fit with your background">' + esc(firstSentence(it.fit, 70)) + '</span>');
      if (it.status) facts.push('<span class="ps-chip status"><em>Status</em>' + esc(firstSentence(it.status, 40)) + '</span>');
      if (it.pi) facts.push('<span class="ps-chip"><em>PI</em>' + esc(firstSentence(it.pi, 70)) + '</span>');
      if (it.type) facts.push('<span class="ps-chip">' + esc(firstSentence(it.type, 90)) + '</span>');
      var shown = { position: 1, link: 1 };
      var details = m.cols.filter(function (c) { return !(c.key in shown) && it.v[c.i]; }).map(function (c) {
        return '<section class="ps-sec"><h4>' + esc(c.label) + '</h4><p>' + cellHtml(it.v[c.i]) + '</p></section>';
      }).join('');
      var id = 'psd-' + key;
      return '<article class="ps-row ' + cls + (open ? ' open' : '') + '" data-key="' + esc(key) + '">' +
        whenBox(it) +
        '<div class="ps-main">' +
        '<h3>' + (it.link ? '<a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + ICON.ext + '</a>' : esc(it.title)) + '</h3>' +
        (where ? '<p class="ps-where">' + esc(where) + '</p>' : '') +
        (facts.length ? '<p class="ps-facts">' + facts.join('') + '</p>' : '') +
        '</div>' +
        '<div class="ps-acts">' +
        (it.link ? '<a class="btn small primary" href="' + esc(it.link) + '" target="_blank" rel="noopener">Apply ' + ICON.ext + '</a>' : '') +
        '<button type="button" class="btn small ps-more" aria-expanded="' + open + '" aria-controls="' + id + '">Details' + ICON.chev + '</button>' +
        '</div>' +
        '<div class="ps-details" id="' + id + '"' + (open ? '' : ' hidden') + '>' + details +
        '<p class="ps-rowlink"><a href="' + esc(rowUrl(sheet, it.row)) + '" target="_blank" rel="noopener">Row ' + it.row + ' in the sheet' + ICON.ext + '</a></p></div>' +
        '</article>';
    }

    function render() {
      var m = cache.model;
      if (!m) return;
      renderStats();
      var up = [], undated = [], past = [];
      m.items.forEach(function (it) { (it.due ? (L.daysUntil(it.due) < 0 ? past : up) : undated).push(it); });
      up.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.row - b.row; });
      past.sort(function (a, b) { return a.due > b.due ? -1 : a.due < b.due ? 1 : a.row - b.row; });
      var groups = [['Coming up', up], ['Rolling or no date', undated], ['Deadline passed', past]].filter(function (g) { return g[1].length; });
      var body = groups.map(function (g) {
        return (groups.length > 1 ? '<h2 class="ps-group">' + g[0] + '<b>' + g[1].length + '</b></h2>' : '') +
          g[1].map(function (it) { return row(it, m); }).join('');
      }).join('');
      if (!m.items.length) {
        body = '<div class="ps-msg"><p class="ps-kicker">Positions</p><h1>No positions yet</h1>' +
          '<p>The sheet has its column names but no rows. Send Claude a posting you’re interested in, or add a row to the sheet yourself.</p></div>';
      }
      paper.innerHTML = '<div class="ps-list">' + body + '</div>' +
        '<div class="ps-foot"><span>Live from your Google Sheet · updates every few minutes</span><button type="button" data-change>Change sheet</button></div>';
      paintAll();
    }
    function paintAll() {
      var rows = paper.querySelectorAll('.ps-row'), opened = paper.querySelectorAll('.ps-row.open').length;
      allBtn.hidden = !rows.length || mode !== 'preview';
      allBtn.textContent = rows.length && opened === rows.length ? 'Collapse all' : 'Expand all';
    }
    function setOpen(rowEl, open) {
      var key = rowEl.dataset.key, o = openRows();
      rowEl.classList.toggle('open', open);
      var btn = rowEl.querySelector('.ps-more'), det = rowEl.querySelector('.ps-details');
      if (btn) btn.setAttribute('aria-expanded', String(open));
      if (det) det.hidden = !open;
      if (open) o[key] = 1; else delete o[key];
      saveState({ open: o });
    }

    /* reading the sheet */
    function refresh(manual) {
      if (!sheet || loading) return;
      loading = true;
      refreshBtn.classList.add('spin');
      var key = sheet.id + '#' + sheet.gid;
      if (!cache.model || cache.key !== key) setStatus('Reading the sheet…');
      readSheet(sheet).then(function (model) {
        if (!sheet || key !== sheet.id + '#' + sheet.gid) return;
        var changed = cache.key !== key || !cache.model || model.sig !== cache.model.sig;
        cache = { key: key, model: model, at: Date.now() };
        if (changed) render();
        setStatus('Updated ' + stamp(cache.at));
      }).catch(function () {
        if (!sheet || key !== sheet.id + '#' + sheet.gid) return;
        if (cache.key === key && cache.model) { setStatus('Couldn’t reach the sheet · showing the copy from ' + stamp(cache.at), true); return; }
        setStatus('Couldn’t read the sheet', true);
        renderError();
      }).then(function () {
        loading = false;
        refreshBtn.classList.remove('spin');
        if (manual) refreshBtn.blur();
      });
    }

    function renderLoading() {
      stats.innerHTML = '';
      paper.innerHTML = '<div class="ps-list ps-skel" aria-hidden="true">' + [0, 1, 2].map(function () {
        return '<div class="ps-row"><i class="ps-when"></i><div class="ps-main"><b></b><i></i><i style="width:55%"></i></div></div>';
      }).join('') + '</div>';
      allBtn.hidden = true;
    }
    function renderError() {
      var offline = navigator.onLine === false;
      stats.innerHTML = '';
      allBtn.hidden = true;
      paper.innerHTML = '<div class="ps-msg"><p class="ps-kicker">Positions</p><h1>' + (offline ? 'You’re offline' : 'Couldn’t read the sheet') + '</h1>' +
        (offline ? '<p>The positions will load again once you’re back online.</p>'
          : '<p>Check that the sheet’s sharing is set to <strong>Anyone with the link</strong> (Share → General access; Viewer is enough). The page reads the sheet without signing in to Google, so a private sheet can’t be read here.</p>') +
        '<div class="ps-actions"><button type="button" class="btn primary" data-retry>Try again</button>' +
        (sheet ? '<a class="btn" href="' + esc(editUrl(sheet)) + '" target="_blank" rel="noopener">Open in Google Sheets</a>' : '') +
        '<button type="button" class="btn ghost" data-change>Change sheet</button></div></div>';
    }
    function renderSetup(msg, offered) {
      setStatus('');
      stats.innerHTML = '';
      allBtn.hidden = true;
      paper.innerHTML =
        '<div class="ps-msg"><p class="ps-kicker">Positions</p><h1>' + (offered ? 'Use this sheet for Positions?' : 'Link your positions sheet') + '</h1>' +
        (offered
          ? '<p>The link you opened names a Google Sheet for this tab' + (sheet ? ', in place of the one it shows now' : '') + '. Press the button to show its rows here.</p>'
          : '<p>Paste the link of the Google Sheet that lists the positions you’re considering. Row 1 holds the column names (Position, University, PI, Application deadline …); each row below is one position.</p>') +
        '<form class="ps-form" data-link><label class="sr" for="psLinkIn">Google Sheet link</label><input id="psLinkIn" name="u" type="url" inputmode="url" autocomplete="off" placeholder="https://docs.google.com/spreadsheets/d/…" value="' + esc(offered || '') + '" required><button class="btn primary">Use this sheet</button>' +
        (offered ? '<button type="button" class="btn ghost" data-dismiss>Not now</button>' : '') + '</form>' +
        (msg ? '<p class="ps-err" role="alert">' + esc(msg) + '</p>' : '') +
        '<p class="ps-fine">The link is kept in your encrypted launch-pad data, not in the site’s public code. In Google Sheets, set Share → General access to “Anyone with the link” (Viewer is enough) so this page can read it.</p></div>';
    }
    // /launch/positions/#sheet=<id>(&gid=<n>) → that sheet's link, offered in the setup form
    function offeredSheet() {
      var m = (location.hash || '').match(/[#&]sheet=([\w-]{20,})(?:&gid=(\d+))?/);
      return m ? editUrl({ id: m[1], gid: m[2] || '0' }) : '';
    }
    function clearOffer() {
      if (!offeredSheet()) return;
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }

    function saveLink(value, after) {
      var sh = sheetOf(value);
      if (!sh) return 'That doesn’t look like a Google Sheet link. Copy it from the address bar of the sheet (it contains /spreadsheets/d/…).';
      clearOffer();
      S.setSettings({ positionsSheet: editUrl(sh) });
      if (after) after();
      return '';
    }
    function changeSheet() {
      var dlg = L.el('dialog', { class: 'modal', 'aria-label': 'Positions sheet' });
      dlg.innerHTML =
        '<form method="dialog" class="modal-body">' +
        '  <h2>Positions sheet</h2>' +
        '  <label>Google Sheet link <small>The sheet whose rows fill the Positions tab. Set its sharing to “Anyone with the link”.</small><input name="u" type="url" placeholder="https://docs.google.com/spreadsheets/d/…"></label>' +
        '  <p class="muted small-note err" role="status"></p>' +
        '  <div class="modal-actions"><button value="cancel" class="btn" formnovalidate>Cancel</button><button value="save" class="btn primary">Save</button></div>' +
        '</form>';
      document.body.appendChild(dlg);
      var f = $('form', dlg);
      f.u.value = linkFromSettings();
      f.addEventListener('submit', function (ev) {
        if (!ev.submitter || ev.submitter.value !== 'save') return;
        ev.preventDefault();
        var err = saveLink(f.u.value, function () { dlg.close(); });
        if (err) $('.err', dlg).textContent = err;
      });
      dlg.addEventListener('close', function () { dlg.remove(); });
      dlg.showModal();
    }

    /* preview / the real sheet */
    function setMode(m) {
      if (m === 'sheet' && !sheet) m = 'preview';
      var was = mode;
      mode = m;
      saveState({ mode: m });
      segs.forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      if (m === 'sheet') {
        var want = editUrl(sheet);
        if (sheetWrap.dataset.src !== want) {
          sheetWrap.innerHTML = '<iframe title="Positions in Google Sheets" src="' + esc(want) + '" allow="clipboard-read; clipboard-write"></iframe>';
          sheetWrap.dataset.src = want;
        }
        sheetWrap.hidden = false; paper.hidden = true;
      } else {
        sheetWrap.hidden = true; paper.hidden = false;
        if (was === 'sheet' && sheet) refresh();   // show what was just edited
      }
      paintAll();
    }

    /* events */
    paper.addEventListener('click', function (e) {
      if (e.target.closest('[data-dismiss]')) { clearOffer(); apply(); return; }
      var more = e.target.closest('.ps-more');
      if (more) { var r = more.closest('.ps-row'); setOpen(r, !r.classList.contains('open')); paintAll(); return; }
      if (e.target.closest('[data-retry]')) { refresh(true); return; }
      if (e.target.closest('[data-change]')) { changeSheet(); return; }
    });
    paper.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-link]');
      if (!f) return;
      e.preventDefault();
      var err = saveLink(f.u.value);
      if (err) renderSetup(err, offeredSheet());
    });
    allBtn.addEventListener('click', function () {
      var rows = Array.prototype.slice.call(paper.querySelectorAll('.ps-row[data-key]'));
      var open = rows.some(function (r) { return !r.classList.contains('open'); });
      rows.forEach(function (r) { setOpen(r, open); });
      paintAll();
    });
    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mode === 'sheet') {
          if (!sheet) return;
          if (isPhone()) { window.open(editUrl(sheet), '_blank', 'noopener'); return; }   // the Sheets app on a phone
          if (mode !== 'sheet') setMode('sheet');
        } else setMode('preview');
      });
    });
    refreshBtn.addEventListener('click', function () { refresh(true); });
    L.listen(document, 'visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() - cache.at > 60000) refresh();
    });
    L.every(function () { if (document.visibilityState === 'visible' && mode === 'preview') refresh(); }, REFRESH);

    /* start, and follow changes to the sheet link */
    function apply() {
      sheetLink = linkFromSettings();
      var sh = sheetOf(sheetLink), offer = offeredSheet();
      if (offer && (!sh || offer !== editUrl(sh))) {
        sheet = sh;
        refreshBtn.hidden = true;
        openLink.hidden = true;
        segs.forEach(function (b) { b.disabled = b.dataset.mode === 'sheet'; });
        setMode('preview');
        renderSetup('', offer);
        return;
      }
      if (offer) clearOffer();
      refreshBtn.hidden = !sh;
      if (!sh) {
        sheet = null;
        openLink.hidden = true;
        segs.forEach(function (b) { b.disabled = b.dataset.mode === 'sheet'; });
        setMode('preview');
        renderSetup(sheetLink ? 'The saved link doesn’t look like a Google Sheet. Paste the sheet’s own link.' : '');
        return;
      }
      var key = sh.id + '#' + sh.gid;
      sheet = sh;
      openLink.hidden = false;
      openLink.href = editUrl(sh);
      segs.forEach(function (b) { b.disabled = false; });
      setMode(isPhone() ? 'preview' : mode);
      if (cache.model && cache.key === key) {
        render();
        setStatus('Updated ' + stamp(cache.at));
        if (Date.now() - cache.at > 60000) refresh();
      } else {
        renderLoading();
        refresh();
      }
    }
    L.onStore(function () { if (linkFromSettings() !== sheetLink) apply(); });
    apply();
  });
})();
