// node luz-estructurada/fuente/build.mjs [--dark] [--audit]
// Escribe luz-estructurada/index.html (tema claro) o, con --dark, fuente/oscuro.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as A from "./kit/audit.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "./kit/tube.mjs";
import * as M from "./modelo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DARK = process.argv.includes("--dark");
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");

const W = 760;
const H = 600;
const AZ = 52;

// ---------- Plan de la mesa (mm) ----------
const BOARD = { x: -225, y: -235, w: 400, d: 375, r: 6 };
const BOARD_H = 13;
const FOOT_H = 10;
const TRAY = M.TRAY;
const TRAY_OUT = k.insetPlan(TRAY.inner, -1.2);
const TRAY_LIP = k.insetPlan(TRAY.inner, -3.4);
const SCOPE_X = M.SCOPE.at[0];
const SCOPE_Y = M.SCOPE.at[1];
const TIP_Z = M.SCOPE.at[2];
const SHAFT_R = 4;
const CLAMP_Z = 232;
const HEAD = { z0: 262, z1: 330 };
const POST = [-132, 0];
const POST_TOP = 296;
const CCU = { x: -218, y: -220, w: 118, d: 92, r: 4 };
const CCU_Z = 4;
const CCU_TOP = 60;
const MON = { x: -205, y: 92, w: 164, d: 18, r: 3 };
const MON_Z = 44;
const MON_TOP = 146;
const SCREEN = { x0: MON.x + 9, x1: MON.x + MON.w - 9, z0: MON_Z + 9, z1: MON_TOP - 9 };
const MON_FACE = MON.y + MON.d;

const P = k.fitProjection([...k.boxCorners(BOARD, -BOARD_H - FOOT_H, 0), [SCOPE_X, SCOPE_Y, 372], [POST[0], POST[1], POST_TOP + 4], [-120, -200, 215], [40, -200, 215]], W, H, { pad: 26, azimuth: AZ });
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ALONG = (o, a) => G.frameAlong(o, a);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---------- Registro para el orden de pintado y la auditoría ----------
const R = A.recorder(P);
const rec = R.solid;
function put(layer, ref, svg, shapes, { bias = 0, name } = {}) {
  R.put({ at: ref, bias, svg, shapes, layer, name: R.nameFor(name ?? `${layer}.item`) });
}
const onto = (name, svg) => { R.items.find((item) => item.name === name).svg += svg; };
const slabAt = (layer, name, plan, z, h, style = {}, { steps = 3, bevel = 0.5, extra = "", inner = "", bias = 0 } = {}) =>
  put(layer, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [rec(A.slab(plan, z, h, { name }, steps))], { bias, name });
const cylAt = (layer, name, cx, cy, r, z, h, style = {}, { steps = 32, bevel = 0, extra = "", inner = "", bias = 0 } = {}) =>
  put(layer, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [rec(A.cylinder(cx, cy, r, z, h, { name }))], { bias, name });
const discAt = (layer, name, F, s0, s1, r, style = {}, { extra = "", inner = "", bias = 0, bevel = 0 } = {}) =>
  put(layer, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel }), { tone: "mid", ...style, inner }) + extra, [rec(A.disc(F, s0, s1, r, { name }))], { bias, name });
const turnedAt = (layer, name, F, profile, style = {}, { extra = "", inner = "", bias = 0 } = {}) =>
  put(layer, G.add3(F.o, G.mul3(F.a, (profile[0][0] + profile[profile.length - 1][0]) / 2)), S(G.solidOf(profile, F, P), { tone: "mid", ...style, inner }) + extra, [rec(A.solid(F, profile, { name }))], { bias, name });
const ballAt = (layer, name, c, r, style = {}, { bias = 0 } = {}) => put(layer, c, S(G.sphereOf(c, r, P), { tone: "mid", ...style }), [rec(A.ball(c, r, { name }))], { bias, name });
const prismAt = (layer, name, F, poly, s0, s1, style = {}, { extra = "", bias = 0 } = {}) =>
  put(layer, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style }) + extra, [rec(A.prism(F, poly, s0, s1, { name }))], { bias, name });
