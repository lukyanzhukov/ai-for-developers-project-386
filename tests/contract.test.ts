import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  createBooking,
  createMeetingType,
  getAvailability,
  listBookings,
  listMeetingTypes,
} from "../generated/api/sdk.gen.ts";

test("OpenAPI preserves input constraints, statuses and idempotency header", () => {
  const api = JSON.parse(readFileSync("generated/openapi/openapi.json", "utf8"));
  const schemas = api.components.schemas;

  expect(Object.keys(api.paths).sort()).toEqual([
    "/api/bookings",
    "/api/health",
    "/api/meeting-types",
    "/api/meeting-types/{id}/availability",
  ]);
  expect(schemas.CreateMeetingType.required).toEqual(["title", "durationMinutes"]);
  expect(schemas.MeetingTypeId).toMatchObject({ minLength: 1, maxLength: 64 });
  const idPattern = new RegExp(schemas.MeetingTypeId.pattern);
  expect(idPattern.test("intro-30")).toBe(true);
  for (const invalid of ["", "Intro", "знакомство", "intro_30", "-intro", "intro-"]) {
    expect(idPattern.test(invalid)).toBe(false);
  }
  expect(schemas.Name).toMatchObject({ minLength: 1, maxLength: 120 });
  expect(schemas.Note.maxLength).toBe(2000);
  expect(schemas.GuestEmail).toMatchObject({ format: "email", maxLength: 254 });
  expect(schemas.DurationMinutes).toMatchObject({ type: "integer", minimum: 1, maximum: 1440 });
  expect(schemas.UtcInstant).toMatchObject({ format: "date-time", pattern: "Z$" });
  expect(schemas.Availability.properties.days).toMatchObject({ minItems: 14, maxItems: 14 });
  expect(api.paths["/api/bookings"].post.parameters).toContainEqual(
    expect.objectContaining({ in: "header", name: "Idempotency-Key", required: true }),
  );
  expect(Object.keys(api.paths["/api/bookings"].post.responses).sort()).toEqual([
    "200",
    "201",
    "400",
    "404",
    "409",
    "500",
  ]);
  expect(Object.keys(api.paths["/api/meeting-types"].post.responses).sort()).toEqual([
    "201",
    "400",
    "409",
    "500",
  ]);
});

test("generated SDK serializes all booking operations and returns typed success or conflict", async () => {
  const requests: Request[] = [];
  const options = {
    baseUrl: "https://contract.example",
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Promise.resolve(Response.json({ items: [] }));
    },
  };
  const typeInput = { title: "Знакомство", durationMinutes: 17 };
  const bookingInput = {
    meetingTypeId: "intro-30",
    startsAt: "2026-11-10T02:00:00Z",
    guestName: "Гость",
    guestEmail: "guest@example.com",
  };
  const key = "bd0cf33d-d025-41be-8de6-53f0e94df419";

  const list = await listMeetingTypes(options);
  expect(list.data).toEqual({ items: [] });
  await createMeetingType({ ...options, body: typeInput });
  await getAvailability({ ...options, path: { id: "intro-30" } });
  await createBooking({ ...options, headers: { "Idempotency-Key": key }, body: bookingInput });
  await listBookings(options);

  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["GET", "/api/meeting-types"],
    ["POST", "/api/meeting-types"],
    ["GET", "/api/meeting-types/intro-30/availability"],
    ["POST", "/api/bookings"],
    ["GET", "/api/bookings"],
  ]);
  expect(await requests[1]!.json()).toEqual(typeInput);
  expect(requests[1]!.headers.get("Content-Type")).toBe("application/json");
  expect(requests[3]!.headers.get("Idempotency-Key")).toBe(key);
  expect(await requests[3]!.json()).toEqual(bookingInput);

  const booking = {
    ...bookingInput,
    id: key,
    meetingTypeTitle: "Знакомство",
    durationMinutes: 17,
    endsAt: "2026-11-10T02:17:00Z",
    note: "",
    createdAt: "2026-11-09T02:00:00Z",
  };
  for (const status of [201, 200]) {
    const result = await createBooking({
      ...options,
      headers: { "Idempotency-Key": key },
      body: bookingInput,
      fetch: () => Promise.resolve(Response.json(booking, { status })),
    });
    expect(result.response?.status).toBe(status);
    expect(result.data).toEqual(booking);
  }
  const error = { code: "SLOT_TAKEN", message: "Это время уже занято. Выберите другой слот" };
  const conflict = await createBooking({
    ...options,
    headers: { "Idempotency-Key": key },
    body: bookingInput,
    fetch: () => Promise.resolve(Response.json(error, { status: 409 })),
  });
  expect(conflict.response?.status).toBe(409);
  expect(conflict.error).toEqual(error);
});
