import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "../web/App.tsx";

function renderPage(pathname: string) {
  return renderToStaticMarkup(createElement(MantineProvider, {}, createElement(App, { pathname })));
}

test("home explains the booking rules and links to the booking page", () => {
  const html = renderPage("/");

  expect(html).toMatch(/<a\b[^>]*href="\/booking"[^>]*>.*?Записаться.*?<\/a>/);
  expect(html).toContain("Без регистрации");
  expect(html).toContain("одним владельцем календаря");
  expect(html).toContain("название, описание и длительность");
  expect(html).toContain("ближайшие 14 дней");
  expect(html).toContain("сколько длится выбранный тип встречи");
  expect(html).toContain("одно и то же время нельзя занять дважды");
  expect(html).toContain("даже частично");
  expect(html).toContain("предстоящие встречи всех типов");
});

test("booking loads meeting types, explains booking is unavailable and links home", () => {
  const html = renderPage("/booking");

  expect(html).toContain("Выберите тип встречи");
  expect(html).toContain("Загрузка типов встреч");
  expect(html).toContain("Пока записаться на встречу через сервис нельзя");
  expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*>.*?На главную.*?<\/a>/);
  expect(html).not.toContain("<form");
});