const roundRect = (u0, u1, v0, v1, r, steps = 4) => {
  const out = [];
  const corner = (cu, cv, a0) => { for (let i = 0; i <= steps; i++) { const a = a0 + (i / steps) * (Math.PI / 2); out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); } };
  corner(u1 - r, v0 + r, -Math.PI / 2); corner(u1 - r, v1 - r, 0); corner(u0 + r, v1 - r, Math.PI / 2); corner(u0 + r, v0 + r, Math.PI);
  return out;
};
const knurlRing = (F, s0, s1, r, count = 36) => k.fadedSvg(G.ribsOf(F, s0, s1, r, count, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" });

// ---------- Mesa óptica ----------
const back = [`<path class="iso-halo" d="${k.haloOf(BOARD, -BOARD_H - FOOT_H, BOARD_H, P)}"/>`];
for (const [x, y] of byDepth(k.corners(BOARD, 34))) {
  back.push(S(k.cylinder(x, y, 15, -BOARD_H - FOOT_H, 2, P, 32), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 12, -BOARD_H - FOOT_H + 2, FOOT_H - 2, P, 32), { tone: "mid" }));
  back.push(Ln(k.sideArc(x, y, 12, -BOARD_H - 4, P, 20), { tone: "faint" }));
}
rec(A.slab(BOARD, -BOARD_H, BOARD_H, { name: "stand.board" }));
back.push(S(k.slabOf(BOARD, -BOARD_H, BOARD_H, P, 6, 1.4), { tone: "mid", inner: Ln(k.sideSeam(BOARD, -BOARD_H + 4.5, P, 6), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(BOARD, 6), 0, P, 6), { tone: "lo" }));
// Agujeros M6 roscados cada 25 mm
const HOLES = [];
for (let x = -200; x <= 150; x += 25) for (let y = -210; y <= 110; y += 25) HOLES.push(k.ring(x, y, 2.6, 0, P, 14));
back.push(Ln(HOLES.join(""), { tone: "faint" }));
const STRIP = { x: -200, y: BOARD.y + BOARD.d - 15, w: 350, d: 8, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 5, STRIP.x + STRIP.w - 5, 5, 5, STRIP.y + 0.8, 0.7, [2.2, 4.2], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2.4, STRIP.y + 4, 0.7]), at([STRIP.x + STRIP.w - 2.4, STRIP.y + 4, 0.7])], { size: 0.45 }));
const LABEL = { x: 62, y: 92, w: 84, d: 22, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 6, LABEL.y + 9], 1, P, "x"), "SCARED · ENDOVIS 2019", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1].map((row) => k.onTop([[LABEL.x + 6, LABEL.y + 14 + row * 3.2], [LABEL.x + (row ? 48 : 66), LABEL.y + 14 + row * 3.2]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + 2.8, LABEL.y + LABEL.d / 2, 1]), at([LABEL.x + LABEL.w - 2.8, LABEL.y + LABEL.d / 2, 1])], { size: 0.45 }));

// ---------- Charola: cuerpo, borde y cavidad (lejos detrás del tejido, cerca delante) ----------
const trayBody = S(k.slabOf(TRAY_OUT, 0, TRAY.top - 2, P, 8, 0), { tone: "mid" }) + S(k.slabOf(TRAY_LIP, TRAY.top - 2, 2, P, 8, 0.6), { tone: "hi", crease: "lo" });
back.push(`<path class="iso-halo" d="${k.haloOf(TRAY_LIP, 0, 4, P)}" style="filter:blur(3px)"/>`);
back.push(trayBody);
rec(A.slab(TRAY_OUT, 0, TRAY.top - 2, { name: "tray.body" }));
rec(A.slab(TRAY_LIP, TRAY.top - 2, 2, { name: "tray.lip" }));
const INNER = k.roundedPlan(TRAY.inner, 6);
const opening = k.pathOf(INNER.map(([x, y]) => at([x, y, TRAY.top])), true);
const cavity = [];
cavity.push(`<path class="iso-fill" d="${k.pathOf(INNER.map(([x, y]) => at([x, y, TRAY.floor])), true)}"/><path class="iso-shade" data-shade="0" d="${k.pathOf(INNER.map(([x, y]) => at([x, y, TRAY.floor])), true)}"/>`);
const farEdge = [];
const nearEdge = [];
for (let i = 0; i < INNER.length; i++) {
  const a = INNER[i], b = INNER[(i + 1) % INNER.length];
  const tangent = [b[0] - a[0], b[1] - a[1]];
  const inward = [-tangent[1], tangent[0]];
  const centre = [TRAY.inner.x + TRAY.inner.w / 2, TRAY.inner.y + TRAY.inner.d / 2];
  const sign = Math.sign(inward[0] * (centre[0] - a[0]) + inward[1] * (centre[1] - a[1])) || 1;
  const n = [inward[0] * sign, inward[1] * sign, 0];
  const visible = n[0] * V[0] + n[1] * V[1] > 0;
  (visible ? farEdge : nearEdge).push(k.pathOf([at([a[0], a[1], TRAY.top]), at([b[0], b[1], TRAY.top])]));
  if (!visible) continue;
  const quad = k.pathOf([at([a[0], a[1], TRAY.floor]), at([b[0], b[1], TRAY.floor]), at([b[0], b[1], TRAY.top]), at([a[0], a[1], TRAY.top])], true);
  cavity.push(`<path class="iso-fill" d="${quad}"/><path class="iso-shade" data-shade="${G.toneOf(n, P)}" d="${quad}"/>`);
}
back.push(`<g class="iso-solid">${cavity.join("")}</g>`, Ln(farEdge.join(""), { tone: "lo" }));
back.push(Ln(k.pathOf(INNER.map(([x, y]) => at([x, y, TRAY.floor])), true), { tone: "faint" }));

const trayFront = `<clipPath id="se-near"><path clip-rule="evenodd" d="${k.slabOf(TRAY_LIP, 0, TRAY.top, P, 8).fill}${opening}"/></clipPath><g clip-path="url(#se-near)">${trayBody}</g>${Ln(nearEdge.join(""), { tone: "lo" })}`;

