import { expect, test } from "vitest";
import { getAvailability } from "../generated/api/sdk.gen.ts";
import { startServer } from "./server.ts";

const meetingType = {
  id: "intro",
  title: "Знакомство",
  description: "",
  durationMinutes: 30,
  createdAt: "2026-11-01T00:00:00Z",
};
const request = (address: string, id = meetingType.id) =>
  getAvailability({ baseUrl: address, path: { id }, signal: AbortSignal.timeout(3000) });

test("availability includes all fourteen owner dates, shifts at owner midnight, and excludes exact now", async () => {
  const server = await startServer([meetingType], {
    now: ["2026-11-08T16:59:59.999Z", "2026-11-08T17:00:00.000Z", "2026-11-09T03:15:00.000Z"],
  });
  try {
    const before = await request(server.address);
    expect(before.response!.status).toBe(200);
    expect(before.data).toMatchObject({
      serverNow: "2026-11-08T16:59:59.999Z",
      timeZone: "Asia/Novokuznetsk",
      windowStart: "2026-11-08",
      windowEnd: "2026-11-21",
    });
    expect(before.data!.days).toHaveLength(14);
    expect(before.data!.days[0]).toEqual({ date: "2026-11-08", slots: [] });
    const midnight = await request(server.address);
    expect(midnight.data).toMatchObject({
      serverNow: "2026-11-08T17:00:00.000Z",
      windowStart: "2026-11-09",
      windowEnd: "2026-11-22",
    });
    expect(midnight.data!.days.at(-1)).toEqual({ date: "2026-11-22", slots: [] });
    expect(midnight.data!.days[0].slots[0]).toEqual({
      startsAt: "2026-11-09T02:00:00.000Z",
      endsAt: "2026-11-09T02:30:00.000Z",
    });
    expect(midnight.data!.days[0].slots.at(-1)).toEqual({
      startsAt: "2026-11-09T10:30:00.000Z",
      endsAt: "2026-11-09T11:00:00.000Z",
    });
    const current = await request(server.address);
    expect(current.data!.days[0].slots[0].startsAt).toBe("2026-11-09T03:30:00.000Z");
    expect(
      current
        .data!.days.filter((day) =>
          ["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"].includes(day.date),
        )
        .every((day) => day.slots.length === 0),
    ).toBe(true);
  } finally {
    await server.close();
  }
});

test("actual duration, cross-type occupancy and touching boundaries determine slots", async () => {
  const server = await startServer(
    [
      meetingType,
      { ...meetingType, id: "odd", durationMinutes: 17 },
      { ...meetingType, id: "long", durationMinutes: 1440 },
      { ...meetingType, id: "short", durationMinutes: 1 },
    ],
    {
      now: ["2026-11-08T17:00:00Z"],
      bookings: [
        {
          id: "f6244d25-9c7b-4f84-9006-b879493009af",
          meetingTypeId: "other",
          meetingTypeTitle: "Другой тип",
          durationMinutes: 17,
          startsAt: "2026-11-09T02:00:00Z",
          endsAt: "2026-11-09T02:17:00Z",
          guestName: "Гость",
          guestEmail: "guest@example.com",
          note: "",
          createdAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "9a9a4460-a4b0-455c-a16c-69b740665f53",
          meetingTypeId: "other",
          meetingTypeTitle: "Другой тип",
          durationMinutes: 30,
          startsAt: "2026-11-09T03:00:00Z",
          endsAt: "2026-11-09T03:30:00Z",
          guestName: "Гость",
          guestEmail: "guest@example.com",
          note: "",
          createdAt: "2026-11-01T00:00:00Z",
        },
      ],
    },
  );
  try {
    const odd = (await request(server.address, "odd")).data!;
    expect(odd.days[0].slots.slice(0, 3)).toEqual([
      { startsAt: "2026-11-09T02:30:00.000Z", endsAt: "2026-11-09T02:47:00.000Z" },
      { startsAt: "2026-11-09T03:30:00.000Z", endsAt: "2026-11-09T03:47:00.000Z" },
      { startsAt: "2026-11-09T03:45:00.000Z", endsAt: "2026-11-09T04:02:00.000Z" },
    ]);
    expect(odd.days[0].slots.at(-1)).toEqual({
      startsAt: "2026-11-09T10:30:00.000Z",
      endsAt: "2026-11-09T10:47:00.000Z",
    });
    const standard = (await request(server.address)).data!;
    expect(standard.days[0].slots[0]).toEqual({
      startsAt: "2026-11-09T02:30:00.000Z",
      endsAt: "2026-11-09T03:00:00.000Z",
    });
    expect(standard.days[0].slots[1].startsAt).toBe("2026-11-09T03:30:00.000Z");
    expect(
      (await request(server.address, "long")).data!.days.every((day) => day.slots.length === 0),
    ).toBe(true);
    expect((await request(server.address, "short")).data!.days[0].slots.at(-1)).toEqual({
      startsAt: "2026-11-09T10:45:00.000Z",
      endsAt: "2026-11-09T10:46:00.000Z",
    });
    const missing = await request(server.address, "missing");
    expect(missing.response!.status).toBe(404);
    expect(missing.error).toMatchObject({ code: "MEETING_TYPE_NOT_FOUND" });
    const invalid = await request(server.address, "INVALID");
    expect(invalid.response!.status).toBe(400);
    expect(invalid.error).toMatchObject({ code: "VALIDATION_ERROR" });
  } finally {
    await server.close();
  }
});
