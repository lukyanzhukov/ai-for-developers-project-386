import "@typespec/http";
import "@typespec/openapi3";
using TypeSpec.Http;

@service(#{ title: "Call Calendar API" })
namespace CallCalendar;

model Health {
  status: "ok";
}

@route("/api/health")
@get
op getHealth(): Health;

@minLength(1)
@maxLength(64)
@pattern("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
@doc("Unique across all meeting types. Trim outer whitespace before validation; do not change case.")
scalar MeetingTypeId extends string;

@format("uuid")
scalar Uuid extends string;

@pattern("Z$")
@format("date-time")
@doc("An absolute instant in UTC, with a Z suffix.")
scalar UtcInstant extends string;

@minLength(1)
@maxLength(120)
@doc("Trim outer whitespace before validation; whitespace-only values are invalid.")
scalar Name extends string;

@maxLength(2000)
@doc("Plain text, never interpreted as HTML. Preserve internal whitespace and line breaks.")
scalar Note extends string;

@minValue(1)
@maxValue(1440)
scalar DurationMinutes extends int32;

@format("email")
@maxLength(254)
@doc("Required email address, trimmed before validation; delivery is not verified.")
scalar GuestEmail extends string;

model MeetingType {
  id: MeetingTypeId;
  title: Name;
  description: Note;
  durationMinutes: DurationMinutes;
  createdAt: UtcInstant;
}

@doc("Omit id to generate a random UUID. An explicitly empty id and null values are invalid. Omitted description becomes an empty string. Duplicate titles are allowed; the UI warns using the public list.")
model CreateMeetingType {
  id?: MeetingTypeId;
  title: Name;
  description?: Note;
  durationMinutes: DurationMinutes;
}

model MeetingTypeList {
  @doc("All types, ordered by creation time ascending, then id. New types are published immediately.")
  items: MeetingType[];
}

model Slot {
  startsAt: UtcInstant;
  endsAt: UtcInstant;
}

model AvailabilityDay {
  date: plainDate;
  @doc("Free slots in ascending start order; empty on non-working or fully occupied dates.")
  slots: Slot[];
}

@doc("Today and the next 13 calendar dates in the owner's time zone. Mon–Fri 09:00–18:00; starts every 15 minutes from 09:00. Starts must be strictly after serverNow, the whole interval must fit working hours, and overlaps with bookings of every type are excluded. Touching boundaries are allowed, without a buffer. No holidays or exceptions.")
model Availability {
  serverNow: UtcInstant;
  timeZone: "Asia/Novokuznetsk";
  windowStart: plainDate;
  windowEnd: plainDate;
  @minItems(14)
  @maxItems(14)
  @doc("All 14 dates, ascending, including dates with no slots. Window boundaries are inclusive.")
  days: AvailabilityDay[];
}

model CreateBooking {
  meetingTypeId: MeetingTypeId;
  @doc("A start from the availability grid. The server calculates duration and end from the meeting type and revalidates availability at save time.")
  startsAt: UtcInstant;
  guestName: Name;
  guestEmail: GuestEmail;
  note?: Note;
}

model Booking {
  id: Uuid;
  meetingTypeId: MeetingTypeId;
  meetingTypeTitle: Name;
  durationMinutes: DurationMinutes;
  startsAt: UtcInstant;
  endsAt: UtcInstant;
  guestName: Name;
  guestEmail: GuestEmail;
  @doc("Empty string if no note was supplied.")
  note: Note;
  createdAt: UtcInstant;
}

model BookingList {
  serverNow: UtcInstant;
  timeZone: "Asia/Novokuznetsk";
  @doc("All types, endsAt > serverNow, ordered by startsAt then id, without a 14-day limit. In-progress bookings are included. No pagination. Public without authentication; refreshed on opening or manually.")
  items: Booking[];
}

model FieldError {
  field: string;
  message: string;
}

model ApiError<Code extends string> {
  code: Code;
  message: string;
}

model ValidationError extends ApiError<"VALIDATION_ERROR"> {
  @doc("Present only when errors relate to specific fields, including headers.")
  fields?: FieldError[];
}

model JsonResponse<Status, Value> {
  @statusCode statusCode: Status;
  @body body: Value;
}

@error
model ValidationFailure is JsonResponse<400, ValidationError>;

@error
model TypeNotFound is JsonResponse<404, ApiError<"MEETING_TYPE_NOT_FOUND">>;

@error
model IdAlreadyExists is JsonResponse<409, ApiError<"ID_ALREADY_EXISTS">>;

@error
model InvalidSlot is JsonResponse<400, ApiError<"INVALID_SLOT">>;

@error
model BookingConflict is JsonResponse<409, ApiError<"SLOT_TAKEN" | "SLOT_EXPIRED" | "SLOT_OUTSIDE_WINDOW" | "IDEMPOTENCY_CONFLICT">>;

@error
model InternalFailure is JsonResponse<500, ApiError<"INTERNAL_ERROR">>;

@route("/api/meeting-types")
@get
op listMeetingTypes(): MeetingTypeList | InternalFailure;

@route("/api/meeting-types")
@post
op createMeetingType(@body body: CreateMeetingType): JsonResponse<201, MeetingType> | ValidationFailure | IdAlreadyExists | InternalFailure;

@route("/api/meeting-types/{id}/availability")
@get
op getAvailability(@path id: MeetingTypeId): Availability | ValidationFailure | TypeNotFound | InternalFailure;

@doc("Atomically validate and save without overlaps across any meeting types, including concurrent requests. One in-memory server process only; types, bookings and idempotency state reset on restart. Bind the key to the first valid payload. Recognize a completed identical retry before checking slot availability and return the same booking with 200; first creation returns 201. Concurrent identical retries create one booking. Different payload with the same key returns IDEMPOTENCY_CONFLICT. A changed slot or guest data requires a new key. Missing/malformed fields or key return VALIDATION_ERROR; off-grid or outside working hours returns INVALID_SLOT. Missing type returns MEETING_TYPE_NOT_FOUND; elapsed, outside-window and occupied slots return the corresponding 409 codes. Failures never overwrite an existing booking.")
@route("/api/bookings")
@post
op createBooking(
  @header("Idempotency-Key") idempotencyKey: Uuid,
  @body body: CreateBooking,
): JsonResponse<201, Booking> | JsonResponse<200, Booking> | ValidationFailure | InvalidSlot | TypeNotFound | BookingConflict | InternalFailure;

@route("/api/bookings")
@get
op listBookings(): BookingList | InternalFailure;
