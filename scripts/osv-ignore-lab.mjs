import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { scanner: { type: "string" }, output: { type: "string" } },
});
if (!values.scanner || !values.output) {
  throw new Error("Usage: node scripts/osv-ignore-lab.mjs --scanner PATH --output DIR");
}

const scanner = resolve(values.scanner);
const output = resolve(values.output);
const advisory = "GHSA-xvch-5gv4-984h";
const now = new Date();
const day = 86_400_000;
const future = new Date(now.getTime() + 365 * day).toISOString().slice(0, 10);
const expired = new Date(now.getTime() - 365 * day).toISOString().slice(0, 10);
const cases = [
  { name: "vulnerable-baseline", version: "1.2.5", expected: 1 },
  { name: "vulnerable-future", version: "1.2.5", until: future, expected: 0 },
  { name: "vulnerable-expired", version: "1.2.5", until: expired, expected: 1 },
  { name: "fixed-expired", version: "1.2.8", until: expired, expected: 0 },
];
const workspace = await mkdtemp(join(tmpdir(), "osv-ignore-lab-"));
const results = [];
await mkdir(output, { recursive: true });
try {
  for (const scenario of cases) {
    const directory = join(workspace, scenario.name);
    const destination = join(output, scenario.name);
    await mkdir(directory);
    await mkdir(destination, { recursive: true });
    const lockfile = JSON.stringify(
      {
        name: "isolated-osv-ignore-exercise",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": {
            name: "isolated-osv-ignore-exercise",
            version: "1.0.0",
            dependencies: { minimist: scenario.version },
          },
          "node_modules/minimist": { version: scenario.version },
        },
      },
      null,
      2,
    );
    const lockpath = join(directory, "package-lock.json");
    await writeFile(lockpath, lockfile);
    await writeFile(join(destination, "package-lock.json"), lockfile);
    const args = ["scan", "source", "--format", "json", "--all-packages", "--lockfile", lockpath];
    if (scenario.until) {
      const config = `[[IgnoredVulns]]\nid = "${advisory}"\nignoreUntil = ${scenario.until}\nreason = "Isolated expiry exercise; never apply to the project"\n`;
      const configpath = join(directory, "osv-scanner.toml");
      await writeFile(configpath, config);
      await writeFile(join(destination, "osv-scanner.toml"), config);
      args.push("--config", configpath);
    }
    const run = spawnSync(scanner, args, {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    await writeFile(join(destination, "report.json"), run.stdout ?? "");
    await writeFile(
      join(destination, "stderr.log"),
      `${run.stderr ?? ""}${run.error?.message ?? ""}`,
    );
    await writeFile(join(destination, "exit-code.txt"), `${run.status ?? "null"}\n`);
    let validReport = false;
    try {
      validReport = Array.isArray(JSON.parse(run.stdout).results);
    } catch {
      // Empty or malformed scanner output is recorded as a failed exercise.
    }
    results.push({
      ...scenario,
      actual: run.status,
      signal: run.signal,
      lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
      passed: run.status === scenario.expected && validReport,
    });
  }
  const summary = { observedAt: now.toISOString(), package: "npm/minimist", advisory, results };
  await writeFile(join(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const rows = results.map(
    (item) =>
      `| ${item.name} | ${item.version} | ${item.until ?? "none"} | ${item.expected} | ${item.actual} | ${item.passed} |`,
  );
  await writeFile(
    join(output, "report.md"),
    `# Isolated ignoreUntil exercise\n\n${advisory}, npm/minimist. Scanner reports and actual exit codes accompany each case.\n\n| Case | Version | ignoreUntil | Expected exit | Actual exit | Passed |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\nAn expired exception stops suppressing a matching vulnerability. It does not itself make a fixed package vulnerable. No system clock changes were made.\n`,
  );
  console.log(await readFile(join(output, "report.md"), "utf8"));
  if (results.some((item) => !item.passed)) process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
