import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
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
      await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
      await page
        .getByRole("link", { name: "Открыть созданный тип в публичном списке", exact: true })
        .click();
      await page.getByRole("link", { name: "Выбрать время", exact: true }).click();
      await page.getByRole("button", { name: "09:00–09:30", exact: true }).click();
      await page.getByRole("button", { name: "Продолжить", exact: true }).click();
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
        await list.getByText("Анна", { exact: true }).waitFor();
        expect(await list.textContent()).toContain("Обсуждение проекта");
        expect(await list.textContent()).toContain("09.11.2026");
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

test("owner retries first load, keeps stale meetings after refresh failure, and removes ended meetings on manual refresh", async () => {
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
      390,
    );
    await retry.click();
    await page.getByText("Предстоящих встреч пока нет", { exact: true }).waitFor();
    expect(await list.count()).toBe(0);
    expect(await page.getByRole("alert").count()).toBe(0);
    expect(requests).toBe(4);
  } finally {
    release!();
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});
