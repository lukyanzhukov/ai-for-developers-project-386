import {
  Alert,
  Badge,
  Button,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { MonthCalendar } from "./MonthCalendar.tsx";
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
        setDate(
          availability.data.days.find((day) => day.slots.length)?.date ??
            availability.data.windowStart,
        );
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
      <Paper withBorder className="confirmation-card">
        <Stack gap="lg" align="center">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <Text className="eyebrow">Всё готово</Text>
          <Title order={1}>Запись подтверждена</Title>
          <Text c="dimmed" ta="center">
            Время за вами. Будем рады встрече!
          </Text>
          <Title order={2} size="h3">
            {booking.meetingTypeTitle}
          </Title>
          <section aria-label="Детали записи" aria-live="polite" className="booking-receipt">
            <dl className="receipt-details">
              <div>
                <dt>Когда</dt>
                <dd>
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Novokuznetsk",
                  }).format(new Date(booking.startsAt))}
                </dd>
              </div>
              <div>
                <dt>Время</dt>
                <dd>
                  {interval(booking)}
                  <small>Asia/Novokuznetsk</small>
                </dd>
              </div>
              <div>
                <dt>Гость</dt>
                <dd>
                  {booking.guestName}
                  <small>{booking.guestEmail}</small>
                </dd>
              </div>
            </dl>
          </section>
          {booking.note && (
            <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{booking.note}</Text>
          )}
          <Button component="a" href="/booking">
            Выбрать другую встречу
          </Button>
        </Stack>
      </Paper>
    );
  return (
    <Stack className="booking-page" gap="lg">
      <Button component="a" href="/booking" variant="subtle" style={{ alignSelf: "flex-start" }}>
        Выбрать другую встречу
      </Button>
      <div className="booking-heading">
        <Text className="eyebrow">
          {step === "form" ? "Последний шаг" : "Найдём удобное время"}
        </Text>
        <Title order={1}>{step === "form" ? "Подтвердите запись" : "Выберите дату и время"}</Title>
      </div>
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
                ? "Встреча не найдена."
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
          <Paper
            withBorder
            className={`booking-panel ${step === "form" ? "booking-panel-form" : ""}`}
          >
            <aside className="meeting-summary">
              <div className="owner-avatar" aria-hidden="true">
                К
              </div>
              <Text size="sm" c="dimmed" mt="lg">
                Календарь звонков
              </Text>
              <Title order={2} size="h3" mt="sm">
                {state.meetingType.title}
              </Title>
              {state.meetingType.description && (
                <Text size="sm" c="dimmed" className="meeting-description">
                  {state.meetingType.description}
                </Text>
              )}
              <Badge variant="light" color="gray" mt="lg">
                {state.meetingType.durationMinutes} мин
              </Badge>
              <Text className="mobile-timezone" size="xs" c="dimmed" mt="sm">
                {state.availability.timeZone}
              </Text>
              <div className="summary-details">
                <Text size="xs" c="dimmed">
                  Часовой пояс
                </Text>
                <Text size="sm">{state.availability.timeZone}</Text>
                {date && (
                  <>
                    <Text size="xs" c="dimmed" mt="md">
                      Выбранная дата
                    </Text>
                    <Text size="sm">
                      {new Intl.DateTimeFormat("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${date}T12:00:00Z`))}
                    </Text>
                  </>
                )}
                <Text size="xs" c="dimmed" mt="md">
                  Время
                </Text>
                <Text size="sm">{selected ? interval(selected) : "Выберите справа"}</Text>
              </div>
            </aside>
            {step === "calendar" ? (
              <>
                <MonthCalendar
                  availability={state.availability}
                  date={date}
                  onChange={(value) => {
                    setDate(value);
                    setSelected(undefined);
                  }}
                />
                <section className="time-picker" aria-label="Выбор времени">
                  <Text fw={600}>Свободное время</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Начало и окончание встречи
                  </Text>
                  {day?.slots.length ? (
                    <fieldset className="time-slots" aria-label="Слоты">
                      {day.slots.map((slot) => (
                        <Button
                          key={slot.startsAt}
                          variant={selected?.startsAt === slot.startsAt ? "filled" : "default"}
                          aria-pressed={selected?.startsAt === slot.startsAt}
                          disabled={Boolean(state.stale)}
                          onClick={() => setSelected(slot)}
                        >
                          {interval(slot)}
                        </Button>
                      ))}
                    </fieldset>
                  ) : (
                    <Text component="output" className="empty-slots" size="sm" c="dimmed">
                      На эту дату свободных слотов нет.
                    </Text>
                  )}
                  <Button
                    fullWidth
                    mt="md"
                    disabled={!selected || Boolean(state.stale)}
                    onClick={() => setStep("form")}
                  >
                    Продолжить <span aria-hidden="true"> →</span>
                  </Button>
                </section>
              </>
            ) : null}
            {selected && (
              <div className={step === "form" ? "guest-form" : "selection-note"}>
                {step === "form" && (
                  <>
                    <Title order={2} size="h3">
                      Ваши данные
                    </Title>
                    <Text size="sm" c="dimmed" mb="lg">
                      Представьтесь, чтобы владелец знал, кого ждать.
                    </Text>
                  </>
                )}
                <Text component="output" size="sm" className="selected-summary">
                  {step === "calendar"
                    ? `Выбрано: ${state.meetingType.title}, ${date}, `
                    : `${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))} · `}
                  {interval(selected)} · {state.availability.timeZone}
                </Text>
                <Text size="xs" c="dimmed" mb="md">
                  Слот выбран, запись ещё не создана.
                </Text>
                {step === "form" ? (
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
                      placeholder="Как к вам обращаться?"
                      autoComplete="name"
                      required
                      maxLength={120}
                      value={guestName}
                      onChange={(event) => setGuestName(event.currentTarget.value)}
                      error={errors.guestName}
                      disabled={saving}
                    />
                    <TextInput
                      label="Email"
                      placeholder="you@example.com"
                      autoComplete="email"
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
                      placeholder="О чём хотите поговорить? Необязательно"
                      minRows={3}
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
                ) : null}
              </div>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
