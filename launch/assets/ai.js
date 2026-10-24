/* AI updates: skills and tools from Ranran's RedNote likes and collections, checked every day by Claude.
   The list lives in /launch/AI-updates/items.json (written by the daily check); your own marks
   (installed, hidden) are saved in the encrypted launch pad like your tasks.
   Cards are picture-first: a preview of the tool, its name and one line; details sit in icon tooltips. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;
  var DATA_URL = '/launch/AI-updates/items.json';
  var FILTER_KEY = 'launch.ai.filter.v1';
  var NEW_DAYS = 7;

  var KINDS = [
    { k: 'skill', name: 'Skills', one: 'Skill', c: '#86e3a6' },
    { k: 'mcp-plugin', name: 'MCP & plugins', one: 'MCP · plugin', c: '#8fd0ff' },
    { k: 'open-source', name: 'Open source', one: 'Open source', c: '#c8b5ff' },
    { k: 'web-tool', name: 'AI tools & models', one: 'AI tool', c: '#ffd66e' },
    { k: 'design-resource', name: 'Design resources', one: 'Design', c: '#ffb0cf' },
    { k: 'prompts', name: 'Prompts', one: 'Prompts', c: '#ffa463' },
    { k: 'hardware', name: 'Hardware', one: 'Hardware', c: '#93e6dc' }
  ];
  var KIND = {};
  KINDS.forEach(function (x) { KIND[x.k] = x; });
  function kindOf(it) {
    if (KIND[it.kind]) return it.kind;
    return it.kind === 'model' ? 'web-tool' : 'open-source';
  }

  var ICON = {
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    hide: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9"/><path d="M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m1 1 22 22"/></svg>',
    show: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.4"/></svg>',
    // "Saved from RedNote": a small red notebook, no words.
    note: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="4" fill="#ff2442"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>'
  };

  /* ---------- data ---------- */
  var data = null, loadError = null, byId = {};
  function load() {
    return fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { data = j; loadError = null; return j; })
      .catch(function (e) { loadError = e; throw e; });
  }

  /* ---------- small helpers ---------- */
  function todayUTC() { var t = new Date(); return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()); }
  function daysAgo(iso) {
    if (!iso) return Infinity;
    var p = String(iso).slice(0, 10).split('-').map(Number);
    return Math.round((todayUTC() - Date.UTC(p[0], p[1] - 1, p[2])) / 86400000);
  }
  function isNew(it) { return !!(data && it.found && it.found > (data.baseline || '') && daysAgo(it.found) <= NEW_DAYS); }
  function dateOf(iso, opts) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtStars(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    n = Number(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e5) return Math.round(n / 1000) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function ghPath(u) { var m = String(u || '').match(/github\.com\/([^\/\s]+\/[^\/\s#?]+)/i); return m ? m[1].replace(/\.git$/, '') : ''; }
  function linkLabel(u) { var g = ghPath(u); return g ? 'GitHub' : (host(u) || 'Open'); }
  function noteUrl(n) { return 'https://www.xiaohongshu.com/explore/' + encodeURIComponent(n.id); }
  function newest(it) { var d = ''; (it.sources || []).forEach(function (n) { if (n.date > d) d = n.date; }); return d; }
  function hue(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

  // The install command, when the "install" text has one (in backticks or starting with a known tool).
  var CMD = /^(npx|npm|pnpm|yarn|pip3?|uvx?|brew|git|docker|curl|claude|\/plugin|cargo|go)\b/;
  function commandOf(s) {
    s = String(s || '');
    var tick = s.match(/`([^`]+)`/);
    if (tick) return tick[1];
    return CMD.test(s.trim()) ? s.trim() : '';
  }

  // "Install with Claude" opens a new Claude chat with the request already written.
  function claudeUrl(it) {
    var link = it.linkKind === 'search' ? '' : (it.link || it.site || ''), p;
    if (kindOf(it) === 'skill') {
      p = 'Please install the agent skill "' + it.name + '" for me' + (link ? ': ' + link : '.') + '\n\n' +
        'First review it for safety: read its SKILL.md and every script or file it ships, and tell me if anything runs remote code, reads credentials or keys, or sends data elsewhere. If the repo holds several skills, list them and ask which ones I want.\n\n' +
        'If it is clean, package it as a Claude plugin file I can install (skills copied unchanged, valid plugin manifest) and send it to me. Also give me the one-line command to add it to Claude Code on my Mac.';
    } else {
      p = 'Help me set up "' + it.name + '"' + (link ? ' (' + link + ')' : '') + ' with Claude. ' +
        'First check what it needs and review it for safety (remote code, credentials, data sent elsewhere), then walk me through connecting it, or package it as a plugin if that applies.';
    }
    return 'https://claude.ai/new?q=' + encodeURIComponent(p);
  }

  /* ---------- filters (remembered on this device) ---------- */
  var filter = Object.assign({ q: '', kind: 'all', hidden: false }, L.lsGet(FILTER_KEY) || {});
  function saveFilter() { L.lsSet(FILTER_KEY, { kind: filter.kind, hidden: filter.hidden }); }

  function matches(it) {
    var st = S.aiState(it.id) || {};
    if (st.hidden && !filter.hidden) return false;
    if (filter.kind !== 'all' && kindOf(it) !== filter.kind) return false;
    var q = filter.q.trim().toLowerCase();
    if (!q) return true;
    var hay = [it.name, it.summary, it.install, it.note, it.link, it.site, (it.tags || []).join(' ')]
      .concat((it.sources || []).map(function (n) { return n.title + ' ' + n.author; })).join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function hasRealLink(it) { return !!(it.link || it.site) && it.linkKind !== 'search'; }
  function sortItems(a, b) {
    var na = isNew(a), nb = isNew(b);
    if (na !== nb) return na ? -1 : 1;
    var la = hasRealLink(a), lb = hasRealLink(b);
    if (la !== lb) return la ? -1 : 1;
    var ia = !!a.img, ib = !!b.img;
    if (ia !== ib) return ia ? -1 : 1;
    if ((a.found || '') !== (b.found || '')) return (b.found || '') < (a.found || '') ? -1 : 1;
    var da = newest(a), db = newest(b);
    if (da !== db) return db < da ? -1 : 1;
    var sa = Number(a.stars) || 0, sb = Number(b.stars) || 0;
    if (sa !== sb) return sb - sa;
    return String(a.name).localeCompare(String(b.name));
  }

  /* ---------- rendering ---------- */
  // A colour poster with the name, for tools without a picture.
  function tile(it) {
    var name = String(it.name).replace(/\s*\([^)]*\)\s*$/, '');
    return '<div class="ai-tile" style="--h:' + hue(it.id) + '"><span>' + esc(name) + '</span></div>';
  }
  function cover(it, link) {
    var inner = it.img
      ? '<img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"' + (/mshots/.test(it.img) ? ' data-shot="1"' : '') + '>'
      : tile(it);
    return link
      ? '<a class="ai-cover" href="' + esc(link) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' + inner + '</a>'
      : '<div class="ai-cover">' + inner + '</div>';
  }

  function card(it) {
    var k = KIND[kindOf(it)], st = S.aiState(it.id) || {};
    var link = L.safeUrl(it.link || it.site);
    var stars = fmtStars(it.stars), src = it.sources || [], first = src[0];
    var canInstall = (k.k === 'skill' || k.k === 'mcp-plugin') && !!(it.link || it.site);
    var cmd = commandOf(it.install);
    var prompts = Array.isArray(it.prompts) ? it.prompts : [];
    var info = [it.install && !cmd ? 'Get it: ' + it.install : '', it.note, it.review,
      it.linkKind === 'search' ? 'No official link confirmed yet; the button searches for it.' : ''].filter(Boolean).join('\n');
    var noteTip = first ? 'Saved from RedNote: ' + first.title + (first.author ? ' · ' + first.author : '') + (src.length > 1 ? ' (+' + (src.length - 1) + ' more)' : '') : '';
    return '<article class="ai-item' + (st.installed ? ' is-installed' : '') + (st.hidden ? ' is-hidden' : '') + '" data-id="' + esc(it.id) + '" style="--k:' + k.c + '">' +
      cover(it, link) +
      '<div class="ai-body">' +
      '<div class="ai-item-top">' +
      '<span class="ai-kind">' + esc(k.one) + '</span>' +
      (isNew(it) ? '<span class="ai-tag new">New</span>' : '') +
      (st.installed ? '<span class="ai-tag done">Installed</span>' : '') +
      (it.plugin ? '<span class="ai-tag sent" title="Packaged as a plugin by the daily check">Plugin ready</span>' : '') +
      '<span class="spacer"></span>' +
      (stars ? '<span class="ai-stars" title="GitHub stars as reported in the RedNote post">★ ' + esc(stars) + '</span>' : '') +
      '<span class="ai-marks">' +
      '<button type="button" class="icon-btn ai-mark" data-act="installed" aria-pressed="' + (st.installed ? 'true' : 'false') + '" title="' + (st.installed ? 'Marked as installed — click to undo' : 'Mark as installed') + '" aria-label="Mark ' + esc(it.name) + ' as installed">' + ICON.check + '</button>' +
      '<button type="button" class="icon-btn ai-mark" data-act="hidden" aria-pressed="' + (st.hidden ? 'true' : 'false') + '" title="' + (st.hidden ? 'Show again' : 'Not interested — hide') + '" aria-label="' + (st.hidden ? 'Show ' : 'Hide ') + esc(it.name) + '">' + (st.hidden ? ICON.show : ICON.hide) + '</button>' +
      '</span>' +
      '</div>' +
      '<h3>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(it.name) + '</a>' : esc(it.name)) + '</h3>' +
      (it.summary ? '<p class="ai-sum" title="' + esc(it.summary) + '">' + esc(it.summary) + '</p>' : '') +
      '<div class="ai-actions">' +
      (canInstall
        ? '<a class="btn small primary" href="' + esc(claudeUrl(it)) + '" target="_blank" rel="noopener" title="Opens a new Claude chat that reviews it and packages it for you">' + (k.k === 'skill' ? 'Install with Claude' : 'Set up with Claude') + '</a>'
        : (link ? (it.linkKind === 'search'
          ? '<a class="btn small ghost" href="' + esc(link) + '" target="_blank" rel="noopener">Search ' + L.ICONS.ext + '</a>'
          : '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(linkLabel(link)) + ' ' + L.ICONS.ext + '</a>') : '')) +
      '<span class="ai-icons">' +
      (canInstall && link ? '<a class="icon-btn" href="' + esc(link) + '" target="_blank" rel="noopener" title="Open ' + esc(linkLabel(link) === 'GitHub' ? 'on GitHub' : linkLabel(link)) + '" aria-label="Open ' + esc(it.name) + '">' + L.ICONS.ext + '</a>' : '') +
      (cmd ? '<button type="button" class="icon-btn ai-copy" data-copy="' + esc(cmd) + '" title="Copy install command: ' + esc(cmd) + '" aria-label="Copy install command">' + ICON.copy + '</button>' : '') +
      (prompts.length ? '<button type="button" class="icon-btn ai-copy" data-copy="' + esc(prompts.join('\n\n')) + '" title="Copy all ' + prompts.length + ' prompts" aria-label="Copy the prompts">' + ICON.copy + '</button>' : '') +
      (info ? '<span class="icon-btn ai-info" tabindex="0" role="img" title="' + esc(info) + '" aria-label="' + esc(info) + '">' + ICON.info + '</span>' : '') +
      (first ? '<a class="icon-btn ai-note" href="' + esc(noteUrl(first)) + '" target="_blank" rel="noopener" title="' + esc(noteTip) + '" aria-label="Open the RedNote post it came from">' + ICON.note + '</a>' : '') +
      '</span>' +
      '</div>' +
      '</div>' +
      '</article>';
  }

  function renderStats(all) {
    var box = $('#aiStats'); if (!box) return;
    var n = function (k) { return all.filter(function (it) { return kindOf(it) === k; }).length; };
    var fresh = all.filter(isNew).length;
    var installed = all.filter(function (it) { var s = S.aiState(it.id); return s && s.installed; }).length;
    var checked = data && data.checked ? new Date(data.checked) : null;
    var tiles = [
      ['Tools', all.length, 'from ' + ((data && data.noteCount) || 0) + ' saved notes'],
      ['Skills', n('skill'), 'installable in Claude'],
      ['New this week', fresh, fresh ? 'marked New below' : 'nothing new yet'],
      ['Installed', installed, 'marked by you']
    ];
    box.innerHTML = tiles.map(function (t) {
      return '<div class="ai-stat"><span>' + esc(t[0]) + '</span><b>' + esc(t[1]) + '</b><small>' + esc(t[2]) + '</small></div>';
    }).join('');
    var sub = $('#aiSub');
    if (sub && checked && !isNaN(checked)) {
      sub.textContent = 'Skills, tools and resources you saved. Last checked ' +
        checked.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + ', ' +
        checked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.';
    }
  }

  function renderBanner() {
    var b = $('#aiBanner'); if (!b) return;
    var msg = '';
    var st = data && data.status;
    if (st && st.state && st.state !== 'ok') msg = st.message || 'The last daily check didn’t finish.';
    else if (data && data.checked) {
      var age = Math.floor((Date.now() - new Date(data.checked).getTime()) / 86400000);
      if (age >= 2) msg = 'The last check was ' + age + ' days ago. Your computer may have been off, or RedNote logged out of Claude’s browser. The next check catches up on everything you saved in between.';
    }
    b.innerHTML = msg ? '<div class="ai-banner" role="status">' + esc(msg) + '</div>' : '';
  }

  function renderChips(all) {
    var box = $('#aiKinds'); if (!box) return;
    var counts = {};
    all.forEach(function (it) {
      var st = S.aiState(it.id) || {};
      if (st.hidden && !filter.hidden) return;
      counts[kindOf(it)] = (counts[kindOf(it)] || 0) + 1;
    });
    var chips = [{ k: 'all', name: 'All' }].concat(KINDS.filter(function (x) { return counts[x.k]; }));
    if (filter.kind !== 'all' && !counts[filter.kind]) filter.kind = 'all';
    box.innerHTML = chips.map(function (x) {
      var on = filter.kind === x.k;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-kind="' + esc(x.k) + '" aria-pressed="' + on + '"' + (x.c ? ' style="--p:' + x.c + '"' : '') + '>' +
        (x.c ? '<i></i>' : '') + esc(x.name) + (x.k !== 'all' ? ' <span class="ai-count">' + counts[x.k] + '</span>' : '') + '</button>';
    }).join('');
  }

  function renderList(all) {
    var wrap = $('#aiList'); if (!wrap) return;
    var shown = all.filter(matches).sort(sortItems);
    if (!shown.length) {
      wrap.innerHTML = '<p class="empty">' + (filter.q ? 'Nothing matches “' + esc(filter.q) + '”.' : 'Nothing here yet.') + '</p>';
      return;
    }
    var groups = KINDS.map(function (x) { return { kind: x, items: shown.filter(function (it) { return kindOf(it) === x.k; }) }; })
      .filter(function (g) { return g.items.length; });
    wrap.innerHTML = groups.map(function (g) {
      return '<section class="ai-group" aria-label="' + esc(g.kind.name) + '" style="--k:' + g.kind.c + '">' +
        '<h2><i></i>' + esc(g.kind.name) + ' <span>' + g.items.length + '</span></h2>' +
        '<div class="ai-grid">' + g.items.map(card).join('') + '</div></section>';
    }).join('');
  }

  function renderFoot() {
    var f = $('#aiFoot'); if (!f) return;
    f.textContent = (data && data.schedule) || '';
  }

  function render() {
    if (!data) {
      var wrap = $('#aiList');
      if (wrap && loadError) wrap.innerHTML = '<p class="empty">Couldn’t load the list (' + esc(loadError.message || 'error') + '). Check your connection and reload.</p>';
      return;
    }
    var all = (data.items || []).filter(function (it) { return it && it.id && it.name; });
    byId = {};
    all.forEach(function (it) { byId[it.id] = it; });
    renderStats(all);
    renderBanner();
    renderChips(all);
    renderList(all);
    renderFoot();
  }

  // A picture that fails to load, or a website screenshot that is still being made, becomes a colour poster.
  function toTile(img) {
    var card = img.closest('.ai-item'), it = card && byId[card.dataset.id];
    if (it) img.outerHTML = tile(it);
  }

  function copyText(text, btn) {
    var done = function () {
      var t = btn.getAttribute('title');
      btn.classList.add('copied'); btn.setAttribute('title', 'Copied');
      setTimeout(function () { btn.classList.remove('copied'); btn.setAttribute('title', t); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy:', text); });
    else window.prompt('Copy:', text);
  }

  L.boot('ai', function () {
    var q = $('#aiQ'), hiddenBtn = $('#aiShowHidden');
    if (q) {
      q.value = filter.q;
      var t = null;
      q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { filter.q = q.value; render(); }, 120); });
    }
    if (hiddenBtn) {
      var paintHidden = function () { hiddenBtn.setAttribute('aria-pressed', filter.hidden ? 'true' : 'false'); hiddenBtn.textContent = filter.hidden ? 'Hide hidden' : 'Show hidden'; };
      paintHidden();
      hiddenBtn.addEventListener('click', function () { filter.hidden = !filter.hidden; saveFilter(); paintHidden(); render(); });
    }
    var kinds = $('#aiKinds');
    if (kinds) kinds.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      filter.kind = c.dataset.kind; saveFilter(); render();
    });
    var list = $('#aiList');
    if (list) {
      list.addEventListener('click', function (e) {
        var cp = e.target.closest('.ai-copy');
        if (cp) { copyText(cp.dataset.copy, cp); return; }
        var m = e.target.closest('.ai-mark'); if (!m) return;
        var id = m.closest('.ai-item').dataset.id, st = S.aiState(id) || {}, patch = {};
        patch[m.dataset.act] = !st[m.dataset.act];
        S.setAi(id, patch);
      });
      list.addEventListener('error', function (e) { if (e.target.tagName === 'IMG') toTile(e.target); }, true);
      list.addEventListener('load', function (e) {
        var im = e.target;
        if (im.tagName === 'IMG' && im.dataset.shot && im.naturalWidth && im.naturalWidth < 900) toTile(im);
      }, true);
    }

    render();
    load().then(render, render);
    L.onStore(render);
  });
})();
