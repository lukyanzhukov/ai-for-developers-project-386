import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { createBooking, createMeetingType } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`owner creates type, guest confirms, owner opens and reloads upcoming list at ${viewport.width}px`, async () => {
    const server = await startServer([], { now: ["2026-11-08T17:00:00Z"] });
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ timeout: 5000 });
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(3000);
      page.setDefaultNavigationTimeout(3000);
      await page.goto(`${server.address}/admin`);
      await page.getByLabel(/^Название/).fill("Обсуждение проекта");
      await page.getByRole("button", { name: "Создать встречу", exact: true }).click();
      await page.getByRole("link", { name: "Посмотреть на странице записи", exact: true }).click();
      await page.getByRole("radio", { name: "Обсуждение проекта, 30 мин", exact: true }).click();
      await page.getByRole("button", { name: "Дальше", exact: true }).click();
      await page.getByRole("button", { name: "09:00–09:30", exact: true }).click();
      await page.getByRole("button", { name: "Дальше", exact: true }).click();
      await page.getByLabel(/^Имя/).fill("Анна");
      const email = `${"a".repeat(60)}@example.com`;
      await page.getByLabel(/^Email/).fill(email);
      await page.getByLabel("Заметка", { exact: true }).fill("<b>План</b>\nОбсудить сроки");
      await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
      await page.getByRole("heading", { name: "Запись подтверждена", exact: true }).waitFor();
      await page.getByRole("link", { name: "Админка", exact: true }).click();
      const link = page.getByRole("link", { name: "Предстоящие встречи", exact: true });
      await link.focus();
      await page.keyboard.press("Enter");
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await page.reload();
        const list = page.getByRole("list", { name: "Предстоящие встречи", exact: true });
        await list.getByText("Анна · 30 мин", { exact: true }).waitFor();
        expect(await list.textContent()).toContain("Обсуждение проекта");
        expect(await list.textContent()).toContain("Сегодня · 9 ноября");
        expect(await list.textContent()).toContain("09:00–09:30");
        expect(await list.textContent()).toContain("30 мин");
        expect(await list.textContent()).toContain(email);
        expect(await list.textContent()).toContain("<b>План</b>");
        expect(await list.locator("b").count()).toBe(0);
        await page.getByText("Время встреч: Asia/Novokuznetsk", { exact: true }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
      }
    } finally {
      try {
        await browser?.close();
      } finally {
        await server.close();
      }
    }
  });
}

for (const width of [1280, 390]) {
  for (const mode of ["Список", "Календарь"]) {
    test(`owner retries, keeps stale meetings and removes ended meetings in ${mode} at ${width}px`, async () => {
      const server = await startServer([], {
        now: ["2026-11-09T02:15:00Z", "2026-11-09T02:30:00Z"],
        bookings: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            meetingTypeId: "intro",
            meetingTypeTitle: "Знакомство",
            startsAt: "2026-11-09T02:00:00Z",
            endsAt: "2026-11-09T02:30:00Z",
            durationMinutes: 30,
            guestName: "Гость",
            guestEmail: "guest@example.com",
            note: "",
            createdAt: "2026-11-01T00:00:00Z",
          },
        ],
      });
      let browser: Browser | undefined;
      let release: (() => void) | undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        browser = await chromium.launch({ timeout: 5000 });
        const page = await browser.newPage({ viewport: { width, height: 844 } });
        page.setDefaultTimeout(3000);
        page.setDefaultNavigationTimeout(3000);
        let requests = 0;
        await page.route("**/api/bookings", async (route) => {
          requests++;
          if (requests === 1) {
            await held;
            await route.abort("failed");
          } else if (requests === 3) await route.abort("failed");
          else await route.continue();
        });
        await page.goto(`${server.address}/admin?view=bookings`);
        await page.getByText("Загрузка встреч…", { exact: true }).waitFor();
        if (mode === "Календарь")
          await page.locator("label").filter({ hasText: "Календарь" }).click();
        expect(await page.getByRole("button", { name: "Обновить", exact: true }).isDisabled()).toBe(
          true,
        );
        release!();
        await page
          .getByRole("alert")
          .getByText("Не удалось загрузить встречи. Попробуйте ещё раз.")
          .waitFor();
        const retry = page.getByRole("button", { name: "Повторить", exact: true });
        await retry.focus();
        await page.keyboard.press("Enter");
        await page.getByText("Идёт сейчас", { exact: true }).waitFor();
        const list = page.getByRole("list", { name: "Предстоящие встречи", exact: true });
        expect(await list.getByRole("listitem").count()).toBe(1);
        await page.getByRole("button", { name: "Обновить", exact: true }).click();
        await page
          .getByRole("alert")
          .getByText(
            "Не удалось обновить встречи. Показан ранее загруженный список; данные могли устареть.",
          )
          .waitFor();
        expect(await list.getByRole("listitem").count()).toBe(1);
        expect(await list.textContent()).toContain("guest@example.com");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await retry.click();
        await page.getByText("Предстоящих встреч пока нет", { exact: true }).waitFor();
        expect(await list.count()).toBe(0);
        expect(await page.getByRole("alert").count()).toBe(0);
        expect(requests).toBe(4);
        expect(await page.getByRole("radio", { name: mode, exact: true }).isChecked()).toBe(true);
        await createMeetingType({
          baseUrl: server.address,
          body: { id: "review", title: "Новая встреча", durationMinutes: 30 },
          throwOnError: true,
          signal: AbortSignal.timeout(3000),
        });
        await createBooking({
          baseUrl: server.address,
          body: {
            meetingTypeId: "review",
            startsAt: "2026-11-09T03:00:00Z",
            guestName: "Новый гость",
            guestEmail: "new@example.com",
          },
          headers: { "Idempotency-Key": randomUUID() },
          throwOnError: true,
          signal: AbortSignal.timeout(3000),
        });
        expect(await list.count()).toBe(0);
        await page.getByRole("button", { name: "Обновить", exact: true }).click();
        await list.getByRole("heading", { name: "Новая встреча", exact: true }).waitFor();
        expect(await list.getByRole("listitem").count()).toBe(1);
        expect(await list.textContent()).toContain("new@example.com");
        expect(await page.getByRole("radio", { name: mode, exact: true }).isChecked()).toBe(true);
      } finally {
        release!();
        try {
          await browser?.close();
        } finally {
          await server.close();
        }
      }
    });
  }
}

