'use strict';

/* ============================================================
   STSL CASE STUDY — INTERACTIONS
   1. Three.js liquid-ripple bg (ported from main portfolio)
   2. GSAP fluid pill-button swap
   3. IntersectionObserver reveal-on-scroll
   ============================================================ */

const ASSETS = {
  bgPattern: '../../assets/bg-pattern.png',
};

/* ── 1. THREE.JS LIQUID-RIPPLE BG ─────────────────────────── */
const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform sampler2D u_texture;
  uniform vec2  u_mouse;
  uniform float u_time;
  uniform float u_strength;
  uniform bool  u_ready;
  uniform vec2  u_uvRepeat;
  uniform vec2  u_uvOffset;
  varying vec2  vUv;

  void main() {
    vec3 bg = vec3(0.0784, 0.0784, 0.1020); /* #14141A Midnight */
    if (!u_ready) { gl_FragColor = vec4(bg, 1.0); return; }
    vec2 uv = vUv;
    vec2 toMouse = uv - u_mouse;
    float dist = length(toMouse);
    float rings = sin(dist * 22.0 - u_time * 2.8);
    float falloff = smoothstep(0.55, 0.0, dist);
    uv += normalize(toMouse + 0.0001) * rings * falloff * u_strength;
    uv.x += sin(uv.y * 7.0 + u_time * 0.32) * 0.003;
    uv.y += cos(uv.x * 5.5 + u_time * 0.25) * 0.0025;
    vec2 texUv = uv * u_uvRepeat + u_uvOffset;
    vec4 tex = texture2D(u_texture, texUv);
    vec3 color = mix(tex.rgb, bg, 0.95);
    float grad = smoothstep(0.0, 0.75, vUv.y);
    color *= mix(0.25, 1.0, grad);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function applyUvCrop(uniforms, imgW, imgH, vpW, vpH, patternScale = 1.0) {
  // patternScale < 1 zooms IN on the pattern (each tile reads larger),
  // > 1 scales OUT (more tiles visible). Used to bump the footer canvas
  // pattern 20% bigger than the cover hero's default.
  const rx = (vpW / vpH) / (imgW / imgH) * patternScale;
  uniforms.u_uvRepeat.value.set(rx, patternScale);
  uniforms.u_uvOffset.value.set((1.0 - rx) * 0.5, (1.0 - patternScale) * 0.5);
}

function initBackground(canvasId, opts = {}) {
  const patternScale = opts.patternScale || 1.0;
  if (typeof THREE === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById(canvasId || 'bg-canvas');
  if (!canvas) return;
  const cover = canvas.parentElement;
  const w = () => cover.clientWidth;
  const h = () => cover.clientHeight;

  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.8s ease';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w(), h());

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    u_texture:  { value: null },
    u_mouse:    { value: new THREE.Vector2(0.5, 0.5) },
    u_time:     { value: 0.0 },
    u_strength: { value: 0.006 },
    u_ready:    { value: false },
    u_uvRepeat: { value: new THREE.Vector2(1.0, 1.0) },
    u_uvOffset: { value: new THREE.Vector2(0.0, 0.0) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function applyTexture(tex) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    uniforms.u_texture.value = tex;
    const img = tex.image;
    applyUvCrop(uniforms, img.naturalWidth || img.width, img.naturalHeight || img.height, w(), h(), patternScale);
    uniforms.u_ready.value = true;
    canvas.style.opacity = '1';
    window.dispatchEvent(new Event('asset-loaded'));
  }

  function applyGrainFallback() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 32 + 8;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    uniforms.u_texture.value = t;
    applyUvCrop(uniforms, 512, 512, w(), h(), patternScale);
    uniforms.u_ready.value = true;
    canvas.style.opacity = '1';
    window.dispatchEvent(new Event('asset-loaded'));
  }

  new THREE.TextureLoader().load(ASSETS.bgPattern, applyTexture, undefined, applyGrainFallback);

  const mouse = { x: 0.5, y: 0.5 };
  cover.addEventListener('mousemove', (e) => {
    const r = cover.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = 1 - (e.clientY - r.top) / r.height;
  });

  window.addEventListener('resize', () => {
    renderer.setSize(w(), h());
    const tex = uniforms.u_texture.value;
    if (tex && tex.image) {
      const iw = tex.image.naturalWidth || tex.image.width;
      const ih = tex.image.naturalHeight || tex.image.height;
      if (iw && ih) applyUvCrop(uniforms, iw, ih, w(), h(), patternScale);
    }
  });

  (function tick(ts) {
    requestAnimationFrame(tick);
    uniforms.u_time.value = ts * 0.001;
    uniforms.u_mouse.value.x += (mouse.x - uniforms.u_mouse.value.x) * 0.055;
    uniforms.u_mouse.value.y += (mouse.y - uniforms.u_mouse.value.y) * 0.055;
    renderer.render(scene, camera);
  })(0);
}

/* ── 2. GSAP FLUID PILL-BUTTON SWAP ──────────────────────── */
function initPillButtons() {
  if (typeof gsap === 'undefined') return;
  const btnContact = document.getElementById('btn-contact');
  const btnResume = document.getElementById('btn-resume');
  if (!btnContact || !btnResume) return;

  const DUR = 0.55;
  const EASE = 'power3.inOut';
  let active = 'contact';

  function activate(which) {
    if (which === active) return;
    active = which;
    if (which === 'contact') {
      gsap.to(btnContact, { flexGrow: 3, backgroundColor: '#f1f1f4', color: '#141414', duration: DUR, ease: EASE, overwrite: true });
      gsap.to(btnResume,  { flexGrow: 1, backgroundColor: '#707070', color: '#ffffff', duration: DUR, ease: EASE, overwrite: true });
    } else {
      gsap.to(btnResume,  { flexGrow: 3, backgroundColor: '#f1f1f4', color: '#141414', duration: DUR, ease: EASE, overwrite: true });
      gsap.to(btnContact, { flexGrow: 1, backgroundColor: '#707070', color: '#ffffff', duration: DUR, ease: EASE, overwrite: true });
    }
  }

  btnContact.addEventListener('mouseenter', () => activate('contact'));
  btnResume.addEventListener('mouseenter', () => activate('resume'));
  const pillGroup = btnContact.closest('.btn-pill-group');
  if (pillGroup) pillGroup.addEventListener('mouseleave', () => activate('contact'));
}

/* ── 3. TABBED LIVE-FRAME (design system section switcher) ─ */
function initLfTabs() {
  document.querySelectorAll('.live-frame--tabbed').forEach((frame) => {
    const base = frame.dataset.lfBase;
    if (!base) return;
    const tabs = frame.querySelectorAll('.lf-tab');
    const iframe = frame.querySelector('.lf-iframe');
    const url = frame.querySelector('[data-lf-url]');
    const open = frame.querySelector('[data-lf-open]');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const hash = tab.dataset.hash || '';
        if (tab.classList.contains('is-active')) return;
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        iframe.src = base + hash;
        if (url) url.textContent = '/design/' + hash;
        if (open) open.href = base + hash;
      });
    });
  });
}

