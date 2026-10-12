/* Motor de "Ruta: plan vs. real". JS puro, sin dependencias.
   Lo usan index.html (navegador) y prueba.js (Node). */

/* ================= PARÁMETROS =================
   Edita aquí los valores por defecto y los rangos de los controles.
   [grupo, clave, etiqueta, valor, min, max, paso, ayuda]
   Los interruptores son 0/1 (min 0, max 1, paso 1).
   El grupo "Observado" no va en el panel: son las cifras reales (por ahora inventadas)
   que se comparan contra la simulación. */
const PARAMS = [
  ['Ruta', 'N', 'Clientes en la ruta (N)', 15, 2, 40, 1, 'Fijo, salvo que H2 esté activa'],
  ['Ruta', 'stem1', 'STEM 1 · UO → primer cliente (min)', 30, 0, 120, 1, ''],
  ['Ruta', 'stem2', 'STEM 2 · último cliente → UO (min)', 30, 0, 120, 1, ''],
  ['Ruta', 'd', 'Traslado promedio entre clientes d (min)', 10, 1, 40, 0.5, 'Cada tramo del mapa se escala para que el promedio sea d'],
  ['Ruta', 'C', 'Comida planeada C (min)', 45, 0, 90, 5, ''],

  ['Stay real', 'tFijo', 't_fijo (min)', 5, 0, 30, 0.5, ''],
  ['Stay real', 'tVar', 't_var (min por caja)', 0.5, 0, 2, 0.05, ''],
  ['Stay real', 'muQ', 'Cajas promedio E[Q]', 20, 1, 100, 1, 'Lognormal'],
  ['Stay real', 'cvQ', 'CV de Q', 0.6, 0, 2, 0.05, ''],
  ['Stay real', 'muW', 'Residual promedio E[W] (min)', 8, 0, 40, 0.5, 'Lognormal: espera, acceso, cobro, firma'],
  ['Stay real', 'cvW', 'CV de W', 1, 0, 3, 0.05, ''],

  ['Lo que se cuela en la resta', 'traf', 'Tráfico: traslado real vs. plan', 0.15, -0.3, 1, 0.01, '0.15 = en promedio 15% más lento que lo planeado'],
  ['Lo que se cuela en la resta', 'cvTraf', 'Variabilidad del tráfico (CV)', 0.3, 0, 1, 0.05, ''],
  ['Lo que se cuela en la resta', 'pU', 'Prob. de evento no productivo por parada', 0.15, 0, 0.8, 0.01, 'Taller, patio, desvío, pendiente personal'],
  ['Lo que se cuela en la resta', 'muU', 'Duración media del evento (min)', 25, 0, 120, 1, 'Exponencial'],
  ['Lo que se cuela en la resta', 'excC', 'Exceso medio de comida (min)', 15, 0, 60, 1, 'Exponencial'],
  ['Lo que se cuela en la resta', 'detU', 'Eventos que detecta el filtro de distancia', 0.8, 0, 1, 0.05, 'El modelo robusto saca esas visitas del entrenamiento'],
  ['Lo que se cuela en la resta', 'drift', 'Cambio de E[W] hoy vs. historial', 0, -0.5, 0.5, 0.01, '−0.10 = hoy el residual es 10% menor'],

  ['Modelos', 'q', 'Cuantil del tiempo fijo (modelo robusto)', 60, 50, 70, 1, ''],
  ['Modelos', 'M', 'Clientes en el historial', 300, 50, 1000, 50, ''],
  ['Modelos', 'K', 'Visitas por cliente en el historial', 24, 3, 60, 1, ''],

  ['Hipótesis', 'h1', 'H1 · El chofer llena la holgura', 1, 0, 1, 1, ''],
  ['Hipótesis', 'phi', 'Fracción de la holgura que se consume φ', 0.6, 0, 1, 0.05, 'Holgura = stay asignado − stay necesario, si es positiva'],
  ['Hipótesis', 'h2', 'H2 · El planificador decide N', 0, 0, 1, 1, 'Agrega clientes mientras el plan quepa en la jornada'],
  ['Hipótesis', 'Tmax', 'Jornada máxima del planificador (min)', 600, 240, 780, 10, ''],

  ['Simulación', 'reps', 'Réplicas Monte Carlo', 4000, 500, 20000, 500, ''],
  ['Simulación', 'seed', 'Semilla', 7, 1, 9999, 1, ''],
  ['Simulación', 'dia', 'Día que se anima', 1, 1, 999, 1, ''],

  ['Observado', 'oN0', 'N antes', 15, 1, 60, 1, ''],
  ['Observado', 'oN1', 'N después', 15, 1, 60, 1, ''],
  ['Observado', 'oP0', 'T planeado antes (h)', 9.0, 0, 16, 0.1, ''],
  ['Observado', 'oP1', 'T planeado después (h)', 7.0, 0, 16, 0.1, ''],
  ['Observado', 'oR0', 'T real antes (h)', 9.2, 0, 16, 0.1, ''],
  ['Observado', 'oR1', 'T real después (h)', 8.4, 0, 16, 0.1, ''],
];

