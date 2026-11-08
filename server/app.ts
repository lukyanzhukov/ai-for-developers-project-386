import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import type { RouteHandlers } from "../generated/api/fastify.gen.ts";
import { HealthSchema, MeetingTypeListSchema } from "../generated/api/schemas.gen.ts";
import * as schemas from "../generated/api/schemas.gen.ts";
import type { MeetingType } from "../generated/api/types.gen.ts";

export async function createApp({ meetingTypes = [] }: { meetingTypes?: MeetingType[] } = {}) {
  const app = Fastify({ logger: true });
  const handlers: Pick<RouteHandlers, "getHealth" | "listMeetingTypes"> = {
    listMeetingTypes: async (_request, reply) =>
      reply.code(200).send({
        items: meetingTypes.toSorted(
          (a, b) =>
            Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        ),
      }),
    getHealth: async (_request, reply) => reply.code(200).send({ status: "ok" }),
  };

  // shortcut: Hey API 0.99 generates handler types only; revisit registration when it emits routes.
  app.get("/api/health", { schema: { response: { 200: HealthSchema } } }, handlers.getHealth);

  app.get(
    "/api/meeting-types",
    {
      schema: {
        response: {
          200: {
            ...MeetingTypeListSchema,
            // Generated references need the OpenAPI components root during serialization.
            components: {
              schemas: Object.fromEntries(
                Object.entries(schemas).map(([name, schema]) => [
                  name.replace(/Schema$/, ""),
                  schema,
                ]),
              ),
            },
          },
        },
      },
    },
    handlers.listMeetingTypes,
  );

  if (process.env.NODE_ENV === "production") {
    await app.register(fastifyStatic, {
      root: fileURLToPath(new URL("../web/", import.meta.url)),
    });
    app.get("/booking", (_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
