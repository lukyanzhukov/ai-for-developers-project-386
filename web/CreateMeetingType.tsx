import {
  Alert,
  Anchor,
  Button,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { createMeetingType, listMeetingTypes } from "../generated/api/sdk.gen.ts";
import type { MeetingType } from "../generated/api/types.gen.ts";

export function CreateMeetingType() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [id, setId] = useState("");
  const [duration, setDuration] = useState("30");
  const [minutes, setMinutes] = useState("30");
  const [items, setItems] = useState<MeetingType[]>([]);
  const [listError, setListError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [created, setCreated] = useState<MeetingType>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void listMeetingTypes({
      throwOnError: true,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setListError(true);
      });
    return () => controller.abort();
  }, []);
  const matches = items.filter(
    (item) => item.title.trim().toLowerCase() === title.trim().toLowerCase(),
  );
  if (created)
    return (
      <Stack className="hero" gap="lg">
        <Title order={1}>Тип встречи создан</Title>
        <Text style={{ overflowWrap: "anywhere" }}>
          {created.title} — {created.durationMinutes} мин
        </Text>
        <Anchor href={`/booking#meeting-type-${created.id}`}>
          Открыть созданный тип в публичном списке
        </Anchor>
      </Stack>
    );
  return (
    <Stack className="hero" gap="lg" maw={650}>
      <Title order={1}>Новый тип встречи</Title>
      <Text>Один владелец календаря. Вход не требуется.</Text>
      {listError && (
        <Alert color="yellow">Не удалось проверить совпадения названий. Создание доступно.</Alert>
      )}
      <Stack
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setErrors({});
          setError("");
          try {
            const result = await createMeetingType({
              body: {
                title,
                description,
                durationMinutes: Number(duration === "custom" ? minutes : duration),
                ...(id.trim() ? { id } : {}),
              },
              signal: AbortSignal.timeout(10000),
            });
            if (result.data) {
              setCreated(result.data);
            } else if (result.error?.code === "ID_ALREADY_EXISTS") {
              setErrors({ id: result.error.message });
            } else if (result.error?.code === "VALIDATION_ERROR") {
              setErrors(
                Object.fromEntries(
                  (result.error.fields ?? []).map((field) => [field.field, field.message]),
                ),
              );
              setError(result.error.message);
            } else setError("Не удалось создать тип встречи. Попробуйте ещё раз.");
          } catch {
            setError("Не удалось создать тип встречи. Попробуйте ещё раз.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <TextInput
          label="Название"
          required
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          error={errors.title}
        />
        {matches.length > 0 && (
          <Alert color="yellow" component="output">
            <Stack gap="xs">
              <Text>Тип встречи с таким названием уже существует</Text>
              {matches.map((item) => (
                <Stack key={item.id} gap={0}>
                  <Anchor
                    href={`/booking#meeting-type-${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.title} — {item.durationMinutes} мин
                  </Anchor>
                  <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {item.description}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Alert>
        )}
        <Textarea
          label="Описание"
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          error={errors.description}
        />
        <NativeSelect
          label="Длительность"
          value={duration}
          onChange={(event) => setDuration(event.currentTarget.value)}
          data={[
            ...[15, 30, 45, 60, 90, 120].map((value) => ({
              value: String(value),
              label: `${value} мин`,
            })),
            { value: "custom", label: "Другая длительность" },
          ]}
          error={errors.durationMinutes}
        />
        {duration === "custom" && (
          <TextInput
            label="Минуты"
            type="number"
            required
            min={1}
            max={1440}
            step={1}
            value={minutes}
            onChange={(event) => setMinutes(event.currentTarget.value)}
            error={errors.durationMinutes}
          />
        )}
        <TextInput
          label="ID"
          description="Необязательно. Оставьте пустым — система назначит ID автоматически"
          value={id}
          onChange={(event) => setId(event.currentTarget.value)}
          error={errors.id}
        />
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Button type="submit" loading={saving} color="teal">
          Создать тип встречи
        </Button>
      </Stack>
      <Anchor href="/booking">Публичный список типов встреч</Anchor>
    </Stack>
  );
}
