import { Alert, Badge, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { MonthCalendar } from "./MonthCalendar.tsx";
import { useEffect, useState } from "react";
import { listBookings } from "../generated/api/sdk.gen.ts";
import type { BookingList } from "../generated/api/types.gen.ts";

export function UpcomingBookings() {
  const [data, setData] = useState<BookingList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [date, setDate] = useState("");
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
  const meetings = data?.items.filter((item) => dateKey(item.startsAt) === selectedDate) ?? [];

  return (
    <Stack className="upcoming-page" gap="lg">
      <Title order={2}>Предстоящие встречи</Title>
      <Text>Время встреч: Asia/Novokuznetsk</Text>
      <Button
        style={{ alignSelf: "flex-start" }}
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setError(false);
          setAttempt((value) => value + 1);
        }}
      >
        {error ? "Повторить" : "Обновить"}
      </Button>
      {loading && <Text component="output">Загрузка встреч…</Text>}
      {error && (
        <Alert role="alert" color="red">
          {data
            ? "Не удалось обновить встречи. Показан ранее загруженный список; данные могли устареть."
            : "Не удалось загрузить встречи. Попробуйте ещё раз."}
        </Alert>
      )}
      {data && (
        <Paper withBorder className="owner-calendar-layout">
          <MonthCalendar
            start={today}
            end={end}
            markedDates={dates}
            date={selectedDate}
            onChange={setDate}
            legend="Есть встречи"
          />
          <section className="owner-agenda" aria-label="Встречи на выбранную дату">
            <Title order={3} size="h4">
              {new Intl.DateTimeFormat("ru-RU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }).format(new Date(`${selectedDate}T12:00:00Z`))}
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              Встреч на этот день: {meetings.length}
            </Text>
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
                {meetings.map((item) => {
                  const start = new Date(item.startsAt);
                  const end = new Date(item.endsAt);
                  const serverNow = Date.parse(data.serverNow);
                  const time = new Intl.DateTimeFormat("ru-RU", {
                    timeZone: data.timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <Paper
                      component="li"
                      key={item.id}
                      p="lg"
                      radius="md"
                      withBorder
                      style={{ overflowWrap: "anywhere" }}
                    >
                      <Stack gap="sm">
                        <Title order={2} size="h3">
                          {item.meetingTypeTitle}
                        </Title>
                        {start.getTime() <= serverNow && serverNow < end.getTime() && (
                          <Badge color="teal">Идёт сейчас</Badge>
                        )}
                        <Text>
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: data.timeZone,
                            dateStyle: "short",
                          }).format(start)}{" "}
                          · {time.format(start)}–{time.format(end)} · {item.durationMinutes} мин
                        </Text>
                        <Text>{item.guestName}</Text>
                        <Text>{item.guestEmail}</Text>
                        {item.note && <Text style={{ whiteSpace: "pre-wrap" }}>{item.note}</Text>}
                      </Stack>
                    </Paper>
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
