// Fig. 2: mejora de imagen antes de estimar profundidad (Toral Cruz et al., MICAI 2026).
// Una torreta de filtros con las 4 condiciones de entrada sobre una caja de luz con un cuadro endoscópico,
// y un riel con 5 relojes comparadores, uno por modelo de profundidad, que leen el AbsRel de la Tabla 3.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as A from "./kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// Tabla 3 del manuscrito: AbsRel e inferencia (ms) en el split oficial de 550 cuadros de SCARED.
export const ENHANCERS = ["None", "Endo-LMSPEC", "IAT", "Endo-STTN"];
export const MODELS = ["Monodepth2", "MonoViT", "Endo-SfMLearner", "AF-SfMLearner", "MonoIIT"];
export const ABSREL = [
  [0.0708, 0.0743, 0.0696, 0.0720],
  [0.0727, 0.0730, 0.0713, 0.0728],
  [0.0845, 0.0877, 0.0879, 0.0904],
  [0.0592, 0.0564, 0.0582, 0.0608],
  [0.0554, 0.0562, 0.0537, 0.0558],
];
export const IT_MS = [
  [6.0, 181.4, 287.3, 19673.0],
  [55.0, 228.5, 335.3, 19721.6],
  [12.8, 187.1, 289.8, 19676.4],
  [8.4, 180.7, 286.6, 19672.9],
  [57.3, 228.9, 335.4, 19722.0],
];
const SCALE = { lo: 0.05, hi: 0.095, from: -135 * DEG, span: 270 * DEG };
const angleOf = (v) => SCALE.from + ((v - SCALE.lo) / (SCALE.hi - SCALE.lo)) * SCALE.span;

const W = 760;
const H = 430;
const AZ = 38;
const BASE = { x: -172, y: -70, w: 347, d: 120, r: 8 };
const BASE_H = 12;
const FOOT_H = 7;
const TUR = [-110, 0];
const TUR_R = 52;
const TUR_Z = 34;
const TUR_T = 4;
const WIN_R = 31;
const WIN = 15;
const ACTIVE = 90 * DEG;                      // la ventana activa mira hacia +x, sobre la caja de luz
const LIGHT = { x: TUR[0] + WIN_R - 18, y: -18, w: 36, d: 36, r: 3 };
const RAIL = { x: -46, y: -11, w: 210, d: 22, r: 3 };
const RAIL_H = 6;
const GX = MODELS.map((_, i) => -30 + i * 45);
const DIAL_R = 17;
const DIAL_Z = 46;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;
const LCD = { w: 22, z0: 16, z1: 26, d: 6 };

