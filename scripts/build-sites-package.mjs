import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");
const bundleDir = mkdtempSync(join(resolve(root, ".."), "hairmirror-wrangler-"));
const openNext = join(root, ".open-next");

try {
  execFileSync(join(root, "node_modules/.bin/opennextjs-cloudflare"), ["build"], { stdio: "inherit" });
  execFileSync(join(root, "node_modules/.bin/wrangler"), [
    "deploy",
    join(openNext, "worker.js"),
    "--dry-run",
    "--outdir",
    bundleDir,
    "--assets",
    join(openNext, "assets"),
  ], { stdio: "inherit" });

  const worker = join(bundleDir, "worker.js");
  if (!existsSync(worker)) throw new Error("Sites worker bundle was not generated");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "server"), { recursive: true });
  mkdirSync(join(dist, "client"), { recursive: true });
  mkdirSync(join(dist, ".openai"), { recursive: true });
  cpSync(worker, join(dist, "server/index.js"));
  cpSync(join(openNext, "assets"), join(dist, "client"), { recursive: true });
  cpSync(join(root, ".openai/hosting.json"), join(dist, ".openai/hosting.json"));

  const hosting = JSON.parse(readFileSync(join(dist, ".openai/hosting.json"), "utf8"));
  if (!hosting.project_id || !existsSync(join(dist, "server/index.js"))) {
    throw new Error("Sites package is missing hosting metadata or worker entrypoint");
  }
  console.log(`Sites package ready: ${join(dist, "server/index.js")}`);
} finally {
  rmSync(bundleDir, { recursive: true, force: true });
}