/* ── 4. ENTRY ANIMATION — mirrors main portfolio's initAnimation ─ */
function initEntryAnimation() {
  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Initial states (match main.js)
  gsap.set('.avatar-wrap',                         { autoAlpha: 0, scale: 0.72 });
  gsap.set(['.profile-name', '.experience-badge'], { autoAlpha: 0, y: 18 });
  gsap.set('.avail-badge',                         { autoAlpha: 0, y: 12 });
  gsap.set('.social-icon',                         { autoAlpha: 0, y: 12 });
  gsap.set('.btn-pill',                            { autoAlpha: 0, y: 12 });
  gsap.set('.tools-bar',                           { autoAlpha: 0, y: 12 });
  gsap.set('.cover-line > span',                   { y: '110%', autoAlpha: 0 });
  gsap.set('.cover-status',                        { autoAlpha: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl
    .to('.avatar-wrap', {
      autoAlpha: 1, scale: 1,
      duration: 0.85, ease: 'back.out(1.9)',
    }, 0.15)
    .to('.profile-name',     { autoAlpha: 1, y: 0, duration: 0.55 }, 0.45)
    .to('.experience-badge', { autoAlpha: 1, y: 0, duration: 0.50 }, 0.58)
    .to('.avail-badge',      { autoAlpha: 1, y: 0, duration: 0.45 }, 0.68)
    .to('.social-icon', {
      autoAlpha: 1, y: 0,
      duration: 0.45, ease: 'power3.out', stagger: 0.07,
    }, 0.68)
    .to('.btn-pill', {
      autoAlpha: 1, y: 0,
      duration: 0.55, stagger: 0.10,
    }, 0.84)
    .to('.tools-bar', {
      autoAlpha: 1, y: 0,
      duration: 0.55,
    }, 0.98)
    .to('.cover-line > span', {
      y: 0, autoAlpha: 1,
      duration: 1.1, stagger: 0.14, ease: 'power4.out',
      clearProps: 'transform',
    }, 0.60)
    .to('.cover-status', {
      autoAlpha: 1,
      duration: 0.6, ease: 'power2.out',
    }, 1.4);

  // Status dots pulse (mirrors ellipsis-red on home)
  gsap.to('.cover-status-dots', {
    opacity: 0.85, duration: 0.9,
    repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.2,
  });
}

/* ── 5. IFRAME SHIELD — click to activate, release on exit ─ */
function initIframeShield() {
  const frames = document.querySelectorAll('.live-frame');
  if (!frames.length) return;

  frames.forEach((frame) => {
    // Inject shield pill if not already present
    if (!frame.querySelector('.lf-shield')) {
      const shield = document.createElement('button');
      shield.type = 'button';
      shield.className = 'lf-shield';
      shield.setAttribute('aria-pressed', 'false');
      shield.textContent = 'Click to interact';
      frame.appendChild(shield);

      shield.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const active = frame.classList.toggle('is-active');
        shield.setAttribute('aria-pressed', active ? 'true' : 'false');
        shield.textContent = active ? 'Active · click to release' : 'Click to interact';
      });
    }

    // Auto-release when iframe scrolls out of view
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && frame.classList.contains('is-active')) {
            frame.classList.remove('is-active');
            const shield = frame.querySelector('.lf-shield');
            if (shield) {
              shield.setAttribute('aria-pressed', 'false');
              shield.textContent = 'Click to interact';
            }
          }
        });
      }, { threshold: 0.15 });
      io.observe(frame);
    }
  });
}