export function figura2() {
  const P = k.fitProjection([...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [TUR[0], TUR[1], 62], ...GX.map((x) => [x, 0, DIAL_TOP + 2])], W, H, { pad: 30, azimuth: AZ });
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  const R = A.recorder(P);
  const put = (ref, svg, shapes, name, bias = 0) => R.put({ at: ref, bias, svg, shapes: shapes.map(R.solid), name: R.nameFor(name) });
  const cyl = (name, cx, cy, r, z, h, style = {}, { steps = 32, bevel = 0, extra = "", inner = "" } = {}) =>
    put([cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.cylinder(cx, cy, r, z, h, { name })], name);
  const slab = (name, plan, z, h, style = {}, { steps = 3, bevel = 0.5, extra = "", inner = "" } = {}) =>
    put([plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [A.slab(plan, z, h, { name }, steps)], name);

  // ---------- Placa base ----------
  const back = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    back.push(S(k.cylinder(x, y, 9, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  R.solid(A.slab(BASE, -BASE_H, BASE_H, { name: "stand.base" }));
  back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid", inner: Ln(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }) }));
  back.push(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 9);
  back.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const STRIP = { x: RAIL.x + 8, y: BASE.y + BASE.d - 15, w: RAIL.w - 16, d: 7, r: 1 };
  back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const TICKS = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y + 0.8, 0.6, [2, 3.6], P);
  back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
  back.push(Dots([at([STRIP.x + 2.2, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2.2, STRIP.y + 3.5, 0.6])], { size: 0.45 }));
  const LABEL = { x: BASE.x + 14, y: BASE.y + BASE.d - 26, w: 62, d: 16, r: 1.5 };
  back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "mid" }), Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P), { tone: "faint" }));
  back.push(Ln([0, 1, 2].map((row) => k.onTop([[LABEL.x + 5, LABEL.y + 4.5 + row * 3.4], [LABEL.x + [52, 40, 46][row], LABEL.y + 4.5 + row * 3.4]], 0.8, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([LABEL.x + 2.6, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d / 2, 0.8])], { size: 0.45 }));

  // ---------- Caja de luz con el cuadro endoscópico ----------
  slab("light.case", LIGHT, 0, 22, {}, { bevel: 0.6, inner: Ln(k.sideSeam(LIGHT, 6, P, 3), { tone: "faint" }) });
  const PANEL = k.insetPlan(LIGHT, 3);
  slab("light.panel", PANEL, 22, 1, { tone: "hi", lit: true }, { bevel: 0 });
  const SWITCH = [LIGHT.x + LIGHT.w - 6, LIGHT.y + LIGHT.d];
  put([SWITCH[0], SWITCH[1] + 1, 10], S(G.disc(0, 2.4, 2.4, G.frameAlong([SWITCH[0], SWITCH[1], 10], [0, 1, 0]), P), { tone: "mid" }), [A.disc(G.frameAlong([SWITCH[0], SWITCH[1], 10], [0, 1, 0]), 0, 2.4, 2.4, { name: "light.switch" })], "light.switch");

  // ---------- Torreta: eje, disco con 4 ventanas, perilla y retén ----------
  cyl("tur.foot", TUR[0], TUR[1], 12, 0, 4, {}, { bevel: 0.5, extra: Dots(G.dotsOf(G.frameOf([TUR[0], TUR[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 4, 9, 3, P, { all: true }), { size: 0.45 }) });
  cyl("tur.post", TUR[0], TUR[1], 5, 4, TUR_Z - 4, {}, { inner: Ln(k.sideArc(TUR[0], TUR[1], 5, 16, P, 16), { tone: "faint" }) });
  const rim = k.fadedSvg(G.ribsOf(G.frameOf([TUR[0], TUR[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), TUR_Z + 0.4, TUR_Z + TUR_T - 0.4, TUR_R, 96, P, { fade: [0.08, 0.5] }), { tone: "lo" });
  cyl("tur.disc", TUR[0], TUR[1], TUR_R, TUR_Z, TUR_T, { tone: "hi", crease: "lo" }, { steps: 96, bevel: 0.6, extra: rim + `<g data-part="windows"></g>` });
  cyl("tur.knob", TUR[0], TUR[1], 10, TUR_Z + TUR_T, 8, { tone: "mid" }, { extra: Ln(k.knurl(TUR[0], TUR[1], 10, TUR_Z + TUR_T, TUR_Z + TUR_T + 8, 40, P), { tone: "lo" }) + `<path data-part="knob-mark" class="iso-line" data-tone="hi" data-free="end" d=""/>` + Dots([at([TUR[0], TUR[1], TUR_Z + TUR_T + 8])], { size: 0.7, tone: "hi" }) });
  // Retén de bola: un bloque al costado que fija cada posición
  const DETENT = { x: TUR[0] - 6, y: TUR[1] - TUR_R - 10, w: 12, d: 10, r: 1.5 };
  slab("tur.detent", DETENT, 0, TUR_Z - 1, {}, { bevel: 0.4, extra: Dots([at([DETENT.x + 6, DETENT.y + 5, TUR_Z - 1])], { size: 0.5 }) });
  // Índice fijo: una flecha grabada en el riel apunta a la ventana activa
  const INDEX = { x: TUR[0] + TUR_R + 2, y: -3, w: 8, d: 6, r: 1 };
  slab("tur.index", INDEX, 0, TUR_Z - 0.5, {}, { bevel: 0.4, extra: Ln(k.lineOnTop([INDEX.x + INDEX.w, INDEX.y + 3], [INDEX.x, INDEX.y + 3], TUR_Z - 0.5, P), { tone: "red" }) });

  // ---------- Riel y cinco relojes comparadores ----------
  slab("stand.rail", RAIL, 0, RAIL_H, {}, { bevel: 0.6, extra: Dots([RAIL.x + 6, RAIL.x + RAIL.w - 6].map((x) => at([x, 0, RAIL_H])), { size: 0.45 }) + Ln(k.lineOnTop([RAIL.x, RAIL.y + 3.5], [RAIL.x + RAIL.w, RAIL.y + 3.5], RAIL_H, P) + k.lineOnTop([RAIL.x, RAIL.y + RAIL.d - 3.5], [RAIL.x + RAIL.w, RAIL.y + RAIL.d - 3.5], RAIL_H, P), { tone: "faint" }) });
  GX.forEach((x, i) => {
    const shoe = { x: x - 11, y: -10, w: 22, d: 20, r: 2 };
    slab(`g${i}.shoe`, shoe, RAIL_H, 5, {}, { bevel: 0.5, extra: Dots([at([shoe.x + 3, shoe.y + 3, RAIL_H + 5]), at([shoe.x + 19, shoe.y + 17, RAIL_H + 5])], { size: 0.42 }) });
    cyl(`g${i}.post`, x, 0, 3.4, RAIL_H + 5, DIAL_Z - 4 - RAIL_H - 5, {}, { steps: 20 });
    // Pantalla del valor: caja en el poste, cara hacia +y
    const box = { x: x - LCD.w / 2, y: 3.4, w: LCD.w, d: LCD.d, r: 1.2 };
    const face = box.y + box.d;
    const win = k.pathOf([[x - 9, LCD.z0 + 1.6], [x + 9, LCD.z0 + 1.6], [x + 9, LCD.z1 - 1.6], [x - 9, LCD.z1 - 1.6]].map(([a, z]) => at([a, face, z])), true);
    const lcd = `<path class="se-lcd" d="${win}"/>` + Ln(win, { tone: "lo" }) + `<g transform="${k.sideMatrix([x, face], LCD.z1 - 1.6, P, "left")}"><text class="se-lcd-text" data-lcd="${i}" x="0" y="${((LCD.z1 - LCD.z0 - 3.2) * 0.5 + 1.5).toFixed(2)}" text-anchor="middle">${ABSREL[i][0].toFixed(4)}</text></g>`;
    slab(`g${i}.lcd`, box, LCD.z0, LCD.z1 - LCD.z0, {}, { steps: 2, bevel: 0.4, extra: lcd });
    slab(`g${i}.lug`, { x: x - 3, y: -3, w: 6, d: 6, r: 1 }, DIAL_Z - 4, 4, {}, { steps: 2, bevel: 0.3 });
    const ticks = k.radialTicks(x, 0, DIAL_R - 3, 18, 4, DIAL_TOP, [1.3, 2.8], P, SCALE.from, SCALE.span);
    const a0 = angleOf(ABSREL[i][0]);
    const zero = k.lineOnTop([x + Math.sin(a0) * (DIAL_R - 6.4), -Math.cos(a0) * (DIAL_R - 6.4)], [x + Math.sin(a0) * (DIAL_R - 2.2), -Math.cos(a0) * (DIAL_R - 2.2)], DIAL_TOP, P);
    const dial =
      Ln(k.knurl(x, 0, DIAL_R, DIAL_TOP - 3.2, DIAL_TOP, 72, P, 0.3), { tone: "lo" }) +
      Ln(k.ring(x, 0, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }) +
      Ln(ticks.minor, { tone: "lo" }) +
      Ln(ticks.major, { tone: "mid" }) +
      `<path class="iso-line se-zero" data-tone="red" d="${zero}"/>` +
      `<path data-needle="${i}" class="iso-line" data-tone="lit" data-free="start" d="" style="stroke-width:1.1"/>` +
      Ln(k.ring(x, 0, 1.5, DIAL_TOP + 0.2, P, 14), { tone: "mid" });
    cyl(`g${i}.dial`, x, 0, DIAL_R, DIAL_Z, DIAL_H, { tone: "hi", crease: "lo" }, { steps: 64, bevel: 0.6, inner: Ln(k.sideArc(x, 0, DIAL_R, DIAL_TOP - 3.2, P, 32), { tone: "faint" }), extra: dial });
    // Corona y vástago del palpador debajo del cuerpo
    cyl(`g${i}.crown`, x + DIAL_R + 2.2, 0, 2.2, DIAL_Z + 2, 4, {}, { steps: 16 });
  });

  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  const label =
    "A filter turret on a plate: a disc with four windows turns over a light box that holds an endoscopic frame, so one window at a time shows the frame as one enhancement method leaves it. Beside it, a rail carries five dial gauges, one per depth model, whose needles read the depth error that model makes on that input, with a red mark at its error on the raw frame.";
  const svg = k.figureSvg({ width: W, height: H, label, body: [...back, ...R.items.map((item) => item.svg)], className: "se2-svg" });
  const DATA = {
    W, H, P, enhancers: ENHANCERS, models: MODELS, absrel: ABSREL, it: IT_MS, scale: SCALE,
    tur: { c: TUR, r: WIN_R, win: WIN, z: TUR_Z + TUR_T, active: ACTIVE }, gx: GX, dial: { r: DIAL_R, top: DIAL_TOP },
  };
  const stage = `<div class="se2-stage" tabindex="0" role="slider" aria-label="Enhancement turret. The left and right arrow keys, or the keys 1 to 4, turn the turret to an enhancement method; hover a gauge to read its depth model." aria-valuemin="0" aria-valuemax="3" aria-valuenow="0" aria-valuetext="No enhancement"><span class="se-said" aria-live="polite"></span>${svg}</div>`;
  const best = (j) => ABSREL.reduce((b, row, i) => (row[j] < ABSREL[b][j] ? i : b), 0);
  const caption = `The same endoscopic frame goes in under four conditions: raw, corrected by Endo-LMSPEC or IAT, or with its specular highlights inpainted by Endo-STTN. Five monocular depth networks then estimate its depth, scaled by the per-frame median and scored against SCARED's structured-light ground truth (Fig. 1) as AbsRel, the mean of |Z − Ẑ| / Z over the valid pixels, on the 550-frame split. Each needle reads one network's AbsRel; the red mark is its error on raw frames. Whether enhancement helps depends on the network: IAT lowers the error for Monodepth2, MonoViT and MonoIIT, and MonoIIT with IAT is the best pair at ${ABSREL[4][2].toFixed(4)}. Endo-LMSPEC suits AF-SfMLearner (${ABSREL[3][1].toFixed(4)}) but tints the tissue green, Endo-SfMLearner gets worse with every method, and Endo-STTN removes the glare but also the fine texture the networks rely on, at about 20 s per frame. A cleaner-looking image is not necessarily a better input for depth.`;
  const body = `<div class="se2">${k.plateHtml({
    fig: "Fig 2",
    title: "Enhancement before depth",
    hint: "Click or ← →: method · hover: model",
    readout: `raw · best ${MODELS[best(0)]} ${ABSREL[best(0)][0].toFixed(4)}`,
    keys: [
      { mark: "lit", label: "Needles: AbsRel of each depth network on that input" },
      { mark: "red", label: "Red mark: the same network on the raw frame" },
      { mark: "raised", label: `Gauges left to right: ${MODELS.join(", ")}` },
    ],
    caption,
    body: stage,
  })}<p class="se-source">Source: J. M. Toral Cruz, E. C. Morales Sánchez de la Barquera, M. P. Gutiérrez Cervantes, G. Camacho-Gonzalez, R. Espinosa and G. Ochoa-Ruíz, “Assessing the Impact of Endoscopic Image Enhancement on Monocular Depth Estimation in SCARED,” MICAI 2026 manuscript, Table 3. The endoscopic frame is drawn for illustration; its four versions imitate what the paper reports each method does.</p></div>`;
  const live = readFileSync(join(HERE, "vivo2.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
  return { body, live: `{\n${live}\n}\n`, R, P };
}
