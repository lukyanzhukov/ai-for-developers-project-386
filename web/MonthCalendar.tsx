import { ActionIcon, Group, Text } from "@mantine/core";
import { useState } from "react";

export function MonthCalendar({
  start,
  end,
  markedDates,
  legend,
  date,
  onChange,
}: {
  start: string;
  end: string;
  markedDates: string[];
  legend: string;
  date: string;
  onChange: (date: string) => void;
}) {
  const firstMonth = start.slice(0, 7);
  const lastMonth = end.slice(0, 7);
  const [viewedMonth, setViewedMonth] = useState(date.slice(0, 7));
  const month = viewedMonth < firstMonth || viewedMonth > lastMonth ? firstMonth : viewedMonth;
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const move = (delta: number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setViewedMonth(next.toISOString().slice(0, 7));
  };
  return (
    <section className="month-calendar" aria-label="Календарь">
      <Group justify="space-between" wrap="nowrap" mb="lg">
        <Text fw={600} className="month-label" aria-live="polite">
          {monthLabel}
        </Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label="Предыдущий месяц"
            disabled={month <= firstMonth}
            onClick={() => move(-1)}
          >
            ‹
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label="Следующий месяц"
            disabled={month >= lastMonth}
            onClick={() => move(1)}
          >
            ›
          </ActionIcon>
        </Group>
      </Group>
      <fieldset className="month-grid" aria-label="Даты">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((weekday) => (
          <span className="weekday" key={weekday}>
            {weekday}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, index) => {
          const current = new Date(first);
          current.setUTCDate(index - offset + 1);
          const iso = current.toISOString().slice(0, 10);
          const inMonth = iso.slice(0, 7) === month;
          return (
            <button
              type="button"
              key={iso}
              className="calendar-day"
              aria-label={iso}
              aria-pressed={date === iso}
              disabled={!inMonth || iso < start || iso > end}
              data-outside={!inMonth || undefined}
              data-available={markedDates.includes(iso) || undefined}
              onClick={() => onChange(iso)}
            >
              {current.getUTCDate()}
              <span className="day-dot" aria-hidden="true" />
            </button>
          );
        })}
      </fieldset>
      <Text size="xs" c="dimmed" mt="lg">
        <span className="availability-dot" /> {legend}
      </Text>
    </section>
  );
}
