import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider
      theme={{
        primaryColor: "dark",
        defaultRadius: "md",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        headings: { fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
        components: {
          Button: { defaultProps: { color: "dark" } },
          TextInput: { defaultProps: { size: "md" } },
          Textarea: { defaultProps: { size: "md" } },
        },
      }}
    >
      <App pathname={window.location.pathname} />
    </MantineProvider>
  </StrictMode>,
);
