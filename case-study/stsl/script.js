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

/* ── 5. MAGNETIC BUTTON (back-to-portfolio) ──────────────── */
function initMagneticBtn() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const btns = document.querySelectorAll('.magnetic-btn');
  btns.forEach((btn) => {
    let raf = 0;
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.28;
      const y = (e.clientY - r.top - r.height / 2) * 0.42;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
    btn.addEventListener('mouseleave', () => {
      cancelAnimationFrame(raf);
      btn.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
      btn.style.transform = 'translate(0, 0)';
      setTimeout(() => { btn.style.transition = ''; }, 600);
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.transition = '';
    });
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
    return { frame, img };
  }).filter(Boolean);

  const SCALE_MIN = 1.0;
  const SCALE_MAX = 1.18;

  let raf = 0;
  function update() {
    const vh = window.innerHeight;
    items.forEach(({ frame, img }) => {
      const r = frame.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      const scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * p;
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

/* ── BOOT ─────────────────────────────────────────────────── */
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
