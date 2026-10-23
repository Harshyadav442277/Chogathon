// Shared helpers for the motion-design pages. Every page builds one paused GSAP timeline (window.tl) and may
// register per-frame canvas drawers; render.mjs calls window.seek(t) for each frame, so everything is a pure
// function of time (deterministic, frame-accurate).
window.drawers = [];
window.seek = (t) => {
  window.tl.time(t, false);
  for (const d of window.drawers) d(t);
};

// Deterministic pseudo-random numbers.
window.rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

// Snow / dust drifting down, a pure function of time.
window.makeSnow = (canvas, { count = 220, seed = 7, speed = 60, drift = 30, color = "255,255,255", alpha = 0.8 } = {}) => {
  const ctx = canvas.getContext("2d");
  const r = window.rng(seed);
  const flakes = Array.from({ length: count }, () => ({ x: r() * 1920, y: r() * 1080, s: 0.4 + r() * 1.6, p: r() * 6.28, z: 0.3 + r() * 0.7 }));
  return (t) => {
    ctx.clearRect(0, 0, 1920, 1080);
    for (const f of flakes) {
      const y = (f.y + t * speed * f.z) % 1100 - 10;
      const x = (f.x + Math.sin(t * 0.6 + f.p) * drift * f.z + 1920) % 1920;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${alpha * f.z})`;
      ctx.arc(x, y, f.s * 1.6, 0, 6.283);
      ctx.fill();
    }
  };
};

// Star field with twinkle.
window.makeStars = (canvas, { count = 260, seed = 3 } = {}) => {
  const ctx = canvas.getContext("2d");
  const r = window.rng(seed);
  const stars = Array.from({ length: count }, () => ({ x: r() * 1920, y: r() * 1080, s: 0.5 + r() * 1.8, p: r() * 6.28, f: 0.6 + r() * 2 }));
  return (t) => {
    ctx.clearRect(0, 0, 1920, 1080);
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.f + s.p));
      ctx.fillStyle = `rgba(255,244,214,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, 6.283);
      ctx.fill();
    }
  };
};

// Wait for web fonts and images before the first frame.
window.ready = async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((res) => { i.onload = i.onerror = res; }))));
  return true;
};

// Count a number up inside an element: used by timelines via onUpdate.
window.countTo = (el, from, to, fmt = (n) => Math.round(n).toLocaleString("en-US")) => ({
  v: 0, update(p) { el.textContent = fmt(from + (to - from) * p); },
});