const DEFAULTS = Object.fromEntries(PARAMS.map((r) => [r[1], r[3]]));
const NMAX = 40;

/* ---------- Azar ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNormal(rand) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = rand(); while (u <= 1e-300) u = rand();
    const r = Math.sqrt(-2 * Math.log(u)), v = 2 * Math.PI * rand();
    spare = r * Math.sin(v);
    return r * Math.cos(v);
  };
}
// Lognormal con media y CV dados (cv = 0 → constante)
function ln(nrm, mean, cv) {
  if (cv <= 0 || mean <= 0) return mean;
  const s2 = Math.log(1 + cv * cv);
  return mean * Math.exp(Math.sqrt(s2) * nrm() - s2 / 2);
}
const expo = (rnd, mean) => (mean > 0 ? -mean * Math.log(1 - rnd()) : 0);

/* ---------- Estadística ---------- */
function ols(x, y) {
  const n = x.length;
  let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0, n };
}
function quantile(arr, q) {
  if (!arr.length) return NaN;
  const a = Float64Array.from(arr).sort(), pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
const mean = (a) => { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : NaN; };

/* ---------- Mapa inventado ----------
   40 clientes en serpentina (8 columnas × 5 filas) con ruido; el orden de la serpentina es el
   orden de visita. Cada tramo planeado se escala para que su promedio sea d. */
function mapa(d) {
  const r = mulberry32(3), pts = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k < 8; k++) {
    const col = row % 2 ? 7 - k : k;
    pts.push({ x: 0.34 + col * 0.085 + (r() - 0.5) * 0.05, y: 0.13 + row * 0.185 + (r() - 0.5) * 0.08 });
  }
  const raw = [];
  for (let i = 1; i < NMAX; i++) raw.push(Math.hypot(pts[i].x - pts[i - 1].x, (pts[i].y - pts[i - 1].y) * 0.42));
  const k = d / mean(raw);
  return { uo: { x: 0.05, y: 0.5 }, pts, leg: raw.map((v) => v * k) }; // leg[j]: cliente j → j+1
}
// Traslado planeado para llegar a la parada i (0 = STEM 1)
const legPlan = (p, m, i) => (i === 0 ? p.stem1 : m.leg[i - 1]);

/* ---------- Historial sintético y ajuste de los dos modelos ----------
   El stay del historial se midió POR RESTA: (salida_i − salida_{i−1}) − traslado planeado
   [− comida planeada]. Así absorbe exceso de tráfico, eventos no productivos y comida larga. */
function historial(p, rnd, nrm) {
  const H = [];
  for (let c = 0; c < p.M; c++) for (let k = 0; k < p.K; k++) {
    const Q = ln(nrm, p.muQ, p.cvQ), W = ln(nrm, p.muW, p.cvW);
    const S = p.tFijo + p.tVar * Q + W;
    const extra = (ln(nrm, 1 + p.traf, p.cvTraf) - 1) * p.d;
    const U = rnd() < p.pU ? expo(rnd, p.muU) : 0;
    const det = U > 0 && rnd() < p.detU;
    const comida = rnd() < 1 / p.N ? expo(rnd, p.excC) : 0;
    H.push({ c, Q, S, meas: S + extra + U + comida, det });
  }
  return H;
}

function porCliente(rows, M) {
  const g = Array.from({ length: M }, () => []);
  for (const r of rows) g[r.c].push(r);
  return g;
}

