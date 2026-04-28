/**
 * URL-safe, sortable-ish (timestamp-prefix not enforced; we rely on
 * createdAt for ordering) ID generator. 21 chars of [0-9a-zA-Z] gives ~10^37
 * combinations — collision-free at any scale we'll ever hit.
 *
 * Implemented directly on top of Web Crypto (`globalThis.crypto.getRandomValues`)
 * so that this module is safe to import from edge / workflow runtimes that
 * cannot resolve Node built-ins. Algorithm mirrors nanoid's `customAlphabet`:
 * mask each random byte to the next power of two above the alphabet size and
 * reject indices that fall outside [0, alphabet.length).
 */
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LEN = 21;
// Smallest power-of-two mask that covers 62 (alphabet length): 64 → mask 63.
const MASK = 63;
// Per nanoid: read 1.6 × len bytes per pass on average to amortize rejections.
const STEP = Math.ceil((1.6 * MASK * ID_LEN) / ALPHABET.length);

export function createId(prefix?: string): string {
  let id = "";
  while (true) {
    const bytes = new Uint8Array(STEP);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < STEP; i++) {
      const idx = bytes[i]! & MASK;
      if (idx < ALPHABET.length) {
        id += ALPHABET[idx];
        if (id.length === ID_LEN) {
          return prefix ? `${prefix}_${id}` : id;
        }
      }
    }
  }
}
