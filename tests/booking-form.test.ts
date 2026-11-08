import { randomUUID } from "node:crypto";
import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { createBooking } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";
const type = {
  id: "intro",
  title: "Знакомство",
  description: "",
  durationMinutes: 30,
  createdAt: "2026-11-01T00:00:00Z",
};

test("guest recovers from slot conflict without losing data and confirms another slot", async () => {
  const server = await startServer([type], { now: ["2026-11-08T17:00:00Z"] });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ timeout: 5000 });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(3000);
    page.setDefaultNavigationTimeout(3000);
    await page.goto(`${server.address}/booking?type=intro`);
    await page.getByRole("button", { name: "09:00–09:30", exact: true }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByLabel(/^Имя/).fill("Гость");
    await page.getByLabel(/^Email/).fill("guest@example.com");
    await page.getByLabel("Заметка", { exact: true }).fill("Обсудим проект");
    await page.getByRole("button", { name: "Назад к календарю" }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    expect(await page.getByLabel(/^Имя/).inputValue()).toBe("Гость");
    await createBooking({
      baseUrl: server.address,
      headers: { "Idempotency-Key": randomUUID() },
      body: {
        meetingTypeId: "intro",
        startsAt: "2026-11-09T02:00:00Z",
        guestName: "Другой гость",
        guestEmail: "other@example.com",
      },
      signal: AbortSignal.timeout(3000),
      throwOnError: true,
    });
    await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
    await page.getByRole("alert").getByText("Это время уже заняли. Выберите другой слот").waitFor();
    await page.getByRole("button", { name: "09:30–10:00", exact: true }).waitFor();
    expect(await page.getByRole("button", { name: "09:00–09:30", exact: true }).count()).toBe(0);
    await page.getByRole("button", { name: "09:30–10:00", exact: true }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    expect(await page.getByLabel(/^Email/).inputValue()).toBe("guest@example.com");
    expect(await page.getByLabel("Заметка", { exact: true }).inputValue()).toBe("Обсудим проект");
    await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
    await page.getByRole("heading", { name: "Запись подтверждена", exact: true }).waitFor();
    expect(await page.getByRole("status").textContent()).toContain(
      "Знакомство, 2026-11-09, 09:30–10:00 · Asia/Novokuznetsk",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});

test("unknown network result retries the same payload and key, while edits use a new key", async () => {
  const server = await startServer([type], { now: ["2026-11-08T17:00:00Z"] });
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
    const sent: { key: string; body: string; status?: number }[] = [];
    await page.route("**/api/bookings", async (route) => {
      const request = route.request();
      const item = {
        key: request.headers()["idempotency-key"],
        body: request.postData()!,
        status: undefined as number | undefined,
      };
      sent.push(item);
      if (sent.length === 1) {
        await held;
        const response = await route.fetch();
        item.status = response.status();
        await route.abort("failed");
      } else {
        const response = await route.fetch();
        item.status = response.status();
        await route.fulfill({ response });
      }
    });
    await page.goto(`${server.address}/booking?type=intro`);
    await page.getByRole("button", { name: "09:00–09:30", exact: true }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByLabel(/^Имя/).fill("Гость");
    await page.getByLabel(/^Email/).fill("guest@example.com");
    const submit = page.getByRole("button", { name: "Подтвердить запись", exact: true });
    await submit.click();
    expect(await submit.isDisabled()).toBe(true);
    release!();
    await page
      .getByRole("alert")
      .getByText("Не удалось узнать результат записи. Повторите отправку с прежними данными.")
      .waitFor();
    await submit.click();
    await page.getByRole("heading", { name: "Запись подтверждена", exact: true }).waitFor();
    expect(sent.map((item) => item.status)).toEqual([201, 200]);
    expect(sent[0].key).toBe(sent[1].key);
    expect(sent[0].body).toBe(sent[1].body);

    await page.goto(`${server.address}/booking?type=intro`);
    await page.getByRole("button", { name: "09:30–10:00", exact: true }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByLabel(/^Имя/).fill("Гость");
    await page.getByLabel(/^Email/).fill("guest@example.com");
    await page.unroute("**/api/bookings");
    let failedKey = "";
    await page.route(
      "**/api/bookings",
      async (route) => {
        failedKey = route.request().headers()["idempotency-key"];
        await route.abort("failed");
      },
      { times: 1 },
    );
    await submit.click();
    await page.getByRole("alert").waitFor();
    await page.getByLabel(/^Имя/).fill("Другой гость");
    const posted = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/api/bookings"),
    );
    await submit.click();
    const request = await posted;
    expect(request.headers()["idempotency-key"]).not.toBe(failedKey);
    expect(request.postDataJSON().guestName).toBe("Другой гость");
    await page.getByRole("heading", { name: "Запись подтверждена", exact: true }).waitFor();
  } finally {
    release!();
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
});
