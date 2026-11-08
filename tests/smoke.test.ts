import { fork } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import { expect, test } from "vitest";
import { getHealth, listMeetingTypes } from "../generated/api/sdk.gen.ts";

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

    const types = await listMeetingTypes({
      baseUrl: address,
      throwOnError: true,
      signal: AbortSignal.timeout(3000),
    });
    expect(types.response.status).toBe(200);
    expect(types.response.headers.get("content-type")).toContain("application/json");
    expect(types.data).toEqual({ items: [] });

    const page = await fetch(address, { signal: AbortSignal.timeout(3000) });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<title>Календарь звонков</title>");
    const booking = await fetch(new URL("/booking", address), {
      signal: AbortSignal.timeout(3000),
    });
    expect(booking.status).toBe(200);
    expect(await booking.text()).toBe(html);
    const asset = html.match(/src="([^"]+\.js)"/);
    expect(asset).not.toBeNull();
    const script = await fetch(new URL(asset![1], address), { signal: AbortSignal.timeout(3000) });
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");

    const browser = await chromium.launch({ timeout: 5000 });
    try {
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({ viewport });
        page.setDefaultTimeout(3000);
        page.setDefaultNavigationTimeout(3000);
        await page.goto(address);
        await page.getByRole("heading", { level: 1, name: /Меньше переписки/ }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );

        await page.getByRole("link", { name: "Записаться", exact: true }).click();
        await page.waitForURL(new URL("/booking", address).href);
        await page.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
        await page
          .getByRole("status")
          .getByText("Типов встреч пока нет.", { exact: true })
          .waitFor();
        await page.reload();
        await page.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );

        await page.getByRole("link", { name: "На главную", exact: true }).click();
        await page.waitForURL(new URL("/", address).href);
        await page.getByRole("heading", { level: 1, name: /Меньше переписки/ }).waitFor();
        await page.close();
      }
    } finally {
      await browser.close();
    }
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
