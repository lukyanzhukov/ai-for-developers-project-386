import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}
const app = await createApp();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app
      .close()
      .then(() => process.disconnect?.())
      .catch((error: unknown) => {
        app.log.error(error);
        process.exitCode = 1;
      });
  });
}

try {
  await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
  process.send?.({ address: app.listeningOrigin });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
