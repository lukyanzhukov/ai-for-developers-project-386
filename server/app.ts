import Fastify, { type FastifyError } from "fastify";
import { randomUUID } from "node:crypto";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import type { RouteHandlers } from "../generated/api/fastify.gen.ts";
import { HealthSchema } from "../generated/api/schemas.gen.ts";
import * as schemas from "../generated/api/schemas.gen.ts";
import type { Availability, Booking, MeetingType } from "../generated/api/types.gen.ts";

const timeZone = "Asia/Novokuznetsk";
const windowDays = 14;
const slotStep = 15 * 60000;
const dateOffset = (date: string, offset: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};
const dayBounds = (date: string) => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return {
    working: weekday !== 0 && weekday !== 6,
    opening: Date.parse(`${date}T09:00:00+07:00`),
    closing: Date.parse(`${date}T18:00:00+07:00`),
  };
};
const ownerDate = (instant: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
const overlaps = (bookings: Booking[], start: number, end: number) =>
  bookings.some(
    (booking) => start < Date.parse(booking.endsAt) && end > Date.parse(booking.startsAt),
  );

export async function createApp({
  meetingTypes = [],
  bookings = [],
  now = () => new Date(),
}: { meetingTypes?: MeetingType[]; bookings?: Booking[]; now?: () => Date } = {}) {
  const keys = new Map<string, { fingerprint: string; booking?: Booking }>();
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
          ? [
              {
                field: field === "idempotency-key" ? "Idempotency-Key" : String(field),
                message: violation.message ?? "Недопустимое значение",
              },
            ]
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
    | "getHealth"
    | "listMeetingTypes"
    | "createMeetingType"
    | "getAvailability"
    | "createBooking"
    | "listBookings"
  > = {
    listBookings: async (_request, reply) => {
      const serverNow = now();
      return reply.code(200).send({
        serverNow: serverNow.toISOString(),
        timeZone,
        items: bookings
          .filter((item) => Date.parse(item.endsAt) > serverNow.getTime())
          .sort(
            (a, b) =>
              Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
          ),
      });
    },
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
    createBooking: async (request, reply) => {
      const { meetingTypeId, startsAt, guestName, guestEmail, note = "" } = request.body;
      const start = Date.parse(startsAt);
      if (!Number.isFinite(start))
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Недопустимое время",
          fields: [{ field: "startsAt", message: "Укажите корректное время UTC" }],
        });
      const key = String(request.headers["idempotency-key"]);
      const fingerprint = JSON.stringify([meetingTypeId, startsAt, guestName, guestEmail, note]);
      const previous = keys.get(key);
      if (previous && previous.fingerprint !== fingerprint)
        return reply.code(409).send({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Данные изменились. Отправьте запись с новым ключом",
        });
      if (previous?.booking) return reply.code(200).send(previous.booking);
      const entry = previous ?? { fingerprint };
      keys.set(key, entry);
      const meetingType = meetingTypes.find((item) => item.id === meetingTypeId);
      if (!meetingType)
        return reply
          .code(404)
          .send({ code: "MEETING_TYPE_NOT_FOUND", message: "Тип встречи не найден" });
      const serverNow = now();
      const end = start + meetingType.durationMinutes * 60000;
      const date = ownerDate(new Date(start));
      const today = ownerDate(serverNow);
      const lastDay = dateOffset(today, windowDays - 1);
      if (start <= serverNow.getTime())
        return reply.code(409).send({
          code: "SLOT_EXPIRED",
          message: "Выбранное время уже прошло. Выберите другой слот",
        });
      if (date < today || date > lastDay)
        return reply.code(409).send({
          code: "SLOT_OUTSIDE_WINDOW",
          message: "Выбранная дата вне окна записи. Выберите другой слот",
        });
      const { working, opening, closing } = dayBounds(date);
      // Date truncates sub-millisecond precision, so inspect the original seconds as well.
      const zeroSeconds = /:00(?:\.0+)?Z$/.test(startsAt);
      if (
        !working ||
        start < opening ||
        end > closing ||
        (start - opening) % slotStep !== 0 ||
        !zeroSeconds
      )
        return reply.code(400).send({
          code: "INVALID_SLOT",
          message: "Слот должен соответствовать рабочим часам и шагу 15 минут",
        });
      if (overlaps(bookings, start, end))
        return reply
          .code(409)
          .send({ code: "SLOT_TAKEN", message: "Это время уже заняли. Выберите другой слот" });
      const booking: Booking = {
        id: randomUUID(),
        meetingTypeId,
        meetingTypeTitle: meetingType.title,
        durationMinutes: meetingType.durationMinutes,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        guestName,
        guestEmail,
        note,
        createdAt: serverNow.toISOString(),
      };
      // The shared overlap check and both writes stay synchronous in this single process.
      bookings.push(booking);
      entry.booking = booking;
      return reply.code(201).send(booking);
    },
    getAvailability: async (request, reply) => {
      const meetingType = meetingTypes.find((item) => item.id === request.params.id);
      if (!meetingType)
        return reply
          .code(404)
          .send({ code: "MEETING_TYPE_NOT_FOUND", message: "Тип встречи не найден" });
      const serverNow = now();
      const today = ownerDate(serverNow);
      const days: Availability["days"][number][] = [];
      for (let offset = 0; offset < windowDays; offset++) {
        const date = dateOffset(today, offset);
        const { working, opening, closing } = dayBounds(date);
        const slots: Availability["days"][number]["slots"] = [];
        if (working) {
          for (
            let start = opening;
            start + meetingType.durationMinutes * 60000 <= closing;
            start += slotStep
          ) {
            const end = start + meetingType.durationMinutes * 60000;
            if (start > serverNow.getTime() && !overlaps(bookings, start, end)) {
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
        windowEnd: days[windowDays - 1].date,
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

  app.get(
    "/api/bookings",
    { schema: { response: { 200: { $ref: "contract#/components/schemas/BookingList" } } } },
    handlers.listBookings,
  );

  app.post<{
    Body: import("../generated/api/types.gen.ts").CreateBooking;
    Headers: { "Idempotency-Key": string };
  }>(
    "/api/bookings",
    {
      preValidation: async (request) => {
        if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
          for (const field of ["guestName", "guestEmail"] as const) {
            if (typeof request.body[field] === "string")
              request.body[field] = request.body[field].trim();
          }
        }
      },
      schema: {
        body: { $ref: "contract#/components/schemas/CreateBooking" },
        headers: {
          type: "object",
          required: ["idempotency-key"],
          properties: { "idempotency-key": schemas.UuidSchema },
        },
        response: {
          200: { $ref: "contract#/components/schemas/Booking" },
          201: { $ref: "contract#/components/schemas/Booking" },
        },
      },
    },
    handlers.createBooking,
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
