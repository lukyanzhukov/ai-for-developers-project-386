import { createApp } from "../dist/server/app.js";

const app = await createApp({ meetingTypes: JSON.parse(process.env.MEETING_TYPES ?? "[]") });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => app.close().then(() => process.disconnect?.()));
}
await app.listen({ port: 0, host: "127.0.0.1" });
process.send({ address: app.listeningOrigin });
