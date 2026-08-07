/* Iliya Mirzaei — personal site
   Modules: theme, DAG background, BibTeX copy, GitHub stars, terminal.
   No dependencies. Each module owns its state; init() wires them on DOMContentLoaded. */
'use strict';

/* ---------- theme ---------- */
const Theme = {
  KEY: 'im-theme',
  init() {
    // Dark is the default on purpose — the site is designed dark-first, so every
    // first-time visitor gets that look regardless of their OS setting. Only a
    // previous explicit toggle overrides it, and only 'dark'/'light' are accepted
    // (the value reaches a data attribute).
    const stored = localStorage.getItem(this.KEY);
    this.set(stored === 'light' ? 'light' : 'dark');
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.set(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  },
  set(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem(this.KEY, theme);
    const icon = document.querySelector('#theme-toggle i');
    icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  },
};

/* ---------- DAG background ----------
   A Mysticeti-style DAG: rounds (columns) of blocks, each linked to 2-3
   parents in the previous round, drifting left. Periodically an "anchor"
   commits and its causal history flashes. Nodes repel the cursor. */
const Dag = {
  LANES: 6, GAP: 150, SPEED: 18,
  init() {
    this.canvas = document.getElementById('dag-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mouse = { x: -9999, y: -9999 };
    this.rounds = [];
    this.anchorTimer = 0;
    this.lastT = performance.now();
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    for (let x = -this.GAP; x < this.W + this.GAP * 2; x += this.GAP) this.pushRound(x);
    requestAnimationFrame((t) => this.draw(t));
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  pushRound(x) {
    const prev = this.rounds[this.rounds.length - 1];
    const blocks = [];
    for (let l = 0; l < this.LANES; l++) {
      if (Math.random() < 0.14) continue;
      const b = {
        x, y: ((l + 0.5) / this.LANES) * this.H + (Math.random() - 0.5) * this.H / this.LANES * 0.7,
        r: 2.2 + Math.random() * 2.4, parents: [], anchor: false, flash: 0, glow: 0, dx: 0, dy: 0,
      };
      if (prev) b.parents = [...prev].sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.5 ? 1 : 0));
      blocks.push(b);
    }
    this.rounds.push(blocks);
  },
  flashHistory(b, depth = 0) {
    if (!b || depth > 5) return;
    b.flash = 1;
    b.parents.forEach((p) => this.flashHistory(p, depth + 1));
  },
  colors() {
    const dark = document.body.dataset.theme !== 'light';
    return dark
      ? { edge: 'rgba(224,104,95,', node: 'rgba(240,164,156,' }
      : { edge: 'rgba(143,59,51,', node: 'rgba(185,81,71,' };
  },
  draw(t) {
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    const speed = this.reduced ? 0 : this.SPEED;
    for (const r of this.rounds) for (const b of r) b.x -= speed * dt;
    if (this.rounds.length && this.rounds[0].every((b) => b.x < -this.GAP)) this.rounds.shift();
    const last = this.rounds[this.rounds.length - 1];
    // A round can come out empty (every lane skipped) — don't let that strand the loop.
    const lastX = last && last.length ? Math.max(...last.map((b) => b.x), 0) : this.W;
    if (lastX < this.W + this.GAP) this.pushRound(lastX + this.GAP);

    this.anchorTimer -= dt;
    if (this.anchorTimer <= 0) {
      this.anchorTimer = 2.6;
      const mid = this.rounds[Math.floor(this.rounds.length * 0.6)];
      if (mid && mid.length) {
        const a = mid[Math.floor(Math.random() * mid.length)];
        a.anchor = true;
        this.flashHistory(a);
      }
    }

    const { edge, node } = this.colors();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    for (const r of this.rounds) for (const b of r) {
      const dx = b.x - this.mouse.x, dy = b.y - this.mouse.y, d2 = dx * dx + dy * dy;
      b.dx = 0; b.dy = 0; b.glow = 0;
      if (d2 < 160 * 160) {
        const d = Math.sqrt(d2) || 1, f = 1 - d / 160;
        b.dx = (dx / d) * f * 26; b.dy = (dy / d) * f * 26; b.glow = f;
      }
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 0.8);
    }
    ctx.lineWidth = 1;
    for (const r of this.rounds) for (const b of r) for (const p of b.parents) {
      const hot = Math.min(b.flash, p.flash);
      ctx.strokeStyle = edge + (0.07 + hot * 0.5 + Math.max(b.glow, p.glow) * 0.25) + ')';
      ctx.beginPath();
      ctx.moveTo(b.x + b.dx, b.y + b.dy);
      ctx.lineTo(p.x + p.dx, p.y + p.dy);
      ctx.stroke();
      if (hot > 0.05) {
        const k = 1 - hot;
        ctx.fillStyle = edge + hot * 0.9 + ')';
        ctx.beginPath();
        ctx.arc(b.x + (p.x - b.x) * k, b.y + (p.y - b.y) * k, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const r of this.rounds) for (const b of r) {
      const x = b.x + b.dx, y = b.y + b.dy;
      if (b.anchor) {
        ctx.strokeStyle = edge + (0.35 + b.flash * 0.5) + ')';
        ctx.beginPath(); ctx.arc(x, y, b.r + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = node + Math.min(0.28 + b.flash * 0.6 + b.glow * 0.5, 0.95) + ')';
      ctx.beginPath(); ctx.arc(x, y, b.r + b.flash * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame((t2) => this.draw(t2));
  },
};

/* ---------- BibTeX copy ---------- */
const Bibtex = {
  entries: {
    fair: `@misc{mirzaei2026fair,
  title={Fair on the Surface: Transaction-Ordering Bias and MEV in Mysticeti DAG-based BFT Protocol},
  author={Mirzaei, Iliya and Amiri, Mohammad Javad},
  year={2026}, eprint={2607.13378}, archivePrefix={arXiv}
}`,
    sample: `@misc{mirzaei2026sample,
  title={Sample More, Reflect Less: Self-Refine and Reflexion Lose to Repeated Sampling at Equal Token Cost, from 1.5B to 7B},
  author={Mirzaei, Iliya},
  year={2026}, eprint={2607.28576}, archivePrefix={arXiv}
}`,
    ipfs: `@misc{mirzaei2026stateless,
  title={Stateless Network-Aware Adaptive Bitrate Streaming over IPFS},
  author={Mirzaei, Iliya and Mojaveri, S. J. and Najafizadeh, A.},
  year={2026}, eprint={2606.29574}, archivePrefix={arXiv}
}`,
    poster: `@misc{mirzaei2026fishing,
  title={Fishing in Deeper Waters: A Comprehensive MEV Analysis of DAG-Based Blockchains},
  author={Mirzaei, Iliya and Amiri, Mohammad Javad},
  howpublished={Poster, North East Database Day}, year={2026}
}`,
  },
  init() {
    document.querySelectorAll('[data-bib]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const old = btn.innerHTML;
        try {
          await navigator.clipboard.writeText(this.entries[btn.dataset.bib]);
          btn.innerHTML = '<i class="ph ph-check"></i> Copied';
        } catch {
          // Denied permission or insecure context — say so instead of failing silently.
          btn.innerHTML = '<i class="ph ph-warning"></i> Copy failed';
        }
        setTimeout(() => { btn.innerHTML = old; }, 1400);
      });
    });
  },
};

/* ---------- GitHub stars (progressive enhancement) ---------- */
const Stars = {
  async init() {
    try {
      const res = await fetch('https://api.github.com/users/iliyami/repos?per_page=100');
      if (!res.ok) return;
      const repos = await res.json();
      const macsai = repos.find((r) => /macsai/i.test(r.name));
      // Guard: only trust the fetch if it's plausibly the real 1.3K-star repo.
      if (!macsai || macsai.stargazers_count < 1000) return;
      const n = macsai.stargazers_count;
      const label = n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
      document.querySelectorAll('[data-stars="macsai"]').forEach((el) => { el.textContent = label; });
    } catch { /* offline or rate-limited — keep static value */ }
  },
};

/* ---------- terminal easter egg ---------- */
const Term = {
  commands: {
    help: ['help · whoami · pubs · stack · consensus · sudo · clear · exit'],
    whoami: ['Iliya Mirzaei — Ph.D. researcher, Stony Brook (SeeMoRe Lab).',
      'Breaking transaction ordering in DAG-based BFT, proving it in Rust.'],
    pubs: ['[1] Fair on the Surface: Ordering Bias & MEV in Mysticeti (arXiv:2607.13378)',
      '[2] Sample More, Reflect Less (arXiv:2607.28576)',
      '[3] Stateless Network-Aware ABR over IPFS (arXiv:2606.29574)',
      '[4] Fishing in Deeper Waters — NEDB Day 2026 poster'],
    stack: ['Rust · Go · Python · C/C++ · Dart · SQL',
      'Mysticeti · Bullshark · PBFT · Paxos · Docker · Prometheus'],
    consensus: ['proposing block b_7f3a…', 'collecting votes… 2f+1 reached ✓',
      'anchor committed. ordering: contested — see arXiv:2607.13378'],
    sudo: ['access granted → imirzaei@cs.stonybrook.edu'],
  },
  init() {
    this.el = document.getElementById('terminal');
    this.body = this.el.querySelector('.body');
    this.input = this.el.querySelector('input');
    document.getElementById('term-trigger').addEventListener('click', () => this.toggle(true));
    this.el.querySelector('.bar button').addEventListener('click', () => this.toggle(false));
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); this.toggle(); }
      if (e.key === 'Escape') this.toggle(false);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const cmd = this.input.value.trim();
      this.input.value = '';
      if (cmd) this.run(cmd);
    });
  },
  toggle(open = this.el.hidden) {
    this.el.hidden = !open;
    if (open) this.input.focus();
  },
  print(lines, cls) {
    for (const ln of lines) {
      const div = document.createElement('div');
      div.textContent = ln;
      if (cls) div.className = cls;
      this.body.insertBefore(div, this.body.querySelector('.in'));
    }
    this.body.scrollTop = this.body.scrollHeight;
  },
  run(cmd) {
    const c = cmd.toLowerCase().split(/\s+/)[0];
    if (c === 'exit') return this.toggle(false);
    if (c === 'clear') {
      this.body.querySelectorAll('div:not(.in)').forEach((d) => d.remove());
      return;
    }
    this.print(['❯ ' + cmd]);
    // Own-property check, not a bare lookup: 'constructor' and '__proto__' resolve
    // up the prototype chain and would hand print() something non-iterable.
    this.print(Object.hasOwn(this.commands, c)
      ? this.commands[c]
      : [`command not found: ${c}, try 'help'`]);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Dag.init();
  Bibtex.init();
  Stars.init();
  Term.init();
});
