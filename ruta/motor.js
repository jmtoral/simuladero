/* Motor de "Tiempo de mercado de una ruta". JS puro, sin dependencias.
   Lo usan index.html (navegador) y prueba.js (Node).

   T = STEM₁ + Σ S_i + Σ D_j + C + STEM₂
   S_i = t_fijo + t_var·Q_i + W_i     Q_i, W_i independientes e iid
   D_j = traslado del tramo j (cliente j → j+1): lognormal con media d·w_j y CV = cvD.
   Los pesos w_j son fijos para la ruta y promedian 1, así que d sigue siendo el traslado promedio.
   STEM₁ y STEM₂ también son lognormales con el mismo CV. */

/* ================= PARÁMETROS =================
   Edita aquí los valores por defecto y los rangos de los controles.
   [grupo, clave, etiqueta, valor, mín, máx, paso, unidad] */
const PARAMS = [
  ['ruta', 'N', 'Clientes', 15, 2, 30, 1, ''],
  ['ruta', 'stem1', 'STEM₁ · UO → primer cliente', 30, 0, 120, 1, 'min'],
  ['ruta', 'd', 'Traslado entre clientes d', 10, 0, 40, 0.5, 'min'],
  ['ruta', 'C', 'Comida C', 45, 0, 90, 5, 'min'],
  ['ruta', 'stem2', 'STEM₂ · último cliente → UO', 30, 0, 120, 1, 'min'],
  ['ruta', 'cvD', 'Variabilidad de los traslados (CV)', 0.3, 0, 1.5, 0.05, ''],
  ['stay', 'tFijo', 't_fijo', 5, 0, 30, 0.5, 'min'],
  ['stay', 'tVar', 't_var', 0.5, 0, 2, 0.05, 'min/caja'],
  ['stay', 'muQ', 'Cajas promedio', 20, 1, 150, 1, 'cajas'],
  ['stay', 'cvQ', 'Variabilidad de las cajas (CV)', 0.6, 0, 2, 0.05, ''],
  ['stay', 'muW', 'Residual W promedio', 8, 0, 60, 0.5, 'min'],
  ['stay', 'cvW', 'Variabilidad de W (CV)', 1, 0, 3, 0.05, ''],
  ['jornada', 'limite', 'Jornada objetivo', 600, 240, 840, 10, 'min'],
  ['modelo', 'sesgo', 'Sesgo del modelo', 0, -30, 30, 1, '%'],
  ['modelo', 'ruido', 'Ruido extra por cliente (desv. estándar)', 0, 0, 15, 0.5, 'min'],
];
/* Con qué predice el planificador el stay de cada cliente. Las cajas se conocen antes de salir (preventa). */
const MODELOS = ['Promedio único', 'Modelo con cajas', 'Perfecto'];
const DIAS_MES = 26;
const DEFAULTS = Object.fromEntries(PARAMS.map((r) => [r[1], r[3]]));

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
function lognormal(nrm, mean, cv) {
  if (cv <= 0 || mean <= 0) return mean;
  const s2 = Math.log(1 + cv * cv);
  return mean * Math.exp(Math.sqrt(s2) * nrm() - s2 / 2);
}

/* ---------- Tramos ----------
   Peso de cada tramo entre clientes: fijo para la ruta (no cambia de un día a otro), entre 0.55 y 1.6
   antes de normalizar a promedio 1. Es lo que hace que unos clientes estén más lejos que otros. */
function pesosTramos(N) {
  const r = mulberry32(2026), w = [];
  for (let j = 0; j < N - 1; j++) w.push(0.55 + 1.05 * r());
  const m = w.reduce((a, b) => a + b, 0) / Math.max(1, w.length);
  return w.map((x) => x / m);
}
// Lognormal que siempre consume una normal, para que mover un CV no cambie el resto del día
function lognormalZ(z, mean, cv) {
  if (cv <= 0 || mean <= 0) return mean;
  const s2 = Math.log(1 + cv * cv);
  return mean * Math.exp(Math.sqrt(s2) * z - s2 / 2);
}

