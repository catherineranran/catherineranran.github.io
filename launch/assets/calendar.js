/* Calendar tab: Google Calendar day/week view you can edit, mini month, calendar list. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, esc = L.esc, GC = window.GCal, G = GC.G;
  L.boot('calendar', function () {
    var days = window.innerWidth < 700 ? 1 : 7, date = new Date(); date.setHours(0, 0, 0, 0);
    var cal = GC.mount($('#calView'), $('#calBanner'), {
      days: days, date: date,
      connectText: 'Connect your Google Calendar to see your week and create, move or edit events here.',
      onRender: function () { paintTitle(); },
      onDayClick: function (d) { setDays(1); go(d); },
      onConnect: function () { if (cal && cal.view) { cal.view.opts.days = days; cal.view.setDate(date); } paintList(); }
    });
    var month = new GC.MiniMonth($('#calMonth'), { date: date, onSelect: function (d) { go(d); } });

    function paintTitle() {
      var first = days === 7 ? GC.startOfWeek(date) : date, last = GC.addDays(first, days - 1);
      var t = first.getMonth() === last.getMonth()
        ? first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        : first.toLocaleDateString('en-GB', { month: 'short' }) + ' – ' + last.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      if (days === 1) t = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      $('#calTitle').textContent = t;
    }
    function go(d) {
      date = new Date(d); date.setHours(0, 0, 0, 0);
      month.setSelected(date); paintTitle();
      if (cal.view) cal.view.setDate(date);
    }
    function setDays(n) {
      days = n;
      document.querySelectorAll('.seg2 button').forEach(function (b) { b.classList.toggle('on', +b.dataset.days === n); });
      if (cal.view) { cal.view.opts.days = n; }
      paintTitle();
    }
    document.querySelector('.seg2').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setDays(+b.dataset.days); if (cal.view) cal.view.setDate(date);
    });
    $('#calToday').addEventListener('click', function () { go(new Date()); });
    $('#calPrev').addEventListener('click', function () { go(GC.addDays(date, -days)); });
    $('#calNext').addEventListener('click', function () { go(GC.addDays(date, days)); });
    $('#calCreate').addEventListener('click', function () {
      if (!G.token()) { alert('Connect Google Calendar first.'); return; }
      G.loadCalendars().then(function () {
        var s = new Date(date), now = new Date();
        s.setHours(GC.sameDay(date, now) ? now.getHours() + 1 : 9, 0, 0, 0);
        GC.openEventEditor({ start: s, end: new Date(s.getTime() + 3600000), allDay: false }, function () { if (cal.view) cal.view.load(); });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea, select, dialog')) return;
      if (e.key === 't') go(new Date());
      else if (e.key === 'ArrowLeft' || e.key === 'j') go(GC.addDays(date, -days));
      else if (e.key === 'ArrowRight' || e.key === 'k') go(GC.addDays(date, days));
      else if (e.key === 'd') { setDays(1); go(date); }
      else if (e.key === 'w') { setDays(7); go(date); }
    });

    // My calendars: tick to show/hide (remembered across devices)
    function paintList() {
      if (!G.token()) return;
      G.loadCalendars().then(function (all) {
        var shown = G.visibleCalendars().map(function (c) { return c.id; });
        $('#calListPanel').hidden = false;
        var mine = all.filter(function (c) { return c.writable; }), other = all.filter(function (c) { return !c.writable; });
        function li(c) { return '<li><label style="--c:' + esc(c.color) + '"><input type="checkbox" data-id="' + esc(c.id) + '"' + (shown.indexOf(c.id) !== -1 ? ' checked' : '') + '>' + esc(c.name) + '</label></li>'; }
        $('#calList').innerHTML = mine.map(li).join('') + (other.length ? '<li><h3>Other calendars</h3></li>' + other.map(li).join('') : '');
      }).catch(function () {});
    }
    $('#calList').addEventListener('change', function () {
      var ids = Array.prototype.filter.call($('#calList').querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return i.dataset.id; });
      G.setShown(ids);
      if (cal.view) cal.view.load();
    });
    paintTitle();
    paintList();
    G.on(function (w) { if (w === 'auth') paintList(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && cal.view && G.token()) cal.view.load(); });
    S.on(function (d, why) { if (why === 'remote' && cal.view) cal.view.render(false); });
  });
})();
