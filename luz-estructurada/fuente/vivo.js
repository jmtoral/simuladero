// La parte viva: el tejido iluminado (canvas en el plano del dibujo), la secuencia de patrones,
// el píxel seguido, los LED, el monitor y la lectura. Usa el kit (iso, pathOf…) y el modelo pegados antes.
const D = __DATA__;
const root = document.querySelector(".se");
const stage = root.querySelector(".se-stage");
const back = stage.querySelector(".se-back");
const front = stage.querySelector(".se-front");
const canvas = stage.querySelector(".se-gl");
const readout = root.querySelector("[data-readout]");
const said = stage.querySelector(".se-said");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const DARK = root.closest("[data-theme]")?.getAttribute("data-theme") === "dark";
const P = D.P;
const part = (name, from = front) => from.querySelector(`[data-part="${name}"]`);
const rays = { l: part("ray-l"), r: part("ray-r"), p: part("ray-p"), probe: part("probe") };
const silhouette = part("silhouette");
const marks = part("marks");
const osd = part("osd");
const eyes = [...front.querySelectorAll("image[data-eye]")];
const leds = [...back.querySelectorAll(".se-led")];
const projLed = part("proj-led", back);
const STEPS = 12;                                     // 0 luz blanca · 1..10 patrones · 11 mapa de profundidad
const HOLD = [1.8, ...Array(10).fill(1.15), 3.6];
const comma = (x, n = 1) => x.toFixed(n);
const clampTo = (x, a, b) => Math.min(b, Math.max(a, x));

// Resorte críticamente amortiguado: llega sin pasarse.
function settle(s, target, dt, seconds, calm) {
  if (calm) { s.x = target; s.v = 0; return false; }
  const w = 1 / seconds;
  for (let i = 0; i < 4; i++) { s.v += (w * w * (target - s.x) - 2 * w * s.v) * (dt / 4); s.x += s.v * (dt / 4); }
  if (Math.abs(target - s.x) < 1e-4 && Math.abs(s.v) < 1e-4) { s.x = target; s.v = 0; return false; }
  return true;
}

// ---------- Del dibujo al mundo ----------
const { sinA, cosA, sinE, cosE, k: KS } = cameraOf(P);
function groundAt(sx, sy, z) {
  const a = (sx - P.origin[0]) / KS, b = ((sy - P.origin[1]) / KS + z * cosE) / sinE;
  return [a * sinA + b * cosA, -a * cosA + b * sinA, z];
}
// Primer punto del tejido bajo un punto del dibujo, o null.
function pick(sx, sy) {
  const top = TISSUE.top + 1, steps = 44;
  let hi = top, lo = null;
  for (let i = 1; i <= steps; i++) {
    const z = top + ((TRAY.floor - top) * i) / steps, p = groundAt(sx, sy, z);
    if (z <= heightAt(p[0], p[1]) + 1e-6 && insideOf(p[0], p[1]) > 0) { lo = z; break; }
    hi = z;
  }
  if (lo === null) return null;
  for (let i = 0; i < 9; i++) { const z = (hi + lo) / 2, p = groundAt(sx, sy, z); if (z <= heightAt(p[0], p[1]) && insideOf(p[0], p[1]) > 0) lo = z; else hi = z; }
  return groundAt(sx, sy, lo);
}
const normalAt = (x, y) => {
  const e = 0.2, dx = (heightAt(x + e, y) - heightAt(x - e, y)) / (2 * e), dy = (heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e);
  const l = Math.hypot(dx, dy, 1);
  return [-dx / l, -dy / l, 1 / l];
};
const toward = (p, q) => { const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; };
const LIGHT = (() => { const l = [-0.45, 0.35, 0.82], n = Math.hypot(...l); return l.map((v) => v / n); })();
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Qué recibe cada punto: luz del cuarto, del endoscopio (luz blanca) y del proyector.
function lightingAt(p) {
  const n = normalAt(p[0], p[1]);
  return {
    amb: 0.5 + 0.5 * dot3(n, LIGHT),
    lamW: Math.max(0, dot3(n, toward(p, SCOPE.at))),
    lamP: Math.max(0, dot3(n, toward(p, PROJ.at))),
    code: (columnOf(p) * CODES) / PROJ.W,
    depth: SCOPE.at[2] - p[2],
  };
}

