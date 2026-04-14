'use strict';

/* ============================================================
   ASSET CONFIG
   ============================================================ */
const ASSETS = {
  bgPattern: 'assets/bg-pattern.png',
};

const AVATAR = 'assets/avatar.jpg';

/* ============================================================
   1. THREE.JS — LIQUID RIPPLE BACKGROUND
      Mouse position drives expanding sine-wave rings.
      Subtle amplitude so it never fights the content.
   ============================================================ */

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
  uniform vec2  u_uvRepeat;   // (vpAsp/imgAsp, 1.0) — fraction of texture width shown
  uniform vec2  u_uvOffset;   // centre-crop offset: ((1-repeat.x)*0.5, 0)
  varying vec2  vUv;

  void main() {
    vec3 bg = vec3(0.09, 0.09, 0.09);

    if (!u_ready) {
      gl_FragColor = vec4(bg, 1.0);
      return;
    }

    // Ripple and drift operate in viewport UV space [0,1]
    vec2 uv = vUv;

    // ── Liquid ripple from cursor ───────────────────────
    vec2  toMouse = uv - u_mouse;
    float dist    = length(toMouse);
    float rings   = sin(dist * 22.0 - u_time * 2.8);
    float falloff = smoothstep(0.55, 0.0, dist);
    uv += normalize(toMouse + 0.0001) * rings * falloff * u_strength;

    // ── Slow idle drift ──────────────────────────────────
    uv.x += sin(uv.y * 7.0 + u_time * 0.32) * 0.003;
    uv.y += cos(uv.x * 5.5 + u_time * 0.25) * 0.0025;

    // ── Fit-height crop: map viewport UV → texture UV ───
    // u_uvRepeat.x < 1 on narrow/portrait screens → centre strip only
    // u_uvRepeat.y = 1 always → full image height, never compressed
    vec2 texUv = uv * u_uvRepeat + u_uvOffset;

    vec4 tex   = texture2D(u_texture, texUv);
    vec3 color = mix(tex.rgb, bg, 0.95);   // 5% pattern opacity

    // Top-to-bottom gradient
    float grad = smoothstep(0.0, 0.75, vUv.y);
    color *= mix(0.25, 1.0, grad);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* UV crop — fit-height, centre-crop width.
   NOTE: texture.repeat/offset have no effect in a custom ShaderMaterial.
   The transform must live in the GLSL uniforms (u_uvRepeat, u_uvOffset). */
function applyUvCrop(uniforms, imgW, imgH, vpW, vpH) {
  const rx = (vpW / vpH) / (imgW / imgH);   // fraction of texture width visible
  uniforms.u_uvRepeat.value.set(rx, 1.0);
  uniforms.u_uvOffset.value.set((1.0 - rx) * 0.5, 0.0);
}

function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  canvas.style.opacity   = '0';
  canvas.style.transition = 'opacity 0.8s ease';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene  = new THREE.Scene();
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
    tex.needsUpdate = true;
    uniforms.u_texture.value = tex;
    const img = tex.image;
    applyUvCrop(uniforms, img.naturalWidth || img.width, img.naturalHeight || img.height, window.innerWidth, window.innerHeight);
    uniforms.u_ready.value = true;
    canvas.style.opacity = '1';
    window.dispatchEvent(new Event('asset-loaded'));
  }

  function applyGrainFallback() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    const id  = ctx.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 32 + 8;
      id.data[i] = id.data[i+1] = id.data[i+2] = v;
      id.data[i+3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c);
    uniforms.u_texture.value = t;
    applyUvCrop(uniforms, 512, 512, window.innerWidth, window.innerHeight);
    uniforms.u_ready.value = true;
    canvas.style.opacity = '1';
    window.dispatchEvent(new Event('asset-loaded'));
  }

  // THREE.TextureLoader handles CORS and HTTPS correctly — new THREE.Texture(img) does not
  new THREE.TextureLoader().load(ASSETS.bgPattern, applyTexture, undefined, applyGrainFallback);

  const mouse = { x: 0.5, y: 0.5 };
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1 - e.clientY / window.innerHeight;
  });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma != null) {
      mouse.x = Math.min(1, Math.max(0, (e.gamma + 90) / 180));
      mouse.y = Math.min(1, Math.max(0, 1 - (e.beta  + 90) / 180));
    }
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const tex = uniforms.u_texture.value;
    if (tex && tex.image) {
      const iw = tex.image.naturalWidth  || tex.image.width  || tex.image.videoWidth;
      const ih = tex.image.naturalHeight || tex.image.height || tex.image.videoHeight;
      if (iw && ih) applyUvCrop(uniforms, iw, ih, window.innerWidth, window.innerHeight);
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

/* ============================================================
   2. INJECT FIGMA AVATAR (preloaded eagerly)
   ============================================================ */
function injectAssets() {
  const av = document.getElementById('avatar-img');
  if (av) av.src = AVATAR;  // local 300×300 JPEG — instant load
}

/* ============================================================
   3. ENTRANCE ANIMATION — full sequenced reveal
   ============================================================ */
function initAnimation() {
  // ── Initial states ───────────────────────────────────────
  gsap.set('.avatar-wrap',                         { autoAlpha: 0, scale: 0.72 });
  gsap.set(['.profile-name', '.experience-badge'], { autoAlpha: 0, y: 18 });
  gsap.set('.avail-badge',                         { autoAlpha: 0, y: 12 });
  gsap.set('.social-icon',                         { autoAlpha: 0, y: 12 });
  gsap.set('.btn-pill',                            { autoAlpha: 0, y: 12 });
  gsap.set('.tools-bar',                           { autoAlpha: 0, y: 12 });
  gsap.set('.press-badge',                         { autoAlpha: 0, y: 10 });
  gsap.set('.service-card',                        { autoAlpha: 0, y: 22 });
  gsap.set('.hero-line',                           { y: '110%', autoAlpha: 0 });
  gsap.set('#coming-soon',                         { autoAlpha: 0 });

  // ── Master timeline ──────────────────────────────────────
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl
    // Page fade-in
    .from('#stage', { autoAlpha: 0, duration: 0.6, ease: 'power2.out' })

    // Avatar pops in with generous spring
    .to('.avatar-wrap', {
      autoAlpha: 1, scale: 1,
      duration: 0.85, ease: 'back.out(1.9)',
    }, 0.15)

    // Name then badge then availability
    .to('.profile-name',     { autoAlpha: 1, y: 0, duration: 0.55 }, 0.45)
    .to('.experience-badge', { autoAlpha: 1, y: 0, duration: 0.50 }, 0.58)
    .to('.avail-badge',      { autoAlpha: 1, y: 0, duration: 0.45 }, 0.68)

    // Social icons cascade left→right
    .to('.social-icon', {
      autoAlpha: 1, y: 0,
      duration: 0.45, ease: 'power3.out', stagger: 0.07,
    }, 0.68)

    // Pill buttons rise
    .to('.btn-pill', {
      autoAlpha: 1, y: 0,
      duration: 0.55, stagger: 0.10,
    }, 0.84)

    // Tools bar floats up
    .to('.tools-bar', {
      autoAlpha: 1, y: 0,
      duration: 0.55,
    }, 0.98)

    // Press badge rises after tools
    .to('.press-badge', {
      autoAlpha: 1, y: 0,
      duration: 0.50,
    }, 1.08)

    // Cards slide up and fade — clearProps lets CSS hover take over cleanly
    .to('.service-card', {
      autoAlpha: 1, y: 0,
      duration: 0.75, stagger: 0.13, ease: 'power4.out',
      clearProps: 'transform',
    }, 0.32)

    // Hero text sweeps up dramatically
    .to('.hero-line', {
      y: 0, autoAlpha: 1,
      duration: 1.1, stagger: 0.14, ease: 'power4.out',
    }, 0.60);

  // Ellipsis pulse — runs forever after intro settles
  gsap.to('.ellipsis-red', {
    opacity: 0.2, duration: 0.9,
    repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.2,
  });
}

/* ============================================================
   4. INTERACTIONS
   ============================================================ */
function initHover() {
  // Whole card is clickable — delegates to its card-btn link
  document.querySelectorAll('.service-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const url = card.dataset.url;
      if (url && !e.target.closest('.card-btn')) window.open(url, '_blank', 'noopener');
    });
  });

  // Sequential video loader — loads one at a time so they don't compete for bandwidth.
  // preload="none" in HTML; we trigger load here then chain to the next.
  const videos = Array.from(document.querySelectorAll('.card-video'));
  let loadIdx = 0;

  function loadNext() {
    if (loadIdx >= videos.length) return;
    const vid = videos[loadIdx++];

    // Loop fallback for browsers that fire 'ended' before native loop restarts
    vid.addEventListener('ended', () => { vid.currentTime = 0; vid.play().catch(() => {}); });

    vid.addEventListener('canplay', () => {
      vid.play().catch(() => {});
      window.dispatchEvent(new Event('video-ready'));
      loadNext(); // chain: start loading next once this one can play
    }, { once: true });

    // Hard fallback: if canplay never fires within 6s, move on anyway
    setTimeout(loadNext, 6000);

    vid.load();
  }

  loadNext();
}

