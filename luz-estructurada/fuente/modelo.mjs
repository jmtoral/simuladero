// Modelo de la figura: luz estructurada con código Gray y un endoscopio estéreo (SCARED, MICCAI 2019).
// Mundo en mm: x, y en la mesa, z hacia arriba. Lo usan build.mjs (Node) y la página (se pega sin "export").

export const BITS = 10;                        // patrones de código Gray de 10 bits
export const CODES = 1 << BITS;                // 1024 franjas distinguibles a lo ancho del proyector

// Proyector de bolsillo AAXA P300 Neo: 15 × 3 × 9 cm, 1280 × 720. Mira hacia +y, inclinado hacia el tejido.
export const PROJ = { at: [0, -165, 150], aim: [0, 6, 16], f: 1792, W: 1280, H: 720 };
// Endoscopio estéreo vertical: dos cámaras rectificadas que miran hacia −z, separadas B a lo largo de x.
export const SCOPE = { at: [0, 0, 115], B: 4.3, f: 1035, W: 1280, H: 1024 };

// Charola de acero y tejido porcino dentro de ella.
export const TRAY = { inner: { x: -64, y: -44, w: 128, d: 88, r: 7 }, floor: 3, top: 21 };
export const TISSUE = { half: [58, 38], round: 20, edge: 10, thick: 21, top: 32 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

// Ejes del proyector: adelante, derecha (+x) y arriba.
export const PF = unit(sub(PROJ.aim, PROJ.at));
export const PR = [1, 0, 0];
export const PU = [PR[1] * PF[2] - PR[2] * PF[1], PR[2] * PF[0] - PR[0] * PF[2], PR[0] * PF[1] - PR[1] * PF[0]];

// Distancia hacia adentro del contorno del tejido (positiva dentro).
export function insideOf(x, y) {
  const { half, round } = TISSUE;
  const qx = Math.abs(x) - (half[0] - round), qy = Math.abs(y) - (half[1] - round);
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round;
  return -sd + 1.6 * Math.sin(0.11 * x + 0.7) * Math.cos(0.13 * y - 0.4);
}

// Altura de la superficie del tejido (o del piso de la charola fuera de él).
export function heightAt(x, y) {
  const din = insideOf(x, y);
  if (din <= 0) return TRAY.floor;
  const e = Math.min(1, din / TISSUE.edge);
  const lump = 1 + 0.16 * Math.sin(0.065 * x + 0.4) * Math.cos(0.08 * y - 0.2) + 0.2 * Math.exp(-((x - 22) ** 2 + (y + 6) ** 2) / 520) - 0.14 * Math.exp(-((x + 18) ** 2 + (y - 14) ** 2) / 260);
  return TRAY.floor + TISSUE.thick * Math.sqrt(1 - (1 - e) ** 2) * lump;
}

// Columna del proyector (0..1280) que ilumina el punto p; fuera de rango si no lo alcanza.
export function columnOf(p) {
  const q = sub(p, PROJ.at);
  return PROJ.W / 2 + (PROJ.f * dot(PR, q)) / dot(PF, q);
}
export const codeOf = (p) => Math.floor((columnOf(p) * CODES) / PROJ.W);

export const gray = (n) => n ^ (n >> 1);
// Patrón k (1..10, el más grueso primero): ¿ilumina la franja con código n?
export const litBy = (n, k) => (gray(n) >> (BITS - k)) & 1;
// Lo que un píxel lee tras k patrones: el prefijo binario de su código y cuántas columnas quedan posibles.
export function prefixOf(n, k) {
  let bin = 0, prev = 0;
  for (let i = 1; i <= k; i++) { prev ^= litBy(n, i); bin = (bin << 1) | prev; }
  return { prefix: bin, width: 1 << (BITS - k) };
}

// Cámaras: −1 izquierda, +1 derecha. Píxel (u, v) en la imagen de 1280 × 1024.
export const eyeOf = (side) => [SCOPE.at[0] + (side * SCOPE.B) / 2, SCOPE.at[1], SCOPE.at[2]];
export function pixelOf(side, p) {
  const c = eyeOf(side), depth = c[2] - p[2];
  return [SCOPE.W / 2 + (SCOPE.f * (p[0] - c[0])) / depth, SCOPE.H / 2 + (SCOPE.f * (p[1] - c[1])) / depth];
}
export const disparityOf = (p) => (SCOPE.f * SCOPE.B) / (SCOPE.at[2] - p[2]);
export const depthFrom = (d) => (SCOPE.f * SCOPE.B) / d;

// Rayo de una cámara por el píxel (u, v) contra el tejido: punto de impacto.
export function hitOf(side, u, v) {
  const c = eyeOf(side), dx = (u - SCOPE.W / 2) / SCOPE.f, dy = (v - SCOPE.H / 2) / SCOPE.f;
  const at = (z) => [c[0] + dx * (c[2] - z), c[1] + dy * (c[2] - z), z];
  const top = TISSUE.top + 1, steps = 40;
  let hi = top, lo = TRAY.floor;
  for (let i = 1; i <= steps; i++) {
    const z = top + ((TRAY.floor - top) * i) / steps, p = at(z);
    if (p[2] <= heightAt(p[0], p[1])) { lo = z; break; }
    hi = z;
  }
  for (let i = 0; i < 12; i++) { const z = (hi + lo) / 2, p = at(z); if (p[2] <= heightAt(p[0], p[1])) lo = z; else hi = z; }
  return at(lo);
}
