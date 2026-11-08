import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { startServer } from "./server.ts";

const meetingType = {
  id: "intro",
  title: "Знакомство",
  description: "Поговорим",
  durationMinutes: 17,
  createdAt: "2026-11-01T00:00:00Z",
};

test("guest selects type, date and slot on desktop and mobile, with direct entry and reload", async () => {
  const server = await startServer([meetingType], { now: ["2026-11-08T17:00:00Z"] });
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
        await page.goto(`${server.address}/booking`);
        await page.getByRole("link", { name: "Выбрать время" }).click();
        await page.waitForURL(`${server.address}/booking?type=intro`);
        await page.getByRole("heading", { name: "Выберите дату и время" }).waitFor();
        await page.getByRole("button", { name: "2026-11-14", exact: true }).click();
        await page.getByText("На эту дату свободных слотов нет.", { exact: true }).waitFor();
        await page.getByRole("button", { name: "2026-11-10", exact: true }).click();
        await page.getByRole("button", { name: "09:00–09:17", exact: true }).click();
        const selection = page.getByRole("status").filter({ hasText: "Выбрано:" });
        expect(await selection.textContent()).toContain("2026-11-10, 09:00–09:17");
        expect(await selection.textContent()).toContain("Asia/Novokuznetsk");
        await page.getByText("Слот выбран, запись ещё не создана.", { exact: true }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        await page.reload();
        await page.getByRole("heading", { name: "Выберите дату и время" }).waitFor();
        await page.getByRole("button", { name: "2026-11-09", exact: true }).waitFor();
        await page.getByRole("link", { name: "К типам встреч", exact: true }).click();
        await page.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
        await page.goto(`${server.address}/booking?type=missing`);
        await page
          .getByRole("alert")
          .getByText("Тип встречи не найден.", { exact: true })
          .waitFor();
        await page.getByRole("link", { name: "К типам встреч", exact: true }).waitFor();
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

test("guest sees calendar loading and request failure, then retries the real API", async () => {
  const server = await startServer([{ ...meetingType, durationMinutes: 1440 }], {
    now: ["2026-11-08T17:00:00Z"],
  });
  let browser: Browser | undefined;
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    browser = await chromium.launch({ timeout: 5000 });
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    page.setDefaultNavigationTimeout(3000);
    await page.route(
      "**/api/meeting-types/intro/availability",
      async (route) => {
        await held;
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page.goto(`${server.address}/booking?type=intro`);
    await page.getByRole("status").getByText("Загрузка календаря…", { exact: true }).waitFor();
    release!();
    await page
      .getByRole("alert")
      .getByText("Не удалось загрузить календарь. Попробуйте ещё раз.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await page.getByRole("button", { name: "2026-11-09", exact: true }).waitFor();
    await page
      .getByRole("status")
      .getByText("На эту дату свободных слотов нет.", { exact: true })
      .waitFor();
    expect(await page.getByRole("alert").count()).toBe(0);
  } finally {
    release!();
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});
