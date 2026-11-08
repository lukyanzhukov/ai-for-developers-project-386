import {
  Alert,
  Badge,
  Button,
  Paper,
  Progress,
  Stepper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { MeetingTypes } from "./MeetingTypes.tsx";
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

export function Calendar({ id: initialId }: { id: string | null }) {
  const [id, setId] = useState(initialId);
  const [chosenId, setChosenId] = useState(initialId);
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
  const [step, setStep] = useState<"meeting" | "calendar" | "form">(
    initialId ? "calendar" : "meeting",
  );
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
    if (!id) return;
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

  const navigate = (next: "meeting" | "calendar" | "form", nextId = id) => {
    if (nextId !== id) {
      setState({ status: "loading" });
      setSelected(undefined);
      setDate("");
      setId(nextId);
    }
    setStep(next);
    setChosenId(nextId);
    setError("");
    const query = new URLSearchParams();
    if (next !== "meeting" && nextId) query.set("type", nextId);
    if (next === "form") query.set("step", "confirm");
    window.history.pushState(null, "", `/booking${query.size ? `?${query}` : ""}`);
  };
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextId = params.get("type");
      if (!nextId) {
        setStep("meeting");
        return;
      }
      if (nextId !== id) {
        setState({ status: "loading" });
        setSelected(undefined);
        setId(nextId);
      }
      setChosenId(nextId);
      setError("");
      setStep(params.get("step") === "confirm" && nextId === id && selected ? "form" : "calendar");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [id, selected]);
  const activeStep = step === "meeting" ? 0 : step === "calendar" ? 1 : 2;
  useEffect(() => {
    document.querySelector<HTMLElement>("#main-content h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step, booking]);

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
          <Title order={1} tabIndex={-1}>
            Запись подтверждена
          </Title>
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
          <Button component="a" href="/booking" fullWidth size="lg">
            Выбрать другую встречу
          </Button>
        </Stack>
      </Paper>
    );
  return (
    <Stack className="booking-wizard" gap="xl">
      <section className="wizard-progress" aria-label="Шаги записи">
        <Stepper
          active={activeStep}
          allowNextStepsSelect={false}
          size="sm"
          onStepClick={(index) => {
            if (!saving && index < activeStep) navigate(index === 0 ? "meeting" : "calendar");
          }}
        >
          <Stepper.Step label="Встреча" />
          <Stepper.Step label="Дата и время" />
          <Stepper.Step label="Подтверждение" />
        </Stepper>
        <Progress
          value={((activeStep + 1) / 3) * 100}
          aria-label="Прогресс записи"
          color="#b5a17e"
          mt="lg"
          size={4}
        />
      </section>
      {step === "meeting" ? (
        <MeetingTypes
          selectedId={chosenId}
          onSelect={setChosenId}
          onContinue={() => navigate("calendar", chosenId)}
        />
      ) : (
        <Stack className="booking-page" gap="lg">
          <div className="booking-heading">
            <Text className="eyebrow">{step === "form" ? "Ваши данные" : "Удобное время"}</Text>
            <Title order={1} tabIndex={-1}>
              {step === "form" ? "Подтвердите запись" : "Выберите дату и время"}
            </Title>
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
                      start={state.availability.windowStart}
                      end={state.availability.windowEnd}
                      markedDates={state.availability.days
                        .filter((day) => day.slots.length)
                        .map((day) => day.date)}
                      legend="Есть свободное время"
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
                              rightSection={
                                selected?.startsAt === slot.startsAt ? (
                                  <span aria-hidden="true">✓</span>
                                ) : null
                              }
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
                            meetingTypeId: state.meetingType.id,
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
                              navigate("calendar");
                              setSelected(undefined);
                              setState({ status: "error", missing: true });
                            } else if (
                              result.error &&
                              ["SLOT_TAKEN", "SLOT_EXPIRED", "SLOT_OUTSIDE_WINDOW"].includes(
                                result.error.code,
                              )
                            ) {
                              navigate("calendar");
                              setError(result.error.message);
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
                        <Button
                          type="submit"
                          disabled={saving}
                          loading={saving}
                          size="lg"
                          fullWidth
                        >
                          Подтвердить запись
                        </Button>
                        <Button
                          variant="default"
                          fullWidth
                          size="lg"
                          disabled={saving}
                          onClick={() => navigate("calendar")}
                        >
                          Назад к календарю
                        </Button>
                      </Stack>
                    ) : null}
                  </div>
                )}
                {step === "calendar" && (
                  <div className="wizard-actions">
                    <Button
                      variant="default"
                      fullWidth
                      size="lg"
                      onClick={() => navigate("meeting")}
                    >
                      Назад к встречам
                    </Button>
                    <Button
                      fullWidth
                      size="lg"
                      disabled={!selected || Boolean(state.stale)}
                      onClick={() => navigate("form")}
                    >
                      Дальше <span aria-hidden="true">→</span>
                    </Button>
                  </div>
                )}
              </Paper>
            </>
          )}
          {state.status === "error" && (
            <Button variant="default" fullWidth size="lg" onClick={() => navigate("meeting")}>
              Назад к встречам
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