// ---------- Endoscopio estéreo en su soporte ----------
// Poste en su base, abrazadera en ángulo recto y varilla horizontal hasta la abrazadera en V del endoscopio
cylAt("front", "stand.base", POST[0], POST[1], 17, 0, 5, {}, { bevel: 0.6, extra: Dots(G.dotsOf(UP([POST[0], POST[1], 0]), 5, 12.5, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.5 }) });
cylAt("front", "stand.holder", POST[0], POST[1], 9, 5, 52, {}, { bevel: 0.4, inner: Ln(k.sideArc(POST[0], POST[1], 9, 50, P, 20), { tone: "faint" }) });
discAt("front", "stand.holder.screw", ALONG([POST[0], POST[1] + 9, 44], [0, 1, 0]), 0, 7, 2.6, {}, { extra: Ln(G.ribsOf(ALONG([POST[0], POST[1] + 9, 44], [0, 1, 0]), 2, 6.6, 2.6, 14, P), { tone: "lo" }) });
cylAt("front", "stand.post.low", POST[0], POST[1], 6.35, 57, CLAMP_Z - 10 - 57, {}, { crease: "none", inner: Ln([120, 180].map((z) => k.sideArc(POST[0], POST[1], 6.35, z, P, 16)).join(""), { tone: "faint" }) });
const RA = { x: POST[0] - 10, y: POST[1] - 10, w: 20, d: 20, r: 2 };
slabAt("front", "stand.clamp", RA, CLAMP_Z - 10, 20, {}, { bevel: 0.6, extra: Dots([at([RA.x + 4, RA.y + 4, CLAMP_Z + 10]), at([RA.x + 16, RA.y + 16, CLAMP_Z + 10])], { size: 0.45 }) });
cylAt("front", "stand.post.high", POST[0], POST[1], 6.35, CLAMP_Z + 10, POST_TOP - CLAMP_Z - 10, {}, { crease: "none" });
cylAt("front", "stand.post.cap", POST[0], POST[1], 7.2, POST_TOP, 3, {}, { bevel: 0.4 });
discAt("front", "stand.clamp.screw", ALONG([POST[0], RA.y + RA.d, CLAMP_Z + 4], [0, 1, 0]), 0, 8, 3.2, {}, { extra: Ln(G.ribsOf(ALONG([POST[0], RA.y + RA.d, CLAMP_Z + 4], [0, 1, 0]), 2.5, 7.6, 3.2, 16, P), { tone: "lo" }) });
const ROD_F = ALONG([RA.x + RA.w, 0, CLAMP_Z], [1, 0, 0]);
const ROD_LEN = SCOPE_X - 9 - (RA.x + RA.w);
discAt("front", "stand.rod", ROD_F, 0, ROD_LEN, 5, {}, { inner: Ln(G.arcOf(ROD_F, ROD_LEN / 2, 5, P), { tone: "faint" }) });
const VBLOCK = { x: SCOPE_X - 9, y: SCOPE_Y - 8, w: 18, d: 16, r: 2 };
slabAt("front", "scope.clamp", VBLOCK, CLAMP_Z - 7, 14, {}, { bevel: 0.5, extra: Dots([at([VBLOCK.x + 3.5, VBLOCK.y + 3.5, CLAMP_Z + 7]), at([VBLOCK.x + 14.5, VBLOCK.y + 12.5, CLAMP_Z + 7])], { size: 0.45 }) });
const VSCREW = ALONG([SCOPE_X + 2, VBLOCK.y + VBLOCK.d, CLAMP_Z], [0, 1, 0]);
discAt("front", "scope.clamp.neck", VSCREW, 0, 3, 1.4);
discAt("front", "scope.clamp.knob", VSCREW, 3, 9, 3.6, {}, { extra: knurlRing(VSCREW, 3, 9, 3.6, 18) });

// Vaina del endoscopio (ø 8 mm), cabeza de cámara con anillo de foco y alivio de tensión
const SHAFT_LOW = CLAMP_Z - 7;
cylAt("front", "scope.tip", SCOPE_X, SCOPE_Y, SHAFT_R, TIP_Z, 6, { tone: "hi", lit: true }, { steps: 28, inner: Ln(k.sideArc(SCOPE_X, SCOPE_Y, SHAFT_R, TIP_Z + 6, P, 20), { tone: "lo" }) });
cylAt("front", "scope.shaft", SCOPE_X, SCOPE_Y, SHAFT_R, TIP_Z + 6, SHAFT_LOW - TIP_Z - 6, { tone: "hi", crease: "none" }, { steps: 28, inner: Ln([150, 190].map((z) => k.sideArc(SCOPE_X, SCOPE_Y, SHAFT_R, z, P, 20)).join(""), { tone: "faint" }) });
cylAt("front", "scope.shaft.high", SCOPE_X, SCOPE_Y, SHAFT_R, CLAMP_Z + 7, 255 - CLAMP_Z - 7, { tone: "hi", crease: "none" }, { steps: 28 });
const HEAD_F = UP([SCOPE_X, SCOPE_Y, 0]);
turnedAt("front", "scope.coupler", HEAD_F, [[255, 4.6], [257, 6.4], [262, 6.4]], { tone: "mid" });
turnedAt("front", "scope.head", HEAD_F, [[HEAD.z0, 12], [272, 12], [272, 13.4], [285, 13.4], [285, 12], [HEAD.z1 - 6, 12], [HEAD.z1 - 2, 11, 1], [HEAD.z1, 9.5, 1]], { tone: "hi" }, {
  inner: Ln(G.arcOf(HEAD_F, 300, 12, P) + G.arcOf(HEAD_F, 266, 12, P), { tone: "faint" }),
  extra: knurlRing(HEAD_F, 273, 284, 13.4, 48),
});
const BUTTONS = [292, 306].map((z) => ALONG([SCOPE_X + 11.6, SCOPE_Y + 3.4, z], G.unit3([1, 0.3, 0])));
BUTTONS.forEach((F, i) => discAt("front", `scope.button${i}`, F, 0, 2, 3.2, { tone: "mid" }));
turnedAt("front", "scope.relief", HEAD_F, [[HEAD.z1, 7], [HEAD.z1 + 4, 6.2, 1], [HEAD.z1 + 12, 4.4, 1], [HEAD.z1 + 20, 3.4]], { tone: "mid" }, { extra: k.fadedSvg(G.ribsOf(HEAD_F, HEAD.z1 + 5, HEAD.z1 + 19, 5, 0, P), { tone: "lo" }) });

