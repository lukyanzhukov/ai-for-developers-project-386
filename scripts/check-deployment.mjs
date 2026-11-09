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
  await page.getByRole("button", { name: "Создать встречу", exact: true }).click();
  await page.getByRole("link", { name: "Посмотреть на странице записи", exact: true }).click();
  await page.getByRole("listitem").filter({ hasText: title }).getByRole("radio").click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();
  const days = page.getByRole("button", { name: /^\d{4}-\d{2}-\d{2}$/, disabled: false });
  await days.first().waitFor();
  const slots = page.getByRole("button", { name: /^\d{2}:\d{2}–\d{2}:\d{2}$/ });
  for (let month = 0; month < 2; month++) {
    for (let index = 0; index < (await days.count()); index++) {
      await days.nth(index).click();
      if (await slots.count()) break;
    }
    if (await slots.count()) break;
    const next = page.getByRole("button", { name: "Следующий месяц", exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  assert((await slots.count()) > 0, "No free slot in the booking window");
  const dateName = await page.getByRole("button", { pressed: true }).getAttribute("aria-label");
  const slotName = await slots.first().textContent();
  await slots.first().click();
  await page.getByRole("button", { name: "Дальше", exact: true }).click();

  const other = await browser.newPage();
  other.setDefaultTimeout(30000);
  await other.goto(page.url());
  const sameDay = other.getByRole("button", { name: dateName, exact: true });
  await other.getByRole("button", { name: "Следующий месяц", exact: true }).waitFor();
  if (!(await sameDay.count()) || (await sameDay.isDisabled()))
    await other.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await sameDay.click();
  await other.getByRole("button", { name: slotName.trim(), exact: true }).click();
  await other.getByRole("button", { name: "Дальше", exact: true }).click();
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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await page.reload();
    await list.getByText(title, { exact: true }).waitFor();
    assert.equal(await list.getByText(title, { exact: true }).count(), 1);
    await page.locator("label").filter({ hasText: "Календарь" }).click();
    const nextMonth = page.getByRole("button", { name: "Следующий месяц", exact: true });
    await nextMonth.waitFor();
    const ownerDay = page.getByRole("button", { name: dateName, exact: true });
    if (!(await ownerDay.count()) || (await ownerDay.isDisabled())) await nextMonth.click();
    await ownerDay.click();
    await list.getByText(title, { exact: true }).waitFor();
    assert.equal(await list.getByText(title, { exact: true }).count(), 1);
  }
  console.log(
    "Passed: health, owner creates type, guest books, duplicate rejected, owner sees booking",
  );
} finally {
  await browser.close();
}
