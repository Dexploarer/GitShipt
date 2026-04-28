import { describe, expect, it } from "vitest";
import { createId } from "./ids";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ID_LEN = 21;

describe("createId", () => {
  it("returns a 21-char id from the expected alphabet when no prefix is given", () => {
    const id = createId();
    expect(id).toHaveLength(ID_LEN);
    for (const ch of id) {
      expect(ALPHABET).toContain(ch);
    }
  });

  it("prepends `${prefix}_` when a prefix is given", () => {
    const prefix = "tok";
    const id = createId(prefix);
    expect(id.startsWith(`${prefix}_`)).toBe(true);
    expect(id).toHaveLength(prefix.length + 1 + ID_LEN);
    const body = id.slice(prefix.length + 1);
    expect(body).toHaveLength(ID_LEN);
    for (const ch of body) {
      expect(ALPHABET).toContain(ch);
    }
  });

  it("produces distinct values across consecutive calls", () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
  });

  it("produces distinct values across many calls (no obvious collisions)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(createId());
    }
    expect(seen.size).toBe(1000);
  });
});
