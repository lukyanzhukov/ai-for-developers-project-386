import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { createBooking, getAvailability } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";

const type = {
  id: "intro",
  title: "Знакомство",
  description: "",
  durationMinutes: 60,
  createdAt: "2026-11-01T00:00:00Z",
};
const body = {
  meetingTypeId: "intro",
  startsAt: "2026-11-09T03:00:00Z",
  guestName: " Гость ",
  guestEmail: " guest@example.com ",
};
const book = (address: string, payload = body, key = randomUUID()) =>
  createBooking({
    baseUrl: address,
    body: payload,
    headers: { "Idempotency-Key": key },
    signal: AbortSignal.timeout(3000),
  });

test("concurrent identical confirmations create one booking and replay it even after time passes", async () => {
  const server = await startServer([type], {
    now: ["2026-11-08T17:00:00Z", "2026-11-10T17:00:00Z"],
  });
  try {
    const key = randomUUID();
    const results = await Promise.all([
      book(server.address, body, key),
      book(server.address, body, key),
    ]);
    expect(results.map((r) => r.response!.status).sort()).toEqual([200, 201]);
    expect(results[0].data).toEqual(results[1].data);
    const later = await getAvailability({
      baseUrl: server.address,
      path: { id: "intro" },
      signal: AbortSignal.timeout(3000),
    });
    expect(later.data!.serverNow).toBe("2026-11-10T17:00:00.000Z");
    const replay = await book(server.address, body, key);
    expect(replay.response!.status).toBe(200);
    expect(replay.data).toEqual(results[0].data);
    expect(results[0].data).toMatchObject({
      guestName: "Гость",
      guestEmail: "guest@example.com",
      note: "",
      startsAt: "2026-11-09T03:00:00.000Z",
      endsAt: "2026-11-09T04:00:00.000Z",
      durationMinutes: 60,
    });
    const changed = await book(server.address, { ...body, guestName: "Другой" }, key);
    expect(changed.response!.status).toBe(409);
    expect(changed.error).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  } finally {
    await server.close();
  }
});

test("simultaneous cross-type partial overlaps have one winner; adjacency stays available", async () => {
  const server = await startServer([type, { ...type, id: "short", durationMinutes: 30 }], {
    now: ["2026-11-08T17:00:00Z"],
  });
  try {
    const results = await Promise.all([
      book(server.address),
      book(server.address, { ...body, meetingTypeId: "short", startsAt: "2026-11-09T03:30:00Z" }),
    ]);
    expect(results.map((r) => r.response!.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.error)?.error).toMatchObject({ code: "SLOT_TAKEN" });
    const confirmed = results.find((r) => r.data)!.data!;
    for (const id of ["intro", "short"]) {
      const available = await getAvailability({
        baseUrl: server.address,
        path: { id },
        signal: AbortSignal.timeout(3000),
      });
      expect(
        available.data!.days[0].slots.some(
          (slot) => slot.startsAt < confirmed.endsAt && slot.endsAt > confirmed.startsAt,
        ),
      ).toBe(false);
    }
    expect(
      (await book(server.address, { ...body, startsAt: confirmed.endsAt })).response!.status,
    ).toBe(201);
  } finally {
    await server.close();
  }
});

test("confirmation validates fields and JSON strictly without binding malformed payloads", async () => {
  const server = await startServer([type], { now: ["2026-11-08T17:00:00Z"] });
  try {
    const key = randomUUID();
    for (const invalid of [
      null,
      [],
      1,
      "bad",
      { ...body, note: null },
      { ...body, guestName: 1 },
      { ...body, guestName: "  " },
      { ...body, guestName: "a".repeat(121) },
      { ...body, guestEmail: "a@b" },
      { ...body, guestEmail: "a".repeat(255) },
      { ...body, note: "a".repeat(2001) },
      { ...body, startsAt: "2026-02-30T03:00:00Z" },
      { ...body, startsAt: "2026-11-09T03:00:60Z" },
      { ...body, startsAt: "2026-11-09T03:00:00+00:00" },
    ]) {
      const response = await fetch(`${server.address}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(invalid),
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status, JSON.stringify(invalid)).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    }
    for (const keyHeader of [undefined, "bad"]) {
      const response = await fetch(`${server.address}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(keyHeader ? { "Idempotency-Key": keyHeader } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "VALIDATION_ERROR",
        fields: [{ field: "Idempotency-Key" }],
      });
    }
    const malformed = await fetch(`${server.address}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: "{",
      signal: AbortSignal.timeout(3000),
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await book(server.address, body, key)).response!.status).toBe(201);
  } finally {
    await server.close();
  }
});

test("confirmation rechecks schedule and binds valid attempted data even after a business failure", async () => {
  const server = await startServer([type], { now: ["2026-11-09T03:00:00Z"] });
  try {
    const cases = [
      [{ ...body, meetingTypeId: "missing" }, 404, "MEETING_TYPE_NOT_FOUND"],
      [body, 409, "SLOT_EXPIRED"],
      [{ ...body, startsAt: "2026-11-23T03:00:00Z" }, 409, "SLOT_OUTSIDE_WINDOW"],
      [{ ...body, startsAt: "2026-11-14T03:00:00Z" }, 400, "INVALID_SLOT"],
      [{ ...body, startsAt: "2026-11-10T01:45:00Z" }, 400, "INVALID_SLOT"],
      [{ ...body, startsAt: "2026-11-10T10:15:00Z" }, 400, "INVALID_SLOT"],
      [{ ...body, startsAt: "2026-11-10T03:01:00Z" }, 400, "INVALID_SLOT"],
      [{ ...body, startsAt: "2026-11-10T03:00:00.0001Z" }, 400, "INVALID_SLOT"],
    ] as const;
    for (const [payload, status, code] of cases) {
      const key = randomUUID();
      const result = await book(server.address, payload, key);
      expect(result.response!.status).toBe(status);
      expect(result.error).toMatchObject({ code });
      const changed = await book(
        server.address,
        { ...body, startsAt: "2026-11-10T04:00:00Z" },
        key,
      );
      expect(changed.error).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    }
    const first = await book(server.address, { ...body, startsAt: "2026-11-10T03:00:00Z" });
    expect(first.response!.status).toBe(201);
    const conflict = await book(server.address, { ...body, startsAt: "2026-11-10T03:30:00Z" });
    expect(conflict.error).toMatchObject({ code: "SLOT_TAKEN" });
    expect(
      (await book(server.address, { ...body, startsAt: "2026-11-10T04:00:00Z" })).response!.status,
    ).toBe(201);
  } finally {
    await server.close();
  }
});
