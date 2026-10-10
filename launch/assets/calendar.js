/* Calendar tab: Google Calendar week view. */
(function () {
  'use strict';
  var L = window.Launch, S = L.Store, $ = L.$;
  L.boot('calendar', function () {
    function paint() {
      var s = S.doc.settings || {}, slot = $('#calSlot');
      if (!s.calendars || !s.calendars.length) {
        slot.innerHTML = '<div class="panel-body"><p class="empty">Add your Google calendar in Settings (the gear, top right).</p></div>';
        return;
      }
      var src = L.calendarEmbed(s, 'WEEK'), f = slot.querySelector('iframe');
      if (f && f.getAttribute('src') === src) return;
      slot.innerHTML = '<iframe class="cal-frame" title="Google Calendar week view" src="' + L.esc(src) + '"></iframe>';
    }
    paint();
    S.on(paint);
  });
})();
