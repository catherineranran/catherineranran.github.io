/* Vibecodings by genius Ranran: a gallery of things built with AI, with links. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;

  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function sorted() {
    return S.vibeList().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : (a.order || 0) - (b.order || 0); });
  }

  L.boot('vibes', function () {
    var wrap = $('#vibes');

    function render() {
      var list = sorted();
      if (!list.length) { wrap.innerHTML = '<p class="empty">No vibecodings yet. Add your first one.</p>'; return; }
      wrap.innerHTML = list.map(function (v) {
        var url = L.safeUrl(v.url), repo = L.safeUrl(v.repo), img = L.safeUrl(v.image);
        var h = hue(v.title || 'x');
        var cover = img
          ? '<img src="' + esc(img) + '" alt="" loading="lazy">'
          : '<div class="vibe-cover-art" style="--h:' + h + '"><span>' + esc((v.title || '?').slice(0, 1)) + '</span></div>';
        return '<article class="vibe" data-id="' + esc(v.id) + '">' +
          (url ? '<a class="vibe-cover" href="' + esc(url) + '" target="_blank" rel="noopener" tabindex="-1">' + cover + '</a>' : '<div class="vibe-cover">' + cover + '</div>') +
          '<div class="vibe-body">' +
          '  <div class="vibe-top"><h3>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(v.title) + '</a>' : esc(v.title)) + '</h3>' +
          '  <button type="button" class="icon-btn vibe-edit" aria-label="Edit ' + esc(v.title) + '" title="Edit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button></div>' +
          (v.date ? '<p class="vibe-date">' + esc(L.fmtDue(v.date)) + (v.status ? ' · ' + esc(v.status) : '') + '</p>' : (v.status ? '<p class="vibe-date">' + esc(v.status) + '</p>' : '')) +
          (v.blurb ? '<p class="vibe-blurb">' + L.linkify(v.blurb) + '</p>' : '') +
          '  <div class="row vibe-links">' +
          (url ? '<a class="btn small" href="' + esc(url) + '" target="_blank" rel="noopener">Open ' + L.ICONS.ext + '</a>' : '') +
          (repo ? '<a class="btn small ghost" href="' + esc(repo) + '" target="_blank" rel="noopener">Code</a>' : '') +
          '  </div>' +
          '</div></article>';
      }).join('');
    }

    function editor(id) {
      var v = id ? S.doc.vibes[id] : { title: '', url: '', repo: '', date: L.todayISO(), blurb: '', image: '', status: '' };
      var dlg = L.el('dialog', { class: 'modal', 'aria-label': id ? 'Edit vibecoding' : 'Add a vibecoding' });
      dlg.innerHTML =
        '<form method="dialog" class="modal-body">' +
        '  <h2>' + (id ? 'Edit vibecoding' : 'Add a vibecoding') + '</h2>' +
        '  <label>Name <input name="title" required placeholder="e.g. Survey Studio"></label>' +
        '  <label>Link <small>Where it lives, e.g. ranranli.net/survey-studio</small><input name="url" placeholder="https://…"></label>' +
        '  <div class="modal-grid">' +
        '    <label>Date <input type="date" name="date"></label>' +
        '    <label>Status <input name="status" placeholder="live, private, WIP…"></label>' +
        '  </div>' +
        '  <label>What it is <textarea name="blurb" rows="3"></textarea></label>' +
        '  <label>Code <small>GitHub repo (optional)</small><input name="repo" placeholder="https://github.com/catherineranran/…"></label>' +
        '  <label>Preview image <small>Image link (optional)</small><input name="image" placeholder="/assets/…jpg"></label>' +
        '  <div class="modal-actions">' +
        (id ? '<span class="left"><button type="button" class="btn small ghost danger" data-del>Delete</button></span>' : '') +
        '    <button value="cancel" class="btn" formnovalidate>Cancel</button><button value="save" class="btn primary">Save</button>' +
        '  </div>' +
        '</form>';
      document.body.appendChild(dlg);
      var f = $('form', dlg);
      ['title', 'url', 'date', 'status', 'blurb', 'repo', 'image'].forEach(function (k) { f[k].value = v[k] || ''; });
      if (id) $('[data-del]', dlg).addEventListener('click', function () {
        if (confirm('Remove “' + v.title + '” from your vibecodings?')) { S.setVibe(id, { del: true }); dlg.close(); }
      });
      dlg.addEventListener('close', function () {
        if (dlg.returnValue === 'save' && f.title.value.trim()) {
          var o = {};
          ['title', 'url', 'date', 'status', 'blurb', 'repo', 'image'].forEach(function (k) { o[k] = f[k].value.trim(); });
          S.setVibe(id || L.uid(), o);
        }
        dlg.remove();
      });
      dlg.showModal();
    }

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('.vibe-edit'); if (b) editor(b.closest('.vibe').dataset.id);
    });
    $('#addVibe').addEventListener('click', function () { editor(null); });
    render();
    S.on(render);
  });
})();
