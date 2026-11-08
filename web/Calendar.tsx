import { Alert, Button, Group, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { createBooking, getAvailability, listMeetingTypes } from "../generated/api/sdk.gen.ts";
import type {
  Availability,
  Booking,
  CreateBooking,
  MeetingType,
  Slot,
} from "../generated/api/types.gen.ts";

export function Calendar({ id }: { id: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; missing: boolean }
    | {
        status: "ready";
        availability: Availability;
        meetingType: MeetingType;
        stale?: "loading" | "error";
      }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Slot>();
  const [step, setStep] = useState<"calendar" | "form">("calendar");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<Booking>();
  const retry = useRef<{ fingerprint: string; key: string; body: CreateBooking } | undefined>(
    undefined,
  );
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
          setState((previous) =>
            previous.status === "ready"
              ? { ...previous, stale: "error" }
              : {
                  status: "error",
                  missing:
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error &&
                    error.code === "MEETING_TYPE_NOT_FOUND",
                },
          );
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
  if (booking)
    return (
      <Stack className="hero" gap="lg" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <Title order={1}>Запись подтверждена</Title>
        <Text component="output">
          {booking.meetingTypeTitle},{" "}
          {new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Novokuznetsk",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(booking.startsAt))}
          , {interval(booking)} · Asia/Novokuznetsk
        </Text>
        <Text>
          {booking.guestName} · {booking.guestEmail}
        </Text>
        {booking.note && (
          <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{booking.note}</Text>
        )}
        <Button component="a" href="/booking">
          К типам встреч
        </Button>
      </Stack>
    );
  return (
    <Stack className="hero" gap="lg" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <Button component="a" href="/booking" variant="subtle" style={{ alignSelf: "flex-start" }}>
        К типам встреч
      </Button>
      <Title order={1}>{step === "form" ? "Подтвердите запись" : "Выберите дату и время"}</Title>
      {error && (
        <Alert role="alert" color="red">
          {error}
        </Alert>
      )}
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
          {state.stale && (
            <Alert color="yellow" role="alert">
              <Stack align="flex-start">
                <Text>
                  {state.stale === "loading"
                    ? "Обновление календаря…"
                    : "Не удалось обновить календарь. Показаны прежние данные; слоты могли устареть."}
                </Text>
                <Button
                  disabled={state.stale === "loading"}
                  onClick={() => {
                    setState({ ...state, stale: "loading" });
                    setAttempt((value) => value + 1);
                  }}
                >
                  Повторить
                </Button>
              </Stack>
            </Alert>
          )}
          <Title order={2}>{state.meetingType.title}</Title>
          <Text>
            {state.meetingType.durationMinutes} мин · {state.availability.timeZone}
          </Text>
          {step === "calendar" ? (
            <>
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
                      disabled={Boolean(state.stale)}
                      onClick={() => setSelected(slot)}
                    >
                      {interval(slot)}
                    </Button>
                  ))}
                </Group>
              ) : (
                <Text component="output">На эту дату свободных слотов нет.</Text>
              )}
            </>
          ) : null}
          {selected && (
            <>
              <Text component="output">
                Выбрано: {state.meetingType.title}, {date}, {interval(selected)} ·{" "}
                {state.availability.timeZone}
              </Text>
              <Text>Слот выбран, запись ещё не создана.</Text>
              {step === "calendar" ? (
                <Button onClick={() => setStep("form")}>Продолжить</Button>
              ) : (
                <Stack
                  component="form"
                  maw={650}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (saving) return;
                    const body = {
                      meetingTypeId: id,
                      startsAt: selected.startsAt,
                      guestName: guestName.trim(),
                      guestEmail: guestEmail.trim(),
                      note,
                    };
                    const fingerprint = JSON.stringify(body);
                    if (retry.current?.fingerprint !== fingerprint)
                      retry.current = { fingerprint, key: crypto.randomUUID(), body };
                    setSaving(true);
                    setError("");
                    setErrors({});
                    try {
                      const result = await createBooking({
                        body: retry.current.body,
                        headers: { "Idempotency-Key": retry.current.key },
                        signal: AbortSignal.timeout(10000),
                      });
                      if (result.data) setBooking(result.data);
                      else if (result.error?.code === "VALIDATION_ERROR") {
                        setError(result.error.message);
                        setErrors(
                          Object.fromEntries(
                            (result.error.fields ?? []).map((field) => [
                              field.field,
                              field.message,
                            ]),
                          ),
                        );
                      } else if (result.error?.code === "MEETING_TYPE_NOT_FOUND") {
                        setStep("calendar");
                        setSelected(undefined);
                        setState({ status: "error", missing: true });
                      } else if (
                        result.error &&
                        ["SLOT_TAKEN", "SLOT_EXPIRED", "SLOT_OUTSIDE_WINDOW"].includes(
                          result.error.code,
                        )
                      ) {
                        setError(result.error.message);
                        setStep("calendar");
                        setSelected(undefined);
                        setState({ ...state, stale: "loading" });
                        setAttempt((value) => value + 1);
                      } else if (
                        result.error?.code === "INVALID_SLOT" ||
                        result.error?.code === "IDEMPOTENCY_CONFLICT"
                      )
                        setError(result.error.message);
                      else
                        setError(
                          "Не удалось узнать результат записи. Повторите отправку с прежними данными.",
                        );
                    } catch {
                      setError(
                        "Не удалось узнать результат записи. Повторите отправку с прежними данными.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <TextInput
                    label="Имя"
                    required
                    maxLength={120}
                    value={guestName}
                    onChange={(event) => setGuestName(event.currentTarget.value)}
                    error={errors.guestName}
                    disabled={saving}
                  />
                  <TextInput
                    label="Email"
                    type="email"
                    required
                    maxLength={254}
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.currentTarget.value)}
                    error={errors.guestEmail}
                    disabled={saving}
                  />
                  <Textarea
                    label="Заметка"
                    maxLength={2000}
                    value={note}
                    onChange={(event) => setNote(event.currentTarget.value)}
                    error={errors.note}
                    disabled={saving}
                  />
                  <Button type="submit" disabled={saving} loading={saving}>
                    Подтвердить запись
                  </Button>
                  <Button variant="subtle" disabled={saving} onClick={() => setStep("calendar")}>
                    Назад к календарю
                  </Button>
                </Stack>
              )}
            </>
          )}
        </>
      )}
    </Stack>
  );
}