/* ---------- Un día ----------
   Cajas: lognormal redondeada a entero (≥ 0). La comida va después del cliente ⌈N/2⌉;
   su posición no cambia el total. */
function dia(p, rnd, nrm) {
  const comidaTras = Math.ceil(p.N / 2) - 1;
  const clientes = [];
  let stays = 0, fijo = 0, variable = 0, residual = 0;
  for (let i = 0; i < p.N; i++) {
    const Q = Math.max(0, Math.round(lognormal(nrm, p.muQ, p.cvQ)));
    const W = lognormal(nrm, p.muW, p.cvW);
    const S = p.tFijo + p.tVar * Q + W;
    clientes.push({ Q, W, S });
    stays += S; fijo += p.tFijo; variable += p.tVar * Q; residual += W;
  }
  const w = pesosTramos(p.N);
  const stem1 = lognormalZ(nrm(), p.stem1, p.cvD);
  const tramos = w.map((wj) => lognormalZ(nrm(), p.d * wj, p.cvD));
  const stem2 = lognormalZ(nrm(), p.stem2, p.cvD);
  const traslados = tramos.reduce((a, b) => a + b, 0);
  const T = stem1 + traslados + p.C + stem2 + stays;
  // el planificador usa los traslados promedio (Σ w_j = N − 1)
  const fijoRuta = p.stem1 + (p.N - 1) * p.d + p.C + p.stem2;
  // Plan: el mismo día, armado con el stay predicho por cada modelo (× (1 + sesgo) + ruido).
  // Siempre se sortean 3 normales por cliente para que mover los sliders no cambie el día real.
  const ES = p.tFijo + p.tVar * p.muQ + p.muW, plan = [fijoRuta, fijoRuta, fijoRuta];
  for (const c of clientes) {
    const base = [ES, p.tFijo + p.tVar * c.Q + p.muW, c.S];
    for (let k = 0; k < 3; k++) plan[k] += Math.max(0, base[k] * (1 + p.sesgo / 100) + p.ruido * nrm());
  }
  return { clientes, comidaTras, T, plan, stem1, stem2, tramos, pesos: w, partes: { stem1, traslados, comida: p.C, stem2, fijo, variable, residual } };
}

/* ---------- Teoría ----------
   E[T] y Var(T) exactos para Q continua; el redondeo de cajas agrega ≈ t_var²/12 por cliente. */
function teoria(p) {
  const ES = p.tFijo + p.tVar * p.muQ + p.muW;
  const varCajas = p.N * (p.tVar * p.muQ * p.cvQ) ** 2;
  const varW = p.N * (p.muW * p.cvW) ** 2;
  const varTras = p.cvD ** 2 * (p.stem1 ** 2 + p.stem2 ** 2 + pesosTramos(p.N).reduce((a, wj) => a + (p.d * wj) ** 2, 0));
  const fijo = p.stem1 + (p.N - 1) * p.d + p.C + p.stem2 + p.N * p.tFijo;
  // Error del plan por ruta (real − plan): el ruido crece con √N, el sesgo con N
  const ruidoRuta = Math.sqrt(p.N) * p.ruido, sesgoRuta = p.N * ES * p.sesgo / 100;
  // el plan usa traslados promedio: su variación entra al error de los tres modelos
  const sdErr = [varCajas + varW, varW, 0].map((v) => Math.sqrt(v + varTras + ruidoRuta * ruidoRuta));
  return { ES, media: fijo + p.N * (p.tVar * p.muQ + p.muW), sd: Math.sqrt(varCajas + varW + varTras), fijo, varCajas, varW, varTras, ruidoRuta, sesgoRuta, sdErr };
}

/* ---------- Muchos días ---------- */
function correr(p, n, rnd, nrm) {
  const T = new Float64Array(n);
  for (let k = 0; k < n; k++) T[k] = dia(p, rnd, nrm).T;
  return T;
}

if (typeof module !== 'undefined') module.exports = { PARAMS, DEFAULTS, MODELOS, DIAS_MES, pesosTramos, mulberry32, makeNormal, dia, teoria, correr };
