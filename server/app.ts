import Fastify, { type FastifyError } from "fastify";
import { randomUUID } from "node:crypto";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import type { RouteHandlers } from "../generated/api/fastify.gen.ts";
import { HealthSchema } from "../generated/api/schemas.gen.ts";
import * as schemas from "../generated/api/schemas.gen.ts";
import type { Availability, Booking, MeetingType } from "../generated/api/types.gen.ts";

export async function createApp({
  meetingTypes = [],
  bookings = [],
  now = () => new Date(),
}: { meetingTypes?: MeetingType[]; bookings?: Booking[]; now?: () => Date } = {}) {
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
  const handlers: Pick<
    RouteHandlers,
    "getHealth" | "listMeetingTypes" | "createMeetingType" | "getAvailability"
  > = {
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
      const item = { id, title, description, durationMinutes, createdAt: now().toISOString() };
      meetingTypes.push(item);
      return reply.code(201).send(item);
    },
    getAvailability: async (request, reply) => {
      const meetingType = meetingTypes.find((item) => item.id === request.params.id);
      if (!meetingType)
        return reply
          .code(404)
          .send({ code: "MEETING_TYPE_NOT_FOUND", message: "Тип встречи не найден" });
      const serverNow = now();
      const timeZone = "Asia/Novokuznetsk";
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(serverNow);
      const days: Availability["days"][number][] = [];
      for (let offset = 0; offset < 14; offset++) {
        const day = new Date(`${today}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() + offset);
        const date = day.toISOString().slice(0, 10);
        const slots: Availability["days"][number]["slots"] = [];
        if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
          const opening = Date.parse(`${date}T09:00:00+07:00`);
          const closing = Date.parse(`${date}T18:00:00+07:00`);
          for (
            let start = opening;
            start + meetingType.durationMinutes * 60000 <= closing;
            start += 15 * 60000
          ) {
            const end = start + meetingType.durationMinutes * 60000;
            if (
              start > serverNow.getTime() &&
              !bookings.some(
                (booking) =>
                  start < Date.parse(booking.endsAt) && end > Date.parse(booking.startsAt),
              )
            ) {
              slots.push({
                startsAt: new Date(start).toISOString(),
                endsAt: new Date(end).toISOString(),
              });
            }
          }
        }
        days.push({ date, slots });
      }
      return reply.code(200).send({
        serverNow: serverNow.toISOString(),
        timeZone,
        windowStart: days[0].date,
        windowEnd: days[13].date,
        days: days as Availability["days"],
      });
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

  app.get<{ Params: { id: string } }>(
    "/api/meeting-types/:id/availability",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { $ref: "contract#/components/schemas/MeetingTypeId" } },
        },
        response: { 200: { $ref: "contract#/components/schemas/Availability" } },
      },
    },
    handlers.getAvailability,
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