/* ── PARALLAX IMAGES — scroll-tied scale on figures explicitly
   marked [data-parallax]. Currently the laptop-hero shot under
   Overview and the Day 2 phone mockup. Image grows from 1.0 to
   1.18 over its journey through the viewport. rAF-coalesced. */
function initParallaxImages() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frames = Array.from(document.querySelectorAll('[data-parallax]'));
  if (!frames.length) return;

  const items = frames.map((frame) => {
    const img = frame.querySelector('img');
    if (!img) return null;
    img.style.transformOrigin = 'center center';
    img.style.willChange = 'transform';
    img.style.transition = 'transform 0.12s linear';
    const min = parseFloat(frame.dataset.parallaxMin);
    const max = parseFloat(frame.dataset.parallaxMax);
    return {
      frame,
      img,
      min: Number.isFinite(min) ? min : 1.0,
      max: Number.isFinite(max) ? max : 1.02,
    };
  }).filter(Boolean);

  let raf = 0;
  function update() {
    const vh = window.innerHeight;
    items.forEach(({ frame, img, min, max }) => {
      const r = frame.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      const scale = min + (max - min) * p;
      img.style.transform = `scale(${scale.toFixed(4)})`;
    });
  }

  function onScroll() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

/* ── HERO PARALLAX — laptop "lifts" as the reader scrolls. Done as
   SCALE-ONLY with origin center bottom so the image grows upward
   (= visually moving up) while the bottom edge stays anchored to
   the cover bottom. No translate, so there's no chance of a charcoal
   gap appearing below the laptop when the parallax kicks in. */
function initHeroParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cover  = document.querySelector('.cover');
  const mockup = document.querySelector('.cover-mockup');
  if (!cover || !mockup) return;

  const MAX_GROW = 0.16; // additional scale on top of CSS transforms

  mockup.style.willChange = 'transform';
  mockup.style.transition = 'transform 0.18s linear';
  mockup.style.transformOrigin = 'center bottom';

  let raf = 0;
  function update() {
    const r = cover.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
    const grow = 1 + MAX_GROW * p;
    mockup.style.transform = `scale(${grow.toFixed(4)})`;
  }
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
  }
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

/* ── LOADER — ported from main portfolio. Tracks the THREE.js
   bg texture ('asset-loaded' event) with a 6s hard fallback. */