// Franja del patrón k filtrada por el ancho del píxel w (en códigos): sin dientes, gris donde es más fina que un píxel.
const sqInt = (x) => Math.floor(x / 2) + Math.max(0, (x / 2 - Math.floor(x / 2)) * 2 - 1);
function stripe(code, k, w) {
  if (k < 1) return 0;
  const j = BITS - k, x = (code + 2 ** j) / 2 ** (j + 1), wx = Math.max(w / 2 ** (j + 1), 1e-4);
  return (sqInt(x + wx / 2) - sqInt(x - wx / 2)) / wx;
}

// ---------- Mapa de impactos del canvas: se calcula una vez por tamaño ----------
let map = null;
const box = (() => {
  const pts = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const z of [TRAY.floor, TISSUE.top + 1]) pts.push(iso([x * (TISSUE.half[0] + 3), y * (TISSUE.half[1] + 3), z], P));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2];
})();
function buildMap() {
  const ratio = Math.min(1.5, devicePixelRatio || 1);
  const width = Math.round(stage.clientWidth * ratio), height = Math.round((width * D.H) / D.W);
  if (!width) return;
  canvas.width = width; canvas.height = height;
  const s = width / D.W;
  const x0 = Math.floor(box[0] * s), y0 = Math.floor(box[1] * s), w = Math.ceil(box[2] * s) - x0, h = Math.ceil(box[3] * s) - y0;
  const N = w * h;
  const m = { s, x0, y0, w, h, cover: new Float32Array(N), amb: new Float32Array(N), lamW: new Float32Array(N), lamP: new Float32Array(N), code: new Float32Array(N), dcode: new Float32Array(N), depth: new Float32Array(N), ddepth: new Float32Array(N), hx: new Float32Array(N), hy: new Float32Array(N) };
  const hit = new Array(N);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) hit[j * w + i] = pick((x0 + i + 0.5) / s, (y0 + j + 0.5) / s);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const at = j * w + i, p = hit[at];
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const q = hit[(j + b) * w + i + a]; return i + a >= 0 && i + a < w && j + b >= 0 && j + b < h && !q !== !p; });
    let cover = p ? 1 : 0, sample = p;
    if (edge) {
      // En el borde: 4 × 4 submuestras para la cobertura, y la más cercana al centro como muestra
      let n = 0;
      for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { const q = pick((x0 + i + (a + 0.5) / 4) / s, (y0 + j + (b + 0.5) / 4) / s); if (q) { n++; if (!sample) sample = q; } }
      cover = n / 16;
    }
    m.cover[at] = cover;
    if (!sample) continue;
    const L = lightingAt(sample);
    m.amb[at] = L.amb; m.lamW[at] = L.lamW; m.lamP[at] = L.lamP; m.code[at] = L.code; m.depth[at] = L.depth; m.hx[at] = sample[0]; m.hy[at] = sample[1];
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const at = j * w + i;
    if (!m.cover[at]) continue;
    const near = (a, b) => { const q = (j + b) * w + i + a; return i + a >= 0 && i + a < w && j + b >= 0 && j + b < h && m.cover[q] ? q : -1; };
    let dc = 0, dz = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = near(a, b); if (q >= 0) { dc = Math.max(dc, Math.abs(m.code[q] - m.code[at])); dz = Math.max(dz, Math.abs(m.depth[q] - m.depth[at])); } }
    m.dcode[at] = Math.min(dc, 64); m.ddepth[at] = Math.min(dz, 4);
  }
  m.image = new ImageData(w, h);
  map = m;
  drawSilhouette();
}

// La silueta superior del tejido en el SVG de adelante: el primer impacto de cada columna del dibujo.
function drawSilhouette() {
  const pts = [];
  for (let sx = box[0]; sx <= box[2]; sx += 0.7) {
    let found = null;
    for (let sy = box[1]; sy <= box[3]; sy += 0.6) if (pick(sx, sy)) { found = sy; break; }
    if (found === null) { if (pts.length > 1) break; pts.length = 0; continue; }
    let a = found - 0.6, b = found;
    for (let i = 0; i < 8; i++) { const c = (a + b) / 2; if (pick(sx, c)) b = c; else a = c; }
    pts.push([sx, b]);
  }
  silhouette.setAttribute("d", pathOf(pts));
}

