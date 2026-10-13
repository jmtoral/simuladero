/* Diorama isométrico de la ruta: CEDIS, calles en serpentina, N tienditas, puesto de comida y camión.
   Se arma en el navegador con el kit de la skill "anatomy" (vendor/iso-kit.js, objeto K)
   cada vez que cambia el día o N. Mundo en unidades de ~1 px: x, y en el piso, z hacia arriba. */
const Diorama = (() => {
  const W = 960, H = 540;
  const BOARD = { x: -340, y: -235, w: 680, d: 470, r: 12 }, BH = 14, FOOT = 5;
  const RW = 14;                                                            // medio ancho de calle
  const CEDIS = { x: -335, y: -205, w: 48, d: 130, r: 2 }, CH = 32, DOCK_Y = -140;
  const FX = CEDIS.x + CEDIS.w;                                             // muro de andenes
  const SIDEWALK = 10, STORE = { l: 24, d: 26 };

  const P = K.fitProjection([...K.boxCorners(BOARD, -BH - FOOT, 0), ...K.boxCorners(CEDIS, 0, CH + 6)], W, H, { pad: 14, azimuth: 45 });
  const VIEW = K.towardViewer(P);
  const at = (p) => K.iso(p, P);
  const S = (paths, style) => K.solidSvg(paths, style);
  const L = (d, style) => K.lineSvg(d, style);
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const perp = (u) => [-u[1], u[0]];
  const facing = (n) => n[0] * VIEW[0] + n[1] * VIEW[1] > 0.02;
  const depth = (x, y, z = 0) => K.depthOf([x, y, z], P);
  const poly = (pts, closed) => K.pathOf(pts.map(at), closed);

  // Caja girada: centro c, eje largo u (unitario), medias longitudes hl (a lo largo de u) y hw (a lo ancho)
  function ringOf(c, u, hl, hw) {
    const v = perp(u);
    return [add(add(c, u, hl), v, hw), add(add(c, u, -hl), v, hw), add(add(c, u, -hl), v, -hw), add(add(c, u, hl), v, -hw)];
  }
  const box = (c, u, hl, hw, z, h, bevel = 0) => K.extrude(ringOf(c, u, hl, hw), z, h, P, { bevel });
  // Rectángulo dibujado sobre una cara vertical: o = punto en la base de la cara, u = dirección de la cara
  const faceRect = (o, u, a0, a1, z0, z1) => poly([[...add(o, u, a0), z0], [...add(o, u, a1), z0], [...add(o, u, a1), z1], [...add(o, u, a0), z1]], true);
  const faceLine = (o, u, a0, a1, z0, z1) => poly([[...add(o, u, a0), z0], [...add(o, u, a1), z1]]);

  /* ---------- Recorrido ----------
     Serpentina: calle de arriba (+x), bajada a la de en medio (−x), bajada a la de abajo (+x),
     y regreso al CEDIS por el periférico del frente y la avenida de la izquierda. */
  const PATH = [[FX + 23, DOCK_Y], [270, DOCK_Y], [270, 0], [-200, 0], [-200, 140], [270, 140], [270, 205], [-250, 205], [-250, DOCK_Y], [FX + 23, DOCK_Y]];
  const STREETS = [[[FX + 6, DOCK_Y], [270, DOCK_Y]], ...PATH.slice(1, -2).map((a, k) => [a, PATH[k + 2]])];
  function polyline(points) {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = cum[cum.length - 1];
    const pointAt = (s) => {
      s = Math.max(0, Math.min(total, s));
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const a = points[i - 1], b = points[i], f = (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };
    const tangentAt = (s, h = 1) => {
      const a = pointAt(s - h), b = pointAt(s + h), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    };
    return { total, cum, pointAt, tangentAt };
  }
  const ROUTE = polyline(PATH);
  const APPROACH = 16;                       // en el patio del CEDIS el camión siempre mira hacia la calle
  // Tramos donde puede haber tiendas: las tres calles largas, lejos de las esquinas
  const C = ROUTE.cum;
  const STRAIGHTS = [
    [C[0] + (-206 - PATH[0][0]), C[0] + (226 - PATH[0][0])],
    [C[2] + (270 - 226), C[2] + (270 + 156)],
    [C[4] + (-156 + 200), C[4] + (226 + 200)],
  ];
  const USABLE = STRAIGHTS.reduce((t, [a, b]) => t + b - a, 0);
  function slotAt(f) {                       // f en [0, 1] a lo largo de los tramos con tiendas
    let left = f * USABLE;
    for (const [a, b] of STRAIGHTS) { if (left <= b - a) return a + left; left -= b - a; }
    return STRAIGHTS[STRAIGHTS.length - 1][1];
  }

  /* ---------- Piezas ---------- */
  function board() {
    const out = [`<path class="iso-halo" d="${K.haloOf(BOARD, -BH - FOOT, BH, P)}"/>`];
    const feet = K.corners(BOARD, 30).sort((a, b) => depth(...a) - depth(...b));
    for (const [x, y] of feet) {
      out.push(S(K.cylinder(x, y, 9, -BH - FOOT, 1.6, P, 28), { tone: "lo" }));
      out.push(S(K.cylinder(x, y, 7, -BH - FOOT + 1.6, FOOT - 1.6, P, 28), { tone: "mid" }));
    }
    out.push(S(K.slabOf(BOARD, -BH, BH, P, 8, 1.6), { tone: "mid" }));
    out.push(L(K.planOutline(K.insetPlan(BOARD, 6), 0, P), { tone: "faint" }));
    out.push(yardGround());
    const screws = K.corners(BOARD, 12);
    out.push(L(screws.map(([x, y]) => K.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(K.dotsSvg(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
    // placa de identificación
    const plate = { x: 291, y: 150, w: 42, d: 18, r: 1.5 };
    out.push(S(K.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
    out.push(L(K.planOutline(K.insetPlan(plate, 1.8), 0.8, P, 4), { tone: "faint" }));
    [[7, 28], [7, 20], [7, 24]].forEach(([x0, w], i) => out.push(L(K.lineOnTop([plate.x + x0, plate.y + 5 + i * 4], [plate.x + x0 + w, plate.y + 5 + i * 4], 0.8, P), { tone: "lo", free: true })));
    out.push(K.dotsSvg([at([plate.x + 3, plate.y + 9, 0.8]), at([plate.x + plate.w - 3, plate.y + 9, 0.8])], { size: 0.45 }));
    return out.join("");
  }

  function streets() {
    const out = [];
    const planOf = ([a, b]) => ({ x: Math.min(a[0], b[0]) - RW, y: Math.min(a[1], b[1]) - RW, w: Math.abs(b[0] - a[0]) + 2 * RW, d: Math.abs(b[1] - a[1]) + 2 * RW, r: 2 });
    const plans = STREETS.map(planOf);
    plans.forEach((pl) => out.push(S(K.slabOf(pl, 0, 0.8, P, 2), { tone: "lo", crease: "none", className: "asphalt" })));
    // segunda pasada sólo con las tapas: borra los bordes de una calle dentro de otra (cruces limpios)
    plans.forEach((pl) => out.push(`<path class="asphalt-top" d="${K.slabOf(K.insetPlan(pl, 0.6), 0, 0.8, P, 2).top}"/>`));
    // líneas centrales, cortadas antes de cada cruce
    STREETS.forEach(([a, b]) => {
      const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L0, uy = (b[1] - a[1]) / L0, m = RW + 4;
      if (L0 > 2 * m) out.push(L(K.lineOnTop([a[0] + ux * m, a[1] + uy * m], [b[0] - ux * m, b[1] - uy * m], 0.8, P), { tone: "mid", dashed: true }));
    });
    // paso peatonal en la avenida, frente al estacionamiento
    for (let x = -250 - RW + 2.5; x < -250 + RW - 2; x += 4.4) out.push(L(K.planOutline({ x, y: -66, w: 2.6, d: 12, r: 0.3 }, 0.8, P, 2), { tone: "mid" }));
    // franjas del patio de maniobras
    for (const y of [DOCK_Y - 16, DOCK_Y + 16]) out.push(L(K.lineOnTop([FX + 6, y], [-250 - RW, y], 0.8, P), { tone: "mid" }));
    // patios entre las filas de tiendas: pasto
    for (const y of [-70, 70]) out.push(S(K.slabOf({ x: -170, y: y - 16, w: 410, d: 32, r: 4 }, 0, 0.5, P, 4), { tone: "lo", crease: "none", className: "lawn" }));
    return out.join("");
  }

  function cedis() {
    const out = [`<path class="iso-halo" d="${K.haloOf(CEDIS, 0, CH, P)}" style="filter:blur(5px)"/>`];
    const dockPlat = { x: FX, y: DOCK_Y - 48, w: 6, d: 96, r: 0.8 };
    out.push(S(K.slabOf(K.insetPlan(CEDIS, -2), 0, 2, P, 3), { tone: "lo" }));
    out.push(S(K.slabOf(CEDIS, 2, CH - 2, P, 3, 0.8), { tone: "hi", inner: L(K.sideSeam(CEDIS, 12, P, 3), { tone: "faint" }) }));
    // muro +x: tres andenes con cortina, defensas y lámparas
    const fx = CEDIS.x + CEDIS.w, face = [fx, 0];
    for (const yc of [DOCK_Y - 30, DOCK_Y, DOCK_Y + 30]) {
      out.push(L(faceRect([fx, yc - 9], [0, 1], 0, 18, 4, 17), { tone: "mid" }));
      for (let z = 6.5; z < 17; z += 2.6) out.push(L(faceLine([fx, yc - 9], [0, 1], 0, 18, z, z), { tone: "faint" }));
    }
    out.push(S(K.slabOf(dockPlat, 0, 4, P, 2, 0.4), { tone: "mid" }));
    for (const yc of [DOCK_Y - 30, DOCK_Y, DOCK_Y + 30]) for (const s of [-1, 1]) out.push(S(K.slabOf({ x: fx + 6, y: yc + s * 10 - 1.2, w: 1.6, d: 2.4, r: 0.3 }, 1.5, 2.5, P, 2), { tone: "mid", crease: "none" }));
    out.push(K.dotsSvg([DOCK_Y - 30, DOCK_Y, DOCK_Y + 30].map((yc) => at([fx, yc, 21])), { size: 0.8, tone: "hi" }));
    // muro +y: lámina acanalada de orilla a orilla
    const fy = CEDIS.y + CEDIS.d;
    const ribs = [];
    for (let x = CEDIS.x + 4; x < CEDIS.x + CEDIS.w - 2; x += 3.5) ribs.push(K.segment([x, fy, 12], [x, fy, CH], P));
    out.push(L(ribs.join(""), { tone: "faint" }));
    // techo: pretil, tragaluces y equipos
    out.push(L(K.planOutline(K.insetPlan(CEDIS, 2.5), CH, P, 3), { tone: "lo" }));
    for (let y = CEDIS.y + 14; y < CEDIS.y + CEDIS.d - 14; y += 24) out.push(S(K.slabOf({ x: CEDIS.x + 12, y, w: 22, d: 10, r: 0.5 }, CH, 1.2, P, 2), { tone: "lo", crease: "none" }));
    for (const y of [CEDIS.y + 16, CEDIS.y + CEDIS.d - 30]) {
      out.push(S(K.slabOf({ x: CEDIS.x + 30, y, w: 11, d: 13, r: 0.6 }, CH, 5, P, 2, 0.4), { tone: "mid" }));
      out.push(L(K.ring(CEDIS.x + 35.5, y + 6.5, 3.6, CH + 5, P, 20), { tone: "lo" }));
      out.push(K.dotsSvg([at([CEDIS.x + 35.5, y + 6.5, CH + 5])], { size: 0.5 }));
    }
    // placa grabada
    out.push(K.faceTextSvg(K.sideMatrix([fx, DOCK_Y], 26, P, "right"), "CEDIS", { size: 5, tone: "mid", anchor: "middle" }));
    return out.join("");
  }

  // Estacionamiento de la flota junto al CEDIS: tres camiones quietos y un cajón libre (el del camión en ruta)
  const YARD = { x: -334, y: -52, w: 62, d: 190, r: 3 };
  function yardGround() {
    let out = S(K.slabOf(YARD, 0, 0.8, P, 3), { tone: "lo", crease: "none", className: "asphalt" });
    for (let k = 0; k <= 7; k++) out += L(K.lineOnTop([YARD.x + 6, YARD.y + 4 + k * 26], [YARD.x + YARD.w, YARD.y + 4 + k * 26], 0.8, P), { tone: "mid" });
    out += S(K.slabOf({ x: YARD.x, y: YARD.y, w: 4, d: YARD.d, r: 0.6 }, 0.8, 1.6, P, 2), { tone: "mid" });
    return out;
  }
  const PARKED = [0, 1, 3, 5].map((k) => [YARD.x + 33, YARD.y + 17 + k * 26]);
  function tower(x, y) {
    const out = [`<path class="iso-halo" d="${K.haloOf({ x: x - 12, y: y - 12, w: 24, d: 24, r: 12 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
    out.push(S(K.cylinder(x, y, 10, 0, 1.4, P, 32), { tone: "lo" }));
    const legs = [[x - 6, y - 6], [x + 6, y - 6], [x - 6, y + 6], [x + 6, y + 6]].sort((a, b) => depth(...a) - depth(...b));
    legs.forEach(([a, b], i) => { out.push(S(K.cylinder(a, b, 0.9, 1.4, 30, P, 10), { tone: "mid", crease: "none" })); if (i === 1) out.push(S(K.cylinder(x, y, 0.6, 1.4, 30, P, 8), { tone: "lo", crease: "none" })); });
    out.push(S(K.cylinder(x, y, 9, 31.4, 1.2, P, 36), { tone: "mid" }));
    out.push(S(K.cylinder(x, y, 8, 32.6, 13, P, 40, 0.6), { tone: "hi", inner: L(K.sideArc(x, y, 8, 37, P, 28) + K.sideArc(x, y, 8, 41.5, P, 28), { tone: "faint" }) }));
    out.push(S(K.cylinder(x, y, 5, 45.6, 2, P, 28, 0.4), { tone: "mid" }));
    out.push(S(K.cylinder(x, y, 1.6, 47.6, 2, P, 14), { tone: "mid" }));
    return out.join("");
  }

  function tree(x, y, s = 1) {
    return `<path class="iso-halo" d="${K.haloOf({ x: x - 6 * s, y: y - 6 * s, w: 12 * s, d: 12 * s, r: 6 * s }, 2.7, 0.1, P)}" style="filter:blur(3px)"/>` +
      S(K.cylinder(x, y, 1.3 * s, 2.7, 8 * s, P, 12), { tone: "mid", crease: "none" }) +
      S(K.cylinder(x, y, 7 * s, 2.7 + 8 * s, 5 * s, P, 24, 0.5), { tone: "mid", className: "crown" }) +
      S(K.cylinder(x, y, 4.8 * s, 2.7 + 13 * s, 4 * s, P, 20, 0.4), { tone: "mid", className: "crown" });
  }
  function bench(x, y, alongX) {
    const plan = alongX ? { x: x - 7, y: y - 2, w: 14, d: 4, r: 0.6 } : { x: x - 2, y: y - 7, w: 4, d: 14, r: 0.6 };
    const legs = alongX ? [[x - 5, y], [x + 5, y]] : [[x, y - 5], [x, y + 5]];
    return legs.map(([a, b]) => S(K.slabOf({ x: a - 1, y: b - 1.5, w: 2, d: 3, r: 0.3 }, 2.7, 2.6, P, 2), { tone: "lo", crease: "none" })).join("") +
      S(K.slabOf(plan, 5.3, 1, P, 2, 0.3), { tone: "mid" });
  }

  // Tiendita en la posición s del recorrido, en la acera side (+1 izquierda, −1 derecha). Su frente mira a la calle.
  function store(i, s, Q, side) {
    const p = ROUTE.pointAt(s), u = ROUTE.tangentAt(s, 4), n = [side * u[1], -side * u[0]];   // n: de la calle hacia la tienda
    const fromLane = RW;                                                                       // del eje al borde de la calle
    const c = add(p, n, fromLane + SIDEWALK + STORE.d / 2);
    const front = add(p, n, fromLane + SIDEWALK);                              // base de la fachada
    const hl = STORE.l / 2, hd = STORE.d / 2, out = [];
    out.push(`<path class="iso-halo" d="${poly(ringOf(c, u, hl + 1, hd + 1).map((q) => [...q, 0]), true)}" style="filter:blur(4px)"/>`);
    out.push(S(box(c, u, hl + 1, hd + 1, 0, 1.2), { tone: "lo" }));
    const showFront = facing([-n[0], -n[1]]);
    let frontArt = "";
    if (showFront) {
      frontArt += L(faceRect(front, u, -10, -3, 1.2, 11), { tone: "mid" }) + L(faceLine(front, u, -6.5, -6.5, 1.2, 11), { tone: "faint" });
      frontArt += L(faceRect(front, u, 0, 10, 4.5, 10.5), { tone: "mid" }) + L(faceLine(front, u, 5, 5, 4.5, 10.5), { tone: "faint" });
    }
    const bh = 14 + ((i * 7) % 5) * 1.4, top = 1.2 + bh;           // alturas variadas, misma planta
    out.push(S(box(c, u, hl, hd, 1.2, bh, 0.6), { tone: "hi", inner: frontArt, className: "body" }));
    out.push(S(box(c, u, hl + 0.8, hd + 0.8, top, 1.6, 0.5), { tone: "mid" }));
    // letrero sobre el pretil, toldo y equipo de aire
    out.push(S(box(add(front, n, 1.6), u, hl - 3, 0.7, top + 1.6, 4.6), { tone: "mid", className: "sign" }));
    out.push(S(box(add(front, n, -2.8), u, hl - 2, 2.8, 12, 1.1, 0.3), { tone: "mid", className: "awning" }));
    const ac = add(add(c, u, -hl + 6), n, 5);
    out.push(S(box(ac, u, 2.8, 2.4, top + 1.6, 2.6, 0.3), { tone: "mid" }));
    out.push(L(K.ring(ac[0], ac[1], 1.5, top + 4.2, P, 14), { tone: "lo" }));
    // tarima en la banqueta con las cajas de este cliente (rojas: lo aleatorio)
    const pal = add(add(p, n, fromLane + SIDEWALK / 2), u, hl - 5);
    out.push(S(box(pal, u, 4.4, 3.2, 0, 1.2), { tone: "lo", crease: "none" }));
    const count = Math.max(1, Math.min(18, Math.ceil(Q / 4))), cubes = [];
    for (let k = 0; k < count; k++) {
      const layer = Math.floor(k / 6), slot = k % 6, a = (slot % 3) - 1, b = Math.floor(slot / 3) - 0.5;
      const cc = add(add(pal, u, a * 2.8), n, b * 2.8);
      cubes.push({ k, key: depth(cc[0], cc[1], layer), svg: S(box(cc, u, 1.25, 1.25, 1.2 + layer * 2.6, 2.5, 0.2), { tone: "hi", className: "box" }) });
    }
    // el orden de aparición es el de carga (capa por capa); el de dibujo, por profundidad
    const drawn = [...cubes].sort((x, y) => x.key - y.key).map((cb) => `<g data-cube="${cb.k}" visibility="hidden">${cb.svg}</g>`).join("");
    out.push(`<g class="stack">${drawn}</g>`);
    return { key: depth(c[0], c[1], 10), svg: `<g class="store" data-store="${i}">${out.join("")}</g>`, count };
  }

  // Puesto de comida sobre la banqueta, donde se detiene el camión a comer
  function fonda(s, side) {
    const p = ROUTE.pointAt(s), u = ROUTE.tangentAt(s, 4), n = [side * u[1], -side * u[0]];
    const c = add(p, n, RW + 5), out = [];
    out.push(`<path class="iso-halo" d="${poly(ringOf(c, u, 8, 4).map((q) => [...q, 0]), true)}" style="filter:blur(3px)"/>`);
    out.push(S(box(c, u, 6, 3, 0, 8, 0.4), { tone: "hi" }));
    out.push(S(box(c, u, 6.8, 3.6, 8, 0.8, 0.3), { tone: "mid" }));
    const t = add(add(c, u, -2), n, 0.4);
    out.push(S(K.cylinder(t[0], t[1], 0.5, 8.8, 6, P, 8), { tone: "mid", crease: "none" }));
    out.push(S(K.cylinder(t[0], t[1], 6.5, 14.8, 0.8, P, 28, 0.4), { tone: "mid", className: "parasol" }));
    return { key: depth(c[0], c[1], 6), svg: `<g class="fonda">${out.join("")}</g>` };
  }

  // Camión de caja seca, rehecho en cada cuadro con su rumbo u
  function truck(c, u, lit = true) {
    const v = perp(u), parts = [];
    const put = (key, svg) => parts.push({ key, svg });
    const wheel = (a, side) => {
      const o = add(add(c, u, a), v, side * 6.6), r = 3.2, pts = [];
      for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2; pts.push([o[0] + u[0] * Math.cos(t) * r, o[1] + u[1] * Math.cos(t) * r, 3.2 + Math.sin(t) * r]); }
      const hub = pts.map((q) => [o[0] + (q[0] - o[0]) * 0.45, o[1] + (q[1] - o[1]) * 0.45, 3.2 + (q[2] - 3.2) * 0.45]);
      return `<path class="iso-fill" d="${poly(pts, true)}"/><path class="iso-line" data-tone="hi" d="${poly(pts, true)}"/><path class="iso-line" data-tone="lo" d="${poly(hub, true)}"/>`;
    };
    const near = facing(v) ? 1 : -1;
    for (const a of [-9, -5, 10]) put(-50, wheel(a, -near));
    put(-10, S(box(c, u, 17, 5.6, 2.2, 2.2), { tone: "mid" }));
    const cab = add(c, u, 11.5), cargo = add(c, u, -4);
    const cabArt = facing(u) ? L(poly([[...add(add(cab, u, 5.5), v, -4.6), 9], [...add(add(cab, u, 5.5), v, 4.6), 9], [...add(add(cab, u, 5.5), v, 4.6), 13], [...add(add(cab, u, 5.5), v, -4.6), 13]], true), { tone: "hi" }) : "";
    const sideWin = facing([v[0] * near, v[1] * near]) ? L(poly([[...add(add(cab, u, -2), v, near * 5.8), 9.5], [...add(add(cab, u, 3.5), v, near * 5.8), 9.5], [...add(add(cab, u, 3.5), v, near * 5.8), 13], [...add(add(cab, u, -2), v, near * 5.8), 13]], true), { tone: "mid" }) : "";
    const cabSvg = S(box(cab, u, 5.5, 5.8, 4.4, 10, 0.5), { tone: lit ? "hi" : "mid", lit, inner: cabArt + sideWin });
    const rear = add(c, u, -17.2);
    const doorArt = facing([-u[0], -u[1]]) ? L(faceLine(rear, v, 0, 0, 5, 19), { tone: "faint" }) + L(faceLine(rear, v, -6.3, 6.3, 12, 12), { tone: "faint" }) : "";
    const cargoSvg = S(box(cargo, u, 13.2, 6.5, 4.4, 15, 0.6), { tone: lit ? "hi" : "mid", lit, inner: doorArt });
    if (facing(u)) { put(0, cargoSvg); put(1, cabSvg); } else { put(0, cabSvg); put(1, cargoSvg); }
    put(2, S(box(add(c, u, 17.4), u, 0.6, 5.8, 3, 2), { tone: "mid", crease: "none" }));
    for (const sgn of [-1, 1]) put(3, S(box(add(add(cab, u, 3), v, sgn * 6.6), u, 0.6, 0.6, 11, 2.4), { tone: "mid", crease: "none" }));
    for (const a of [-9, -5, 10]) put(10, wheel(a, near));
    const halo = `<path class="iso-halo" d="${poly(ringOf(c, u, 18, 7).map((q) => [...q, 0]), true)}" style="filter:blur(4px)"/>`;
    return halo + parts.sort((a, b) => a.key - b.key).map((p) => p.svg).join("");
  }

  /* ---------- Estado ---------- */
  let root, itemsG, truckG, stops = [], lunchS = 0, ev = [], endT = 0, counts = [], lastKey = null, readout = null;

  function build(container, p, day, out) {
    readout = out;
    const N = day.clientes.length;
    // posición de cada cliente: proporcional al traslado promedio acumulado (pesos del motor)
    const cumW = [0]; day.pesos.forEach((w) => cumW.push(cumW[cumW.length - 1] + w));
    stops = day.clientes.map((_, i) => slotAt(N === 1 ? 0.5 : cumW[i] / cumW[N - 1]));
    const sideOf = (i) => (i % 2 ? -1 : 1);
    const Lidx = day.comidaTras;
    lunchS = Lidx < N - 1 ? (stops[Lidx] + stops[Lidx + 1]) / 2 : stops[N - 1];
    const items = [];
    items.push({ key: depth(CEDIS.x + CEDIS.w / 2, DOCK_Y, 16), svg: cedis() });
    counts = [];
    day.clientes.forEach((cl, i) => { const st = store(i, stops[i], cl.Q, sideOf(i)); counts.push(st.count); items.push(st); });
    items.push(fonda(lunchS, sideOf(Lidx)));
    PARKED.forEach(([x, y]) => items.push({ key: depth(x, y, 9), svg: truck([x, y], [1, 0], false) }));
    items.push({ key: depth(313, -70, 20), svg: tower(313, -70) });
    [[314, -175, 1.3], [312, 50, 1.2], [310, 100, 1.05], [-305, 165, 1.1]].forEach(([x, y, sc]) => items.push({ key: depth(x, y, 8), svg: tree(x, y, sc) }));
    // arboleda y bancas en los patios entre filas de tiendas
    for (const y of [-70, 70]) for (let x = -140, k = 0; x <= 220; x += 52, k++) {
      if (k % 3 === 1) items.push({ key: depth(x, y, 4), svg: bench(x, y, true) });
      else items.push({ key: depth(x, y, 8), svg: tree(x, y + ((k * 7) % 5) - 2, 1.1 + ((k * 3) % 4) * 0.12) });
    }
    items.sort((a, b) => a.key - b.key);

    container.innerHTML = K.figureSvg({
      width: W, height: H,
      label: `Diorama de la ruta: el CEDIS a la izquierda, calles en serpentina con ${N} tienditas en ambas aceras, un puesto de comida y el camión que sale del CEDIS, visita a cada cliente y regresa por el periférico.`,
      body: [board(), streets(), `<g data-items>${items.map((it) => `<g data-key="${it.key.toFixed(3)}">${it.svg}</g>`).join("")}</g>`],
    });
    root = container.querySelector("svg");
    itemsG = root.querySelector("[data-items]");
    truckG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    truckG.setAttribute("data-truck", "");
    itemsG.appendChild(truckG);
    lastKey = null;
    timeline(p, day);
  }

  // Línea de tiempo en minutos: posición en el recorrido (arco s) y qué pasa
  function timeline(p, day) {
    ev = []; let t = 0;
    const move = (s0, s1, dur, what) => { ev.push({ k: "mov", s0, s1, t0: t, t1: (t += dur), what }); };
    const last = day.clientes.length - 1;
    move(0, stops[0], day.stem1, "STEM₁ · rumbo al cliente 1");
    day.clientes.forEach((c, i) => {
      ev.push({ k: "stay", i, s: stops[i], t0: t, t1: (t += c.S), c });
      if (i === day.comidaTras && i < last) {
        move(stops[i], lunchS, day.tramos[i] / 2, `traslado al cliente ${i + 2}`);
        ev.push({ k: "comida", s: lunchS, t0: t, t1: (t += p.C) });
        move(lunchS, stops[i + 1], day.tramos[i] / 2, `traslado al cliente ${i + 2}`);
      } else if (i < last) move(stops[i], stops[i + 1], day.tramos[i], `traslado al cliente ${i + 2}`);
    });
    if (day.comidaTras >= last) ev.push({ k: "comida", s: stops[last], t0: t, t1: (t += p.C) });
    move(stops[last], ROUTE.total, day.stem2, "STEM₂ · regreso al CEDIS");
    endT = t;
  }

  const ease = (x) => x * x * (3 - 2 * x);
  function frame(t) {
    if (!root) return;
    const e = ev.find((x) => t >= x.t0 && t < x.t1) || ev[ev.length - 1];
    let s, text;
    if (e.k === "mov") { const f = t >= e.t1 ? 1 : ease(Math.min(1, (t - e.t0) / Math.max(1e-9, e.t1 - e.t0))); s = e.s0 + (e.s1 - e.s0) * f; text = e.what; }
    else s = e.s;
    // rumbo: tangente suavizada; en el patio del CEDIS el camión siempre mira hacia la calle
    let u = ROUTE.tangentAt(s, 7);
    if (s < APPROACH || s > ROUTE.total - APPROACH) u = [1, 0];
    const c = ROUTE.pointAt(s);
    truckG.innerHTML = truck(c, u);
    const key = depth(c[0], c[1], 9);
    if (key !== lastKey) {
      const after = [...itemsG.children].find((g) => g !== truckG && +g.dataset.key > key) || null;
      if (truckG.nextSibling !== after) itemsG.insertBefore(truckG, after);
      lastKey = key;
    }
    // cajas descargadas y tienda activa
    const stayOf = (i) => ev.find((x) => x.k === "stay" && x.i === i);
    root.querySelectorAll(".store").forEach((g) => {
      const i = +g.dataset.store, st = stayOf(i);
      const f = t >= st.t1 ? 1 : t <= st.t0 ? 0 : (t - st.t0) / (st.t1 - st.t0);
      const show = Math.ceil(counts[i] * f - 1e-9);
      g.querySelectorAll("[data-cube]").forEach((cb) => cb.setAttribute("visibility", +cb.dataset.cube < show ? "visible" : "hidden"));
      g.classList.toggle("active", f > 0 && f < 1);
    });
    if (readout) {
      if (t >= endT) text = "De vuelta en el CEDIS";
      else if (e.k === "stay") text = `Cliente ${e.i + 1} · ${e.c.Q} cajas · ${(t - e.t0).toFixed(0)} de ${e.c.S.toFixed(1)} min`;
      else if (e.k === "comida") text = "Comida";
      readout(text);
    }
  }
  return { build, frame, get end() { return endT; } };
})();