// ---------- Proyector AAXA P300 Neo (15 × 3 × 9 cm) sobre rótula ----------
const PF = G.frameOf(M.PROJ.at, M.PF, M.PR, M.PU);
const LENS_U = 38;
const BODY = { u0: -112 + LENS_U, u1: 38 + LENS_U, v0: -15, v1: 15, s0: -98, s1: -8 };
const BODY_F = G.frameOf(G.sub3(M.PROJ.at, G.mul3(M.PR, LENS_U)), M.PF, M.PR, M.PU);
const pAt = (u, v, s) => G.add3(M.PROJ.at, G.add3(G.mul3(M.PR, u - LENS_U), G.add3(G.mul3(M.PU, v), G.mul3(M.PF, s))));
prismAt("back", "proj.body", BODY_F, roundRect(BODY.u0, BODY.u1, BODY.v0, BODY.v1, 5), BODY.s0, BODY.s1, { tone: "hi" });
const LENS_F = G.frameOf(M.PROJ.at, M.PF, M.PR, M.PU);
turnedAt("back", "proj.lens", LENS_F, [[-8, 13], [-4, 13], [-4, 11.2], [4, 11.2], [4, 12.4], [6, 12.4]], { tone: "mid" }, { extra: Ln(G.circleOf(LENS_F, 6, 8.4, P, 48), { tone: "lo" }) + Ln(G.circleOf(LENS_F, 6, 4.6, P, 32), { tone: "faint" }) });
// Rejilla, botones y LED en la cara de arriba (+PU); puerto HDMI y rueda de foco en el costado (+x)
const topAt = (u, s) => pAt(u, BODY.v1, s);
const SLOTS = [];
for (let i = 0; i < 9; i++) {
  const u = BODY.u0 + 14 + i * 7;
  SLOTS.push(k.pathOf([...Array.from({ length: 7 }, (_, j) => [u + 1.1 * Math.cos(Math.PI * (j / 6)), -84 + 1.1 * Math.sin(Math.PI * (j / 6)) * -1]), ...Array.from({ length: 7 }, (_, j) => [u - 1.1 * Math.cos(Math.PI * (j / 6)), -40 + 1.1 * Math.sin(Math.PI * (j / 6))])].map(([uu, s]) => at(topAt(uu, s))), true));
}
const proj = [Ln(SLOTS.join(""), { tone: "faint" })];
const KEYS = [-34, -26, -18].map((s) => topAt(BODY.u1 - 22, s));
proj.push(Ln(KEYS.map((p) => G.circleOf(G.frameOf(p, M.PU, M.PR, M.PF), 0, 2.6, P, 18)).join(""), { tone: "lo" }));
proj.push(Dots(KEYS.map(at), { size: 0.45, tone: "mid" }));
proj.push(`<g data-part="proj-led">${Dots([at(topAt(BODY.u1 - 10, -18))], { size: 1, tone: "lit" })}</g>`);
onto("proj.body", proj.join(""));
const FOCUS_F = G.frameOf(pAt(BODY.u1, 0, -24), M.PR, M.PU, M.PF);
discAt("back", "proj.focus", FOCUS_F, 0, 3.2, 8, { tone: "mid" }, { extra: knurlRing(FOCUS_F, 0, 3.2, 8, 32) });
const HDMI_AT = pAt(BODY.u1, -3, -80);
prismAt("back", "proj.hdmi", G.frameOf(HDMI_AT, M.PR, M.PU, M.PF), roundRect(-3, 3, -7, 7, 1, 2), 0, 2.4, { tone: "lo" });
// Placa de inclinación, rótula y poste
const BOTTOM = pAt(LENS_U - 78, BODY.v0, -45);
const PLATE_F = G.frameOf(BOTTOM, G.mul3(M.PU, -1), M.PR, M.PF);
prismAt("back", "proj.plate", PLATE_F, roundRect(-22, 22, -20, 20, 3), 0, 4, { tone: "mid" });
const STEM_TOP = G.add3(BOTTOM, G.mul3(M.PU, -4));
const BALL_R = 9;
const BALL = [STEM_TOP[0], STEM_TOP[1], STEM_TOP[2] - 6 - BALL_R];
const STEM_F = UP([BALL[0], BALL[1], 0]);
const CUP_R = 8;
const CUP_TOP = BALL[2] - Math.sqrt(BALL_R ** 2 - CUP_R ** 2);
const ballShape = rec(A.ball(BALL, BALL_R, { name: "proj.ball" }));
const plateShape = R.solids.find((shape) => shape.name === "proj.plate");
put("back", BALL, S(G.sphereOf(BALL, BALL_R, P), { tone: "hi" }), [ballShape], { name: "proj.ball" });
const STEM_PROFILE = [[BALL[2] + Math.sqrt(BALL_R ** 2 - 16) - 0.4, 4], [STEM_TOP[2] - 1, 4]];
put("back", [BALL[0], BALL[1], (STEM_PROFILE[0][0] + STEM_PROFILE[1][0]) / 2], S(G.solidOf(STEM_PROFILE, STEM_F, P), { tone: "mid" }), [rec(A.solid(STEM_F, STEM_PROFILE, { name: "proj.stem", seated: true, cut: [ballShape, plateShape] }))], { name: "proj.stem" });
const CUP_F = UP([BALL[0], BALL[1], 0]);
const CUP_PROFILE = [[CUP_TOP - 20, 12], [CUP_TOP - 6, 12], [CUP_TOP - 4, CUP_R, 1], [CUP_TOP + 0.3, CUP_R]];
put("back", [BALL[0], BALL[1], CUP_TOP - 10], S(G.solidOf(CUP_PROFILE, CUP_F, P), { tone: "mid" }, ) , [rec(A.solid(CUP_F, CUP_PROFILE, { name: "proj.cup", seated: true, cut: [ballShape] }))], { name: "proj.cup" });
Object.assign(ballShape, { seated: true, cut: [{ ...A.solid(CUP_F, CUP_PROFILE, { name: "proj.cup" }), piece: ballShape.piece, move: ballShape.move, ride: ballShape.ride }] });
const LOCK_F = ALONG([BALL[0] + 12, BALL[1], CUP_TOP - 13], [1, 0, 0]);
discAt("back", "proj.lock.neck", LOCK_F, 0, 4, 1.6);
discAt("back", "proj.lock", LOCK_F, 4, 11, 4.4, {}, { extra: knurlRing(LOCK_F, 4, 11, 4.4, 20) });
cylAt("back", "proj.post", BALL[0], BALL[1], 6.35, 52, CUP_TOP - 20 - 52, {}, { crease: "none", inner: Ln(k.sideArc(BALL[0], BALL[1], 6.35, 100, P, 16), { tone: "faint" }) });
cylAt("back", "proj.holder", BALL[0], BALL[1], 9, 5, 47, {}, { bevel: 0.4 });
cylAt("back", "proj.base", BALL[0], BALL[1], 17, 0, 5, {}, { bevel: 0.6, extra: Dots(G.dotsOf(UP([BALL[0], BALL[1], 0]), 5, 12.5, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.5 }) });