function initLoader(onComplete) {
  const loaderEl = document.getElementById('loader');
  const barEl    = document.getElementById('loader-bar');
  const numEl    = document.querySelector('.loader-number');
  if (!loaderEl || !barEl) { onComplete(); return; }

  const MIN_MS = 900;
  let current  = 0;
  let target   = 0;
  const t0     = Date.now();
  let raf      = null;
  let exited   = false;

  function tick() {
    const delta = target - current;
    if (delta < 0.35) {
      current = target;
      if (numEl) numEl.textContent = Math.floor(current);
      raf = null;
      return;
    }
    current += delta * 0.09;
    if (numEl) numEl.textContent = Math.floor(current);
    raf = requestAnimationFrame(tick);
  }
  function setTarget(pct) {
    target = pct;
    barEl.style.width = pct + '%';
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function scheduleExit() {
    if (exited) return;
    exited = true;
    const wait = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(() => {
      setTarget(100);
      const waitForFull = () => {
        if (current < 100) { setTimeout(waitForFull, 40); return; }
        if (numEl) numEl.textContent = '100';
        setTimeout(() => {
          loaderEl.classList.add('fade-out');
          onComplete();
          setTimeout(() => loaderEl.remove(), 700);
        }, 280);
      };
      waitForFull();
    }, wait);
  }

  setTarget(60);
  window.addEventListener('asset-loaded', scheduleExit, { once: true });
  setTimeout(scheduleExit, 6000);
}

/* ── 8. DAY RAIL — glass scroll-tied chapter ticker ─────────── */
function initDayRail() {
  const rail = document.querySelector('.day-rail');
  if (!rail) return;
  const nodes = Array.from(rail.querySelectorAll('.day-rail-node'));
  if (!nodes.length) return;

  const items = nodes.map((node) => {
    const id = node.dataset.target;
    const target = id ? document.getElementById(id) : null;
    return { node, target };
  }).filter(x => x.target);
  if (!items.length) return;

  rail.hidden = false;
  const cover = document.querySelector('.cover');
  function maybeShowRail() {
    if (!cover) { rail.classList.add('is-ready'); return; }
    const r = cover.getBoundingClientRect();
    if (r.bottom < window.innerHeight * 0.6) {
      rail.classList.add('is-ready');
    } else {
      rail.classList.remove('is-ready');
    }
  }
  maybeShowRail();
  window.addEventListener('scroll', maybeShowRail, { passive: true });

  function setActive(targetItem) {
    items.forEach(({ node, target }) => {
      node.classList.toggle('is-active', target === targetItem);
    });
  }

  function activate(item, scroll = true) {
    if (!item.target) return;
    if (item.target.tagName.toLowerCase() === 'details' && !item.target.open) {
      item.target.open = true;
    }
    setActive(item.target);
    if (scroll) {
      const top = item.target.getBoundingClientRect().top + window.scrollY - 40;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  items.forEach((item) => {
    item.node.addEventListener('click', () => activate(item, true));
    item.node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(item, true);
      }
    });
  });

  // Drag scrubbing
  let dragging = false;
  rail.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.day-rail-node')) return;
    dragging = true;
    rail.setPointerCapture(e.pointerId);
  });
  rail.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = rail.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const idx = Math.floor(t * items.length);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    activate(items[clamped], true);
  });
  rail.addEventListener('pointerup', (e) => {
    dragging = false;
    try { rail.releasePointerCapture(e.pointerId); } catch (_) {}
  });
  rail.addEventListener('pointercancel', () => { dragging = false; });

  function syncFromScroll() {
    const vc = window.innerHeight * 0.4;
    let best = null;
    let bestDist = Infinity;
    items.forEach((item) => {
      const r = item.target.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const dist = Math.abs(mid - vc);
      if (dist < bestDist) { bestDist = dist; best = item; }
    });
    if (best) setActive(best.target);
  }
  syncFromScroll();
  window.addEventListener('scroll', syncFromScroll, { passive: true });
}

/* ── 9. SCROLL TO TOP — fills red progress ring as you scroll. */
function initScrollTop() {
  const btn = document.querySelector('.scroll-top');
  if (!btn) return;

  function update() {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docH > 0 ? Math.max(0, Math.min(100, (window.scrollY / docH) * 100)) : 0;
    btn.style.setProperty('--scroll-progress', progress.toFixed(1));
    const shouldShow = window.scrollY > window.innerHeight * 0.3;
    if (shouldShow) {
      btn.hidden = false;
      btn.classList.add('is-ready');
    } else {
      btn.classList.remove('is-ready');
    }
  }

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

/* ── 10. INTERSECTION OBSERVER REVEAL ─────────────────────── */
function initReveal() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window) || !targets.length) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach(el => io.observe(el));
}

/* ── TIP TAP — make .tip spans tap-to-toggle on mobile (hover doesn't
   fire there). Tap outside or on another tip closes the open one. */
function initTipTap() {
  const tips = Array.from(document.querySelectorAll('.tip'));
  if (!tips.length) return;
  let open = null;
  function close() {
    if (open) { open.classList.remove('is-active'); open = null; }
  }
  tips.forEach((tip) => {
    tip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (open && open !== tip) open.classList.remove('is-active');
      const wasOpen = tip.classList.contains('is-active');
      tip.classList.toggle('is-active');
      open = wasOpen ? null : tip;
    });
    tip.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); tip.blur(); }
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tip')) close();
  });
}

/* ── DAY-COST SCRUBBER — one slider drives both cards.
   Math:
     studioCost(d) = (d / 84) * 10,000         // $0 → $10,000 over 84 days
     claudeCost(d) = min(d / 3.5, 1) * 65       // $0 → $65 over 3.5 days, then flat
   One motion source beyond manual drag:
     - Scroll-tied: as the figure travels through the viewport, day 0 → 84.
       progress = clamp((vh - rect.top) / vh)
         — completes when the figure's top reaches the viewport's top
         (data-point header at top), not when the figure has fully passed.
   The Replay button snaps the slider back to 0; there's no automated playback. */
