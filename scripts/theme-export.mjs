import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const globalsPath = path.join(root, "apps", "web", "app", "globals.css");
const outputDir = path.join(root, ".theme");
const outputPath = path.join(outputDir, "tokens.json");

const css = await readFile(globalsPath, "utf8");

function readVars(selector) {
  const pattern = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
    "m",
  );
  const match = css.match(pattern);
  if (!match) {
    throw new Error(`Missing theme selector: ${selector}`);
  }

  return Object.fromEntries(
    Array.from(
      match[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi),
      ([, key, value]) => [key, value.trim()],
    ),
  );
}

const tokens = {
  dark: readVars(":root"),
  light: readVars('[data-theme="light"]'),
  exportedAt: new Date().toISOString(),
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(tokens, null, 2)}\n`);
console.log(
  `Exported ${Object.keys(tokens.dark).length} dark tokens and ${Object.keys(tokens.light).length} light tokens to ${path.relative(root, outputPath)}`,
);
