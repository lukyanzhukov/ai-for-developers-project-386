import { Alert, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { listMeetingTypes } from "../generated/api/sdk.gen.ts";
import type { MeetingType } from "../generated/api/types.gen.ts";

export function MeetingTypes() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error" } | { status: "ready"; items: MeetingType[] }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void listMeetingTypes({
      throwOnError: true,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) setState({ status: "ready", items: data.items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <Stack className="hero" gap="lg">
      <Title order={1}>Выберите тип встречи</Title>
      <Text c="dimmed">Пока записаться на встречу через сервис нельзя.</Text>
      {state.status === "loading" ? (
        <Text component="output">Загрузка типов встреч…</Text>
      ) : state.status === "error" ? (
        <Alert role="alert" color="red">
          <Stack align="flex-start">
            <Text>Не удалось загрузить типы встреч. Попробуйте ещё раз.</Text>
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Повторить
            </Button>
          </Stack>
        </Alert>
      ) : state.items.length === 0 ? (
        <Text component="output">Типов встреч пока нет.</Text>
      ) : (
        <Stack component="ul" aria-label="Типы встреч" p={0} m={0} style={{ listStyle: "none" }}>
          {state.items.map((item) => (
            <Paper
              component="li"
              key={item.id}
              id={`meeting-type-${item.id}`}
              p="lg"
              radius="md"
              withBorder
              style={{ overflowWrap: "anywhere" }}
            >
              <Stack gap="sm">
                <Title order={2} size="h3">
                  {item.title}
                </Title>
                {item.description && (
                  <Text style={{ whiteSpace: "pre-wrap" }}>{item.description}</Text>
                )}
                <Text>{item.durationMinutes} мин</Text>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
