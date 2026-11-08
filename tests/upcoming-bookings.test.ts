import { expect, test } from "vitest";
import { listBookings } from "../generated/api/sdk.gen.ts";
import type { Booking } from "../generated/api/types.gen.ts";
import { startServer } from "./server.ts";

const booking = (id: string, startsAt: string, endsAt: string, type = "intro"): Booking => ({
  id,
  startsAt,
  endsAt,
  meetingTypeId: type,
  meetingTypeTitle: type,
  durationMinutes: 30,
  guestName: "Гость",
  guestEmail: "guest@example.com",
  note: "",
  createdAt: "2026-11-01T00:00:00Z",
});

test("owner receives ongoing and future meetings of every type, ordered by numeric start then ID without a booking window", async () => {
  const ongoing = booking(
    "00000000-0000-4000-8000-000000000002",
    "2026-11-09T02:00:00Z",
    "2026-11-09T02:30:00Z",
  );
  const firstTie = booking(
    "00000000-0000-4000-8000-000000000003",
    "2026-11-09T03:00:00.000Z",
    "2026-11-09T03:30:00Z",
    "review",
  );
  const secondTie = booking(
    "00000000-0000-4000-8000-000000000004",
    "2026-11-09T03:00:00Z",
    "2026-11-09T03:30:00Z",
  );
  const distant = booking(
    "00000000-0000-4000-8000-000000000005",
    "2027-01-04T02:00:00Z",
    "2027-01-04T02:30:00Z",
    "review",
  );
  const server = await startServer([], {
    now: ["2026-11-09T02:15:00Z", "2026-11-09T02:30:00Z"],
    bookings: [
      distant,
      secondTie,
      booking(
        "00000000-0000-4000-8000-000000000006",
        "2026-11-08T02:00:00Z",
        "2026-11-08T02:30:00Z",
      ),
      firstTie,
      ongoing,
      booking(
        "00000000-0000-4000-8000-000000000001",
        "2026-11-09T01:45:00Z",
        "2026-11-09T02:15:00Z",
      ),
    ],
  });
  try {
    const options = {
      baseUrl: server.address,
      throwOnError: true as const,
      signal: AbortSignal.timeout(3000),
    };
    expect((await listBookings(options)).data).toEqual({
      serverNow: "2026-11-09T02:15:00.000Z",
      timeZone: "Asia/Novokuznetsk",
      items: [ongoing, firstTie, secondTie, distant],
    });
    expect((await listBookings(options)).data.items).toEqual([firstTie, secondTie, distant]);
  } finally {
    await server.close();
  }
});