for (const width of [1280, 390]) {
  test(`owner opens the full list, switches to the calendar and preserves the selected day at ${width}px`, async () => {
    const base = {
      meetingTypeId: "intro",
      durationMinutes: 30,
      guestName: "Гость",
      guestEmail: "guest@example.com",
      note: "",
      createdAt: "2026-11-01T00:00:00Z",
    };
    const server = await startServer([], {
      now: ["2026-11-09T02:15:00Z"],
      bookings: [
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000004",
          meetingTypeId: "review",
          meetingTypeTitle: "Позже сегодня",
          startsAt: "2026-11-09T03:00:00Z",
          endsAt: "2026-11-09T03:30:00Z",
        },
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000005",
          meetingTypeTitle: "Завершена",
          startsAt: "2026-11-09T01:30:00Z",
          endsAt: "2026-11-09T02:15:00Z",
        },
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000001",
          meetingTypeTitle: "Сегодня",
          startsAt: "2026-11-09T02:00:00Z",
          endsAt: "2026-11-09T02:30:00Z",
        },
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000002",
          meetingTypeTitle: "Завтра",
          startsAt: "2026-11-10T02:00:00Z",
          endsAt: "2026-11-10T02:30:00Z",
        },
        {
          ...base,
          id: "00000000-0000-4000-8000-000000000003",
          meetingTypeTitle: "В январе",
          startsAt: "2027-01-04T02:00:00Z",
          endsAt: "2027-01-04T02:30:00Z",
        },
      ],
    });
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ timeout: 5000 });
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        hasTouch: width === 390,
      });
      page.setDefaultTimeout(3000);
      let requests = 0;
      await page.route("**/api/bookings", async (route) => {
        requests++;
        await route.continue();
      });
      await page.goto(`${server.address}/admin?view=bookings`);
      const list = page.getByRole("list", { name: "Предстоящие встречи", exact: true });
      await list.getByText("Сегодня", { exact: true }).waitFor();
      expect(await list.getByRole("listitem").count()).toBe(4);
      expect(await list.getByRole("heading", { level: 4 }).allTextContents()).toEqual([
        "Сегодня",
        "Позже сегодня",
        "Завтра",
        "В январе",
      ]);
      expect(await list.getByRole("heading", { level: 3 }).allTextContents()).toEqual([
        "Сегодня · 9 ноября",
        "вторник, 10 ноября",
        "понедельник, 4 января 2027 г.",
      ]);
      expect(await list.getByText("Идёт сейчас", { exact: true }).count()).toBe(1);
      expect(await list.getByText("Завершена", { exact: true }).count()).toBe(0);
      expect(await page.getByRole("region", { name: "Календарь", exact: true }).count()).toBe(0);
      await page.reload();
      await list.getByText("В январе", { exact: true }).waitFor();
      expect(await page.getByRole("radio", { name: "Список", exact: true }).isChecked()).toBe(true);
      const calendarToggle = page.locator("label").filter({ hasText: "Календарь" });
      if (width === 390) await calendarToggle.tap();
      else await calendarToggle.click();
      expect(await list.getByRole("listitem").count()).toBe(2);
      await page.getByRole("button", { name: "2026-11-11", exact: true }).click();
      await page.getByText("На этот день встреч нет", { exact: true }).waitFor();
      expect(await list.count()).toBe(0);
      await page.getByRole("button", { name: "2026-11-10", exact: true }).click();
      await list.getByText("Завтра", { exact: true }).waitFor();
      await page.locator("label").filter({ hasText: "Список" }).click();
      expect(await list.getByRole("listitem").count()).toBe(4);
      await page.getByRole("radio", { name: "Список", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      expect(await page.getByRole("radio", { name: "Календарь", exact: true }).isChecked()).toBe(
        true,
      );
      expect(
        await page
          .getByRole("button", { name: "2026-11-10", exact: true })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(requests).toBe(2);
      const next = page.getByRole("button", { name: "Следующий месяц", exact: true });
      await next.click();
      await next.click();
      await page.getByRole("button", { name: "2027-01-04", exact: true }).click();
      await list.getByText("В январе", { exact: true }).waitFor();
      expect(await next.isDisabled()).toBe(true);
      await page.getByRole("button", { name: "Обновить", exact: true }).click();
      await list.getByText("В январе", { exact: true }).waitFor();
      expect(
        await page
          .getByRole("button", { name: "2027-01-04", exact: true })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    } finally {
      try {
        await browser?.close();
      } finally {
        await server.close();
      }
    }
  });
}
