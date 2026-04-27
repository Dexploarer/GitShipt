import nacl from "tweetnacl";
import bs58 from "bs58";
import { beforeEach, describe, expect, it, vi } from "vitest";

function installAuthMocks(store = new Map<string, string>()) {
  const fakeRedis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(
      async (
        key: string,
        value: string,
        mode: "EX",
        ttlSeconds: number,
      ) => {
        void mode;
        void ttlSeconds;
        store.set(key, value);
        return "OK";
      },
    ),
    del: vi.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
  };

  vi.doMock("@/lib/redis", () => ({ redis: () => fakeRedis }));
  vi.doMock("@/lib/env", () => ({
    serverEnv: () => ({ NODE_ENV: "test" }),
  }));

  return { fakeRedis, store };
}

function nonceKey(address: string, nonce: string) {
  return `gitbags:siws:nonce:${address}:${nonce}`;
}

describe("SIWS nonce and verification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("issues a single-use nonce with a five-minute Redis TTL", async () => {
    const { fakeRedis } = installAuthMocks();
    const { issueNonce } = await import("./siws");

    const address = bs58.encode(nacl.sign.keyPair().publicKey);
    const nonce = await issueNonce(address);

    expect(nonce).toHaveLength(24);
    expect(fakeRedis.set).toHaveBeenCalledWith(
      nonceKey(address, nonce),
      "1",
      "EX",
      300,
    );
  });

  it("verifies a signed message once and rejects replay", async () => {
    const { store, fakeRedis } = installAuthMocks();
    const { buildMessage, verifySiws } = await import("./siws");
    const keyPair = nacl.sign.keyPair();
    const address = bs58.encode(keyPair.publicKey);
    const nonce = "nonce-12345678";
    const message = {
      domain: "gitbags.test",
      address,
      statement: "Sign to link this wallet to your GitBags account.",
      uri: "https://gitbags.test/auth/wallet",
      version: "1" as const,
      chainId: "solana:devnet",
      nonce,
      issuedAt: new Date().toISOString(),
    };
    const messageBytes = new TextEncoder().encode(buildMessage(message));
    const signature = bs58.encode(
      nacl.sign.detached(messageBytes, keyPair.secretKey),
    );
    store.set(nonceKey(address, nonce), "1");

    await expect(
      verifySiws({
        message,
        signatureBase58: signature,
        expectedDomain: "gitbags.test",
        expectedChainId: "solana:devnet",
      }),
    ).resolves.toEqual({ ok: true, address });
    expect(fakeRedis.del).toHaveBeenCalledWith(nonceKey(address, nonce));

    await expect(
      verifySiws({
        message,
        signatureBase58: signature,
        expectedDomain: "gitbags.test",
        expectedChainId: "solana:devnet",
      }),
    ).resolves.toEqual({ ok: false, reason: "nonce" });
  });
});
