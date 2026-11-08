import { Alert, Badge, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { listBookings } from "../generated/api/sdk.gen.ts";
import type { BookingList } from "../generated/api/types.gen.ts";

export function UpcomingBookings() {
  const [data, setData] = useState<BookingList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

  return (
    <Stack className="hero" gap="lg">
      <Title order={1}>Предстоящие встречи</Title>
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
      {data &&
        (data.items.length === 0 ? (
          <Text component="output">Предстоящих встреч пока нет</Text>
        ) : (
          <Stack
            component="ul"
            aria-label="Предстоящие встречи"
            p={0}
            m={0}
            style={{ listStyle: "none" }}
          >
            {data.items.map((item) => {
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
        ))}
    </Stack>
  );
}