// Modelo anterior: OLS por cliente sobre el stay medido, filtro 5–120 min; si no es válido, OLS global.
function ajusteAnterior(H, M) {
  const rows = H.filter((r) => r.meas >= 5 && r.meas <= 120);
  const glob = ols(rows.map((r) => r.Q), rows.map((r) => r.meas));
  const a = new Float64Array(M), b = new Float64Array(M);
  porCliente(rows, M).forEach((g, c) => {
    const f = g.length >= 3 ? ols(g.map((r) => r.Q), g.map((r) => r.meas)) : null;
    const ok = f && f.r >= 0.3 && f.a >= 0 && f.b >= 0;
    a[c] = ok ? f.a : glob.a; b[c] = ok ? f.b : glob.b;
  });
  return { a, b, usados: rows.length / H.length };
}

// Modelo robusto: quita eventos detectados y atípicos (Tukey); β = mediana de pendientes
// informativas; α del cliente = cuantil q de los residuales (medido − β·Q), piso 0.5 min.
function ajusteRobusto(H, M, q) {
  const pre = H.filter((r) => r.meas <= 240 && !r.det);
  const q1 = quantile(pre.map((r) => r.meas), 0.25), q3 = quantile(pre.map((r) => r.meas), 0.75);
  const lo = q1 - 1.5 * (q3 - q1), hi = q3 + 1.5 * (q3 - q1);
  const rows = pre.filter((r) => r.meas >= lo && r.meas <= hi);
  const grupos = porCliente(rows, M), pend = [];
  for (const g of grupos) {
    if (g.length < 3) continue;
    const f = ols(g.map((r) => r.Q), g.map((r) => r.meas));
    if (f.r >= 0.3) pend.push(f.b);
  }
  const beta = pend.length ? quantile(pend, 0.5) : ols(rows.map((r) => r.Q), rows.map((r) => r.meas)).b;
  const alfaGlob = quantile(rows.map((r) => r.meas - beta * r.Q), q / 100);
  const a = new Float64Array(M), b = new Float64Array(M).fill(beta);
  grupos.forEach((g, c) => {
    a[c] = Math.max(0.5, g.length ? quantile(g.map((r) => r.meas - beta * r.Q), q / 100) : alfaGlob);
  });
  return { a, b, usados: rows.length / H.length };
}

/* ---------- Un día ----------
   Mismos números aleatorios para antes y después (comparación justa). */
function generarDia(p, rnd, nrm) {
  const st = [];
  for (let i = 0; i < NMAX; i++) {
    st.push({
      Q: ln(nrm, p.muQ, p.cvQ),
      W: ln(nrm, p.muW * (1 + p.drift), p.cvW),
      f: ln(nrm, 1 + p.traf, p.cvTraf),
      U: rnd() < p.pU ? expo(rnd, p.muU) : 0,
      c: Math.floor(rnd() * p.M),
    });
  }
  return { st, f2: ln(nrm, 1 + p.traf, p.cvTraf), excC: expo(rnd, p.excC) };
}

// Corre la ruta del día con un modelo. Devuelve totales; con tl = true, también la línea de tiempo.
function correr(p, m, dia, mod, tl) {
  const shat = dia.st.map((s) => mod.a[s.c] + mod.b[s.c] * s.Q);
  let n = p.N;
  if (p.h2) {
    n = 1;
    let acc = 0;
    for (let i = 0; i < NMAX; i++) {
      acc += legPlan(p, m, i) + shat[i];
      if (acc + p.C + p.stem2 <= p.Tmax) n = i + 1; else break;
    }
  }
  const L = Math.max(0, Math.ceil(n / 2) - 1); // la comida va después de esta parada
  const r = { n, Tplan: p.C + p.stem2, Treal: 0, viajePlan: p.stem2, viajeExtra: 0, U: 0, comida: p.C, comidaExtra: dia.excC, base: 0, holgura: 0, shat: 0, meas: 0 };
  const ev = tl ? [] : null;
  let t = 0, salida = 0;
  for (let i = 0; i < n; i++) {
    const s = dia.st[i], lp = legPlan(p, m, i), lr = lp * s.f;
    if (tl) {
      ev.push({ k: 'mov', t0: t, t1: t + lr / 2, a: i - 1, b: i, f0: 0, f1: 0.5 });
      if (s.U > 0) ev.push({ k: 'evento', t0: t + lr / 2, t1: t + lr / 2 + s.U, a: i - 1, b: i });
      ev.push({ k: 'mov', t0: t + lr / 2 + s.U, t1: t + lr + s.U, a: i - 1, b: i, f0: 0.5, f1: 1 });
    }
    t += lr + s.U;
    const base = p.tFijo + p.tVar * s.Q + s.W;
    const hol = p.h1 ? p.phi * Math.max(0, shat[i] - base) : 0;
    if (tl) ev.push({ k: 'stay', t0: t, t1: t + base + hol, i, shat: shat[i], S: base + hol });
    t += base + hol;
    // la resta: tiempo entre salidas menos lo planeado (y la comida planeada, si cayó en este hueco)
    r.meas += t - salida - lp - (i === L + 1 ? p.C : 0);
    salida = t;
    if (i === L) {
      if (tl) ev.push({ k: 'comida', t0: t, t1: t + p.C + dia.excC, i });
      t += p.C + dia.excC;
    }
    r.Tplan += lp + shat[i]; r.viajePlan += lp; r.viajeExtra += lr - lp; r.U += s.U;
    r.base += base; r.holgura += hol; r.shat += shat[i];
  }
  const back = p.stem2 * dia.f2;
  if (tl) ev.push({ k: 'mov', t0: t, t1: t + back, a: n - 1, b: -1, f0: 0, f1: 1 });
  t += back;
  r.viajeExtra += back - p.stem2;
  r.Treal = t;
  if (tl) r.ev = ev;
  return r;
}

