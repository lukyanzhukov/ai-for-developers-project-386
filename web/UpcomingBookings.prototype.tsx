// Throwaway: three layouts on /admin?view=bookings&prototype=1&variant=A, using synthetic data only.
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { MonthCalendar } from "./MonthCalendar.tsx";
import "./UpcomingBookings.prototype.css";

const variants = ["A", "B", "C"];
const names = ["Карточки по датам", "Компактная таблица", "Лента встреч"];
const demo = [
  {
    id: "1",
    date: "2026-11-09",
    time: "10:00–10:30",
    title: "Знакомство",
    duration: 30,
    guest: "Анна Смирнова",
    email: "anna@example.com",
    note: "Хочу обсудить обучение и следующий шаг.",
    current: true,
  },
  {
    id: "2",
    date: "2026-11-09",
    time: "14:00–15:00",
    title: "Консультация",
    duration: 60,
    guest: "Михаил Орлов",
    email: "mikhail@example.com",
    note: "Вопросы по архитектуре приложения.",
    current: false,
  },
  {
    id: "3",
    date: "2026-11-10",
    time: "11:00–11:30",
    title: "Знакомство",
    duration: 30,
    guest: "Елена Волкова",
    email: "elena@example.com",
    note: "",
    current: false,
  },
  {
    id: "4",
    date: "2026-11-26",
    time: "16:00–17:00",
    title: "Разбор проекта",
    duration: 60,
    guest: "Алексей Соколов",
    email: "alexey@example.com",
    note: "Обсудим подготовку к сдаче проекта.",
    current: false,
  },
];
type Meeting = (typeof demo)[number];
const day = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

function Details({ item }: { item: Meeting }) {
  return (
    <Stack gap={6}>
      <Group gap="xs">
        <Text fw={600}>{item.title}</Text>
        {item.current && (
          <Badge color="teal" size="sm">
            Идёт сейчас
          </Badge>
        )}
      </Group>
      <Text size="sm">
        {item.guest} · {item.duration} мин
      </Text>
      <Text size="sm" c="dimmed">
        {item.email}
      </Text>
      {item.note && (
        <Text size="sm" c="dimmed">
          {item.note}
        </Text>
      )}
    </Stack>
  );
}

export function VariantA({ items }: { items: Meeting[] }) {
  return (
    <Stack gap={26}>
      {[...new Set(items.map((item) => item.date))].map((date) => (
        <section key={date} aria-label={day(date)}>
          <Group justify="space-between" mb="sm">
            <Text className="prototype-date" fw={600}>
              {date === "2026-11-09" ? "Сегодня · 9 ноября" : day(date)}
            </Text>
            <Text size="xs" c="dimmed">
              Записей: {items.filter((item) => item.date === date).length}
            </Text>
          </Group>
          <Stack gap="sm">
            {items
              .filter((item) => item.date === date)
              .map((item) => (
                <Paper key={item.id} withBorder p="lg" className="prototype-card">
                  <Text size="sm" fw={600} className="prototype-time">
                    {item.time}
                  </Text>
                  <Details item={item} />
                </Paper>
              ))}
          </Stack>
        </section>
      ))}
    </Stack>
  );
}

export function VariantB({ items }: { items: Meeting[] }) {
  return (
    <Paper withBorder className="prototype-table">
      <div className="prototype-table-head">
        <Text size="xs" c="dimmed">
          Дата и время
        </Text>
        <Text size="xs" c="dimmed">
          Встреча и гость
        </Text>
      </div>
      {items.map((item) => (
        <div className="prototype-row" key={item.id}>
          <div>
            <Text size="sm" fw={600}>
              {item.date.slice(8)} ноября
            </Text>
            <Text size="sm" c="dimmed">
              {item.time}
            </Text>
          </div>
          <Details item={item} />
        </div>
      ))}
    </Paper>
  );
}

export function VariantC({ items }: { items: Meeting[] }) {
  return (
    <div className="prototype-timeline">
      {items.map((item) => (
        <section className="prototype-event" key={item.id}>
          <Text size="sm" className="prototype-date" c="dimmed">
            {day(item.date)}
          </Text>
          <Title order={3} size="h2" my="xs">
            {item.time}
          </Title>
          <Details item={item} />
        </section>
      ))}
    </div>
  );
}

