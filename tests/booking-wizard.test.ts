import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { startServer } from "./server.ts";

const meetings = [
  {
    id: "intro",
    title: "Знакомство",
    description: "Поговорим",
    durationMinutes: 30,
    createdAt: "2026-11-01T00:00:00Z",
  },
  {
    id: "review",
    title: "Разбор проекта",
    description: "Посмотрим детали",
    durationMinutes: 60,
    createdAt: "2026-11-01T00:00:01Z",
  },
];

for (const width of [1280, 390]) {
  test(`wizard is linear, preserves choices and guest details, supports browser history at ${width}px`, async () => {
    const server = await startServer(meetings, { now: ["2026-11-08T17:00:00Z"] });
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ timeout: 5000 });
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(3000);
      await page.goto(`${server.address}/booking`);
      const next = page.getByRole("button", { name: "Дальше", exact: true });
      const progress = page.getByRole("progressbar", { name: "Прогресс записи" });
      expect(await next.isDisabled()).toBe(true);
      await page.getByRole("button", { name: /2 Дата и время/ }).click({ force: true });
      await page.getByRole("heading", { name: "Выберите встречу", exact: true }).waitFor();
      const intro = page.getByRole("radio", { name: "Знакомство, 30 мин", exact: true });
      await intro.focus();
      await page.keyboard.press("Space");
      expect(await intro.getAttribute("aria-checked")).toBe("true");
      await next.click();
      await page.getByRole("heading", { name: "Выберите дату и время", exact: true }).waitFor();
      expect(Number(await progress.getAttribute("aria-valuenow"))).toBeCloseTo(200 / 3);
      expect(await next.isDisabled()).toBe(true);
      await page.getByRole("button", { name: "2026-11-10", exact: true }).click();
      const slot = page.getByRole("button", { name: "09:00–09:30", exact: true });
      await slot.click();
      await next.click();
      await page.getByLabel(/^Имя/).fill("Анна");
      await page.getByLabel(/^Email/).fill("anna@example.com");
      await page.getByLabel("Заметка", { exact: true }).fill("Обсудим планы");
      expect(await progress.getAttribute("aria-valuenow")).toBe("100");
      await page.getByRole("button", { name: "Назад к календарю", exact: true }).click();
      expect(await slot.getAttribute("aria-pressed")).toBe("true");
      expect(
        await page
          .getByRole("button", { name: "2026-11-10", exact: true })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      await page.getByRole("button", { name: "Назад к встречам", exact: true }).click();
      expect(await intro.getAttribute("aria-checked")).toBe("true");
      await next.click();
      expect(await slot.getAttribute("aria-pressed")).toBe("true");
      await next.click();
      expect(await page.getByLabel(/^Имя/).inputValue()).toBe("Анна");
      expect(await page.getByLabel(/^Email/).inputValue()).toBe("anna@example.com");
      expect(await page.getByLabel("Заметка", { exact: true }).inputValue()).toBe("Обсудим планы");
      await page.goBack();
      await page.getByRole("heading", { name: "Выберите дату и время", exact: true }).waitFor();
      await page.goForward();
      await page.getByRole("heading", { name: "Подтвердите запись", exact: true }).waitFor();
      expect(await page.getByLabel(/^Имя/).inputValue()).toBe("Анна");
      await page.getByRole("button", { name: "Назад к календарю", exact: true }).click();
      await page.getByRole("button", { name: "Назад к встречам", exact: true }).click();
      await page.getByRole("radio", { name: "Разбор проекта, 60 мин", exact: true }).click();
      await next.click();
      await page.getByRole("button", { name: "09:00–10:00", exact: true }).waitFor();
      expect(await next.isDisabled()).toBe(true);
      expect(await page.getByRole("button", { pressed: true }).count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.goto(`${server.address}/booking?type=intro&step=confirm`);
      await page.getByRole("heading", { name: "Выберите дату и время", exact: true }).waitFor();
      expect(
        await page.getByRole("button", { name: "Подтвердить запись", exact: true }).count(),
      ).toBe(0);
    } finally {
      try {
        await browser?.close();
      } finally {
        await server.close();
      }
    }
  });
}
