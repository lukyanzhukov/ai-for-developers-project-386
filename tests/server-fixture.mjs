import { createApp } from "../dist/server/app.js";

const options = JSON.parse(process.env.SERVER_OPTIONS ?? "{}");
const app = await createApp({
  meetingTypes: JSON.parse(process.env.MEETING_TYPES ?? "[]"),
  bookings: options.bookings,
  ...(options.now
    ? { now: () => new Date(options.now.length > 1 ? options.now.shift() : options.now[0]) }
    : {}),
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => app.close().then(() => process.disconnect?.()));
}
await app.listen({ port: 0, host: "127.0.0.1" });
process.send({ address: app.listeningOrigin });
