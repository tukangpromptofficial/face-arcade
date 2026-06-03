// FACE ARCADE — webcam face filters with retro arcade vibes
let FaceLandmarker, FilesetResolver;

const $ = (id) => document.getElementById(id);

const video = $("video");
const overlay = $("overlay");
const fxlayer = $("fxlayer");
const octx = overlay.getContext("2d");
const fxctx = fxlayer.getContext("2d");

let landmarker = null;
let running = false;
let activeFilters = new Set(["sunglasses"]);
let activeEffects = new Set();
let lastVideoTime = -1;
let lastDetectTime = 0;
let lastFace = null;
let faceLockTimer = 0;
let lostFrames = 0;
let score = 0;
let combo = 1;
let coins = 0;
let blinkCount = 0;
let lastBlink = 0;
let mouthOpenCount = 0;
let lastFps = 60;
let frameCount = 0;
let fpsLastT = performance.now();
let mirror = true;

/* ============ FILTERS ============ */
// Each filter draws on the overlay canvas given landmarks
const FILTERS = {
  sunglasses: {
    name: "SHADES",
    icon: "🕶️",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      // Use eye corners
      const lEye = pts[33];
      const rEye = pts[263];
      const noseTip = pts[1];
      drawBetween(ctx, lEye, rEye, w, h, (cx, cy, dist, angle) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const size = dist * 1.6;
        ctx.font = `${size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🕶️", 0, 0);
        ctx.restore();
      });
    },
  },
  mustache: {
    name: "STACHE",
    icon: "🥸",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const upperLip = pts[13];
      const lCorner = pts[61];
      const rCorner = pts[291];
      drawBetween(ctx, lCorner, rCorner, w, h, (cx, cy, dist, angle) => {
        ctx.save();
        ctx.translate(cx, cy - dist * 0.45);
        ctx.rotate(angle);
        ctx.font = `${dist * 1.8}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🥸", 0, 0);
        ctx.restore();
      });
    },
  },
  crown: {
    name: "CROWN",
    icon: "👑",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const top = pts[10];
      drawAbove(ctx, lEye, rEye, top, w, h, "👑", 1.8);
    },
  },
  hat: {
    name: "PIXEL HAT",
    icon: "🎩",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const top = pts[10];
      drawAbove(ctx, lEye, rEye, top, w, h, "🎩", 2.0);
    },
  },
  fire: {
    name: "ON FIRE",
    icon: "🔥",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const top = pts[10];
      drawAbove(ctx, lEye, rEye, top, w, h, "🔥", 2.2, 0.05);
    },
  },
  halo: {
    name: "HALO",
    icon: "😇",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const top = pts[10];
      drawAbove(ctx, lEye, rEye, top, w, h, "😇", 1.5);
    },
  },
  horns: {
    name: "DEMON",
    icon: "👹",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const top = pts[10];
      drawAbove(ctx, lEye, rEye, top, w, h, "😈", 1.8);
    },
  },
  star: {
    name: "STAR EYES",
    icon: "🤩",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      const eyeDist = dist2D(lEye, rEye) * w;
      const star = "⭐";
      ctx.font = `${eyeDist * 0.45}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(star, lEye.x * w, lEye.y * h);
      ctx.fillText(star, rEye.x * w, rEye.y * h);
    },
  },
  laser: {
    name: "LASERS",
    icon: "🤖",
    color: "yellow",
    draw: (ctx, pts, w, h) => {
      const lEye = pts[33];
      const rEye = pts[263];
      ctx.save();
      ctx.strokeStyle = "#ff2244";
      ctx.lineWidth = 6;
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(lEye.x * w, lEye.y * h);
      ctx.lineTo(0, lEye.y * h - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rEye.x * w, rEye.y * h);
      ctx.lineTo(w, rEye.y * h - 20);
      ctx.stroke();
      ctx.restore();
    },
  },
};

const FILTER_ORDER = [
  "sunglasses",
  "mustache",
  "crown",
  "hat",
  "fire",
  "halo",
  "horns",
  "star",
  "laser",
];

/* ============ EFFECTS ============ */
// Postprocess effects (rendered on fxlayer over the video)
const EFFECTS = {
  scanline: {
    name: "SCANLINE",
    icon: "📺",
    draw: (ctx, w, h) => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
    },
  },
  vignette: {
    name: "VIGNETTE",
    icon: "🌑",
    draw: (ctx, w, h) => {
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  neon: {
    name: "NEON",
    icon: "💖",
    draw: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "rgba(0,255,231,0.18)");
      g.addColorStop(0.5, "rgba(255,43,214,0.12)");
      g.addColorStop(1, "rgba(157,0,255,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  glitch: {
    name: "GLITCH",
    icon: "⚡",
    draw: (ctx, w, h) => {
      const ts = performance.now();
      const sliceY = (Math.sin(ts / 80) * 0.5 + 0.5) * h;
      const sliceH = 30;
      ctx.drawImage(video, 0, sliceY, w, sliceH, 8, sliceY, w, sliceH);
      ctx.fillStyle = "rgba(255,43,214,0.3)";
      ctx.fillRect(0, sliceY, w, 2);
    },
  },
  rainbow: {
    name: "RAINBOW",
    icon: "🌈",
    draw: (ctx, w, h) => {
      const ts = performance.now() / 1000;
      const colors = ["#ff2244", "#ff8a00", "#fff200", "#00ff66", "#00ffe7", "#9d00ff"];
      const stripeH = h / colors.length;
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.12 + Math.sin(ts + i) * 0.05;
        ctx.fillRect(0, i * stripeH, w, stripeH);
      });
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    name: "8-BIT",
    icon: "👾",
    draw: (ctx, w, h) => {
      // Pixelate by reading low-res snapshot, drawing back enlarged
      const small = 80;
      const tmp = document.createElement("canvas");
      tmp.width = small;
      tmp.height = small * (h / w);
      const tctx = tmp.getContext("2d");
      tctx.drawImage(video, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(tmp, 0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
    },
  },
};
const EFFECT_ORDER = ["scanline", "vignette", "neon", "glitch", "rainbow", "pixel"];

/* ============ HELPERS ============ */
function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function drawBetween(ctx, p1, p2, w, h, fn) {
  const cx = ((p1.x + p2.x) / 2) * w;
  const cy = ((p1.y + p2.y) / 2) * h;
  const dist = dist2D(p1, p2) * w;
  const angle = Math.atan2((p2.y - p1.y) * h, (p2.x - p1.x) * w);
  fn(cx, cy, dist, angle);
}
function drawAbove(ctx, lEye, rEye, top, w, h, emoji, scale = 1.5, jitter = 0) {
  const cx = ((lEye.x + rEye.x) / 2) * w;
  const cy = top.y * h;
  const dist = dist2D(lEye, rEye) * w;
  const angle = Math.atan2((rEye.y - lEye.y) * h, (rEye.x - lEye.x) * w);
  ctx.save();
  ctx.translate(cx, cy - dist * 0.6);
  ctx.rotate(angle);
  if (jitter) {
    const j = (Math.random() - 0.5) * jitter * dist * 4;
    ctx.translate(j, 0);
  }
  ctx.font = `${dist * scale}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

/* ============ FACE EVENTS ============ */
function detectBlink(landmarks) {
  // Eye aspect ratio
  const lUp = landmarks[159];
  const lDn = landmarks[145];
  const rUp = landmarks[386];
  const rDn = landmarks[374];
  const lAR = Math.abs(lUp.y - lDn.y);
  const rAR = Math.abs(rUp.y - rDn.y);
  return (lAR + rAR) / 2 < 0.012;
}
function detectMouthOpen(landmarks) {
  const upper = landmarks[13];
  const lower = landmarks[14];
  return Math.abs(upper.y - lower.y) > 0.05;
}

/* ============ RENDER LOOP ============ */
async function renderFrame() {
  if (!running) return;

  const w = (overlay.width = video.videoWidth || 640);
  const h = (overlay.height = video.videoHeight || 480);
  fxlayer.width = w;
  fxlayer.height = h;

  octx.clearRect(0, 0, w, h);
  fxctx.clearRect(0, 0, w, h);

  // FPS
  frameCount++;
  const now = performance.now();
  if (now - fpsLastT > 500) {
    lastFps = Math.round((frameCount * 1000) / (now - fpsLastT));
    $("fps").textContent = lastFps;
    frameCount = 0;
    fpsLastT = now;
  }

  // Detect
  if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, now);
      if (result?.faceLandmarks?.length > 0) {
        lastFace = result.faceLandmarks[0];
        lostFrames = 0;
        faceLockTimer = Math.min(100, faceLockTimer + 4);
      } else {
        lostFrames++;
        faceLockTimer = Math.max(0, faceLockTimer - 6);
        if (lostFrames > 30) lastFace = null;
      }
    } catch (e) {
      console.error("detect err", e);
    }
  }

  // HP lock bar
  const hp = $("hpFill");
  hp.style.width = faceLockTimer + "%";
  $("hpFill").parentElement.parentElement.classList.toggle("lost", faceLockTimer < 30);
  $("lockStat").textContent = lastFace
    ? `LOCKED ${Math.round(faceLockTimer)}%`
    : "SCANNING...";

  // Mirror video sourcing
  // Note: we apply CSS mirror via .mirror class; landmarks come from raw video.
  // To draw overlays aligned with the mirrored view, we mirror the overlay canvas too.
  if (mirror) {
    octx.save();
    octx.translate(w, 0);
    octx.scale(-1, 1);
    fxctx.save();
    fxctx.translate(w, 0);
    fxctx.scale(-1, 1);
  }

  if (lastFace) {
    activeFilters.forEach((id) => {
      try {
        FILTERS[id]?.draw(octx, lastFace, w, h);
      } catch (e) {
        console.warn("filter err", id, e);
      }
    });

    // Scoring on face presence
    if (now - lastDetectTime > 500) {
      lastDetectTime = now;
      score += 10 * combo;
      coins += Math.random() < 0.05 ? 1 : 0;
      $("score").textContent = String(score).padStart(6, "0");
      $("coins").textContent = coins;
    }

    // Blink combo
    if (detectBlink(lastFace)) {
      if (now - lastBlink > 250) {
        blinkCount++;
        combo = Math.min(99, combo + 1);
        $("combo").textContent = "x" + combo;
        popPoints(lastFace, "+" + 100 * combo, "yellow");
        score += 100 * combo;
        $("score").textContent = String(score).padStart(6, "0");
        lastBlink = now;
      }
    } else if (now - lastBlink > 4000) {
      combo = Math.max(1, combo - 1);
      $("combo").textContent = "x" + combo;
      lastBlink = now;
    }

    // Mouth open big bonus
    if (detectMouthOpen(lastFace)) {
      if (now - (mouthOpenCount || 0) > 1200) {
        coins += 5;
        $("coins").textContent = coins;
        popPoints(lastFace, "🪙 +5", "pink");
        toast("🎤 SCREAM BONUS +5 🪙", "pink");
        mouthOpenCount = now;
      }
    }
  }

  if (mirror) {
    octx.restore();
    fxctx.restore();
  }

  activeEffects.forEach((id) => {
    try {
      EFFECTS[id]?.draw(fxctx, fxlayer.width, fxlayer.height);
    } catch (e) {
      console.warn("fx err", id, e);
    }
  });

  requestAnimationFrame(renderFrame);
}

