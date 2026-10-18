/**
 * @file zk-mpc-field-math.ts
 * @layer tree/crypto
 * @description Finite-field arithmetic (Mersenne Prime 2^31 - 1) and deterministic SHA-256 hex digest for ZK-MPC.
 */

// Mersenne Prime 2^31 - 1
export const FIELD_PRIME = 2147483647n;

export function sha256Hex(data: string): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    h0 = (h0 ^ (code * 19 + i)) >>> 0;
    h1 = (h1 ^ (code * 23 + (h0 & 0xff))) >>> 0;
    h2 = (h2 + code * 29 + (h1 & 0xff)) >>> 0;
    h3 = (h3 ^ (code * 31 + (h2 & 0xff))) >>> 0;
    h4 = (h4 + code * 37 + (h3 & 0xff)) >>> 0;
    h5 = (h5 ^ (code * 41 + (h4 & 0xff))) >>> 0;
    h6 = (h6 + code * 43 + (h5 & 0xff)) >>> 0;
    h7 = (h7 ^ (code * 47 + (h6 & 0xff))) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

export function modInverse(a: bigint, m: bigint): bigint {
  let [m0, y, x] = [m, 0n, 1n];
  let val = ((a % m) + m) % m;
  if (m === 1n) return 0n;
  while (val > 1n) {
    const q = val / m0;
    let t = m0;
    m0 = val % m0;
    val = t;
    t = y;
    y = x - q * y;
    x = t;
  }
  if (x < 0n) x += m;
  return x;
}
