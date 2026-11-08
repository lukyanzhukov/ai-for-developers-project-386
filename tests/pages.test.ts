import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "../web/App.tsx";

function renderPage(pathname: string) {
  return renderToStaticMarkup(createElement(MantineProvider, {}, createElement(App, { pathname })));
}

test("home explains the booking steps and links to booking", () => {
  const html = renderPage("/");
  expect(html).toMatch(/<a\b[^>]*href="\/booking"[^>]*>.*?Записаться.*?<\/a>/);
  expect(html).toContain("Без регистрации");
  expect(html).toContain("Выберите встречу");
  expect(html).toContain("Назначьте время");
  expect(html).toContain("ближайшие 14 дней");
  expect(html).not.toContain("тип встречи");
});

test("booking loads meetings and links home", () => {
  const html = renderPage("/booking");
  expect(html).toContain("Выберите встречу");
  expect(html).toContain("Загрузка встреч");
  expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*aria-label="Календарь звонков — на главную"/);
  expect(html).not.toContain("<form");
});
