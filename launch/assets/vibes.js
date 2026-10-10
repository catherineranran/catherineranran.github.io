/* Vibecodings by genius Ranran: a gallery of things built with AI, with links. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc;

  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 40; return 190 + h; } // sky blues
  function sorted() {
    return S.vibeList().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : (a.order || 0) - (b.order || 0); });
  }

  // Last edited: read from GitHub (latest commit) when the code link points there.
  var ghCache = {};
  function ghInfo(repo) {
    var m = String(repo || '').match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)(?:\/tree\/([^\/\s]+)\/?(.*))?/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, ''), branch: m[3] || '', path: (m[4] || '').replace(/\/$/, '') };
  }
  function lastCommit(repo) {
    var g = ghInfo(repo); if (!g) return Promise.resolve(null);
    var key = repo;
    if (ghCache[key]) return ghCache[key];
    var cached = L.lsGet('launch.gh.' + key);
    if (cached && cached.t > Date.now() - 3600000) return (ghCache[key] = Promise.resolve(cached.d));
    var url = 'https://api.github.com/repos/' + g.owner + '/' + g.repo + '/commits?per_page=1' + (g.branch ? '&sha=' + encodeURIComponent(g.branch) : '') + (g.path ? '&path=' + encodeURIComponent(g.path) : '');
    ghCache[key] = fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var d = j && j[0] && j[0].commit && (j[0].commit.committer || j[0].commit.author).date;
        d = d ? d.slice(0, 10) : null;
        L.lsSet('launch.gh.' + key, { t: Date.now(), d: d });
        return d;
      }).catch(function () { return null; });
    return ghCache[key];
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
          (v.status ? '<span class="vibe-status">' + esc(v.status) + '</span>' : '') +
          '<div class="vibe-dates">' + (v.date ? '<span><em>Made</em>' + esc(fullDate(v.date)) + '</span>' : '') +
          '<span class="edited" data-repo="' + esc(v.repo || '') + '" data-manual="' + esc(v.edited || '') + '"' + (v.edited ? '' : ' hidden') + '><em>Last edited</em><b>' + esc(v.edited ? fullDate(v.edited) : '') + '</b></span></div>' +
          (v.blurb ? '<p class="vibe-blurb">' + L.linkify(v.blurb) + '</p>' : '') +
          '  <div class="row vibe-links">' +
          (url ? '<a class="btn small" href="' + esc(url) + '" target="_blank" rel="noopener">Open ' + L.ICONS.ext + '</a>' : '') +
          (repo ? '<a class="btn small ghost" href="' + esc(repo) + '" target="_blank" rel="noopener">Code</a>' : '') +
          '  </div>' +
          '</div></article>';
      }).join('');
      wrap.querySelectorAll('.edited[data-repo]').forEach(function (n) {
        if (!n.dataset.repo) return;
        lastCommit(n.dataset.repo).then(function (d) {
          var best = [d, n.dataset.manual].filter(Boolean).sort().pop();
          if (best) { n.hidden = false; n.querySelector('b').textContent = fullDate(best); }
        });
      });
    }
    function fullDate(isoDate) {
      var p = isoDate.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function editor(id) {
      var v = id ? S.doc.vibes[id] : { title: '', url: '', repo: '', date: L.todayISO(), edited: '', blurb: '', image: '', status: '' };
      var dlg = L.el('dialog', { class: 'modal', 'aria-label': id ? 'Edit vibecoding' : 'Add a vibecoding' });
      dlg.innerHTML =
        '<form method="dialog" class="modal-body">' +
        '  <h2>' + (id ? 'Edit vibecoding' : 'Add a vibecoding') + '</h2>' +
        '  <label>Name <input name="title" required placeholder="e.g. Survey Studio"></label>' +
        '  <label>Link <small>Where it lives, e.g. ranranli.net/survey-studio</small><input name="url" placeholder="https://…"></label>' +
        '  <div class="modal-grid">' +
        '    <label>First made <input type="date" name="date"></label>' +
        '    <label>Last edited <small>Filled in from GitHub when there’s a code link</small><input type="date" name="edited"></label>' +
        '  </div>' +
        '  <label>Status <input name="status" placeholder="live, private, WIP…"></label>' +
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
      ['title', 'url', 'date', 'edited', 'status', 'blurb', 'repo', 'image'].forEach(function (k) { f[k].value = v[k] || ''; });
      if (id) $('[data-del]', dlg).addEventListener('click', function () {
        if (confirm('Remove “' + v.title + '” from your vibecodings?')) { S.setVibe(id, { del: true }); dlg.close(); }
      });
      dlg.addEventListener('close', function () {
        if (dlg.returnValue === 'save' && f.title.value.trim()) {
          var o = {};
          ['title', 'url', 'date', 'edited', 'status', 'blurb', 'repo', 'image'].forEach(function (k) { o[k] = f[k].value.trim(); });
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
