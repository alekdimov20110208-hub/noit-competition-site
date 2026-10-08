export const REMINDER_OFFSETS = [1440, 60, 15] as const;
export function validReminderOffsets(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    new Set(value).size === value.length &&
    value.every((offset) => REMINDER_OFFSETS.includes(offset))
  );
}
