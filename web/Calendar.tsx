import { Alert, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { getAvailability, listMeetingTypes } from "../generated/api/sdk.gen.ts";
import type { Availability, MeetingType, Slot } from "../generated/api/types.gen.ts";

export function Calendar({ id }: { id: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; missing: boolean }
    | { status: "ready"; availability: Availability; meetingType: MeetingType }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Slot>();
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
    void Promise.all([
      getAvailability({ path: { id }, signal, throwOnError: true }),
      listMeetingTypes({ signal, throwOnError: true }),
    ])
      .then(([availability, types]) => {
        if (controller.signal.aborted) return;
        const meetingType = types.data.items.find((item) => item.id === id);
        if (!meetingType) {
          setState({ status: "error", missing: true });
          return;
        }
        setDate(availability.data.windowStart);
        setSelected(undefined);
        setState({ status: "ready", availability: availability.data, meetingType });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            missing:
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "MEETING_TYPE_NOT_FOUND",
          });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const time = (instant: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Novokuznetsk",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(instant));
  const interval = (slot: Slot) => `${time(slot.startsAt)}–${time(slot.endsAt)}`;
  const day =
    state.status === "ready"
      ? state.availability.days.find((item) => item.date === date)
      : undefined;
  return (
    <Stack className="hero" gap="lg">
      <Button component="a" href="/booking" variant="subtle" style={{ alignSelf: "flex-start" }}>
        К типам встреч
      </Button>
      <Title order={1}>Выберите дату и время</Title>
      {state.status === "loading" ? (
        <Text component="output">Загрузка календаря…</Text>
      ) : state.status === "error" ? (
        <Alert role="alert" color="red">
          <Stack align="flex-start">
            <Text>
              {state.missing
                ? "Тип встречи не найден."
                : "Не удалось загрузить календарь. Попробуйте ещё раз."}
            </Text>
            {!state.missing && (
              <Button
                onClick={() => {
                  setState({ status: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                Повторить
              </Button>
            )}
          </Stack>
        </Alert>
      ) : (
        <>
          <Title order={2}>{state.meetingType.title}</Title>
          <Text>
            {state.meetingType.durationMinutes} мин · {state.availability.timeZone}
          </Text>
          <Text>Выберите дату:</Text>
          <Group aria-label="Даты">
            {state.availability.days.map((item) => (
              <Button
                key={item.date}
                variant={date === item.date ? "filled" : "light"}
                aria-pressed={date === item.date}
                onClick={() => {
                  setDate(item.date);
                  setSelected(undefined);
                }}
              >
                {item.date}
              </Button>
            ))}
          </Group>
          <Text>Свободное время:</Text>
          {day?.slots.length ? (
            <Group aria-label="Слоты">
              {day.slots.map((slot) => (
                <Button
                  key={slot.startsAt}
                  variant={selected?.startsAt === slot.startsAt ? "filled" : "light"}
                  aria-pressed={selected?.startsAt === slot.startsAt}
                  onClick={() => setSelected(slot)}
                >
                  {interval(slot)}
                </Button>
              ))}
            </Group>
          ) : (
            <Text component="output">На эту дату свободных слотов нет.</Text>
          )}
          {selected && (
            <>
              <Text component="output">
                Выбрано: {state.meetingType.title}, {date}, {interval(selected)} ·{" "}
                {state.availability.timeZone}
              </Text>
              <Text>Слот выбран, запись ещё не создана.</Text>
            </>
          )}
          <Text c="dimmed">Подтверждение записи скоро появится.</Text>
        </>
      )}
    </Stack>
  );
}
