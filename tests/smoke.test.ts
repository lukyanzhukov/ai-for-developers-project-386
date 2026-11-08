import { fork } from "node:child_process";
import { once } from "node:events";
import { expect, test } from "vitest";
import { getHealth } from "../generated/api/sdk.gen.ts";

test("built application starts and serves the API through the SDK and the frontend", async () => {
  const child = fork("dist/server/main.js", [], {
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));

  try {
    const address = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Server startup timed out: ${output}`)),
        10000,
      );
      child.once("message", (message: { address: string }) => {
        clearTimeout(timer);
        resolve(message.address);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited (${code}): ${output}`));
      });
    });
    const result = await getHealth({
      baseUrl: address,
      throwOnError: true,
      signal: AbortSignal.timeout(3000),
    });
    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({ status: "ok" });

    const page = await fetch(address, { signal: AbortSignal.timeout(3000) });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<title>Календарь звонков</title>");
    const asset = html.match(/src="([^"]+\.js)"/);
    expect(asset).not.toBeNull();
    const script = await fetch(new URL(asset![1], address), { signal: AbortSignal.timeout(3000) });
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      const killTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
      child.kill("SIGTERM");
      await exited;
      clearTimeout(killTimer);
    }
  }
});
