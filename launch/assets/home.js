/* Today page: island, focus music + timer, agenda, coming-up deadlines. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$;
  var FOCUS_KEY = 'launch.focus.v1';
  var C = 2 * Math.PI * 44;

  L.boot('home', function (doc) {
    var settings = doc.settings || {};

    // Island
    var islandUrl = settings.islandUrl || '/pleasure-island-experiment/';
    $('#islandSlot').innerHTML = '<iframe class="island-frame" title="Ranran’s island" src="' + L.esc(islandUrl) + '" allow="autoplay; fullscreen"></iframe>';
    $('#islandOpen').href = islandUrl;

    // Agenda
    function paintAgenda(s) {
      var slot = $('#agendaSlot');
      if (!s.calendars || !s.calendars.length) {
        slot.innerHTML = '<div class="panel-body"><p class="empty">Add your Google calendar in Settings (the gear, top right).</p></div>';
        return;
      }
      var src = L.calendarEmbed(s, 'AGENDA');
      var f = slot.querySelector('iframe');
      if (f && f.getAttribute('src') === src) return;
      slot.innerHTML = '<iframe class="agenda-frame" title="Today’s agenda" src="' + L.esc(src) + '"></iframe>';
    }
    paintAgenda(settings);

    // Music
    function musicUrl() { return (S.doc.settings || {}).musicUrl || 'https://my.brain.fm/'; }
    $('#musicTab').href = musicUrl();
    $('#musicBtn').addEventListener('click', function () {
      var w = Math.min(460, screen.availWidth), h = Math.min(820, screen.availHeight);
      var win = window.open(musicUrl(), 'ranran-brainfm', 'popup=yes,width=' + w + ',height=' + h + ',left=' + (screen.availWidth - w) + ',top=0');
      if (!win) window.open(musicUrl(), '_blank', 'noopener');
      var t = L.lsGet(FOCUS_KEY) || {};
      if (!t.endAt) startTimer();
    });

    // Focus timer (kept on this device so it survives switching tabs)
    var ring = $('#ringProg');
    ring.style.strokeDasharray = C;
    function state() { var t = L.lsGet(FOCUS_KEY) || {}; if (!t.mins) t.mins = 50; return t; }
    function save(t) { L.lsSet(FOCUS_KEY, t); paint(); }
    function startTimer() {
      var t = state();
      var left = t.left != null ? t.left : t.mins * 60000;
      t.endAt = Date.now() + left; t.left = null; save(t);
    }
    function paint() {
      var t = state(), total = t.mins * 60000, left;
      if (t.endAt) left = Math.max(0, t.endAt - Date.now());
      else left = t.left != null ? t.left : total;
      var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      $('#ringTime').textContent = m + ':' + String(s).padStart(2, '0');
      ring.style.strokeDashoffset = C * (1 - left / total);
      $('#ringSub').textContent = t.endAt ? 'focusing' : left < total ? 'paused' : t.mins + ' min block';
      $('#timerGo').textContent = t.endAt ? 'Pause' : left < total ? 'Resume' : 'Start timer';
      $('#focusState').textContent = t.endAt ? 'In the zone until ' + new Date(t.endAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Ready when you are';
      document.querySelectorAll('.chips .chip').forEach(function (b) { b.classList.toggle('on', +b.dataset.min === t.mins); });
      if (t.endAt && left === 0) {
        t.endAt = null; t.left = null; L.lsSet(FOCUS_KEY, t);
        chime();
        $('#focusState').textContent = 'Block done — take a break';
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
      if (t.endAt) { t.left = Math.max(0, t.endAt - Date.now()); t.endAt = null; save(t); }
      else startTimer();
    });
    $('#timerReset').addEventListener('click', function () { var t = state(); t.endAt = null; t.left = null; save(t); });
    document.querySelectorAll('.chips .chip').forEach(function (b) {
      b.addEventListener('click', function () { save({ mins: +b.dataset.min, endAt: null, left: null }); });
    });
    paint();
    setInterval(paint, 1000);

    // Coming up: every open card with a deadline in the next 3 weeks (or overdue)
    function paintDue() {
      var cols = {};
      (S.doc.columns || []).forEach(function (c) { cols[c.id] = c.name; });
      var list = S.allCards().filter(function (c) {
        return !c.done && c.due && cols[c.col] && L.daysUntil(c.due) <= 21;
      }).sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.prio || 0) - (a.prio || 0); });
      var ul = $('#dueList');
      if (!list.length) { ul.innerHTML = '<li class="empty" style="display:block">Nothing due in the next three weeks.</li>'; return; }
      ul.innerHTML = list.slice(0, 12).map(function (c) {
        return '<li><span class="pdot" data-prio="' + (c.prio || 0) + '"></span>' +
          '<span class="t"><a href="/launch/task-list/#' + c.id + '" style="color:inherit;text-decoration:none">' + L.esc(c.title) + '</a><small>' + L.esc(cols[c.col]) + (c.next ? ' · ' + L.esc(c.next.split('\n')[0]) : '') + '</small></span>' +
          '<span class="d ' + L.dueClass(c.due) + '">' + L.esc(L.fmtDue(c.due)) + '<br>' + L.esc(L.relDue(c.due)) + '</span></li>';
      }).join('');
    }
    paintDue();

    S.on(function () {
      var s = S.doc.settings || {};
      paintAgenda(s);
      $('#musicTab').href = musicUrl();
      var iu = s.islandUrl || '/pleasure-island-experiment/', f = $('#islandSlot iframe');
      if (f && f.getAttribute('src') !== iu) { f.src = iu; $('#islandOpen').href = iu; }
      paintDue();
    });
  });
})();
