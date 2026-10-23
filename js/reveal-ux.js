/* reveal-ux.js — small presentation UX helpers for a Reveal deck, independent
   of any other plugin. No dependencies. House conventions: class + options
   object, exposed on window. Provides:
     - a guidance/controls card shown while the ESC overview is open
     - mouse-wheel browsing inside the overview (Reveal pans as selection moves)
     - a keyboard toggle for a QR/link element (works with reveal-qr.js)
     - optional click-to-jump behavior for Reveal's slide number
     - optional fixed top/bottom page information bar */
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
      clickableSlideNumber: false,
      slideNumberSelector: '.reveal .slide-number',
      slideNumberPrompt: 'Go to slide:',
      pageInfo: null,
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
    if (this.opts.overviewGuide || this.opts.qrToggleKey) this._injectBaseStyle();
    if (this.opts.overviewGuide) this._buildGuide();
    if (this.opts.wheelNavigate) this._bindWheelNavigate();
    if (this.opts.qrToggleKey) this._bindQrToggle();
    if (this.opts.clickableSlideNumber) this._bindClickableSlideNumber();
    if (this.opts.pageInfo) this._buildPageInfo();
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

  RevealUX.prototype._bindClickableSlideNumber = function () {
    const self = this;
    const el = document.querySelector(this.opts.slideNumberSelector);
    if (!el) { console.warn('[reveal-ux] no ' + this.opts.slideNumberSelector + ' element found'); return; }
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', this.opts.slideNumberPrompt);
    el.style.cursor = 'pointer';
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      self._promptForSlideNumber();
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      self._promptForSlideNumber();
    });
  };

  RevealUX.prototype._promptForSlideNumber = function () {
    const total = this._totalSlideCount();
    const current = this._currentSlideNumber();
    const raw = window.prompt(this.opts.slideNumberPrompt, String(current));
    if (raw === null) return;
    const target = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(target) || target < 1 || target > total) return;
    this._goToSlideNumber(target);
  };

  RevealUX.prototype._totalSlideCount = function () {
    if (window.Reveal.getSlides) return window.Reveal.getSlides().length;
    return window.Reveal.getTotalSlides ? window.Reveal.getTotalSlides() : 0;
  };

  RevealUX.prototype._currentSlideNumber = function () {
    if (window.Reveal.getSlidePastCount) return window.Reveal.getSlidePastCount() + 1;
    const indices = window.Reveal.getIndices ? window.Reveal.getIndices() : { h: 0 };
    return (indices.h || 0) + 1;
  };

  RevealUX.prototype._goToSlideNumber = function (slideNumber) {
    const targetIndex = slideNumber - 1;
    if (window.Reveal.getSlides && window.Reveal.getIndices) {
      const slide = window.Reveal.getSlides()[targetIndex];
      if (!slide) return;
      const indices = window.Reveal.getIndices(slide);
      window.Reveal.slide(indices.h || 0, indices.v || 0, indices.f || 0);
      return;
    }
    window.Reveal.slide(targetIndex);
  };

  RevealUX.prototype._buildPageInfo = function () {
    const cfg = Object.assign({
      position: 'bottom',
      left: '',
      center: '',
      right: '',
      injectStyle: true,
    }, this.opts.pageInfo || {});
    if (cfg.injectStyle) this._injectPageInfoStyle();

    const bar = document.createElement('div');
    bar.className = 'reveal-ux-page-info is-' + (cfg.position === 'top' ? 'top' : 'bottom');
    const slots = ['left', 'center', 'right'].map(function (name) {
      const el = document.createElement('div');
      el.className = 'rux-page-info-' + name;
      bar.appendChild(el);
      return { name, el };
    });
    document.body.appendChild(bar);
    this._pageInfo = { cfg, slots, bar };
    this._renderPageInfo();

    const self = this;
    if (window.Reveal.addEventListener) {
      window.Reveal.addEventListener('slidechanged', function () { self._renderPageInfo(); });
      window.Reveal.addEventListener('ready', function () { self._renderPageInfo(); });
    }
  };

  // Default look for the overview guide and the QR toggle. Inserted first in <head>
  // so a deck's own CSS for the same selectors wins.
  RevealUX.prototype._injectBaseStyle = function () {
    if (document.getElementById('reveal-ux-base-style')) return;
    const style = document.createElement('style');
    style.id = 'reveal-ux-base-style';
    style.textContent = [
      '.reveal-ux-guide{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:50;',
      'pointer-events:none;opacity:0;transition:opacity .2s;',
      'background:#fff;color:#1f2933;border:1px solid #d9dee7;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);',
      'padding:14px 20px;font:400 15px/1.35 Inter,Segoe UI,Arial,sans-serif;',
      'display:grid;grid-template-columns:repeat(2,auto);gap:6px 28px;}',
      '.reveal-ux-guide.is-visible{opacity:1;}',
      '.reveal-ux-guide .rux-guide-title{grid-column:1/-1;font-weight:700;margin-bottom:4px;}',
      '.reveal-ux-guide .rux-guide-row{display:flex;align-items:center;gap:10px;white-space:nowrap;}',
      '.reveal-ux-guide kbd{min-width:2.2em;text-align:center;padding:2px 7px;border:1px solid #c5ccd6;border-bottom-width:2px;',
      'border-radius:6px;background:#f4f6f9;font:600 13px/1.4 ui-monospace,Consolas,monospace;}',
      '@media (max-width:700px),(max-height:500px){.reveal-ux-guide{display:none;}}',
      '.rux-hidden{display:none !important;}',
    ].join('');
    document.head.insertBefore(style, document.head.firstChild);
  };

  RevealUX.prototype._injectPageInfoStyle = function () {
    if (document.getElementById && document.getElementById('reveal-ux-style')) return;
    const style = document.createElement('style');
    style.id = 'reveal-ux-style';
    style.textContent = [
      '.reveal-ux-page-info{',
      'position:fixed;left:60px;right:60px;z-index:30;',
      'display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);',
      'gap:18px;align-items:center;pointer-events:none;',
      'font:600 16px/1.2 Inter,Segoe UI,Arial,sans-serif;color:#526070;',
      '}',
      '.reveal-ux-page-info.is-top{top:18px;}',
      '.reveal-ux-page-info.is-bottom{bottom:18px;}',
      '.reveal-ux-page-info .rux-page-info-left{text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.reveal-ux-page-info .rux-page-info-center{text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.reveal-ux-page-info .rux-page-info-right{text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '@media (max-width:700px),(max-height:500px){',
      '.reveal-ux-page-info{left:10px;right:10px;gap:8px;font-size:10px;}',
      '.reveal-ux-page-info.is-top{top:6px;}',
      '.reveal-ux-page-info.is-bottom{bottom:6px;}',
      '}',
    ].join('');
    (document.head || document.body).appendChild(style);
  };

  RevealUX.prototype._renderPageInfo = function () {
    if (!this._pageInfo) return;
    const context = this._pageInfoContext();
    this._pageInfo.slots.forEach(function (slot) {
      const value = this._resolvePageInfoValue(this._pageInfo.cfg[slot.name], context);
      slot.el.textContent = value;
    }, this);
  };

  RevealUX.prototype._pageInfoContext = function () {
    const indices = window.Reveal.getIndices ? window.Reveal.getIndices() : { h: 0, v: 0, f: 0 };
    const total = this._totalSlideCount();
    const current = this._currentSlideNumber();
    return { Reveal: window.Reveal, indices, current, total };
  };

  RevealUX.prototype._resolvePageInfoValue = function (value, context) {
    if (typeof value === 'function') return String(value(context) || '');
    return String(value || '');
  };

  return { RevealUX };
});
