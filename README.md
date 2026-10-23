# Academic Reveal.js Tools

Small browser helpers for academic Reveal.js slide decks.

This repository is intended to be public. Keep private talks, paper images,
PDFs, and unpublished slide content outside the published surface. In this
workspace, `slide/` is ignored by git and can stay private while the reusable
JavaScript files in `js/` are served from GitHub Pages or jsDelivr.

## Tools

| File | Purpose |
| --- | --- |
| `js/reveal-bibtex.js` | Parse inline or external BibTeX, render citation footers, and generate bibliography slides. |
| `js/reveal-agenda.js` | Build a clickable agenda/table of contents from slides marked with `data-toc`. |
| `js/reveal-qr.js` | Show a QR code for the current slide URL. |
| `js/reveal-ux.js` | Add overview guidance, wheel navigation, and a QR visibility keyboard toggle. |
| `css/juyoung-theme.css` | Default slide style (colours, type, tiles, cards, chips, part dividers) for 1920x1080 decks on the Reveal white theme. |

## CDN Usage

After enabling GitHub Pages for this repository, use the Pages URL directly:

```html
<link rel="stylesheet" href="https://sebaram.github.io/academic-revealjs-tools/css/juyoung-theme.css">
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-bibtex.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-agenda.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-qr.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-ux.js"></script>
```

For stable public decks, prefer jsDelivr with a git tag:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/css/juyoung-theme.css">
<script src="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/js/reveal-bibtex.js"></script>
<script src="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/js/reveal-agenda.js"></script>
<script src="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/js/reveal-qr.js"></script>
<script src="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/js/reveal-ux.js"></script>
```

Use `@main` only while developing because it can change under existing decks.

## Basic Reveal.js Setup

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/theme/white.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800;900&family=Noto+Sans+KR:wght@400;700&family=Source+Serif+4:ital,wght@0,400;1,400&display=swap">
<link rel="stylesheet" href="https://sebaram.github.io/academic-revealjs-tools/css/juyoung-theme.css">

<div id="qrcode"></div>
<div class="reveal">
  <div class="slides">
    <section>...</section>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/reveal.js@5/dist/reveal.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-bibtex.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-agenda.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-qr.js"></script>
<script src="https://sebaram.github.io/academic-revealjs-tools/js/reveal-ux.js"></script>
<script>
  Reveal.initialize({
    hash: true,
    width: 1920,
    height: 1080,
    margin: 0,
    center: false,
    slideNumber: "c/t"
  });
</script>
```

## Theme

`css/juyoung-theme.css` is a default slide style: navy/orange palette, Inter
type, and a small set of layout pieces. Load it after the Reveal white theme.
It assumes 1920x1080 slides with `margin: 0` and `center: false`, and the
Google Fonts link shown above (Source Serif 4 is only used by `.quote`).

| Class | Use |
| --- | --- |
| `.kicker` | Small italic line above a slide title. |
| `.hl`, `.muted`, `.good-t`, `.bad-t` | Accent, grey, green and red text. |
| `.big`, `.small`, `.tiny`, `.center` | Text size and alignment. |
| `.cols`, `.cols-3`, `.cols-4` | 2, 3 or 4 column grids. |
| `.card`, `.tile` (`.o`, `.x`), `.tiles-sm`, `.tall` | Panels and icon tiles (`.o` orange icon, `.x` crossed out). |
| `.chips` + `.chip` (`.o`) | Pill labels. |
| `.fig`, `.cap`, `.source` | Figure, caption, citation footer (pairs with `data-cite`). |
| `section.title-slide`, `section.part` | Title slide and part divider (`.num`, `h2`, `p`). |
| `table.cmp`, `.flow`, `.steps`/`.step` | Comparison table, tile flow with arrows, numbered step list. |
| `.quote`, `.quote-by`, `.widget`, `.btn` | Pull quote and interactive widget box. |

