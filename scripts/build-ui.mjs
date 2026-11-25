// Bundle the Control UI entry into dist/control-ui/<hash>/index.js
// and update openclaw.plugin.json#controlUi.entry.
//
// `openclaw plugins build` only authors metadata for tool-plugin entries; a
// plugin whose runtime is a plain definePluginEntry (like this one) has to
// produce the browser build itself. This script does exactly what that command
// does for the UI half: one esbuild pass, content-addressed output directory,
// manifest entry pointing at it.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm, rename } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const manifestPath = join(root, "openclaw.plugin.json");
const source = join(root, "src", "control-ui.ts");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const outRoot = join(root, "dist", "control-ui");

const result = await build({
  absWorkingDir: root,
  entryPoints: { index: source },
  outdir: join(outRoot, ".tmp-build"),
  bundle: true,
  splitting: true,
  chunkNames: "chunk-[hash]",
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  sourcemap: false,
  write: true,
  metafile: true,
  loader: { ".css": "css" },
});

const outputs = Object.keys(result.metafile.outputs).sort();
const files = [];
for (const out of outputs) {
  const rel = relative(join(outRoot, ".tmp-build"), join(root, out));
  if (!/\.(m?js|css)$/u.test(rel)) continue;
  files.push(rel);
}
if (!files.includes("index.js")) throw new Error("browser build produced no index.js");

const hash = createHash("sha256");
for (const name of files) {
  hash.update(`${name}\0`);
  hash.update(String(result.metafile.outputs[join("dist", "control-ui", ".tmp-build", name)]?.bytes ?? 0));
}
const generation = hash.digest("hex").slice(0, 32);
const target = join(outRoot, generation);

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await rename(join(outRoot, ".tmp-build"), target).catch(async (error) => {
  // rename across a non-empty target, or a platform that refuses it: copy files
  if (error?.code !== "EEXIST" && error?.code !== "ENOTEMPTY" && error?.code !== "EPERM") throw error;
  await rm(target, { recursive: true, force: true });
  await rename(join(outRoot, ".tmp-build"), target);
});

manifest.controlUi = {
  ...(manifest.controlUi ?? {}),
  entry: `dist/control-ui/${generation}/index.js`,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`control-ui: dist/control-ui/${generation}/ (${files.length} files)`);
for (const name of files) console.log(`  ${name}`);