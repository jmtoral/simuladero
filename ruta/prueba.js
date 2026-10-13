// Verificaciones del motor: node ruta/prueba.js
const assert = require('assert');
const M = require('./motor.js');
const p = M.DEFAULTS, rnd = M.mulberry32(1), nrm = M.makeNormal(rnd);

// 1. Cada día cuadra con la fórmula T = STEM₁ + ΣS + ΣD + C + STEM₂, y los pesos de los tramos promedian 1
for (let k = 0; k < 100; k++) {
  const x = M.dia(p, rnd, nrm), sumS = x.clientes.reduce((a, c) => a + c.S, 0), sumD = x.tramos.reduce((a, b) => a + b, 0);
  assert(Math.abs(x.T - (x.stem1 + sumS + sumD + p.C + x.stem2)) < 1e-9, 'fórmula del día');
}
for (const n of [2, 15, 30]) { const w = M.pesosTramos(n); assert(Math.abs(w.reduce((a, b) => a + b, 0) - (n - 1)) < 1e-9, 'pesos'); }
// 2. Media y desviación Monte Carlo ≈ teoría
const T = M.correr(p, 100000, rnd, nrm), th = M.teoria(p);
const mean = T.reduce((a, b) => a + b, 0) / T.length;
const sd = Math.sqrt(T.reduce((a, b) => a + (b - mean) ** 2, 0) / T.length);
assert(Math.abs(mean / th.media - 1) < 0.003, `media ${mean} vs ${th.media}`);
assert(Math.abs(sd / th.sd - 1) < 0.03, `sd ${sd} vs ${th.sd}`);
// 3. Sin variabilidad, T es constante e igual a la media teórica
const T0 = M.correr(Object.assign({}, p, { cvQ: 0, cvW: 0, cvD: 0 }), 10, rnd, nrm);
assert(T0.every((t) => Math.abs(t - th.media) < 1e-9), 'T determinista');
console.log(`3/3 OK · media ${mean.toFixed(1)} (teoría ${th.media.toFixed(1)}) · sd ${sd.toFixed(1)} (teoría ${th.sd.toFixed(1)})`);
// 4. Sin sesgo ni ruido: el plan perfecto es exacto; el de cajas sólo falla por W; el sesgo se acumula N veces
{
  const q = Object.assign({}, p, { cvD: 0 }), e1 = [], e2 = [];
  for (let k = 0; k < 50000; k++) { const x = M.dia(q, rnd, nrm); assert(Math.abs(x.plan[2] - x.T) < 1e-9, 'plan perfecto'); e1.push(x.T - x.plan[1]); }
  const m1 = e1.reduce((a, b) => a + b, 0) / e1.length, s1 = Math.sqrt(e1.reduce((a, b) => a + (b - m1) ** 2, 0) / e1.length);
  const t = M.teoria(q);
  assert(Math.abs(m1) < 0.5 && Math.abs(s1 / t.sdErr[1] - 1) < 0.03, `error con cajas ${m1} ± ${s1} vs ${t.sdErr[1]}`);
  const qs = Object.assign({}, p, { sesgo: -10, cvD: 0 });
  for (let k = 0; k < 20000; k++) { const x = M.dia(qs, rnd, nrm); e2.push(x.T - x.plan[2]); }
  const m2 = e2.reduce((a, b) => a + b, 0) / e2.length;
  assert(Math.abs(m2 / -M.teoria(qs).sesgoRuta - 1) < 0.02, `sesgo acumulado ${m2} vs ${-M.teoria(qs).sesgoRuta}`);
  console.log(`4/4 OK · error con cajas ±${s1.toFixed(1)} min (teoría ${t.sdErr[1].toFixed(1)}) · sesgo −10% → ${m2.toFixed(1)} min por ruta`);
}
