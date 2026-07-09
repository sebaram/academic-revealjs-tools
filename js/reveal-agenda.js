/* reveal-agenda.js — build a clickable table-of-contents / agenda slide from
   sections tagged with data-toc="Label". No dependencies. Follows the same
   house conventions as reveal-bibtex.js / reveal-qr.js (class + options object,
   exposed on window). Reusable in any Reveal deck. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;             // Node: { RevealAgenda }
  }
  if (typeof window !== 'undefined') {
    window.RevealAgenda = api;        // Browser: window.RevealAgenda.RevealAgenda
  }
})(this, function () {
  'use strict';

  function RevealAgenda(options) {
    this.opts = Object.assign({
      sectionSelector: 'section[data-toc]',   // slides that start a part
      agendaSelector: '[data-agenda]',         // container to fill on the agenda slide
      markerAttr: 'data-toc',                  // attribute holding the part label
      numbered: true,                          // show 1..N badges
    }, options || {});
  }

  // Horizontal index of a top-level slide (this deck has no vertical stacks).
  RevealAgenda.prototype._indexOf = function (section) {
    const tops = Array.prototype.slice.call(document.querySelectorAll('.reveal .slides > section'));
    return tops.indexOf(section);
  };

  RevealAgenda.prototype.render = function () {
    const self = this;
    const container = document.querySelector(this.opts.agendaSelector);
    if (!container) { console.warn('[reveal-agenda] no ' + this.opts.agendaSelector + ' container found'); return; }
    const sections = Array.prototype.slice.call(document.querySelectorAll(this.opts.sectionSelector));
    if (!sections.length) { console.warn('[reveal-agenda] no ' + this.opts.sectionSelector + ' sections found'); return; }

    const ol = document.createElement(this.opts.numbered ? 'ol' : 'ul');
    ol.className = 'agenda-list';
    // Reset list markers inline (with !important) so the manual number badges
    // are the only numbering, regardless of the host theme's list styling.
    ol.style.setProperty('list-style', 'none', 'important');

    sections.forEach(function (sec, i) {
      const h2 = sec.querySelector('h2');
      const label = sec.getAttribute(self.opts.markerAttr) || (h2 ? h2.textContent.trim() : 'Section ' + (i + 1));

      const li = document.createElement('li');
      li.style.setProperty('list-style', 'none', 'important');
      const a = document.createElement('a');
      a.className = 'agenda-item';
      // Static href keeps it working even without JS navigation; the click
      // handler recomputes the live index so reordering can't stale the link.
      a.setAttribute('href', '#/' + self._indexOf(sec));
      if (self.opts.numbered) {
        const num = document.createElement('span');
        num.className = 'agenda-num';
        num.textContent = i + 1;
        a.appendChild(num);
      }
      const text = document.createElement('span');
      text.className = 'agenda-label';
      text.textContent = label;
      a.appendChild(text);

      a.addEventListener('click', function (ev) {
        if (typeof window !== 'undefined' && window.Reveal && typeof window.Reveal.slide === 'function') {
          ev.preventDefault();
          const idx = self._indexOf(sec);
          if (idx >= 0) window.Reveal.slide(idx);
        }
      });

      li.appendChild(a);
      ol.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(ol);
    container.setAttribute('data-agenda-count', String(sections.length));
  };

  return { RevealAgenda };
});
