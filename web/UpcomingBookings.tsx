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
import { MonthCalendar } from "./MonthCalendar.tsx";
import { useEffect, useState } from "react";
import { listBookings } from "../generated/api/sdk.gen.ts";
import type { BookingList } from "../generated/api/types.gen.ts";

export function UpcomingBookings() {
  const [data, setData] = useState<BookingList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("list");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void listBookings({
      throwOnError: true,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) setData(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const dateKey = (instant: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: data?.timeZone ?? "Asia/Novokuznetsk",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(instant));
  const today = data ? dateKey(data.serverNow) : "";
  const dates = data?.items.map((item) => dateKey(item.startsAt)) ?? [];
  const lastDate = dates.at(-1) ?? today;
  const endOfMonth = data ? new Date(`${lastDate.slice(0, 7)}-01T12:00:00Z`) : undefined;
  endOfMonth?.setUTCMonth(endOfMonth.getUTCMonth() + 1);
  endOfMonth?.setUTCDate(0);
  const end = endOfMonth?.toISOString().slice(0, 10) ?? "";
  const selectedDate = date >= today && date <= end ? date : (dates[0] ?? today);
  const meetings =
    data?.items.filter((item) => mode === "list" || dateKey(item.startsAt) === selectedDate) ?? [];
  const counts = new Map<string, number>();
  for (const day of dates) counts.set(day, (counts.get(day) ?? 0) + 1);
  const dayLabel = (day: string) => {
    const label = new Intl.DateTimeFormat("ru-RU", {
      weekday: day === today ? undefined : "long",
      day: "numeric",
      month: "long",
      year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
    return day === today ? `Сегодня · ${label}` : label;
  };

  return (
    <Stack className="upcoming-page" gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Предстоящие встречи</Title>
          <Text size="sm" c="dimmed" mt={6}>
            Время встреч: Asia/Novokuznetsk
          </Text>
        </div>
        <Button
          variant="default"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError(false);
            setAttempt((value) => value + 1);
          }}
        >
          {error ? "Повторить" : "Обновить"}
        </Button>
      </Group>
      <Group justify="space-between">
        <SegmentedControl
          className="owner-view-toggle"
          radius="xl"
          color="dark"
          aria-label="Режим просмотра"
          value={mode}
          onChange={setMode}
          data={[
            {
              value: "list",
              label: (
                <span className="owner-view-label">
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 5h9M7 10h9M7 15h9M3 5h.01M3 10h.01M3 15h.01" />
                  </svg>
                  Список
                </span>
              ),
            },
            {
              value: "calendar",
              label: (
                <span className="owner-view-label">
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
        {data && (
          <Text size="sm" c="dimmed">
            {mode === "list"
              ? `Всего: ${meetings.length}`
              : `На выбранный день: ${meetings.length}`}
          </Text>
        )}
      </Group>
      {loading && <Text component="output">Загрузка встреч…</Text>}
      {error && (
        <Alert role="alert" color="red">
          {data
            ? "Не удалось обновить встречи. Показан ранее загруженный список; данные могли устареть."
            : "Не удалось загрузить встречи. Попробуйте ещё раз."}
        </Alert>
      )}
      {data && (
        <Paper
          withBorder={mode === "calendar"}
          bg={mode === "calendar" ? "white" : "transparent"}
          className={mode === "calendar" ? "owner-calendar-layout" : undefined}
        >
          {mode === "calendar" && (
            <MonthCalendar
              start={today}
              end={end}
              markedDates={dates}
              date={selectedDate}
              onChange={setDate}
              legend="Есть встречи"
            />
          )}
          <section
            className={mode === "calendar" ? "owner-agenda" : "owner-list"}
            aria-label={
              mode === "calendar" ? "Встречи на выбранную дату" : "Все предстоящие встречи"
            }
          >
            {mode === "calendar" && (
              <Title order={3} size="h4" mb="lg">
                {dayLabel(selectedDate)}
              </Title>
            )}
            {meetings.length === 0 ? (
              <Text component="output" c="dimmed">
                {data.items.length ? "На этот день встреч нет" : "Предстоящих встреч пока нет"}
              </Text>
            ) : (
              <Stack
                component="ul"
                aria-label="Предстоящие встречи"
                p={0}
                m={0}
                style={{ listStyle: "none" }}
              >
                {meetings.map((item, index) => {
                  const start = new Date(item.startsAt);
                  const end = new Date(item.endsAt);
                  const serverNow = Date.parse(data.serverNow);
                  const time = new Intl.DateTimeFormat("ru-RU", {
                    timeZone: data.timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li key={item.id}>
                      {mode === "list" &&
                        (index === 0 ||
                          dateKey(meetings[index - 1].startsAt) !== dateKey(item.startsAt)) && (
                          <Group justify="space-between" className="owner-date-heading">
                            <Title order={3} size="md">
                              {dayLabel(dateKey(item.startsAt))}
                            </Title>
                            <Text size="xs" c="dimmed">
                              Записей: {counts.get(dateKey(item.startsAt))}
                            </Text>
                          </Group>
                        )}
                      <Paper p="lg" radius="md" withBorder className="owner-booking-card">
                        <Text size="sm" fw={600} className="owner-booking-time">
                          <time dateTime={item.startsAt}>{time.format(start)}</time>–
                          <time dateTime={item.endsAt}>{time.format(end)}</time>
                        </Text>
                        <Stack gap={6}>
                          <Group gap="xs">
                            <Title order={4} size="md">
                              {item.meetingTypeTitle}
                            </Title>
                            {start.getTime() <= serverNow && serverNow < end.getTime() && (
                              <Badge color="teal" size="sm">
                                Идёт сейчас
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm">
                            {item.guestName} · {item.durationMinutes} мин
                          </Text>
                          <Text size="sm" c="dimmed">
                            {item.guestEmail}
                          </Text>
                          {item.note && (
                            <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                              {item.note}
                            </Text>
                          )}
                        </Stack>
                      </Paper>
                    </li>
                  );
                })}
              </Stack>
            )}
          </section>
        </Paper>
      )}
    </Stack>
  );
}
