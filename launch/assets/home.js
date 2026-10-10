/* Today page: Brain.fm focus music, focus timer, concentration summary, coming-up tasks, day agenda. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$, GC = window.GCal, F = L.Focus;

  L.boot('home', function () {
    /* ---------- Brain.fm (the player itself lives in L.Dock so it keeps playing across tabs) ---------- */
    function musicUrl() { return (S.doc.settings || {}).musicUrl || 'https://my.brain.fm/'; }
    $('#popIcon').innerHTML = L.ICONS.ext;
    $('#musicPop').addEventListener('click', function () {
      var w = Math.min(460, screen.availWidth), h = Math.min(820, screen.availHeight);
      var win = window.open(musicUrl(), 'ranran-brainfm', 'popup=yes,width=' + w + ',height=' + h + ',left=' + (screen.availWidth - w) + ',top=0');
      if (!win) window.open(musicUrl(), '_blank', 'noopener');
    });

    /* ---------- focus timer ---------- */
    function paintTimer() {
      var t = F.state(), total = t.mins * 60000, left = F.left();
      $('#timerTime').textContent = L.fmtClock(left);
      $('#timerGo').textContent = t.endAt ? 'Pause' : left < total ? 'Resume' : 'Start';
      $('#timerLen').value = String(t.mins);
      $('#timerReset').hidden = !(t.endAt || left < total);
    }
    $('#timerGo').addEventListener('click', function () { if (F.running()) F.pause(); else F.start(); });
    $('#timerReset').addEventListener('click', function () { F.reset(); });
    $('#timerLen').addEventListener('change', function () { F.setLength(+this.value); });
    L.scoped(F.on(function () { paintTimer(); paintFocus(); }));
    paintTimer();

    /* ---------- concentration summary ---------- */
    function hm(min) {
      min = Math.round(min);
      var h = Math.floor(min / 60), m = min % 60;
      return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
    }
    function dayKey(d) { return L.todayISOOf(d); }
    var lastFocusPaint = '';
    function paintFocus() {
      if (!$('#focusStats')) return;
      var by = S.focusByDay(), today = new Date(); today.setHours(0, 0, 0, 0);
      var tToday = by[dayKey(today)] || 0;
      // this week (Mon–Sun), last 7 days, streak
      var monday = GC.startOfWeek(today), week = 0, last7 = 0, best = 0;
      for (var i = 0; i < 7; i++) { week += by[dayKey(GC.addDays(monday, i))] || 0; last7 += by[dayKey(GC.addDays(today, -i))] || 0; }
      Object.keys(by).forEach(function (k) { if (by[k] > best) best = by[k]; });
      var streak = 0, d = new Date(today);
      if (!(by[dayKey(d)] > 0)) d = GC.addDays(d, -1);
      while (by[dayKey(d)] > 0) { streak++; d = GC.addDays(d, -1); }
      // last 14 days as bars
      var days = [], max = 60;
      for (var j = 13; j >= 0; j--) { var dd = GC.addDays(today, -j), v = by[dayKey(dd)] || 0; days.push({ d: dd, v: v }); if (v > max) max = v; }
      var sig = JSON.stringify([tToday, week, last7, streak, days.map(function (x) { return Math.round(x.v); })]);
      if (sig === lastFocusPaint) return;
      lastFocusPaint = sig;
      $('#focusStats').innerHTML =
        stat('Today', hm(tToday)) + stat('This week', hm(week)) + stat('Daily average', hm(last7 / 7), 'last 7 days') +
        stat('Streak', streak + (streak === 1 ? ' day' : ' days'), best ? 'best day ' + hm(best) : '');
      $('#focusBars').innerHTML = days.map(function (x) {
        var isToday = GC.sameDay(x.d, today), pct = Math.round(x.v / max * 100);
        return '<div class="fbar' + (isToday ? ' today' : '') + '" title="' + L.esc(x.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + hm(x.v)) + '">' +
          '<span class="fbar-v">' + (x.v >= 1 ? (x.v >= 60 ? (Math.round(x.v / 6) / 10) + 'h' : Math.round(x.v) + 'm') : '') + '</span>' +
          '<span class="fbar-fill" style="height:' + Math.max(pct, x.v > 0 ? 3 : 0) + '%"></span>' +
          '<span class="fbar-d">' + x.d.toLocaleDateString('en-GB', { weekday: 'narrow' }) + '<br>' + x.d.getDate() + '</span></div>';
      }).join('');
    }
    function stat(label, value, sub) {
      return '<div class="fstat"><span>' + L.esc(label) + '</span><b>' + L.esc(value) + '</b>' + (sub ? '<small>' + L.esc(sub) + '</small>' : '') + '</div>';
    }
    if ($('#focusAdd')) $('#focusAdd').addEventListener('click', function () {
      var v = prompt('Add focus time for today (minutes), e.g. if you worked without the timer:', '30');
      var m = Math.round(parseFloat(v));
      if (m > 0 && m < 24 * 60) F.addManual(m);
    });
    paintFocus();

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
    var month = new GC.MiniMonth($('#agendaMonth'), { date: day, onSelect: function (d) { goDay(d); } });
    function goDay(d) {
      day = new Date(d); day.setHours(0, 0, 0, 0);
      paintDate(); month.setSelected(day);
      if (cal.view) cal.view.setDate(day);
    }
    $('#agPrev').addEventListener('click', function () { goDay(GC.addDays(day, -1)); });
    $('#agNext').addEventListener('click', function () { goDay(GC.addDays(day, 1)); });
    paintDate();
    L.listen(document, 'visibilitychange', function () { if (document.visibilityState === 'visible' && cal.view && GC.G.token()) cal.view.load(); });

    L.onStore(function () { paintDue(); paintFocus(); L.Dock.refresh(); });
  });
})();