function popPoints(face, text, cls = "") {
  const wrap = $("floatingPoints");
  const div = document.createElement("div");
  div.className = "fp " + cls;
  div.textContent = text;
  const cx = (face[1]?.x || 0.5) * 100;
  const cy = (face[1]?.y || 0.5) * 100;
  div.style.left = cx + "%";
  div.style.top = cy + "%";
  wrap.appendChild(div);
  setTimeout(() => div.remove(), 1400);
}

function toast(text, color = "") {
  const stack = $("toasts");
  const el = document.createElement("div");
  el.className = "toast " + color;
  el.textContent = text;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function bigText(t) {
  const ov = $("overlay-big");
  ov.innerHTML = `<div class="big-text">${t}</div>`;
  setTimeout(() => (ov.innerHTML = ""), 1500);
}

function shake() {
  const el = $("shake");
  el.classList.remove("shaking");
  void el.offsetWidth;
  el.classList.add("shaking");
}

/* ============ INIT MEDIAPIPE ============ */
async function initLandmarker() {
  try {
    if (!FaceLandmarker) {
      const mod = await import(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
      );
      FaceLandmarker = mod.FaceLandmarker;
      FilesetResolver = mod.FilesetResolver;
    }
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
    );
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    $("status").textContent = "● FACE DETECT READY";
  } catch (e) {
    console.error("landmarker init", e);
    $("status").textContent = "✕ FACE DETECT FAILED";
    toast("Face detector failed to load", "red");
  }
}

