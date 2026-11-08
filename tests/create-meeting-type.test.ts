import type { Browser } from "playwright";
import { expect, test } from "vitest";
import { createMeetingType, listMeetingTypes } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";

test("owner creates published types with own and system IDs, optional description and duplicate titles", async () => {
  const server = await startServer();
  try {
    const options = { baseUrl: server.address, signal: AbortSignal.timeout(3000) };
    const first = await createMeetingType({
      ...options,
      body: {
        id: " intro-30 ",
        title: " Знакомство ",
        description: "<b>Текст</b>  с пробелами\nи переносом",
        durationMinutes: 17,
      },
    });
    expect(first.response?.status).toBe(201);
    expect(first.data).toMatchObject({
      id: "intro-30",
      title: "Знакомство",
      description: "<b>Текст</b>  с пробелами\nи переносом",
      durationMinutes: 17,
    });
    const second = await createMeetingType({
      ...options,
      body: { title: "знакомство", durationMinutes: 1440 },
    });
    expect(second.response?.status).toBe(201);
    expect(second.data?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
    expect(second.data?.description).toBe("");
    const list = await listMeetingTypes({ ...options, throwOnError: true });
    expect(list.data.items).toEqual([first.data, second.data]);
  } finally {
    await server.close();
  }
});

test("validation rejects invalid primitives and limits without changing published types; conflict never overwrites", async () => {
  const server = await startServer();
  try {
    const options = { baseUrl: server.address, signal: AbortSignal.timeout(3000) };
    for (const body of [
      { id: "a", title: "x", durationMinutes: 1 },
      {
        id: "b".repeat(64),
        title: "x".repeat(120),
        description: "d".repeat(2000),
        durationMinutes: 1440,
      },
    ])
      expect((await createMeetingType({ ...options, body })).response?.status).toBe(201);
    const before = (await listMeetingTypes({ ...options, throwOnError: true })).data;
    const conflict = await createMeetingType({
      ...options,
      body: { id: " a ", title: "replacement", durationMinutes: 30 },
    });
    expect(conflict.response?.status).toBe(409);
    expect(conflict.error?.code).toBe("ID_ALREADY_EXISTS");
    for (const invalid of [
      ...[
        "",
        " ",
        "Intro",
        "знакомство",
        "intro_30",
        "-intro",
        "intro-",
        "a".repeat(65),
        null,
        3,
      ].map((id) => ({ id })),
      ...["", " ", "x".repeat(121), null, 3].map((title) => ({ title })),
      ...["d".repeat(2001), null, 3].map((description) => ({ description })),
      ...[0, -1, 1.5, 1441, "30", null].map((durationMinutes) => ({ durationMinutes })),
    ]) {
      const response = await fetch(`${server.address}/api/meeting-types`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Valid", durationMinutes: 30, ...invalid }),
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        fields: [{ field: Object.keys(invalid)[0], message: expect.any(String) }],
      });
    }
    for (const body of ["{", "", "null", "[]", "3", "{}"]) {
      const response = await fetch(`${server.address}/api/meeting-types`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.any(String),
      });
    }
    expect((await listMeetingTypes({ ...options, throwOnError: true })).data).toEqual(before);
  } finally {
    await server.close();
  }
});

test("owner sees duplicate warning links, keeps conflicts and publishes a custom 17 minute type", async () => {
  const { chromium } = await import("playwright");
  const server = await startServer([
    {
      id: "intro",
      title: "Знакомство",
      description: "Исходный тип",
      durationMinutes: 30,
      createdAt: "2026-11-09T00:00:00Z",
    },
  ]);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ timeout: 5000 });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(3000);
    page.setDefaultNavigationTimeout(3000);
    await page.goto(server.address);
    await page.getByRole("link", { name: "Админка", exact: true }).click();
    await page
      .getByText("Необязательно. Оставьте пустым — система назначит ID автоматически", {
        exact: true,
      })
      .waitFor();
    expect(await page.getByLabel("Длительность", { exact: true }).inputValue()).toBe("30");
    await page.getByLabel(/^Название/).fill(" знакомство ");
    await page.getByText("Тип встречи с таким названием уже существует", { exact: true }).waitFor();
    expect(
      await page
        .getByRole("link", { name: "Знакомство — 30 мин", exact: true })
        .getAttribute("href"),
    ).toBe("/booking#meeting-type-intro");
    await page.getByText("Исходный тип", { exact: true }).waitFor();
    await page.getByLabel("Описание", { exact: true }).fill("Черновик");
    await page.getByLabel("ID", { exact: true }).fill("draft-id");
    const opened = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Знакомство — 30 мин", exact: true }).click();
    const comparison = await opened;
    await comparison
      .locator("#meeting-type-intro")
      .getByText("Исходный тип", { exact: true })
      .waitFor();
    await comparison.close();
    expect(await page.getByLabel(/^Название/).inputValue()).toBe(" знакомство ");
    expect(await page.getByLabel("Описание", { exact: true }).inputValue()).toBe("Черновик");
    expect(await page.getByLabel("ID", { exact: true }).inputValue()).toBe("draft-id");
    const publicListOpened = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Публичный список типов встреч", exact: true }).click();
    const publicList = await publicListOpened;
    await publicList.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
    await publicList.close();
    expect(await page.getByLabel(/^Название/).inputValue()).toBe(" знакомство ");
    expect(await page.getByLabel("Описание", { exact: true }).inputValue()).toBe("Черновик");
    expect(await page.getByLabel("ID", { exact: true }).inputValue()).toBe("draft-id");
    await page.getByLabel("Описание", { exact: true }).fill("Новая встреча");
    await page.getByLabel("Длительность", { exact: true }).selectOption("custom");
    await page.getByLabel(/^Минуты/).fill("17");
    await page.getByLabel("ID", { exact: true }).fill("intro");
    await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
    await page
      .getByText("Этот ID уже занят. Укажите другой или оставьте поле пустым", { exact: true })
      .waitFor();
    expect(await page.getByLabel(/^Название/).inputValue()).toBe(" знакомство ");
    expect(await page.getByLabel("Описание", { exact: true }).inputValue()).toBe("Новая встреча");
    expect(await page.getByLabel(/^Минуты/).inputValue()).toBe("17");
    await page.getByLabel("ID", { exact: true }).fill("");
    await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
    await page.getByText("Тип встречи создан", { exact: true }).waitFor();
    await page
      .getByRole("link", { name: "Открыть созданный тип в публичном списке", exact: true })
      .click();
    await page.getByRole("heading", { name: "Выберите тип встречи", exact: true }).waitFor();
    const item = page.getByRole("listitem").filter({ hasText: "Новая встреча" });
    expect(await item.textContent()).toContain("17 мин");
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
