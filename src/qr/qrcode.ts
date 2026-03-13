// ─────────────────────────────────────────────────────────────────────────────
//  qr/qrcode.ts
//  Pure-TypeScript QR Code encoder  (version 10, ECC level M, byte mode).
//  No external dependencies.  Supports up to ~182 bytes of UTF-8 input.
// ─────────────────────────────────────────────────────────────────────────────

// ── Galois Field GF(256) arithmetic ──────────────────────────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number): number =>
  a && b ? GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255] : 0;

function rsGeneratorPoly(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const t  = [1, GF_EXP[i]];
    const ng = new Array<number>(g.length + 1).fill(0);
    for (let a = 0; a < g.length; a++)
      for (let b = 0; b < t.length; b++) ng[a + b] ^= gfMul(g[a], t[b]);
    g = ng;
  }
  return g;
}

function rsEncode(data: number[], n: number): number[] {
  const gen = rsGeneratorPoly(n);
  const msg = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = msg[i];
    if (!c) continue;
    for (let j = 1; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], c);
  }
  return msg.slice(data.length);
}

// ── QR matrix builder ────────────────────────────────────────────────────────

export interface QRResult { matrix: number[][]; size: number; }

export function makeQR(text: string): QRResult | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 182) return null;           // v10-M limit

  // Bit stream
  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  };
  push(0b0100, 4);            // byte mode
  push(bytes.length, 8);      // char count (v1–v9, byte mode = 8 bits)
  bytes.forEach((b) => push(b, 8));
  for (let i = 0; i < 4 && bits.length < 182 * 8; i++) bits.push(0); // terminator
  while (bits.length % 8) bits.push(0);
  const pads = [0xec, 0x11]; let pi = 0;
  while (bits.length < 182 * 8) push(pads[pi++ % 2], 8);

  // Pack into bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes.push(b);
  }

  const ecBytes  = rsEncode(dataBytes, 92);      // 92 EC codewords for v10-M
  const allBytes = [...dataBytes, ...ecBytes];

  // Matrix (57×57 for version 10)
  const SIZE = 57;
  const M: number[][] = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(-1));
  const R: boolean[][] = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));

  const setM = (r: number, c: number, v: number) => { M[r][c] = v; R[r][c] = true; };

  // Finder patterns (3 corners)
  const finder = (tr: number, tc: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = tr + r, cc = tc + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const onBorder = r === -1 || r === 7 || c === -1 || c === 7;
      const onCore   = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setM(rr, cc, onBorder || onCore ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);

  // Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    setM(6, i, i % 2 === 0 ? 1 : 0);
    setM(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Dark module
  setM(SIZE - 8, 8, 1);

  // Reserve format info areas
  const FMT_COORDS: [number, number][] = [
    [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
    [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
    [SIZE-7,8],[SIZE-6,8],[SIZE-5,8],[SIZE-4,8],[SIZE-3,8],[SIZE-2,8],[SIZE-1,8],
    [8,SIZE-8],[8,SIZE-7],[8,SIZE-6],[8,SIZE-5],[8,SIZE-4],[8,SIZE-3],[8,SIZE-2],[8,SIZE-1],
  ];
  FMT_COORDS.forEach(([r, c]) => { R[r][c] = true; });

  // Alignment patterns for v10: centers at (6,46), (46,6), (46,46)
  for (const [ar, ac] of [[46, 46], [46, 6], [6, 46]] as [number,number][]) {
    if (R[ar][ac]) continue;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      setM(ar + r, ac + c, (r === -2 || r === 2 || c === -2 || c === 2) ? 1 : (r === 0 && c === 0 ? 1 : 0));
    }
  }

  // Data placement
  let bi = 0;
  const cols: number[] = [];
  for (let c = SIZE - 1; c >= 1; c -= 2) { if (c === 6) c = 5; cols.push(c); }
  cols.forEach((c, ci) => {
    const rows = ci % 2 === 0
      ? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i)
      : Array.from({ length: SIZE }, (_, i) => i);
    rows.forEach((r) => {
      for (const cc of [c, c - 1]) {
        if (cc < 0 || R[r][cc]) continue;
        M[r][cc] = ((allBytes[Math.floor(bi / 8)] ?? 0) >> (7 - (bi % 8))) & 1;
        bi++;
      }
    });
  });

  // Fill remaining -1
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (M[r][c] === -1) M[r][c] = 0;

  // Apply mask pattern 0: (i+j) % 2 === 0
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!R[r][c] && (r + c) % 2 === 0) M[r][c] ^= 1;

  // Write format info (ECC level M + mask 0, pre-computed)
  const FMT_BITS: number[] = [];
  const fmtVal = 0b101010011010101;
  for (let i = 14; i >= 0; i--) FMT_BITS.push((fmtVal >> i) & 1);
  const fp1: [number,number][] = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const fp2: [number,number][] = [[SIZE-1,8],[SIZE-2,8],[SIZE-3,8],[SIZE-4,8],[SIZE-5,8],[SIZE-6,8],[SIZE-7,8],[8,SIZE-8],[8,SIZE-7],[8,SIZE-6],[8,SIZE-5],[8,SIZE-4],[8,SIZE-3],[8,SIZE-2],[8,SIZE-1]];
  fp1.forEach(([r, c], i) => { M[r][c] = FMT_BITS[i]; });
  fp2.forEach(([r, c], i) => { M[r][c] = FMT_BITS[i]; });

  return { matrix: M, size: SIZE };
}
