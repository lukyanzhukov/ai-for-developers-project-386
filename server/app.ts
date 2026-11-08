import Fastify, { type FastifyError } from "fastify";
import { randomUUID } from "node:crypto";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import type { RouteHandlers } from "../generated/api/fastify.gen.ts";
import { HealthSchema } from "../generated/api/schemas.gen.ts";
import * as schemas from "../generated/api/schemas.gen.ts";
import type { MeetingType } from "../generated/api/types.gen.ts";

export async function createApp({ meetingTypes = [] }: { meetingTypes?: MeetingType[] } = {}) {
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { coerceTypes: false, keywords: ["components"] } },
  });
  app.addSchema({
    $id: "contract",
    components: {
      schemas: Object.fromEntries(
        Object.entries(schemas).map(([name, schema]) => [name.replace(/Schema$/, ""), schema]),
      ),
    },
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (
      error.validation ||
      error.code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
      error.code === "FST_ERR_CTP_EMPTY_JSON_BODY"
    ) {
      const fields = error.validation?.flatMap((violation) => {
        const field = violation.instancePath.split("/")[1] || violation.params.missingProperty;
        return field
          ? [{ field: String(field), message: violation.message ?? "Недопустимое значение" }]
          : [];
      });
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Проверьте введённые значения",
        ...(fields?.length ? { fields } : {}),
      });
    }
    request.log.error(error);
    return reply.code(500).send({ code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });
  const handlers: Pick<RouteHandlers, "getHealth" | "listMeetingTypes" | "createMeetingType"> = {
    listMeetingTypes: async (_request, reply) =>
      reply.code(200).send({
        items: meetingTypes.toSorted(
          (a, b) =>
            Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        ),
      }),
    createMeetingType: async (request, reply) => {
      const { title, description = "", durationMinutes } = request.body;
      let id = request.body.id;
      if (id === undefined) {
        do {
          id = randomUUID();
        } while (meetingTypes.some((item) => item.id === id));
      }
      if (meetingTypes.some((item) => item.id === id)) {
        return reply.code(409).send({
          code: "ID_ALREADY_EXISTS",
          message: "Этот ID уже занят. Укажите другой или оставьте поле пустым",
        });
      }
      const item = { id, title, description, durationMinutes, createdAt: new Date().toISOString() };
      meetingTypes.push(item);
      return reply.code(201).send(item);
    },
    getHealth: async (_request, reply) => reply.code(200).send({ status: "ok" }),
  };

  // shortcut: Hey API 0.99 generates handler types only; revisit registration when it emits routes.
  app.get("/api/health", { schema: { response: { 200: HealthSchema } } }, handlers.getHealth);

  app.get(
    "/api/meeting-types",
    {
      schema: {
        response: {
          200: { $ref: "contract#/components/schemas/MeetingTypeList" },
        },
      },
    },
    handlers.listMeetingTypes,
  );

  app.post<{ Body: import("../generated/api/types.gen.ts").CreateMeetingType }>(
    "/api/meeting-types",
    {
      preValidation: async (request) => {
        if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
          for (const field of ["id", "title"] as const) {
            if (typeof request.body[field] === "string")
              request.body[field] = request.body[field].trim();
          }
        }
      },
      schema: {
        body: { $ref: "contract#/components/schemas/CreateMeetingType" },
        response: {
          400: { $ref: "contract#/components/schemas/ValidationError" },
          201: { $ref: "contract#/components/schemas/MeetingType" },
        },
      },
    },
    handlers.createMeetingType,
  );

  if (process.env.NODE_ENV === "production") {
    await app.register(fastifyStatic, {
      root: fileURLToPath(new URL("../web/", import.meta.url)),
    });
    for (const path of ["/booking", "/admin"])
      app.get(path, (_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
