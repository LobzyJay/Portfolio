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
/* ── IFRAME SHIELD — was a floating absolute-positioned pill in the
   top-right of each .live-frame; now lives inline inside the chrome
   bar, beside the Open link. Tabbed variants put their Open link in
   .lf-tabs (above the URL row), simple variants put it inside the
   .lf-chrome row, and the footer variant has no Open at all — the
   action picks the right host and inserts before Open if present,
   else appends to the chrome. */
function initIframeShield() {
  const frames = document.querySelectorAll('.live-frame');
  if (!frames.length) return;

  const setLabel = (action, active) => {
    /* Two label spans so the chrome can swap to a shorter text on
       narrow viewports via CSS, without JS having to know breakpoints. */
    action.innerHTML = '';
    const full = document.createElement('span');
    full.className = 'lf-action-full';
    full.textContent = active ? 'Active · click to release' : 'Click to interact';
    const short = document.createElement('span');
    short.className = 'lf-action-short';
    short.textContent = active ? 'Release' : 'Interact';
    action.append(full, short);
  };

  frames.forEach((frame) => {
    if (frame.querySelector('.lf-action')) return; // idempotent

    /* Pick the host: tabbed variant has Open inside .lf-tabs; simple
       variants have Open (or nothing) inside .lf-chrome. */
    const tabs = frame.querySelector('.lf-tabs');
    const chrome = frame.querySelector('.lf-chrome');
    let host = null;
    let beforeNode = null;
    if (tabs && tabs.querySelector('.lf-open')) {
      host = tabs;
      beforeNode = tabs.querySelector('.lf-open');
    } else if (chrome) {
      host = chrome;
      beforeNode = chrome.querySelector('.lf-open');
    }
    if (!host) return;

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'lf-action';
    action.setAttribute('aria-pressed', 'false');
    setLabel(action, false);
    if (beforeNode) host.insertBefore(action, beforeNode);
    else host.appendChild(action);

    action.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = frame.classList.toggle('is-active');
      action.setAttribute('aria-pressed', active ? 'true' : 'false');
      setLabel(action, active);
    });

    /* Auto-release when iframe scrolls out of view. */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && frame.classList.contains('is-active')) {
            frame.classList.remove('is-active');
            action.setAttribute('aria-pressed', 'false');
            setLabel(action, false);
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
  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  const frames = Array.from(document.querySelectorAll('[data-parallax]'));
  if (!frames.length) return;

  /* IntersectionObserver gates which items are currently visible so
     the rAF loop only does layout work for items in (or near) the
     viewport — the rest sit untouched until they scroll in. Biggest
     win on mobile where scroll cost matters most. */
  const visible = new Set();
  const items = frames.map((frame) => {
    const img = frame.querySelector('img');
    if (!img) return null;
    img.style.transformOrigin = 'center center';
    img.style.willChange = 'transform';
    img.style.transition = 'transform 0.12s linear';
    let min = parseFloat(frame.dataset.parallaxMin);
    let max = parseFloat(frame.dataset.parallaxMax);
    if (!Number.isFinite(min)) min = 1.0;
    if (!Number.isFinite(max)) max = 1.02;
    /* Compress the parallax range on mobile so each scroll tick
       triggers a smaller transform delta — keeps the effect, drops
       the per-frame composite cost roughly in half. */
    if (isMobile) {
      const range = max - min;
      max = min + range * 0.5;
    }
    return { frame, img, min, max };
  }).filter(Boolean);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const item = items.find((it) => it.frame === entry.target);
        if (!item) return;
        if (entry.isIntersecting) visible.add(item);
        else visible.delete(item);
      });
    }, { rootMargin: '100px 0px' });
    items.forEach((it) => io.observe(it.frame));
  } else {
    items.forEach((it) => visible.add(it));
  }

  let raf = 0;
  function update() {
    const vh = window.innerHeight;
    visible.forEach(({ frame, img, min, max }) => {
      const r = frame.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      const scale = min + (max - min) * p;
      img.style.transform = `scale(${scale.toFixed(4)})`;
    });
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
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

    /* Model credit on the status line. Day 0 + the early ramp ran on
       Sonnet in Claude chat (the brief, the audit, the PRD). Once the
       build started in Claude Code the rest of it rolled on Opus 4.7,
       so the credit swaps when the needle passes the day-2 mark. */
    tokenStatus.textContent = d < 2 ? 'Claude Sonnet' : 'Claude Opus 4.7';
    /* The big number + gauge needle already carry the burn state via
       red colour shift; keep is-burning / is-exhausted on the NUMBER. */
    tokenNum.classList.remove('is-burning', 'is-exhausted');
    if (d >= 3 && d < BURN_DAY) {
      tokenNum.classList.add('is-burning');
    } else if (d >= BURN_DAY) {
      tokenNum.classList.add('is-exhausted');
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
/* ── PROMPT-HINT click-to-reveal.
   <details> hides its body content via UA display:none the instant
   [open] is removed, which means an outro animation hooked on the
   `toggle` event has nothing to animate (scrollHeight = 0 by then).
   Pattern below intercepts the click, runs a WAAPI height/opacity
   animation manually, and only flips d.open at the END of the close
   animation so the browser's hide is invisible. */
function initPromptHints() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hints = Array.from(document.querySelectorAll('details.prompt-hint'));
  if (!hints.length) return;

  const OPEN_EASE  = 'cubic-bezier(0.16, 1, 0.3, 1)';     // ease-out, snappy in
  /* easeIn for the close: slow start, fast finish. WAAPI applies one
     easing to every animated property — with a standard ease, opacity
     hits 0 well before height does, leaving a residual layout tail.
     Accelerating curve makes height finish its motion at the same
     moment opacity does, so the layout snaps shut in sync. */
  const CLOSE_EASE = 'cubic-bezier(0.55, 0, 1, 0.45)';
  const OPEN_MS  = 380;
  const CLOSE_MS = 440;

  hints.forEach((d) => {
    const content = d.querySelector('.ph-content');
    const trigger = d.querySelector('summary');
    if (!content || !trigger) return;

    let activeAnim = null;
    let isAnimating = false;

    function cancelAnim() {
      if (activeAnim) { try { activeAnim.cancel(); } catch (_) {} activeAnim = null; }
      d._activeAnim = null;
      isAnimating = false;
    }

    function animateOpen() {
      if (reduce) { d.open = true; return; }
      cancelAnim();
      d.open = true;
      const cs = getComputedStyle(content);
      const marginTop = cs.marginTop;
      const target = content.scrollHeight;
      isAnimating = true;
      activeAnim = content.animate(
        [
          { height: '0px', opacity: 0, transform: 'translateY(-6px)', marginTop: '0px' },
          { height: `${target}px`, opacity: 1, transform: 'translateY(0)', marginTop }
        ],
        { duration: OPEN_MS, easing: OPEN_EASE, fill: 'forwards' }
      );
      d._activeAnim = activeAnim;
      activeAnim.onfinish = () => { isAnimating = false; activeAnim = null; d._activeAnim = null; };
    }

    function animateClose() {
      if (!d.open) return;
      if (reduce) { d.open = false; return; }
      cancelAnim();
      const cs = getComputedStyle(content);
      const marginTop = cs.marginTop;
      const target = content.scrollHeight;
      isAnimating = true;
      // Flag the close NOW so the trigger pill + sub label start their
      // CSS outros in parallel with the body height animation.
      d.setAttribute('data-closing', '');
      activeAnim = content.animate(
        [
          // Animate margin-top alongside height so the gap between
          // pill and body collapses WITH the body, not after. Without
          // this the body shrinks to 0 but its 14px top-margin lingers
          // until [open] is flipped, reading as a leftover gap.
          { height: `${target}px`, opacity: 1, transform: 'translateY(0)', marginTop },
          { height: '0px', opacity: 0, transform: 'translateY(-6px)', marginTop: '0px' }
        ],
        { duration: CLOSE_MS, easing: CLOSE_EASE, fill: 'forwards' }
      );
      d._activeAnim = activeAnim;
      activeAnim.onfinish = () => {
        // Order matters: flip [open]=false FIRST so the CSS expansion
        // rules (which key off [open]:not([data-closing])) can't re-
        // fire for one frame between the data-closing removal and the
        // open flip. Removing data-closing after is a no-op visually.
        d.open = false;
        d.removeAttribute('data-closing');
        isAnimating = false;
        activeAnim = null;
        d._activeAnim = null;
      };
    }

    /* Restore from a mid-flight close back to fully-open, with a
       smooth height animation instead of letting cancelAnim() snap
       the body back to natural height in 0ms. Reads the current
       frozen height before cancelling, removes data-closing so CSS
       can take over opacity/transform, then runs a short WAAPI from
       current → target to bridge height + marginTop smoothly. */
    function animateRestore() {
      if (reduce) {
        if (activeAnim) { try { activeAnim.cancel(); } catch (_) {} }
        d.removeAttribute('data-closing');
        d._activeAnim = null;
        isAnimating = false;
        activeAnim = null;
        return;
      }
      const currentHeight = content.getBoundingClientRect().height;
      const currentMargin = getComputedStyle(content).marginTop;
      // Cancel the close keyframes (drops fill:forwards inline values).
      // Removing data-closing re-engages CSS [open]:not([data-closing])
      // so opacity/transform restore via the CSS fallback transitions.
      if (activeAnim) { try { activeAnim.cancel(); } catch (_) {} }
      d.removeAttribute('data-closing');
      const target = content.scrollHeight;
      const targetMargin = getComputedStyle(content).marginTop;
      isAnimating = true;
      activeAnim = content.animate(
        [
          { height: `${currentHeight}px`, marginTop: currentMargin },
          { height: `${target}px`, marginTop: targetMargin }
        ],
        { duration: 280, easing: OPEN_EASE, fill: 'forwards' }
      );
      d._activeAnim = activeAnim;
      activeAnim.onfinish = () => {
        isAnimating = false;
        activeAnim = null;
        d._activeAnim = null;
      };
    }

    /* Custom click handler — prevent the native open/close so we can
       drive the animation ourselves. */
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      // If a close is in flight, treat the click as "abort + reopen"
      // and animate back to full height instead of dropping it.
      if (isAnimating && d.hasAttribute('data-closing')) {
        animateRestore();
        return;
      }
      if (isAnimating) return;
      if (d.open) animateClose(); else animateOpen();
    });

    /* Mouseleave fires the close immediately. The earlier grace was a
       40ms buffer for tiny overshoots, but with the shorter close
       duration the buffer reads as lag. */
    d.addEventListener('mouseleave', () => {
      if (d._closeTimer) clearTimeout(d._closeTimer);
      if (d.open && !isAnimating) animateClose();
    });
    /* Mouseenter cancels both the pending close AND any in-flight
       close animation, smoothly restoring the body to its natural
       height instead of snapping it back. */
    d.addEventListener('mouseenter', () => {
      if (d._closeTimer) { clearTimeout(d._closeTimer); d._closeTimer = null; }
      if (isAnimating && d.hasAttribute('data-closing')) {
        animateRestore();
      }
    });

    /* Suppress the native toggle handler from running anything. The
       click handler above keeps things in sync. */
    d.addEventListener('toggle', () => { /* no-op */ });
  });

  /* Auto-close when the hint scrolls out of the viewport. Body is
     off-screen so we skip the eased close — but still cancel any
     in-flight WAAPI so we don't leave the body in an intermediate
     state when [open] flips. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const d = entry.target;
        if (!entry.isIntersecting && d.open) {
          // Cancel any close animation in flight; the body is going
          // off-screen anyway, no point keeping the keyframes ticking.
          if (d._activeAnim) { try { d._activeAnim.cancel(); } catch (_) {} }
          d.removeAttribute('data-closing');
          d.open = false;
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    hints.forEach((d) => io.observe(d));
  }
}

/* ── ACCORDION REVEAL — when a chapter accordion opens, fade-rise its
   body children with a stagger. The CSS animation on .chapter-body
   was a single block fade that read as instant; this gives each
   element (picture, paragraphs, pull-quote, iframe) its own
   choreographed entry. Day 1's chapter-prose-rail wraps the picture +
   prose inside one block — we recurse one level into it so each
   inner element animates individually. */
function initAccordionReveal() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  document.querySelectorAll('.chapter--accordion').forEach((chapter) => {
    chapter.addEventListener('toggle', () => {
      if (!chapter.open) return;
      const body = chapter.querySelector(':scope > .chapter-body');
      if (!body) return;

      /* Build the stagger list. For Day 1, chapter-prose-rail is a
         single direct child of chapter-body that wraps the photo +
         all prose; recurse into it so inner items animate one by one. */
      const targets = [];
      Array.from(body.children).forEach((child) => {
        if (child.classList.contains('chapter-prose-rail')) {
          targets.push(...Array.from(child.children));
        } else {
          targets.push(child);
        }
      });
      if (!targets.length) return;

      targets.forEach((el, i) => {
        try {
          el.animate(
            [
              { opacity: 0, transform: 'translateY(14px)' },
              { opacity: 1, transform: 'translateY(0)' }
            ],
            {
              duration: 480,
              delay: 80 + i * 70,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              fill: 'both'
            }
          );
        } catch (_) {}
      });
    });
  });
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
  initAccordionReveal();
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