function initDayCost() {
  const fig = document.querySelector('.day-cost');
  if (!fig) return;
  const slider = fig.querySelector('.dc-slider');
  const dayNum = fig.querySelector('.dc-day-num');
  const dayLabel = fig.querySelector('.dc-day-label');
  const studioAmount = fig.querySelector('[data-cost-studio]');
  const claudeAmount = fig.querySelector('[data-cost-claude]');
  const studioNaira = fig.querySelector('[data-cost-studio-ng]');
  const claudeNaira = fig.querySelector('[data-cost-claude-ng]');
  const studioBar = fig.querySelector('.dc-bar-fill--studio');
  const claudeBar = fig.querySelector('.dc-bar-fill--claude');
  const replay = fig.querySelector('.dc-replay');
  const summary = fig.querySelector('.dc-card-summary');
  const tokenNum = fig.querySelector('[data-token-num]');
  const tokenLabel = fig.querySelector('[data-token-label]');
  const tokenStatus = fig.querySelector('[data-token-status]');
  const gauge = fig.querySelector('.dc-gauge');
  const gaugeFg = fig.querySelector('.dc-gauge-fg');
  const gaugeNeedle = fig.querySelector('.dc-gauge-needle');
  // Compute the actual path length once at init and pin both dasharray + initial
  // offset directly on the element via attributes — bypasses CSS specificity.
  const GAUGE_LEN = gaugeFg ? gaugeFg.getTotalLength() : 251.33;
  if (gaugeFg) {
    gaugeFg.setAttribute('stroke-dasharray', GAUGE_LEN);
    gaugeFg.setAttribute('stroke-dashoffset', GAUGE_LEN);
  }
  const gaugeNeedleTrail = fig.querySelector('.dc-gauge-needle-trail');
  const gaugeOuterRedline = fig.querySelector('.dc-gauge-outer-redline');
  const redlinePill = fig.querySelector('[data-redline-pill]');
  const pulseDot = fig.querySelector('[data-pulse-dot]');
  const ticksShortHost = fig.querySelector('[data-ticks-short]');
  const ticksLongHost = fig.querySelector('[data-ticks-long]');
  const pulseLabel = fig.querySelector('[data-pulse-label]');

  // Build tick hierarchy along the 180° arc. Long ticks at 0/25/50/75/100,
  // short ticks at every other 10% step. Inner radius = 80, outer = 84 (short)
  // / 88 (long), all from centre (100, 100).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function tickAt(pct, longTick) {
    // 0% = left (180°), 100% = right (0°). Map 0..100 → π..0.
    const angle = Math.PI * (1 - pct / 100);
    const cx = 100, cy = 100;
    const rIn = 80, rOut = longTick ? 90 : 85;
    const x1 = cx + Math.cos(angle) * rIn;
    const y1 = cy - Math.sin(angle) * rIn;
    const x2 = cx + Math.cos(angle) * rOut;
    const y2 = cy - Math.sin(angle) * rOut;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    line.dataset.pct = String(pct);
    return line;
  }
  if (ticksShortHost && ticksLongHost) {
    [10, 20, 30, 40, 60, 70, 80, 90].forEach(p => ticksShortHost.appendChild(tickAt(p, false)));
    [0, 25, 50, 75, 100].forEach(p => {
      const line = tickAt(p, true);
      if (p >= 80) line.classList.add('is-redline');
      ticksLongHost.appendChild(line);
    });
  }

  if (!slider || !dayNum || !studioBar || !claudeBar) return;

  // Per-day token totals from the real STSL build session logs.
  const TOKEN_DATA = [
    { day: 1, total: 17_019_602 },
    { day: 2, total: 40_632_391 },
    { day: 3, total: 63_603_609 },
    { day: 4, total: 24_977_120 },
  ];
  const TOKEN_TOTAL = TOKEN_DATA.reduce((s, x) => s + x.total, 0);
  const TOKEN_CUM = TOKEN_DATA.reduce((acc, x) => {
    acc.push((acc[acc.length - 1] || 0) + x.total);
    return acc;
  }, []);
  const fmtNum = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 0 });
  const BURN_DAY = 4;

  // Three session boundaries (Day 3 + Day 4 share a context window). Used only
  // to fire the reset-pulse on forward crossings — the gauge fill itself is
  // now a single continuous gradient driven by --gauge-fill.

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtNG = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STUDIO_TOTAL = 10_000;
  const CLAUDE_TOTAL = 65;
  const NGN_RATE = 1540;
  const SHIP_DAY = 3.5;
  const MAX_DAY = 84;

  // Track which session the scrubber is currently in. On boundary crossings
  // (any direction) fire a reset pulse — that's the "context reset" signal.
  let lastSessionIdx = sessionIndexFor(0);
  function sessionIndexFor(d) {
    if (d < 1) return 0;
    if (d < 2) return 1;
    return 2;
  }

  function firePulse() {
    if (reduced) return;
    // Re-trigger by toggling the class — drop, force reflow, re-add.
    gauge.classList.remove('is-pulsing');
    void gauge.offsetWidth;
    gauge.classList.add('is-pulsing');
    if (pulseLabel) {
      pulseLabel.classList.add('is-visible');
      clearTimeout(firePulse._t);
      firePulse._t = setTimeout(() => pulseLabel.classList.remove('is-visible'), 800);
    }
    setTimeout(() => gauge.classList.remove('is-pulsing'), 620);
  }

  // Day-counter follows scroll directly — no JS lerp, snap on each scroll
  // tick so the number, gauge, and running-cost bars all advance in lockstep.
  function renderDayReadout(d) {
    const shown = Math.round(d);
    dayNum.textContent = String(shown);
    dayLabel.textContent = `Day ${shown}`;
  }

  // Single update: scroll position → every visual element. No JS lerp, no
  // tween loop, no separate gauge state. CSS transitions on .dc-bar-fill,
  // .dc-gauge-fg, .dc-gauge-needle, .dc-gauge-num do all the smoothing in
  // lockstep (~0.12s) so bars + gauge + needle + token scale move together.
  function update(rawDay) {
    const d = Math.round(Math.max(0, Math.min(MAX_DAY, rawDay)) * 2) / 2;
    renderDayReadout(d);

    // ── Running-cost bars + amounts ────────────────────────────
    const studioCost = Math.round((d / MAX_DAY) * STUDIO_TOTAL);
    studioAmount.textContent = fmt.format(studioCost);
    studioAmount.classList.toggle('is-live', d > 0);
    if (studioNaira) studioNaira.textContent = `₦${fmtNG.format(studioCost * NGN_RATE)}`;
    studioBar.style.width = `${(d / MAX_DAY) * 100}%`;

    const claudeCost = d >= SHIP_DAY
      ? CLAUDE_TOTAL
      : Math.round((d / SHIP_DAY) * CLAUDE_TOTAL);
    claudeAmount.textContent = fmt.format(claudeCost);
    claudeAmount.classList.toggle('is-live', d > 0);
    if (claudeNaira) claudeNaira.textContent = `₦${fmtNG.format(claudeCost * NGN_RATE)}`;
    claudeBar.style.width = `${(claudeCost / STUDIO_TOTAL) * 100}%`;

    fig.style.setProperty('--dc-progress', `${(d / MAX_DAY) * 100}%`);

    if (d <= 0) {
      summary.textContent = 'Drag the scrubber to compare.';
    } else {
      const diff = studioCost - claudeCost;
      summary.textContent = `${fmt.format(diff)} less than the agency at this point.`;
    }

    // ── Gauge (arc, needle, glow, redline, pulse, ticks) ───────
    if (!(gaugeFg && gaugeNeedle && tokenNum)) return;
    // Stepped marker progression. Each 20% of scroll snaps the needle to
    // the next Day tick (0 / 1 / 2 / 3 / 4 → exhausted). Reverse on scroll
    // up is symmetric — same math, just in reverse.
    //   0–20%  → Day 0
    //   20–40% → Day 1
    //   40–60% → Day 2
    //   60–80% → Day 3
    //   80–100% → Day 4 (exhausted)
    const scrollProgress = Math.max(0, Math.min(1, d / MAX_DAY));
    const dayMarker = Math.min(Math.floor(scrollProgress * 5), 4);
    const fill = dayMarker / 4; // 0, 0.25, 0.5, 0.75, 1
    gaugeFg.setAttribute('stroke-dashoffset', ((1 - fill) * GAUGE_LEN).toFixed(2));
    gaugeNeedle.style.transform = `rotate(${(-90 + fill * 180).toFixed(2)}deg)`;

    // Yellow trail follows the red needle as a glued halo (no opacity scaling).
    if (gaugeNeedleTrail) {
      gaugeNeedleTrail.style.transform = `rotate(${(-90 + fill * 180).toFixed(2)}deg)`;
    }
    // HUD layers stay visible as static decoration — no fill-driven changes.
    // (Removed: glow scaling, redline pill toggle, pulse dot rate, outer
    // redline arc fill, tick brightening — only the gauge bar animates now.)

    // ── Token counter + scale ──────────────────────────────────
    const scrollDay = fill * BURN_DAY;
    let tokensSoFar;
    if (scrollDay <= 0) tokensSoFar = 0;
    else if (scrollDay >= BURN_DAY) tokensSoFar = TOKEN_TOTAL;
    else {
      const idx = Math.floor(scrollDay);
      const frac = scrollDay - idx;
      const base = idx > 0 ? TOKEN_CUM[idx - 1] : 0;
      const next = TOKEN_DATA[idx]?.total || 0;
      tokensSoFar = Math.round(base + frac * next);
    }
    tokenNum.textContent = fmtNum.format(tokensSoFar);
    const tokenScale = fill <= 0 ? 0 : Math.pow(fill, 0.6);
    tokenNum.style.setProperty('--token-scale', tokenScale.toFixed(4));

    // ── Token label + status text ──────────────────────────────
    const dayN = Math.min(Math.ceil(d), BURN_DAY);
    tokenLabel.textContent = d <= 0
      ? 'day 0'
      : (d >= BURN_DAY ? 'day 4 — context full' : `day ${dayN}`);

    tokenNum.classList.remove('is-burning', 'is-exhausted');
    tokenStatus.classList.remove('is-burning', 'is-exhausted');
    /* The slider runs 0-84 (the full 12-week comparison timeline). The
       burn period only covers days 0-4, so anchoring the "exhausted"
       state to d>=4 leaves the status stuck red for ~95% of the scroll.
       Map post-burn ranges to ledger-style messages instead so the
       status keeps changing as the studio comparison plays out. */
    if (d <= 0) {
      tokenStatus.textContent = 'Idle.';
    } else if (d < 1) {
      tokenStatus.textContent = 'Session 1, building.';
    } else if (d < 2) {
      tokenStatus.textContent = 'Session 2, building.';
    } else if (d < 3) {
      tokenStatus.textContent = 'Session 3, burning fast.';
      tokenNum.classList.add('is-burning');
      tokenStatus.classList.add('is-burning');
    } else if (d < BURN_DAY) {
      tokenStatus.textContent = 'Session 3, near full.';
      tokenNum.classList.add('is-burning');
      tokenStatus.classList.add('is-burning');
    } else if (d < 14) {
      tokenStatus.textContent = 'Context full. 4 days down.';
      tokenNum.classList.add('is-exhausted');
      tokenStatus.classList.add('is-exhausted');
    } else if (d < 28) {
      tokenStatus.textContent = 'Week 2. Studio: discovery.';
    } else if (d < 56) {
      tokenStatus.textContent = 'Week 4-8. Studio: building.';
    } else if (d < 84) {
      tokenStatus.textContent = 'Week 12. Studio: pushing for ship.';
    } else {
      tokenStatus.textContent = '12 weeks vs my 4 days.';
    }

    // Reset-pulse on session boundary crossings.
    const idx = sessionIndexFor(d);
    if (idx !== lastSessionIdx) {
      firePulse();
      lastSessionIdx = idx;
    }
  }

  slider.addEventListener('input', (e) => {
    update(parseFloat(e.target.value));
  });

  // Replay button removed — scroll itself drives the simulation, no explicit
  // reset needed. Scroll up = visuals reverse to 0 via the scroll handler.

  // ── Scroll-tied progress.
  // Animation begins once the data-point bento is halfway past the viewport
  // (figure top has crossed the viewport's vertical midpoint). Completes
  // when figure top reaches viewport top. Reverses symmetrically on scroll
  // up.
  //   - progress 0 when rect.top = vh/2 (figure top at viewport midpoint)
  //   - progress 1 when rect.top = 0    (figure top at viewport top)
  // On mobile (cards stack), the figure's top is mostly headline + scrubber
  // before the running cost card shows up, so we trigger from the cost card
  // instead. On desktop the figure as a whole is the trigger zone.
  const costCard = fig.querySelector('.dc-card--cost');
  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const isMobile = window.innerWidth <= 720;
      const target = (isMobile && costCard) ? costCard : fig;
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const halfPoint = vh / 2;
      const progress = Math.max(0, Math.min(1, (halfPoint - rect.top) / halfPoint));
      const d = progress * MAX_DAY;
      slider.value = d;
      update(d);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // Initial paint on load.
  onScroll();
}

