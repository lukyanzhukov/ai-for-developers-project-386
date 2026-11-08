import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import type { RouteHandlers } from "../generated/api/fastify.gen.ts";
import { HealthSchema } from "../generated/api/schemas.gen.ts";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}
const app = Fastify({ logger: true });
const handlers: Pick<RouteHandlers, "getHealth"> = {
  getHealth: async (_request, reply) => reply.code(200).send({ status: "ok" }),
};

// shortcut: Hey API 0.99 generates handler types only; revisit registration when it emits routes.
app.get("/api/health", { schema: { response: { 200: HealthSchema } } }, handlers.getHealth);

if (process.env.NODE_ENV === "production") {
  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL("../web/", import.meta.url)),
  });
  app.get("/booking", (_request, reply) => reply.sendFile("index.html"));
}

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
