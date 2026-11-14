import { test as nodeTest } from "node:test";
const test = (name, fn) => nodeTest(name, { timeout: 15000 }, fn);
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync as spawnSyncProcess } from "node:child_process";
const spawnSync = (file, args, options = {}) =>
  spawnSyncProcess(file, args, {
    timeout: 10000,
    killSignal: "SIGKILL",
    ...options,
  });

const cli = new URL("../../scripts/audit.mjs", import.meta.url).pathname;
test("invalid replay retains a diagnostic report and fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    writeFileSync(join(dir, "input.json"), "{}");
    const run = spawnSync(process.execPath, [cli, "validate", "todo", dir], { encoding: "utf8" });
    assert.notEqual(run.status, 0);
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /Error/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("TODO snapshot includes only tracked source with context", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    for (const args of [
      ["init"],
      ["config", "user.email", "test@example.com"],
      ["config", "user.name", "Test"],
    ])
      spawnSync("git", args, { cwd: dir });
    writeFileSync(
      join(dir, "app.ts"),
      "const first = 1;\nconst second = 2;\nconst third = 3;\n// TODO: reject expired sessions\nexport const alive = true;\nconst fifth = 5;\nconst sixth = 6;\n",
    );
    writeFileSync(join(dir, "lesson.md"), "TODO educational exercise");
    writeFileSync(join(dir, "untracked.ts"), "// FIXME untracked");
    spawnSync("git", ["add", "app.ts", "lesson.md"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "fixture"], { cwd: dir });
    const run = spawnSync(process.execPath, [cli, "collect", "todo", join(dir, "output")], {
      cwd: dir,
      env: { ...process.env, GITHUB_REPOSITORY: "owner/repo" },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    const snapshot = JSON.parse(readFileSync(join(dir, "output/input.json"), "utf8"));
    assert.equal(snapshot.candidates.length, 1);
    assert.equal(snapshot.candidates[0].path, "app.ts");
    assert.equal(snapshot.candidates[0].line, 4);
    assert.match(snapshot.candidates[0].context, /alive/);
    writeFileSync(
      join(dir, "app.ts"),
      readFileSync(join(dir, "app.ts"), "utf8").replace("// TODO:", "\n\n// TODO:"),
    );
    spawnSync("git", ["add", "app.ts"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "blank lines"], { cwd: dir });
    const repeated = spawnSync(process.execPath, [cli, "collect", "todo", join(dir, "repeated")], {
      cwd: dir,
      env: { ...process.env, GITHUB_REPOSITORY: "owner/repo" },
      encoding: "utf8",
    });
    assert.equal(repeated.status, 0);
    const next = JSON.parse(readFileSync(join(dir, "repeated/input.json"), "utf8"));
    assert.equal(next.candidates[0].context, snapshot.candidates[0].context);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execProcess = promisify(execFile);
const exec = (file, args, options = {}) =>
  execProcess(file, args, {
    timeout: 10000,
    killSignal: "SIGKILL",
    ...options,
  });
test("publisher finds a closed manual issue on later pages and comments once for new evidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  const comments = [];
  const mutations = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      let body = "";
      for await (const part of req) body += part;
      const data = JSON.parse(body);
      mutations.push(url.pathname);
      comments.push({ body: data.body });
      res.end(
        JSON.stringify({ html_url: "https://github.com/owner/repo/issues/9#issuecomment-1" }),
      );
    } else if (url.pathname.endsWith("/comments")) {
      if (!url.searchParams.has("page")) {
        res.setHeader(
          "link",
          `<http://127.0.0.1:${server.address().port}${url.pathname}?page=2>; rel="next"`,
        );
        res.end(JSON.stringify([{ body: "Earlier discussion" }]));
      } else res.end(JSON.stringify(comments));
    } else if (!url.searchParams.has("page")) {
      res.setHeader(
        "link",
        `<http://127.0.0.1:${server.address().port}${url.pathname}?page=2>; rel="next"`,
      );
      res.end(
        JSON.stringify([
          {
            number: 1,
            title: "unrelated",
            body: "",
            html_url: "https://github.com/owner/repo/issues/1",
          },
        ]),
      );
    } else
      res.end(
        JSON.stringify([
          {
            number: 9,
            state: "closed",
            title: "Expired sessions",
            body: "app.ts\n// TODO: reject expired sessions",
            html_url: "https://github.com/owner/repo/issues/9",
          },
        ]),
      );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const candidate = {
      id: "session",
      path: "app.ts",
      line: 3,
      text: "// TODO: reject expired sessions",
      context: "expired sessions remain accepted",
    };
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [candidate],
      }),
    );
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({
        findings: [
          {
            id: "session",
            confirmed: true,
            title: "Expired sessions",
            evidence: "Expired sessions remain accepted",
            reason: "security",
          },
        ],
      }),
    );
    const env = {
      ...process.env,
      GITHUB_REPOSITORY: "owner/repo",
      GH_TOKEN: "fake",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
    };
    await exec(process.execPath, [cli, "publish", "todo", dir], { env });
    await exec(process.execPath, [cli, "publish", "todo", dir], { env });
    assert.deepEqual(mutations, ["/repos/owner/repo/issues/9/comments"]);
    assert.equal(JSON.parse(readFileSync(join(dir, "decisions.json"), "utf8"))[0].decision, "skip");
    candidate.context = "  expired   sessions remain accepted\n\n";
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [candidate],
      }),
    );
    await exec(process.execPath, [cli, "publish", "todo", dir], { env });
    assert.equal(mutations.length, 1, "formatting alone is not new evidence");
    candidate.context = "also accepts revoked sessions";
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [candidate],
      }),
    );
    await exec(process.execPath, [cli, "publish", "todo", dir], { env });
    assert.equal(mutations.length, 2);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scanner errors and no-package exits retain raw diagnostics and never become findings", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    for (const code of [0, 1, 127, 128, 3]) {
      const scanner = join(dir, "scanner");
      writeFileSync(
        scanner,
        `#!/bin/sh\nprintf '%s' '{"results":[{"packages":[{"package":{"name":"example","version":"1.0.0","ecosystem":"npm"},"vulnerabilities":[]}]}]}'\nprintf 'diagnostic' >&2\nexit ${code}\n`,
        { mode: 0o755 },
      );
      const output = join(dir, String(code));
      const run = spawnSync(process.execPath, [cli, "collect", "osv", output], {
        env: { ...process.env, OSV_SCANNER: scanner, GITHUB_REPOSITORY: "owner/repo" },
        encoding: "utf8",
      });
      assert.equal(run.status, [0, 1].includes(code) ? 0 : 1);
      assert.equal(readFileSync(join(output, "scanner.stderr"), "utf8"), "diagnostic");
      assert.equal(
        JSON.parse(readFileSync(join(output, "scanner-status.json"), "utf8")).exitCode,
        code,
      );
      const input = JSON.parse(readFileSync(join(output, "input.json"), "utf8"));
      assert.equal(input.packageCount, 1);
      assert.equal(input.candidates.length, 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty or malformed agent output fails and preserves transcript", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    const agent = join(dir, "agent");
    writeFileSync(agent, '#!/bin/sh\necho \'{"type":"text","part":{"text":"not json"}}\'\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [
          { id: "x", path: "app.ts", line: 1, text: "// TODO fix", context: "// TODO fix" },
        ],
      }),
    );
    const run = spawnSync(process.execPath, [cli, "analyze", "todo", dir], {
      env: { ...process.env, OPENCODE_BIN: agent, GITHUB_REPOSITORY: "owner/repo" },
    });
    assert.equal(run.status, 1);
    assert.match(readFileSync(join(dir, "agent.jsonl"), "utf8"), /not json/);
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /Error/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("OSV aliases identify one issue and identical replay never writes again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  const issues = [];
  const comments = [];
  const writes = [];
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      let raw = "";
      for await (const part of req) raw += part;
      const value = JSON.parse(raw);
      writes.push(req.url);
      if (req.url.includes("/comments")) comments.push(value);
      else issues.push({ ...value, number: 1, html_url: "https://github.com/owner/repo/issues/1" });
      res.end(
        JSON.stringify({ number: 1, html_url: "https://github.com/owner/repo/issues/1", ...value }),
      );
    } else res.end(JSON.stringify(req.url.includes("/comments") ? comments : issues));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const candidate = {
      id: "advisory",
      ecosystem: "npm",
      package: "example",
      version: "1.0.0",
      aliases: ["TEST-1", "TEST-ALIAS"],
      vulnerabilities: [
        { id: "TEST-1", modified: "2026-01-01", details: "Example advisory facts" },
      ],
    };
    const snapshot = {
      schema: 1,
      kind: "osv",
      repository: "owner/repo",
      sha: "b".repeat(40),
      packageCount: 1,
      scanner: { exitCode: 1 },
      candidates: [candidate],
    };
    writeFileSync(join(dir, "input.json"), JSON.stringify(snapshot));
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({
        findings: [
          {
            id: candidate.id,
            confirmed: true,
            title: "Example advisory",
            evidence: "Example package is affected",
            reason: "Scanner confirmed",
          },
        ],
      }),
    );
    const env = {
      ...process.env,
      GITHUB_REPOSITORY: "owner/repo",
      GH_TOKEN: "fake",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
    };
    await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    assert.deepEqual(writes, ["/repos/owner/repo/issues"]);
    candidate.vulnerabilities[0].modified = "2026-02-01";
    writeFileSync(join(dir, "input.json"), JSON.stringify(snapshot));
    await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    assert.deepEqual(writes, ["/repos/owner/repo/issues"]);
    // A new alias is new evidence about the same problem, not a second issue.
    candidate.aliases.push("TEST-NEW");
    writeFileSync(join(dir, "input.json"), JSON.stringify(snapshot));
    await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    assert.deepEqual(writes, ["/repos/owner/repo/issues", "/repos/owner/repo/issues/1/comments"]);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty snapshot produces JSON and Markdown without invoking agent", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [],
      }),
    );
    const run = spawnSync(process.execPath, [cli, "analyze", "todo", dir], {
      env: { ...process.env, OPENCODE_BIN: "/does/not/exist", GITHUB_REPOSITORY: "owner/repo" },
    });
    assert.equal(run.status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "result.json"), "utf8")), { findings: [] });
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /0 candidates/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("replay rejects foreign workflow before downloading its artifact", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        repository: { full_name: "owner/repo" },
        head_repository: { full_name: "owner/repo" },
        head_branch: "main",
        workflow_id: req.url.endsWith("/11") ? 1 : 2,
        status: "completed",
        event: "workflow_dispatch",
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(
      exec(process.execPath, [cli, "replay", "todo", dir], {
        env: {
          ...process.env,
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_RUN_ID: "11",
          SOURCE_RUN_ID: "22",
          GH_TOKEN: "fake",
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        },
      }),
    );
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /this repository and workflow/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed scanner JSON remains an error with raw output", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    const scanner = join(dir, "scanner");
    writeFileSync(scanner, "#!/bin/sh\necho 'not json'\n", { mode: 0o755 });
    const run = spawnSync(process.execPath, [cli, "collect", "osv", join(dir, "output")], {
      env: { ...process.env, OSV_SCANNER: scanner, GITHUB_REPOSITORY: "owner/repo" },
    });
    assert.equal(run.status, 1);
    assert.equal(readFileSync(join(dir, "output/scanner.stdout.json"), "utf8"), "not json\n");
    assert.match(readFileSync(join(dir, "output/report.md"), "utf8"), /Error/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publisher refuses fabricated source IDs before contacting GitHub", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [
          { id: "real", path: "app.ts", line: 1, text: "// TODO fix", context: "// TODO fix" },
        ],
      }),
    );
    writeFileSync(
      join(dir, "result.json"),
      JSON.stringify({
        findings: [
          {
            id: "fabricated",
            confirmed: true,
            title: "Wrong",
            evidence: "Invented",
            reason: "Invented",
          },
        ],
      }),
    );
    const run = spawnSync(process.execPath, [cli, "publish", "todo", dir], {
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_API_URL: "http://127.0.0.1:1",
      },
    });
    assert.equal(run.status, 1);
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /Malformed agent finding/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("replay chains retain their original trusted snapshot after main advances", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  const snapshot = {
    schema: 1,
    kind: "todo",
    repository: "owner/repo",
    sha: "a".repeat(40),
    candidates: [],
  };
  let foreignOrigin = false;
  const server = createServer((req, res) => {
    const id = req.url.split("/").at(-1);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        repository: { full_name: foreignOrigin && id === "1" ? "foreign/repo" : "owner/repo" },
        head_repository: { full_name: "owner/repo" },
        head_branch: "main",
        workflow_id: 8,
        status: "completed",
        event: "workflow_dispatch",
        head_sha: (id === "1" ? "a" : "b").repeat(40),
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const artifact = join(dir, "artifact.json");
    writeFileSync(artifact, JSON.stringify(snapshot));
    writeFileSync(
      join(dir, "gh"),
      '#!/bin/sh\nfor arg do output="$arg"; done\ncp "$AUDIT_ARTIFACT" "$output/input.json"\n',
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      AUDIT_ARTIFACT: artifact,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "2",
      SOURCE_RUN_ID: "1",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
    };
    await exec(process.execPath, [cli, "replay", "todo", dir], { env });
    writeFileSync(artifact, readFileSync(join(dir, "input.json")));
    env.SOURCE_RUN_ID = "2";
    env.GITHUB_RUN_ID = "3";
    await exec(process.execPath, [cli, "replay", "todo", dir], { env });
    assert.equal(JSON.parse(readFileSync(join(dir, "input.json"))).sha, "a".repeat(40));
    foreignOrigin = true;
    await assert.rejects(exec(process.execPath, [cli, "replay", "todo", dir], { env }));
    assert.match(readFileSync(join(dir, "report.md"), "utf8"), /this repository and workflow/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual issue matching requires whole TODO and OSV identity fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  let issue;
  const writes = [];
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      for await (const part of req) void part;
      writes.push(req.url);
      res.end(JSON.stringify({ number: 2, html_url: "https://github.com/owner/repo/issues/2" }));
    } else res.end(JSON.stringify(req.url.includes("/comments") ? [] : [issue]));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const env = {
      ...process.env,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
    };
    for (const [kind, candidate, body] of [
      [
        "todo",
        { id: "x", path: "app.ts", line: 1, text: "// TODO fix", context: "new facts" },
        "otherapp.ts\n// TODO fix",
      ],
      ...[
        "npm example-extra 1.0.0 TEST-1",
        "npm example 11.0.0 TEST-1",
        "PyPI example 1.0.0 TEST-1",
      ].map((body) => [
        "osv",
        { id: "x", ecosystem: "npm", package: "example", version: "1.0.0", aliases: ["TEST-1"] },
        body,
      ]),
    ]) {
      issue = { number: 1, body, html_url: "https://github.com/owner/repo/issues/1" };
      writeFileSync(
        join(dir, "input.json"),
        JSON.stringify({
          schema: 1,
          kind,
          repository: "owner/repo",
          sha: "a".repeat(40),
          candidates: [candidate],
        }),
      );
      writeFileSync(
        join(dir, "result.json"),
        JSON.stringify({
          findings: [
            {
              id: "x",
              confirmed: true,
              title: "Problem",
              evidence: "new facts",
              reason: "confirmed",
            },
          ],
        }),
      );
      await exec(process.execPath, [cli, "publish", kind, dir], { env });
      assert.equal(writes.at(-1), "/repos/owner/repo/issues", body);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual OSV reports do not gain comments when agent wording changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  const writes = [];
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST") {
      for await (const part of req) void part;
      writes.push(req.url);
      res.end(JSON.stringify({ html_url: "https://github.com/owner/repo/issues/1#comment" }));
    } else
      res.end(
        JSON.stringify(
          req.url.includes("/comments")
            ? []
            : [
                {
                  number: 1,
                  state: "closed",
                  title: "npm example 1.0.0 TEST-1",
                  body: "Known advisory",
                  html_url: "https://github.com/owner/repo/issues/1",
                },
              ],
        ),
      );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "osv",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [
          {
            id: "x",
            ecosystem: "npm",
            package: "example",
            version: "1.0.0",
            aliases: ["TEST-1"],
            vulnerabilities: [{ id: "TEST-1", details: "Known advisory" }],
          },
        ],
      }),
    );
    const env = {
      ...process.env,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
    };
    for (const evidence of [
      "Package has the known advisory",
      "This version is affected by TEST-1",
    ]) {
      writeFileSync(
        join(dir, "result.json"),
        JSON.stringify({
          findings: [
            { id: "x", confirmed: true, title: "Known", evidence, reason: "Scanner confirmed" },
          ],
        }),
      );
      await exec(process.execPath, [cli, "publish", "osv", dir], { env });
    }
    assert.deepEqual(writes, []);
    assert.equal(JSON.parse(readFileSync(join(dir, "decisions.json")))[0].decision, "skip");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("agent receives large snapshots through stdin with bounded argv", () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  try {
    const agent = join(dir, "agent");
    writeFileSync(
      agent,
      `#!${process.execPath}
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
if (process.argv.join(' ').length > 1000 || input.length < 256 * 1024) process.exit(2);
const snapshot = JSON.parse(input.split('Snapshot:\\n')[1]);
if (snapshot.candidates[0].context.length !== 300000) process.exit(3);
console.log(JSON.stringify({type:'text',part:{text:JSON.stringify({findings:[{id:'large',confirmed:false,reason:'No concrete unfinished behavior'}]})}}));
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [
          {
            id: "large",
            path: "app.ts",
            line: 1,
            text: "// TODO fix",
            context: "x".repeat(300000),
          },
        ],
      }),
    );
    const run = spawnSync(process.execPath, [cli, "analyze", "todo", dir], {
      env: { ...process.env, GITHUB_REPOSITORY: "owner/repo", OPENCODE_BIN: agent },
    });
    assert.equal(run.status, 0, readFileSync(join(dir, "report.md"), "utf8"));
    assert.equal(JSON.parse(readFileSync(join(dir, "result.json"))).findings[0].id, "large");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cancelling a publisher blocked on HTTP terminates its child and releases connections", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-test-"));
  let requested;
  const requestStarted = new Promise((resolve) => {
    requested = resolve;
  });
  const server = createServer(() => requested());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    writeFileSync(
      join(dir, "input.json"),
      JSON.stringify({
        schema: 1,
        kind: "todo",
        repository: "owner/repo",
        sha: "a".repeat(40),
        candidates: [],
      }),
    );
    writeFileSync(join(dir, "result.json"), JSON.stringify({ findings: [] }));
    const controller = new AbortController();
    const pending = exec(process.execPath, [cli, "publish", "todo", dir], {
      signal: controller.signal,
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      },
    });
    const exited = new Promise((resolve) =>
      pending.child.once("exit", (...values) => resolve(values)),
    );
    await Promise.race([requestStarted, pending]);
    const rejected = assert.rejects(pending, { name: "AbortError" });
    controller.abort();
    await rejected;
    const [code, signal] = await exited;
    assert.equal(code, null);
    assert.equal(signal, "SIGTERM");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
