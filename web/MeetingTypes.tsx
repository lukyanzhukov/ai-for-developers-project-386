import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
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
    <Stack className="meeting-page" gap="xl">
      <header className="page-heading">
        <div className="owner-avatar" aria-hidden="true">
          К
        </div>
        <Text className="eyebrow" mt="lg">
          Календарь звонков
        </Text>
        <Title order={1}>Выберите встречу</Title>
        <Text c="dimmed" mt="sm">
          Найдём время для хорошего разговора. С чего начнём?
        </Text>
      </header>
      {state.status === "loading" ? (
        <Text component="output">Загрузка встреч…</Text>
      ) : state.status === "error" ? (
        <Alert role="alert" color="red">
          <Stack align="flex-start">
            <Text>Не удалось загрузить встречи. Попробуйте ещё раз.</Text>
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
        <Text component="output">Встреч для записи пока нет.</Text>
      ) : (
        <Stack
          component="ul"
          aria-label="Встречи"
          className="meeting-list"
          p={0}
          m={0}
          style={{ listStyle: "none" }}
        >
          {state.items.map((item) => (
            <Paper
              component="li"
              key={item.id}
              id={`meeting-type-${item.id}`}
              p={28}
              radius="md"
              withBorder
              style={{ overflowWrap: "anywhere" }}
            >
              <Stack gap="md" h="100%">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Title order={2} size="h3">
                    {item.title}
                  </Title>
                  <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>
                    {item.durationMinutes} мин
                  </Badge>
                </Group>
                {item.description && (
                  <Text c="dimmed" size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {item.description}
                  </Text>
                )}
                <Button
                  component="a"
                  href={`/booking?type=${encodeURIComponent(item.id)}`}
                  variant="subtle"
                  className="meeting-link"
                  rightSection={<span aria-hidden="true">→</span>}
                >
                  Выбрать время
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
