import {
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import "./app.css";
import { CreateMeetingType } from "./CreateMeetingType.tsx";
import { Calendar } from "./Calendar.tsx";
import { UpcomingBookings } from "./UpcomingBookings.tsx";
import { UpcomingBookingsPrototype } from "./UpcomingBookings.prototype.tsx";

export function App({ pathname }: { pathname: string }) {
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const meetingTypeId = params.get("type");
  const isUpcoming = params.get("view") === "bookings";
  const isAdmin = pathname === "/admin";
  const isBooking = pathname === "/booking";
  return (
    <Container size={1180} className="app-shell">
      <Group component="header" className="site-header" justify="space-between" gap="sm">
        <Anchor
          href="/"
          className="brand"
          underline="never"
          aria-label="Календарь звонков — на главную"
        >
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>{" "}
          Календарь
        </Anchor>
        <Group component="nav" aria-label="Основная навигация" gap={6}>
          <Anchor href="/booking" className="nav-link" data-active={isBooking || undefined}>
            Записаться
          </Anchor>
          <Anchor href="/admin" className="nav-link" data-active={isAdmin || undefined}>
            Админка
          </Anchor>
        </Group>
      </Group>
      <Box component="main" id="main-content">
        {isAdmin ? (
          <div className="admin-layout">
            <aside className="admin-sidebar">
              <Text className="eyebrow">Ваш календарь</Text>
              <Title order={1} size="h3">
                Управление
              </Title>
              <nav aria-label="Разделы владельца" className="admin-nav">
                <Anchor href="/admin" data-active={!isUpcoming || undefined}>
                  Новая встреча <span aria-hidden="true">＋</span>
                </Anchor>
                <Anchor href="/admin?view=bookings" data-active={isUpcoming || undefined}>
                  Предстоящие встречи
                </Anchor>
              </nav>
              <div className="sidebar-note">
                <Text size="sm" fw={600}>
                  Готовы пригласить гостей?
                </Text>
                <Text size="sm" c="dimmed">
                  Откройте страницу записи и поделитесь ссылкой.
                </Text>
                <Anchor href="/booking" target="_blank" rel="noopener noreferrer">
                  Страница записи ↗
                </Anchor>
              </div>
            </aside>
            <div className="admin-content">
              {isUpcoming ? (
                import.meta.env.DEV && params.has("prototype") ? (
                  <UpcomingBookingsPrototype />
                ) : (
                  <UpcomingBookings />
                )
              ) : (
                <CreateMeetingType />
              )}
            </div>
          </div>
        ) : isBooking ? (
          <Calendar id={meetingTypeId} />
        ) : (
          <>
            <section className="home-hero">
              <Stack gap={24} align="flex-start" className="home-copy">
                <Badge variant="light" color="orange" radius="sm">
                  Без регистрации
                </Badge>
                <Title order={1} className="hero-title">
                  Меньше переписки.
                  <br />
                  <span>
                    Больше времени
                    <br />
                    на встречу.
                  </span>
                </Title>
                <Text className="hero-description">
                  Хороший разговор начинается с удобного времени. Выберите встречу, найдите
                  свободное окно — и приходите знакомиться.
                </Text>
                <Button
                  component="a"
                  href="/booking"
                  size="lg"
                  rightSection={<span aria-hidden="true">↗</span>}
                >
                  Записаться
                </Button>
                <Text size="sm" c="dimmed">
                  Пара минут на запись. Никаких аккаунтов.
                </Text>
              </Stack>
              <div className="home-preview">
                <div className="preview-label">
                  <span className="availability-dot" /> Ваше время — в порядке
                </div>
                <Paper className="preview-card" p={28} radius="lg" withBorder>
                  <div className="owner-avatar" aria-hidden="true">
                    К
                  </div>
                  <Text size="sm" c="dimmed" mt="md">
                    Календарь звонков
                  </Text>
                  <Title order={2} size="h3" mt={6}>
                    Давайте встретимся
                  </Title>
                  <Text size="sm" c="dimmed" mt={8}>
                    Вы выбираете время. Мы сохраняем его за вами.
                  </Text>
                  <div className="preview-meeting">
                    <div>
                      <Text fw={600}>Знакомство</Text>
                      <Text size="sm" c="dimmed">
                        30 минут · Один на один
                      </Text>
                    </div>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <div className="preview-dates" aria-hidden="true">
                    {["Пн", "Вт", "Ср", "Чт", "Пт"].map((day, index) => (
                      <div key={day} data-selected={index === 2 || undefined}>
                        <small>{day}</small>
                        <strong>{12 + index}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="preview-time">
                    <span aria-hidden="true">✓</span>
                    <Text size="sm">Удобное время найдётся</Text>
                  </div>
                </Paper>
                <Text className="preview-caption">Одна ссылка вместо долгой переписки.</Text>
              </div>
            </section>
            <section className="home-steps" aria-label="Как записаться">
              {[
                [
                  "01",
                  "Выберите встречу",
                  "Знакомство, консультация или разговор по делу — решайте вы.",
                ],
                ["02", "Назначьте время", "В календаре на ближайшие 14 дней видны свободные окна."],
                [
                  "03",
                  "Приходите на встречу",
                  "Оставьте имя и email. После подтверждения время будет за вами.",
                ],
              ].map(([number, title, description]) => (
                <div key={number}>
                  <Text className="step-number">{number}</Text>
                  <Title order={2} size="h4">
                    {title}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {description}
                  </Text>
                </div>
              ))}
            </section>
          </>
        )}
      </Box>
      <Box component="footer" className="footer">
        <Text size="xs" c="dimmed">
          Календарь звонков
        </Text>
      </Box>
    </Container>
  );
}