Colours are CSS variables on `:root` (`--navy`, `--accent`, `--ink`, `--muted`,
`--line`, `--soft`, `--good`, `--bad`, `--slate`); override them in the deck to
re-tint everything. Keep layouts used by only one deck in that deck's `<style>`.

Example slide:

```html
<section>
  <div class="kicker">1 · What to evaluate</div>
  <h2>Three kinds of evaluation</h2>
  <div class="cols-3">
    <div class="tile o"><i data-lucide="cpu"></i><b>System</b><span>Does it work?</span></div>
    <div class="tile o"><i data-lucide="timer"></i><b>User</b><span>Can people use it?</span></div>
    <div class="tile"><i data-lucide="message-circle"></i><b>Subjective</b><span>Do people want it?</span></div>
  </div>
  <div class="source" data-cite="lee2024whirling"></div>
</section>
```

Icons in the examples are [Lucide](https://lucide.dev); call `lucide.createIcons()` after loading it.

## BibTeX Citations

Add BibTeX inside the deck:

```html
<script type="application/x-bibtex" id="refs">
@article{doe2026,
  author = {Doe, Jane and Lee, Juyoung},
  title = {A Useful Academic Slide Tool},
  journal = {Example Journal},
  year = {2026},
  doi = {10.0000/example}
}
</script>
```

<details>
<summary>Use a separate <code>.bib</code> file instead</summary>

You can keep references in a file such as:

```text
slide/
  index.html
  assets/
    references.bib
```

Then point `bibtex` to that file:

```html
<script>
  Reveal.addEventListener("ready", function () {
    window.bib = new window.RevealBibtex.RevealBibtex({
      bibtex: "assets/references.bib",
      style: "apa",
      sourceMode: "full",
      perPage: 7
    });
    window.bib.load().then(function (ok) {
      if (ok) window.bib.render();
    });
  });
</script>
```

Use a same-site path when possible. If the `.bib` file is hosted on another
domain, that server must allow browser access with CORS headers.

</details>

Add citation placeholders:

```html
<section>
  <h2>Key Result</h2>
  <p>The result appears here.</p>
  <div class="source" data-cite="doe2026"></div>
</section>

<section>
  <h2>References</h2>
  <div class="references" data-bibliography></div>
</section>
```

Initialize after Reveal is ready:

```html
<script>
  Reveal.addEventListener("ready", function () {
    window.bib = new window.RevealBibtex.RevealBibtex({
      bibtex: "#refs",
      style: "apa",
      sourceMode: "full",
      perPage: 7
    });
    window.bib.load().then(function (ok) {
      if (ok) window.bib.render();
    });
  });
</script>
```

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `bibtex` | `"#refs"` | CSS selector for inline BibTeX, or a URL to a `.bib` file. |
| `style` | `"apa"` | Citation style. Supported values: `"apa"`, `"ieee"`. |
| `sourceSelector` | `".source[data-cite]"` | Elements that render slide citations. |
| `sourceMode` | `"intext"` | `"intext"` for compact citations, `"full"` for full references in footers. |
| `bibliographySelector` | `"[data-bibliography]"` | Container for generated references. |
| `perPage` | `0` | Split bibliography into generated slides after this many entries. `0` disables pagination. |

Per-source override:

```html
<div class="source" data-cite="doe2026" data-cite-mode="intext"></div>
```

## Agenda

Mark section-start slides:

```html
<section data-toc="Background">
  <h2>Why this problem matters</h2>
</section>
```

Add an agenda container:

```html
<section>
  <h2>Agenda</h2>
  <div data-agenda></div>
</section>
```

Initialize:

```html
<script>
  Reveal.addEventListener("ready", function () {
    window.agenda = new window.RevealAgenda.RevealAgenda();
    window.agenda.render();
  });
</script>
```

## QR Code

Add a container:

```html
<div id="qrcode"></div>
```

Initialize:

```html
<script>
  Reveal.addEventListener("ready", function () {
    window.qr = new RevealQR({
      hideSlides: [0],
      showPrintButton: false
    });
  });
</script>
```

`reveal-qr.js` loads `qrcodejs` from cdnjs if `window.QRCode` is not already
present. The QR is hidden on phones (viewport under 700px wide or 500px tall):
a link to the slide is not useful on the device already showing it.

## Presentation UX

Initialize:

```html
<script>
  Reveal.addEventListener("ready", function () {
    window.ux = new window.RevealUX.RevealUX({
      wheelThrottleMs: 100,
      qrToggleKey: "q",
      clickableSlideNumber: true,
      pageInfo: {
        position: "top",
        left: "Presentation title",
        center: "Seminar name",
        right: "Presenter - 2026-07-10"
      }
    }).init();
  });
</script>
```

This adds:

- a keyboard shortcut card while the Reveal overview (Esc) is open
- mouse wheel slide navigation; in the overview, each tick moves a whole slide
  and skips fragments
- `q` key toggle for the QR code container
- click-to-jump behavior for Reveal's built-in slide number
- optional top or bottom page information bar (smaller text and margins on phones)

Reveal still renders the page number. Enable it in `Reveal.initialize()`:

```js
Reveal.initialize({
  slideNumber: "c/t",
  showSlideNumber: "all"
});
```

Then `clickableSlideNumber: true` makes that slide number clickable. Clicking it
opens a small prompt; entering `12` jumps to slide 12. Empty, invalid, and
out-of-range input is ignored.

`pageInfo` adds a fixed header/footer with three customizable slots. By default,
`RevealUX` injects a small stylesheet, so no extra CSS file is required.

```js
pageInfo: {
  position: "top", // "top" or "bottom"
  left: "Guiding Users Beyond the Display",
  center: "UVR Lab seminar",
  right: ({ current, total }) => current + "/" + total
}
```

Slot values can be strings or functions. Functions receive:

```js
{ Reveal, indices, current, total }
```

To disable the default injected CSS and style it yourself:

```js
pageInfo: {
  position: "bottom",
  left: "Presentation title",
  injectStyle: false
}
```

The generated classes are `.reveal-ux-page-info`, `.is-top`, `.is-bottom`,
`.rux-page-info-left`, `.rux-page-info-center`, and `.rux-page-info-right`.

`RevealUX` also injects default styles for the overview guide (a shortcut card
shown while ESC overview is open; hidden on phones) and for the `q` QR toggle.
They are inserted first in `<head>`, so your deck CSS overrides them. Example:

```css
.reveal-ux-guide {
  pointer-events: none;
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  opacity: 0;
  background: white;
  border: 1px solid #d9dee7;
  padding: 1rem 1.5rem;
}
.reveal-ux-guide.is-visible {
  opacity: 1;
}
.rux-hidden {
  display: none !important;
}
```

## Private Slide Workflow

Keep a private local deck like this:

```text
academic-revealjs-tools/
  js/              public tools committed to GitHub
  slide/           private deck, ignored by git
```

Inside `slide/index.html`, either use local scripts while developing:

```html
<script src="../js/reveal-bibtex.js"></script>
```

or use the public CDN URL when the deck lives in another private repository:

```html
<script src="https://cdn.jsdelivr.net/gh/sebaram/academic-revealjs-tools@v0.1.0/js/reveal-bibtex.js"></script>
```

## Development

Run the BibTeX unit tests:

```powershell
node --test js\reveal-bibtex.test.mjs
```

The test file uses Node's built-in test runner and a small DOM stub, so no
package install is required.

## Publishing Checklist

1. Commit only public files: `.gitignore`, `.nojekyll`, `index.html`, `README.md`, `js/`, and `css/`.
2. Push to GitHub.
3. In GitHub, open repository settings and enable Pages from the `main` branch.
4. Create a version tag for stable CDN URLs:

```powershell
git tag v0.1.0
git push origin v0.1.0
```
