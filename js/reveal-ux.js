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
  // Read before Reveal starts: its scroll view rewrites the hash while images load.
  const initialHash = typeof location !== 'undefined' ? location.hash : '';
  // No hash means the start: the browser may carry over a scroll offset from the tab's last page.
  const initialAt = (function (m) { return { h: +m[1], v: +(m[2] || 0) }; })(/^#\/(\d+)(?:\/(\d+))?/.exec(initialHash) || [null, 0, 0]);

  function RevealUX(options) {
    this.opts = Object.assign({
      overviewGuide: true,
      wheelNavigate: true,        // mouse-wheel moves to prev/next slide (normal + overview)
      wheelThrottleMs: 80,        // min gap between wheel-driven moves (tames momentum scroll)
      overviewWheelPxPerSlide: 110, // overview: wheel distance maps to slides, no throttle, so a free-spin wheel flies
      wheelMinDelta: 6,           // ignore tiny trackpad jitter
      scrollViewFragments: false, // phones read, not present: show all fragments in Reveal's scroll view
      scrollViewLayout: 'compact', // scroll view stacks slides at their own height, several per screen ('full' = Reveal's one per screen)
      scrollViewPortrait: false,  // also use the scroll view whenever the window is taller than wide (tablets, rotated screens)
      scrollViewBorder: false,    // scroll view: frame each slide as a card so stacked slides read apart
      scrollViewSlideNumber: false, // scroll view: show "n / total" in each slide's corner (Reveal hides its own there)
      instantHash: true,          // write #/h/v/f on every move (Reveal throttles its own write to 1/s)
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
        ['Scroll', 'Browse slides (spin fast to fly)'],
        ['Click', 'Jump to a slide (or an agenda item)'],
        ['G + 12', 'Go to slide number'],
        ['F', 'Fullscreen'],
        ['S', 'Speaker notes'],
        ['Q', 'Toggle the QR slide link'],
      ],
    }, options || {});
    this._lastWheel = 0;
    this._wheelAcc = 0;
  }

  RevealUX.prototype.init = function () {
    if (typeof window === 'undefined' || !window.Reveal) { console.warn('[reveal-ux] Reveal not found'); return; }
    if (this.opts.overviewGuide || this.opts.qrToggleKey) this._injectBaseStyle();
    if (this.opts.overviewGuide) this._buildGuide();
    if (this.opts.wheelNavigate) this._bindWheelNavigate();
    const c = window.Reveal.getConfig();
    this._authored = { hash: !!c.hash, scrollLayout: c.scrollLayout, scrollSnap: c.scrollSnap };
    if (this.opts.instantHash) this._bindInstantHash();
    if (c.view === 'presentation') {
      // ?view=presentation: slide mode at any size. 0, not null: null makes Reveal skip its
      // check and leaves a phone in the scroll view it already entered at load.
      c.scrollActivationWidth = 0;
      window.Reveal.layout();
      window.Reveal.slide(initialAt.h, initialAt.v); // leaving the scroll view loses the deep link
    } else if (this.opts.scrollViewPortrait) this._scrollViewWhenPortrait(c.scrollActivationWidth);
    this._adaptToScrollView();
    this._keepScrollViewDeepLink();
    if (this.opts.scrollViewBorder || this.opts.scrollViewSlideNumber) this._decorateScrollView();
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
      if (self._isScrollView()) return; // Reveal's scroll view (phones): let the page scroll natively
      if (self._scrollableAncestorCanScroll(ev.target, ev.deltaY)) return;
      if (Math.abs(ev.deltaY) < self.opts.wheelMinDelta) return;
      ev.preventDefault();
      // Overview: distance, not ticks. Accumulate pixels and move as many whole
      // slides as the wheel travelled, so a free-spin wheel crosses the deck in one flick.
      if (window.Reveal.isOverview && window.Reveal.isOverview()) {
        const px = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaMode === 2 ? ev.deltaY * 800 : ev.deltaY;
        self._wheelAcc += px;
        const n = Math.trunc(self._wheelAcc / self.opts.overviewWheelPxPerSlide);
        if (n !== 0) {
          self._wheelAcc -= n * self.opts.overviewWheelPxPerSlide;
          window.Reveal.slide(Math.max(0, window.Reveal.getIndices().h + n), 0);
        }
        return;
      }
      // Presenting: one step per move, throttled so momentum scroll does not skip ahead.
      const now = (window.performance && performance.now) ? performance.now() : +new Date();
      if (now - self._lastWheel < self.opts.wheelThrottleMs) return;
      self._lastWheel = now;
      if (ev.deltaY > 0) window.Reveal.next(); else window.Reveal.prev();
    }, { passive: false });
    if (window.Reveal.addEventListener) window.Reveal.addEventListener('overviewshown', function () { self._wheelAcc = 0; });
  };

  RevealUX.prototype._isScrollView = function () {
    return !!(window.Reveal.isScrollView && window.Reveal.isScrollView());
  };

  // Scroll view: the slide a reader is on is the top one on screen (the first page
  // whose middle is still below the top edge). Reveal's own pick follows scroll
  // progress through the whole deck and drifts once several slides share a screen.
  RevealUX.prototype._topIndices = function () {
    const pages = document.querySelectorAll('.reveal .scroll-page');
    let page = null;
    for (let k = 0; k < pages.length && !page; k++) {
      const r = pages[k].getBoundingClientRect();
      if (r.top + r.height / 2 > 0) page = pages[k];
    }
    const slide = page && window.Reveal.getSlides().find(function (s) { return s.closest('.scroll-page') === page; });
    return slide ? window.Reveal.getIndices(slide) : window.Reveal.getIndices();
  };

  RevealUX.prototype._goTo = function (i) {
    if (!this._isScrollView()) { window.Reveal.slide(i.h, i.v || 0); return; }
    // getSlide() finds nothing in scroll view (slides are re-wrapped), so match indices.
    const slide = window.Reveal.getSlides().find(function (s) {
      const j = window.Reveal.getIndices(s);
      return j.h === i.h && (j.v || 0) === (i.v || 0);
    });
    const page = slide && slide.closest('.scroll-page');
    if (page) page.scrollIntoView();
  };

  // Reveal 5.1's scroll view jumps to #/h/v before images load, so the layout
  // shift leaves a deep link on an earlier slide. Jump again once all is loaded.
  // Named links (#/some-id) are left to Reveal.
  RevealUX.prototype._keepScrollViewDeepLink = function () {
    const self = this;
    function jump() { if (self._isScrollView()) self._goTo(initialAt); }
    // setTimeout: on 'ready' Reveal has not finished laying out the scroll pages yet.
    if (document.readyState === 'complete') setTimeout(jump, 0); else window.addEventListener('load', function () { setTimeout(jump, 0); });
  };

  // Scroll view (phones) is for reading: several slides per screen without snapping,
  // every fragment shown, and instantHash owns the address (Reveal 5.1's delayed
  // write there blanks it). Crossing the width keeps the slide the reader was on.
  RevealUX.prototype._adaptToScrollView = function () {
    const self = this, a = this._authored;
    let adapted = false, resizing = false, at = window.Reveal.getIndices();
    // Remember the reader's slide as they go; at a switch the resize has already moved the layout.
    window.Reveal.on('slidechanged', function () { if (!resizing && !self._isScrollView()) at = window.Reveal.getIndices(); });
    document.addEventListener('scroll', function () { if (!resizing && self._isScrollView()) at = self._topIndices(); }, true);
    function sync() {
      const sv = self._isScrollView();
      requestAnimationFrame(function () { resizing = false; }); // after the scroll events this resize caused
      if (sv === adapted) { if (sv) self._goTo(at); return; } // a resize reflows the stacked slides too
      adapted = sv;
      // Rename rather than configure({fragments:false}): Reveal still reserves scroll space per .fragment.
      if (!self.opts.scrollViewFragments) {
        document.querySelectorAll(sv ? '.reveal .slides .fragment' : '.reveal .slides .rux-fragment').forEach(function (e) {
          e.classList.replace(sv ? 'fragment' : 'rux-fragment', sv ? 'rux-fragment' : 'fragment');
        });
      }
      const compact = sv && self.opts.scrollViewLayout === 'compact';
      window.Reveal.configure({
        hash: a.hash && !(sv && self.opts.instantHash),
        scrollLayout: sv && self.opts.scrollViewLayout ? self.opts.scrollViewLayout : a.scrollLayout,
        scrollSnap: compact ? false : a.scrollSnap,
      });
      self._goTo(at);
    }
    sync();
    // A rotated phone or resized window can cross scrollActivationWidth; wait a tick for Reveal to switch views.
    window.addEventListener('resize', function () { resizing = true; setTimeout(sync, 0); });
  };

  // Reveal picks its scroll view by width alone; lifting the threshold while portrait
  // hands the switch to it, and _adaptToScrollView's resize hook does the rest.
  RevealUX.prototype._scrollViewWhenPortrait = function (authoredWidth) {
    if (typeof authoredWidth !== 'number') return; // scrollActivationWidth: null means never scroll view
    const mq = window.matchMedia('(orientation: portrait)');
    // Set the live config and re-layout, the path a phone-width resize takes: switching
    // views inside configure() lets Reveal write a stale hash (#/1/0/0) over the reader's slide.
    function apply() { window.Reveal.getConfig().scrollActivationWidth = mq.matches ? Infinity : authoredWidth; window.Reveal.layout(); }
    apply();
    mq.addEventListener('change', apply);
  };

  RevealUX.prototype._bindInstantHash = function () {
    const self = this;
    function write(i) {
      if (!self._authored.hash) return;
      const f = i.f === undefined ? -1 : i.f;
      const h = '#/' + i.h + (i.v > 0 || f >= 0 ? '/' + i.v : '') + (f >= 0 ? '/' + f : '');
      if (location.hash === h) return;
      // Safari throws once a page exceeds ~100 replaceState calls per 10 s; the next move writes again.
      try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) {}
    }
    ['slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function (ev) {
      window.Reveal.on(ev, function () { if (!self._isScrollView()) write(window.Reveal.getIndices()); });
    });
    let queued = false;
    // Scroll events don't bubble; capture catches the scroll view's container.
    document.addEventListener('scroll', function () {
      if (queued || !self._isScrollView()) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; const i = self._topIndices(); write({ h: i.h, v: i.v }); });
    }, true);
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

  // CSS only, drawn over each page without changing its size, so Reveal's scroll
  // positions and _topIndices stay exact. Each slide is one .scroll-page, in deck order.
  RevealUX.prototype._decorateScrollView = function () {
    const root = document.querySelector('.reveal');
    if (!root) return;
    if (this.opts.scrollViewBorder) root.classList.add('rux-sv-border');
    if (this.opts.scrollViewSlideNumber) {
      root.classList.add('rux-sv-number');
      root.style.setProperty('--rux-total', '"' + window.Reveal.getTotalSlides() + '"');
    }
    if (document.getElementById('reveal-ux-sv-style')) return;
    const style = document.createElement('style');
    style.id = 'reveal-ux-sv-style';
    style.textContent = [
      '.reveal-scroll .reveal.rux-sv-border .scroll-page-content::after{content:"";position:absolute;inset:6px;z-index:20;pointer-events:none;',
      'border:1px solid #c5ccd6;border-radius:10px;box-shadow:0 0 0 6px #eef1f5;}',
      '.reveal-scroll .reveal.rux-sv-number{counter-reset:rux-sn;}',
      '.reveal-scroll .reveal.rux-sv-number .scroll-page{counter-increment:rux-sn;}',
      '.reveal-scroll .reveal.rux-sv-number .scroll-page-content::before{content:counter(rux-sn) " / " var(--rux-total);',
      'position:absolute;right:16px;bottom:14px;z-index:21;pointer-events:none;padding:2px 8px;border-radius:6px;',
      'background:rgba(31,41,51,.72);color:#fff;font:600 13px/1.4 Inter,Segoe UI,Arial,sans-serif;font-variant-numeric:tabular-nums;}',
    ].join('');
    document.head.insertBefore(style, document.head.firstChild); // first, so a deck's own CSS wins
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
      '.reveal-scroll .reveal-ux-page-info{display:none;}',
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
