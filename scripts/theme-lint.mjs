import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "packages",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const rawHex = /#[0-9a-fA-F]{3,8}\b/g;

const ignoredSegments = new Set([
  ".next",
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
]);

// Files that legitimately need raw hex because they render outside the CSS
// runtime. next/og's Satori cannot resolve CSS variables, so OG / Twitter
// image generators are inlined SVG-like JSX with literal colours.
const ignoredFilenamePrefixes = [
  "opengraph-image",
  "twitter-image",
  "icon.",
  "apple-icon.",
];

function isAllowedFilename(name) {
  return ignoredFilenamePrefixes.some((prefix) => name.startsWith(prefix));
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (
      entry.isFile() &&
      sourceExtensions.has(path.extname(entry.name)) &&
      !isAllowedFilename(entry.name)
    ) {
      yield fullPath;
    }
  }
}

const failures = [];

for (const scanRoot of scanRoots) {
  const dir = path.join(root, scanRoot);
  for await (const filePath of walk(dir)) {
    const source = await readFile(filePath, "utf8");
    const matches = source.match(rawHex);
    if (!matches) continue;

    for (const match of matches) {
      const index = source.indexOf(match);
      const line = source.slice(0, index).split("\n").length;
      failures.push(
        `${path.relative(root, filePath)}:${line} uses raw hex ${match}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Raw hex values are not allowed outside theme CSS tokens.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Theme lint passed: no raw hex values in app or package sources.");
