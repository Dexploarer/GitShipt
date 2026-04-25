import { createHash } from "crypto";

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
 */
export interface MerkleLeafInput {
  contributorId: string;
  amountLamports: bigint;
}

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256BufferConcat(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([left, right]))
    .digest();
}

export function leafHash(contributorId: string, amountLamports: bigint): string {
  return sha256Hex(`${contributorId}:${amountLamports.toString()}`);
}

export function computeMerkleRoot(entries: MerkleLeafInput[]): string {
  if (entries.length === 0) {
    return sha256Hex("");
  }
  const sorted = [...entries].sort((a, b) =>
    a.contributorId < b.contributorId ? -1 : a.contributorId > b.contributorId ? 1 : 0,
  );
  let layer: Buffer[] = sorted.map((e) =>
    Buffer.from(leafHash(e.contributorId, e.amountLamports), "hex"),
  );
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left; // duplicate odd
      next.push(sha256BufferConcat(left, right));
    }
    layer = next;
  }
  return layer[0]!.toString("hex");
}
