// Fig. 2 viva: torreta de filtros y cinco relojes. Va dentro de un bloque { } para no chocar con la Fig. 1.
const D2 = __DATA__;
const root2 = document.querySelector(".se2");
const stage2 = root2.querySelector(".se2-stage");
const svg2 = stage2.querySelector("svg");
const readout2 = root2.querySelector("[data-readout]");
const said2 = stage2.querySelector(".se-said");
const still2 = matchMedia("(prefers-reduced-motion: reduce)");
const P2 = D2.P;
const N = D2.enhancers.length;

// ---------- El cuadro endoscópico y lo que cada método le hace ----------
const FW = 120, FH = 96;
function frameVersions() {
  const raw = new Float32Array(FW * FH * 3), spec = new Float32Array(FW * FH);
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
    const x = i / FW - 0.5, y = (j / FH - 0.5) * 0.8, r2 = x * x + y * y;
    const fold = Math.sin(x * 19 + Math.sin(y * 11) * 2.2) * 0.5 + Math.sin(y * 23 - x * 7) * 0.3;
    const vessel = Math.exp(-Math.abs(Math.sin(x * 9 + y * 14 + Math.sin(x * 21) * 0.6)) * 26) * 0.55;
    const shade = 0.78 + 0.16 * fold - vessel * 0.5;
    const fall = Math.max(0.08, 1.25 - 3.6 * r2);
    const s = [[0.08, -0.06, 0.0009], [-0.12, 0.05, 0.0006], [0.02, 0.1, 0.0004], [0.17, 0.02, 0.0005]].reduce((acc, [cx, cy, w]) => acc + Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / w), 0);
    const at = j * FW + i;
    spec[at] = Math.min(1, s);
    const tissue = [0.78 * shade, 0.32 * shade - vessel * 0.1, 0.3 * shade];
    for (let c = 0; c < 3; c++) raw[at * 3 + c] = Math.min(1, tissue[c] * fall + spec[at] * 0.95);
  }
  const blur = (src) => {
    const out = new Float32Array(src.length);
    for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < FW && jj < FH) { sum += src[(jj * FW + ii) * 3 + c]; n++; } }
      out[(j * FW + i) * 3 + c] = sum / n;
    }
    return out;
  };
  const local = blur(blur(raw));
  const versions = [raw, new Float32Array(raw.length), new Float32Array(raw.length), new Float32Array(raw.length)];
  const soft = blur(raw);
  for (let at = 0; at < FW * FH; at++) {
    const lum = (raw[at * 3] + raw[at * 3 + 1] + raw[at * 3 + 2]) / 3;
    for (let c = 0; c < 3; c++) {
      const v = raw[at * 3 + c];
      // Endo-LMSPEC: contraste local fuerte y un corrimiento verde en las sombras
      versions[1][at * 3 + c] = Math.min(1, Math.max(0, 1.3 * (local[at * 3 + c] + 1.7 * (v - local[at * 3 + c])) + (c === 1 ? 0.3 * (1 - lum) + 0.06 : c === 0 ? -0.12 * (1 - lum) : 0)));
      // IAT: levanta las sombras y comprime los brillos sin cambiar el tono
      const lifted = Math.pow(v, 0.72);
      versions[2][at * 3 + c] = lifted / (1 + Math.max(0, lifted - 0.82) * 1.4);
      // Endo-STTN: rellena los brillos especulares, pero alisa la textura
      const base = soft[at * 3 + c] - spec[at] * 0.95 * 0.9;
      versions[3][at * 3 + c] = Math.max(0, Math.min(1, spec[at] > 0.05 ? base * (1 - spec[at]) + (soft[at * 3 + c] - spec[at] * 0.8) * spec[at] : soft[at * 3 + c]));
    }
  }
  const canvas = Object.assign(document.createElement("canvas"), { width: FW, height: FH });
  const ctx = canvas.getContext("2d");
  return versions.map((v) => {
    const img = ctx.createImageData(FW, FH);
    for (let at = 0; at < FW * FH; at++) { for (let c = 0; c < 3; c++) img.data[at * 4 + c] = Math.round(v[at * 3 + c] * 255); img.data[at * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  });
}

// ---------- Ventanas de la torreta (en el plano de arriba del disco) ----------
const T = D2.tur;
const IMG = { w: 2 * T.win + 6, h: (2 * T.win + 6) * 0.8 };
const centre = [T.c[0] + T.r * Math.sin(T.active), T.c[1] - T.r * Math.cos(T.active)];
const hrefs = frameVersions();
const holder = svg2.querySelector('[data-part="windows"]');
const NS = "http://www.w3.org/2000/svg";
holder.innerHTML = `<g transform="${topMatrix(centre, T.z, P2, "x")}">${D2.enhancers
  .map((_, i) => `<clipPath id="se2-w${i}"><circle data-clip="${i}" r="${T.win}"/></clipPath><circle class="se2-glass" data-glass="${i}" r="${T.win}"/><g clip-path="url(#se2-w${i})"><image href="${hrefs[i]}" x="${-IMG.w / 2}" y="${-IMG.h / 2}" width="${IMG.w}" height="${IMG.h}" preserveAspectRatio="none"/></g><circle class="se2-rim" data-rim="${i}" r="${T.win}"/><g class="se2-pips" data-pips="${i}">${Array.from({ length: i + 1 }, () => `<circle r="0.55"/>`).join("")}</g>`)
  .join("")}</g>`;
const clips = [...holder.querySelectorAll("[data-clip]")], glass = [...holder.querySelectorAll("[data-glass]")], rims = [...holder.querySelectorAll("[data-rim]")], pips = [...holder.querySelectorAll("[data-pips]")];
const knobMark = svg2.querySelector('[data-part="knob-mark"]');
const needles = [...svg2.querySelectorAll("[data-needle]")];
const lcds = [...svg2.querySelectorAll("[data-lcd]")];

function placeWindows(t) {
  D2.enhancers.forEach((_, i) => {
    const a = T.active + (i - t) * (Math.PI / 2);
    const x = T.c[0] + T.r * Math.sin(a) - centre[0], y = T.c[1] - T.r * Math.cos(a) - centre[1];
    for (const el of [clips[i], glass[i], rims[i]]) { el.setAttribute("cx", x.toFixed(2)); el.setAttribute("cy", y.toFixed(2)); }
    const rp = T.r + T.win + 3.2, dots = pips[i].children, spread = 2.4;
    for (let d = 0; d < dots.length; d++) {
      const b = a + ((d - (dots.length - 1) / 2) * spread) / rp;
      dots[d].setAttribute("cx", (T.c[0] + Math.min(rp, 49) * Math.sin(b) - centre[0]).toFixed(2));
      dots[d].setAttribute("cy", (T.c[1] - Math.min(rp, 49) * Math.cos(b) - centre[1]).toFixed(2));
    }
  });
  const a = -t * (Math.PI / 2) + T.active;
  knobMark.setAttribute("d", lineOnTop([T.c[0], T.c[1]], [T.c[0] + Math.sin(a) * 8.6, T.c[1] - Math.cos(a) * 8.6], T.z + 8, P2));
}

// ---------- Agujas ----------
const S2 = D2.scale;
const needleAt = (i, v) => {
  const a = S2.from + ((Math.min(S2.hi, Math.max(S2.lo, v)) - S2.lo) / (S2.hi - S2.lo)) * S2.span, x = D2.gx[i];
  return lineOnTop([x - Math.sin(a) * 3.2, Math.cos(a) * 3.2], [x + Math.sin(a) * (D2.dial.r - 3.6), -Math.cos(a) * (D2.dial.r - 3.6)], D2.dial.top + 0.2, P2);
};

// ---------- Estado ----------
const turret = { x: 0, v: 0 };
const gauges = D2.models.map((_, i) => ({ x: D2.absrel[i][0], v: 0 }));
let target = 0, hover = -1, touring2 = !still2.matches, clock2 = 0, frame2 = 0, last2 = 0, visible2 = false, idle2 = 0;
const pct = (a, b) => `${a < b ? "−" : "+"}${Math.abs((100 * (a - b)) / b).toFixed(1)}%`;
const cost = (j) => { const ms = D2.it[4][j] - D2.it[4][0]; return j === 0 ? "" : ms > 1000 ? ` · +${(ms / 1000).toFixed(1)} s/frame` : ` · +${Math.round(ms)} ms/frame`; };
function say() {
  const j = target, name = j ? D2.enhancers[j] : "raw";
  if (hover >= 0) { const v = D2.absrel[hover][j]; return `${D2.models[hover]} · ${name} ${v.toFixed(4)}${j ? ` · ${pct(v, D2.absrel[hover][0])}` : ""}`; }
  const best = D2.absrel.reduce((b, row, i) => (row[j] < D2.absrel[b][j] ? i : b), 0);
  return `${name} · best ${D2.models[best]} ${D2.absrel[best][j].toFixed(4)}${cost(j)}`;
}
function select(j, user) {
  target = ((j % N) + N) % N;
  stage2.setAttribute("aria-valuenow", String(target));
  stage2.setAttribute("aria-valuetext", target ? D2.enhancers[target] : "No enhancement");
  if (user) { touring2 = false; clearTimeout(idle2); idle2 = setTimeout(() => { touring2 = !still2.matches; clock2 = 0; run2(); }, 3600); clearTimeout(said2.t); said2.t = setTimeout(() => (said2.textContent = `${target ? D2.enhancers[target] : "No enhancement"}.`), 700); }
  run2();
}
function settle2(s, goal, dt, k, c, calm) {
  if (calm) { s.x = goal; s.v = 0; return false; }
  for (let n = 0; n < 4; n++) { s.v += ((goal - s.x) * k - s.v * c) * (dt / 4); s.x += s.v * (dt / 4); }
  if (Math.abs(goal - s.x) < 1e-5 && Math.abs(s.v) < 1e-5) { s.x = goal; s.v = 0; return false; }
  return true;
}
function tick2(now) {
  const dt = last2 ? Math.min((now - last2) / 1000, 1 / 30) : 1 / 60;
  last2 = now;
  const calm = still2.matches;
  if (touring2) { clock2 += dt; const step = Math.floor(clock2 / 3.2) % N; if (step !== target) select(step, false); }
  // La torreta gira por el camino corto
  let goal = target;
  while (goal - turret.x > N / 2) goal -= N;
  while (turret.x - goal > N / 2) goal += N;
  let moving = settle2(turret, goal, dt, 40, 12.6, calm);
  if (!moving) turret.x = ((turret.x % N) + N) % N;
  placeWindows(turret.x);
  gauges.forEach((g, i) => {
    moving = settle2(g, D2.absrel[i][target], dt, 90, 13, calm) || moving;
    needles[i].setAttribute("d", needleAt(i, g.x));
    const text = g.x.toFixed(4);
    if (lcds[i].textContent !== text) lcds[i].textContent = text;
  });
  const text = say();
  if (readout2.textContent !== text) readout2.textContent = text;
  frame2 = visible2 && (moving || touring2) ? requestAnimationFrame(tick2) : 0;
}
function run2() { if (!frame2 && visible2) { last2 = 0; frame2 = requestAnimationFrame(tick2); } }

stage2.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") select(target + 1, true);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") select(target - 1, true);
  else if (/^[1-4]$/.test(event.key)) select(+event.key - 1, true);
  else return;
  event.preventDefault();
});
stage2.addEventListener("pointermove", (event) => {
  const r = svg2.getBoundingClientRect(), sx = ((event.clientX - r.left) / r.width) * D2.W, sy = ((event.clientY - r.top) / r.height) * D2.H;
  let near = -1, best = 26;
  D2.gx.forEach((x, i) => { const [px, py] = iso([x, 0, D2.dial.top], P2), d = Math.hypot(px - sx, py - sy); if (d < best) { best = d; near = i; } });
  if (near !== hover) { hover = near; run2(); }
  if (near < 0) { const [tx, ty] = iso([T.c[0], T.c[1], T.z], P2); stage2.style.cursor = Math.hypot(tx - sx, ty - sy) < 50 ? "pointer" : ""; }
});
stage2.addEventListener("pointerleave", () => { hover = -1; run2(); });
stage2.addEventListener("click", (event) => {
  const r = svg2.getBoundingClientRect(), [tx, ty] = iso([T.c[0], T.c[1], T.z], P2);
  if (Math.hypot(((event.clientX - r.left) / r.width) * D2.W - tx, ((event.clientY - r.top) / r.height) * D2.H - ty) < 50) select(target + 1, true);
});
new IntersectionObserver((entries) => { visible2 = entries[entries.length - 1].isIntersecting; if (visible2) run2(); }, { rootMargin: "120px 0px" }).observe(stage2);
placeWindows(0);
gauges.forEach((g, i) => needles[i].setAttribute("d", needleAt(i, g.x)));
if (still2.matches) select(2, false);
