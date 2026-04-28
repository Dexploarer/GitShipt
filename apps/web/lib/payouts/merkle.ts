/**
 * Merkle root over (contributorId, amountLamports) tuples.
 *
 * Determinism rules:
 *   - Sort entries by `contributorId` lexicographically (UTF-8 byte order)
 *     before hashing.
 *   - Each leaf is `sha256(contributorId + ':' + amountLamports)`.
 *   - Pair adjacent nodes; an odd trailing node is duplicated so it pairs
 *     with itself (Bitcoin-style). Hash pairs as `sha256(left || right)`.
 *   - Empty input -> sha256 of empty string ("e3b0c4..." - well-known).
 *
 * Returns a hex-encoded string (64 chars).
 *
 * Implementation note: uses Web Crypto (`globalThis.crypto.subtle`) so the
 * module is safe to import inside Vercel Workflow bundles, where Node's
 * `crypto` module is not available. All hash operations are async.
 */
export interface MerkleLeafInput {
  contributorId: string;
  amountLamports: bigint;
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = await globalThis.crypto.subtle.digest(
    "SHA-256",
    data as unknown as BufferSource,
  );
  return new Uint8Array(buf);
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, "0");
  }
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  return bytesToHex(await sha256Bytes(bytes));
}

async function sha256BufferConcat(
  left: Uint8Array,
  right: Uint8Array,
): Promise<Uint8Array> {
  const cat = new Uint8Array(left.length + right.length);
  cat.set(left, 0);
  cat.set(right, left.length);
  return sha256Bytes(cat);
}

export async function leafHash(
  contributorId: string,
  amountLamports: bigint,
): Promise<string> {
  return sha256Hex(`${contributorId}:${amountLamports.toString()}`);
}

export async function computeMerkleRoot(
  entries: MerkleLeafInput[],
): Promise<string> {
  if (entries.length === 0) {
    return sha256Hex("");
  }
  const sorted = [...entries].sort((a, b) =>
    a.contributorId < b.contributorId
      ? -1
      : a.contributorId > b.contributorId
        ? 1
        : 0,
  );
  let layer: Uint8Array[] = await Promise.all(
    sorted.map(async (e) =>
      hexToBytes(await leafHash(e.contributorId, e.amountLamports)),
    ),
  );
  while (layer.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left; // duplicate odd
      next.push(await sha256BufferConcat(left, right));
    }
    layer = next;
  }
  return bytesToHex(layer[0]!);
}
