/* Reading notes: a Google Doc read live, with a floating outline of its dates.

   Each day in the doc starts with a heading that begins with its date, e.g.
   "24.10.2026 · Shared Wisdom — Alex Pentland"; the headings under it become that
   day's outline. The doc's link is kept in the encrypted settings (settings.readingDoc),
   never in this public code. The doc has to be shared "Anyone with the link" (Viewer is
   enough) so the page can read it without a Google sign-in. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;

  var STATE_KEY = 'launch.reading.v1';
  var SERIF = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400;1,8..60,600&display=swap';
  var REFRESH = 180000;   // re-read the doc every 3 minutes while the tab is open
  var WPM = 230;

  /* ---------- the doc ---------- */
  function docIdOf(s) {
    s = String(s || '').trim();
    var m = s.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]{20,})/) || s.match(/^([\w-]{30,})$/);
    return m ? m[1] : null;
  }
  function editUrl(id) { return 'https://docs.google.com/document/d/' + id + '/edit'; }
  // The lightweight mobile view keeps date chips and inline styles; the HTML export is the fallback.
  var SOURCES = [
    function (id) { return 'https://docs.google.com/document/d/' + id + '/mobilebasic'; },
    function (id) { return 'https://docs.google.com/document/d/' + id + '/export?format=html'; }
  ];
  function fetchText(url) {
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }
  var pending = null;
  function readDoc(id) {
    if (pending && pending.id === id) return pending.p;
    var p = fetchText(SOURCES[0](id)).then(function (html) {
      if (html.indexOf('doc-content') === -1) throw new Error('not a doc');
      return html;
    }).catch(function (first) {
      return fetchText(SOURCES[1](id)).then(function (html) {
        if (!/<body/i.test(html)) throw first;
        return html;
      });
    }).then(function (html) { return build(parse(html)); });
    pending = { id: id, p: p };
    var done = function () { if (pending && pending.p === p) pending = null; };
    p.then(done, done);
    return p;
  }

  /* ---------- Google's HTML → clean blocks ---------- */
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }

  // Styles given by class (the HTML export); the mobile view writes them inline instead.
  function classCss(d) {
    var map = {};
    each(d.querySelectorAll('style'), function (st) {
      var re = /([^{}]+)\{([^{}]*)\}/g, m;
      while ((m = re.exec(st.textContent))) {
        m[1].split(',').forEach(function (sel) {
          var c = sel.trim().match(/^\.([\w-]+)$/);
          if (c) map[c[1]] = (map[c[1]] || '') + ';' + m[2];
        });
      }
    });
    return map;
  }
  function styleOf(n, ctx) {
    var s = n.getAttribute('style') || '';
    each(n.classList, function (c) { if (ctx.css[c]) s = ctx.css[c] + ';' + s; });
    return s.toLowerCase();
  }
  function unwrapLink(href) {
    var m = String(href || '').match(/^https?:\/\/(?:www\.)?google\.[a-z.]+\/url\?(.*)$/i);
    if (m) { try { var q = new URLSearchParams(m[1]).get('q'); if (q) return q; } catch (e) { /* keep as is */ } }
    return href;
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, svg: 1, CANVAS: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1 };

  function inline(n, out, ctx, inLink) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
    if (n.nodeType !== 1 || SKIP[n.tagName]) return;
    var tag = n.tagName;
    if (tag === 'BR') { out.appendChild(document.createElement('br')); return; }
    if (tag === 'IMG') {
      var src = n.getAttribute('src') || '';
      if (/^https:\/\//i.test(src)) {
        var img = document.createElement('img');
        img.setAttribute('src', src);
        img.setAttribute('alt', n.getAttribute('alt') || '');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('referrerpolicy', 'no-referrer');
        out.appendChild(img);
      }
      return;
    }
    if (tag === 'A') {
      var href = unwrapLink(n.getAttribute('href') || '');
      var holder = document.createDocumentFragment();
      if (/^(https?:|mailto:)/i.test(href)) {
        holder = document.createElement('a');
        holder.setAttribute('href', href);
        holder.setAttribute('target', '_blank');
        holder.setAttribute('rel', 'noopener noreferrer');
      }
      each(n.childNodes, function (c) { inline(c, holder, ctx, true); });
      out.appendChild(holder);
      return;
    }
    var st = styleOf(n, ctx), wrap = [];
    if (tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(st)) wrap.push('strong');
    if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(st)) wrap.push('em');
    if (!inLink && (tag === 'U' || /text-decoration[^;]*underline/.test(st))) wrap.push('u');
    if (tag === 'S' || tag === 'DEL' || /text-decoration[^;]*line-through/.test(st)) wrap.push('s');
    if (tag === 'SUP' || /vertical-align:\s*super/.test(st)) wrap.push('sup');
    else if (tag === 'SUB' || /vertical-align:\s*sub/.test(st)) wrap.push('sub');
    var bg = st.match(/background-color:\s*([^;]+)/);
    if (bg && !/^(?:#fff(?:fff)?|white|transparent|inherit|initial|none)$|^rgba?\(\s*255\s*,\s*255\s*,\s*255\b|^rgba?\([^)]*,\s*0\s*\)$/.test(bg[1].trim())) wrap.push('mark');
    if (tag === 'CODE' || /font-family:[^;]*(courier|mono|consolas|source code)/.test(st)) wrap.push('code');
    var holder2 = out;
    wrap.forEach(function (w) { var e = document.createElement(w); holder2.appendChild(e); holder2 = e; });
    each(n.childNodes, function (c) { inline(c, holder2, ctx, inLink); });
  }
  function inlineOf(n, ctx) {
    var box = document.createElement('div');
    each(n.childNodes, function (c) { inline(c, box, ctx, false); });
    return box;
  }

  var HEAD = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
  function block(n, out, ctx) {
    var tag = n.tagName;
    if (!tag || SKIP[tag]) return;
    var isTitle = tag === 'P' && n.classList.contains('title');
    if (HEAD[tag] || isTitle) {
      var box = inlineOf(n, ctx), text = clean(box.textContent);
      if (!text) return;
      out.push({ h: HEAD[tag] || 0, text: text, inner: box.innerHTML, html: '<h2>' + box.innerHTML + '</h2>', plain: text });
      ctx.anon = {};
      return;
    }
    if (tag === 'P' || tag === 'BLOCKQUOTE' || tag === 'PRE') {
      var p = inlineOf(n, ctx);
      var plain = clean(p.textContent);
      if (!plain && !p.querySelector('img')) return;
      var cls = n.classList.contains('subtitle') ? ' class="subtitle"' : '';
      var t = tag === 'P' ? 'p' : tag.toLowerCase();
      out.push({ html: '<' + t + cls + '>' + p.innerHTML + '</' + t + '>', plain: plain });
      ctx.anon = {};
      return;
    }
    if (tag === 'UL' || tag === 'OL') { list(n, out, ctx); return; }
    if (tag === 'TABLE') { table(n, out, ctx); return; }
    if (tag === 'HR') {
      if (!/display:\s*none/.test(styleOf(n, ctx))) out.push({ html: '<hr>', plain: '' });
      return;
    }
    if (n.children && n.children.length) { each(n.children, function (c) { block(c, out, ctx); }); return; }
    var loose = clean(n.textContent);
    if (loose) out.push({ html: '<p>' + esc(loose) + '</p>', plain: loose });
  }

  // Google writes each nesting level as its own list (lst-kix_<id>-<level>), so numbering is
  // carried across them here the way Google's own counters do.
  function list(n, out, ctx) {
    var ordered = n.tagName === 'OL';
    var cls = n.getAttribute('class') || '';
    var m = cls.match(/lst-kix_([\w]+)-(\d+)/);
    var items = Array.prototype.filter.call(n.children, function (c) { return c.tagName === 'LI'; });
    var level;
    if (m) level = +m[2];
    else {
      var ml = (items[0] ? styleOf(items[0], ctx) : '').match(/margin-left:\s*([\d.]+)pt/);
      level = ml ? Math.max(0, Math.round(+ml[1] / 36) - 1) : 0;
    }
    level = Math.min(level, 5);
    var counters = m ? (ctx.lists[m[1]] = ctx.lists[m[1]] || {}) : ctx.anon;
    Object.keys(counters).forEach(function (k) { if (+k > level) delete counters[k]; });
    var startAttr = +n.getAttribute('start') || 0;
    if (/\bstart\b/.test(cls) || counters[level] == null) counters[level] = startAttr ? startAttr - 1 : 0;
    var first = counters[level] + 1;
    counters[level] += items.length;
    var html = '', plain = '';
    items.forEach(function (li) {
      var box = inlineOf(li, ctx);
      // list items can also hold block children (paragraphs)
      html += '<li>' + box.innerHTML + '</li>';
      plain += ' ' + clean(box.textContent);
    });
    if (!html) return;
    var t = ordered ? 'ol' : 'ul';
    out.push({ html: '<' + t + ' data-l="' + level + '"' + (ordered && first > 1 ? ' start="' + first + '"' : '') + '>' + html + '</' + t + '>', plain: clean(plain), list: true });
  }

  function table(n, out, ctx) {
    var rows = '', plain = '';
    each(n.rows, function (tr) {
      var cells = '';
      each(tr.cells, function (td) {
        var inner = [], sub = { css: ctx.css, lists: ctx.lists, anon: {} };
        each(td.children, function (c) { block(c, inner, sub); });
        if (!td.children.length) { var tx = clean(td.textContent); if (tx) inner.push({ html: '<p>' + esc(tx) + '</p>', plain: tx }); }
        var span = '';
        ['colspan', 'rowspan'].forEach(function (a) { var v = td.getAttribute(a); if (v && /^\d{1,2}$/.test(v) && v !== '1') span += ' ' + a + '="' + v + '"'; });
        var tg = td.tagName === 'TH' ? 'th' : 'td';
        cells += '<' + tg + span + '>' + inner.map(function (b) { return b.h != null ? '<p><strong>' + b.inner + '</strong></p>' : b.html; }).join('') + '</' + tg + '>';
        plain += ' ' + inner.map(function (b) { return b.plain; }).join(' ');
      });
      rows += '<tr>' + cells + '</tr>';
    });
    if (rows) out.push({ html: '<div class="rd-table"><table><tbody>' + rows + '</tbody></table></div>', plain: clean(plain) });
  }

  function parse(html) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var root = d.querySelector('.doc-content') || d.body;
    var ctx = { css: classCss(d), lists: {}, anon: {} };
    var blocks = [];
    each(root.children, function (n) { block(n, blocks, ctx); });
    var title = clean(d.title).replace(/\s+[-–]\s+Google\s+\S+$/i, '');
    return { title: title, blocks: blocks };
  }

  /* ---------- dates ---------- */
  var MON = { jan: 1, feb: 2, mar: 3, 'mär': 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
  function mon(w) { return MON[String(w || '').toLowerCase().replace('ae', 'ä').slice(0, 3)] || null; }
  function ymd(y, mo, da) {
    var d = new Date(y, mo - 1, da);
    return y > 1900 && y < 2200 && d.getMonth() === mo - 1 && d.getDate() === da ? d : null;
  }
  function parseDate(t) {
    var m, d = null;
    if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) d = ymd(+m[1], +m[2], +m[3]);
    else if ((m = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t))) {
      var a = +m[1], b = +m[2];
      d = b > 12 && a <= 12 ? ymd(+m[3], a, b) : ymd(+m[3], b, a);   // day.month.year unless that can't be
    } else if ((m = /(\d{1,2})(?:st|nd|rd|th|\.)?\s+([A-Za-zÄÖÜäöü]{3,10})\.?,?\s+(\d{4})/.exec(t)) && mon(m[2])) d = ymd(+m[3], mon(m[2]), +m[1]);
    else if ((m = /([A-Za-zÄÖÜäöü]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(t)) && mon(m[1])) d = ymd(+m[3], mon(m[1]), +m[2]);
    return d ? { date: d, index: m.index, length: m[0].length } : null;
  }
  var WDAY = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)';
  var WD_END = new RegExp('\\b' + WDAY + '\\.?,?\\s*$', 'i'), WD_START = new RegExp('^\\s*\\(?\\s*' + WDAY + '\\b\\.?\\s*\\)?', 'i');
  function titleParts(text, pd) {
    var t = pd ? text.slice(0, pd.index).replace(WD_END, '') + ' ' + text.slice(pd.index + pd.length).replace(WD_START, '') : text;
    t = t.replace(/^[\s·•|—–\-:,.;/]+|[\s·•|—–\-:,;/(]+$/g, '').trim();
    // "Title — Author", "Title, edited by A and B", "Title by Author" (the last " by ")
    var m = t.match(/^(.+?)\s+[—–|-]\s+(.+)$/) || t.match(/^(.+?),?\s+((?:edited|ed\.|eds\.)\s+(?:by\s+)?.+)$/i) || t.match(/^(.+)\s+by\s+(.+)$/i);
    return m ? { title: m[1].trim(), byline: m[2].trim() } : { title: t, byline: '' };
  }
  // A heading that repeats a known title: what follows the title is the author line.
  function afterTitle(text, title) {
    var i = text.toLowerCase().indexOf(title.toLowerCase());
    if (i !== 0) return titleParts(text, null);
    var rest = text.slice(title.length).replace(/^[\s,:;·•|—–\-]+/, '').replace(/^by\s+/i, '').trim();
    return { title: title, byline: rest };
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dm(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function sameDay(a, b) { return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function isToday(d) { return sameDay(d, new Date()); }
  function longDate(d) { return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function monthLabel(d) { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  function weekday(d) { return d.toLocaleDateString('en-GB', { weekday: 'short' }); }

  /* ---------- blocks → days ---------- */
  var QUEUE = /\b(queue|up next|next up|to[- ]read|reading list|wish ?list|backlog)\b/i;
  function words(s) { return (String(s || '').match(/\S+/g) || []).length; }
  function squash(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function slug(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40); }

  // A book's first paragraph opens with "Subtitle · Publisher, 2019." (or "…, 1994 (Galilée, 1981).").
  // The earliest year in that lead-in is the year of first publication.
  var LEAD = /^(.{0,240}?\b(?:1[5-9]\d\d|20\d\d)\b[^.]{0,60})\.(?:\s+|$)/;
  function leadIn(t) { var m = LEAD.exec(t || ''); return m ? m[1] : ''; }
  function yearOf(t) {
    var ys = (leadIn(t).match(/\b(?:1[5-9]\d\d|20\d\d)\b/g) || []).map(Number);
    return ys.length ? Math.min.apply(null, ys) : null;
  }
  // Before a book's first section: its cover (an image pasted at the top of the tab) and its lead-in line.
  function bookFront(e) {
    for (var i = 0; i < e.blocks.length; i++) {
      var b = e.blocks[i];
      if (b.sub) break;
      if (!e.cover && b.html.indexOf('<img') !== -1) {
        var m = b.html.match(/<img[^>]*\ssrc="([^"]+)"[^>]*>/);
        if (m) {
          e.cover = m[1].replace(/&amp;/g, '&');
          b.html = b.html.replace(m[0], '');
          if (!b.plain && b.html.indexOf('<img') === -1) { e.blocks.splice(i--, 1); continue; }
        }
      }
      if (!e.deck && b.plain && !b.list) e.deck = b.plain;
    }
    e.year = yearOf(e.deck);
  }

  // The level that starts a day: the heading level most dated headings use (Heading 1 wins ties).
  function entryLevel(heads) {
    var dated = heads.filter(function (h) { return h.pd; }), pool = dated.length ? dated : heads.filter(function (h) { return h.h > 0; });
    if (!pool.length) pool = heads;
    if (!pool.length) return null;
    var counts = {};
    pool.forEach(function (h) { counts[h.h] = (counts[h.h] || 0) + 1; });
    var pref = [1, 2, 0, 3, 4, 5, 6];
    return +Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || pref.indexOf(+a) - pref.indexOf(+b); })[0];
  }

  function build(doc) {
    var heads = doc.blocks.filter(function (b) { return b.h != null; });
    heads.forEach(function (b) { b.pd = parseDate(b.text); });
    var lvl = entryLevel(heads);
    var front = [], entries = [], cur = null, used = {}, order = 0;
    doc.blocks.forEach(function (b) {
      if (b.h != null && lvl != null && b.h <= lvl) {
        if (b.h < lvl) { cur = null; front.push(b); return; }
        var base = b.pd ? iso(b.pd.date) : 'n-' + (slug(b.text) || 'notes'), id = base, k = 2;
        while (used[id]) id = base + '-' + k++;
        used[id] = 1;
        var tp = titleParts(b.text, b.pd);
        cur = { id: id, date: b.pd ? b.pd.date : null, title: tp.title, byline: tp.byline, raw: b.text, blocks: [], subs: [], words: words(b.text), text: b.text, order: order++, queue: !b.pd && QUEUE.test(b.text), items: 0 };
        entries.push(cur);
        return;
      }
      if (!cur) { front.push(b); return; }
      if (b.h != null) cur.blocks.push({ sub: true, depth: b.h - lvl, inner: b.inner, plain: b.text });
      else {
        cur.blocks.push(b);
        if (b.list) cur.items += (b.html.match(/<li>/g) || []).length;
        else if (b.plain) cur.items += 1;
      }
      cur.words += words(b.plain);
      cur.text += ' ' + b.plain;
    });
    entries.forEach(function (e) {
      // A day named only by its date (a doc tab called "24.10.2026") takes its title from the first heading in it.
      // So does a tab named with a short title ("Shared Wisdom") whose first heading repeats it with the author.
      var f = e.blocks[0];
      if (f && f.sub && (!e.title || squash(f.plain).indexOf(squash(e.title)) === 0)) {
        var tp = e.title ? afterTitle(f.plain, e.title) : titleParts(f.plain, parseDate(f.plain));
        e.title = tp.title; e.byline = e.byline || tp.byline;
        var tm = f.inner.match(/href="https:\/\/docs\.google\.com\/document\/[^"]*[?&]tab=(t\.[\w-]+)/);
        if (tm) e.tabId = tm[1];
        e.blocks.shift();
      }
      if (e.byline && !e.date) bookFront(e);
      var subs = e.blocks.filter(function (b) { return b.sub; });
      var shift = subs.length ? Math.min.apply(null, subs.map(function (b) { return b.depth; })) - 1 : 0;
      subs.forEach(function (b, i) {
        var depth = Math.max(1, Math.min(3, b.depth - shift)), sid = e.id + '--' + (i + 1), t = 'h' + (depth + 1);
        b.html = '<' + t + ' id="' + sid + '" data-sub>' + b.inner + '</' + t + '>';
        e.subs.push({ id: sid, depth: depth, text: b.plain });
      });
      var firstText = '';
      e.blocks.some(function (b) { if (b.plain) { firstText = b.plain; return true; } return false; });
      e.label = e.title || (e.subs[0] && e.subs[0].text) || (firstText.length > 60 ? firstText.slice(0, 58) + '…' : firstText) || (e.date ? 'Reading notes' : 'Notes');
      e.sig = e.raw + '\u0001' + e.blocks.map(function (b) { return b.html; }).join('');
    });
    var dated = entries.filter(function (e) { return e.date && !e.queue; }).sort(function (a, b) { return b.date - a.date || a.order - b.order; });
    return {
      title: doc.title, entries: entries, dated: dated,
      queue: entries.filter(function (e) { return e.queue; }),
      other: entries.filter(function (e) { return !e.date && !e.queue; }),
      front: front,
      sig: entries.map(function (e) { return e.id + '\u0002' + e.sig; }).join('\u0003') + '\u0004' + front.map(function (b) { return b.html; }).join('')
    };
  }

  /* ---------- small bits ---------- */
  function state() { return L.lsGet(STATE_KEY) || {}; }
  function saveState(patch) { L.lsSet(STATE_KEY, Object.assign(state(), patch)); }
  function loadFont() {
    if (document.querySelector('link[data-rd-font]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = SERIF; l.setAttribute('data-rd-font', '');
    document.head.appendChild(l);
  }
  var ICON = {
    list: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2z"/><path d="M8 7h7"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
  };

  // Kept between tab switches, so coming back to Reading is instant.
  var cache = { id: null, model: null, at: 0, failed: false };

  /* ---------- book covers ----------
     A cover pasted at the top of a book's tab wins. Otherwise the cover is looked up once by title and
     author (Open Library first, for its larger scans, then Google Books) and remembered on this device. */
  var COVER_KEY = 'launch.reading.covers.v1', COVER_RETRY = 7 * 864e5;
  var coverMem = null, coverWait = {};
  function covers() { if (!coverMem) coverMem = L.lsGet(COVER_KEY) || {}; return coverMem; }
  function firstAuthor(by) {
    return (String(by || '').replace(/^(?:edited|ed\.|eds\.)\s+(?:by\s+)?/i, '').split(/\s*(?:,|&|\band\b)\s*/)[0] || '').trim();
  }
  function lastName(n) { var p = String(n || '').split(/\s+/); return p[p.length - 1] || ''; }
  function coverKey(e) { return squash(e.title || e.label) + '|' + squash(lastName(firstAuthor(e.byline))); }
  // "Psych: The Story of the Human Mind" is the book "Psych"; "The Science of Science Policy" is not "The Science of Science"
  function mainTitle(t) { return squash(String(t || '').split(/\s*[:(—–]\s*|\s-\s/)[0]); }
  function sameTitle(found, ours) { var a = mainTitle(found), b = mainTitle(ours); return !!a && a === b; }
  function getJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function fromOpenLibrary(title, author) {
    return getJSON('https://openlibrary.org/search.json?limit=8&fields=title,cover_i,first_publish_year&title=' + encodeURIComponent(title) +
      (author ? '&author=' + encodeURIComponent(author) : '')).then(function (j) {
      var d = (j.docs || []).filter(function (x) { return x.cover_i && sameTitle(x.title, title); })[0];
      return d ? { src: 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-L.jpg', year: d.first_publish_year || null } : null;
    });
  }
  function fromGoogleBooks(title, author) {
    var q = 'intitle:' + title + (author ? ' inauthor:' + author : '');
    return getJSON('https://www.googleapis.com/books/v1/volumes?maxResults=6&printType=books&fields=items(id,volumeInfo(title,publishedDate,imageLinks))&q=' + encodeURIComponent(q)).then(function (j) {
      var it = (j.items || []).filter(function (x) { var v = x.volumeInfo || {}; return v.imageLinks && sameTitle(v.title, title); })[0];
      if (!it) return null;
      var v = it.volumeInfo, year = parseInt(v.publishedDate, 10) || null;
      var https = function (u) { return String(u || '').replace(/^http:/, 'https:').replace(/&edge=curl/, ''); };
      var small = { src: https(v.imageLinks.thumbnail || v.imageLinks.smallThumbnail), year: year };
      // the search only gives a thumbnail; the volume itself often has a larger publisher image
      return getJSON('https://www.googleapis.com/books/v1/volumes/' + encodeURIComponent(it.id) + '?fields=volumeInfo/imageLinks').then(function (d) {
        var l = (d.volumeInfo || {}).imageLinks || {}, big = l.medium || l.small || l.large;
        return big ? { src: https(big), year: year } : small;
      }, function () { return small; });
    });
  }
  function coverFor(e) {
    if (e.cover) return Promise.resolve({ src: e.cover });
    var key = coverKey(e), hit = covers()[key];
    if (hit && (hit.src || Date.now() - hit.at < COVER_RETRY)) return Promise.resolve(hit.src ? hit : null);
    if (coverWait[key]) return coverWait[key];
    var title = e.title || e.label, author = lastName(firstAuthor(e.byline)), failed = 0;
    var soft = function (p) { return p.catch(function () { failed++; return null; }); };
    var p = soft(fromOpenLibrary(title, author)).then(function (c) {
      return c || soft(fromGoogleBooks(title, author));
    }).then(function (c) {
      delete coverWait[key];
      if (!c && failed) return null;              // offline or blocked: try again next time
      var m = covers();
      m[key] = c ? { src: c.src, year: c.year || null, at: Date.now() } : { at: Date.now() };
      L.lsSet(COVER_KEY, m);
      return c;
    });
    coverWait[key] = p;
    return p;
  }
  function coverBox(e, cls) {
    return '<span class="rd-cover' + (cls ? ' ' + cls : '') + '" data-cover="' + esc(e.id) + '" style="--h:' + hue(e.title || e.label) + '" aria-hidden="true">' +
      '<span class="rd-cover-f"><b>' + esc(e.title || e.label) + '</b><small>' + esc(firstAuthor(e.byline)) + '</small></span></span>';
  }
  function hue(t) { var h = 0; t = String(t || ''); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }

  /* ---------- the tab ---------- */
  L.boot('reading', function () {
    var page = $('#rdPage'), side = $('#rdSide'), list = $('#rdList'), q = $('#rdQ'), foot = $('#rdFoot');
    var paper = $('#rdPaper'), docWrap = $('#rdDoc'), status = $('#rdStatus'), openLink = $('#rdOpen');
    var countEl = $('#rdCount'), toggle = $('#rdToggle'), refreshBtn = $('#rdRefresh');
    var segs = Array.prototype.slice.call(document.querySelectorAll('#rdMode button'));
    if (!page) return;
    loadFont();
    refreshBtn.innerHTML = ICON.refresh;
    toggle.innerHTML = '<span id="rdToggleText">All dates</span>' + ICON.chev;

    var mode = state().mode === 'doc' ? 'doc' : 'notes';
    var docLink = null, docId = null, current = null, loading = false;

    function linkFromSettings() { return ((S.doc && S.doc.settings) || {}).readingDoc || ''; }
    function byId(id) { var m = cache.model; if (!m) return null; for (var i = 0; i < m.entries.length; i++) if (m.entries[i].id === id) return m.entries[i]; return null; }
    var LIB = 'library';   // the shelf of all undated entries (one per book)
    function known(id) { return id === LIB ? !!(cache.model && cache.model.other.length) : !!byId(id); }

    function setStatus(text, bad) { status.textContent = text || ''; status.classList.toggle('bad', !!bad); }
    function stamp(t) { return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

    /* which day to show */
    function pickDefault() {
      var m = cache.model, h = decodeURIComponent((location.hash || '').slice(1));
      if (h && known(h)) return h;
      if (m.other.length) return LIB;   // the Library overview is the front page
      for (var i = 0; i < m.dated.length; i++) if (isToday(m.dated[i].date)) return m.dated[i].id;
      if (m.dated[0]) return m.dated[0].id;
      return m.entries[0] ? m.entries[0].id : null;
    }

    /* "new" dots: days added since you last looked */
    function seenMap() { return state().seen || null; }
    function markSeen(id) {
      var seen = seenMap() || {};
      if (seen[id]) return;
      seen[id] = 1; saveState({ seen: seen });
    }
    function initSeen() {
      if (seenMap()) return;
      var seen = {};
      cache.model.entries.forEach(function (e) { seen[e.id] = 1; });
      saveState({ seen: seen });
    }
    function isNew(e) { var s = seenMap(); return !!(s && !s[e.id] && e.date && !e.queue); }

    /* ---------- outline ---------- */
    function row(e) {
      var on = e.id === current, d = e.date;
      var badge = d
        ? '<span class="rd-d"><b>' + d.getDate() + '</b><small>' + (isToday(d) ? 'Today' : esc(weekday(d))) + '</small></span>'
        : e.queue ? '<span class="rd-d"><b>' + e.items + '</b><small>' + (e.items === 1 ? 'book' : 'books') + '</small></span>'
          : '<span class="rd-d rd-ic">' + (e.byline ? ICON.book : ICON.note) + '</span>';
      var h = '<a class="rd-day' + (on ? ' on' : '') + (isToday(d) ? ' today' : '') + '" href="#' + esc(e.id) + '" data-id="' + esc(e.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
        badge + '<span class="rd-t"><span>' + esc(e.label) + '</span>' + (e.byline ? '<small>' + esc(e.byline) + '</small>' : '') + '</span>' +
        (isNew(e) && !on ? '<i class="rd-new" title="New"></i>' : '') + '</a>';
      if (on && e.subs.length) {
        h += '<ol class="rd-subs">' + e.subs.map(function (s) {
          return '<li class="d' + s.depth + '"><a href="#' + esc(s.id) + '" data-sub="' + esc(s.id) + '">' + esc(s.text) + '</a></li>';
        }).join('') + '</ol>';
      }
      return h;
    }
    function renderOutline() {
      var m = cache.model;
      if (!m) { list.innerHTML = '<p class="rd-none">' + (docId ? 'Opening the doc…' : 'Your reading days will be listed here.') + '</p>'; countEl.textContent = ''; return; }
      var term = clean(q.value).toLowerCase();
      var hit = function (e) { return !term || (e.label + ' ' + e.byline + ' ' + e.text).toLowerCase().indexOf(term) !== -1; };
      var h = '', queue = m.queue.filter(hit), dated = m.dated.filter(hit), other = m.other.filter(hit), month = '';
      dated.forEach(function (e) {
        var mk = monthLabel(e.date);
        if (mk !== month) { month = mk; h += '<p class="rd-group">' + esc(mk) + '</p>'; }
        h += row(e);
      });
      if (queue.length) h += '<p class="rd-group">Up next</p>' + queue.map(row).join('');
      if (other.length) h += '<a class="rd-group rd-libhead' + (current === LIB ? ' on' : '') + '" href="#' + LIB + '" data-id="' + LIB + '"' + (current === LIB ? ' aria-current="true"' : '') + '>Library<b>' + m.other.length + '</b></a>' + other.map(row).join('');
      if (!h) h = '<p class="rd-none">' + (term ? 'Nothing matches “' + esc(term) + '”.' : 'No days yet. Each day starts with a heading that begins with its date.') + '</p>';
      list.innerHTML = h;
      countEl.textContent = m.dated.length ? m.dated.length + (m.dated.length === 1 ? ' day' : ' days') : '';
      var e = byId(current), tt = $('#rdToggleText');
      if (tt) tt.textContent = current === LIB ? 'Library · ' + m.other.length + ' books' : e ? (e.date ? dm(e.date) + ' · ' : '') + e.label : 'All dates';
      spy();
    }

    /* ---------- the page of one day ---------- */
    function neighbours(e) {
      var d = cache.model.dated, i = d.indexOf(e);
      if (i !== -1) return { newer: d[i - 1] || null, older: d[i + 1] || null };
      var o = cache.model.other, j = o.indexOf(e);   // books: previous / next on the shelf
      return j === -1 ? {} : { older: o[j - 1] || null, newer: o[j + 1] || null, shelf: true };
    }
    function pagerLink(e, cls, label) {
      if (!e) return '';
      return '<a class="' + cls + '" href="#' + esc(e.id) + '" data-id="' + esc(e.id) + '"><small>' + label + '</small><span>' + (e.date ? dm(e.date) + ' · ' : '') + esc(e.label) + '</span></a>';
    }
    function gist(e) {
      var t = e.deck;
      if (!t) e.blocks.some(function (b) { if (!b.sub && !b.list && b.plain) { t = b.plain; return true; } return false; });
      if (!t) return '';
      var lead = leadIn(t);
      if (lead) t = t.slice(lead.length).replace(/^\.\s*/, '');   // drop the "subtitle · publisher, year." lead-in
      return t.length > 150 ? t.slice(0, 148).replace(/\s+\S*$/, '') + '…' : t;
    }
    function yearFor(e) { if (e.year) return e.year; var c = covers()[coverKey(e)]; return c && c.year || null; }
    function fillCovers(root) {
      Array.prototype.forEach.call(root.querySelectorAll('[data-cover]'), function (box) {
        var e = byId(box.getAttribute('data-cover'));
        if (!e) return;
        coverFor(e).then(function (c) {
          if (!c || !c.src || !box.isConnected || box.querySelector('img')) return;
          var img = new Image();
          img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
          img.onload = function () {
            if (img.naturalWidth < 40 || !box.isConnected) return;   // Open Library answers a missing scan with a 1×1 image
            box.appendChild(img); box.classList.add('has-img');
          };
          img.src = c.src;
        });
      });
    }
    function renderShelf() {
      var books = cache.model.other, total = 0;
      books.forEach(function (b) { total += Math.max(1, Math.round(b.words / WPM)); });
      paper.innerHTML =
        '<article class="rd-entry rd-shelf">' +
        '<header class="rd-head"><p class="rd-kicker">Library</p><h1>Your books</h1>' +
        '<p class="rd-meta"><span>' + books.length + (books.length === 1 ? ' summary' : ' summaries') + '</span><span>about ' + total + ' min of reading</span></p></header>' +
        '<div class="rd-lib">' + books.map(function (b) {
          var mins = Math.max(1, Math.round(b.words / WPM)), y = yearFor(b), t = b.title || b.label;
          return '<a class="rd-book" href="#' + esc(b.id) + '" data-id="' + esc(b.id) + '" title="' + esc(t + (b.byline ? ', ' + b.byline : '') + (y ? ' (' + y + ')' : '')) + '">' +
            coverBox(b) +
            '<span class="rd-book-t">' + esc(t) + '</span>' +
            (b.byline ? '<span class="rd-book-a">' + esc(b.byline) + '</span>' : '') +
            '<span class="rd-book-m">' + (y ? '<b data-year>' + y + '</b>' : '') + '<span>' + mins + ' min read</span>' + (isNew(b) ? '<i class="rd-new" title="New"></i>' : '') + '</span>' +
            '<span class="rd-book-g">' + esc(gist(b)) + '</span></a>';
        }).join('') + '</div></article>';
      fillCovers(paper);
    }
    function renderEntry() {
      var m = cache.model;
      if (!m) return;
      if (current === LIB && m.other.length) { renderShelf(); return; }
      var e = byId(current);
      if (!e) {
        paper.innerHTML = '<article class="rd-entry"><header class="rd-head"><p class="rd-kicker">Reading notes</p><h1>' + esc(m.title || 'Your reading doc') + '</h1></header>' +
          '<div class="rd-prose">' + (m.front.length ? m.front.map(function (b) { return b.html; }).join('') : '') +
          '<p class="rd-emptynote">No dated notes yet. Each day starts with a heading that begins with its date, like <em>24.10.2026 · Book — Author</em>; the headings under it become that day’s outline.</p></div></article>';
        return;
      }
      var nav = neighbours(e), mins = Math.max(1, Math.round(e.words / WPM));
      var book = !!(e.byline && !e.date && !e.queue), y = book ? yearFor(e) : null;
      var kicker = e.date ? esc(longDate(e.date)) + (isToday(e.date) ? '<span class="rd-today">Today</span>' : '') : e.queue ? 'Up next' : e.byline ? '<a href="#' + LIB + '" data-id="' + LIB + '">Library</a>' : 'Notes';
      var title = '<h1>' + esc(e.title || (e.subs[0] && e.subs[0].text) || (e.date ? 'Reading notes' : e.label)) + '</h1>' +
        '<p class="rd-meta">' + (e.byline ? '<span>' + esc(e.byline) + '</span>' : '') + (y ? '<span>' + y + '</span>' : '') + (e.words > 60 ? '<span>' + mins + ' min read</span>' : '') + (e.subs.length ? '<span>' + e.subs.length + (e.subs.length === 1 ? ' section' : ' sections') + '</span>' : '') + '</p>';
      paper.innerHTML =
        '<article class="rd-entry">' +
        '<header class="rd-head"><div class="rd-headrow"><p class="rd-kicker">' + kicker + '</p>' +
        '<button type="button" class="btn small rd-edit" data-edit title="Edit this in the Google Doc">' + ICON.edit + 'Edit</button></div>' +
        (book ? '<div class="rd-titlerow">' + coverBox(e, 'sm') + '<div class="rd-titletext">' + title + '</div></div>' : title) + '</header>' +
        '<div class="rd-prose">' + (e.blocks.length ? e.blocks.map(function (b) { return b.html; }).join('') : '<p class="rd-emptynote">Nothing under this date yet.</p>') + '</div>' +
        (nav.older || nav.newer ? '<nav class="rd-pager" aria-label="' + (nav.shelf ? 'Other books' : 'Other days') + '">' + pagerLink(nav.older, 'rd-older', nav.shelf ? '← Previous' : '← Older') + pagerLink(nav.newer, 'rd-newer', nav.shelf ? 'Next →' : 'Newer →') + '</nav>' : '') +
        '</article>';
      if (book) fillCovers(paper);
    }

    function select(id, opts) {
      opts = opts || {};
      if (!known(id)) return;
      current = id;
      if (id !== LIB) markSeen(id);
      try { history.replaceState(history.state, '', location.pathname + location.search + '#' + encodeURIComponent(id)); } catch (e) { /* ignore */ }
      renderEntry();
      renderOutline();
      if (docId) openLink.href = dayUrl(byId(id));
      if (opts.scroll !== false) {
        var top = paper.getBoundingClientRect().top + window.scrollY - 16;
        if (window.scrollY > top || opts.force) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      if (window.matchMedia('(max-width: 900px)').matches && opts.fromList) setOpen(false);
      var a = list.querySelector('.rd-day.on');
      if (a && a.scrollIntoView && !opts.fromList) a.scrollIntoView({ block: 'nearest' });
    }

    function render(first) {
      if (!cache.model) return;
      if (first) initSeen();
      if (!current || !known(current)) current = pickDefault();
      if (current && current !== LIB) markSeen(current);
      renderEntry();
      renderOutline();
      if (docId) openLink.href = dayUrl(byId(current));
      foot.innerHTML = '<span title="' + esc(cache.model.title) + '">' + esc(cache.model.title || 'Google Doc') + '</span><button type="button" data-change>Change doc</button>';
    }

    /* ---------- reading the doc ---------- */
    function refresh(manual) {
      if (!docId || loading) return;
      loading = true;
      refreshBtn.classList.add('spin');
      if (!cache.model || cache.id !== docId) setStatus('Opening the doc…');
      var id = docId;
      readDoc(id).then(function (model) {
        if (id !== docId) return;
        var first = cache.id !== id || !cache.model, changed = first || model.sig !== cache.model.sig;
        cache = { id: id, model: model, at: Date.now(), failed: false };
        if (changed) render(first);
        setStatus('Updated ' + stamp(cache.at));
      }).catch(function () {
        if (id !== docId) return;
        cache.failed = true;
        if (cache.id === id && cache.model) { setStatus('Couldn’t reach the doc · showing the copy from ' + stamp(cache.at), true); return; }
        setStatus('Couldn’t open the doc', true);
        renderError();
      }).then(function () {
        loading = false;
        refreshBtn.classList.remove('spin');
        if (manual) refreshBtn.blur();
      });
    }

    function renderLoading() {
      paper.innerHTML = '<div class="rd-entry rd-skel" aria-hidden="true"><i style="width:28%"></i><b style="width:64%"></b><i style="width:40%"></i><hr>' +
        '<i></i><i></i><i style="width:82%"></i><i></i><i style="width:58%"></i></div>';
      renderOutline();
    }
    function renderError() {
      var offline = navigator.onLine === false;
      paper.innerHTML = '<div class="rd-entry rd-msg"><p class="rd-kicker">Reading notes</p><h1>' + (offline ? 'You’re offline' : 'Couldn’t open the doc') + '</h1>' +
        (offline ? '<p>The notes will load again once you’re back online.</p>'
          : '<p>Check that the doc’s sharing is set to <strong>Anyone with the link</strong> (Share → General access; Viewer is enough). The page reads the doc without signing in to Google, so a private doc can’t be read here.</p>') +
        '<div class="rd-actions"><button type="button" class="btn primary" data-retry>Try again</button><button type="button" class="btn" data-mode="doc">Open it as a Google Doc</button><button type="button" class="btn ghost" data-change>Change doc</button></div></div>';
      list.innerHTML = '<p class="rd-none">The days will be listed here once the doc opens.</p>';
      countEl.textContent = '';
      foot.innerHTML = '<span>The doc couldn’t be read</span><button type="button" data-change>Change doc</button>';
    }
    function renderSetup(msg) {
      setStatus('');
      page.classList.add('setup');
      paper.innerHTML =
        '<div class="rd-entry rd-msg"><p class="rd-kicker">Reading notes</p><h1>Link your reading doc</h1>' +
        '<p>Paste the link of the Google Doc that holds your reading notes. Each day starts with a heading that begins with its date, like <em>24.10.2026 · Book — Author</em>, and the dates become the outline on the left.</p>' +
        '<form class="rd-form" data-link><label class="sr" for="rdLinkIn">Google Doc link</label><input id="rdLinkIn" name="u" type="url" inputmode="url" autocomplete="off" placeholder="https://docs.google.com/document/d/…" required><button class="btn primary">Use this doc</button></form>' +
        (msg ? '<p class="rd-err" role="alert">' + esc(msg) + '</p>' : '') +
        '<p class="rd-fine">The link is kept in your encrypted launch-pad data, not in the site’s public code. In Google Docs, set Share → General access to “Anyone with the link” (Viewer is enough) so this page can read it.</p></div>';
      list.innerHTML = '<p class="rd-none">Your reading days will be listed here.</p>';
      countEl.textContent = '';
      foot.innerHTML = '';
    }

    function saveLink(value, after) {
      var id = docIdOf(value);
      if (!id) return 'That doesn’t look like a Google Doc link. Copy it from the address bar of the doc (it contains /document/d/…).';
      S.setSettings({ readingDoc: editUrl(id) });
      if (after) after();
      return '';
    }
    function changeDoc() {
      var dlg = L.el('dialog', { class: 'modal', 'aria-label': 'Reading doc' });
      dlg.innerHTML =
        '<form method="dialog" class="modal-body">' +
        '  <h2>Reading doc</h2>' +
        '  <label>Google Doc link <small>The doc whose dated headings fill the Reading tab. Set its sharing to “Anyone with the link”.</small><input name="u" type="url" placeholder="https://docs.google.com/document/d/…"></label>' +
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

    /* ---------- notes / Google Doc ---------- */
    // The doc, opened at this day's own tab when the day's heading links to it.
    function dayUrl(e) { return editUrl(docId) + (e && e.tabId ? '?tab=' + encodeURIComponent(e.tabId) : ''); }
    function setMode(m, url) {
      if (m === 'doc' && !docId) m = 'notes';
      var was = mode;
      mode = m;
      saveState({ mode: m });
      page.classList.toggle('doc', m === 'doc');
      segs.forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      if (m === 'doc') {
        var want = url || docWrap.dataset.src || dayUrl(byId(current));
        if (docWrap.dataset.id !== docId || docWrap.dataset.src !== want) {
          docWrap.innerHTML = '<iframe title="Reading notes in Google Docs" src="' + esc(want) + '" allow="clipboard-read; clipboard-write"></iframe>';
          docWrap.dataset.id = docId; docWrap.dataset.src = want;
        }
        docWrap.hidden = false; paper.hidden = true;
        window.scrollTo(0, 0);
      } else {
        docWrap.hidden = true; paper.hidden = false;
        if (was === 'doc' && docId) refresh();   // show what was just edited
      }
    }
    // Edit = the real Google Doc: inside the launch pad on a computer, in the Docs app on a phone.
    function editDay(e) {
      var url = dayUrl(e);
      if (window.matchMedia('(max-width: 900px)').matches) { window.open(url, '_blank', 'noopener'); return; }
      setMode('doc', url);
    }

    /* ---------- the outline follows your reading ---------- */
    var spyQueued = false, spyHold = 0;
    function markSub(id) { each(list.querySelectorAll('.rd-subs a'), function (a) { a.classList.toggle('on', a.dataset.sub === id); }); }
    function spy() {
      spyQueued = false;
      if (mode !== 'notes' || Date.now() < spyHold) return;
      // at the very end of a day, the last heading on screen counts as the one you're reading
      var atEnd = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      var line = atEnd ? window.innerHeight - 120 : 140;
      var hs = paper.querySelectorAll('[data-sub]'), active = null;
      for (var i = 0; i < hs.length; i++) { if (hs[i].getBoundingClientRect().top < line) active = hs[i].id; else break; }
      markSub(active);
    }
    L.listen(window, 'scroll', function () { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });

    function setOpen(open) {
      side.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    /* ---------- events ---------- */
    list.addEventListener('click', function (e) {
      var sub = e.target.closest('[data-sub]');
      if (sub) {
        e.preventDefault();
        var h = document.getElementById(sub.dataset.sub);
        if (h) { spyHold = Date.now() + 1200; markSub(sub.dataset.sub); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        if (window.matchMedia('(max-width: 900px)').matches) setOpen(false);
        return;
      }
      var a = e.target.closest('[data-id]');
      if (!a) return;
      e.preventDefault();
      if (a.dataset.id === current) { select(current, { fromList: true, force: true }); return; }
      select(a.dataset.id, { fromList: true, force: true });
    });
    paper.addEventListener('click', function (e) {
      var a = e.target.closest('.rd-pager [data-id], .rd-lib [data-id], .rd-kicker [data-id]');
      if (a) { e.preventDefault(); select(a.dataset.id, { force: true }); return; }
      if (e.target.closest('[data-retry]')) { refresh(true); return; }
      if (e.target.closest('[data-change]')) { changeDoc(); return; }
      if (e.target.closest('[data-edit]')) { editDay(byId(current)); return; }
      var link = e.target.closest('.rd-prose a[href]');
      if (link && docId && cache.model) {
        var tm = link.getAttribute('href').match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]+)\/[^?#]*\?(?:[^#]*&)?tab=(t\.[\w-]+)/);
        var hit = tm && tm[1] === docId && cache.model.entries.filter(function (x) { return x.tabId === tm[2]; })[0];
        if (hit) { e.preventDefault(); select(hit.id, { force: true }); return; }
      }
      var mb = e.target.closest('[data-mode]');
      if (mb) setMode(mb.dataset.mode);
    });
    paper.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-link]');
      if (!f) return;
      e.preventDefault();
      var err = saveLink(f.u.value);
      if (err) renderSetup(err);
    });
    foot.addEventListener('click', function (e) { if (e.target.closest('[data-change]')) changeDoc(); });
    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mode === 'doc') { if (mode !== 'doc') setMode('doc', dayUrl(byId(current))); }
        else setMode('notes');
      });
    });
    refreshBtn.addEventListener('click', function () { refresh(true); });
    toggle.addEventListener('click', function () { setOpen(!side.classList.contains('open')); });
    q.addEventListener('input', renderOutline);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { q.value = ''; renderOutline(); }
      if (e.key === 'Enter') { var a = list.querySelector('.rd-day'); if (a) select(a.dataset.id, { fromList: true, force: true }); }
    });
    // ← older day, → newer day
    L.listen(document, 'keydown', function (e) {
      if (mode !== 'notes' || !cache.model || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
      var cur = byId(current); if (!cur) return;
      var nb = neighbours(cur), go = e.key === 'ArrowLeft' ? nb.older : e.key === 'ArrowRight' ? nb.newer : null;
      if (go) { e.preventDefault(); select(go.id, { force: true }); }
    });
    L.listen(document, 'visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() - cache.at > 60000) refresh();
    });
    L.every(function () { if (document.visibilityState === 'visible' && mode === 'notes') refresh(); }, REFRESH);

    /* ---------- start, and follow changes to the doc link ---------- */
    function apply() {
      docLink = linkFromSettings();
      var id = docIdOf(docLink);
      page.classList.remove('setup');
      if (!id) {
        docId = null;
        openLink.hidden = true;
        segs.forEach(function (b) { b.disabled = b.dataset.mode === 'doc'; });
        setMode('notes');
        renderSetup(docLink ? 'The saved link doesn’t look like a Google Doc. Paste the doc’s own link.' : '');
        return;
      }
      var changed = id !== docId;
      docId = id;
      openLink.hidden = false;
      openLink.href = editUrl(id);
      segs.forEach(function (b) { b.disabled = false; });
      if (changed && cache.id !== id) { current = null; cache = { id: null, model: null, at: 0, failed: false }; }
      setMode(mode);
      if (cache.model && cache.id === id) {
        render(false);
        setStatus('Updated ' + stamp(cache.at));
        if (Date.now() - cache.at > 60000) refresh();
      } else {
        renderLoading();
        refresh();
      }
    }
    L.onStore(function () { if (linkFromSettings() !== docLink) apply(); });
    apply();
  });
})();
