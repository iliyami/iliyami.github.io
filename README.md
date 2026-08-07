# iliya.dev — personal site

Static site, zero build step, zero dependencies. Deploy by copying this folder anywhere that serves files (GitHub Pages, Netlify, Cloudflare Pages, an SBU `~/public_html`).

Live at **https://iliyami.github.io** (GitHub Pages, `iliyami/iliyami.github.io`). Canonical/OG URLs in `index.html` are absolute and point there — update them together if the domain ever changes.

## Structure

```
site/
├── index.html                  # semantic markup only — no styling, no behavior
├── styles.css                  # design tokens → base → components → sections → responsive
├── main.js                     # 5 isolated modules: Theme, Dag, Bibtex, Stars, Term
├── favicon.svg
├── Iliya_Mirzaei_Resume.pdf    # linked from the hero — publicly downloadable
└── assets/
    └── headshot.jpeg
```

## Design decisions

- **Tokens first**: all colors/spacing live in CSS custom properties on `:root`; the light theme overrides only the token layer (`body[data-theme="light"]`), so component rules never branch on theme.
- **Progressive enhancement**: the page is fully readable with JS disabled — the canvas background, star counts, theme persistence, and terminal are enhancements. GitHub API failures fall back to the static star count.
- **Accessibility**: semantic landmarks (`nav`/`main`/`section`/`article`), skip link, `:focus-visible` ring, `aria-label`s on icon-only controls, `prefers-reduced-motion` stops the DAG drift and float animations.
- **Theme**: **dark by default, deliberately** — the site is designed dark-first, so every first-time visitor gets that look regardless of their OS `prefers-color-scheme`. Only a previous explicit toggle overrides it, persisted in `localStorage` and whitelisted to `dark`/`light` before it reaches the DOM. Don't "fix" this to follow the OS.
- **No framework**: at this size a framework is overhead; modules communicate via one `themechange` event.
- **Third-party lockdown**: the two Phosphor icon stylesheets are version-pinned *and* carry SRI hashes — bump the hashes with the version or the icons stop loading. A `Content-Security-Policy` meta tag in `index.html` allowlists exactly the hosts in use (`fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`, `api.github.com`) and blocks everything else, including inline `<script>`.

## Editing

- Content → `index.html` (BibTeX entries live in `main.js` → `Bibtex.entries`).
- Colors → token block at the top of `styles.css` (SBU-red accent ramp).
- DAG behavior → `Dag` constants (`LANES`, `GAP`, `SPEED`) in `main.js`.

## Easter egg

Press <kbd>`</kbd> (or click "all replicas in agreement_" in the footer) for the consensus shell: `help`, `whoami`, `pubs`, `stack`, `consensus`, `sudo`, `clear`, `exit`.
