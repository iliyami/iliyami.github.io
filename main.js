/* Iliya Mirzaei — personal site
   Modules: theme, DAG background, BibTeX copy, GitHub stars, nav scrollspy, terminal.
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
    const btn = document.getElementById('theme-toggle');
    btn.querySelector('i').className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  },
};

/* ---------- DAG background ----------
   A Mysticeti-style DAG: rounds (columns) of blocks, one lane per validator.
   Each block references its own lane's previous block plus 1-2 neighbouring lanes,
   so edges stay local and read as a graph rather than a web. Periodically an
   "anchor" commits and the commit ripples back through its causal history one
   hop at a time. Nodes ease away from the cursor. The whole layer dims once
   the hero scrolls away so it never competes with body text. */
const Dag = {
  LANES: 6, GAP: 150, SPEED: 18,
  REPEL: 160,       // cursor influence radius (px)
  HOP: 0.16,        // seconds for the commit ripple to cross one edge
  DEPTH: 6,         // how many rounds back a commit lights up
  COMMIT_EVERY: 3.2,
  init() {
    this.canvas = document.getElementById('dag-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mouse = { x: -9999, y: -9999 };
    this.rounds = [];
    this.anchorTimer = 1.2;
    this.time = 0;
    this.lastT = performance.now();
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    for (let x = -this.GAP; x < this.W + this.GAP * 2; x += this.GAP) this.pushRound(x);
    window.addEventListener('resize', () => { this.resize(); if (this.reduced) this.render(); });
    window.addEventListener('scroll', () => this.dim(), { passive: true });
    this.dim();
    if (this.reduced) {
      // One still frame, redrawn only when the theme changes.
      document.addEventListener('themechange', () => this.render());
      this.render();
      return;
    }
    window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    document.documentElement.addEventListener('mouseleave', () => { this.mouse.x = this.mouse.y = -9999; });
    requestAnimationFrame((t) => this.frame(t));
  },
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  // Full strength over the hero, settling to 40% by the time it has scrolled away.
  dim() {
    const k = Math.min(window.scrollY / (this.H * 0.8), 1);
    this.canvas.style.opacity = String(1 - 0.6 * k);
  },
  pushRound(x) {
    const prev = this.rounds[this.rounds.length - 1];
    const blocks = [];
    for (let l = 0; l < this.LANES; l++) {
      if (Math.random() < 0.14) continue;
      // y is stored as a fraction of the viewport so resizes (mobile URL bar) don't strand nodes.
      const b = {
        x, lane: l, fy: (l + 0.5 + (Math.random() - 0.5) * 0.7) / this.LANES,
        r: 2.2 + Math.random() * 2.4, parents: [], anchor: false,
        lit: -1, dx: 0, dy: 0, glow: 0,
      };
      if (prev && prev.length) {
        const own = prev.find((p) => p.lane === l)
          || prev.reduce((a, p) => (Math.abs(p.lane - l) < Math.abs(a.lane - l) ? p : a));
        // Mostly adjacent lanes; an occasional two-lane reach keeps it from looking like a lattice.
        const reach = Math.random() < 0.25 ? 2 : 1;
        const near = prev.filter((p) => p !== own && Math.abs(p.lane - l) <= reach)
          .sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2);
        b.parents = [own, ...near];
      }
      blocks.push(b);
    }
    this.rounds.push(blocks);
  },
  // Breadth-first so each block lights at its shortest hop distance from the anchor.
  commit(anchor) {
    anchor.anchor = true;
    let wave = [anchor], seen = new Set(wave);
    for (let d = 0; d <= this.DEPTH && wave.length; d++) {
      const next = [];
      for (const b of wave) {
        b.lit = this.time + d * this.HOP;
        for (const p of b.parents) if (!seen.has(p)) { seen.add(p); next.push(p); }
      }
      wave = next;
    }
  },
  // 0 before the ripple reaches a block, 1 on arrival, fading over ~1.4s.
  heat(b) {
    if (b.lit < 0) return 0;
    const age = this.time - b.lit;
    return age < 0 ? 0 : Math.max(0, 1 - age / 1.4);
  },
  colors() {
    const dark = document.body.dataset.theme !== 'light';
    return dark
      ? { edge: 'rgba(224,104,95,', node: 'rgba(240,164,156,' }
      : { edge: 'rgba(143,59,51,', node: 'rgba(185,81,71,' };
  },
  frame(t) {
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    this.time += dt;
    this.step(dt);
    this.render();
    requestAnimationFrame((t2) => this.frame(t2));
  },
  step(dt) {
    for (const r of this.rounds) for (const b of r) b.x -= this.SPEED * dt;
    if (this.rounds.length && this.rounds[0].every((b) => b.x < -this.GAP)) this.rounds.shift();
    const last = this.rounds[this.rounds.length - 1];
    // A round can come out empty (every lane skipped) — don't let that strand the loop.
    const lastX = last && last.length ? Math.max(...last.map((b) => b.x), 0) : this.W;
    if (lastX < this.W + this.GAP) this.pushRound(lastX + this.GAP);

    this.anchorTimer -= dt;
    if (this.anchorTimer <= 0) {
      this.anchorTimer = this.COMMIT_EVERY;
      // Pick from the right half so the ripple has room to travel left across the screen.
      const mid = this.rounds[Math.floor(this.rounds.length * 0.7)];
      if (mid && mid.length) this.commit(mid[Math.floor(Math.random() * mid.length)]);
    }

    // Ease toward the repelled offset instead of snapping, so fast cursor moves stay smooth.
    const ease = Math.min(1, dt * 7);
    for (const r of this.rounds) for (const b of r) {
      const y = b.fy * this.H;
      const dx = b.x - this.mouse.x, dy = y - this.mouse.y, d2 = dx * dx + dy * dy;
      let tx = 0, ty = 0, g = 0;
      if (d2 < this.REPEL * this.REPEL) {
        const d = Math.sqrt(d2) || 1, f = 1 - d / this.REPEL;
        tx = (dx / d) * f * 26; ty = (dy / d) * f * 26; g = f;
      }
      b.dx += (tx - b.dx) * ease; b.dy += (ty - b.dy) * ease; b.glow += (g - b.glow) * ease;
    }
  },
  render() {
    const { edge, node } = this.colors();
    const ctx = this.ctx, H = this.H;
    ctx.clearRect(0, 0, this.W, H);
    ctx.lineWidth = 1;
    for (const r of this.rounds) for (const b of r) {
      const x1 = b.x + b.dx, y1 = b.fy * H + b.dy;
      for (const p of b.parents) {
        const x2 = p.x + p.dx, y2 = p.fy * H + p.dy, mx = (x1 + x2) / 2;
        const hot = Math.min(this.heat(b), this.heat(p));
        ctx.strokeStyle = edge + (0.08 + hot * 0.45 + Math.max(b.glow, p.glow) * 0.25) + ')';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
        ctx.stroke();
        // A spark rides the edge from child to parent while the ripple crosses it.
        if (b.lit >= 0 && p.lit > b.lit) {
          const k = (this.time - b.lit) / (p.lit - b.lit);
          if (k > 0 && k < 1) {
            const u = 1 - k, a = u * u * u, c = 3 * u * u * k, e = 3 * u * k * k, f = k * k * k;
            ctx.fillStyle = edge + '0.95)';
            ctx.beginPath();
            ctx.arc(a * x1 + c * mx + e * mx + f * x2, a * y1 + c * y1 + e * y2 + f * y2, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    for (const r of this.rounds) for (const b of r) {
      const x = b.x + b.dx, y = b.fy * H + b.dy, h = this.heat(b);
      if (b.anchor) {
        ctx.strokeStyle = edge + (0.3 + h * 0.5) + ')';
        ctx.beginPath(); ctx.arc(x, y, b.r + 5, 0, Math.PI * 2); ctx.stroke();
        // Expanding ring on the anchor itself at the moment of commit.
        const age = this.time - b.lit;
        if (age >= 0 && age < 1.2) {
          ctx.strokeStyle = edge + (0.5 * (1 - age / 1.2)) + ')';
          ctx.beginPath(); ctx.arc(x, y, b.r + 5 + age * 28, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.fillStyle = node + Math.min(0.28 + h * 0.6 + b.glow * 0.5, 0.95) + ')';
      ctx.beginPath(); ctx.arc(x, y, b.r + h * 1.5, 0, Math.PI * 2); ctx.fill();
    }
  },
};

/* ---------- BibTeX copy ---------- */
const Bibtex = {
  entries: {
    sigmod: `@inproceedings{mirzaei2027transaction,
  title={Transaction Order Under Attack: Benchmarking MEV in DAG-based BFT Consensus Protocols},
  author={Mirzaei, Iliya and Cai, Zichun and Wu, Chenyuan and Amiri, Mohammad Javad},
  booktitle={Proceedings of the ACM SIGMOD International Conference on Management of Data},
  year={2027}
}`,
    fair: `@misc{mirzaei2026fair,
  title={Fair on the Surface: Transaction-Ordering Bias and MEV in Mysticeti DAG-based BFT Protocol},
  author={Mirzaei, Iliya and Amiri, Mohammad Javad},
  year={2026}, eprint={2607.13378}, archivePrefix={arXiv}
}`,
    spectrum: `@misc{mirzaei2026competition,
  title={Competition, Collusion, and Corruption: The Spectrum of MEV Attacks on DAG-Based BFT Consensus Protocols},
  author={Mirzaei, Iliya and Patel, Heer and Wu, Chenyuan and Amiri, Mohammad Javad},
  year={2026}, eprint={2609.20069}, archivePrefix={arXiv}
}`,
    evage: `@misc{wen2026evage,
  title={EVAGE: Autonomous MEV Generation and Adaptation via Multi-Agent Harness},
  author={Wen, Yan and Cai, Zichun and Mirzaei, Iliya and Cai, Xiaohua and Amiri, Mohammad Javad and Chen, Haoxian and Wu, Chenyuan},
  year={2026}, eprint={2609.27424}, archivePrefix={arXiv}
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
      // Guard: only trust the fetch if it's plausibly the real 1.8K-star repo.
      if (!macsai || macsai.stargazers_count < 1000) return;
      const n = macsai.stargazers_count;
      const label = n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
      document.querySelectorAll('[data-stars="macsai"]').forEach((el) => { el.textContent = label; });
    } catch { /* offline or rate-limited — keep static value */ }
  },
};

/* ---------- nav scrollspy ----------
   Marks the nav link for whichever section crosses the upper third of the viewport. */
const Spy = {
  init() {
    const links = new Map([...document.querySelectorAll('.nav-links a[href^="#"]')]
      .map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a, id) => {
          if (id === e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-30% 0px -65% 0px' });
    links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  },
};

/* ---------- terminal easter egg ---------- */
const Term = {
  commands: {
    help: ['help · whoami · pubs · stack · consensus · sudo · clear · exit'],
    whoami: ['Iliya Mirzaei — Ph.D. researcher, Stony Brook (SeeMoRe Lab).',
      'Breaking transaction ordering in DAG-based BFT, proving it in Rust.'],
    pubs: ['[1] Transaction Order Under Attack: Benchmarking MEV in DAG-BFT (SIGMOD 2027)',
      '[2] Fair on the Surface: Ordering Bias & MEV in Mysticeti (arXiv:2607.13378)',
      '[3] Competition, Collusion, and Corruption: MEV Attacks on DAG-BFT (arXiv:2609.20069)',
      '[4] EVAGE: Autonomous MEV Generation via Multi-Agent Harness (arXiv:2609.27424)',
      '[5] Sample More, Reflect Less (arXiv:2607.28576)',
      '[6] Stateless Network-Aware ABR over IPFS (arXiv:2606.29574)',
      '[7] Fishing in Deeper Waters — NEDB Day 2026 poster'],
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
    if (open === !this.el.hidden) return;
    this.el.hidden = !open;
    // Hand focus back to wherever it was, so keyboard users aren't dropped at the top.
    if (open) { this.returnTo = document.activeElement; this.input.focus(); }
    else this.returnTo?.focus?.();
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
  Spy.init();
});
