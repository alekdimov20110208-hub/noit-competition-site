// An Event-local wall-clock value, never an instant or a reminder schedule.
export function isTaskDeadlineTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
