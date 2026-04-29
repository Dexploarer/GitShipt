import { describe, expect, it } from "vitest";
import { redisOptionsFromUrl } from "@/lib/redis";

describe("redisOptionsFromUrl", () => {
  it("parses redis URLs into ioredis options without the URL-string constructor", () => {
    expect(
      redisOptionsFromUrl(
        "redis://default:p%40ssword@redis.example.com:6380/2?family=4&connectionName=gitshipt",
      ),
    ).toMatchObject({
      host: "redis.example.com",
      port: 6380,
      username: "default",
      password: "p@ssword",
      db: 2,
      family: 4,
      connectionName: "gitshipt",
    });
  });

  it("enables TLS for rediss URLs", () => {
    expect(redisOptionsFromUrl("rediss://:secret@redis.example.com")).toEqual({
      host: "redis.example.com",
      password: "secret",
      tls: {},
    });
  });
});
