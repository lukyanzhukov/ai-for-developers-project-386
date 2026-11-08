import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { listMeetingTypes } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";

const sameTitle = "Знакомство";
const first = {
  id: "a",
  title: sameTitle,
  description: "",
  durationMinutes: 17,
  createdAt: "2026-11-09T02:00:00Z",
};
const second = { ...first, id: "b", description: "<b>Текст</b>  с пробелами\nи переносом" };
const third = { ...first, id: "c", createdAt: "2026-11-09T03:00:00Z" };

test("SDK receives all meeting type fields in creation order with id tie-break", async () => {
  const server = await startServer([third, second, first]);
  try {
    const result = await listMeetingTypes({
      baseUrl: server.address,
      throwOnError: true,
      signal: AbortSignal.timeout(3000),
    });
    expect(result.response.status).toBe(200);
    expect(result.response.headers.get("content-type")).toContain("application/json");
    expect(result.data).toEqual({ items: [first, second, third] });
  } finally {
    await server.close();
  }
});

test("guest reads the real API list on desktop and mobile without interpreting descriptions as HTML", async () => {
  const server = await startServer([third, second, first]);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ timeout: 5000 });
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(3000);
      page.setDefaultNavigationTimeout(3000);
      try {
        const response = page.waitForResponse((response) =>
          response.url().endsWith("/api/meeting-types"),
        );
        await page.goto(`${server.address}/booking`);
        expect(await (await response).json()).toEqual({ items: [first, second, third] });
        await page.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
        const items = page.getByRole("list", { name: "Типы встреч" }).getByRole("listitem");
        expect(await items.count()).toBe(3);
        expect(await items.nth(0).getByRole("heading").textContent()).toBe(sameTitle);
        expect(await items.nth(0).textContent()).toContain("17 мин");
        const description = items.nth(1).getByText(second.description, { exact: true });
        expect(await description.textContent()).toBe(second.description);
        expect(await description.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(
          "pre-wrap",
        );
        expect(await items.nth(1).locator("b").count()).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});

test("guest sees loading, a request error, and can retry against the real server", async () => {
  const server = await startServer();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ timeout: 5000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    page.setDefaultNavigationTimeout(3000);
    let failRequest: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      failRequest = resolve;
    });
    await page.route(
      "**/api/meeting-types",
      async (route) => {
        await held;
        await route.abort("failed");
      },
      { times: 1 },
    );
    try {
      await page.goto(`${server.address}/booking`);
      await page.getByRole("status").getByText("Загрузка типов встреч…", { exact: true }).waitFor();
      failRequest!();
      await page
        .getByRole("alert")
        .getByText("Не удалось загрузить типы встреч. Попробуйте ещё раз.", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Повторить", exact: true }).click();
      await page.getByRole("status").getByText("Типов встреч пока нет.", { exact: true }).waitFor();
      expect(await page.getByRole("alert").count()).toBe(0);
    } finally {
      failRequest!();
      await page.close();
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});
