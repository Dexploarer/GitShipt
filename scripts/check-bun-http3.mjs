#!/usr/bin/env bun

const version = Bun.version;
const revision = Bun.revision ?? "unknown";
const requireHttp3 = process.env.REQUIRE_BUN_HTTP3 === "1";
const isCanary = version.includes("canary");

const stableParts = version
  .split("-")[0]
  .split(".")
  .map((part) => Number.parseInt(part, 10));
const isLatestStableOrNewer =
  (stableParts[0] ?? 0) > 1 ||
  ((stableParts[0] ?? 0) === 1 &&
    ((stableParts[1] ?? 0) > 3 ||
      ((stableParts[1] ?? 0) === 3 && (stableParts[2] ?? 0) >= 13)));

console.log(`Bun ${version} (${revision})`);

if (!isLatestStableOrNewer) {
  console.error("GitBags requires Bun 1.3.13 or newer.");
  process.exit(1);
}

if (isCanary) {
  console.log(
    "HTTP/3 canary APIs may be available: Bun.serve({ h3: true }) and fetch(..., { protocol: 'http3' }).",
  );
  process.exit(0);
}

const message =
  "Bun HTTP/3 support landed after the 1.3.13 stable release. Use `bun upgrade --canary` locally when testing `h3: true` or `protocol: 'http3'`; keep production on stable Bun until Bun publishes these APIs in a stable release.";

if (requireHttp3) {
  console.error(message);
  process.exit(1);
}

console.log(message);
