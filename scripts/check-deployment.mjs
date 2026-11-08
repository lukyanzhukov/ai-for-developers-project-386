import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { getHealth } from "../generated/api/sdk.gen.ts";

const baseUrl = process.env.DEPLOYMENT_URL;
assert(baseUrl, "Set DEPLOYMENT_URL to the running service URL");
const health = await getHealth({
  baseUrl,
  throwOnError: true,
  signal: AbortSignal.timeout(30000),
});
assert.deepEqual(health.data, { status: "ok" });

const browser = await chromium.launch({ timeout: 10000 });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  const title = `Проверка деплоя ${randomUUID()}`;
  await page.goto(`${baseUrl}/admin`);
  await page.getByLabel(/^Название/).fill(title);
  await page.getByRole("button", { name: "Создать тип встречи", exact: true }).click();
  await page
    .getByRole("link", { name: "Открыть созданный тип в публичном списке", exact: true })
    .click();
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("link", { name: "Выбрать время", exact: true })
    .click();
  // Try each date: today's working hours may already be over.
  const days = page.getByRole("button", { name: /^\d{4}-\d{2}-\d{2}$/ });
  await days.first().waitFor();
  const slots = page.getByRole("button", { name: /^\d{2}:\d{2}–\d{2}:\d{2}$/ });
  for (let index = 0; index < (await days.count()); index++) {
    await days.nth(index).click();
    if (await slots.count()) break;
  }
  assert((await slots.count()) > 0, "No free slot in the booking window");
  const dateName = await page.getByRole("button", { pressed: true }).textContent();
  const slotName = await slots.first().textContent();
  await slots.first().click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();

  const other = await browser.newPage();
  other.setDefaultTimeout(30000);
  await other.goto(page.url());
  await other.getByRole("button", { name: dateName.trim(), exact: true }).click();
  await other.getByRole("button", { name: slotName.trim(), exact: true }).click();
  await other.getByRole("button", { name: "Продолжить", exact: true }).click();
  for (const guest of [page, other]) {
    await guest.getByLabel(/^Имя/).fill("Тестовый гость");
    await guest.getByLabel(/^Email/).fill("deployment@example.com");
  }
  await page.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
  await page.getByRole("heading", { name: "Запись подтверждена", exact: true }).waitFor();
  await other.getByRole("button", { name: "Подтвердить запись", exact: true }).click();
  await other.getByRole("alert").getByText("Это время уже заняли. Выберите другой слот").waitFor();
  await page.goto(`${baseUrl}/admin?view=bookings`);
  const list = page.getByRole("list", { name: "Предстоящие встречи", exact: true });
  await list.getByText(title, { exact: true }).waitFor();
  assert.equal(await list.getByText(title, { exact: true }).count(), 1);
  await page.reload();
  await list.getByText(title, { exact: true }).waitFor();
  console.log(
    "Passed: health, owner creates type, guest books, duplicate rejected, owner sees booking",
  );
} finally {
  await browser.close();
}
