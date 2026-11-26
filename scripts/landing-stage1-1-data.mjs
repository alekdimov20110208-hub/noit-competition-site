// Local review transport records. No real people, credentials or database.
export const id = (n) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function syntheticData(language = "bg") {
  const bg = language === "bg";
  const stamp = "2026-11-25T10:00:00Z";
  const members = [
    {
      id: id(11),
      name: bg ? "Мира" : "Mira",
      role: bg ? "Координация" : "Coordination",
    },
    {
      id: id(12),
      name: bg ? "Алекс" : "Alex",
      role: bg ? "Зала и оборудване" : "Venue and equipment",
    },
    {
      id: id(13),
      name: bg ? "Ива" : "Iva",
      role: bg ? "Посрещане" : "Welcome desk",
    },
  ];
  const event = {
    id: id(1),
    name: bg ? "Зимен айкидо семинар" : "Winter Aikido seminar",
    startDate: "2026-12-04",
    endDate: "2026-12-06",
    timezone: "Europe/Sofia",
    archived: false,
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
    membership: { id: id(11), accessRole: "ORGANIZER" },
  };
  const titles = bg
    ? [
        "Потвърди достъпа до залата",
        "Уточни трансфера на инструктора",
        "Подготви татами и оборудване",
        "Изпрати програмата на участниците",
        "Провери регистрационната маса",
        "Потвърди настаняването",
        "Съгласувай тренировъчната програма",
        "Разпредели дежурствата на екипа",
      ]
    : [
        "Confirm access to the training hall",
        "Coordinate the instructor transfer",
        "Prepare tatami and equipment",
        "Send the programme to participants",
        "Check the welcome desk",
        "Confirm accommodation",
        "Confirm the training programme",
        "Assign team duties",
      ];
  const statuses = [
    "blocked",
    "in-progress",
    "in-progress",
    "not-started",
    "not-started",
    "completed",
    "completed",
    "completed",
  ];
  const tasks = titles.map((title, i) => ({
    id: id(100 + i),
    title,
    category: bg
      ? i < 3
        ? "Логистика"
        : "Подготовка"
      : i < 3
        ? "Logistics"
        : "Preparation",
    context: bg
      ? "Подготовка за зимния айкидо семинар. Съгласувайте подробностите с екипа."
      : "Prepare for the winter Aikido seminar. Coordinate details with the team.",
    deadline: [
      "2026-11-24",
      "2026-11-25",
      "2026-12-03",
      "2026-11-28",
      "2026-12-03",
      "2026-11-20",
      "2026-11-22",
      "2026-11-23",
    ][i],
    deadlineTime: i === 1 ? "16:00" : null,
    reminderOffsets: [],
    status: statuses[i],
    priority: i === 0 ? "critical" : i < 3 ? "important" : "normal",
    assignedMemberId: members[i % 3].id,
    accepted: i !== 4,
    acceptedByMemberId: i !== 4 ? members[i % 3].id : null,
    acceptedAt: i !== 4 ? stamp : null,
    version: 1,
    updatedAt: stamp,
    blockedBy:
      i === 0
        ? bg
          ? "Залата отваря час по-късно."
          : "The hall opens an hour later."
        : "",
    blocks: "",
  }));
  const affectedTasks = tasks.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    deadline: t.deadline,
    deadlineTime: t.deadlineTime,
    assignedMember: members.find((m) => m.id === t.assignedMemberId),
  }));
  const changes = [
    {
      id: id(200),
      eventId: event.id,
      title: bg ? "Залата отваря час по-късно" : "The hall opens an hour later",
      context: bg
        ? "Промяната засяга подготовката на татамито и посрещането на инструктора."
        : "The change affects tatami preparation and the instructor's welcome.",
      reporter: members[1],
      responseOwner: members[0],
      decision: {
        text: bg
          ? "Преместваме подреждането на татамито за 09:00."
          : "Move tatami setup to 09:00.",
        authoredBy: members[0],
        createdAt: stamp,
        updatedAt: stamp,
      },
      response: bg
        ? "Алекс потвърждава достъпа. Ива уведомява екипа."
        : "Alex confirms access. Iva informs the team.",
      planB: bg
        ? "При допълнително забавяне използваме малката зала."
        : "Use the smaller hall if access is delayed further.",
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      affectedTasks,
      impact: {
        taskCount: 3,
        people: members,
        deadlines: affectedTasks.map((t) => t.deadline),
      },
    },
  ];
  return {
    event,
    members,
    tasks,
    changes,
    user: {
      id: "SYNTHETIC_REVIEW_USER",
      name: bg ? "Мира · демо" : "Mira · demo",
      email: "demo@example.invalid",
    },
  };
}