// ---------- Unidad de control: decodifica y muestra el código del píxel en 10 LED ----------
for (const [x, y] of byDepth(k.corners(CCU, 9))) cylAt("back", "ccu.foot", x, y, 5, 0, CCU_Z, { tone: "lo" }, { steps: 20 });
const CCU_SEAM = Ln(k.sideSeam(CCU, CCU_TOP - 8, P, 4), { tone: "faint" });
slabAt("back", "ccu.case", CCU, CCU_Z, CCU_TOP - CCU_Z, {}, { steps: 4, bevel: 0.8, inner: CCU_SEAM });
const LED_Y = CCU.y + CCU.d - 16;
const LED_X = Array.from({ length: M.BITS }, (_, i) => CCU.x + 16 + i * 9.5);
const ccuTop = [];
const LED_STRIP = { x: CCU.x + 9, y: LED_Y - 7, w: 9.5 * 9 + 14, d: 14, r: 2 };
ccuTop.push(S(k.slabOf(LED_STRIP, CCU_TOP, 0.8, P, 3), { tone: "lo", crease: "none" }));
const LED_TICKS = k.topTicks(LED_X[0], LED_X[M.BITS - 1], 9.5, 5, LED_STRIP.y + LED_STRIP.d - 0.6, CCU_TOP + 0.8, [1.6, 2.8], P);
ccuTop.push(Ln(LED_TICKS.minor, { tone: "lo" }), Ln(LED_TICKS.major, { tone: "mid" }));
ccuTop.push(Ln(LED_X.map((x) => k.ring(x, LED_Y, 3, CCU_TOP + 0.8, P, 18)).join(""), { tone: "lo" }));
ccuTop.push(LED_X.map((x, i) => `<g class="se-led" data-led="${i}">${S(G.sphereOf([x, LED_Y, CCU_TOP + 0.8], 2.1, P, { steps: 24 }), { tone: "mid" })}</g>`).join(""));
for (let i = 0; i < 3; i++) ccuTop.push(Ln(k.planOutline({ x: CCU.x + 12, y: CCU.y + 14 + i * 7, w: 52, d: 2.6, r: 1.3 }, CCU_TOP, P, 3), { tone: "faint" }));
ccuTop.push(Dots(k.corners(CCU, 5).map(([x, y]) => at([x, y, CCU_TOP])), { size: 0.45 }));
onto("ccu.case", ccuTop.join(""));
const KNOB = [CCU.x + CCU.w - 22, CCU.y + 28];
cylAt("back", "ccu.knob", KNOB[0], KNOB[1], 7, CCU_TOP, 6, { tone: "hi" }, { extra: Ln(k.knurl(KNOB[0], KNOB[1], 7, CCU_TOP, CCU_TOP + 6, 32, P), { tone: "lo" }) + Ln(k.lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + 5, KNOB[1] - 2], CCU_TOP + 6, P), { tone: "hi" }) });
const CCU_FRONT = CCU.y + CCU.d;
const SCOPE_PORT = ALONG([CCU.x + 80, CCU_FRONT, CCU_Z + 22], [0, 1, 0]);
discAt("back", "ccu.port.scope", SCOPE_PORT, 0, 3, 9, { tone: "mid" }, { extra: Ln(G.circleOf(SCOPE_PORT, 3, 6, P, 32), { tone: "lo" }) + Dots(G.dotsOf(SCOPE_PORT, 3, 4, 6, P, { all: true }), { size: 0.35 }) });
const VIDEO_PORT = ALONG([CCU.x + 30, CCU_FRONT, CCU_Z + 18], [0, 1, 0]);
discAt("back", "ccu.port.video", VIDEO_PORT, 0, 2.4, 5, { tone: "mid" });
const HDMI_PORT = ALONG([CCU.x + CCU.w, CCU.y + 40, CCU_Z + 12], [1, 0, 0]);
prismAt("back", "ccu.port.hdmi", G.frameOf(HDMI_PORT.o, [1, 0, 0], [0, 1, 0], [0, 0, 1]), roundRect(-7, 7, -3.4, 3.4, 1, 2), 0, 2, { tone: "lo" });

