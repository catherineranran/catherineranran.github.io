/* Today page: Brain.fm focus music, focus timer, coming-up tasks, day agenda + mini month. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, GC = window.GCal;
  var FOCUS_KEY = 'launch.focus.v1';

  L.boot('home', function () {
    /* ---------- Brain.fm ---------- */
    function musicUrl() { return (S.doc.settings || {}).musicUrl || 'https://my.brain.fm/'; }
    function paintMusic() {
      var slot = $('#musicSlot'), url = L.safeUrl(musicUrl()), f = slot.querySelector('iframe');
      if (f && f.getAttribute('src') === url) return;
      slot.innerHTML = '<iframe class="music-frame" title="Brain.fm" src="' + L.esc(url) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>';
    }
    paintMusic();
    $('#popIcon').innerHTML = L.ICONS.ext;
    $('#musicPop').addEventListener('click', function () {
      var w = Math.min(460, screen.availWidth), h = Math.min(820, screen.availHeight);
      var win = window.open(musicUrl(), 'ranran-brainfm', 'popup=yes,width=' + w + ',height=' + h + ',left=' + (screen.availWidth - w) + ',top=0');
      if (!win) window.open(musicUrl(), '_blank', 'noopener');
    });

    /* ---------- focus timer (kept on this device) ---------- */
    function state() { var t = L.lsGet(FOCUS_KEY) || {}; if (!t.mins) t.mins = 50; return t; }
    function save(t) { L.lsSet(FOCUS_KEY, t); paintTimer(); }
    function paintTimer() {
      var t = state(), total = t.mins * 60000, left = t.endAt ? Math.max(0, t.endAt - Date.now()) : (t.left != null ? t.left : total);
      $('#timerTime').textContent = Math.floor(left / 60000) + ':' + String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
      $('#timerGo').textContent = t.endAt ? 'Pause' : left < total ? 'Resume' : 'Start';
      $('#timerLen').value = String(t.mins);
      if (t.endAt && left === 0) {
        t.endAt = null; t.left = null; L.lsSet(FOCUS_KEY, t);
        chime();
        document.title = '✓ Block done · Launch Pad';
        setTimeout(function () { document.title = 'Launch Pad · Today'; }, 60000);
      }
    }
    function chime() {
      try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        [0, .25, .5].forEach(function (d, i) {
          var o = ac.createOscillator(), g = ac.createGain();
          o.frequency.value = [660, 880, 990][i]; o.connect(g); g.connect(ac.destination);
          g.gain.setValueAtTime(.0001, ac.currentTime + d);
          g.gain.exponentialRampToValueAtTime(.2, ac.currentTime + d + .02);
          g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d + .6);
          o.start(ac.currentTime + d); o.stop(ac.currentTime + d + .65);
        });
      } catch (e) { /* no audio */ }
    }
    $('#timerGo').addEventListener('click', function () {
      var t = state();
      if (t.endAt) { t.left = Math.max(0, t.endAt - Date.now()); t.endAt = null; }
      else { t.endAt = Date.now() + (t.left != null ? t.left : t.mins * 60000); t.left = null; }
      save(t);
    });
    $('#timerLen').addEventListener('change', function () { save({ mins: +this.value, endAt: null, left: null }); });
    paintTimer(); setInterval(paintTimer, 1000);

    /* ---------- coming up ---------- */
    // Two columns: the open cards of "To do: Miscellaneous" and "To do: Research", dated ones first.
    function paintDue() {
      var cols = S.doc.columns || [];
      function find(re, fallback) { var c = cols.filter(function (x) { return re.test(x.name); })[0]; return c || cols.filter(function (x) { return x.id === fallback; })[0]; }
      [[find(/misc/i, 'misc'), '#dueMisc', '#dueMiscH'], [find(/research/i, 'research'), '#dueRes', '#dueResH']].forEach(function (x) {
        var col = x[0], ul = $(x[1]);
        if (!col) { ul.innerHTML = ''; return; }
        $(x[2]).textContent = col.name;
        var list = S.cardsIn(col.id).filter(function (c) { return !c.done; }).sort(function (a, b) {
          if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.prio || 0) - (a.prio || 0);
          if (a.due || b.due) return a.due ? -1 : 1;
          return (b.prio || 0) - (a.prio || 0) || (a.order || 0) - (b.order || 0);
        });
        if (!list.length) { ul.innerHTML = '<li class="empty" style="display:block">All clear.</li>'; return; }
        var shown = list.slice(0, 10);
        ul.innerHTML = shown.map(function (c) {
          return '<li><span class="pdot" data-prio="' + (c.prio || 0) + '"></span>' +
            '<span class="t"><a href="/launch/task-list/#' + c.id + '">' + L.esc(c.title) + '</a>' + (c.next ? '<small>' + L.esc(c.next.split('\n')[0]) + '</small>' : '') + '</span>' +
            '<span class="d ' + (c.due ? L.dueClass(c.due) : '') + '">' + (c.due ? L.esc(L.fmtDue(c.due)) + '<br>' + L.esc(L.relDue(c.due)) : '') + '</span></li>';
        }).join('') + (list.length > shown.length ? '<li style="display:block;border:0"><a class="more" href="/launch/task-list/">+ ' + (list.length - shown.length) + ' more</a></li>' : '');
      });
    }
    paintDue();

    /* ---------- agenda: one day + mini month ---------- */
    var day = new Date(); day.setHours(0, 0, 0, 0);
    function paintDate() {
      var today = GC.sameDay(day, new Date());
      $('#agDate').textContent = day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); $('#agDate').title = today ? 'Today' : '';
    }
    var cal = GC.mount($('#agendaView'), $('#agendaBanner'), { days: 1, compact: true, date: day, connectText: 'See today’s plan from Google Calendar here, and add or move events.', onConnect: function () { if (cal && cal.view) cal.view.setDate(day); } });
    var month = new GC.MiniMonth($('#agendaMonth'), { date: day, onSelect: function (d) { go(d); } });
    function go(d) {
      day = new Date(d); day.setHours(0, 0, 0, 0);
      paintDate(); month.setSelected(day);
      if (cal.view) cal.view.setDate(day);
    }
    $('#agPrev').addEventListener('click', function () { go(GC.addDays(day, -1)); });
    $('#agNext').addEventListener('click', function () { go(GC.addDays(day, 1)); });
    paintDate();
    // refresh events when coming back to the page
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && cal.view && GC.G.token()) cal.view.load(); });

    S.on(function () { paintMusic(); paintDue(); });
  });
})();