/* ── BOOT ─────────────────────────────────────────────────── */
/* ── PROMPT-HINT click-to-reveal. WAAPI animates .ph-content height +
   opacity on each toggle (the icon spin and bg shift are CSS). Two
   auto-close behaviours layered on top so the open hint never feels
   abandoned: mouseleave + IntersectionObserver out-of-viewport. */
function initPromptHints() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hints = Array.from(document.querySelectorAll('details.prompt-hint'));
  if (!hints.length) return;

  const closeWithDelay = (d, ms) => {
    if (!d.open) return;
    if (d._closeTimer) clearTimeout(d._closeTimer);
    d._closeTimer = setTimeout(() => { if (d.open) d.open = false; }, ms);
  };

  hints.forEach((d) => {
    const content = d.querySelector('.ph-content');
    if (!content) return;

    /* Animate height + opacity on every toggle. Use ease-out (fast in)
       on open and ease-in-out (smooth both ends) on close so the
       collapse-back has a softer landing rather than just running
       backward through the open curve. */
    d.addEventListener('toggle', () => {
      if (reduce) return;
      const opening = d.open;
      const target = content.scrollHeight;
      const from = opening ? 0 : target;
      const to   = opening ? target : 0;
      const duration = opening ? 380 : 460;
      const easing = opening
        ? 'cubic-bezier(0.16, 1, 0.3, 1)'   // ease-out: snap into open
        : 'cubic-bezier(0.55, 0, 0.2, 1)';  // softer ease for the outro
      content.animate(
        [
          { height: `${from}px`, opacity: opening ? 0 : 1, transform: opening ? 'translateY(-6px)' : 'translateY(0)' },
          { height: `${to}px`,   opacity: opening ? 1 : 0, transform: opening ? 'translateY(0)'    : 'translateY(-6px)' }
        ],
        { duration, easing, fill: 'forwards' }
      );
    });

    /* Auto-close when the cursor leaves the hint's bounding box. A
       120ms grace keeps tiny overshoots (e.g. lifting to scroll) from
       collapsing the hint mid-read, but the close still feels reactive
       when the cursor moves to the next paragraph. */
    d.addEventListener('mouseleave', () => closeWithDelay(d, 120));
    d.addEventListener('mouseenter', () => {
      if (d._closeTimer) { clearTimeout(d._closeTimer); d._closeTimer = null; }
    });
  });

  /* Auto-close when the hint scrolls out of the viewport. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.target.open) {
          entry.target.open = false;
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    hints.forEach((d) => io.observe(d));
  }
}

function boot() {
  // Force scroll to top on every refresh — disable browser auto-restore.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  initBackground('bg-canvas');
  // Footer pattern reads ~1.56x larger than the cover hero (20% zoom +
  // another 30% on top). patternScale 0.64 = 1/1.56.
  initBackground('end-canvas', { patternScale: 0.64 });
  initPillButtons();
  initLfTabs();
  initIframeShield();
  initParallaxImages();
  initHeroParallax();
  initDayRail();
  initScrollTop();
  initReveal();
  initTipTap();
  initDayCost();
  initPromptHints();
  // Loader gates the entry animation; rest is already running.
  initLoader(() => {
    document.body.classList.add('is-loaded');
    initEntryAnimation();
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* Cost-vs-Value — tap-to-flip for touch / non-hover devices */
document.querySelectorAll('.cv-metric').forEach((btn) => {
  btn.addEventListener('click', () => btn.classList.toggle('is-flipped'));
});

