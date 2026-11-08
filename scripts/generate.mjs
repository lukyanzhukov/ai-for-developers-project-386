import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

function snapshot(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [path, createHash("sha256").update(readFileSync(path)).digest("hex")];
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

const check = process.argv.includes("--check");
const before = check ? snapshot("generated") : undefined;
rmSync("generated", { recursive: true, force: true });
execFileSync("pnpm", ["exec", "tsp", "compile", "api/main.tsp", "--config", "tspconfig.yaml"], {
  stdio: "inherit",
});
execFileSync("pnpm", ["exec", "openapi-ts"], { stdio: "inherit" });
if (check) {
  if (JSON.stringify(snapshot("generated")) !== JSON.stringify(before)) {
    throw new Error("Generated files are stale. Run mise run generate and commit generated/.");
  }
}
