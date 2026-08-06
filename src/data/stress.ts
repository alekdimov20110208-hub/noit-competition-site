import { createDemoWorkspace } from "./demo.ts";
import type {
  EventMilestone,
  EventMilestoneStatus,
  Task,
  TaskPriority,
  TaskStatus,
  WorkspaceState,
} from "../domain/types.ts";

const STRESS_MILESTONE_TITLES = [
  "Потвърждение на измислената зала, всички часови прозорци за достъп и резервната процедура при неочаквана промяна",
  "Проверка на настилката, маршрутите и резервното оборудване",
  "Съгласуване на програмата с измисления гост-инструктор",
  "Преглед на минимално необходимите регистрационни данни",
  "Първа координационна среща на изцяло измисления екип",
  "Заключване на основния транспортен план и неговия резервен вариант",
  "Потвърждение на настаняването и процедурата за късно пристигане",
  "Публикуване на предварителната програма за участниците",
  "Проверка на достъпния вход и маршрута до тренировъчната зона",
  "Разпределяне и потвърждаване на доброволческите смени",
  "Проверка на аптечката и процедурата при инцидент",
  "Тест на регистрационния поток и неговия офлайн резервен вариант",
  "Потвърждение на обозначенията за входове, изходи и съблекални",
  "Финална проверка на звука и съобщенията в измислената зала",
  "Изпращане на подробния участнически инструктаж",
  "Проверка на всички критични зависимости и блокирани задачи",
  "Общ обход на залата с отговорниците за всяка оперативна зона",
  "Финален контролен момент преди изцяло измисленото събитие",
] as const;

const STRESS_MEMBER_NAMES = [
  "Александра Светлозарова-Мирова — измислен персонаж",
  "Константин Добромиров Велинов — измислен персонаж",
  "Екатерина Радославова Николова — измислен персонаж",
  "Николай Теодоров Станчев — измислен персонаж",
  "Виктория Мирославова Денева — измислен персонаж",
] as const;

const STRESS_MEMBER_ROLES = [
  "Главен организатор и координатор на всички оперативни зависимости",
  "Координатор на пътуването, пристигането и резервния транспорт",
  "Координатор на залата, оборудването и достъпните маршрути",
  "Отговорник за регистрацията и подробната комуникация с участниците",
  "Координатор на доброволците, безопасността и резервните сценарии",
] as const;

const STRESS_TASK_STATUSES: readonly TaskStatus[] = [
  "completed",
  "not-started",
  "in-progress",
  "blocked",
];

const STRESS_TASK_PRIORITIES: readonly TaskPriority[] = [
  "normal",
  "important",
  "critical",
];

function formatStressDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function getMilestoneStatus(index: number): EventMilestoneStatus {
  if (index < 5) return "completed";
  if (index === 5) return "current";
  return "upcoming";
}

function createStressMilestones(): EventMilestone[] {
  return STRESS_MILESTONE_TITLES.map((title, index) => ({
    id: `stress-milestone-${String(index + 1).padStart(2, "0")}`,
    title,
    date: formatStressDate(2026, 6, 3 + index * 4),
    status: getMilestoneStatus(index),
  }));
}

