import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const standaloneRoot = resolve(projectRoot, ".next/standalone");
const assets = [
  [resolve(projectRoot, "public"), resolve(standaloneRoot, "public")],
  [resolve(projectRoot, ".next/static"), resolve(standaloneRoot, ".next/static")],
];

for (const [source, destination] of assets) {
  if (!existsSync(source)) {
    throw new Error(`STANDALONE_ASSET_SOURCE_MISSING: ${source}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

console.log("Standalone public and static assets prepared");
