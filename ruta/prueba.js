// Verificaciones del motor: node ruta/prueba.js
const assert = require('assert');
const M = require('./motor.js');
const p = M.DEFAULTS, rnd = M.mulberry32(1), nrm = M.makeNormal(rnd);

// 1. Cada día cuadra con la fórmula T = STEM₁ + ΣS + (N−1)d + C + STEM₂
for (let k = 0; k < 100; k++) {
  const x = M.dia(p, rnd, nrm), sumS = x.clientes.reduce((a, c) => a + c.S, 0);
  assert(Math.abs(x.T - (p.stem1 + sumS + (p.N - 1) * p.d + p.C + p.stem2)) < 1e-9, 'fórmula del día');
}
// 2. Media y desviación Monte Carlo ≈ teoría
const T = M.correr(p, 100000, rnd, nrm), th = M.teoria(p);
const mean = T.reduce((a, b) => a + b, 0) / T.length;
const sd = Math.sqrt(T.reduce((a, b) => a + (b - mean) ** 2, 0) / T.length);
assert(Math.abs(mean / th.media - 1) < 0.003, `media ${mean} vs ${th.media}`);
assert(Math.abs(sd / th.sd - 1) < 0.03, `sd ${sd} vs ${th.sd}`);
// 3. Sin variabilidad, T es constante e igual a la media teórica
const T0 = M.correr(Object.assign({}, p, { cvQ: 0, cvW: 0 }), 10, rnd, nrm);
assert(T0.every((t) => Math.abs(t - th.media) < 1e-9), 'T determinista');
console.log(`3/3 OK · media ${mean.toFixed(1)} (teoría ${th.media.toFixed(1)}) · sd ${sd.toFixed(1)} (teoría ${th.sd.toFixed(1)})`);