/* ============ CAMERA ============ */
function showFatalError(title, detail) {
  const ps = $("pressStart");
  ps.classList.remove("hidden");
  ps.innerHTML = `
    <div class="ps-title" style="color:#ff2244">${title}</div>
    <div class="ps-sub" style="font-size:11px;line-height:1.6;max-width:560px;color:#fff;text-align:left">${detail}</div>
    <div class="ps-note" style="margin-top:18px;color:#fff200">▶ TAP TO RETRY ◀</div>
  `;
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showFatalError(
      "NO CAMERA API",
      `Browser ini ga support getUserMedia.<br>Origin: <code>${location.origin}</code><br>Coba browser lain (Chrome/Safari terbaru).`,
    );
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));
    await video.play();
    if (mirror) video.classList.add("mirror");
    $("status").textContent = "● CAMERA LIVE";
    running = true;
    requestAnimationFrame(renderFrame);
    bigText("READY!");
    toast("⚔ FIGHT THE LENS!", "pink");
  } catch (e) {
    console.error("camera err", e);
    $("status").textContent = "✕ CAMERA " + (e.name || "ERR");
    const tips = {
      NotAllowedError:
        "Permission ditolak / di-block.<br>1. Klik icon kamera/gembok di address bar<br>2. Allow camera untuk site ini<br>3. Reload page",
      NotFoundError: "Ga ada camera ke-detect. Pastikan webcam nyala & ga dipake app lain.",
      NotReadableError: "Camera lagi dipake aplikasi lain (Zoom/Meet/etc). Tutup dulu.",
      OverconstrainedError: "Camera ga support resolusi yang diminta.",
      SecurityError: "Origin ga aman. Harus HTTPS atau localhost.",
    };
    showFatalError(
      `CAMERA ${e.name || "ERROR"}`,
      `<b>${e.message || e}</b><br><br>${tips[e.name] || "Unknown error. Check console (F12)."}`,
    );
  }
}

