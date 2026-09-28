// The local prototype is an editable fictional snapshot, not a live workspace.
// Calendar helpers still receive a normal Date and know nothing about this mode.
export const DEMO_REFERENCE_DATE = "2026-09-07";
export const DEMO_TIME_ZONE = "Europe/Sofia";
// Noon in Varna on the reference date; demo interactions stay in the snapshot.
export const DEMO_REFERENCE_TIMESTAMP = `${DEMO_REFERENCE_DATE}T09:00:00.000Z`;

export function getDemoReferenceNow(): Date {
  // Local noon preserves 7 September in every host timezone. Parsing the date
  // as UTC would move the calendar day backwards in western timezones.
  return new Date(`${DEMO_REFERENCE_DATE}T12:00:00`);
}