export function UpcomingBookingsPrototype() {
  const [variant, setVariant] = useState(
    () => new URLSearchParams(location.search).get("variant") ?? "A",
  );
  const [mode, setMode] = useState("all");
  const [date, setDate] = useState("2026-11-09");
  const [state, setState] = useState("populated");
  const index = Math.max(0, variants.indexOf(variant));
  const changeVariant = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    const url = new URL(location.href);
    url.searchParams.set("variant", next);
    history.replaceState(null, "", url);
    setVariant(next);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          target.closest("input, textarea, select, button, [contenteditable], [role=radio]"))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        changeVariant(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const all = state === "empty" ? [] : demo;
  const items = mode === "all" ? all : all.filter((item) => item.date === date);
  const content = items.length ? (
    index === 0 ? (
      <VariantA items={items} />
    ) : index === 1 ? (
      <VariantB items={items} />
    ) : (
      <VariantC items={items} />
    )
  ) : (
    <Paper withBorder p="xl">
      <Title order={3} size="h4">
        {all.length ? "На этот день встреч нет" : "Предстоящих встреч пока нет"}
      </Title>
      <Text size="sm" c="dimmed" mt="xs">
        {all.length
          ? "Выберите другую дату или откройте все встречи."
          : "Когда гость запишется, встреча появится здесь."}
      </Text>
    </Paper>
  );
  return (
    <Stack gap="lg" className="upcoming-page prototype-page">
      <Text size="xs" c="dimmed">
        МАКЕТ · Вымышленные данные · 9 ноября 2026, 10:15
      </Text>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Предстоящие встречи</Title>
          <Text size="sm" c="dimmed" mt={6}>
            Все типы встреч · Asia/Novokuznetsk
          </Text>
        </div>
        <Button variant="default" onClick={() => setState("populated")}>
          {state === "error" ? "Повторить" : "Обновить"}
        </Button>
      </Group>
      <Group justify="space-between">
        <SegmentedControl
          className="prototype-view-toggle"
          radius="xl"
          color="dark"
          aria-label="Режим просмотра"
          value={mode}
          onChange={setMode}
          data={[
            {
              value: "all",
              label: (
                <span className="prototype-view-label">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 5h9M7 10h9M7 15h9M3 5h.01M3 10h.01M3 15h.01" />
                  </svg>
                  Список
                </span>
              ),
            },
            {
              value: "day",
              label: (
                <span className="prototype-view-label">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="3" y="4" width="14" height="13" rx="3" />
                    <path d="M6 2.5v3M14 2.5v3M3 8h14M7 11h.01M10 11h.01M13 11h.01M7 14h.01M10 14h.01" />
                  </svg>
                  Календарь
                </span>
              ),
            },
          ]}
        />
        <Text size="sm" c="dimmed">
          {mode === "all" ? `Всего: ${all.length}` : `На выбранный день: ${items.length}`}
        </Text>
      </Group>
      {state === "error" && (
        <Alert role="alert" color="red">
          Не удалось обновить встречи. Показан ранее загруженный список; данные могли устареть.
        </Alert>
      )}
      {state === "loading" ? (
        <Text component="output">Загрузка встреч…</Text>
      ) : mode === "day" ? (
        <Paper withBorder className="prototype-day-layout">
          <MonthCalendar
            start="2026-11-09"
            end="2026-11-30"
            markedDates={all.map((item) => item.date)}
            legend="Есть встречи"
            date={date}
            onChange={setDate}
          />
          <section className="prototype-day-content" aria-label="Встречи на выбранную дату">
            {index !== 0 && (
              <Text className="prototype-date" fw={600} mb="lg">
                {day(date)}
              </Text>
            )}
            {content}
          </section>
        </Paper>
      ) : (
        <section aria-label="Все предстоящие встречи">{content}</section>
      )}
      <Paper withBorder p="sm" className="prototype-states">
        <Text size="xs" c="dimmed" mb={8}>
          Проверить состояние макета
        </Text>
        <SegmentedControl
          size="xs"
          value={state}
          onChange={setState}
          data={[
            { value: "populated", label: "Встречи" },
            { value: "empty", label: "Пусто" },
            { value: "error", label: "Ошибка" },
            { value: "loading", label: "Загрузка" },
          ]}
        />
      </Paper>
      <Text size="xs" c="dimmed">
        Макет не отправляет запросов. Переключение режима сохраняет выбранную дату; «Обновить»
        восстанавливает демонстрационные данные.
      </Text>
      {import.meta.env.DEV && (
        <nav className="prototype-switcher" aria-label="Варианты макета">
          <button type="button" aria-label="Предыдущий вариант" onClick={() => changeVariant(-1)}>
            ←
          </button>
          <span aria-live="polite">
            {variants[index]} · {names[index]}
          </span>
          <button type="button" aria-label="Следующий вариант" onClick={() => changeVariant(1)}>
            →
          </button>
        </nav>
      )}
    </Stack>
  );
}
