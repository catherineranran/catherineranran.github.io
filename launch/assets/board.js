/* Task board: columns, cards, importance colours, deadlines, next steps, notes, finished cards. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var DOTS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  var CAL = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>';

  // Research strands from ranranli.net (same colours as the Research section there).
  var STRANDS = [
    { v: 1, name: 'Person–Situation Processes', short: '01 Person–Situation', hex: '#68d391' },
    { v: 2, name: 'Prosocial and Moral Behavior', short: '02 Prosocial & Moral', hex: '#93c5fd' },
    { v: 3, name: 'Method Lab: Virtual Reality and beyond', short: '03 Method Lab', hex: '#c4b5fd' }
  ];
  function strandOf(c) { return STRANDS[(c.strand || 0) - 1] || null; }

  var ui = {
    q: '', prio: null, showDone: false,
    openNotes: {}, openDone: {}, adding: null, draft: '',
    dragId: null
  };

  L.boot('tasks', function () {
    var board = $('#board');

    /* ---------- legend / filters ---------- */
    function paintLegend() {
      var chips = [{ v: null, name: 'All' }].concat(L.PRIO.slice(1).reverse());
      $('#legend').innerHTML = chips.map(function (p) {
        return '<button type="button" class="chip' + (ui.prio === p.v && ui.strand == null ? ' on' : '') + '" data-p="' + (p.v == null ? '' : p.v) + '"' +
          (p.v ? ' data-prio="' + p.v + '"' : '') + '>' + (p.v ? '<i></i>' : '') + p.name + '</button>';
      }).join('') + '<span class="legend-sep"></span>' + STRANDS.map(function (st) {
        return '<button type="button" class="chip strand-chip' + (ui.strand === st.v ? ' on' : '') + '" data-s="' + st.v + '" style="--s:' + st.hex + '" title="' + esc(st.name) + '"><i></i>' + esc(st.short) + '</button>';
      }).join('');
    }
    $('#legend').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.s) { var sv = +b.dataset.s; ui.strand = ui.strand === sv ? null : sv; paintLegend(); render(); return; }
      var v = b.dataset.p === '' ? null : +b.dataset.p;
      ui.prio = ui.prio === v ? null : v;
      if (v == null) ui.strand = null;
      paintLegend(); render();
    });
    $('#q').addEventListener('input', function () { ui.q = this.value.trim().toLowerCase(); render(); });
    $('#toggleDone').addEventListener('click', function () {
      ui.showDone = !ui.showDone;
      ui.openDone = {};
      this.textContent = ui.showDone ? 'Hide finished' : 'Show finished';
      render();
    });

    function matches(c) {
      if (ui.prio != null && (c.prio || 0) !== ui.prio) return false;
      if (ui.strand != null && (c.strand || 0) !== ui.strand) return false;
      if (!ui.q) return true;
      return [c.title, c.next, c.note, c.link].join(' ').toLowerCase().indexOf(ui.q) !== -1;
    }

    /* ---------- rendering ---------- */
    function titleHtml(c) {
      var href = L.safeUrl(c.link);
      if (href) return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(c.title || 'Untitled') + '</a><span class="ext">' + L.ICONS.ext + '</span>';
      return L.linkify(c.title || 'Untitled');
    }
    function cardHtml(c) {
      var p = c.prio || 0, open = !!ui.openNotes[c.id];
      var st = strandOf(c);
      var h = '<article class="card' + (c.done ? ' done' : '') + (st ? ' has-strand' : '') + '" id="' + esc(c.id) + '" data-id="' + esc(c.id) + '" data-prio="' + p + '"' + (st ? ' style="--s:' + st.hex + '"' : '') + ' draggable="' + (c.done ? 'false' : 'true') + '" tabindex="0">';
      if (st) h += '<span class="strand-dot" title="' + esc(st.name) + '" aria-label="' + esc(st.name) + '"></span>';
      h += '<div class="card-top"><button type="button" class="tick" aria-label="' + (c.done ? 'Mark as not finished' : 'Mark as finished') + '" title="' + (c.done ? 'Reopen' : 'Finished') + '">' + CHECK + '</button>';
      h += '<div class="card-title">' + titleHtml(c) + '</div></div>';
      if (c.due) {
        h += '<div class="meta">';
        if (c.due) h += '<span class="due ' + L.dueClass(c.due, c.done) + '" title="' + esc(L.relDue(c.due)) + '">' + CAL + esc(L.fmtDue(c.due)) + ' · ' + esc(L.relDue(c.due)) + '</span>';
        h += '</div>';
      }
      if (c.next) h += '<div class="next"><b>Next</b>' + L.linkify(c.next) + '</div>';
      if (c.note) {
        h += '<button type="button" class="note-toggle" aria-expanded="' + open + '"><span class="chev">›</span>' + (open ? 'Hide note' : 'Note') + '</button>';
        if (open) h += '<div class="note">' + L.linkify(c.note) + '</div>';
      }
      return h + '</article>';
    }
    function colHtml(col, i, n) {
      var all = S.cardsIn(col.id), open = all.filter(function (c) { return !c.done; });
      var done = all.filter(function (c) { return c.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
      var shownOpen = open.filter(matches), shownDone = done.filter(matches);
      var h = '<section class="col" data-col="' + esc(col.id) + '" aria-label="' + esc(col.name) + '">';
      h += '<div class="col-head"><h2>' + esc(col.name) + '</h2><span class="count" title="Open tasks">' + open.length + '</span>' +
        '<button type="button" class="icon-btn col-menu" aria-label="Column options">' + DOTS + '</button></div>';
      h += '<div class="col-body">' + shownOpen.map(cardHtml).join('');
      if (!shownOpen.length && !shownDone.length) h += '<p class="empty" style="padding:4px 4px 0">' + (ui.q || ui.prio != null ? 'No matches.' : 'Nothing here yet.') + '</p>';
      if (shownDone.length) {
        var isOpen = ui.showDone || ui.openDone[col.id];
        h += '<details class="done-zone" data-col="' + esc(col.id) + '"' + (isOpen ? ' open' : '') + '><summary><span class="chev">›</span>Finished · ' + shownDone.length + '</summary>' +
          '<div class="done-list">' + shownDone.map(cardHtml).join('') + '</div></details>';
      }
      h += '</div>';
      if (ui.adding === col.id) {
        h += '<form class="add-form"><textarea placeholder="What needs doing?" aria-label="New card">' + esc(ui.draft) + '</textarea>' +
          '<div class="row"><button class="btn small primary">Add card</button><button type="button" class="btn small ghost add-cancel">Cancel</button></div>' +
          '<span class="hint">Tip: a date like 2026-11-01 becomes the deadline. One card per line.</span></form>';
      } else {
        h += '<button type="button" class="add-card">+ Add a card</button>';
      }
      return h + '</section>';
    }
    function render() {
      if (ui.dragId) return;
      var scroll = { x: board.scrollLeft, cols: {} };
      board.querySelectorAll('.col').forEach(function (c) { scroll.cols[c.dataset.col] = $('.col-body', c).scrollTop; });
      var cols = S.doc.columns || [];
      board.innerHTML = cols.map(colHtml).join('') + '<button type="button" class="add-col">+ Add a column</button>';
      board.scrollLeft = scroll.x;
      board.querySelectorAll('.col').forEach(function (c) { var b = $('.col-body', c); b.scrollTop = scroll.cols[c.dataset.col] || 0; });
      if (ui.adding) {
        var ta = board.querySelector('.col[data-col="' + ui.adding + '"] .add-form textarea');
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      }
    }

    /* ---------- card actions ---------- */
    function toggleDone(id) {
      var c = S.doc.cards[id]; if (!c) return;
      var node = document.getElementById(id);
      var go = function () { S.setCard(id, c.done ? { done: false, doneAt: 0 } : { done: true, doneAt: Date.now() }); };
      if (!c.done && node) { node.classList.add('finishing'); setTimeout(go, 220); } else go();
    }

    board.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('a')) return;
      var cardEl = t.closest('.card');
      if (t.closest('.tick')) { e.stopPropagation(); toggleDone(cardEl.dataset.id); return; }
      if (t.closest('.note-toggle')) {
        var id = cardEl.dataset.id;
        ui.openNotes[id] = !ui.openNotes[id];
        render();
        return;
      }
      if (t.closest('.note')) return;
      if (cardEl) { openEditor(cardEl.dataset.id); return; }
      if (t.closest('.col-menu')) { colMenu(t.closest('.col').dataset.col, t.closest('.col-menu')); return; }
      if (t.closest('.add-card')) { ui.adding = t.closest('.col').dataset.col; ui.draft = ''; render(); return; }
      if (t.closest('.add-cancel')) { ui.adding = null; ui.draft = ''; render(); return; }
      if (t.closest('.add-col')) {
        var name = prompt('Name of the new column');
        if (name && name.trim()) S.setColumns((S.doc.columns || []).concat([{ id: L.uid(), name: name.trim() }]));
      }
    });
    // Right-click a card: strand colour, importance, finish, edit, delete
    board.addEventListener('contextmenu', function (e) {
      var cardEl = e.target.closest('.card'); if (!cardEl) return;
      e.preventDefault();
      closeMenus();
      var id = cardEl.dataset.id, c = S.doc.cards[id]; if (!c) return;
      var m = L.el('div', { class: 'menu card-menu', role: 'menu' });
      m.innerHTML =
        '<div class="cm-label">Research strand</div>' +
        '<div class="cm-strands">' + STRANDS.map(function (st) {
          return '<button type="button" class="cm-swatch' + ((c.strand || 0) === st.v ? ' on' : '') + '" data-s="' + st.v + '" style="--s:' + st.hex + '" title="' + esc(st.name) + '"><i></i><span>' + esc(st.short) + '</span></button>';
        }).join('') + '<button type="button" class="cm-swatch' + (!c.strand ? ' on' : '') + '" data-s="0"><i class="none"></i><span>No colour</span></button></div>' +
        '<hr><div class="cm-label">Importance</div><div class="cm-prio">' + L.PRIO.map(function (p) {
          return '<button type="button" data-p="' + p.v + '"' + (p.v ? ' data-prio="' + p.v + '"' : '') + ' class="' + ((c.prio || 0) === p.v ? 'on' : '') + '" title="' + p.name + '"><i></i></button>';
        }).join('') + '</div>' +
        '<hr><button type="button" data-a="done">' + (c.done ? 'Reopen' : '✓ Mark finished') + '</button>' +
        '<button type="button" data-a="edit">Edit…</button>' +
        '<button type="button" data-a="del" class="danger">Delete</button>';
      document.body.appendChild(m);
      var w = m.offsetWidth, hgt = m.offsetHeight;
      m.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - w - 8)) + window.scrollX + 'px';
      m.style.top = Math.max(8, Math.min(e.clientY, window.innerHeight - hgt - 8)) + window.scrollY + 'px';
      m.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        closeMenus();
        if (b.dataset.s != null) S.setCard(id, { strand: +b.dataset.s });
        else if (b.dataset.p != null) S.setCard(id, { prio: +b.dataset.p });
        else if (b.dataset.a === 'done') toggleDone(id);
        else if (b.dataset.a === 'edit') openEditor(id);
        else if (b.dataset.a === 'del') { if (confirm('Delete “' + (c.title || 'this card') + '”?')) S.deleteCard(id); }
      });
    });
    board.addEventListener('keydown', function (e) {
      var cardEl = e.target.closest && e.target.closest('.card');
      if (cardEl && e.target === cardEl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEditor(cardEl.dataset.id); }
      var ta = e.target.closest && e.target.closest('.add-form textarea');
      if (ta) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAdd(ta.closest('.add-form')); }
        if (e.key === 'Escape') { ui.adding = null; ui.draft = ''; render(); }
      }
    });
    board.addEventListener('input', function (e) { if (e.target.closest('.add-form')) ui.draft = e.target.value; });
    board.addEventListener('submit', function (e) { e.preventDefault(); submitAdd(e.target); });
    board.addEventListener('toggle', function (e) {
      var d = e.target; if (!d.classList || !d.classList.contains('done-zone')) return;
      ui.openDone[d.dataset.col] = d.open;
    }, true);

    function submitAdd(form) {
      var col = form.closest('.col').dataset.col;
      var lines = $('textarea', form).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      lines.forEach(function (line) {
        var due = '', m = line.match(/\b(20\d\d-\d\d-\d\d)\b/);
        if (m) { due = m[1]; line = line.replace(m[0], '').replace(/\s{2,}/g, ' ').trim(); }
        S.addCard(col, { title: line || 'Untitled', due: due });
      });
      ui.draft = '';
      render();
    }

    /* ---------- column menu ---------- */
    function closeMenus() { document.querySelectorAll('.menu').forEach(function (m) { m.remove(); }); }
    L.listen(document, 'click', function (e) { if (!e.target.closest('.menu') && !e.target.closest('.col-menu')) closeMenus(); });
    L.listen(document, 'keydown', function (e) { if (e.key === 'Escape') closeMenus(); });

    function colMenu(colId, anchor) {
      closeMenus();
      var cols = S.doc.columns.slice(), i = cols.findIndex(function (c) { return c.id === colId; }), col = cols[i];
      var m = L.el('div', { class: 'menu', role: 'menu' });
      m.innerHTML =
        '<button data-a="add">Add a card at the top</button>' +
        '<button data-a="sort">Sort open cards by deadline</button>' +
        '<button data-a="sortp">Sort open cards by importance</button>' +
        '<hr><button data-a="rename">Rename column</button>' +
        (i > 0 ? '<button data-a="left">Move column left</button>' : '') +
        (i < cols.length - 1 ? '<button data-a="right">Move column right</button>' : '') +
        '<button data-a="cleardone">Delete finished cards</button>' +
        '<hr><button data-a="delete" class="danger">Delete column</button>';
      document.body.appendChild(m);
      var r = anchor.getBoundingClientRect();
      m.style.top = (r.bottom + window.scrollY + 4) + 'px';
      m.style.left = Math.max(8, Math.min(r.right + window.scrollX - m.offsetWidth, document.documentElement.clientWidth - m.offsetWidth - 8)) + 'px';
      m.addEventListener('click', function (e) {
        var a = e.target.dataset.a; if (!a) return;
        closeMenus();
        var open = S.cardsIn(colId).filter(function (c) { return !c.done; });
        if (a === 'add') {
          var title = prompt('New card for ' + col.name);
          if (title && title.trim()) S.addCard(colId, { title: title.trim() }, true);
        } else if (a === 'sort') {
          S.reorder(colId, open.slice().sort(function (x, y) {
            if (!x.due && !y.due) return 0; if (!x.due) return 1; if (!y.due) return -1; return x.due < y.due ? -1 : x.due > y.due ? 1 : 0;
          }).map(function (c) { return c.id; }));
        } else if (a === 'sortp') {
          S.reorder(colId, open.slice().sort(function (x, y) { return (y.prio || 0) - (x.prio || 0); }).map(function (c) { return c.id; }));
        } else if (a === 'rename') {
          var name = prompt('Rename column', col.name);
          if (name && name.trim()) { cols[i] = Object.assign({}, col, { name: name.trim() }); S.setColumns(cols); }
        } else if (a === 'left' || a === 'right') {
          var j = a === 'left' ? i - 1 : i + 1, tmp = cols[j]; cols[j] = cols[i]; cols[i] = tmp; S.setColumns(cols);
        } else if (a === 'cleardone') {
          var done = S.cardsIn(colId).filter(function (c) { return c.done; });
          if (done.length && confirm('Delete ' + done.length + ' finished card(s) in “' + col.name + '”?')) done.forEach(function (c) { S.deleteCard(c.id); });
        } else if (a === 'delete') {
          var n = S.cardsIn(colId).length;
          if (confirm('Delete the column “' + col.name + '”' + (n ? ' and its ' + n + ' card(s)' : '') + '?')) {
            S.cardsIn(colId).forEach(function (c) { S.deleteCard(c.id); });
            cols.splice(i, 1); S.setColumns(cols);
          }
        }
      });
    }

    /* ---------- drag and drop ---------- */
    var dropLine = L.el('div', { class: 'drop-line' });
    function dropIndex(body, y) {
      var cards = Array.prototype.filter.call(body.querySelectorAll(':scope > .card'), function (n) { return n.dataset.id !== ui.dragId; });
      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return { i: i, before: cards[i] };
      }
      return { i: cards.length, before: body.querySelector(':scope > .done-zone, :scope > .empty') };
    }
    board.addEventListener('dragstart', function (e) {
      var c = e.target.closest && e.target.closest('.card');
      if (!c || c.classList.contains('done')) return;
      ui.dragId = c.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', c.dataset.id); } catch (x) { /* ignore */ }
      setTimeout(function () { c.classList.add('dragging'); }, 0);
    });
    board.addEventListener('dragover', function (e) {
      if (!ui.dragId) return;
      var col = e.target.closest && e.target.closest('.col'); if (!col) return;
      e.preventDefault();
      var body = $('.col-body', col), pos = dropIndex(body, e.clientY);
      if (pos.before) body.insertBefore(dropLine, pos.before); else body.appendChild(dropLine);
      board.querySelectorAll('.col.drop-target').forEach(function (n) { if (n !== col) n.classList.remove('drop-target'); });
      col.classList.add('drop-target');
    });
    board.addEventListener('drop', function (e) {
      if (!ui.dragId) return;
      var col = e.target.closest && e.target.closest('.col'); if (!col) return;
      e.preventDefault();
      var colId = col.dataset.col, body = $('.col-body', col), pos = dropIndex(body, e.clientY), id = ui.dragId;
      var ids = S.cardsIn(colId).filter(function (c) { return !c.done && c.id !== id; }).map(function (c) { return c.id; });
      // Hidden (filtered) cards keep their place: translate the visible index to the full list.
      var visible = Array.prototype.map.call(body.querySelectorAll(':scope > .card'), function (n) { return n.dataset.id; }).filter(function (x) { return x !== id; });
      var at = pos.i < visible.length ? ids.indexOf(visible[pos.i]) : (visible.length ? ids.indexOf(visible[visible.length - 1]) + 1 : ids.length);
      ids.splice(at < 0 ? ids.length : at, 0, id);
      endDrag();
      S.reorder(colId, ids);
    });
    function endDrag() {
      ui.dragId = null;
      dropLine.remove();
      board.querySelectorAll('.drop-target').forEach(function (n) { n.classList.remove('drop-target'); });
      board.querySelectorAll('.dragging').forEach(function (n) { n.classList.remove('dragging'); });
    }
    board.addEventListener('dragend', function () { if (ui.dragId) { endDrag(); render(); } });

    /* ---------- card editor ---------- */
    function openEditor(id) {
      var c = S.doc.cards[id]; if (!c) return;
      var dlg = L.el('dialog', { class: 'modal', 'aria-label': 'Edit card' });
      var colOpts = (S.doc.columns || []).map(function (col) {
        return '<option value="' + esc(col.id) + '"' + (col.id === c.col ? ' selected' : '') + '>' + esc(col.name) + '</option>';
      }).join('');
      dlg.innerHTML =
        '<form method="dialog" class="modal-body">' +
        '  <input class="title-input" name="title" aria-label="Title" placeholder="Title">' +
        '  <div class="modal-grid">' +
        '    <label>Deadline <span class="date-row"><input type="date" name="due"><button type="button" class="btn small ghost" data-clear>Clear</button></span></label>' +
        '    <label>Column <select name="col">' + colOpts + '</select></label>' +
        '  </div>' +
        '  <div><label style="margin-bottom:6px">Importance / urgency</label><div class="seg" id="prioSeg">' +
        L.PRIO.map(function (p) { return '<button type="button" data-v="' + p.v + '"' + (p.v ? ' data-prio="' + p.v + '"' : '') + '><i></i>' + p.name + '</button>'; }).join('') +
        '  </div></div>' +
        '  <div><label style="margin-bottom:6px">Research strand</label><div class="seg" id="strandSeg"><button type="button" data-s="0">None</button>' +
        STRANDS.map(function (st) { return '<button type="button" data-s="' + st.v + '" style="--p:' + st.hex + '"><i></i>' + esc(st.short) + '</button>'; }).join('') +
        '  </div></div>' +
        '  <label>Next steps <small>Shown on the card.</small><textarea name="next" rows="3" placeholder="e.g. Draft the 500-word abstract"></textarea></label>' +
        '  <label>Note <small>Unfolds from the card. Links work.</small><textarea name="note" rows="6" placeholder="Details, links, ideas…"></textarea></label>' +
        '  <label>Link <small>Makes the title clickable.</small><input name="link" placeholder="https://…"></label>' +
        '  <div class="modal-actions">' +
        '    <span class="left"><button type="button" class="btn small ghost danger" data-del>Delete</button></span>' +
        '    <button type="button" class="btn" data-done></button>' +
        '    <button value="close" class="btn primary">Done</button>' +
        '  </div>' +
        '</form>';
      document.body.appendChild(dlg);
      var f = $('form', dlg);
      f.title.value = c.title || ''; f.due.value = c.due || ''; f.next.value = c.next || ''; f.note.value = c.note || ''; f.link.value = c.link || '';
      function cur() { return S.doc.cards[id]; }
      function paintSeg() {
        var p = cur().prio || 0;
        dlg.querySelectorAll('#prioSeg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === p); });
        dlg.querySelectorAll('#strandSeg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === (cur().strand || 0)); });
        $('[data-done]', dlg).textContent = cur().done ? 'Reopen' : '✓ Mark finished';
      }
      paintSeg();
      ['title', 'next', 'note', 'link'].forEach(function (k) {
        f[k].addEventListener('input', function () { var o = {}; o[k] = f[k].value; S.setCard(id, o); });
      });
      f.due.addEventListener('change', function () { S.setCard(id, { due: f.due.value }); });
      $('[data-clear]', dlg).addEventListener('click', function () { f.due.value = ''; S.setCard(id, { due: '' }); });
      f.col.addEventListener('change', function () {
        var others = S.cardsIn(f.col.value).filter(function (x) { return !x.done; });
        S.setCard(id, { col: f.col.value, order: others.length ? others[others.length - 1].order + 1000 : 1000 });
      });
      $('#strandSeg', dlg).addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.setCard(id, { strand: +b.dataset.s }); paintSeg();
      });
      $('#prioSeg', dlg).addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.setCard(id, { prio: +b.dataset.v }); paintSeg();
      });
      $('[data-done]', dlg).addEventListener('click', function () { toggleDone(id); setTimeout(function () { dlg.close(); }, 240); });
      $('[data-del]', dlg).addEventListener('click', function () {
        if (confirm('Delete “' + (cur().title || 'this card') + '”?')) { S.deleteCard(id); dlg.close(); }
      });
      dlg.addEventListener('close', function () {
        if (!cur().del && !(cur().title || '').trim()) S.setCard(id, { title: 'Untitled' });
        dlg.remove();
        S.save();
      });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg.showModal();
      if (!c.title) f.title.focus(); else f.title.blur();
    }

    /* ---------- go ---------- */
    paintLegend();
    render();
    L.onStore(function () { render(); });

    if (location.hash.length > 1) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.classList.add('flash');
        setTimeout(function () { target.classList.remove('flash'); }, 2200);
      }
    }
  });
})();