/* ---------- Monte Carlo ---------- */
function simular(p) {
  const rnd = mulberry32(p.seed >>> 0), nrm = makeNormal(rnd);
  const m = mapa(p.d);
  const H = historial(p, rnd, nrm);
  const mods = [ajusteAnterior(H, p.M), ajusteRobusto(H, p.M, p.q)];
  const keys = ['viajePlan', 'viajeExtra', 'U', 'comida', 'comidaExtra', 'base', 'holgura', 'shat', 'meas'];
  const acc = mods.map(() => ({ N: new Float64Array(p.reps), Tplan: new Float64Array(p.reps), Treal: new Float64Array(p.reps), sum: Object.fromEntries(keys.map((k) => [k, 0])), stops: 0 }));
  for (let r = 0; r < p.reps; r++) {
    const dia = generarDia(p, rnd, nrm);
    mods.forEach((mod, k) => {
      const x = correr(p, m, dia, mod, false), A = acc[k];
      A.N[r] = x.n; A.Tplan[r] = x.Tplan; A.Treal[r] = x.Treal; A.stops += x.n;
      for (const key of keys) A.sum[key] += x[key];
    });
  }
  const reg = acc.map((A, k) => {
    let err = 0, abs = 0, tr = 0;
    for (let r = 0; r < p.reps; r++) { const e = A.Tplan[r] - A.Treal[r]; err += e; abs += Math.abs(e); tr += A.Treal[r]; }
    const comp = Object.fromEntries(keys.map((key) => [key, A.sum[key] / p.reps]));
    return {
      N: mean(A.N), Tplan: mean(A.Tplan), Treal: mean(A.Treal),
      Treal5: quantile(A.Treal, 0.05), Treal95: quantile(A.Treal, 0.95),
      sesgo: err / p.reps, asertividad: 1 - abs / tr,
      shatCliente: A.sum.shat / A.stops, measCliente: A.sum.meas / A.stops,
      comp, usados: mods[k].usados, _Tplan: A.Tplan, _Treal: A.Treal,
    };
  });
  // Promedios por cliente: lo que pasa de verdad vs. lo que mide la resta en el historial
  const hist = { real: mean(H.map((h) => h.S)), medido: mean(H.map((h) => h.meas)) };
  // Día animado: su propia semilla
  const r2 = mulberry32((p.dia * 7919 + p.seed) >>> 0);
  const dia = generarDia(p, r2, makeNormal(r2));
  const show = mods.map((mod) => correr(p, m, dia, mod, true));
  return { p, mapa: m, reg, hist, show, teoria: teoria(p, m) };
}

// E[T real] analítico. Válido sólo sin H1 ni H2 (N fijo, nadie llena holgura).
function teoria(p, m) {
  let legs = 0; for (let i = 0; i < p.N; i++) legs += legPlan(p, m, i);
  const f = 1 + p.traf;
  const ES = p.tFijo + p.tVar * p.muQ + p.muW * (1 + p.drift);
  return { ES, ET: (legs + p.stem2) * f + p.N * (ES + p.pU * p.muU) + p.C + p.excC, valido: !p.h1 && !p.h2 };
}

if (typeof module !== 'undefined') module.exports = { PARAMS, DEFAULTS, simular, mapa, correr, generarDia, ajusteAnterior, ajusteRobusto, historial, mulberry32, makeNormal, teoria };
