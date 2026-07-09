/* reveal-ux.js — small presentation UX helpers for a Reveal deck, independent
   of any other plugin. No dependencies. House conventions: class + options
   object, exposed on window. Provides:
     - a guidance/controls card shown while the ESC overview is open
     - mouse-wheel browsing inside the overview (Reveal pans as selection moves)
     - a keyboard toggle for a QR/link element (works with reveal-qr.js) */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.RevealUX = api;
})(this, function () {
  'use strict';

  function RevealUX(options) {
    this.opts = Object.assign({
      overviewGuide: true,
      wheelNavigate: true,        // mouse-wheel moves to prev/next slide (normal + overview)
      wheelThrottleMs: 280,       // min gap between wheel-driven moves (tames momentum scroll)
      wheelMinDelta: 6,           // ignore tiny trackpad jitter
      qrToggleKey: 'q',
      qrContainerId: 'qrcode',
      guideTitle: 'Overview — how to navigate',
      guideItems: [
        ['Esc', 'Open / close this overview'],
        ['← → ↑ ↓', 'Move between slides'],
        ['Scroll', 'Previous / next slide'],
        ['Click', 'Jump to a slide (or an agenda item)'],
        ['F', 'Fullscreen'],
        ['S', 'Speaker notes'],
        ['Q', 'Toggle the QR slide link'],
      ],
    }, options || {});
    this._lastWheel = 0;
  }

  RevealUX.prototype.init = function () {
    if (typeof window === 'undefined' || !window.Reveal) { console.warn('[reveal-ux] Reveal not found'); return; }
    if (this.opts.overviewGuide) this._buildGuide();
    if (this.opts.wheelNavigate) this._bindWheelNavigate();
    if (this.opts.qrToggleKey) this._bindQrToggle();
    return this;
  };

  RevealUX.prototype._buildGuide = function () {
    const g = document.createElement('div');
    g.className = 'reveal-ux-guide';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<div class="rux-guide-title">' + this.opts.guideTitle + '</div>' +
      this.opts.guideItems.map(function (it) {
        return '<div class="rux-guide-row"><kbd>' + it[0] + '</kbd><span>' + it[1] + '</span></div>';
      }).join('');
    document.body.appendChild(g);
    this._guide = g;
    window.Reveal.addEventListener('overviewshown', function () { g.classList.add('is-visible'); });
    window.Reveal.addEventListener('overviewhidden', function () { g.classList.remove('is-visible'); });
    // In case the deck loads already in overview.
    if (window.Reveal.isOverview && window.Reveal.isOverview()) g.classList.add('is-visible');
  };

  RevealUX.prototype._bindWheelNavigate = function () {
    const self = this;
    document.addEventListener('wheel', function (ev) {
      // Let a genuinely scrollable region (overflowing content) consume the
      // wheel first; only navigate when the slide itself can't scroll.
      if (self._scrollableAncestorCanScroll(ev.target, ev.deltaY)) return;
      if (Math.abs(ev.deltaY) < self.opts.wheelMinDelta) return;
      const now = (window.performance && performance.now) ? performance.now() : +new Date();
      if (now - self._lastWheel < self.opts.wheelThrottleMs) return;
      self._lastWheel = now;
      ev.preventDefault();
      if (ev.deltaY > 0) window.Reveal.next(); else window.Reveal.prev();
    }, { passive: false });
  };

  // Walk up from the wheel target; if an ancestor actually overflows and is not
  // yet at the scroll edge in the wheel's direction, let it scroll instead of
  // navigating. Keeps long/scrollable slides usable.
  RevealUX.prototype._scrollableAncestorCanScroll = function (node, deltaY) {
    while (node && node !== document.body && node.nodeType === 1) {
      if (node.scrollHeight - node.clientHeight > 2) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY)) {
          if (deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
          if (deltaY < 0 && node.scrollTop > 0) return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  };

  RevealUX.prototype._bindQrToggle = function () {
    const self = this;
    document.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (!ev.key || ev.key.toLowerCase() !== self.opts.qrToggleKey) return;
      const el = document.getElementById(self.opts.qrContainerId);
      if (el) el.classList.toggle('rux-hidden');
    });
  };

  return { RevealUX };
});