/* ============ UI ============ */
function buildFilterGrid() {
  const grid = $("filterGrid");
  grid.innerHTML = FILTER_ORDER.map((id, i) => {
    const f = FILTERS[id];
    return `<div class="fil ${activeFilters.has(id) ? "active" : ""}" data-fil="${id}">
      <span class="key">${i + 1}</span>
      <div class="ico">${f.icon}</div>
      <div class="name">${f.name}</div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".fil").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.dataset.fil;
      toggleFilter(id);
    }),
  );
}
function buildEffectGrid() {
  const grid = $("effectGrid");
  grid.innerHTML = EFFECT_ORDER.map((id) => {
    const e = EFFECTS[id];
    return `<div class="fil ${activeEffects.has(id) ? "active" : ""}" data-eff="${id}">
      <div class="ico">${e.icon}</div>
      <div class="name">${e.name}</div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".fil").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.dataset.eff;
      toggleEffect(id);
    }),
  );
}
function toggleFilter(id) {
  if (activeFilters.has(id)) activeFilters.delete(id);
  else activeFilters.add(id);
  buildFilterGrid();
  toast(`▶ ${FILTERS[id].name}`, "pink");
}
function toggleEffect(id) {
  if (activeEffects.has(id)) activeEffects.delete(id);
  else activeEffects.add(id);
  buildEffectGrid();
}
function randomFilter() {
  activeFilters.clear();
  const pick = FILTER_ORDER[Math.floor(Math.random() * FILTER_ORDER.length)];
  activeFilters.add(pick);
  buildFilterGrid();
  toast(`🎲 ROLLED: ${FILTERS[pick].name}`, "yellow");
  bigText("ROLL!");
}