/* ============================================================
   5. FLUID PILL BUTTONS
   ============================================================ */
function initPillButtons() {
  const btnContact = document.getElementById('btn-contact');
  const btnResume  = document.getElementById('btn-resume');
  if (!btnContact || !btnResume) return;

  const DUR  = 0.55;
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

  // Hover drives the fluid swap
  btnContact.addEventListener('mouseenter', () => activate('contact'));
  btnResume.addEventListener('mouseenter',  () => activate('resume'));

  // Leaving the group resets to Contact Me as default
  const pillGroup = btnContact.closest('.btn-pill-group');
  if (pillGroup) {
    pillGroup.addEventListener('mouseleave', () => activate('contact'));
  }

}

/* ============================================================
   6. TYPEWRITER — "Website coming soon..."
      Types in, pauses, erases, pauses, repeats.
   ============================================================ */
function initTypewriter() {
  const el      = document.getElementById('coming-soon');
  const textEl  = document.getElementById('typewriter-text');  // pre-existing span — no DOM recreation
  const text    = 'Website under construction';
  const SPD     = { type: 62, erase: 36, pauseFull: 2600, pauseEmpty: 700 };
  let i = 0, erasing = false;

  function render() {
    textEl.textContent = text.slice(0, i);  // textContent only — no layout thrash
  }

  function tick() {
    if (!erasing) {
      i = Math.min(i + 1, text.length);
      render();
      if (i >= text.length) { erasing = true; setTimeout(tick, SPD.pauseFull); return; }
      setTimeout(tick, SPD.type);
    } else {
      i = Math.max(i - 1, 0);
      render();
      if (i <= 0) { erasing = false; setTimeout(tick, SPD.pauseEmpty); return; }
      setTimeout(tick, SPD.erase);
    }
  }

  // Start after entrance sequence has cleared (≈1.9 s)
  setTimeout(() => {
    gsap.set(el, { autoAlpha: 1 });
    render();
    tick();
  }, 1950);
}

