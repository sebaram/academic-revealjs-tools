/* reveal-bibtex.js — self-contained BibTeX parser, citation styles, and
   Reveal.js adapter. No dependencies. Loads in the browser and in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node: { BibtexParser, BibtexStyles, RevealBibtex }
  }
  if (typeof window !== 'undefined') {
    window.RevealBibtex = api;       // Browser: window.RevealBibtex.RevealBibtex, etc.
  }
})(this, function () {
  'use strict';

  // Each accent regex allows an optional outer '{' ... '}' wrap AND an optional
  // inner '{' ... '}' around just the letter, e.g. \"o, {\"o}, \"{o}, {\"{o}}
  // all normalize the same way. These MUST run (they do, via the loop below)
  // before the generic '~' -> ' ' (NBSP) replacement, or a bare \~n gets its
  // tilde eaten by that generic rule and left with a dangling backslash.
  const LATEX_ACCENTS = [
    [/\{?\\"\{?([aouAOUeiEIsy])\}?\}?/g, (m, c) => ({ a:'ä',o:'ö',u:'ü',A:'Ä',O:'Ö',U:'Ü',e:'ë',i:'ï',E:'Ë',I:'Ï',s:'ß',y:'ÿ' }[c])],
    [/\{?\\'\{?([aeiouAEIOUnyc])\}?\}?/g, (m, c) => ({ a:'á',e:'é',i:'í',o:'ó',u:'ú',A:'Á',E:'É',I:'Í',O:'Ó',U:'Ú',n:'ń',y:'ý',c:'ć' }[c])],
    [/\{?\\`\{?([aeiouAEIOU])\}?\}?/g,   (m, c) => ({ a:'à',e:'è',i:'ì',o:'ò',u:'ù',A:'À',E:'È',I:'Ì',O:'Ò',U:'Ù' }[c])],
    [/\{?\\~\{?([naoNAO])\}?\}?/g,       (m, c) => ({ n:'ñ',a:'ã',o:'õ',N:'Ñ',A:'Ã',O:'Õ' }[c])],
    [/\{?\\c\s?\{?([cC])\}?\}?/g,        (m, c) => ({ c:'ç',C:'Ç' }[c])],
    [/\\ss(\{\})?/g, 'ß'],
  ];

  const BibtexParser = {
    parse(text) {
      const strings = {};
      const entries = [];
      let i = 0;
      const n = text.length;
      const isIdChar = (c) => /[A-Za-z0-9_+:\-.\/]/.test(c);

      const skipWs = () => {
        while (i < n) {
          const c = text[i];
          if (c === '%') { while (i < n && text[i] !== '\n') i++; }
          else if (/\s/.test(c)) i++;
          else break;
        }
      };
      const readIdent = () => {
        let s = i;
        while (i < n && isIdChar(text[i])) i++;
        return text.slice(s, i);
      };
      const readBraced = () => {           // assumes text[i] === '{'
        let depth = 0, s = i;
        for (; i < n; i++) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') { depth--; if (depth === 0) { i++; return text.slice(s + 1, i - 1); } }
        }
        return text.slice(s + 1);
      };
      while (i < n) {
        skipWs();
        if (text[i] !== '@') { i++; continue; }
        i++;                                // consume '@'
        const type = readIdent().toLowerCase();
        skipWs();
        if (text[i] !== '{') continue;
        const body = readBraced();          // whole {...} of the entry; re-parse below
        if (type === 'comment') continue;

        // Re-scan the captured body with a fresh cursor.
        const inner = body;
        let j = 0;
        const m = inner.length;
        const iskip = () => { while (j < m && (/\s/.test(inner[j]) || inner[j] === '%')) { if (inner[j] === '%') { while (j < m && inner[j] !== '\n') j++; } else j++; } };
        const iident = () => { let s = j; while (j < m && /[A-Za-z0-9_+:\-.\/]/.test(inner[j])) j++; return inner.slice(s, j); };

        if (type === 'string') {
          iskip(); const name = iident(); iskip();
          if (inner[j] === '=') { j++; iskip(); strings[name] = readInnerValue(inner, () => j, (v) => { j = v; }, strings); }
          continue;
        }

        iskip();
        const key = iident();
        const fields = {};
        iskip();
        while (j < m) {
          if (inner[j] === ',') { j++; iskip(); continue; }
          const fname = iident().toLowerCase();
          iskip();
          if (inner[j] !== '=') { break; }
          j++; iskip();
          const res = parseInnerValue(inner, j, strings);
          fields[fname] = res.value;
          j = res.next;
          iskip();
        }
        entries.push({ type, key, fields });
      }
      return entries;
    },
    decodeLatex(str) {
      if (!str) return '';
      let out = str;
      for (const [re, rep] of LATEX_ACCENTS) out = out.replace(re, rep);
      out = out.replace(/---/g, '—').replace(/--/g, '–').replace(/~/g, ' ');
      out = out.replace(/\\&/g, '&').replace(/\\%/g, '%').replace(/\\_/g, '_').replace(/\\#/g, '#');
      out = out.replace(/[{}]/g, '');
      return out;
    },
    parseAuthors(str) {
      if (!str) return [];
      return str.split(/\s+and\s+/i).map((raw) => {
        const name = this.decodeLatex(raw.trim());
        if (name.includes(',')) {
          const [family, given] = name.split(',');
          return { family: family.trim(), given: (given || '').trim() };
        }
        const parts = name.split(/\s+/);
        const family = parts.pop() || '';
        return { family, given: parts.join(' ') };
      });
    },
  };

  // Value reader used inside an entry/@string body (brace/quote/abbrev + '#').
  function parseInnerValue(s, start, strings) {
    let j = start, out = '';
    const readToken = () => {
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === '{') {
        let depth = 0, st = j;
        for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (!depth) { j++; return s.slice(st + 1, j - 1); } } }
        return s.slice(st + 1);
      }
      if (s[j] === '"') {
        let st = ++j, depth = 0;
        for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; else if (s[j] === '"' && !depth) { const v = s.slice(st, j); j++; return v; } }
        return s.slice(st);
      }
      let st = j; while (j < s.length && /[A-Za-z0-9_+:\-.\/]/.test(s[j])) j++;
      const id = s.slice(st, j);
      return (id in strings) ? strings[id] : id;
    };
    out = readToken();
    while (j < s.length && /\s/.test(s[j])) j++;
    while (s[j] === '#') { j++; out += readToken(); while (j < s.length && /\s/.test(s[j])) j++; }
    return { value: out, next: j };
  }
  function readInnerValue(s, getJ, setJ, strings) {
    const res = parseInnerValue(s, getJ(), strings);
    setJ(res.next);
    return res.value;
  }

  const BibtexStyles = {
    _styles: {},
    register(name, style) { this._styles[name] = style; return this; },
    get(name) { return this._styles[name]; },
    has(name) { return name in this._styles; },
    names() { return Object.keys(this._styles); },
  };

  const _d = (s) => BibtexParser.decodeLatex(s || '');
  const _initial = (p) => p[0].toUpperCase() + '.';
  const _initials = (given) => given.trim().split(/\s+/).filter(Boolean)
    .map(word => word.split('-').filter(Boolean).map(_initial).join('-'))
    .join(' ');
  const _link = (fields) => {
    const url = fields.doi ? 'https://doi.org/' + fields.doi : (fields.url || '');
    return url ? { url, text: url } : null;
  };
  const _esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  BibtexStyles.register('apa', {
    numbered: false,
    inText(e) {
      const a = e.authors, y = _d(e.fields.year);
      let names;
      if (a.length === 0) names = _esc(_d(e.fields.title).split(/\s+/).slice(0, 2).join(' '));
      else if (a.length === 1) names = _esc(a[0].family);
      else if (a.length === 2) names = _esc(a[0].family) + ' & ' + _esc(a[1].family);
      else names = _esc(a[0].family) + ' et al.';
      return '<span class="cite-intext">(' + names + ', ' + _esc(y) + ')</span>';
    },
    bibEntry(e) {
      const a = e.authors.map(x => _esc(x.family) + ', ' + _esc(_initials(x.given)));
      let authorStr = a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ', &amp; ' + a[a.length - 1];
      const y = _esc(_d(e.fields.year));
      const title = _esc(_d(e.fields.title));
      const venue = _esc(_d(e.fields.journal || e.fields.booktitle || e.fields.publisher || ''));
      const vol = e.fields.volume ? ', <em>' + _esc(_d(e.fields.volume)) + '</em>' + (e.fields.number ? '(' + _esc(_d(e.fields.number)) + ')' : '') : '';
      const pages = e.fields.pages ? ', ' + _esc(_d(e.fields.pages)) : '';
      const link = _link(e.fields);
      const linkHtml = link ? ' <a href="' + _esc(link.url) + '">' + _esc(link.text) + '</a>' : '';
      const authorPrefix = authorStr ? authorStr + ' ' : '';
      return '<p>' + authorPrefix + '(' + y + '). ' + title + '. <em>' + venue + '</em>' + vol + pages + '.' + linkHtml + '</p>';
    },
    sort(entries) {
      return entries.slice().sort((x, y) => {
        const fx = (x.authors[0] && x.authors[0].family || '').toLowerCase();
        const fy = (y.authors[0] && y.authors[0].family || '').toLowerCase();
        return fx < fy ? -1 : fx > fy ? 1 : 0;
      });
    },
  });

  const _ieeeName = (a) => _esc(_initials(a.given)).replace(/\s+/g, ' ') .trim() + ' ' + _esc(a.family);
  const _q = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  BibtexStyles.register('ieee', {
    numbered: true,
    inText(e, n) { return '<span class="cite-intext">[' + n + ']</span>'; },
    bibEntry(e, n) {
      const a = e.authors;
      let authorStr;
      if (a.length === 0) authorStr = '';
      else if (a.length <= 2) authorStr = a.map(_ieeeName).join(', ');
      else authorStr = _ieeeName(a[0]) + ' et al.';
      const title = _q(_d(e.fields.title));
      const venue = _esc(_d(e.fields.journal || e.fields.booktitle || e.fields.publisher || ''));
      const y = _esc(_d(e.fields.year));
      const link = _link(e.fields);
      const linkHtml = link ? ' <a href="' + _q(link.url) + '">' + _esc(link.text) + '</a>' : '';
      const authorPrefix = authorStr ? authorStr + ', ' : '';
      return '<p>[' + n + '] ' + authorPrefix + '&quot;' + title + ',&quot; <em>' + venue + '</em>, ' + y + '.' + linkHtml + '</p>';
    },
    sort(entries) { return entries.slice(); },
  });
  function RevealBibtex(options) {
    this.opts = Object.assign({
      bibtex: '#refs',
      style: 'apa',
      sourceSelector: '.source[data-cite]',
      sourceMode: 'intext',   // 'intext' -> (Author, year)/[n]; 'full' -> full formatted reference
      bibliographySelector: '[data-bibliography]',
      perPage: 0,
    }, options || {});
    this.entries = {};      // key -> { type, key, fields, authors }
    this.order = [];        // cite keys in first-seen order
    this._num = {};         // key -> assigned number
  }

  RevealBibtex.prototype.load = function () {
    const self = this;
    const readText = function () {
      const sel = self.opts.bibtex;
      const el = document.querySelector(sel);
      if (el && (el.type === 'application/x-bibtex' || el.tagName === 'SCRIPT')) {
        return Promise.resolve(el.textContent);
      }
      return fetch(sel).then(function (r) { return r.text(); });
    };
    return readText().then(function (text) {
      BibtexParser.parse(text).forEach(function (e) {
        e.authors = BibtexParser.parseAuthors(e.fields.author || '');
        self.entries[e.key] = e;
      });
      return true;
    }).catch(function (err) {
      console.error('[reveal-bibtex] failed to load BibTeX:', err);
      return false;
    });
  };

  RevealBibtex.prototype._numberOf = function (key) {
    if (!(key in this._num)) { this.order.push(key); this._num[key] = this.order.length; }
    return this._num[key];
  };

  RevealBibtex.prototype.render = function () {
    const self = this;
    const style = BibtexStyles.get(this.opts.style) || BibtexStyles.get('apa');

    // Reset numbering each render so a setStyle() re-render is stable.
    this.order = []; this._num = {};

    // 0) Drop any overflow sections generated by a previous render() so
    // re-rendering (e.g. via setStyle()) is idempotent and never accumulates
    // duplicate slides.
    document.querySelectorAll('section[data-bibtex-generated]').forEach(function (s) { s.remove(); });

    // 1) Source footers. Each footer renders either the short in-text citation
    // or the full formatted reference, chosen per-element via data-cite-mode or
    // globally via opts.sourceMode ('intext' | 'full').
    document.querySelectorAll(this.opts.sourceSelector).forEach(function (el) {
      const keys = el.getAttribute('data-cite').split(/[,\s]+/).filter(Boolean);
      const mode = el.getAttribute('data-cite-mode') || self.opts.sourceMode;
      const full = mode === 'full';
      el.innerHTML = keys.map(function (key) {
        const e = self.entries[key];
        if (!e) { console.warn('[reveal-bibtex] unknown key:', key); return '<span class="cite-missing">[?' + key + ']</span>'; }
        const num = self._numberOf(key);
        return full ? style.bibEntry(e, num) : style.inText(e, num);
      }).join(full ? '' : ' ');
      el.setAttribute('data-cite-rendered', full ? 'full' : 'intext');
    });

    // 2) Bibliography container(s). After step 0, every container matched
    // here is a "primary" container (none live inside a generated section).
    let paginated = false;
    document.querySelectorAll(this.opts.bibliographySelector).forEach(function (box) {
      const cited = self.order.length ? self.order.map(function (k) { return self.entries[k]; }).filter(Boolean)
                                      : Object.keys(self.entries).map(function (k) { return self.entries[k]; });
      const sorted = style.sort(cited);
      const perPage = self.opts.perPage || parseInt(box.getAttribute('data-per-page'), 10) || 0;

      const fill = function (target, chunk, startIdx) {
        target.innerHTML = chunk.map(function (e, i) { return style.bibEntry(e, self._num[e.key] || startIdx + i + 1); }).join('');
        target.setAttribute('data-style', self.opts.style);
      };

      // The primary <h2> persists across renders (only cloned sections get
      // removed in step 0), so any "(k/n)" suffix a previous render added is
      // still sitting on it. Strip it before recomputing, or repeated
      // render()/setStyle() calls would keep appending suffixes forever.
      const primarySection = box.closest('section');
      const heading = primarySection ? primarySection.querySelector('h2') : null;
      const baseTitle = heading ? heading.textContent.replace(/\s*\(\d+\/\d+\)\s*$/, '') : null;

      if (perPage <= 0 || sorted.length <= perPage) {
        fill(box, sorted, 0);
        if (heading && baseTitle !== null) heading.textContent = baseTitle;
      } else {
        paginated = true;
        const chunks = [];
        for (let i = 0; i < sorted.length; i += perPage) chunks.push(sorted.slice(i, i + perPage));
        const total = chunks.length;

        fill(box, chunks[0], 0);
        if (heading && baseTitle !== null) heading.textContent = baseTitle + ' (1/' + total + ')';

        let prevSection = primarySection;
        for (let k = 1; k < total; k++) {
          if (!prevSection) break; // no section to clone from; skip pagination for this container
          const clone = prevSection.cloneNode(true);
          clone.setAttribute('data-bibtex-generated', '');
          const cloneBox = clone.querySelector(self.opts.bibliographySelector);
          if (cloneBox) fill(cloneBox, chunks[k], k * perPage);
          const cloneHeading = clone.querySelector('h2');
          if (cloneHeading && baseTitle !== null) cloneHeading.textContent = baseTitle + ' (' + (k + 1) + '/' + total + ')';
          prevSection.parentNode.insertBefore(clone, prevSection.nextSibling);
          prevSection = clone;
        }
      }
    });
    if (typeof document !== 'undefined' && document.body) document.body.setAttribute('data-cite-style', this.opts.style);
    if (paginated && typeof window !== 'undefined' && window.Reveal && typeof window.Reveal.sync === 'function') {
      window.Reveal.sync();
    }
  };

  RevealBibtex.prototype.setStyle = function (name) {
    if (!BibtexStyles.has(name)) { console.warn('[reveal-bibtex] unknown style:', name); return; }
    this.opts.style = name;
    this.render();
  };

  return { BibtexParser, BibtexStyles, RevealBibtex };
});