// ---------- Monitor: las dos vistas, izquierda y derecha ----------
const MON_FOOT = { x: MON.x + 30, y: MON.y - 26, w: 104, d: 58, r: 5 };
slabAt("front", "mon.foot", MON_FOOT, 0, 6, {}, { steps: 5, bevel: 0.6 });
const NECK = { x: MON.x + MON.w / 2 - 9, y: MON.y - 8, w: 18, d: 10, r: 2 };
slabAt("front", "mon.neck", NECK, 6, MON_Z - 6, {}, { bevel: 0.4 });
slabAt("front", "mon.case", MON, MON_Z, MON_TOP - MON_Z, {}, { steps: 4, bevel: 0.8 });
const face = [];
const faceAt = (x, z) => at([x, MON_FACE, z]);
const rectOn = (x0, x1, z0, z1) => k.pathOf([faceAt(x0, z0), faceAt(x1, z0), faceAt(x1, z1), faceAt(x0, z1)], true);
face.push(`<path class="se-screen" d="${rectOn(SCREEN.x0, SCREEN.x1, SCREEN.z0, SCREEN.z1)}"/>`);
const IMG = { w: 64, h: 51.2, gap: 6 };
const imgX = [SCREEN.x0 + (SCREEN.x1 - SCREEN.x0 - 2 * IMG.w - IMG.gap) / 2, 0];
imgX[1] = imgX[0] + IMG.w + IMG.gap;
const IMG_Z = SCREEN.z1 - 10;
const screenMatrix = k.sideMatrix([SCREEN.x0, MON_FACE], SCREEN.z1, P, "left");
const eyeImage = (i) => `<image data-eye="${i}" x="${(imgX[i] - SCREEN.x0).toFixed(2)}" y="${(SCREEN.z1 - IMG_Z).toFixed(2)}" width="${IMG.w}" height="${IMG.h}" preserveAspectRatio="none" href=""/>`;
face.push(`<g transform="${screenMatrix}"><clipPath id="se-screen-clip"><rect x="0" y="0" width="${SCREEN.x1 - SCREEN.x0}" height="${SCREEN.z1 - SCREEN.z0}"/></clipPath><g clip-path="url(#se-screen-clip)">${eyeImage(0)}${eyeImage(1)}<g class="se-marks" data-part="marks"></g><text class="se-osd" x="${(imgX[0] - SCREEN.x0 + 1).toFixed(1)}" y="${(SCREEN.z1 - IMG_Z - 2.2).toFixed(1)}">LEFT</text><text class="se-osd" x="${(imgX[1] - SCREEN.x0 + 1).toFixed(1)}" y="${(SCREEN.z1 - IMG_Z - 2.2).toFixed(1)}">RIGHT</text><text class="se-osd" data-part="osd" x="${((SCREEN.x1 - SCREEN.x0) / 2).toFixed(1)}" y="${(SCREEN.z1 - SCREEN.z0 - 4).toFixed(1)}" text-anchor="middle"></text></g></g>`);
face.push(Ln(rectOn(SCREEN.x0, SCREEN.x1, SCREEN.z0, SCREEN.z1), { tone: "lo" }));
face.push(Dots([0, 1, 2].map((i) => faceAt(MON.x + MON.w - 14 - i * 7, MON_Z + 4.5)), { size: 0.7, tone: "mid" }));
face.push(Dots([faceAt(MON.x + 12, MON_Z + 4.5)], { size: 0.9, tone: "lit" }));
onto("mon.case", face.join(""));

