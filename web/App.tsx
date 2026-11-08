import {
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import "./app.css";
import { CreateMeetingType } from "./CreateMeetingType.tsx";
import { Calendar } from "./Calendar.tsx";
import { UpcomingBookings } from "./UpcomingBookings.tsx";
import { MeetingTypes } from "./MeetingTypes.tsx";

const steps = [
  {
    title: "Выберите тип встречи",
    description:
      "Владелец календаря задаёт название, описание и длительность каждого типа встречи.",
  },
  {
    title: "Найдите удобное время",
    description: "Откройте календарь на ближайшие 14 дней и выберите свободный слот.",
  },
  {
    title: "Подтвердите запись",
    description: "Слот займёт столько времени, сколько длится выбранный тип встречи.",
  },
];

export function App({ pathname }: { pathname: string }) {
  const meetingTypeId =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("type");
  const isUpcoming =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("view") === "bookings";
  const isBooking = pathname === "/booking";

  return (
    <Container size="lg" className="app-shell">
      <Group component="header" justify="space-between" py="xl" gap="sm">
        <Anchor href="/" c="dark" fw={700} underline="never">
          Календарь звонков
        </Anchor>
        <Anchor href="/admin">Админка</Anchor>
      </Group>

      <Box component="main" id="main-content">
        {pathname === "/admin" ? (
          <>
            <Group component="nav" aria-label="Разделы владельца">
              <Anchor href="/admin">Создать тип встречи</Anchor>
              <Anchor href="/admin?view=bookings">Предстоящие встречи</Anchor>
            </Group>
            {isUpcoming ? <UpcomingBookings /> : <CreateMeetingType />}
          </>
        ) : isBooking ? (
          <>
            {meetingTypeId !== null ? <Calendar id={meetingTypeId} /> : <MeetingTypes />}
            <Button component="a" href="/" color="teal" mb="xl">
              На главную
            </Button>
          </>
        ) : (
          <>
            <Stack className="hero" align="flex-start" gap="lg">
              <Badge variant="light" color="teal" size="lg">
                Без регистрации
              </Badge>
              <Title order={1} className="hero-title">
                Меньше переписки.
                <br />
                Больше времени на встречу.
              </Title>
              <Text size="lg" c="dimmed" maw={610}>
                Календарь звонков — сервис записи на встречи с одним владельцем календаря. Выберите
                подходящий тип встречи, удобное время и подтвердите запись.
              </Text>
              <Button component="a" href="/booking" color="teal" size="lg" radius="md">
                Записаться
              </Button>
              <Text size="sm" c="dimmed">
                Выберите тип встречи и время, затем подтвердите запись.
              </Text>
            </Stack>

            <Stack component="section" aria-labelledby="steps-title" gap="xl" pb="xl">
              <Title order={2} id="steps-title" size="h3">
                От выбора до встречи — три шага
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                {steps.map((step, index) => (
                  <Paper key={step.title} p="xl" radius="lg" withBorder>
                    <Stack gap="md">
                      <ThemeIcon color="teal" variant="light" size={40} radius="md">
                        {index + 1}
                      </ThemeIcon>
                      <Title order={3} size="h4">
                        {step.title}
                      </Title>
                      <Text c="dimmed" size="sm">
                        {step.description}
                      </Text>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
              <Text c="dimmed" size="sm" maw={760}>
                Занятость общая для всех типов встреч: одно и то же время нельзя занять дважды, даже
                частично. Владелец календаря видит предстоящие встречи всех типов в одном списке.
              </Text>
            </Stack>
          </>
        )}
      </Box>

      <Box component="footer" className="footer" py="lg">
        <Text size="sm" c="dimmed">
          Календарь звонков · Один календарь, удобное время для каждого
        </Text>
      </Box>
    </Container>
  );
}
