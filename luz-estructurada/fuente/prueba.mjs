// node luz-estructurada/fuente/prueba.mjs — comprueba el modelo.
import assert from "node:assert/strict";
import * as M from "./modelo.mjs";

// El código Gray cambia un solo bit entre franjas vecinas, y los 10 patrones decodifican cada franja.
for (let n = 0; n < M.CODES; n++) {
  if (n) assert.equal(Math.log2(M.gray(n) ^ M.gray(n - 1)) % 1, 0);
  const { prefix, width } = M.prefixOf(n, M.BITS);
  assert.equal(prefix, n);
  assert.equal(width, 1);
  for (let k = 1; k <= M.BITS; k++) assert.equal(M.prefixOf(n, k).prefix, n >> (M.BITS - k));
}

// Cada punto del tejido cae dentro del campo del proyector, y sobre un plano el código crece a lo largo de x (la línea epipolar).
for (let y = -36; y <= 36; y += 6) {
  let last = -1;
  for (let x = -56; x <= 56; x += 0.5) {
    const n = M.codeOf([x, y, M.heightAt(x, y)]);
    assert.ok(n >= 0 && n < M.CODES, `código fuera de rango en ${x},${y}`);
    const flat = M.codeOf([x, y, 20]);
    assert.ok(flat >= last, `código no crece en ${x},${y}`);
    last = flat;
  }
}

// Un punto visto por las dos cámaras: misma fila, disparidad f·B/Z, y la profundidad vuelve de la disparidad.
for (const p of [[0, 0, M.heightAt(0, 0)], [30, -12, M.heightAt(30, -12)], [-40, 20, M.heightAt(-40, 20)]]) {
  const L = M.pixelOf(-1, p), R = M.pixelOf(1, p);
  assert.ok(Math.abs(L[1] - R[1]) < 1e-9);
  const d = L[0] - R[0];
  assert.ok(Math.abs(d - M.disparityOf(p)) < 1e-9);
  assert.ok(Math.abs(M.depthFrom(d) - (M.SCOPE.at[2] - p[2])) < 1e-9);
  const hit = M.hitOf(-1, L[0], L[1]);
  assert.ok(Math.hypot(hit[0] - p[0], hit[1] - p[1], hit[2] - p[2]) < 0.05, `el rayo no vuelve a ${p}`);
}

const top = Math.max(...Array.from({ length: 117 * 77 }, (_, i) => M.heightAt((i % 117) - 58, Math.floor(i / 117) - 38)));
assert.ok(top < M.TISSUE.top, `tejido más alto (${top.toFixed(1)}) que TISSUE.top`);
const ds = [M.TRAY.floor, top].map((z) => M.disparityOf([0, 0, z]));
console.log(`modelo ok · tejido hasta ${top.toFixed(1)} mm · disparidad ${ds[0].toFixed(1)}–${ds[1].toFixed(1)} px · franja ${(M.PROJ.W / M.CODES).toFixed(2)} columnas`);
