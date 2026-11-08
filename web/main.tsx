import "@mantine/core/styles.css";
import { Alert, Container, MantineProvider, Stack, Text, Title } from "@mantine/core";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getHealth } from "../generated/api/sdk.gen.ts";

function App() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal, throwOnError: true })
      .then(({ data }) => setStatus(data.status))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <Container size="sm" py="xl">
      <Stack>
        <Title>Календарь звонков</Title>
        <Text>Основа приложения готова. Запись на встречи появится позже.</Text>
        <Alert color={status === "error" ? "red" : "blue"} component="output" aria-live="polite">
          {status === "loading" && "Проверяем подключение…"}
          {status === "ok" && "Сервер доступен"}
          {status === "error" && "Не удалось подключиться к серверу"}
        </Alert>
      </Stack>
    </Container>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider>
      <App />
    </MantineProvider>
  </StrictMode>,
);