// ---------- Paleta del tejido (lo que debe verse sobre el papel) ----------
const TONE = DARK ? { shadow: [26, 21, 21], lit: [214, 184, 178], line: [244, 238, 236] } : { shadow: [150, 118, 114], lit: [250, 238, 234], line: [30, 24, 24] };
function paint(u) {
  const m = map;
  if (!m) return;
  const data = m.image.data, N = m.w * m.h, pr = PROBE_R, rw = 0.42;
  for (let at = 0; at < N; at++) {
    const o = at * 4, cover = m.cover[at];
    if (!cover) { data[o + 3] = 0; continue; }
    const s = u.proj > 1e-4 ? u.proj * m.lamP[at] * ((1 - u.mix) * stripe(m.code[at], u.bitA, m.dcode[at]) + u.mix * stripe(m.code[at], u.bitB, m.dcode[at])) : 0;
    const e = Math.min(1.15, 0.2 * m.amb[at] + 0.85 * u.white * m.lamW[at] + 0.95 * s);
    const t = Math.min(1, e);
    let r = TONE.shadow[0] + (TONE.lit[0] - TONE.shadow[0]) * t, g = TONE.shadow[1] + (TONE.lit[1] - TONE.shadow[1]) * t, b = TONE.shadow[2] + (TONE.lit[2] - TONE.shadow[2]) * t;
    if (u.map > 1e-4) {
      // Curvas de igual profundidad cada 2 mm, como el mapa de la Fig. 1 del artículo
      const z = m.depth[at] / 2, f = Math.abs(z - Math.round(z)) * 2, width = Math.max(m.ddepth[at] / 2, 0.02) * 2.2;
      const line = u.map * Math.max(0, 1 - f / width) * 0.75;
      r += (TONE.line[0] - r) * line; g += (TONE.line[1] - g) * line; b += (TONE.line[2] - b) * line;
    }
    if (u.probe) {
      const d = Math.hypot(m.hx[at] - u.probe[0], m.hy[at] - u.probe[1]);
      const ring = Math.max(0, 1 - Math.abs(d - pr) / rw);
      if (ring > 0) { r += (TONE.line[0] - r) * ring; g += (TONE.line[1] - g) * ring; b += (TONE.line[2] - b) * ring; }
    }
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255 * cover;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(m.image, m.x0, m.y0);
}
const PROBE_R = 2.4;

// ---------- Las dos cámaras del endoscopio (128 × 102, la imagen de 1280 × 1024 a un décimo) ----------
const EW = 128, EH = 102, ESCALE = SCOPE.W / EW;
const eyeMaps = [-1, 1].map((side) => {
  const N = EW * EH, e = { code: new Float32Array(N), lamP: new Float32Array(N), lamW: new Float32Array(N), depth: new Float32Array(N), inside: new Uint8Array(N) };
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const p = hitOf(side, (i + 0.5) * ESCALE, (j + 0.5) * ESCALE), at = j * EW + i, L = lightingAt(p);
    e.code[at] = L.code; e.lamP[at] = L.lamP; e.lamW[at] = L.lamW; e.depth[at] = L.depth; e.inside[at] = insideOf(p[0], p[1]) > 0 ? 1 : 0;
  }
  return e;
});
const eyeCanvas = Object.assign(document.createElement("canvas"), { width: EW, height: EH });
const depthRange = (() => { let lo = Infinity, hi = -Infinity; for (const e of eyeMaps) for (let i = 0; i < e.depth.length; i++) if (e.inside[i]) { lo = Math.min(lo, e.depth[i]); hi = Math.max(hi, e.depth[i]); } return [lo, hi]; })();
function paintEyes(step) {
  const ctx = eyeCanvas.getContext("2d");
  eyeMaps.forEach((e, side) => {
    const img = ctx.createImageData(EW, EH);
    for (let at = 0; at < EW * EH; at++) {
      let v;
      if (!e.inside[at]) v = 18;
      else if (step === 0) v = 40 + 200 * e.lamW[at];
      else if (step <= BITS) v = 22 + 220 * e.lamP[at] * litBy(Math.floor(e.code[at]), step);
      else v = 30 + 215 * (depthRange[1] - e.depth[at]) / (depthRange[1] - depthRange[0]);
      img.data[at * 4] = img.data[at * 4 + 1] = img.data[at * 4 + 2] = v; img.data[at * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    eyes[side].setAttribute("href", eyeCanvas.toDataURL());
  });
}

// ---------- Estado ----------
const env = { white: { x: 1, v: 0 }, proj: { x: 0, v: 0 }, map: { x: 0, v: 0 }, mix: { x: 1, v: 0 } };
let step = 0, held = 0, playing = !still.matches, bitA = 1, bitB = 1;
const probe = { x: 18, y: -6 }, aim = { x: 18, y: -6 };
let hovering = false, wander = 0, wanderTimer = 0, frame = 0, last = 0, visible = false, painted = "";

function goTo(next) {
  next = ((next % STEPS) + STEPS) % STEPS;
  if (next >= 1 && next <= BITS) { bitA = step >= 1 && step <= BITS ? bitB : next; bitB = next; env.mix.x = bitA === bitB ? 1 : 0; env.mix.v = 0; }
  step = next; held = 0;
  paintEyes(step);
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", phaseText());
  run();
}
const phaseText = () => (step === 0 ? "White light: reference image" : step <= BITS ? `Pattern ${step} of ${BITS}` : "Decoded depth map");

function probePoint() { return [probe.x, probe.y, heightAt(probe.x, probe.y)]; }
function describe(p) {
  const n = codeOf(p), d = disparityOf(p);
  if (step === 0) return { text: "white light · reference image", n, d };
  if (step <= BITS) {
    const seen = Array.from({ length: step }, (_, i) => litBy(n, i + 1)).join("");
    const left = 1 << (BITS - step);
    return { text: `pattern ${step}/${BITS} · ${seen} · ${left === 1 ? "1 stripe" : `${left} possible stripes`}`, n, d };
  }
  return { text: `code ${n} · d ${comma(d)} px · Z ${comma(depthFrom(d))} mm`, n, d };
}

function drawSvg(p, info) {
  const lens = [-1, 1].map((side) => [SCOPE.at[0] + (side * SCOPE.B) / 2, SCOPE.at[1], SCOPE.at[2]]);
  rays.l.setAttribute("d", pathOf([iso(lens[0], P), iso(p, P)]));
  rays.r.setAttribute("d", pathOf([iso(lens[1], P), iso(p, P)]));
  rays.p.setAttribute("d", pathOf([iso([PROJ.at[0] + PF[0] * 6, PROJ.at[1] + PF[1] * 6, PROJ.at[2] + PF[2] * 6], P), iso(p, P)]));
  rays.p.style.opacity = env.proj.x.toFixed(3);
  const [px, py] = iso(p, P);
  rays.probe.innerHTML = `<g class="iso-dots" data-tone="lit"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="0.9"/></g>`;
  if (projLed) projLed.style.opacity = (0.25 + 0.75 * env.proj.x).toFixed(3);
  // LED: un bit por patrón ya capturado
  leds.forEach((led, i) => {
    const shown = step > BITS || i < Math.min(step, BITS);
    if (!shown) led.removeAttribute("data-bit");
    else led.setAttribute("data-bit", String(litBy(info.n, i + 1)));
  });
  // Monitor: cruz en la izquierda; en la derecha, la franja de la fila que todavía comparte el código
  const L = pixelOf(-1, p), Rr = pixelOf(1, p);
  const sx = D.screen.w / SCOPE.W, sy = D.screen.h / SCOPE.H;
  const cross = (eye, u, v) => {
    const x = D.screen.imgX[eye] + u * sx, y = D.screen.imgY + v * sy;
    return `<path class="se-cross" d="M${(x - 3).toFixed(2)} ${y.toFixed(2)}h2M${(x + 1).toFixed(2)} ${y.toFixed(2)}h2M${x.toFixed(2)} ${(y - 3).toFixed(2)}v2M${x.toFixed(2)} ${(y + 1).toFixed(2)}v2"/>`;
  };
  let svg = "";
  if (step >= 1) {
    svg += cross(0, L[0], L[1]);
    const k = Math.min(step, BITS), want = prefixOf(info.n, k).prefix, row = Math.floor(Rr[1] / ESCALE), e = eyeMaps[1];
    if (row >= 0 && row < EH) {
      let from = -1;
      for (let i = 0; i <= EW; i++) {
        const on = i < EW && e.inside[row * EW + i] && prefixOf(Math.floor(e.code[row * EW + i]), k).prefix === want;
        if (on && from < 0) from = i;
        if (!on && from >= 0) { svg += `<rect class="se-band" x="${(D.screen.imgX[1] + from * (D.screen.w / EW)).toFixed(2)}" y="${(D.screen.imgY + row * (D.screen.h / EH)).toFixed(2)}" width="${((i - from) * (D.screen.w / EW)).toFixed(2)}" height="${(D.screen.h / EH).toFixed(2)}"/>`; from = -1; }
      }
    }
    if (step >= BITS) svg += cross(1, Rr[0], Rr[1]);
  } else svg += cross(0, L[0], L[1]);
  marks.innerHTML = svg;
  osd.textContent = step === 0 ? "WHITE LIGHT" : step <= BITS ? `PATTERN ${step}/${BITS}` : `DEPTH · d ${comma(info.d)} px`;
  if (readout.textContent !== info.text) readout.textContent = info.text;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (playing) { held += dt; if (held >= HOLD[step]) goTo(step + 1); }
  let moving = false;
  moving = settle(env.white, step === 0 ? 1 : step > BITS ? 0.55 : 0, dt, 0.18, calm) || moving;
  moving = settle(env.proj, step >= 1 && step <= BITS ? 1 : 0, dt, 0.16, calm) || moving;
  moving = settle(env.map, step > BITS ? 1 : 0, dt, 0.3, calm) || moving;
  moving = settle(env.mix, 1, dt, 0.05, calm) || moving;
  if (!hovering && playing && !calm) { wander += dt; aim.x = 34 * Math.sin(wander * 0.23 + 0.6); aim.y = -4 + 15 * Math.sin(wander * 0.37 + 1.3); }
  const f = calm ? 1 : 1 - Math.exp(-dt / 0.2);
  probe.x += (aim.x - probe.x) * f; probe.y += (aim.y - probe.y) * f;
  if (Math.hypot(aim.x - probe.x, aim.y - probe.y) < 0.01) { probe.x = aim.x; probe.y = aim.y; } else moving = true;
  const p = probePoint();
  const u = { white: env.white.x, proj: env.proj.x, map: env.map.x, mix: env.mix.x, bitA, bitB, probe: [p[0], p[1]] };
  const key = JSON.stringify([u.white, u.proj, u.map, u.mix, bitA, bitB, p[0], p[1]].map((v) => +(+v).toFixed(4)));
  if (key !== painted) { paint(u); painted = key; }
  drawSvg(p, describe(p));
  frame = visible && (playing || moving) ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

// ---------- Entrada ----------
function toVb(event) {
  const r = back.getBoundingClientRect();
  return [((event.clientX - r.left) / r.width) * D.W, ((event.clientY - r.top) / r.height) * D.H];
}
function aimAt(event) {
  const p = pick(...toVb(event));
  if (!p || insideOf(p[0], p[1]) < 6) return;
  hovering = true; aim.x = p[0]; aim.y = p[1];
  clearTimeout(wanderTimer);
  run();
}
stage.addEventListener("pointermove", aimAt);
stage.addEventListener("pointerdown", aimAt);
stage.addEventListener("pointerleave", () => { clearTimeout(wanderTimer); wanderTimer = setTimeout(() => { hovering = false; run(); }, 3600); });
stage.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (event.key in keys) { playing = false; goTo(step + keys[event.key]); }
  else if (event.key === " " || event.key === "Enter") { playing = !playing; held = 0; run(); }
  else if (event.key === "Home") { playing = false; goTo(0); }
  else if (event.key === "End") { playing = false; goTo(STEPS - 1); }
  else return;
  event.preventDefault();
  clearTimeout(said.timer);
  said.timer = setTimeout(() => { said.textContent = `${phaseText()}${playing ? "" : ", paused"}.`; }, 700);
});
stage.addEventListener("focus", () => { said.textContent = `${phaseText()}.`; });

let resizeTimer = 0;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { buildMap(); painted = ""; run(); }, map ? 150 : 0); }).observe(stage);
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
paintEyes(0);
if (still.matches) { playing = false; goTo(5); }