// ---------- Tablero de ajedrez de calibración (de aquí salen f y B del endoscopio) ----------
const CHK = { x: 82, y: -8, w: 84, d: 62, r: 2 };
const CHK_H = 3;
const SQ = 8;
const checks = [];
for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2 === 0) {
  const x = CHK.x + 6 + i * SQ, y = CHK.y + 3 + j * SQ;
  checks.push(k.pathOf([[x, y], [x + SQ, y], [x + SQ, y + SQ], [x, y + SQ]].map(([a, b]) => at([a, b, CHK_H])), true));
}
slabAt("front", "chk.plate", CHK, 0, CHK_H, { tone: "hi", crease: "lo" }, { steps: 3, bevel: 0.5, extra: `<path class="se-check" d="${checks.join("")}"/>` + Ln(k.pathOf([[CHK.x + 6, CHK.y + 3], [CHK.x + 6 + 9 * SQ, CHK.y + 3], [CHK.x + 6 + 9 * SQ, CHK.y + 3 + 7 * SQ], [CHK.x + 6, CHK.y + 3 + 7 * SQ]].map(([a, b]) => at([a, b, CHK_H])), true), { tone: "lo" }) });

// ---------- Cables: endoscopio → unidad, proyector → unidad, unidad → monitor ----------
const CABLES = [];
function cable(layer, name, points, { r = 1.6, bend = 9, shells = [true, true] } = {}) {
  const route = G.fillet(points, bend, 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = 6;
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  R.route(name, route, r, { owner: name, limp: true, gaps, rims: shells.map((on) => (on ? r * 1.9 : r)) });
  tubePieces(route, r, P, { maxLength: 16, spacing: 1, gaps }).forEach((piece, i) => put(layer, piece.mid, tubeSvg(piece, { tone: "mid" }), [A.tube(piece.points, piece.radii)], { bias: 0.1, name: `${name}:${i}` }));
  [0, 1].forEach((end) => {
    if (!shells[end]) return;
    const tangent = G.tangentAlong(route, end ? total : 0);
    const tip = end ? route[route.length - 1] : route[0];
    const F = G.frameAlong(tip, tangent);
    const [s0, s1] = end ? [-SHELL, 0] : [0, SHELL];
    put(layer, G.add3(tip, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 1.9, F, P, { bevel: 0.3 }), { tone: "mid" }), [rec(A.disc(F, s0, s1, r * 1.9, { name: `${name}.shell`, owner: name }))], { bias: 0.15, name: `${name}.shell` });
  });
  CABLES.push(name);
}
cable("front", "cable.scope", [
  [SCOPE_X, SCOPE_Y, HEAD.z1 + 20],
  [SCOPE_X, SCOPE_Y, HEAD.z1 + 34],
  [SCOPE_X - 30, SCOPE_Y - 4, HEAD.z1 + 40],
  [POST[0], -14, POST_TOP - 6],
  [POST[0], -14, 34],
  [POST[0] + 18, -26, 14],
  [POST[0] + 18, -30, 3.1],
  [POST[0] + 18, CCU_FRONT + 34, 3.1],
  [SCOPE_PORT.o[0], CCU_FRONT + 22, SCOPE_PORT.o[2]],
  [SCOPE_PORT.o[0], CCU_FRONT + 3, SCOPE_PORT.o[2]],
], { r: 2, shells: [false, true] });
const HDMI_OUT = G.add3(HDMI_AT, G.mul3(M.PR, 2.4));
cable("back", "cable.hdmi", [
  HDMI_OUT,
  G.add3(HDMI_OUT, [12, 0, 0]),
  [HDMI_OUT[0] + 14, HDMI_OUT[1] + 4, 40],
  [HDMI_OUT[0] + 14, HDMI_OUT[1] + 10, 2.7],
  [HDMI_OUT[0] + 14, -184, 2.7],
  [HDMI_PORT.o[0] + 26, -184, 2.7],
  [HDMI_PORT.o[0] + 14, HDMI_PORT.o[1], HDMI_PORT.o[2]],
  [HDMI_PORT.o[0] + 2, HDMI_PORT.o[1], HDMI_PORT.o[2]],
], { r: 1.6 });
const MON_PORT = [MON.x + 14, MON.y, MON_Z + 16];
discAt("front", "mon.port", ALONG(MON_PORT, [0, -1, 0]), 0, 2.4, 5, { tone: "mid" });
cable("front", "cable.video", [
  [VIDEO_PORT.o[0], CCU_FRONT + 2.4, VIDEO_PORT.o[2]],
  [VIDEO_PORT.o[0], CCU_FRONT + 14, VIDEO_PORT.o[2]],
  [VIDEO_PORT.o[0] - 6, CCU_FRONT + 26, 2.7],
  [MON_PORT[0], CCU_FRONT + 40, 2.7],
  [MON_PORT[0], MON.y - 26, 2.7],
  [MON_PORT[0], MON.y - 18, MON_PORT[2]],
  [MON_PORT[0], MON.y - 2.4, MON_PORT[2]],
], { r: 1.6 });