/* ============================================================
   7. LOADER
      Tracks bg texture + 3 card videos. Number counts 0→100
      as each asset fires ready. Red bar fills in parallel.
   ============================================================ */
function initLoader() {
  const loaderEl = document.getElementById('loader');
  const barEl    = document.getElementById('loader-bar');
  const numEl    = document.querySelector('.loader-number');
  if (!loaderEl || !barEl) { initAnimation(); initTypewriter(); return; }

  const TOTAL  = 4;    // bg texture + 3 card videos
  const MIN_MS = 2400;
  let loaded   = 0;
  let current  = 0;    // displayed number
  let target   = 0;    // target number
  const t0     = Date.now();
  let raf      = null;

  // Smooth counter — exponential ease-out: fast start, decelerates near target
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

  function advance() {
    loaded = Math.min(loaded + 1, TOTAL);
    setTarget(Math.round(loaded / TOTAL * 100));
    if (loaded >= TOTAL) scheduleExit();
  }

  function scheduleExit() {
    const wait = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(() => {
      setTarget(100);
      // Wait until counter reaches 100 before fading
      const waitForFull = () => {
        if (current < 100) { setTimeout(waitForFull, 40); return; }
        if (numEl) numEl.textContent = '100';
        setTimeout(() => {
          loaderEl.classList.add('fade-out');
          initAnimation();
          initTypewriter();
          setTimeout(() => loaderEl.remove(), 700);
        }, 280);
      };
      waitForFull();
    }, wait);
  }

  // bg texture ready signal dispatched from initBackground
  window.addEventListener('asset-loaded', advance, { once: true });

  // Videos load sequentially (initiated by initHover), so listen on the window
  // for a custom event fired each time one becomes ready
  window.addEventListener('video-ready', advance);

  // hard fallback — force complete after 10 s
  setTimeout(() => {
    if (loaded < TOTAL) { loaded = TOTAL - 1; advance(); }
  }, 10000);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  injectAssets();
  initBackground();
  initLoader();     // manages initAnimation + initTypewriter timing
  initHover();
  initPillButtons();
});