/* ============ SNAP ============ */
function snap() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w) return;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const c = tmp.getContext("2d");
  if (mirror) {
    c.save();
    c.translate(w, 0);
    c.scale(-1, 1);
    c.drawImage(video, 0, 0, w, h);
    c.restore();
  } else {
    c.drawImage(video, 0, 0, w, h);
  }
  c.drawImage(overlay, 0, 0, w, h);
  c.drawImage(fxlayer, 0, 0, w, h);
  c.fillStyle = "rgba(255,242,0,0.85)";
  c.font = `bold ${Math.floor(h / 28)}px Press Start 2P, monospace`;
  c.textAlign = "right";
  c.fillText("FACE ARCADE", w - 16, h - 14);

  const dataURL = tmp.toDataURL("image/png");

  // add to strip
  const strip = $("snapStrip");
  if (strip.querySelector(".snap-empty")) strip.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataURL;
  img.title = "click to download";
  img.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `face-arcade-${Date.now()}.png`;
    a.click();
  });
  strip.insertBefore(img, strip.firstChild);
  while (strip.children.length > 24) strip.removeChild(strip.lastChild);

  score += 500;
  $("score").textContent = String(score).padStart(6, "0");
  toast("📸 +500 SNAP!", "yellow");
  bigText("SNAP!");
  shake();
}

/* ============ BG CANVAS PARTICLES ============ */
const bg = $("bgfx");
const bctx = bg.getContext("2d");
let bgParticles = [];
function bgResize() {
  bg.width = innerWidth;
  bg.height = innerHeight;
  bgParticles = Array.from({ length: 70 }, spawnBgP);
}
function spawnBgP() {
  return {
    x: Math.random() * bg.width,
    y: Math.random() * bg.height,
    r: Math.random() * 1.8 + 0.5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.6 - 0.2,
    a: Math.random() * 0.7 + 0.3,
    c: ["#00ffe7", "#ff2bd6", "#fff200"][Math.floor(Math.random() * 3)],
  };
}
function bgLoop() {
  bctx.clearRect(0, 0, bg.width, bg.height);
  bgParticles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.a *= 0.993;
    if (p.y < -20 || p.a < 0.05) {
      bgParticles[i] = spawnBgP();
      bgParticles[i].y = bg.height + 10;
    }
    bctx.fillStyle = p.c;
    bctx.globalAlpha = p.a;
    bctx.shadowBlur = 8;
    bctx.shadowColor = p.c;
    bctx.beginPath();
    bctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bctx.fill();
  });
  bctx.globalAlpha = 1;
  bctx.shadowBlur = 0;
  requestAnimationFrame(bgLoop);
}

/* ============ EVENTS ============ */
$("pressStart").addEventListener("click", async () => {
  $("pressStart").classList.add("hidden");
  await startCamera();
  await initLandmarker();
});
$("snapBtn").addEventListener("click", snap);
$("cycleBtn").addEventListener("click", randomFilter);
$("shakeBtn").addEventListener("click", () => {
  shake();
  bigText("SHAKE!");
});
$("muteBtn").addEventListener("click", () => {
  mirror = !mirror;
  video.classList.toggle("mirror", mirror);
  toast(mirror ? "🪞 MIRROR ON" : "🪞 MIRROR OFF");
});

addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    snap();
  } else if (e.key === "f" || e.key === "F") {
    randomFilter();
  } else if (/^[1-9]$/.test(e.key)) {
    const idx = parseInt(e.key) - 1;
    if (FILTER_ORDER[idx]) toggleFilter(FILTER_ORDER[idx]);
  }
});

addEventListener("resize", bgResize);
bgResize();
bgLoop();
buildFilterGrid();
buildEffectGrid();
activeEffects.add("scanline");
buildEffectGrid();