function createAdditionalStressTasks(
  eventId: string,
  ownerIds: string[],
): Task[] {
  return Array.from({ length: 28 }, (_, index) => {
    const taskNumber = index + 1;
    const status = STRESS_TASK_STATUSES[index % STRESS_TASK_STATUSES.length];
    const priority =
      STRESS_TASK_PRIORITIES[index % STRESS_TASK_PRIORITIES.length];
    const ownerId = ownerIds[index % ownerIds.length] ?? ownerIds[0] ?? "";

    return {
      id: `stress-task-${String(taskNumber).padStart(2, "0")}`,
      eventId,
      title: `Синтетична задача ${taskNumber}: потвърждаване на изключително дълго оперативно заглавие, което трябва да се пренася правилно на тесни екрани без да измества действията и статуса`,
      category:
        index % 2 === 0
          ? "Измислена оперативна координация"
          : "Измислен резервен сценарий",
      ownerId,
      deadline: formatStressDate(2026, 7, 1 + index * 2),
      status,
      priority,
      context:
        "Това е изцяло синтетично и умишлено дълго описание за проверка на пренасянето на български текст. То обяснява последиците, зависимостите и следващия контролен момент, без да съдържа истински хора, места, контакти или сведения от интервю.",
      ...(status === "blocked"
        ? {
            blockedBy:
              "Измислено външно потвърждение с дълго наименование, което все още липсва",
          }
        : {}),
      ...(index % 5 === 0
        ? {
            blocks:
              "Следваща синтетична задача, участнически инструктаж и резервен оперативен план",
          }
        : {}),
      acknowledged: index % 3 !== 0,
      updatedAt: new Date(
        Date.UTC(2026, 6, 20 + (index % 10), 8 + (index % 8)),
      ).toISOString(),
    };
  });
}

/**
 * Creates an intentionally dense, entirely fictional workspace for layout and
 * selector stress tests. It is never used as the persisted demonstration seed.
 */
export function createStressWorkspace(): WorkspaceState {
  const base = createDemoWorkspace();
  const currentEvent =
    base.events.find((event) => event.id === base.currentEventId) ??
    base.events[0];

  if (!currentEvent) return base;

  const teamMembers = base.teamMembers.map((member, index) => ({
    ...member,
    name: STRESS_MEMBER_NAMES[index] ?? member.name,
    role: STRESS_MEMBER_ROLES[index] ?? member.role,
  }));
  const additionalTasks = createAdditionalStressTasks(
    currentEvent.id,
    teamMembers.map((member) => member.id),
  );
  const existingTasks = base.tasks.map((task, index) =>
    index < 4
      ? {
          ...task,
          title: `${task.title} — синтетично разширение с много дълго заглавие за проверка на надеждното пренасяне при 320 пиксела`,
          context: `${task.context} Това допълнение е измислено и нарочно дълго, за да провери дали основното съдържание запазва приоритет пред метаданните и контролите.`,
        }
      : task,
  );
  const tasks = [...existingTasks, ...additionalTasks];
  const stressAffectedTaskIds = additionalTasks
    .slice(0, 9)
    .map((task) => task.id);

  return {
    ...base,
    demoLabel:
      "SYNTHETIC STRESS FIXTURE · FICTIONAL DATA ONLY · no real people, venues, contacts, or interview details",
    events: base.events.map((event) =>
      event.id === currentEvent.id
        ? {
            ...event,
            name: "Изцяло измислен международен семинар по бойни изкуства с необичайно дълго име за проверка на адаптивното оформление — Варна 2026",
            location:
              "Измислена многофункционална тренировъчна зала „Северен хоризонт“, Варна, България",
            guestInstructor:
              "Александър Примеров Дългоименов — измислен гост-инструктор",
            milestones: createStressMilestones(),
          }
        : event,
    ),
    teamMembers,
    tasks,
    changes: base.changes.map((change, index) =>
      index === 0
        ? {
            ...change,
            title:
              "Изцяло измислена критична промяна с дълго заглавие, която засяга транспорта, настаняването, програмата и комуникацията",
            description:
              "Това синтетично описание е нарочно продължително, за да провери представянето на оперативното въздействие, засегнатите области, свързаните задачи и следващия контролен момент върху тесни и широки екрани.",
            affectedTaskIds: [
              ...change.affectedTaskIds,
              ...stressAffectedTaskIds,
            ],
            affectedAreas: [
              ...change.affectedAreas,
              "Измислена много дълга засегната оперативна област",
              "Резервна комуникация и координация",
            ],
            response:
              "Проверете синтетичните зависимости, потвърдете измислените отговорници и отчетете следващия контролен момент преди публикуване на актуализирания план.",
          }
        : change,
    ),
  };
}
