// Test/owner-preview assets only. Never imported by production frontend code.
export const id = (n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const stamp = "2026-12-15T12:00:00.000Z";
export const event = {
  id: id(1),
  name: "SYNTHETIC Calendar Event A",
  startDate: "2026-12-20",
  endDate: "2026-12-21",
  timezone: "Europe/Sofia",
  archived: false,
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
  membership: { id: id(10), accessRole: "ORGANIZER" },
};
export const other = {
  ...event,
  id: id(2),
  name: "SYNTHETIC Calendar Event B",
  startDate: "2026-12-31",
  endDate: "2027-01-02",
};
export const members = [
  { id: id(10), name: "Synthetic Organizer", role: "Organizer" },
];
export const task = (n, title, deadline, deadlineTime = null) => ({
  id: id(n),
  title,
  deadline,
  deadlineTime,
  reminderOffsets: [],
  category: "Fixture",
  context: "Isolated synthetic UI verification",
  status: "not-started",
  priority: "normal",
  assignedMemberId: null,
  accepted: false,
  acceptedByMemberId: null,
  acceptedAt: null,
  version: 1,
  updatedAt: stamp,
  blockedBy: "",
  blocks: "",
});
export const tasks = [
  task(100, "SYNTHETIC Date only", "2026-12-15"),
  task(101, "SYNTHETIC Local time", "2026-12-15", "09:30"),
  task(102, "SYNTHETIC Midnight", "2026-12-15", "00:00"),
  task(103, "SYNTHETIC End of year", "2026-12-31", "23:59"),
  task(104, "SYNTHETIC New year", "2027-01-01"),
  task(105, "SYNTHETIC Leap day", "2028-02-29"),
];
