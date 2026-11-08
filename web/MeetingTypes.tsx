import { Alert, Badge, Button, Group, Radio, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { listMeetingTypes } from "../generated/api/sdk.gen.ts";
import type { MeetingType } from "../generated/api/types.gen.ts";

export function MeetingTypes({
  selectedId,
  onSelect,
  onContinue,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
}) {
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
        <Title order={1} tabIndex={-1}>
          Выберите встречу
        </Title>
        <Text c="dimmed" mt="sm">
          Выберите подходящую встречу. На следующем шаге назначим время.
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
        <Radio.Group value={selectedId ?? ""} onChange={onSelect} aria-label="Встреча">
          <ul aria-label="Встречи" className="meeting-list">
            {state.items.map((item) => (
              <li key={item.id} id={`meeting-type-${item.id}`}>
                <Radio.Card
                  value={item.id}
                  aria-label={`${item.title}, ${item.durationMinutes} мин`}
                  className="meeting-choice"
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
                    <Group justify="space-between" mt="auto">
                      <Text size="sm" fw={600} className="meeting-choice-state">
                        {selectedId === item.id ? "Выбрано" : "Выбрать встречу"}
                      </Text>
                      <Radio.Indicator variant="outline" color="#9b8054" />
                    </Group>
                  </Stack>
                </Radio.Card>
              </li>
            ))}
          </ul>
        </Radio.Group>
      )}
      <Button
        size="lg"
        fullWidth
        disabled={state.status !== "ready" || !state.items.some((item) => item.id === selectedId)}
        onClick={onContinue}
      >
        Дальше <span aria-hidden="true">→</span>
      </Button>
    </Stack>
  );
}
