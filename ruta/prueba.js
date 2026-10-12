// Verificaciones del motor: node ruta/prueba.js
const assert = require('assert');
const M = require('./motor.js');
const P = (o) => Object.assign({}, M.DEFAULTS, o);
const near = (a, b, tol, msg) => assert(Math.abs(a / b - 1) <= tol, `${msg}: ${a.toFixed(2)} vs ${b.toFixed(2)}`);

// 1. Sin H1/H2, la media Monte Carlo de T real coincide con la fórmula analítica
{
  const r = M.simular(P({ h1: 0, h2: 0, reps: 20000 }));
  near(r.reg[0].Treal, r.teoria.ET, 0.01, 'E[T] MC vs analítico');
  assert.strictEqual(r.reg[0].Treal, r.reg[1].Treal, 'sin H1/H2 el T real no depende del modelo');
}
// 2. Sin contaminación, el modelo anterior planea bien (plan ≈ real)
{
  const r = M.simular(P({ h1: 0, h2: 0, traf: 0, cvTraf: 0, pU: 0, excC: 0, reps: 10000 }));
  near(r.reg[0].Tplan, r.reg[0].Treal, 0.015, 'plan anterior sin contaminación');
}
// 3. Con contaminación, el modelo robusto planea stays más cortos que el anterior
{
  const r = M.simular(P({ h1: 0, h2: 0 }));
  assert(r.reg[1].shatCliente < r.reg[0].shatCliente, 'robusto < anterior');
  assert(r.hist.medido > r.hist.real, 'la resta infla el stay');
}
// 4. H2: con stays planeados más cortos, el planificador mete más clientes
{
  const r = M.simular(P({ h1: 0, h2: 1 }));
  assert(r.reg[1].N >= r.reg[0].N, `N robusto ${r.reg[1].N} ≥ N anterior ${r.reg[0].N}`);
}
// 5. H1: con φ > 0 el T real baja al pasar al modelo robusto
{
  const r = M.simular(P({ h1: 1, phi: 0.6, h2: 0 }));
  assert(r.reg[1].Treal < r.reg[0].Treal, 'H1 baja el T real');
}
// 6. La resta cuadra: Σ stays medidos + traslados planeados + comida planeada + regreso real = T real
{
  const p = P({ N: 12 }), m = M.mapa(p.d), rnd = M.mulberry32(5), nrm = M.makeNormal(rnd);
  const H = M.historial(p, rnd, nrm), mod = M.ajusteAnterior(H, p.M);
  for (let k = 0; k < 50; k++) {
    const dia = M.generarDia(p, rnd, nrm), x = M.correr(p, m, dia, mod, false);
    const legs = x.viajePlan - p.stem2;
    const lhs = x.meas + legs + p.C + p.stem2 * dia.f2;
    assert(Math.abs(lhs - x.Treal) < 1e-6, `identidad de la resta ${lhs} vs ${x.Treal}`);
  }
}
console.log('6/6 verificaciones OK');