const DATA = {
  W,
  H,
  P,
  V,
  screen: { x0: SCREEN.x0, z1: SCREEN.z1, imgX: imgX.map((x) => x - SCREEN.x0), imgY: SCREEN.z1 - IMG_Z, w: IMG.w, h: IMG.h },
  bits: M.BITS,
};

var RAYS = `<g class="se-rays" data-part="rays"><path class="iso-line" data-tone="lit" data-part="ray-l" d=""/><path class="iso-line" data-tone="lit" data-part="ray-r" d=""/><path class="iso-line se-beam" data-tone="lo" data-part="ray-p" d=""/><g data-part="probe"></g></g>`;
// ---------- Orden de pintado ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const layerOf = (name) => R.items.filter((item) => item.layer === name).map((item) => (item.name === "scope.tip" ? RAYS : "") + item.svg);
const backItems = layerOf("back");
const frontItems = layerOf("front");
const SILHOUETTE = `<path class="iso-line" data-tone="hi" data-part="silhouette" d=""/>`;

const LABEL_TEXT =
  "An optical breadboard with a steel tray holding a piece of porcine tissue. Behind it, a pocket projector on a ball head throws Gray-code stripes onto the tissue; above, a vertical stereo endoscope clamped to a post looks down with its two cameras. A cable runs from the endoscope to a control unit whose ten LEDs show the code of the tracked pixel, and a monitor shows the left and right views with the matched pixel.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, ...backItems], className: "se-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg se-layer se-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${SILHOUETTE}${trayFront}${frontItems.join("")}</svg>`;
const stage = `<div class="se-stage" tabindex="0" role="slider" aria-label="Structured light. Move the pointer over the tissue to pick the pixel; the left and right arrow keys change the pattern, the space bar pauses or resumes the sequence." aria-valuemin="0" aria-valuemax="11" aria-valuenow="0" aria-valuetext="White light"><span class="se-said" aria-live="polite"></span>${backSvg}<canvas class="se-layer se-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

const caption = `To grade depth-estimation algorithms, SCARED (MICCAI 2019) needed the true depth of every pixel an endoscope sees. With the scene held still, a pocket projector throws 10 Gray-code patterns: each stripe sets one bit on or off, and after all ten every projector column has its own number, 0 to ${M.CODES - 1}. Because a Gray code changes a single bit between neighbouring stripes, a pixel on an edge is off by at most one stripe. The same code in the left and right views is the same point on the tissue, so matching them is no longer guesswork: the disparity d gives the depth Z = f·B/d, here with f = ${M.SCOPE.f} px and B = ${M.SCOPE.B} mm, the kind of values a checkerboard calibration gives. For the frames between keyframes, SCARED carried that depth along with the da Vinci robot's kinematics, which is where the errors the teams later reported came in: video lagging the kinematics, and doubtful calibrations in datasets 4 and 5. Ten teams were graded against this ground truth; the winner was off by about 3.5 mm on average.`;

const body = `<div class="se">${k.plateHtml({
  fig: "Fig 1",
  title: "Structured light · SCARED",
  hint: "Pointer: pixel · ← →: pattern · space: pause",
  readout: "white light · reference image",
  keys: [
    { mark: "lit", label: "The tracked pixel and the rays of the two cameras" },
    { mark: "raised", label: "Projector, stereo endoscope and control unit" },
    { mark: "flat", label: "Porcine tissue: what is measured" },
    { mark: "red", label: "LEDs and red band: the pixel's code, bit by bit" },
  ],
  caption,
  body: stage,
})}<p class="se-source">Source: M. Allan et al., “Stereo Correspondence and Reconstruction of Endoscopic Data Challenge,” arXiv:2101.01133 (2021), <a href="https://arxiv.org/abs/2101.01133">arxiv.org/abs/2101.01133</a>. Setup, projector and protocol follow sections II, V and VI; the 3.5 mm figure is read from tables II and III. The tissue shape and the camera values are illustrative.</p></div>`;

const CSS = readFileSync(join(HERE, "estilo.css"), "utf8");
const LIVE = readFileSync(join(HERE, "vivo.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const script = strip("kit/iso-kit.mjs") + strip("modelo.mjs") + LIVE;
const page = k.pageHtml({ title: "Structured light · SCARED", theme: DARK ? "dark" : "light", body: `<style>${CSS}</style>${body}`, script, width: 820 });
const out = DARK ? join(HERE, "oscuro.html") : join(HERE, "..", "index.html");
writeFileSync(out, page);
console.log("escribí", out, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} piezas`, `${CABLES.length} cables`);
A.auditOrExit(R, P);