/* ── RATIO BLOCK — randomised stagger + click-to-toggle on touch ──
   Assigns each cell a random `--i` (0..1) used by CSS as a
   transition-delay multiplier. The hot cell keeps its fixed late
   delay so it lands last. Click on the hot cell toggles
   `.is-active` on the figure for non-hover devices. */
(function initRatioBlock() {
  const block = document.querySelector('.ratio-block');
  if (!block) return;

  // 1. Random reveal delays for each muted cell
  const cells = block.querySelectorAll('.rb-cell:not(.rb-cell--hot)');
  cells.forEach((cell) => {
    cell.style.setProperty('--i', Math.random().toFixed(3));
  });

  // 2. Click toggling for the hot cell (no-hover devices)
  const hot = block.querySelector('.rb-cell--hot');
  if (!hot) return;

  hot.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = block.classList.toggle('is-active');
    hot.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  });

  // 3. Tap outside the block closes the active card on touch
  document.addEventListener('click', (e) => {
    if (!block.classList.contains('is-active')) return;
    if (!block.contains(e.target)) {
      block.classList.remove('is-active');
      hot.setAttribute('aria-expanded', 'false');
    }
  });

  // 4. Esc closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && block.classList.contains('is-active')) {
      block.classList.remove('is-active');
      hot.setAttribute('aria-expanded', 'false');
      hot.blur();
    }
  });
})();

/* ── Agents/Skills toggle — segmented pill, mirrors the portfolio
   Contact/Resume hero pair in mechanic. Click or arrow-key swaps panels. */
(function initAgentsSkills() {
  document.querySelectorAll('.agents-skills').forEach((root) => {
    const toggle = root.querySelector('.as-toggle');
    const tabs = Array.from(root.querySelectorAll('.as-toggle-btn'));
    const panels = {
      agents: root.querySelector('.as-list--agents'),
      skills: root.querySelector('.as-list--skills'),
    };
    if (!toggle || tabs.length !== 2 || !panels.agents || !panels.skills) return;

    const activate = (key) => {
      toggle.dataset.active = key;
      tabs.forEach((t) => {
        const on = t.dataset.tab === key;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== key; });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(tab.dataset.tab));
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = tabs[(i + 1) % tabs.length];
          activate(next.dataset.tab);
          next.focus();
        }
      });
    });
  });
})();
